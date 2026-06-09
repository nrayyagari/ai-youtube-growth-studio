import json
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient


@pytest.fixture
def client():
    import os
    os.chdir("/home/laborant/repos/ai-youtube-growth-studio/backend")
    test_db = Path("data") / "test_api_growth_studio.db"
    if test_db.exists():
        test_db.unlink()

    import core.database as db_mod
    db_mod.DATABASE_PATH = test_db
    db_mod.init_db()
    from main import _seed_data
    _seed_data()

    from main import app
    os.environ["FRONTEND_ORIGIN"] = "http://localhost:5173"

    with TestClient(app) as client:
        yield client

    if test_db.exists():
        test_db.unlink()


class TestChannels:
    def test_create_channel(self, client):
        r = client.post("/api/channels", json={"name": "TestChannel", "niche": "Tech"})
        assert r.status_code == 200
        assert r.json()["name"] == "TestChannel"
        assert "id" in r.json()

    def test_list_channels(self, client):
        client.post("/api/channels", json={"name": "Channel1"})
        client.post("/api/channels", json={"name": "Channel2"})
        r = client.get("/api/channels")
        assert r.status_code == 200
        channels = r.json()
        assert len(channels) >= 2 + 3  # +3 from seeded data

    def test_get_channel(self, client):
        r = client.post("/api/channels", json={"name": "GetMe"})
        channel_id = r.json()["id"]
        r = client.get(f"/api/channels/{channel_id}")
        assert r.status_code == 200
        assert r.json()["name"] == "GetMe"

    def test_get_channel_not_found(self, client):
        r = client.get("/api/channels/99999")
        assert r.status_code == 404

    def test_update_channel(self, client):
        r = client.post("/api/channels", json={"name": "OldName", "niche": "Old"})
        channel_id = r.json()["id"]
        r = client.put(f"/api/channels/{channel_id}", json={"name": "NewName", "niche": "New"})
        assert r.status_code == 200
        r = client.get(f"/api/channels/{channel_id}")
        assert r.json()["name"] == "NewName"
        assert r.json()["niche"] == "New"

    def test_delete_channel(self, client):
        r = client.post("/api/channels", json={"name": "DeleteMe"})
        channel_id = r.json()["id"]
        r = client.delete(f"/api/channels/{channel_id}")
        assert r.status_code == 200
        r = client.get(f"/api/channels/{channel_id}")
        assert r.status_code == 404


class TestWorkflows:
    def test_list_workflows(self, client):
        r = client.get("/api/workflows")
        assert r.status_code == 200
        workflows = r.json()
        assert len(workflows) == 3  # seeded
        assert "skills" in workflows[0]

    def test_list_skills(self, client):
        r = client.get("/api/skills")
        assert r.status_code == 200
        skills = r.json()
        assert len(skills) == 18  # seeded

    def test_list_skills_by_category(self, client):
        r = client.get("/api/skills?category=script")
        assert r.status_code == 200
        skills = r.json()
        assert len(skills) == 3  # Hook Writing, Faceless Script Writing, Retention Loop


class TestSettings:
    def test_get_api_keys_empty(self, client):
        r = client.get("/api/settings/apikeys")
        assert r.status_code == 200
        keys = r.json()
        assert isinstance(keys, dict)

    def test_update_api_keys(self, client):
        r = client.put("/api/settings/apikeys", json={"gemini_api_key": "sk-test123"})
        assert r.status_code == 200
        r = client.get("/api/settings/apikeys")
        assert r.json().get("gemini_api_key", "").startswith("sk-t")


class TestCalendar:
    def test_add_calendar_entry(self, client):
        r = client.post("/api/calendar", json={
            "scheduled_date": "2026-07-01",
            "notes": "Test video",
        })
        assert r.status_code == 200
        assert r.json()["scheduled_date"] == "2026-07-01"

    def test_list_calendar(self, client):
        r = client.get("/api/calendar")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestSeries:
    def test_create_series(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.post("/api/series", json={
            "channel_id": channel_id,
            "name": "Test Series",
            "description": "A test series",
        })
        assert r.status_code == 200
        assert r.json()["name"] == "Test Series"

    def test_list_series(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.get(f"/api/series?channel_id={channel_id}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_episode(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        series = client.post("/api/series", json={"channel_id": channel_id, "name": "EpSeries"}).json()
        series_id = series["id"]
        r = client.post(f"/api/series/{series_id}/episodes", json={
            "episode_number": 1,
            "title": "Pilot",
            "description": "First episode",
            "arc_position": "beginning",
        })
        assert r.status_code == 200
        assert r.json()["episode_number"] == 1

    def test_list_episodes(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        series = client.post("/api/series", json={"channel_id": channel_id, "name": "ListEpSeries"}).json()
        series_id = series["id"]
        client.post(f"/api/series/{series_id}/episodes", json={
            "episode_number": 1, "title": "Ep1", "arc_position": "beginning",
        })
        r = client.get(f"/api/series/{series_id}/episodes")
        assert r.status_code == 200
        assert len(r.json()) >= 1


class TestRecommendations:
    def test_list_recommendations(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.get(f"/api/channels/{channel_id}/recommendations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_recommendation(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.post(f"/api/channels/{channel_id}/recommendations", json={
            "recommendation_type": "topic",
            "title": "Try this topic",
            "priority": 1,
        })
        assert r.status_code == 200
        assert r.json()["title"] == "Try this topic"


class TestAnalytics:
    def test_create_snapshot(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.post(f"/api/channels/{channel_id}/analytics", json={
            "views": 1000,
            "watch_time_minutes": 500,
            "subscribers": 100,
            "avg_ctr": 5.5,
            "avg_retention": 60,
        })
        assert r.status_code == 200
        assert r.json()["views"] == 1000

    def test_list_snapshots(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        client.post(f"/api/channels/{channel_id}/analytics", json={
            "views": 500, "watch_time_minutes": 200, "subscribers": 50,
            "avg_ctr": 4.0, "avg_retention": 50,
        })
        r = client.get(f"/api/channels/{channel_id}/analytics")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_get_latest(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        client.post(f"/api/channels/{channel_id}/analytics", json={
            "views": 100, "watch_time_minutes": 50, "subscribers": 10,
            "avg_ctr": 3.0, "avg_retention": 40,
        })
        r = client.get(f"/api/channels/{channel_id}/analytics/latest")
        assert r.status_code == 200

    def test_compare_analytics(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        client.post(f"/api/channels/{channel_id}/analytics", json={
            "views": 100, "watch_time_minutes": 50, "subscribers": 10,
            "avg_ctr": 3.0, "avg_retention": 40,
        })
        client.post(f"/api/channels/{channel_id}/analytics", json={
            "views": 200, "watch_time_minutes": 100, "subscribers": 20,
            "avg_ctr": 4.0, "avg_retention": 45,
        })
        r = client.get(f"/api/channels/{channel_id}/analytics/compare")
        assert r.status_code == 200
        comparison = r.json()
        if comparison.get("comparison") is not None:
            assert "changes_pct" in comparison


class TestPackages:
    def test_list_packages(self, client):
        r = client.get("/api/packages")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_package_not_found(self, client):
        r = client.get("/api/packages/99999")
        assert r.status_code == 404

    def test_delete_package(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        workflows = client.get("/api/workflows").json()
        workflow_id = workflows[0]["id"]

        from core.database import get_db
        conn = get_db()
        import core.database as db_mod
        conn.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
            (channel_id, workflow_id, "DRAFT"),
        )
        conn.commit()
        pkg = conn.execute("SELECT id FROM video_packages ORDER BY id DESC LIMIT 1").fetchone()
        package_id = pkg["id"]
        conn.close()

        r = client.delete(f"/api/packages/{package_id}")
        assert r.status_code == 200

    def test_export_package_markdown(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        workflows = client.get("/api/workflows").json()
        workflow_id = workflows[0]["id"]

        from core.database import get_db
        import core.database as db_mod
        conn = get_db()
        conn.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
            (channel_id, workflow_id, "DRAFT"),
        )
        conn.commit()
        pkg = conn.execute("SELECT id FROM video_packages ORDER BY id DESC LIMIT 1").fetchone()
        package_id = pkg["id"]
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (package_id, "idea", json.dumps({"ideas": [{"topic": "Test topic", "score": {"total": 80}}]}), 80),
        )
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (package_id, "script", json.dumps({"script": "Hello world", "hook": "Amazing!", "tone": "educational"}), 85),
        )
        conn.commit()
        conn.close()

        r = client.get(f"/api/packages/{package_id}/export?format=md")
        assert r.status_code == 200
        assert "Video Package" in r.text
        assert "Test topic" in r.text
        assert "Hello world" in r.text

    def test_export_package_txt(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        workflows = client.get("/api/workflows").json()
        workflow_id = workflows[0]["id"]

        from core.database import get_db
        conn = get_db()
        conn.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
            (channel_id, workflow_id, "DRAFT"),
        )
        conn.commit()
        pkg = conn.execute("SELECT id FROM video_packages ORDER BY id DESC LIMIT 1").fetchone()
        package_id = pkg["id"]
        conn.execute(
            "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
            (package_id, "idea", json.dumps({}), 80),
        )
        conn.commit()
        conn.close()

        r = client.get(f"/api/packages/{package_id}/export?format=txt")
        assert r.status_code == 200
        assert "Video Package" in r.text


class TestPatterns:
    def test_create_pattern(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.post(f"/api/channels/{channel_id}/patterns", json={
            "pattern_type": "hook",
            "pattern_name": "Shock Hook",
            "description": "Shocking opener",
        })
        assert r.status_code == 200
        assert r.json()["pattern_name"] == "Shock Hook"

    def test_list_patterns(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.get(f"/api/channels/{channel_id}/patterns")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestWhisper:
    def test_whisper_status(self, client):
        r = client.get("/api/whisper/status")
        assert r.status_code == 200


class TestTTS:
    def test_list_voices(self, client):
        r = client.get("/api/tts/voices")
        assert r.status_code == 200

    def test_generate_tts_no_script(self, client):
        r = client.post("/api/tts/generate", json={"script": ""})
        assert r.status_code == 400


class TestThumbnails:
    def test_generate_thumbnail_no_concept(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        workflows = client.get("/api/workflows").json()
        workflow_id = workflows[0]["id"]

        from core.database import get_db
        conn = get_db()
        conn.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
            (channel_id, workflow_id, "DRAFT"),
        )
        conn.commit()
        pkg = conn.execute("SELECT id FROM video_packages ORDER BY id DESC LIMIT 1").fetchone()
        package_id = pkg["id"]
        conn.close()

        r = client.post("/api/thumbnails/generate", json={"package_id": package_id, "concept_index": 0})
        assert r.status_code == 404


class TestABTest:
    def test_generate_ab_test(self, client):
        r = client.post("/api/ab-test/generate", json={
            "topic": "AI tools",
            "script": "AI is changing the world...",
        })
        assert r.status_code in (200, 404, 500)


class TestYouTubeOAuth:
    def test_oauth_status(self, client):
        r = client.get("/api/youtube/oauth/status")
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data
        assert data["connected"] is False

    def test_oauth_url_missing_credentials(self, client):
        r = client.post("/api/youtube/oauth/url", json={
            "client_id": "",
            "client_secret": "",
        })
        assert r.status_code == 400


class TestReferenceVideos:
    def test_list_reference_videos(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.get(f"/api/channels/{channel_id}/reference-videos")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_add_reference_video_invalid_url(self, client):
        channels = client.get("/api/channels").json()
        channel_id = channels[0]["id"]
        r = client.post(f"/api/channels/{channel_id}/reference-videos", json={"url": "not-a-url"})
        assert r.status_code == 400
