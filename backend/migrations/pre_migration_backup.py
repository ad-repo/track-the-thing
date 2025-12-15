#!/usr/bin/env python3
"""
Pre-Migration Backup Script

MUST be run before ANY migration as per project rules:
"Any change involving database schema modifications MUST include:
 - Test migration on a copy of the database before committing"

This script:
1. Creates a timestamped backup
2. Creates a test copy for migration testing
3. Verifies the backup is valid
"""

import shutil
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
            return path

    print("❌ Database not found!")
    sys.exit(1)


def create_backup(reason="migration"):
    """Create a timestamped backup of the database."""
    db_path = get_db_path()
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.parent / f"daily_notes.db.backup-before-{reason}-{timestamp}"

    print(f"Creating backup: {backup_path.name}")
    print(f"Source: {db_path}")
    print(f"Size: {db_path.stat().st_size / 1024 / 1024:.2f} MB")

    # Copy database
    shutil.copy2(db_path, backup_path)

    # Verify backup is valid
    try:
        conn = sqlite3.connect(str(backup_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM daily_notes")
        daily_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM note_entries")
        entry_count = cursor.fetchone()[0]
        conn.close()

        print(f"✓ Backup verified: {daily_count} daily notes, {entry_count} entries")
        print(f"✓ Backup saved: {backup_path}")
        return backup_path

    except Exception as e:
        print(f"❌ Backup verification failed: {e}")
        backup_path.unlink()  # Delete invalid backup
        sys.exit(1)


def create_test_copy():
    """Create a test copy for migration testing."""
    db_path = get_db_path()
    test_path = db_path.parent / "daily_notes.db.test"

    print(f"\nCreating test copy: {test_path.name}")
    shutil.copy2(db_path, test_path)
    print(f"✓ Test copy created: {test_path}")
    print(f"\n⚠️  Run your migration on {test_path} first!")
    print("   Verify data integrity before applying to production database")

    return test_path


def main():
    """Main backup routine."""
    print("=" * 60)
    print("PRE-MIGRATION BACKUP")
    print("=" * 60)
    print()

    reason = sys.argv[1] if len(sys.argv) > 1 else "migration"

    # Create backup
    backup_path = create_backup(reason)

    # Create test copy
    test_path = create_test_copy()

    print()
    print("=" * 60)
    print("✅ BACKUP COMPLETE")
    print("=" * 60)
    print()
    print("Next steps:")
    print(f"1. Test your migration on: {test_path}")
    print("2. Verify data integrity")
    print("3. If successful, apply to production")
    print(f"4. Keep backup until verified: {backup_path.name}")
    print()


if __name__ == "__main__":
    main()

