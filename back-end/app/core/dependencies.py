"""FastAPI dependencies: Database sessions, current user authentication, and RBAC."""
from typing import Annotated, List
from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.modules.auth.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate the currently authenticated user from the JWT token."""
    payload = decode_access_token(token)
    if not payload:
        raise AuthenticationError("Could not validate credentials: invalid or expired token.")

    user_id: str = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Token payload missing subject identifier.")

    query = select(User).where(User.id == user_id, User.is_active == True)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError("User account not found or has been disabled.")

    return user


def require_roles(*allowed_roles: UserRole):
    """Factory creating a dependency that enforces RBAC roles."""
    allowed_values = [r.value for r in allowed_roles]

    async def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        # Super admin has global bypass permission
        if current_user.role == UserRole.SUPER_ADMIN.value:
            return current_user

        if current_user.role not in allowed_values:
            raise AuthorizationError(
                f"Role '{current_user.role}' does not have permission. Required roles: {allowed_values}"
            )
        return current_user

    return role_checker

