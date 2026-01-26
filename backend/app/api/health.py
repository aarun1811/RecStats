"""Health check endpoint."""

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("")
async def health_check():
    """Check if the API is running."""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
    }


@router.get("/ready")
async def readiness_check():
    """Check if the API is ready to serve requests."""
    # Could add database connectivity check here
    return {"status": "ready"}
