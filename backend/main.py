import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os

from core.database import get_db, init_db
from core.config import settings
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError

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
