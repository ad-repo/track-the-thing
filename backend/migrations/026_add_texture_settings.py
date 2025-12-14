#!/usr/bin/env python3
"""
Migration: Add texture settings to app_settings
Version: 026
Date: 2025-11-22

This migration adds texture_enabled and texture_settings columns to app_settings
to support the UI texture system.
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
    """Add texture settings columns to app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        if column_exists(cursor, 'app_settings', 'texture_enabled'):
            print("'texture_enabled' column already exists in 'app_settings' table. Skipping.")
            conn.close()
            return True

        # Add texture_enabled column (0 = false, 1 = true)
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN texture_enabled INTEGER DEFAULT 0
        """)
        print("Added 'texture_enabled' column to 'app_settings' table.")

        # Add texture_settings column for JSON storage
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN texture_settings TEXT DEFAULT '{}'
        """)
        print("Added 'texture_settings' column to 'app_settings' table.")

        conn.commit()
        print("Migration 026 completed successfully.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()


def migrate_down(db_path):
    """Remove texture settings columns from app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Removing texture settings columns from 'app_settings' table...")

        # Get current data (excluding texture fields)
        cursor.execute("""
            SELECT id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, 
                   quarterly_start_date, quarterly_end_date, emoji_library, sprint_name, 
                   daily_goal_end_time, created_at, updated_at 
            FROM app_settings
        """)
        data = cursor.fetchall()

        # Drop and recreate table without texture fields
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
                sprint_name TEXT DEFAULT 'Sprint',
                daily_goal_end_time TEXT DEFAULT '17:00',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Restore data
        for row in data:
            cursor.execute("""
                INSERT INTO app_settings 
                (id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, 
                 quarterly_start_date, quarterly_end_date, emoji_library, sprint_name, 
                 daily_goal_end_time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, row)

        conn.commit()
        print("Successfully removed texture settings columns from 'app_settings' table.")

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

