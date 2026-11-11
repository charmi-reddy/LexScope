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

from app.auth import get_current_user
from app.main import app
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
            row = {"id": "new-matter", "status": "open", **self.payload}
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
