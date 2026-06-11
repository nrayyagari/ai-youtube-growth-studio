import hashlib
import random
import smtplib
import time
from email.mime.text import MIMEText
from core.config import settings
from core.database import get_db

_MAX_ATTEMPTS = 3


def _hash_email(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def generate_and_send_otp(email: str) -> str:
    email_hash = _hash_email(email)
    otp = str(random.randint(100000, 999999))
    expires_at = int(time.time()) + settings.otp_expiry_seconds

    conn = get_db()
    conn.execute(
        """
        INSERT INTO otp_challenges (email_hash, otp_hash, expires_at, attempt_count)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(email_hash) DO UPDATE SET
            otp_hash = excluded.otp_hash,
            expires_at = excluded.expires_at,
            attempt_count = 0
        """,
        (email_hash, _hash_otp(otp), expires_at),
    )
    conn.commit()
    conn.close()

    _send_email(email, otp)
    return otp


def verify_otp(email: str, otp: str) -> bool:
    email_hash = _hash_email(email)
    conn = get_db()
    row = conn.execute(
        "SELECT otp_hash, expires_at, attempt_count FROM otp_challenges WHERE email_hash = ?",
        (email_hash,),
    ).fetchone()
    if not row:
        conn.close()
        return False

    now = int(time.time())
    if now > row["expires_at"] or row["attempt_count"] >= _MAX_ATTEMPTS:
        conn.execute("DELETE FROM otp_challenges WHERE email_hash = ?", (email_hash,))
        conn.commit()
        conn.close()
        return False

    if row["otp_hash"] != _hash_otp(otp):
        conn.execute(
            "UPDATE otp_challenges SET attempt_count = attempt_count + 1 WHERE email_hash = ?",
            (email_hash,),
        )
        conn.commit()
        conn.close()
        return False

    conn.execute("DELETE FROM otp_challenges WHERE email_hash = ?", (email_hash,))
    conn.commit()
    conn.close()
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
def cleanup_expired_otps() -> None:
    conn = get_db()
    conn.execute(
        "DELETE FROM otp_challenges WHERE expires_at < ?",
        (int(time.time()),),
    )
    conn.commit()
    conn.close()
