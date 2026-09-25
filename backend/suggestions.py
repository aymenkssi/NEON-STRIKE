"""Suggestions sent by signed-in players, read in the admin page ("Suggestions" tab).

- POST /api/suggestions                 : a player with an account sends an idea, a bug or anything else.
- GET  /api/admin/suggestions           : list (newest first), optional ?status= filter, with counts.
- PUT  /api/admin/suggestions/{id}      : change the status (new -> read -> done).
- DELETE /api/admin/suggestions/{id}
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import current_player
from database import db
from liveops import require_admin
from stats import client_context

public = APIRouter(prefix="/api")
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

MAX_PER_DAY = 5
Category = Literal["idea", "bug", "other"]
Status = Literal["new", "read", "done"]


class SuggestionIn(BaseModel):
    category: Category = "idea"
    message: str = Field(..., min_length=5, max_length=1000)


class Suggestion(BaseModel):
    id: str
    username: str
    category: Category
    message: str
    status: Status
    created_at: str
    lang: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None
    country: Optional[str] = None


class SuggestionList(BaseModel):
    items: List[Suggestion]
    counts: dict


class StatusIn(BaseModel):
    status: Status


@public.post("/suggestions")
async def send_suggestion(payload: SuggestionIn, request: Request, player: dict = Depends(current_player)):
    if not player.get("username"):
        raise HTTPException(403, "Account required")
    message = payload.message.strip()
    if len(message) < 5:
        raise HTTPException(422, "Message too short")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.suggestions.count_documents({"player_id": player["id"], "created_at": {"$gte": since}}) >= MAX_PER_DAY:
        raise HTTPException(429, "Too many suggestions today")
    ctx = client_context(request)
    doc = {
        "id": str(uuid.uuid4()),
        "player_id": player["id"],
        "username": player["username"],
        "category": payload.category,
        "message": message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "lang": ctx.get("lang"),
        "app_version": ctx.get("app_version"),
        "platform": ctx.get("platform"),
        "country": ctx.get("country") or player.get("country"),
    }
    await db.suggestions.insert_one(doc)
    return {"ok": True}


@admin.get("/suggestions", response_model=SuggestionList)
async def list_suggestions(status: Optional[Status] = None, limit: int = 200):
    query = {"status": status} if status else {}
    items = await db.suggestions.find(query, {"_id": 0, "player_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    counts = {s: await db.suggestions.count_documents({"status": s}) for s in ("new", "read", "done")}
    return SuggestionList(items=[Suggestion(**i) for i in items], counts=counts)


@admin.put("/suggestions/{suggestion_id}", response_model=Suggestion)
async def set_status(suggestion_id: str, payload: StatusIn):
    res = await db.suggestions.update_one({"id": suggestion_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(404, "Unknown suggestion")
    return Suggestion(**await db.suggestions.find_one({"id": suggestion_id}, {"_id": 0, "player_id": 0}))


@admin.delete("/suggestions/{suggestion_id}")
async def delete_suggestion(suggestion_id: str):
    res = await db.suggestions.delete_one({"id": suggestion_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Unknown suggestion")
    return {"deleted": suggestion_id}


async def setup():
    await db.suggestions.create_index("id", unique=True)
    await db.suggestions.create_index([("player_id", 1), ("created_at", -1)])
