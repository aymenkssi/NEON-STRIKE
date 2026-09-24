import os
import sys
from pathlib import Path

import mongomock_motor
import motor.motor_asyncio
import pytest

# In-memory MongoDB; must be patched before server.py is imported.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "neon_test")
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(server, "SCORE_COOLDOWN_S", 0)
    monkeypatch.setattr(server, "PURCHASE_VERIFICATION", "google")
    with TestClient(server.app) as c:
        for name in ("players", "scores", "purchases"):
            c.portal.call(server.db[name].delete_many, {})
        yield c


@pytest.fixture
def player(api):
    def make(name="ACE"):
        r = api.post("/api/players", json={"name": name})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}"}

    return make
