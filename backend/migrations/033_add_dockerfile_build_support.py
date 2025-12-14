"""
Migration 033: Add Dockerfile build support for MCP servers

Adds fields to support building MCP server images from Dockerfiles:
- build_source: 'image' (pre-built) or 'dockerfile' (build from source)
- build_context: Path to directory containing Dockerfile
- dockerfile_path: Optional path to Dockerfile relative to build_context
"""

import sqlite3


def migrate_up(db_path: str) -> None:
    """Add Dockerfile build fields to mcp_servers table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if columns already exist
    cursor.execute("PRAGMA table_info(mcp_servers)")
    columns = {row[1] for row in cursor.fetchall()}

    if 'build_source' not in columns:
        cursor.execute(
            "ALTER TABLE mcp_servers ADD COLUMN build_source TEXT DEFAULT 'image'"
        )
        print("Added build_source column to mcp_servers")

    if 'build_context' not in columns:
        cursor.execute(
            "ALTER TABLE mcp_servers ADD COLUMN build_context TEXT DEFAULT ''"
        )
        print("Added build_context column to mcp_servers")

    if 'dockerfile_path' not in columns:
        cursor.execute(
            "ALTER TABLE mcp_servers ADD COLUMN dockerfile_path TEXT DEFAULT ''"
        )
        print("Added dockerfile_path column to mcp_servers")

    conn.commit()
    conn.close()


def migrate_down(db_path: str) -> None:
    """Remove Dockerfile build fields (SQLite doesn't support DROP COLUMN easily)."""
    # SQLite doesn't support DROP COLUMN in older versions
    # For rollback, we'd need to recreate the table
    print("Rollback not implemented - columns will remain but be unused")


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage: python 033_add_dockerfile_build_support.py <db_path>")
        sys.exit(1)
    migrate_up(sys.argv[1])

