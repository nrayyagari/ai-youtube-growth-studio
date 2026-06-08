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
            workflow_id INTEGER NOT NULL REFERENCES workflows(id),
            status TEXT DEFAULT 'DRAFT',
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
    """)
    conn.commit()
    conn.close()
