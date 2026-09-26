"""Player accounts: a unique username + password on top of the anonymous player.

- POST /api/accounts/register : turns the caller's anonymous player into an account (keeps its
  scores, purchases and save), or creates a new player when called without a token.
- POST /api/accounts/login    : returns a new device token for an existing account.
- GET  /api/accounts/available: live check while typing a username.
- POST /api/accounts/delete   : deletes the caller's account and its data (password required);
  purchases are kept for accounting but detached from the player.
- GET  /api/admin/players     : player list of the admin page (search, filter, sort, pages).
- DELETE /api/admin/players/{id}: deletes a player, like the in-app deletion (e.g. offensive name).

Passwords are stored as salted scrypt hashes (hashlib, no extra dependency).
"""
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from auth import current_player, find_player_by_token, hash_token
from cloudsave import MAX_DEVICES, _rate_limited
from database import db
from liveops import require_admin
from stats import client_ip, record_visit

logger = logging.getLogger("neon.accounts")
router = APIRouter(prefix="/api/accounts")
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,16}$")
SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **SCRYPT)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


class Credentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=16)
    password: str = Field(..., min_length=6, max_length=72)


class DeleteRequest(BaseModel):
    password: str = Field("", max_length=72)


class AccountSession(BaseModel):
    id: str
    token: str
    username: str


class Availability(BaseModel):
    available: bool
    reason: Optional[str] = None  # "invalid" | "taken"


def validate_username(username: str) -> str:
    username = username.strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(422, "Username must be 3-16 letters, digits or _")
    return username


async def username_taken(username: str) -> bool:
    return await db.players.count_documents({"username_lower": username.lower()}) > 0


@router.get("/available", response_model=Availability)
async def available(username: str):
    if not USERNAME_RE.match(username.strip()):
        return Availability(available=False, reason="invalid")
    if await username_taken(username.strip()):
        return Availability(available=False, reason="taken")
    return Availability(available=True)


@router.post("/register", response_model=AccountSession)
async def register(payload: Credentials, request: Request, authorization: Optional[str] = Header(default=None)):
    ip = client_ip(request)
    if _rate_limited(f"register:{ip}"):
        raise HTTPException(429, "Too many attempts, try again later")
    username = validate_username(payload.username)
    if await username_taken(username):
        raise HTTPException(409, "Username already taken")

    fields = {
        "username": username,
        "username_lower": username.lower(),
        "name": username,
        "password_hash": hash_password(payload.password),
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    token = secrets.token_urlsafe(32)
    current = None
    if authorization and authorization.lower().startswith("bearer "):
        current = await find_player_by_token(authorization[7:].strip())

    try:
        if current and not current.get("username"):
            # Upgrade the guest's anonymous player: scores, purchases and save follow the account.
            devices = (current.get("device_token_hashes") or [])[-(MAX_DEVICES - 1):] + [hash_token(token)]
            await db.players.update_one({"id": current["id"]}, {"$set": {**fields, "device_token_hashes": devices}})
            player_id = current["id"]
        else:
            player_id = str(uuid.uuid4())
            await db.players.insert_one(
                {"id": player_id, "token_hash": hash_token(token), "created_at": fields["registered_at"], "last_score_at": 0.0, **fields}
            )
    except Exception as e:  # unique index race: two sign-ups with the same name at once
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "Username already taken")
        raise
    await db.scores.update_many({"player_id": player_id}, {"$set": {"name": username}})
    await record_visit({**(current or {}), "id": player_id}, request)
    logger.info("Account %s registered", username)
    return AccountSession(id=player_id, token=token, username=username)


@router.post("/login", response_model=AccountSession)
async def login(payload: Credentials, request: Request):
    ip = client_ip(request)
    if _rate_limited(f"login:{ip}"):
        raise HTTPException(429, "Too many attempts, try again later")
    player = await db.players.find_one({"username_lower": payload.username.strip().lower()})
    # Same error for unknown user and wrong password: do not reveal which usernames exist.
    if not player or not check_password(payload.password, player.get("password_hash", "")):
        raise HTTPException(401, "Invalid username or password")
    token = secrets.token_urlsafe(32)
    devices = (player.get("device_token_hashes") or [])[-(MAX_DEVICES - 1):] + [hash_token(token)]
    await db.players.update_one({"id": player["id"]}, {"$set": {"device_token_hashes": devices}})
    await record_visit(player, request)
    return AccountSession(id=player["id"], token=token, username=player["username"])


@router.post("/delete")
async def delete_account(payload: DeleteRequest, request: Request, player: dict = Depends(current_player)):
    if _rate_limited(f"delete:{client_ip(request)}"):
        raise HTTPException(429, "Too many attempts, try again later")
    # An account needs its password; an anonymous player (no username) only its token.
    # 403, not 401: a 401 makes the app re-register a fresh player and retry with it.
    if player.get("username") and not check_password(payload.password, player.get("password_hash", "")):
        raise HTTPException(403, "Wrong password")
    await erase_player(player)
    return {"deleted": True}


async def erase_player(player: dict) -> None:
    pid = player["id"]
    for name in ("scores", "saves", "activity", "suggestions"):
        await db[name].delete_many({"player_id": pid})
    # Random placeholder: sales stats still count distinct buyers, without any link to the player.
    await db.purchases.update_many({"player_id": pid}, {"$set": {"player_id": f"deleted-{uuid.uuid4()}"}})
    await db.players.delete_one({"id": pid})
    logger.info("Account %s deleted", player.get("username") or pid)


# ------------------------ Admin: player list ------------------------
PAGE_SIZE = 50
SORTS = {"last_seen": ("last_seen_at", -1), "created": ("created_at", -1), "sessions": ("sessions", -1), "name": ("username_lower", 1)}


class PlayerRow(BaseModel):
    id: str
    username: Optional[str] = None
    created_at: Optional[str] = None
    registered_at: Optional[str] = None
    last_seen_at: Optional[str] = None
    sessions: int = 0
    country: Optional[str] = None
    lang: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None
    best_score: Optional[int] = None
    best_level: Optional[int] = None
    kills: Optional[int] = None
    credits: Optional[int] = None
    unlocked_level: Optional[int] = None
    purchases: int = 0
    test_purchases: int = 0
    spent: List[dict] = []


class PlayerPage(BaseModel):
    items: List[PlayerRow]
    total: int
    page: int
    pages: int
    counts: dict


@admin.get("/players", response_model=PlayerPage)
async def list_players(
    q: str = Query(default="", max_length=64),
    kind: str = Query(default="all", pattern="^(all|account|guest)$"),
    sort: str = Query(default="last_seen", pattern="^(last_seen|created|sessions|name)$"),
    page: int = Query(default=1, ge=1),
):
    has_name = {"username": {"$type": "string"}}
    flt: dict = {}
    if kind == "account":
        flt.update(has_name)
    elif kind == "guest":
        flt["username"] = {"$not": {"$type": "string"}}
    if q.strip():
        needle = re.escape(q.strip().lower())
        flt["$or"] = [{"username_lower": {"$regex": needle}}, {"id": {"$regex": "^" + needle}}]

    total = await db.players.count_documents(flt)
    field, direction = SORTS[sort]
    rows = (
        await db.players.find(flt, {"_id": 0, "password_hash": 0, "token_hash": 0, "device_token_hashes": 0, "recovery_hash": 0})
        .sort([(field, direction), ("id", 1)])
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .to_list(PAGE_SIZE)
    )
    ids = [r["id"] for r in rows]
    scores = {s["player_id"]: s for s in await db.scores.find({"player_id": {"$in": ids}}, {"_id": 0}).to_list(None)}
    saves = {s["player_id"]: s.get("data") or {} for s in await db.saves.find({"player_id": {"$in": ids}}, {"_id": 0}).to_list(None)}
    bought: dict = {}
    for p in await db.purchases.find({"player_id": {"$in": ids}}, {"_id": 0, "player_id": 1, "is_test": 1, "price": 1, "currency": 1}).to_list(None):
        b = bought.setdefault(p["player_id"], {"purchases": 0, "test_purchases": 0, "spent": {}})
        if p.get("is_test"):
            b["test_purchases"] += 1
            continue
        b["purchases"] += 1
        if p.get("price") is not None and p.get("currency"):
            b["spent"][p["currency"]] = b["spent"].get(p["currency"], 0) + p["price"]

    def as_int(v):
        return int(v) if isinstance(v, (int, float)) else None

    items = []
    for r in rows:
        sc, sv, b = scores.get(r["id"], {}), saves.get(r["id"], {}), bought.get(r["id"], {})
        items.append(
            PlayerRow(
                **{k: r.get(k) for k in ("id", "username", "created_at", "registered_at", "last_seen_at", "country", "lang", "app_version", "platform")},
                sessions=r.get("sessions") or 0,
                best_score=as_int(sc.get("score")),
                best_level=as_int(sc.get("level")),
                kills=as_int(sc.get("kills")),
                credits=as_int(sv.get("credits")),
                unlocked_level=as_int(sv.get("unlockedLevel")),
                purchases=b.get("purchases", 0),
                test_purchases=b.get("test_purchases", 0),
                spent=[{"currency": c, "amount": round(a, 2)} for c, a in sorted(b.get("spent", {}).items(), key=lambda x: -x[1])],
            )
        )
    accounts_n = await db.players.count_documents(has_name)
    all_n = await db.players.count_documents({})
    return PlayerPage(
        items=items,
        total=total,
        page=page,
        pages=max(1, -(-total // PAGE_SIZE)),
        counts={"all": all_n, "account": accounts_n, "guest": all_n - accounts_n},
    )


@admin.delete("/players/{player_id}")
async def admin_delete_player(player_id: str):
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(404, "Unknown player")
    await erase_player(player)
    return {"deleted": player_id}


async def setup():
    await db.players.create_index("username_lower", unique=True, sparse=True)
    await db.players.create_index("last_seen_at")
    await db.players.create_index("created_at")
