from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.api import deps
from app.db.models.user import User
from app.db.models.contact import ScrapedContact
from app.db.models.job_posting import JobPosting
from app.schemas.contact import ScrapedContactRead
from app.schemas.scraper import ScraperJobRequest, ColdMailDispatchRequest
from app.worker.tasks import run_scraping_agent_task, run_cold_mail_task

router = APIRouter()

@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scraper(
    req: ScraperJobRequest,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Trigger the background scraping autonomous agent.
    """
    if req.target_type not in ["jobs", "contacts"]:
        raise HTTPException(status_code=400, detail="Invalid target type. Must be 'jobs' or 'contacts'.")
        
    logger.info(f"User {current_user.email} triggered scraper for {req.target_url} ({req.target_type})")
    
    # Dispatch unstructured URL to Celery background task
    run_scraping_agent_task.delay(current_user.id, req.target_url, req.target_type)
    
    return {"message": "Scraper job enqueued. Collaborative data pool will be updated shortly."}

@router.get("/contacts", response_model=list[ScrapedContactRead])
async def get_global_contacts(
    skip: int = 0, limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Fetch all collaborative scraped emails.
    """
    stmt = select(ScrapedContact).offset(skip).limit(limit).order_by(ScrapedContact.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/dispatch-mail", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_cold_mail(
    req: ColdMailDispatchRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Dispatch an Autonomous Cold Mail Agent to email a contact using a template and resume.
    """
    # 1. Verify resources
    stmt = select(ScrapedContact).where(ScrapedContact.id == req.contact_id)
    contact = (await db.execute(stmt)).scalars().first()
    if not contact: raise HTTPException(404, "Collaborative Contact not found")
    
    run_cold_mail_task.delay(current_user.id, req.contact_id, req.template_id, req.resume_id)
    return {"message": f"Autonomous Cold Mail Agent dispatched for {contact.email}."}
