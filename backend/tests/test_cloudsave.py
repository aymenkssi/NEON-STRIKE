import cloudsave


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def new_player(api, name="ACE"):
    return api.post("/api/players", json={"name": name}).json()


SAVE = {"credits": 1500, "unlockedLevel": 7, "stars": {"1": 3}}


class TestSave:
    def test_empty_then_roundtrip(self, api):
        t = new_player(api)["token"]
        assert api.get("/api/save", headers=auth(t)).json() is None
        r = api.put("/api/save", json={"data": SAVE, "updated_at": 1000}, headers=auth(t))
        assert r.json() == {"stored": True, "updated_at": 1000}
        assert api.get("/api/save", headers=auth(t)).json() == {"data": SAVE, "updated_at": 1000}

    def test_older_save_not_stored(self, api):
        t = new_player(api)["token"]
        api.put("/api/save", json={"data": SAVE, "updated_at": 2000}, headers=auth(t))
        r = api.put("/api/save", json={"data": {"credits": 0}, "updated_at": 1500}, headers=auth(t))
        assert r.json() == {"stored": False, "updated_at": 2000}
        assert api.get("/api/save", headers=auth(t)).json()["data"] == SAVE

    def test_requires_player(self, api):
        assert api.get("/api/save").status_code == 401
        assert api.put("/api/save", json={"data": {}, "updated_at": 1}).status_code == 401

    def test_saves_are_per_player(self, api):
        a, b = new_player(api, "A")["token"], new_player(api, "B")["token"]
        api.put("/api/save", json={"data": SAVE, "updated_at": 1}, headers=auth(a))
        assert api.get("/api/save", headers=auth(b)).json() is None

    def test_too_large(self, api):
        t = new_player(api)["token"]
        big = {"x": "a" * (cloudsave.MAX_SAVE_BYTES + 10)}
        assert api.put("/api/save", json={"data": big, "updated_at": 1}, headers=auth(t)).status_code == 413


class TestRecovery:
    def test_recover_on_new_device(self, api):
        p = new_player(api, "NEO")
        api.put("/api/save", json={"data": SAVE, "updated_at": 5}, headers=auth(p["token"]))
        code = api.post("/api/players/recovery-code", headers=auth(p["token"])).json()["code"]
        assert len(code) == 14 and code.count("-") == 2
        # New phone: lowercase, spaces and missing dashes are accepted
        r = api.post("/api/players/recover", json={"code": code.lower().replace("-", " ")})
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == p["id"] and body["name"] == "NEO" and body["token"] != p["token"]
        # Both devices now act as the same player
        assert api.get("/api/save", headers=auth(body["token"])).json()["data"] == SAVE
        assert api.get("/api/save", headers=auth(p["token"])).status_code == 200

    def test_new_code_invalidates_old(self, api):
        p = new_player(api)
        old = api.post("/api/players/recovery-code", headers=auth(p["token"])).json()["code"]
        new = api.post("/api/players/recovery-code", headers=auth(p["token"])).json()["code"]
        assert old != new
        assert api.post("/api/players/recover", json={"code": old}).status_code == 404
        assert api.post("/api/players/recover", json={"code": new}).status_code == 200

    def test_wrong_code(self, api):
        assert api.post("/api/players/recover", json={"code": "AAAA-BBBB-CCCC"}).status_code == 404
        assert api.post("/api/players/recover", json={"code": "short!!!"}).status_code == 404

    def test_rate_limited(self, api):
        codes = [api.post("/api/players/recover", json={"code": "AAAA-BBBB-CCCC"}).status_code for _ in range(11)]
        assert codes[:10] == [404] * 10 and codes[10] == 429

    def test_device_list_is_capped(self, api):
        p = new_player(api)
        code = api.post("/api/players/recovery-code", headers=auth(p["token"])).json()["code"]
        tokens = []
        for _ in range(12):
            cloudsave._attempts.clear()
            tokens.append(api.post("/api/players/recover", json={"code": code}).json()["token"])
        assert api.get("/api/save", headers=auth(tokens[-1])).status_code == 200
        assert api.get("/api/save", headers=auth(tokens[0])).status_code == 401  # oldest device dropped
        assert api.get("/api/save", headers=auth(p["token"])).status_code == 200  # original device kept
