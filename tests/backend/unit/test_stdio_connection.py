"""Tests for StdioMcpConnection class."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest


class TestStdioMcpConnection:
    """Tests for the StdioMcpConnection class."""

    @pytest.fixture
    def mock_docker_client(self):
        """Create a mock Docker client."""
        client = MagicMock()
        client.containers = MagicMock()
        client.containers.create = MagicMock()
        client.containers.get = MagicMock()
        return client

    @pytest.fixture
    def mock_env_vars(self):
        """Sample environment variables for testing."""
        return {
            'BRAVE_API_KEY': 'test-key',
            'OPENAI_API_KEY': 'sk-test',
        }

    @pytest.fixture
    def connection(self, mock_docker_client, mock_env_vars):
        """Create a StdioMcpConnection instance for testing."""
        from app.services.docker_bridge import StdioMcpConnection

        return StdioMcpConnection(
            server_name='test-server',
            image='mcp/test-image',
            env_vars=mock_env_vars,
            docker_client=mock_docker_client,
        )

    def test_init(self, connection, mock_env_vars, mock_docker_client):
        """Test StdioMcpConnection initialization."""
        assert connection.server_name == 'test-server'
        assert connection.image == 'mcp/test-image'
        assert connection.env_vars == mock_env_vars
        assert connection.container_name == 'ttt-mcp-stdio-test-server'
        assert connection._docker_client == mock_docker_client
        assert connection._running is False
        assert connection._initialized is False

    def test_get_next_id_increments(self, connection):
        """Test that request IDs increment properly."""
        id1 = connection._get_next_id()
        id2 = connection._get_next_id()
        id3 = connection._get_next_id()

        assert id1 == 1
        assert id2 == 2
        assert id3 == 3

    def test_is_running_when_not_started(self, connection):
        """Test is_running property when not started."""
        assert connection.is_running is False

    @pytest.mark.asyncio
    async def test_start_creates_container(self, connection, mock_docker_client):
        """Test that start() creates a Docker container."""
        mock_container = MagicMock()
        mock_container.start = MagicMock()
        mock_container.attach_socket = MagicMock(return_value=MagicMock())
        mock_docker_client.containers.create.return_value = mock_container

        success, error = await connection.start()

        # Verify container was created
        mock_docker_client.containers.create.assert_called_once()
        call_kwargs = mock_docker_client.containers.create.call_args[1]

        assert call_kwargs['name'] == 'ttt-mcp-stdio-test-server'
        assert call_kwargs['stdin_open'] is True
        assert call_kwargs['tty'] is False
        assert 'BRAVE_API_KEY' in call_kwargs['environment']

    @pytest.mark.asyncio
    async def test_start_failure_when_docker_not_available(self):
        """Test that start() handles Docker not available."""
        from app.services.docker_bridge import StdioMcpConnection

        conn = StdioMcpConnection(
            server_name='test',
            image='mcp/test',
            env_vars={},
            docker_client=None,
        )

        success, error = await conn.start()

        assert success is False
        assert 'Docker client not available' in error

    @pytest.mark.asyncio
    async def test_stop_cleans_up(self, connection, mock_docker_client):
        """Test that stop() properly cleans up resources."""
        mock_container = MagicMock()
        mock_container.stop = MagicMock()
        mock_container.remove = MagicMock()
        connection.container = mock_container
        connection._running = True
        connection._initialized = True
        connection._socket = MagicMock()

        success, error = await connection.stop()

        assert success is True
        assert error is None
        assert connection._running is False
        assert connection._initialized is False

    @pytest.mark.asyncio
    async def test_stop_when_not_running(self, connection):
        """Test that stop() handles not-running state gracefully."""
        success, error = await connection.stop()

        assert success is True
        assert error is None

    def test_handle_response_queues_response(self, connection):
        """Test that _handle_response queues responses properly."""
        # Setup a pending request
        loop = asyncio.new_event_loop()
        future = loop.create_future()
        connection._pending_requests[1] = future

        response = {'jsonrpc': '2.0', 'result': {'tools': []}, 'id': 1}
        connection._handle_response(response)

        # Check response was queued
        assert not connection._response_queue.empty()
        resp_id, resp = connection._response_queue.get_nowait()
        assert resp_id == 1
        assert resp == response

        loop.close()


class TestStdioMcpConnectionProtocol:
    """Tests for MCP protocol methods."""

    @pytest.fixture
    def mock_docker_client(self):
        """Create a mock Docker client."""
        return MagicMock()

    @pytest.fixture
    def mock_connection(self, mock_docker_client):
        """Create a mocked StdioMcpConnection for protocol tests."""
        from app.services.docker_bridge import StdioMcpConnection

        conn = StdioMcpConnection(
            server_name='test',
            image='mcp/test',
            env_vars={},
            docker_client=mock_docker_client,
        )
        conn._running = True
        conn._socket = MagicMock()
        conn._socket.sendall = MagicMock()
        return conn

    @pytest.mark.asyncio
    async def test_send_request_when_not_running(self, mock_docker_client):
        """Test send_request returns error when not running."""
        from app.services.docker_bridge import StdioMcpConnection

        conn = StdioMcpConnection('test', 'img', {}, mock_docker_client)
        result, error = await conn.send_request('test/method')

        assert result is None
        assert error == 'Connection not active'

    @pytest.mark.asyncio
    async def test_initialize_sends_correct_request(self, mock_connection):
        """Test that initialize sends the correct MCP initialize request."""
        # Mock send_request
        mock_connection.send_request = AsyncMock(
            return_value=({'protocolVersion': '2024-11-05', 'capabilities': {}}, None)
        )

        result, error = await mock_connection.initialize()

        assert error is None
        assert mock_connection._initialized is True
        mock_connection.send_request.assert_called_once()
        call_args = mock_connection.send_request.call_args
        assert call_args[0][0] == 'initialize'

    @pytest.mark.asyncio
    async def test_initialize_already_initialized(self, mock_connection):
        """Test that initialize returns early if already initialized."""
        mock_connection._initialized = True
        mock_connection.send_request = AsyncMock()

        result, error = await mock_connection.initialize()

        assert result == {'already_initialized': True}
        assert error is None
        mock_connection.send_request.assert_not_called()

    @pytest.mark.asyncio
    async def test_list_tools_initializes_first(self, mock_connection):
        """Test that list_tools initializes connection first."""
        mock_connection._initialized = False
        mock_connection.initialize = AsyncMock(return_value=({}, None))
        mock_connection.send_request = AsyncMock(return_value=({'tools': [{'name': 'test_tool'}]}, None))

        tools, error = await mock_connection.list_tools()

        assert error is None
        assert tools == [{'name': 'test_tool'}]
        mock_connection.initialize.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_tools_when_already_initialized(self, mock_connection):
        """Test list_tools skips initialization when already initialized."""
        mock_connection._initialized = True
        mock_connection.initialize = AsyncMock()
        mock_connection.send_request = AsyncMock(return_value=({'tools': [{'name': 'test_tool'}]}, None))

        tools, error = await mock_connection.list_tools()

        assert error is None
        mock_connection.initialize.assert_not_called()

    @pytest.mark.asyncio
    async def test_call_tool_extracts_text_content(self, mock_connection):
        """Test that call_tool properly extracts text content from response."""
        mock_connection._initialized = True
        mock_connection.send_request = AsyncMock(
            return_value=(
                {
                    'content': [
                        {'type': 'text', 'text': 'Result 1'},
                        {'type': 'text', 'text': 'Result 2'},
                    ]
                },
                None,
            )
        )

        result, error = await mock_connection.call_tool('test_tool', {'arg': 'value'})

        assert error is None
        assert result == 'Result 1\nResult 2'

    @pytest.mark.asyncio
    async def test_call_tool_returns_raw_result_when_no_text_content(self, mock_connection):
        """Test that call_tool returns raw result when no text content."""
        mock_connection._initialized = True
        mock_connection.send_request = AsyncMock(return_value=({'some_data': 'value'}, None))

        result, error = await mock_connection.call_tool('test_tool', {})

        assert error is None
        assert result == {'some_data': 'value'}
