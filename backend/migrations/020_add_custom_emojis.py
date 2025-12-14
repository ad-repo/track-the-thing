import sqlite3
from pathlib import Path


def get_db_path():
    # This function should ideally get the path from a config or env var
    # For tests, it might point to a test-specific DB
    # For local dev, it might point to a local DB
    # For now, assuming a default path for migration script execution
    return Path('./daily_notes.db')

def table_exists(cursor, table_name: str) -> bool:
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    return cursor.fetchone() is not None

def column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    return any(column[1] == column_name for column in columns)

def migrate_up(db_path: Path) -> bool:
    """
    Add custom_emojis table for user-uploaded custom emojis.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if table_exists(cursor, 'custom_emojis'):
            print("Table 'custom_emojis' already exists. Skipping migration 020.")
            return True

        # Create custom_emojis table
        cursor.execute("""
            CREATE TABLE custom_emojis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                image_url TEXT NOT NULL,
                category TEXT DEFAULT 'Custom',
                keywords TEXT DEFAULT '',
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Create index on name for faster lookups
        cursor.execute("CREATE INDEX idx_custom_emojis_name ON custom_emojis(name)")

        # Create index on is_deleted for filtering
        cursor.execute("CREATE INDEX idx_custom_emojis_is_deleted ON custom_emojis(is_deleted)")

        print("Created 'custom_emojis' table with indexes.")
        conn.commit()
    return True

def migrate_down(db_path: Path) -> bool:
    """
    Remove custom_emojis table.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if not table_exists(cursor, 'custom_emojis'):
            print("Table 'custom_emojis' does not exist. Skipping migration 020 (down).")
            return False

        cursor.execute("DROP TABLE IF EXISTS custom_emojis")
        print("Dropped 'custom_emojis' table.")
        conn.commit()
    return True

if __name__ == '__main__':
    db_path = get_db_path()
    print(f"Running migration 020 on database: {db_path}")
    success = migrate_up(db_path)
    if success:
        print("✓ Migration 020_add_custom_emojis.py completed successfully")
    else:
        print("✗ Migration 020_add_custom_emojis.py failed or skipped")

