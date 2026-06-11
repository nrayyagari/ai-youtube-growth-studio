import hashlib
import hmac
import time
import json
from uuid import uuid4

from core.config import settings


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_password(password), hashed)


def create_token(user_id: str) -> str:
    payload = json.dumps({
        "user_id": user_id,
        "exp": int(time.time()) + 86400 * 30,
        "iat": int(time.time()),
    })
    signature = hmac.new(
        settings.jwt_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}.{signature}"


def verify_token(token: str) -> dict | None:
    try:
        payload_str, signature = token.rsplit(".", 1)
        expected = hmac.new(
            settings.jwt_secret.encode(),
            payload_str.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return None
        payload = json.loads(payload_str)
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def extract_user_id(request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        payload = verify_token(token)
        if payload:
            return payload["user_id"]

    if settings.dev_mode:
        return request.headers.get("X-User-Id") or ""

    return ""
