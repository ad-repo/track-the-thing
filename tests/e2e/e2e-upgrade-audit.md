# E2E Upgrade Audit (2025-12-07)

## Playwright Config Snapshot
- `fullyParallel: true`, `workers: 2`, retries `CI?1:0`; test timeout 30s; expect timeout 3s; action timeout 2s; navigation timeout 15s.
- Reporter: html (never open) + list; artifacts on failure: trace `on-first-retry`, screenshot `only-on-failure`, video `retain-on-failure`.
- Single project: Chromium only; other browsers commented.
- Web servers (when BASE_URL unset): `backend` via `uvicorn app.main:app --port 8000`, `frontend` via `npm run dev` on `3000`, both 120s startup, reuse when not CI.

## Fixtures & Data Isolation
- Shared helpers in `fixtures/helpers.ts` focus on navigation, entry/label helpers, theme change, and simple waits; no centralized test data factory or cleanup hook. `clearTestData` references `/api/test/cleanup` but no implementation or usage.
- Baseline seed (`fixtures/baseline_db.sql`) sets static data dated 2025-11-05..07 plus labels/goals/settings; colors are hex-coded; no per-test scoping.
- Isolation strategies vary by suite: some (02-note-entries, 03-labels, 10-rich-text) generate hashed dates per test; others (most nav/calendar/search/reports/theming/backup/media) rely on default/today without cleanup. With `fullyParallel` and `workers: 2`, suites without isolated dates risk cross-test contamination (pinned entries, lists/kanban, settings).

## Current Spec Coverage & Gaps (by file)
- `01-basic-navigation`: Basic page loads and nav/back checks only; lacks auth/route-guard assertions, active link state, history navigation depth.
- `02-note-entries`: Covers create/edit/delete, move-to-top, important/completed toggles, multi-entry persistence; missing autosave debounce verification, pin/archiving/report toggles, reminder/label flows.
- `03-labels`: Tests creation, reuse, emoji labels, removal, day-level labels; no duplicate-name guard, color validation, filtered view, bulk remove, label ordering.
- `04-search`: Placeholder assertions only (presence of headings/inputs); no real queries, history, combined filters, empty states, keyboard nav, ordering.
- `05-reports`: Placeholder checks for heading/buttons; no week selection, export/download, empty-state validation, include_in_report filtering.
- `06-backup-restore`: Placeholder settings-page visibility; no export payload validation, restore fixtures, corrupted file rejection, ID remap checks.
- `07-theming`: Placeholder visibility checks; no theme toggle persistence, background upload toggle, texture enable/disable, custom theme CRUD.
- `08-goals`: Covers section visibility, basic edits, some task list behavior; several skips around date editing; lacks full create/update/complete flows across views and visibility toggles.
- `09-calendar`: Placeholder checks for headers; missing month/week navigation, indicators for goals/reminders/notes, open-from-calendar flows, legend assertions.
- `10-rich-text-editor`: Broad toolbar interactions and task lists with real saves; lacks paste markdown, code block assert depth, undo/redo verification, checklist persistence across history, media handling.
- `11-media-features`: Pure placeholders (buttons visible only); no image upload/validation, camera/voice permission mocks, lightbox/resize/delete flows.
- `12-lists`: Entire suite skipped; contains draft flows for create/edit/delete/reorder but unexecuted.
- `13-kanban`: Entire suite skipped; contains draft flows for init, drag/drop, exclusivity, badge switching.
- `14-custom-emojis`: Entire suite skipped; contains draft flows for upload/use/delete across UI.
- `15-pinned-entries`: Entire suite skipped; contains draft flows for pin copy/unpin/delete/all copies.
- `16-settings-advanced`: Entire suite skipped; contains draft flows for timezone/emoji library/daily goal end time; mostly settings persistence checks.

## Immediate Priorities
- Phase 2: Rewrite `11-media-features.spec.ts` with real upload/permissions/lightbox/resize/delete scenarios using deterministic fixtures and permission mocks.
- Phase 3: Replace placeholder suites (`04-search`, `05-reports`, `06-backup-restore`, `07-theming`, `09-calendar`) with real flows + stronger asserts; unskip and harden `12-16` after validating selectors and data isolation.
- Phase 4: Add missing specs for search history, reminders snooze/dismiss, backup error paths, large file rejection, accessibility smoke, preference sync.
- Stabilization: Introduce shared fixtures for per-test IDs/dates and cleanup; ensure suites using today’s date pinning/lists/settings don’t leak across workers; prefer deterministic fixtures over baseline seed for multi-worker runs.

