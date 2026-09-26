from datetime import datetime, timedelta, timezone

import pytest

from conftest import ADMIN
from test_api import verify  # noqa: F401  (reuses the purchase helper)


def iso(delta_hours):
    return (datetime.now(timezone.utc) + timedelta(hours=delta_hours)).isoformat()


class TestAdminAuth:
    def test_admin_requires_token(self, api):
        assert api.get("/api/admin/packs").status_code == 401
        assert api.get("/api/admin/packs", headers={"Authorization": "Bearer wrong-token-xxxxxxxx"}).status_code == 401

    def test_admin_disabled_without_env(self, api, monkeypatch):
        monkeypatch.delenv("ADMIN_TOKEN")
        assert api.get("/api/admin/packs", headers=ADMIN).status_code == 503

    def test_admin_disabled_with_short_token(self, api, monkeypatch):
        monkeypatch.setenv("ADMIN_TOKEN", "short")
        assert api.get("/api/admin/packs", headers={"Authorization": "Bearer short"}).status_code == 503

    def test_admin_page_served(self, api):
        r = api.get("/admin")
        assert r.status_code == 200 and "Neon Strike Admin" in r.text
        assert r.headers["x-frame-options"] == "DENY"


class TestPacks:
    def test_defaults_seeded(self, api):
        packs = api.get("/api/config").json()["packs"]
        assert [p["sku"] for p in packs] == ["coins_500", "coins_1200", "coins_3500", "coins_8000"]
        assert packs[2]["tag"] == "POPULAIRE"

    def test_update_and_add_pack(self, api):
        r = api.put("/api/admin/packs/coins_1200", json={"credits": 2000, "bonus": " PROMO ", "tag": "", "sort": 5}, headers=ADMIN)
        assert r.json() == {"sku": "coins_1200", "credits": 2000, "bonus": "PROMO", "tag": None, "tag_en": None, "sort": 5, "active": True}
        api.put("/api/admin/packs/coins_20000", json={"credits": 20000, "sort": 99}, headers=ADMIN)
        packs = api.get("/api/config").json()["packs"]
        assert [p["sku"] for p in packs][0] == "coins_1200" and packs[-1]["sku"] == "coins_20000"

    def test_hidden_pack_not_public(self, api):
        api.put("/api/admin/packs/coins_8000", json={"credits": 8000, "active": False}, headers=ADMIN)
        assert "coins_8000" not in [p["sku"] for p in api.get("/api/config").json()["packs"]]
        assert "coins_8000" in [p["sku"] for p in api.get("/api/admin/packs", headers=ADMIN).json()]

    @pytest.mark.parametrize("sku", ["Coins", "_x", "coins-500", "a" * 65])
    def test_invalid_sku(self, api, sku):
        assert api.put(f"/api/admin/packs/{sku}", json={"credits": 1}, headers=ADMIN).status_code == 422

    def test_invalid_credits(self, api):
        assert api.put("/api/admin/packs/coins_1", json={"credits": 0}, headers=ADMIN).status_code == 422

    def test_delete_pack(self, api):
        assert api.delete("/api/admin/packs/coins_500", headers=ADMIN).status_code == 200
        assert api.delete("/api/admin/packs/coins_500", headers=ADMIN).status_code == 404


class TestCreditsFollowConfig:
    def test_verified_purchase_uses_configured_credits(self, api, player, google):
        api.put("/api/admin/packs/coins_1200", json={"credits": 2400}, headers=ADMIN)
        assert verify(api, player(), "coins_1200").json()["credits"] == 2400

    def test_hidden_pack_still_honoured(self, api, player, google):
        api.put("/api/admin/packs/coins_3500", json={"credits": 3500, "active": False}, headers=ADMIN)
        assert verify(api, player(), "coins_3500").json()["status"] == "valid"

    def test_sold_pack_cannot_be_deleted(self, api, player, google):
        verify(api, player(), "coins_500")
        assert api.delete("/api/admin/packs/coins_500", headers=ADMIN).status_code == 409

    def test_deleted_pack_rejected(self, api, player, google):
        api.delete("/api/admin/packs/coins_8000", headers=ADMIN)
        assert verify(api, player(), "coins_8000").status_code == 422


class TestMessages:
    def post(self, api, **kw):
        body = {"title": "Bonjour", "body": "Bienvenue", **kw}
        return api.post("/api/admin/messages", json=body, headers=ADMIN)

    def live_titles(self, api):
        return [m["title"] for m in api.get("/api/config").json()["messages"]]

    def test_publish_and_receive(self, api):
        m = self.post(api, title="Promo", kind="promo").json()
        cfg = api.get("/api/config").json()["messages"]
        assert cfg == [{"id": m["id"], "title": "Promo", "body": "Bienvenue", "title_en": None, "body_en": None, "kind": "promo"}]

    def test_schedule_window(self, api):
        self.post(api, title="future", starts_at=iso(2))
        self.post(api, title="past", starts_at=iso(-5), ends_at=iso(-1))
        self.post(api, title="now", starts_at=iso(-1), ends_at=iso(1))
        self.post(api, title="off", active=False)
        assert self.live_titles(api) == ["now"]

    def test_naive_datetime_is_utc(self, api):
        naive_past = (datetime.now(timezone.utc) - timedelta(hours=1)).replace(tzinfo=None).isoformat()
        self.post(api, title="naive", starts_at=naive_past)
        assert self.live_titles(api) == ["naive"]

    def test_end_before_start_rejected(self, api):
        assert self.post(api, starts_at=iso(2), ends_at=iso(1)).status_code == 422

    def test_edit_toggle_delete(self, api):
        m = self.post(api).json()
        r = api.put(f"/api/admin/messages/{m['id']}", json={"title": "Maintenance", "body": "Ce soir 22h", "kind": "warning", "active": False}, headers=ADMIN)
        assert r.json()["title"] == "Maintenance" and r.json()["active"] is False
        assert self.live_titles(api) == []
        assert api.delete(f"/api/admin/messages/{m['id']}", headers=ADMIN).status_code == 200
        assert api.get("/api/admin/messages", headers=ADMIN).json() == []
        assert api.put("/api/admin/messages/nope", json={"title": "a", "body": "b"}, headers=ADMIN).status_code == 404

    def test_validation(self, api):
        assert self.post(api, title="").status_code == 422
        assert self.post(api, kind="spam").status_code == 422
        assert self.post(api, body="x" * 1001).status_code == 422

    def test_at_most_five_live_messages(self, api):
        for i in range(7):
            self.post(api, title=f"m{i}")
        assert len(self.live_titles(api)) == 5


class TestEnglish:
    def test_message_english_version_is_public(self, api):
        body = {"title": "Promo", "body": "Crédits x2", "title_en": "Sale", "body_en": "Credits x2", "kind": "promo"}
        assert api.post("/api/admin/messages", json=body, headers=ADMIN).status_code == 200
        msg = api.get("/api/config").json()["messages"][0]
        assert (msg["title_en"], msg["body_en"]) == ("Sale", "Credits x2")

    def test_message_without_english(self, api):
        api.post("/api/admin/messages", json={"title": "Info", "body": "Bonjour"}, headers=ADMIN)
        msg = api.get("/api/config").json()["messages"][0]
        assert msg["title_en"] is None and msg["body_en"] is None

    def test_pack_english_tag(self, api):
        r = api.put("/api/admin/packs/coins_500", json={"credits": 500, "tag": "NOUVEAU", "tag_en": " NEW "}, headers=ADMIN)
        assert r.json()["tag_en"] == "NEW"
        packs = {p["sku"]: p for p in api.get("/api/config").json()["packs"]}
        assert packs["coins_500"]["tag_en"] == "NEW"
        assert packs["coins_3500"]["tag_en"] == "POPULAR"


class TestWeaponPrices:
    def test_defaults_in_config(self, api):
        weapons = {w["key"]: w for w in api.get("/api/config").json()["weapons"]}
        assert list(weapons)[:2] == ["pistol", "shotgun"] and weapons["pistol"]["price"] == 0
        assert weapons["ak47"]["price"] == 2800 and weapons["rpg"]["on_sale"] is True

    def test_admin_sets_price_and_sale(self, api):
        from conftest import ADMIN
        r = api.put("/api/admin/weapons/ak47", json={"price": 3500, "on_sale": False}, headers=ADMIN)
        assert r.status_code == 200 and r.json()["price"] == 3500
        ak = next(w for w in api.get("/api/config").json()["weapons"] if w["key"] == "ak47")
        assert ak == {"key": "ak47", "name": "AK-47", "price": 3500, "on_sale": False}
        assert api.get("/api/admin/weapons", headers=ADMIN).json()[5]["price"] == 3500

    def test_validation(self, api):
        from conftest import ADMIN
        assert api.put("/api/admin/weapons/laser", json={"price": 10}, headers=ADMIN).status_code == 422
        assert api.put("/api/admin/weapons/m4", json={"price": -1}, headers=ADMIN).status_code == 422
        assert api.put("/api/admin/weapons/m4", json={"price": 10}).status_code == 401
