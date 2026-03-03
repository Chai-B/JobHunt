"""
System-level transactional email service for verification and password reset.
Uses SYSTEM_SMTP_* env vars — completely separate from user's personal SMTP config.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from loguru import logger
from app.core.config import settings


def _is_configured() -> bool:
    return bool(settings.SYSTEM_SMTP_HOST and settings.SYSTEM_SMTP_USER and settings.SYSTEM_SMTP_PASSWORD)


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send a transactional email. Returns True on success, False on failure."""
    if not _is_configured():
        logger.warning(f"System SMTP not configured — cannot send email to {to_email}. Set SYSTEM_SMTP_* in .env.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"JobHunt <{settings.SYSTEM_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SYSTEM_SMTP_HOST, settings.SYSTEM_SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SYSTEM_SMTP_USER, settings.SYSTEM_SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Transactional email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send transactional email to {to_email}: {e}")
        return False


def send_verification_email(to_email: str, token: str):
    """Send email verification link."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; font-size: 24px; font-weight: 600; margin-bottom: 8px;">Verify your email</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">Click the button below to verify your email address and activate your JobHunt account.</p>
        <a href="{verify_url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; margin: 24px 0;">Verify Email</a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
    """
    send_email(to_email, "Verify your email — JobHunt", html)


def send_password_reset_email(to_email: str, token: str):
    """Send password reset link."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; font-size: 24px; font-weight: 600; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">Click the button below to reset your JobHunt password. This link expires in 1 hour.</p>
        <a href="{reset_url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; margin: 24px 0;">Reset Password</a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    """
    send_email(to_email, "Reset your password — JobHunt", html)
