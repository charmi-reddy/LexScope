"""Tests for the developer-pays AI proxy routes.

All upstream calls are mocked — no network, no real Puter token needed.
Run: cd backend && python -m pytest tests/ -q
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.routes import ai as ai_routes
from app.services import ai_proxy

client = TestClient(ai_routes and __import__("app.main", fromlist=["app"]).app)


@pytest.fixture(autouse=True)
def reset_limiter():
    ai_routes.limiter._hits.clear()
    yield
    ai_routes.limiter._hits.clear()


MSG = [{"role": "system", "content": "sys"}, {"role": "user", "content": "doc text"}]


def test_status_reports_unconfigured(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: False)
    r = client.get("/api/ai/status")
    assert r.status_code == 200
    assert r.json()["configured"] is False


def test_chat_requires_token(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: False)
    r = client.post("/api/ai/chat", json={"messages": MSG})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "ai_not_configured"


def test_chat_success_passthrough(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: True)

    async def fake_completion(messages, **kwargs):
        assert messages == MSG
        assert kwargs["model"] is None  # falls back to server default
        return {"text": "RAW AI TEXT", "model": "google/gemini-2.5-flash", "usage": {"x": 1}}

    monkeypatch.setattr(ai_proxy, "chat_completion", fake_completion)
    r = client.post("/api/ai/chat", json={"messages": MSG})
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "RAW AI TEXT"
    assert body["model"] == "google/gemini-2.5-flash"


def test_chat_rejects_non_google_model(monkeypatch):
    monkeypatch.setattr(ai_proxy, "GEMINI_API_KEY", "k")  # provider configured
    r = client.post("/api/ai/chat", json={"messages": MSG, "model": "openai/gpt-4o"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "model_unavailable"


def test_rate_limit(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: True)
    monkeypatch.setattr(ai_routes, "AI_RATE_LIMIT", "2/60")

    async def fake_completion(messages, **kwargs):
        return {"text": "ok", "model": "google/gemini-2.5-flash", "usage": None}

    monkeypatch.setattr(ai_proxy, "chat_completion", fake_completion)
    assert client.post("/api/ai/chat", json={"messages": MSG}).status_code == 200
    assert client.post("/api/ai/chat", json={"messages": MSG}).status_code == 200
    r = client.post("/api/ai/chat", json={"messages": MSG})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"


def test_upstream_error_mapping(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: True)

    async def fake_completion(messages, **kwargs):
        raise ai_proxy.AiUpstreamError("AI_TOKEN_INVALID", "token rejected", status=502)

    monkeypatch.setattr(ai_proxy, "chat_completion", fake_completion)
    r = client.post("/api/ai/chat", json={"messages": MSG})
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "ai_token_invalid"


def test_free_plan_402_mapping(monkeypatch):
    """Puter free plan: server-side calls get HTTP 402 → typed, actionable error."""
    import asyncio

    from app.services import ai_proxy

    monkeypatch.setattr(ai_proxy, "PUTER_AUTH_TOKEN", "dummy-token-for-test")

    class FakeResponse:
        status_code = 402
        text = '{"error": "A subscription is required for this action"}'

        def json(self):
            return {"error": "A subscription is required for this action"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(ai_proxy.httpx, "AsyncClient", FakeClient)

    with pytest.raises(ai_proxy.AiUpstreamError) as excinfo:
        asyncio.run(ai_proxy.chat_completion([{"role": "user", "content": "x"}]))
    assert excinfo.value.code == "AI_SUBSCRIPTION_REQUIRED"


def test_payload_size_guard(monkeypatch):
    monkeypatch.setattr(ai_proxy, "is_configured", lambda: True)
    # Two messages under the per-message cap but over the total-request guard.
    big = "x" * 80_000
    r = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": big}, {"role": "user", "content": big}]})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "document_too_large"


def test_model_validation_function():
    assert ai_proxy.validate_model(None) == ai_proxy.DEFAULT_AI_MODEL
    assert ai_proxy.validate_model("google/gemini-2.0-flash") == "google/gemini-2.0-flash"
    with pytest.raises(ai_proxy.AiUpstreamError):
        ai_proxy.validate_model("openai/gpt-4o")
    with pytest.raises(ai_proxy.AiUpstreamError):
        ai_proxy.validate_model("../etc/passwd")


def test_provider_selection(monkeypatch):
    monkeypatch.setattr(ai_proxy, "GEMINI_API_KEY", "k1")
    monkeypatch.setattr(ai_proxy, "PUTER_AUTH_TOKEN", "t1")
    assert ai_proxy.active_provider() == "gemini"  # gemini wins when both set

    monkeypatch.setattr(ai_proxy, "GEMINI_API_KEY", None)
    assert ai_proxy.active_provider() == "puter"

    monkeypatch.setattr(ai_proxy, "PUTER_AUTH_TOKEN", None)
    assert ai_proxy.active_provider() == "none"
    assert ai_proxy.is_configured() is False


def test_gemini_provider_strips_prefix_and_uses_key(monkeypatch):
    """Gemini route: model 'google/x' → 'x', GEMINI_API_KEY used as Bearer."""
    import asyncio

    from app.services import ai_proxy

    monkeypatch.setattr(ai_proxy, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(ai_proxy, "PUTER_AUTH_TOKEN", None)

    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

        def json(self):
            return {
                "choices": [{"message": {"content": "hello"}}],
                "usage": {"total_tokens": 3},
            }

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, headers=None, **k):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(ai_proxy.httpx, "AsyncClient", FakeClient)

    result = asyncio.run(ai_proxy.chat_completion([{"role": "user", "content": "x"}]))
    assert captured["url"] == ai_proxy.GEMINI_AI_URL
    assert captured["json"]["model"] == "gemini-2.5-flash"  # prefix stripped
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert result["text"] == "hello"
    assert result["provider"] == "gemini"
