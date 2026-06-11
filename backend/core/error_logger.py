import json
import traceback as tb
import sqlite3
import re
from pathlib import Path
from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

DB_PATH = Path("data") / "stats.db"
_SECRET_PATTERNS = [
    re.compile(r"(Bearer\s+)([A-Za-z0-9._-]+)", re.IGNORECASE),
    re.compile(r'("?(?:api[_-]?key|token|refresh_token|access_token|client_secret|authorization)"?\s*[:=]\s*"?)([^",\s}]+)', re.IGNORECASE),
]


def redact_secrets(value: str) -> str:
    redacted = value
    for pattern in _SECRET_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]", redacted)
    return redacted


def log_error(error_type: str, error_message: str, traceback_str: str = "",
              agent_name: str = "", metadata: dict | None = None) -> int:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute(
            """INSERT INTO ops_error_logs (error_type, error_message, traceback, agent_name, metadata)
               VALUES (?, ?, ?, ?, ?)""",
            (
                error_type,
                redact_secrets(error_message)[:1000],
                redact_secrets(traceback_str)[:5000],
                agent_name,
                json.dumps(metadata or {}),
            ),
        )
        conn.commit()
        row_id = conn.lastrowid or 0
        conn.close()
        return row_id
    except Exception:
        return 0


def get_unfixed_errors(limit: int = 20) -> list[dict]:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM ops_error_logs WHERE fixed_by_agent = 0 ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def mark_fixed(error_id: int, fix_description: str) -> None:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute(
            "UPDATE ops_error_logs SET fixed_by_agent = 1, fix_applied = ? WHERE id = ?",
            (fix_description[:500], error_id),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            if response.status_code >= 500:
                log_error(
                    error_type=f"HTTP_{response.status_code}",
                    error_message=f"{request.method} {request.url.path} returned {response.status_code}",
                    agent_name="http",
                )
            return response
        except HTTPException:
            raise
        except Exception as e:
            body_preview = ""
            if request.method in {"POST", "PUT", "PATCH"}:
                try:
                    raw_body = await request.body()
                    body_preview = redact_secrets(raw_body.decode("utf-8", errors="ignore")[:1000])
                except Exception:
                    body_preview = ""
            log_error(
                error_type=type(e).__name__,
                error_message=str(e),
                traceback_str=tb.format_exc(),
                agent_name="http",
                metadata={
                    "path": str(request.url.path),
                    "method": request.method,
                    "body_preview": body_preview,
                },
            )
            return Response(
                content=json.dumps({"detail": "Internal server error"}),
                status_code=500,
                media_type="application/json",
            )
