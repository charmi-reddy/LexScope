"""Matter (legal case file) endpoints backed by Supabase."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import get_current_user
from app.models.schemas import MatterCreate, MatterPatch
from app.routes.errors_helpers import error_response
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/matters")


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail=error_response("not_found", "Matter not found."),
    )


def _owned_matter(client: Any, matter_id: str, user_id: str) -> dict[str, Any]:
    result = (
        client.table("matters")
        .select("*")
        .eq("id", matter_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise _not_found()
    return rows[0]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_matter(
    payload: MatterCreate,
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> dict[str, Any]:
    result = (
        client.table("matters")
        .insert({**payload.model_dump(), "user_id": user["id"]})
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else {}


@router.get("")
def list_matters(
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> list[dict[str, Any]]:
    result = (
        client.table("matters")
        .select("*")
        .eq("user_id", user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    matters = result.data or []
    for matter in matters:
        updates = (
            client.table("matter_updates")
            .select("id", count="exact")
            .eq("matter_id", matter["id"])
            .eq("user_id", user["id"])
            .execute()
        )
        matter["update_count"] = updates.count if updates.count is not None else len(updates.data or [])
    return matters


@router.get("/{matter_id}")
def get_matter(
    matter_id: str,
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> dict[str, Any]:
    matter = _owned_matter(client, matter_id, user["id"])
    updates = (
        client.table("matter_updates")
        .select("*")
        .eq("matter_id", matter_id)
        .eq("user_id", user["id"])
        .order("created_at", desc=False)
        .execute()
    )
    matter["updates"] = updates.data or []
    return matter


@router.patch("/{matter_id}")
def patch_matter(
    matter_id: str,
    payload: MatterPatch,
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> dict[str, Any]:
    _owned_matter(client, matter_id, user["id"])
    changes = payload.model_dump(exclude_unset=True)
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = (
        client.table("matters")
        .update(changes)
        .eq("id", matter_id)
        .eq("user_id", user["id"])
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise _not_found()
    return rows[0]


@router.delete("/{matter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_matter(
    matter_id: str,
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> Response:
    _owned_matter(client, matter_id, user["id"])
    client.table("matters").delete().eq("id", matter_id).eq("user_id", user["id"]).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
