"""Tests for quick-save history using a mocked Supabase client."""
from __future__ import annotations

import os
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault("SUPABASE_URL", "https://supabase.example.test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "unit-test-service-role")
os.environ.setdefault("SUPABASE_ANON_KEY", "unit-test-anon")

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.services import matter_ai
from app.services.supabase_client import get_supabase


class Query:
    def __init__(self, db: "FakeSupabase", table_name: str):
        self.db = db
        self.table_name = table_name
        self.filters = {}
        self.action = "select"
        self.payload = None
        self.descending = False
        self.limit_value = None

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.action, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.action, self.payload = "update", payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def order(self, key, desc=False):
        self.order_key = key
        self.descending = desc
        return self

    def execute(self):
        rows = self.db.tables[self.table_name]
        matched = [row for row in rows if all(row.get(key) == value for key, value in self.filters.items())]
        if self.action == "insert":
            row = {
                "id": f"{self.table_name}-{self.db.next_id}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "open",
                **self.payload,
            }
            self.db.next_id += 1
            rows.append(row)
            matched = [row]
        elif self.action == "update":
            for row in matched:
                row.update(self.payload)
        elif self.action == "delete":
            self.db.tables[self.table_name] = [row for row in rows if row not in matched]
        elif hasattr(self, "order_key"):
            matched.sort(key=lambda row: row.get(self.order_key) or "", reverse=self.descending)
        if self.limit_value is not None:
            matched = matched[:self.limit_value]
        return SimpleNamespace(data=deepcopy(matched))


class FakeSupabase:
    def __init__(self):
        self.next_id = 1
        self.tables = {"matters": [], "matter_updates": []}

    def table(self, name):
        return Query(self, name)


db = FakeSupabase()
client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    global db
    previous_overrides = app.dependency_overrides.copy()
    db = FakeSupabase()
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supabase] = lambda: db
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous_overrides)


def _payload(summary="The notice sets out a payment deadline."):
    return {
        "document_name": "Payment notice.pdf",
        "document_text": "The recipient must pay the stated amount by the due date.",
        "summary": summary,
    }


def test_creates_quick_analyses_matter_when_missing():
    response = client.post("/api/quick-saves", json=_payload())
    assert response.status_code == 200
    assert response.json() == {"matter_id": "matters-1"}
    assert db.tables["matters"][0]["title"] == "Quick analyses"
    assert db.tables["matters"][0]["matter_type"] == "other"
    saved = db.tables["matter_updates"][0]
    assert saved["user_id"] == "user-1"
    assert saved["label"] == saved["document_name"] == "Payment notice.pdf"
    assert saved["document_text"] == _payload()["document_text"]
    assert saved["summary"] == _payload()["summary"]
    assert saved["update_type"] == "other"
    assert saved["what_changed"] == ""
    assert "current_summary" not in db.tables["matters"][0]


def test_reuses_existing_quick_analyses_matter():
    db.tables["matters"].append({
        "id": "existing",
        "user_id": "user-1",
        "title": "Quick analyses",
        "matter_type": "other",
        "current_summary": "Leave this summary untouched.",
        "updated_at": "2020-01-01T00:00:00+00:00",
    })
    response = client.post("/api/quick-saves", json=_payload())
    assert response.status_code == 200
    assert response.json() == {"matter_id": "existing"}
    assert len(db.tables["matters"]) == 1
    assert db.tables["matters"][0]["current_summary"] == "Leave this summary untouched."
    assert db.tables["matters"][0]["updated_at"] != "2020-01-01T00:00:00+00:00"


def test_prunes_oldest_updates_beyond_fifty():
    db.tables["matters"].append({
        "id": "existing", "user_id": "user-1", "title": "Quick analyses", "matter_type": "other",
    })
    db.tables["matter_updates"] = [
        {
            "id": f"update-{index}",
            "matter_id": "existing",
            "user_id": "user-1",
            "created_at": f"2026-01-{index + 1:02d}T00:00:00+00:00",
        }
        for index in range(50)
    ]
    response = client.post("/api/quick-saves", json=_payload())
    assert response.status_code == 200
    assert len(db.tables["matter_updates"]) == 50
    assert "update-0" not in {row["id"] for row in db.tables["matter_updates"]}
    assert any(row.get("summary") == _payload()["summary"] for row in db.tables["matter_updates"])


def test_empty_summary_returns_422_and_ai_is_not_called():
    with patch.object(matter_ai, "summarize_matter_update", new_callable=AsyncMock) as summarize:
        response = client.post("/api/quick-saves", json=_payload("  "))
    assert response.status_code == 422
    summarize.assert_not_awaited()
    assert db.tables["matters"] == []
    assert db.tables["matter_updates"] == []


def test_valid_quick_save_never_calls_ai():
    with patch.object(matter_ai, "summarize_matter_update", new_callable=AsyncMock) as summarize:
        response = client.post("/api/quick-saves", json=_payload())
    assert response.status_code == 200
    summarize.assert_not_awaited()
