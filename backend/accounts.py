"""Player accounts: a unique username + password on top of the anonymous player.

- POST /api/accounts/register : turns the caller's anonymous player into an account (keeps its
  scores, purchases and save), or creates a new player when called without a token.
- POST /api/accounts/login    : returns a new device token for an existing account.
- GET  /api/accounts/available: live check while typing a username.
- POST /api/accounts/delete   : deletes the caller's account and its data (password required);
  purchases are kept for accounting but detached from the player.

Passwords are stored as salted scrypt hashes (hashlib, no extra dependency).
"""
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from auth import current_player, find_player_by_token, hash_token
from cloudsave import MAX_DEVICES, _rate_limited
from database import db
from stats import client_ip, record_visit

logger = logging.getLogger("neon.accounts")
router = APIRouter(prefix="/api/accounts")

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
    pid = player["id"]
    for name in ("scores", "saves", "activity", "suggestions"):
        await db[name].delete_many({"player_id": pid})
    # Random placeholder: sales stats still count distinct buyers, without any link to the player.
    await db.purchases.update_many({"player_id": pid}, {"$set": {"player_id": f"deleted-{uuid.uuid4()}"}})
    await db.players.delete_one({"id": pid})
    logger.info("Account %s deleted", player.get("username") or pid)
    return {"deleted": True}


async def setup():
    await db.players.create_index("username_lower", unique=True, sparse=True)
