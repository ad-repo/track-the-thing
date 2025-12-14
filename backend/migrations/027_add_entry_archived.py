#!/usr/bin/env python3
"""
Migration: Add is_archived field to note_entries
Version: 027
Date: 2025-12-03

This migration adds is_archived column to note_entries table
to support archiving cards/entries.
"""

import sqlite3
import sys
from pathlib import Path


def get_db_path():
    """Get the database path, checking multiple possible locations."""
    possible_paths = [
        Path(__file__).parent.parent / "data" / "daily_notes.db",
        Path(__file__).parent.parent / "daily_notes.db",
        Path.cwd() / "data" / "daily_notes.db",
        Path.cwd() / "daily_notes.db",
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    # If no database exists, return the preferred location
    return str(possible_paths[0])


def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    return any(col[1] == column_name for col in columns)


def migrate_up(db_path):
    """Add is_archived column to note_entries."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        if column_exists(cursor, 'note_entries', 'is_archived'):
            print("'is_archived' column already exists in 'note_entries' table. Skipping.")
            conn.close()
            return True

        # Add is_archived column (0 = false, 1 = true)
        cursor.execute("""
            ALTER TABLE note_entries 
            ADD COLUMN is_archived INTEGER DEFAULT 0
        """)
        print("Added 'is_archived' column to 'note_entries' table.")

        conn.commit()
        print("Migration 027 completed successfully.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()


def migrate_down(db_path):
    """Remove is_archived column from note_entries."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Removing is_archived column from 'note_entries' table...")

        # Get column info to reconstruct table without is_archived
        cursor.execute("PRAGMA table_info(note_entries)")
        columns = cursor.fetchall()
        columns_to_keep = [col for col in columns if col[1] != 'is_archived']
        column_names = [col[1] for col in columns_to_keep]

        # Get current data
        cursor.execute(f"SELECT {', '.join(column_names)} FROM note_entries")
        data = cursor.fetchall()

        # Drop and recreate table without is_archived
        cursor.execute("DROP TABLE note_entries")

        # Recreate the table structure
        cursor.execute("""
            CREATE TABLE note_entries (
                id INTEGER PRIMARY KEY,
                daily_note_id INTEGER NOT NULL,
                title TEXT DEFAULT '',
                content TEXT NOT NULL,
                content_type TEXT DEFAULT 'rich_text',
                order_index INTEGER DEFAULT 0,
                include_in_report INTEGER DEFAULT 0,
                is_important INTEGER DEFAULT 0,
                is_completed INTEGER DEFAULT 0,
                is_dev_null INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (daily_note_id) REFERENCES daily_notes(id)
            )
        """)

        # Restore data
        placeholders = ', '.join(['?' for _ in column_names])
        for row in data:
            cursor.execute(f"""
                INSERT INTO note_entries ({', '.join(column_names)})
                VALUES ({placeholders})
            """, row)

        conn.commit()
        print("Successfully removed is_archived column from 'note_entries' table.")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration rollback: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    db_path = get_db_path()
    print(f"Using database: {db_path}")

    if len(sys.argv) > 1 and sys.argv[1] == 'down':
        migrate_down(db_path)
    else:
        migrate_up(db_path)
