"""Backend API tests (FastAPI TestClient, no network needed).

Run: cd backend && python -m pytest tests/ -q
"""
from __future__ import annotations

import io
import pathlib

import pytest
from docx import Document
from fastapi.testclient import TestClient
from pypdf import PdfReader

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


def _make_pdf_bytes_with_text(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 50 100 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream.decode('latin-1')}\nendstream".encode("latin-1"),
    ]
    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n{obj.decode('latin-1')}\nendobj\n".encode("latin-1")
    xref_offset = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode("latin-1")
    pdf += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode("latin-1")
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("latin-1")
    reader = PdfReader(io.BytesIO(pdf))
    assert reader.pages[0].extract_text() is not None
    return pdf


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
        files={"file": ("contract.doc", b"fake word file", "application/msword")},
    )
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_format"


def test_extract_pdf_upload():
    content = _make_pdf_bytes_with_text(
        "Important clause: severance terms apply to all terminated employees and include salary continuation for six months after employment ends."
    )

    r = client.post(
        "/api/documents/extract",
        files={"file": ("contract.pdf", content, "application/pdf")},
    )
    assert r.status_code == 200
    body = r.json()
    assert "severance" in body["text"].lower()
    assert body["name"] == "contract.pdf"


def test_extract_docx_upload():
    document = Document()
    document.add_paragraph(
        "This agreement covers salary, benefits, and termination rights for all employees and sets the notice period for departures."
    )
    table = document.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Clause"
    table.cell(0, 1).text = "Value"
    table.cell(1, 0).text = "Termination"
    table.cell(1, 1).text = "30 days notice"

    stream = io.BytesIO()
    document.save(stream)
    content = stream.getvalue()

    r = client.post(
        "/api/documents/extract",
        files={"file": ("contract.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 200
    body = r.json()
    assert "termination" in body["text"].lower()
    assert "30 days notice" in body["text"]


def test_extract_corrupt_pdf_returns_4xx():
    r = client.post(
        "/api/documents/extract",
        files={"file": ("broken.pdf", b"%PDF-1.4 not a real pdf", "application/pdf")},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "corrupted_document"


def test_extract_empty_file():
    r = client.post(
        "/api/documents/extract",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 422


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
