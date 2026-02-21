"""
In-memory task registry for tracking and cancelling background async tasks.
Used when Celery/Redis is unavailable or for direct inline execution.
"""
import asyncio
from typing import Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger


@dataclass
class TaskInfo:
    task_id: str
    user_id: int
    task_type: str  # "scraper", "resume_extraction"
    status: str = "running"  # running, completed, cancelled, failed
    asyncio_task: Optional[asyncio.Task] = field(default=None, repr=False)
    created_at: datetime = field(default_factory=datetime.utcnow)


# Global registry
_tasks: Dict[str, TaskInfo] = {}
_counter = 0


def register_task(user_id: int, task_type: str, asyncio_task: asyncio.Task) -> str:
    """Register a new async task and return its ID."""
    global _counter
    _counter += 1
    task_id = f"{task_type}_{user_id}_{_counter}"
    _tasks[task_id] = TaskInfo(
        task_id=task_id,
        user_id=user_id,
        task_type=task_type,
        asyncio_task=asyncio_task,
    )
    logger.info(f"Registered task {task_id}")
    return task_id


def cancel_task(task_id: str) -> bool:
    """Cancel a running task by ID. Returns True if cancelled."""
    info = _tasks.get(task_id)
    if not info:
        return False
    if info.asyncio_task and not info.asyncio_task.done():
        info.asyncio_task.cancel()
        info.status = "cancelled"
        logger.info(f"Cancelled task {task_id}")
        return True
    return False


def cancel_user_tasks(user_id: int, task_type: Optional[str] = None) -> int:
    """Cancel all running tasks for a user, optionally filtered by type."""
    count = 0
    for info in _tasks.values():
        if info.user_id == user_id and info.status == "running":
            if task_type and info.task_type != task_type:
                continue
            if info.asyncio_task and not info.asyncio_task.done():
                info.asyncio_task.cancel()
                info.status = "cancelled"
                count += 1
    logger.info(f"Cancelled {count} tasks for user {user_id}")
    return count


def get_running_tasks(user_id: int) -> list:
    """Get all running tasks for a user."""
    return [
        {"task_id": t.task_id, "task_type": t.task_type, "created_at": t.created_at.isoformat()}
        for t in _tasks.values()
        if t.user_id == user_id and t.status == "running"
        and t.asyncio_task and not t.asyncio_task.done()
    ]


def cleanup_done_tasks():
    """Remove completed tasks from registry to prevent memory leak."""
    done = [k for k, v in _tasks.items() if v.asyncio_task and v.asyncio_task.done()]
    for k in done:
        _tasks[k].status = "completed"
