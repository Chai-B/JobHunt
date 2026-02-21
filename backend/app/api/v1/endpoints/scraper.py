from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
import asyncio

from app.api import deps
from app.db.models.user import User
from app.db.models.contact import ScrapedContact
from app.db.models.job_posting import JobPosting
from app.schemas.contact import ScrapedContactRead
from app.schemas.scraper import ScraperJobRequest, ColdMailDispatchRequest
from app.worker.tasks import run_scraping_agent_async
from app.services.task_registry import register_task, cancel_user_tasks, get_running_tasks

router = APIRouter()

@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scraper(
    req: ScraperJobRequest,
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Trigger the scraping agent. Runs directly in FastAPI's event loop.
    """
    if req.target_type not in ["jobs", "contacts"]:
        raise HTTPException(status_code=400, detail="Invalid target type. Must be 'jobs' or 'contacts'.")
        
    logger.info(f"User {current_user.email} triggered scraper for {req.target_url} ({req.target_type})")
    
    # Run directly in the current event loop
    task = asyncio.create_task(
        run_scraping_agent_async(current_user.id, req.target_url, req.target_type)
    )
    task_id = register_task(current_user.id, "scraper", task)
    
    return {"message": "Scraper started. Check Logs for real-time progress.", "task_id": task_id}

@router.post("/stop", status_code=status.HTTP_200_OK)
async def stop_scraper(
    current_user: User = Depends(deps.get_current_active_user)
):
    """Stop all running scraper tasks for the current user."""
    count = cancel_user_tasks(current_user.id, task_type="scraper")
    return {"message": f"Stopped {count} running scraper task(s).", "cancelled": count}

@router.get("/status")
async def scraper_status(
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get running tasks for current user."""
    tasks = get_running_tasks(current_user.id)
    return {"running_tasks": tasks}

@router.get("/contacts", response_model=list[ScrapedContactRead])
async def get_global_contacts(
    skip: int = 0, limit: int = 100,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Fetch all collaborative scraped emails."""
    stmt = select(ScrapedContact).offset(skip).limit(limit).order_by(ScrapedContact.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/dispatch-mail", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_cold_mail(
    req: ColdMailDispatchRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Dispatch an Autonomous Cold Mail Agent."""
    stmt = select(ScrapedContact).where(ScrapedContact.id == req.contact_id)
    contact = (await db.execute(stmt)).scalars().first()
    if not contact: raise HTTPException(404, "Collaborative Contact not found")
    
    from app.worker.tasks import run_cold_mail_async
    task = asyncio.create_task(
        run_cold_mail_async(current_user.id, req.contact_id, req.template_id, req.resume_id)
    )
    task_id = register_task(current_user.id, "cold_mail", task)
    return {"message": f"Cold Mail Agent dispatched for {contact.email}.", "task_id": task_id}
