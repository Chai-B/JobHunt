from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class JobPostingBase(BaseModel):
    title: str
    company: str
    description: str

class JobPostingCreate(JobPostingBase):
    pass

class JobPostingRead(JobPostingBase):
    id: int
    source: str
    external_id: Optional[str] = None
    relevance_score: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JobMatchResult(BaseModel):
    job: JobPostingRead
    best_resume_id: int
    match_score: float
