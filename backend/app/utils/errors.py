"""Typed application errors with a single JSON error envelope.

Every error surfaced by the API uses the shape:
    {"error": {"code": "...", "message": "...", "details": {...}}}
so the frontend can render precise, human-friendly messages.
"""
from __future__ import annotations

from typing import Any, Optional


class AppError(Exception):
    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}


class EmptyDocumentError(AppError):
    status_code = 422
    code = "empty_document"


class DocumentTooLargeError(AppError):
    status_code = 413
    code = "document_too_large"


class UnsupportedFormatError(AppError):
    status_code = 415
    code = "unsupported_format"
