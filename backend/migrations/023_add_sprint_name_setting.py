#!/usr/bin/env python3
"""
Migration: Add sprint_name to app_settings
Version: 023
Date: 2025-11-15

This migration adds a sprint_name column to app_settings to allow customizing
the label used for sprint goals throughout the application.
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
    """Add sprint_name column to app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        if column_exists(cursor, 'app_settings', 'sprint_name'):
            print("'sprint_name' column already exists in 'app_settings' table. Skipping.")
            conn.close()
            return True

        # Add sprint_name column with default value 'Sprint'
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN sprint_name TEXT DEFAULT 'Sprint'
        """)

        conn.commit()
        print("Successfully added 'sprint_name' column to 'app_settings' table.")
        print("Migration 023 completed successfully.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()


def migrate_down(db_path):
    """Remove sprint_name column from app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # SQLite doesn't support DROP COLUMN directly, need to recreate table
        print("Removing 'sprint_name' column from 'app_settings' table...")

        # Get current data
        cursor.execute("SELECT id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, quarterly_start_date, quarterly_end_date, emoji_library, created_at, updated_at FROM app_settings")
        data = cursor.fetchall()

        # Drop and recreate table without sprint_name
        cursor.execute("DROP TABLE app_settings")
        cursor.execute("""
            CREATE TABLE app_settings (
                id INTEGER PRIMARY KEY,
                sprint_goals TEXT DEFAULT '',
                quarterly_goals TEXT DEFAULT '',
                sprint_start_date TEXT DEFAULT '',
                sprint_end_date TEXT DEFAULT '',
                quarterly_start_date TEXT DEFAULT '',
                quarterly_end_date TEXT DEFAULT '',
                emoji_library TEXT DEFAULT 'emoji-picker-react',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Restore data
        for row in data:
            cursor.execute("""
                INSERT INTO app_settings 
                (id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, quarterly_start_date, quarterly_end_date, emoji_library, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, row)

        conn.commit()
        print("Successfully removed 'sprint_name' column from 'app_settings' table.")

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

