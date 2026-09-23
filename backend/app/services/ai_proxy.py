"""AI proxy service — the ONLY backend module that talks to AI providers.

Developer-pays mode with two interchangeable providers (priority order):
  1. "gemini" — Google AI Studio key (GEMINI_API_KEY) via Gemini's official
     OpenAI-compatible endpoint. Free tier available; recommended default.
  2. "puter"  — Puter server-side API (PUTER_AUTH_TOKEN, created at
     puter.com/dashboard). Requires a paid Puter plan.

Set via backend/.env — see .env.example. Swap point: replace this file's
`chat_completion` to use any other provider; routes and frontend stay put.

Privacy: request messages are never written to logs or disk; only metadata
(provider, model, status codes, timings) is logged.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Optional

import httpx

from app.config import (
    AI_TIMEOUT_SECONDS,
    DEFAULT_AI_MODEL,
    GEMINI_AI_URL,
    GEMINI_API_KEY,
    PUTER_AI_URL,
    PUTER_AUTH_TOKEN,
)

logger = logging.getLogger("lexscope.ai")

_ALLOWED_MODEL_PREFIX = "google/"
_MODEL_RE = re.compile(r"^[a-zA-Z0-9._/-]+$")


class AiUpstreamError(Exception):
    """Upstream (AI provider) failure with a stable machine-readable code."""

    def __init__(self, code: str, message: str, status: int = 502, details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.code = code  # AI_TOKEN_INVALID | AI_SUBSCRIPTION_REQUIRED | QUOTA | MODEL_UNAVAILABLE | TIMEOUT | AI_UPSTREAM_UNREACHABLE | AI_UPSTREAM
        self.message = message
        self.status = status
        self.details = details or {}


def active_provider() -> str:
    """Which provider will serve AI calls right now: 'gemini' | 'puter' | 'none'."""
    if GEMINI_API_KEY:
        return "gemini"
    if PUTER_AUTH_TOKEN:
        return "puter"
    return "none"


def is_configured() -> bool:
    return active_provider() != "none"


def validate_model(model: Optional[str]) -> str:
    resolved = (model or DEFAULT_AI_MODEL).strip()
    if not _MODEL_RE.match(resolved) or not resolved.startswith(_ALLOWED_MODEL_PREFIX):
        raise AiUpstreamError(
            "MODEL_UNAVAILABLE",
            "This AI model is not allowed. Models must be Google/Gemini models (e.g. google/gemini-2.5-flash).",
            status=400,
        )
    return resolved


def _endpoint_and_headers(provider: str, resolved_model: str) -> tuple[str, dict[str, str], str]:
    """Returns (url, headers, model_for_provider)."""
    if provider == "gemini":
        # Gemini's OpenAI-compatible endpoint uses unprefixed model names.
        return (
            GEMINI_AI_URL,
            {"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"},
            resolved_model.removeprefix("google/"),
        )
    return (
        PUTER_AI_URL,
        {"Authorization": f"Bearer {PUTER_AUTH_TOKEN}", "Content-Type": "application/json"},
        resolved_model,
    )


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict[str, Any]:
    """Calls the active AI provider. Returns {"text", "model", "usage", "provider"}."""
    provider = active_provider()
    if provider == "none":
        raise AiUpstreamError(
            "AI_NOT_CONFIGURED",
            "The server has no AI credentials configured yet. See README → “Developer-pays AI setup”.",
            status=503,
        )
    resolved_model = validate_model(model)
    url, headers, provider_model = _endpoint_and_headers(provider, resolved_model)

    payload: dict[str, Any] = {"model": provider_model, "messages": messages}
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        logger.warning("AI upstream timeout after %ss (%s)", AI_TIMEOUT_SECONDS, resolved_model)
        raise AiUpstreamError(
            "TIMEOUT",
            f"The AI service didn't respond within {AI_TIMEOUT_SECONDS}s. Long documents can need a retry.",
            status=504,
        ) from exc
    except httpx.HTTPError as exc:
        logger.warning("AI upstream unreachable: %s", type(exc).__name__)
        raise AiUpstreamError(
            "AI_UPSTREAM_UNREACHABLE",
            "Could not reach the AI service. Check the server's internet connection and try again.",
            status=502,
        ) from exc

    duration = round(time.monotonic() - started, 2)
    logger.info(
        "AI call finished provider=%s model=%s status=%s duration=%ss msgs=%d",
        provider, resolved_model, response.status_code, duration, len(messages),
    )

    if response.status_code in (401, 403):
        raise AiUpstreamError(
            "AI_TOKEN_INVALID",
            f"The configured {provider} credentials were rejected. Create a fresh key and update the server configuration (.env).",
            status=502,
        )
    if response.status_code == 402:
        raise AiUpstreamError(
            "AI_SUBSCRIPTION_REQUIRED",
            "The Puter account behind this server is on the free plan, which doesn't allow server-side (developer-pays) AI calls. Upgrade the Puter subscription, or configure GEMINI_API_KEY (free tier) — until then LexScope falls back to visitor sign-in.",
            status=502,
        )
    if response.status_code == 429:
        raise AiUpstreamError(
            "QUOTA",
            "The AI account behind this server has hit its usage limit. Try again later.",
            status=429,
        )
    if response.status_code == 400:
        body_text = response.text[:300]
        if "model" in body_text.lower():
            raise AiUpstreamError(
                "MODEL_UNAVAILABLE",
                "The AI model is unavailable on this provider right now.",
                status=502,
            )
        raise AiUpstreamError("AI_UPSTREAM", "The AI service rejected the request.", status=502)
    if response.status_code >= 500:
        raise AiUpstreamError(
            "AI_UPSTREAM",
            "The AI service had a temporary problem. Please try again.",
            status=502,
        )
    if response.status_code >= 400:
        raise AiUpstreamError("AI_UPSTREAM", "The AI service returned an unexpected error.", status=502)

    try:
        body = response.json()
    except ValueError as exc:
        raise AiUpstreamError("AI_UPSTREAM", "The AI service returned a malformed response.", status=502) from exc

    text = _extract_text(body)
    if not text or not text.strip():
        raise AiUpstreamError("AI_UPSTREAM", "The AI returned an empty response. Trying again usually fixes this.", status=502)

    usage = body.get("usage") if isinstance(body, dict) else None
    return {"text": text, "model": resolved_model, "usage": usage, "provider": provider}


def _extract_text(body: Any) -> str:
    """Normalizes OpenAI-shaped responses (and tolerant fallbacks) to text."""
    if isinstance(body, str):
        return body
    if not isinstance(body, dict):
        return ""
    choices = body.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]
            if isinstance(first.get("text"), str):
                return first["text"]
    content = body.get("content")
    if isinstance(content, str):
        return content
    return ""
