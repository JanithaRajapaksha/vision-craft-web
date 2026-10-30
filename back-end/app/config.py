"""Application Configuration using Pydantic Settings."""
from pathlib import Path
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes", "debug")
        return bool(v)
    APP_NAME: str = "VisionCraft OS"
    COMPANY_NAME: str = "VisionCraft"
    SECRET_KEY: str = "visioncraft-secure-secret-key-32-bytes-janitha-lalitha-thakshila-melanka"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent}/visioncraft.db"

    # Redis & Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_ALWAYS_EAGER: bool = True

    # Storage Abstraction
    STORAGE_PROVIDER: str = "local"  # "local" or "s3"
    STORAGE_LOCAL_ROOT: str = "/home/janitha/vision-craft-web/storage_data"

    # S3 / Object Storage (Optional for AWS S3 / MinIO production)
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = "visioncraft-assets"
    S3_REGION: Optional[str] = "ap-south-1"

    # 3D Slicer Engine
    PRUSA_SLICER_PATH: str = "/usr/bin/prusa-slicer"
    ORCA_SLICER_PATH: str = "/usr/bin/orca-slicer"
    SLICER_DEFAULT_ENGINE: str = "PRUSA_SLICER"
    SLICER_TIMEOUT_SECONDS: int = 120

    # Default Currency
    DEFAULT_CURRENCY: str = "LKR"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
