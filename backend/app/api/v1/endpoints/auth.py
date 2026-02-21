from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from loguru import logger
import secrets

from app.crud import user as crud_user
from app.schemas.user import UserCreate, UserRead, Token
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.jwt import create_access_token
from app.services.clerk_sync import sync_user_to_clerk, verify_user_with_clerk

router = APIRouter()


class OAuthSyncRequest(BaseModel):
    email: str
    full_name: str = ""
    clerk_id: str = ""
    provider: str = "oauth"


@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    user = await crud_user.get_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        logger.warning(f"Inactive user attempt to login: {form_data.username}")
        raise HTTPException(status_code=400, detail="Inactive user")

    # Non-blocking Clerk verification (headless sync on login)
    await verify_user_with_clerk(form_data.username, form_data.password)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer"
    }


@router.post("/register", response_model=UserRead)
async def register(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """Register new user. Creates locally and syncs to Clerk (headless)."""
    user = await crud_user.get_by_email(db, email=user_in.email)
    if user:
        logger.warning(f"Registration failed: User already exists for {user_in.email}")
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )

    user = await crud_user.create(db, obj_in=user_in)
    logger.info(f"New user registered: {user.email}")

    await sync_user_to_clerk(
        email=user_in.email,
        password=user_in.password,
        full_name=user_in.full_name or ""
    )

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
) -> Any:
    """
    Sync an OAuth-authenticated user from Clerk to the local database.
    If the user doesn't exist locally, create them with a random password.
    Returns a JWT access token for the frontend.
    """
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
        logger.info(f"OAuth: Created local user for {req.email} (clerk_id={req.clerk_id})")
    else:
        logger.info(f"OAuth: Existing user {req.email} signed in via {req.provider}")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer"
    }
