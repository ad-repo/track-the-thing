"""
Migration 032: Add remote MCP server support

Adds fields to mcp_servers table to support remote/HTTP MCP servers
in addition to Docker-based ones.

New fields:
- server_type: 'docker' or 'remote'
- url: Remote endpoint URL (for remote servers)
- headers: JSON string for authentication headers
"""

import sqlite3


def migrate_up(db_path):
    """Add remote MCP server fields."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(mcp_servers)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'server_type' not in columns:
        cursor.execute("ALTER TABLE mcp_servers ADD COLUMN server_type TEXT DEFAULT 'docker'")
        print("Added server_type column to mcp_servers.")

    if 'url' not in columns:
        cursor.execute("ALTER TABLE mcp_servers ADD COLUMN url TEXT DEFAULT ''")
        print("Added url column to mcp_servers.")

    if 'headers' not in columns:
        cursor.execute("ALTER TABLE mcp_servers ADD COLUMN headers TEXT DEFAULT '{}'")
        print("Added headers column to mcp_servers.")

    conn.commit()
    conn.close()
    return True


def migrate_down(db_path):
    """Remove remote MCP server fields (SQLite doesn't support DROP COLUMN easily)."""
    # SQLite doesn't support DROP COLUMN before 3.35
    # We'll leave the columns but they won't be used
    print("Note: SQLite migration rollback - columns will remain but unused.")
    return True

