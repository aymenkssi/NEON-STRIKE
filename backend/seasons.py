"""Monthly seasons: a leaderboard that restarts every month (UTC), with in-game rewards.

- Every accepted score also counts for the current season (best run of the month per player).
- When a month ends, the admin checks the top of the ranking (and can exclude a suspicious
  score), then validates: rewards are created for the top 100 and the top 5 get a badge and the
  exclusive "Champion" skin. Without the admin, a season is validated automatically
  AUTO_VALIDATE_DAYS days after its end.
- Players collect their rewards from the app (credits and skin are added to their save).

Public:  GET  /api/seasons/current · GET /api/seasons/me · POST /api/seasons/rewards/{id}/claim
Admin:   GET  /api/admin/seasons · PUT /api/admin/seasons/{season}/players/{id}
         POST /api/admin/seasons/{season}/validate
"""
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Path as PathParam
from pydantic import BaseModel

from auth import current_player
from database import db
from liveops import require_admin

public = APIRouter(prefix="/api/seasons")
admin = APIRouter(prefix="/api/admin/seasons", dependencies=[Depends(require_admin)])

SEASON_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
AUTO_VALIDATE_DAYS = 3
CHAMPION_SKIN = "w_champion"
BADGE_RANKS = 5
# (first rank, last rank, credits, champion reward: skin + badge)
REWARDS = [
    (1, 1, 5000, True),
    (2, 2, 3000, True),
    (3, 3, 2000, True),
    (4, 5, 1000, True),
    (6, 20, 500, False),
    (21, 100, 200, False),
]
REWARDED = REWARDS[-1][1]


def season_of(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return f"{dt.year:04d}-{dt.month:02d}"


def bounds(season: str):
    y, m = map(int, season.split("-"))
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc)
    return start, end


def previous(season: str) -> str:
    start, _ = bounds(season)
    return season_of(start - timedelta(days=1))


def reward_for(rank: int):
    for lo, hi, credits, champion in REWARDS:
        if lo <= rank <= hi:
            return credits, champion
    return None


# ------------------------ Scores ------------------------
async def record(player: dict, score: int, level: int, kills: int) -> None:
    """Keeps the player's best run of the current season (called by POST /api/scores)."""
    season = season_of()
    now = datetime.now(timezone.utc).isoformat()
    key = {"season": season, "player_id": player["id"]}
    await db.season_scores.update_one(
        key, {"$set": {"name": player["username"]}, "$setOnInsert": {**key, "score": -1, "excluded": False}}, upsert=True
    )
    await db.season_scores.update_one(
        {**key, "score": {"$lt": score}}, {"$set": {"score": score, "level": level, "kills": kills, "updated_at": now}}
    )


async def ranking(season: str, limit: int, with_excluded: bool = False) -> List[dict]:
    flt: dict = {"season": season, "score": {"$gte": 0}}
    if not with_excluded:
        flt["excluded"] = {"$ne": True}
    rows = await db.season_scores.find(flt, {"_id": 0}).sort([("score", -1), ("updated_at", 1)]).limit(limit).to_list(limit)
    rank = 0
    for r in rows:
        if not r.get("excluded"):
            rank += 1
            r["rank"] = rank
        else:
            r["rank"] = None
    return rows


async def badge_ranks(player_ids: List[str]) -> Dict[str, int]:
    """Best season rank (1-5) of each player, for the trophy next to their name."""
    out: Dict[str, int] = {}
    async for p in db.players.find({"id": {"$in": player_ids}, "badges": {"$exists": True}}, {"id": 1, "badges": 1}):
        ranks = [b.get("rank", 99) for b in p.get("badges") or []]
        if ranks:
            out[p["id"]] = min(ranks)
    return out


# ------------------------ Validation ------------------------
async def validate(season: str, by: str) -> dict:
    if season >= season_of():
        raise HTTPException(409, "Season not finished")
    if await db.seasons.find_one({"season": season}):
        raise HTTPException(409, "Season already validated")
    rows = [r for r in await ranking(season, REWARDED) if r["rank"]]
    now = datetime.now(timezone.utc).isoformat()
    rewards = []
    for r in rows:
        credits, champion = reward_for(r["rank"])
        rewards.append(
            {
                "id": str(uuid.uuid4()),
                "season": season,
                "player_id": r["player_id"],
                "name": r["name"],
                "rank": r["rank"],
                "score": r["score"],
                "credits": credits,
                "skin": CHAMPION_SKIN if champion else None,
                "badge": champion,
                "claimed": False,
                "created_at": now,
            }
        )
        if champion:
            await db.players.update_one({"id": r["player_id"]}, {"$push": {"badges": {"season": season, "rank": r["rank"]}}})
    if rewards:
        await db.season_rewards.insert_many([dict(x) for x in rewards])
    doc = {
        "season": season,
        "validated_at": now,
        "validated_by": by,
        "players": len(rows),
        "champions": [{k: r[k] for k in ("rank", "name", "score", "level", "kills", "player_id")} for r in rows[:BADGE_RANKS]],
    }
    try:
        await db.seasons.insert_one(dict(doc))
    except Exception as e:  # two validations at the same instant (admin + automatic)
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "Season already validated")
        raise
    return doc


_last_auto = 0.0


async def auto_validate(force: bool = False) -> None:
    """Validates the finished seasons still unchecked AUTO_VALIDATE_DAYS days after their end."""
    global _last_auto
    if not force and time.time() - _last_auto < 600:
        return
    _last_auto = time.time()
    now = datetime.now(timezone.utc)
    done = set(await db.seasons.distinct("season"))
    for season in await db.season_scores.distinct("season"):
        _, end = bounds(season)
        if season not in done and now >= end + timedelta(days=AUTO_VALIDATE_DAYS):
            try:
                await validate(season, "auto")
            except HTTPException:
                pass


# ------------------------ Public ------------------------
class SeasonRow(BaseModel):
    rank: int
    name: str
    score: int
    level: int = 1
    kills: int = 0
    badge: Optional[int] = None


class Tier(BaseModel):
    first: int
    last: int
    credits: int
    champion: bool


class SeasonInfo(BaseModel):
    season: str
    starts_at: str
    ends_at: str
    top: List[SeasonRow]
    rewards: List[Tier]


def row(r: dict, badges: Dict[str, int]) -> SeasonRow:
    return SeasonRow(rank=r["rank"], name=r["name"], score=r["score"], level=r.get("level", 1), kills=r.get("kills", 0), badge=badges.get(r["player_id"]))


@public.get("/current", response_model=SeasonInfo)
async def current(limit: int = 50):
    await auto_validate()
    season = season_of()
    start, end = bounds(season)
    rows = await ranking(season, max(1, min(limit, 100)))
    badges = await badge_ranks([r["player_id"] for r in rows])
    return SeasonInfo(
        season=season,
        starts_at=start.isoformat(),
        ends_at=end.isoformat(),
        top=[row(r, badges) for r in rows],
        rewards=[Tier(first=a, last=b, credits=c, champion=ch) for a, b, c, ch in REWARDS],
    )


class Reward(BaseModel):
    id: str
    season: str
    rank: int
    credits: int
    skin: Optional[str] = None
    badge: bool = False


class MySeason(BaseModel):
    season: str
    rank: Optional[int] = None
    score: Optional[int] = None
    excluded: bool = False
    rewards: List[Reward]


@public.get("/me", response_model=MySeason)
async def me(player: dict = Depends(current_player)):
    await auto_validate()
    season = season_of()
    mine = await db.season_scores.find_one({"season": season, "player_id": player["id"], "score": {"$gte": 0}})
    rank = None
    if mine and not mine.get("excluded"):
        rank = await db.season_scores.count_documents({"season": season, "excluded": {"$ne": True}, "score": {"$gt": mine["score"]}}) + 1
    pending = await db.season_rewards.find({"player_id": player["id"], "claimed": False}, {"_id": 0}).sort("season", 1).to_list(24)
    return MySeason(
        season=season,
        rank=rank,
        score=mine["score"] if mine else None,
        excluded=bool(mine and mine.get("excluded")),
        rewards=[Reward(**r) for r in pending],
    )


@public.post("/rewards/{reward_id}/claim", response_model=Reward)
async def claim(reward_id: str, player: dict = Depends(current_player)):
    doc = await db.season_rewards.find_one_and_update(
        {"id": reward_id, "player_id": player["id"], "claimed": False},
        {"$set": {"claimed": True, "claimed_at": datetime.now(timezone.utc).isoformat()}},
        projection={"_id": 0},
    )
    if not doc:
        raise HTTPException(404, "Unknown or already claimed reward")
    return Reward(**doc)


# ------------------------ Admin ------------------------
class Exclude(BaseModel):
    excluded: bool


async def admin_rows(season: str) -> List[dict]:
    rows = await ranking(season, 30, with_excluded=True)
    for r in rows:
        r.pop("season", None)
    return rows


@admin.get("")
async def overview():
    await auto_validate()
    season = season_of()
    _, end = bounds(season)
    # Every finished season with scores that was not validated yet (most recent first).
    done = set(await db.seasons.distinct("season"))
    finished = sorted({x for x in await db.season_scores.distinct("season") if x < season and x not in done}, reverse=True)
    pending = []
    for s in finished[:6]:
        _, e = bounds(s)
        pending.append({"season": s, "auto_at": (e + timedelta(days=AUTO_VALIDATE_DAYS)).isoformat(), "top": await admin_rows(s)})
    history = await db.seasons.find({}, {"_id": 0}).sort("season", -1).to_list(36)
    for h in history:
        h["claimed"] = await db.season_rewards.count_documents({"season": h["season"], "claimed": True})
    return {
        "current": {"season": season, "ends_at": end.isoformat(), "top": await admin_rows(season)},
        "pending": pending,
        "history": history,
        "rewards": [{"first": a, "last": b, "credits": c, "champion": ch} for a, b, c, ch in REWARDS],
    }


@admin.put("/{season}/players/{player_id}")
async def set_excluded(payload: Exclude, player_id: str, season: str = PathParam(..., pattern=SEASON_PATTERN)):
    if await db.seasons.find_one({"season": season}):
        raise HTTPException(409, "Season already validated")
    res = await db.season_scores.update_one({"season": season, "player_id": player_id}, {"$set": {"excluded": payload.excluded}})
    if res.matched_count == 0:
        raise HTTPException(404, "No score for this player in this season")
    return {"season": season, "player_id": player_id, "excluded": payload.excluded}


@admin.post("/{season}/validate")
async def validate_now(season: str = PathParam(..., pattern=SEASON_PATTERN)):
    return await validate(season, "admin")


async def setup():
    await db.season_scores.create_index([("season", 1), ("player_id", 1)], unique=True)
    await db.season_scores.create_index([("season", 1), ("score", -1)])
    await db.season_rewards.create_index([("player_id", 1), ("claimed", 1)])
    await db.seasons.create_index("season", unique=True)
