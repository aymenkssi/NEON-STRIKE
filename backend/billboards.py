"""Advertising posters on the building facades of the game (3 slots in every level).

The admin uploads an image (resized to 1024x512 by the admin page) and chooses where it shows:
slot 1 (north facade of the square), 2 (east), 3 (west) or all three, and for which levels. The
app downloads the live posters when it opens (GET /api/config, field "billboards") and puts them
on the facades; a slot without a poster keeps its normal facade. Each level played counts one
view per poster shown (POST /api/billboards/views), shown in the admin page.

Public:  GET /api/billboards/{id}-{version}.jpg · POST /api/billboards/views
Admin:   GET/POST /api/admin/billboards · PUT/DELETE /api/admin/billboards/{id}
"""
import base64
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator

from database import db
from liveops import as_utc, require_admin, utcnow

public = APIRouter(prefix="/api/billboards")
admin = APIRouter(prefix="/api/admin/billboards", dependencies=[Depends(require_admin)])

MAX_LEVEL = 30
SLOTS = 3
MAX_IMAGE_BYTES = 1_500_000
DATA_URL = re.compile(r"^data:image/(jpeg|png);base64,([A-Za-z0-9+/=\s]+)$")
MAGIC = {"jpeg": b"\xff\xd8\xff", "png": b"\x89PNG\r\n\x1a\n"}


def decode_image(data_url: str):
    m = DATA_URL.match(data_url or "")
    if not m:
        raise HTTPException(422, "Image invalide (JPEG ou PNG attendu).")
    kind = m.group(1)
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception:
        raise HTTPException(422, "Image illisible.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image trop lourde (1,5 Mo au plus).")
    if not raw.startswith(MAGIC[kind]):
        raise HTTPException(422, "Le fichier n'est pas une image JPEG ou PNG.")
    return kind, raw


class BillboardIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)  # advertiser / campaign
    slot: int = Field(default=0, ge=0, le=SLOTS)  # 0 = the 3 slots
    level_from: int = Field(default=1, ge=1, le=MAX_LEVEL)
    level_to: int = Field(default=MAX_LEVEL, ge=1, le=MAX_LEVEL)
    active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    image: Optional[str] = None  # data URL; required to create, optional to update

    @model_validator(mode="after")
    def _ranges(self):
        if self.level_from > self.level_to:
            raise ValueError("Le premier niveau doit être avant le dernier.")
        if self.starts_at and self.ends_at and as_utc(self.ends_at) <= as_utc(self.starts_at):
            raise ValueError("La fin doit être après le début.")
        return self


class Billboard(BaseModel):
    id: str
    name: str
    slot: int
    level_from: int
    level_to: int
    active: bool
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    version: int
    views: int = 0
    image_url: str
    created_at: datetime


class PublicBillboard(BaseModel):
    id: str
    slot: int
    level_from: int
    level_to: int
    url: str  # path under the backend, e.g. /api/billboards/<id>-3.jpg


def image_path(doc: dict) -> str:
    return f"/api/billboards/{doc['id']}-{doc['version']}.{'png' if doc.get('image_type') == 'png' else 'jpg'}"


def out(doc: dict) -> Billboard:
    return Billboard(**{k: v for k, v in doc.items() if k in Billboard.model_fields}, image_url=image_path(doc))


def is_live(doc: dict, now: datetime) -> bool:
    starts, ends = as_utc(doc.get("starts_at")), as_utc(doc.get("ends_at"))
    return bool(doc.get("active")) and (starts is None or starts <= now) and (ends is None or ends > now)


FIELDS = {"image": 0, "_id": 0}


async def setup():
    await db.billboards.create_index("id", unique=True)


async def live_billboards() -> List[PublicBillboard]:
    """Posters to show now (read by the app in /api/config)."""
    now = utcnow()
    docs = await db.billboards.find({"active": True}, FIELDS).sort("created_at", -1).to_list(100)
    return [
        PublicBillboard(id=d["id"], slot=d["slot"], level_from=d["level_from"], level_to=d["level_to"], url=image_path(d))
        for d in docs
        if is_live(d, now)
    ]


# ------------------------ Public ------------------------
@public.get("/{name}")
async def image(name: str):
    m = re.fullmatch(r"([0-9a-f]{32})-(\d+)\.(jpg|png)", name)
    if not m:
        raise HTTPException(404, "Image introuvable")
    doc = await db.billboards.find_one({"id": m.group(1)}, {"_id": 0, "image": 1, "image_type": 1, "version": 1})
    if not doc or not doc.get("image"):
        raise HTTPException(404, "Image introuvable")
    media = "image/png" if doc.get("image_type") == "png" else "image/jpeg"
    # The version is in the name: a new image gets a new URL, so this one can be cached for long.
    # Public image: always allowed cross-origin, so a copy cached by the browser (first fetched
    # without an Origin header) still loads as a WebGL texture on the web version.
    headers = {"Cache-Control": "public, max-age=2592000, immutable", "Access-Control-Allow-Origin": "*"}
    return Response(content=bytes(doc["image"]), media_type=media, headers=headers)


class ViewsIn(BaseModel):
    ids: List[str] = Field(default_factory=list, max_length=SLOTS)


@public.post("/views")
async def count_views(payload: ViewsIn):
    ids = list({i for i in payload.ids if re.fullmatch(r"[0-9a-f]{32}", i)})
    if ids:
        await db.billboards.update_many({"id": {"$in": ids}}, {"$inc": {"views": 1}})
    return {"ok": True}


# ------------------------ Admin ------------------------
@admin.get("", response_model=List[Billboard])
async def list_billboards():
    return [out(d) for d in await db.billboards.find({}, FIELDS).sort("created_at", -1).to_list(200)]


@admin.post("", response_model=Billboard)
async def create_billboard(payload: BillboardIn):
    if not payload.image:
        raise HTTPException(422, "Ajoute une image.")
    kind, raw = decode_image(payload.image)
    now = datetime.now(timezone.utc)
    doc = {
        **payload.model_dump(exclude={"image"}),
        "id": uuid.uuid4().hex, "version": 1, "views": 0, "image": raw, "image_type": kind, "created_at": now,
    }
    await db.billboards.insert_one(dict(doc))
    return out(doc)


@admin.put("/{billboard_id}", response_model=Billboard)
async def update_billboard(billboard_id: str, payload: BillboardIn):
    doc = await db.billboards.find_one({"id": billboard_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Publicité introuvable")
    doc.update(payload.model_dump(exclude={"image"}))
    if payload.image:
        kind, raw = decode_image(payload.image)
        doc.update(image=raw, image_type=kind, version=doc["version"] + 1)
    await db.billboards.replace_one({"id": billboard_id}, doc)
    return out(doc)


@admin.delete("/{billboard_id}")
async def delete_billboard(billboard_id: str):
    r = await db.billboards.delete_one({"id": billboard_id})
    if not r.deleted_count:
        raise HTTPException(404, "Publicité introuvable")
    return {"ok": True}
