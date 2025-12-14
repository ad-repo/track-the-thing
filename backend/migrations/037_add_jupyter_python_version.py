"""
Migration 037: Add Jupyter Python version settings

Adds jupyter_python_version and jupyter_custom_image columns to app_settings
to allow users to select Python version or use a custom Docker image.
"""

import sqlite3


def migrate_up(db_path: str) -> bool:
    """Add Jupyter Python version settings to the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute('PRAGMA table_info(app_settings)')
        columns = {row[1] for row in cursor.fetchall()}

        # Add jupyter_python_version setting (3.9, 3.10, 3.11, 3.12, or 'custom')
        if 'jupyter_python_version' not in columns:
            cursor.execute("""
                ALTER TABLE app_settings
                ADD COLUMN jupyter_python_version TEXT DEFAULT '3.11'
            """)
            print("Added jupyter_python_version column (default: 3.11)")

        # Add jupyter_custom_image for when version is 'custom'
        if 'jupyter_custom_image' not in columns:
            cursor.execute("""
                ALTER TABLE app_settings
                ADD COLUMN jupyter_custom_image TEXT DEFAULT ''
            """)
            print("Added jupyter_custom_image column (default: empty)")

        conn.commit()
        return True
    except Exception as e:
        print(f'Migration failed: {e}')
        conn.rollback()
        return False
    finally:
        conn.close()


def migrate_down(db_path: str) -> None:
    """Rollback migration."""
    print('Rollback: jupyter_python_version and jupyter_custom_image columns will remain')
    print('SQLite does not support DROP COLUMN easily')

