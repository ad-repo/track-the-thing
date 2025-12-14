# Track the Thing 🎯

A focused daily workspace for capturing notes, tasks, and decisions without losing historical context. Track the Thing combines a fast FastAPI backend with a modern React/TypeScript frontend, letting you move seamlessly between daily notes, Kanban boards, reports, and custom UI themes.

---

## Why People Use It

- **Capture everything** – Rich text, code, voice dictation, camera shots, video, uploads, JSON/YAML helpers, and link previews live inside one editor.
- **Organize on your terms** – Daily notes, pinned entries, Trello-style lists, Kanban boards, day labels, and custom emojis stay in sync.
- **Report instantly** – Weekly reports and the Selected Entries Report turn any tagged entry into shareable Markdown.
- **Control the UI** – Built-in themes, custom themes, backgrounds, textures, and condensed display toggles give you a workspace that fits.
- **Deploy anywhere** – Docker, local dev, or the desktop/Tauri build all share the same codebase and backup/restore format.

---

## Tech Stack

| Layer     | Tools |
|-----------|-------|
| Backend   | FastAPI, SQLAlchemy, SQLite, Pydantic, Requests, BeautifulSoup |
| Frontend  | React 18, TypeScript, Vite, Tailwind, TipTap, React Router, Axios, date-fns |
| Desktop   | Tauri shell + PyInstaller sidecar backend (see [`desktop/README-desktop.md`](desktop/README-desktop.md)) |

---

## Getting Started

### Prerequisites
- **Docker** (recommended) OR
- **Python 3.11+** with **Node.js 18+** (for local development)

### 🐳 Docker (Recommended)

```bash
git clone <repo>
cd track-the-thing
docker-compose --env-file .dockerenv up --build -d
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

Data persists in `./backend/data`. Update `.dockerenv` to change ports, database paths, or API URLs.

### 💻 Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### 🖥️ Desktop App (Tauri)

Full desktop documentation: **[`desktop/README-desktop.md`](desktop/README-desktop.md)**

**Quick start:**

```bash
cp .tourienv.example .tourienv            # Configure desktop settings
./desktop/pyinstaller/build_backend.sh    # Build backend sidecar
npm --prefix desktop/tauri run tauri:dev  # Run desktop app
```

**Prerequisites:**
- Node.js 18+ and npm
- Rust toolchain (`rustup`) with `cargo`
- Python 3.11 with `pyinstaller` installed
- macOS Command Line Tools (for macOS builds)

**Installing the DMG on macOS:**

Due to macOS Gatekeeper, you may need to clear the quarantine flag before opening:

```bash
# Before opening DMG
xattr -cr ~/Downloads/Track\ the\ Thing_0.1.0_aarch64.dmg

# If app shows "damaged and can't be opened" after install
xattr -cr /Applications/Track\ the\ Thing.app
```

> **Why?** macOS quarantines files from the internet. Since the app isn't signed with an Apple Developer certificate, the `xattr -cr` command removes the quarantine attribute.

The desktop app uses separate ports and data directories from Docker, so both can run simultaneously.

---

## Project Structure

```
track-the-thing/
├── backend/                 # FastAPI backend
│   ├── app/                 # Main application code
│   │   ├── main.py          # Entry point
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   └── routers/         # API endpoints
│   ├── data/                # SQLite + uploads (Docker volume)
│   └── migrations/          # Database migrations
├── frontend/                # React/TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # State management
│   │   └── hooks/           # Custom hooks
│   └── tests/               # Frontend tests
├── desktop/                 # Desktop app (Tauri + PyInstaller)
│   ├── tauri/               # Tauri shell and assets
│   └── pyinstaller/         # Backend sidecar build
├── tests/                   # Backend + E2E tests
├── .dockerenv               # Docker environment config
├── .tourienv.example        # Desktop environment template
└── docker-compose.yml
```

---

## Key Features

### Capture & Edit
- Daily notes with timeline and optional entry titles
- TipTap rich text editor (headings, task lists, fonts, colors, markdown preview, JSON formatter, YAML validator, link previews)
- Voice dictation, camera capture, and video recording
- Code editor with syntax highlighting
- Entry states: ⭐ important, ✓ completed, 📌 pinned, 📄 add to report, 🔔 reminders

### Organize & Plan
- Labels with emoji support and autocomplete
- Trello-style lists with drag-and-drop
- Kanban board with custom columns and mini-map navigation
- Daily, Sprint, and Quarterly goals with rich text and countdown timers
- Pinned entries that auto-copy to future days

### Report & Share
- Weekly reports (Wednesday-to-Wednesday) with Markdown export
- Selected Entries Report with compact cards
- Global search across entries, lists, and Kanban
- Copy as Markdown or Jira/Confluence format

### Customize
- 30+ built-in themes + custom theme editor
- Custom backgrounds with auto-rotate and tiling
- UI textures (20+ patterns with blend modes)
- Custom emoji upload and management

### AI Integration
- **Send to AI**: Select text and send to OpenAI, Anthropic, or Google Gemini
- **MCP Servers**: Docker-based local AI processing with pattern-based routing
- **Conversation Context**: Maintains conversation history per entry
- **Global Prompt Rules**: Configure system prompts applied to all AI requests
- **Graceful Fallback**: MCP failures automatically fall back to cloud LLMs

---

## Testing

**Run all tests before committing:**

```bash
./test_ci_locally.sh
```

### Test Suites

| Suite | Location | Runner | Tests |
|-------|----------|--------|-------|
| Backend | `tests/backend/` | pytest | 211 |
| Frontend | `frontend/tests/` | vitest | 241 |
| E2E | `tests/e2e/` | Playwright | 106 |

**Individual test commands:**

```bash
# Backend
cd tests/backend && ./run_tests.sh

# Frontend  
cd frontend && npx vitest

# E2E (requires Docker)
./run_all_tests.sh
```

---

## Configuration

### Environment Files

| File | Purpose |
|------|---------|
| `.dockerenv` | Docker deployment config (ports, database, API URLs) |
| `.tourienv` | Desktop app config (separate ports/data from Docker) |
| `backend/.env` | Backend-only settings (local dev) |
| `frontend/.env` | Frontend-only settings (local dev) |

### Application Settings

Configurable in Settings → General:
- **Sprint Goal Name**: Customize "Sprint" label
- **Daily Goal End Time**: Set countdown timer endpoint
- **Emoji Library**: Choose picker component
- **Goal Visibility**: Toggle Daily/Sprint/Quarterly goals
- **Timezone**: Default Eastern US (America/New_York)

---

## Backup & Restore

1. Go to **Settings → Management**
2. **Backup**: Download JSON with all data + ZIP with uploads
3. **Restore**: Import from previous backup

> ⚠️ JSON backups from before v7.0 don't include list/Kanban metadata. Keep a copy of `track_the_thing.db` when upgrading older deployments.

---

## API Documentation

Interactive API docs available at `http://localhost:8000/docs` when the backend is running.

Key endpoint groups:
- `/api/notes/` – Daily notes CRUD
- `/api/entries/` – Note entries management
- `/api/labels/` – Label operations
- `/api/lists/` – List management
- `/api/search/` – Global search
- `/api/backup/` – Export/import operations
- `/api/uploads/` – File uploads
- `/api/llm/` – LLM integration and AI chat
- `/api/mcp/` – MCP server management and routing

---

## License

This project is open source and available under the MIT License.

---

**Track the Thing! 🎯✨**
