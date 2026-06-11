import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.database import get_db, init_db


@pytest.fixture
def db():
    import os

    os.makedirs("data", exist_ok=True)
    test_db = Path("data") / "test_growth_studio.db"
    if test_db.exists():
        test_db.unlink()

    import core.database as db_mod

    db_mod.DATABASE_PATH = test_db
    init_db()
    conn = get_db()
    yield conn
    conn.close()
    if test_db.exists():
        test_db.unlink()


def test_init_db_creates_stateless_tables(db):
    tables = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    table_names = [t["name"] for t in tables]
    assert "otp_challenges" in table_names
    assert "auth_events" in table_names
    assert "rate_limits" in table_names
    assert "ops_error_logs" in table_names
    assert "login_aggregates" in table_names


def test_auth_events_and_login_aggregates_are_minimal(db):
    db.execute(
        "INSERT INTO auth_events (user_hash, event_type, metadata) VALUES (?, ?, ?)",
        ("abc123", "login_success", '{"ip":"127.0.0.1"}'),
    )
    db.execute(
        """
        INSERT INTO login_aggregates (period, login_count)
        VALUES (?, ?)
        ON CONFLICT(period) DO UPDATE SET login_count = login_count + 1
        """,
        ("2026-06-12", 1),
    )
    db.commit()

    event = db.execute("SELECT * FROM auth_events WHERE user_hash = ?", ("abc123",)).fetchone()
    aggregate = db.execute("SELECT * FROM login_aggregates WHERE period = ?", ("2026-06-12",)).fetchone()
    assert event["event_type"] == "login_success"
    assert aggregate["login_count"] == 1


def test_ops_error_logs_do_not_require_workspace_tables(db):
    db.execute(
        """
        INSERT INTO ops_error_logs
        (error_type, error_message, traceback, agent_name, metadata)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("HTTP_500", "generation failed", "trace", "http", '{"path":"/api/generate"}'),
    )
    db.commit()

    row = db.execute("SELECT * FROM ops_error_logs WHERE error_type = ?", ("HTTP_500",)).fetchone()
    assert row["agent_name"] == "http"
    assert row["error_message"] == "generation failed"
