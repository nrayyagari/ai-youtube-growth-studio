import sqlite3
import json
from pathlib import Path

DATABASE_PATH = Path("data") / "growth_studio.db"


def get_db() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT 'local-dev-user',
            name TEXT NOT NULL,
            niche TEXT DEFAULT '',
            audience TEXT DEFAULT '',
            target_country TEXT DEFAULT '',
            language TEXT DEFAULT 'en',
            content_mode TEXT DEFAULT 'single_video',
            monetization_goal TEXT DEFAULT '',
            upload_frequency TEXT DEFAULT '',
            banned_topics TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT DEFAULT '',
            subscription_tier TEXT DEFAULT 'free',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            stripe_subscription_id TEXT DEFAULT '',
            stripe_customer_id TEXT DEFAULT '',
            status TEXT DEFAULT 'inactive',
            current_period_end TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            script_format TEXT DEFAULT '',
            scene_format TEXT DEFAULT '',
            visual_style TEXT DEFAULT '',
            music_style TEXT DEFAULT '',
            qa_checklist TEXT DEFAULT '[]',
            scoring_rules TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            description TEXT DEFAULT '',
            prompt_template TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS workflow_skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
            skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
            execution_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            purpose TEXT DEFAULT '',
            provider_preference TEXT DEFAULT '',
            default_model TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS video_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'DRAFT',
            youtube_video_id TEXT DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS package_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
            section_type TEXT NOT NULL,
            content TEXT DEFAULT '{}',
            score REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS growth_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            score REAL DEFAULT 0,
            explanation TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS qa_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
            check_type TEXT NOT NULL,
            score REAL DEFAULT 0,
            status TEXT DEFAULT 'PASS',
            details TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS reference_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            video_id TEXT NOT NULL,
            title TEXT DEFAULT '',
            channel_name TEXT DEFAULT '',
            thumbnail_url TEXT DEFAULT '',
            duration TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            transcript TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS style_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            visual_style TEXT DEFAULT '',
            editing_style TEXT DEFAULT '',
            tone TEXT DEFAULT '',
            music_preferences TEXT DEFAULT '',
            pacing TEXT DEFAULT '',
            content_patterns TEXT DEFAULT '{}',
            hooks TEXT DEFAULT '',
            thumbnails_style TEXT DEFAULT '',
            raw_analysis TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'PLANNING',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
            package_id INTEGER REFERENCES video_packages(id) ON DELETE SET NULL,
            episode_number INTEGER NOT NULL,
            title TEXT DEFAULT '',
            description TEXT DEFAULT '',
            arc_position TEXT DEFAULT '',
            status TEXT DEFAULT 'PLANNED',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS competitor_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            competitor_url TEXT NOT NULL,
            analysis_type TEXT NOT NULL,
            findings TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pattern_library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            pattern_type TEXT NOT NULL,
            pattern_name TEXT NOT NULL,
            description TEXT DEFAULT '',
            examples TEXT DEFAULT '[]',
            effectiveness_score REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS analytics_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            snapshot_date TEXT NOT NULL,
            views INTEGER DEFAULT 0,
            watch_time_minutes REAL DEFAULT 0,
            subscribers INTEGER DEFAULT 0,
            avg_ctr REAL DEFAULT 0,
            avg_retention REAL DEFAULT 0,
            top_videos TEXT DEFAULT '[]',
            demographics TEXT DEFAULT '{}',
            raw_data TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            snapshot_id INTEGER REFERENCES analytics_snapshots(id) ON DELETE SET NULL,
            recommendation_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            priority INTEGER DEFAULT 0,
            based_on TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS content_calendar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            package_id INTEGER REFERENCES video_packages(id) ON DELETE SET NULL,
            scheduled_date TEXT NOT NULL,
            status TEXT DEFAULT 'planned',
            slot_name TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS publishing_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            day_of_week INTEGER NOT NULL,
            hour INTEGER NOT NULL,
            label TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS thumbnail_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
            concept_name TEXT DEFAULT '',
            image_path TEXT NOT NULL,
            prompt_used TEXT DEFAULT '',
            file_size_bytes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS performance_learning (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
            package_id INTEGER NOT NULL REFERENCES video_packages(id) ON DELETE CASCADE,
            youtube_video_id TEXT NOT NULL,
            predicted_growth_score REAL DEFAULT 0,
            predicted_retention_score REAL DEFAULT 0,
            predicted_ctr_score REAL DEFAULT 0,
            actual_views INTEGER DEFAULT 0,
            actual_watch_minutes REAL DEFAULT 0,
            actual_ctr REAL DEFAULT 0,
            actual_retention_pct REAL DEFAULT 0,
            actual_likes INTEGER DEFAULT 0,
            actual_comments INTEGER DEFAULT 0,
            accuracy_score REAL DEFAULT 0,
            learning_insights TEXT DEFAULT '[]',
            snapshot_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    _ensure_column(conn, "channels", "user_id", "TEXT DEFAULT 'local-dev-user'")
    _ensure_column(conn, "subscriptions", "payment_provider", "TEXT DEFAULT 'stripe'")
    _ensure_column(conn, "subscriptions", "provider_subscription_id", "TEXT DEFAULT ''")
    conn.execute(
        "INSERT OR IGNORE INTO users (id, email, subscription_tier) VALUES (?, ?, ?)",
        ("local-dev-user", "local@example.com", "agency"),
    )
    conn.execute("UPDATE channels SET user_id = 'local-dev-user' WHERE user_id IS NULL OR user_id = ''")
    conn.commit()
    conn.close()


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    columns = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
