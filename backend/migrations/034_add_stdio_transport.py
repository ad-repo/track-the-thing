"""
Migration 034: Add stdio transport support for MCP servers

Adds transport_type field to support stdio-based MCP servers like Brave Search.
Transport types:
- 'http': Traditional HTTP-based communication (default for existing servers)
- 'stdio': stdin/stdout communication via Docker interactive mode

For stdio servers:
- Container runs with -i flag (interactive, stdin open)
- JSON-RPC 2.0 messages sent to stdin
- Responses read from stdout
- No port binding required
"""

import sqlite3


def migrate_up(db_path: str) -> bool:
    """Add transport_type column to mcp_servers table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(mcp_servers)")
        columns = {row[1] for row in cursor.fetchall()}

        if 'transport_type' not in columns:
            # Default to 'http' for existing servers (backward compatible)
            cursor.execute(
                "ALTER TABLE mcp_servers ADD COLUMN transport_type TEXT DEFAULT 'http'"
            )
            print("Added transport_type column to mcp_servers (default: 'http')")

            # Update existing docker servers to have transport_type='http'
            cursor.execute(
                "UPDATE mcp_servers SET transport_type = 'http' WHERE server_type = 'docker' AND transport_type IS NULL"
            )

            # Remote servers also use http transport
            cursor.execute(
                "UPDATE mcp_servers SET transport_type = 'http' WHERE server_type = 'remote' AND transport_type IS NULL"
            )
            print("Updated existing servers with transport_type='http'")

        conn.commit()
        return True
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def migrate_down(db_path: str) -> None:
    """Remove transport_type column (SQLite doesn't support DROP COLUMN easily)."""
    print("Rollback not implemented - column will remain but be unused")


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python 034_add_stdio_transport.py <db_path>")
        sys.exit(1)
    migrate_up(sys.argv[1])

