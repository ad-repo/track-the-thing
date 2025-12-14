"""
MCP Bridge Service

Manages MCP server connections for both Docker containers and remote HTTP servers:
- Docker: Binds to 127.0.0.1 (localhost), injects API keys, health monitoring
- Remote: HTTP endpoints with custom headers for authentication
- Log redaction for sensitive data
- MCP tool discovery and execution
"""

import json
import re
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app import models


def parse_sse_response(response_text: str) -> dict | None:
    """
    Parse Server-Sent Events response from MCP server.

    SSE format:
    event: message
    data: {"jsonrpc": "2.0", "result": {...}, "id": 1}

    Returns the parsed JSON data or None if parsing fails.
    """
    lines = response_text.strip().split('\n')
    for line in lines:
        if line.startswith('data: '):
            try:
                return json.loads(line[6:])  # Skip 'data: ' prefix
            except json.JSONDecodeError:
                continue
    return None


class DockerBridge:
    """Service for managing MCP servers (Docker containers and remote HTTP endpoints)."""

    # Container name prefix for all MCP containers
    CONTAINER_PREFIX = 'ttt-mcp-'

    # Patterns to redact from logs
    REDACT_PATTERNS = [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI keys
        r'sk-ant-[a-zA-Z0-9-]+',  # Anthropic keys
        r'AIza[a-zA-Z0-9_-]{30,}',  # Google API keys (typically 39 chars total)
        r'[A-Za-z0-9+/]{40,}={0,2}',  # Base64 encoded secrets (40+ chars)
    ]

    def __init__(self, db: Session):
        """Initialize DockerBridge with database session."""
        self.db = db
        self._docker_client = None
        self._docker_available = None
        self._docker_version = None

    def _init_docker(self) -> bool:
        """Initialize Docker client if available."""
        if self._docker_available is not None:
            return self._docker_available

        try:
            import docker

            self._docker_client = docker.from_env()
            # Test connection
            version_info = self._docker_client.version()
            self._docker_version = version_info.get('Version', 'unknown')
            self._docker_available = True
        except ImportError:
            self._docker_available = False
            self._docker_client = None
        except Exception:
            self._docker_available = False
            self._docker_client = None

        return self._docker_available

    def is_available(self) -> tuple[bool, str | None, str | None]:
        """
        Check if Docker is available.

        Returns:
            Tuple of (available, version, error_message)
        """
        available = self._init_docker()
        if available:
            return True, self._docker_version, None
        else:
            return False, None, 'Docker is not available or not running'

    def _get_container_name(self, server: models.McpServer) -> str:
        """Get the Docker container name for an MCP server."""
        return f'{self.CONTAINER_PREFIX}{server.name}'

    def _get_container(self, server: models.McpServer):
        """Get the Docker container for an MCP server if it exists."""
        if not self._init_docker():
            return None

        try:
            container_name = self._get_container_name(server)
            return self._docker_client.containers.get(container_name)
        except Exception:
            return None

    def _redact_logs(self, logs: str) -> str:
        """Redact sensitive information from logs."""
        redacted = logs
        for pattern in self.REDACT_PATTERNS:
            redacted = re.sub(pattern, '[REDACTED]', redacted)
        return redacted

    def _get_api_keys(self) -> dict:
        """Get API keys from app settings."""
        settings = self.db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
        if not settings:
            return {}

        keys = {}
        if settings.openai_api_key:
            keys['OPENAI_API_KEY'] = settings.openai_api_key
        if settings.anthropic_api_key:
            keys['ANTHROPIC_API_KEY'] = settings.anthropic_api_key
        if settings.gemini_api_key:
            keys['GEMINI_API_KEY'] = settings.gemini_api_key

        return keys

    async def start_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Start an MCP server (Docker container or mark remote as running).

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        # Remote servers don't need container management
        if getattr(server, 'server_type', 'docker') == 'remote':
            # Just mark as running - we'll verify with health check
            server.status = 'running'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return True, None

        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            # Check if container already exists
            container = self._get_container(server)
            if container:
                if container.status == 'running':
                    return True, None
                # Container exists but not running - remove and recreate
                container.remove(force=True)

            # Build environment variables
            env_vars = self._get_api_keys()

            # Add any custom env vars specified for this server
            try:
                server_env_vars = json.loads(server.env_vars) if server.env_vars else []
                # Server env_vars just lists the names of vars to include
                # The actual values come from the system env or settings
                for var_name in server_env_vars:
                    if var_name in env_vars:
                        continue  # Already have it
                    # Could add more env var sources here
            except json.JSONDecodeError:
                pass

            # Docker run configuration with security settings
            container_name = self._get_container_name(server)

            container = self._docker_client.containers.run(
                server.image,
                name=container_name,
                detach=True,
                remove=False,  # Keep for logs, cleanup manually
                ports={f'{server.port}/tcp': ('127.0.0.1', server.port)},  # localhost only
                environment=env_vars,
                mem_limit='512m',
                cpu_quota=50000,  # 50% CPU
                security_opt=['no-new-privileges:true'],
            )

            # Update server status
            server.status = 'starting'
            server.updated_at = datetime.utcnow()
            self.db.commit()

            return True, None

        except Exception as e:
            # Update server status to error
            server.status = 'error'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return False, str(e)

    async def stop_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Stop an MCP server (Docker container or mark remote as stopped).

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        # Remote servers don't need container management
        if getattr(server, 'server_type', 'docker') == 'remote':
            server.status = 'stopped'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return True, None

        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            container = self._get_container(server)
            if not container:
                server.status = 'stopped'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return True, None

            container.stop(timeout=10)
            container.remove()

            server.status = 'stopped'
            server.updated_at = datetime.utcnow()
            self.db.commit()

            return True, None

        except Exception as e:
            return False, str(e)

    async def restart_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Restart an MCP container.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        success, error = await self.stop_container(server)
        if not success:
            return success, error

        return await self.start_container(server)

    async def get_logs(self, server: models.McpServer, tail: int = 100) -> tuple[str | None, str | None]:
        """
        Get container logs with key redaction (Docker only).

        Args:
            server: The MCP server configuration
            tail: Number of lines to return

        Returns:
            Tuple of (logs, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')

        # Remote servers don't have local logs
        if server_type == 'remote':
            return 'Logs not available for remote MCP servers.', None

        if not self._init_docker():
            return None, 'Docker is not available'

        try:
            container = self._get_container(server)
            if not container:
                return '', None

            logs = container.logs(tail=tail, timestamps=True).decode('utf-8')
            return self._redact_logs(logs), None

        except Exception as e:
            return None, str(e)

    def _get_remote_headers(self, server: models.McpServer) -> dict:
        """Get HTTP headers for remote server authentication."""
        try:
            headers_str = getattr(server, 'headers', '{}') or '{}'
            return json.loads(headers_str)
        except json.JSONDecodeError:
            return {}

    async def health_check(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Check the health of an MCP server.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (healthy, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')

        # Remote server health check
        if server_type == 'remote':
            try:
                url = getattr(server, 'url', '') or ''
                if not url:
                    return False, 'Remote server URL not configured'

                headers = self._get_remote_headers(server)
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # Try a simple request to verify connectivity
                    # MCP servers may not have a /health endpoint, so we accept various responses
                    response = await client.get(url, headers=headers)

                    # Accept 200, 404 (endpoint exists), or other non-5xx as "alive"
                    if response.status_code < 500:
                        server.status = 'running'
                        server.last_health_check = datetime.utcnow()
                        server.updated_at = datetime.utcnow()
                        self.db.commit()
                        return True, None
                    else:
                        server.status = 'error'
                        server.updated_at = datetime.utcnow()
                        self.db.commit()
                        return False, f'Remote server returned {response.status_code}'

            except httpx.TimeoutException:
                server.status = 'error'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, 'Remote server health check timed out'
            except httpx.ConnectError:
                server.status = 'error'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, 'Could not connect to remote server'
            except Exception as e:
                server.status = 'error'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, str(e)

        # Docker container health check
        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            container = self._get_container(server)
            if not container or container.status != 'running':
                server.status = 'stopped' if not container else container.status
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, 'Container not running'

            # Try to hit the health endpoint
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f'http://127.0.0.1:{server.port}/health')

                if response.status_code == 200:
                    server.status = 'running'
                    server.last_health_check = datetime.utcnow()
                    server.updated_at = datetime.utcnow()
                    self.db.commit()
                    return True, None
                else:
                    return False, f'Health check returned {response.status_code}'

        except httpx.TimeoutException:
            return False, 'Health check timed out'
        except httpx.ConnectError:
            return False, 'Could not connect to container'
        except Exception as e:
            return False, str(e)

    async def sync_statuses(self) -> None:
        """Sync all MCP server statuses with actual states."""
        servers = self.db.query(models.McpServer).all()

        for server in servers:
            server_type = getattr(server, 'server_type', 'docker')

            if server_type == 'remote':
                # Remote servers: status is managed via health checks
                # Don't change status here - let health_check handle it
                continue

            # Docker servers: sync with container state
            if not self._init_docker():
                continue

            container = self._get_container(server)
            if container:
                if container.status == 'running':
                    server.status = 'running'
                elif container.status == 'exited':
                    server.status = 'stopped'
                else:
                    server.status = container.status
            else:
                server.status = 'stopped'

            server.updated_at = datetime.utcnow()

        self.db.commit()

    async def cleanup_idle_containers(self, timeout_seconds: int) -> list[str]:
        """
        Stop containers that have been idle beyond the timeout.

        Args:
            timeout_seconds: Seconds of idle time before stopping

        Returns:
            List of container names that were stopped
        """
        # This is a placeholder for future implementation
        # Would need to track last request time per container
        stopped = []
        return stopped

    async def process_request(
        self,
        server: models.McpServer,
        input_text: str,
        rules: str = '',
        context: dict = None,
    ) -> tuple[dict | None, str | None]:
        """
        Send a processing request to an MCP server.

        Args:
            server: The MCP server configuration
            input_text: The text to process
            rules: Global prompt rules
            context: Additional context (entry_id, conversation_history, etc.)

        Returns:
            Tuple of (response_dict, error_message)
        """
        if context is None:
            context = {}

        server_type = getattr(server, 'server_type', 'docker')

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Determine URL and headers based on server type
                if server_type == 'remote':
                    url = getattr(server, 'url', '') or ''
                    if not url:
                        return None, 'Remote server URL not configured'
                    headers = self._get_remote_headers(server)
                    headers['Content-Type'] = 'application/json'
                    print(f'[MCP Debug] Remote request to: {url}')
                    print(f'[MCP Debug] Headers (keys only): {list(headers.keys())}')

                    # Build messages array with optional system prompt
                    messages = []
                    if rules:
                        messages.append({'role': 'system', 'content': rules})
                    messages.append({'role': 'user', 'content': input_text})

                    # Use JSON-RPC 2.0 format for MCP protocol
                    payload = {
                        'jsonrpc': '2.0',
                        'method': 'sampling/createMessage',
                        'params': {
                            'messages': messages,
                            'maxTokens': 2048,
                        },
                        'id': 1,
                    }
                else:
                    # Docker container - use simple format
                    url = f'http://127.0.0.1:{server.port}/process'
                    headers = {'Content-Type': 'application/json'}
                    payload = {
                        'input': input_text,
                        'rules': rules,
                        'context': context,
                    }

                print(f'[MCP Debug] Sending POST to {url}')
                print(f'[MCP Debug] Payload: {json.dumps(payload)[:300]}...')

                response = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                )

                print(f'[MCP Debug] Response status: {response.status_code}')
                if response.status_code == 200:
                    result = response.json()
                    print(
                        f'[MCP Debug] Response keys: {list(result.keys()) if isinstance(result, dict) else "not a dict"}'
                    )

                    # Handle JSON-RPC response format
                    if isinstance(result, dict) and 'result' in result:
                        mcp_result = result['result']
                        # Extract content from MCP response
                        if isinstance(mcp_result, dict):
                            content = mcp_result.get('content', '')
                            if isinstance(content, list) and len(content) > 0:
                                # MCP returns content as array of {type, text} objects
                                text_parts = [c.get('text', '') for c in content if c.get('type') == 'text']
                                return {'output': ''.join(text_parts)}, None
                            elif isinstance(content, str):
                                return {'output': content}, None
                        return {'output': str(mcp_result)}, None
                    elif isinstance(result, dict) and 'error' in result:
                        error = result['error']
                        return None, f"MCP error: {error.get('message', str(error))}"

                    return result, None
                else:
                    print(f'[MCP Debug] Response body: {response.text[:500]}')
                    return None, f'MCP server returned {response.status_code}: {response.text}'

        except httpx.TimeoutException:
            return None, 'MCP request timed out'
        except httpx.ConnectError:
            return None, 'Could not connect to MCP server'
        except Exception as e:
            return None, str(e)

    async def initialize_mcp(self, server: models.McpServer) -> tuple[dict | None, str | None]:
        """
        Initialize MCP protocol with a server.

        Returns:
            Tuple of (capabilities_dict, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')

        try:
            if server_type == 'remote':
                url = getattr(server, 'url', '') or ''
                if not url:
                    return None, 'Remote server URL not configured'
                headers = self._get_remote_headers(server)
                headers['Content-Type'] = 'application/json'
            else:
                url = f'http://127.0.0.1:{server.port}/'
                headers = {'Content-Type': 'application/json'}

            payload = {
                'jsonrpc': '2.0',
                'method': 'initialize',
                'params': {
                    'protocolVersion': '2024-11-05',
                    'capabilities': {},
                    'clientInfo': {'name': 'track-the-thing', 'version': '1.0'},
                },
                'id': 1,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 200:
                    # Parse SSE or JSON response
                    result = parse_sse_response(response.text) or response.json()
                    if 'result' in result:
                        return result['result'], None
                    elif 'error' in result:
                        return None, f"MCP error: {result['error'].get('message', str(result['error']))}"
                    return result, None
                else:
                    return None, f'MCP initialize returned {response.status_code}: {response.text[:200]}'

        except Exception as e:
            return None, str(e)

    async def list_tools(self, server: models.McpServer) -> tuple[list[dict] | None, str | None]:
        """
        Get list of available tools from an MCP server.

        Returns:
            Tuple of (tools_list, error_message)
            Each tool has: name, description, inputSchema
        """
        server_type = getattr(server, 'server_type', 'docker')

        try:
            if server_type == 'remote':
                url = getattr(server, 'url', '') or ''
                if not url:
                    return None, 'Remote server URL not configured'
                headers = self._get_remote_headers(server)
                headers['Content-Type'] = 'application/json'
            else:
                url = f'http://127.0.0.1:{server.port}/'
                headers = {'Content-Type': 'application/json'}

            payload = {
                'jsonrpc': '2.0',
                'method': 'tools/list',
                'id': 2,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 200:
                    # Parse SSE or JSON response
                    result = parse_sse_response(response.text) or response.json()
                    if 'result' in result:
                        tools = result['result'].get('tools', [])
                        return tools, None
                    elif 'error' in result:
                        return None, f"MCP error: {result['error'].get('message', str(result['error']))}"
                    return [], None
                else:
                    return None, f'MCP tools/list returned {response.status_code}: {response.text[:200]}'

        except Exception as e:
            return None, str(e)

    async def call_tool(
        self, server: models.McpServer, tool_name: str, arguments: dict[str, Any]
    ) -> tuple[Any | None, str | None]:
        """
        Call a tool on an MCP server.

        Args:
            server: The MCP server configuration
            tool_name: Name of the tool to call
            arguments: Tool arguments as a dictionary

        Returns:
            Tuple of (result, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')

        try:
            if server_type == 'remote':
                url = getattr(server, 'url', '') or ''
                if not url:
                    return None, 'Remote server URL not configured'
                headers = self._get_remote_headers(server)
                headers['Content-Type'] = 'application/json'
            else:
                url = f'http://127.0.0.1:{server.port}/'
                headers = {'Content-Type': 'application/json'}

            payload = {
                'jsonrpc': '2.0',
                'method': 'tools/call',
                'params': {
                    'name': tool_name,
                    'arguments': arguments,
                },
                'id': 3,
            }

            print(f'[MCP Debug] Calling tool {tool_name} on {server.name}')
            print(f'[MCP Debug] Arguments: {json.dumps(arguments)[:300]}')

            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)

                print(f'[MCP Debug] Tool response status: {response.status_code}')

                if response.status_code == 200:
                    # Parse SSE or JSON response
                    result = parse_sse_response(response.text) or response.json()

                    if 'result' in result:
                        tool_result = result['result']
                        # Extract content from MCP tool result
                        if isinstance(tool_result, dict):
                            content = tool_result.get('content', [])
                            if isinstance(content, list):
                                # Combine text content
                                texts = []
                                for item in content:
                                    if isinstance(item, dict) and item.get('type') == 'text':
                                        texts.append(item.get('text', ''))
                                if texts:
                                    return '\n'.join(texts), None
                            return tool_result, None
                        return tool_result, None
                    elif 'error' in result:
                        error = result['error']
                        return None, f"Tool error: {error.get('message', str(error))}"
                    return result, None
                else:
                    print(f'[MCP Debug] Tool error response: {response.text[:500]}')
                    return None, f'MCP tools/call returned {response.status_code}: {response.text[:200]}'

        except Exception as e:
            return None, str(e)

    def convert_tools_for_openai(self, mcp_tools: list[dict]) -> list[dict]:
        """
        Convert MCP tools to OpenAI function calling format.

        MCP format:
        {
            "name": "tool_name",
            "description": "Tool description",
            "inputSchema": { JSON Schema }
        }

        OpenAI format:
        {
            "type": "function",
            "function": {
                "name": "tool_name",
                "description": "Tool description",
                "parameters": { JSON Schema }
            }
        }
        """
        openai_tools = []
        for tool in mcp_tools:
            openai_tools.append(
                {
                    'type': 'function',
                    'function': {
                        'name': tool.get('name', ''),
                        'description': tool.get('description', ''),
                        'parameters': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                    },
                }
            )
        return openai_tools

    def convert_tools_for_anthropic(self, mcp_tools: list[dict]) -> list[dict]:
        """
        Convert MCP tools to Anthropic tool use format.

        Anthropic format:
        {
            "name": "tool_name",
            "description": "Tool description",
            "input_schema": { JSON Schema }
        }
        """
        anthropic_tools = []
        for tool in mcp_tools:
            anthropic_tools.append(
                {
                    'name': tool.get('name', ''),
                    'description': tool.get('description', ''),
                    'input_schema': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                }
            )
        return anthropic_tools

    def convert_tools_for_gemini(self, mcp_tools: list[dict]) -> list[dict]:
        """
        Convert MCP tools to Gemini function calling format.

        Gemini format (inside functionDeclarations):
        {
            "name": "tool_name",
            "description": "Tool description",
            "parameters": { JSON Schema }
        }
        """
        gemini_tools = []
        for tool in mcp_tools:
            gemini_tools.append(
                {
                    'name': tool.get('name', ''),
                    'description': tool.get('description', ''),
                    'parameters': tool.get('inputSchema', {'type': 'object', 'properties': {}}),
                }
            )
        return gemini_tools
