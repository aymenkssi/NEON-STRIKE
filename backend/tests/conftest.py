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
import cloudsave  # noqa: E402
from play_verifier import PlayPurchase  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


ADMIN_TOKEN = "test-admin-token-0123456789"
ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(server, "SCORE_COOLDOWN_S", 0)
    monkeypatch.setattr(server, "PURCHASE_VERIFICATION", "google")
    monkeypatch.setenv("ADMIN_TOKEN", ADMIN_TOKEN)
    with TestClient(server.app) as c:
        cloudsave._attempts.clear()
        for name in ("players", "scores", "purchases", "packs", "messages", "saves"):
            c.portal.call(server.db[name].delete_many, {})
        c.portal.call(server.liveops.setup)  # re-seed default packs
        yield c


@pytest.fixture
def player(api):
    def make(name="ACE"):
        r = api.post("/api/players", json={"name": name})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}"}

    return make


@pytest.fixture
def google(monkeypatch):
    calls = []
    state = {"result": PlayPurchase(state="purchased", order_id="GPA.1", is_test=True), "calls": calls}

    async def fake_verify(product_id, token):
        calls.append((product_id, token))
        if isinstance(state["result"], Exception):
            raise state["result"]
        return state["result"]

    monkeypatch.setattr(server.verifier, "verify_product", fake_verify)
    monkeypatch.setattr(type(server.verifier), "configured", property(lambda self: True))
    return state
