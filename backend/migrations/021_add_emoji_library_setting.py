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
    Add emoji_library column to app_settings table.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if not table_exists(cursor, 'app_settings'):
            print("Table 'app_settings' does not exist. Skipping migration 021.")
            return False

        # Add emoji_library column
        if not column_exists(cursor, 'app_settings', 'emoji_library'):
            cursor.execute("ALTER TABLE app_settings ADD COLUMN emoji_library TEXT DEFAULT 'emoji-picker-react'")
            print("Added 'emoji_library' column to 'app_settings' table.")
        else:
            print("'emoji_library' column already exists in 'app_settings' table. Skipping.")

        conn.commit()
    return True

def migrate_down(db_path: Path) -> bool:
    """
    Remove emoji_library column from app_settings table.
    Note: Removing columns in SQLite typically requires recreating the table.
    This down migration will only print a warning.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if not table_exists(cursor, 'app_settings'):
            print("Table 'app_settings' does not exist. Skipping migration 021 (down).")
            return False

        print("Downgrade for 021: Removing columns is not directly supported in SQLite without recreating the table.")
        print("If you need to remove 'emoji_library', you would typically:")
        print("1. Create a new table without this column.")
        print("2. Copy data from the old table to the new table.")
        print("3. Drop the old table.")
        print("4. Rename the new table to the old table's name.")
        print("Skipping actual column removal for safety.")
        conn.commit()
    return True

if __name__ == '__main__':
    db_path = get_db_path()
    print(f"Running migration 021 on database: {db_path}")
    success = migrate_up(db_path)
    if success:
        print("✓ Migration 021_add_emoji_library_setting.py completed successfully")
    else:
        print("✗ Migration 021_add_emoji_library_setting.py failed or skipped")

