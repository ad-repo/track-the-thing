"""
MCP Bridge Service

Manages MCP server connections for both Docker containers and remote HTTP servers:
- Docker: Binds to 127.0.0.1 (localhost), injects API keys, health monitoring
- Remote: HTTP endpoints with custom headers for authentication
- Stdio: Interactive Docker containers communicating via stdin/stdout
- Log redaction for sensitive data
- MCP tool discovery and execution
"""

import asyncio
import json
import os
import queue
import re
import subprocess
import threading
import traceback
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app import models


def convert_github_url_to_docker_context(url: str) -> tuple[str, str | None]:
    """
    Convert a GitHub blob/tree URL to a Docker-compatible build context.

    Supports URLs like:
    - https://github.com/user/repo/blob/commit/Dockerfile
    - https://github.com/user/repo/tree/branch/path
    - https://github.com/user/repo (already valid)
    - https://github.com/user/repo.git#branch (already valid)

    Returns:
        Tuple of (docker_context_url, dockerfile_path or None)
    """
    if not url:
        return url, None

    # Already a .git URL with optional ref - pass through
    if '.git' in url and '#' in url:
        return url, None
    if url.endswith('.git'):
        return url, None

    # Parse GitHub blob/tree URLs
    # Format: https://github.com/user/repo/blob/ref/path/to/Dockerfile
    # Format: https://github.com/user/repo/tree/ref/path
    import re

    # Match: github.com/user/repo/(blob|tree)/ref/optional/path
    match = re.match(
        r'https?://github\.com/([^/]+)/([^/]+)/(blob|tree)/([^/]+)(?:/(.*))?',
        url,
    )

    if match:
        user = match.group(1)
        repo = match.group(2)
        url_type = match.group(3)  # 'blob' or 'tree'
        ref = match.group(4)  # branch, tag, or commit hash
        path = match.group(5) or ''  # optional path

        # Build Docker-compatible git URL
        # Format: https://github.com/user/repo.git#ref:context_path
        git_url = f'https://github.com/{user}/{repo}.git#{ref}'

        dockerfile_path = None

        if url_type == 'blob':
            # URL points to a specific file (likely Dockerfile)
            if path:
                # Extract directory from file path
                if '/' in path:
                    context_dir = '/'.join(path.split('/')[:-1])
                    dockerfile_name = path.split('/')[-1]
                    if context_dir:
                        git_url = f'https://github.com/{user}/{repo}.git#{ref}:{context_dir}'
                    if dockerfile_name != 'Dockerfile':
                        dockerfile_path = dockerfile_name
                else:
                    # File is in root directory
                    if path != 'Dockerfile':
                        dockerfile_path = path
        elif url_type == 'tree' and path:
            # URL points to a directory
            git_url = f'https://github.com/{user}/{repo}.git#{ref}:{path}'

        print(f'[GitHub URL] Converted {url} -> {git_url}')
        return git_url, dockerfile_path

    # Try simple repo URL: https://github.com/user/repo
    simple_match = re.match(r'https?://github\.com/([^/]+)/([^/]+)/?$', url)
    if simple_match:
        user = simple_match.group(1)
        repo = simple_match.group(2)
        return f'https://github.com/{user}/{repo}.git', None

    # Not a recognized GitHub URL format - return as-is
    return url, None


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


class StdioMcpConnection:
    """
    Manages a stdio-based MCP server connection using Docker SDK.

    Runs a Docker container in interactive mode and communicates
    via stdin/stdout using JSON-RPC 2.0 protocol.

    This class handles:
    - Container lifecycle (start/stop) via Docker SDK
    - Message serialization/deserialization
    - Request/response correlation via JSON-RPC IDs
    - Thread-safe communication
    """

    def __init__(self, server_name: str, image: str, env_vars: dict[str, str], docker_client: Any = None):
        """
        Initialize stdio connection.

        Args:
            server_name: Unique name for the container
            image: Docker image to run
            env_vars: Environment variables to pass to container
            docker_client: Docker client instance (from DockerBridge)
        """
        self.server_name = server_name
        self.image = image
        self.env_vars = env_vars
        # Container name must be lowercase
        safe_name = server_name.lower().replace(' ', '-')
        self.container_name = f'ttt-mcp-stdio-{safe_name}'
        self._docker_client = docker_client

        self._container = None
        self._socket = None
        self._response_queue: queue.Queue = queue.Queue()
        self._reader_thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._request_id = 0
        self._pending_requests: dict[int, asyncio.Future] = {}
        self._running = False
        self._initialized = False

    def _get_next_id(self) -> int:
        """Get next request ID (thread-safe)."""
        with self._lock:
            self._request_id += 1
            return self._request_id

    def _reader_loop(self):
        """Background thread that reads stdout and dispatches responses."""
        if not self._socket:
            return

        buffer = b''
        while self._running:
            try:
                # Read from socket
                data = self._socket.recv(4096)
                if not data:
                    print(f'[StdioMcp] Socket closed for {self.server_name}')
                    break

                buffer += data

                # Try to parse complete JSON objects (newline-delimited)
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    if line.strip():
                        try:
                            # Docker attach protocol may have stream type prefix byte
                            # Skip first 8 bytes if they look like Docker stream header
                            line_str = line.decode('utf-8', errors='ignore')
                            # Try to find JSON start
                            json_start = line_str.find('{')
                            if json_start >= 0:
                                response = json.loads(line_str[json_start:])
                                self._handle_response(response)
                        except json.JSONDecodeError as e:
                            print(f'[StdioMcp] JSON parse error: {e}, line: {line[:100]}')
                        except Exception as e:
                            print(f'[StdioMcp] Parse error: {e}')

            except Exception as e:
                if self._running:
                    print(f'[StdioMcp] Reader error: {e}')
                break

        print(f'[StdioMcp] Reader loop exited for {self.server_name}')

    def _handle_response(self, response: dict):
        """Handle a JSON-RPC response from the server."""
        request_id = response.get('id')
        print(f'[StdioMcp] Received response for id={request_id}')

        if request_id is not None:
            # Put response in queue for async handling
            self._response_queue.put((request_id, response))

    async def start(self) -> tuple[bool, str | None]:
        """
        Start the Docker container in interactive mode using Docker SDK.

        Returns:
            Tuple of (success, error_message)
        """
        if self._running:
            return True, None

        if not self._docker_client:
            return False, 'Docker client not available'

        try:
            # Log what we're starting (redact secrets)
            redacted_env = {}
            for key, value in self.env_vars.items():
                if any(s in key.upper() for s in ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'AUTH']):
                    redacted_env[key] = '[REDACTED]'
                else:
                    redacted_env[key] = value
            print(f'[StdioMcp] Starting container {self.container_name} with image {self.image}')
            print(f'[StdioMcp] Environment: {redacted_env}')

            # Remove existing container if any
            try:
                old_container = self._docker_client.containers.get(self.container_name)
                old_container.remove(force=True)
                print(f'[StdioMcp] Removed existing container {self.container_name}')
            except Exception:
                pass

            # Create container with stdin open
            self._container = self._docker_client.containers.create(
                self.image,
                name=self.container_name,
                stdin_open=True,
                tty=False,
                environment=self.env_vars,
                detach=True,
            )

            # Attach to container stdin/stdout
            self._socket = self._container.attach_socket(params={'stdin': 1, 'stdout': 1, 'stderr': 1, 'stream': 1})
            # Get the underlying socket
            if hasattr(self._socket, '_sock'):
                self._socket = self._socket._sock

            # Start the container
            self._container.start()
            print(f'[StdioMcp] Container {self.container_name} started')

            self._running = True

            # Start reader thread
            self._reader_thread = threading.Thread(
                target=self._reader_loop, daemon=True, name=f'stdio-reader-{self.server_name}'
            )
            self._reader_thread.start()

            # Give container time to start
            await asyncio.sleep(1.0)

            # Check if container is still running
            self._container.reload()
            if self._container.status != 'running':
                logs = self._container.logs().decode('utf-8', errors='ignore')
                return False, f'Container exited immediately. Logs: {logs[:500]}'

            return True, None

        except Exception as e:
            self._running = False
            print(f'[StdioMcp] Start error: {traceback.format_exc()}')
            return False, str(e)

    async def stop(self) -> tuple[bool, str | None]:
        """
        Stop the Docker container.

        Returns:
            Tuple of (success, error_message)
        """
        self._running = False
        self._initialized = False

        if self._socket:
            try:
                self._socket.close()
            except Exception as e:
                print(f'[StdioMcp] Error closing socket: {e}')
            self._socket = None

        if self._container:
            try:
                self._container.stop(timeout=5)
                self._container.remove(force=True)
                print(f'[StdioMcp] Container {self.container_name} stopped and removed')
            except Exception as e:
                print(f'[StdioMcp] Error stopping container: {e}')
            self._container = None

        return True, None

    async def send_request(
        self, method: str, params: dict | None = None, timeout: float = 60.0
    ) -> tuple[dict | None, str | None]:
        """
        Send a JSON-RPC request and wait for response.

        Args:
            method: JSON-RPC method name
            params: Optional parameters
            timeout: Timeout in seconds

        Returns:
            Tuple of (result_dict, error_message)
        """
        if not self._running or not self._socket:
            return None, 'Connection not active'

        request_id = self._get_next_id()

        request = {
            'jsonrpc': '2.0',
            'method': method,
            'id': request_id,
        }
        if params:
            request['params'] = params

        try:
            # Send request
            request_json = json.dumps(request) + '\n'
            print(f'[StdioMcp] Sending: {request_json[:200]}...')
            self._socket.sendall(request_json.encode('utf-8'))

            # Wait for response with polling
            start_time = asyncio.get_event_loop().time()
            while True:
                try:
                    # Check response queue
                    try:
                        resp_id, response = self._response_queue.get_nowait()
                        if resp_id == request_id:
                            if 'error' in response:
                                error = response['error']
                                return None, f"{error.get('message', 'Unknown error')}"
                            return response.get('result'), None
                        else:
                            # Put back if not our response
                            self._response_queue.put((resp_id, response))
                    except queue.Empty:
                        pass

                    # Check timeout
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if elapsed > timeout:
                        return None, f'Request timed out after {timeout}s'

                    # Check if container died
                    if self._container:
                        self._container.reload()
                        if self._container.status != 'running':
                            return None, 'Container terminated'

                    await asyncio.sleep(0.1)

                except asyncio.CancelledError:
                    raise

        except Exception as e:
            return None, str(e)
        finally:
            # Clean up pending request
            self._pending_requests.pop(request_id, None)

    async def initialize(self) -> tuple[dict | None, str | None]:
        """
        Send MCP initialize request.

        Returns:
            Tuple of (capabilities_dict, error_message)
        """
        if self._initialized:
            return {'already_initialized': True}, None

        result, error = await self.send_request(
            'initialize',
            {
                'protocolVersion': '2024-11-05',
                'capabilities': {},
                'clientInfo': {'name': 'track-the-thing', 'version': '1.0'},
            },
        )

        if error:
            return None, error

        # Send initialized notification (no response expected)
        if self._socket:
            try:
                notification = json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n'
                self._socket.sendall(notification.encode('utf-8'))
            except Exception as e:
                print(f'[StdioMcp] Error sending initialized notification: {e}')

        self._initialized = True
        return result, None

    async def list_tools(self) -> tuple[list[dict] | None, str | None]:
        """
        Get list of available tools from the MCP server.

        Returns:
            Tuple of (tools_list, error_message)
        """
        # Ensure initialized first
        if not self._initialized:
            _, err = await self.initialize()
            if err:
                return None, f'Failed to initialize: {err}'

        result, error = await self.send_request('tools/list')
        if error:
            return None, error

        tools = result.get('tools', []) if result else []
        return tools, None

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> tuple[Any | None, str | None]:
        """
        Call a tool on the MCP server.

        Returns:
            Tuple of (result, error_message)
        """
        result, error = await self.send_request(
            'tools/call',
            {'name': tool_name, 'arguments': arguments},
            timeout=120.0,  # Longer timeout for tool calls
        )

        if error:
            return None, error

        # Extract content from result
        if isinstance(result, dict):
            content = result.get('content', [])
            if isinstance(content, list):
                texts = []
                for item in content:
                    if isinstance(item, dict) and item.get('type') == 'text':
                        texts.append(item.get('text', ''))
                if texts:
                    return '\n'.join(texts), None
            return result, None

        return result, None

    @property
    def is_running(self) -> bool:
        """Check if the connection is active."""
        if not self._running or not self._container:
            return False
        try:
            self._container.reload()
            return self._container.status == 'running'
        except Exception:
            return False


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
        self._stdio_connections: dict[int, StdioMcpConnection] = {}  # server_id -> connection

    def _init_docker(self) -> bool:
        """Initialize Docker client if available."""
        if self._docker_available is not None:
            return self._docker_available

        try:
            import docker

            # Try docker.from_env() first (uses DOCKER_HOST env var or default socket)
            try:
                self._docker_client = docker.from_env()
                version_info = self._docker_client.version()
                self._docker_version = version_info.get('Version', 'unknown')
                self._docker_available = True
                print(f'[DockerBridge] Connected to Docker {self._docker_version} via default')
                return True
            except Exception as e:
                print(f'[DockerBridge] docker.from_env() failed: {e}')

            # On macOS, Docker Desktop socket may be at different locations
            # Try common socket paths for desktop environments
            import platform

            if platform.system() == 'Darwin':
                socket_paths = [
                    os.path.expanduser('~/.docker/run/docker.sock'),  # Docker Desktop 4.x+
                    '/var/run/docker.sock',  # Traditional location
                    os.path.expanduser('~/Library/Containers/com.docker.docker/Data/docker.sock'),
                ]

                for socket_path in socket_paths:
                    if os.path.exists(socket_path):
                        try:
                            print(f'[DockerBridge] Trying socket: {socket_path}')
                            self._docker_client = docker.DockerClient(base_url=f'unix://{socket_path}')
                            version_info = self._docker_client.version()
                            self._docker_version = version_info.get('Version', 'unknown')
                            self._docker_available = True
                            print(f'[DockerBridge] Connected to Docker {self._docker_version} via {socket_path}')
                            return True
                        except Exception as socket_err:
                            print(f'[DockerBridge] Socket {socket_path} failed: {socket_err}')
                            continue

            # All attempts failed
            print('[DockerBridge] No working Docker connection found')
            self._docker_available = False
            self._docker_client = None

        except ImportError:
            print('[DockerBridge] Docker SDK not installed')
            self._docker_available = False
            self._docker_client = None
        except Exception as e:
            print(f'[DockerBridge] Docker init error: {e}')
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
            import platform

            if platform.system() == 'Darwin':
                return (
                    False,
                    None,
                    'Docker is not available. Ensure Docker Desktop is running and check that '
                    '~/.docker/run/docker.sock or /var/run/docker.sock exists.',
                )
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

    def _get_image_name(self, server: models.McpServer) -> str:
        """Get the Docker image name for an MCP server."""
        build_source = getattr(server, 'build_source', 'image') or 'image'
        if build_source == 'dockerfile':
            # Use server name as image tag for built images
            # Docker requires lowercase repository names
            safe_name = server.name.lower().replace(' ', '-')
            return f'ttt-mcp-{safe_name}:latest'
        return server.image

    async def build_image(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Build a Docker image from a Dockerfile.

        Supports:
        - Local paths: /path/to/context
        - GitHub URLs: https://github.com/user/repo/blob/branch/Dockerfile
        - Git URLs: https://github.com/user/repo.git#branch

        Args:
            server: The MCP server configuration with build_context set

        Returns:
            Tuple of (success, error_message)
        """
        if not self._init_docker():
            return False, 'Docker is not available'

        build_context = getattr(server, 'build_context', '') or ''
        if not build_context:
            return False, 'Build context path is required'

        dockerfile_path = getattr(server, 'dockerfile_path', '') or ''

        # Convert GitHub blob/tree URLs to Docker-compatible format
        if build_context.startswith('http'):
            # Validate URL - must be a clean URL without extra text
            if ' ' in build_context or '\n' in build_context:
                return False, 'Build context URL is invalid - contains extra text. Please paste only the URL.'

            # Only GitHub URLs are supported for remote builds
            if 'github.com' not in build_context:
                return False, f'Only GitHub URLs are supported for remote builds. Got: {build_context[:100]}'

            converted_context, auto_dockerfile = convert_github_url_to_docker_context(build_context)
            build_context = converted_context
            # Use auto-detected dockerfile path if not explicitly set
            if auto_dockerfile and not dockerfile_path:
                dockerfile_path = auto_dockerfile

        try:
            # Update status to building
            server.status = 'building'
            server.updated_at = datetime.utcnow()
            self.db.commit()

            image_name = self._get_image_name(server)
            print(f'[MCP Build] Building image {image_name} from {build_context}')

            # Build the image using Docker SDK
            # The SDK supports git URLs directly in the path parameter
            build_args = {
                'path': build_context,
                'tag': image_name,
                'rm': True,  # Remove intermediate containers
                'forcerm': True,  # Always remove intermediate containers
            }

            if dockerfile_path:
                build_args['dockerfile'] = dockerfile_path

            print(f'[MCP Build] Build args: {build_args}')
            image, build_logs = self._docker_client.images.build(**build_args)

            # Log build output
            for log in build_logs:
                if 'stream' in log:
                    stream_text = log['stream'].strip()
                    if stream_text:
                        print(f'[MCP Build] {stream_text}')
                elif 'error' in log:
                    print(f"[MCP Build Error] {log['error']}")
                    server.status = 'error'
                    server.updated_at = datetime.utcnow()
                    self.db.commit()
                    return False, log['error']

            # Update the server's image field with the built image name
            server.image = image_name
            server.status = 'stopped'
            server.updated_at = datetime.utcnow()
            self.db.commit()

            print(f'[MCP Build] Successfully built {image_name}')
            return True, None

        except Exception as e:
            print(f'[MCP Build] Exception: {str(e)}')
            print(f'[MCP Build] Traceback: {traceback.format_exc()}')
            server.status = 'error'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return False, f'Build failed: {str(e)}'

    async def start_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Start an MCP server (Docker container, remote, or stdio).

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')
        transport_type = getattr(server, 'transport_type', 'http')

        # Remote servers don't need container management
        if server_type == 'remote':
            # Just mark as running - we'll verify with health check
            server.status = 'running'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return True, None

        # STDIO transport - new code path
        if transport_type == 'stdio':
            return await self._start_stdio_container(server)

        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            # Check if we need to build from Dockerfile
            build_source = getattr(server, 'build_source', 'image') or 'image'
            if build_source == 'dockerfile':
                # Check if image exists, if not build it
                image_name = self._get_image_name(server)
                try:
                    self._docker_client.images.get(image_name)
                    print(f'[MCP] Image {image_name} exists, using it')
                except Exception:
                    # Image doesn't exist, build it
                    print(f'[MCP] Image {image_name} not found, building...')
                    success, error = await self.build_image(server)
                    if not success:
                        return False, f'Failed to build image: {error}'

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
            image_to_use = self._get_image_name(server)

            container = self._docker_client.containers.run(
                image_to_use,
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

    async def _start_stdio_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Start an MCP server using stdio transport.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Check if already running
            if server.id in self._stdio_connections:
                conn = self._stdio_connections[server.id]
                if conn.is_running:
                    server.status = 'running'
                    server.updated_at = datetime.utcnow()
                    self.db.commit()
                    return True, None

            # Check if we need to build from Dockerfile
            build_source = getattr(server, 'build_source', 'image') or 'image'
            if build_source == 'dockerfile':
                # Need to build from Dockerfile first
                if not self._init_docker():
                    return False, 'Docker is not available for building image'

                image_name = self._get_image_name(server)
                try:
                    self._docker_client.images.get(image_name)
                    print(f'[MCP-STDIO] Image {image_name} exists, using it')
                except Exception:
                    # Image doesn't exist, build it
                    print(f'[MCP-STDIO] Image {image_name} not found, building...')
                    success, error = await self.build_image(server)
                    if not success:
                        return False, f'Failed to build image: {error}'
                image = image_name
            else:
                # Validate pre-built image name
                image = server.image or ''
                if not image:
                    return False, 'Docker image is required for stdio servers'
                if image.startswith('http://') or image.startswith('https://'):
                    return False, 'Image must be a Docker image name (e.g., mcp/brave-search), not a URL'

            # Build environment variables
            env_vars = self._get_api_keys()

            # Add any custom env vars specified for this server
            try:
                server_env_names = json.loads(server.env_vars) if server.env_vars else []
                for var_name in server_env_names:
                    if var_name not in env_vars:
                        # Look up from environment
                        if var_name in os.environ:
                            env_vars[var_name] = os.environ[var_name]
            except json.JSONDecodeError:
                pass

            # Initialize Docker client if needed
            if not self._init_docker():
                return False, 'Docker is not available'

            # Create connection with Docker client
            conn = StdioMcpConnection(
                server_name=server.name,
                image=image,
                env_vars=env_vars,
                docker_client=self._docker_client,
            )

            # Update status
            server.status = 'starting'
            server.updated_at = datetime.utcnow()
            self.db.commit()

            # Start container
            success, error = await conn.start()

            if not success:
                server.status = 'error'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, error

            # Store connection
            self._stdio_connections[server.id] = conn

            # Initialize MCP protocol
            _, init_error = await conn.initialize()
            if init_error:
                print(f'[MCP] Warning: Initialization returned error: {init_error}')
                # Don't fail - some servers might not require explicit init

            server.status = 'running'
            server.last_health_check = datetime.utcnow()
            server.updated_at = datetime.utcnow()
            self.db.commit()

            return True, None

        except Exception as e:
            server.status = 'error'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return False, f'Failed to start stdio container: {str(e)}'

    async def stop_container(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Stop an MCP server (Docker container, remote, or stdio).

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
        server_type = getattr(server, 'server_type', 'docker')
        transport_type = getattr(server, 'transport_type', 'http')

        # Remote servers don't need container management
        if server_type == 'remote':
            server.status = 'stopped'
            server.updated_at = datetime.utcnow()
            self.db.commit()
            return True, None

        # STDIO transport
        if transport_type == 'stdio':
            if server.id in self._stdio_connections:
                conn = self._stdio_connections.pop(server.id)
                await conn.stop()
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
        transport_type = getattr(server, 'transport_type', 'http')

        # Remote servers don't have local logs
        if server_type == 'remote':
            return 'Logs not available for remote MCP servers.', None

        # STDIO containers - try docker logs command
        if transport_type == 'stdio':
            try:
                result = subprocess.run(
                    ['docker', 'logs', '--tail', str(tail), f'ttt-mcp-stdio-{server.name}'],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                logs = result.stdout + result.stderr
                return self._redact_logs(logs) if logs else 'No logs available', None
            except subprocess.TimeoutExpired:
                return None, 'Log retrieval timed out'
            except Exception as e:
                return None, str(e)

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
        transport_type = getattr(server, 'transport_type', 'http')

        # STDIO health check - check if connection is alive
        if transport_type == 'stdio':
            if server.id in self._stdio_connections:
                conn = self._stdio_connections[server.id]
                if conn.is_running:
                    server.status = 'running'
                    server.last_health_check = datetime.utcnow()
                    server.updated_at = datetime.utcnow()
                    self.db.commit()
                    return True, None
                else:
                    server.status = 'stopped'
                    server.updated_at = datetime.utcnow()
                    self.db.commit()
                    return False, 'Stdio container not running'
            else:
                server.status = 'stopped'
                server.updated_at = datetime.utcnow()
                self.db.commit()
                return False, 'No stdio connection found'

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
            transport_type = getattr(server, 'transport_type', 'http')

            if server_type == 'remote':
                # Remote servers: status is managed via health checks
                # Don't change status here - let health_check handle it
                continue

            # STDIO servers: check connection state
            if transport_type == 'stdio':
                if server.id in self._stdio_connections:
                    conn = self._stdio_connections[server.id]
                    server.status = 'running' if conn.is_running else 'stopped'
                else:
                    server.status = 'stopped'
                server.updated_at = datetime.utcnow()
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
        transport_type = getattr(server, 'transport_type', 'http')

        # STDIO transport - use dedicated connection
        if transport_type == 'stdio':
            if server.id not in self._stdio_connections:
                # Try to start it
                success, error = await self._start_stdio_container(server)
                if not success:
                    return None, f'Failed to start stdio server: {error}'

            conn = self._stdio_connections.get(server.id)
            if not conn or not conn.is_running:
                return None, 'Stdio connection not available'

            return await conn.list_tools()

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
        transport_type = getattr(server, 'transport_type', 'http')

        # STDIO transport - use dedicated connection
        if transport_type == 'stdio':
            conn = self._stdio_connections.get(server.id)
            if not conn or not conn.is_running:
                return None, 'Stdio connection not available'

            return await conn.call_tool(tool_name, arguments)

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
