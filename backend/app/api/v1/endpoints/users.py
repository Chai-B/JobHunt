from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models.user import User
from app.db.models.application import Application
from app.db.models.contact import ScrapedContact
from app.db.models.job_posting import JobPosting
from app.schemas.user import UserRead, UserUpdate
from app.api import deps

router = APIRouter()

@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: User = Depends(deps.get_current_active_user)
) -> UserRead:
    """
    Get current logged-in user profile.
    """
    return current_user

@router.put("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> UserRead:
    """
    Update own user profile.
    """
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Don't update password through this generic endpoint ideally, 
    # but we allow it if provided per schema
    if "password" in update_data and update_data["password"]:
        from app.core.security import get_password_hash
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    for field, value in update_data.items():
        setattr(current_user, field, value)
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("/metrics")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Return aggregated analytics for the overview dashboard.
    """
    # Personal Pipeline Stats
    pipeline_stmt = select(Application.status, func.count(Application.id)).filter(Application.user_id == current_user.id).group_by(Application.status)
    pipeline_result = await db.execute(pipeline_stmt)
    pipeline = pipeline_result.all()
    
    pipeline_dict = {status: count for status, count in pipeline}
    total_apps = sum(pipeline_dict.values())
    
    # Global Knowledge Pool Stats
    contacts_stmt = select(func.count(ScrapedContact.id))
    total_contacts = (await db.execute(contacts_stmt)).scalar() or 0
    
    jobs_stmt = select(func.count(JobPosting.id))
    total_jobs = (await db.execute(jobs_stmt)).scalar() or 0
    
    return {
        "pipeline": pipeline_dict,
        "total_applications": total_apps,
        "global_knowledge": {
            "contacts": total_contacts,
            "jobs": total_jobs
        }
    }
