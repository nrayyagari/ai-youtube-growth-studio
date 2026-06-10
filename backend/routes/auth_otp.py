import hashlib
import hmac
import time
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.config import settings
from core.otp import generate_and_send_otp, verify_otp
from core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SendOtpRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


def _create_token(email: str) -> str:
    email_hash = hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]
    email_provider = email.split("@")[1] if "@" in email else "unknown"
    payload = {
        "user_hash": email_hash,
        "email_provider": email_provider,
        "created_at": int(time.time()),
        "exp": int(time.time()) + 86400 * 30,  # 30 days
    }
    payload_b64 = json.dumps(payload).encode()
    sig = hmac.new(settings.jwt_secret.encode(), payload_b64, "sha256").hexdigest()
    return payload_b64.hex() + "." + sig


def decode_token(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_bytes = bytes.fromhex(parts[0])
        sig = hmac.new(settings.jwt_secret.encode(), payload_bytes, "sha256").hexdigest()
        if not hmac.compare_digest(sig, parts[1]):
            return None
        payload = json.loads(payload_bytes)
        if time.time() > payload.get("exp", 0):
            return None
        return payload
    except Exception:
        return None


@router.post("/otp/send")
def send_otp(body: SendOtpRequest):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Invalid email address")

    generate_and_send_otp(email)

    conn = get_db()
    conn.execute(
        "INSERT INTO usage_stats (event_type, user_hash) VALUES (?, ?)",
        ("otp_sent", hashlib.sha256(email.encode()).hexdigest()[:16]),
    )
    conn.commit()
    conn.close()

    return {"sent": True, "message": "If this email exists, an OTP has been sent."}


@router.post("/otp/verify")
def verify_otp_endpoint(body: VerifyOtpRequest):
    email = body.email.strip().lower()
    if not verify_otp(email, body.otp):
        raise HTTPException(401, "Invalid or expired OTP")

    token = _create_token(email)

    conn = get_db()
    conn.execute(
        "INSERT INTO usage_stats (event_type, user_hash) VALUES (?, ?)",
        ("user_login", hashlib.sha256(email.encode()).hexdigest()[:16]),
    )
    conn.commit()
    conn.close()

    user_hash = hashlib.sha256(email.encode()).hexdigest()[:16]
    email_provider = email.split("@")[1] if "@" in email else "unknown"

    return {
        "token": token,
        "user_hash": user_hash,
        "email_provider": email_provider,
    }


@router.get("/me")
def get_me(token: str = ""):
    from fastapi import Header

    # Token can come as query param or Authorization header
    # We handle header in the route dependency — keeping it simple
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload
