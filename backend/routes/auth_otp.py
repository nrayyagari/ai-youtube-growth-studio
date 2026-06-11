import hashlib
import time
import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.auth import verify_token
from core.otp import cleanup_expired_otps, generate_and_send_otp, verify_otp
from core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SendOtpRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


def _create_token(email: str) -> str:
    normalized = email.strip().lower()
    email_hash = hashlib.sha256(normalized.encode()).hexdigest()[:16]
    email_provider = email.split("@")[1] if "@" in email else "unknown"
    payload = json.dumps({
        "user_id": email_hash,
        "user_hash": email_hash,
        "email_provider": email_provider,
        "created_at": int(time.time()),
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 30,  # 30 days
    })
    from core.config import settings
    import hmac

    sig = hmac.new(settings.jwt_secret.encode(), payload.encode(), "sha256").hexdigest()
    return f"{payload}.{sig}"


def decode_token(token: str) -> dict | None:
    return verify_token(token)


def _record_auth_event(event_type: str, email: str, metadata: dict | None = None) -> str:
    normalized = email.strip().lower()
    user_hash = hashlib.sha256(normalized.encode()).hexdigest()[:16]
    conn = get_db()
    conn.execute(
        "INSERT INTO auth_events (user_hash, event_type, metadata) VALUES (?, ?, ?)",
        (user_hash, event_type, json.dumps(metadata or {})),
    )
    if event_type == "login_success":
        period = time.strftime("%Y-%m-%d")
        conn.execute(
            """
            INSERT INTO login_aggregates (period, login_count, updated_at)
            VALUES (?, 1, datetime('now'))
            ON CONFLICT(period) DO UPDATE SET
                login_count = login_count + 1,
                updated_at = datetime('now')
            """,
            (period,),
        )
    conn.commit()
    conn.close()
    return user_hash


@router.post("/otp/send")
def send_otp(body: SendOtpRequest, request: Request):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Invalid email address")

    cleanup_expired_otps()
    generate_and_send_otp(email)
    _record_auth_event(
        "otp_sent",
        email,
        metadata={"ip": request.client.host if request.client else "unknown"},
    )

    return {"sent": True, "message": "If this email exists, an OTP has been sent."}


@router.post("/otp/verify")
def verify_otp_endpoint(body: VerifyOtpRequest):
    email = body.email.strip().lower()
    if not verify_otp(email, body.otp):
        _record_auth_event("login_failed", email)
        raise HTTPException(401, "Invalid or expired OTP")

    token = _create_token(email)
    user_hash = _record_auth_event("login_success", email)
    email_provider = email.split("@")[1] if "@" in email else "unknown"

    return {
        "token": token,
        "user_hash": user_hash,
        "email_provider": email_provider,
    }


@router.get("/me")
def get_me(request: Request, token: str = ""):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload
