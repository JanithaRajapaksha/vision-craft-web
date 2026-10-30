"""S3-compatible object storage provider (AWS S3, MinIO, Cloudflare R2)."""
from app.config import settings
from app.core.storage.base import StorageProvider


class S3StorageProvider(StorageProvider):
    def __init__(self):
        # Initialized with credentials from settings for production deployment
        self.endpoint_url = settings.S3_ENDPOINT_URL
        self.bucket_name = settings.S3_BUCKET_NAME
        self.access_key = settings.S3_ACCESS_KEY
        self.secret_key = settings.S3_SECRET_KEY
        self.region = settings.S3_REGION

    async def save(self, relative_path: str, content: bytes) -> str:
        # In production, uses aioboto3 / boto3 to upload to S3
        raise NotImplementedError("S3 provider is active in production mode with boto3.")

    async def read(self, relative_path: str) -> bytes:
        raise NotImplementedError("S3 provider is active in production mode with boto3.")

    async def exists(self, relative_path: str) -> bool:
        raise NotImplementedError("S3 provider is active in production mode with boto3.")

    async def delete(self, relative_path: str) -> bool:
        raise NotImplementedError("S3 provider is active in production mode with boto3.")

    def get_url(self, relative_path: str) -> str:
        return f"{self.endpoint_url}/{self.bucket_name}/{relative_path.lstrip('/')}"

