from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

# Comment schemas
class FeedbackCommentCreate(BaseModel):
    message: str

class FeedbackCommentRead(BaseModel):
    id: int
    feedback_id: int
    user_id: int
    message: str
    created_at: datetime
    
    # Information from the user who posted the comment
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True

# Feedback schemas
class FeedbackCreate(BaseModel):
    title: str
    type: str # "Issue", "Feature Request", "General"
    message: str

class FeedbackRead(BaseModel):
    id: int
    user_id: int
    title: str
    type: str
    status: str
    message: str
    upvotes: int
    created_at: datetime

    # Pre-calculated or joined fields
    comment_count: Optional[int] = 0
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True

class FeedbackDetail(FeedbackRead):
    comments: List[FeedbackCommentRead] = []

    class Config:
        from_attributes = True
