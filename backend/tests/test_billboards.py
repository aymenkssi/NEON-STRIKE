import base64
from datetime import datetime, timedelta, timezone

from conftest import ADMIN

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200


def data_url(raw=JPEG, kind="jpeg"):
    return f"data:image/{kind};base64," + base64.b64encode(raw).decode()


def ad(**kw):
    base = {"name": "Pizza Roma", "slot": 1, "level_from": 1, "level_to": 30, "active": True, "image": data_url()}
    base.update(kw)
    return base


def test_admin_required(api):
    assert api.get("/api/admin/billboards").status_code == 401
    assert api.post("/api/admin/billboards", json=ad()).status_code == 401


def test_create_serve_and_config(api):
    r = api.post("/api/admin/billboards", json=ad(), headers=ADMIN)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["version"] == 1 and b["views"] == 0 and b["image_url"].endswith(f"{b['id']}-1.jpg")
    img = api.get(b["image_url"])
    assert img.status_code == 200 and img.content == JPEG and img.headers["content-type"] == "image/jpeg"
    assert "max-age" in img.headers["cache-control"]
    assert img.headers["access-control-allow-origin"] == "*"
    cfg = api.get("/api/config").json()["billboards"]
    assert cfg == [{"id": b["id"], "slot": 1, "level_from": 1, "level_to": 30, "url": b["image_url"]}]
    # The list never carries the image bytes
    assert "image" not in api.get("/api/admin/billboards", headers=ADMIN).json()[0]


def test_live_rules(api):
    api.post("/api/admin/billboards", json=ad(name="Off", active=False), headers=ADMIN)
    later = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    api.post("/api/admin/billboards", json=ad(name="Later", starts_at=later), headers=ADMIN)
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    api.post("/api/admin/billboards", json=ad(name="Over", starts_at=(datetime.now(timezone.utc) - timedelta(days=3)).isoformat(), ends_at=past), headers=ADMIN)
    live = api.post("/api/admin/billboards", json=ad(name="Live", slot=0, level_from=6, level_to=10, image=data_url(PNG, "png")), headers=ADMIN).json()
    cfg = api.get("/api/config").json()["billboards"]
    assert [c["id"] for c in cfg] == [live["id"]] and cfg[0]["slot"] == 0 and cfg[0]["url"].endswith(".png")


def test_validation(api):
    for bad in (
        ad(image=None),
        ad(image="data:image/gif;base64,R0lGOD"),
        ad(image=data_url(b"not an image")),
        ad(slot=4),
        ad(level_from=12, level_to=3),
        ad(name=""),
    ):
        assert api.post("/api/admin/billboards", json=bad, headers=ADMIN).status_code in (413, 422), bad
    big = data_url(JPEG + b"0" * 1_600_000)
    assert api.post("/api/admin/billboards", json=ad(image=big), headers=ADMIN).status_code == 413


def test_update_image_bumps_version_and_views(api):
    b = api.post("/api/admin/billboards", json=ad(), headers=ADMIN).json()
    r = api.put(f"/api/admin/billboards/{b['id']}", json=ad(name="Pizza Roma 2", image=None), headers=ADMIN).json()
    assert r["version"] == 1 and r["name"] == "Pizza Roma 2"
    r = api.put(f"/api/admin/billboards/{b['id']}", json=ad(image=data_url(PNG, "png")), headers=ADMIN).json()
    assert r["version"] == 2 and r["image_url"].endswith("-2.png")
    assert api.get(r["image_url"]).content == PNG
    for _ in range(3):
        api.post("/api/billboards/views", json={"ids": [b["id"], "nope"]})
    assert api.get("/api/admin/billboards", headers=ADMIN).json()[0]["views"] == 3
    assert api.post("/api/billboards/views", json={"ids": ["a"] * 5}).status_code == 422
    assert api.get("/api/billboards/zzz.jpg").status_code == 404
    assert api.delete(f"/api/admin/billboards/{b['id']}", headers=ADMIN).status_code == 200
    assert api.get(r["image_url"]).status_code == 404
    assert api.get("/api/config").json()["billboards"] == []
