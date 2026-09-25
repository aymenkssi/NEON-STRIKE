import accounts
import cloudsave


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register(api, username="Neo", password="secret123", headers=None):
    return api.post("/api/accounts/register", json={"username": username, "password": password}, headers=headers or {})


class TestRegister:
    def test_register_and_use_token(self, api):
        r = register(api)
        assert r.status_code == 200
        body = r.json()
        assert body["username"] == "Neo" and body["token"]
        assert api.get("/api/save", headers=auth(body["token"])).status_code == 200

    def test_username_unique_case_insensitive(self, api):
        register(api, "Neo")
        cloudsave._attempts.clear()
        assert register(api, "NEO").status_code == 409
        assert api.get("/api/accounts/available?username=neo").json() == {"available": False, "reason": "taken"}
        assert api.get("/api/accounts/available?username=Trinity").json() == {"available": True, "reason": None}

    def test_username_rules(self, api):
        for bad in ["ab", "a" * 17, "bad name", "émile", "x-y"]:
            cloudsave._attempts.clear()
            assert register(api, bad).status_code == 422, bad
        assert api.get("/api/accounts/available?username=ab").json()["reason"] == "invalid"

    def test_password_rules(self, api):
        assert register(api, "Morpheus", "12345").status_code == 422

    def test_password_not_stored_in_clear(self, api):
        register(api, "Oracle", "secret123")
        doc = api.portal.call(accounts.db.players.find_one, {"username": "Oracle"})
        assert "secret123" not in str(doc) and doc["password_hash"].startswith("scrypt$")

    def test_guest_upgrade_keeps_progress(self, api):
        guest = api.post("/api/players", json={"name": "x"}).json()
        api.put("/api/save", json={"data": {"credits": 900}, "updated_at": 5}, headers=auth(guest["token"]))
        r = register(api, "Switch", headers=auth(guest["token"]))
        body = r.json()
        assert body["id"] == guest["id"]  # same player, now with a username
        assert api.get("/api/save", headers=auth(body["token"])).json()["data"] == {"credits": 900}
        assert api.get("/api/save", headers=auth(guest["token"])).status_code == 200  # old token still valid

    def test_account_cannot_be_registered_twice(self, api):
        first = register(api, "Tank").json()
        cloudsave._attempts.clear()
        r = register(api, "Dozer", headers=auth(first["token"]))
        assert r.status_code == 200 and r.json()["id"] != first["id"]  # a new account, the first one untouched


class TestLogin:
    def test_login_other_device(self, api):
        acc = register(api, "Apoc").json()
        api.put("/api/save", json={"data": {"credits": 42}, "updated_at": 9}, headers=auth(acc["token"]))
        r = api.post("/api/accounts/login", json={"username": "apoc", "password": "secret123"})
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == acc["id"] and body["username"] == "Apoc" and body["token"] != acc["token"]
        assert api.get("/api/save", headers=auth(body["token"])).json()["data"] == {"credits": 42}

    def test_wrong_password_or_user_same_error(self, api):
        register(api, "Mouse")
        a = api.post("/api/accounts/login", json={"username": "Mouse", "password": "wrongpass"})
        b = api.post("/api/accounts/login", json={"username": "Nobody", "password": "wrongpass"})
        assert a.status_code == b.status_code == 401 and a.json() == b.json()

    def test_login_rate_limited(self, api):
        codes = [api.post("/api/accounts/login", json={"username": "Ghost", "password": "wrongpass"}).status_code for _ in range(11)]
        assert codes[:10] == [401] * 10 and codes[10] == 429


def test_hashing_roundtrip():
    h = accounts.hash_password("hunter22")
    assert accounts.check_password("hunter22", h) and not accounts.check_password("hunter23", h)
    assert h != accounts.hash_password("hunter22")  # salted
    assert not accounts.check_password("x", "garbage")


class TestDelete:
    def test_delete_account_removes_data(self, api, google):
        body = register(api, "Gone").json()
        h = auth(body["token"])
        pid = body["id"]
        assert api.post("/api/scores", json={"name": "Gone", "score": 500, "level": 2, "kills": 5}, headers=h).status_code == 200
        assert api.put("/api/save", json={"data": {"credits": 5}, "updated_at": 1000}, headers=h).status_code == 200
        assert api.post("/api/suggestions", json={"category": "idea", "message": "More cities please"}, headers=h).status_code == 200
        r = api.post("/api/purchases/verify", json={"product_id": "coins_1200", "purchase_token": "token-of-deleted-player"}, headers=h)
        assert r.status_code == 200 and r.json()["status"] == "valid", r.text

        cloudsave._attempts.clear()
        assert api.post("/api/accounts/delete", json={"password": "wrong-pass"}, headers=h).status_code == 403
        assert api.post("/api/accounts/delete", json={"password": "secret123"}, headers=h).json() == {"deleted": True}

        db = accounts.db
        for name in ("players", "scores", "saves", "activity", "suggestions"):
            key = "id" if name == "players" else "player_id"
            assert api.portal.call(db[name].count_documents, {key: pid}) == 0, name
        purchase = api.portal.call(db.purchases.find_one, {})
        assert purchase and purchase["player_id"].startswith("deleted-")
        # The token is dead, the name is free again, the leaderboard no longer lists it.
        assert api.get("/api/save", headers=h).status_code == 401
        assert api.get("/api/accounts/available?username=Gone").json()["available"] is True
        assert all(row["name"] != "Gone" for row in api.get("/api/leaderboard").json())

    def test_delete_requires_token(self, api):
        assert api.post("/api/accounts/delete", json={"password": "secret123"}).status_code == 401
