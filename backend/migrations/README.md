# Database Migrations

This directory contains database migration scripts for upgrading the Track the Thing database schema.

## ⚠️ CRITICAL REQUIREMENTS

**BEFORE running ANY migration:**

1. **Create a backup:**
   ```bash
   python migrations/pre_migration_backup.py
   ```

2. **Test on the test copy first:**
   ```bash
   # The backup script creates daily_notes.db.test
   # Test your migration on this copy
   python migrations/verify_migration.py  # Run before migration
   # Apply migration to test DB
   python migrations/verify_migration.py  # Run after migration
   ```

3. **Verify data integrity:**
   - Check row counts before/after
   - Verify foreign key constraints
   - Test actual application functionality

4. **Only then apply to production database**

**Migration must:**
- Handle upgrades from ALL previous versions
- Be idempotent (safe to run multiple times)
- Include both `migrate_up()` and `migrate_down()` functions
- Preserve ALL data during schema changes
- Update backup/restore scripts if data model changes

## Running Migrations

### Individual Migration

To run a specific migration:

```bash
# Apply migration
python migrations/001_add_title_field.py up

# Rollback migration
python migrations/001_add_title_field.py down
```

### All Migrations

To run all pending migrations:

```bash
python migrations/run_migrations.py
```

## Using Docker

If you're running the app in Docker:

```bash
# Apply migrations
docker-compose --env-file .dockerenv exec backend python migrations/001_add_title_field.py up

# Or run all migrations
docker-compose --env-file .dockerenv exec backend python migrations/run_migrations.py
```

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `pre_migration_backup.py` | **REQUIRED**: Create backup + test copy before any migration |
| `verify_migration.py` | Verify database integrity and data counts |
| `run_migrations.py` | Run all pending migrations in order |

## Migration List

| Version | Description | Date |
|---------|-------------|------|
| 001 | Add title field to note_entries | 2025-10-30 |
| 010 | Fix localhost URLs in content | 2025-11-01 |
| 011 | Add sprint/quarterly goals to daily_notes | 2025-11-06 |
| 012 | Move goals to app_settings table | 2025-11-06 |
| 013 | Add goal date fields to app_settings | 2025-11-07 |
| 014 | **Automatic timezone fix** - moves PAST entries to correct dates (skips future dates) | 2025-11-07 (fixed 11/7 evening) |
| 015 | **Date-aware goals** - creates sprint_goals and quarterly_goals tables for historical tracking | 2025-11-07 |
| 016 | **Lists feature** - creates lists and entry_lists tables for Trello-style organization | 2025-11-11 |
| 017 | **Pinned entries** - adds is_pinned column for auto-copying entries to future days | 2025-11-12 |
| 018 | **List labels** - creates list_labels association table for many-to-many relationship between lists and labels | 2025-11-12 |
| 019 | **Kanban support** - adds is_kanban and kanban_order columns for Kanban board functionality | 2025-11-13 |
| 020 | **Custom emojis** - creates custom_emojis table for user-uploaded emoji images | 2025-11-13 |
| 021 | **Emoji library setting** - adds emoji_library preference to app_settings | 2025-11-13 |
| 022 | **Remove duplicate entries** - cleans up duplicate note entries from pinned copy logic | 2025-11-13 |
| 023 | **Sprint name setting** - adds sprint_name customization to app_settings | 2025-11-14 |
| 024 | **Daily goal end time** - adds daily_goal_end_time to app_settings for countdown timer | 2025-11-14 |
| 025 | **Reminders** - creates reminders table for date-time based reminders on entry cards | 2025-11-22 |
|| 026 | **Texture settings** - adds texture_enabled and texture_settings to app_settings for UI texture system | 2025-11-22 |

## Creating New Migrations

When creating a new migration:

1. Name it with the next sequential number: `00X_descriptive_name.py`
2. Include both `migrate_up()` and `migrate_down()` functions
3. Make migrations idempotent (safe to run multiple times)
4. Test both up and down migrations
5. Update this README with the migration details

## Notes

- Migrations are designed to work with SQLite
- Each migration checks if changes are already applied before running
- Always backup your database before running migrations manually
- The Docker setup automatically runs migrations on startup

