from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api import deps
from app.db.models.user import User
from app.db.models.email_template import EmailTemplate
from app.db.models.setting import UserSetting
from app.schemas.email_template import EmailTemplateCreate, EmailTemplateRead, EmailTemplateUpdate, EmailTemplateList
from sqlalchemy import func

router = APIRouter()

class AITemplateRequest(BaseModel):
    purpose: str = "cold_outreach"
    tone: str = "professional"
    length: str = "short"
    focus: str = "achievements"
    target_role: Optional[str] = None
    target_company: Optional[str] = None

@router.post("/", response_model=EmailTemplateRead)
async def create_template(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    template_in: EmailTemplateCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # Check name exists
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.name == template_in.name))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Template with this name already exists")
        
    db_obj = EmailTemplate(
        name=template_in.name,
        subject=template_in.subject,
        body_text=template_in.body_text,
        is_active=template_in.is_active
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.get("/", response_model=EmailTemplateList)
async def list_templates(
    db: AsyncSession = Depends(deps.get_personal_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    count_stmt = select(func.count(EmailTemplate.id))
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    res = await db.execute(select(EmailTemplate).offset(skip).limit(limit).order_by(EmailTemplate.created_at.desc()))
    items = res.scalars().all()
    return {"items": items, "total": total}

@router.put("/{template_id}", response_model=EmailTemplateRead)
async def update_template(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    template_id: int,
    template_in: EmailTemplateUpdate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Template not found")
        
    update_data = template_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.post("/generate-ai")
async def generate_ai_template(
    *,
    req: AITemplateRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Generate an email template using Gemini AI."""
    # Get user settings for API key
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    settings = (await db.execute(stmt)).scalars().first()
    
    if not settings:
        raise HTTPException(status_code=400, detail="Configure AI Settings first.")
        
    provider = settings.llm_provider or "gemini"
    if provider == "gemini" and not settings.gemini_api_keys:
        raise HTTPException(status_code=400, detail="Configure a Gemini API Key in Settings first.")
    elif provider == "openai" and not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="Configure a Custom API Key in Settings first.")
    
    from app.services.llm import call_llm
    
    target_info = ""
    if req.target_role:
        target_info += f"Target Role: {req.target_role}\n"
    if req.target_company:
        target_info += f"Target Company: {req.target_company}\n"
    
    prompt = f"""You are an elite, world-class executive communication strategist and top-tier technical recruiter copywriter.
    Your goal is to write a highly persuasive, psychological, and high-converting {req.purpose.replace('_', ' ')} email.

    PARAMETERS:
    - Tone constraint: {req.tone}
    - Length Configuration: Produce text that is explicitly {req.length} (short: 3-4 sentences max, medium: 2-3 short paragraphs, long: detailed and comprehensive).
    - Primary Focus: Emphasize {req.focus} intensely.
    {target_info}
    
    CRITICAL INSTRUCTION - VARIABLE INJECTION:
    You MUST aggressively and naturally weave the following exact literal variables into the text. Do NOT replace them. Ensure grammar remains flawless even if a variable evaluates to empty later. Do NOT make up new [brackets].
    {{{{user_name}}}}, {{{{user_email}}}}, {{{{user_phone}}}}, {{{{linkedin}}}}, {{{{github}}}}, {{{{portfolio}}}}
    {{{{job_title}}}}, {{{{company}}}}, {{{{contact_name}}}}
    {{{{skills}}}}, {{{{experience_years}}}}, {{{{education}}}}, {{{{recent_role}}}}, {{{{top_projects}}}}, {{{{certifications}}}}

    WRITING RULES:
    1. No corporate fluff or generic buzzwords. Be incredibly specific, punchy, and memorable.
    2. The Subject Line MUST have an open-rate-optimized structure (e.g., provoke curiosity or establish immediate extreme relevance). Use variables like {{{{job_title}}}} or {{{{company}}}} in the subject.
    3. The Body MUST follow a hook -> value proposition -> concise evidence -> low-friction call-to-action structure.
    4. Seamlessly incorporate {{{{experience_years}}}} of experience, current/past role as {{{{recent_role}}}}, and top projects: {{{{top_projects}}}} into the prose.
    5. Do NOT include placeholders like [Your Name] or [Date]. ONLY use the exact {{{{variable}}}} formatted tags provided.
    
    Return STRICTLY valid JSON ONLY:
    {{
      "name": "<A short 3-5 word internal name for this template>",
      "subject": "<Compelling Email Subject Line>",
      "body_text": "<The actual email body string with variables>"
    }}
    """
    
    import json
    
    try:
        raw_json = await call_llm(prompt=prompt, settings=settings, is_json=True)
        # strict=False allows unescaped control characters (like raw \n in LLaMA responses)
        result = json.loads(raw_json, strict=False)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
