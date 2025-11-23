#!/bin/bash
set -e
echo "Running ruff linter..."
ruff check app/ ../tests/backend/
echo "Running ruff formatter check..."
ruff format --check app/ ../tests/backend/

