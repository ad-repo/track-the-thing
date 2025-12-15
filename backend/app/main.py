import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.models import AppSettings
from app.routers import (
    app_settings,
    background_images,
    backup,
    custom_emojis,
    entries,
    goals,
    jupyter,
    labels,
    link_preview,
    lists,
    llm,
    mcp,
    notes,
    reminders,
    reports,
    search,
    search_history,
    uploads,
)
from app.services.docker_bridge import DockerBridge
from app.services.jupyter_bridge import JupyterBridge

logger = logging.getLogger(__name__)


async def mcp_watchdog():
    """Background task that monitors and auto-restarts MCP server containers if needed."""
    # Import here to avoid circular imports
    from app.models import McpServer

    while True:
        try:
            # Check every 30 seconds
            await asyncio.sleep(30)

            # Get settings from database
            db = SessionLocal()
            try:
                settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
                if not settings:
                    continue

                mcp_enabled = bool(getattr(settings, 'mcp_enabled', 0))
                if not mcp_enabled:
                    continue

                # Check Docker availability
                bridge = DockerBridge(db)
                docker_available, _, _ = bridge.is_available()

                if not docker_available:
                    continue

                # Get all servers with auto_start enabled
                servers = db.query(McpServer).filter(McpServer.auto_start == 1).all()

                for server in servers:
                    # Skip non-Docker servers (remote, stdio)
                    server_type = getattr(server, 'server_type', 'docker')
                    if server_type != 'docker':
                        continue

                    # Check if container is running
                    if server.status != 'running':
                        logger.info(f'MCP watchdog: Server "{server.name}" not running, auto-starting...')

                        success, error = await bridge.start_container(server)
                        if success:
                            logger.info(f'MCP watchdog: Server "{server.name}" started successfully')
                        else:
                            logger.error(f'MCP watchdog: Failed to start server "{server.name}": {error}')

            finally:
                db.close()

        except Exception as e:
            logger.error(f'MCP watchdog error: {e}')


async def jupyter_watchdog():
    """Background task that monitors and auto-restarts Jupyter container if needed."""
    while True:
        try:
            # Check every 30 seconds
            await asyncio.sleep(30)

            # Get settings from database
            db = SessionLocal()
            try:
                settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
                if not settings:
                    continue

                jupyter_enabled = bool(getattr(settings, 'jupyter_enabled', 0))
                auto_start = bool(getattr(settings, 'jupyter_auto_start', 0))

                if not jupyter_enabled or not auto_start:
                    continue

                # Check if container is running
                bridge = JupyterBridge(db)
                docker_available, _, _ = bridge.is_available()

                if not docker_available:
                    continue

                if not bridge.is_container_running():
                    logger.info('Jupyter watchdog: Container not running, auto-starting...')

                    # Load image config
                    python_version = getattr(settings, 'jupyter_python_version', '3.11') or '3.11'
                    custom_image = getattr(settings, 'jupyter_custom_image', '') or ''
                    bridge.set_image_config(python_version, custom_image)

                    success, error = await bridge.start_container()
                    if success:
                        logger.info('Jupyter watchdog: Container started successfully')
                    else:
                        logger.error(f'Jupyter watchdog: Failed to start container: {error}')
            finally:
                db.close()

        except Exception as e:
            logger.error(f'Jupyter watchdog error: {e}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown tasks."""
    # Startup: Start background tasks
    jupyter_task = None
    mcp_task = None

    if os.getenv('TESTING') != 'true':
        jupyter_task = asyncio.create_task(jupyter_watchdog())
        mcp_task = asyncio.create_task(mcp_watchdog())
        logger.info('Started Jupyter and MCP watchdog tasks')

    yield

    # Shutdown: Cancel background tasks
    for task, name in [(jupyter_task, 'Jupyter'), (mcp_task, 'MCP')]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info(f'Stopped {name} watchdog task')


# Create database tables only if not in test mode
if os.getenv('TESTING') != 'true':
    Base.metadata.create_all(bind=engine)

app = FastAPI(title='Track the Thing API', version='1.0.0', lifespan=lifespan)

# Configure CORS
# Allow all origins for now (restrict in production if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=['*'],
    allow_headers=['*'],
)

# Include routers
app.include_router(notes.router, prefix='/api/notes', tags=['notes'])
app.include_router(entries.router, prefix='/api/entries', tags=['entries'])
app.include_router(uploads.router, prefix='/api/uploads', tags=['uploads'])
app.include_router(labels.router, prefix='/api/labels', tags=['labels'])
app.include_router(lists.router)
app.include_router(backup.router, prefix='/api/backup', tags=['backup'])
app.include_router(reports.router, prefix='/api/reports', tags=['reports'])
app.include_router(search.router, prefix='/api/search', tags=['search'])
app.include_router(search_history.router, prefix='/api/search-history', tags=['search-history'])
app.include_router(link_preview.router, prefix='/api/link-preview', tags=['link-preview'])
app.include_router(background_images.router, prefix='/api/background-images', tags=['background-images'])
app.include_router(custom_emojis.router)
app.include_router(app_settings.router)
app.include_router(goals.router)
app.include_router(reminders.router)
app.include_router(llm.router)
app.include_router(mcp.router)
app.include_router(jupyter.router)


@app.get('/')
async def root():
    return {'message': 'Track the Thing API', 'version': '1.0.0'}


@app.get('/health')
async def health():
    return {'status': 'healthy'}
