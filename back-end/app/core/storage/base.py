"""Abstract Storage Provider Interface."""
from abc import ABC, abstractmethod


class StorageProvider(ABC):
    @abstractmethod
    async def save(self, relative_path: str, content: bytes) -> str:
        """Save bytes to storage and return the relative path or URI."""
        pass

    @abstractmethod
    async def read(self, relative_path: str) -> bytes:
        """Read bytes from storage."""
        pass

    @abstractmethod
    async def exists(self, relative_path: str) -> bool:
        """Check if file exists in storage."""
        pass

    @abstractmethod
    async def delete(self, relative_path: str) -> bool:
        """Delete file from storage."""
        pass

    @abstractmethod
    def get_url(self, relative_path: str) -> str:
        """Get publicly accessible or internal download URL for the file."""
        pass
