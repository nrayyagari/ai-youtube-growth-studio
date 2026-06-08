import json
import re
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import httpx

from core.database import get_db, init_db
from core.config import settings
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError
from agents.master_router_agent import MasterRouterAgent
from core.youtube_analytics import YouTubeAnalyticsService

app = FastAPI(title="AI YouTube Growth Studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    _seed_data()


# ─── Request/Response Models ───

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


class GenerateRequest(BaseModel):
    channel_id: int
    workflow_id: int
    topic: str = ""


class APIKeysUpdate(BaseModel):
    gemini_api_key: str = ""
    grok_api_key: str = ""
    cerebras_api_key: str = ""


# ─── Channel Routes ───

@app.post("/api/channels")
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


@app.get("/api/channels")
def list_channels():
    conn = get_db()
    rows = conn.execute("SELECT * FROM channels ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/channels/{channel_id}")
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


@app.put("/api/channels/{channel_id}")
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


@app.delete("/api/channels/{channel_id}")
def delete_channel(channel_id: int):
    conn = get_db()
    conn.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Workflow Routes ───

@app.get("/api/workflows")
def list_workflows():
    conn = get_db()
    workflows = conn.execute("SELECT * FROM workflows ORDER BY id").fetchall()
    result = []
    for w in workflows:
        wd = dict(w)
        skills = conn.execute(
            """SELECT s.*, ws.execution_order FROM skills s
               JOIN workflow_skills ws ON ws.skill_id = s.id
               WHERE ws.workflow_id = ?
               ORDER BY ws.execution_order""",
            (w["id"],),
        ).fetchall()
        wd["skills"] = [dict(s) for s in skills]
        wd["qa_checklist"] = json.loads(wd["qa_checklist"]) if wd.get("qa_checklist") else []
        wd["scoring_rules"] = json.loads(wd["scoring_rules"]) if wd.get("scoring_rules") else {}
        result.append(wd)
    conn.close()
    return result


# ─── Skill Routes ───

@app.get("/api/skills")
def list_skills(category: str | None = None):
    conn = get_db()
    if category:
        rows = conn.execute("SELECT * FROM skills WHERE category = ? ORDER BY name", (category,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM skills ORDER BY category, name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── Package Generation ───

@app.post("/api/generate")
def generate_package(body: GenerateRequest):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (body.channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")
    workflow = conn.execute("SELECT * FROM workflows WHERE id = ?", (body.workflow_id,)).fetchone()
    if not workflow:
        conn.close()
        raise HTTPException(404, "Workflow not found")
    conn.close()

    channel_dict = dict(channel)

    try:
        router = AIProviderRouter()
        pipeline = PipelineRunner(router)
        result = pipeline.run(channel_dict, body.topic)
    except PipelineError as e:
        raise HTTPException(500, f"Pipeline failed at {e.agent_name}: {e.detail}")
    except AllProvidersExhausted as e:
        raise HTTPException(429, str(e))

    status = result["approval"]["status"]
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
        (body.channel_id, body.workflow_id, status),
    )
    package_id = cursor.lastrowid

    for section in result["sections"]:
        section_type = section.get("section_type", "")
        content = json.dumps(section.get("output", {}))
        score = 0
        scores = result["approval"].get("scores", {})
        if section_type == "idea":
            score = scores.get("growth_score", 0)
        elif section_type == "script":
            score = scores.get("script_score", 0)
        elif section_type == "titles":
            score = scores.get("title_score", 0)
        elif section_type == "thumbnail":
            score = scores.get("thumbnail_score", 0)
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (package_id, section_type, content, score),
        )

    for category, score in result["approval"]["scores"].items():
        if category.startswith("idea_"):
            conn.execute(
                "INSERT INTO growth_scores (package_id, category, score, explanation) VALUES (?, ?, ?, ?)",
                (package_id, category.replace("idea_", ""), score, "Auto-scored by Idea Agent"),
            )

    if result["approval"]["status"] == "NEEDS_IMPROVEMENT":
        conn.execute(
            "INSERT INTO qa_reports (package_id, check_type, score, status, details) VALUES (?, ?, ?, ?, ?)",
            (package_id, "overall", result["approval"]["scores"].get("copyright_safety", 0),
             "FAIL" if result["approval"]["failing"] else "PASS",
             json.dumps(result["approval"]["corrections"])),
        )

    conn.commit()

    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    sections = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ? ORDER BY id", (package_id,)
    ).fetchall()
    conn.close()

    pkg = dict(package)
    pkg["sections"] = [dict(s) for s in sections]
    pkg["approval"] = result["approval"]
    return pkg


@app.post("/api/packages/{package_id}/regenerate")
def regenerate_package(package_id: int, body: GenerateRequest | None = None):
    return generate_package(body or GenerateRequest(channel_id=0, workflow_id=0, topic=""))


# ─── Package Routes ───

@app.get("/api/packages")
def list_packages(channel_id: int | None = None, status: str | None = None):
    conn = get_db()
    query = "SELECT * FROM video_packages"
    params = []
    conditions = []
    if channel_id is not None:
        conditions.append("channel_id = ?")
        params.append(channel_id)
    if status:
        conditions.append("status = ?")
        params.append(status)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/packages/{package_id}")
def get_package(package_id: int):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")
    sections = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ? ORDER BY id", (package_id,)
    ).fetchall()
    scores = conn.execute(
        "SELECT * FROM growth_scores WHERE package_id = ?", (package_id,)
    ).fetchall()
    qa = conn.execute(
        "SELECT * FROM qa_reports WHERE package_id = ?", (package_id,)
    ).fetchall()
    conn.close()

    pkg = dict(package)
    pkg["sections"] = [dict(s) for s in sections]
    pkg["growth_scores"] = [dict(s) for s in scores]
    pkg["qa_reports"] = [dict(q) for q in qa]
    return pkg


@app.delete("/api/packages/{package_id}")
def delete_package(package_id: int):
    conn = get_db()
    conn.execute("DELETE FROM video_packages WHERE id = ?", (package_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Reference Video Routes ───

class ReferenceVideoCreate(BaseModel):
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


@app.post("/api/channels/{channel_id}/reference-videos")
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


@app.get("/api/channels/{channel_id}/reference-videos")
def list_reference_videos(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reference_videos WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/reference-videos/{ref_id}")
def delete_reference_video(ref_id: int):
    conn = get_db()
    conn.execute("DELETE FROM reference_videos WHERE id = ?", (ref_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Style Profile Routes ───

class StyleProfileCreate(BaseModel):
    name: str


@app.post("/api/channels/{channel_id}/style-profiles/generate")
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


@app.get("/api/channels/{channel_id}/style-profiles")
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


@app.delete("/api/style-profiles/{profile_id}")
def delete_style_profile(profile_id: int):
    conn = get_db()
    conn.execute("DELETE FROM style_profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Series & Episodes Routes ───

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


@app.post("/api/series")
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


@app.get("/api/series")
def list_series(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM series WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/series/{series_id}")
def delete_series(series_id: int):
    conn = get_db()
    conn.execute("DELETE FROM series WHERE id = ?", (series_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@app.post("/api/series/{series_id}/episodes")
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


@app.get("/api/series/{series_id}/episodes")
def list_episodes(series_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM episodes WHERE series_id = ? ORDER BY episode_number",
        (series_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.put("/api/episodes/{episode_id}")
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


@app.delete("/api/episodes/{episode_id}")
def delete_episode(episode_id: int):
    conn = get_db()
    conn.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Pattern Analysis Routes ───

class CompetitorAnalysisCreate(BaseModel):
    competitor_url: str
    analysis_type: str = "general"


@app.post("/api/channels/{channel_id}/competitor-analysis")
def run_competitor_analysis(channel_id: int, body: CompetitorAnalysisCreate):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")
    conn.close()

    try:
        router = AIProviderRouter()
        prompt = f"""You are a YouTube competitive analyst for faceless channels.

Channel niche: {channel['niche']}
Competitor URL: {body.competitor_url}

Analyze this competitor channel and provide:
1. Content strategy patterns
2. Video format and structure
3. Thumbnail and title strategies
4. Engagement tactics
5. Weaknesses or gaps that could be exploited
6. What's working well that could be adapted

Return JSON:
{{
  "content_strategy": "Analysis of content approach",
  "format_patterns": "Video structure observations",
  "thumbnail_strategy": "Thumbnail approach analysis",
  "engagement_tactics": "How they drive engagement",
  "weaknesses": ["gap1", "gap2"],
  "strengths_to_adapt": ["strength1", "strength2"],
  "overall_assessment": "Summary assessment"
}}"""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        findings = json.loads(result) if isinstance(result, str) else result
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO competitor_analyses (channel_id, competitor_url, analysis_type, findings) VALUES (?, ?, ?, ?)",
        (channel_id, body.competitor_url, body.analysis_type, json.dumps(findings)),
    )
    analysis_id = cursor.lastrowid
    conn.commit()

    row = conn.execute("SELECT * FROM competitor_analyses WHERE id = ?", (analysis_id,)).fetchone()
    conn.close()
    r = dict(row)
    r["findings"] = json.loads(r["findings"])
    return r


@app.get("/api/channels/{channel_id}/competitor-analysis")
def list_competitor_analyses(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM competitor_analyses WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["findings"] = json.loads(d["findings"])
        result.append(d)
    return result


class PatternCreate(BaseModel):
    pattern_type: str
    pattern_name: str
    description: str = ""
    examples: str = "[]"


@app.post("/api/channels/{channel_id}/patterns")
def create_pattern(channel_id: int, body: PatternCreate):
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO pattern_library (channel_id, pattern_type, pattern_name, description, examples) VALUES (?, ?, ?, ?, ?)",
        (channel_id, body.pattern_type, body.pattern_name, body.description, body.examples),
    )
    conn.commit()
    pid = cursor.lastrowid
    conn.close()
    return {"id": pid, "pattern_name": body.pattern_name}


@app.get("/api/channels/{channel_id}/patterns")
def list_patterns(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM pattern_library WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/patterns/{pattern_id}")
def delete_pattern(pattern_id: int):
    conn = get_db()
    conn.execute("DELETE FROM pattern_library WHERE id = ?", (pattern_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ─── Analytics Routes ───

class AnalyticsSnapshotCreate(BaseModel):
    views: int = 0
    watch_time_minutes: float = 0
    subscribers: int = 0
    avg_ctr: float = 0
    avg_retention: float = 0
    top_videos: str = "[]"
    demographics: str = "{}"


@app.post("/api/channels/{channel_id}/analytics")
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


@app.get("/api/channels/{channel_id}/analytics")
def list_analytics_snapshots(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM analytics_snapshots WHERE channel_id = ? ORDER BY snapshot_date DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/channels/{channel_id}/analytics/latest")
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


@app.get("/api/channels/{channel_id}/analytics/compare")
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


class RecommendationCreate(BaseModel):
    recommendation_type: str
    title: str
    description: str = ""
    priority: int = 0
    based_on: str = ""
    snapshot_id: int | None = None


@app.post("/api/channels/{channel_id}/recommendations")
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


@app.get("/api/channels/{channel_id}/recommendations")
def list_recommendations(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM recommendations WHERE channel_id = ? ORDER BY priority DESC, created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/channels/{channel_id}/recommendations/generate")
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


# ─── YouTube OAuth Routes ───

class YouTubeOAuthConfig(BaseModel):
    client_id: str
    client_secret: str


@app.post("/api/youtube/oauth/url")
def get_youtube_oauth_url(body: YouTubeOAuthConfig):
    redirect_uri = settings.youtube_redirect_uri
    if not body.client_id or not body.client_secret:
        raise HTTPException(400, "Client ID and Client Secret are required")
    try:
        auth_url = YouTubeAnalyticsService.get_auth_url(
            body.client_id, body.client_secret, redirect_uri
        )
    except Exception as e:
        raise HTTPException(500, str(e))

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_client_id", body.client_id),
    )
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_client_secret", body.client_secret),
    )
    conn.commit()
    conn.close()
    return {"auth_url": auth_url}


@app.get("/api/youtube/oauth/callback")
def youtube_oauth_callback(code: str, state: str = ""):
    conn = get_db()
    client_id = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)
    ).fetchone()
    client_secret = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)
    ).fetchone()
    conn.close()

    if not client_id or not client_secret:
        raise HTTPException(400, "Configure YouTube OAuth credentials first")

    try:
        tokens = YouTubeAnalyticsService.exchange_code(
            client_id["value"], client_secret["value"],
            settings.youtube_redirect_uri, code,
        )
    except Exception as e:
        raise HTTPException(500, f"OAuth exchange failed: {str(e)}")

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_refresh_token", tokens["refresh_token"]),
    )
    conn.commit()
    conn.close()

    return {"status": "connected", "expires_at": tokens.get("expiry")}


@app.get("/api/youtube/oauth/status")
def youtube_oauth_status():
    conn = get_db()
    row = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)
    ).fetchone()
    conn.close()
    return {"connected": bool(row and row["value"])}


# ─── YouTube Analytics Fetch Routes ───

@app.post("/api/youtube/fetch/channel-stats")
def fetch_youtube_channel_stats():
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected. Run OAuth setup first.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        stats = svc.get_channel_stats()
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return stats


@app.post("/api/youtube/fetch/analytics")
def fetch_youtube_analytics(days: int = 30):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        analytics = svc.get_channel_analytics(days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return analytics


@app.post("/api/youtube/fetch/top-videos")
def fetch_top_videos(max_results: int = 10, days: int = 30):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        videos = svc.get_top_videos(max_results, days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return videos


@app.post("/api/youtube/fetch/demographics")
def fetch_demographics(days: int = 90):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        demos = svc.get_demographics(days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return demos


@app.post("/api/youtube/sync/{channel_id}")
def sync_youtube_to_snapshot(channel_id: int):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        channel_stats = svc.get_channel_stats()
        if "error" in channel_stats:
            raise HTTPException(500, channel_stats["error"])

        analytics = svc.get_channel_analytics(30)
        if "error" in analytics:
            raise HTTPException(500, analytics["error"])

        demos = svc.get_demographics(90)

        snapshot_data = svc.create_snapshot_from_analytics(channel_stats, analytics)
        snapshot_data["demographics"] = json.dumps(demos)

        today = datetime.date.today().isoformat()
        conn = get_db()
        existing = conn.execute(
            "SELECT id FROM analytics_snapshots WHERE channel_id = ? AND snapshot_date = ?",
            (channel_id, today),
        ).fetchone()

        if existing:
            conn.execute(
                """UPDATE analytics_snapshots SET views = ?, watch_time_minutes = ?,
                   subscribers = ?, avg_ctr = ?, avg_retention = ?,
                   top_videos = ?, demographics = ?
                   WHERE id = ?""",
                (snapshot_data["views"], snapshot_data["watch_time_minutes"],
                 snapshot_data["subscribers"], snapshot_data["avg_ctr"],
                 snapshot_data["avg_retention"], snapshot_data["top_videos"],
                 snapshot_data["demographics"], existing["id"]),
            )
            snap_id = existing["id"]
        else:
            cursor = conn.execute(
                """INSERT INTO analytics_snapshots (channel_id, snapshot_date, views,
                   watch_time_minutes, subscribers, avg_ctr, avg_retention,
                   top_videos, demographics)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (channel_id, today, snapshot_data["views"], snapshot_data["watch_time_minutes"],
                 snapshot_data["subscribers"], snapshot_data["avg_ctr"],
                 snapshot_data["avg_retention"], snapshot_data["top_videos"],
                 snapshot_data["demographics"]),
            )
            snap_id = cursor.lastrowid

        conn.commit()
        snap = conn.execute("SELECT * FROM analytics_snapshots WHERE id = ?", (snap_id,)).fetchone()
        conn.close()

        result = dict(snap)
        result["_channel_stats"] = channel_stats
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Sync failed: {str(e)}")


# ─── Settings Routes ───

@app.get("/api/settings/apikeys")
def get_api_keys():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings WHERE key LIKE '%_api_key'").fetchall()
    conn.close()
    result = {}
    for r in rows:
        val = r["value"]
        result[r["key"]] = val[:4] + "..." + val[-4:] if len(val) > 8 else ""
    return result


@app.put("/api/settings/apikeys")
def update_api_keys(body: APIKeysUpdate):
    conn = get_db()
    for key, val in body.model_dump().items():
        if val:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
                (key, val),
            )
    conn.commit()
    conn.close()
    return {"status": "saved"}


# ─── Static Frontend (catch-all must be last) ───

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        path = os.path.join(FRONTEND_DIR, full_path) if full_path else FRONTEND_DIR
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── Seed Data ───

def _seed_data():
    conn = get_db()
    existing = conn.execute("SELECT COUNT(*) FROM workflows").fetchone()[0]
    if existing > 0:
        conn.close()
        return

    workflows = [
        ("AI Tool Explainer", "Hook-driven explainers for AI tools and concepts",
         "hook_body_summary_cta", "intro_tool_overview_examples_conclusion",
         "Clean tech, screen recordings", "Modern electronic, upbeat"),
        ("Facts / Curiosity", "Surprising facts and curiosity-driven short content",
         "hook_fact_explanation_twist", "intro_fact_reveal_explore_conclusion",
         "Motion graphics, bold text", "Curious, mysterious, engaging"),
        ("Clean Faceless Productivity", "Minimalist productivity and how-to content",
         "hook_problem_solution_steps_result", "intro_problem_steps_demo_conclusion",
         "Clean minimal, screen demos", "Calm, focused, ambient"),
    ]

    for name, desc, sfmt, cfmt, vstyle, mstyle in workflows:
        conn.execute(
            "INSERT INTO workflows (name, description, script_format, scene_format, visual_style, music_style) VALUES (?, ?, ?, ?, ?, ?)",
            (name, desc, sfmt, cfmt, vstyle, mstyle),
        )

    skills = [
        ("Hook Writing", "script", "Craft attention-grabbing hooks for video openings"),
        ("Faceless Script Writing", "script", "Write scripts optimized for faceless video format"),
        ("Retention Loop Writing", "script", "Structure content to maximize viewer retention"),
        ("Scene-by-Scene Planning", "visual", "Plan detailed scene sequences for video production"),
        ("Image Prompt Generation", "visual", "Generate AI image prompts for visual assets"),
        ("Motion Graphics Direction", "visual", "Direct motion graphics and animation sequences"),
        ("Background Music Selection", "music", "Select royalty-free background music"),
        ("Sound Mood Matching", "music", "Match music mood to video content and pacing"),
        ("CTR Title Generation", "growth", "Generate high-click-through-rate titles"),
        ("SEO Generation", "growth", "Optimize titles, descriptions, and tags for YouTube search"),
        ("Growth Score Prediction", "growth", "Predict video performance before publishing"),
        ("Copyright Safety Check", "qa", "Verify content does not infringe copyright"),
        ("Monetization Safety Check", "qa", "Ensure content meets advertiser-friendly guidelines"),
        ("Factual Accuracy Check", "qa", "Verify claims and statistics are accurate"),
        ("Script Quality Check", "qa", "Review script structure and engagement quality"),
        ("Visual Consistency Check", "qa", "Ensure visual plan is coherent and achievable"),
        ("Trend Research", "research", "Research current trends in the niche"),
        ("Topic Gap Finding", "research", "Find underserved topics in the niche"),
    ]

    for name, cat, desc in skills:
        conn.execute(
            "INSERT OR IGNORE INTO skills (name, category, description) VALUES (?, ?, ?)",
            (name, cat, desc),
        )

    agents = [
        ("Idea Agent", "Generate and score video ideas"),
        ("Script Agent", "Write narration scripts"),
        ("Visual Director Agent", "Plan scenes and visuals"),
        ("Music Agent", "Suggest royalty-free music"),
        ("Title Agent", "Generate titles and SEO"),
        ("Thumbnail Agent", "Create thumbnail concepts"),
        ("QA Agent", "Check copyright, monetization, quality"),
    ]

    for name, purpose in agents:
        conn.execute(
            "INSERT OR IGNORE INTO agents (name, purpose) VALUES (?, ?)",
            (name, purpose),
        )

    conn.commit()
    conn.close()
