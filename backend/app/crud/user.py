from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash

async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()

async def get(db: AsyncSession, id: int) -> Optional[User]:
    result = await db.execute(select(User).filter(User.id == id))
    return result.scalars().first()

async def create(db: AsyncSession, *, obj_in: UserCreate) -> User:
    db_obj = User(
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        is_active=obj_in.is_active,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
