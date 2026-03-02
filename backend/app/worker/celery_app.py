from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
)

celery_app.conf.task_routes = {
    "*": "main-queue"
}

# Allow parallel processing of multiple resume uploads / scraper jobs
celery_app.conf.worker_concurrency = 4
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1

celery_app.autodiscover_tasks(['app.worker'])

# Celery Beat Schedule for Fully Autonomous Discovery and Match Tracking
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'run-daily-job-discovery': {
        'task': 'run_automated_discovery_task',
        'schedule': crontab(hour=8, minute=0), # Run every day at 8:00 AM
    },
    'run-daily-match-alerts': {
        'task': 'run_daily_match_alerts_task',
        'schedule': crontab(hour=9, minute=0), # Run every day at 9:00 AM
    },
    'run-user-configured-scraping': {
        'task': 'run_user_configured_scraping_task',
        'schedule': crontab(minute=0, hour='*/4'), # Every 4 hours
    },
    'run-scheduled-cold-mail': {
        'task': 'run_scheduled_cold_mail_task',
        'schedule': crontab(minute=30, hour='*/6'), # Every 6 hours
    },
    'run-periodic-inbox-sync': {
        'task': 'run_periodic_inbox_sync_task',
        'schedule': crontab(minute=0, hour='*/2'), # Every 2 hours
    },
}
