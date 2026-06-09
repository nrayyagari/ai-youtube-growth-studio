from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from sqlite3 import Connection, Row

from fastapi import HTTPException, Request

LOCAL_USER_ID = "local-dev-user"

TIER_LIMITS = {
    "free": {
        "packages_per_month": 3,
        "channels": 1,
        "advanced_agents": False,
        "youtube_analytics": False,
        "batch_generate": False,
        "competitor_analysis": False,
    },
    "pro": {
        "packages_per_month": None,
        "channels": 3,
        "advanced_agents": True,
        "youtube_analytics": True,
        "batch_generate": False,
        "competitor_analysis": False,
    },
    "agency": {
        "packages_per_month": None,
        "channels": 20,
        "advanced_agents": True,
        "youtube_analytics": True,
        "batch_generate": True,
        "competitor_analysis": True,
    },
}


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    subscription_tier: str

    @property
    def limits(self) -> dict:
        return TIER_LIMITS.get(self.subscription_tier, TIER_LIMITS["free"])


def user_id_from_request(request: Request | None) -> str:
    if request is None:
        return LOCAL_USER_ID
    return (
        request.headers.get("X-Clerk-User-Id")
        or request.headers.get("X-User-Id")
        or LOCAL_USER_ID
    )


def ensure_user(conn: Connection, user_id: str, email: str = "") -> CurrentUser:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row:
        return _row_to_user(row)

    tier = "agency" if user_id == LOCAL_USER_ID else "free"
    conn.execute(
        "INSERT INTO users (id, email, subscription_tier) VALUES (?, ?, ?)",
        (user_id, email, tier),
    )
    conn.commit()
    return CurrentUser(id=user_id, email=email, subscription_tier=tier)


def get_current_user(conn: Connection, request: Request | None) -> CurrentUser:
    return ensure_user(conn, user_id_from_request(request), request.headers.get("X-Clerk-User-Email", "") if request else "")


def require_channel_access(conn: Connection, channel_id: int, user: CurrentUser) -> Row:
    row = conn.execute(
        "SELECT * FROM channels WHERE id = ? AND user_id = ?",
        (channel_id, user.id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Channel not found")
    return row


def require_package_access(conn: Connection, package_id: int, user: CurrentUser) -> Row:
    row = conn.execute(
        """SELECT vp.* FROM video_packages vp
           JOIN channels c ON c.id = vp.channel_id
           WHERE vp.id = ? AND c.user_id = ?""",
        (package_id, user.id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Package not found")
    return row


def require_channel_capacity(conn: Connection, user: CurrentUser) -> None:
    limit = user.limits["channels"]
    count = conn.execute("SELECT COUNT(*) FROM channels WHERE user_id = ?", (user.id,)).fetchone()[0]
    if limit is not None and count >= limit:
        raise HTTPException(403, f"{user.subscription_tier.title()} tier allows {limit} channel(s). Upgrade to add more.")


def require_package_capacity(conn: Connection, user: CurrentUser, amount: int = 1) -> None:
    limit = user.limits["packages_per_month"]
    if limit is None:
        return
    month_start = datetime.utcnow().strftime("%Y-%m-01")
    count = conn.execute(
        """SELECT COUNT(*) FROM video_packages vp
           JOIN channels c ON c.id = vp.channel_id
           WHERE c.user_id = ? AND vp.created_at >= ?""",
        (user.id, month_start),
    ).fetchone()[0]
    if count + amount > limit:
        raise HTTPException(403, f"Free tier allows {limit} package(s) per month. Upgrade to continue.")


def require_feature(user: CurrentUser, feature: str) -> None:
    if not user.limits.get(feature):
        raise HTTPException(403, f"{feature.replace('_', ' ').title()} requires a higher plan.")


def usage_summary(conn: Connection, user: CurrentUser) -> dict:
    month_start = datetime.utcnow().strftime("%Y-%m-01")
    channels = conn.execute("SELECT COUNT(*) FROM channels WHERE user_id = ?", (user.id,)).fetchone()[0]
    packages = conn.execute(
        """SELECT COUNT(*) FROM video_packages vp
           JOIN channels c ON c.id = vp.channel_id
           WHERE c.user_id = ? AND vp.created_at >= ?""",
        (user.id, month_start),
    ).fetchone()[0]
    return {
        "tier": user.subscription_tier,
        "channels": {"used": channels, "limit": user.limits["channels"]},
        "packages_this_month": {"used": packages, "limit": user.limits["packages_per_month"]},
        "features": {k: v for k, v in user.limits.items() if isinstance(v, bool)},
    }


def _row_to_user(row: Row) -> CurrentUser:
    tier = row["subscription_tier"] if row["subscription_tier"] in TIER_LIMITS else "free"
    return CurrentUser(id=row["id"], email=row["email"] or "", subscription_tier=tier)
