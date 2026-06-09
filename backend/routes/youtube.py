import json
import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from core.database import get_db
from core.config import settings
from core.youtube_analytics import YouTubeAnalyticsService

router = APIRouter(prefix="/api/youtube", tags=["youtube"])


class YouTubeUploadRequest(BaseModel):
    title: str
    description: str = ""
    tags: list[str] = []
    privacy: str = "private"
    category_id: str = "27"


class YouTubeOAuthConfig(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: str = ""


@router.post("/upload")
def upload_video_to_youtube(body: YouTubeUploadRequest):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected. Set up OAuth first.")

    if body.privacy not in ("private", "unlisted", "public"):
        raise HTTPException(400, "Privacy must be private, unlisted, or public")

    if body.privacy == "public":
        raise HTTPException(400, "Public upload requires Commander override. Use --force-public flag.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        video_id = svc.upload_video(
            title=body.title,
            description=body.description,
            tags=body.tags,
            privacy_status=body.privacy,
            category_id=body.category_id,
        )
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    return {
        "youtube_video_id": video_id,
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "privacy_status": body.privacy,
        "title": body.title,
    }


@router.post("/oauth/url")
def get_youtube_oauth_url(body: YouTubeOAuthConfig):
    redirect_uri = body.redirect_uri or settings.youtube_redirect_uri
    if not body.client_id or not body.client_secret:
        raise HTTPException(400, "Client ID and Client Secret are required")
    try:
        auth_url = YouTubeAnalyticsService.get_auth_url(
            body.client_id, body.client_secret, redirect_uri
        )
    except Exception as e:
        raise HTTPException(500, str(e))

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_client_id", body.client_id),
    )
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_client_secret", body.client_secret),
    )
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_redirect_uri", redirect_uri),
    )
    conn.commit()
    conn.close()
    return {"auth_url": auth_url}


@router.get("/oauth/callback")
def youtube_oauth_callback(code: str, state: str = ""):
    conn = get_db()
    client_id = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)
    ).fetchone()
    client_secret = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)
    ).fetchone()
    redirect_uri_row = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_redirect_uri",)
    ).fetchone()
    conn.close()

    redirect_uri = redirect_uri_row["value"] if redirect_uri_row else settings.youtube_redirect_uri

    if not client_id or not client_secret:
        return HTMLResponse(_oauth_page("Error", "YouTube OAuth credentials not configured.", False))

    try:
        tokens = YouTubeAnalyticsService.exchange_code(
            client_id["value"], client_secret["value"],
            redirect_uri, code,
        )
    except Exception as e:
        return HTMLResponse(_oauth_page("Error", f"OAuth exchange failed: {str(e)}", False))

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("youtube_refresh_token", tokens["refresh_token"]),
    )
    conn.commit()
    conn.close()

    return HTMLResponse(_oauth_page("Connected!", "YouTube Analytics is now connected. You can close this tab and return to the app.", True))


@router.get("/oauth/status")
def youtube_oauth_status():
    conn = get_db()
    row = conn.execute(
        "SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)
    ).fetchone()
    conn.close()
    return {"connected": bool(row and row["value"])}


@router.post("/fetch/channel-stats")
def fetch_youtube_channel_stats():
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected. Run OAuth setup first.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        stats = svc.get_channel_stats()
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return stats


@router.post("/fetch/analytics")
def fetch_youtube_analytics(days: int = 30):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        analytics = svc.get_channel_analytics(days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return analytics


@router.post("/fetch/top-videos")
def fetch_top_videos(max_results: int = 10, days: int = 30):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        videos = svc.get_top_videos(max_results, days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return videos


@router.post("/fetch/demographics")
def fetch_demographics(days: int = 90):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        demos = svc.get_demographics(days)
    except Exception as e:
        raise HTTPException(500, f"Failed: {str(e)}")

    return demos


@router.post("/sync/{channel_id}")
def sync_youtube_to_snapshot(channel_id: int):
    conn = get_db()
    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        channel_stats = svc.get_channel_stats()
        if "error" in channel_stats:
            raise HTTPException(500, channel_stats["error"])

        analytics = svc.get_channel_analytics(30)
        if "error" in analytics:
            raise HTTPException(500, analytics["error"])

        demos = svc.get_demographics(90)

        snapshot_data = svc.create_snapshot_from_analytics(channel_stats, analytics)
        snapshot_data["demographics"] = json.dumps(demos)

        today = datetime.date.today().isoformat()
        conn = get_db()
        existing = conn.execute(
            "SELECT id FROM analytics_snapshots WHERE channel_id = ? AND snapshot_date = ?",
            (channel_id, today),
        ).fetchone()

        if existing:
            conn.execute(
                """UPDATE analytics_snapshots SET views = ?, watch_time_minutes = ?,
                   subscribers = ?, avg_ctr = ?, avg_retention = ?,
                   top_videos = ?, demographics = ?
                   WHERE id = ?""",
                (snapshot_data["views"], snapshot_data["watch_time_minutes"],
                 snapshot_data["subscribers"], snapshot_data["avg_ctr"],
                 snapshot_data["avg_retention"], snapshot_data["top_videos"],
                 snapshot_data["demographics"], existing["id"]),
            )
            snap_id = existing["id"]
        else:
            cursor = conn.execute(
                """INSERT INTO analytics_snapshots (channel_id, snapshot_date, views,
                   watch_time_minutes, subscribers, avg_ctr, avg_retention,
                   top_videos, demographics)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (channel_id, today, snapshot_data["views"], snapshot_data["watch_time_minutes"],
                 snapshot_data["subscribers"], snapshot_data["avg_ctr"],
                 snapshot_data["avg_retention"], snapshot_data["top_videos"],
                 snapshot_data["demographics"]),
            )
            snap_id = cursor.lastrowid

        conn.commit()
        snap = conn.execute("SELECT * FROM analytics_snapshots WHERE id = ?", (snap_id,)).fetchone()
        conn.close()

        result = dict(snap)
        result["_channel_stats"] = channel_stats
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Sync failed: {str(e)}")


def _oauth_page(title: str, message: str, success: bool) -> str:
    color = "#4ade80" if success else "#f87171"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f0f1a; color: #e0e0e0; display: flex;
         justify-content: center; align-items: center; min-height: 100vh; margin: 0; }}
  .card {{ background: #1e1e2e; border: 1px solid #333; border-radius: 12px;
           padding: 40px 48px; text-align: center; max-width: 420px; }}
  h1 {{ color: {color}; margin: 0 0 12px; font-size: 24px; }}
  p {{ color: #888; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }}
  a {{ color: #e94560; text-decoration: none; font-weight: 600; }}
</style>
</head>
<body>
<div class="card">
  <h1>{'&#10003;' if success else '&#10007;'} {title}</h1>
  <p>{message}</p>
  <p><a href="/">Back to Growth Studio</a></p>
</div>
</body>
</html>"""
