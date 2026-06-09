import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db

router = APIRouter(prefix="/api", tags=["analytics"])


class AnalyticsSnapshotCreate(BaseModel):
    views: int = 0
    watch_time_minutes: float = 0
    subscribers: int = 0
    avg_ctr: float = 0
    avg_retention: float = 0
    top_videos: str = "[]"
    demographics: str = "{}"


@router.post("/channels/{channel_id}/analytics")
def create_analytics_snapshot(channel_id: int, body: AnalyticsSnapshotCreate):
    conn = get_db()
    snapshot_date = datetime.date.today().isoformat()
    cursor = conn.execute(
        """INSERT INTO analytics_snapshots (channel_id, snapshot_date, views, watch_time_minutes,
           subscribers, avg_ctr, avg_retention, top_videos, demographics)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (channel_id, snapshot_date, body.views, body.watch_time_minutes, body.subscribers,
         body.avg_ctr, body.avg_retention, body.top_videos, body.demographics),
    )
    snap_id = cursor.lastrowid
    conn.commit()

    row = conn.execute("SELECT * FROM analytics_snapshots WHERE id = ?", (snap_id,)).fetchone()
    conn.close()
    return dict(row)


@router.get("/channels/{channel_id}/analytics")
def list_analytics_snapshots(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM analytics_snapshots WHERE channel_id = ? ORDER BY snapshot_date DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/channels/{channel_id}/analytics/latest")
def get_latest_analytics(channel_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM analytics_snapshots WHERE channel_id = ? ORDER BY snapshot_date DESC LIMIT 1",
        (channel_id,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "No analytics data")
    return dict(row)


@router.get("/channels/{channel_id}/analytics/compare")
def compare_analytics(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        """SELECT * FROM analytics_snapshots WHERE channel_id = ?
           ORDER BY snapshot_date DESC LIMIT 2""",
        (channel_id,),
    ).fetchall()
    conn.close()
    if len(rows) < 2:
        return {"comparison": None, "message": "Need at least 2 snapshots to compare"}
    latest = dict(rows[0])
    previous = dict(rows[1])
    changes = {}
    for key in ["views", "watch_time_minutes", "subscribers", "avg_ctr", "avg_retention"]:
        old_val = previous.get(key, 0) or 0
        new_val = latest.get(key, 0) or 0
        if old_val > 0:
            changes[key] = round(((new_val - old_val) / old_val) * 100, 1)
        else:
            changes[key] = 0 if new_val == 0 else 100
    return {"latest": latest, "previous": previous, "changes_pct": changes}
