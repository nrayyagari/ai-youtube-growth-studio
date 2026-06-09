import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db

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
def create_channel(body: ChannelCreate):
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO channels (name, niche, audience, target_country, language,
           content_mode, monetization_goal, upload_frequency, banned_topics)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (body.name, body.niche, body.audience, body.target_country, body.language,
         body.content_mode, body.monetization_goal, body.upload_frequency, body.banned_topics),
    )
    conn.commit()
    channel_id = cursor.lastrowid
    conn.close()
    return {"id": channel_id, "name": body.name}


@router.get("")
def list_channels():
    conn = get_db()
    rows = conn.execute("SELECT * FROM channels ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/{channel_id}")
def get_channel(channel_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Channel not found")
    packages = conn.execute(
        "SELECT * FROM video_packages WHERE channel_id = ? ORDER BY created_at DESC", (channel_id,)
    ).fetchall()
    conn.close()
    result = dict(row)
    result["packages"] = [dict(p) for p in packages]
    return result


@router.put("/{channel_id}")
def update_channel(channel_id: int, body: ChannelUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Channel not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE channels SET {set_clause} WHERE id = ?", (*updates.values(), channel_id))
        conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/{channel_id}")
def delete_channel(channel_id: int):
    conn = get_db()
    conn.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
