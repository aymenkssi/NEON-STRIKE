import pytest

import seasons
from conftest import ADMIN


@pytest.fixture(autouse=True)
def no_auto_validation(monkeypatch):
    # Past seasons seeded by the tests are older than 3 days: keep them for the admin by default.
    monkeypatch.setattr(seasons, "_last_auto", 1e18)


def account(api, name):
    r = api.post("/api/accounts/register", json={"username": name, "password": "secret123"})
    assert r.status_code == 200, r.text
    return r.json()


def auth(p):
    return {"Authorization": f"Bearer {p['token']}"}


def score(api, p, value, level=5, kills=40):
    r = api.post("/api/scores", json={"name": "x", "score": value, "level": level, "kills": kills}, headers=auth(p))
    assert r.status_code == 200, r.text


def seed(api, season, rows):
    """rows: [(player, score)] straight into a past season."""
    docs = [
        {"season": season, "player_id": p["id"], "name": p["username"], "score": s, "level": 9, "kills": 99, "excluded": False, "updated_at": f"2020-01-01T00:00:{i:02d}"}
        for i, (p, s) in enumerate(rows)
    ]
    api.portal.call(seasons.db.season_scores.insert_many, docs)


class TestCurrentSeason:
    def test_scores_count_for_the_season(self, api):
        a, b = account(api, "Alpha"), account(api, "Bravo")
        score(api, a, 1000)
        score(api, b, 3000)
        score(api, a, 800)  # worse run: the season keeps the best one
        r = api.get("/api/seasons/current").json()
        assert r["season"] == seasons.season_of()
        assert [(x["rank"], x["name"], x["score"]) for x in r["top"]] == [(1, "Bravo", 3000), (2, "Alpha", 1000)]
        assert r["ends_at"] > r["starts_at"] and r["rewards"][0] == {"first": 1, "last": 1, "credits": 5000, "champion": True}
        me = api.get("/api/seasons/me", headers=auth(a)).json()
        assert me["rank"] == 2 and me["score"] == 1000 and me["rewards"] == []

    def test_current_season_cannot_be_validated(self, api):
        assert api.post(f"/api/admin/seasons/{seasons.season_of()}/validate", headers=ADMIN).status_code == 409

    def test_admin_requires_token(self, api):
        assert api.get("/api/admin/seasons").status_code == 401


class TestValidation:
    def test_exclude_validate_and_claim(self, api):
        players = [account(api, f"P{i}_x") for i in range(7)]
        seed(api, "2020-01", [(p, 10000 - i * 1000) for i, p in enumerate(players)])
        cheat = players[0]
        assert api.put(f"/api/admin/seasons/2020-01/players/{cheat['id']}", json={"excluded": True}, headers=ADMIN).status_code == 200

        overview = api.get("/api/admin/seasons", headers=ADMIN).json()
        pending = next(p for p in overview["pending"] if p["season"] == "2020-01")
        assert pending["top"][0]["excluded"] is True and pending["top"][0]["rank"] is None and pending["top"][1]["rank"] == 1

        doc = api.post("/api/admin/seasons/2020-01/validate", headers=ADMIN).json()
        assert [c["name"] for c in doc["champions"]] == ["P1_x", "P2_x", "P3_x", "P4_x", "P5_x"]
        assert api.post("/api/admin/seasons/2020-01/validate", headers=ADMIN).status_code == 409
        assert api.put(f"/api/admin/seasons/2020-01/players/{cheat['id']}", json={"excluded": False}, headers=ADMIN).status_code == 409

        # Rewards: 1st 5000 + skin + badge; 6th 500, no skin; the excluded player gets nothing.
        first = api.get("/api/seasons/me", headers=auth(players[1])).json()["rewards"]
        assert [(r["rank"], r["credits"], r["skin"], r["badge"]) for r in first] == [(1, 5000, "w_champion", True)]
        sixth = api.get("/api/seasons/me", headers=auth(players[6])).json()["rewards"]
        assert [(r["rank"], r["credits"], r["skin"]) for r in sixth] == [(6, 500, None)]
        assert api.get("/api/seasons/me", headers=auth(cheat)).json()["rewards"] == []

        claimed = api.post(f"/api/seasons/rewards/{first[0]['id']}/claim", headers=auth(players[1]))
        assert claimed.status_code == 200 and claimed.json()["credits"] == 5000
        assert api.post(f"/api/seasons/rewards/{first[0]['id']}/claim", headers=auth(players[1])).status_code == 404
        assert api.post(f"/api/seasons/rewards/{sixth[0]['id']}/claim", headers=auth(players[1])).status_code == 404  # not his
        assert api.get("/api/seasons/me", headers=auth(players[1])).json()["rewards"] == []

        history = api.get("/api/admin/seasons", headers=ADMIN).json()["history"]
        assert history[0]["season"] == "2020-01" and history[0]["claimed"] == 1 and history[0]["validated_by"] == "admin"

    def test_badges_on_leaderboards(self, api):
        champ, other = account(api, "Champ"), account(api, "Other")
        seed(api, "2020-02", [(champ, 5000), (other, 100)])
        api.post("/api/admin/seasons/2020-02/validate", headers=ADMIN)
        score(api, champ, 2000)
        score(api, other, 1000)
        board = {r["name"]: r["badge"] for r in api.get("/api/leaderboard").json()}
        assert board == {"Champ": 1, "Other": 2}
        season = {r["name"]: r["badge"] for r in api.get("/api/seasons/current").json()["top"]}
        assert season == {"Champ": 1, "Other": 2}
        assert api.get("/api/leaderboard/me", headers=auth(champ)).json()["badge"] == 1

    def test_auto_validation_after_three_days(self, api):
        p = account(api, "Late")
        seed(api, "2020-03", [(p, 700)])
        seasons._last_auto = 0  # the fixture restores it
        api.get("/api/seasons/current")  # any season call runs the check (at most every 10 minutes)
        done = api.portal.call(seasons.db.seasons.find_one, {"season": "2020-03"})
        assert done and done["validated_by"] == "auto"
        assert api.get("/api/seasons/me", headers=auth(p)).json()["rewards"][0]["credits"] == 5000
        # The season that is still running is never validated.
        score(api, p, 100)
        api.portal.call(seasons.auto_validate, True)
        assert api.portal.call(seasons.db.seasons.find_one, {"season": seasons.season_of()}) is None

    def test_account_deletion_removes_season_data(self, api):
        p = account(api, "Bye")
        seed(api, "2020-04", [(p, 500)])
        api.post("/api/admin/seasons/2020-04/validate", headers=ADMIN)
        score(api, p, 300)
        assert api.post("/api/accounts/delete", json={"password": "secret123"}, headers=auth(p)).status_code == 200
        for name in ("season_scores", "season_rewards"):
            assert api.portal.call(seasons.db[name].count_documents, {"player_id": p["id"]}) == 0


def test_season_helpers():
    assert seasons.previous("2026-01") == "2025-12"
    s, e = seasons.bounds("2026-12")
    assert (s.month, e.year, e.month) == (12, 2027, 1)
    assert seasons.reward_for(4) == (1000, True) and seasons.reward_for(50) == (200, False) and seasons.reward_for(101) is None
