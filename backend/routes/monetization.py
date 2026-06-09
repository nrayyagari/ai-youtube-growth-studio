from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import get_db
from core.payment_router import payment_router
from core.tenancy import get_current_user, usage_summary

router = APIRouter(prefix="/api", tags=["monetization"])


class CheckoutRequest(BaseModel):
    tier: str
    provider: str = ""
    currency: str = "USD"
    country: str = "US"


def _upsert_subscription(conn, user_id: str, result: dict) -> None:
    if result["tier"] in {"free", "pro", "agency"} and result["status"] in {"active", "trialing", "complete", "paid", "authenticated"}:
        conn.execute("UPDATE users SET subscription_tier = ? WHERE id = ?", (result["tier"], user_id))
    sub_id = str(uuid4())
    conn.execute(
        """INSERT OR REPLACE INTO subscriptions
           (id, user_id, payment_provider, provider_subscription_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sub_id,
            user_id,
            result.get("provider", "stripe"),
            result.get("subscription_id", ""),
            result.get("subscription_id", "") if result.get("provider") == "stripe" else "",
            result.get("customer_id", ""),
            result["status"],
            str(result.get("current_period_end", "")),
        ),
    )
    conn.commit()


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


@router.get("/payment/providers")
def payment_providers(request: Request):
    conn = get_db()
    user = get_current_user(conn, request)
    conn.close()
    return payment_router.available(user.id)


@router.post("/payment/create-order")
async def payment_create_order(body: CheckoutRequest, request: Request):
    tier = body.tier.lower()
    if tier not in {"pro", "agency"}:
        raise HTTPException(400, "tier must be pro or agency")

    conn = get_db()
    user = get_current_user(conn, request)
    conn.close()

    provider_id = body.provider
    if not provider_id:
        provider = payment_router.route(body.currency, body.country)
    elif provider_id in payment_router.PROVIDERS:
        provider = payment_router.PROVIDERS[provider_id]
    else:
        raise HTTPException(400, f"Unknown provider: {provider_id}")

    result = await provider.create_checkout(user.id, user.email, tier)
    if result.get("status") == "error":
        raise HTTPException(500, result.get("detail", "Payment provider error"))

    return {**result, "tier": tier, "user_id": user.id}


@router.post("/stripe/checkout")
async def stripe_checkout(body: CheckoutRequest, request: Request):
    body.provider = "stripe"
    return await payment_create_order(body, request)


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    result = await payment_router.PROVIDERS["stripe"].handle_webhook(payload, dict(request.headers))
    if not result:
        return {"status": "ignored"}

    conn = get_db()
    ensure_user(conn, result["user_id"])
    _upsert_subscription(conn, result["user_id"], result)
    conn.close()
    return {"status": "ok"}


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    payload = await request.body()
    result = await payment_router.PROVIDERS["razorpay"].handle_webhook(payload, dict(request.headers))
    if not result:
        return {"status": "ignored"}

    conn = get_db()
    ensure_user(conn, result["user_id"])
    _upsert_subscription(conn, result["user_id"], result)
    conn.close()
    return {"status": "ok"}


@router.post("/paypal/webhook")
async def paypal_webhook(request: Request):
    payload = await request.body()
    result = await payment_router.PROVIDERS["paypal"].handle_webhook(payload, dict(request.headers))
    if not result:
        return {"status": "ignored"}

    conn = get_db()
    ensure_user(conn, result["user_id"])
    _upsert_subscription(conn, result["user_id"], result)
    conn.close()
    return {"status": "ok"}
