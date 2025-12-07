# Test Coverage Review and Improvement Plan

## Current State Analysis

### Frontend Components Coverage

| Component | Lines | Has Test | Coverage Quality |
|-----------|-------|----------|------------------|
| `RichTextEditor.tsx` | 2052 | Yes | Weak - heavily mocked, tests mostly verify rendering |
| `Settings.tsx` | 1852 | Yes | Weak - only basic render tests |
| `Reports.tsx` | 1111 | Yes | Weak - minimal snapshot-like tests |
| `NoteEntryCard.tsx` | 1007 | Yes | Weak - no menu action coverage |
| `DailyView.tsx` | 828 | Yes | Weak - heavily mocked, missing goal/merge flows |
| `Search.tsx` | 777 | Yes | Weak - smoke tests only |
| `Archive.tsx` | 671 | **Yes** | ✅ Added - archive/restore flows |
| `GoalForm.tsx` | 604 | **Yes** | ✅ Added - validation and submission |
| `Lists.tsx` | 567 | Yes | Partial - no drag/drop or archive |
| `Kanban.tsx` | 534 | Yes | Minimal - 2 tests |
| `ListColumn.tsx` | 442 | **Yes** | ✅ Added - kanban column interactions |
| `EntryListSelector.tsx` | 413 | **No** | Missing |
| `CodeEditor.tsx` | ~300 | **No** | Missing |
| `Navigation.tsx` | ~250 | **Yes** | ✅ Added - route guards and indicators |
| `SplashScreen.tsx` | 194 | **No** | Missing |
| `TexturePatternPreview.tsx` | 133 | **No** | Missing |
| `EmojiPicker.tsx` | ~300 | **Yes** | ✅ Added - search/selection logic |
| `CustomEmojiManager.tsx` | ~350 | **No** | Missing |
| `CustomBackgroundSettings.tsx` | ~300 | **No** | Missing |
| `GoalCard.tsx` | ~250 | **Yes** | ✅ Added - Goal display and actions |
| `EntryDropdown.tsx` | ~200 | **No** | Missing |
| `ListCard.tsx` | 362 | **No** | Missing |

### Frontend Contexts/Hooks Coverage

| Context/Hook | Has Test | Notes |
|--------------|----------|-------|
| `ThemeContext` | Yes | Basic smoke tests only |
| `TimezoneContext` | Yes | Basic - no error handling |
| `FullScreenContext` | Yes | Basic |
| `DailyGoalsContext` | Yes | Basic |
| `TransparentLabelsContext` | Yes | Basic |
| `TextureContext` | Yes | Weak - minimal coverage |
| `CustomBackgroundContext` | Partial | Weak - no rotation/upload tests |
| `EmojiLibraryContext` | **Yes** | ✅ Added - library switching, persistence |
| `DayLabelsContext` | **Yes** | ✅ Added - visibility toggle, persistence |
| `useReminderPolling` | **No** | Missing |
| `useTexture` | **No** | Missing |
| `useWindowSize` | **No** | Missing |
| `useSpeechRecognition` | Yes | Has tests |

### Backend Coverage Analysis

The backend tests use **real SQLite databases** via fixtures - this is correct for integration testing. However, the unit tests folder only has 3 files:

- `test_entries.py` - Good model tests
- `test_goals.py` - Good model tests  
- `test_labels.py` - Good model tests

**Missing unit tests with mocked dependencies for:**

- Router business logic (validation, error handling)
- Complex operations in `backup.py` (1122 lines - largest router)
- Search ranking/scoring logic in `search.py` (259 lines)
- Report generation logic in `reports.py` (131 lines)
- Reminder scheduling logic in `reminders.py` (286 lines)

---

## Completed Improvements ✅

### Phase 1: Frontend Components (Completed)

1. **`Archive.tsx`** - Tests for archive/restore flows, loading states, tab filtering, view modes
2. **`GoalForm.tsx`** - Tests for validation, goal types (time-based vs lifestyle), form submission
3. **`ListColumn.tsx`** - Tests for kanban column interactions, drag/drop, name editing, archive
4. **`GoalCard.tsx`** - Tests for goal display, completion toggle, visibility, delete confirmation
5. **`Navigation.tsx`** - Tests for route links, active states, day name display
6. **`EmojiPicker.tsx`** - Tests for emoji selection, custom emojis, manager modal

### Phase 3: Frontend Contexts (Completed)

1. **`EmojiLibraryContext.tsx`** - Tests for library switching, API persistence, localStorage fallback
2. **`DayLabelsContext.tsx`** - Tests for visibility toggle, localStorage persistence

---

## Remaining Improvements

### Phase 2: Strengthen Weak Frontend Tests

Improve existing test files:

1. **`DailyView.test.tsx`** - Add tests for:
   - Goal section rendering/hiding
   - Multi-select UX for merging
   - Entry reorder via drag
   - Reminder interactions

2. **`Search.test.tsx`** - Add tests for:
   - Debounced API search
   - Label filter combinations
   - Keyboard navigation
   - History persistence

3. **`Reports.test.tsx`** - Add tests for:
   - Week filter selection
   - Empty state handling
   - Export functionality

4. **`NoteEntryCard.test.tsx`** - Add tests for:
   - Pin/unpin action
   - Label attachment
   - Reminder setting
   - Markdown preview toggle

### Phase 3: Remaining Frontend Contexts/Hooks

1. **`useReminderPolling.ts`** - Polling interval, cleanup
2. **`useTexture.ts`** - CSS variable updates, memoization
3. **`useWindowSize.ts`** - Resize listener handling

### Phase 4: Backend Unit Tests with Mocks

Add unit tests that mock the database for testing business logic in isolation:

1. **`test_backup_logic.py`** - Test backup/restore validation logic without DB
2. **`test_search_ranking.py`** - Test search scoring/ranking algorithms
3. **`test_reminder_scheduling.py`** - Test reminder time calculations
4. **`test_report_generation.py`** - Test report aggregation logic

---

## Tests Using Real Dependencies (Intentional)

The following tests correctly use real dependencies:

**Backend Integration Tests** (`tests/backend/integration/`):
- All 22 integration test files use real SQLite via the `client` fixture
- This is **correct** - they test the full API stack

**Backend Unit Tests** (`tests/backend/unit/`):
- Uses real SQLite via `db_session` fixture for model tests
- This is **acceptable** for model layer tests but business logic should use mocks

**Frontend Context Tests** (`test_contexts.test.tsx`):
- Tests real context providers without mocking
- This is **correct** for testing actual context behavior

---

## Summary Statistics

| Category | Missing | Weak | Adequate | Completed |
|----------|---------|------|----------|-----------|
| Frontend Components | 8 | 8 | 4 | 6 ✅ |
| Frontend Contexts | 0 | 4 | 5 | 2 ✅ |
| Frontend Hooks | 3 | 0 | 1 | 0 |
| Backend Unit Tests | 4 areas | 0 | 3 | 0 |
| Backend Integration | 0 | 0 | 22 | 0 |

**Total new test files created:** 8 (6 components + 2 contexts)
**Total estimated remaining:** 15 (8 components + 3 hooks + 4 backend unit)

---

## Execution Notes

Each test file was committed separately after completion to maintain a clean git history and allow easy rollback if needed.

All tests follow existing patterns in the codebase:
- Use `vi.mock` for API and context dependencies
- Use `vi.hoisted` for mock functions that need to be referenced
- Use `renderWithRouter` from test-utils for components with routing
- Follow the naming convention `ComponentName.test.tsx`

