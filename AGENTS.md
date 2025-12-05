# AI Agent Guide - Track the Thing

**All rules are in `.cursorrules`** - this file provides quick context only.

## Golden Rules
1. Never break working code
2. Follow existing patterns (search first)
3. Run `./test_ci_locally.sh` before every commit
4. Never change code to fix tests

## Project Structure
- `backend/` - Python/FastAPI API
- `frontend/` - React/TypeScript UI
- `tests/` - All tests (backend/, e2e/)
- `desktop/` - Tauri desktop app

## Key Scripts
- `./test_ci_locally.sh` - Run before committing (required)
- `./run_all_tests.sh` - Full test suite (containerized)

## Quick Reference
- Migrations: `backend/migrations/`
- Backup/restore: `backend/app/routers/backup.py`
- Theme colors: Use `var(--color-*)`, never hardcode

**See `.cursorrules` for complete rules.**
