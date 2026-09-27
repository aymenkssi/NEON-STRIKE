from datetime import datetime, timedelta, timezone

from conftest import ADMIN


def episode(**kw):
    base = {
        "title_fr": "Le retour", "title_en": "The Return", "tagline_fr": "Un signal à Sydney.", "level": 12,
        "boss_look": "queen", "boss_name_fr": "LA REINE II", "boss_hp": 2,
        "radio_start_fr": "On y retourne.", "radio_boss_who": "kira", "radio_boss_fr": "La voilà !",
        "intro": [{"art": "signal", "who": "narrator", "text_fr": "Un signal…", "text_en": "A signal…"}, {"art": "hero:o_ninja", "who": "kira", "text_fr": "Allons-y."}],
        "outro": [{"art": "team", "who": "max", "text_fr": "Encore gagné."}],
        "reward_credits": 700, "reward_skin": "o_cyber_2", "published": True,
    }
    base.update(kw)
    return base


def test_admin_required(api):
    assert api.get("/api/admin/episodes").status_code == 401
    assert api.post("/api/admin/episodes", json=episode()).status_code == 401


def test_create_publish_and_config(api):
    r = api.post("/api/admin/episodes", json=episode(), headers=ADMIN)
    assert r.status_code == 200, r.text
    ep = r.json()
    assert ep["number"] == 1 and ep["id"]
    draft = api.post("/api/admin/episodes", json=episode(title_fr="Brouillon", published=False), headers=ADMIN).json()
    assert draft["number"] == 2
    later = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    api.post("/api/admin/episodes", json=episode(title_fr="Plus tard", starts_at=later), headers=ADMIN)
    live = api.get("/api/config").json()["episodes"]
    assert [e["title_fr"] for e in live] == ["Le retour"]  # drafts and future episodes hidden
    assert live[0]["intro"][1]["art"] == "hero:o_ninja" and live[0]["reward_skin"] == "o_cyber_2"
    # Publishing the draft: newest first
    r = api.put(f"/api/admin/episodes/{draft['id']}", json=episode(title_fr="Brouillon", published=True), headers=ADMIN)
    assert r.status_code == 200
    assert [e["title_fr"] for e in api.get("/api/config").json()["episodes"]] == ["Brouillon", "Le retour"]
    assert len(api.get("/api/admin/episodes", headers=ADMIN).json()) == 3


def test_validation(api):
    for bad in (
        episode(level=31),
        episode(boss_look="dragon"),
        episode(intro=[]),
        episode(intro=[{"art": "moon", "who": "narrator", "text_fr": "x"}]),
        episode(intro=[{"art": "lab", "who": "bob", "text_fr": "x"}]),
        episode(reward_skin="../x"),
        episode(boss_hp=9),
        episode(title_fr=""),
    ):
        assert api.post("/api/admin/episodes", json=bad, headers=ADMIN).status_code == 422, bad
    assert api.post("/api/admin/episodes", json=episode(reward_skin=""), headers=ADMIN).json()["reward_skin"] is None


def test_update_delete(api):
    ep = api.post("/api/admin/episodes", json=episode(), headers=ADMIN).json()
    r = api.put(f"/api/admin/episodes/{ep['id']}", json=episode(title_fr="Nouveau titre"), headers=ADMIN)
    assert r.json()["title_fr"] == "Nouveau titre" and r.json()["number"] == 1
    assert api.put("/api/admin/episodes/nope", json=episode(), headers=ADMIN).status_code == 404
    assert api.delete(f"/api/admin/episodes/{ep['id']}", headers=ADMIN).status_code == 200
    assert api.delete(f"/api/admin/episodes/{ep['id']}", headers=ADMIN).status_code == 404
    assert api.get("/api/config").json()["episodes"] == []
