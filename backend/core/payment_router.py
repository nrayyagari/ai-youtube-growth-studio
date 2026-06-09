from __future__ import annotations

import json
import hashlib
import hmac
import httpx
from uuid import uuid4

from core.config import settings


class PaymentProvider:
    async def create_checkout(self, user_id: str, email: str, tier: str) -> dict:
        raise NotImplementedError

    async def handle_webhook(self, payload: bytes, headers: dict) -> dict | None:
        raise NotImplementedError

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        raise NotImplementedError


class StripeProvider(PaymentProvider):
    async def create_checkout(self, user_id: str, email: str, tier: str) -> dict:
        if not settings.stripe_secret_key:
            return {"status": "mock", "provider": "stripe", "detail": "Stripe keys not configured"}

        price_id = settings.stripe_pro_price_id if tier == "pro" else settings.stripe_agency_price_id
        if not price_id:
            return {"status": "mock", "provider": "stripe", "detail": "Price ID not configured"}

        url = "https://api.stripe.com/v1/checkout/sessions"
        body = {
            "mode": "subscription",
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": "1",
            "success_url": f"{settings.app_base_url}/dashboard?checkout=success",
            "cancel_url": f"{settings.app_base_url}/pricing?checkout=cancel",
            "client_reference_id": user_id,
            "customer_email": email,
            "metadata[user_id]": user_id,
            "metadata[tier]": tier,
        }

        r = httpx.post(
            url,
            data=body,
            auth=(settings.stripe_secret_key, ""),
            headers={"Stripe-Version": "2025-02-24.acacia"},
            timeout=30,
        )

        if r.status_code != 200:
            return {"status": "error", "provider": "stripe", "detail": r.text[:500]}

        data = r.json()
        return {
            "status": "ok",
            "provider": "stripe",
            "checkout_url": data.get("url", ""),
            "session_id": data.get("id", ""),
        }

    async def handle_webhook(self, payload: bytes, headers: dict) -> dict | None:
        sig = headers.get("stripe-signature", "")
        if settings.stripe_webhook_secret and not self.verify_signature(payload, sig):
            return None

        try:
            event = json.loads(payload.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return None

        event_type = event.get("type", "")
        if event_type not in ("checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"):
            return None

        obj = event.get("data", {}).get("object", {})
        user_id = obj.get("metadata", {}).get("user_id") or obj.get("client_reference_id")
        if not user_id:
            return None

        tier = obj.get("metadata", {}).get("tier", "pro")
        status = obj.get("status", "active")
        sub_id = obj.get("subscription") or obj.get("id", "")
        customer_id = obj.get("customer", "")

        return {
            "user_id": user_id,
            "tier": tier,
            "status": status,
            "provider": "stripe",
            "subscription_id": sub_id,
            "customer_id": customer_id,
            "current_period_end": obj.get("current_period_end", ""),
        }

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        if not settings.stripe_webhook_secret:
            return True
        try:
            import stripe
            stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
            return True
        except Exception:
            return False


class RazorpayProvider(PaymentProvider):
    async def create_checkout(self, user_id: str, email: str, tier: str) -> dict:
        if not settings.razorpay_key_id or not settings.razorpay_key_secret:
            return {"status": "mock", "provider": "razorpay", "detail": "Razorpay keys not configured"}

        plan_id = settings.razorpay_pro_plan_id if tier == "pro" else settings.razorpay_agency_plan_id
        if not plan_id:
            return {"status": "mock", "provider": "razorpay", "detail": "Plan ID not configured"}

        url = "https://api.razorpay.com/v1/subscriptions"
        body = {
            "plan_id": plan_id,
            "total_count": 60,
            "customer_notify": 1,
            "notes": {"user_id": user_id, "tier": tier},
        }

        r = httpx.post(url, json=body, auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=30)

        if r.status_code not in (200, 201):
            return {"status": "error", "provider": "razorpay", "detail": r.text[:500]}

        data = r.json()
        return {
            "status": "ok",
            "provider": "razorpay",
            "checkout_url": data.get("short_url", ""),
            "subscription_id": data.get("id", ""),
            "key_id": settings.razorpay_key_id,
        }

    async def handle_webhook(self, payload: bytes, headers: dict) -> dict | None:
        sig = headers.get("x-razorpay-signature", "")
        if settings.razorpay_webhook_secret and not self.verify_signature(payload, sig):
            return None

        try:
            event = json.loads(payload.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return None

        event_type = event.get("event", "")
        if event_type not in ("subscription.charged", "subscription.activated", "subscription.cancelled"):
            return None

        sub = event.get("payload", {}).get("subscription", {}).get("entity", {})
        notes = sub.get("notes", {})
        user_id = notes.get("user_id", "")
        if not user_id:
            return None

        tier = notes.get("tier", "pro")
        status = "active" if sub.get("status") in ("active", "authenticated") else "inactive"

        return {
            "user_id": user_id,
            "tier": tier,
            "status": status,
            "provider": "razorpay",
            "subscription_id": sub.get("id", ""),
            "customer_id": sub.get("customer_id", ""),
            "current_period_end": sub.get("current_end", ""),
        }

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        if not settings.razorpay_webhook_secret:
            return True
        expected = hmac.new(
            settings.razorpay_webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class PayPalProvider(PaymentProvider):
    async def _get_access_token(self) -> str:
        url = "https://api-m.paypal.com/v1/oauth2/token" if settings.paypal_client_id and "sb-" not in settings.paypal_client_id else "https://api-m.sandbox.paypal.com/v1/oauth2/token"
        r = httpx.post(url, data={"grant_type": "client_credentials"}, auth=(settings.paypal_client_id, settings.paypal_client_secret), timeout=30)
        if r.status_code != 200:
            raise Exception(f"PayPal auth failed: {r.text[:200]}")
        return r.json()["access_token"]

    async def create_checkout(self, user_id: str, email: str, tier: str) -> dict:
        if not settings.paypal_client_id or not settings.paypal_client_secret:
            return {"status": "mock", "provider": "paypal", "detail": "PayPal keys not configured"}

        plan_id = settings.paypal_pro_plan_id if tier == "pro" else settings.paypal_agency_plan_id
        if not plan_id:
            return {"status": "mock", "provider": "paypal", "detail": "Plan ID not configured"}

        try:
            token = await self._get_access_token()
        except Exception as e:
            return {"status": "error", "provider": "paypal", "detail": str(e)}

        base = "https://api-m.sandbox.paypal.com" if "sb-" in settings.paypal_client_id else "https://api-m.paypal.com"
        url = f"{base}/v1/billing/subscriptions"
        body = {
            "plan_id": plan_id,
            "subscriber": {"name": {"given_name": email.split("@")[0] if email else "User"}, "email_address": email},
            "application_context": {
                "brand_name": "Growth Studio",
                "user_action": "SUBSCRIBE_NOW",
                "return_url": f"{settings.app_base_url}/dashboard?checkout=success",
                "cancel_url": f"{settings.app_base_url}/pricing?checkout=cancel",
            },
            "custom_id": user_id,
        }

        r = httpx.post(url, json=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=30)

        if r.status_code not in (200, 201):
            return {"status": "error", "provider": "paypal", "detail": r.text[:500]}

        data = r.json()
        approve_url = ""
        for link in data.get("links", []):
            if link.get("rel") == "approve":
                approve_url = link.get("href", "")
                break

        return {
            "status": "ok",
            "provider": "paypal",
            "checkout_url": approve_url,
            "subscription_id": data.get("id", ""),
        }

    async def handle_webhook(self, payload: bytes, headers: dict) -> dict | None:
        try:
            event = json.loads(payload.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return None

        event_type = event.get("event_type", "")
        if event_type not in ("BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED"):
            return None

        resource = event.get("resource", {})
        user_id = resource.get("custom_id", "")
        if not user_id:
            return None

        status = "active" if event_type == "BILLING.SUBSCRIPTION.ACTIVATED" else "inactive"

        return {
            "user_id": user_id,
            "tier": resource.get("plan_id", ""),
            "status": status,
            "provider": "paypal",
            "subscription_id": resource.get("id", ""),
            "customer_id": resource.get("subscriber", {}).get("payer_id", ""),
            "current_period_end": resource.get("billing_info", {}).get("next_billing_time", ""),
        }

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        return True


class PaymentRouter:
    PROVIDERS: dict[str, PaymentProvider] = {
        "stripe": StripeProvider(),
        "razorpay": RazorpayProvider(),
        "paypal": PayPalProvider(),
    }

    def route(self, currency: str = "USD", country: str = "US") -> PaymentProvider:
        if currency == "INR":
            return self.PROVIDERS["razorpay"]
        if country in ("US", "CA", "GB", "AU", "DE", "FR", "IT", "ES", "NL", "SE", "CH", "AT", "BE", "IE", "PT", "NO", "DK", "FI"):
            return self.PROVIDERS["stripe"]
        return self.PROVIDERS["paypal"]

    def available(self, user_id: str) -> list[dict]:
        providers = []
        if settings.stripe_secret_key:
            providers.append({"id": "stripe", "name": "Card / Stripe", "regions": ["US", "EU", "Global"]})
        if settings.razorpay_key_id:
            providers.append({"id": "razorpay", "name": "Razorpay", "regions": ["India"], "methods": ["UPI", "NetBanking", "Cards"]})
        if settings.paypal_client_id:
            providers.append({"id": "paypal", "name": "PayPal", "regions": ["Global"]})
        return providers


payment_router = PaymentRouter()
