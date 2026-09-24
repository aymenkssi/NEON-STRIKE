"""Anonymous player authentication: a secret token per device, only its SHA-256 is stored."""
import hashlib
from typing import Optional

from fastapi import Header, HTTPException

from database import db


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def find_player_by_token(token: str) -> Optional[dict]:
    h = hash_token(token)
    # token_hash: device that created the player; device_token_hashes: devices added with a recovery code.
    return await db.players.find_one({"$or": [{"token_hash": h}, {"device_token_hashes": h}]})


async def current_player(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing player token")
    player = await find_player_by_token(authorization[7:].strip())
    if not player:
        raise HTTPException(401, "Unknown player token")
    return player
