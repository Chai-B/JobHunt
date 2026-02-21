from typing import AsyncGenerator
from loguru import logger
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from functools import lru_cache

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.schemas.user import TokenPayload
from app.crud import user as crud_user

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
    except JWTError:
        logger.warning("Invalid JWT Token received")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    # Eagerly load settings for the current user
    stmt = select(User).options(selectinload(User.settings)).where(User.id == int(token_data.sub))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        logger.error(f"User not found for token subject: {token_data.sub}")
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        logger.warning(f"Inactive user {current_user.email} attempted access")
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

_engine_cache = {}

async def get_personal_db(
    current_user: User = Depends(get_current_active_user),
    host_db: AsyncSession = Depends(get_db)
) -> AsyncGenerator[AsyncSession, None]:
    """
    If the user has configured `external_db_url`, route reads/writes to their personal database.
    Otherwise, fallback to the host instance database session.
    """
    settings = current_user.settings
    if settings and settings.external_db_url:
        target_url = settings.external_db_url
        if target_url.startswith("postgres://"):
            target_url = target_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif target_url.startswith("postgresql://"):
            target_url = target_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        try:
            if target_url not in _engine_cache:
                _engine_cache[target_url] = create_async_engine(target_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
            
            async_session_factory = async_sessionmaker(
                bind=_engine_cache[target_url], class_=AsyncSession, expire_on_commit=False
            )
            async with async_session_factory() as custom_session:
                yield custom_session
            return
        except Exception as e:
            logger.error(f"Failed to connect to personal DB for user {current_user.id}: {str(e)}")
            # Fallback to host DB
            
    yield host_db
