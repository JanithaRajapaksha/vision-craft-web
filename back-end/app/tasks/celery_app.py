"""Celery application configuration for VisionCraft OS."""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "visioncraft",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Colombo",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_routes={
        "app.tasks.slicing.*": {"queue": "slicing"},
        "app.tasks.pdf.*": {"queue": "pdf"},
        "app.tasks.default.*": {"queue": "default"},
    },
)


@celery_app.task(name="ping")
def ping_task():
    return "pong"
