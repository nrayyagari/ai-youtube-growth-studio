from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.auth import hash_password, verify_password, create_token, extract_user_id
from core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(body: SignupRequest):
    email = body.email.strip().lower()
    if not email or "@" not in email or len(body.password) < 6:
        raise HTTPException(400, "Invalid email or password (min 6 chars).")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(409, "An account with this email already exists.")

    user_id = str(uuid4())
    conn.execute(
        "INSERT INTO users (id, email, password_hash, subscription_tier) VALUES (?, ?, ?, ?)",
        (user_id, email, hash_password(body.password), "free"),
    )
    conn.commit()
    conn.close()

    token = create_token(user_id)
    return {"token": token, "user_id": user_id, "email": email, "subscription_tier": "free"}


@router.post("/login")
def login(body: LoginRequest):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(400, "Email and password required.")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password.")

    token = create_token(row["id"])
    return {
        "token": token,
        "user_id": row["id"],
        "email": row["email"],
        "subscription_tier": row["subscription_tier"],
    }
