from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.db.models.user import User
from app.db.models.feedback import Feedback, FeedbackCreate, FeedbackRead

router = APIRouter()

@router.post("/", response_model=FeedbackRead)
async def submit_feedback(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    feedback_in: FeedbackCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Submit user feedback."""
    db_obj = Feedback(
        message=feedback_in.message,
        user_id=current_user.id
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
