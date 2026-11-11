"""Unit tests for Supabase bearer token verification."""
from __future__ import annotations

import os
import asyncio

os.environ.setdefault("SUPABASE_URL", "https://supabase.example.test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "unit-test-service-role")
os.environ.setdefault("SUPABASE_ANON_KEY", "unit-test-anon")

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.auth import get_current_user


def _request(authorization: str | None = None) -> Request:
    headers = [] if authorization is None else [(b"authorization", authorization.encode())]
    return Request({"type": "http", "headers": headers, "method": "GET", "path": "/"})


def test_missing_header_is_401():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(_request()))
    assert exc.value.status_code == 401
    assert exc.value.detail["error"]["code"] == "unauthorized"


def test_valid_token_returns_user_id():
    response = httpx.Response(200, json={"id": "user-123"})
    with patch("app.auth.httpx.AsyncClient") as client_cls:
        client_cls.return_value.__aenter__ = AsyncMock(return_value=client_cls.return_value)
        client_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value.get = AsyncMock(return_value=response)
        assert asyncio.run(get_current_user(_request("Bearer abc"))) == {"id": "user-123"}
        client_cls.return_value.get.assert_awaited_once_with(
            "https://supabase.example.test/auth/v1/user",
            headers={"apikey": "unit-test-anon", "Authorization": "Bearer abc"},
        )


def test_invalid_token_is_401():
    response = httpx.Response(401)
    with patch("app.auth.httpx.AsyncClient") as client_cls:
        client_cls.return_value.__aenter__ = AsyncMock(return_value=client_cls.return_value)
        client_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value.get = AsyncMock(return_value=response)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(get_current_user(_request("Bearer bad")))
    assert exc.value.status_code == 401
    assert exc.value.detail["error"]["code"] == "unauthorized"


def test_network_error_is_503():
    error = httpx.ConnectError("offline")
    with patch("app.auth.httpx.AsyncClient") as client_cls:
        client_cls.return_value.__aenter__ = AsyncMock(return_value=client_cls.return_value)
        client_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value.get = AsyncMock(side_effect=error)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(get_current_user(_request("Bearer abc")))
    assert exc.value.status_code == 503
    assert exc.value.detail["error"]["code"] == "auth_unavailable"
