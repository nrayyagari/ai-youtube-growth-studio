import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter
from agents.ab_test_agent import ABTestAgent
from agents.repurpose_agent import RepurposeAgent

router = APIRouter(prefix="/api", tags=["ab-test", "repurpose"])


class ABTestRequest(BaseModel):
    package_id: int | None = None
    topic: str = ""
    script: str = ""


class ABTestScoreRequest(BaseModel):
    titles: list[dict] = []
    thumbnails: list[dict] = []
    performance_data: dict = {}


@router.post("/ab-test/generate")
def generate_ab_test_variants(body: ABTestRequest):
    conn = get_db()
    channel = None
    script = body.script
    if body.package_id:
        pkg = conn.execute("SELECT * FROM video_packages WHERE id = ?", (body.package_id,)).fetchone()
        if pkg:
            channel = conn.execute("SELECT * FROM channels WHERE id = ?", (pkg["channel_id"],)).fetchone()
            sections = conn.execute(
                "SELECT * FROM package_sections WHERE package_id = ? AND section_type = 'script'",
                (body.package_id,),
            ).fetchone()
            if sections and not script:
                try:
                    content = json.loads(sections["content"])
                    script = content.get("script", "")
                except Exception:
                    script = sections["content"]
    if not channel:
        channel = conn.execute("SELECT * FROM channels LIMIT 1").fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "No channels found")
    conn.close()

    try:
        router = AIProviderRouter()
        agent = ABTestAgent()
        result = agent.process(dict(channel), {
            "action": "generate_variants",
            "topic": body.topic,
            "script": script,
        }, router)
    except Exception as e:
        raise HTTPException(500, f"A/B test generation failed: {str(e)}")

    return result.get("output", {})


@router.post("/ab-test/score")
def score_ab_test_results(body: ABTestScoreRequest):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels LIMIT 1").fetchone()
    conn.close()
    if not channel:
        raise HTTPException(404, "No channels found")

    try:
        router = AIProviderRouter()
        agent = ABTestAgent()
        result = agent.process(dict(channel), {
            "action": "score_variants",
            "titles": body.titles,
            "thumbnails": body.thumbnails,
            "performance_data": body.performance_data,
        }, router)
    except Exception as e:
        raise HTTPException(500, f"A/B test scoring failed: {str(e)}")

    return result.get("output", {})


@router.post("/packages/{package_id}/repurpose")
def repurpose_package(package_id: int):
    conn = get_db()
    pkg = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not pkg:
        conn.close()
        raise HTTPException(404, "Package not found")
    if pkg["status"] not in ("APPROVED", "DRAFT"):
        conn.close()
        raise HTTPException(400, "Package must be APPROVED to repurpose")

    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (pkg["channel_id"],)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")

    sections = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ? ORDER BY id",
        (package_id,),
    ).fetchall()
    conn.close()

    script = ""
    topic = ""
    for s in sections:
        try:
            content = json.loads(s["content"])
        except Exception:
            content = {}
        if s["section_type"] == "script":
            script = content.get("script", "") or s["content"]
        elif s["section_type"] == "idea":
            topic = content.get("ideas", [{}])[0].get("topic", "") if isinstance(content.get("ideas"), list) else ""

    try:
        router = AIProviderRouter()
        agent = RepurposeAgent()
        result = agent.process(dict(channel), {
            "action": "extract_shorts",
            "script": script,
            "topic": topic or "video content",
        }, router)
    except Exception as e:
        raise HTTPException(500, f"Repurposing failed: {str(e)}")

    shorts = result.get("output", {}).get("shorts", [])
    if not shorts:
        raise HTTPException(500, "No shorts extracted from script")

    conn = get_db()
    created = []
    for short in shorts:
        cursor = conn.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status, source_package_id) VALUES (?, ?, ?, ?)",
            (pkg["channel_id"], pkg["workflow_id"], "DRAFT", package_id),
        )
        short_pkg_id = cursor.lastrowid

        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (short_pkg_id, "idea", json.dumps({"ideas": [{"topic": short.get("topic", topic)}]}), 80),
        )
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (short_pkg_id, "script", json.dumps({"script": short.get("script", "")}), 85),
        )
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (short_pkg_id, "titles", json.dumps({"titles": [{"title": short.get("title", "")}], "recommended_title": short.get("title", "")}), 80),
        )
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (short_pkg_id, "thumbnail", json.dumps({"thumbnail_concepts": [short.get("thumb_concept", {})]}), short.get("viral_potential", 80)),
        )

        created.append({
            "package_id": short_pkg_id,
            "title": short.get("title", ""),
            "viral_potential": short.get("viral_potential", 0),
        })

    conn.commit()
    conn.close()
    return {
        "source_package_id": package_id,
        "shorts_created": len(created),
        "shorts": created,
        "insight": result.get("output", {}).get("repurposing_insight", ""),
    }
