import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from core.config import settings
from core.youtube_analytics import YouTubeAnalyticsService

router = APIRouter(prefix="/api/youtube", tags=["youtube"])


class YouTubeOAuthConfig(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: str = ""


@router.post("/oauth/url")
async def get_youtube_oauth_url(body: YouTubeOAuthConfig, req: Request):
    if body.redirect_uri:
        redirect_uri = body.redirect_uri
    else:
        origin = req.headers.get("origin") or req.headers.get("referer") or ""
        if origin and "://" in origin:
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

    return {"auth_url": auth_url, "redirect_uri": redirect_uri}


@router.get("/oauth/callback")
def youtube_oauth_callback(code: str, state: str = ""):
    # We don't store client credentials server-side anymore.
    # The client sends them, then the redirect comes back.
    # For stateless OAuth, the frontend handles the redirect URL.
    # This endpoint is kept for the redirect target.
    return HTMLResponse(_oauth_page(
        "Authorization Received",
        "You can close this tab and return to the app. "
        "The authorization code has been sent to the redirect URI.",
        True,
    ))


@router.post("/exchange-code")
def exchange_code(body: dict):
    client_id = body.get("client_id", "")
    client_secret = body.get("client_secret", "")
    redirect_uri = body.get("redirect_uri", settings.youtube_redirect_uri)
    code = body.get("code", "")

    if not client_id or not client_secret or not code:
        raise HTTPException(400, "client_id, client_secret, and code are required")

    try:
        tokens = YouTubeAnalyticsService.exchange_code(
            client_id, client_secret, redirect_uri, code
        )
    except Exception as e:
        raise HTTPException(500, f"OAuth exchange failed: {str(e)}")

    return {
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
        "expires_in": tokens.get("expires_in", 3600),
    }


class FetchVideosRequest(BaseModel):
    refresh_token: str
    client_id: str = ""
    client_secret: str = ""
    max_results: int = 10


@router.post("/my-recent-videos")
def fetch_my_recent_videos(body: FetchVideosRequest):
    cid = body.client_id or settings.youtube_client_id
    secret = body.client_secret or settings.youtube_client_secret

    if not cid or not secret:
        raise HTTPException(400, "YouTube Client ID and Secret not configured")

    if not body.refresh_token:
        raise HTTPException(400, "No refresh token provided. Connect YouTube first.")

    try:
        svc = YouTubeAnalyticsService(cid, secret, body.refresh_token)
        videos = svc.get_top_videos(body.max_results, 30)
        channel_stats = svc.get_channel_stats()
        analytics = svc.get_channel_analytics(30)
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch YouTube data: {str(e)}")

    return {
        "videos": videos if isinstance(videos, list) else [],
        "channel_stats": channel_stats if isinstance(channel_stats, dict) else {},
        "analytics": analytics if isinstance(analytics, dict) else {},
    }


@router.post("/oauth/status")
def youtube_oauth_status(body: dict):
    refresh_token = body.get("refresh_token", "")
    cid = body.get("client_id", "") or settings.youtube_client_id
    secret = body.get("client_secret", "") or settings.youtube_client_secret

    if not refresh_token or not cid or not secret:
        return {"connected": False}

    try:
        svc = YouTubeAnalyticsService(cid, secret, refresh_token)
        svc.get_channel_stats()
        return {"connected": True}
    except Exception:
        return {"connected": False}


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
