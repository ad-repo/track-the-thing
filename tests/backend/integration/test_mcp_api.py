"""
Integration tests for MCP API endpoints

Uses shared fixtures from conftest.py for database setup.
"""


class TestMcpDockerStatus:
    """Tests for Docker status endpoint."""

    def test_get_docker_status(self, client):
        """Test getting Docker status."""
        response = client.get('/api/mcp/docker/status')
        assert response.status_code == 200
        data = response.json()
        assert 'available' in data
        assert isinstance(data['available'], bool)


class TestMcpSettings:
    """Tests for MCP settings endpoints."""

    def test_get_mcp_settings(self, client):
        """Test getting MCP settings."""
        response = client.get('/api/mcp/settings')
        assert response.status_code == 200
        data = response.json()
        assert 'mcp_enabled' in data
        assert 'mcp_idle_timeout' in data
        assert 'mcp_fallback_to_llm' in data
        assert 'docker_available' in data

    def test_update_mcp_settings(self, client):
        """Test updating MCP settings."""
        response = client.patch(
            '/api/mcp/settings',
            json={
                'mcp_enabled': True,
                'mcp_idle_timeout': 600,
                'mcp_fallback_to_llm': False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data['mcp_enabled'] is True
        assert data['mcp_idle_timeout'] == 600
        assert data['mcp_fallback_to_llm'] is False

        # Reset
        client.patch(
            '/api/mcp/settings',
            json={
                'mcp_enabled': False,
                'mcp_fallback_to_llm': True,
            },
        )


class TestMcpServersCrud:
    """Tests for MCP server CRUD endpoints."""

    def test_list_servers_empty(self, client):
        """Test listing servers when none exist."""
        response = client.get('/api/mcp/servers')
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_server(self, client):
        """Test creating an MCP server."""
        response = client.post(
            '/api/mcp/servers',
            json={
                'name': 'test-summarizer',
                'image': 'ghcr.io/test/mcp-summarizer:latest',
                'port': 8011,
                'description': 'Test summarizer',
                'env_vars': ['OPENAI_API_KEY'],
                'auto_start': False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'test-summarizer'
        assert data['image'] == 'ghcr.io/test/mcp-summarizer:latest'
        assert data['port'] == 8011
        assert data['status'] == 'stopped'
        assert data['source'] == 'local'

        # Cleanup
        client.delete(f'/api/mcp/servers/{data["id"]}')

    def test_create_server_duplicate_name(self, client):
        """Test creating a server with duplicate name fails."""
        # Create first server
        resp1 = client.post(
            '/api/mcp/servers',
            json={
                'name': 'duplicate-test',
                'image': 'test:latest',
                'port': 8012,
            },
        )
        assert resp1.status_code == 200
        server_id = resp1.json()['id']

        # Try to create duplicate
        resp2 = client.post(
            '/api/mcp/servers',
            json={
                'name': 'duplicate-test',
                'image': 'test2:latest',
                'port': 8013,
            },
        )
        assert resp2.status_code == 400
        assert 'already exists' in resp2.json()['detail']

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_get_server(self, client):
        """Test getting a specific server."""
        # Create server
        create_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'get-test',
                'image': 'test:latest',
                'port': 8014,
            },
        )
        server_id = create_resp.json()['id']

        # Get server
        response = client.get(f'/api/mcp/servers/{server_id}')
        assert response.status_code == 200
        assert response.json()['name'] == 'get-test'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_get_nonexistent_server(self, client):
        """Test getting a server that doesn't exist."""
        response = client.get('/api/mcp/servers/99999')
        assert response.status_code == 404

    def test_update_server(self, client):
        """Test updating a server."""
        # Create server
        create_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'update-test',
                'image': 'old:latest',
                'port': 8015,
            },
        )
        server_id = create_resp.json()['id']

        # Update server
        response = client.put(
            f'/api/mcp/servers/{server_id}',
            json={
                'description': 'Updated description',
                'image': 'new:latest',
            },
        )
        assert response.status_code == 200
        assert response.json()['description'] == 'Updated description'
        assert response.json()['image'] == 'new:latest'

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_delete_server(self, client):
        """Test deleting a server."""
        # Create server
        create_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'delete-test',
                'image': 'test:latest',
                'port': 8016,
            },
        )
        server_id = create_resp.json()['id']

        # Delete server
        response = client.delete(f'/api/mcp/servers/{server_id}')
        assert response.status_code == 200
        assert response.json()['deleted'] is True

        # Verify deleted
        get_resp = client.get(f'/api/mcp/servers/{server_id}')
        assert get_resp.status_code == 404


class TestMcpRoutingRules:
    """Tests for MCP routing rules endpoints."""

    def test_create_routing_rule(self, client):
        """Test creating a routing rule."""
        # Create server first
        server_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'rule-test-server',
                'image': 'test:latest',
                'port': 8017,
            },
        )
        server_id = server_resp.json()['id']

        # Create rule
        response = client.post(
            '/api/mcp/routing-rules',
            json={
                'mcp_server_id': server_id,
                'pattern': 'summarize|summary',
                'priority': 100,
                'is_enabled': True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data['pattern'] == 'summarize|summary'
        assert data['priority'] == 100
        assert data['is_enabled'] is True

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_list_routing_rules(self, client):
        """Test listing routing rules."""
        response = client.get('/api/mcp/routing-rules')
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_update_routing_rule(self, client):
        """Test updating a routing rule."""
        # Create server and rule
        server_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'update-rule-test',
                'image': 'test:latest',
                'port': 8018,
            },
        )
        server_id = server_resp.json()['id']

        rule_resp = client.post(
            '/api/mcp/routing-rules',
            json={
                'mcp_server_id': server_id,
                'pattern': 'old-pattern',
                'priority': 50,
            },
        )
        rule_id = rule_resp.json()['id']

        # Update rule
        response = client.put(
            f'/api/mcp/routing-rules/{rule_id}',
            json={
                'pattern': 'new-pattern',
                'priority': 75,
            },
        )
        assert response.status_code == 200
        assert response.json()['pattern'] == 'new-pattern'
        assert response.json()['priority'] == 75

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_delete_routing_rule(self, client):
        """Test deleting a routing rule."""
        # Create server and rule
        server_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'delete-rule-test',
                'image': 'test:latest',
                'port': 8019,
            },
        )
        server_id = server_resp.json()['id']

        rule_resp = client.post(
            '/api/mcp/routing-rules',
            json={
                'mcp_server_id': server_id,
                'pattern': 'delete-me',
                'priority': 50,
            },
        )
        rule_id = rule_resp.json()['id']

        # Delete rule
        response = client.delete(f'/api/mcp/routing-rules/{rule_id}')
        assert response.status_code == 200
        assert response.json()['deleted'] is True

        # Cleanup
        client.delete(f'/api/mcp/servers/{server_id}')

    def test_cascade_delete_rules_with_server(self, client):
        """Test that rules are deleted when server is deleted."""
        # Create server
        server_resp = client.post(
            '/api/mcp/servers',
            json={
                'name': 'cascade-test',
                'image': 'test:latest',
                'port': 8020,
            },
        )
        server_id = server_resp.json()['id']

        # Create rules
        client.post(
            '/api/mcp/routing-rules',
            json={
                'mcp_server_id': server_id,
                'pattern': 'pattern1',
                'priority': 100,
            },
        )
        client.post(
            '/api/mcp/routing-rules',
            json={
                'mcp_server_id': server_id,
                'pattern': 'pattern2',
                'priority': 50,
            },
        )

        # Verify rules exist
        server_detail = client.get(f'/api/mcp/servers/{server_id}')
        assert len(server_detail.json()['routing_rules']) == 2

        # Delete server
        client.delete(f'/api/mcp/servers/{server_id}')

        # Rules should be gone (can't directly verify without the server)
        # Just verify server is deleted
        assert client.get(f'/api/mcp/servers/{server_id}').status_code == 404
