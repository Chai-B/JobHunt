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
def clean_body(text: str) -> str:
    """Aggressively clean email body to minimize tokens while preserving core info."""
    if not text: return ""
    # Remove technical headers/footers often found in redirected emails
    text = re.sub(r'-----Original Message-----.*$', '', text, flags=re.DOTALL | re.M)
    text = re.sub(r'From:.*?\nTo:.*?\nSubject:.*?\n', '', text, flags=re.DOTALL | re.I)
    
    # Remove common signatures patterns (heuristic: many dashes or long blocks of lines with links)
    text = re.sub(r'--\s*\n.*$', '', text, flags=re.DOTALL | re.M)
    
    # Collapse whitespace
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    cleaned = " ".join(lines)
    
    # Limit to 1500 chars per email for batching safety
    return cleaned[:1500]

async def run_inbox_scanner_async(user_id: int):
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
        user_settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))).scalars().first()
        
        if not user_settings or not getattr(user_settings, 'gmail_access_token', None):
            return

        logger.info(f"Starting High-Performance Batch Inbox Scanner for User {user_id}")
        try:
            from app.db.models.action_log import ActionLog
            log_start = ActionLog(user_id=user_id, action_type="scraper", status="running", message="Running Batch AI Inbox Sync")
            db.add(log_start)
            await db.commit()

            scanner = InboxScanner(user_settings.gmail_access_token, getattr(user_settings, 'gmail_refresh_token', ''))
            watermark = user_settings.last_inbox_sync_time
            emails = scanner.fetch_recent_emails(watermark=watermark, max_results=50)
            
            if not emails:
                log_start.status = "success"
                log_start.message = "Inbox Sync completed. No new emails found."
                await db.commit()
                return

            system_prompt = """You are an elite Recruitment Data Processor. 
Task: Extract structured job application info from a SINGLE email.
Statuses: [applied, interviewed, assessment, rejected, selected]

Return JSON: 
{
  "company_name": "string",
  "role": "string",
  "location": "string",
  "source": "string",
  "status": "applied|interviewed|assessment|rejected|selected",
  "confidence": 0-1
}

Precise Rules:
1. company_name: YOU MUST EXTRACT OR INFER THIS. Look at the sender domain, email signature, or text. Ignore 'LinkedIn', 'Internshala', 'Wellfound' unless they are the employer (extract the actual hiring company instead). Avoid returning individual recruiter names.
2. role: The job title (e.g. Software Engineer).
3. status: Map 'Round 1/2' or 'Schedule' to 'interviewed'. Map 'Test/Assignment' to 'assessment'. Map 'Not moving forward' to 'rejected'. Make an implicit guess based on context if ambiguous.
4. If an email is NOT about a job application, set company_name to null.
"""

            matched_count = 0
            # Fetch existing apps for deduplication
            apps_result = await db.execute(select(Application).where(Application.user_id == user_id))
            applications = {a.company_name.lower(): a for a in apps_result.scalars().all() if a.company_name}

            async def process_single_email(email):
                text_payload = f"Subject: {email['subject']}\nSender: {email['sender']}\nBody: {clean_body(email['body'])}"
                try:
                    raw_llm = await call_llm(text_payload, user_settings, is_json=True, system_prompt=system_prompt)
                    parsed = json.loads(raw_llm)
                    
                    if not parsed.get("company_name") or parsed.get("confidence", 0) < 0.3:
                        return None
                        
                    return {
                        "email": email,
                        "extraction": parsed
                    }
                except Exception as e:
                    logger.warning(f"Error processing email {email['id']}: {e}")
                    return None

            # Process all emails in parallel
            tasks = [process_single_email(e) for e in emails]
            results = await asyncio.gather(*tasks)
            valid_results = [r for r in results if r is not None]

            for res in valid_results:
                email = res['email']
                ext = res['extraction']
                
                co_name = ext['company_name'].strip().title()
                role = ext.get('role', '').strip().title()
                status = ext.get('status', 'applied').lower()
                loc = ext.get('location', '').strip().title()
                src = ext.get('source', 'Email')

                # Logic: Bind or Create
                target_app = applications.get(co_name.lower())
                if not target_app:
                    # Fuzzy matching fallback
                    target_app = next((a for c, a in applications.items() if (c in co_name.lower() or co_name.lower() in c) and len(c) > 3), None)

                if not target_app:
                    logger.info(f"AI Sync: Creating new app for {co_name}")
                    target_app = Application(
                        user_id=user_id,
                        company_name=co_name,
                        application_type="Discovered (Email)",
                        status=status,
                        contact_role=role,
                        location=loc,
                        source_url=src,
                        notes=f"Imported from Gmail on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
                    )
                    db.add(target_app)
                    await db.flush()
                    applications[co_name.lower()] = target_app
                
                # Update status if forward move or terminal
                ranks = {"applied": 1, "interviewed": 2, "assessment": 3, "rejected": 4, "selected": 5}
                if ranks.get(status, 0) > ranks.get(target_app.status, 0) or status == "rejected":
                    target_app.status = status
                
                # Enrich missing metadata
                if role and not target_app.contact_role: target_app.contact_role = role
                if loc and not target_app.location: target_app.location = loc
                if src and src != 'Email' and not target_app.source_url: target_app.source_url = src

                # Timeline Node
                if str(email['id']) not in (target_app.notes or ""):
                    timeline = f"\n[{email['date'][:16]}] {email['subject']} -> {status.upper()} [Ref: {email['id']}]"
                    target_app.notes = (target_app.notes or "") + timeline
                    matched_count += 1
                    db.add(target_app)

            from sqlalchemy.sql import func
            user_settings.last_inbox_sync_time = func.now()
            db.add(user_settings)
            
            log_start.status = "success"
            log_start.message = f"Batch Sync completed. Processed {len(emails)} emails, found {matched_count} updates."
            db.add(log_start)
            
            await db.commit()
            logger.info(f"Inbox Scan completed for User {user_id}. {matched_count} nodes integrated.")
            
        except Exception as e:
            logger.error(f"Inbox Scanner critical failure: {e}")
            if 'log_start' in locals():
                log_start.status = "failed"
                log_start.message = f"Scan failed: {str(e)}"
                db.add(log_start)
                await db.commit()
