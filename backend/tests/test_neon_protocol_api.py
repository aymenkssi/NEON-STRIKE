"""Backend tests for Neon Protocol API
Covers: /api/scores, /api/leaderboard, /api/leaderboard/best, /api/rewards/ad, validation.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-enhance-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_PREFIX = f"TEST{int(time.time()) % 100000}"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------------------ Health ------------------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ------------------------ Scores ------------------------
class TestScoreSubmission:
    def test_submit_score_returns_entry_rank_and_flag(self, api_client):
        payload = {"name": f"{TEST_PREFIX}A", "score": 100, "wave": 2, "kills": 5}
        r = api_client.post(f"{API}/scores", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["entry", "rank", "is_high_score"]).issubset(data.keys())
        entry = data["entry"]
        assert entry["name"] == payload["name"]
        assert entry["score"] == 100
        assert entry["wave"] == 2
        assert entry["kills"] == 5
        assert "id" in entry and "created_at" in entry
        assert isinstance(data["rank"], int) and data["rank"] >= 1
        assert data["is_high_score"] is True  # first submission for this new name

    def test_submit_score_high_score_flag_true_when_equal_or_higher(self, api_client):
        name = f"{TEST_PREFIX}B"
        api_client.post(f"{API}/scores", json={"name": name, "score": 50, "wave": 1, "kills": 1})
        # equal to previous best -> still high_score per implementation (>=)
        r = api_client.post(f"{API}/scores", json={"name": name, "score": 50, "wave": 1, "kills": 1})
        assert r.status_code == 200
        assert r.json()["is_high_score"] is True

    def test_submit_score_high_score_flag_false_when_lower(self, api_client):
        name = f"{TEST_PREFIX}C"
        api_client.post(f"{API}/scores", json={"name": name, "score": 200, "wave": 3, "kills": 4})
        r = api_client.post(f"{API}/scores", json={"name": name, "score": 100, "wave": 1, "kills": 1})
        assert r.status_code == 200
        assert r.json()["is_high_score"] is False

    def test_submit_score_name_truncation_to_16(self, api_client):
        long_name = "A" * 30
        r = api_client.post(f"{API}/scores", json={"name": long_name, "score": 10, "wave": 1, "kills": 0})
        # pydantic max_length=16 -> should 422
        assert r.status_code == 422

    def test_submit_score_empty_name_rejected(self, api_client):
        r = api_client.post(f"{API}/scores", json={"name": "", "score": 10, "wave": 1, "kills": 0})
        assert r.status_code == 422

    def test_submit_score_negative_score_rejected(self, api_client):
        r = api_client.post(f"{API}/scores", json={"name": f"{TEST_PREFIX}N", "score": -5, "wave": 1, "kills": 0})
        assert r.status_code == 422

    def test_submit_score_wave_default(self, api_client):
        # wave and kills should default when omitted
        r = api_client.post(f"{API}/scores", json={"name": f"{TEST_PREFIX}D", "score": 7})
        assert r.status_code == 200
        entry = r.json()["entry"]
        assert entry["wave"] == 1
        assert entry["kills"] == 0


# ------------------------ Leaderboard ------------------------
class TestLeaderboard:
    def test_leaderboard_returns_ranked_desc(self, api_client):
        # seed a few scores under prefix
        for i, sc in enumerate([300, 250, 400]):
            api_client.post(f"{API}/scores", json={"name": f"{TEST_PREFIX}L{i}", "score": sc, "wave": 1, "kills": 0})

        r = api_client.get(f"{API}/leaderboard?limit=50")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) > 0
        # rank field present and monotonically increasing from 1
        assert rows[0]["rank"] == 1
        for i in range(len(rows) - 1):
            assert rows[i]["score"] >= rows[i + 1]["score"]
            assert rows[i + 1]["rank"] == rows[i]["rank"] + 1
        # no mongo _id leaked
        for row in rows[:5]:
            assert "_id" not in row
            assert "id" in row and "name" in row and "score" in row

    def test_leaderboard_limit_clamped(self, api_client):
        r = api_client.get(f"{API}/leaderboard?limit=500")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) <= 100

    def test_leaderboard_limit_min(self, api_client):
        r = api_client.get(f"{API}/leaderboard?limit=0")
        assert r.status_code == 200
        # clamped to 1
        assert len(r.json()) <= 1


# ------------------------ Personal Best ------------------------
class TestPersonalBest:
    def test_personal_best_returns_null_for_unknown(self, api_client):
        r = api_client.get(f"{API}/leaderboard/best", params={"name": f"{TEST_PREFIX}UNKNOWN"})
        assert r.status_code == 200
        assert r.json() is None

    def test_personal_best_returns_max(self, api_client):
        name = f"{TEST_PREFIX}PB"
        for sc in [10, 90, 55, 42]:
            api_client.post(f"{API}/scores", json={"name": name, "score": sc, "wave": 1, "kills": 0})
        r = api_client.get(f"{API}/leaderboard/best", params={"name": name})
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["name"] == name
        assert data["score"] == 90


# ------------------------ Rewards ------------------------
class TestRewards:
    def test_reward_ad_default_type(self, api_client):
        r = api_client.post(f"{API}/rewards/ad", json={"name": f"{TEST_PREFIX}R"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("granted") is True
        assert data.get("reward_type") == "revive"

    def test_reward_ad_custom_type(self, api_client):
        r = api_client.post(f"{API}/rewards/ad", json={"name": f"{TEST_PREFIX}R", "reward_type": "ammo"})
        assert r.status_code == 200
        assert r.json().get("reward_type") == "ammo"
