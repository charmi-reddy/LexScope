"""Document routes: extraction (file upload) and validation (pasted text).

These endpoints never persist documents — bytes are read, processed in
memory, and released when the request ends. Nothing is written to disk and
nothing is logged except metadata (sizes, extension names).
"""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.config import (
    MAX_FILE_BYTES,
    MAX_TEXT_CHARS,
    MIN_TEXT_CHARS,
    PLANNED_EXTENSIONS,
    WARN_TEXT_CHARS,
)
from app.models.schemas import DocumentResponse, LimitsResponse, ValidateTextRequest
from app.services import extraction, text_processing
from app.utils.errors import (
    AppError,
    DocumentTooLargeError,
    UnsupportedFormatError,
)

router = APIRouter()


def _build_response(name: str, raw_text: str) -> DocumentResponse:
    text = text_processing.clean_text(raw_text)
    text_processing.validate_document_text(text)
    return DocumentResponse(
        name=name,
        text=text,
        stats=text_processing.compute_stats(text),
        warnings=text_processing.quality_warnings(text),
    )


@router.post("/documents/extract", response_model=DocumentResponse)
async def extract_document(file: UploadFile = File(...)) -> DocumentResponse:
    """Upload a document file (.txt today) and receive cleaned text + stats."""
    filename = file.filename or "uploaded.txt"
    ext = extraction.extension_of(filename)

    if extraction.get_extractor(ext) is None:
        raise UnsupportedFormatError(
            extraction.planned_format_message(ext)
            if ext in PLANNED_EXTENSIONS
            else "Unsupported file type. Upload a .txt file or paste the document text.",
            details={"extension": ext or "unknown"},
        )

    content = await file.read()
    if len(content) == 0:
        raise AppError("The uploaded file is empty.", code="empty_document", status_code=422)
    if len(content) > MAX_FILE_BYTES:
        raise DocumentTooLargeError(
            f"The file is {len(content) / 1024:.0f} KB — the limit is {MAX_FILE_BYTES // 1024} KB. "
            "Trim the file or paste only the sections you care about."
        )

    extractor = extraction.get_extractor(ext)
    raw_text = extractor(content)
    safe_name = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return _build_response(safe_name, raw_text)


@router.post("/documents/validate", response_model=DocumentResponse)
async def validate_document(payload: ValidateTextRequest) -> DocumentResponse:
    """Validate pasted text and receive cleaned text + stats (no storage)."""
    name = (payload.name or "").strip() or "Pasted document"
    return _build_response(name, payload.text)


@router.get("/meta/limits", response_model=LimitsResponse)
async def get_limits() -> LimitsResponse:
    """Frontends mirror these limits so users get feedback before uploading."""
    return LimitsResponse(
        max_file_bytes=MAX_FILE_BYTES,
        max_text_chars=MAX_TEXT_CHARS,
        warn_text_chars=WARN_TEXT_CHARS,
        min_text_chars=MIN_TEXT_CHARS,
        supported_extensions=extraction.supported_extensions(),
        planned_extensions=PLANNED_EXTENSIONS,
    )
