"""Matter route tests using an in-memory Supabase query mock."""
from __future__ import annotations

import os

os.environ.setdefault("SUPABASE_URL", "https://supabase.example.test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "unit-test-service-role")
os.environ.setdefault("SUPABASE_ANON_KEY", "unit-test-anon")

from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.auth import get_current_user
from app.main import app
from app.routes import matters as matters_routes
from app.services.ai_proxy import AiUpstreamError
from app.services.supabase_client import get_supabase


class Query:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db = db
        self.table_name = table
        self.filters = {}
        self.action = "select"
        self.payload = None
        self.descending = False
        self.count_requested = False

    def select(self, *_args, count=None, **_kwargs):
        self.action = "select"
        self.count_requested = count == "exact"
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

    def limit(self, _value):
        return self

    def order(self, _key, desc=False):
        self.descending = desc
        return self

    def execute(self):
        rows = self.db.tables[self.table_name]
        matched = [row for row in rows if all(row.get(k) == v for k, v in self.filters.items())]
        if self.action == "insert":
            row = {"id": f"new-{self.table_name}", "status": "open", "created_at": "2025-03-01", **self.payload}
            rows.append(row)
            matched = [row]
        elif self.action == "update":
            for row in matched:
                row.update(self.payload)
        elif self.action == "delete":
            self.db.tables[self.table_name] = [row for row in rows if row not in matched]
        elif self.table_name == "matters" and self.descending:
            matched = list(reversed(matched))
        return SimpleNamespace(data=deepcopy(matched), count=len(matched) if self.count_requested else None)


class FakeSupabase:
    def __init__(self):
        self.tables = {
            "matters": [
                {"id": "mine", "user_id": "user-1", "title": "My matter", "status": "open", "updated_at": "2025-02-01"},
                {"id": "theirs", "user_id": "user-2", "title": "Other matter", "status": "open", "updated_at": "2025-02-02"},
            ],
            "matter_updates": [
                {"id": "update-1", "matter_id": "mine", "user_id": "user-1", "created_at": "2025-01-01"},
                {"id": "update-2", "matter_id": "theirs", "user_id": "user-2", "created_at": "2025-01-02"},
            ],
        }

    def table(self, name):
        return Query(self, name)


db = FakeSupabase()
app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
app.dependency_overrides[get_supabase] = lambda: db
client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_supabase():
    global db
    db = FakeSupabase()


def test_create_returns_row():
    response = client.post("/api/matters", json={"title": "New file", "matter_type": "case"})
    assert response.status_code == 201
    assert response.json()["title"] == "New file"
    assert response.json()["user_id"] == "user-1"


def test_list_only_returns_users_matters():
    response = client.get("/api/matters")
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == ["mine"]
    assert response.json()[0]["update_count"] == 1


@pytest.mark.parametrize("method,path,body", [
    ("get", "/api/matters/theirs", None),
    ("patch", "/api/matters/theirs", {"title": "Intrude"}),
    ("delete", "/api/matters/theirs", None),
])
def test_other_users_matter_appears_missing(method, path, body):
    response = getattr(client, method)(path, json=body) if body else getattr(client, method)(path)
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "not_found"


def test_invalid_matter_type_returns_422():
    response = client.post("/api/matters", json={"title": "Bad", "matter_type": "contract"})
    assert response.status_code == 422


UPDATE_TEXT = (
    "This notice confirms that the parties agreed to extend the response deadline by thirty days. "
    "All other terms remain unchanged and the recipient must reply in writing."
)


def test_first_update_sets_summary_and_first_document_change():
    db.tables["matter_updates"] = []
    result = {
        "update_summary": "The notice extends the response deadline by thirty days. The recipient must reply in writing. All other terms remain unchanged.",
        "what_changed": "First document in this matter.",
        "running_summary": "The parties are handling a matter with a response deadline. The latest notice extends that deadline by thirty days. A written reply is required.",
    }
    with patch.object(matters_routes.matter_ai, "summarize_matter_update", new=AsyncMock(return_value=result)) as summarize:
        response = client.post(
            "/api/matters/mine/updates",
            files={"file": ("notice.txt", UPDATE_TEXT.encode(), "text/plain")},
            data={"label": "Initial notice", "update_type": "notice"},
        )
    assert response.status_code == 200
    assert response.json()["current_summary"] == result["running_summary"]
    stored = next(row for row in response.json()["updates"] if row["label"] == "Initial notice")
    assert stored["what_changed"] == "First document in this matter."
    assert summarize.await_args.args[1] is None


def test_second_update_receives_previous_summaries():
    db.tables["matters"][0]["current_summary"] = "The matter began with a notice."
    db.tables["matter_updates"] = []
    db.tables["matter_updates"].append(
        {"id": "old-update", "matter_id": "mine", "user_id": "user-1", "label": "First notice", "summary": "A deadline was set.", "created_at": "2025-01-03"}
    )
    result = {
        "update_summary": "The reply responds to the initial notice. It disputes the proposed deadline. The recipient asks for more time.",
        "what_changed": "The recipient disputes the deadline and asks for more time.",
        "running_summary": "The matter concerns a response deadline. The recipient has disputed it and requested more time.",
    }
    with patch.object(matters_routes.matter_ai, "summarize_matter_update", new=AsyncMock(return_value=result)) as summarize:
        response = client.post(
            "/api/matters/mine/updates",
            files={"file": ("reply.txt", UPDATE_TEXT.encode(), "text/plain")},
            data={"label": "Reply", "update_type": "reply"},
        )
    assert response.status_code == 200
    assert summarize.await_args.args[1] == "The matter began with a notice."
    assert summarize.await_args.args[2] == [{"label": "First notice", "summary": "A deadline was set."}]


def test_ai_failure_does_not_insert_update():
    initial_updates = deepcopy(db.tables["matter_updates"])
    initial_summary = db.tables["matters"][0].get("current_summary")
    error = AiUpstreamError("AI_UPSTREAM", "The AI service had a temporary problem.")
    with patch.object(matters_routes.matter_ai, "summarize_matter_update", new=AsyncMock(side_effect=error)):
        response = client.post(
            "/api/matters/mine/updates",
            files={"file": ("notice.txt", UPDATE_TEXT.encode(), "text/plain")},
            data={"label": "Initial notice"},
        )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_upstream"
    assert db.tables["matter_updates"] == initial_updates
    assert db.tables["matters"][0].get("current_summary") == initial_summary
