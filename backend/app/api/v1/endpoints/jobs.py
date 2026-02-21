from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.api import deps
from app.db.models.user import User
from app.db.models.job_posting import JobPosting
from app.schemas.job import JobPostingCreate, JobPostingRead, JobMatchResult
from app.services.job_ingestion import ManualJobAdapter
from app.services.matching_engine import find_best_resume_for_job

router = APIRouter()

@router.get("/", response_model=List[JobPostingRead])
async def list_all_jobs(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Returns all jobs from the global database, newest first."""
    result = await db.execute(
        select(JobPosting).order_by(JobPosting.created_at.desc()).limit(200)
    )
    return result.scalars().all()

@router.post("/ingest/manual", response_model=List[JobPostingRead])
async def ingest_manual_job(
    request: JobPostingCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Manually ingest a job description, compute embeddings, and store."""
    adapter = ManualJobAdapter()
    raw_jobs = adapter.fetch_jobs(
        title=request.title, 
        company=request.company, 
        description=request.description
    )
    
    saved_jobs = []
    for raw_job in raw_jobs:
        processed = adapter.process_job(raw_job)
        
        db_job = JobPosting(
            source=processed["source"],
            title=processed["title"],
            company=processed["company"],
            description=processed["description"],
            embedding=processed["embedding"],
            metadata_json=processed["metadata_json"]
        )
        db.add(db_job)
        await db.commit()
        await db.refresh(db_job)
        saved_jobs.append(db_job)
        
        logger.info(f"Ingested Job {db_job.id} - {db_job.title} at {db_job.company}")
        
    return saved_jobs

@router.get("/{job_id}/match", response_model=JobMatchResult)
async def match_job_to_resume(
    job_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Returns the best matching resume for a specific job."""
    # Ensure job exists
    job = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job_record = job.scalars().first()
    if not job_record:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await find_best_resume_for_job(db, job_id, current_user.id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "job": job_record,
        "best_resume_id": result["best_resume_id"],
        "match_score": result["match_score"]
    }
