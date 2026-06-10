import hashlib
import random
import smtplib
import time
import threading
from email.mime.text import MIMEText
from core.config import settings

_otp_store: dict[str, dict] = {}
_lock = threading.Lock()
_MAX_ATTEMPTS = 3


def _hash_email(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]


def generate_and_send_otp(email: str) -> str:
    email_hash = _hash_email(email)
    otp = str(random.randint(100000, 999999))

    with _lock:
        _otp_store[email_hash] = {
            "otp": otp,
            "expires_at": time.time() + settings.otp_expiry_seconds,
            "attempts": 0,
        }

    _send_email(email, otp)
    return otp


def verify_otp(email: str, otp: str) -> bool:
    email_hash = _hash_email(email)
    with _lock:
        entry = _otp_store.get(email_hash)
        if not entry:
            return False
        if time.time() > entry["expires_at"]:
            del _otp_store[email_hash]
            return False
        if entry["attempts"] >= _MAX_ATTEMPTS:
            del _otp_store[email_hash]
            return False
        if entry["otp"] != otp:
            entry["attempts"] += 1
            return False
        del _otp_store[email_hash]
        return True


def _send_email(to_email: str, otp: str) -> None:
    subject = "Your Growth Studio Login Code"
    body = f"""Your one-time login code is:

{otp}

This code expires in {settings.otp_expiry_seconds // 60} minutes.

If you didn't request this, you can ignore this email.
"""

    # Prefer Resend API
    if settings.resend_api_key:
        _send_via_resend(to_email, subject, body)
        return

    # Fallback to SMTP
    if settings.smtp_host:
        _send_via_smtp(to_email, subject, body)
        return

    # Dev mode: print to console
    if settings.dev_mode:
        print(f"\n[DEV OTP] To: {to_email} | Code: {otp}\n")


def _send_via_resend(to_email: str, subject: str, body: str) -> None:
    import httpx

    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.email_from,
            "to": to_email,
            "subject": subject,
            "text": body,
        },
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        print(f"[EMAIL ERROR] Resend: {resp.status_code} {resp.text}")


def _send_via_smtp(to_email: str, subject: str, body: str) -> None:
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.email_from, [to_email], msg.as_string())
    except Exception as e:
        print(f"[EMAIL ERROR] SMTP: {e}")


def _cleanup_worker():
    while True:
        time.sleep(60)
        with _lock:
            now = time.time()
            expired = [k for k, v in _otp_store.items() if now > v["expires_at"]]
            for k in expired:
                del _otp_store[k]


_cleanup_thread = threading.Thread(target=_cleanup_worker, daemon=True)
_cleanup_thread.start()
