from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.db.models.user import User
from app.db.models.application import Application
from app.schemas.application import ApplicationCreate, ApplicationRead, ApplicationUpdate
from app.services.application_engine import ApplicationEngine
from app.worker.tasks import run_auto_apply_task

router = APIRouter()

@router.post("/", response_model=ApplicationRead)
async def create_application(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    app_in: ApplicationCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # Basic deduplication constraint:
    stmt = select(Application).where(
        Application.user_id == current_user.id,
        Application.job_id == app_in.job_id
    )
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Application for this job already exists.")
        
    db_obj = Application(
        user_id=current_user.id,
        job_id=app_in.job_id,
        resume_id=app_in.resume_id,
        status="shortlisted"
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.get("/", response_model=List[ApplicationRead])
async def list_applications(
    db: AsyncSession = Depends(deps.get_personal_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    stmt = select(Application).where(Application.user_id == current_user.id).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.put("/{app_id}/status", response_model=ApplicationRead)
async def update_application_status(
    app_id: int,
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    status_update: ApplicationUpdate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    if not status_update.status:
        raise HTTPException(status_code=400, detail="Must provide new status.")
        
    res = await db.execute(select(Application).where(Application.id == app_id))
    app_record = res.scalars().first()
    
    if not app_record or app_record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    # Use Application Engine to safely transition
    try:
        updated_app = await ApplicationEngine.update_status(db, app_record, status_update.status)
        return updated_app
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{app_id}/auto-apply", status_code=202)
async def trigger_auto_apply(
    app_id: int,
    db: AsyncSession = Depends(deps.get_personal_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Triggers the Autonomous Agent to apply for this job.
    """
    res = await db.execute(select(Application).where(Application.id == app_id))
    app_record = res.scalars().first()
    
    if not app_record or app_record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    if not app_record.resume_id:
        raise HTTPException(status_code=400, detail="A resume must be attached to the application before auto-applying.")
        
    app_record.status = "processing"
    db.add(app_record)
    await db.commit()
    
    run_auto_apply_task.delay(current_user.id, app_id)
    return {"message": "Autonomous Agent dispatched to apply for this job."}
