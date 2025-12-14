"""Integration tests for STDIO MCP transport."""


# Note: Uses `client` fixture from conftest.py which properly sets up test database


class TestStdioServerCRUD:
    """Tests for STDIO MCP server CRUD operations."""

    def test_create_stdio_server(self, client):
        """Test creating an MCP server with stdio transport."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-stdio-server',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'image': 'mcp/brave-search',
                'description': 'Test STDIO server',
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'test-stdio-server'
        assert data['server_type'] == 'docker'
        assert data['transport_type'] == 'stdio'
        assert data['image'] == 'mcp/brave-search'
        assert data['port'] == 0  # Port not required for stdio
        assert data['status'] == 'stopped'

        # Cleanup
        client.delete(f"/api/mcp/servers/{data['id']}")

    def test_create_stdio_server_requires_image(self, client):
        """Test that creating stdio server without image fails."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-stdio-no-image',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'description': 'Should fail',
            },
        )

        assert response.status_code == 400
        assert 'Docker image is required for stdio servers' in response.json()['detail']

    def test_create_stdio_server_does_not_require_port(self, client):
        """Test that stdio server doesn't require port."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-stdio-no-port',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'image': 'mcp/test',
                # No port specified
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data['port'] == 0

        # Cleanup
        client.delete(f"/api/mcp/servers/{data['id']}")

    def test_update_server_transport_type(self, client):
        """Test updating a server's transport type."""
        # First create an HTTP server
        create_response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-update-transport',
                'server_type': 'docker',
                'transport_type': 'http',
                'image': 'mcp/test',
                'port': 8011,
            },
        )
        assert create_response.status_code == 200
        server_id = create_response.json()['id']

        # Update to stdio
        update_response = client.put(
            f'/api/mcp/servers/{server_id}',
            json={
                'transport_type': 'stdio',
            },
        )

        assert update_response.status_code == 200
        assert update_response.json()['transport_type'] == 'stdio'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_list_servers_includes_transport_type(self, client):
        """Test that listing servers includes transport_type field."""
        # Create a stdio server
        create_response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-list-transport',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'image': 'mcp/test',
            },
        )
        assert create_response.status_code == 200
        server_id = create_response.json()['id']

        # List servers
        list_response = client.get('/api/mcp/servers')
        assert list_response.status_code == 200

        servers = list_response.json()
        test_server = next((s for s in servers if s['id'] == server_id), None)
        assert test_server is not None
        assert test_server['transport_type'] == 'stdio'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_get_server_includes_transport_type(self, client):
        """Test that getting a server includes transport_type field."""
        # Create a stdio server
        create_response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-get-transport',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'image': 'mcp/test',
            },
        )
        assert create_response.status_code == 200
        server_id = create_response.json()['id']

        # Get server
        get_response = client.get(f'/api/mcp/servers/{server_id}')
        assert get_response.status_code == 200
        assert get_response.json()['transport_type'] == 'stdio'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')


class TestStdioServerBackupRestore:
    """Tests for backup/restore with stdio servers."""

    def test_export_includes_transport_type(self, client):
        """Test that backup export includes transport_type field."""
        # Create a stdio server
        create_response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-export-transport',
                'server_type': 'docker',
                'transport_type': 'stdio',
                'image': 'mcp/brave-search',
            },
        )
        assert create_response.status_code == 200
        server_id = create_response.json()['id']

        # Export data
        export_response = client.get('/api/backup/export')
        assert export_response.status_code == 200

        export_data = export_response.json()
        mcp_servers = export_data.get('mcp_servers', [])
        test_server = next((s for s in mcp_servers if s['id'] == server_id), None)

        assert test_server is not None
        assert test_server['transport_type'] == 'stdio'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')


class TestStdioDefaultTransportType:
    """Tests for default transport_type behavior."""

    def test_http_is_default_transport_type(self, client):
        """Test that http is the default transport type."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-default-transport',
                'server_type': 'docker',
                'image': 'mcp/test',
                'port': 8011,
                # No transport_type specified
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data['transport_type'] == 'http'

        # Cleanup
        client.delete(f"/api/mcp/servers/{data['id']}")

    def test_remote_server_uses_http_transport(self, client):
        """Test that remote servers use http transport."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-remote-transport',
                'server_type': 'remote',
                'url': 'https://example.com/mcp',
                # No transport_type specified
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data['transport_type'] == 'http'

        # Cleanup
        client.delete(f"/api/mcp/servers/{data['id']}")
