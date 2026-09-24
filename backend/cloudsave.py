"""Online save + recovery code, so a player can get their progress back on another phone.

- PUT/GET /api/save            : the app's progress blob (last write wins, by client timestamp)
- POST /api/players/recovery-code : issues a new code (only its hash is stored; the old one stops working)
- POST /api/players/recover     : exchanges a code for a new device token on the same player
"""
import json
import logging
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import current_player, hash_token
from database import db
from stats import client_ip

logger = logging.getLogger("neon.cloudsave")
router = APIRouter(prefix="/api")

MAX_SAVE_BYTES = 48_000
# No 0/O/1/I: codes are read and typed by humans.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 12
MAX_DEVICES = 10
RECOVER_LIMIT = (10, 600)  # attempts per IP per window (seconds)
_attempts: Dict[str, deque] = defaultdict(deque)


class SaveIn(BaseModel):
    data: Dict[str, Any]
    updated_at: int = Field(..., ge=0)  # client time in ms of the last local change


class SaveOut(BaseModel):
    data: Dict[str, Any]
    updated_at: int


class SaveResult(BaseModel):
    stored: bool  # False when the server already holds a newer save
    updated_at: int


class RecoveryCode(BaseModel):
    code: str


class RecoverIn(BaseModel):
    code: str = Field(..., min_length=8, max_length=32)


class Recovered(BaseModel):
    id: str
    token: str
    name: str


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch in CODE_ALPHABET)


def format_code(raw: str) -> str:
    return "-".join(raw[i : i + 4] for i in range(0, len(raw), 4))


@router.get("/save", response_model=Optional[SaveOut])
async def get_save(player: dict = Depends(current_player)):
    doc = await db.saves.find_one({"player_id": player["id"]}, {"_id": 0})
    return SaveOut(data=doc["data"], updated_at=doc["updated_at"]) if doc else None


@router.put("/save", response_model=SaveResult)
async def put_save(payload: SaveIn, player: dict = Depends(current_player)):
    if len(json.dumps(payload.data)) > MAX_SAVE_BYTES:
        raise HTTPException(413, "Save too large")
    current = await db.saves.find_one({"player_id": player["id"]}, {"updated_at": 1})
    if current and current["updated_at"] > payload.updated_at:
        return SaveResult(stored=False, updated_at=current["updated_at"])
    await db.saves.update_one(
        {"player_id": player["id"]},
        {"$set": {"data": payload.data, "updated_at": payload.updated_at, "server_time": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return SaveResult(stored=True, updated_at=payload.updated_at)


@router.post("/players/recovery-code", response_model=RecoveryCode)
async def new_recovery_code(player: dict = Depends(current_player)):
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    await db.players.update_one({"id": player["id"]}, {"$set": {"recovery_hash": hash_token(raw)}})
    return RecoveryCode(code=format_code(raw))


def _rate_limited(ip: str) -> bool:
    limit, window = RECOVER_LIMIT
    q = _attempts[ip]
    now = time.time()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


@router.post("/players/recover", response_model=Recovered)
async def recover(payload: RecoverIn, request: Request):
    ip = client_ip(request)
    if _rate_limited(ip):
        raise HTTPException(429, "Too many attempts, try again later")
    raw = normalize_code(payload.code)
    if len(raw) != CODE_LENGTH:
        raise HTTPException(404, "Unknown code")
    player = await db.players.find_one({"recovery_hash": hash_token(raw)})
    if not player:
        raise HTTPException(404, "Unknown code")
    token = secrets.token_urlsafe(32)
    devices = (player.get("device_token_hashes") or [])[-(MAX_DEVICES - 1):] + [hash_token(token)]
    await db.players.update_one({"id": player["id"]}, {"$set": {"device_token_hashes": devices}})
    logger.info("Player %s recovered on a new device", player["id"])
    return Recovered(id=player["id"], token=token, name=player.get("name", "PLAYER"))


async def setup():
    await db.saves.create_index("player_id", unique=True)
    await db.players.create_index("recovery_hash", sparse=True)
    await db.players.create_index("device_token_hashes")
