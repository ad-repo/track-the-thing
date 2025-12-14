"""
Migration 031: Add MCP server configuration

Adds mcp_servers table for Docker-based MCP server configurations
and mcp_routing_rules table for keyword-based routing.

Also adds MCP settings columns to app_settings table.
"""

import sqlite3


def migrate_up(db_path):
    """Add MCP server tables and settings columns."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create mcp_servers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            image TEXT NOT NULL,
            port INTEGER NOT NULL,
            description TEXT DEFAULT '',
            env_vars TEXT DEFAULT '[]',
            status TEXT DEFAULT 'stopped',
            last_health_check DATETIME,
            auto_start INTEGER DEFAULT 0,
            source TEXT DEFAULT 'local',
            manifest_url TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created mcp_servers table")

    # Create mcp_routing_rules table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mcp_routing_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mcp_server_id INTEGER NOT NULL,
            pattern TEXT NOT NULL,
            priority INTEGER DEFAULT 0,
            is_enabled INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
        )
    """)
    print("Created mcp_routing_rules table")

    # Create index on mcp_servers name
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name)
    """)

    # Create index on mcp_routing_rules for efficient priority ordering
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_mcp_routing_rules_priority 
        ON mcp_routing_rules(priority DESC, is_enabled)
    """)

    # Add MCP settings columns to app_settings
    cursor.execute("PRAGMA table_info(app_settings)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'mcp_enabled' not in columns:
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN mcp_enabled INTEGER DEFAULT 0
        """)
        print("Added mcp_enabled column to app_settings")

    if 'mcp_idle_timeout' not in columns:
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN mcp_idle_timeout INTEGER DEFAULT 300
        """)
        print("Added mcp_idle_timeout column to app_settings")

    if 'mcp_fallback_to_llm' not in columns:
        cursor.execute("""
            ALTER TABLE app_settings 
            ADD COLUMN mcp_fallback_to_llm INTEGER DEFAULT 1
        """)
        print("Added mcp_fallback_to_llm column to app_settings")

    conn.commit()
    conn.close()
    return True


def migrate_down(db_path):
    """Drop MCP tables (settings columns are left for safety)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop tables in order (routing rules first due to foreign key)
    cursor.execute("DROP TABLE IF EXISTS mcp_routing_rules")
    cursor.execute("DROP TABLE IF EXISTS mcp_servers")
    print("Dropped MCP tables")

    conn.commit()
    conn.close()
    return True

