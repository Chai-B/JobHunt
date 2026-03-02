from pydantic import BaseModel
from typing import Optional


class ScraperJobRequest(BaseModel):
    target_url: str
    target_type: str # "jobs" or "contacts"
    keywords: Optional[str] = None  # comma-separated filter keywords

class ColdMailDispatchRequest(BaseModel):
    contact_id: int
    template_id: int
    resume_id: int
    attach_resume: bool = True
