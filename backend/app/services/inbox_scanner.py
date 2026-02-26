import asyncio
from loguru import logger
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import base64
import json

from datetime import datetime, timedelta, timezone
import re

from app.core.config import settings
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.db.models.application import Application
from app.db.session import AsyncSessionLocal

class InboxScanner:
    def __init__(self, access_token: str, refresh_token: str):
        self.creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=getattr(settings, "GOOGLE_CLIENT_ID", "dummy_client_id"),
            client_secret=getattr(settings, "GOOGLE_CLIENT_SECRET", "dummy_client_secret")
        )
        self.service = build('gmail', 'v1', credentials=self.creds)

    def fetch_recent_emails(self, watermark: datetime = None, max_results=100):
        # Default to 6 months ago if no watermark
        if not watermark:
            watermark = datetime.now(timezone.utc) - timedelta(days=180)
        
        after_date = watermark.strftime("%Y/%m/%d")
        query = f"after:{after_date} (subject:interview OR subject:application OR subject:update OR subject:offer OR subject:status OR from:linkedin)"
        logger.info(f"Gmail Query: {query}")
        results = self.service.users().messages().list(userId='me', q=query, maxResults=max_results).execute()
        messages = results.get('messages', [])
        
        email_data = []
        for msg in messages:
            try:
                msg_full = self.service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                payload = msg_full.get('payload', {})
                headers = payload.get('headers', [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
                sender = next((h['value'] for h in headers if h['name'] == 'From'), "Unknown")
                date = next((h['value'] for h in headers if h['name'] == 'Date'), "Unknown")
                
                body = ""
                # recursive search for body
                if 'parts' in payload:
                    for part in payload['parts']:
                        if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                            body += base64.urlsafe_b64decode(part['body']['data']).decode()
                        elif 'parts' in part:
                            # 1 layer deeper
                            for subpart in part['parts']:
                                if subpart['mimeType'] == 'text/plain' and 'data' in subpart['body']:
                                    body += base64.urlsafe_b64decode(subpart['body']['data']).decode()
                elif 'data' in payload.get('body', {}):
                    body = base64.urlsafe_b64decode(payload['body']['data']).decode()
                    
                email_data.append({
                    "id": msg['id'],
                    "subject": subject,
                    "sender": sender,
                    "date": date,
                    "body": body[:2000] # limit context for LLM cost and speed
                })
            except Exception as e:
                logger.error(f"Error fetching email {msg['id']}: {e}")
                
        return email_data

async def run_inbox_scanner_async(user_id: int):
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
        user_settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))).scalars().first()
        
        if not user_settings or not getattr(user_settings, 'gmail_access_token', None):
            logger.info(f"User {user_id} does not have Gmail connected for scanning.")
            return

        logger.info(f"Starting Heuristic Inbox Scanner for User {user_id}")
        try:
            scanner = InboxScanner(user_settings.gmail_access_token, getattr(user_settings, 'gmail_refresh_token', ''))
            
            # Use tracked watermark
            watermark = user_settings.last_inbox_sync_time
            emails = scanner.fetch_recent_emails(watermark=watermark, max_results=50)
            
            # Fetch existing applications
            apps_result = await db.execute(select(Application).where(Application.user_id == user_id))
            applications = apps_result.scalars().all()
            
            # Build fast lookup for company matching
            known_companies = {a.company_name.lower().strip(): a for a in applications if a.company_name}
            
            status_heuristics = {
                "rejected": [r"unfortunately", r"not moving forward", r"other candidates", r"regret to inform"],
                "offer": [r"offer", r"congratulations", r"compensation package", r"letter"],
                "interviewing": [r"interview", r"schedule", r"availability", r"next steps", r"invite", r"chat", r"call", r"calendly", r"assessment", r"online test", r"hacker rank", r"hackerrank"],
                "applied": [r"received", r"thank you for applying", r"confirmed"]
            }

            matched_count = 0
            for email in emails:
                text_to_check = (email['subject'] + " " + email['body']).lower()
                sender = email['sender'].lower()
                
                # Heuristic 1: Extract Company Name
                extracted_company = None
                
                # Try simple domain extraction first
                domain_match = re.search(r'@([\w.-]+)\.', sender)
                
                # ATS domains that hide the real company
                ignore_domains = ["gmail", "yahoo", "hotmail", "outlook", "greenhouse", "lever", "workday", "ashbyhq", "myworkday", "linkedin", "bamboohr", "talent", "recruiting", "smartrecruiters", "icims", "jobvite"]
                
                if domain_match:
                    domain = domain_match.group(1).lower()
                    if domain not in ignore_domains:
                        extracted_company = domain.title()
                
                # If domain is ATS or generic (like LinkedIn), try looking at the Sender Name or Subject
                if not extracted_company:
                    name_part = sender.split('<')[0].strip().lower()
                    subject_lower = email['subject'].lower()
                    
                    # 1. Check known companies first
                    for c_name in known_companies.keys():
                        if c_name in name_part or c_name in subject_lower:
                            extracted_company = known_companies[c_name].company_name
                            break
                    
                    # 2. LinkedIn Easy Apply fallback: "Your application to [Company] was sent"
                    if not extracted_company and "linkedin" in sender:
                        match = re.search(r'application to (.+?) was sent|viewed your application for (.+?)\b|application for (.+?) at (.+?)\b', subject_lower)
                        if match:
                            extracted_company = next((m for m in match.groups() if m), "Unknown").strip().title()

                if not extracted_company or extracted_company.lower() in ("unknown", "linkedin", "greenhouse"):
                    continue # Cannot bind this email to any tracked jobs
                
                # Bind to application or CREATE ONE
                target_app = known_companies.get(extracted_company.lower())
                
                if not target_app:
                    # Fuzzy match just in case
                    target_app = next((a for c, a in known_companies.items() if c in extracted_company.lower() or extracted_company.lower() in c), None)
                
                # If STILL no match, auto-create the Application row so the user doesn't lose the data!
                if not target_app:
                    logger.info(f"Auto-creating missing application for: {extracted_company}")
                    target_app = Application(
                        user_id=user_id,
                        company_name=extracted_company,
                        application_type="Discovered (Email)",
                        status="applied",
                        notes=f"Auto-imported from Gmail on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
                    )
                    db.add(target_app)
                    await db.flush() # get ID
                    known_companies[extracted_company.lower()] = target_app

                # Heuristic 2: Status Matching
                detected_status = None
                # Check in order of priority (Offer -> Rejected -> Interviewing -> Applied)
                for s in ["offer", "rejected", "interviewing", "applied"]:
                    # Removed word boundaries \b to allow sub-string matches like "offered" or "scheduling"
                    if any(kw in text_to_check for kw in status_heuristics[s]):
                        detected_status = s
                        break
                        
                if detected_status:
                    logger.info(f"Match found for {extracted_company}. Status: {detected_status}")
                    # Rank maps
                    ranks = {"applied": 1, "interviewing": 2, "rejected": 3, "offer": 4}
                    curr_rank = ranks.get(target_app.status, 0)
                    new_rank = ranks.get(detected_status, 0)
                    
                    if new_rank > curr_rank or detected_status == "rejected":
                        target_app.status = detected_status
                    
                    # Generate Timeline Node
                    existing_notes = target_app.notes or ""
                    sender_clean = sender.split('<')[0].strip()
                    if str(email['id']) not in existing_notes:
                        timeline_node = f"\n[{email['date'][:16]}] {sender_clean}: {email['subject']}  -> (Status: {detected_status.upper()}) [ID: {email['id']}]"
                        target_app.notes = existing_notes + timeline_node
                        db.add(target_app)
                        matched_count += 1
            
            from sqlalchemy.sql import func
            user_settings.last_inbox_sync_time = func.now()
            db.add(user_settings)
            
            await db.commit()
            logger.info(f"Inbox Scan completed for User {user_id}. Integrated {matched_count} new timeline nodes.")
            
        except Exception as e:
            logger.error(f"Inbox Scanner failed for User {user_id}: {e}")
