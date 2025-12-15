# Track the Thing 🎯

A focused daily workspace for capturing notes, tasks, and decisions without losing historical context. Track the Thing combines a fast FastAPI backend with a modern React/TypeScript frontend, letting you move seamlessly between daily notes, Kanban boards, reports, and custom UI themes.

---

## Why People Use It

- **Capture everything** – Rich text, code blocks, voice dictation, camera/video capture, file uploads, JSON/YAML tools, and link previews in one editor.
- **Run code inline** – Jupyter notebook cells execute Python directly in your notes. Import and export `.ipynb` files.
- **AI-assisted editing** – Send selected text to OpenAI, Anthropic, or Gemini. Route queries to local MCP servers with pattern matching.
- **Organize on your terms** – Daily notes, pinned entries, Trello-style lists, Kanban boards, labels, reminders, and custom emojis.
- **Report instantly** – Weekly reports and Selected Entries Report export tagged content to Markdown or Jira format.
- **Control the UI** – 30+ themes, custom backgrounds, textures, and display toggles for a workspace that fits.
- **Own your data** – SQLite database and local storage keep notes on your machine. Full JSON backup/restore.
- **Deploy anywhere** – Docker, local dev, or desktop app share the same codebase and data format.

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

**Prerequisites (macOS):**

| Dependency | Install Command |
|------------|-----------------|
| Node.js 18+ | `brew install node` |
| Rust toolchain | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Python 3.11+ | `brew install python@3.11` |
| PyInstaller | `pip3 install pyinstaller` |
| Xcode CLI Tools | `xcode-select --install` |

**Build the desktop app:**

```bash
cp .tourienv.example .tourienv    # Configure desktop settings
./scripts/build-desktop-macos.sh  # Build complete macOS app (.app + .dmg)
```

The build script automatically:
- Validates all dependencies
- Builds the backend sidecar (PyInstaller)
- Builds the frontend (Vite)
- Packages the Tauri desktop bundle

**Development mode:**

```bash
cp .tourienv.example .tourienv                # Configure settings
./desktop/pyinstaller/build_backend.sh        # Build backend sidecar
npm --prefix desktop/tauri run tauri:dev      # Run with hot reload
```

**Installing the DMG on macOS:**

Due to macOS Gatekeeper, clear the quarantine flag before opening:

```bash
# Before opening DMG
xattr -cr ~/Downloads/Track\ the\ Thing_*.dmg

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

### Editor Toolbar Reference

The rich text editor toolbar uses [Lucide icons](https://lucide.dev/), organized by function:

| Icon | Name | Description |
|:-----|:-----|:------------|
| ↶ ↷ | Undo / Redo | History navigation |
| **B** | Bold | Bold text |
| *I* | Italic | Italic text |
| ~~S~~ | Strikethrough | Strikethrough text |
| ■ | Text Color | Color picker |
| T | Font Family | 14 font choices (Type icon) |
| Aa | Font Size | 10px–72px (CaseSensitive icon) |
| H₁ | Headings | H1–H6 + Normal (Heading1 icon) |
| „ | Block Quote | Indented quote (Quote icon) |
| ≡ | Bullet List | Unordered list (List icon) |
| 1≡ | Numbered List | Ordered list (ListOrdered icon) |
| ☐ | Task List | Checkboxes (CheckSquare icon) |
| </> | Inline Code | Monospace text (Code icon) |
| {/} | Code Block | Syntax highlighted (Code2 icon) |
| ☰ | Preformatted | Preserve whitespace (FileText icon) |
| 🔗 | Link | Add hyperlink (Link2 icon) |
| ↗ | Link Preview | Rich preview card (ExternalLink icon) |
| 🖼 | Image | Upload image (Image icon) |
| 📎 | Attach File | Upload any file (Paperclip icon) |
| 😊 | Emoji | Unicode + custom emoji picker |
| 🎤 | Voice Dictation | Speech-to-text (Mic icon) |
| 📷 | Camera | Capture photo (Camera icon) |
| 🎥 | Video | Record video (Video icon) |
| ✦ | Send to AI | Route to LLM/MCP (Sparkles icon) |
| ⟨⟩ | Jupyter Cell | Insert Python cell (FileCode icon) |
| ↑ | Import Notebook | Load `.ipynb` from file or URL (Upload icon) |
| ↓ | Export Notebook | Save `.ipynb` (Download icon) |
| **M** | Markdown Preview | Render markdown |
| **J** | JSON Format | Prettify and validate |
| **Y** | YAML Validate | Check syntax |
| ⤢ | Expand/Collapse | Toggle editor size (Maximize2 icon) |

### Entry Cards

Each note entry supports these states and actions:

| Icon | State/Action |
|------|--------------|
| ⭐ | Important (highlights entry) |
| ✓ | Completed (strikethrough) |
| 📌 | Pinned (auto-copies to future days) |
| 📄 | Include in Report |
| 🔔 | Reminder (date/time notification) |
| 🏷️ | Labels (tags with colors and emojis) |
| 📋 | Add to List |

### Organization
- **Daily Notes**: Timeline view with fire rating and daily goals
- **Labels**: Color-coded tags with emoji support and autocomplete
- **Lists**: Trello-style collections with drag-and-drop ordering
- **Kanban Board**: Custom columns with mini-map navigation
- **Goals**: Daily, Sprint, Quarterly, and custom goal types with countdown timers

### Reporting
- **Weekly Reports**: Wednesday-to-Wednesday with Markdown export
- **Selected Entries Report**: Compact cards for flagged entries
- **Global Search**: Search across entries, lists, and Kanban
- **Copy Formats**: Markdown or Jira/Confluence format

### Customization
- **Themes**: 30+ built-in themes + custom theme editor
- **Backgrounds**: Custom images with auto-rotate and tiling
- **Textures**: 20+ UI patterns with blend modes
- **Custom Emojis**: Upload and manage custom emoji images

### AI Integration
- **LLM Providers**: OpenAI, Anthropic, or Google Gemini
- **MCP Servers**: Docker-based or remote AI processing with regex routing
- **Conversation Context**: Maintains history per entry
- **Global Prompts**: System prompts applied to all AI requests
- **Fallback**: MCP failures automatically use cloud LLMs

### Jupyter Notebooks
- **Insert Cells**: Add executable Python cells inline with notes
- **Run Code**: Execute code with Shift+Enter, view outputs inline
- **Import**: Load `.ipynb` from file upload or URL (supports GitHub links)
- **Export**: Save editor content as `.ipynb` notebook

### MCP Server Configuration

MCP (Model Context Protocol) servers provide specialized AI processing. Configure in **Settings → MCP Servers**.

**Server Types:**

| Type | Transport | Use Case |
|------|-----------|----------|
| Docker (HTTP) | HTTP | Servers exposing HTTP endpoints (requires port) |
| Docker (STDIO) | stdin/stdout | Servers using stdio protocol (e.g., Brave Search) |
| Remote | HTTP | External MCP servers (no Docker required) |

**Image Sources:**

- **Pre-built Image**: Docker Hub image (e.g., `mcp/brave-search`)
- **Build from Dockerfile**: GitHub URL or local path
  - Example: `https://github.com/nickclyde/duckduckgo-mcp-server/blob/main/Dockerfile`

**Routing Rules:**

Each server can have regex patterns that route matching text selections:
- Pattern: `(?i)search|find|look up` → Routes search queries to a search MCP
- Priority: Higher priority rules match first
- Colors: Each server has a unique color shown on the AI button when matched

**Requirements:**
- Docker Desktop must be running for Docker-based servers
- STDIO servers don't require exposed ports
- Remote servers only need a URL and optional auth headers

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

### AI Settings (Settings → AI)

- **LLM Provider**: OpenAI, Anthropic, or Google Gemini
- **API Keys**: Store your provider API keys
- **Global Prompt**: System prompt applied to all AI requests
- **MCP Enabled**: Toggle local MCP server processing
- **MCP Idle Timeout**: Auto-stop idle Docker containers
- **Fallback to LLM**: Use cloud LLM when MCP fails

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
- `/api/jupyter/` – Jupyter kernel execution, notebook import/export

---

## License

This project is open source and available under the MIT License.

---

**Track the Thing! 🎯✨**
