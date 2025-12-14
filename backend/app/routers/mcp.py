"""
API routes for MCP (Model Context Protocol) server management
"""

import json
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.docker_bridge import DockerBridge

router = APIRouter(prefix='/api/mcp', tags=['mcp'])


def get_docker_bridge(db: Session = Depends(get_db)) -> DockerBridge:
    """Dependency to get DockerBridge instance."""
    return DockerBridge(db)


def _serialize_server(server: models.McpServer) -> dict:
    """Serialize McpServer to dict with proper env_vars and headers handling."""
    try:
        env_vars = json.loads(server.env_vars) if server.env_vars else []
    except json.JSONDecodeError:
        env_vars = []

    try:
        headers_str = getattr(server, 'headers', '{}') or '{}'
        headers = json.loads(headers_str)
    except json.JSONDecodeError:
        headers = {}

    server_type = getattr(server, 'server_type', 'docker') or 'docker'
    url = getattr(server, 'url', '') or ''

    return {
        'id': server.id,
        'name': server.name,
        'server_type': server_type,
        'image': server.image or '',
        'port': server.port or 0,
        'url': url,
        'headers': headers,
        'description': server.description or '',
        'env_vars': env_vars,
        'status': server.status or 'stopped',
        'last_health_check': server.last_health_check,
        'auto_start': bool(server.auto_start),
        'source': server.source or 'local',
        'manifest_url': server.manifest_url or '',
        'created_at': server.created_at,
        'updated_at': server.updated_at,
        'routing_rules': [
            {
                'id': rule.id,
                'mcp_server_id': rule.mcp_server_id,
                'pattern': rule.pattern,
                'priority': rule.priority,
                'is_enabled': bool(rule.is_enabled),
                'created_at': rule.created_at,
            }
            for rule in server.routing_rules
        ],
    }


# ===========================
# Docker Status
# ===========================


@router.get('/docker/status', response_model=schemas.McpDockerStatusResponse)
def get_docker_status(bridge: DockerBridge = Depends(get_docker_bridge)):
    """Check if Docker is available and get version info."""
    available, version, error = bridge.is_available()
    return schemas.McpDockerStatusResponse(
        available=available,
        version=version,
        error=error,
    )


# ===========================
# MCP Settings
# ===========================


@router.get('/settings', response_model=schemas.McpSettingsResponse)
def get_mcp_settings(
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Get MCP settings."""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    docker_available, _, _ = bridge.is_available()

    return schemas.McpSettingsResponse(
        mcp_enabled=bool(getattr(settings, 'mcp_enabled', 0)) if settings else False,
        mcp_idle_timeout=getattr(settings, 'mcp_idle_timeout', 300) if settings else 300,
        mcp_fallback_to_llm=bool(getattr(settings, 'mcp_fallback_to_llm', 1)) if settings else True,
        docker_available=docker_available,
    )


@router.patch('/settings', response_model=schemas.McpSettingsResponse)
def update_mcp_settings(
    update: schemas.McpSettingsUpdate,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Update MCP settings."""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings:
        settings = models.AppSettings(id=1)
        db.add(settings)

    if update.mcp_enabled is not None:
        settings.mcp_enabled = 1 if update.mcp_enabled else 0
    if update.mcp_idle_timeout is not None:
        settings.mcp_idle_timeout = update.mcp_idle_timeout
    if update.mcp_fallback_to_llm is not None:
        settings.mcp_fallback_to_llm = 1 if update.mcp_fallback_to_llm else 0

    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)

    docker_available, _, _ = bridge.is_available()

    return schemas.McpSettingsResponse(
        mcp_enabled=bool(settings.mcp_enabled),
        mcp_idle_timeout=settings.mcp_idle_timeout,
        mcp_fallback_to_llm=bool(settings.mcp_fallback_to_llm),
        docker_available=docker_available,
    )


# ===========================
# MCP Servers CRUD
# ===========================


@router.get('/servers')
def list_servers(db: Session = Depends(get_db)):
    """List all MCP servers."""
    servers = db.query(models.McpServer).all()
    return [_serialize_server(s) for s in servers]


@router.get('/servers/{server_id}')
def get_server(server_id: int, db: Session = Depends(get_db)):
    """Get a specific MCP server."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')
    return _serialize_server(server)


@router.post('/servers')
def create_server(server_data: schemas.McpServerCreate, db: Session = Depends(get_db)):
    """Create a new MCP server configuration (Docker or remote)."""
    # Check if name already exists
    existing = db.query(models.McpServer).filter(models.McpServer.name == server_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail='Server name already exists')

    # Validate based on server type
    server_type = server_data.server_type or 'docker'
    if server_type == 'docker':
        if not server_data.image:
            raise HTTPException(status_code=400, detail='Docker image is required for Docker servers')
        if not server_data.port:
            raise HTTPException(status_code=400, detail='Port is required for Docker servers')
    elif server_type == 'remote':
        if not server_data.url:
            raise HTTPException(status_code=400, detail='URL is required for remote servers')

    server = models.McpServer(
        name=server_data.name,
        server_type=server_type,
        image=server_data.image or '',
        port=server_data.port or 0,
        url=server_data.url or '',
        headers=json.dumps(server_data.headers or {}),
        description=server_data.description,
        env_vars=json.dumps(server_data.env_vars),
        auto_start=1 if server_data.auto_start else 0,
        source='local',
        status='stopped',
    )
    db.add(server)
    db.commit()
    db.refresh(server)

    return _serialize_server(server)


@router.put('/servers/{server_id}')
def update_server(server_id: int, update: schemas.McpServerUpdate, db: Session = Depends(get_db)):
    """Update an MCP server configuration."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    if update.name is not None:
        # Check if new name already exists
        existing = (
            db.query(models.McpServer)
            .filter(
                models.McpServer.name == update.name,
                models.McpServer.id != server_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail='Server name already exists')
        server.name = update.name

    if update.server_type is not None:
        server.server_type = update.server_type
    if update.image is not None:
        server.image = update.image
    if update.port is not None:
        server.port = update.port
    if update.url is not None:
        server.url = update.url
    if update.headers is not None:
        server.headers = json.dumps(update.headers)
    if update.description is not None:
        server.description = update.description
    if update.env_vars is not None:
        server.env_vars = json.dumps(update.env_vars)
    if update.auto_start is not None:
        server.auto_start = 1 if update.auto_start else 0

    server.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(server)

    return _serialize_server(server)


@router.delete('/servers/{server_id}')
async def delete_server(
    server_id: int,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Delete an MCP server configuration and stop container if running."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    # Stop container if running
    if server.status == 'running':
        await bridge.stop_container(server)

    db.delete(server)
    db.commit()

    return {'deleted': True}


# ===========================
# Container Control
# ===========================


@router.post('/servers/{server_id}/start')
async def start_server(
    server_id: int,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Start an MCP server container."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    success, error = await bridge.start_container(server)
    if not success:
        raise HTTPException(status_code=500, detail=error or 'Failed to start container')

    db.refresh(server)
    return _serialize_server(server)


@router.post('/servers/{server_id}/stop')
async def stop_server(
    server_id: int,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Stop an MCP server container."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    success, error = await bridge.stop_container(server)
    if not success:
        raise HTTPException(status_code=500, detail=error or 'Failed to stop container')

    db.refresh(server)
    return _serialize_server(server)


@router.post('/servers/{server_id}/restart')
async def restart_server(
    server_id: int,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Restart an MCP server container."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    success, error = await bridge.restart_container(server)
    if not success:
        raise HTTPException(status_code=500, detail=error or 'Failed to restart container')

    db.refresh(server)
    return _serialize_server(server)


@router.get('/servers/{server_id}/logs')
async def get_server_logs(
    server_id: int,
    tail: int = 100,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Get logs from an MCP server container."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    logs, error = await bridge.get_logs(server, tail=tail)
    if error:
        return schemas.McpServerLogsResponse(
            server_id=server.id,
            server_name=server.name,
            logs=f'Error retrieving logs: {error}',
            timestamp=datetime.utcnow(),
        )

    return schemas.McpServerLogsResponse(
        server_id=server.id,
        server_name=server.name,
        logs=logs or '',
        timestamp=datetime.utcnow(),
    )


@router.get('/servers/{server_id}/health')
async def check_server_health(
    server_id: int,
    db: Session = Depends(get_db),
    bridge: DockerBridge = Depends(get_docker_bridge),
):
    """Check health of an MCP server."""
    server = db.query(models.McpServer).filter(models.McpServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    healthy, error = await bridge.health_check(server)

    db.refresh(server)
    return {
        'healthy': healthy,
        'error': error,
        'server': _serialize_server(server),
    }


# ===========================
# GitHub Manifest Import
# ===========================


@router.post('/import')
async def import_from_manifest(data: schemas.McpManifestImport, db: Session = Depends(get_db)):
    """Import an MCP server configuration from a GitHub manifest URL."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(data.manifest_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f'Failed to fetch manifest: {response.status_code}')

            manifest = response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail='Manifest fetch timed out')
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail='Invalid JSON in manifest')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Failed to fetch manifest: {str(e)}')

    # Validate required fields
    required = ['name', 'image']
    for field in required:
        if field not in manifest:
            raise HTTPException(status_code=400, detail=f'Missing required field in manifest: {field}')

    # Check if server with this name already exists
    existing = db.query(models.McpServer).filter(models.McpServer.name == manifest['name']).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Server with name '{manifest['name']}' already exists")

    # Determine port (use manifest port or find next available starting at 8011)
    port = manifest.get('port', 8011)
    while db.query(models.McpServer).filter(models.McpServer.port == port).first():
        port += 1

    # Create server from manifest
    server = models.McpServer(
        name=manifest['name'],
        image=manifest['image'],
        port=port,
        description=manifest.get('description', ''),
        env_vars=json.dumps(manifest.get('env_vars', [])),
        auto_start=0,
        source='github',
        manifest_url=data.manifest_url,
        status='stopped',
    )
    db.add(server)
    db.flush()

    # Create default routing rules from manifest
    default_patterns = manifest.get('default_routing_patterns', [])
    for i, pattern in enumerate(default_patterns):
        rule = models.McpRoutingRule(
            mcp_server_id=server.id,
            pattern=pattern,
            priority=100 - i,  # First patterns get higher priority
            is_enabled=1,
        )
        db.add(rule)

    db.commit()
    db.refresh(server)

    return _serialize_server(server)


# ===========================
# Routing Rules CRUD
# ===========================


@router.get('/routing-rules')
def list_routing_rules(db: Session = Depends(get_db)):
    """List all routing rules."""
    rules = db.query(models.McpRoutingRule).order_by(models.McpRoutingRule.priority.desc()).all()
    return [
        {
            'id': rule.id,
            'mcp_server_id': rule.mcp_server_id,
            'pattern': rule.pattern,
            'priority': rule.priority,
            'is_enabled': bool(rule.is_enabled),
            'created_at': rule.created_at,
        }
        for rule in rules
    ]


@router.post('/routing-rules')
def create_routing_rule(rule_data: schemas.McpRoutingRuleCreate, db: Session = Depends(get_db)):
    """Create a new routing rule."""
    # Verify server exists
    server = db.query(models.McpServer).filter(models.McpServer.id == rule_data.mcp_server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail='MCP server not found')

    rule = models.McpRoutingRule(
        mcp_server_id=rule_data.mcp_server_id,
        pattern=rule_data.pattern,
        priority=rule_data.priority,
        is_enabled=1 if rule_data.is_enabled else 0,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return {
        'id': rule.id,
        'mcp_server_id': rule.mcp_server_id,
        'pattern': rule.pattern,
        'priority': rule.priority,
        'is_enabled': bool(rule.is_enabled),
        'created_at': rule.created_at,
    }


@router.put('/routing-rules/{rule_id}')
def update_routing_rule(rule_id: int, update: schemas.McpRoutingRuleUpdate, db: Session = Depends(get_db)):
    """Update a routing rule."""
    rule = db.query(models.McpRoutingRule).filter(models.McpRoutingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='Routing rule not found')

    if update.pattern is not None:
        rule.pattern = update.pattern
    if update.priority is not None:
        rule.priority = update.priority
    if update.is_enabled is not None:
        rule.is_enabled = 1 if update.is_enabled else 0

    db.commit()
    db.refresh(rule)

    return {
        'id': rule.id,
        'mcp_server_id': rule.mcp_server_id,
        'pattern': rule.pattern,
        'priority': rule.priority,
        'is_enabled': bool(rule.is_enabled),
        'created_at': rule.created_at,
    }


@router.delete('/routing-rules/{rule_id}')
def delete_routing_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a routing rule."""
    rule = db.query(models.McpRoutingRule).filter(models.McpRoutingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='Routing rule not found')

    db.delete(rule)
    db.commit()

    return {'deleted': True}
