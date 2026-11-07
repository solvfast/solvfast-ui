# P35 — Frappe Form / List View coverage in @solvfast/ui + CRM DS adoption: final report

Date: 2026-11-07. Nothing in this phase was published, pushed, tagged or deployed. No bench command, database, cache,
migration or restart was touched. Service Desk, Service Management, Sada, Sear Studio and Frappe core were not changed.

The detailed evidence lives next to this file. Each section below points at the document that holds the per-row detail:

| Document | Holds |
|---|---|
| `README.md` | the baseline counts and the fixed denominator |
| `A-form.md`, `B-list.md`, `C-native.md`, `D-crm.md`, `E-tests.md` | the five read-only baseline audits (0.6.0 = `0ef45c1`; CRM `127c0b4`) |
| `COVERAGE.md` | the consolidated Form (A–P) and List (A–J) matrices after implementation: status, layer, file, test, showcase, evidence level, limitations; real-site validation list; new features; remaining gaps |
| `CRM-MIGRATION.md` | per CRM area: previous implementation, DS component adopted, files, remaining CRM code, regression evidence; owner decisions |
| `../../../CHANGELOG.md` (0.7.0-dev.1) | Added / Changed (behaviour changes) / Fixed / export-signature notes |
| `../../LIMITATIONS.md`, `../../FRAPPE.md` | rewritten for 0.7.0-dev.1 |

## A. Executive summary

**What was inspected.**
- `@solvfast/ui` 0.6.0: Core, the Frappe layer, the simulator, tests, Showcase, docs and exports.
- The Frappe v15.110 source, as the native reference (form, list, views, Python endpoints).
- The whole CRM: 519 rendered files and all routes, including the 313 files it shares with Service Desk / Service Management.

**What was implemented.** This is package `0.7.0-dev.1`, branch `feat/0.7.x/p35-coverage`. Six workstreams and an
integration pass did the work:

- **Form**
  - The native mismatches F1–F9. Ctrl+S runs the visible primary action. Workflow transitions run the mandatory check plus `before/after_workflow_action`. `_link_titles` are kept. Link create/open respect permissions. A dirty submitted document shows Update without Cancel. Amend needs create. Copies start from new-document defaults.
  - Unsupported fieldtypes are reported and shown read-only; Autocomplete has a real control.
  - Server field errors appear on the field.
  - The header shows an image and "See on Website".
  - Boot user defaults are applied automatically.
  - Undo/redo, `frm.addCustomButton`, Quick Entry, and the `menu` / `extraTabs` / `fieldFilter` slots.
- **Record actions:** the default form ⋯ menu (Duplicate, Copy, Rename, Delete, Reload, New, Print, Email, Links, Customize, Remind Me, Undo/Redo), form Print with server preview and PDF, the Connections tab with open counts, the email composer, and Remind Me.
- **List**
  - Workflow state in the row indicator.
  - Assigned To and Tags as real group/filter fields, with a Tags cell.
  - A group-by sidebar with server counts and tag stats, and Toggle Sidebar.
  - "Add {DocType}", gated by permission and opening Quick Entry or the full form.
  - Page sizes 20/100/500/2500, "select all matching", and a card layout on phones.
  - Saved filters: delete confirmation, global filters, duplicate names rejected.
  - Desk's menu links and the List Settings dialog.
  - A typed Bulk Edit control.
- **Views:** a ViewSwitcher that only offers working views; Image, Report, Kanban (board and Select modes) and Calendar (month); FrappeViews carrying filters out of the List view.
- **Core, for the CRM:**
  - `StatusBadge` / `StatusDot` `color` and `ColumnDef.status`;
  - LifecycleBar per-step state;
  - FileDropzone;
  - SearchCombobox static options and multi-select;
  - Timeline icons and `onItemSelect`;
  - LinkInput groups and icons;
  - IconStatCard trend;
  - EmptyState;
  - the RichTextEditor insert API;
  - MonthInput;
  - Stepper overflow;
  - the AssigneeGroup description line (the P34 follow-up);
  - the TagInput fix.
- **Simulator:** handlers get the real permission engine and row filter through `FixtureContext`, and docinfo lists Communications. Everything is labelled SIMULATED, and every new handler cites its Frappe source file:line.

**What was migrated in CRM.** Branch `crm/p35-ds-adoption` = `d244b64`, consuming 0.6.0 only:
- M1/M2 `EditableTitle` and `StatusBadge` on the Lead, Contact and Organization pages.
- M4–M6 `PageHeader` and `StatusBadge` on the activity pages.
- M3 one shared `AlertDialog` delete confirm for the four detail pages.
- M13 `DropdownMenuShortcut`.
- M14 `ColorInput`.
- M8 `RichTextEditor` in the email composer.

M7 (bulk Add Tags → `TagInput`) is on `crm/p35-needs-070` (`12a1c10`). With 0.6.0 the TagInput "No results" list blocks
the Apply button, so M7 needs the 0.7.0-dev.1 fix.

**What remains incomplete.** See §F. In short:
- **Not built:**
  - Gantt, Dashboard, Map, Tree and Inbox views.
  - Grid CSV download/upload.
  - Email preview.
  - Report Builder save/aggregates.
  - Calendar week/day views.
  - Real controls for Signature, Geolocation, Barcode and Icon.
  - Datetime time-zone editing.
- **Not validated:** nothing has run against an authenticated real Frappe site.

**Overall completion.**
- **Denominator:** fixed before implementation as the applicable rows of the Form and List requirement lists (307 rows minus 6 N/A = 301). A row is COMPLETE only when a test exercises its behaviour.

  | | 0.6.0 | 0.7.0-dev.1 |
  |---|---|---|
  | Form | 79 / 181 = 43.6 % | **155 / 181 = 85.6 %** |
  | List | 69 / 120 = 57.5 % | **103 / 120 = 85.8 %** |
  | Total | 148 / 301 = 49.2 % | **258 / 301 = 85.7 %** |

- **Evidence behind the 258:**
  - **177** rely on the in-package simulator for at least part of their evidence.
  - **62** have an essential behaviour that is a server write or aggregate, so they are listed for real-site validation.
  - **0** have real-site evidence.
  - In other words, "85.7 %" means "implemented and tested on unit tests and the simulator". It does not mean "verified against Frappe".

## B. Form View coverage matrix

Every row A1…P4 is in `COVERAGE.md` §4a, with status, layer, file, test, showcase, evidence level and limitations.

| Section | 0.6.0 C / P / M / N/A / B | 0.7.0-dev.1 C / P / M / N/A / B |
|---|---|---|
| A Fields | 13 / 26 / 6 / 0 / 0 | 31 / 14 / 0 / 0 / 0 |
| B Layout | 5 / 3 / 0 / 0 / 0 | 6 / 2 / 0 / 0 / 0 |
| C Conditional | 6 / 1 / 0 / 0 / 0 | 6 / 1 / 0 / 0 / 0 |
| D Permissions | 8 / 3 / 0 / 0 / 0 | 9 / 2 / 0 / 0 / 0 |
| E Defaults / fetch | 5 / 2 / 0 / 0 / 0 | 7 / 0 / 0 / 0 / 0 |
| F Link | 5 / 5 / 0 / 0 / 0 | 10 / 0 / 0 / 0 / 0 |
| G Child tables | 8 / 5 / 1 / 0 / 0 | 12 / 1 / 1 / 0 / 0 |
| H Lifecycle | 10 / 4 / 0 / 0 / 0 | 14 / 0 / 0 / 0 / 0 |
| I Workflow | 7 / 0 / 0 / 1 / 1 | 7 / 0 / 0 / 1 / 1 |
| J Status / header | 7 / 3 / 1 / 0 / 0 | 10 / 1 / 0 / 0 / 0 |
| K Menus | 0 / 5 / 10 / 1 / 0 | 15 / 0 / 0 / 1 / 0 |
| L Print | 0 / 4 / 1 / 1 / 1 | 4 / 1 / 0 / 1 / 1 |
| M Connections | 0 / 0 / 6 / 0 / 0 | 6 / 0 / 0 / 0 / 0 |
| N Submission | 5 / 1 / 0 / 0 / 0 | 6 / 0 / 0 / 0 / 0 |
| O Email | 0 / 0 / 9 / 0 / 0 | 8 / 0 / 1 / 0 / 0 |
| P Website link | 0 / 0 / 4 / 0 / 0 | 4 / 0 / 0 / 0 / 0 |

## C. List View coverage matrix

Every row A1…J11 is in `COVERAGE.md` §4b.

| Section | 0.6.0 C / P / M / N/A / B | 0.7.0-dev.1 C / P / M / N/A / B |
|---|---|---|
| A Columns | 9 / 1 / 0 / 1 / 1 | 10 / 0 / 0 / 1 / 1 |
| B Filters | 11 / 1 / 3 / 0 / 0 | 13 / 1 / 1 / 0 / 0 |
| C Sort & saved filters | 9 / 1 / 1 / 2 / 1 | 11 / 0 / 0 / 2 / 1 |
| D Grouping & sidebar | 6 / 3 / 3 / 0 / 0 | 11 / 1 / 0 / 0 / 0 |
| E Row status | 8 / 2 / 2 / 0 / 0 | 10 / 1 / 1 / 0 / 0 |
| F Bulk actions | 15 / 3 / 0 / 0 / 1 | 18 / 0 / 0 / 0 / 1 |
| G Create / Quick Entry | 0 / 4 / 5 / 0 / 0 | 9 / 0 / 0 / 0 / 0 |
| H Views | 0 / 0 / 10 / 0 / 0 | 3 / 2 / 5 / 0 / 0 |
| I Count & pagination | 7 / 1 / 1 / 0 / 0 | 8 / 1 / 0 / 0 / 0 |
| J List menu | 4 / 1 / 6 / 0 / 0 | 10 / 0 / 1 / 0 / 0 |

Views at the four levels the brief asked for (switcher entry / implementation / data / actions and filters):
- **Image, Kanban, Calendar and Report:** all four levels exist, on unit tests and the simulator. Report and Calendar are PARTIAL.
- **Gantt, Dashboard, Map, Tree, Inbox:** none of the four levels. They are never offered in the switcher; the reasons are in `docs/components/views.md` §7.

## D. Missing features implemented

`COVERAGE.md` §6 has, for each feature, the previous gap, architectural decision, public API, files, tests, showcase
and docs. `CHANGELOG.md` 0.7.0-dev.1 lists every addition.

**Architectural decisions that apply throughout:**
- Generic UI lives in Core: RecordMenu, ConnectionsPanel, EmailComposer, ReminderDialog, PrintPreviewFrame, GroupBySidebar, ViewSwitcher, ImageGrid, KanbanBoard, CalendarMonth, FileDropzone, MonthInput, EmptyState.
- Server operations live in the Frappe layer: FrappeRecordMenu, FrappeFormPrint, FrappeConnections, FrappeEmailComposer, FrappeQuickEntry, useGroupByCounts, FrappeListSettingsDialog, the Frappe*View adapters and FrappeViews.
- `check:boundaries` passes, including its dist rules: the core entry reaches no Frappe module, and the frappe entry reaches nothing in `frappe/testing`.

**Test names and Showcase:**
- Tests are named by row id: `FV.<section><n>`, `LV.<section><n>`, `CORE.<gap>`.
- Showcase has 6 new pages, all labelled SIMULATED where a backend is involved. The smoke run covers 73 pages × 4 theme/language combinations with 0 console errors.

## E. CRM adoption report

Per-area detail is in `CRM-MIGRATION.md`.

**Classification of the 98 CRM rows at baseline:**

| Status | Rows |
|---|---|
| Already on the DS | 30 (all 28 lists use the Core ListView) |
| Migrate now with 0.6.0 | 15 |
| Need a new DS capability | 13 |
| CRM-specific | 13 |
| N/A | 5 |
| Blocked by mock mode | 9 |

**Status after P35:**
- **Migrated now:** 9 of the 15 (M1–M6, M8, M13, M14), on `d244b64`.
- **Built but held back:**
  - M7 is on `crm/p35-needs-070`.
  - M10 (DataGrid) is not committed: it scrolls sideways at 390 px. The patch is in the session scratchpad.
- **Waiting on an owner decision:** M9, M11, M12 (§H).
- **Rule followed:** every change to a shared file is gated by `useDsScope()`.

**Regression of `d244b64` on 0.6.0 (local static build):**

| Check | Result |
|---|---|
| CRM typecheck | 30 errors, the same list as baseline |
| Build | ✓ |
| Route sweep | 82 loads, 0 console errors |
| Mock flows | 16 / 0 |
| Records-assign | 111 / 0 |
| 28 lists | 112 / 112 |
| Tags / assign | 43 / 43 en, 43 / 43 ar |
| Legacy interactions | 56 / 0 |
| Migrated UI | 344 / 0 (8 combinations) |
| Service Desk / Service Management + legacy routes | 172 loads, 0 console errors; 163 identical, 9 differ by 2–5 px, inside the 2–16 px noise between two baseline captures |

**Against 0.7.0-dev.1:** the CRM builds and passes the same suites against a local 0.7.0-dev.1 pack. Its pinned
dependency was not changed. The only visual change is the role line returning under each assignee on the detail pages.

**New DS capabilities the CRM still has to adopt** (`CRM-MIGRATION.md` §4): StatusBadge `color`, LifecycleBar `step`,
FileDropzone, SearchCombobox multi, Timeline icons, the phone card layout, LinkInput groups, EmptyState, MonthInput. They
reach the CRM only after a package release.

## F. Remaining gaps

`COVERAGE.md` §7 has the full lists.

- **Missing:**
  - Form: FV.G9 grid CSV, O5 email preview.
  - List: B15 90-day default filter, E11 unseen-in-bold, J9 Edit DocType.
  - Views H4 Gantt, H6 Dashboard, H7 Map, H8 Tree, H9 Inbox.
- **Partial:**
  - Datetime TZ; Currency symbol; Markdown, HTML and Code editors; Signature, Geolocation, Barcode and Icon (read-only); JSON validation; Phone; Fold; placeholders.
  - `collapsible_depends_on` live update; naming-series preview; `download_pdf` (not simulated).
  - Report view (no save_report or aggregates); Calendar (month only); "Load more" only when grouped; Date In / Not In; the sidebar Edit modal.
- **Backend-dependent:**
  - BLOCKED: real Workflow (FV.I9), real print formats (FV.L7), the `user_settings` merge (LV.A6b), List Filter permissions (LV.C14), every bulk write (LV.F19).
  - The 62 simulator-COMPLETE server-write rows (`COVERAGE.md` §5).
- **Real-Frappe validation:**
  - No authenticated session has run against a real site, and no write has been verified on one.
  - Realtime has only a fake socket.
  - Restricted users and User Permissions have been tested only on the simulator.
- **Known bugs and deviations:**
  - DataGrid has a fixed `min-w-[32rem]` on phones.
  - A FrappeListView DocType that isn't Quick Entry eligible, with no `onOpenFullForm` given, shows the full form inside the dialog.
  - Quick Entry saves through `savedocs` and has no Submit step.
  - Rename and Delete leave routing to the host.
  - Kanban `old_index` behaves as Desk does.
  - The Report-view editability deviation.
  - F9: there is no *source* rule against importing the simulator; the dist rule covers it.
- **Future enhancements:** Report Builder, Kanban board editing, Calendar week/day views and drag, Gantt/Tree/Dashboard, the email extras, and an export-snapshot gate in CI.

## G. Test report

**Package checks** at the final commit on `feat/0.7.x/p35-coverage`. HEAD `6d97da5`, plus this report.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 (11.2 s) |
| `npx vitest run` | **72 files passed; 1415 passed, 10 todo, 0 failed** (0.6.0: 52 files, 1144 passed, 11 todo) |
| `npm run build` | exit 0; extract-css regenerated identical styles; `git status --short` empty |
| `npm run check:boundaries` | `✔ boundaries OK` (source and dist rules) |
| `npm run check:package` | `✔ package OK` (13 exports; 775 files, 888.7 kB packed per the integration run) |
| `npm run showcase:build` | exit 0 (integration run at `826013d`; later commits are docs and e2e scripts only) |
| `node e2e/showcase-smoke.mjs …` | PASS: 73 pages × 4 combinations, 0 page / console errors (`826013d`) |
| `bash e2e/consumers/run.sh …` | consumer a (Tailwind 3 + preset) and consumer b (no Tailwind): tsc ✓, build ✓, one React copy each (`410169d`) |
| Export snapshot vs 0.6.0 dist | 0 exports removed; 66 changed signatures, nearly all additive |

Two pre-existing breaks in the check scripts were fixed; both failed on 0.6.0 too:
- `showcase-smoke.mjs` skipped new pages and had two stale interaction checks.
- `consumers/run.sh` copied demo files with repo-relative imports.

CRM commands and results are in §E and `CRM-MIGRATION.md`.

**Evidence levels:** unit tests and the simulator, plus the existing recorded real 15.110 read responses. **No real-site run.**

## H. Release readiness

- **Package:** ready for a **0.7.0 release candidate** as far as the local checks go. It is not ready to be called Frappe-compatible.
  - **Breaking changes:** no export removed. Signature notes for hand-written mocks and wrappers:
    - `RichTextEditor` is now a forwardRef component.
    - `groupOf` may return an array.
    - SearchCombobox `search` and `onSelect` are optional.
    - `Messages` has new keys.
    - `FormController`, `DocStore` and `FormServices` have new members.
  - **32 behaviour changes** are listed in `CHANGELOG.md`. Examples:
    - FrappeForm shows the ⋯ menu and Connections tab by default.
    - FrappeListView shows the page-size picker by default.
    - System Managers get the Desk menu entries.
    - Create actions need the create right.
    - Workflow DocTypes get the workflow indicator.
    - Ctrl+S runs the visible primary action.
    - A dirty submitted document shows Update only.
    - Unsupported fieldtypes are read-only.
    - The local saved-filter adapter rejects duplicate names.
    - Empty groups are labelled "Not Set" / "No Tags".
  - **Before a release:** decide the owner questions below, then do a real-site validation pass (`e2e/frappe-site/` is prepared but has never run).
- **CRM:**
  - `crm/p35-ds-adoption` (`d244b64`) is deployable with the current 0.6.0, subject to the usual approval, backup, drill and smoke procedure.
  - `crm/p35-needs-070` (M7) can be deployed only after a release that contains the TagInput fix.
- **Rollback:** the CRM changes are source-only and gated per scope, so the usual kit applies. The package is unreleased, so there is nothing to roll back.
- **Owner decisions pending:**
  1. `selectionMode` default `"bar"` → `"header"`.
  2. CRM `SearchableSelect` / `ClientPicker` → `LinkInput` (M11, M12).
  3. CRM record-menu confirm bars → `AlertDialog` (M9).
  4. M10 DataGrid while it scrolls sideways on phones.
  5. The Report view deliberately allows editing that Desk 15.110 blocks on DocTypes without a Table field (`report_view.js:772-777`).
  6. A Frappe test site and account for real-site validation.
- **Follow-up work:**
  - Real-site validation of the 62 server-write rows and the 5 BLOCKED rows.
  - A DataGrid phone layout.
  - The missing views and features in §F.
  - The CRM adopting the 0.7 capabilities after a release.
  - A source boundary rule for the simulator (F9).

## Branches (local only, nothing pushed)

| Repository | Branch | HEAD | Content |
|---|---|---|---|
| package `/home/frappe/sfui-dev/p35-pkg` | `feat/0.7.x/p35-coverage` | this commit | 0.7.0-dev.1 integration (merges of `feat/0.7.x/p35-{form,record,list,views,core,docs}`) |
| CRM `/home/frappe/sfui-dev/p35-crm` | `crm/p35-ds-adoption` | `d244b64` | M1–M6, M8, M13, M14 on 0.6.0 |
| CRM | `crm/p35-needs-070` | `12a1c10` | as above + M7 (needs the 0.7 TagInput fix) |
