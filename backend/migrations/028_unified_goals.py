"""
Migration 028: Create unified goals table and migrate existing data

This migration creates a flexible goals system that supports multiple goal types
including time-based (Daily, Weekly, Sprint, Monthly, Quarterly, Yearly) and
lifestyle goals (Fitness, Health, Learning, etc.).
"""
import sqlite3
from typing import Tuple


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cursor.fetchone() is not None


def _column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return any(col[1] == column_name for col in cursor.fetchall())


def _add_name_column_if_missing(cursor) -> int:
    """
    Ensure the goals table has a non-null name column.
    Returns the number of rows updated with backfilled names.
    """
    if _column_exists(cursor, 'goals', 'name'):
        return 0

    cursor.execute("ALTER TABLE goals ADD COLUMN name TEXT NOT NULL DEFAULT 'Goal'")

    cursor.execute(
        """
        UPDATE goals
        SET name = COALESCE(goal_type, 'Goal')
        WHERE name IS NULL OR name = ''
        """
    )
    return cursor.rowcount


def _ensure_goal_columns(cursor) -> None:
    """
    Ensure the goals table has all expected columns.

    This is defensive for databases created before the full unified goals schema
    existed (e.g., missing end_time). SQLite ALTER TABLE ADD COLUMN is
    idempotent when guarded by column existence checks.
    """
    # Column name -> SQL fragment for ALTER TABLE
    required_columns = {
        'name': "ALTER TABLE goals ADD COLUMN name TEXT NOT NULL DEFAULT 'Goal'",
        'goal_type': "ALTER TABLE goals ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'Custom'",
        'text': "ALTER TABLE goals ADD COLUMN text TEXT DEFAULT ''",
        'start_date': "ALTER TABLE goals ADD COLUMN start_date TEXT",
        'end_date': "ALTER TABLE goals ADD COLUMN end_date TEXT",
        'end_time': "ALTER TABLE goals ADD COLUMN end_time TEXT DEFAULT ''",
        'status_text': "ALTER TABLE goals ADD COLUMN status_text TEXT DEFAULT ''",
        'show_countdown': "ALTER TABLE goals ADD COLUMN show_countdown INTEGER DEFAULT 1",
        'is_completed': "ALTER TABLE goals ADD COLUMN is_completed INTEGER DEFAULT 0",
        'completed_at': "ALTER TABLE goals ADD COLUMN completed_at DATETIME",
        'is_visible': "ALTER TABLE goals ADD COLUMN is_visible INTEGER DEFAULT 1",
        'order_index': "ALTER TABLE goals ADD COLUMN order_index INTEGER DEFAULT 0",
        'created_at': "ALTER TABLE goals ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        'updated_at': "ALTER TABLE goals ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    }

    for col, alter_sql in required_columns.items():
        if not _column_exists(cursor, 'goals', col):
            cursor.execute(alter_sql)

    # Backfill critical defaults for rows that may be NULL or empty
    cursor.execute(
        """
        UPDATE goals
        SET
            name = COALESCE(NULLIF(name, ''), COALESCE(goal_type, 'Goal')),
            goal_type = COALESCE(goal_type, 'Custom'),
            text = COALESCE(text, ''),
            end_time = COALESCE(end_time, ''),
            status_text = COALESCE(status_text, ''),
            show_countdown = COALESCE(show_countdown, 1),
            is_completed = COALESCE(is_completed, 0),
            is_visible = COALESCE(is_visible, 1),
            order_index = COALESCE(order_index, 0),
            created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
        """
    )


def _rebuild_goals_table_if_needed(cursor) -> int:
    """
    Rebuild goals table if legacy NOT NULL constraints exist on start/end dates.

    SQLite cannot drop NOT NULL in-place, so we recreate the table with the
    correct nullable schema and copy data over.
    Returns 1 if rebuild occurred, else 0.
    """
    cursor.execute("PRAGMA table_info(goals)")
    columns = cursor.fetchall()
    needs_rebuild = any(col[1] in ('start_date', 'end_date') and col[3] == 1 for col in columns)
    if not needs_rebuild:
        return 0

    cursor.execute("ALTER TABLE goals RENAME TO goals_old")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            goal_type TEXT NOT NULL,
            text TEXT DEFAULT '',
            start_date TEXT,
            end_date TEXT,
            end_time TEXT DEFAULT '',
            status_text TEXT DEFAULT '',
            show_countdown INTEGER DEFAULT 1,
            is_completed INTEGER DEFAULT 0,
            completed_at DATETIME,
            is_visible INTEGER DEFAULT 1,
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        INSERT INTO goals (
            id, name, goal_type, text, start_date, end_date, end_time, status_text,
            show_countdown, is_completed, completed_at, is_visible, order_index, created_at, updated_at
        )
        SELECT
            id, name, goal_type, text, start_date, end_date, end_time, status_text,
            show_countdown, is_completed, completed_at, is_visible, order_index, created_at, updated_at
        FROM goals_old
        """
    )

    cursor.execute("DROP TABLE goals_old")
    return 1


def _migrate_legacy_goals(cursor) -> tuple[int, int]:
    """Migrate sprint and quarterly goals if those tables exist."""
    migrated_sprint = 0
    migrated_quarterly = 0

    try:
        cursor.execute('SELECT id, text, start_date, end_date, created_at, updated_at FROM sprint_goals')
        sprint_goals = cursor.fetchall()
        for idx, goal in enumerate(sprint_goals):
            cursor.execute(
                '''
                INSERT INTO goals (name, goal_type, text, start_date, end_date, show_countdown, order_index, created_at, updated_at)
                VALUES (?, 'Sprint', ?, ?, ?, 1, ?, ?, ?)
                ''',
                ('Sprint Goal', goal[1], goal[2], goal[3], idx, goal[4], goal[5]),
            )
            migrated_sprint += 1
    except sqlite3.OperationalError:
        # sprint_goals table might not exist
        pass

    try:
        cursor.execute('SELECT id, text, start_date, end_date, created_at, updated_at FROM quarterly_goals')
        quarterly_goals = cursor.fetchall()
        for idx, goal in enumerate(quarterly_goals):
            cursor.execute(
                '''
                INSERT INTO goals (name, goal_type, text, start_date, end_date, show_countdown, order_index, created_at, updated_at)
                VALUES (?, 'Quarterly', ?, ?, ?, 1, ?, ?, ?)
                ''',
                ('Quarterly Goal', goal[1], goal[2], goal[3], 1000 + idx, goal[4], goal[5]),
            )
            migrated_quarterly += 1
    except sqlite3.OperationalError:
        # quarterly_goals table might not exist
        pass

    return migrated_sprint, migrated_quarterly


def upgrade(db_path: str) -> Tuple[bool, str]:
    """Create goals table and migrate sprint/quarterly goals."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # If the table already exists, ensure required columns are present
        if _table_exists(cursor, 'goals'):
            updated = _add_name_column_if_missing(cursor)
            _ensure_goal_columns(cursor)
            rebuilt = _rebuild_goals_table_if_needed(cursor)

            cursor.execute("SELECT COUNT(*) FROM goals")
            existing_count = cursor.fetchone()[0]
            migrated_sprint = 0
            migrated_quarterly = 0

            # If empty, attempt to migrate legacy tables for convenience
            if existing_count == 0:
                migrated_sprint, migrated_quarterly = _migrate_legacy_goals(cursor)

            conn.commit()
            conn.close()
            return (
                True,
                f"Goals table already exists; ensured name column (backfilled {updated} rows) "
                f"and schema (rebuilt={bool(rebuilt)}). "
                f"Migrated {migrated_sprint} sprint and {migrated_quarterly} quarterly goals."
            )

        # Create new goals table
        # Note: start_date and end_date are nullable for lifestyle goals (ongoing goals without dates)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                goal_type TEXT NOT NULL,
                text TEXT DEFAULT '',
                start_date TEXT,
                end_date TEXT,
                end_time TEXT DEFAULT '',
                status_text TEXT DEFAULT '',
                show_countdown INTEGER DEFAULT 1,
                is_completed INTEGER DEFAULT 0,
                completed_at DATETIME,
                is_visible INTEGER DEFAULT 1,
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        migrated_sprint, migrated_quarterly = _migrate_legacy_goals(cursor)

        conn.commit()
        conn.close()

        total_migrated = migrated_sprint + migrated_quarterly
        return True, f'Created goals table and migrated {total_migrated} existing goals ({migrated_sprint} sprint, {migrated_quarterly} quarterly)'
    except Exception as e:
        return False, f'Migration failed: {str(e)}'


def downgrade(db_path: str) -> Tuple[bool, str]:
    """Remove goals table (data loss warning)."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS goals')
        conn.commit()
        conn.close()
        return True, 'Removed goals table'
    except Exception as e:
        return False, f'Downgrade failed: {str(e)}'


def migrate_up(db_path: str):
    """Compat wrapper used by run_migrations.py."""
    success, _message = upgrade(db_path)
    return success


def migrate_down(db_path: str):
    """Compat wrapper for rollbacks."""
    success, _message = downgrade(db_path)
    return success


