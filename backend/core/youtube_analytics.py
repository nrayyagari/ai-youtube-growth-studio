"""
YouTube Analytics API integration using OAuth 2.0.
Handles channel stats, video metrics, and auto-sync to snapshots table.

Requires: pip install google-api-python-client google-auth-oauthlib google-auth-httplib2
"""

import json
import datetime
from typing import Optional


class YouTubeAnalyticsService:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str = ""):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self._credentials: Optional[object] = None

    @staticmethod
    def _ensure_deps():
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build
            from google_auth_oauthlib.flow import InstalledAppFlow
            return Credentials, Request, build, InstalledAppFlow
        except ImportError:
            raise ImportError(
                "YouTube Analytics requires: pip install google-api-python-client "
                "google-auth-oauthlib google-auth-httplib2"
            )

    SCOPES = [
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
    ]

    def _get_credentials(self):
        Credentials, Request, _, _ = self._ensure_deps()

        if self._credentials and self._credentials.valid:
            return self._credentials

        if not self.refresh_token:
            raise ValueError("No refresh token. Run OAuth flow first.")

        creds = Credentials(
            token=None,
            refresh_token=self.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES,
        )
        creds.refresh(Request())
        self._credentials = creds
        return creds

    @staticmethod
    def get_auth_url(client_id: str, client_secret: str, redirect_uri: str) -> str:
        _, _, _, InstalledAppFlow = YouTubeAnalyticsService._ensure_deps()

        flow = InstalledAppFlow.from_client_config(
            {
                "installed": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=YouTubeAnalyticsService.SCOPES,
        )
        flow.redirect_uri = redirect_uri
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            include_granted_scopes="true",
        )
        return auth_url

    @staticmethod
    def exchange_code(client_id: str, client_secret: str, redirect_uri: str, code: str) -> dict:
        _, _, _, InstalledAppFlow = YouTubeAnalyticsService._ensure_deps()

        flow = InstalledAppFlow.from_client_config(
            {
                "installed": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=YouTubeAnalyticsService.SCOPES,
        )
        flow.redirect_uri = redirect_uri
        flow.fetch_token(code=code)
        creds = flow.credentials
        return {
            "refresh_token": creds.refresh_token,
            "access_token": creds.token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        }

    def get_channel_stats(self) -> dict:
        Credentials, Request, build, _ = self._ensure_deps()
        creds = self._get_credentials()
        youtube = build("youtube", "v3", credentials=creds)

        try:
            resp = youtube.channels().list(
                part="statistics,snippet",
                mine=True,
            ).execute()

            if not resp.get("items"):
                return {"error": "No channel found"}

            channel = resp["items"][0]
            stats = channel.get("statistics", {})
            snippet = channel.get("snippet", {})

            return {
                "channel_id": channel["id"],
                "title": snippet.get("title", ""),
                "subscribers": int(stats.get("subscriberCount", 0)),
                "total_views": int(stats.get("viewCount", 0)),
                "video_count": int(stats.get("videoCount", 0)),
                "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
            }
        except Exception as e:
            return {"error": str(e)}

    def get_channel_analytics(self, days: int = 30) -> dict:
        _, _, build, _ = self._ensure_deps()
        creds = self._get_credentials()
        analytics = build("youtubeAnalytics", "v2", credentials=creds)

        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=days)

        try:
            resp = analytics.reports().query(
                ids="channel==MINE",
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics="views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost",
                dimensions="day",
                sort="day",
            ).execute()

            rows = resp.get("rows", [])
            if not rows:
                return {"error": "No analytics data available", "period_days": days}

            total_views = sum(r[1] for r in rows)
            total_watch_minutes = sum(r[2] for r in rows)
            avg_duration = sum(r[3] for r in rows) / len(rows) if rows else 0
            avg_pct = sum(r[4] for r in rows) / len(rows) if rows else 0
            subs_gained = sum(r[5] for r in rows)
            subs_lost = sum(r[6] for r in rows)

            return {
                "period_days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_views": total_views,
                "total_watch_minutes": round(total_watch_minutes, 1),
                "avg_view_duration_seconds": round(avg_duration, 1),
                "avg_view_percentage": round(avg_pct, 1),
                "subscribers_gained": subs_gained,
                "subscribers_lost": subs_lost,
                "subscribers_net": subs_gained - subs_lost,
                "daily_breakdown": [
                    {"date": r[0], "views": r[1], "watch_minutes": r[2],
                     "avg_duration": r[3], "avg_pct": r[4],
                     "subs_gained": r[5], "subs_lost": r[6]}
                    for r in rows
                ],
            }
        except Exception as e:
            return {"error": str(e)}

    def get_top_videos(self, max_results: int = 10, days: int = 30) -> dict:
        _, _, build, _ = self._ensure_deps()
        creds = self._get_credentials()
        analytics = build("youtubeAnalytics", "v2", credentials=creds)

        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=days)

        try:
            resp = analytics.reports().query(
                ids="channel==MINE",
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics="views,estimatedMinutesWatched,averageViewDuration",
                dimensions="video",
                maxResults=max_results,
                sort="-views",
            ).execute()

            rows = resp.get("rows", [])
            youtube = build("youtube", "v3", credentials=creds)

            videos = []
            for row in rows:
                video_id = row[0]
                try:
                    v_resp = youtube.videos().list(
                        part="snippet",
                        id=video_id,
                    ).execute()
                    title = v_resp["items"][0]["snippet"]["title"] if v_resp.get("items") else video_id
                except Exception:
                    title = video_id

                videos.append({
                    "video_id": video_id,
                    "title": title,
                    "views": row[1],
                    "watch_minutes": round(row[2], 1),
                    "avg_duration": round(row[3], 1),
                })

            return {"period_days": days, "videos": videos}
        except Exception as e:
            return {"error": str(e)}

    def get_demographics(self, days: int = 90) -> dict:
        _, _, build, _ = self._ensure_deps()
        creds = self._get_credentials()
        analytics = build("youtubeAnalytics", "v2", credentials=creds)

        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=days)

        result = {}

        try:
            age_resp = analytics.reports().query(
                ids="channel==MINE",
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics="viewerPercentage",
                dimensions="ageGroup",
                sort="-viewerPercentage",
            ).execute()
            result["age_groups"] = {
                r[0]: round(r[1], 1) for r in (age_resp.get("rows") or [])
            }
        except Exception:
            result["age_groups"] = {}

        try:
            gender_resp = analytics.reports().query(
                ids="channel==MINE",
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics="viewerPercentage",
                dimensions="gender",
            ).execute()
            result["gender"] = {
                r[0]: round(r[1], 1) for r in (gender_resp.get("rows") or [])
            }
        except Exception:
            result["gender"] = {}

        return result

    def create_snapshot_from_analytics(self, channel_stats: dict, analytics: dict) -> dict:
        estimated_ctr = 5.0
        estimated_retention = analytics.get("avg_view_percentage", 50.0)

        return {
            "views": channel_stats.get("total_views", 0),
            "watch_time_minutes": analytics.get("total_watch_minutes", 0),
            "subscribers": channel_stats.get("subscribers", 0),
            "avg_ctr": round(estimated_ctr, 1),
            "avg_retention": round(estimated_retention, 1),
            "top_videos": json.dumps(analytics.get("daily_breakdown", [])),
            "demographics": "{}",
        }
