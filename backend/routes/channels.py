import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import get_db
from core.tenancy import get_current_user, require_channel_access, require_channel_capacity

router = APIRouter(prefix="/api/channels", tags=["channels"])


class ChannelCreate(BaseModel):
    name: str
    niche: str = ""
    audience: str = ""
    target_country: str = ""
    language: str = "en"
    content_mode: str = "single_video"
    monetization_goal: str = ""
    upload_frequency: str = ""
    banned_topics: str = "[]"


class ChannelUpdate(BaseModel):
    name: str | None = None
    niche: str | None = None
    audience: str | None = None
    target_country: str | None = None
    language: str | None = None
    content_mode: str | None = None
    monetization_goal: str | None = None
    upload_frequency: str | None = None
    banned_topics: str | None = None


@router.post("")
def create_channel(body: ChannelCreate, request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    require_channel_capacity(conn, user)
    cursor = conn.execute(
        """INSERT INTO channels (user_id, name, niche, audience, target_country, language,
           content_mode, monetization_goal, upload_frequency, banned_topics)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user.id, body.name, body.niche, body.audience, body.target_country, body.language,
         body.content_mode, body.monetization_goal, body.upload_frequency, body.banned_topics),
    )
    conn.commit()
    channel_id = cursor.lastrowid
    conn.close()
    return {"id": channel_id, "name": body.name}


@router.get("")
def list_channels(request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    rows = conn.execute("SELECT * FROM channels WHERE user_id = ? ORDER BY created_at DESC", (user.id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/{channel_id}")
def get_channel(channel_id: int, request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    row = require_channel_access(conn, channel_id, user)
    packages = conn.execute(
        "SELECT * FROM video_packages WHERE channel_id = ? ORDER BY created_at DESC", (channel_id,)
    ).fetchall()
    conn.close()
    result = dict(row)
    result["packages"] = [dict(p) for p in packages]
    return result


@router.put("/{channel_id}")
def update_channel(channel_id: int, body: ChannelUpdate, request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    require_channel_access(conn, channel_id, user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE channels SET {set_clause} WHERE id = ? AND user_id = ?", (*updates.values(), channel_id, user.id))
        conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/{channel_id}")
def delete_channel(channel_id: int, request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    require_channel_access(conn, channel_id, user)
    conn.execute("DELETE FROM channels WHERE id = ? AND user_id = ?", (channel_id, user.id))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
