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
- MCP servers: `backend/app/routers/mcp.py`, `backend/app/services/docker_bridge.py`
- LLM integration: `backend/app/routers/llm.py`

## MCP (Model Context Protocol) Integration
The app supports Docker-based MCP servers for local AI processing:
- MCP servers are configured in Settings → MCP Servers
- Text selections are routed to MCP servers based on regex patterns
- Falls back to cloud LLM providers when MCP unavailable
- Requires Docker to be running for container management

**See `.cursorrules` for complete rules.**
