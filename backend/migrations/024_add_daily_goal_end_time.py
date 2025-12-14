#!/usr/bin/env python3
"""
Migration: Add daily_goal_end_time to app_settings
Version: 024
Date: 2025-11-15

This migration adds a daily_goal_end_time column to app_settings to allow customizing
the end time for daily goal countdown.
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
    """Add daily_goal_end_time column to app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        if column_exists(cursor, 'app_settings', 'daily_goal_end_time'):
            print("'daily_goal_end_time' column already exists in 'app_settings' table. Skipping.")
            conn.close()
            return True

        # Add daily_goal_end_time column with default value '17:00' (5pm)
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN daily_goal_end_time TEXT DEFAULT '17:00'
        """)

        conn.commit()
        print("Successfully added 'daily_goal_end_time' column to 'app_settings' table.")
        print("Migration 024 completed successfully.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()


def migrate_down(db_path):
    """Remove daily_goal_end_time column from app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Removing 'daily_goal_end_time' column from 'app_settings' table...")

        # Get current data
        cursor.execute("SELECT id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, quarterly_start_date, quarterly_end_date, emoji_library, sprint_name, created_at, updated_at FROM app_settings")
        data = cursor.fetchall()

        # Drop and recreate table without daily_goal_end_time
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Restore data
        for row in data:
            cursor.execute("""
                INSERT INTO app_settings 
                (id, sprint_goals, quarterly_goals, sprint_start_date, sprint_end_date, quarterly_start_date, quarterly_end_date, emoji_library, sprint_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, row)

        conn.commit()
        print("Successfully removed 'daily_goal_end_time' column from 'app_settings' table.")

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

