"""Local filesystem storage provider using standard library."""
import asyncio
from pathlib import Path
from app.config import settings
from app.core.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    def __init__(self, root_dir: str = settings.STORAGE_LOCAL_ROOT):
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """Resolve path and ensure it stays within root_dir to prevent directory traversal."""
        clean_path = Path(relative_path).as_posix().lstrip("/")
        full_path = (self.root_dir / clean_path).resolve()
        if not str(full_path).startswith(str(self.root_dir.resolve())):
            raise ValueError(f"Path traversal attempt detected: {relative_path}")
        return full_path

    async def save(self, relative_path: str, content: bytes) -> str:
        safe_path = self._resolve_safe_path(relative_path)
        safe_path.parent.mkdir(parents=True, exist_ok=True)

        def _write():
            with open(safe_path, "wb") as f:
                f.write(content)

        await asyncio.to_thread(_write)
        return relative_path

    async def read(self, relative_path: str) -> bytes:
        safe_path = self._resolve_safe_path(relative_path)
        if not safe_path.exists():
            raise FileNotFoundError(f"File not found: {relative_path}")

        def _read() -> bytes:
            with open(safe_path, "rb") as f:
                return f.read()

        return await asyncio.to_thread(_read)

    async def exists(self, relative_path: str) -> bool:
        safe_path = self._resolve_safe_path(relative_path)
        return await asyncio.to_thread(safe_path.is_file)

    async def delete(self, relative_path: str) -> bool:
        safe_path = self._resolve_safe_path(relative_path)

        def _delete() -> bool:
            if safe_path.exists():
                safe_path.unlink()
                return True
            return False

        return await asyncio.to_thread(_delete)

    def get_url(self, relative_path: str) -> str:
        clean_path = relative_path.lstrip("/")
        return f"/api/v1/storage/{clean_path}"
