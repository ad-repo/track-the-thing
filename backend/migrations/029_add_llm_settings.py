"""
Migration 029: Add LLM integration settings and conversation history

Adds API key storage for OpenAI, Anthropic, and Gemini providers,
along with conversation history per entry for context persistence.
"""
import sqlite3


def _column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return any(col[1] == column_name for col in cursor.fetchall())


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cursor.fetchone() is not None


def upgrade(db_path: str) -> tuple[bool, str]:
    """Add LLM settings columns and create conversation history table."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Add LLM columns to app_settings if they don't exist
        llm_columns = {
            'llm_provider': "ALTER TABLE app_settings ADD COLUMN llm_provider TEXT DEFAULT 'openai'",
            'openai_api_key': "ALTER TABLE app_settings ADD COLUMN openai_api_key TEXT DEFAULT ''",
            'anthropic_api_key': "ALTER TABLE app_settings ADD COLUMN anthropic_api_key TEXT DEFAULT ''",
            'gemini_api_key': "ALTER TABLE app_settings ADD COLUMN gemini_api_key TEXT DEFAULT ''",
            'llm_global_prompt': "ALTER TABLE app_settings ADD COLUMN llm_global_prompt TEXT DEFAULT ''",
        }

        columns_added = 0
        for col, alter_sql in llm_columns.items():
            if not _column_exists(cursor, 'app_settings', col):
                cursor.execute(alter_sql)
                columns_added += 1

        # Create llm_conversations table if it doesn't exist
        table_created = False
        if not _table_exists(cursor, 'llm_conversations'):
            cursor.execute('''
                CREATE TABLE llm_conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_id INTEGER NOT NULL,
                    messages TEXT NOT NULL DEFAULT '[]',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (entry_id) REFERENCES note_entries(id) ON DELETE CASCADE
                )
            ''')
            cursor.execute('CREATE INDEX idx_llm_conversations_entry_id ON llm_conversations(entry_id)')
            table_created = True

        conn.commit()
        conn.close()

        return True, f'Added {columns_added} LLM columns to app_settings, created conversation table: {table_created}'
    except Exception as e:
        return False, f'Migration failed: {str(e)}'


def downgrade(db_path: str) -> tuple[bool, str]:
    """Remove LLM settings (note: SQLite cannot drop columns easily)."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS llm_conversations')
        conn.commit()
        conn.close()
        return True, 'Removed llm_conversations table (columns remain in app_settings)'
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

