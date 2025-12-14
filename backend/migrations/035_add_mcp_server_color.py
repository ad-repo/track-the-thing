"""
Migration 035: Add color field to MCP servers

Adds a color field to mcp_servers table for unique visual identification
in the UI. Each MCP server can have a distinct color for its indicator.
"""

import sqlite3

# Predefined color palette for MCP servers
MCP_COLORS = [
    '#22c55e',  # Green (default)
    '#3b82f6',  # Blue
    '#f59e0b',  # Amber
    '#ef4444',  # Red
    '#8b5cf6',  # Purple
    '#06b6d4',  # Cyan
    '#ec4899',  # Pink
    '#f97316',  # Orange
]


def migrate_up(db_path: str) -> bool:
    """Add color column to mcp_servers table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute('PRAGMA table_info(mcp_servers)')
        columns = {row[1] for row in cursor.fetchall()}

        if 'color' not in columns:
            # Add color column with default green
            cursor.execute("ALTER TABLE mcp_servers ADD COLUMN color TEXT DEFAULT '#22c55e'")
            print("Added color column to mcp_servers (default: '#22c55e')")

            # Assign unique colors to existing servers
            cursor.execute('SELECT id FROM mcp_servers ORDER BY id')
            servers = cursor.fetchall()
            for i, (server_id,) in enumerate(servers):
                color = MCP_COLORS[i % len(MCP_COLORS)]
                cursor.execute('UPDATE mcp_servers SET color = ? WHERE id = ?', (color, server_id))
            print(f'Assigned unique colors to {len(servers)} existing servers')

        conn.commit()
        return True
    except Exception as e:
        print(f'Migration failed: {e}')
        conn.rollback()
        return False
    finally:
        conn.close()


def migrate_down(db_path: str) -> None:
    """Remove color column (SQLite doesn't support DROP COLUMN easily)."""
    print('Rollback not implemented - column will remain but be unused')


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print('Usage: python 035_add_mcp_server_color.py <db_path>')
        sys.exit(1)
    migrate_up(sys.argv[1])
