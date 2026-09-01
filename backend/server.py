from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Neon Protocol API")
api_router = APIRouter(prefix="/api")


# ------------------------ Models ------------------------
class ScoreCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=16)
    score: int = Field(..., ge=0)
    wave: int = Field(default=1, ge=1)
    kills: int = Field(default=0, ge=0)


class Score(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    score: int
    wave: int = 1
    kills: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ScoreWithRank(Score):
    rank: int


class SubmitResult(BaseModel):
    entry: Score
    rank: int
    is_high_score: bool


# ------------------------ Routes ------------------------
@api_router.get("/")
async def root():
    return {"message": "Neon Protocol API online"}


@api_router.post("/scores", response_model=SubmitResult)
async def submit_score(payload: ScoreCreate):
    name = payload.name.strip()[:16] or "PLAYER"
    entry = Score(name=name, score=payload.score, wave=payload.wave, kills=payload.kills)
    await db.scores.insert_one(entry.model_dump())

    # rank = number of scores strictly greater + 1
    higher = await db.scores.count_documents({"score": {"$gt": entry.score}})
    rank = higher + 1

    # personal best check for this name
    best = await db.scores.find_one(
        {"name": name}, sort=[("score", -1)]
    )
    is_high_score = best is None or entry.score >= int(best.get("score", 0))

    return SubmitResult(entry=entry, rank=rank, is_high_score=is_high_score)


@api_router.get("/leaderboard", response_model=List[ScoreWithRank])
async def leaderboard(limit: int = 50):
    limit = max(1, min(limit, 100))
    cursor = db.scores.find({}, {"_id": 0}).sort("score", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    out: List[ScoreWithRank] = []
    for i, r in enumerate(rows):
        out.append(ScoreWithRank(rank=i + 1, **r))
    return out


@api_router.get("/leaderboard/best", response_model=Optional[Score])
async def personal_best(name: str):
    doc = await db.scores.find_one({"name": name.strip()[:16]}, {"_id": 0}, sort=[("score", -1)])
    if not doc:
        return None
    return Score(**doc)


# Placeholder for rewarded-ad server-side verification hook (revive reward)
class AdReward(BaseModel):
    name: str
    reward_type: str = "revive"


@api_router.post("/rewards/ad")
async def reward_ad(payload: AdReward):
    # In production, verify AdMob SSV before granting. Here we just acknowledge.
    return {"granted": True, "reward_type": payload.reward_type}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
