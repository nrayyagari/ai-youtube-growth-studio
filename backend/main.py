import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.database import init_db
from core.config import settings
from core.error_logger import ErrorLoggingMiddleware
from agents.health_monitor import HealthMonitor

from routes.packages import router as packages_router
from routes.reference import router as reference_router
from routes.youtube import router as youtube_router
from routes.auth_otp import router as auth_otp_router
from routes.workflows import router as workflows_router

logger = logging.getLogger(__name__)


async def health_loop():
    monitor = HealthMonitor()
    while True:
        try:
            monitor.run_hourly_check()
        except Exception as e:
            logger.error(f"HealthMonitor check failed: {e}")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(health_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="AI YouTube Growth Studio", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ErrorLoggingMiddleware)

app.include_router(packages_router)
app.include_router(reference_router)
app.include_router(youtube_router)
app.include_router(auth_otp_router)
app.include_router(workflows_router)


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


@app.post("/api/health/heal")
def heal_now():
    monitor = HealthMonitor()
    result = monitor.check_and_heal()
    return result


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        path = os.path.join(FRONTEND_DIR, full_path) if full_path else FRONTEND_DIR
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
