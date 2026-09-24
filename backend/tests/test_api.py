import pytest

import server
from play_verifier import PlayPurchase


# ------------------------ Players & leaderboard ------------------------
class TestPlayers:
    def test_create_player_returns_token(self, api):
        r = api.post("/api/players", json={"name": "  Neo\u0000  "})
        body = r.json()
        assert r.status_code == 200
        assert body["name"] == "Neo"
        assert len(body["token"]) > 30 and body["id"]

    def test_token_authenticates_player(self, api):
        token = api.post("/api/players", json={}).json()["token"]
        r = api.get("/api/leaderboard/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200 and r.json() is None


class TestScores:
    def test_requires_player_token(self, api):
        assert api.post("/api/scores", json={"name": "A", "score": 1}).status_code == 401
        bad = {"Authorization": "Bearer nope"}
        assert api.post("/api/scores", json={"name": "A", "score": 1}, headers=bad).status_code == 401

    def test_keeps_best_score_per_player(self, api, player):
        h = player()
        r = api.post("/api/scores", json={"name": "ACE", "score": 900, "level": 1, "kills": 6}, headers=h)
        assert r.json() == {"rank": 1, "best": 900, "is_high_score": True}
        r = api.post("/api/scores", json={"name": "ACE2", "score": 300, "level": 1, "kills": 2}, headers=h)
        assert r.json()["is_high_score"] is False and r.json()["best"] == 900
        rows = api.get("/api/leaderboard").json()
        assert len(rows) == 1
        assert rows[0]["score"] == 900 and rows[0]["name"] == "ACE2"  # name refreshed, best kept

    def test_leaderboard_sorted_and_hides_internal_fields(self, api, player):
        for name, score in [("A", 500), ("B", 1500), ("C", 1000)]:
            api.post("/api/scores", json={"name": name, "score": score, "level": 2, "kills": 10}, headers=player(name))
        rows = api.get("/api/leaderboard?limit=500").json()
        assert [r["name"] for r in rows] == ["B", "C", "A"]
        assert [r["rank"] for r in rows] == [1, 2, 3]
        for r in rows:
            assert "player_id" not in r and "_id" not in r and "token_hash" not in r

    def test_my_rank(self, api, player):
        api.post("/api/scores", json={"name": "A", "score": 2000, "level": 3, "kills": 12}, headers=player("A"))
        h = player("B")
        api.post("/api/scores", json={"name": "B", "score": 800, "level": 1, "kills": 5}, headers=h)
        me = api.get("/api/leaderboard/me", headers=h).json()
        assert me["rank"] == 2 and me["score"] == 800

    def test_rejects_implausible_score(self, api, player):
        r = api.post("/api/scores", json={"name": "X", "score": 999999, "level": 1, "kills": 3}, headers=player())
        assert r.status_code == 422

    def test_validation(self, api, player):
        h = player()
        assert api.post("/api/scores", json={"name": "", "score": 1}, headers=h).status_code == 422
        assert api.post("/api/scores", json={"name": "A", "score": -1}, headers=h).status_code == 422
        assert api.post("/api/scores", json={"name": "A", "score": 1, "level": 31}, headers=h).status_code == 422

    def test_cooldown(self, api, player, monkeypatch):
        monkeypatch.setattr(server, "SCORE_COOLDOWN_S", 60)
        h = player()
        body = {"name": "A", "score": 100, "level": 1, "kills": 1}
        assert api.post("/api/scores", json=body, headers=h).status_code == 200
        assert api.post("/api/scores", json=body, headers=h).status_code == 429


# ------------------------ Purchases ------------------------
TOKEN = "google-purchase-token-123"


def verify(api, h, product="coins_1200", token=TOKEN):
    return api.post("/api/purchases/verify", json={"product_id": product, "purchase_token": token}, headers=h)


class TestPurchases:
    def test_valid_purchase(self, api, player, google):
        r = verify(api, player(), "coins_3500")
        assert r.json() == {"status": "valid", "credits": 3500, "is_test": True}
        assert google["calls"] == [("coins_3500", TOKEN)]

    def test_same_player_retry_is_idempotent(self, api, player, google):
        h = player()
        verify(api, h)
        r = verify(api, h)
        assert r.json()["status"] == "valid"
        assert len(google["calls"]) == 1  # served from the database

    def test_token_reuse_by_other_player_blocked(self, api, player, google):
        verify(api, player("A"))
        assert verify(api, player("B")).json()["status"] == "invalid"

    def test_token_reuse_for_other_product_blocked(self, api, player, google):
        h = player()
        verify(api, h, "coins_500")
        assert verify(api, h, "coins_8000").json()["status"] == "invalid"

    @pytest.mark.parametrize("state,expected", [("pending", "pending"), ("cancelled", "invalid"), ("invalid", "invalid")])
    def test_non_purchased_states(self, api, player, google, state, expected):
        google["result"] = PlayPurchase(state=state)
        h = player()
        assert verify(api, h).json() == {"status": expected, "credits": 0, "is_test": False}
        # nothing recorded: a pending purchase can be verified again once it clears
        google["result"] = PlayPurchase(state="purchased")
        assert verify(api, h).json()["status"] == "valid"

    def test_unknown_product(self, api, player, google):
        assert verify(api, player(), "coins_999999").status_code == 422

    def test_requires_player(self, api, google):
        assert verify(api, {}).status_code == 401

    def test_google_down(self, api, player, google):
        google["result"] = RuntimeError("timeout")
        assert verify(api, player()).status_code == 502

    def test_not_configured(self, api, player, monkeypatch):
        monkeypatch.setattr(type(server.verifier), "configured", property(lambda self: False))
        assert verify(api, player()).status_code == 503

    def test_disabled_mode_accepts(self, api, player, monkeypatch):
        monkeypatch.setattr(server, "PURCHASE_VERIFICATION", "disabled")
        assert verify(api, player()).json()["status"] == "valid"
