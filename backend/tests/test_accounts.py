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
