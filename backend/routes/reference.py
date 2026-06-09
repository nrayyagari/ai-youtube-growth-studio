import json
import re
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter, AllProvidersExhausted
from agents.master_router_agent import MasterRouterAgent

router = APIRouter(prefix="/api", tags=["reference-videos"])


class ReferenceVideoCreate(BaseModel):
    url: str


class StyleProfileCreate(BaseModel):
    name: str


def _extract_youtube_id(url: str) -> str:
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)",
        r"youtu\.be\/([0-9A-Za-z_-]{11})",
        r"embed\/([0-9A-Za-z_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise HTTPException(400, "Could not extract YouTube video ID from URL")


def _fetch_youtube_metadata(video_id: str) -> dict:
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        r = httpx.get(oembed_url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return {
                "title": data.get("title", ""),
                "channel_name": data.get("author_name", ""),
                "thumbnail_url": data.get("thumbnail_url", ""),
            }
    except Exception:
        pass
    return {"title": "", "channel_name": "", "thumbnail_url": ""}


def _fetch_youtube_transcript(video_id: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry["text"] for entry in transcript])
    except Exception:
        return ""


@router.post("/channels/{channel_id}/reference-videos")
def add_reference_video(channel_id: int, body: ReferenceVideoCreate):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")

    video_id = _extract_youtube_id(body.url)
    meta = _fetch_youtube_metadata(video_id)
    transcript = _fetch_youtube_transcript(video_id)

    cursor = conn.execute(
        """INSERT INTO reference_videos (channel_id, url, video_id, title, channel_name,
           thumbnail_url, transcript)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (channel_id, body.url, video_id, meta["title"], meta["channel_name"],
         meta["thumbnail_url"], transcript),
    )
    conn.commit()
    ref_id = cursor.lastrowid
    conn.close()
    return {"id": ref_id, "video_id": video_id, "title": meta["title"],
            "channel_name": meta["channel_name"], "has_transcript": bool(transcript)}


@router.get("/channels/{channel_id}/reference-videos")
def list_reference_videos(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reference_videos WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/reference-videos/{ref_id}")
def delete_reference_video(ref_id: int):
    conn = get_db()
    conn.execute("DELETE FROM reference_videos WHERE id = ?", (ref_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.post("/channels/{channel_id}/style-profiles/generate")
def generate_style_profile(channel_id: int, body: StyleProfileCreate):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")
    ref_videos = conn.execute(
        "SELECT * FROM reference_videos WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()

    if not ref_videos:
        raise HTTPException(400, "No reference videos for this channel")

    channel_dict = dict(channel)
    ref_list = [dict(v) for v in ref_videos]

    try:
        router = AIProviderRouter()
        agent = MasterRouterAgent()
        result = agent.analyze_reference(channel_dict, ref_list, router)
    except AllProvidersExhausted as e:
        raise HTTPException(429, str(e))

    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO style_profiles (channel_id, name, visual_style, editing_style, tone,
           music_preferences, pacing, content_patterns, hooks, thumbnails_style, raw_analysis)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (channel_id, body.name,
         result.get("visual_style", ""),
         result.get("editing_style", ""),
         result.get("tone", ""),
         result.get("music_preferences", ""),
         result.get("pacing", ""),
         json.dumps(result.get("content_patterns", {})),
         result.get("hooks", ""),
         result.get("thumbnails_style", ""),
         json.dumps(result)),
    )
    profile_id = cursor.lastrowid
    conn.commit()

    profile = conn.execute("SELECT * FROM style_profiles WHERE id = ?", (profile_id,)).fetchone()
    conn.close()

    p = dict(profile)
    p["content_patterns"] = json.loads(p.get("content_patterns", "{}"))
    p["raw_analysis"] = json.loads(p.get("raw_analysis", "{}"))
    return p


@router.get("/channels/{channel_id}/style-profiles")
def list_style_profiles(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM style_profiles WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["content_patterns"] = json.loads(d.get("content_patterns", "{}"))
        d["raw_analysis"] = json.loads(d.get("raw_analysis", "{}"))
        result.append(d)
    return result


@router.delete("/style-profiles/{profile_id}")
def delete_style_profile(profile_id: int):
    conn = get_db()
    conn.execute("DELETE FROM style_profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
