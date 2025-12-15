"""
API routes for Jupyter notebook integration
"""

import io
import json
from datetime import datetime
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.jupyter_bridge import JupyterBridge

router = APIRouter(prefix='/api/jupyter', tags=['jupyter'])


def get_jupyter_bridge(db: Session = Depends(get_db)) -> JupyterBridge:
    """Dependency to get JupyterBridge instance."""
    return JupyterBridge(db)


# ===========================
# Status & Settings
# ===========================


@router.get('/status', response_model=schemas.JupyterStatusResponse)
async def get_jupyter_status(bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Get Jupyter container and Docker status."""
    docker_available, _, docker_error = bridge.is_available()

    if not docker_available:
        return schemas.JupyterStatusResponse(
            docker_available=False,
            container_running=False,
            kernel_id=None,
            error=docker_error,
        )

    container_running = bridge.is_container_running()
    kernel_id = None

    if container_running:
        # Try to get existing kernel
        kernel_id, _ = await bridge.get_or_create_kernel()

    return schemas.JupyterStatusResponse(
        docker_available=True,
        container_running=container_running,
        kernel_id=kernel_id,
        error=None,
    )


@router.get('/settings', response_model=schemas.JupyterSettingsResponse)
def get_jupyter_settings(
    db: Session = Depends(get_db),
    bridge: JupyterBridge = Depends(get_jupyter_bridge),
):
    """Get Jupyter settings."""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    docker_available, _, _ = bridge.is_available()

    return schemas.JupyterSettingsResponse(
        jupyter_enabled=bool(getattr(settings, 'jupyter_enabled', 0)) if settings else False,
        jupyter_auto_start=bool(getattr(settings, 'jupyter_auto_start', 0)) if settings else False,
        jupyter_python_version=getattr(settings, 'jupyter_python_version', '3.11') or '3.11' if settings else '3.11',
        jupyter_custom_image=getattr(settings, 'jupyter_custom_image', '') or '' if settings else '',
        docker_available=docker_available,
    )


@router.patch('/settings', response_model=schemas.JupyterSettingsResponse)
def update_jupyter_settings(
    update: schemas.JupyterSettingsUpdate,
    db: Session = Depends(get_db),
    bridge: JupyterBridge = Depends(get_jupyter_bridge),
):
    """Update Jupyter settings."""
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()

    if not settings:
        settings = models.AppSettings(id=1)
        db.add(settings)

    if update.jupyter_enabled is not None:
        settings.jupyter_enabled = 1 if update.jupyter_enabled else 0
    if update.jupyter_auto_start is not None:
        settings.jupyter_auto_start = 1 if update.jupyter_auto_start else 0
    if update.jupyter_python_version is not None:
        settings.jupyter_python_version = update.jupyter_python_version
    if update.jupyter_custom_image is not None:
        settings.jupyter_custom_image = update.jupyter_custom_image

    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)

    docker_available, _, _ = bridge.is_available()

    return schemas.JupyterSettingsResponse(
        jupyter_enabled=bool(settings.jupyter_enabled),
        jupyter_auto_start=bool(settings.jupyter_auto_start),
        jupyter_python_version=settings.jupyter_python_version or '3.11',
        jupyter_custom_image=settings.jupyter_custom_image or '',
        docker_available=docker_available,
    )


# ===========================
# Container Control
# ===========================


@router.post('/start', response_model=schemas.JupyterStartResponse)
async def start_jupyter(
    db: Session = Depends(get_db),
    bridge: JupyterBridge = Depends(get_jupyter_bridge),
):
    """Start Jupyter container and get a kernel."""
    # Load settings to get Python version/custom image config
    settings = db.query(models.AppSettings).first()
    if settings:
        python_version = getattr(settings, 'jupyter_python_version', '3.11') or '3.11'
        custom_image = getattr(settings, 'jupyter_custom_image', '') or ''
        bridge.set_image_config(python_version, custom_image)

    success, error = await bridge.start_container()
    if not success:
        return schemas.JupyterStartResponse(
            success=False,
            kernel_id=None,
            error=error,
        )

    # Create or get kernel
    kernel_id, kernel_error = await bridge.get_or_create_kernel()
    if kernel_error:
        return schemas.JupyterStartResponse(
            success=True,  # Container started but kernel creation failed
            kernel_id=None,
            error=f'Container started but kernel creation failed: {kernel_error}',
        )

    return schemas.JupyterStartResponse(
        success=True,
        kernel_id=kernel_id,
        error=None,
    )


@router.post('/stop', response_model=schemas.JupyterStopResponse)
async def stop_jupyter(bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Stop Jupyter container."""
    success, error = await bridge.stop_container()
    return schemas.JupyterStopResponse(
        success=success,
        error=error,
    )


@router.get('/health')
async def health_check(bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Check Jupyter health."""
    healthy, error = await bridge.health_check()
    return {
        'healthy': healthy,
        'error': error,
    }


@router.get('/logs', response_model=schemas.JupyterLogsResponse)
def get_logs(tail: int = 100, bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Get container logs."""
    logs, error = bridge.get_container_logs(tail=tail)
    if error:
        return schemas.JupyterLogsResponse(logs=f'Error: {error}')
    return schemas.JupyterLogsResponse(logs=logs or '')


# ===========================
# Code Execution
# ===========================


@router.post('/execute', response_model=schemas.JupyterExecuteResponse)
async def execute_code(
    request: schemas.JupyterExecuteRequest,
    db: Session = Depends(get_db),
    bridge: JupyterBridge = Depends(get_jupyter_bridge),
):
    """
    Execute code in Jupyter kernel.

    Request: { code: string }
    Response: {
        outputs: [{ type, text, data, mime_type }],
        execution_count: int,
        status: 'ok' | 'error',
        error?: { name, value, traceback }
    }
    """
    # Check if auto-start is enabled and container isn't running
    settings = db.query(models.AppSettings).filter(models.AppSettings.id == 1).first()
    jupyter_enabled = bool(getattr(settings, 'jupyter_enabled', 0)) if settings else False
    auto_start = bool(getattr(settings, 'jupyter_auto_start', 0)) if settings else False

    if not jupyter_enabled:
        return schemas.JupyterExecuteResponse(
            outputs=[schemas.JupyterOutput(type='error', text='Jupyter is not enabled. Enable it in Settings.')],
            execution_count=0,
            status='error',
            error_name='NotEnabled',
            error_value='Jupyter is not enabled. Enable it in Settings.',
            traceback=None,
        )

    # Auto-start container if enabled and not running
    if auto_start and not bridge.is_container_running():
        # Load image config from settings
        python_version = getattr(settings, 'jupyter_python_version', '3.11') or '3.11'
        custom_image = getattr(settings, 'jupyter_custom_image', '') or ''
        bridge.set_image_config(python_version, custom_image)

        success, start_error = await bridge.start_container()
        if not success:
            return schemas.JupyterExecuteResponse(
                outputs=[schemas.JupyterOutput(type='error', text=f'Failed to auto-start Jupyter: {start_error}')],
                execution_count=0,
                status='error',
                error_name='AutoStartFailed',
                error_value=f'Failed to auto-start Jupyter: {start_error}',
                traceback=None,
            )

    result, error = await bridge.execute_code(request.code)

    if error:
        return schemas.JupyterExecuteResponse(
            outputs=[schemas.JupyterOutput(type='error', text=error)],
            execution_count=0,
            status='error',
            error_name='ExecutionError',
            error_value=error,
            traceback=None,
        )

    # Convert outputs to schema format
    outputs = []
    for output in result.get('outputs', []):
        outputs.append(
            schemas.JupyterOutput(
                type=output.get('type', 'unknown'),
                text=output.get('text'),
                data=output.get('data'),
                mime_type=output.get('mime_type'),
            )
        )

    return schemas.JupyterExecuteResponse(
        outputs=outputs,
        execution_count=result.get('execution_count', 0),
        status=result.get('status', 'ok'),
        error_name=result.get('error_name'),
        error_value=result.get('error_value'),
        traceback=result.get('traceback'),
    )


@router.post('/interrupt')
async def interrupt_execution(bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Interrupt running code."""
    success, error = await bridge.interrupt_kernel()
    return {
        'success': success,
        'error': error,
    }


@router.post('/restart')
async def restart_kernel(bridge: JupyterBridge = Depends(get_jupyter_bridge)):
    """Restart the kernel (clears all state)."""
    success, error = await bridge.restart_kernel()
    return {
        'success': success,
        'error': error,
    }


# ===========================
# Export
# ===========================


def _convert_outputs_to_ipynb(outputs: list[dict]) -> list[dict]:
    """Convert our output format to Jupyter .ipynb format."""
    ipynb_outputs = []
    for output in outputs:
        output_type = output.get('type', '')
        if output_type in ('stdout', 'stderr'):
            ipynb_outputs.append(
                {
                    'output_type': 'stream',
                    'name': output_type,
                    'text': [output.get('text', '')],
                }
            )
        elif output_type == 'execute_result':
            ipynb_outputs.append(
                {
                    'output_type': 'execute_result',
                    'data': output.get('data', {'text/plain': output.get('text', '')}),
                    'metadata': {},
                    'execution_count': output.get('execution_count'),
                }
            )
        elif output_type == 'display_data':
            ipynb_outputs.append(
                {
                    'output_type': 'display_data',
                    'data': output.get('data', {}),
                    'metadata': {},
                }
            )
        elif output_type == 'error':
            ipynb_outputs.append(
                {
                    'output_type': 'error',
                    'ename': output.get('error_name', 'Error'),
                    'evalue': output.get('error_value', output.get('text', '')),
                    'traceback': output.get('traceback', []),
                }
            )
    return ipynb_outputs


@router.post('/export')
async def export_notebook(request: schemas.JupyterExportRequest):
    """Export cells as .ipynb file."""
    notebook = {
        'cells': [
            {
                'cell_type': 'code',
                'source': cell.code.split('\n'),
                'outputs': _convert_outputs_to_ipynb(cell.outputs),
                'execution_count': cell.execution_count,
                'metadata': {},
            }
            for cell in request.cells
        ],
        'metadata': {
            'kernelspec': {
                'display_name': 'Python 3',
                'language': 'python',
                'name': 'python3',
            },
            'language_info': {
                'name': 'python',
                'version': '3.11',
            },
        },
        'nbformat': 4,
        'nbformat_minor': 5,
    }

    filename = request.filename
    if not filename.endswith('.ipynb'):
        filename = f'{filename}.ipynb'

    return StreamingResponse(
        io.BytesIO(json.dumps(notebook, indent=2).encode()),
        media_type='application/x-ipynb+json',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )


@router.post('/export-mixed')
async def export_mixed_notebook(request: schemas.JupyterMixedExportRequest):
    """Export mixed code/markdown content as .ipynb file."""
    cells = []
    for node in request.nodes:
        if node.type == 'code':
            cells.append(
                {
                    'cell_type': 'code',
                    'source': node.content.split('\n'),
                    'outputs': _convert_outputs_to_ipynb(node.outputs),
                    'execution_count': node.execution_count,
                    'metadata': {},
                }
            )
        elif node.type == 'markdown':
            cells.append(
                {
                    'cell_type': 'markdown',
                    'source': node.content.split('\n'),
                    'metadata': {},
                }
            )

    notebook = {
        'cells': cells,
        'metadata': {
            'kernelspec': {
                'display_name': 'Python 3',
                'language': 'python',
                'name': 'python3',
            },
            'language_info': {
                'name': 'python',
                'version': '3.11',
            },
        },
        'nbformat': 4,
        'nbformat_minor': 5,
    }

    filename = request.filename
    if not filename.endswith('.ipynb'):
        filename = f'{filename}.ipynb'

    return StreamingResponse(
        io.BytesIO(json.dumps(notebook, indent=2).encode()),
        media_type='application/x-ipynb+json',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )


# ===========================
# Import
# ===========================


def _parse_markdown_to_tiptap_nodes(markdown_text: str) -> list[dict]:
    """Convert markdown text to TipTap-compatible nodes."""
    import re

    nodes = []
    lines = markdown_text.split('\n')
    current_paragraph = []

    def flush_paragraph():
        """Flush accumulated paragraph text as a paragraph node."""
        if current_paragraph:
            text = '\n'.join(current_paragraph).strip()
            if text:
                nodes.append(
                    {
                        'type': 'paragraph',
                        'content': [{'type': 'text', 'text': text}],
                    }
                )
            current_paragraph.clear()

    for line in lines:
        # Check for headings
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            flush_paragraph()
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            nodes.append(
                {
                    'type': 'heading',
                    'attrs': {'level': level},
                    'content': [{'type': 'text', 'text': text}],
                }
            )
            continue

        # Check for code blocks (```...```)
        if line.strip().startswith('```'):
            flush_paragraph()
            # Skip code fence markers - they'll be handled as regular text
            continue

        # Check for horizontal rules
        if re.match(r'^[-*_]{3,}\s*$', line):
            flush_paragraph()
            nodes.append({'type': 'horizontalRule'})
            continue

        # Check for bullet lists
        bullet_match = re.match(r'^[\s]*[-*+]\s+(.+)$', line)
        if bullet_match:
            flush_paragraph()
            nodes.append(
                {
                    'type': 'bulletList',
                    'content': [
                        {
                            'type': 'listItem',
                            'content': [
                                {
                                    'type': 'paragraph',
                                    'content': [{'type': 'text', 'text': bullet_match.group(1)}],
                                }
                            ],
                        }
                    ],
                }
            )
            continue

        # Check for numbered lists
        numbered_match = re.match(r'^[\s]*\d+[.)]\s+(.+)$', line)
        if numbered_match:
            flush_paragraph()
            nodes.append(
                {
                    'type': 'orderedList',
                    'content': [
                        {
                            'type': 'listItem',
                            'content': [
                                {
                                    'type': 'paragraph',
                                    'content': [{'type': 'text', 'text': numbered_match.group(1)}],
                                }
                            ],
                        }
                    ],
                }
            )
            continue

        # Check for blockquotes
        quote_match = re.match(r'^>\s*(.*)$', line)
        if quote_match:
            flush_paragraph()
            text = quote_match.group(1).strip()
            if text:
                nodes.append(
                    {
                        'type': 'blockquote',
                        'content': [
                            {
                                'type': 'paragraph',
                                'content': [{'type': 'text', 'text': text}],
                            }
                        ],
                    }
                )
            continue

        # Empty line - flush paragraph
        if not line.strip():
            flush_paragraph()
            continue

        # Regular text - accumulate for paragraph
        current_paragraph.append(line)

    # Flush any remaining paragraph text
    flush_paragraph()

    return nodes


def _parse_notebook_to_nodes(notebook_data: dict) -> list[schemas.JupyterImportNode]:
    """Parse notebook JSON and convert to TipTap-compatible nodes."""
    nodes = []
    for cell in notebook_data.get('cells', []):
        cell_type = cell.get('cell_type', '')
        source = cell.get('source', [])

        # Handle source as list or string
        if isinstance(source, list):
            source_text = ''.join(source)
        else:
            source_text = source

        if cell_type == 'code':
            # Convert outputs to our format
            outputs = []
            for output in cell.get('outputs', []):
                output_type = output.get('output_type', '')
                if output_type == 'stream':
                    outputs.append(
                        {
                            'type': output.get('name', 'stdout'),
                            'text': ''.join(output.get('text', [])),
                        }
                    )
                elif output_type == 'execute_result':
                    data = output.get('data', {})
                    text = data.get('text/plain', '')
                    if isinstance(text, list):
                        text = ''.join(text)
                    outputs.append(
                        {
                            'type': 'execute_result',
                            'text': text,
                            'data': data,
                        }
                    )
                elif output_type == 'display_data':
                    outputs.append(
                        {
                            'type': 'display_data',
                            'data': output.get('data', {}),
                        }
                    )
                elif output_type == 'error':
                    outputs.append(
                        {
                            'type': 'error',
                            'error_name': output.get('ename', 'Error'),
                            'error_value': output.get('evalue', ''),
                            'traceback': output.get('traceback', []),
                        }
                    )

            # Build attrs dict, excluding None values
            cell_attrs = {
                'code': source_text,
                'outputs': json.dumps(outputs),
                'status': 'idle',
            }
            execution_count = cell.get('execution_count')
            if execution_count is not None:
                cell_attrs['executionCount'] = execution_count

            nodes.append(
                schemas.JupyterImportNode(
                    type='notebookCell',
                    attrs=cell_attrs,
                )
            )
        elif cell_type == 'markdown':
            # Parse markdown and convert to TipTap nodes
            markdown_nodes = _parse_markdown_to_tiptap_nodes(source_text)
            for md_node in markdown_nodes:
                nodes.append(
                    schemas.JupyterImportNode(
                        type=md_node.get('type', 'paragraph'),
                        attrs=md_node.get('attrs'),
                        content=md_node.get('content'),
                    )
                )

    return nodes


@router.post('/import', response_model=schemas.JupyterImportResponse, response_model_exclude_none=True)
async def import_notebook(file: UploadFile = File(...)):
    """
    Parse .ipynb file upload and return TipTap-compatible nodes.

    - Code cells become notebookCell nodes
    - Markdown cells become paragraph nodes with text
    """
    content = await file.read()
    notebook_data = json.loads(content)
    nodes = _parse_notebook_to_nodes(notebook_data)

    return schemas.JupyterImportResponse(
        nodes=nodes,
        filename=file.filename or 'notebook.ipynb',
    )


def _parse_pyproject_dependencies(pyproject_content: str) -> list[str]:
    """Parse pyproject.toml content and extract dependencies."""
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib

    try:
        data = tomllib.loads(pyproject_content)

        dependencies = []

        # PEP 621 format: [project.dependencies]
        if 'project' in data and 'dependencies' in data['project']:
            dependencies.extend(data['project']['dependencies'])

        # Poetry format: [tool.poetry.dependencies]
        if 'tool' in data and 'poetry' in data['tool']:
            poetry_deps = data['tool']['poetry'].get('dependencies', {})
            for pkg, version in poetry_deps.items():
                if pkg.lower() == 'python':
                    continue
                if isinstance(version, str):
                    dependencies.append(
                        f'{pkg}{version}' if version.startswith('^') or version.startswith('~') else pkg
                    )
                elif isinstance(version, dict):
                    dependencies.append(pkg)
                else:
                    dependencies.append(pkg)

        # Optional dependencies
        if 'project' in data and 'optional-dependencies' in data['project']:
            for group_deps in data['project']['optional-dependencies'].values():
                dependencies.extend(group_deps)

        return dependencies
    except Exception:
        return []


@router.post('/import-url', response_model=schemas.JupyterImportResponse, response_model_exclude_none=True)
async def import_notebook_from_url(
    request: schemas.JupyterImportUrlRequest,
    db: Session = Depends(get_db),
    bridge: JupyterBridge = Depends(get_jupyter_bridge),
):
    """
    Fetch .ipynb from URL and return TipTap-compatible nodes.

    Supports:
    - Direct .ipynb URLs
    - GitHub blob URLs (automatically converted to raw)
    - GitHub raw URLs
    - Optional pyproject.toml URL for installing dependencies
    """
    url = request.url.strip()

    # Convert GitHub blob URLs to raw URLs
    if 'github.com' in url and '/blob/' in url:
        url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail=f'Invalid notebook URL. Make sure it starts with http:// or https:// (got: {url[:50]}...)',
        )

    try:
        # Add User-Agent header - GitHub blocks requests without it
        headers = {
            'User-Agent': 'TrackTheThing/1.0 (Jupyter Notebook Importer)',
            'Accept': 'application/json, text/plain, */*',
        }
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        notebook_data = response.json()
    except requests.Timeout:
        raise HTTPException(status_code=400, detail='Request timed out. Try again or use a different URL.')
    except requests.ConnectionError:
        raise HTTPException(status_code=400, detail='Could not connect to the URL. Check your internet connection.')
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=400, detail='Notebook not found at this URL.')
        elif e.response.status_code == 403:
            raise HTTPException(status_code=400, detail='Access denied. The notebook may be private.')
        raise HTTPException(status_code=400, detail=f'Failed to fetch notebook: HTTP {e.response.status_code}')
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f'Failed to fetch notebook: {e}')
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400, detail='URL does not contain valid JSON. Make sure it points to a .ipynb file.'
        )

    # Validate it's a notebook
    if 'cells' not in notebook_data:
        raise HTTPException(
            status_code=400,
            detail='URL does not contain a valid Jupyter notebook (missing "cells" field).',
        )

    # Handle pyproject.toml if provided
    dependencies_installed = []
    if request.pyproject_url and request.pyproject_url.strip():
        pyproject_url = request.pyproject_url.strip()

        # Validate pyproject URL
        pyproject_parsed = urlparse(pyproject_url)
        if not pyproject_parsed.scheme or not pyproject_parsed.netloc:
            # Log warning but don't fail
            print(f'Warning: Invalid pyproject.toml URL, skipping: {pyproject_url}')
        else:
            # Convert GitHub blob URLs to raw URLs
            if 'github.com' in pyproject_url and '/blob/' in pyproject_url:
                pyproject_url = pyproject_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

            try:
                pyproject_response = requests.get(pyproject_url, timeout=30, headers=headers)
                pyproject_response.raise_for_status()
                pyproject_content = pyproject_response.text

                dependencies = _parse_pyproject_dependencies(pyproject_content)

                if dependencies and bridge.is_container_running():
                    # Install dependencies in the Jupyter container
                    pip_install_code = f'import subprocess; subprocess.run(["pip", "install", "-q", {", ".join(repr(d) for d in dependencies)}])'
                    await bridge.execute_code(pip_install_code)
                    dependencies_installed = dependencies

            except Exception as e:
                # Log but don't fail the import
                print(f'Warning: Failed to process pyproject.toml: {e}')

    nodes = _parse_notebook_to_nodes(notebook_data)

    # If dependencies were installed, add an info cell at the top
    if dependencies_installed:
        info_text = f'# Dependencies installed: {", ".join(dependencies_installed[:5])}{"..." if len(dependencies_installed) > 5 else ""}'
        nodes.insert(
            0,
            schemas.JupyterImportNode(
                type='paragraph',
                content=[{'type': 'text', 'text': info_text}],
            ),
        )

    # Extract filename from URL (use the converted raw URL for correct path)
    path = parsed.path
    filename = path.split('/')[-1] if path else 'notebook.ipynb'
    if not filename.endswith('.ipynb'):
        filename = 'notebook.ipynb'

    return schemas.JupyterImportResponse(
        nodes=nodes,
        filename=filename,
    )
