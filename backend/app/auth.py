"""Supabase access token verification for protected API routes."""
from __future__ import annotations

import httpx
from fastapi import HTTPException, Request

from app.config import SUPABASE_ANON_KEY, SUPABASE_URL
from app.routes.errors_helpers import error_response


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=error_response("unauthorized", "A valid bearer token is required."),
    )


async def get_current_user(request: Request) -> dict[str, str]:
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token.strip()}",
                },
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail=error_response("auth_unavailable", "Authentication service is unavailable."),
        ) from None

    if response.status_code in (401, 403):
        raise _unauthorized()
    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=error_response("auth_unavailable", "Authentication service is unavailable."),
        )

    try:
        user_id = response.json()["id"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=503,
            detail=error_response("auth_unavailable", "Authentication service returned an invalid response."),
        ) from None
    return {"id": user_id}
