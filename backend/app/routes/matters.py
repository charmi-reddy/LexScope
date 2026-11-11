"""Matter (legal case file) endpoints backed by Supabase."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.auth import get_current_user
from app.config import MAX_FILE_BYTES, PLANNED_EXTENSIONS
from app.models.schemas import MatterCreate, MatterPatch
from app.routes.errors_helpers import error_response
from app.services import extraction, matter_ai, text_processing
from app.services.ai_proxy import AiUpstreamError
from app.services.supabase_client import get_supabase
from app.utils.errors import DocumentTooLargeError, EmptyDocumentError, UnsupportedFormatError

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


@router.post("/{matter_id}/updates")
async def create_matter_update(
    matter_id: str,
    file: UploadFile = File(...),
    label: str = Form(..., min_length=1, max_length=120),
    update_type: Literal["notice", "reply", "hearing-order", "order", "other"] = Form("other"),
    user: dict = Depends(get_current_user),
    client: Any = Depends(get_supabase),
) -> Any:
    matter = _owned_matter(client, matter_id, user["id"])

    filename = file.filename or "uploaded.txt"
    extension = extraction.extension_of(filename)
    extractor = extraction.get_extractor(extension)
    if extractor is None:
        raise UnsupportedFormatError(
            extraction.planned_format_message(extension)
            if extension in PLANNED_EXTENSIONS
            else "Unsupported file type. Upload a supported document file.",
            details={"extension": extension or "unknown"},
        )

    content = await file.read()
    if not content:
        raise EmptyDocumentError("The uploaded file is empty. Upload a document that contains text.")
    if len(content) > MAX_FILE_BYTES:
        raise DocumentTooLargeError(
            f"The file is {len(content) / 1024:.0f} KB — the limit is {MAX_FILE_BYTES // 1024} KB."
        )
    document_text = text_processing.clean_text(extractor(content))
    text_processing.validate_document_text(document_text)

    previous_result = (
        client.table("matter_updates")
        .select("label,summary,created_at")
        .eq("matter_id", matter_id)
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    previous_updates = list(reversed(previous_result.data or []))
    try:
        summaries = await matter_ai.summarize_matter_update(
            matter.get("title", ""),
            matter.get("current_summary"),
            [{"label": row.get("label", ""), "summary": row.get("summary", "")} for row in previous_updates],
            document_text,
        )
    except AiUpstreamError as exc:
        return JSONResponse(
            status_code=502,
            content=error_response(exc.code.lower(), exc.message, details=exc.details),
        )

    client.table("matter_updates").insert(
        {
            "matter_id": matter_id,
            "user_id": user["id"],
            "label": label,
            "update_type": update_type,
            "document_name": filename,
            "document_text": document_text,
            "summary": summaries["update_summary"],
            "what_changed": summaries["what_changed"],
        }
    ).execute()
    client.table("matters").update(
        {
            "current_summary": summaries["running_summary"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", matter_id).eq("user_id", user["id"]).execute()

    return get_matter(matter_id, user, client)


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
