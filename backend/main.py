import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.database import get_db, init_db
from core.config import settings

from routes.channels import router as channels_router
from routes.workflows import router as workflows_router
from routes.packages import router as packages_router
from routes.reference import router as reference_router
from routes.series import router as series_router
from routes.patterns import router as patterns_router
from routes.calendar import router as calendar_router
from routes.recommendations import router as recommendations_router
from routes.analytics import router as analytics_router
from routes.tts import router as tts_router
from routes.whisper import router as whisper_router
from routes.thumbnails import router as thumbnails_router
from routes.ab_test import router as ab_test_router
from routes.youtube import router as youtube_router
from routes.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_data()
    yield


app = FastAPI(title="AI YouTube Growth Studio", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(channels_router)
app.include_router(workflows_router)
app.include_router(packages_router)
app.include_router(reference_router)
app.include_router(series_router)
app.include_router(patterns_router)
app.include_router(calendar_router)
app.include_router(recommendations_router)
app.include_router(analytics_router)
app.include_router(tts_router)
app.include_router(whisper_router)
app.include_router(thumbnails_router)
app.include_router(ab_test_router)
app.include_router(youtube_router)
app.include_router(settings_router)


@app.get("/api/health")
def health():
    from core.database import get_db
    try:
        conn = get_db()
        conn.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "database": db_ok}


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        path = os.path.join(FRONTEND_DIR, full_path) if full_path else FRONTEND_DIR
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


def _seed_data():
    conn = get_db()
    existing = conn.execute("SELECT COUNT(*) FROM workflows").fetchone()[0]
    if existing > 0:
        conn.close()
        return

    conn.execute(
        "INSERT INTO channels (name, niche, audience, target_country, language, content_mode, monetization_goal) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("CurioLab", "General Knowledge / Curiosity", "18-35 curious minds", "United States", "en", "single_video", "Ad revenue"),
    )
    conn.execute(
        "INSERT INTO channels (name, niche, audience, target_country, language, content_mode, monetization_goal) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("SmartExplainers", "AI & Tech Explainers", "20-40 tech-interested professionals", "United States", "en", "single_video", "Ad revenue + affiliate"),
    )
    conn.execute(
        "INSERT INTO channels (name, niche, audience, target_country, language, content_mode, monetization_goal) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("ProductiveDaily", "Productivity & Self-Improvement", "22-35 professionals and students", "United States", "en", "single_video", "Ad revenue"),
    )

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
