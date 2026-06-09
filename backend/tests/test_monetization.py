import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def client():
    os.chdir(Path(__file__).resolve().parents[1])
    test_db = Path("data") / "test_monetization_growth_studio.db"
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


def test_user_me_creates_free_clerk_user(client):
    response = client.get(
        "/api/user/me",
        headers={"X-Clerk-User-Id": "user_123", "X-Clerk-User-Email": "creator@example.com"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "user_123"
    assert body["email"] == "creator@example.com"
    assert body["subscription_tier"] == "free"
    assert body["usage"]["channels"]["limit"] == 1


def test_free_user_channel_limit_is_enforced(client):
    headers = {"X-Clerk-User-Id": "free_user"}

    first = client.post("/api/channels", json={"name": "First"}, headers=headers)
    second = client.post("/api/channels", json={"name": "Second"}, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 403
    assert "allows 1 channel" in second.json()["detail"]


def test_channels_are_scoped_to_current_user(client):
    client.post("/api/channels", json={"name": "User A Channel"}, headers={"X-Clerk-User-Id": "user_a"})
    client.post("/api/channels", json={"name": "User B Channel"}, headers={"X-Clerk-User-Id": "user_b"})

    response = client.get("/api/channels", headers={"X-Clerk-User-Id": "user_a"})

    assert response.status_code == 200
    channels = response.json()
    assert [channel["name"] for channel in channels] == ["User A Channel"]


def test_checkout_returns_mock_until_stripe_is_configured(client):
    response = client.post(
        "/api/stripe/checkout",
        json={"tier": "pro"},
        headers={"X-Clerk-User-Id": "user_checkout"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "mock"
    assert "tier=pro" in response.json()["checkout_url"]
