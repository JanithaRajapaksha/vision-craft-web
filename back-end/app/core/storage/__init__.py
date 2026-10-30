"""Storage provider factory."""
from app.config import settings
from app.core.storage.base import StorageProvider
from app.core.storage.local import LocalStorageProvider
from app.core.storage.s3 import S3StorageProvider

_storage_instance: StorageProvider | None = None


def get_storage() -> StorageProvider:
    global _storage_instance
    if _storage_instance is None:
        if settings.STORAGE_PROVIDER.lower() == "s3":
            _storage_instance = S3StorageProvider()
        else:
            _storage_instance = LocalStorageProvider(settings.STORAGE_LOCAL_ROOT)
    return _storage_instance
