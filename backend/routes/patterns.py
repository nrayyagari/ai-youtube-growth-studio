import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter

router = APIRouter(prefix="/api", tags=["patterns"])


class CompetitorAnalysisCreate(BaseModel):
    competitor_url: str
    analysis_type: str = "general"


class PatternCreate(BaseModel):
    pattern_type: str
    pattern_name: str
    description: str = ""
    examples: str = "[]"


class TrendingRequest(BaseModel):
    topic_hint: str = ""


@router.post("/channels/{channel_id}/competitor-analysis")
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


@router.get("/channels/{channel_id}/competitor-analysis")
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


@router.post("/channels/{channel_id}/patterns")
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


@router.get("/channels/{channel_id}/patterns")
def list_patterns(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM pattern_library WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/patterns/{pattern_id}")
def delete_pattern(pattern_id: int):
    conn = get_db()
    conn.execute("DELETE FROM pattern_library WHERE id = ?", (pattern_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.post("/trending")
def detect_trending_topics(body: TrendingRequest | None = None):
    conn = get_db()
    channels = conn.execute("SELECT * FROM channels LIMIT 1").fetchall()
    conn.close()
    if not channels:
        raise HTTPException(400, "No channels configured")

    channel = dict(channels[0])
    if body and body.topic_hint:
        channel["niche"] = body.topic_hint

    try:
        from agents.reference_intelligence_agent import ReferenceIntelligenceAgent
        router = AIProviderRouter()
        agent = ReferenceIntelligenceAgent()
        result = agent.process(channel, {"action": "detect_trends"}, router)
    except Exception as e:
        raise HTTPException(500, f"Trend detection failed: {str(e)}")

    return result.get("output", {})


@router.post("/channels/{channel_id}/pattern-analysis")
def run_pattern_analysis(channel_id: int):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")

    ref_videos = conn.execute(
        "SELECT * FROM reference_videos WHERE channel_id = ? ORDER BY created_at DESC LIMIT 10",
        (channel_id,),
    ).fetchall()

    styles = conn.execute(
        "SELECT * FROM style_profiles WHERE channel_id = ? ORDER BY created_at DESC LIMIT 3",
        (channel_id,),
    ).fetchall()
    conn.close()

    channel_dict = dict(channel)
    ref_list = [dict(v) for v in ref_videos]
    style_list = [dict(s) for s in styles]

    try:
        from agents.reference_intelligence_agent import ReferenceIntelligenceAgent
        router = AIProviderRouter()
        agent = ReferenceIntelligenceAgent()
        result = agent.process(channel_dict, {
            "action": "analyze_patterns",
            "reference_videos": ref_list,
            "style_profiles": style_list,
        }, router)
    except Exception as e:
        raise HTTPException(500, f"Pattern analysis failed: {str(e)}")

    output = result.get("output", {})
    detected = output.get("detected_patterns", [])

    conn = get_db()
    saved = []
    for p in detected:
        cursor = conn.execute(
            "INSERT INTO pattern_library (channel_id, pattern_type, pattern_name, description, examples, effectiveness_score) VALUES (?, ?, ?, ?, ?, ?)",
            (channel_id, p.get("pattern_type", "general"), p.get("pattern_name", ""),
             p.get("description", ""), json.dumps(p),
             p.get("effectiveness_score", 0)),
        )
        saved.append({"id": cursor.lastrowid, "pattern_name": p.get("pattern_name", "")})
    conn.commit()
    conn.close()

    return {"patterns_saved": len(saved), "patterns": saved,
            "style_insights": output.get("style_insights", ""),
            "gaps_identified": output.get("gaps_identified", "")}
