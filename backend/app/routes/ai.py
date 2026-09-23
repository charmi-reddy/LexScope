"""AI routes — a thin, guarded proxy between the frontend and Puter/Gemini.

Guards, in order:
  1. Token configured?            → 503 ai_not_configured
  2. Per-client rate limit?       → 429 rate_limited
  3. Payload shape & size limits  → 422/413
  4. Model allowlist (google/*)   → 400 model_unavailable

The proxy never logs message content — only counts, models and timings.
"""
from __future__ import annotations

import time
from typing import List, Literal, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import AI_RATE_LIMIT, DEFAULT_AI_MODEL
from app.routes.errors_helpers import error_response
from app.services import ai_proxy
from app.services.ai_proxy import AiUpstreamError

router = APIRouter()

MAX_TOTAL_CHARS = 140_000  # 60k doc + system prompt + repair headroom


class AiChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=140_000)


class AiChatRequest(BaseModel):
    messages: List[AiChatMessage] = Field(min_length=1, max_length=8)
    model: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)


class SlidingWindowLimiter:
    """In-memory per-client sliding window. Single-process (fine for this app)."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        hits = self._hits.setdefault(key, [])
        while hits and hits[0] <= now - window_seconds:
            hits.pop(0)
        if len(hits) >= limit:
            return False
        hits.append(now)
        if len(self._hits) > 10_000:  # crude memory guard
            self._hits.clear()
            self._hits[key] = hits[-1:]
        return True


limiter = SlidingWindowLimiter()


def _parse_rate_limit(raw: str) -> tuple[int, int]:
    try:
        limit, window = raw.split("/")
        return max(1, int(limit)), max(1, int(window))
    except ValueError:
        return 8, 600


@router.get("/ai/status")
async def ai_status() -> dict:
    """Lets the frontend know whether server-side AI is configured (no secrets)."""
    provider = ai_proxy.active_provider()
    return {
        "configured": provider != "none",
        "provider": provider if provider != "none" else None,
        "model": DEFAULT_AI_MODEL,
    }


@router.post("/ai/chat")
async def ai_chat(payload: AiChatRequest, request: Request) -> JSONResponse:
    if not ai_proxy.is_configured():
        return JSONResponse(status_code=503, content=error_response("ai_not_configured", "The server has no AI credentials configured yet. See README → “Developer-pays AI setup”."))

    limit, window = _parse_rate_limit(AI_RATE_LIMIT)
    client_key = request.client.host if request.client else "unknown"
    if not limiter.allow(client_key, limit, window):
        return JSONResponse(status_code=429, content=error_response("rate_limited", f"Too many analyses from your network right now — you can run {limit} every {window // 60} minutes. Please wait and try again."))

    total_chars = sum(len(m.content) for m in payload.messages)
    if total_chars > MAX_TOTAL_CHARS:
        return JSONResponse(status_code=413, content=error_response("document_too_large", "This request is too large for the AI proxy. Split the document and analyze the most important parts."))

    try:
        result = await ai_proxy.chat_completion(
            [m.model_dump() for m in payload.messages],
            model=payload.model,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )
    except AiUpstreamError as exc:
        return JSONResponse(status_code=exc.status, content=error_response(exc.code.lower(), exc.message, details=exc.details))

    return JSONResponse(status_code=200, content={"text": result["text"], "model": result["model"], "usage": result.get("usage")})
