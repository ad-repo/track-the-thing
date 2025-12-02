# Track the Thing Desktop (Tauri)

This folder holds everything required to ship Track the Thing as a native
desktop application using [Tauri 2.x](https://tauri.app/start/) with the
existing React/Vite frontend and FastAPI backend. The desktop bundle embeds
the backend (via a PyInstaller-frozen binary) and serves the production React
build inside a Tauri window so users are unaware that a browser engine is
involved.

> Why Tauri + PyInstaller? Tauri keeps the UI lightweight by reusing the
> system webview, while PyInstaller produces a self-contained binary for the
> FastAPI backend so we can launch it as a managed “sidecar” process from the
> Tauri runtime. This combination keeps deployments small and avoids
> requiring Docker or Python on end-user machines.

## Directory layout

```
desktop/
├── README-desktop.md        # This file
├── pyinstaller/             # PyInstaller spec + helper scripts
│   └── dist/                # Frozen backend binary output (ignored)
└── tauri/                   # Tauri app scaffold (Rust + config)
    ├── src-tauri/           # Rust commands, splash, icons, sidecar glue
    └── dist/                # Final desktop bundles, per-platform (ignored)
```

Future commits populate `pyinstaller/` and `tauri/` with the actual toolchain.

## Environment configuration (`.tourienv`)

All desktop-specific settings live in a root-level `.tourienv` file (ignored by
git). Copy `.tourienv.example` to `.tourienv` and adjust the values before
running any of the desktop scripts.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `TAURI_BACKEND_HOST` / `TAURI_BACKEND_PORT` | Loopback host & port for the packaged FastAPI server | Defaults avoid the Docker ports (`8000/8001`) so both stacks can run simultaneously. |
| `TAURI_DESKTOP_DATA_DIR` | Base directory for desktop-only data | **Required** in production. Choose an OS-specific app-data path. App fails explicitly if home directory cannot be resolved (no fallback). |
| `TAURI_DATABASE_PATH`, `TAURI_UPLOADS_DIR`, `TAURI_STATIC_DIR` | Concrete locations for SQLite DB, uploads, and extracted assets | Derived from `TAURI_DESKTOP_DATA_DIR` by default. |
| `TAURI_WINDOW_HEIGHT_RATIO`, `TAURI_WINDOW_WIDTH`, `TAURI_WINDOW_MAXIMIZED` | Initial window sizing rules | Default is maximized (`true`). The Rust bootstrapper uses physical pixels and enforces the requested height ratio (~85%) if not maximized. |
| `TAURI_SPLASH_MIN_VISIBLE_MS` | Minimum splash duration | Ensures users see a branded splash while the backend warms up. |
| `PYINSTALLER_ENTRYPOINT` | Command frozen by PyInstaller | Typically `python3 backend/desktop_launcher.py`. |
| `TAURI_BACKEND_LOG` | Path where backend stdout/stderr are redirected | Useful for debugging without polluting system logs. |

Keep `.tourienv` secrets local—only `.tourienv.example` is versioned.

## Data isolation vs Docker

| Concern | Docker Deployment | Desktop Deployment |
| --- | --- | --- |
| Database path | `./backend/data/track_the_thing.db` (mounted volume) | `TAURI_DATABASE_PATH` (defaults to `~/Library/Application Support/TrackTheThingDesktop/ttt_desktop.db`) |
| Uploads | `./backend/data/uploads/` | `TAURI_UPLOADS_DIR` |
| Ports | 3000/8000 (frontend/backend) | `TAURI_BACKEND_PORT` (default `18765`) served inside Tauri webview |
| Runtime | Containers orchestrated via `docker-compose` | Tauri shell launches PyInstaller sidecar |

Because the desktop defaults never touch `./backend/data` or the Compose
ports, you can run Docker and Tauri builds at the same time on the same
machine without collisions.

## Workflow (high level)

1. **Sync Tauri assets into the frontend bundle.** The helper script
   `desktop/tauri/scripts/sync_assets.sh` copies everything in
   `desktop/tauri/assets/` (logo + splash markup) into
   `frontend/public/desktop/` right before each dev session or production
   build.
2. **Build or serve the frontend.** Tauri’s `beforeDevCommand` /
   `beforeBuildCommand` run the scripts in `desktop/tauri/scripts/` to launch
   `npm run dev` (on port 5174) or `npm run build` with `VITE_API_URL`
   pointing at the desktop backend host:port.
3. **Build the backend sidecar** via
   `desktop/pyinstaller/build_backend.sh`. The PyInstaller output is copied
   into `desktop/tauri/src-tauri/bin/<platform>/track-the-thing-backend/`
   where Tauri expects sidecars.
4. **Run the Tauri dev server or bundle** (`npm run tauri:dev` /
   `npm run tauri:build`). The Rust bootstrapper spawns the backend (sidecar 
   or directly via Python), polls `/health`, then opens the main window. 
   The React app displays a splash overlay component while the backend is 
   initializing, which automatically fades out once ready.

### Commands

```bash
# Build the backend executable (macOS host)
./desktop/pyinstaller/build_backend.sh

# Run the desktop shell with the live Vite dev server
npm --prefix desktop/tauri run tauri:dev

# Produce a signed bundle (DMG, app bundle, etc.)
npm --prefix desktop/tauri run tauri:build
```

## Installing the Desktop App (macOS)

### From DMG

1. Download the DMG file (e.g., `Track the Thing_0.1.0_aarch64.dmg`)
2. **Important:** Before opening the DMG, you may need to clear the macOS quarantine flag:
   ```bash
   xattr -cr ~/Downloads/Track\ the\ Thing_0.1.0_aarch64.dmg
   ```
3. Double-click the DMG to mount it
4. Drag "Track the Thing" to your Applications folder
5. If you see "app is damaged and can't be opened", run:
   ```bash
   xattr -cr /Applications/Track\ the\ Thing.app
   ```
6. Launch the app from Applications

> **Why is this needed?** macOS Gatekeeper quarantines files downloaded from the internet. 
> Since the app isn't signed with an Apple Developer certificate, macOS blocks it by default.
> The `xattr -cr` command removes the quarantine attribute so the app can run.

> **Tip:** Whenever you replace `desktop/tauri/assets/track-the-thing-logo.png`
> with the official logo, re-run
> `cd desktop/tauri && npx tauri icon ./assets/track-the-thing-logo.png`
> so the toolbar/system icons update across platforms.

### Asset flow

```
desktop/tauri/assets/
 └── track-the-thing-logo.png      # Source for splash screen logo

desktop/tauri/scripts/sync_assets.sh
   ↳ Copies assets into frontend/public/desktop/ before each build/dev run
frontend/public/desktop/
 └── track-the-thing-logo.png
 
frontend/src/components/SplashScreen.tsx  # React splash overlay component

### Brand assets & icons

The desktop app uses different logo assets for different purposes:

- **Desktop Icons** (dock, file icons, `.icns`/`.ico`): Uses `frontend/public/logo.png` (full logo with text)
- **Navigation Header**: Uses `frontend/public/logo.svg` (vector SVG, theme-aware)
- **Splash Screen**: Uses `desktop/tauri/assets/track-the-thing-logo.png`

To update desktop icons:

1. Update `frontend/public/logo.png` with the new branding
2. Run `cd desktop/tauri && npx tauri icon ../../frontend/public/logo.png`
3. This regenerates all platform icons in `src-tauri/icons/` (`.icns`, `.ico`, etc.)

The navigation logo and splash screen logo can be updated independently as needed.
```
Detailed commands, scripts, and CI hooks will land alongside the actual
PyInstaller and Tauri scaffolding in the next steps.

