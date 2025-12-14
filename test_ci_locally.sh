#!/bin/bash
set -euo pipefail

COMPOSE_CMD="docker-compose --env-file .dockerenv"
source ./.dockerenv

echo "=========================================="
echo "Testing EXACTLY like CI (containerized)"
echo "=========================================="

echo ""
echo "1. Backend Linting..."
$COMPOSE_CMD run --rm backend sh -c "chmod +x run_lint.sh && ./run_lint.sh"

echo ""
echo "2. Frontend Linting + TypeScript..."
$COMPOSE_CMD run --rm frontend sh -c '
  set -e
  npm ci --legacy-peer-deps
  ARCH=$(uname -m)
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ROLLUP_PKG=@rollup/rollup-linux-arm64-musl
  else
    ROLLUP_PKG=@rollup/rollup-linux-x64-gnu
  fi
  npm install --no-save --legacy-peer-deps "$ROLLUP_PKG" || npm install --no-save --legacy-peer-deps @rollup/rollup-linux-x64-gnu
  npm run lint
  npx tsc --noEmit
'

echo ""
echo "3. Backend Tests..."
$COMPOSE_CMD run --rm backend-test

echo ""
echo "4. Frontend Tests..."
$COMPOSE_CMD run --rm frontend-test

#echo ""
#echo "5. E2E Tests..."
#$COMPOSE_CMD --profile e2e up -d backend-e2e frontend-e2e >/dev/null
# # Wait for services to be reachable before running Playwright
# for url in "${E2E_API_URL:-http://localhost:8001}/docs" "${E2E_BASE_URL:-http://localhost:3001}"; do
#   echo "Waiting for $url ..."
#   for i in {1..60}; do
#     if curl -sSf "$url" >/dev/null 2>&1; then
#       echo "✓ $url is up"
#       break
#     fi
#     sleep 1
#   done
# done

# E2E_EXIT=0
# $COMPOSE_CMD --profile e2e run --rm e2e npx playwright test --grep-invert "media-features" || E2E_EXIT=$?
# $COMPOSE_CMD --profile e2e down >/dev/null || true
# if [ $E2E_EXIT -ne 0 ]; then
#   exit $E2E_EXIT
# fi

echo ""
echo "=========================================="
echo "✅ All CI checks passed via Docker!"
echo "=========================================="
