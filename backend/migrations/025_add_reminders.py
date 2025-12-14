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
    Add reminders table for date-time based reminders on entry cards.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if table_exists(cursor, 'reminders'):
            print("Table 'reminders' already exists. Skipping migration 025.")
            return True

        # Create reminders table
        cursor.execute("""
            CREATE TABLE reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL,
                reminder_datetime TEXT NOT NULL,
                is_dismissed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES note_entries(id) ON DELETE CASCADE
            )
        """)

        # Create index on entry_id for faster lookups
        cursor.execute("CREATE INDEX idx_reminders_entry_id ON reminders(entry_id)")

        # Create index on reminder_datetime for sorting and filtering due reminders
        cursor.execute("CREATE INDEX idx_reminders_datetime ON reminders(reminder_datetime)")

        # Create index on is_dismissed for filtering active reminders
        cursor.execute("CREATE INDEX idx_reminders_is_dismissed ON reminders(is_dismissed)")

        print("Created 'reminders' table with indexes.")
        conn.commit()
    return True

def migrate_down(db_path: Path) -> bool:
    """
    Remove reminders table.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        if not table_exists(cursor, 'reminders'):
            print("Table 'reminders' does not exist. Skipping migration 025 (down).")
            return False

        cursor.execute("DROP TABLE IF EXISTS reminders")
        print("Dropped 'reminders' table.")
        conn.commit()
    return True

if __name__ == '__main__':
    db_path = get_db_path()
    print(f"Running migration 025 on database: {db_path}")
    success = migrate_up(db_path)
    if success:
        print("✓ Migration 025_add_reminders.py completed successfully")
    else:
        print("✗ Migration 025_add_reminders.py failed or skipped")

