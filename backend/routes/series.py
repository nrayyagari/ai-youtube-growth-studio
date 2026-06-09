from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db

router = APIRouter(prefix="/api", tags=["series"])


class SeriesCreate(BaseModel):
    channel_id: int
    name: str
    description: str = ""


class EpisodeCreate(BaseModel):
    episode_number: int
    title: str = ""
    description: str = ""
    arc_position: str = ""
    package_id: int | None = None


@router.post("/series")
def create_series(body: SeriesCreate):
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO series (channel_id, name, description) VALUES (?, ?, ?)",
        (body.channel_id, body.name, body.description),
    )
    conn.commit()
    sid = cursor.lastrowid
    conn.close()
    return {"id": sid, "name": body.name}


@router.get("/series")
def list_series(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM series WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/series/{series_id}")
def delete_series(series_id: int):
    conn = get_db()
    conn.execute("DELETE FROM series WHERE id = ?", (series_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.post("/series/{series_id}/episodes")
def create_episode(series_id: int, body: EpisodeCreate):
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO episodes (series_id, package_id, episode_number, title, description, arc_position)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (series_id, body.package_id, body.episode_number, body.title, body.description, body.arc_position),
    )
    conn.commit()
    eid = cursor.lastrowid
    conn.close()
    return {"id": eid, "episode_number": body.episode_number}


@router.get("/series/{series_id}/episodes")
def list_episodes(series_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM episodes WHERE series_id = ? ORDER BY episode_number",
        (series_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.put("/episodes/{episode_id}")
def update_episode(episode_id: int, body: EpisodeCreate):
    conn = get_db()
    conn.execute(
        """UPDATE episodes SET episode_number = ?, title = ?, description = ?,
           arc_position = ?, package_id = ? WHERE id = ?""",
        (body.episode_number, body.title, body.description, body.arc_position, body.package_id, episode_id),
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}


@router.delete("/episodes/{episode_id}")
def delete_episode(episode_id: int):
    conn = get_db()
    conn.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
