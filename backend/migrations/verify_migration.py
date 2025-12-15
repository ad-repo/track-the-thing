#!/usr/bin/env python3
"""
Migration Verification Script

Run this before and after migrations to ensure data integrity.
Follows project requirement: "Test migration on a copy of the database before committing"
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path


def get_db_path():
    """Get the database path."""
    possible_paths = [
        Path(__file__).parent.parent / "data" / "daily_notes.db",
        Path.cwd() / "data" / "daily_notes.db",
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    return str(possible_paths[0])


def verify_database():
    """Verify database integrity and data counts."""
    db_path = get_db_path()

    print("=" * 60)
    print("Database Verification Report")
    print("=" * 60)
    print(f"Database: {db_path}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]

    print(f"Found {len(tables)} tables:")
    print()

    total_rows = 0
    table_stats = {}

    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        total_rows += count
        table_stats[table] = count
        print(f"  {table:30} {count:>10} rows")

    print()
    print(f"Total rows across all tables: {total_rows:,}")
    print()

    # Verify foreign key integrity
    print("Foreign Key Integrity Checks:")
    print()

    # Check note_entries -> daily_notes
    cursor.execute("""
        SELECT COUNT(*)
        FROM note_entries ne
        LEFT JOIN daily_notes dn ON ne.daily_note_id = dn.id
        WHERE ne.daily_note_id IS NOT NULL AND dn.id IS NULL
    """)
    orphaned_entries = cursor.fetchone()[0]

    if orphaned_entries > 0:
        print(f"  ⚠️  {orphaned_entries} note_entries with invalid daily_note_id")
    else:
        print("  ✓ All note_entries have valid daily_note_id references")

    # Check entry_labels -> note_entries
    cursor.execute("""
        SELECT COUNT(*)
        FROM entry_labels el
        LEFT JOIN note_entries ne ON el.entry_id = ne.id
        WHERE ne.id IS NULL
    """)
    orphaned_entry_labels = cursor.fetchone()[0]

    if orphaned_entry_labels > 0:
        print(f"  ⚠️  {orphaned_entry_labels} entry_labels with invalid entry_id")
    else:
        print("  ✓ All entry_labels have valid entry_id references")

    # Check entry_labels -> labels
    cursor.execute("""
        SELECT COUNT(*)
        FROM entry_labels el
        LEFT JOIN labels l ON el.label_id = l.id
        WHERE l.id IS NULL
    """)
    orphaned_label_refs = cursor.fetchone()[0]

    if orphaned_label_refs > 0:
        print(f"  ⚠️  {orphaned_label_refs} entry_labels with invalid label_id")
    else:
        print("  ✓ All entry_labels have valid label_id references")

    print()

    # Check for data in recent days
    cursor.execute("""
        SELECT dn.date, COUNT(ne.id) as entry_count
        FROM daily_notes dn
        LEFT JOIN note_entries ne ON ne.daily_note_id = dn.id
        GROUP BY dn.date
        ORDER BY dn.date DESC
        LIMIT 10
    """)
    recent_days = cursor.fetchall()

    if recent_days:
        print("Recent Activity (last 10 days with data):")
        print()
        for date, count in recent_days:
            print(f"  {date}: {count} entries")
    else:
        print("⚠️  No daily_notes found")

    print()
    print("=" * 60)

    conn.close()

    # Return status
    if orphaned_entries > 0 or orphaned_entry_labels > 0 or orphaned_label_refs > 0:
        print("❌ Database has integrity issues")
        return 1
    else:
        print("✅ Database integrity verified")
        return 0


if __name__ == "__main__":
    sys.exit(verify_database())

