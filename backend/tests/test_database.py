import json
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.database import get_db, init_db
from pathlib import Path


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


def test_init_db_creates_tables(db):
    tables = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    table_names = [t["name"] for t in tables]
    assert "channels" in table_names
    assert "workflows" in table_names
    assert "skills" in table_names
    assert "video_packages" in table_names
    assert "package_sections" in table_names
    assert "growth_scores" in table_names
    assert "qa_reports" in table_names
    assert "settings" in table_names
    assert "reference_videos" in table_names
    assert "style_profiles" in table_names
    assert "series" in table_names
    assert "episodes" in table_names
    assert "competitor_analyses" in table_names
    assert "pattern_library" in table_names
    assert "analytics_snapshots" in table_names
    assert "recommendations" in table_names
    assert "content_calendar" in table_names
    assert "publishing_slots" in table_names
    assert "users" in table_names
    assert "subscriptions" in table_names


def test_channel_crud(db):
    cursor = db.execute(
        "INSERT INTO channels (user_id, name, niche, audience, language) VALUES (?, ?, ?, ?, ?)",
        ("local-dev-user", "TestChannel", "Tech", "Developers", "en"),
    )
    channel_id = cursor.lastrowid
    db.commit()

    row = db.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    assert row["name"] == "TestChannel"
    assert row["niche"] == "Tech"
    assert row["user_id"] == "local-dev-user"

    db.execute("UPDATE channels SET niche = ? WHERE id = ?", ("UpdatedTech", channel_id))
    db.commit()
    row = db.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    assert row["niche"] == "UpdatedTech"

    db.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
    db.commit()
    row = db.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    assert row is None


def test_video_package_creation(db):
    cursor = db.execute(
        "INSERT INTO channels (name, niche) VALUES (?, ?)",
        ("PkgTest", "Testing"),
    )
    channel_id = cursor.lastrowid

    cursor = db.execute(
        "INSERT INTO workflows (name, description) VALUES (?, ?)",
        ("TestWorkflow", "A test workflow"),
    )
    workflow_id = cursor.lastrowid

    cursor = db.execute(
        "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
        (channel_id, workflow_id, "DRAFT"),
    )
    package_id = cursor.lastrowid
    db.commit()

    pkg = db.execute("SELECT * FROM video_packages WHERE id = ?", (package_id,)).fetchone()
    assert pkg is not None
    assert pkg["status"] == "DRAFT"
    assert pkg["channel_id"] == channel_id
    assert pkg["workflow_id"] == workflow_id


def test_package_sections_crud(db):
    cursor = db.execute("INSERT INTO channels (name) VALUES (?)", ("SectionTest",))
    channel_id = cursor.lastrowid
    cursor = db.execute("INSERT INTO workflows (name) VALUES (?)", ("TestWF",))
    workflow_id = cursor.lastrowid
    cursor = db.execute(
        "INSERT INTO video_packages (channel_id, workflow_id) VALUES (?, ?)",
        (channel_id, workflow_id),
    )
    package_id = cursor.lastrowid

    cursor = db.execute(
        "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
        (package_id, "idea", json.dumps({"topic": "AI"}), 85),
    )
    db.commit()

    sections = db.execute(
        "SELECT * FROM package_sections WHERE package_id = ?", (package_id,)
    ).fetchall()
    assert len(sections) == 1
    assert sections[0]["score"] == 85

    content = json.loads(sections[0]["content"])
    assert content["topic"] == "AI"


def test_settings_insert_or_replace(db):
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("gemini_api_key", "test-key-12345"),
    )
    db.commit()

    row = db.execute(
        "SELECT value FROM settings WHERE key = ?", ("gemini_api_key",)
    ).fetchone()
    assert row["value"] == "test-key-12345"

    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("gemini_api_key", "updated-key-67890"),
    )
    db.commit()
    row = db.execute(
        "SELECT value FROM settings WHERE key = ?", ("gemini_api_key",)
    ).fetchone()
    assert row["value"] == "updated-key-67890"


def test_cascade_delete_package(db):
    cursor = db.execute("INSERT INTO channels (name) VALUES (?)", ("CascadeTest",))
    channel_id = cursor.lastrowid
    cursor = db.execute("INSERT INTO workflows (name) VALUES (?)", ("CascadeWF",))
    workflow_id = cursor.lastrowid
    cursor = db.execute(
        "INSERT INTO video_packages (channel_id, workflow_id) VALUES (?, ?)",
        (channel_id, workflow_id),
    )
    package_id = cursor.lastrowid

    db.execute(
        "INSERT INTO package_sections (package_id, section_type, content) VALUES (?, ?, ?)",
        (package_id, "idea", "{}"),
    )
    db.execute(
        "INSERT INTO growth_scores (package_id, category, score) VALUES (?, ?, ?)",
        (package_id, "test", 80),
    )
    db.execute(
        "INSERT INTO qa_reports (package_id, check_type, score) VALUES (?, ?, ?)",
        (package_id, "copyright", 85),
    )
    db.commit()

    db.execute("DELETE FROM video_packages WHERE id = ?", (package_id,))
    db.commit()

    sections = db.execute(
        "SELECT COUNT(*) FROM package_sections WHERE package_id = ?", (package_id,)
    ).fetchone()
    assert sections[0] == 0

    scores = db.execute(
        "SELECT COUNT(*) FROM growth_scores WHERE package_id = ?", (package_id,)
    ).fetchone()
    assert scores[0] == 0

    qa = db.execute(
        "SELECT COUNT(*) FROM qa_reports WHERE package_id = ?", (package_id,)
    ).fetchone()
    assert qa[0] == 0


def test_content_calendar_empty(db):
    rows = db.execute("SELECT COUNT(*) FROM content_calendar").fetchone()
    assert rows[0] == 0

    cursor = db.execute("INSERT INTO channels (name) VALUES (?)", ("CalendarChan",))
    channel_id = cursor.lastrowid

    db.execute(
        "INSERT INTO content_calendar (channel_id, scheduled_date, notes) VALUES (?, ?, ?)",
        (channel_id, "2026-07-01", "Test video"),
    )
    db.commit()

    rows = db.execute(
        "SELECT * FROM content_calendar WHERE channel_id = ?", (channel_id,)
    ).fetchall()
    assert len(rows) == 1
    assert rows[0]["notes"] == "Test video"


def test_series_and_episodes(db):
    cursor = db.execute("INSERT INTO channels (name) VALUES (?)", ("SeriesChan",))
    channel_id = cursor.lastrowid
    cursor = db.execute(
        "INSERT INTO series (channel_id, name, description) VALUES (?, ?, ?)",
        (channel_id, "AI Series", "All about AI"),
    )
    series_id = cursor.lastrowid

    cursor = db.execute(
        "INSERT INTO episodes (series_id, episode_number, title, arc_position) VALUES (?, ?, ?, ?)",
        (series_id, 1, "Intro to AI", "beginning"),
    )
    episode_id = cursor.lastrowid
    db.commit()

    episodes = db.execute(
        "SELECT * FROM episodes WHERE series_id = ? ORDER BY episode_number",
        (series_id,),
    ).fetchall()
    assert len(episodes) == 1
    assert episodes[0]["title"] == "Intro to AI"
    assert episodes[0]["arc_position"] == "beginning"

    db.execute("DELETE FROM series WHERE id = ?", (series_id,))
    db.commit()

    episodes_after = db.execute(
        "SELECT COUNT(*) FROM episodes WHERE series_id = ?", (series_id,)
    ).fetchone()
    assert episodes_after[0] == 0
