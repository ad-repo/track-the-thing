#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${REPO_ROOT}/.tourienv" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.tourienv"
  set +a
fi

"${SCRIPT_DIR}/sync_assets.sh"

export VITE_API_URL="http://${TAURI_BACKEND_HOST:-127.0.0.1}:${TAURI_BACKEND_PORT:-18765}"
echo "VITE_API_URL=${VITE_API_URL}"

cd "${REPO_ROOT}"
npm --prefix frontend install
exec npm --prefix frontend run build

