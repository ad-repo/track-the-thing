"""
API routes for Jupyter notebook integration
"""

import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends
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
