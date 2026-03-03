import asyncio
import base64
import json
import re
from datetime import datetime, timedelta, timezone
from html import unescape

from loguru import logger
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.db.models.application import Application
from app.db.session import AsyncSessionLocal
from app.services.llm import call_llm

# ── Known job platform domains and sender patterns ──
_JOB_PLATFORM_DOMAINS = {
    "linkedin.com", "greenhouse.io", "lever.co", "ashbyhq.com",
    "workday.com", "myworkdayjobs.com", "icims.com", "smartrecruiters.com",
    "bamboohr.com", "jazz.co", "breezy.hr", "recruitee.com",
    "wellfound.com", "angel.co", "indeed.com", "glassdoor.com",
    "hired.com", "dice.com", "ziprecruiter.com", "monster.com",
    "internshala.com", "naukri.com", "hireview.com", "testgorilla.com",
    "hackerrank.com", "codility.com", "karat.com",
}

_SKIP_DOMAINS = {
    "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "pinterest.com", "tiktok.com", "reddit.com", "quora.com",
    "medium.com", "substack.com", "spotify.com",
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_MULTI_SPACE_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


class InboxScanner:
    """Scans a user's Gmail for job-application-related emails."""

    def __init__(self, access_token: str, refresh_token: str):
        self.creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=getattr(settings, "GOOGLE_CLIENT_ID", "dummy_client_id"),
            client_secret=getattr(settings, "GOOGLE_CLIENT_SECRET", "dummy_client_secret"),
        )
        self.service = build("gmail", "v1", credentials=self.creds)

    def fetch_recent_emails(self, watermark: datetime | None = None, max_results: int = 100) -> list[dict]:
        """Fetch job-relevant emails from Gmail using broad matching."""
        if not watermark:
            watermark = datetime.now(timezone.utc) - timedelta(days=180)

        after_date = (watermark - timedelta(days=1)).strftime("%Y/%m/%d")

        # Broad query: subject keywords + known job platform senders
        subject_terms = [
            "application", "interview", "offer", "assessment", "hiring",
            "opportunity", "position", "candidacy", "shortlist", "rejection",
            "regret", "congratulations", "next steps", "coding challenge",
            "technical round", "schedule", "onboarding", "background check",
        ]
        from_terms = [
            "noreply@", "no-reply@", "careers@", "recruiting@", "talent@",
            "hr@", "jobs@", "hiring@", "notifications@",
        ]
        platform_froms = [f"from:{d}" for d in list(_JOB_PLATFORM_DOMAINS)[:15]]

        subject_query = " OR ".join(f"subject:{t}" for t in subject_terms)
        from_query = " OR ".join(f"from:{f}" for f in from_terms)
        platform_query = " OR ".join(platform_froms)

        query = f"after:{after_date} ({subject_query} OR {from_query} OR {platform_query})"
        logger.info(f"Gmail query (truncated): {query[:200]}...")

        all_messages = []
        page_token = None

        # Paginate through results to get up to max_results
        while len(all_messages) < max_results:
            batch_size = min(100, max_results - len(all_messages))
            request_kwargs = {"userId": "me", "q": query, "maxResults": batch_size}
            if page_token:
                request_kwargs["pageToken"] = page_token

            results = self.service.users().messages().list(**request_kwargs).execute()
            batch = results.get("messages", [])
            if not batch:
                break
            all_messages.extend(batch)
            page_token = results.get("nextPageToken")
            if not page_token:
                break

        logger.info(f"Found {len(all_messages)} candidate emails from Gmail.")

        email_data = []
        for msg_ref in all_messages:
            try:
                msg = self.service.users().messages().get(
                    userId="me", id=msg_ref["id"], format="full"
                ).execute()
                email_data.append(self._parse_message(msg))
            except Exception as e:
                logger.warning(f"Failed to fetch message {msg_ref['id']}: {e}")

        return email_data

    def _parse_message(self, msg: dict) -> dict:
        """Extract structured fields from a Gmail API message."""
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        subject = headers.get("subject", "(No Subject)")
        sender = headers.get("from", "")
        date_str = headers.get("date", "")
        msg_id = msg.get("id", "")

        # Parse date robustly
        email_date = self._parse_date(date_str)

        # Extract body: prefer text/plain, fallback to text/html → strip tags
        body = self._extract_body(msg.get("payload", {}))

        return {
            "id": msg_id,
            "subject": subject,
            "sender": sender,
            "sender_email": self._extract_email(sender),
            "sender_domain": self._extract_domain(sender),
            "date": email_date.isoformat() if email_date else date_str,
            "date_short": email_date.strftime("%Y-%m-%d %H:%M") if email_date else date_str[:16],
            "body": body,
        }

    def _extract_body(self, payload: dict) -> str:
        """Recursively extract text body from Gmail payload."""
        mime = payload.get("mimeType", "")
        parts = payload.get("parts", [])

        # Direct body
        if mime == "text/plain" and payload.get("body", {}).get("data"):
            raw = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
            return raw

        if mime == "text/html" and payload.get("body", {}).get("data"):
            raw = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
            return _strip_html(raw)

        # Multipart: search parts
        text_body = ""
        html_body = ""
        for part in parts:
            part_mime = part.get("mimeType", "")
            if part_mime == "text/plain" and part.get("body", {}).get("data"):
                text_body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
            elif part_mime == "text/html" and part.get("body", {}).get("data"):
                html_body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
            elif "multipart" in part_mime:
                # Recurse into nested multipart
                nested = self._extract_body(part)
                if nested:
                    text_body = text_body or nested

        return text_body if text_body else _strip_html(html_body) if html_body else ""

    @staticmethod
    def _extract_email(sender: str) -> str:
        match = re.search(r"<([^>]+)>", sender)
        return match.group(1).lower() if match else sender.lower().strip()

    @staticmethod
    def _extract_domain(sender: str) -> str:
        email = InboxScanner._extract_email(sender)
        return email.split("@")[-1] if "@" in email else ""

    @staticmethod
    def _parse_date(date_str: str) -> datetime | None:
        """Best-effort parse of email date headers."""
        if not date_str:
            return None
        # Remove timezone abbreviation suffixes like "(PST)"
        cleaned = re.sub(r"\s*\([A-Z]{2,5}\)\s*$", "", date_str.strip())
        for fmt in (
            "%a, %d %b %Y %H:%M:%S %z",
            "%d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S%z",
        ):
            try:
                return datetime.strptime(cleaned, fmt)
            except ValueError:
                continue
        return None


def _strip_html(html: str) -> str:
    """Convert HTML to plain text."""
    if not html:
        return ""
    text = unescape(html)
    # Replace block elements with newlines
    text = re.sub(r"<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", text, flags=re.I)
    text = _HTML_TAG_RE.sub("", text)
    text = _MULTI_SPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def clean_body(text: str) -> str:
    """Aggressively clean email body to minimize tokens while preserving core info."""
    if not text:
        return ""
    # Remove forwarded message blocks
    text = re.sub(r"-----\s*Original Message\s*-----.*$", "", text, flags=re.DOTALL | re.M)
    text = re.sub(r"---------- Forwarded message.*$", "", text, flags=re.DOTALL | re.M)
    # Remove quoted reply blocks
    text = re.sub(r"^>.*$", "", text, flags=re.M)
    text = re.sub(r"On .{10,80} wrote:\s*$", "", text, flags=re.M)
    # Remove common email signatures
    text = re.sub(r"--\s*\n.*$", "", text, flags=re.DOTALL | re.M)
    text = re.sub(r"(Sent from my (iPhone|iPad|Android|Samsung)).*$", "", text, flags=re.DOTALL | re.I)
    # Remove long URL strings (keep them short)
    text = re.sub(r"https?://\S{80,}", "[link]", text)
    # Remove unsubscribe blocks
    text = re.sub(r"(unsubscribe|opt.out|email preferences|manage notifications).*$", "", text, flags=re.DOTALL | re.I)
    # Collapse whitespace
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    cleaned = "\n".join(lines)
    # Limit to 2000 chars for LLM token efficiency
    return cleaned[:2000]


def _is_job_related_domain(domain: str) -> bool:
    """Check if sender domain is a known job platform."""
    return any(d in domain for d in _JOB_PLATFORM_DOMAINS)


# ── LLM system prompt for email classification + extraction ──
_SYSTEM_PROMPT = """You are a precision job-application email classifier and data extractor.

Given an email (Subject, Sender, Body), determine if it is about a JOB APPLICATION and extract structured data.

CLASSIFICATION: An email is job-related if it discusses:
- Application confirmation/receipt/status
- Interview scheduling/feedback
- Assessment/coding challenge invitations
- Offer letters or rejections
- Recruiter outreach about a specific role

NOT job-related: newsletters, marketing, social notifications, general company updates, password resets, purchase receipts.

EXTRACTION RULES:
1. company_name: The HIRING COMPANY (not the job platform). Extract from email signature, body text, or infer from sender domain. If LinkedIn/Indeed/etc is the sending platform, look for the actual company name in the body. Return null if genuinely unknown.
2. job_title: The specific role title (e.g. "Software Engineer", "Product Manager"). Return null if not mentioned.
3. status: One of [applied, interviewed, assessment, rejected, selected, offer_received]. Map contextually:
   - "received your application" / "application confirmed" → applied
   - "schedule an interview" / "next round" / "Round 1/2/3" → interviewed
   - "coding challenge" / "take-home" / "assessment" / "test" → assessment
   - "unfortunately" / "not moving forward" / "regret" / "not selected" → rejected
   - "pleased to offer" / "congratulations" / "offer letter" → offer_received
   - "selected" / "you've been chosen" → selected
4. location: City/State/Country or "Remote" if mentioned. Return null if not stated.
5. source: Platform name (LinkedIn, Greenhouse, etc.) or "Direct Email" if from company directly.
6. contact_name: The actual person's name from the email signature if present. Return null if automated/no-reply.
7. contact_email: The sender's email address.
8. confidence: 0.0-1.0. Set to 0.0 if the email is NOT about a job application.

Return ONLY valid JSON:
{
  "is_job_email": true/false,
  "company_name": "string or null",
  "job_title": "string or null",
  "status": "string",
  "location": "string or null",
  "source": "string",
  "contact_name": "string or null",
  "contact_email": "string or null",
  "confidence": 0.0-1.0
}

CRITICAL: Do NOT hallucinate data. If a field is not present in the email, return null. Never return empty strings — use null."""


async def run_inbox_scanner_async(user_id: int):
    """Main entry point: scan a user's Gmail for job application emails and sync to Applications table."""
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
        user_settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))).scalars().first()

        if not user_settings or not getattr(user_settings, "gmail_access_token", None):
            logger.warning(f"User {user_id}: no Gmail token configured, skipping inbox scan.")
            return

        logger.info(f"Starting inbox scan for user {user_id}")

        try:
            from app.db.models.action_log import ActionLog

            log_entry = ActionLog(user_id=user_id, action_type="inbox_sync", status="running", message="Scanning inbox for job application emails")
            db.add(log_entry)
            await db.commit()

            from app.core.encryption import decrypt as _decrypt
            scanner = InboxScanner(_decrypt(user_settings.gmail_access_token), _decrypt(getattr(user_settings, "gmail_refresh_token", "")))
            watermark = user_settings.last_inbox_sync_time
            emails = scanner.fetch_recent_emails(watermark=watermark, max_results=100)

            if not emails:
                log_entry.status = "success"
                log_entry.message = "Inbox scan complete. No new emails found."
                await db.commit()
                logger.info(f"User {user_id}: no emails found.")
                return

            # Pre-filter: skip emails from obviously non-job domains
            filtered_emails = []
            for e in emails:
                domain = e.get("sender_domain", "")
                if domain and any(skip in domain for skip in _SKIP_DOMAINS):
                    continue
                if not e.get("body", "").strip() and not e.get("subject", "").strip():
                    continue
                filtered_emails.append(e)

            logger.info(f"User {user_id}: {len(filtered_emails)} emails after pre-filter (from {len(emails)} raw).")

            # Load existing applications for deduplication
            apps_result = await db.execute(select(Application).where(Application.user_id == user_id))
            existing_apps: dict[str, Application] = {}
            for app in apps_result.scalars().all():
                if app.company_name:
                    existing_apps[app.company_name.lower().strip()] = app

            # Process emails in parallel with a semaphore to limit concurrency
            sem = asyncio.Semaphore(5)
            matched_count = 0

            async def process_email(email: dict) -> dict | None:
                async with sem:
                    payload = f"Subject: {email['subject']}\nSender: {email['sender']}\nBody: {clean_body(email['body'])}"
                    try:
                        raw_llm = await call_llm(payload, user_settings, is_json=True, system_prompt=_SYSTEM_PROMPT)
                        parsed = json.loads(raw_llm)

                        if not parsed.get("is_job_email", False):
                            return None
                        if not parsed.get("company_name"):
                            return None
                        if parsed.get("confidence", 0) < 0.4:
                            return None

                        return {"email": email, "extraction": parsed}
                    except Exception as e:
                        logger.warning(f"LLM processing failed for email {email['id']}: {e}")
                        return None

            tasks = [process_email(e) for e in filtered_emails]
            results = await asyncio.gather(*tasks)
            valid_results = [r for r in results if r is not None]

            logger.info(f"User {user_id}: {len(valid_results)} job-related emails identified from {len(filtered_emails)} processed.")

            # ── Upsert applications ──
            STATUS_RANK = {
                "applied": 1,
                "assessment": 2,
                "interviewed": 3,
                "offer_received": 4,
                "selected": 5,
            }
            TERMINAL_STATUSES = {"rejected", "selected", "offer_received"}

            for res in valid_results:
                email = res["email"]
                ext = res["extraction"]

                co_name = (ext["company_name"] or "").strip()
                if not co_name:
                    continue

                # Normalize to title case
                co_name_display = co_name.title()
                co_key = co_name.lower()

                job_title = (ext.get("job_title") or "").strip().title() or None
                status = (ext.get("status") or "applied").lower()
                location = (ext.get("location") or "").strip().title() or None
                source = ext.get("source") or "Email"
                contact_name = (ext.get("contact_name") or "").strip().title() or None
                contact_email = (ext.get("contact_email") or "").strip().lower() or None

                # Fuzzy match existing applications
                target_app = existing_apps.get(co_key)
                if not target_app:
                    # Try substring match (e.g., "Google" matches "Google LLC")
                    for existing_key, existing_app in existing_apps.items():
                        if len(co_key) > 3 and len(existing_key) > 3:
                            if co_key in existing_key or existing_key in co_key:
                                target_app = existing_app
                                break

                if not target_app:
                    target_app = Application(
                        user_id=user_id,
                        company_name=co_name_display,
                        job_title=job_title,
                        application_type="Discovered (Email)",
                        status=status,
                        contact_name=contact_name,
                        contact_email=contact_email,
                        contact_role=job_title,
                        location=location,
                        source_url=source if source != "Email" else None,
                        notes="",
                    )
                    db.add(target_app)
                    await db.flush()
                    existing_apps[co_key] = target_app
                    logger.info(f"Created new application: {co_name_display} ({status})")

                # Update status: progress forward or accept terminal states
                current_rank = STATUS_RANK.get(target_app.status, 0)
                new_rank = STATUS_RANK.get(status, 0)
                if status in TERMINAL_STATUSES or new_rank > current_rank:
                    target_app.status = status

                # Enrich missing fields (don't overwrite existing data)
                if job_title and not target_app.job_title:
                    target_app.job_title = job_title
                if job_title and not target_app.contact_role:
                    target_app.contact_role = job_title
                if location and not target_app.location:
                    target_app.location = location
                if contact_name and not target_app.contact_name:
                    target_app.contact_name = contact_name
                if contact_email and not target_app.contact_email:
                    target_app.contact_email = contact_email
                if source and source not in ("Email", "Direct Email") and not target_app.source_url:
                    target_app.source_url = source

                # Timeline: append if this email hasn't been processed
                if str(email["id"]) not in (target_app.notes or ""):
                    sender_name = (contact_name or email.get("sender_email", "System")).strip()
                    subj = email["subject"][:80]
                    date_short = email.get("date_short", "")

                    # Format: [date] sender: subject  -> (Status: status) [ID: msg_id]
                    timeline_entry = f"\n[{date_short}] {sender_name}: {subj}  -> (Status: {status.upper()}) [ID: {email['id']}]"
                    target_app.notes = (target_app.notes or "") + timeline_entry
                    matched_count += 1
                    db.add(target_app)

            # Update watermark
            from sqlalchemy.sql import func
            user_settings.last_inbox_sync_time = func.now()
            db.add(user_settings)

            log_entry.status = "success"
            log_entry.message = f"Scan complete. Processed {len(filtered_emails)} emails, found {len(valid_results)} job-related, {matched_count} updates applied."
            db.add(log_entry)

            await db.commit()
            logger.info(f"User {user_id}: inbox scan finished. {matched_count} timeline nodes integrated.")

        except Exception as e:
            logger.error(f"Inbox scanner critical failure for user {user_id}: {e}")
            try:
                if "log_entry" in locals():
                    log_entry.status = "failed"
                    log_entry.message = f"Scan failed: {str(e)[:500]}"
                    db.add(log_entry)
                    await db.commit()
            except Exception:
                pass
