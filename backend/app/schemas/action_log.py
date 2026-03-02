from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ActionLogBase(BaseModel):
    action_type: str
    status: str
    message: Optional[str] = None
    user_id: Optional[int] = None

class ActionLogCreate(ActionLogBase):
    pass

class ActionLogResponse(ActionLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
