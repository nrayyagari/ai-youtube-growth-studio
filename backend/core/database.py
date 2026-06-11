import sqlite3
from pathlib import Path
from typing import Any

DATABASE_PATH = Path("data") / "stats.db"


def get_db() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS otp_challenges (
            email_hash TEXT PRIMARY KEY,
            otp_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS auth_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_hash TEXT DEFAULT '',
            event_type TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
            key TEXT PRIMARY KEY,
            bucket TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            window_expires_at INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ops_error_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_type TEXT NOT NULL,
            error_message TEXT DEFAULT '',
            traceback TEXT DEFAULT '',
            agent_name TEXT DEFAULT '',
            fixed_by_agent INTEGER DEFAULT 0,
            fix_applied TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS login_aggregates (
            period TEXT PRIMARY KEY,
            login_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_auth_event_type ON auth_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_auth_user_hash ON auth_events(user_hash);
        CREATE INDEX IF NOT EXISTS idx_error_type ON ops_error_logs(error_type);
        CREATE INDEX IF NOT EXISTS idx_error_created ON ops_error_logs(created_at);
    """)
    conn.commit()
    conn.close()


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    conn = get_db()
    conn.execute(query, params)
    conn.commit()
    conn.close()
