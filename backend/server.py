"""Neon Strike API: anonymous players, online leaderboard, Google Play purchase verification."""
import hashlib
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

from play_verifier import PlayVerifier

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("neon")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# "google" (default) verifies every purchase with Google Play; "disabled" accepts them (local dev only).
PURCHASE_VERIFICATION = os.environ.get("PURCHASE_VERIFICATION", "google")
verifier = PlayVerifier(
    package_name=os.environ.get("GOOGLE_PLAY_PACKAGE", "com.aymenkssi.neonstrike"),
    service_account_file=os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE"),
)

# Must match frontend/src/iap/catalog.ts — the server is the authority on credits per product.
PRODUCT_CREDITS = {"coins_500": 500, "coins_1200": 1200, "coins_3500": 3500, "coins_8000": 8000}

MAX_LEVEL = 30
SCORE_COOLDOWN_S = 5

app = FastAPI(title="Neon Strike API")
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def clean_name(name: str) -> str:
    return "".join(ch for ch in name.strip() if ch.isprintable())[:16] or "PLAYER"


# ------------------------ Auth ------------------------
async def current_player(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing player token")
    player = await db.players.find_one({"token_hash": hash_token(authorization[7:].strip())})
    if not player:
        raise HTTPException(401, "Unknown player token")
    return player


# ------------------------ Models ------------------------
class PlayerCreate(BaseModel):
    name: str = Field(default="PLAYER", max_length=32)


class PlayerCreated(BaseModel):
    id: str
    token: str
    name: str


class ScoreCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=16)
    score: int = Field(..., ge=0)
    level: int = Field(default=1, ge=1, le=MAX_LEVEL)
    kills: int = Field(default=0, ge=0, le=5000)


class ScoreRow(BaseModel):
    id: str
    rank: int
    name: str
    score: int
    level: int
    kills: int
    created_at: str


class SubmitResult(BaseModel):
    rank: int
    best: int
    is_high_score: bool


class PurchaseVerify(BaseModel):
    product_id: str = Field(..., max_length=64)
    purchase_token: str = Field(..., min_length=10, max_length=4096)


class PurchaseResult(BaseModel):
    # "valid": paid and owned by this player; "pending": payment not cleared yet;
    # "invalid": not a real/owned purchase — never grant.
    status: str
    credits: int = 0
    is_test: bool = False


# ------------------------ Routes ------------------------
@api.get("/")
async def root():
    return {"message": "Neon Strike API online"}


@api.post("/players", response_model=PlayerCreated)
async def create_player(payload: PlayerCreate):
    token = secrets.token_urlsafe(32)
    player = {
        "id": str(uuid.uuid4()),
        "token_hash": hash_token(token),
        "name": clean_name(payload.name),
        "created_at": now_iso(),
        "last_score_at": 0.0,
    }
    await db.players.insert_one(player)
    return PlayerCreated(id=player["id"], token=token, name=player["name"])


def plausible(p: ScoreCreate) -> bool:
    # Engine: 100-150 points per kill, 1000 per boss (at most one per level played),
    # and the game-over screen can double the final score with a rewarded ad.
    return p.score <= 2 * (p.kills * 150 + p.level * 1000)


@api.post("/scores", response_model=SubmitResult)
async def submit_score(payload: ScoreCreate, player: dict = Depends(current_player)):
    if not plausible(payload):
        raise HTTPException(422, "Score rejected")
    now = time.time()
    if now - player.get("last_score_at", 0) < SCORE_COOLDOWN_S:
        raise HTTPException(429, "Too many submissions")
    name = clean_name(payload.name)
    await db.players.update_one({"id": player["id"]}, {"$set": {"last_score_at": now, "name": name}})

    # One row per player: keep the best run, always refresh the display name.
    prev = await db.scores.find_one({"player_id": player["id"]})
    is_high = prev is None or payload.score > prev["score"]
    update = {"$set": {"name": name}}
    if is_high:
        update["$set"].update(
            score=payload.score, level=payload.level, kills=payload.kills, created_at=now_iso()
        )
    doc = await db.scores.find_one_and_update(
        {"player_id": player["id"]},
        {**update, "$setOnInsert": {"id": str(uuid.uuid4()), "player_id": player["id"]}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    rank = await db.scores.count_documents({"score": {"$gt": payload.score}}) + 1
    return SubmitResult(rank=rank, best=doc["score"], is_high_score=is_high)


@api.get("/leaderboard", response_model=List[ScoreRow])
async def leaderboard(limit: int = 50):
    limit = max(1, min(limit, 100))
    rows = await db.scores.find({}, {"_id": 0, "player_id": 0}).sort("score", -1).limit(limit).to_list(limit)
    return [ScoreRow(rank=i + 1, **r) for i, r in enumerate(rows)]


@api.get("/leaderboard/me", response_model=Optional[ScoreRow])
async def my_rank(player: dict = Depends(current_player)):
    doc = await db.scores.find_one({"player_id": player["id"]}, {"_id": 0, "player_id": 0})
    if not doc:
        return None
    rank = await db.scores.count_documents({"score": {"$gt": doc["score"]}}) + 1
    return ScoreRow(rank=rank, **doc)


@api.post("/purchases/verify", response_model=PurchaseResult)
async def verify_purchase(payload: PurchaseVerify, player: dict = Depends(current_player)):
    credits = PRODUCT_CREDITS.get(payload.product_id)
    if credits is None:
        raise HTTPException(422, "Unknown product")
    token_hash = hash_token(payload.purchase_token)

    # A purchase token belongs to the first player who redeemed it.
    existing = await db.purchases.find_one({"token_hash": token_hash})
    if existing:
        if existing["player_id"] != player["id"] or existing["product_id"] != payload.product_id:
            logger.warning("Purchase token reuse blocked for player %s", player["id"])
            return PurchaseResult(status="invalid")
        return PurchaseResult(status="valid", credits=credits, is_test=existing.get("is_test", False))

    if PURCHASE_VERIFICATION == "disabled":
        logger.warning("PURCHASE_VERIFICATION=disabled: accepting %s without Google check", payload.product_id)
        state, order_id, is_test = "purchased", None, True
    else:
        if not verifier.configured:
            raise HTTPException(503, "Purchase verification not configured")
        try:
            result = await verifier.verify_product(payload.product_id, payload.purchase_token)
        except Exception:
            logger.exception("Google Play verification failed")
            raise HTTPException(502, "Google Play unavailable")
        state, order_id, is_test = result.state, result.order_id, result.is_test

    if state == "pending":
        return PurchaseResult(status="pending")
    if state != "purchased":
        return PurchaseResult(status="invalid")

    try:
        await db.purchases.insert_one(
            {
                "token_hash": token_hash,
                "player_id": player["id"],
                "product_id": payload.product_id,
                "credits": credits,
                "order_id": order_id,
                "is_test": is_test,
                "created_at": now_iso(),
            }
        )
    except DuplicateKeyError:
        # Two concurrent requests with the same token: re-check ownership.
        return await verify_purchase(payload, player)
    logger.info("Purchase %s verified for player %s (test=%s)", payload.product_id, player["id"], is_test)
    return PurchaseResult(status="valid", credits=credits, is_test=is_test)


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
async def create_indexes():
    await db.players.create_index("id", unique=True)
    await db.players.create_index("token_hash", unique=True)
    await db.scores.create_index("player_id", unique=True)
    await db.scores.create_index([("score", -1)])
    await db.purchases.create_index("token_hash", unique=True)
    if PURCHASE_VERIFICATION != "google":
        logger.warning("Purchase verification is %s — never use this in production", PURCHASE_VERIFICATION)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
