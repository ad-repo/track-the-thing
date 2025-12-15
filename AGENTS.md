# AI Agent Guide - Track the Thing

**Rules are in `.cursor/rules/*.mdc`** - context-specific rules auto-apply based on file globs.

## Golden Rules
1. Never break working code
2. Follow existing patterns (search first)
3. Run `./test_ci_locally.sh` before every commit
4. Never change code to fix tests

## Project Structure
```
backend/           # Python/FastAPI API
frontend/          # React/TypeScript UI  
tests/             # All tests (backend/, e2e/)
desktop/           # Tauri desktop app
.cursor/rules/     # AI rules (auto-applied by file type)
```

## Key Scripts
- `./test_ci_locally.sh` - Run before committing (required)
- `./run_all_tests.sh` - Full test suite (containerized)

## Quick Reference
| Area | Location |
|------|----------|
| Migrations | `backend/migrations/` |
| Backup/restore | `backend/app/routers/backup.py` |
| MCP servers | `backend/app/routers/mcp.py`, `backend/app/services/docker_bridge.py` |
| Jupyter | `backend/app/routers/jupyter.py`, `backend/app/services/jupyter_bridge.py` |
| LLM | `backend/app/routers/llm.py` |
| Theme colors | Use `var(--color-*)`, never hardcode |

## Rule Files
- `project.mdc` - Core rules (always applied)
- `backend.mdc` - Python/FastAPI (applied to `backend/**/*.py`)
- `frontend.mdc` - React/TypeScript (applied to `frontend/**/*.{ts,tsx}`)
- `testing.mdc` - Testing patterns (applied to `tests/**`)
- `database.mdc` - Migrations (applied to models/migrations)
