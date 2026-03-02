from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
import asyncio
import re

from app.api import deps
from app.db.models.user import User
from app.db.models.contact import ScrapedContact
from app.db.models.job_posting import JobPosting
from app.db.models.resume import Resume
from app.db.models.email_template import EmailTemplate
from app.db.models.setting import UserSetting
from app.schemas.contact import ScrapedContactRead
from app.schemas.scraper import ScraperJobRequest, ColdMailDispatchRequest
from app.worker.tasks import run_scraping_agent_async
from app.services.task_registry import register_task, cancel_user_tasks, get_running_tasks

router = APIRouter()

@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scraper(
    req: ScraperJobRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Trigger the scraping agent. Runs directly in FastAPI's event loop.
    """
    if req.target_type not in ["jobs", "contacts"]:
        raise HTTPException(status_code=400, detail="Invalid target type. Must be 'jobs' or 'contacts'.")
        
    settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == current_user.id))).scalars().first()
    if not settings or not settings.gemini_api_keys:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Please configure it in Settings to use the AI Scraper.")

    logger.info(f"User {current_user.email} triggered scraper for {req.target_url} ({req.target_type})")
    
    task = asyncio.create_task(
        run_scraping_agent_async(current_user.id, req.target_url, req.target_type, req.keywords)
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
    
    # Pre-flight check: Ensure sending mechanisms are configured before dispatching to Celery
    settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == current_user.id))).scalars().first()
    if not settings:
        raise HTTPException(400, "Settings not configured. Please visit Settings to connect your email.")
    
    if getattr(settings, 'use_gmail_for_send', False):
        if not getattr(settings, 'gmail_access_token', None):
            raise HTTPException(400, "Gmail send is enabled but access token is missing. Connect Gmail in Settings.")
    else:
        missing_smtp = []
        if not settings.smtp_server: missing_smtp.append("SMTP Server")
        if not settings.smtp_username: missing_smtp.append("SMTP Username")
        if not settings.smtp_password: missing_smtp.append("SMTP Password")
        if missing_smtp:
            raise HTTPException(400, f"Missing SMTP configuration: {', '.join(missing_smtp)}. Configure in Settings.")

    stmt = select(ScrapedContact).where(ScrapedContact.id == req.contact_id)
    contact = (await db.execute(stmt)).scalars().first()
    if not contact: raise HTTPException(404, "Collaborative Contact not found")
    
    from app.worker.tasks import run_cold_mail_async
    task = asyncio.create_task(
        run_cold_mail_async(current_user.id, req.contact_id, req.template_id, req.resume_id, req.attach_resume)
    )
    task_id = register_task(current_user.id, "cold_mail", task)
    return {"message": f"Cold Mail Agent dispatched for {contact.email}.", "task_id": task_id}

@router.post("/preview-mail")
async def preview_cold_mail(
    req: ColdMailDispatchRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Dry-run cold mail tag resolution. Returns the fully resolved subject, body,
    tag value map, and any warnings — without actually sending the email.
    """
    contact = (await db.execute(select(ScrapedContact).where(ScrapedContact.id == req.contact_id))).scalars().first()
    template = (await db.execute(select(EmailTemplate).where(EmailTemplate.id == req.template_id))).scalars().first()
    resume = (await db.execute(select(Resume).where(Resume.id == req.resume_id))).scalars().first()
    settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == current_user.id))).scalars().first()

    if not contact: raise HTTPException(404, "Contact not found")
    if not template: raise HTTPException(404, "Template not found")
    if not resume: raise HTTPException(404, "Resume not found")

    resume_data = resume.parsed_json or {}
    
    raw_exp = resume_data.get("experience_years") or getattr(current_user, 'experience_years', "") or ""
    exp_match = re.search(r'(\d+)', str(raw_exp))
    exp_years = exp_match.group(1) if exp_match else ""

    target_role = (resume_data.get("target_role") or getattr(settings, 'target_roles', "")).strip()

    val_map = {
        "contact_name": (contact.name or "").strip(),
        "contact_role": (contact.role or "").strip(),
        "job_title": target_role,
        "company": (contact.company or "").strip(),
        "experience_years": exp_years,
        "skills": (resume_data.get("skills") or getattr(current_user, 'skills', "") or "").strip(),
        "education": (resume_data.get("education") or getattr(current_user, 'education', "") or "").strip(),
        "recent_role": (resume_data.get("recent_role") or "").strip(),
        "top_projects": (resume_data.get("top_projects") or "").strip(),
        "certifications": (resume_data.get("certifications") or "").strip(),
        "linkedin": (current_user.linkedin_url or "").strip(),
        "github": (current_user.github_url or "").strip(),
        "portfolio": (getattr(current_user, 'portfolio_url', "") or "").strip(),
        "user_name": (current_user.full_name or "").strip(),
        "user_email": (current_user.email or "").strip(),
        "user_phone": (current_user.phone or "").strip(),
    }

    def replace_tag(match):
        tag_name = match.group(1).strip()
        return str(val_map.get(tag_name, match.group(0)))

    subject = re.sub(r'{{(.*?)}}', replace_tag, template.subject)
    body = re.sub(r'{{(.*?)}}', replace_tag, template.body_text)

    # Collect warnings
    warnings = []
    remaining_tags = re.findall(r'{{(.*?)}}', subject + "\n" + body)
    if remaining_tags:
        warnings.append(f"Unreplaced tags: {remaining_tags}")
    
    critical_fields = {"contact_name": "Contact Name", "company": "Company", "user_name": "Your Name", "job_title": "Target Role"}
    for key, label in critical_fields.items():
        if not val_map.get(key):
            warnings.append(f"Critical field empty: {label}")
    
    empty_tags = [k for k, v in val_map.items() if not v and k not in ["experience_years", "certifications", "portfolio", "github"]]
    if empty_tags:
        warnings.append(f"Empty optional fields: {empty_tags}")

    # Check attachment availability
    has_attachment = False
    if req.attach_resume:
        if getattr(resume, "file_data", None) and len(resume.file_data) > 0:
            has_attachment = True
        else:
            from app.core.config import settings as app_settings
            file_path = app_settings.UPLOAD_DIR / f"{resume.id}_{resume.filename}"
            has_attachment = file_path.exists()
        if not has_attachment:
            warnings.append("Resume attachment requested but file data is unavailable. Re-upload the resume.")

    return {
        "subject": subject,
        "body": body,
        "tag_values": val_map,
        "warnings": warnings,
        "has_attachment": has_attachment,
        "recipient": contact.email,
    }

