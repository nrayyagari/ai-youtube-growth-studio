import json
import datetime
from fastapi import APIRouter, HTTPException, Request
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
    package_id: int | None = None


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

    if body.package_id:
        conn = get_db()
        conn.execute(
            "UPDATE video_packages SET youtube_video_id = ? WHERE id = ?",
            (video_id, body.package_id),
        )
        conn.commit()
        conn.close()

    return {
        "youtube_video_id": video_id,
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "privacy_status": body.privacy,
        "title": body.title,
        "package_id": body.package_id,
    }


@router.post("/link-package")
def link_package_to_video(video_id: str, package_id: int):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")
    conn.execute(
        "UPDATE video_packages SET youtube_video_id = ? WHERE id = ?",
        (video_id, package_id),
    )
    conn.commit()
    conn.close()
    return {"package_id": package_id, "youtube_video_id": video_id}


@router.post("/oauth/url")
async def get_youtube_oauth_url(body: YouTubeOAuthConfig, req: Request):
    if body.redirect_uri:
        redirect_uri = body.redirect_uri
    else:
        origin = req.headers.get("origin") or req.headers.get("referer") or ""
        if origin and "://" in origin and "trycloudflare" not in origin:
            base = origin.rstrip("/")
            redirect_uri = f"{base}/api/youtube/oauth/callback"
        else:
            redirect_uri = settings.youtube_redirect_uri
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


@router.post("/learn/{package_id}")
def learn_from_performance(package_id: int):
    conn = get_db()
    package = conn.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    if not package:
        conn.close()
        raise HTTPException(404, "Package not found")

    video_id = package["youtube_video_id"]
    if not video_id:
        conn.close()
        raise HTTPException(400, "Package not linked to a YouTube video. Upload or link first.")

    cid = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_id",)).fetchone()
    secret = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_client_secret",)).fetchone()
    token = conn.execute("SELECT value FROM settings WHERE key = ?", ("youtube_refresh_token",)).fetchone()
    conn.close()

    if not token or not token["value"]:
        raise HTTPException(400, "YouTube not connected. Set up OAuth first.")

    try:
        svc = YouTubeAnalyticsService(
            cid["value"] if cid else "",
            secret["value"] if secret else "",
            token["value"],
        )
        metrics = svc.get_video_metrics(video_id)
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch video metrics: {str(e)}")

    conn = get_db()
    growth_scores = conn.execute(
        "SELECT * FROM growth_scores WHERE package_id = ?", (package_id,)
    ).fetchall()
    sections = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ?", (package_id,)
    ).fetchall()
    conn.close()

    predicted_growth = 0
    predicted_retention = 0
    predicted_ctr = 0
    for gs in growth_scores:
        if gs["category"] == "retention":
            predicted_retention = gs["score"]
        if gs["category"] == "ctr":
            predicted_ctr = gs["score"]
        predicted_growth += gs["score"]
    if growth_scores:
        predicted_growth = predicted_growth // len(growth_scores)
    if not predicted_retention:
        for s in sections:
            if s["section_type"] == "script" and s["score"] > 0:
                predicted_retention = s["score"]
    if not predicted_ctr:
        for s in sections:
            if s["section_type"] == "titles" and s["score"] > 0:
                predicted_ctr = s["score"]

    actual_views = metrics.get("views", 0)
    actual_ctr = metrics.get("ctr", 0)
    actual_retention = metrics.get("avg_view_pct", 0)
    actual_watch = metrics.get("watch_minutes", 0)
    actual_likes = metrics.get("likes", 0)
    actual_comments = metrics.get("comments", 0)

    predicted_ctr_norm = predicted_ctr / 100.0 if predicted_ctr > 0 else 0
    predicted_retention_norm = predicted_retention / 100.0 if predicted_retention > 0 else 0

    ctr_error = abs(predicted_ctr_norm - (actual_ctr / 100.0)) * 100
    retention_error = abs(predicted_retention_norm - (actual_retention / 100.0)) * 100
    accuracy = round(100 - ((ctr_error + retention_error) / 2), 1)

    engagements = actual_likes + actual_comments
    insights = []
    if ctr_error > 30:
        insights.append(f"CTR prediction off by {ctr_error:.0f}pts — title agent needs calibration")
    if retention_error > 30:
        insights.append(f"Retention prediction off by {retention_error:.0f}pts — script agent needs calibration")
    if actual_views > 0 and engagements > 0 and actual_views / engagements < 100:
        insights.append(f"Good engagement: {engagements} interactions on {actual_views} views")
    if actual_views == 0:
        insights.append("Video has no views yet — check back later for meaningful comparison")

    today = datetime.date.today().isoformat()
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM performance_learning WHERE package_id = ? AND snapshot_date = ?",
        (package_id, today),
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE performance_learning SET
               predicted_growth_score = ?, predicted_retention_score = ?,
               predicted_ctr_score = ?, actual_views = ?, actual_watch_minutes = ?,
               actual_ctr = ?, actual_retention_pct = ?,
               actual_likes = ?, actual_comments = ?,
               accuracy_score = ?, learning_insights = ?
               WHERE id = ?""",
            (predicted_growth, predicted_retention, predicted_ctr,
             actual_views, actual_watch, actual_ctr, actual_retention,
             actual_likes, actual_comments,
             accuracy, json.dumps(insights), existing["id"]),
        )
        learn_id = existing["id"]
    else:
        cursor = conn.execute(
            """INSERT INTO performance_learning
               (channel_id, package_id, youtube_video_id,
                predicted_growth_score, predicted_retention_score, predicted_ctr_score,
                actual_views, actual_watch_minutes, actual_ctr, actual_retention_pct,
                actual_likes, actual_comments, accuracy_score, learning_insights, snapshot_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (package["channel_id"], package_id, video_id,
             predicted_growth, predicted_retention, predicted_ctr,
             actual_views, actual_watch, actual_ctr, actual_retention,
             actual_likes, actual_comments, accuracy, json.dumps(insights), today),
        )
        learn_id = cursor.lastrowid

    conn.commit()
    row = conn.execute("SELECT * FROM performance_learning WHERE id = ?", (learn_id,)).fetchone()
    conn.close()

    return {
        "learning_id": learn_id,
        "package_id": package_id,
        "youtube_video_id": video_id,
        "predicted": {
            "growth_score": predicted_growth,
            "retention_score": predicted_retention,
            "ctr_score": predicted_ctr,
        },
        "actual": {
            "views": actual_views,
            "watch_minutes": actual_watch,
            "ctr_pct": actual_ctr,
            "retention_pct": actual_retention,
            "likes": actual_likes,
            "comments": actual_comments,
        },
        "accuracy_score": accuracy,
        "insights": insights,
        "video_metrics": metrics,
    }


@router.get("/learn/{channel_id}")
def list_learning_results(channel_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM performance_learning WHERE channel_id = ? ORDER BY created_at DESC",
        (channel_id,),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["learning_insights"] = json.loads(d.get("learning_insights", "[]"))
        results.append(d)
    return results


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
