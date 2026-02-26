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
from app.services.llm import call_llm

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
                "assessment": [r"case study", r"pre-hiring evaluation", r"test", r"task", r"assignment", r"presentation", r"shortlisted for hr round 1"],
                "interviewed": [r"interview", r"schedule", r"huddle", r"meeting room", r"timings", r"office address", r"round 1"],
                "rejected": [r"not moving forward", r"unfortunate", r"wish you all the best", r"another candidate", r"won't be able to move forward", r"not move forward"],
                "selected": [r"offer", r"congratulations", r"onboard", r"welcome", r"hired", r"package", r"selected"],
                "applied": [r"received", r"thank you for applying", r"application was sent", r"confirmed", r"interest in the"]
            }

            matched_count = 0
            
            from app.db.models.action_log import ActionLog
            log_start = ActionLog(user_id=user_id, action_type="scraper", status="running", message="Running Heuristic Inbox Sync")
            db.add(log_start)
            await db.commit()
            
            for email in emails:
                logger.info(f"Analyzing email: {email['subject']} from {email['sender']}")
                
                # LLM-Powered Extraction
                extraction_json = None
                system_prompt = """You are an elite Recruitment Data Agent. 
Extract structured job application data from the email provided.
Return ONLY a valid JSON object with these keys:
- company_name: (string) The hiring company.
- role: (string) The job title (e.g., "Machine Learning Engineer").
- location: (string) Location (e.g., "Remote", "Gurgaon").
- contact_name: (string) Name of the recruiter/sender.
- contact_email: (string) Email of the recruiter.
- status: (string) STRICTLY one of: [applied, interviewed, assessment, rejected, selected].
- source: (string) e.g., "LinkedIn", "Direct".

Status Mapping Guide:
- 'applied': Thank you for applying, received application.
- 'interviewed': Scheduling interview, invitation to chat, meeting link, huddle, round 1, round 2.
- 'assessment': Case study, pre-hiring evaluation, test, assignment, presentation.
- 'rejected': Not moving forward, unfortunately, wish you best, another candidate.
- 'selected': Offer, congratulations, welcome onboard, hired.
"""
                prompt = f"Subject: {email['subject']}\nSender: {email['sender']}\nBody:\n{email['body']}"
                
                try:
                    raw_llm = await call_llm(prompt, user_settings, is_json=True, system_prompt=system_prompt)
                    extraction_json = json.loads(raw_llm)
                    logger.info(f"LLM Extraction Success: {extraction_json.get('company_name')} -> {extraction_json.get('status')}")
                except Exception as e:
                    logger.warning(f"LLM extraction failed for email {email['id']}: {e}. Falling back to heuristics.")

                # Metadata Assignment (LLM or Heuristic Fallback)
                if extraction_json:
                    extracted_company = (extraction_json.get('company_name') or '').strip().title()
                    extracted_role = (extraction_json.get('role') or '').strip().title()
                    extracted_location = (extraction_json.get('location') or '').strip().title()
                    detected_status = (extraction_json.get('status') or '').lower()
                    contact_name = extraction_json.get('contact_name')
                    contact_email = extraction_json.get('contact_email')
                    source_url = "https://www.linkedin.com" if extraction_json.get('source') == "LinkedIn" else None
                else:
                    # HEURISTIC FALLBACK (Keep previous logic but simplify)
                    text_to_check = (email['subject'] + " " + email['body']).lower()
                    sender = email['sender'].lower()
                    subject_lower = email['subject'].lower()
                    
                    extracted_company = None
                    extracted_role = None
                    extracted_location = None
                    detected_status = None

                    # Simplistic regex fallback
                    app_subject_match = re.search(r'application to (.+?) (?:was sent|for)|application for .+? at (.+?)\b|update from (.+?)(?:\s|$)|sent to (.*?)(?:\s|$)', subject_lower)
                    if app_subject_match:
                        groups = [g for g in app_subject_match.groups() if g]
                        extracted_company = groups[-1].strip().title()
                    
                    for s in ["selected", "rejected", "assessment", "interviewed", "applied"]:
                        if any(kw in text_to_check for kw in status_heuristics.get(s, [])):
                            detected_status = s
                            break

                # Final validation block
                if not extracted_company or extracted_company.lower() in ("unknown", "linkedin", "greenhouse"):
                    continue 
                
                # Bind or Auto-Create (Robust Deduplication)
                target_app = known_companies.get(extracted_company.lower())
                if not target_app:
                    # Search for existing company in DB if not in local cache or do fuzzy lookup
                    target_app = next((a for c, a in known_companies.items() if (c in extracted_company.lower() or extracted_company.lower() in c) and len(c) > 3), None)
                
                if not target_app:
                    logger.info(f"Auto-creating missing application for: {extracted_company}")
                    
                    # Fallback contact extraction if LLM failed
                    if not extraction_json:
                        email_match = re.search(r'<(.*?)>', email['sender'])
                        if email_match:
                            contact_email = email_match.group(1).strip()
                            contact_name = email['sender'].split('<')[0].strip()
                        else:
                            contact_email = email['sender'].strip()
                            contact_name = contact_email.split('@')[0]
                    
                    target_app = Application(
                        user_id=user_id,
                        company_name=extracted_company,
                        application_type="Discovered (Email)",
                        status=detected_status or "applied",
                        contact_name=contact_name,
                        contact_email=contact_email,
                        contact_role=extracted_role,
                        location=extracted_location,
                        source_url=source_url if 'source_url' in locals() else None,
                        notes=f"Auto-imported by AI Engine from Gmail on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
                    )
                    db.add(target_app)
                    await db.flush() 
                    known_companies[extracted_company.lower()] = target_app
                else:
                    # Update existing app with new info if missing
                    if not target_app.contact_role and extracted_role:
                        target_app.contact_role = extracted_role
                    if not target_app.location and extracted_location:
                        target_app.location = extracted_location
                    if not target_app.contact_name and contact_name:
                        target_app.contact_name = contact_name
                    if not target_app.contact_email and contact_email:
                        target_app.contact_email = contact_email

                if detected_status:
                    ranks = {"applied": 1, "interviewed": 2, "assessment": 3, "rejected": 4, "selected": 5}
                    curr_rank = ranks.get(target_app.status, 0)
                    new_rank = ranks.get(detected_status, 0)
                    
                    # Advance status only if it's a forward move or terminal rejection
                    if new_rank > curr_rank or detected_status == "rejected":
                        target_app.status = detected_status
                    
                    existing_notes = target_app.notes or ""
                    sender_clean = email['sender'].split('<')[0].strip()
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
