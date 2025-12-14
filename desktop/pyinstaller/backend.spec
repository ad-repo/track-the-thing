# -*- mode: python ; coding: utf-8 -*-

"""
PyInstaller specification for the Track the Thing desktop backend sidecar.

The spec adds the backend folder to PYTHONPATH and bundles the migrations
directory as data so the runtime script can continue to load migration files
via importlib.
"""

from pathlib import Path
import sys


def _spec_path() -> Path:
    candidate = globals().get("__file__")
    if candidate:
        return Path(candidate).resolve()
    if sys.argv and sys.argv[0]:
        return Path(sys.argv[0]).resolve()
    return (Path.cwd() / "desktop/pyinstaller/backend.spec").resolve()


SPEC_FILE = _spec_path()
project_root = SPEC_FILE.parents[2]
backend_root = project_root / "backend"

block_cipher = None

a = Analysis(
    [str(backend_root / "desktop_launcher.py")],
    pathex=[str(backend_root)],
    binaries=[],
    datas=[(str(backend_root / "migrations"), "migrations")],
    hiddenimports=[
        "app",
        "app.main",
        "app.database",
        "app.models",
        "app.schemas",
        "app.db_init",
        "app.routers",
        "app.routers.backup",
        "app.routers.entries",
        "app.routers.goals",
        "app.routers.labels",
        "app.routers.link_preview",
        "app.routers.lists",
        "app.routers.llm",
        "app.routers.mcp",
        "app.routers.notes",
        "app.routers.reminders",
        "app.routers.reports",
        "app.routers.search",
        "app.routers.search_history",
        "app.routers.settings",
        "app.routers.uploads",
        "app.routers.app_settings",
        "app.routers.background_images",
        "app.routers.custom_emojis",
        "app.services",
        "app.services.docker_bridge",
        "app.storage_paths",
        # Docker SDK for MCP container management
        "docker",
        "docker.api",
        "docker.api.client",
        "docker.api.container",
        "docker.api.image",
        "docker.client",
        "docker.models",
        "docker.models.containers",
        "docker.models.images",
        "docker.transport",
        "docker.transport.unixconn",
        "docker.errors",
        "docker.utils",
        "docker.constants",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="track-the-thing-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Enable console for proper stdout/stderr and logging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="track-the-thing-backend",
)

