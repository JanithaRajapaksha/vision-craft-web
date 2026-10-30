"""VisionCraft OS Backend Main FastAPI Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.core.logging import setup_logging, logger
from app.core.exceptions import DomainException
from app.modules.auth.router import router as auth_router
from app.modules.accounting.router import router as accounting_router
from app.modules.founders.router import router as founders_router
from app.modules.printing_3d.router import router as printing_3d_router
from app.core.database import engine, Base
import app.modules.printing_3d.models

# Setup structured logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist (e.g. PostgreSQL in Docker or SQLite in dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        from app.seed import seed_database
        await seed_database()
    except Exception as e:
        logger.warning(f"Database auto-seed notice: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="VisionCraft OS – Complete Business Management System for Engineering & FDM Manufacturing Operations",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.message, "code": exc.code},
    )


# Health check endpoint
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "app_name": settings.APP_NAME,
        "currency": settings.DEFAULT_CURRENCY,
    }


# Include modular domain routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(founders_router, prefix="/api/v1")
app.include_router(printing_3d_router, prefix="/api/v1")

