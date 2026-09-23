"""Pydantic schemas — the API's response/request contracts."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class DocumentStats(BaseModel):
    char_count: int
    word_count: int
    line_count: int
    reading_time_minutes: float


class DocumentResponse(BaseModel):
    """Result of extraction/validation. `text` is returned so the browser can
    feed the *cleaned* text to Gemini; the server keeps no copy of it."""

    name: str
    text: str
    stats: DocumentStats
    warnings: List[str] = []


class ValidateTextRequest(BaseModel):
    text: str = Field(min_length=1)
    name: Optional[str] = None


class LimitsResponse(BaseModel):
    max_file_bytes: int
    max_text_chars: int
    warn_text_chars: int
    min_text_chars: int
    supported_extensions: List[str]
    planned_extensions: Dict[str, str]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
