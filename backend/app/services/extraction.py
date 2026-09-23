"""Document text extraction.

v1 supports plain-text formats. The extractor *registry* below is the single
extension point: to add PDF or DOCX later, write an `extract_pdf(content:
bytes) -> str` function and register it under the right extensions — routes,
validation and response schemas stay untouched.
"""
from __future__ import annotations

from typing import Callable, Optional

from app.config import PLANNED_EXTENSIONS, TEXT_EXTENSIONS
from app.utils.errors import UnsupportedFormatError

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


# --- Registry: extension -> extractor ---------------------------------------
EXTRACTORS: dict[str, Extractor] = {
    ".txt": extract_txt,
    ".text": extract_txt,
    ".md": extract_txt,
    ".markdown": extract_txt,
    # FUTURE: register extract_pdf / extract_docx here without any other changes.
    # ".pdf": extract_pdf,
    # ".docx": extract_docx,
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
