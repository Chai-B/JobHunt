from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.schemas.setting import UserSettingRead, UserSettingUpdate

router = APIRouter()

@router.get("/me", response_model=UserSettingRead)
async def get_my_settings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get current user's integration settings.
    """
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Auto-create empty settings if they don't exist yet
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        
    return setting

@router.put("/me", response_model=UserSettingRead)
async def update_my_settings(
    setting_in: UserSettingUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Update user's integration settings.
    """
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)
        
    update_data = setting_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(setting, field, value)
        
    await db.commit()
    await db.refresh(setting)
    return setting
