from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
)

celery_app.conf.task_routes = {
    "app.worker.tasks.*": "main-queue"
}

celery_app.autodiscover_tasks(['app.worker'])

# Celery Beat Schedule for Fully Autonomous Discovery and Match Tracking
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'run-daily-job-discovery': {
        'task': 'app.worker.tasks.run_automated_discovery_task',
        'schedule': crontab(hour=8, minute=0), # Run every day at 8:00 AM
    },
    'run-daily-match-alerts': {
        'task': 'app.worker.tasks.run_daily_match_alerts_task',
        'schedule': crontab(hour=9, minute=0), # Run every day at 9:00 AM
    },
}
