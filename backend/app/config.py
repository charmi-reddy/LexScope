"""LexScope backend configuration.

All limits are environment-overridable so the app can be tuned without code
changes. The server-side Gemini key is read from environment variables and
never hardcoded into the application source.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - optional dependency fallback
    load_dotenv = None

_BASE_DIR = Path(__file__).resolve().parent.parent
for _candidate in (_BASE_DIR / ".env", Path.cwd() / ".env"):
    if _candidate.exists():
        try:
            if load_dotenv is not None:
                load_dotenv(_candidate, override=False)
        except Exception:  # pragma: no cover - ignore file parsing errors at import time
            pass
        break

APP_NAME = "LexScope API"
APP_VERSION = "0.1.0"
API_PREFIX = "/api"

# --- Document limits -------------------------------------------------------
MAX_FILE_BYTES = int(os.environ.get("LEXSCOPE_MAX_FILE_BYTES", 512 * 1024))  # 512 KB
MAX_TEXT_CHARS = int(os.environ.get("LEXSCOPE_MAX_TEXT_CHARS", 60_000))
WARN_TEXT_CHARS = int(os.environ.get("LEXSCOPE_WARN_TEXT_CHARS", 45_000))
MIN_TEXT_CHARS = int(os.environ.get("LEXSCOPE_MIN_TEXT_CHARS", 80))

# --- Supported formats -----------------------------------------------------
# TXT, PDF, and DOCX are supported. The extractor registry
# (services/extraction.py) allows additional formats without touching routes.
TEXT_EXTENSIONS = [".txt", ".text", ".md", ".markdown", ".pdf", ".docx"]

PLANNED_EXTENSIONS = {
    ".doc": "Legacy Word (.doc) support is on the roadmap — save the file as .txt for now.",
    ".rtf": "RTF support is on the roadmap — save the file as .txt for now.",
    ".html": "HTML files are not supported yet — paste the text instead.",
    ".htm": "HTML files are not supported yet — paste the text instead.",
}

# --- AI -------------------------------------------------------------------
# Server-side Gemini key. End users never sign in or see credentials.

def _configured_secret(name: str) -> str | None:
    value = (os.environ.get(name) or "").strip()
    if not value:
        return None

    normalized = value.lower()
    placeholder_values = {
        "**",
        "***",
        "placeholder",
        "changeme",
        "example",
        "todo",
        "your_gemini_api_key_here",
        "your_key_here",
        "dummy",
        "test-key",
    }
    if normalized in placeholder_values or normalized.startswith("your_") or normalized.startswith("<your"):
        return None
    return value


GEMINI_API_KEY = _configured_secret("GEMINI_API_KEY")
def _required_setting(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Required setting {name} is missing or empty.")
    return value


SUPABASE_URL = _required_setting("SUPABASE_URL").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = _required_setting("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = _required_setting("SUPABASE_ANON_KEY")
GEMINI_AI_URL = os.environ.get(
    "GEMINI_AI_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
)
DEFAULT_AI_MODEL = os.environ.get("LEXSCOPE_AI_MODEL", "google/gemini-2.5-flash")
AI_TIMEOUT_SECONDS = int(os.environ.get("LEXSCOPE_AI_TIMEOUT_SECONDS", 180))

# Simple per-client rate limit for AI calls, format "N requests / W seconds".
AI_RATE_LIMIT = os.environ.get("LEXSCOPE_AI_RATE_LIMIT", "8/600")

# --- CORS -------------------------------------------------------------------
# The API carries no credentials or stored documents, so a permissive default
# is acceptable for the hackathon build. Lock down for production.
_cors = os.environ.get("LEXSCOPE_CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if _cors.strip() == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
