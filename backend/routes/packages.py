import json
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError

router = APIRouter(prefix="/api", tags=["packages"])

SECTION_TO_AGENT = {
    "idea": "idea", "script": "script", "visual": "visual",
    "music": "music", "titles": "title", "thumbnail": "thumbnail", "qa_report": "qa",
}


class GenerateRequest(BaseModel):
    channel_id: int
    workflow_id: int
    topic: str = ""


class RegenerateRequest(BaseModel):
    sections: list[str] = []


class ApproveRequest(BaseModel):
    override: bool = False


@router.post("/generate")
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
        score = _section_score(section_type, result["approval"].get("scores", {}))
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


@router.post("/packages/{package_id}/regenerate")
def regenerate_package(package_id: int, body: RegenerateRequest | None = None):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")

    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (package["channel_id"],)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")

    sections_to_regenerate = set(body.sections) if body and body.sections else None
    if sections_to_regenerate is None:
        existing_sections = conn.execute(
            "SELECT * FROM package_sections WHERE package_id = ?", (package_id,)
        ).fetchall()
        passing = {s["section_type"] for s in existing_sections if s["score"] >= 85 and s["score"] > 0}
        all_sections = {s["section_type"] for s in existing_sections}
        if passing == all_sections and all_sections:
            passing = set()
        if not existing_sections:
            passing = set()
    else:
        all_sections = {"idea", "script", "visual", "music", "titles", "thumbnail", "qa_report"}
        passing = all_sections - sections_to_regenerate
    conn.close()

    channel_dict = dict(channel)
    agent_skip = {SECTION_TO_AGENT.get(s, s) for s in passing}

    correction_prompts = {}
    if passing:
        existing_sections_all = conn.execute(
            "SELECT * FROM package_sections WHERE package_id = ?", (package_id,)
        ).fetchall()
        conn.close()
        for s in existing_sections_all:
            if s["section_type"] not in passing and s["score"] > 0:
                agent_name = SECTION_TO_AGENT.get(s["section_type"], "")
                if agent_name:
                    gap = 85 - s["score"]
                    correction_prompts[agent_name] = (
                        f"[FIX REQUIRED] Previous {s['section_type']} scored {s['score']}/100 "
                        f"(need 85, missing {gap} points). "
                        f"Regenerate this section with a stronger focus on quality. "
                        f"Maintain all other quality dimensions."
                    )
    else:
        conn.close()

    try:
        router = AIProviderRouter()
        pipeline = PipelineRunner(router)
        result = pipeline.run(channel_dict, "", skip_sections=agent_skip,
                              correction_prompts=correction_prompts if correction_prompts else None)
    except PipelineError as e:
        raise HTTPException(500, f"Pipeline failed at {e.agent_name}: {e.detail}")
    except AllProvidersExhausted as e:
        raise HTTPException(429, str(e))

    status = result["approval"]["status"]
    conn = get_db()
    conn.execute(
        "UPDATE video_packages SET status = ? WHERE id = ?",
        (status, package_id),
    )

    for section in result["sections"]:
        section_type = section.get("section_type", "")
        content = json.dumps(section.get("output", {}))
        score = _section_score(section_type, result["approval"].get("scores", {}))

        existing = conn.execute(
            "SELECT id FROM package_sections WHERE package_id = ? AND section_type = ?",
            (package_id, section_type),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE package_sections SET content = ?, score = ? WHERE id = ?",
                (content, score, existing["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
                (package_id, section_type, content, score),
            )

    conn.execute("DELETE FROM growth_scores WHERE package_id = ?", (package_id,))
    for category, score in result["approval"]["scores"].items():
        if category.startswith("idea_"):
            conn.execute(
                "INSERT INTO growth_scores (package_id, category, score, explanation) VALUES (?, ?, ?, ?)",
                (package_id, category.replace("idea_", ""), score, "Auto-scored by Idea Agent"),
            )

    conn.execute("DELETE FROM qa_reports WHERE package_id = ?", (package_id,))
    if result["approval"]["failing"] or result["approval"]["status"] != "APPROVED":
        conn.execute(
            "INSERT INTO qa_reports (package_id, check_type, score, status, details) VALUES (?, ?, ?, ?, ?)",
            (package_id, "overall", result["approval"]["scores"].get("copyright_safety", 0),
             "FAIL" if result["approval"]["failing"] else "PASS",
             json.dumps(result["approval"]["corrections"])),
        )

    conn.commit()
    conn.close()

    return {"package_id": package_id, "status": status, "approval": result["approval"]}


@router.post("/packages/{package_id}/approve")
def approve_package(package_id: int, body: ApproveRequest | None = None):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")

    if body and body.override:
        conn.execute("UPDATE video_packages SET status = 'APPROVED' WHERE id = ?", (package_id,))
        conn.commit()
        conn.close()
        return {"package_id": package_id, "status": "APPROVED", "override": True}

    scores = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ?", (package_id,)
    ).fetchall()

    all_good = all(s["score"] >= 85 for s in scores if s["score"] > 0)
    if not all_good:
        conn.close()
        raise HTTPException(400, "Not all sections meet threshold. Use override=true to force approval.")

    conn.execute("UPDATE video_packages SET status = 'APPROVED' WHERE id = ?", (package_id,))
    conn.commit()
    conn.close()
    return {"package_id": package_id, "status": "APPROVED", "override": False}


@router.get("/packages")
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


@router.get("/packages/{package_id}")
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


@router.delete("/packages/{package_id}")
def delete_package(package_id: int):
    conn = get_db()
    conn.execute("DELETE FROM video_packages WHERE id = ?", (package_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


def _section_score(section_type: str, scores: dict) -> int:
    mapping = {
        "idea": "growth_score",
        "script": "script_score",
        "visual": "visual_score",
        "titles": "title_score",
        "thumbnail": "thumbnail_score",
        "music": "music_score",
        "qa_report": "qa_overall",
    }
    return scores.get(mapping.get(section_type, ""), 0)


class StreamGenerateRequest(BaseModel):
    channel_id: int
    workflow_id: int
    topic: str = ""


@router.post("/generate/stream")
async def generate_package_stream(body: StreamGenerateRequest):
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

    async def event_stream():
        queue = asyncio.Queue()

        def on_progress(event: dict):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

        pipeline = PipelineRunner(AIProviderRouter())
        events_sent = 0

        try:
            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(pipeline.run, channel_dict, body.topic, None, on_progress)

            while not future.done() or not queue.empty():
                try:
                    event = queue.get_nowait()
                    events_sent += 1
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0.1)

            result = future.result()
            status = result["approval"]["status"]

            db = get_db()
            cursor = db.execute(
                "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
                (body.channel_id, body.workflow_id, status),
            )
            package_id = cursor.lastrowid

            for section in result["sections"]:
                section_type = section.get("section_type", "")
                content = json.dumps(section.get("output", {}))
                score = _section_score(section_type, result["approval"].get("scores", {}))
                db.execute(
                    "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
                    (package_id, section_type, content, score),
                )

            for category, score in result["approval"]["scores"].items():
                if category.startswith("idea_"):
                    db.execute(
                        "INSERT INTO growth_scores (package_id, category, score, explanation) VALUES (?, ?, ?, ?)",
                        (package_id, category.replace("idea_", ""), score, "Auto-scored by Idea Agent"),
                    )

            db.commit()
            db.close()

            yield f"data: {json.dumps({'agent': 'complete', 'status': 'done', 'package_id': package_id, 'approval_status': status, 'scores': result['approval'].get('scores', {})})}\n\n"

        except PipelineError as e:
            yield f"data: {json.dumps({'agent': e.agent_name, 'status': 'error', 'error': e.detail})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': 'pipeline', 'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/packages/{package_id}/export")
def export_package(package_id: int, format: str = "md"):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")

    channel = conn.execute("SELECT id, name, niche, audience FROM channels WHERE id = ?",
                           (package["channel_id"],)).fetchone()
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

    channel_name = channel["name"] if channel else "Unknown"
    created = package["created_at"] if package["created_at"] else ""

    md = f"""# Video Package #{package_id}

**Channel:** {channel_name}  
**Status:** {package['status']}  
**Created:** {created}

---

"""

    for s in sections:
        title = s["section_type"].replace("_", " ").title()
        md += f"## {title} (Score: {s['score']})\n\n"
        try:
            content = json.loads(s["content"])
        except Exception:
            content = s["content"]

        if s["section_type"] == "idea":
            ideas = content.get("ideas", [])
            for idea in ideas[:3]:
                md += f"- **Topic:** {idea.get('topic', 'N/A')}\n"
                if idea.get("score"):
                    md += f"  - Growth Score: {idea['score'].get('total', 'N/A')}\n"
        elif s["section_type"] == "script":
            md += f"**Hook:** {content.get('hook', 'N/A')}\n\n"
            md += f"**Tone:** {content.get('tone', 'N/A')}\n\n"
            md += f"```\n{content.get('script', 'N/A')[:5000]}\n```\n\n"
        elif s["section_type"] == "titles":
            titles = content.get("titles", [])
            for t in titles[:5]:
                md += f"- {t.get('title', 'N/A')} *(CTR: {t.get('predicted_ctr', 'N/A')})*\n"
            rec = content.get("recommended_title", "")
            if rec:
                md += f"\n**Recommended:** {rec}\n"
            seo = content.get("seo", {})
            if seo:
                md += f"\n**Tags:** {', '.join(seo.get('tags', [])[:10])}\n"
        elif s["section_type"] == "visual":
            scenes = content.get("scenes", [])
            for scene in scenes[:5]:
                md += f"- **{scene.get('scene_number', '')}:** {scene.get('description', '')[:200]}\n"
        elif s["section_type"] == "music":
            suggestions = content.get("music_suggestions", [])
            for m in suggestions:
                md += f"- {m.get('mood', '')} / {m.get('genre', '')} — {m.get('source', '')}\n"
        elif s["section_type"] == "thumbnail":
            concepts = content.get("thumbnail_concepts", [])
            for c in concepts:
                md += f"- **{c.get('concept_name', '')}:** {c.get('description', '')[:300]}\n"
        elif s["section_type"] == "qa_report":
            checks = content.get("checks", [])
            for check in checks:
                icon = "PASS" if check.get("status") == "PASS" else "FAIL"
                md += f"- [{icon}] **{check.get('type', '')}** (Score: {check.get('score')}): {check.get('details', '')}\n"
        else:
            md += f"```json\n{json.dumps(content, indent=2)[:2000]}\n```\n"
        md += "\n---\n\n"

    if scores:
        md += "## Growth Scores\n\n"
        for sc in scores:
            md += f"- **{sc['category']}:** {sc['score']} — {sc.get('explanation', '')}\n"

    if qa:
        md += "\n## QA Reports\n\n"
        for q in qa:
            md += f"- **{q['check_type']}** [{q['status']}]: Score {q['score']}\n"

    if format == "md":
        return Response(content=md, media_type="text/markdown",
                        headers={"Content-Disposition": f"attachment; filename=package_{package_id}.md"})

    if format == "txt":
        plain = md.replace("#", "").replace("*", "").replace("`", "")
        return Response(content=plain, media_type="text/plain",
                        headers={"Content-Disposition": f"attachment; filename=package_{package_id}.txt"})

    return {"format": format, "content": md}
