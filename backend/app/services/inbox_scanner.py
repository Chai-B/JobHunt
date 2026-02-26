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
        
        # Look back 1 extra day to avoid missing emails due to sync timing or timezone offsets
        after_date = (watermark - timedelta(days=1)).strftime("%Y/%m/%d")
        query = f"after:{after_date} (subject:interview OR subject:application OR subject:update OR subject:offer OR subject:status OR from:linkedin)"
        logger.info(f"Gmail Query: {query}")
        
        results = self.service.users().messages().list(userId='me', q=query, maxResults=max_results).execute()
        messages = results.get('messages', [])
        logger.info(f"Found {len(messages)} potential emails matching query criteria.")
        
        email_data = []
        def get_body_recursive(p):
            inner_body = ""
            if p.get('mimeType') == 'text/plain' and 'data' in p.get('body', {}):
                try:
                    raw_data = base64.urlsafe_b64decode(p['body']['data'])
                    inner_body += raw_data.decode('utf-8', errors='replace')
                except Exception as e:
                    logger.warning(f"Failed to decode part: {e}")
            
            if 'parts' in p:
                for part in p['parts']:
                    inner_body += get_body_recursive(part)
            return inner_body

        for i, msg in enumerate(messages):
            try:
                logger.info(f"Processing email {i+1}/{len(messages)} [ID: {msg['id']}]")
                msg_full = self.service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                payload = msg_full.get('payload', {})
                headers = payload.get('headers', [])
                
                subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "No Subject")
                sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), "Unknown")
                date = next((h['value'] for h in headers if h['name'].lower() == 'date'), "Unknown")
                
                body = get_body_recursive(payload)
                    
                email_data.append({
                    "id": msg['id'],
                    "subject": subject,
                    "sender": sender,
                    "date": date,
                    "body": body[:5000] # Increased context slightly for better heuristics
                })
            except Exception as e:
                logger.error(f"Error fetching detail for email {msg['id']}: {e}")
                
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
            
            from app.db.models.action_log import ActionLog
            log_start = ActionLog(user_id=user_id, action_type="scraper", status="running", message="Running Heuristic Inbox Sync")
            db.add(log_start)
            await db.commit()
            
            for email in emails:
                text_to_check = (email['subject'] + " " + email['body']).lower()
                sender = email['sender'].lower()
                subject_lower = email['subject'].lower()
                
                # Heuristic 1: Extract Company Name, Role, and Location
                extracted_company = None
                extracted_role = None
                extracted_location = None
                
                # Role Extraction from Subject
                # e.g., "Application for Software Engineer", "Your application to Meta for Data Scientist"
                role_match = re.search(r'application for (.+?)(?: at |$)|application to .+? for (.+?)$|interest in the (.+?) position', subject_lower)
                if role_match:
                    groups = [g for g in role_match.groups() if g]
                    if groups:
                        extracted_role = groups[0].strip().title()

                # Location Heuristics
                if "remote" in text_to_check:
                    extracted_location = "Remote"
                else:
                    # Look for specific city patterns if needed, but default to Remote/Hybrid check for now
                    loc_match = re.search(r'based in (.+?)(?:\.|,|$)|location: (.+?)(?:\.|,|$)', text_to_check)
                    if loc_match:
                        groups = [g for g in loc_match.groups() if g]
                        if groups:
                            extracted_location = groups[0].strip().title()

                # Company Extraction (Existing Logic...)
                # Check 1: LinkedIn Easy Apply & Generic Application Confirmations
                # Subject examples: "Your application to Stripe was sent", "Application for Software Engineer at Meta", "We have received your application for Google"
                app_subject_match = re.search(r'application to (.+?) (?:was sent|for)|application for .+? at (.+?)\b|application for (.+?)\b|applying to (.+?)\b|interest in (.+?)\b', subject_lower)
                if app_subject_match:
                    # Filter out the capture groups to find the actual match
                    groups = [g for g in app_subject_match.groups() if g]
                    # The company is usually the last match in our generic OR groups above ("Stripe", "Meta", "Google")
                    if groups:
                        extracted_company = groups[-1].strip().title()

                # Check 2: Try simple domain extraction and ATS Filtering
                if not extracted_company:
                    domain_match = re.search(r'@([\w.-]+)\.', sender)
                    
                    # ATS domains and job boards that hide the real company
                    ignore_domains = ["gmail", "yahoo", "hotmail", "outlook", "greenhouse", "lever", "workday", "ashbyhq", "myworkday", "linkedin", "bamboohr", "talent", "recruiting", "smartrecruiters", "icims", "jobvite", "breezy", "angel", "wellfound"]
                    
                    if domain_match:
                        domain = domain_match.group(1).lower()
                        if domain not in ignore_domains:
                            extracted_company = domain.title()
                
                # Check 3: If domain is ATS or generic (like LinkedIn/Greenhouse), look at the Sender Name
                # e.g., "Stripe via Greenhouse" or "Recruiting | Meta"
                if not extracted_company:
                    name_part = sender.split('<')[0].strip().lower()
                    
                    # Try to strip "via ATS" syntax
                    via_match = re.search(r'(.+?) via |recruiting [\-\|] (.+?)$|(.+?) recruiting', name_part)
                    if via_match:
                        groups = [g for g in via_match.groups() if g]
                        if groups:
                            extracted_company = groups[-1].strip().title()
                    
                    # Fallback to checking against our DB known companies
                    if not extracted_company:
                        for c_name in known_companies.keys():
                            if c_name in name_part or c_name in subject_lower:
                                extracted_company = known_companies[c_name].company_name
                                break

                # Final validation block
                if not extracted_company or extracted_company.lower() in ("unknown", "linkedin", "greenhouse", "application", "software engineer", "resume"):
                    continue # Cannot bind this email to any tracked jobs
                
                # Bind to application or CREATE ONE natively
                target_app = known_companies.get(extracted_company.lower())
                
                if not target_app:
                    # Fuzzy match just in case
                    target_app = next((a for c, a in known_companies.items() if c in extracted_company.lower() or extracted_company.lower() in c), None)
                
                # If STILL no match, auto-create the Application row so the user doesn't lose the data!
                if not target_app:
                    logger.info(f"Auto-creating missing application for: {extracted_company}")
                    
                    # Extract contact details from sender: "Name <email@example.com>"
                    contact_email = None
                    contact_name = None
                    email_match = re.search(r'<(.*?)>', email['sender'])
                    if email_match:
                        contact_email = email_match.group(1).strip()
                        contact_name = email['sender'].split('<')[0].strip()
                    else:
                        contact_email = email['sender'].strip()
                        contact_name = contact_email.split('@')[0]

                    # Heuristic for Source (e.g., LinkedIn, Indeed)
                    source_url = None
                    if "linkedin" in email['sender'].lower() or "linkedin" in email['body'].lower():
                        source_url = "https://www.linkedin.com"
                    
                    target_app = Application(
                        user_id=user_id,
                        job_id=None,
                        company_name=extracted_company,
                        application_type="Discovered (Email)",
                        status="applied",
                        contact_name=contact_name,
                        contact_email=contact_email,
                        contact_role=extracted_role,
                        location=extracted_location,
                        source_url=source_url,
                        notes=f"Auto-imported by Heuristic Engine from Gmail on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
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
            
            log_start.status = "success"
            log_start.message = f"Heuristic Inbox Sync completed. Integrated {matched_count} new updates."
            db.add(log_start)
            
            await db.commit()
            logger.info(f"Inbox Scan completed for User {user_id}. Integrated {matched_count} new timeline nodes.")
            
        except Exception as e:
            logger.error(f"Inbox Scanner failed for User {user_id}: {e}")
            if 'log_start' in locals():
                log_start.status = "failed"
                log_start.message = f"Heuristic Inbox Sync failed: {str(e)}"
                db.add(log_start)
                await db.commit()
