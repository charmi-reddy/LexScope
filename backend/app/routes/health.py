"""Health + meta routes."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import APP_NAME, APP_VERSION
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service=APP_NAME, version=APP_VERSION)
