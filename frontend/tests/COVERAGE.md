# Frontend Test Coverage Inventory

_Last updated: 2025-11-22_

This document maps the major frontend surfaces (`frontend/src/**`) to existing specs in `frontend/tests/**`, highlighting gaps or low-value coverage. Use it to guide the ongoing test overhaul.

## Component Coverage

| Component / Feature | Current Spec(s) | Coverage Notes |
| --- | --- | --- |
| `DailyView` | `components/DailyView.test.tsx` | Heavily mocked but assertions only verify renders/calls; lacks checks for goal sections, multi-select UX, merge/reorder flows, navigation side-effects, reminder interactions. |
| `CalendarView` | `components/CalendarView.test.tsx` | Stubs calendar; no real assertions about tile indicators, month change callbacks, sprint/quarter overlays, or error handling. |
| `Search` | `components/Search.test.tsx` | Mostly smoke tests; does not exercise debounced API search, label filters, history persistence, keyboard navigation, or result routing. |
| `Lists` / `ListCard` / `ListColumn` | `components/Lists.test.tsx`, `components/NoteEntryCard.test.tsx` | List rendering checked but entry CRUD, drag/drop reorder, archive toggles, add-to-list modal, and kanban flags largely untested. |
| `Kanban` | _None_ | Entire kanban workflow (board init, column CRUD, drag/drop reorder, refresh meter) lacks tests. |
| Entry modals (`CreateEntryModal`, `EntryModal`, `AddEntryToListModal`) | _None_ | No coverage for validation, API submit, rich text editor integration, or callbacks. |
| Reminder UX (`ReminderModal`, `ReminderAlert`) | _None_ | Reminder scheduling/dismissal UI untested. |
| Texture UI (`TextureSettings`, `TexturePatternPreview`, `Settings` texture section) | _None_ | Toggling textures, per-element overrides, import/export, randomization not covered. |
| `Settings` | `components/Settings.test.tsx` | Only basic render; no assertions for theme persistence, texture controls, reminders, or background uploads. |
| `Reports` | `components/Reports.test.tsx` | Minimal snapshot-like tests; lacks coverage for filters, pagination, exports, and empty/error states. |
| `NoteEntryCard` | `components/NoteEntryCard.test.tsx` | Verifies render but not menu actions (pin, labels, reminders) or markdown preview toggles. |
| `EmojiPicker`, `CustomEmojiManager` | _None_ | Emoji search, category filtering, upload/delete handling untested. |
| `Navigation`, `SplashScreen` | _None_ | Route guards, loading transitions, and reminder indicator states untested. |
| `TexturePatternPreview`, `TexturePatternGrid` | _None_ | Canvas rendering hooks not simulated. |

## Context & Hook Coverage

| Context / Hook | Current Spec(s) | Coverage Notes |
| --- | --- | --- |
| Theme, Timezone, FullScreen, DailyGoals, TransparentLabels | `contexts/test_contexts.test.tsx` | Basic smoke tests only; do not verify persistence edge cases, event subscriptions, or cross-provider interactions. |
| `TextureContext` / `useTextures` | _None_ | Needs tests for enable/disable, element overrides, randomization timer, export/import pipelines. |
| `CustomBackgroundContext` | _None_ | Rotation scheduling, upload queue, error handling untested. |
| `EmojiLibraryContext` | _None_ | No verification of library switching or persistence. |
| `SprintGoalsContext`, `QuarterlyGoalsContext`, `SprintNameContext` | _None_ | Should assert API fetch, optimistic updates, and error paths. |
| `useSpeechRecognition` | _None_ | Browser API mocks needed for start/stop lifecycle, transcript updates, error handling. |
| `useTexture` (hook) | _None_ | Should cover memoized selectors, CSS variable updates, cleanup. |
| `useWindowSize`, other helpers | _None_ | Basic resize listeners untested (low priority). |

## Test Utilities & Integration

- `frontend/tests/run_tests.sh` exists but integration tests folder (`tests/integration`) is empty aside from `__init__.ts`. Consider adding scenario-level tests (e.g., entry lifecycle, kanban board).
- Coverage HTML in `frontend/tests/coverage` reflects a previous run but indicates many files never touched by tests.

## Next Steps

1. Rewrite weak specs called out above with real user-behavior assertions.
2. Add missing specs (modals, kanban, textures, reminders, navigation).
3. Create dedicated context/hook test suites for Texture, Background, Speech, etc.
4. Log any true defects discovered during testing work in a shared issue tracker before touching production code.


