import base64
from email.message import EmailMessage
from loguru import logger
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.core.config import settings

class GmailService:
    def __init__(self, access_token: str, refresh_token: str):
        # In production this requires specific client_id & client_secret
        self.creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=getattr(settings, "GOOGLE_CLIENT_ID", "dummy_client_id"),
            client_secret=getattr(settings, "GOOGLE_CLIENT_SECRET", "dummy_client_secret")
        )
        self.service = build('gmail', 'v1', credentials=self.creds)

    def send_email(self, to: str, subject: str, body: str, attachment_data: bytes = None, attachment_filename: str = None) -> str:
        """Send an email via the user's connected Gmail account, optionally with an attachment."""
        try:
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            from email.mime.base import MIMEBase
            from email import encoders
            import os
            
            message = MIMEMultipart()
            message['To'] = to
            message['Subject'] = subject
            message.attach(MIMEText(body, 'plain'))
            
            if attachment_data and attachment_filename:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment_data)
                
                encoders.encode_base64(part)
                filename = attachment_filename
                # Strip internal IDs for the recipient if we appended them to the filename
                if "_" in filename:
                    filename = filename.split("_", 1)[1]
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename= {filename}",
                )
                message.attach(part)
            
            # The API expects urlsafe base64 encoding without padding
            encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            create_message = {
                'raw': encoded_message
            }
            # Sending as "me"
            send_message = self.service.users().messages().send(userId="me", body=create_message).execute()
            logger.info(f"Gmail sent successfully to {to}. Message Id: {send_message['id']}")
            return send_message['id']
            
        except Exception as e:
            logger.error(f"An error occurred sending Gmail: {e}")
            raise e
