# Track the Thing 🎯

A focused daily workspace for capturing notes, tasks, and decisions without losing historical context. Track the Thing combines a fast FastAPI backend with a modern React/TypeScript frontend, letting you move seamlessly between daily notes, Kanban boards, reports, and custom UI themes.

---

## Why people use it

- **Capture everything** – Rich text, code, voice dictation, camera shots, video, uploads, JSON/YAML helpers, and link previews live inside one editor.
- **Organize on your terms** – Daily notes, pinned entries, Trello-style lists, Kanban boards, day labels, and custom emojis stay in sync.
- **Report instantly** – Weekly reports and the Selected Entries Report turn any tagged entry into shareable Markdown (cards stay compact but can expand inline).
- **Control the UI** – Built-in themes, custom themes, backgrounds, desk-top ready textures, and condensed display toggles give you a workspace that fits.
- **Deploy anywhere** – Docker, local dev, or the upcoming desktop/Tauri build all share the same codebase and backup/restore format.

---

## Core product areas

### Capture & edit
- Daily note view with timeline and optional entry titles.
- TipTap-based rich text editor with headings, task lists, custom fonts, colors, markdown preview, JSON formatter, YAML validator, link previews, inline preview editing, voice dictation (Chrome/Safari), camera, and video recording.
- Code editor and syntax highlighting for dedicated code entries.
- Entry states: ⭐ important, ✓ completed, 📌 pinned (auto-copies forward), 📄 add to report, 🔔 reminders.
- Multi-select + merge, copy as Markdown, copy as Jira/Confluence, continue from previous day.

### Organize & plan
- Labels with emoji support, predictive search, transparent mode, and a full custom emoji pipeline (upload, rename, delete, backed up automatically).
- Lists: Trello-style columns with drag-and-drop, inline creation, pills on cards, global search visibility, and optimistic updates.
- Kanban board: custom columns, drag/drop, quick status dropdown, mini-map navigation, exclusive Kanban status plus multi-list support.
- Goals: Daily, Sprint, and Quarterly goals all use the rich editor, are date-aware, and expose countdown timers. Display toggles sit under Settings → General (now condensed with clearer descriptions).
- Day labels for filtering and timeline context.

### Report & share
- Weekly report generator (Wednesday-to-Wednesday) with copy/export.
- Selected Entries Report displays compact cards with inline expand/collapse, copy buttons, open-in-context, and Markdown export.
- Global search spans entries, lists, Kanban columns, and labels with status filters and history.
- JSON + uploads backup/restore plus Markdown export for LLM workflows.

### Customize the UI
- 30+ built-in themes, custom theme editor with live preview, reset-to-default, and transparent label mode.
- Custom backgrounds with auto-rotate, tiling, and cover modes.
- UI Textures: 20+ patterns, per-element targeting, blend modes, random rotation, live preview, and import/export (Textures + Themes share the same backup pipeline).
- View controls: full-screen mode, timeline toggle, persistent preferences, responsive layout.
- Desktop build (Tauri + PyInstaller sidecar) reuses the same assets and `.tourienv` settings for splash screens and icons.

---

## Tech stack

| Layer     | Tools |
|-----------|-------|
| Backend   | FastAPI, SQLAlchemy, SQLite, Pydantic, Requests, BeautifulSoup |
| Frontend  | React 18, TypeScript, Vite, Tailwind, TipTap, React Router, Axios, date-fns |
| Desktop   | Tauri shell + PyInstaller “sidecar” backend (see `desktop/README-desktop.md`) |

---

## Getting started

### Prerequisites
- Docker & Docker Desktop **or** Python 3.11+ with Node 18+

### Docker (recommended)
```bash
git clone <repo>
cd track-the-thing
docker-compose --env-file .dockerenv up --build -d
```
Services run on `http://localhost:3000` (frontend) and `http://localhost:8000` (API/docs). Data lives in `backend/data`. Update `.dockerenv` to change ports, database paths, or API URLs.

### Desktop build (optional preview)
```bash
cp .tourienv.example .tourienv
./desktop/pyinstaller/build_backend.sh
npm --prefix desktop/tauri run tauri:dev
```
All desktop scripts sit under `desktop/tauri/scripts/` and use separate ports/db names so Docker and Tauri can run simultaneously.

### Local development
```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# frontend
cd frontend
npm install
npm run dev      # launches on http://localhost:3000
```

---

## Project structure (abridged)
```
track-the-thing/
├── backend/
│   ├── app/
│   │   ├── main.py, models.py, schemas.py, database.py
│   │   └── routers/notes.py, entries.py, lists.py, kanban.py, backup.py, search.py, ...
│   ├── data/ (SQLite + uploads)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/components/ (DailyView, CalendarView, NoteEntryCard, RichTextEditor, Lists, Kanban, Reports, Settings, TextureSettings, etc.)
│   ├── src/contexts/ (themes, textures, labels, goals, timezone, transparent labels, sprint name, etc.)
│   ├── src/hooks/ and src/api.ts
│   └── vite.config.ts, package.json
├── desktop/
│   ├── tauri/ (Tauri app, assets, splash, scripts)
│   └── pyinstaller/ (backend sidecar build scripts)
├── docker-compose.yml
├── .dockerenv / .tourienv.examples
└── README.md (you are here)
```

---

## Tips
- JSON backups before v7.0 do not contain list/Kanban metadata—keep a copy of the original `track_the_thing.db` when upgrading.
- `.dockerenv` drives Docker services; `.tourienv` configures the desktop app so the two environments never collide.
- Everything (themes, textures, emojis, attachments) is included in the backup/restore story—run both the JSON and uploads ZIP exports before upgrading or migrating.

Enjoy shipping your day. 📓⚡

### 📝 Note Taking
- **Entry Titles**: Add optional one-line titles to note entries for quick identification
- **Daily View**: Focus on a single day with multiple content entries
- **Rich Text Editor**: Modern WYSIWYG editor powered by TipTap with support for:
  - Text formatting (bold, italic, underline, strikethrough, inline code, subscript, superscript)
  - **Heading Picker**: Single dropdown for H1-H6 and Normal paragraph with visual previews
  - **Task Lists**: Interactive checklists with checkboxes (supports nesting)
  - **Text Color**: Pick any color for your text with color picker
  - **Font Family**: Choose from 14 font options with visual previews (Arial, Times, Courier, Georgia, Verdana, Comic Sans, Impact, Trebuchet, Palatino, Garamond, Tahoma, Lucida, Helvetica, Monospace)
  - **Font Size**: Select from 16 sizes (10px-72px) with visual previews
  - Code blocks with syntax highlighting (multi-line smart conversion)
  - Images and file uploads (with persistent storage)
  - **Voice Dictation**: Real-time speech-to-text with Web Speech API (Safari/Chrome)
  - **Camera Capture**: Take photos directly in the editor
  - **Video Recording**: Record videos with audio directly in the editor
  - **Link Previews**: Automatic metadata fetching with click-to-edit titles/descriptions
  - **Editable Previews**: Click any preview title or description to edit inline
  - Blockquotes and preformatted text
  - **Smart Code Handling**: Multi-line selections automatically become code blocks
  - **Markdown Preview**: Toggle to view rendered markdown (converts editor content to formatted markdown)
  - **JSON Formatter**: Prettify and validate JSON with one click (with error detection)
  - **YAML Validator**: Validate YAML syntax with instant feedback
  - **Organized Toolbar**: Buttons grouped by functionality (History, Text Formatting, Block Formatting, Lists, Code, Insert/Embed, Media Capture, Tools, View)
- **Code Entries**: Dedicated code editor for multi-line code snippets
- **Timeline Navigation**: Visual timeline on the left sidebar for quick entry navigation
- **Entry States**: Mark entries as:
  - ⭐ Important (starred)
  - ✓ Completed
  - 📌 Pinned (auto-copy to future days)
  - 📄 Add to Report (for weekly summaries)

### 🏷️ Organization
- **Labels**: Add text or emoji labels to both days and individual entries
- **Label Deletion**: Remove unused labels from Settings
- **Autocomplete**: Smart label suggestions with predictive text
- **Emoji Labels**: Special rendering for emoji-only labels
- **Transparent Mode**: Toggle between solid or transparent label backgrounds
- **Custom Emoji System**: Advanced emoji management with multiple options
  - **Dual Library Support**: Choose between `emoji-picker-react` or `emoji-mart` in Settings
  - **Custom Emoji Upload**: Upload your own emoji images (PNG, JPG, GIF, WebP)
  - **Automatic Resizing**: Uploaded emojis are automatically resized to 64x64 pixels
  - **Emoji Management**: View, rename, and delete custom emojis from Settings
  - **Global Availability**: Custom emojis work everywhere - rich text editor, labels, and all text inputs
  - **Image Display**: Custom emojis render as inline images, not text
  - **Searchable by Name**: Find custom emojis quickly by their names
  - **Persistent Storage**: Custom emojis saved to database and included in backups
- **Lists**: Trello-style boards for organizing note entries
  - Create custom lists with names, descriptions, and colors
  - Add labels to lists for categorization and filtering
  - **Inline List Selector**: Add entries to lists with dropdown interface
  - **Create Lists on the Fly**: Create new lists directly from the entry card
  - **Visual List Pills**: See all associated lists with colored badges
  - Drag note entries between lists for organization
  - Entries can belong to multiple lists simultaneously
  - Archive/restore lists as needed
  - Horizontal scrolling column layout (Trello-style)
  - Each list tracks entry count
  - Lists are independent of dates (persistent organization)
  - Navigate from list entries back to their daily note
  - Create new entries directly from list view
  - Search and filter by lists and labels
  - **Optimistic UI Updates**: Instant feedback when adding/removing from lists
- **Kanban Board**: Workflow state management with visual columns
  - **One-Click Initialize**: Create default columns (To Do, In Progress, Done)
  - **Custom Columns**: Add your own workflow states with custom names and colors
  - **Drag-and-Drop**: Reorder columns to match your workflow
  - **Horizontal Scrolling**: Navigate between columns with smooth scrolling
  - **Mini-Map Navigation**: Quick jump to any column with visual indicators
  - **Status Selector on Cards**: Click the Kanban status badge on any card to open a dropdown and change its status
  - **Quick Status Changes**: Move entries between Kanban columns without drag-and-drop
  - **Smooth Transitions**: Status changes include loading indicators and smooth page updates
  - **Reuses Existing Infrastructure**: Kanban columns are special lists (is_kanban flag)
  - **Separate from Lists**: Regular lists and Kanban boards are kept separate
  - **Full Entry Support**: All entry features work in Kanban (labels, completion, etc.)
  - **Create Entries**: Add new tasks directly from any Kanban column
  - **⚠️ Exclusive Kanban Status**: Entries can only be in ONE Kanban column at a time (moving to a new column automatically removes from the old one)
  - **Multi-List Support**: Entries can be in ONE Kanban column AND multiple regular lists simultaneously (the two systems are independent)
- **Pinned Entries**: Auto-copy important entries to future days
  - Pin any card to have it automatically appear on all future days
  - Perfect for recurring tasks, daily reminders, or ongoing work
  - Completion status resets each day
  - Labels and list associations are preserved
  - Multiple cards can be pinned simultaneously
  - Unpin at any time to stop copying forward
  - **⚠️ Smart Deletion**: Deleting any copy of a pinned entry automatically unpins ALL copies to prevent the entry from reappearing
- **Daily Goals**: Set goals for each day (visible as tooltips in calendar)
  - **Rich Text Editor**: Full formatting support (bold, italic, underline, strikethrough, headings, lists, task lists with checkboxes, links, code, blockquotes)
  - **Scrollable**: Goals scroll when content exceeds 300px height
  - **Save Button**: Explicit save button for confident editing
  - **HTML Display**: Goals render with proper formatting in display mode
  - Toggle visibility in Settings → General
  - Click-to-edit with automatic save
  - **⚠️ Daily Countdown**: Shows time remaining until end-of-day (configurable in Settings, default 5 PM)
- **Sprint Goals**: Date-aware goal tracking with historical support
  - **Rich Text Editor**: Full formatting support (bold, italic, underline, strikethrough, headings, lists, task lists with checkboxes, links, code, blockquotes)
  - **Scrollable**: Goals scroll when content exceeds 300px height
  - **Save Button**: Explicit save button for confident editing
  - **All fields always editable**: Edit goal text, start date, and end date at any time
  - **HTML Display**: Goals render with proper formatting in display mode
  - Automatically shows the correct goal for the date being viewed
  - Shows upcoming goals with "X days until start" countdown
  - Create goals with specific start/end dates
  - Days remaining calculated from viewed date, not today
  - Full history - see different goals when browsing different dates
  - Toggle visibility in Settings → General
  - **⚠️ Overlapping Goals Allowed**: Multiple sprint goals can have overlapping date ranges (overlap validation removed)
  - **Customizable Name**: Change "Sprint" to any term you prefer (e.g., "Iteration", "Cycle") in Settings → General
- **Quarterly Goals**: Date-aware quarterly objectives with historical tracking
  - **Rich Text Editor**: Full formatting support (bold, italic, underline, strikethrough, headings, lists, task lists with checkboxes, links, code, blockquotes)
  - **Scrollable**: Goals scroll when content exceeds 300px height
  - **Save Button**: Explicit save button for confident editing
  - **All fields always editable**: Edit goal text, start date, and end date at any time
  - **HTML Display**: Goals render with proper formatting in display mode
  - Same powerful features as Sprint Goals
  - Shows upcoming goals before they start
  - Separate goal history for quarterly planning
  - Toggle visibility in Settings → General
  - **⚠️ Overlapping Goals Allowed**: Multiple quarterly goals can have overlapping date ranges (overlap validation removed)
- **Day Labels**: Organize days with labels for quick filtering (displayed above goals)
  - Toggle visibility in Settings → General

### 📅 Calendar & Visualization
- **Calendar View**: Visual overview with animated indicators (multiple can show):
  - ⭐ Yellow glowing star: Has important entries
  - ✓ Green bouncing checkmark: Has completed entries
  - • Blue dot: Has regular notes (only if no other states)
  - 🔔 Bell: Has reminders set for this date
  - 🚀 Rocket: Sprint Goal active on this date
  - 🌟 Star: Quarterly Goal active on this date
- **Smart Tooltips**: Hover over any date to see daily goals, sprint goals, quarterly goals, reminder count, and entry count
- **Month Navigation**: Browse notes by month
- **Today Button**: Quick jump to current day (shows day name)
- **Timezone Support**: Display times in your preferred timezone (Eastern US by default)
- **Upcoming Reminders**: View all pending reminders on the Calendar page with dates, times, and quick actions

### 📊 Reports
- **Weekly Reports**: Generate Wednesday-to-Wednesday reports
  - Organized by Completed and In Progress sections
  - Export to Markdown
  - Copy individual sections
- **Selected Entries Report**: View all entries marked "Add to Report"
  - Clickable cards that navigate to specific entries
  - Export to Markdown
  - Copy individual entries or all at once
- **Markdown Export**: Export all data as markdown for LLM consumption

### 🔍 Search & Discovery
- **Global Search**: Search entries, lists, and Kanban boards by text content and/or labels
- **Unified Results**: View entries, regular lists, and Kanban columns together in search results
- **Kanban Differentiation**: Kanban columns displayed with Trello icon and accent color for easy identification
- **Status Filters**: Filter by starred, completed, or not completed entries
- **Search History**: Unlimited search history (no duplicates)
- **Label Filtering**: Find entries, lists, and Kanban boards by specific labels
- **Direct Navigation**: Click search results to jump to specific entries, lists, or Kanban boards
- **Rich Result Cards**: Large, detailed cards showing all relevant information

### 🛠️ Productivity Tools
- **Multi-Select & Merge**: Select multiple entries and combine them into one
- **Copy Content**: Copy any entry's text content to clipboard
- **Copy as Markdown**: Export entries with title and content as high-quality Markdown
- **Copy as Jira/Confluence**: Export entries in Jira wiki markup format with full formatting preservation
- **Continue from Previous Day**: Copy entries from past days to today
- **Entry Management**: Edit, delete, and reorder entries
- **Reminders**: Set date-time based reminders on entry cards
  - Click "Remind Me" button on any entry card to set a reminder
  - Choose specific date and time for the reminder
  - In-app alerts appear when reminders are due
  - Snooze reminders for 1 day or dismiss them
  - View all upcoming reminders on the Calendar page
  - Calendar shows bell indicators on days with reminders
  - Cancel reminders from the Calendar view or entry card

### 🖥️ View Customization
- **Full-Screen Mode**: Expand daily view to full width for focused work
- **Timeline Toggle**: Show/hide left timeline sidebar for more space
- **Smart Layout**: Timeline auto-hides in full-screen, auto-shows when toggled on
- **Persistent Preferences**: View settings saved across sessions
- **One-Click Toggle**: Quick access from navigation bar

### 🎯 UI/UX Improvements
- **Card Borders**: Defined 2px borders on all cards in list and kanban views for better visual separation
- **Improved Card Layout**: Enhanced content display with proper spacing and formatting
- **Rich Text Rendering**: Full prose styling for all formatted content (headings, lists, code blocks, etc.)
- **Vertical Scrolling**: List and Kanban columns grow naturally without truncation
- **Page-Level Scrolling**: Smooth scrolling for entire page when lists have varying heights
- **Fixed Scroll Indicators**: Horizontal scroll indicators stay at consistent viewport position
- **Unified Horizontal Scrolling**: Navigation and content scroll together as a single unit on narrow viewports
- **Custom Logo**: Branded "Track the Thing" logo with monitor icon in navigation bar
- **Theme-Aware Logo**: Logo colors adapt to current theme using CSS variables
- **Responsive Design**: Consistent layout across different screen sizes

### 💾 Data Management
- **Backup & Restore**: Full JSON export/import with all data
- **Download Uploads**: Export all uploaded files as a zip archive
- **Persistent Storage**: SQLite database with all metadata preserved
- **Docker Volumes**: Data persists across container restarts
- **Full Restore**: One-click restore from both JSON + ZIP backups
- **Migration Support**: Automated migration scripts for version upgrades

### 🎨 Themes & Customization
- **Built-in Themes**: 30+ professionally designed color themes
- **Custom Themes**: Create and edit your own themes
- **Theme Editor**: Modify existing themes with live preview
- **Restore to Default**: Reset built-in themes to original colors
- **Transparent Labels**: Toggle between solid or transparent label backgrounds
- **Custom Backgrounds**: Upload and rotate your own background images
- **Auto-Rotate**: Set interval for automatic background image cycling
- **Tile or Cover**: Choose between tiled pattern or centered/covered background
- **Unified Toggle Styles**: Consistent toggle button design across all settings
- **Theme Variables**: CSS custom properties for consistent styling
- **UI Textures**: Add subtle texture patterns to UI elements
  - **20+ Texture Patterns**: Basic (noise, dots, lines, grid), Natural (wood, water, paper, stone), Industrial (rust, concrete, brushed metal, carbon fiber, chain link, diamond plate, rivets, corrugated), Geometric (cross-hatch, hexagons, waves, perlin)
  - **Fine-Grained Controls**: Adjust opacity (0-100%), scale (0.5-2x), density (10-100%), rotation (0-360°)
  - **Blend Modes**: 12 blend modes for different visual effects (normal, multiply, screen, overlay, etc.)
  - **Per-Element Settings**: Apply different textures to cards, calendar, lists, kanban, modals, navigation, panels, sidebar, header, and buttons
  - **Random Pattern Rotation**: Automatically cycle through patterns with configurable intervals (1-60 minutes)
  - **Live Preview**: Real-time preview of texture settings before applying
  - **Export/Import**: Save and share texture configurations
  - **Smooth Animations**: Polished transitions and hover effects
  - **Independent System**: Works alongside themes and background images without interference
  - **Canvas-Based Generation**: Efficient texture rendering with caching
  - **localStorage Persistence**: Settings saved locally and synced via backup/restore

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Modern, fast Python web framework
- **SQLAlchemy**: SQL toolkit and ORM
- **SQLite**: Lightweight database (easily upgradeable to PostgreSQL)
- **Pydantic**: Data validation and settings management
- **BeautifulSoup4**: HTML parsing for link previews
- **Requests**: HTTP library for fetching link metadata

### Frontend
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **Tailwind CSS**: Utility-first CSS framework
- **TipTap**: Headless WYSIWYG editor with extensions
- **React Router**: Client-side routing
- **Axios**: HTTP client
- **date-fns & date-fns-tz**: Date utility and timezone support
- **Lucide React**: Beautiful icon library
- **React Calendar**: Calendar component

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Desktop (for Docker deployment)
- OR Python 3.11+ and Node.js 18+ (for local development)

### 🐳 Docker Deployment (Recommended)

The easiest way to run the entire application:

```bash
# Clone the repository
git clone <your-repo-url>
cd track-the-thing

# Build and start all services
docker-compose --env-file .dockerenv up --build -d

# View logs
docker-compose --env-file .dockerenv logs -f

# Stop services
docker-compose --env-file .dockerenv down
```

> All container configuration lives in `.dockerenv`. Update the values there (database paths, API URLs, etc.) before running Compose commands.

Access the application:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs`

Data is persisted in Docker volumes at `./backend/data`

If you delete `backend/data/track_the_thing.db`, the backend will automatically recreate the SQLite file (and default settings row) the next time it starts up.

> **Note:** JSON backups created before version 7.0 (no `lists` section) do not include Trello-style lists/Kanban columns. Importing those backups restores daily notes/entries, but lists must be recreated manually or migrated from the source database. Always keep a copy of the original `track_the_thing.db` when upgrading older deployments.

### Configuration via `.dockerenv`

All Docker services read their environment values from the root `.dockerenv` file. The defaults target local development (SQLite databases, localhost ports). Update this file if you need to point at different databases, change API URLs, or tweak CI flags. Local tooling (e.g., the frontend `.env`) also derives its defaults from the same values to keep everything in sync.

### 🖥️ Desktop (Tauri) Deployment

We are in the process of shipping a first-class desktop build powered by
[Tauri](https://tauri.app/start/) and a PyInstaller-frozen FastAPI backend.
Desktop-specific documentation, data paths, and commands live under
`desktop/README-desktop.md`.

Quick overview:

1. Copy `.tourienv.example` to `.tourienv` and customize the desktop-only
   settings (ports, window sizing, and dedicated data directories).
   Place the official square logo PNG under
   `desktop/tauri/assets/track-the-thing-logo.png` so both the splashscreen and
   app icons match the desktop branding.
2. Build the backend sidecar (PyInstaller) and the frontend production bundle.
3. Launch the Tauri shell, which shows a splash screen using the Track the
   Thing logo while the backend warms up, then opens a nearly full-height
   window pointed at the bundled frontend.

The `.tourienv` defaults deliberately avoid the Docker ports (3000/8000) and
use unique SQLite names (e.g., `ttt_desktop.db`) under a separate application
data directory. That guarantees Docker (`.dockerenv`) and desktop (`.tourienv`)
deployments can run simultaneously without touching each other’s data.

Desktop workflow quickstart:

```bash
cp .tourienv.example .tourienv            # adjust ports + data paths
./desktop/pyinstaller/build_backend.sh    # build the backend sidecar (PyInstaller)
npm --prefix desktop/tauri run tauri:dev  # run splash + desktop shell
```

Desktop build prerequisites:
- Node.js 18+ and npm
- Rust toolchain (rustup) with `cargo`
- Python 3.11 with `pyinstaller` installed
- macOS Command Line Tools (for `scripts/build-desktop-macos.sh`)

Key scripts live under `desktop/tauri/scripts/`:

- `run_frontend_dev.sh` / `run_frontend_build.sh` – keep the frontend build
  synced with the desktop assets and export `VITE_API_URL` from `.tourienv`.
- `sync_assets.sh` – copies `desktop/tauri/assets/` (logo + splash HTML) into
  `frontend/public/desktop/` right before each build or dev session so the
  splash window and toolbar icon always use the latest branding.

### Local Development

#### 1. Set up the Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

#### 2. Set up the Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 📁 Project Structure

```
track-the-thing/
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── database.py         # Database configuration
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   └── routers/            # API route handlers
│   │       ├── notes.py        # Daily note endpoints
│   │       ├── entries.py      # Note entries endpoints
│   │       ├── labels.py       # Label management
│   │       ├── uploads.py      # File upload handling
│   │       ├── backup.py       # Backup/restore/export
│   │       ├── reports.py      # Report generation
│   │       ├── search.py       # Search functionality
│   │       ├── search_history.py # Search history
│   │       └── link_preview.py # Link preview fetching
│   ├── data/                   # Persistent storage (Docker volume)
│   │   ├── daily_notes.db     # SQLite database
│   │   └── uploads/           # Uploaded files
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .gitignore
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── CalendarView.tsx       # Calendar with indicators
│   │   │   ├── DailyView.tsx          # Daily note view
│   │   │   ├── Navigation.tsx         # Top navigation bar
│   │   │   ├── RichTextEditor.tsx     # TipTap rich text editor
│   │   │   ├── CodeEditor.tsx         # Code entry editor
│   │   │   ├── NoteEntryCard.tsx      # Individual entry card
│   │   │   ├── LabelSelector.tsx      # Label management UI
│   │   │   ├── EmojiPicker.tsx        # Emoji selection
│   │   │   ├── EntryTimeline.tsx      # Timeline navigation
│   │   │   ├── Reports.tsx            # Reports view
│   │   │   ├── Search.tsx             # Global search
│   │   │   └── Settings.tsx           # Settings & management
│   │   ├── contexts/
│   │   │   └── TimezoneContext.tsx    # Timezone management
│   │   ├── extensions/
│   │   │   └── LinkPreview.tsx        # TipTap link preview extension
│   │   ├── utils/
│   │   │   └── timezone.ts            # Timezone utilities
│   │   ├── api.ts              # API client
│   │   ├── types.ts            # TypeScript types
│   │   ├── App.tsx             # Main app component
│   │   └── index.css           # Global styles & animations
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── .dockerenv                 # Shared environment config for Docker
├── docker-compose.yml
└── README.md
```

## 🧪 Testing & CI

Track the Thing has comprehensive test coverage with **558 tests** across all layers:

### Test Suite Structure
```
tests/
├── backend/          # Backend tests (pytest)
│   ├── unit/         # Model and utility tests
│   ├── integration/  # API endpoint tests
│   ├── migrations/   # Database schema tests
│   └── fixtures/     # Test data and helpers
└── e2e/              # End-to-end tests (Playwright)
    ├── tests/        # E2E test suites
    └── fixtures/     # Test helpers and baseline data

frontend/tests/       # Frontend tests (vitest)
├── components/       # React component tests
├── contexts/         # Context and hook tests
└── integration/      # Integration tests
```

- **Backend Tests**: 211 tests (pytest)
  - Unit tests for models and utilities
  - Integration tests for all API endpoints
  - Migration tests for database schema changes
- **Frontend Tests**: 241 tests (vitest)
  - Component tests with React Testing Library
  - Context and hook tests
  - Utility function tests
- **E2E Tests**: 106 tests (Playwright)
  - Full user workflow tests
  - Cross-browser compatibility
  - Auto-save and persistence verification

### Running Tests

**All tests** (requires Docker):
```bash
./run_all_tests.sh
```

**Backend only**:
```bash
cd tests/backend
./run_tests.sh
# or with coverage:
python -m pytest --cov=../../backend/app --cov-report=html
```

**Frontend only**:
```bash
cd frontend
npx vitest
# or with coverage:
npx vitest --coverage
```

**E2E only**:
```bash
cd tests/e2e
npx playwright test
# or with UI:
npx playwright test --ui
```

### Continuous Integration

GitHub Actions automatically runs:
- **On push**: Linters + Backend tests + Frontend tests
- **On PR**: All of the above + E2E tests

All tests must pass before merging.

### Code Quality
- **Backend**: ruff linter and formatter (configured in `pyproject.toml`)
- **Frontend**: ESLint + TypeScript strict mode
- **Pre-push**: Run `./backend/run_lint.sh` to verify code quality

## 🎨 Usage

### Creating Entries
1. Navigate to any day using the calendar or arrow buttons
2. Click "Add Text Entry" for rich text or "Add Code Entry" for code
3. Start typing - content is auto-saved
4. Use the toolbar for formatting, links, images, etc.

### Managing Entry States
- Click the **star** to mark as important
- Click the **checkmark** to mark as completed
- Click the **file** icon to add to weekly report

### Using Labels
- Type in the label field to add text labels
- Click the emoji picker to add emoji labels
- Labels autocomplete from existing tags
- Labels are searchable globally

### Generating Reports
1. Mark relevant entries with "Add to Report"
2. Go to Reports section
3. Click "Generate" for weekly report or selected entries report
4. Export to Markdown or copy sections

### Searching
1. Go to Search section
2. Enter text to search entry content
3. Select labels to filter by tags
4. Click results to navigate to specific entries
5. Recent searches are saved for quick access

### Backup & Restore
1. Go to Settings → Management
2. Click "Backup" to download JSON with all data
3. Use "Restore" to import a previous backup
4. Timestamps and metadata are preserved

## 📊 API Endpoints

### Notes
- `GET /api/notes/` - Get all notes
- `GET /api/notes/{date}` - Get note for specific date
- `POST /api/notes/` - Create new note
- `PATCH /api/notes/{date}` - Update note
- `DELETE /api/notes/{date}` - Delete note
- `GET /api/notes/month/{year}/{month}` - Get notes for month

### Note Entries
- `GET /api/entries/note/{date}` - Get entries for date
- `POST /api/entries/note/{date}` - Create entry
- `PATCH /api/entries/{entry_id}` - Update entry
- `DELETE /api/entries/{entry_id}` - Delete entry
- `POST /api/entries/merge` - Merge multiple entries

### Labels
- `GET /api/labels/` - Get all labels
- `POST /api/labels/` - Create label
- `POST /api/labels/note/{date}/label/{label_id}` - Add label to note
- `POST /api/labels/entry/{entry_id}/label/{label_id}` - Add label to entry
- `DELETE /api/labels/note/{date}/label/{label_id}` - Remove label from note
- `DELETE /api/labels/entry/{entry_id}/label/{label_id}` - Remove label from entry

### Reports
- `GET /api/reports/generate` - Generate weekly report
- `GET /api/reports/all-entries` - Generate selected entries report
- `GET /api/reports/weeks` - Get available report weeks

### Search
- `POST /api/search/` - Search entries by text/labels
- `GET /api/search/history` - Get search history
- `POST /api/search/history` - Save search to history

### Uploads
- `POST /api/uploads/image` - Upload image
- `POST /api/uploads/file` - Upload file
- `GET /api/uploads/download-all` - Download all uploads as zip

### Backup & Management
- `GET /api/backup/export` - Export all data as JSON
- `POST /api/backup/import` - Import data from JSON
- `GET /api/backup/export-markdown` - Export as Markdown

### Link Previews
- `POST /api/link-preview/preview` - Fetch link preview metadata

## 🧪 Testing

The project includes comprehensive test coverage across backend, frontend, and E2E tests.

### Running Tests

**All Tests** (recommended before committing):
```bash
./test_ci_locally.sh
```

**Backend Tests**:
```bash
cd tests/backend
python -m pytest --tb=short -v --cov=../../backend/app
```

**Frontend Tests**:
```bash
cd frontend
npx vitest --run --coverage
```

**E2E Tests**:
```bash
docker-compose --env-file .dockerenv --profile e2e run --rm e2e npx playwright test
```

### Test Coverage

**Backend Integration Tests** (`tests/backend/integration/`):
- Note entries, labels, lists, and Kanban API endpoints
- Sprint and quarterly goals with overlap validation
- Search functionality with filters
- Backup/restore operations
- Custom emoji CRUD operations
- Error handling and edge cases
- Database constraints and cascading deletes

**Frontend Unit Tests** (`frontend/tests/`):
- Component rendering and interactions
- Context providers (Theme, Timezone, Goals, etc.)
- Custom hooks
- Rich text editor functionality

**E2E Tests** (`tests/e2e/tests/`):
- **01-basic-navigation.spec.ts**: Page navigation and routing
- **02-note-entries.spec.ts**: Creating, editing, and managing entries
- **03-labels.spec.ts**: Label creation, assignment, and deletion
- **04-search.spec.ts**: Search functionality with filters
- **05-reports.spec.ts**: Weekly report generation
- **06-backup-restore.spec.ts**: Data export and import
- **07-theming.spec.ts**: Theme switching and customization
- **08-goals.spec.ts**: Sprint and quarterly goal management
- **09-calendar.spec.ts**: Calendar navigation and indicators
- **10-rich-text-editor.spec.ts**: Editor features and formatting
- **11-media-features.spec.ts**: Camera, video, and voice recording
- **12-lists.spec.ts**: List creation, editing, deletion, drag-and-drop, and multi-list support
- **13-kanban.spec.ts**: Kanban board initialization, columns, drag-and-drop, exclusive status, and status changes
- **14-custom-emojis.spec.ts**: Custom emoji upload, display, deletion, and library switching
- **15-pinned-entries.spec.ts**: Pinning, unpinning, copy behavior, and smart deletion
- **16-settings-advanced.spec.ts**: Sprint name, daily goal end time, and emoji library settings

### Test Quality Standards

All tests follow these principles:
- **Meaningful Assertions**: Tests verify specific behavior, not just execution success
- **Realistic Data**: Test data and mocks represent actual use cases
- **Clear Intent**: Test names clearly communicate what is being tested
- **No Test Modification**: Program code is never changed to make tests pass
- **Comprehensive Coverage**: Both positive and negative test cases are included

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/.env` or `.dockerenv` for Docker):
```env
DATABASE_URL=sqlite:///./data/daily_notes.db
```

**Frontend** (`frontend/.env` or `.dockerenv` for Docker):
```env
VITE_API_URL=http://localhost:8000
```

### Application Settings
**General Settings** (configurable in Settings → General):
- **Sprint Goal Name**: Customize the label for "Sprint" goals (e.g., "Iteration", "Cycle", "Phase")
- **Daily Goal End Time**: Set when your day ends for the daily countdown timer (default: 5:00 PM)
- **Emoji Library**: Choose between `emoji-picker-react` or `emoji-mart` for emoji selection
- **Goal Visibility**: Toggle visibility of Daily, Sprint, and Quarterly goals
- **Label Display**: Toggle transparent label backgrounds and day labels visibility

**Timezone Settings**:
- Default timezone: Eastern US (America/New_York)
- Configurable in Settings page
- All timestamps display in selected timezone

## 🚢 Production Considerations

For production deployment:

1. **Database**: Consider migrating from SQLite to PostgreSQL for better concurrency
2. **Environment Variables**: Set proper production URLs and secrets
3. **Security**: Implement authentication and authorization
4. **HTTPS**: Use SSL/TLS certificates (Let's Encrypt)
5. **Reverse Proxy**: Use Nginx or Traefik for routing
6. **Backups**: Implement automated backup strategy
7. **Monitoring**: Add logging and monitoring solutions
8. **Volume Management**: Ensure Docker volumes are backed up regularly

## 🎨 Customization

### Animations
- Calendar indicators use custom CSS animations
- Modify `@keyframes` in `index.css` for different effects
- Star rays, pulsing, and bouncing animations

### Colors & Styling
- Tailwind CSS for all styling
- Modify `tailwind.config.js` for theme changes
- Custom colors for labels (randomly assigned)

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend library
- [TipTap](https://tiptap.dev/) - Rich text editor
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Lucide Icons](https://lucide.dev/) - Icon library
- [date-fns](https://date-fns.org/) - Date utilities

---

**Track the Thing! 🎯✨**
