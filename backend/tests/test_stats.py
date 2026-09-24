import pytest

import stats
from conftest import ADMIN
from play_verifier import PlayPurchase


def anon(api, headers=None):
    r = api.post("/api/players", json={"name": "x"}, headers=headers or {})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def buy(api, h, sku="coins_500", token="tok-0123456789", **extra):
    return api.post("/api/purchases/verify", headers=h, json={"product_id": sku, "purchase_token": token, **extra})


def get_stats(api):
    r = api.get("/api/admin/stats", headers=ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def no_geoip(monkeypatch):
    monkeypatch.setattr(stats, "_geo", None)
    monkeypatch.setattr(stats, "_geo_loaded", True)


class FakeGeo:
    def __init__(self, table):
        self.table = table

    def get(self, ip):
        code = self.table.get(ip)
        return {"country": {"iso_code": code}} if code else None


def test_admin_only(api):
    assert api.get("/api/admin/stats").status_code == 401


def test_players_accounts_guests_and_activity(api, player, no_geoip):
    anon(api)
    anon(api)
    player("Alice")
    s = get_stats(api)
    assert s["players"]["total"] == 3
    assert s["players"]["accounts"] == 1
    assert s["players"]["guests"] == 2
    assert s["players"]["new_today"] == 3
    assert s["players"]["active_today"] == 3  # creating a player counts as a visit
    assert s["daily"][-1] == {"day": stats.today(), "active": 3, "new": 3, "purchases": 0}
    assert len(s["daily"]) == 30


def test_session_records_device_context(api, no_geoip):
    h = anon(api)
    ctx = {"X-Client-Country": "fr", "X-Client-Lang": "fr", "X-App-Version": "1.2.0", "X-Platform": "android"}
    assert api.post("/api/players/session", headers={**h, **ctx}).status_code == 200
    api.post("/api/players/session", headers={**h, **ctx})
    p = api.portal.call(stats.db.players.find_one, {})
    assert (p["country"], p["country_source"], p["lang"], p["app_version"], p["platform"], p["sessions"]) == (
        "FR",
        "device",
        "fr",
        "1.2.0",
        "android",
        2,
    )
    s = get_stats(api)
    assert s["players"]["active_today"] == 1  # one activity row per player and day
    assert s["languages"] == [{"value": "fr", "players": 1}]
    assert s["countries"][0]["country"] == "FR"


def test_invalid_context_is_ignored(api, no_geoip):
    h = anon(api)
    bad = {"X-Client-Country": "France", "X-Client-Lang": "<script>", "X-App-Version": "x" * 50, "X-Platform": "toaster"}
    api.post("/api/players/session", headers={**h, **bad})
    p = api.portal.call(stats.db.players.find_one, {})
    assert not any(k in p for k in ("country", "lang", "app_version", "platform"))


def test_geoip_country_wins_over_device(api, monkeypatch):
    monkeypatch.setattr(stats, "_geo", FakeGeo({"203.0.113.9": "TN"}))
    monkeypatch.setattr(stats, "_geo_loaded", True)
    # The proxy appends the real client address last; earlier entries may be forged.
    h = anon(api, {"X-Forwarded-For": "198.51.100.1, 203.0.113.9", "X-Client-Country": "FR"})
    p = api.portal.call(stats.db.players.find_one, {})
    assert (p["country"], p["country_source"]) == ("TN", "ip")
    # Later visit from an address the database does not know: keep the IP-based country.
    api.post("/api/players/session", headers={**h, "X-Forwarded-For": "192.0.2.1", "X-Client-Country": "FR"})
    p = api.portal.call(stats.db.players.find_one, {})
    assert p["country"] == "TN"


def test_purchase_revenue_countries_and_products(api, player, google, no_geoip):
    fr = anon(api, {"X-Client-Country": "FR"})
    tn = player("Buyer")
    api.post("/api/players/session", headers={**tn, "X-Client-Country": "TN"})
    google["result"] = PlayPurchase(state="purchased", order_id="GPA.1", is_test=False)
    assert buy(api, fr, "coins_500", "tok-aaaaaaaaaa", price=0.99, currency="EUR").json()["status"] == "valid"
    assert buy(api, fr, "coins_1200", "tok-bbbbbbbbbb", price=1.99, currency="EUR").json()["status"] == "valid"
    google["result"] = PlayPurchase(state="purchased", order_id="GPA.2", is_test=False, region_code="TN")
    assert buy(api, tn, "coins_500", "tok-cccccccccc", price=3.2, currency="TND").json()["status"] == "valid"
    google["result"] = PlayPurchase(state="purchased", order_id="GPA.3", is_test=True)
    buy(api, tn, "coins_8000", "tok-dddddddddd", price=19.99, currency="EUR")  # license tester

    s = get_stats(api)
    p = s["purchases"]
    assert (p["count"], p["test_count"], p["buyers"], p["credits"]) == (3, 1, 2, 2200)
    assert p["revenue"] == [{"currency": "TND", "amount": 3.2}, {"currency": "EUR", "amount": 2.98}]
    assert p["conversion"] == 100.0
    assert s["daily"][-1]["purchases"] == 3
    by_country = {c["country"]: c for c in s["countries"]}
    assert by_country["FR"]["purchases"] == 2 and by_country["FR"]["buyers"] == 1
    assert by_country["FR"]["revenue"] == [{"currency": "EUR", "amount": 2.98}]
    assert by_country["TN"]["revenue"] == [{"currency": "TND", "amount": 3.2}]
    assert by_country["TN"]["accounts"] == 1
    assert s["products"][0] == {"sku": "coins_500", "count": 2, "credits": 1000, "revenue": [{"currency": "TND", "amount": 3.2}, {"currency": "EUR", "amount": 0.99}]}
    recent = s["recent_purchases"]
    assert len(recent) == 4 and recent[0]["is_test"] is True
    assert {r["player"] for r in recent} == {"invité", "Buyer"}


def test_purchase_without_price_is_counted(api, player, google, no_geoip):
    google["result"] = PlayPurchase(state="purchased", order_id="GPA.1", is_test=False)
    buy(api, player())
    s = get_stats(api)["purchases"]
    assert (s["count"], s["revenue"], s["without_price"]) == (1, [], 1)


def test_bad_currency_rejected(api, player, google):
    assert buy(api, player(), price=1.0, currency="euro").status_code == 422


def test_login_rate_limit_is_per_client_address(api, player, no_geoip):
    player("Target")
    bad = {"username": "Target", "password": "wrong-pass"}
    for _ in range(10):
        assert api.post("/api/accounts/login", json=bad, headers={"X-Forwarded-For": "203.0.113.5"}).status_code == 401
    assert api.post("/api/accounts/login", json=bad, headers={"X-Forwarded-For": "203.0.113.5"}).status_code == 429
    # Another player behind the same proxy is not blocked.
    assert api.post("/api/accounts/login", json=bad, headers={"X-Forwarded-For": "203.0.113.6"}).status_code == 401
