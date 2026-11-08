"""Document text extraction.

The extractor registry below is the single extension point. New file types are
registered here; routes, validation and response schemas stay unchanged.
"""
from __future__ import annotations

import io
import re
from typing import Callable, Optional

from docx import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

from app.config import PLANNED_EXTENSIONS, TEXT_EXTENSIONS
from app.utils.errors import AppError

Extractor = Callable[[bytes], str]


def _decode_bytes(content: bytes) -> str:
    """Decode file bytes to text, tolerating BOMs and common legacy encodings."""
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    # Last resort: never crash on encoding — replace undecodable characters.
    return content.decode("cp1252", errors="replace")


def extract_txt(content: bytes) -> str:
    return _decode_bytes(content)


def extract_pdf(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:  # pragma: no cover - defensive; route handles AppError
        raise AppError(
            "This PDF could not be read and may be corrupted. Please try again or paste the text instead.",
            code="corrupted_document",
            status_code=422,
        ) from exc

    if reader.is_encrypted:
        raise AppError(
            "This PDF is password-protected and cannot be read yet. Please remove the password or paste the text instead.",
            code="password_protected_document",
            status_code=422,
        )

    pages: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        cleaned = " ".join(text.split())
        if cleaned:
            pages.append(cleaned)

    combined = "\n\n".join(pages)
    visible = re.sub(r"\s+", "", combined)
    if not combined.strip() or len(visible) < 20:
        raise AppError(
            "This PDF looks like a scanned document and LexScope cannot read images yet — export or paste the text instead.",
            code="scanned_document",
            status_code=422,
        )
    return combined


def extract_docx(content: bytes) -> str:
    try:
        document = DocxDocument(io.BytesIO(content))
    except Exception as exc:
        raise AppError(
            "This Word document could not be read and may be corrupted. Please try again or paste the text instead.",
            code="corrupted_document",
            status_code=422,
        ) from exc

    parts: list[str] = []
    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            paragraph = Paragraph(child, document)
            cleaned = " ".join(paragraph.text.split())
            if cleaned:
                parts.append(cleaned)
        elif child.tag.endswith("}tbl"):
            table = Table(child, document)
            for row in table.rows:
                row_parts: list[str] = []
                for cell in row.cells:
                    cell_text = " ".join(cell.text.split())
                    if cell_text:
                        row_parts.append(cell_text)
                if row_parts:
                    parts.append("\n".join(row_parts))

    text = "\n".join(part for part in parts if part)
    if not text.strip():
        raise AppError(
            "This Word document could not be read and may be corrupted. Please try again or paste the text instead.",
            code="corrupted_document",
            status_code=422,
        )
    return text


# --- Registry: extension -> extractor ---------------------------------------
EXTRACTORS: dict[str, Extractor] = {
    ".txt": extract_txt,
    ".text": extract_txt,
    ".md": extract_txt,
    ".markdown": extract_txt,
    ".pdf": extract_pdf,
    ".docx": extract_docx,
}


def extension_of(filename: str) -> str:
    name = (filename or "").strip().lower()
    dot = name.rfind(".")
    return name[dot:] if dot != -1 else ""


def get_extractor(ext: str) -> Optional[Extractor]:
    return EXTRACTORS.get(ext)


def planned_format_message(ext: str) -> str:
    return PLANNED_EXTENSIONS.get(
        ext, "This file format is not supported yet — paste the text or upload a .txt file."
    )


def supported_extensions() -> list[str]:
    return list(TEXT_EXTENSIONS)
