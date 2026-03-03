from datetime import timedelta, datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from loguru import logger
import secrets

from app.crud import user as crud_user
from app.schemas.user import UserCreate, UserRead, Token
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.jwt import create_access_token
from app.db.models.user import User
from app.services.email_service import send_verification_email, send_password_reset_email

router = APIRouter()


class OAuthSyncRequest(BaseModel):
    email: str
    full_name: str = ""
    clerk_id: str = ""
    provider: str = "oauth"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login."""
    user = await crud_user.get_by_email(db, email=form_data.username)
    if not user or not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
        "is_email_verified": getattr(user, "is_email_verified", True),
    }


@router.post("/register", response_model=UserRead)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """Register new user. Sends verification email if system SMTP is configured."""
    user = await crud_user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(status_code=400, detail="The user with this username already exists in the system")

    user = await crud_user.create(db, obj_in=user_in)
    logger.info(f"New user registered: {user.email}")

    # Generate and save email verification token
    try:
        verification_token = secrets.token_urlsafe(32)
        user.email_verification_token = verification_token
        user.is_email_verified = False
        await db.commit()
        send_verification_email(user.email, verification_token)
    except Exception as e:
        logger.warning(f"Failed to send verification email: {e}")

    return user


@router.get("/me", response_model=UserRead)
async def get_current_user(
    current_user=Depends(deps.get_current_active_user)
) -> Any:
    """Get current user data."""
    return current_user


@router.post("/oauth-sync")
async def oauth_sync(
    *,
    db: AsyncSession = Depends(deps.get_db),
    req: OAuthSyncRequest,
    x_oauth_secret: str = Header(None, alias="X-OAuth-Secret"),
) -> Any:
    """
    Sync an OAuth-authenticated user from Clerk to the local database.
    Protected by a shared secret header to prevent anyone from forging JWTs.
    """
    # Validate shared secret — if OAUTH_SYNC_SECRET is configured, enforce it
    if settings.OAUTH_SYNC_SECRET:
        if x_oauth_secret != settings.OAUTH_SYNC_SECRET:
            logger.warning(f"OAuth sync rejected: invalid secret for {req.email}")
            raise HTTPException(status_code=403, detail="Invalid OAuth sync authorization")

    user = await crud_user.get_by_email(db, email=req.email)

    if not user:
        random_password = secrets.token_urlsafe(32)
        user_create = UserCreate(
            email=req.email,
            password=random_password,
            full_name=req.full_name,
            is_active=True,
        )
        user = await crud_user.create(db, obj_in=user_create)
        # OAuth users are auto-verified
        user.is_email_verified = True
        await db.commit()
        logger.info(f"OAuth: Created local user for {req.email} (clerk_id={req.clerk_id})")
    else:
        # Ensure OAuth users are marked as verified
        if not user.is_email_verified:
            user.is_email_verified = True
            await db.commit()
        logger.info(f"OAuth: Existing user {req.email} signed in via {req.provider}")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer"
    }


# ── Forgot Password ──

@router.post("/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Send password reset email. Always returns 200 to prevent email enumeration."""
    user = await crud_user.get_by_email(db, email=req.email)
    if user and user.hashed_password:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        send_password_reset_email(user.email, reset_token)
    # Always return success to prevent email enumeration
    return {"message": "If an account exists with that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Reset password using a valid reset token."""
    stmt = select(User).where(User.password_reset_token == req.token)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if not user.password_reset_expires or user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = security.get_password_hash(req.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()
    logger.info(f"Password reset successful for {user.email}")
    return {"message": "Password has been reset successfully. You can now sign in."}


# ── Email Verification ──

@router.post("/verify-email")
async def verify_email(
    req: VerifyEmailRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Verify email address using the token sent during registration."""
    stmt = select(User).where(User.email_verification_token == req.token)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    user.is_email_verified = True
    user.email_verification_token = None
    await db.commit()
    logger.info(f"Email verified for {user.email}")
    return {"message": "Email verified successfully. You can now use all features."}


@router.post("/resend-verification")
async def resend_verification(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Resend verification email to current user."""
    if current_user.is_email_verified:
        return {"message": "Email is already verified."}

    verification_token = secrets.token_urlsafe(32)
    current_user.email_verification_token = verification_token
    await db.commit()
    send_verification_email(current_user.email, verification_token)
    return {"message": "Verification email sent."}
