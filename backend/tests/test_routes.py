import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.auth_otp import _create_token


@pytest.fixture
def client():
    import os

    os.chdir(Path(__file__).resolve().parents[1])
    test_db = Path("data") / "test_api_growth_studio.db"
    if test_db.exists():
        test_db.unlink()

    import core.database as db_mod

    db_mod.DATABASE_PATH = test_db
    db_mod.init_db()

    from main import app

    with TestClient(app) as client:
        yield client

    if test_db.exists():
        test_db.unlink()


def _auth_headers(email: str = "creator@example.com") -> dict[str, str]:
    return {"Authorization": f"Bearer {_create_token(email)}"}


def test_health_route(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_send_otp_logs_auth_event(client):
    response = client.post("/api/auth/otp/send", json={"email": "creator@example.com"})
    assert response.status_code == 200
    assert response.json()["sent"] is True

    from core.database import get_db

    conn = get_db()
    row = conn.execute(
        "SELECT event_type FROM auth_events ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    assert row["event_type"] == "otp_sent"


def test_get_me_accepts_bearer_token(client):
    response = client.get("/api/auth/me", headers=_auth_headers())
    assert response.status_code == 200
    body = response.json()
    assert body["email_provider"] == "example.com"
    assert "user_hash" in body


def test_generate_requires_auth(client):
    response = client.post(
        "/api/generate",
        json={"topic": "AI", "api_keys": {"gemini": "test-key"}, "channel": {"name": "My Channel"}},
    )
    assert response.status_code == 401


def test_generate_returns_client_storable_package(client, monkeypatch):
    from routes import packages as packages_route

    monkeypatch.setattr(
        packages_route.PipelineRunner,
        "run",
        lambda self, channel, topic, reference_url=None: {
            "id": "pkg-123",
            "topic": topic,
            "created_at": "2026-06-12T00:00:00Z",
            "sections": [
                {
                    "agent": "script",
                    "section_type": "script",
                    "output": {"script": "hello world", "score": {"overall": 91}},
                }
            ],
            "approval": {"status": "APPROVED", "scores": {"script_score": 91}, "failing": [], "corrections": []},
        },
    )

    response = client.post(
        "/api/generate",
        headers=_auth_headers(),
        json={
            "topic": "AI for creators",
            "api_keys": {"gemini_api_key": "test-key"},
            "channel": {"name": "Creator Lab", "niche": "AI", "audience": "creators", "language": "en"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "pkg-123"
    assert body["topic"] == "AI for creators"
    assert body["sections"][0]["content"]["script"] == "hello world"


def test_youtube_status_is_stateless(client):
    response = client.post(
        "/api/youtube/oauth/status",
        headers=_auth_headers(),
        json={"refresh_token": ""},
    )
    assert response.status_code == 200
    assert response.json() == {"connected": False}
