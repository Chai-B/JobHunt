from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ResumeBase(BaseModel):
    filename: str
    format: str
    label: Optional[str] = None

class ResumeCreate(ResumeBase):
    pass

class ResumeUpdate(BaseModel):
    label: Optional[str] = None
    raw_text: Optional[str] = None

class ResumeRead(ResumeBase):
    id: int
    user_id: int
    status: str
    structural_score: Optional[float] = None
    semantic_score: Optional[float] = None
    raw_text: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ResumeList(BaseModel):
    items: List[ResumeRead]
    total: int
