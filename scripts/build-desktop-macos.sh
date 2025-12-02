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

# ============================================================
# Pre-build dependency checks
# ============================================================
log "Checking build dependencies..."

MISSING_DEPS=()

# Node.js and npm
if ! command -v node >/dev/null 2>&1; then
  MISSING_DEPS+=("node (Node.js runtime - install via: brew install node)")
else
  NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [[ "$NODE_MAJOR" -lt 18 ]]; then
    abort "Node.js 18+ required, found v${NODE_VERSION}. Update via: brew upgrade node"
  fi
  echo "  ✓ node v${NODE_VERSION}"
fi

if ! command -v npm >/dev/null 2>&1; then
  MISSING_DEPS+=("npm (Node package manager - comes with Node.js)")
else
  echo "  ✓ npm $(npm --version 2>/dev/null)"
fi

# Rust toolchain
if ! command -v rustup >/dev/null 2>&1; then
  MISSING_DEPS+=("rustup (Rust toolchain manager - install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)")
else
  echo "  ✓ rustup $(rustup --version 2>/dev/null | head -1 | awk '{print $2}')"
fi

if ! command -v cargo >/dev/null 2>&1; then
  MISSING_DEPS+=("cargo (Rust package manager - install Rust via rustup)")
else
  echo "  ✓ cargo $(cargo --version 2>/dev/null | awk '{print $2}')"
fi

if ! command -v rustc >/dev/null 2>&1; then
  MISSING_DEPS+=("rustc (Rust compiler - install Rust via rustup)")
else
  echo "  ✓ rustc $(rustc --version 2>/dev/null | awk '{print $2}')"
fi

# Python
if ! command -v python3 >/dev/null 2>&1; then
  MISSING_DEPS+=("python3 (Python 3.11+ - install via: brew install python@3.11)")
else
  PYTHON_VERSION=$(python3 --version 2>/dev/null | awk '{print $2}')
  PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
  PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
  if [[ "$PYTHON_MAJOR" -lt 3 ]] || [[ "$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -lt 11 ]]; then
    abort "Python 3.11+ required, found ${PYTHON_VERSION}. Install via: brew install python@3.11"
  fi
  echo "  ✓ python3 ${PYTHON_VERSION}"
fi

# PyInstaller
if ! command -v pyinstaller >/dev/null 2>&1; then
  MISSING_DEPS+=("pyinstaller (Python app bundler - install via: pip3 install pyinstaller)")
else
  echo "  ✓ pyinstaller $(pyinstaller --version 2>/dev/null)"
fi

# Tauri CLI (checked via npm)
if ! npm --prefix "${PROJECT_ROOT}/desktop/tauri" list @tauri-apps/cli >/dev/null 2>&1; then
  echo "  ⚠ @tauri-apps/cli not installed (will be installed during build)"
else
  TAURI_VERSION=$(npm --prefix "${PROJECT_ROOT}/desktop/tauri" list @tauri-apps/cli 2>/dev/null | grep "@tauri-apps/cli" | sed 's/.*@//')
  echo "  ✓ @tauri-apps/cli ${TAURI_VERSION}"
fi

# macOS Command Line Tools
if ! xcode-select -p >/dev/null 2>&1; then
  MISSING_DEPS+=("Xcode Command Line Tools (install via: xcode-select --install)")
else
  echo "  ✓ Xcode Command Line Tools"
fi

# Check for missing dependencies
if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
  echo ""
  echo "❌ Missing required dependencies:"
  for dep in "${MISSING_DEPS[@]}"; do
    echo "   • $dep"
  done
  echo ""
  abort "Install missing dependencies and try again."
fi

log "✓ All dependencies satisfied"

# ============================================================
# Cleanup running processes
# ============================================================
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

# ============================================================
# Environment and config checks
# ============================================================
if [[ ! -f "${PROJECT_ROOT}/.tourienv" ]]; then
  abort "Missing .tourienv. Copy .tourienv.example and customize desktop settings before building."
fi

# if ! git -C "${PROJECT_ROOT}" diff --quiet --exit-code --stat; then
#   abort "Working tree has tracked changes. Commit or stash them before running the macOS build."
# fi

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

log "Installing Tauri desktop dependencies"
npm --prefix "${PROJECT_ROOT}/desktop/tauri" install

log "Running cargo check to verify the Tauri workspace"
cargo check --manifest-path "${PROJECT_ROOT}/desktop/tauri/src-tauri/Cargo.toml"

log "Building the Tauri desktop bundle (this creates .app and .dmg)"
npm --prefix "${PROJECT_ROOT}/desktop/tauri" run tauri:build

DMG_PATH="${PROJECT_ROOT}/desktop/tauri/src-tauri/target/release/bundle/macos"

log "Build finished. Artefacts:"
ls -1 "${DMG_PATH}" | sed "s/^/   📦 /"

log "macOS desktop bundle successfully created."

