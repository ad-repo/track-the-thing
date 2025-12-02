#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/desktop/pyinstaller/build"
LOG_PREFIX="🏗️ "

log() {
  echo "${LOG_PREFIX}$1"
}

abort() {
  echo "❌ $1" >&2
  exit 1
}

cleanup() {
  rm -rf "${BUILD_DIR}"
}

trap cleanup EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  abort "This packaging script currently supports macOS only."
fi

log "Stopping any running desktop app instances..."
pkill -9 -f "track-the-thing-backend" 2>/dev/null || true
pkill -9 -f "track_the_thing_desktop" 2>/dev/null || true
pkill -9 -f "tauri dev" 2>/dev/null || true
pkill -9 -f "tauri:dev" 2>/dev/null || true
pkill -9 -f "Track the Thing" 2>/dev/null || true
pkill -9 -f "vite.*5174" 2>/dev/null || true
pkill -9 -f "npm.*tauri" 2>/dev/null || true
sleep 2
log "✓ Cleanup complete"

if [[ ! -f "${PROJECT_ROOT}/.tourienv" ]]; then
  abort "Missing .tourienv. Copy .tourienv.example and customize desktop settings before building."
fi

# if ! git -C "${PROJECT_ROOT}" diff --quiet --exit-code --stat; then
#   abort "Working tree has tracked changes. Commit or stash them before running the macOS build."
# fi

for cmd in npm cargo pyinstaller python3; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    abort "Required command '${cmd}' not found in PATH."
  fi
done

set -a
# shellcheck source=/dev/null
source "${PROJECT_ROOT}/.tourienv"
set +a

ASSETS_DIR="${PROJECT_ROOT}/desktop/tauri/assets"
if [[ ! -f "${ASSETS_DIR}/track-the-thing-logo.png" ]]; then
  abort "Missing desktop/tauri/assets/track-the-thing-logo.png. Add the official logo before packaging."
fi

log "Syncing logo assets into frontend/public/desktop"
"${PROJECT_ROOT}/desktop/tauri/scripts/sync_assets.sh"

log "Running frontend production build (populates frontend/dist)"
./desktop/tauri/scripts/run_frontend_build.sh

log "Ensuring backend sidecar is rebuilt via PyInstaller"
"${PROJECT_ROOT}/desktop/pyinstaller/build_backend.sh"

log "Running cargo check to verify the Tauri workspace"
cargo check --manifest-path "${PROJECT_ROOT}/desktop/tauri/src-tauri/Cargo.toml"

log "Building the Tauri desktop bundle (this creates .app and .dmg)"
npm --prefix "${PROJECT_ROOT}/desktop/tauri" run tauri:build

DMG_PATH="${PROJECT_ROOT}/desktop/tauri/src-tauri/target/release/bundle/macos"

log "Build finished. Artefacts:"
ls -1 "${DMG_PATH}" | sed "s/^/   📦 /"

log "macOS desktop bundle successfully created."

