"""
Jupyter Bridge Service

Manages Jupyter Kernel Gateway container lifecycle and code execution:
- Container start/stop/health check
- Kernel creation and management
- Code execution via WebSocket
- Output parsing (stdout, stderr, display_data, execute_result)
"""

import asyncio
import json
import logging
import os
import platform
import uuid
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)


class JupyterBridge:
    """Service for managing Jupyter Kernel Gateway container and code execution."""

    CONTAINER_NAME = 'track-the-thing-jupyter'
    DEFAULT_PORT = 8888
    DEFAULT_IMAGE = 'jupyter/minimal-notebook:python-3.11'
    DOCKER_NETWORK = 'track-the-thing-network'
    # Use container name for Docker-to-Docker communication
    JUPYTER_HOST = CONTAINER_NAME
    # Supported Python versions for the preset selector
    SUPPORTED_VERSIONS = ['3.9', '3.10', '3.11', '3.12']

    def __init__(self, db: Session):
        """Initialize JupyterBridge with database session."""
        self.db = db
        self._docker_client = None
        self._python_version = '3.11'
        self._custom_image = ''
        self._docker_available = None
        self._docker_version = None
        self._kernel_id = None
        self._jupyter_token = os.getenv('JUPYTER_TOKEN', 'trackthething')

    def set_image_config(self, python_version: str, custom_image: str = '') -> None:
        """
        Set the Python version or custom image to use.

        Args:
            python_version: One of '3.9', '3.10', '3.11', '3.12', or 'custom'
            custom_image: Docker image to use when python_version is 'custom'
        """
        self._python_version = python_version
        self._custom_image = custom_image

    @property
    def docker_image(self) -> str:
        """
        Get the Docker image to use based on configuration.

        Returns:
            Docker image string (e.g., 'jupyter/minimal-notebook:python-3.11')
        """
        if self._python_version == 'custom' and self._custom_image:
            return self._custom_image
        elif self._python_version in self.SUPPORTED_VERSIONS:
            return f'jupyter/minimal-notebook:python-{self._python_version}'
        else:
            return self.DEFAULT_IMAGE

    def _init_docker(self) -> bool:
        """Initialize Docker client if available (reuses DockerBridge pattern)."""
        if self._docker_available is not None:
            return self._docker_available

        # Ensure Docker credential helpers are in PATH for desktop app
        if platform.system() == 'Darwin':
            extra_paths = [
                '/usr/local/bin',
                '/opt/homebrew/bin',
                os.path.expanduser('~/.docker/bin'),
                '/Applications/Docker.app/Contents/Resources/bin',
            ]
            current_path = os.environ.get('PATH', '')
            for p in extra_paths:
                if p not in current_path and os.path.exists(p):
                    os.environ['PATH'] = f'{p}:{current_path}'
                    current_path = os.environ['PATH']

        try:
            import docker

            # Try docker.from_env() first
            try:
                self._docker_client = docker.from_env()
                version_info = self._docker_client.version()
                self._docker_version = version_info.get('Version', 'unknown')
                self._docker_available = True
                logger.info(f'Connected to Docker {self._docker_version} via default')
                return True
            except Exception as e:
                logger.warning(f'docker.from_env() failed: {e}')

            # On macOS, try common socket paths
            if platform.system() == 'Darwin':
                socket_paths = [
                    os.path.expanduser('~/.docker/run/docker.sock'),
                    '/var/run/docker.sock',
                    os.path.expanduser('~/Library/Containers/com.docker.docker/Data/docker.sock'),
                ]

                for socket_path in socket_paths:
                    if os.path.exists(socket_path):
                        try:
                            self._docker_client = docker.DockerClient(base_url=f'unix://{socket_path}')
                            version_info = self._docker_client.version()
                            self._docker_version = version_info.get('Version', 'unknown')
                            self._docker_available = True
                            logger.info(f'Connected to Docker {self._docker_version} via {socket_path}')
                            return True
                        except Exception as socket_err:
                            logger.warning(f'Socket {socket_path} failed: {socket_err}')
                            continue

            logger.error('No working Docker connection found')
            self._docker_available = False
            self._docker_client = None

        except ImportError as ie:
            logger.error(f'Docker SDK not installed: {ie}')
            self._docker_available = False
            self._docker_client = None
        except Exception as e:
            logger.error(f'Docker init error: {e}', exc_info=True)
            self._docker_available = False
            self._docker_client = None

        return self._docker_available

    def is_available(self) -> tuple[bool, str | None, str | None]:
        """
        Check if Docker is available for Jupyter.

        Returns:
            Tuple of (available, version, error_message)
        """
        available = self._init_docker()
        if available:
            return True, self._docker_version, None
        else:
            if platform.system() == 'Darwin':
                return (
                    False,
                    None,
                    'Docker is not available. Ensure Docker Desktop is running.',
                )
            return False, None, 'Docker is not available or not running'

    def _get_container(self):
        """Get the Jupyter container if it exists."""
        if not self._init_docker():
            return None

        try:
            return self._docker_client.containers.get(self.CONTAINER_NAME)
        except Exception:
            return None

    async def start_container(self) -> tuple[bool, str | None]:
        """
        Start the Jupyter Kernel Gateway container.

        Returns:
            Tuple of (success, error_message)
        """
        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            # Check if container already exists and running
            container = self._get_container()
            if container:
                if container.status == 'running':
                    logger.info('Jupyter container already running')
                    return True, None
                # Container exists but not running - remove and recreate
                container.remove(force=True)
                logger.info('Removed existing Jupyter container')

            # Pull image if needed
            try:
                self._docker_client.images.get(self.docker_image)
                logger.info(f'Image {self.docker_image} already exists')
            except Exception:
                logger.info(f'Pulling image {self.docker_image}...')
                self._docker_client.images.pull(self.docker_image)
                logger.info(f'Pulled image {self.docker_image}')

            # Start container with kernel gateway installation
            # The minimal-notebook image doesn't include kernel gateway by default
            # Note: Don't use quotes around token value - they become literal in bash -c
            install_and_run_cmd = (
                'pip install --quiet jupyter_kernel_gateway && '
                'jupyter kernelgateway '
                '--KernelGatewayApp.api=kernel_gateway.jupyter_websocket '
                '--KernelGatewayApp.ip=0.0.0.0 '
                f'--KernelGatewayApp.port={self.DEFAULT_PORT} '
                '--KernelGatewayApp.allow_origin=* '
                f'--KernelGatewayApp.auth_token={self._jupyter_token}'
            )
            container = self._docker_client.containers.run(
                self.docker_image,
                name=self.CONTAINER_NAME,
                detach=True,
                remove=False,
                ports={f'{self.DEFAULT_PORT}/tcp': ('127.0.0.1', self.DEFAULT_PORT)},
                environment={'JUPYTER_TOKEN': self._jupyter_token},
                command=['bash', '-c', install_and_run_cmd],
                mem_limit='1g',
                network=self.DOCKER_NETWORK,  # Join same network as backend
            )

            logger.info(f'Started Jupyter container: {container.id}')

            # Wait for container to be healthy
            for _ in range(30):  # Wait up to 30 seconds
                await asyncio.sleep(1)
                healthy, _ = await self.health_check()
                if healthy:
                    logger.info('Jupyter container is healthy')
                    return True, None

            return False, 'Container started but health check failed'

        except Exception as e:
            logger.error(f'Failed to start Jupyter container: {e}')
            return False, str(e)

    async def stop_container(self) -> tuple[bool, str | None]:
        """
        Stop the Jupyter container.

        Returns:
            Tuple of (success, error_message)
        """
        if not self._init_docker():
            return False, 'Docker is not available'

        try:
            container = self._get_container()
            if not container:
                return True, None

            container.stop(timeout=10)
            container.remove(force=True)
            self._kernel_id = None
            logger.info('Stopped and removed Jupyter container')
            return True, None

        except Exception as e:
            logger.error(f'Failed to stop Jupyter container: {e}')
            return False, str(e)

    async def health_check(self) -> tuple[bool, str | None]:
        """
        Check if Jupyter is responding.

        Returns:
            Tuple of (healthy, error_message)
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f'http://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api',
                    headers={'Authorization': f'token {self._jupyter_token}'},
                )
                if response.status_code == 200:
                    return True, None
                return False, f'Health check returned {response.status_code}'
        except httpx.TimeoutException:
            return False, 'Health check timed out'
        except httpx.ConnectError:
            return False, 'Could not connect to Jupyter'
        except Exception as e:
            return False, str(e)

    async def get_or_create_kernel(self) -> tuple[str | None, str | None]:
        """
        Get existing kernel or create new one.

        Returns:
            Tuple of (kernel_id, error_message)
        """
        # Check if we have an existing kernel
        if self._kernel_id:
            # Verify it's still alive
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        f'http://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api/kernels/{self._kernel_id}',
                        headers={'Authorization': f'token {self._jupyter_token}'},
                    )
                    if response.status_code == 200:
                        return self._kernel_id, None
            except Exception:
                pass
            self._kernel_id = None

        # Create new kernel
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f'http://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api/kernels',
                    headers={'Authorization': f'token {self._jupyter_token}'},
                    json={'name': 'python3'},
                )
                if response.status_code in (200, 201):
                    data = response.json()
                    self._kernel_id = data.get('id')
                    logger.info(f'Created kernel: {self._kernel_id}')

                    # Store in database
                    session = models.JupyterSession(
                        kernel_id=self._kernel_id,
                        status='idle',
                        last_activity=datetime.utcnow(),
                    )
                    self.db.add(session)
                    self.db.commit()

                    return self._kernel_id, None
                return None, f'Failed to create kernel: {response.status_code}'
        except Exception as e:
            logger.error(f'Failed to create kernel: {e}')
            return None, str(e)

    async def execute_code(
        self,
        code: str,
        kernel_id: str | None = None,
    ) -> tuple[dict | None, str | None]:
        """
        Execute code in the Jupyter kernel.

        Returns:
            Tuple of (result_dict, error_message)
            result_dict contains:
            - outputs: list of {type, text/data, mime_type}
            - execution_count: int
            - status: 'ok' | 'error'
            - error_name: str (if error)
            - error_value: str (if error)
            - traceback: list[str] (if error)
        """
        if not kernel_id:
            kernel_id, error = await self.get_or_create_kernel()
            if error:
                return None, error

        try:
            import websockets
        except ImportError:
            return None, 'websockets package not installed'

        # Connect via WebSocket
        ws_url = f'ws://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api/kernels/{kernel_id}/channels?token={self._jupyter_token}'

        try:
            result = {
                'outputs': [],
                'execution_count': 0,
                'status': 'ok',
                'error_name': None,
                'error_value': None,
                'traceback': None,
            }

            msg_id = str(uuid.uuid4())

            # Build execute_request message
            execute_request = {
                'header': {
                    'msg_id': msg_id,
                    'username': 'track-the-thing',
                    'session': str(uuid.uuid4()),
                    'msg_type': 'execute_request',
                    'version': '5.3',
                },
                'parent_header': {},
                'metadata': {},
                'content': {
                    'code': code,
                    'silent': False,
                    'store_history': True,
                    'user_expressions': {},
                    'allow_stdin': False,
                    'stop_on_error': True,
                },
                'buffers': [],
                'channel': 'shell',
            }

            async with websockets.connect(ws_url, max_size=10 * 1024 * 1024) as ws:
                # Send execute request
                await ws.send(json.dumps(execute_request))

                # Wait for responses
                execute_reply_received = False
                timeout = 120  # 2 minute timeout

                while not execute_reply_received:
                    try:
                        response = await asyncio.wait_for(ws.recv(), timeout=timeout)
                        msg = json.loads(response)

                        msg_type = msg.get('msg_type') or msg.get('header', {}).get('msg_type')
                        parent_msg_id = msg.get('parent_header', {}).get('msg_id')

                        # Only process messages for our request
                        if parent_msg_id != msg_id:
                            continue

                        content = msg.get('content', {})

                        if msg_type == 'stream':
                            # stdout/stderr
                            result['outputs'].append(
                                {
                                    'type': content.get('name', 'stdout'),
                                    'text': content.get('text', ''),
                                }
                            )

                        elif msg_type == 'execute_result':
                            result['execution_count'] = content.get('execution_count', 0)
                            data = content.get('data', {})
                            if 'text/plain' in data:
                                result['outputs'].append(
                                    {
                                        'type': 'execute_result',
                                        'text': data.get('text/plain'),
                                        'data': data,
                                    }
                                )
                            else:
                                result['outputs'].append(
                                    {
                                        'type': 'execute_result',
                                        'data': data,
                                    }
                                )

                        elif msg_type == 'display_data':
                            data = content.get('data', {})
                            result['outputs'].append(
                                {
                                    'type': 'display_data',
                                    'data': data,
                                }
                            )

                        elif msg_type == 'error':
                            result['status'] = 'error'
                            result['error_name'] = content.get('ename', 'Error')
                            result['error_value'] = content.get('evalue', '')
                            result['traceback'] = content.get('traceback', [])
                            result['outputs'].append(
                                {
                                    'type': 'error',
                                    'text': f"{content.get('ename')}: {content.get('evalue')}",
                                }
                            )

                        elif msg_type == 'execute_reply':
                            result['execution_count'] = content.get('execution_count', 0)
                            if content.get('status') == 'error':
                                result['status'] = 'error'
                                result['error_name'] = content.get('ename')
                                result['error_value'] = content.get('evalue')
                                result['traceback'] = content.get('traceback')
                            execute_reply_received = True

                    except TimeoutError:
                        return None, 'Execution timed out'

            # Update session last_activity
            session = self.db.query(models.JupyterSession).filter(models.JupyterSession.kernel_id == kernel_id).first()
            if session:
                session.last_activity = datetime.utcnow()
                self.db.commit()

            return result, None

        except Exception as e:
            logger.error(f'Execution failed: {e}')
            return None, str(e)

    async def interrupt_kernel(self, kernel_id: str | None = None) -> tuple[bool, str | None]:
        """
        Interrupt a running kernel.

        Returns:
            Tuple of (success, error_message)
        """
        if not kernel_id:
            kernel_id = self._kernel_id

        if not kernel_id:
            return False, 'No kernel to interrupt'

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f'http://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api/kernels/{kernel_id}/interrupt',
                    headers={'Authorization': f'token {self._jupyter_token}'},
                )
                if response.status_code in (200, 204):
                    return True, None
                return False, f'Interrupt failed: {response.status_code}'
        except Exception as e:
            return False, str(e)

    async def restart_kernel(self, kernel_id: str | None = None) -> tuple[bool, str | None]:
        """
        Restart a kernel.

        Returns:
            Tuple of (success, error_message)
        """
        if not kernel_id:
            kernel_id = self._kernel_id

        if not kernel_id:
            return False, 'No kernel to restart'

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f'http://{self.JUPYTER_HOST}:{self.DEFAULT_PORT}/api/kernels/{kernel_id}/restart',
                    headers={'Authorization': f'token {self._jupyter_token}'},
                )
                if response.status_code in (200, 204):
                    # Clear session status
                    session = (
                        self.db.query(models.JupyterSession)
                        .filter(models.JupyterSession.kernel_id == kernel_id)
                        .first()
                    )
                    if session:
                        session.status = 'idle'
                        session.last_activity = datetime.utcnow()
                        self.db.commit()
                    return True, None
                return False, f'Restart failed: {response.status_code}'
        except Exception as e:
            return False, str(e)

    def get_container_logs(self, tail: int = 100) -> tuple[str | None, str | None]:
        """
        Get container logs for debugging.

        Returns:
            Tuple of (logs, error_message)
        """
        if not self._init_docker():
            return None, 'Docker is not available'

        try:
            container = self._get_container()
            if not container:
                return '', 'Container not found'

            logs = container.logs(tail=tail, timestamps=True).decode('utf-8')
            return logs, None
        except Exception as e:
            return None, str(e)

    def is_container_running(self) -> bool:
        """Check if the Jupyter container is running."""
        container = self._get_container()
        return container is not None and container.status == 'running'
