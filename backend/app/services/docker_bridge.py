"""
Docker Bridge Service

Manages MCP container lifecycle with security measures:
- Binds only to 127.0.0.1 (localhost)
- Injects API keys via environment variables at runtime
- Health monitoring and auto-restart
- Log redaction for sensitive data
"""

import json
import re
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app import models


class DockerBridge:
    """Service for managing Docker containers for MCP servers."""

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
        Start an MCP container with injected environment variables.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
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
        Stop an MCP container.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (success, error_message)
        """
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
        Get container logs with key redaction.

        Args:
            server: The MCP server configuration
            tail: Number of lines to return

        Returns:
            Tuple of (logs, error_message)
        """
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

    async def health_check(self, server: models.McpServer) -> tuple[bool, str | None]:
        """
        Check the health of an MCP server.

        Args:
            server: The MCP server configuration

        Returns:
            Tuple of (healthy, error_message)
        """
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
        """Sync all MCP server statuses with actual container states."""
        if not self._init_docker():
            return

        servers = self.db.query(models.McpServer).all()

        for server in servers:
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

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f'http://127.0.0.1:{server.port}/process',
                    json={
                        'input': input_text,
                        'rules': rules,
                        'context': context,
                    },
                )

                if response.status_code == 200:
                    return response.json(), None
                else:
                    return None, f'MCP server returned {response.status_code}: {response.text}'

        except httpx.TimeoutException:
            return None, 'MCP request timed out'
        except httpx.ConnectError:
            return None, 'Could not connect to MCP server'
        except Exception as e:
            return None, str(e)
