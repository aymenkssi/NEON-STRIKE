from conftest import ADMIN


def send(api, h, message="Ajouter un mode survie infini", category="idea", **headers):
    return api.post("/api/suggestions", json={"category": category, "message": message}, headers={**h, **headers})


def test_account_can_send_and_admin_reads(api, player):
    h = player("Idea")
    assert send(api, h, **{"X-Client-Lang": "fr", "X-App-Version": "1.1.0", "X-Platform": "android"}).json() == {"ok": True}
    r = api.get("/api/admin/suggestions", headers=ADMIN).json()
    assert r["counts"] == {"new": 1, "read": 0, "done": 0}
    s = r["items"][0]
    assert (s["username"], s["category"], s["message"], s["status"], s["lang"], s["app_version"], s["platform"]) == (
        "Idea", "idea", "Ajouter un mode survie infini", "new", "fr", "1.1.0", "android")
    assert "player_id" not in s


def test_guest_cannot_send(api):
    r = api.post("/api/players", json={"name": "x"})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert send(api, h).status_code == 403
    assert send(api, {}).status_code == 401


def test_validation(api, player):
    h = player()
    assert send(api, h, message="   ok   ").status_code == 422
    assert send(api, h, message="x" * 1001).status_code == 422
    assert send(api, h, category="spam").status_code == 422


def test_daily_limit(api, player):
    h = player()
    for i in range(5):
        assert send(api, h, message=f"Suggestion numéro {i}").status_code == 200
    assert send(api, h, message="Une de trop").status_code == 429
    assert send(api, player("Other"), message="Un autre joueur").status_code == 200


def test_status_filter_and_delete(api, player):
    h = player()
    send(api, h, message="Premier message")
    send(api, h, message="Deuxième message", category="bug")
    items = api.get("/api/admin/suggestions", headers=ADMIN).json()["items"]
    bug = next(i for i in items if i["category"] == "bug")
    assert api.put(f"/api/admin/suggestions/{bug['id']}", json={"status": "done"}, headers=ADMIN).json()["status"] == "done"
    r = api.get("/api/admin/suggestions?status=done", headers=ADMIN).json()
    assert [i["id"] for i in r["items"]] == [bug["id"]] and r["counts"] == {"new": 1, "read": 0, "done": 1}
    assert api.put("/api/admin/suggestions/nope", json={"status": "read"}, headers=ADMIN).status_code == 404
    assert api.put(f"/api/admin/suggestions/{bug['id']}", json={"status": "archived"}, headers=ADMIN).status_code == 422
    assert api.delete(f"/api/admin/suggestions/{bug['id']}", headers=ADMIN).status_code == 200
    assert api.get("/api/admin/suggestions", headers=ADMIN).json()["counts"]["done"] == 0


def test_admin_only(api):
    assert api.get("/api/admin/suggestions").status_code == 401
