from conftest import ADMIN


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def make_account(api, name):
    r = api.post("/api/accounts/register", json={"username": name, "password": "secret123"})
    assert r.status_code == 200, r.text
    return r.json()


class TestPlayerList:
    def test_requires_admin(self, api):
        assert api.get("/api/admin/players").status_code == 401

    def test_lists_accounts_and_guests_with_details(self, api, google):
        neo = make_account(api, "Neo")
        h = auth(neo["token"])
        api.post("/api/scores", json={"name": "Neo", "score": 900, "level": 4, "kills": 33}, headers=h)
        api.put("/api/save", json={"data": {"credits": 1250, "unlockedLevel": 5}, "updated_at": 1000}, headers=h)
        google["result"].is_test = False
        api.post("/api/purchases/verify", json={"product_id": "coins_1200", "purchase_token": "token-neo-000001"}, headers=h)
        guest = api.post("/api/players", json={}).json()

        r = api.get("/api/admin/players", headers=ADMIN).json()
        assert r["counts"] == {"all": 2, "account": 1, "guest": 1} and r["total"] == 2
        row = next(i for i in r["items"] if i["id"] == neo["id"])
        assert row["username"] == "Neo" and row["best_score"] == 900 and row["kills"] == 33
        assert row["credits"] == 1250 and row["unlocked_level"] == 5 and row["purchases"] == 1
        assert "password_hash" not in row and "token_hash" not in row

        assert [i["id"] for i in api.get("/api/admin/players?kind=guest", headers=ADMIN).json()["items"]] == [guest["id"]]
        assert [i["username"] for i in api.get("/api/admin/players?kind=account", headers=ADMIN).json()["items"]] == ["Neo"]

    def test_search_and_pages(self, api):
        for n in ("Alpha_1", "Alpha_2", "Bravo"):
            make_account(api, n)
        r = api.get("/api/admin/players?q=alpha&sort=name", headers=ADMIN).json()
        assert [i["username"] for i in r["items"]] == ["Alpha_1", "Alpha_2"] and r["pages"] == 1
        assert api.get("/api/admin/players?q=.*", headers=ADMIN).json()["total"] == 0  # regex is escaped

    def test_admin_delete(self, api):
        p = make_account(api, "Troll")
        assert api.delete(f"/api/admin/players/{p['id']}", headers=ADMIN).status_code == 200
        assert api.get("/api/admin/players", headers=ADMIN).json()["total"] == 0
        assert api.get("/api/save", headers=auth(p["token"])).status_code == 401
        assert api.delete(f"/api/admin/players/{p['id']}", headers=ADMIN).status_code == 404
