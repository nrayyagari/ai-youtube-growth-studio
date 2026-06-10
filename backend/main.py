import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.database import init_db
from core.config import settings

from routes.packages import router as packages_router
from routes.reference import router as reference_router
from routes.youtube import router as youtube_router
from routes.auth_otp import router as auth_otp_router
from routes.workflows import router as workflows_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI YouTube Growth Studio", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        path = os.path.join(FRONTEND_DIR, full_path) if full_path else FRONTEND_DIR
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
