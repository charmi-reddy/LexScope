"""Backend API tests (FastAPI TestClient, no network needed).

Run: cd backend && python -m pytest tests/ -q
"""
from __future__ import annotations

import pathlib

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SAMPLE = (pathlib.Path(__file__).resolve().parents[2] / "frontend" / "src" / "utils" / "sampleDocument.js")
# Extract just the raw template literal text for a realistic document body.
def _sample_text() -> str:
    raw = SAMPLE.read_text(encoding="utf-8")
    start = raw.index("EMPLOYMENT AGREEMENT")
    end = raw.rindex("`,")  # end of template literal
    return raw[start:end]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_limits():
    r = client.get("/api/meta/limits")
    assert r.status_code == 200
    body = r.json()
    assert body["max_text_chars"] > body["min_text_chars"]


def test_validate_ok():
    r = client.post("/api/documents/validate", json={"text": _sample_text(), "name": "Sample"})
    assert r.status_code == 200
    body = r.json()
    assert body["stats"]["word_count"] > 100
    assert "text" in body and body["name"] == "Sample"


def test_validate_empty():
    r = client.post("/api/documents/validate", json={"text": "   "})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "empty_document"


def test_validate_too_short():
    r = client.post("/api/documents/validate", json={"text": "Hello world"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "empty_document"


def test_validate_too_large():
    r = client.post("/api/documents/validate", json={"text": "CLAUSE TEXT. " * 12000})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "document_too_large"


def test_extract_txt_upload():
    content = _sample_text().encode("utf-8")
    r = client.post(
        "/api/documents/extract",
        files={"file": ("agreement.txt", content, "text/plain")},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "agreement.txt"


def test_extract_unsupported():
    r = client.post(
        "/api/documents/extract",
        files={"file": ("contract.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_format"


def test_extract_empty_file():
    r = client.post(
        "/api/documents/extract",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 422


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
