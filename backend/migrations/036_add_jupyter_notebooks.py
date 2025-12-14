"""
Migration 036: Add Jupyter notebook support

Adds jupyter_enabled and jupyter_auto_start settings to app_settings and creates
jupyter_sessions table for tracking active kernel sessions.
"""

import sqlite3


def migrate_up(db_path: str) -> bool:
    """Add Jupyter support to the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check existing columns in app_settings
        cursor.execute('PRAGMA table_info(app_settings)')
        columns = {row[1] for row in cursor.fetchall()}

        # Add jupyter_enabled setting
        if 'jupyter_enabled' not in columns:
            cursor.execute("""
                ALTER TABLE app_settings
                ADD COLUMN jupyter_enabled INTEGER DEFAULT 0
            """)
            print("Added jupyter_enabled column to app_settings (default: 0)")

        # Add jupyter_auto_start setting
        if 'jupyter_auto_start' not in columns:
            cursor.execute("""
                ALTER TABLE app_settings
                ADD COLUMN jupyter_auto_start INTEGER DEFAULT 0
            """)
            print("Added jupyter_auto_start column to app_settings (default: 0)")

        # Create jupyter_sessions table for kernel tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jupyter_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kernel_id TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'idle',
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created jupyter_sessions table")

        conn.commit()
        return True
    except Exception as e:
        print(f'Migration failed: {e}')
        conn.rollback()
        return False
    finally:
        conn.close()


def migrate_down(db_path: str) -> None:
    """Rollback migration (drop jupyter_sessions table)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute('DROP TABLE IF EXISTS jupyter_sessions')
        print('Dropped jupyter_sessions table')
        # Note: SQLite doesn't support DROP COLUMN easily
        print('Rollback: jupyter_enabled and jupyter_auto_start columns will remain')
        conn.commit()
    except Exception as e:
        print(f'Rollback failed: {e}')
        conn.rollback()
    finally:
        conn.close()


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print('Usage: python 036_add_jupyter_notebooks.py <db_path>')
        sys.exit(1)
    migrate_up(sys.argv[1])

