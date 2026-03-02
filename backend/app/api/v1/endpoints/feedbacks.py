from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api import deps
from app.db.models.user import User
from app.db.models.feedback import Feedback, FeedbackComment
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackRead,
    FeedbackDetail,
    FeedbackCommentCreate,
    FeedbackCommentRead
)

router = APIRouter()

@router.get("/", response_model=List[FeedbackRead])
async def read_feedbacks(
    db: AsyncSession = Depends(deps.get_db),
    status: Optional[str] = None,
    sort_by: str = Query("latest", regex="^(latest|upvotes)$"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Retrieve feedbacks, filtered by status."""
    stmt = select(Feedback).options(selectinload(Feedback.user))
    if status in ["Active", "Closed"]:
        stmt = stmt.where(Feedback.status == status)

    if sort_by == "upvotes":
        stmt = stmt.order_by(Feedback.upvotes.desc(), Feedback.created_at.desc())
    else:
        stmt = stmt.order_by(Feedback.created_at.desc())

    stmt = stmt.offset(skip).limit(limit)
    res = await db.execute(stmt)
    feedbacks = res.scalars().all()
    
    # Map user data + manual comment count (without requiring a tricky subquery for now, or we can just count len(comments))
    # Eager loading comments just for count is expensive, but for now we do a simple map. 
    # Better: load with selectinload(Feedback.comments) and get len
    
    # We'll re-query with comments for count
    stmt = stmt.options(selectinload(Feedback.comments))
    res = await db.execute(stmt)
    feedbacks = res.scalars().all()

    results = []
    for f in feedbacks:
        f_dict = FeedbackRead.model_validate(f).model_dump()
        f_dict["comment_count"] = len(f.comments)
        if f.user:
            f_dict["user_name"] = f.user.full_name or f.user.email.split('@')[0]
            f_dict["user_email"] = f.user.email
        results.append(f_dict)
    
    return results

@router.post("/", response_model=FeedbackRead)
async def create_feedback(
    *,
    db: AsyncSession = Depends(deps.get_db),
    feedback_in: FeedbackCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Create new feedback."""
    db_obj = Feedback(
        user_id=current_user.id,
        title=feedback_in.title,
        type=feedback_in.type,
        message=feedback_in.message,
        status="Active",
        upvotes=1  # OP inherently upvotes it
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    db_obj.comment_count = 0
    db_obj.user_name = current_user.full_name or current_user.email.split('@')[0]
    db_obj.user_email = current_user.email
    return db_obj

@router.get("/{feedback_id}", response_model=FeedbackDetail)
async def get_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Get a specific feedback thread and comments."""
    stmt = select(Feedback).where(Feedback.id == feedback_id).options(
        selectinload(Feedback.user),
        selectinload(Feedback.comments).selectinload(FeedbackComment.user)
    )
    res = await db.execute(stmt)
    f = res.scalars().first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")

    result = FeedbackDetail.model_validate(f).model_dump()
    result["comment_count"] = len(f.comments)
    if f.user:
        result["user_name"] = f.user.full_name or f.user.email.split('@')[0]
        result["user_email"] = f.user.email
    
    # Map comments
    formatted_comments = []
    for c in f.comments:
        c_dict = FeedbackCommentRead.model_validate(c).model_dump()
        if c.user:
            c_dict["user_name"] = c.user.full_name or c.user.email.split('@')[0]
            c_dict["user_email"] = c.user.email
        formatted_comments.append(c_dict)
        
    result["comments"] = formatted_comments
    return result

@router.post("/{feedback_id}/comments", response_model=FeedbackCommentRead)
async def add_comment(
    feedback_id: int,
    comment_in: FeedbackCommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Add a comment to a feedback thread."""
    stmt = select(Feedback).where(Feedback.id == feedback_id)
    f = (await db.execute(stmt)).scalars().first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")

    comment = FeedbackComment(
        feedback_id=feedback_id,
        user_id=current_user.id,
        message=comment_in.message
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    result = FeedbackCommentRead.model_validate(comment).model_dump()
    result["user_name"] = current_user.full_name or current_user.email.split('@')[0]
    result["user_email"] = current_user.email
    return result

@router.put("/{feedback_id}/status", response_model=FeedbackRead)
async def toggle_status(
    feedback_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Toggle status between Active and Closed."""
    stmt = select(Feedback).where(Feedback.id == feedback_id).options(selectinload(Feedback.user))
    f = (await db.execute(stmt)).scalars().first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Optional: ensure only OP or admin can close
    if f.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    f.status = "Closed" if f.status == "Active" else "Active"
    db.add(f)
    await db.commit()
    await db.refresh(f)
    
    result = FeedbackRead.model_validate(f).model_dump()
    if f.user:
        result["user_name"] = f.user.full_name or f.user.email.split('@')[0]
        result["user_email"] = f.user.email
    return result

@router.post("/{feedback_id}/upvote")
async def upvote_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Increment upvotes. (In a full prod system, we'd track who upvoted to prevent multiples, but this is a lightweight MVP)."""
    stmt = select(Feedback).where(Feedback.id == feedback_id)
    f = (await db.execute(stmt)).scalars().first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")

    f.upvotes = f.upvotes + 1
    db.add(f)
    await db.commit()
    return {"message": "Upvoted"}
