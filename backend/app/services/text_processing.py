"""Text cleaning, statistics and lightweight quality checks.

Privacy note: functions here deliberately *return* data instead of printing or
logging it. Documents are processed in memory and never persisted.
"""
from __future__ import annotations

import re
from typing import List

from app.config import MAX_TEXT_CHARS, MIN_TEXT_CHARS, WARN_TEXT_CHARS

# Strip control characters except tab/newline.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_BLANK_RE = re.compile(r"\n{3,}")
_TRAILING_SPACE_RE = re.compile(r"[ \t]+$", re.MULTILINE)

# Soft heuristic: words that commonly appear in legal documents. Used only to
# attach a gentle "doesn't look like a legal document" warning.
_LEGAL_HINTS = [
    "agreement", "party", "parties", "hereby", "clause", "terms", "conditions",
    "shall", "liability", "termination", "contract", "license", "warranty",
    "indemnify", "confidential", "governing law", "jurisdiction", "lessee",
    "lessor", "employer", "employee", "tenant", "landlord", " Obligations",
]


def clean_text(raw: str) -> str:
    """Normalise whitespace and remove junk characters, preserving structure."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_RE.sub("", text)
    text = _TRAILING_SPACE_RE.sub("", text)
    text = _MULTI_BLANK_RE.sub("\n\n", text)
    return text.strip()


def word_count(text: str) -> int:
    return len(text.split())


def compute_stats(text: str) -> dict:
    words = word_count(text)
    return {
        "char_count": len(text),
        "word_count": words,
        "line_count": text.count("\n") + 1 if text else 0,
        # Average silent reading speed ~200 wpm.
        "reading_time_minutes": round(words / 200.0, 1) if words else 0.0,
    }


def quality_warnings(text: str) -> List[str]:
    """Non-fatal quality notices shown to the user alongside the stats."""
    warnings: List[str] = []
    n = len(text)
    if n == 0:
        return warnings
    if n < 300:
        warnings.append(
            "This text is very short — a full legal document usually gives more useful analysis."
        )
    elif n >= WARN_TEXT_CHARS:
        warnings.append(
            "This is a long document. Analysis may take longer, and very deep sections may be summarised at a high level."
        )
    lowered = text.lower()
    if not any(hint.lower() in lowered for hint in _LEGAL_HINTS):
        warnings.append(
            "This doesn't read like a legal document. You can still analyse it, but results may be less meaningful."
        )
    return warnings


def validate_document_text(text: str) -> None:
    """Hard validation — raises AppError subclasses on failure."""
    from app.utils.errors import DocumentTooLargeError, EmptyDocumentError

    if not text or not text.strip():
        raise EmptyDocumentError(
            "The document is empty. Paste legal text or upload a .txt file that contains content."
        )
    if len(text) < MIN_TEXT_CHARS:
        raise EmptyDocumentError(
            f"This text is too short to analyse ({len(text)} characters). "
            f"A legal document should contain at least {MIN_TEXT_CHARS} characters."
        )
    if len(text) > MAX_TEXT_CHARS:
        raise DocumentTooLargeError(
            f"This document is too large ({len(text):,} characters). "
            f"The current limit is {MAX_TEXT_CHARS:,} characters — split the document and analyse the most important parts."
        )
