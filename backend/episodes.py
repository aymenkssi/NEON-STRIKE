"""Story episodes published from the admin page, without an app update.

After the 5 acts of the story, a new episode can come out every season: comic pages before and
after, radio lines, a story boss and a reward. The admin writes it (French, English optional),
chooses the level it is played on (city and difficulty) and publishes it, now or at a date.
The app reads the published episodes from GET /api/config (field "episodes").

Admin:  GET /api/admin/episodes · POST /api/admin/episodes · PUT/DELETE /api/admin/episodes/{id}
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from database import db
from liveops import as_utc, require_admin, utcnow

admin = APIRouter(prefix="/api/admin/episodes", dependencies=[Depends(require_admin)])

MAX_LEVEL = 30
# Pictures the app can draw for a comic page (see frontend/src/game/story.ts: episodeArt).
SCENES = ["lab", "leak", "radio", "tower", "badge", "skyline", "crates", "neon", "servers", "satellite", "desert", "signal"]
HEROES = ["o_soldier", "o_commando", "o_ninja", "o_astronaut", "o_cyber", "o_royal"]
BOSS_LOOKS = ["boss", "guardian", "spitterking", "commander", "queen", "founder"]
ARTS = SCENES + [f"hero:{h}" for h in HEROES] + [f"boss:{b}" for b in BOSS_LOOKS] + ["team", "horde"]
SPEAKERS = ["narrator", "max", "radio", "rex", "kira", "zed", "nova", "leo", "doc", "guardian", "commander", "queen", "founder"]
SKIN_PATTERN = r"^[wo]_[a-z0-9_]{1,30}$"


def pick(value: str, allowed: List[str], what: str) -> str:
    if value not in allowed:
        raise ValueError(f"{what} inconnu : {value}")
    return value


class PanelIn(BaseModel):
    art: str
    who: str = "narrator"
    text_fr: str = Field(min_length=1, max_length=400)
    text_en: str = Field(default="", max_length=400)

    @field_validator("art")
    @classmethod
    def _art(cls, v: str) -> str:
        return pick(v, ARTS, "Image")

    @field_validator("who")
    @classmethod
    def _who(cls, v: str) -> str:
        return pick(v, SPEAKERS, "Personnage")


class EpisodeIn(BaseModel):
    title_fr: str = Field(min_length=1, max_length=60)
    title_en: str = Field(default="", max_length=60)
    tagline_fr: str = Field(default="", max_length=200)
    tagline_en: str = Field(default="", max_length=200)
    level: int = Field(ge=1, le=MAX_LEVEL)  # city and difficulty of the level played
    boss_look: str = "boss"
    boss_name_fr: str = Field(default="", max_length=40)
    boss_name_en: str = Field(default="", max_length=40)
    boss_hp: float = Field(default=1.5, ge=1, le=4)
    radio_start_who: str = "radio"
    radio_start_fr: str = Field(default="", max_length=200)
    radio_start_en: str = Field(default="", max_length=200)
    radio_boss_who: str = "radio"
    radio_boss_fr: str = Field(default="", max_length=200)
    radio_boss_en: str = Field(default="", max_length=200)
    intro: List[PanelIn] = Field(min_length=1, max_length=8)
    outro: List[PanelIn] = Field(default_factory=list, max_length=8)
    reward_credits: int = Field(default=500, ge=0, le=20000)
    reward_skin: Optional[str] = Field(default=None, pattern=SKIN_PATTERN)
    published: bool = False
    starts_at: Optional[datetime] = None  # published episodes appear from this date (now if empty)

    @field_validator("boss_look")
    @classmethod
    def _look(cls, v: str) -> str:
        return pick(v, BOSS_LOOKS, "Boss")

    @field_validator("radio_start_who", "radio_boss_who")
    @classmethod
    def _speaker(cls, v: str) -> str:
        return pick(v, SPEAKERS, "Personnage")

    @field_validator("reward_skin", mode="before")
    @classmethod
    def _skin(cls, v):
        return v or None


class Episode(EpisodeIn):
    id: str
    number: int
    created_at: datetime
    updated_at: datetime


def is_live(e: dict, now: datetime) -> bool:
    starts = as_utc(e.get("starts_at"))
    return bool(e.get("published")) and (starts is None or starts <= now)


async def setup():
    await db.episodes.create_index("id", unique=True)


async def live_episodes() -> List[Episode]:
    """Published episodes already out, newest first (read by the app in /api/config)."""
    now = utcnow()
    docs = await db.episodes.find({"published": True}, {"_id": 0}).sort("number", -1).to_list(100)
    return [Episode(**d) for d in docs if is_live(d, now)][:24]


@admin.get("", response_model=List[Episode])
async def list_episodes():
    return [Episode(**d) for d in await db.episodes.find({}, {"_id": 0}).sort("number", -1).to_list(200)]


@admin.post("", response_model=Episode)
async def create_episode(payload: EpisodeIn):
    last = await db.episodes.find({}, {"number": 1}).sort("number", -1).to_list(1)
    now = datetime.now(timezone.utc)
    doc = {**payload.model_dump(), "id": uuid.uuid4().hex, "number": (last[0]["number"] + 1) if last else 1, "created_at": now, "updated_at": now}
    await db.episodes.insert_one(dict(doc))
    return Episode(**doc)


@admin.put("/{episode_id}", response_model=Episode)
async def update_episode(episode_id: str, payload: EpisodeIn):
    doc = await db.episodes.find_one({"id": episode_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Épisode introuvable")
    doc.update(payload.model_dump(), updated_at=datetime.now(timezone.utc))
    await db.episodes.replace_one({"id": episode_id}, doc)
    return Episode(**doc)


@admin.delete("/{episode_id}")
async def delete_episode(episode_id: str):
    r = await db.episodes.delete_one({"id": episode_id})
    if not r.deleted_count:
        raise HTTPException(404, "Épisode introuvable")
    return {"ok": True}
