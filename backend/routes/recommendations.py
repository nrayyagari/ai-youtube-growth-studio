import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter

router = APIRouter(prefix="/api", tags=["recommendations"])


class RecommendationCreate(BaseModel):
    recommendation_type: str
    title: str
    description: str = ""
    priority: int = 0
    based_on: str = ""
    snapshot_id: int | None = None


@router.post("/channels/{channel_id}/recommendations/generate")
def generate_recommendations(channel_id: int):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")

    snapshots = conn.execute(
        "SELECT * FROM analytics_snapshots WHERE channel_id = ? ORDER BY snapshot_date DESC LIMIT 1",
        (channel_id,),
    ).fetchall()
    profiles = conn.execute(
        "SELECT * FROM style_profiles WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1",
        (channel_id,),
    ).fetchall()
    conn.close()

    if not snapshots:
        raise HTTPException(400, "No analytics data to base recommendations on")

    snapshot_data = json.dumps(dict(snapshots[0]))
    profile_data = json.dumps(dict(profiles[0])) if profiles else "{}"

    try:
        router = AIProviderRouter()
        prompt = f"""You are a YouTube growth strategist.

Channel: {channel['niche']}
Latest analytics: {snapshot_data}
Style profile: {profile_data}

Based on the analytics and style data, generate 3-5 specific, actionable recommendations for the next video. Focus on:
- What topic to cover next
- How to improve CTR
- How to improve retention
- What format changes to try

Return JSON:
{{
  "recommendations": [
    {{
      "type": "topic/format/ctr/retention/monetization",
      "title": "Short recommendation title",
      "description": "Detailed explanation",
      "priority": 1,
      "based_on": "What data this is based on"
    }}
  ]
}}"""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = json.loads(result) if isinstance(result, str) else result
        recs = data.get("recommendations", [])
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {str(e)}")

    conn = get_db()
    created = []
    snap_id = snapshots[0]["id"] if snapshots else -1
    for rec in recs:
        cursor = conn.execute(
            """INSERT INTO recommendations (channel_id, snapshot_id, recommendation_type, title,
               description, priority, based_on)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (channel_id, snap_id, rec.get("type", ""), rec.get("title", ""),
             rec.get("description", ""), rec.get("priority", 1), rec.get("based_on", "")),
        )
        created.append({"id": cursor.lastrowid, "title": rec.get("title", "")})
    conn.commit()
    conn.close()
    return {"recommendations": created}


@router.post("/channels/{channel_id}/recommendations")
def create_recommendation(channel_id: int, body: RecommendationCreate):
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO recommendations (channel_id, snapshot_id, recommendation_type, title,
           description, priority, based_on)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (channel_id, body.snapshot_id, body.recommendation_type, body.title,
         body.description, body.priority, body.based_on),
    )
    conn.commit()
    rid = cursor.lastrowid
    conn.close()
    return {"id": rid, "title": body.title}


@router.get("/channels/{channel_id}/recommendations")
def list_recommendations(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM recommendations WHERE channel_id = ? ORDER BY priority DESC, created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
