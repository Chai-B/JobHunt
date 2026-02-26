from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class ScrapedContactBase(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    role: Optional[str] = None
    company: Optional[str] = None
    source_url: Optional[str] = None
    is_verified: bool = False

class ScrapedContactCreate(ScrapedContactBase):
    pass

class ScrapedContactRead(ScrapedContactBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScrapedContactList(BaseModel):
    items: List[ScrapedContactRead]
    total: int
