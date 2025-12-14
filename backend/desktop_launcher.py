"""
Local entrypoint used by the Tauri desktop build.

This script mirrors backend/start.sh but is pure Python so it can be frozen
with PyInstaller. It is responsible for:

1. Reading desktop-specific configuration from environment variables
   (populated via `.tourienv`).
2. Ensuring the desktop data directories exist and pointing DATABASE_URL at
   a desktop-only SQLite file so Docker deployments remain untouched.
3. Running database initialization + migrations.
4. Starting uvicorn bound to the requested loopback host/port.
"""

from __future__ import annotations

import logging
import os
import signal
import sys
from pathlib import Path

import uvicorn


def _expand(path_value: str) -> Path:
    """Expand ~ and environment variables for a filesystem path."""
    expanded = os.path.expandvars(os.path.expanduser(path_value.strip('"').strip("'")))
    return Path(expanded).resolve()


def _configure_logging(log_path: str | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    if log_path:
        log_file = _expand(log_path)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def _prepare_environment() -> tuple[str, str]:
    host = os.getenv("TAURI_BACKEND_HOST", "127.0.0.1")
    port = os.getenv("TAURI_BACKEND_PORT", "18765")
    data_dir = os.getenv("TAURI_DESKTOP_DATA_DIR")
    uploads_dir = os.getenv("TAURI_UPLOADS_DIR")
    static_dir = os.getenv("TAURI_STATIC_DIR")
    db_path = os.getenv("TAURI_DATABASE_PATH")

    # CRITICAL: Fail immediately if required configuration is missing
    # This backend should only run when launched by Tauri with .tourienv loaded
    if not data_dir:
        logging.error("FATAL: TAURI_DESKTOP_DATA_DIR environment variable is not set.")
        logging.error("This backend must be launched by the Tauri desktop app, not directly.")
        logging.error("The Tauri app loads configuration from .tourienv before spawning the backend.")
        logging.error("")
        logging.error("If you need to run the backend standalone for testing:")
        logging.error("  1. Copy .tourienv.example to .tourienv")
        logging.error("  2. Customize the settings in .tourienv")
        logging.error("  3. Load .tourienv: source .tourienv (bash/zsh) or set the vars manually")
        logging.error("  4. Then run: python3 backend/desktop_launcher.py")
        sys.exit(1)

    data_path = _expand(data_dir)
    data_path.mkdir(parents=True, exist_ok=True)

    resolved_db_path: Path
    if db_path:
        resolved_db_path = _expand(db_path)
    else:
        resolved_db_path = data_path / "ttt_desktop.db"

    resolved_db_path.parent.mkdir(parents=True, exist_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{resolved_db_path}"
    logging.info("Desktop data directory: %s", data_path)
    logging.info("SQLite database path: %s", resolved_db_path)

    if uploads_dir:
        resolved_uploads = _expand(uploads_dir)
    else:
        resolved_uploads = data_path / "uploads"
    resolved_uploads.mkdir(parents=True, exist_ok=True)
    os.environ["UPLOADS_DIR"] = str(resolved_uploads)

    if static_dir:
        resolved_static = _expand(static_dir)
    else:
        resolved_static = data_path / "static"
    resolved_static.mkdir(parents=True, exist_ok=True)
    os.environ["STATIC_FILES_DIR"] = str(resolved_static)

    return host, port


def main() -> None:
    _configure_logging(os.getenv("TAURI_BACKEND_LOG"))

    host, port = _prepare_environment()

    # Import database-dependent modules only after DATABASE_URL is set
    from app.db_init import ensure_database  # noqa: WPS433
    from migrations import run_migrations  # noqa: WPS433

    logging.info("Starting Track the Thing desktop backend on %s:%s", host, port)

    logging.info("Ensuring SQLite database exists and has default settings")
    ensure_database()

    logging.info("Running migrations")
    migration_rc = run_migrations.main()
    if migration_rc != 0:
        logging.warning("One or more migrations reported issues (code=%s)", migration_rc)

    logging.info("Migrations complete, creating uvicorn server config")

    try:
        server_config = uvicorn.Config(
            "app.main:app",
            host=host,
            port=int(port),
            reload=False,
            log_level="info",
        )
        logging.info("Created uvicorn config successfully")

        server = uvicorn.Server(server_config)
        logging.info("Created uvicorn server successfully")

        # Allow Ctrl+C / SIGTERM to stop uvicorn cleanly when spawned as a sidecar.
        def _handle_signal(signum, frame):  # type: ignore[override]
            logging.info("Received signal %s, shutting down backend", signum)
            server.should_exit = True

        signal.signal(signal.SIGTERM, _handle_signal)
        signal.signal(signal.SIGINT, _handle_signal)
        logging.info("Signal handlers registered, starting uvicorn server")

        server.run()
    except Exception as e:
        logging.error("Fatal error starting uvicorn: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

