import json
import re
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.router import AIProviderRouter, AllProvidersExhausted
from agents.master_router_agent import MasterRouterAgent

router = APIRouter(prefix="/api", tags=["reference"])


class AnalyzeRequest(BaseModel):
    url: str


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


@router.post("/analyze")
def analyze_reference(body: AnalyzeRequest):
    video_id = _extract_youtube_id(body.url)
    meta = _fetch_youtube_metadata(video_id)
    transcript = _fetch_youtube_transcript(video_id)

    if not transcript:
        return {
            "video_id": video_id,
            "title": meta.get("title", ""),
            "channel_name": meta.get("channel_name", ""),
            "transcript": "",
            "style_profile": None,
            "error": "Transcript not available for this video (may be age-restricted, private, or has captions disabled).",
        }

    router = AIProviderRouter()
    agent = MasterRouterAgent()
    style_profile = agent.analyze_reference(
        {"niche": "General", "audience": "General"},
        [{"title": meta.get("title", ""), "channel_name": meta.get("channel_name", ""), "transcript": transcript}],
        router,
    )

    return {
        "video_id": video_id,
        "title": meta.get("title", ""),
        "channel_name": meta.get("channel_name", ""),
        "thumbnail_url": meta.get("thumbnail_url", ""),
        "transcript": transcript[:5000],
        "style_profile": style_profile,
    }
