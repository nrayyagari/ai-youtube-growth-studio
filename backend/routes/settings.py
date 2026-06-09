from fastapi import APIRouter
from pydantic import BaseModel

from core.database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


class APIKeysUpdate(BaseModel):
    gemini_api_key: str = ""
    grok_api_key: str = ""
    cerebras_api_key: str = ""


@router.get("/apikeys")
def get_api_keys():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings WHERE key LIKE '%_api_key'").fetchall()
    conn.close()
    result = {}
    for r in rows:
        val = r["value"]
        result[r["key"]] = val[:4] + "..." + val[-4:] if len(val) > 8 else ""
    return result


@router.put("/apikeys")
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
