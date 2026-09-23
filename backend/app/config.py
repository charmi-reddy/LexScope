"""LexScope backend configuration.

All limits are environment-overridable so the app can be tuned without code
changes. No secrets are configured here on purpose — the Gemini integration
runs in the browser through Puter.js (user-pays, no API keys).
"""
import os

APP_NAME = "LexScope API"
APP_VERSION = "0.1.0"
API_PREFIX = "/api"

# --- Document limits -------------------------------------------------------
MAX_FILE_BYTES = int(os.environ.get("LEXSCOPE_MAX_FILE_BYTES", 512 * 1024))  # 512 KB
MAX_TEXT_CHARS = int(os.environ.get("LEXSCOPE_MAX_TEXT_CHARS", 60_000))
WARN_TEXT_CHARS = int(os.environ.get("LEXSCOPE_WARN_TEXT_CHARS", 45_000))
MIN_TEXT_CHARS = int(os.environ.get("LEXSCOPE_MIN_TEXT_CHARS", 80))

# --- Supported formats -----------------------------------------------------
# v1 ships TXT; the extractor registry (services/extraction.py) is designed so
# PDF/DOCX extractors can be registered without touching the routes.
TEXT_EXTENSIONS = [".txt", ".text", ".md", ".markdown"]

PLANNED_EXTENSIONS = {
    ".pdf": "PDF support is on the roadmap — export or copy the text as .txt for now.",
    ".docx": "Word (.docx) support is on the roadmap — save the file as .txt for now.",
    ".doc": "Legacy Word (.doc) support is on the roadmap — save the file as .txt for now.",
    ".rtf": "RTF support is on the roadmap — save the file as .txt for now.",
    ".html": "HTML files are not supported yet — paste the text instead.",
    ".htm": "HTML files are not supported yet — paste the text instead.",
}

# --- AI (developer-pays mode) ------------------------------------------------
# Provider priority: GEMINI_API_KEY (Google AI Studio, free tier) first, then
# PUTER_AUTH_TOKEN (Puter server-side API, requires a paid Puter plan).
# Both are server-side secrets — end users never sign in or see credentials.
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip() or None
GEMINI_AI_URL = os.environ.get(
    "GEMINI_AI_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
)
PUTER_AUTH_TOKEN = (os.environ.get("PUTER_AUTH_TOKEN") or "").strip() or None
PUTER_AI_URL = os.environ.get(
    "PUTER_AI_URL", "https://api.puter.com/puterai/openai/v1/chat/completions"
)
DEFAULT_AI_MODEL = os.environ.get("LEXSCOPE_AI_MODEL", "google/gemini-2.5-flash")
AI_TIMEOUT_SECONDS = int(os.environ.get("LEXSCOPE_AI_TIMEOUT_SECONDS", 180))

# Simple per-client rate limit for AI calls, format "N requests / W seconds".
# Protects your Puter quota from hammering. Example: "8/600" = 8 per 10 min.
AI_RATE_LIMIT = os.environ.get("LEXSCOPE_AI_RATE_LIMIT", "8/600")

# --- CORS -------------------------------------------------------------------
# The API carries no credentials or stored documents, so a permissive default
# is acceptable for the hackathon build. Lock down for production.
_cors = os.environ.get("LEXSCOPE_CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if _cors.strip() == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
