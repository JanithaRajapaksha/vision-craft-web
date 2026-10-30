"""Authentication and Security Unit Tests."""
import pytest
from httpx import AsyncClient
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token


def test_password_hashing():
    pwd = "MySecurePassword123!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_generation_and_decoding():
    data = {"sub": "user_uuid_123", "role": "FOUNDER", "email": "janitha@visioncraft.lk"}
    token = create_access_token(data)
    assert isinstance(token, str)

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user_uuid_123"
    assert decoded["role"] == "FOUNDER"
    assert decoded["email"] == "janitha@visioncraft.lk"


@pytest.mark.asyncio
async def test_api_login_success(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "Password123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "janitha@visioncraft.lk"
    assert data["user"]["full_name"] == "Janitha"
    assert data["user"]["role"] == "FOUNDER"


@pytest.mark.asyncio
async def test_api_login_invalid_password(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "IncorrectPassword!"},
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

