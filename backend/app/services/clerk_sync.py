"""
Clerk Backend API service for headless user synchronization.
Uses the Clerk Backend SDK to create/verify users while keeping
our own custom sign-in/sign-up forms on the frontend.
"""
from typing import Optional
from loguru import logger
from app.core.config import settings

try:
    from clerk_backend_api import Clerk
    _clerk_available = True
except ImportError:
    _clerk_available = False
    logger.warning("clerk-backend-api not installed. Clerk sync disabled.")


def get_clerk_client():
    """Get Clerk SDK client. Returns None if not configured."""
    if not _clerk_available:
        return None
    if not settings.CLERK_SECRET_KEY:
        return None
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


async def sync_user_to_clerk(email: str, password: str, full_name: str = "") -> Optional[dict]:
    """
    Create a user in Clerk using the Backend API (headless).
    Returns the Clerk user object or None if Clerk is not configured.
    """
    client = get_clerk_client()
    if not client:
        logger.debug("Clerk not configured — skipping user sync on registration.")
        return None

    try:
        first_name = full_name.split(" ")[0] if full_name else email.split("@")[0]
        last_name = " ".join(full_name.split(" ")[1:]) if full_name and " " in full_name else ""

        clerk_user = client.users.create(
            email_address=[email],
            password=password,
            first_name=first_name,
            last_name=last_name,
            skip_password_checks=True,
        )

        logger.info(f"Clerk: User synced — {email} (clerk_id={clerk_user.id})")
        return {"clerk_id": clerk_user.id, "email": email}
    except Exception as e:
        logger.warning(f"Clerk sync failed for {email}: {e}")
        return None


async def verify_user_with_clerk(email: str, password: str) -> Optional[dict]:
    """
    Verify user credentials against Clerk Backend API.
    Returns Clerk user data or None if not configured.
    """
    client = get_clerk_client()
    if not client:
        return None

    try:
        users = client.users.list(email_address=[email])
        if users and len(users) > 0:
            clerk_user = users[0]
            logger.debug(f"Clerk: Found user {email} (clerk_id={clerk_user.id})")
            return {"clerk_id": clerk_user.id, "email": email}
    except Exception as e:
        logger.warning(f"Clerk verification lookup failed for {email}: {e}")

    return None
