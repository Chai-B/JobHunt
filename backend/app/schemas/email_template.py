from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    body_text: str
    is_active: bool = True

class EmailTemplateCreate(EmailTemplateBase):
    pass

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    is_active: Optional[bool] = None

class EmailTemplateRead(EmailTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EmailTemplateList(BaseModel):
    items: List[EmailTemplateRead]
    total: int
