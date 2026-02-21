from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.api import deps
from app.db.models.action_log import ActionLog
from app.schemas.action_log import ActionLogResponse
from app.db.models.user import User
from app.services.task_registry import cancel_user_tasks, get_running_tasks

router = APIRouter()

@router.get("/", response_model=List[ActionLogResponse])
async def get_logs(
    status: Optional[str] = Query(None, description="Filter logs by status (e.g. 'running')"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Retrieve background action logs for the current user."""
    query = select(ActionLog).where(ActionLog.user_id == current_user.id)
    if status:
        query = query.where(ActionLog.status == status)
    if action_type:
        query = query.where(ActionLog.action_type == action_type)
    query = query.order_by(ActionLog.created_at.desc()).limit(100)
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs

@router.post("/stop-all", status_code=200)
async def stop_all_tasks(
    current_user: User = Depends(deps.get_current_active_user)
):
    """Stop all running background tasks for the current user."""
    count = cancel_user_tasks(current_user.id)
    return {"message": f"Stopped {count} running task(s).", "cancelled": count}

@router.get("/running")
async def get_running(
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all currently running in-memory tasks."""
    tasks = get_running_tasks(current_user.id)
    return {"running_tasks": tasks, "count": len(tasks)}
