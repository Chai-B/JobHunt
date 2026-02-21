from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from app.api import deps
from app.db.models.user import User
from app.db.models.resume import Resume
from app.schemas.resume import ResumeRead, ResumeList, ResumeUpdate
from app.worker.tasks import process_resume_task, process_resume_async

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt", "md"}

@router.post("/upload", response_model=ResumeRead, status_code=202)
async def upload_resume(
    file: UploadFile = File(...),
    label: str | None = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(deps.get_personal_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Upload a new resume and trigger background parsing."""
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")
        
    file_bytes = await file.read()
    
    # Create pending DB record
    new_resume = Resume(
        user_id=current_user.id,
        filename=file.filename,
        format=ext,
        label=label,
        status="pending"
    )
    db.add(new_resume)
    await db.commit()
    await db.refresh(new_resume)
    
    # Try Celery first, fall back to inline background task
    try:
        process_resume_task.delay(new_resume.id, file_bytes, file.filename)
        logger.info(f"Resume {new_resume.id} dispatched to Celery worker")
    except Exception as e:
        logger.warning(f"Celery unavailable ({e}), processing resume inline")
        import asyncio
        background_tasks.add_task(asyncio.run, process_resume_async(new_resume.id, file_bytes, file.filename))
    
    logger.info(f"User {current_user.id} uploaded resume {new_resume.id}. Background task triggered.")
    
    return new_resume

@router.get("/", response_model=ResumeList)
async def list_resumes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(deps.get_personal_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Get all resumes for the current user."""
    # Count total
    count_stmt = select(func.count(Resume.id)).where(Resume.user_id == current_user.id)
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0
    
    # Get items
    stmt = select(Resume).where(Resume.user_id == current_user.id).offset(skip).limit(limit).order_by(Resume.created_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()
    
    return {"items": items, "total": total}

@router.put("/{resume_id}", response_model=ResumeRead)
async def update_resume(
    resume_id: int,
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    resume_in: ResumeUpdate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Update a resume's metadata or parsed raw text."""
    res = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id))
    resume = res.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    update_data = resume_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(resume, field, value)
        
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    
    logger.info(f"User {current_user.id} updated resume {resume.id}")
    return resume
