#!/usr/bin/env python3
"""
Migration 014: Fix timezone for existing entries

This migration reassociates note_entries with the correct daily_note based on
the user's timezone (defaults to America/New_York).

Problem: Entries created at 8pm EST (Nov 6) were stored with UTC timestamp
4am (Nov 7), so they appear on the wrong day.

Solution: Convert UTC timestamps to user's timezone and reassociate with
correct daily_note.

IMPORTANT: Only moves PAST entries. Future entries (current_date > today) are
intentionally left alone as users may create entries for future dates.

Fixed: 2025-11-07 - Added check to skip future dates
"""

import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ModuleNotFoundError:
    ZoneInfo = None


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


def migrate_up(db_path):
    """Apply the migration."""
    print(f"Connecting to database: {db_path}")

    if not os.path.exists(db_path):
        print(f"Warning: Database not found at {db_path}")
        print("Migration will be applied when the database is created.")
        return True

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        if ZoneInfo is None:
            print("⚠️  ZoneInfo module is unavailable in this environment. Skipping timezone fix.")
            return True

        # Default to America/New_York timezone
        timezone = ZoneInfo('America/New_York')

        # Get all entries with their current associations
        cursor.execute('''
            SELECT ne.id, ne.daily_note_id, ne.created_at, dn.date
            FROM note_entries ne
            LEFT JOIN daily_notes dn ON ne.daily_note_id = dn.id
            WHERE ne.created_at IS NOT NULL
            ORDER BY ne.created_at
        ''')
        entries = cursor.fetchall()

        if not entries:
            print("✓ No entries to check")
            return True

        print(f"Checking {len(entries)} entries for timezone issues...")

        moves = []
        today = datetime.now(timezone).strftime('%Y-%m-%d')

        for entry_id, current_daily_note_id, created_at_str, current_date in entries:
            if not current_date:
                # Entry is orphaned, we'll handle it
                pass

            try:
                # Parse UTC timestamp
                created_at_utc = datetime.strptime(created_at_str, '%Y-%m-%d %H:%M:%S.%f')
            except ValueError:
                # Try without microseconds
                try:
                    created_at_utc = datetime.strptime(created_at_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    print(f"⚠️  Skipping entry {entry_id}: invalid timestamp format")
                    continue

            created_at_utc = created_at_utc.replace(tzinfo=ZoneInfo('UTC'))

            # Convert to user's timezone
            created_at_local = created_at_utc.astimezone(timezone)
            correct_date = created_at_local.strftime('%Y-%m-%d')

            # ONLY move entries if:
            # 1. The correct_date is different from current_date AND
            # 2. The current_date is NOT in the future (user may have intentionally created future entries)
            if correct_date != current_date:
                # Skip if current_date is in the future (intentionally created future entry)
                if current_date and current_date > today:
                    print(f"  Skipping entry {entry_id}: future date {current_date} (intentionally created)")
                    continue

                moves.append({
                    'entry_id': entry_id,
                    'from_date': current_date or 'NULL',
                    'to_date': correct_date,
                    'timestamp_utc': created_at_str,
                    'timestamp_local': created_at_local.strftime('%Y-%m-%d %H:%M:%S')
                })

        if not moves:
            print("✓ All entries are already on the correct dates")
            return True

        print(f"Found {len(moves)} entries that need to be moved")

        # Show first few
        for move in moves[:5]:
            print(f"  Entry {move['entry_id']}: {move['from_date']} → {move['to_date']}")

        if len(moves) > 5:
            print(f"  ... and {len(moves) - 5} more entries")

        # Perform the moves
        moved_count = 0
        created_notes = []

        for move in moves:
            # Get or create daily_note for the correct date
            cursor.execute('SELECT id FROM daily_notes WHERE date = ?', (move['to_date'],))
            result = cursor.fetchone()

            if result:
                target_daily_note_id = result[0]
            else:
                # Create new daily_note
                cursor.execute('''
                    INSERT INTO daily_notes (date, fire_rating, daily_goal, created_at, updated_at)
                    VALUES (?, 0, '', ?, ?)
                ''', (move['to_date'], datetime.now(), datetime.now()))
                target_daily_note_id = cursor.lastrowid
                created_notes.append(move['to_date'])

            # Update the entry
            cursor.execute('''
                UPDATE note_entries
                SET daily_note_id = ?
                WHERE id = ?
            ''', (target_daily_note_id, move['entry_id']))
            moved_count += 1

        conn.commit()

        print(f"✓ Moved {moved_count} entries to correct dates")
        if created_notes:
            print(f"✓ Created {len(created_notes)} new daily_notes for missing dates")

        print("✓ Migration completed successfully")
        return True

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


def migrate_down(db_path):
    """Rollback the migration."""
    print(f"Connecting to database: {db_path}")
    print("⚠️  Warning: This migration cannot be automatically rolled back")
    print("⚠️  Entries have been reassociated with different dates")
    print("⚠️  Restore from backup if needed")
    return True


def main():
    """Run the migration."""
    db_path = get_db_path()

    if len(sys.argv) > 1 and sys.argv[1] == "down":
        success = migrate_down(db_path)
    else:
        success = migrate_up(db_path)

    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

