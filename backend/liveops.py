"""Live operations managed from the admin page: coin packs and messages to players.

The euro price of a pack is set in Play Console (Google charges it and the app displays
Google's localized price). What the server controls is everything else: credits granted,
visibility, order and the labels shown in the shop.
"""
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi import Path as PathParam
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from database import db

# Seeded once into an empty database; afterwards the admin page is the source of truth.
DEFAULT_PACKS = [
    {"sku": "coins_500", "credits": 500, "bonus": None, "tag": None, "sort": 10, "active": True},
    {"sku": "coins_1200", "credits": 1200, "bonus": "+20 %", "tag": None, "sort": 20, "active": True},
    {"sku": "coins_3500", "credits": 3500, "bonus": "+40 %", "tag": "POPULAIRE", "tag_en": "POPULAR", "sort": 30, "active": True},
    {"sku": "coins_8000", "credits": 8000, "bonus": "+60 %", "tag": "MEILLEURE OFFRE", "tag_en": "BEST VALUE", "sort": 40, "active": True},
]

# Play Console product ID rules: lowercase letters, digits, "_" and ".", starting with a letter or digit.
SKU_PATTERN = r"^[a-z0-9][a-z0-9_.]{0,63}$"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(d: Optional[datetime]) -> Optional[datetime]:
    if d is None:
        return None
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)


# ------------------------ Admin auth ------------------------
async def require_admin(authorization: Optional[str] = Header(default=None)) -> None:
    expected = os.environ.get("ADMIN_TOKEN", "")
    if len(expected) < 16:
        raise HTTPException(503, "Admin disabled: set ADMIN_TOKEN (16+ characters)")
    given = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    if not secrets.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(401, "Invalid admin token")


# ------------------------ Models ------------------------
class PackIn(BaseModel):
    credits: int = Field(..., ge=1, le=1_000_000)
    bonus: Optional[str] = Field(default=None, max_length=24)
    tag: Optional[str] = Field(default=None, max_length=24)
    tag_en: Optional[str] = Field(default=None, max_length=24)  # shown to English players (else tag)
    sort: int = Field(default=100, ge=0, le=10_000)
    active: bool = True


class Pack(PackIn):
    sku: str


class MessageIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=1, max_length=1000)
    kind: Literal["info", "promo", "warning"] = "info"
    # Optional English version, shown to players who play in English (else the French text).
    title_en: Optional[str] = Field(default=None, max_length=80)
    body_en: Optional[str] = Field(default=None, max_length=1000)
    active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class Message(MessageIn):
    id: str
    created_at: datetime


class PublicMessage(BaseModel):
    id: str
    title: str
    body: str
    title_en: Optional[str] = None
    body_en: Optional[str] = None
    kind: str


class RemoteConfig(BaseModel):
    packs: List[Pack]
    messages: List[PublicMessage]


# ------------------------ Helpers ------------------------
def clean_label(v: Optional[str]) -> Optional[str]:
    v = (v or "").strip()
    return v or None


async def pack_credits(sku: str) -> Optional[int]:
    # Inactive packs still count: a purchase started before the pack was hidden stays valid.
    doc = await db.packs.find_one({"sku": sku})
    return int(doc["credits"]) if doc else None


def message_is_live(m: dict, now: datetime) -> bool:
    starts, ends = as_utc(m.get("starts_at")), as_utc(m.get("ends_at"))
    return m.get("active", False) and (starts is None or starts <= now) and (ends is None or ends > now)


async def setup():
    await db.packs.create_index("sku", unique=True)
    await db.messages.create_index("id", unique=True)
    if await db.packs.count_documents({}) == 0:
        await db.packs.insert_many([dict(p) for p in DEFAULT_PACKS])


# ------------------------ Public ------------------------
public = APIRouter(prefix="/api")


@public.get("/config", response_model=RemoteConfig)
async def remote_config():
    """Everything the app needs at startup: shop packs and live messages."""
    packs = await db.packs.find({"active": True}, {"_id": 0}).sort("sort", 1).to_list(50)
    now = utcnow()
    msgs = await db.messages.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    live = [PublicMessage(**m) for m in msgs if message_is_live(m, now)][:5]
    return RemoteConfig(packs=[Pack(**p) for p in packs], messages=live)


# ------------------------ Admin API ------------------------
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@admin.get("/packs", response_model=List[Pack])
async def list_packs():
    return [Pack(**p) for p in await db.packs.find({}, {"_id": 0}).sort("sort", 1).to_list(100)]


@admin.put("/packs/{sku}", response_model=Pack)
async def upsert_pack(payload: PackIn, sku: str = PathParam(..., pattern=SKU_PATTERN)):
    data = payload.model_dump()
    data["bonus"], data["tag"], data["tag_en"] = clean_label(data["bonus"]), clean_label(data["tag"]), clean_label(data["tag_en"])
    await db.packs.update_one({"sku": sku}, {"$set": data}, upsert=True)
    return Pack(sku=sku, **data)


@admin.delete("/packs/{sku}")
async def delete_pack(sku: str):
    if await db.purchases.count_documents({"product_id": sku}) > 0:
        raise HTTPException(409, "Pack already sold: deactivate it instead")
    res = await db.packs.delete_one({"sku": sku})
    if res.deleted_count == 0:
        raise HTTPException(404, "Unknown pack")
    return {"deleted": sku}


@admin.get("/messages", response_model=List[Message])
async def list_messages():
    return [Message(**m) for m in await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)]


def validate_window(payload: MessageIn):
    s, e = as_utc(payload.starts_at), as_utc(payload.ends_at)
    if s and e and e <= s:
        raise HTTPException(422, "ends_at must be after starts_at")
    return s, e


@admin.post("/messages", response_model=Message)
async def create_message(payload: MessageIn):
    s, e = validate_window(payload)
    doc = {**payload.model_dump(), "starts_at": s, "ends_at": e, "id": str(uuid.uuid4()), "created_at": utcnow()}
    await db.messages.insert_one(dict(doc))
    return Message(**doc)


@admin.put("/messages/{message_id}", response_model=Message)
async def update_message(message_id: str, payload: MessageIn):
    s, e = validate_window(payload)
    data = {**payload.model_dump(), "starts_at": s, "ends_at": e}
    doc = await db.messages.find_one_and_update(
        {"id": message_id}, {"$set": data}, projection={"_id": 0}, return_document=ReturnDocument.AFTER
    )
    if not doc:
        raise HTTPException(404, "Unknown message")
    return Message(**doc)


@admin.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    res = await db.messages.delete_one({"id": message_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Unknown message")
    return {"deleted": message_id}


# ------------------------ Admin page ------------------------
admin_page = APIRouter()
ADMIN_HTML = Path(__file__).parent / "admin.html"


@admin_page.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin_ui():
    return HTMLResponse(ADMIN_HTML.read_text(encoding="utf-8"), headers={"Cache-Control": "no-store", "X-Frame-Options": "DENY"})
