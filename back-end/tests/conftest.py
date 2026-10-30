"""Pytest fixtures and test database setup."""
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base, get_db
from app.main import app
from app.seed import STANDARD_COA, PARTNERS, DEFAULT_PASSWORD
from app.modules.accounting.models import Account
from app.modules.auth.models import User, UserRole
from app.modules.founders.models import Founder
from app.core.security import get_password_hash
from decimal import Decimal

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Create a fresh database session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Seed standard COA
        account_map = {}
        for code, name, classification in STANDARD_COA:
            account = Account(
                code=code,
                name=name,
                classification=classification,
                current_balance=Decimal("0.00"),
            )
            session.add(account)
            await session.flush()
            account_map[code] = account

        # Seed Admin
        admin = User(
            email="admin@visioncraft.lk",
            password_hash=get_password_hash(DEFAULT_PASSWORD),
            full_name="Super Administrator",
            role=UserRole.SUPER_ADMIN.value,
        )
        session.add(admin)

        # Seed 4 Partners
        for p in PARTNERS:
            user = User(
                email=p["email"],
                password_hash=get_password_hash(DEFAULT_PASSWORD),
                full_name=p["name"],
                role=UserRole.FOUNDER.value,
            )
            session.add(user)
            await session.flush()

            founder = Founder(
                user_id=user.id,
                display_name=p["name"],
                ownership_percentage=Decimal("25.00"),
                profit_share_percentage=Decimal("25.00"),
                capital_account_id=account_map[p["capital_code"]].id,
                drawings_account_id=account_map[p["drawings_code"]].id,
                payable_account_id=account_map[p["payable_code"]].id,
            )
            session.add(founder)

        await session.commit()
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession):
    """Async test client with overridden database dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()

