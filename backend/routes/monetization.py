from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.config import settings
from core.database import get_db
from core.tenancy import ensure_user, get_current_user, usage_summary

router = APIRouter(prefix="/api", tags=["monetization"])


class ClerkWebhook(BaseModel):
    id: str | None = None
    type: str = ""
    data: dict = {}


class CheckoutRequest(BaseModel):
    tier: str


@router.post("/auth/webhook")
def clerk_webhook(body: ClerkWebhook):
    data = body.data or {}
    user_id = data.get("id") or body.id
    if not user_id:
        return {"status": "ignored", "reason": "missing user id"}

    email = ""
    emails = data.get("email_addresses") or []
    if emails:
        email = emails[0].get("email_address", "")
    email = data.get("email") or email

    conn = get_db()
    ensure_user(conn, user_id, email)
    if email:
        conn.execute("UPDATE users SET email = ? WHERE id = ?", (email, user_id))
        conn.commit()
    conn.close()
    return {"status": "ok", "user_id": user_id}


@router.get("/user/me")
def user_me(request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    summary = usage_summary(conn, user)
    conn.close()
    return {
        "id": user.id,
        "email": user.email,
        "subscription_tier": user.subscription_tier,
        "usage": summary,
    }


@router.get("/user/usage")
def user_usage(request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    summary = usage_summary(conn, user)
    conn.close()
    return summary


@router.post("/stripe/checkout")
def stripe_checkout(body: CheckoutRequest, request: Request):
    tier = body.tier.lower()
    if tier not in {"pro", "agency"}:
        return {"status": "error", "detail": "tier must be pro or agency"}

    conn = get_db()
    user = get_current_user(conn, request)
    conn.close()

    price_id = settings.stripe_pro_price_id if tier == "pro" else settings.stripe_agency_price_id
    if not settings.stripe_secret_key or not price_id:
        return {
            "status": "mock",
            "checkout_url": f"{settings.app_base_url}/pricing?checkout=mock&tier={tier}",
            "tier": tier,
            "user_id": user.id,
        }

    return {
        "status": "configured",
        "checkout_url": f"{settings.app_base_url}/pricing?checkout=configured&tier={tier}",
        "tier": tier,
        "price_id": price_id,
    }


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = json.loads(payload.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        event = {}

    data = event.get("data", {}).get("object", {})
    user_id = data.get("metadata", {}).get("user_id") or data.get("client_reference_id")
    tier = data.get("metadata", {}).get("tier", "pro")
    status = data.get("status", "active")

    if not user_id:
        return {"status": "ignored", "reason": "missing user id"}

    conn = get_db()
    ensure_user(conn, user_id)
    if tier in {"free", "pro", "agency"} and status in {"active", "trialing", "complete", "paid"}:
        conn.execute("UPDATE users SET subscription_tier = ? WHERE id = ?", (tier, user_id))
    conn.execute(
        """INSERT OR REPLACE INTO subscriptions
           (id, user_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            data.get("id") or str(uuid4()),
            user_id,
            data.get("subscription") or data.get("id", ""),
            data.get("customer", ""),
            status,
            str(data.get("current_period_end", "")),
        ),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}
