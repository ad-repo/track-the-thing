#!/usr/bin/env python3
"""
Migration: Remove duplicate pinned entries
Version: 022
Date: 2025-11-15

This migration removes duplicate entries that were created due to the bug in
copy_pinned_entries_to_date() where it only checked against pinned entries,
causing duplicates when entries were unpinned.

It keeps the most recent entry for each (daily_note_id, content, title) combination.
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


def migrate_up(db_path):
    """Remove duplicate entries, keeping the most recent one."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if note_entries table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='note_entries'
        """)
        if not cursor.fetchone():
            print("note_entries table does not exist yet. Skipping migration.")
            conn.close()
            return True

        print("Finding duplicate entries...")

        # Find all duplicate entries (same daily_note_id, content, and title)
        cursor.execute("""
            SELECT daily_note_id, content, title, COUNT(*) as count
            FROM note_entries
            GROUP BY daily_note_id, content, title
            HAVING COUNT(*) > 1
        """)

        duplicates = cursor.fetchall()
        total_duplicates = len(duplicates)

        if total_duplicates == 0:
            print("No duplicate entries found.")
            print("Migration 022 completed successfully.")
            conn.close()
            return True

        print(f"Found {total_duplicates} sets of duplicate entries.")
        total_removed = 0

        for daily_note_id, content, title, count in duplicates:
            # Get all entries for this combination, ordered by created_at DESC
            cursor.execute("""
                SELECT id, created_at
                FROM note_entries
                WHERE daily_note_id = ? AND content = ? AND title = ?
                ORDER BY created_at DESC
            """, (daily_note_id, content, title))

            entries = cursor.fetchall()

            # Keep the first one (most recent), delete the rest
            entries_to_delete = [entry[0] for entry in entries[1:]]

            if entries_to_delete:
                placeholders = ','.join('?' * len(entries_to_delete))

                # Delete from association tables first (due to foreign keys)
                cursor.execute(f"DELETE FROM entry_labels WHERE entry_id IN ({placeholders})", entries_to_delete)
                cursor.execute(f"DELETE FROM entry_lists WHERE entry_id IN ({placeholders})", entries_to_delete)

                # Delete the duplicate entries
                cursor.execute(f"DELETE FROM note_entries WHERE id IN ({placeholders})", entries_to_delete)

                total_removed += len(entries_to_delete)
                print(f"  Removed {len(entries_to_delete)} duplicate(s) for entry with title: '{title[:50]}...'")

        conn.commit()
        print(f"\nSuccessfully removed {total_removed} duplicate entries.")
        print("Migration 022 completed successfully.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()


def migrate_down(db_path):
    """This migration cannot be reversed as we don't know which entries were duplicates."""
    print("Migration 022 cannot be reversed - duplicate entries have been permanently removed.")
    print("If you need to restore data, use a backup.")


if __name__ == '__main__':
    db_path = get_db_path()
    print(f"Using database: {db_path}")

    if len(sys.argv) > 1 and sys.argv[1] == 'down':
        migrate_down(db_path)
    else:
        migrate_up(db_path)

