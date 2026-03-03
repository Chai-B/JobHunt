from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.schemas.setting import UserSettingRead, UserSettingUpdate
from app.core.encryption import encrypt, decrypt, SENSITIVE_FIELDS

router = APIRouter()

def _decrypt_setting(setting: UserSetting) -> dict:
    """Convert a UserSetting ORM object to a dict with sensitive fields decrypted."""
    data = {}
    for col in UserSetting.__table__.columns:
        val = getattr(setting, col.name, None)
        if col.name in SENSITIVE_FIELDS and val:
            data[col.name] = decrypt(val)
        else:
            data[col.name] = val
    return data

@router.get("/me", response_model=UserSettingRead)
async def get_my_settings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get current user's integration settings (sensitive fields decrypted for display)."""
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    
    decrypted = _decrypt_setting(setting)
    return decrypted

@router.put("/me", response_model=UserSettingRead)
async def update_my_settings(
    setting_in: UserSettingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Update user's integration settings (sensitive fields encrypted before storage)."""
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)
        
    update_data = setting_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in SENSITIVE_FIELDS and value:
            setattr(setting, field, encrypt(value))
        else:
            setattr(setting, field, value)
        
    await db.commit()
    await db.refresh(setting)
    
    decrypted = _decrypt_setting(setting)
    return decrypted
