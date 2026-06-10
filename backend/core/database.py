import sqlite3
from pathlib import Path

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
        CREATE TABLE IF NOT EXISTS usage_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            user_hash TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS error_logs (
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

        CREATE INDEX IF NOT EXISTS idx_usage_event ON usage_stats(event_type);
        CREATE INDEX IF NOT EXISTS idx_error_type ON error_logs(error_type);
        CREATE INDEX IF NOT EXISTS idx_error_created ON error_logs(created_at);
    """)
    conn.commit()
    conn.close()
