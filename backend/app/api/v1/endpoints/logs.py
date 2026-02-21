from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.api import deps
from app.db.models.action_log import ActionLog
from app.schemas.action_log import ActionLogResponse
from app.db.models.user import User

router = APIRouter()

@router.get("/", response_model=List[ActionLogResponse])
async def get_logs(
    status: Optional[str] = Query(None, description="Filter logs by status (e.g. 'running')"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Retrieve background action logs for the current user.
    Optionally filter by status.
    """
    query = select(ActionLog).where(ActionLog.user_id == current_user.id)
    if status:
        query = query.where(ActionLog.status == status)
    query = query.order_by(ActionLog.created_at.desc()).limit(100)
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs

