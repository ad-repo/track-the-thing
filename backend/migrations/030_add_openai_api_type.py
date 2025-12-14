"""
Migration 030: Add OpenAI API type setting

Adds openai_api_type column to app_settings table to allow choosing between
'chat_completions' (default) and 'responses' API formats.
"""

import sqlite3


def migrate_up(db_path):
    """Add openai_api_type column to app_settings."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(app_settings)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'openai_api_type' not in columns:
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN openai_api_type TEXT DEFAULT 'chat_completions'
        """)
        print("Added openai_api_type column to app_settings")
    else:
        print("Column openai_api_type already exists")

    conn.commit()
    conn.close()
    return True


def migrate_down(db_path):
    """SQLite doesn't support dropping columns easily, so we skip this."""
    return True
