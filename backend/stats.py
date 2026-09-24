"""Player and purchase statistics for the admin page.

Collected per player (never the IP address itself):
- country: from the IP with a GeoIP database when one is installed (see deploy/geoip-update.sh),
  otherwise the phone's region sent by the app (X-Client-Country);
- language, app version, platform, first and last visit, number of sessions;
- one activity row per player and day (daily / weekly / monthly active players).
Purchases also keep the price paid and its currency, as reported by Google Play to the app.
"""
import logging
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from pymongo.errors import DuplicateKeyError

from auth import current_player
from database import db
from liveops import require_admin

logger = logging.getLogger("neon.stats")

public = APIRouter(prefix="/api")
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
LANG_RE = re.compile(r"^[a-z]{2}$")
VERSION_RE = re.compile(r"^[0-9A-Za-z.+-]{1,20}$")
PLATFORMS = {"android", "ios", "web"}

_geo = None
_geo_loaded = False


def _geoip():
    """GeoIP reader (DB-IP / MaxMind country .mmdb), or None when no database is installed."""
    global _geo, _geo_loaded
    if not _geo_loaded:
        _geo_loaded = True
        path = os.environ.get("GEOIP_DB", "/app/geoip/country.mmdb")
        if os.path.exists(path):
            try:
                import maxminddb

                _geo = maxminddb.open_database(path)
                logger.info("GeoIP database loaded: %s", path)
            except Exception:
                logger.exception("Cannot open GeoIP database %s", path)
    return _geo


def client_ip(request: Request) -> str:
    """Address of the player. Behind Traefik or Caddy, the proxy appends the real client address
    as the last X-Forwarded-For entry (entries before it can be forged by the client)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "?"


def country_from_ip(ip: str) -> Optional[str]:
    reader = _geoip()
    if not reader or not ip or ip == "?":
        return None
    try:
        rec = reader.get(ip) or {}
    except ValueError:
        return None
    code = ((rec.get("country") or {}).get("iso_code") or "").upper()
    return code if COUNTRY_RE.match(code) else None


def client_context(request: Request) -> Dict[str, str]:
    """What the app says about itself, validated, plus the country."""
    h = request.headers
    ctx: Dict[str, str] = {}
    geo = country_from_ip(client_ip(request))
    device = (h.get("x-client-country") or "").strip().upper()
    if geo:
        ctx["country"], ctx["country_source"] = geo, "ip"
    elif COUNTRY_RE.match(device):
        ctx["country"], ctx["country_source"] = device, "device"
    lang = (h.get("x-client-lang") or "").strip().lower()
    if LANG_RE.match(lang):
        ctx["lang"] = lang
    version = (h.get("x-app-version") or "").strip()
    if VERSION_RE.match(version):
        ctx["app_version"] = version
    platform = (h.get("x-platform") or "").strip().lower()
    if platform in PLATFORMS:
        ctx["platform"] = platform
    return ctx


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def record_visit(player: dict, request: Request, new_session: bool = False) -> None:
    now = datetime.now(timezone.utc).isoformat()
    ctx = client_context(request)
    # An IP-based country is more reliable than the phone setting: never downgrade it.
    if ctx.get("country_source") == "device" and player.get("country_source") == "ip":
        ctx.pop("country"), ctx.pop("country_source")
    update: dict = {"$set": {"last_seen_at": now, **ctx}}
    if new_session:
        update["$inc"] = {"sessions": 1}
    await db.players.update_one({"id": player["id"]}, update)
    day = {"player_id": player["id"], "day": today()}
    try:
        await db.activity.update_one(day, {"$setOnInsert": day}, upsert=True)
    except DuplicateKeyError:
        pass  # two visits at the same instant: the row exists, which is all we need


@public.post("/players/session")
async def session_start(request: Request, player: dict = Depends(current_player)):
    """Called by the app at launch: activity, country, language and version of the player."""
    await record_visit(player, request, new_session=True)
    return {"ok": True}


# ------------------------ Admin ------------------------
def _days_back(n: int) -> List[str]:
    start = datetime.now(timezone.utc).date()
    return [(start - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)]


def _money(amounts: Dict[str, float]) -> List[dict]:
    return sorted(({"currency": c, "amount": round(a, 2)} for c, a in amounts.items()), key=lambda r: -r["amount"])


@admin.get("/stats")
async def stats(days: int = Query(default=30, ge=7, le=365)):
    now = datetime.now(timezone.utc)
    series_days = _days_back(days)
    since = series_days[0]

    # ---- Players ----
    players = await db.players.find(
        {}, {"_id": 0, "id": 1, "username": 1, "name": 1, "created_at": 1, "last_seen_at": 1, "country": 1, "lang": 1, "app_version": 1, "platform": 1}
    ).to_list(None)
    by_id = {p["id"]: p for p in players}

    def created_within(p, d):
        return (p.get("created_at") or "") >= (now - timedelta(days=d)).isoformat()

    activity = await db.activity.find({"day": {"$gte": since}}, {"_id": 0}).to_list(None)
    active_by_day: Dict[str, set] = defaultdict(set)
    for a in activity:
        active_by_day[a["day"]].add(a["player_id"])

    def active_within(d: int) -> int:
        ids = set()
        for day in _days_back(d):
            ids |= active_by_day.get(day, set())
        return len(ids)

    new_by_day: Dict[str, int] = defaultdict(int)
    for p in players:
        day = (p.get("created_at") or "")[:10]
        if day >= since:
            new_by_day[day] += 1

    # ---- Purchases (test purchases from license testers are counted apart) ----
    purchases = await db.purchases.find({}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(None)
    real = [p for p in purchases if not p.get("is_test")]
    revenue: Dict[str, float] = defaultdict(float)
    for p in real:
        if p.get("price") is not None and p.get("currency"):
            revenue[p["currency"]] += p["price"]
    purchases_by_day: Dict[str, int] = defaultdict(int)
    for p in real:
        day = (p.get("created_at") or "")[:10]
        if day >= since:
            purchases_by_day[day] += 1

    products: Dict[str, dict] = {}
    for p in real:
        row = products.setdefault(p["product_id"], {"sku": p["product_id"], "count": 0, "credits": 0, "revenue": defaultdict(float)})
        row["count"] += 1
        row["credits"] += p.get("credits") or 0
        if p.get("price") is not None and p.get("currency"):
            row["revenue"][p["currency"]] += p["price"]

    # ---- Countries ----
    countries: Dict[str, dict] = {}

    def country_row(code: str) -> dict:
        return countries.setdefault(
            code, {"country": code, "players": 0, "accounts": 0, "active_30d": 0, "buyers": set(), "purchases": 0, "revenue": defaultdict(float)}
        )

    active_30 = set()
    for day in _days_back(30):
        active_30 |= active_by_day.get(day, set())
    for p in players:
        row = country_row(p.get("country") or "??")
        row["players"] += 1
        row["accounts"] += 1 if p.get("username") else 0
        row["active_30d"] += 1 if p["id"] in active_30 else 0
    for p in real:
        buyer = by_id.get(p["player_id"], {})
        row = country_row(p.get("country") or buyer.get("country") or "??")
        row["buyers"].add(p["player_id"])
        row["purchases"] += 1
        if p.get("price") is not None and p.get("currency"):
            row["revenue"][p["currency"]] += p["price"]

    def share(field: str) -> List[dict]:
        counts: Dict[str, int] = defaultdict(int)
        for p in players:
            counts[p.get(field) or "?"] += 1
        return [{"value": k, "players": v} for k, v in sorted(counts.items(), key=lambda kv: -kv[1])]

    buyers = {p["player_id"] for p in real}
    return {
        "generated_at": now.isoformat(),
        "geoip": _geoip() is not None,
        "players": {
            "total": len(players),
            "accounts": sum(1 for p in players if p.get("username")),
            "guests": sum(1 for p in players if not p.get("username")),
            "new_today": new_by_day.get(series_days[-1], 0),
            "new_7d": sum(1 for p in players if created_within(p, 7)),
            "new_30d": sum(1 for p in players if created_within(p, 30)),
            "active_today": len(active_by_day.get(series_days[-1], set())),
            "active_7d": active_within(7),
            "active_30d": active_within(30),
        },
        "purchases": {
            "count": len(real),
            "test_count": len(purchases) - len(real),
            "buyers": len(buyers),
            "conversion": round(100 * len(buyers) / len(players), 2) if players else 0.0,
            "credits": sum(p.get("credits") or 0 for p in real),
            "revenue": _money(revenue),
            "without_price": sum(1 for p in real if p.get("price") is None),
        },
        "daily": [
            {"day": d, "active": len(active_by_day.get(d, set())), "new": new_by_day.get(d, 0), "purchases": purchases_by_day.get(d, 0)}
            for d in series_days
        ],
        "countries": sorted(
            (
                {**{k: v for k, v in c.items() if k not in ("buyers", "revenue")}, "buyers": len(c["buyers"]), "revenue": _money(c["revenue"])}
                for c in countries.values()
            ),
            key=lambda r: (-r["players"], r["country"]),
        ),
        "products": sorted(
            ({**{k: v for k, v in r.items() if k != "revenue"}, "revenue": _money(r["revenue"])} for r in products.values()),
            key=lambda r: -r["count"],
        ),
        "languages": share("lang"),
        "versions": share("app_version"),
        "platforms": share("platform"),
        "recent_purchases": [
            {
                "created_at": p.get("created_at"),
                "sku": p["product_id"],
                "credits": p.get("credits"),
                "price": p.get("price"),
                "currency": p.get("currency"),
                "country": p.get("country") or by_id.get(p["player_id"], {}).get("country"),
                "player": by_id.get(p["player_id"], {}).get("username") or "invité",
                "is_test": bool(p.get("is_test")),
            }
            for p in purchases[:25]
        ],
    }


async def setup():
    await db.activity.create_index([("day", 1), ("player_id", 1)], unique=True)
    await db.players.create_index("country")
