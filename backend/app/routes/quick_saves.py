"""Automatic one-shot analysis history stored as matter updates."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.auth import get_current_user
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/quick-saves")
QUICK_ANALYSES_TITLE = "Quick analyses"
MAX_QUICK_ANALYSES = 50


class QuickSaveRequest(BaseModel):
    document_name: str = Field(min_length=1, max_length=200)
    document_text: str
    summary: str = Field(min_length=1)

    @field_validator("summary")
    @classmethod
    def summary_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("summary cannot be empty")
        return value


def _get_or_create_matter(client: Any, user_id: str) -> dict[str, Any]:
    found = (
        client.table("matters")
        .select("id")
        .eq("user_id", user_id)
        .eq("title", QUICK_ANALYSES_TITLE)
        .eq("matter_type", "other")
        .limit(1)
        .execute()
    )
    rows = found.data or []
    if rows:
        return rows[0]

    created = (
        client.table("matters")
        .insert({"user_id": user_id, "title": QUICK_ANALYSES_TITLE, "matter_type": "other"})
        .select("id")
        .execute()
    )
    rows = created.data or []
    if not rows:
        raise RuntimeError("Supabase did not return the created matter id")
    return rows[0]


@router.post("")
def create_quick_save(
    payload: QuickSaveRequest,
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> dict[str, str]:
    user_id = user["id"]
    matter = _get_or_create_matter(client, user_id)
    matter_id = matter["id"]

    client.table("matter_updates").insert(
        {
            "matter_id": matter_id,
            "user_id": user_id,
            "label": payload.document_name,
            "update_type": "other",
            "document_name": payload.document_name,
            "document_text": payload.document_text,
            "summary": payload.summary,
            "what_changed": "",
        }
    ).execute()

    client.table("matters").update(
        {"updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", matter_id).eq("user_id", user_id).execute()

    updates = (
        client.table("matter_updates")
        .select("id,created_at")
        .eq("matter_id", matter_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    old_updates = (updates.data or [])[MAX_QUICK_ANALYSES:]
    for old_update in old_updates:
        client.table("matter_updates").delete().eq("id", old_update["id"]).eq(
            "matter_id", matter_id
        ).eq("user_id", user_id).execute()

    return {"matter_id": matter_id}
