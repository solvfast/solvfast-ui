# Changelog — @solvfast/ui

Versioning: SemVer 0.x — patch = no API or visual change; minor = additive or intentional visual change;
breaking changes bump the minor while in 0.x and are labelled **BREAKING**. Tags are created only on a clean tree,
with the owner's approval. Releases are published by the owner (GitHub Packages, `@solvfast` org).

## [Unreleased]

## 0.7.0-dev.2 (unreleased) — P36

P36 — owner decisions on the P35 open items, and real-site validation **prepared, not run**. `package.json` `version` is
`0.7.0-dev.2` (not tagged, not published). Coverage of the fixed P35 list is unchanged (**258 / 301**,
`docs/audit/p35/COVERAGE.md` §8 lists the rows whose evidence changed). **No real-site validation has been done;** every
write path is still simulator-only. Index: `docs/audit/p36/README.md` (repository only).

Owner decisions (final): (1) Desk's header-actions selection is the List View standard; (2) CRM pickers migrate per usage,
by semantics only; (3) CRM confirmations use `AlertDialog`; (4) no CRM Commission `DataGrid` migration until its responsive
behaviour is verified; (5) Report view editing matches Frappe 15.110 by default, with an explicit opt-in. (2)–(4) are CRM
work; the package delivers (1), (5) and the DataGrid layout (4).

### Added
- **DataGrid (Core)** — `layout="table" | "cards" | "auto"` for phones: one card per row (the primary column as the title,
  the others as label / value lines; `DataGridColumn.mobile: "primary" | false`, as ListView's `ColumnDef.mobile`).
  `"auto"` switches on the grid's **container** width (ResizeObserver; `cardsBelow`, default 640 px), not the window; an
  unmeasured width (SSR, hidden tab) gives the table. Cards keep the grid's editing (one row inline at a time; tap a value
  or the "Edit row {n}" toggle; Escape / tap outside stops), the row menu, selection, Add Row, paging and Desk's shortcuts;
  no sideways scroll. `minTableWidth` (table layout only; default `"32rem"`, `false` = none). `FrappeChildTable` does not
  forward these props yet (Frappe Table fields keep the table).
- **List (Core)** — Ctrl/⌘-click on a row toggles its selection instead of opening it (Desk `list_view.js:1296-1306`; not
  on links).
- **Report view (`@solvfast/ui/frappe`)** — `FrappeReportView` `editable`: `"desk"` (default) | `"strict"` (adds the
  field-permlevel write, `write`-not-`create`, `submit` on submitted documents, `read_only_depends_on` always evaluated) |
  `(df, row, info) => boolean` (`info.desk` = Desk's verdict). Child-table cells are editable as in Desk and save through
  `frappe.client.set_value` on the child row.
- **Exports from `@solvfast/ui/frappe`** — `deskCanWrite`, `evaluateReportReadOnlyDependsOn`, `isNonStdField`,
  `rowFromSavedDoc`, `updateCachedRows`; types `ReportEditable`, `ReportEditInfo`, `ReportEditMode`, `ReportEditOptions`;
  `selectionAfterBulk(kind, outcome, count)` (Desk's selection outcome per bulk action, `src/frappe/list/bulk.ts`).
- **Messages** — `listNoActions` ("No actions available for the selection"), `coreGridEditRow` ("Edit row {n}"), en + ar.
- **Simulator (not public)** — `reportSetValueHandler` in `src/frappe/testing/handlers/views.ts`: SIMULATED
  `frappe.client.set_value` with the child-table branch, the submit right and update-after-submit validation. It is **not**
  exported from `@solvfast/ui/frappe/testing` (the showcase imports it directly) and not part of the builtin handlers.
- **Real-site validation infrastructure (repository only, NOT RUN)** — `docs/audit/p36/VALIDATION-MATRIX.md` (every COVERAGE
  row classified, 75-test catalogue), `e2e/frappe-site/run-matrix.mjs` (matrix runner: `--dry-run`, `--write`,
  `--browser`), `staging-seed.py` / `staging-teardown.py` with `fixtures/staging/*.json`, `guards.mjs` /
  `staging_guards.py` / `production-denylist.json` (refuse production names, loopback, a missing owner approval or a
  private directory inside a repository), a FrappeForm / FrappeListView / FrappeViews harness, `tests/frappe-site-guards.test.ts`
  (23 tests).

### Changed (behaviour visible to 0.7.0-dev.1 consumers)
1. **List selection follows Frappe Desk's header actions by default** (owner decision 1). `ListView` and `FrappeListView`
   now default to `selectionMode="header"`: no bulk bar; with ≥ 1 row selected the header shows "{n} items selected" +
   Clear, and the primary action ("Add {DocType}" / `primaryAction`) is replaced in place by the Actions menu; clearing
   the selection restores it. `selectionMode="bar"` remains as an explicit opt-in (not Desk's layout).
   **What apps must do:**
   - Any `ListView` / `FrappeListView` with `selectable` (or `bulk`) and no `selectionMode` now renders the header mode:
     `bulkActions` are Actions-menu items, and the column titles are replaced by the count while rows are selected (header
     sorting is unavailable during a selection — offer `controls.sortMenu`). To keep the bar, pass `selectionMode="bar"`.
   - Put the "New" button in `primaryAction`, not `toolbarActions`: only `primaryAction` gives way to the Actions menu
     (Desk's swap); `toolbarActions` content is never hidden.
   - `renderBulkActions` content renders in the toolbar next to the Actions menu (header) instead of inside the bar.
   - In header mode the selected rows are resolved across pages (`rowByKey`), so Print's draft / cancelled check and the
     workflow `get_common_transition_actions` see every selected row; opting back into `"bar"` keeps the current-page-only
     `ctx.rows`.
2. Header mode swaps the primary action on the selection alone (Desk `list_view.js:1634`): when no action applies, the
   Actions menu shows a disabled "No actions available for the selection" item instead of bringing the primary action back.
3. `FrappeListView` / `useFrappeBulkActions` / `FrappeBulkActions`: **the selection after an action follows Desk's
   callbacks** (`selectionAfterBulk`). Edit and workflow actions keep the selection (the list reloads); Submit / Cancel
   clear it only when every document went through (a partial failure keeps it and reloads; a queued job keeps it, no
   reload); dismissing Clear Assignment's confirmation clears the selection and reloads (Desk's `reject_action`). Assign
   To / Apply Assignment Rule / Add Tags / Delete (clear on success) and Export / Print (keep) are unchanged.
4. **`FrappeReportView` / `isCellEditable` (LV.H1): inline editing follows Frappe 15.110's report view by default**
   (owner decision 5), verified from report_view.js `is_editable` + `build_row` and frappe-datatable's `=== false` check.
   On a DocType without a Table field, plain fields are editable and a field with `read_only_depends_on` is editable when
   it evaluates false on the loaded row (true → read-only); with a Table field `read_only_depends_on` is not evaluated; the
   write right is Desk's `can_write` (level-0 write or create) and the field's permlevel is not checked (the server
   silently resets such a change). Before (0.7.0-dev.1): `read_only_depends_on` fields were never editable, a permlevel
   without write locked the cell, and child cells were read-only. `editable="strict"` restores the per-permlevel check.
5. `FrappeReportView` refreshes the edited row (every loaded row of that document) from the returned document, sends
   nothing for an unchanged value, and treats a response without `message` as a failure — the editor stays open (Desk).
6. Repository only: `e2e/frappe-site/seed-crm-site.py` and `teardown-crm-site.py` now refuse to run (they targeted a
   production site); the legacy `seed.py` / `validate.mjs` and the harness proxy refuse anything but an approved staging site.

Unchanged: `DataGrid`'s default `layout="table"` renders exactly as before (same classes), so `FrappeChildTable` and other
existing grids are unaffected. `package.json` `exports` unchanged.

### BREAKING (vs 0.7.0-dev.1)
- `isCellEditable(df, row, levels)` → `isCellEditable(df, row, { fields, levels, issingle?, child?: { name }, mode?: "desk" |
  "strict", onIssue? })`. Migrate: pass the DocType's `fields` and the user's `levels` in the options object; pass
  `mode: "strict"` for the 0.7.0-dev.1 permlevel check. (0.7.0-dev.1 was never released; 0.6.0 has no `isCellEditable`.)

### Fixed
- Header selection mode: the primary action no longer stays visible while rows are selected and no action applies.
- `FrappeReportView`: a response without `message` was treated as a successful save; an unchanged value sent a
  `set_value` request.
- The Report view editability deviation recorded in P35 (`views.md` §3, "deliberately not :772-777") rested on a misread of
  Desk; the rule now matches 15.110 (Changed 4).

### Docs
- `docs/LIMITATIONS.md`, `docs/FRAPPE.md`, `docs/CONSUMING.md`, `docs/release/LISTVIEW-FRAPPE-PARITY.md`: header selection is
  the default; DataGrid on phones; Report view editability; real-site status "prepared, not run"; Frappe 15.110 server
  rules the validation run must confirm (read from source, not yet observed on a site).
- `docs/components/list.md` (selection default, "The selection after an action"), `views.md` §3 (truth table, save path,
  opt-in), `forms.md` (DataGrid on phones), `docs/FEATURES.md` (F20, F21, C3, C4) — updated by the workstreams.
- `docs/audit/p35/COVERAGE.md` (§8 P36 changes; no status change), `docs/audit/p35/CRM-MIGRATION.md` (§5 decisions),
  new `docs/audit/p36/README.md` and `VALIDATION-MATRIX.md` (repository only).

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written in P36; every real-site result in
  `VALIDATION-MATRIX.md` is BLOCKED (not run). Running it needs an owner-approved, isolated staging site
  (`docs/audit/p36/README.md` §"What the owner must provide").
- Evidence for the P36 changes is jsdom / simulator only (`tests/list-selection-desk.test.tsx`,
  `tests/list-selection-header.test.tsx`, `tests/frappe-views-report.test.tsx` 26 `LV.H1`, `tests/datagrid-p36.test.tsx`
  14 `CORE.DG*`, `tests/frappe-site-guards.test.ts` 23) plus one real-browser check of the showcase DataGrid section
  (`e2e/datagrid-mobile.mjs`, Chromium, 360 / 390 / 1280 px × en / ar × light / dark — run in the W3 worktree).
- Integration gates (at this commit): `npx vitest run` — 75 files, 1505 passed, 10 todo, 0 failed (0.7.0-dev.1: 72 files,
  1415 passed); `npm run typecheck` exit 0; `check-boundaries` source rules OK. Not run at integration: `npm run build` (so `dist/styles/full.css` for consumers without Tailwind has not been rebuilt with the new DataGrid
  utilities), `check:package`, `showcase:build`, `e2e/showcase-smoke.mjs` (its list checks were rewritten for the header
  default by W1 and have not run), `e2e/consumers/run.sh`.

## 0.7.0-dev.1 (unreleased)

P35 — Form View / List View coverage. Coverage of the fixed P35 requirement list (`docs/audit/p35/COVERAGE.md`, repository
only): **148 / 301 = 49.2 % at 0.6.0 → 258 / 301 = 85.7 %** (Form 155 / 181, List 103 / 120). **No authenticated real-site
validation has been done; every write path is simulator-only** (`docs/LIMITATIONS.md`). `package.json` `version` is
`0.7.0-dev.1` (not tagged); `files` now also ships `docs/components/views.md` and `docs/components/p35-core.md`.

Exports: **0 removed** against 0.6.0 (snapshot of the built `dist/*.d.ts`, TypeScript checker: `.` 466 → 553, `./frappe`
494 → 620, `./frappe/testing` 25 → 29, `toast` / `chart` / `form` unchanged); `package.json` `exports` unchanged (13
entries). 66 exports changed signature, all widening; the ones a consumer could notice are listed under "Export
signatures" below.

Gates (integration, at `826013d`; `410169d` changes only `e2e/consumers/run.sh`, whose gate was re-run): typecheck exit 0;
`npm test` 72 files, 1415 passed, 10 todo, 0 failed; `npm run build` exit 0 (775 files, 888.7 kB packed; extracted styles
regenerated identical); `check:boundaries` OK (source + dist rules); `check:package` OK (13 exports, 507 built files);
`showcase:build` OK; `e2e/showcase-smoke.mjs` PASS (73 sections × light / dark × en / ar, 0 page / console errors);
`e2e/consumers/run.sh` both clean consumers (Tailwind 3 + preset; no Tailwind) tsc + build OK, one React copy. None of these
is a real-site check.

### Added
- **Form (`@solvfast/ui/frappe`)**
  - `FrappeQuickEntry` (Desk's Quick Entry dialog over `FrappeFormView`, "Edit Full Form" hand-over), `useQuickEntryHost`,
    `quickEntryFields` / `quickEntryFilter` (port of quick_entry.js:59-110); `FrappeForm` opens it from a Link's
    "Create a new X" when the target is quick-entry eligible; `FrappeFormProps.onOpenFullForm`.
  - `FrappeFormView` slots and options: `menu`, `extraTabs`, `fieldFilter`, `hotkeys`; header image from `meta.image_field`;
    "See on Website" (`__onload.is_website_generator` + `published` + `route`, fallback `has_web_view`).
  - Undo / Redo: `DocStore.undo/redo/canUndo/canRedo/eraseHistory`, `HistoryEntry`; Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y.
  - `FormController`: `addCustomButton` / `removeCustomButton` / `clearCustomButtons` (grouped buttons form a dropdown),
    `save(action?)`, `checkMandatory()`, `selectedWorkflowAction`, `undo()` / `redo()` / `canUndo` / `canRedo`;
    `before_workflow_action` is abortable; `FrappeWorkflowActionsProps.beforeApply` / `afterApply`.
  - Server save errors on fields: `fieldErrorsFromFrappeError` (MandatoryError, LinkValidationError).
  - Fieldtypes: Autocomplete control (`df.options`); `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`, `FieldtypeIssue`.
  - `useUnsavedChangesBlocker` (router-agnostic in-app navigation guard); `defaultLinkHref`; `FormServices.builtin`,
    `FormServices.quickEntry`.
  - Client / boot: `getDoc` keeps getdoc's `_link_titles` (`linkTitlesOf`, `LoadedDocWithTitles`); `userDefaultsFromBoot`,
    `FrappeBootPayload.defaults` / `user_permissions`, `FrappeBoot.userDefaults`.
- **Record (Core `@solvfast/ui` + `@solvfast/ui/frappe`)**
  - Core: `RecordMenu`, `groupMenuItems`, `RenameDialog`, `PrintPreviewFrame`, `printSrcDoc`, `ConnectionsPanel`,
    `EmailComposer`, `isValidEmail`, `ReminderDialog` (+ `toFrappeDatetime`, `remindAtFor`, `reminderSetText`).
  - Frappe: the form ⋯ menu `FrappeRecordMenu` + `formMenuItems` / `FORM_MENU_ORDER` / `printAllowedForStatus` /
    `customizeHref` (Print, Email, Links, Duplicate, Copy to Clipboard, Rename, Reload, Delete, Remind Me, Undo / Redo,
    Customize, New — Desk's order and rules); `FrappeFormPrint`, `FrappePrintPreview` (+ `downloadPdfUrl`, `printViewUrl`,
    …); `FrappeConnections`, `connectionsFromMeta`, `useOpenCounts`; `FrappeEmailComposer`, `emailMakeArgs`;
    `FrappeReminder`.
- **List**
  - Core: `GroupBySidebar` and `ListView` `aside` / `asideOpen`; multi-bucket grouping (`GroupBucket`); page-size picker
    (`ListPagination pageSize/pageSizes/onPageSize`, `useListState().setPageSize`, `ListViewProps.pageSizes`); "Select all
    {n} matching" (`ListViewProps.selectAllMatching`, `BulkAction.allMatching`, `SelectionMatching`); phone cards
    (`ListViewProps.layout: "table" | "cards" | "auto"`, `ColumnDef.mobile`); `SavedFilter.global`, `SaveFilterOptions`,
    `SavedFilters canSaveGlobal`, `ListViewProps.savedFiltersGlobal`; `FilterField.operators`; `ListActions.removeCondition`.
  - Frappe: workflow state in the row indicator from the DocType (`indicatorWorkflowFromMeta`); Assigned To / Tags filter
    fields, per-user / per-tag grouping, `TagsCell`; group-by sidebar with server counts and tag stats (`sidebar`,
    `FrappeGroupBySidebar`, `useGroupByCounts`, `useTagStats`) + "Toggle Sidebar"; "Add {DocType}" (`create`,
    `FrappeListCreate`); menu entries User Permissions / Role Permissions Manager / Customize / List Settings
    (`FrappeListSettingsDialog`, `save_listview_settings`), `onNavigate`, `userPermissionsUrl`, `rolePermissionsUrl`,
    `customizeUrl`; typed Bulk Edit value (`BulkEditValue`); `DESK_PAGE_SIZES`; `actsAsSystemManagerFor`.
- **Views** — Core: `ViewSwitcher`, `ViewToolbar`, `ImageGrid`, `ImageView`, `KanbanBoard`, `CalendarMonth` and helpers;
  Frappe: `FrappeViews`, `availableViews`, `FrappeReportView` (column picker incl. child fields, permission-aware inline
  edit, totals), `FrappeImageView`, `FrappeKanbanView` (Kanban Board or Select-field mode), `FrappeCalendarView`,
  `useFrappeViewList`. Gantt, Dashboard, Map, Tree and Inbox are not implemented (`docs/components/views.md` §7).
- **Core capabilities for the CRM** — `StatusBadge` / `StatusDot` `color` (+ `STATUS_PALETTE`, `resolveStatusColor`,
  `statusColorStyles`); `LifecycleStateItem.step` (`past` / `current` / `future` / `skipped` / `failed`); `FileDropzone`;
  `SearchCombobox` static `options`, `multiple`, `values`, `variant`; `TimelineItem.icon` rendered + `tone`,
  `Timeline onItemSelect` / `showActor`; `Suggestion.group` / `icon` (LinkInput, TagInput); `IconStatCard trend`;
  `EmptyState`; `RichTextEditorHandle` (`insertText`, `insertHtml`, `focus`, `getHtml`) + `toolbarEnd`; `MonthInput`;
  `Stepper overflowCue` / `followCurrent`; `AssigneeGroup` list variant shows `description` under the name.
- **Integration (defaults and wiring)** — `FrappeForm` `menu?: boolean | FrappeFormMenuOptions | ReactNode | ((ctx) => ReactNode)`
  and `connections?: boolean | FrappeFormConnectionsOptions` (types exported; `FrappeFormMenuOptions.onOpened(doc, "duplicate"
  | "new")`); `FrappeFormView` `menu` also takes a function of `FrappeFormMenuContext` (`frm`, live `doc`, `dirty`, `reload`,
  `showTab`, `tabs`); `FrappeListCreate.onOpenFullForm` / `defaults`; `FrappeListViewProps.onQueryStateChange` (FrappeViews
  uses it to carry the List view's filters and sort); `FrappeProviderProps.userDefaults` / `FrappeSettings.userDefaults`;
  Core `ColumnDef.status` (`color` / `tone` / `variant` → the default cell renders a `StatusBadge`).
- **Simulator (`@solvfast/ui/frappe/testing`)** — handlers receive a `FixtureContext` (exported type: permission engine,
  `assertDoc` / `assertDoctype`, the transport's row filter `rows`, `printSettings()`, clock, user, options); two-argument
  handlers still work. The entry re-exports `KANBAN_BOARD_FIXTURE_META`, `VIEWS_DEMO_META`, `viewsDemoBackend`.
  SIMULATED handlers for `get_group_by_count`, `get_sidebar_stats`,
  `save_listview_settings`, `get_open_count`, `get_html_and_style`, `communication.email.make`, `get_email_template`,
  `create_new_reminder`, `get_kanban_boards`, `update_order_for_single_card`, `calendar.get_events`.
- **Showcase** — SIMULATED pages `#frappe-form-p35`, `#frappe-record-actions`, `#p35-list`, `#frappe-views`; Core pages
  `core-fields`, `file-dropzone`, `combobox-p35`, `empty-trend`, `record-p35`, `editor-stepper-p35`, `record-extras`.

### Changed (behaviour visible to 0.6.0 consumers)
The 32 behaviour changes reported by the integration (`ws/integration.md` §2), in its order, then the export signatures.

**Integration**
1. `FrappeForm` renders Desk's ⋯ menu (`FrappeRecordMenu`) by default; `menu={false}` opts out, a node replaces it.
2. `FrappeForm` adds a "Connections" tab by default when the DocType has a dashboard (`meta.__dashboard` with
   transactions); a form without Tab Breaks therefore gets a "Details" + "Connections" tab bar. `connections={false}` opts out.
3. Duplicate / New from that menu open the unsaved document in the same form; saving it inserts a new document. The form's
   `name` prop is unchanged — route with `menu.onOpened`.
4. `FrappeForm` no longer passes the loaded docinfo, or offers Reload, when the shown document is not the loaded name
   (local copy, new document, saved amendment). Before, a saved amendment and the cancelled original shared docinfo.
5. `FrappeProvider` forwards `boot.userDefaults` to new documents (FrappeForm, Quick Entry, list create);
   `userDefaults={false}` opts out; the app's own `newDocDefaults.userDefaults` wins.
6. `FrappeListView create={{ … }}` with neither `render` nor `onCreate`: before, no Add button; now Add opens
   `FrappeQuickEntry` (eligible DocType), or calls `create.onOpenFullForm`, or shows the Quick Entry dialog with the whole form.
7. `FrappeViews` carries the List view's filters and sort into the other views.
8. `TagInput` closes its suggestion list after Enter / comma creates a tag.
9. Simulator (`@solvfast/ui/frappe/testing`, SIMULATED): record / list / views handlers refuse through the permission
   engine (if_owner, User Permissions, shares) with Frappe's messages instead of a role-only check; `get_group_by_count` /
   `get_sidebar_stats` apply child-table filters and row permissions, equal counts ordered by value; `get_events` supports
   every simulated operator and needs read, `update_order_for_single_card` needs write; `get_docinfo` lists stored
   Communications and `get_communications` returns them (was `[]`); a stored "Print Settings" single also governs the
   builtin multi-PDF print check.

**Form**
10. **Ctrl/⌘+S runs the visible primary action** (Save / Submit → confirm / Update / Amend; Desk's
    `trigger_primary_action`), at document level, only the topmost form; it blurs the focused input first and does nothing
    with `saveDisabled`, without rights or while workflow actions replace the buttons; `hotkeys={false}` opts out. Before:
    save / update, only with focus inside the form.
11. A dirty submitted document shows **Update and no Cancel** (toolbar.js:668-689).
12. **Amend needs the amend and the create right.**
13. Duplicate / Amend copies start from the new-document defaults, with `__run_link_triggers` and `modified_by` reset
    (`no_copy` fields get their default; child rows keep `_amended_from`).
14. **Link "Create a new X" needs the target's create right by default** (was: whenever `onCreateNew` was given).
15. **The open-record link is hidden without read on the target**, and for a session without roles. App overrides
    (`canCreate`, `linkHref`) still decide alone.
16. **Unsupported fieldtypes** (Signature, Geolocation, Barcode, Icon, …) **are read-only** and listed in the form's
    banner (were editable text boxes).
17. `""` in a required field no longer forces a collapsible section open (only `null`, section.js:150).
18. A new document of a workflow DocType gets the workflow's default state.
19. The form header shows the `image_field` avatar and "See on Website".
20. `frm.save("Submit")` asks for confirmation first (Desk `savesubmit`).

**List**
21. **`FrappeListView` shows the page-size picker by default** (20 / 100 / 500 / 2500, stored in `user_settings`
    `List.sf_ui.pageSize`); `pageSizes={[]}` hides it.
22. **System Managers see four more ⋯ entries:** User Permissions, Role Permissions Manager, Customize, List Settings
    (`menu={{ … : false }}` per entry). Import also navigates through `onNavigate` when given.
23. **The empty-state "Create your first …" needs the create right** (was ungated).
24. **The localStorage saved-filter adapter rejects duplicate names** (it replaced them).
25. **Workflow DocTypes get the workflow indicator by default** (`workflow={false}` opts out); with the width cap it takes
    Desk's Status slot.
26. The Frappe group-by "no value" bucket is labelled **"Not Set" / "No Tags"** (was "—"); Assigned To / Tags rows go into
    one group per user / tag, user groups labelled with full names.
27. Saved filters ask for confirmation before removal (System Managers also get an "Is Global" checkbox in FrappeListView).
28. Group-row React keys are prefixed by the group.

**Core**
29. `AssigneeGroup variant="list"` renders `Assignee.description` as a second line (rows without one are unchanged).
30. `RichTextEditor` is a `forwardRef` component: JSX use is unchanged; calling it as a plain function no longer type-checks.
31. `SearchComboboxProps.search` / `onSelect` are optional.
32. `TimelineItem.icon` is rendered (it was ignored).

Also from WS1 (not in the integration list): workflow transitions run Desk's pre-steps — mandatory check (incl.
`mandatory_depends_on`) → `before_workflow_action` → `apply_workflow` → `after_workflow_action`; `frm.save()` checks the
right first.

**Export signatures** (no export removed; every change widens, but these can be noticed):
- `RichTextEditor`: function component → `ForwardRefExoticComponent<RichTextEditorProps & RefAttributes<RichTextEditorHandle>>`.
- `GroupByOption.groupOf` may return `GroupBucket | GroupBucket[]`: code that *calls* it must handle an array; code that
  implements it is unaffected.
- `SearchComboboxProps.search` / `onSelect` are optional — a narrowing only for code that reads the props.
- `Messages` gained required keys and the message-key union grew: a full hand-typed `Messages` object, or a `t` typed
  against 0.6.0's keys passed to `operatorLabel` / `TimelineContext.t` / `buildFrappeListMeta` / `columnsFromMeta` /
  `filterFieldsFromMeta`, no longer type-checks. `useLocale().t` and `Partial` messages are unaffected.
- `FormController`, `DocStore` and `FormServices` gained required members (undo / redo / canUndo / canRedo, custom buttons,
  `save`, `checkMandatory`, `selectedWorkflowAction`, `eraseHistory`, `builtin`): only hand-written mocks need them.
- Widened (optional props / params, new union members): e.g. `ListViewProps`, `ColumnDef` (`mobile`, `status`),
  `FrappeListViewProps`, `FrappeFormProps` / `FrappeFormViewProps` (`menu` also a function), `FrappeProviderProps`
  (`userDefaults`), `FixtureHandler` (optional `ctx`), `BulkAction.run` / `resolveBulkActions` / `SavedFiltersStorage.save`
  (optional extra parameter), `copyDoc` / `amendDoc` / `buildLayout` (optional option), `FrappeListOptions.workflow`
  (accepts `false`). `FormSkeleton` moved to its own module and is still exported from `@solvfast/ui/frappe`.

### Fixed (native Frappe 15.110 mismatches, `docs/audit/p35/C-native.md`)
- F1 Ctrl+S (above). F2 workflow pre / post steps (above). F3 getdoc `_link_titles` are kept and seed the link-title cache,
  so saved forms show Link titles without a search. F4 Link create / open permission defaults (above). F5 Update without
  Cancel (above; `tests/parity/review-r1.test.ts` updated to the native expectation). F6 in-app navigation:
  `onDirtyChange` + `useUnsavedChangesBlocker`. F8 Amend right and copy defaults (above). F7 stale `docs/FRAPPE.md` /
  `docs/LIMITATIONS.md` (Docs below). **F9 not fixed:** no source boundary rule yet forbids `src/frappe/**` from importing
  `./testing` (the dist rule exists).

### Docs
- `docs/FRAPPE.md` rewritten: the entry's contents, every whitelisted method called (rows via `reportview.get`;
  `get_list` for lookups only), writes, `user_settings`, realtime, validation status.
- `docs/LIMITATIONS.md` rewritten for 0.7.0-dev.1: no authenticated real-site validation, simulator-only areas, views not
  implemented and why, known bugs; stale "Not supported: child tables, realtime, per-user list settings" removed.
- `docs/components/forms.md` (P35 APIs, behaviour changes, regenerated fieldtype table — Attach uploads), `record.md` §5,
  `list.md` (stale "selection-bar buttons only", "sidebar not reproduced", "List Settings read only" removed),
  `views.md` (new), `p35-core.md` (new) — both now shipped (`package.json` `files`); integration added forms.md §2.3 / §2.4
  (provider defaults, menu / connections / `FrappeFormMenuContext`), list.md `create` defaults and `onQueryStateChange`,
  record.md / views.md simulator notes, p35-core.md status columns and TagInput.
- `docs/audit/p35/COVERAGE.md`, `docs/audit/p35/CRM-MIGRATION.md` (new); `docs/release/COMPONENT-COMPLETION-MATRIX.md` and
  `LISTVIEW-FRAPPE-PARITY.md` marked superseded where stale.

## [0.6.0] — 2026-11-06

Version decision: **0.6.0** (minor), not 0.5.1. Reason, checked on the public surface `v0.5.0..HEAD`: `src/index.ts` gains
new exports (ExportDialog, DataImportDialog, the import model / views / labels, buildCsv / parseCsv / saveBlob …);
`src/frappe/index.ts` and `package.json` `exports` are unchanged; nothing is removed or renamed (`GroupedImportWarnings` /
`ImportFieldOption` are now aliases of identical Core types; `ExportDialogLabels` gains optional keys). Behaviour visible to
existing consumers changes on purpose: `FrappeExportDialog` labels follow the language (Arabic under `ar`), an empty
selection shows a hint, the File Type resets to CSV on each opening, and both import / export dialogs keep wide content
inside at phone widths. New public API + intentional visual change = minor under the policy above. Dev builds were numbered
0.5.1-dev.1 … dev.5 before this check; they continue as 0.6.0-dev.N. No release commit or tag.

### Added (additive; dev builds 0.6.0-dev.N — not released)
- **Core `ExportDialog`** (core entry): the Design System's Export Data dialog without a backend — File Type, Export Type
  (All / Filtered or Selected (n) / 5 Records / Blank Template, optional counts), field groups with label, key and
  "(Mandatory)", Select All / Select Mandatory / Unselect All, `lockMandatory`, `defaultSelection`, validation (nothing
  selected), loading, error (`renderError`) and success (closes) states; en / ar labels from the message catalogue
  (`export*` keys). `onExport({ fileType, records, fields })` — the host writes the file. Utilities: `buildCsv`,
  `parseCsv`, `saveBlob`, `mandatorySelection`, `orderedSelection`.
- `ExportDialog`: `filtered` (default Export Type = Selected (n) with a selection, else Filtered Records when the list is
  filtered, else All Records; never Blank Template unless `defaultRecords` asks), `ExportField.note` (e.g. a conditional or
  update-only requirement shown after the key).
- Import requirements: `ImportField.requiredOn` (create-only / update-only mandatory), `ImportField.requiredWhen`
  (conditional: `{ test, label, on }`), `validateImport(…, importType)` and `isMandatoryFor`; Update Existing Records checks
  that each row matches an existing record (no duplicate flags then).
- **Core `DataImportDialog`** (core entry): the Data Import tool's steps (Upload → Preview → Import → Result) behind a
  `DataImportAdapter` (`parse`, `fields` with mandatory / per-value checks / aliases, `duplicates`, `run` or
  `runUnavailable: reason`, `template` → the Core ExportDialog). Client-side auto-mapping, per-row validation, duplicate
  detection (existing records and within the file), column mapper, duplicate handling, progress and the run's result —
  never a success the run did not report. Model: `autoMapColumns`, `validateImport`, `importableRows`,
  `importPreviewColumns`. Views: `ImportPreviewTable`, `ImportWarningsPanel`, `ColumnMappingForm`. Labels:
  `DATA_IMPORT_LABELS_EN/AR` (moved to Core, still exported from `/frappe`), `IMPORT_DIALOG_LABELS_EN/AR`.

### Changed (no API change)
- `FrappeExportDialog` renders the Core `ExportDialog` (same props, same `download_template` request); its labels now
  default to the catalogue (Arabic under `language: "ar"`), and an empty selection shows "Select at least one field".
- A host re-render with new-but-equal `groups` / adapter no longer resets the user's picks in `ExportDialog` or the
  unsaved column mapping in `DataImportDialog` (reset only on open or a structural change).
- Phone widths: the Export / Data Import dialogs (Core and `FrappeDataImport`) keep their content inside the dialog
  (`grid-cols-[minmax(0,1fr)]`): a wide preview grid scrolls horizontally instead of widening the dialog past the screen.
- `FrappeImportPreview`, `FrappeImportWarnings`, `FrappeColumnMapping` render the Core views; `FrappeDataImport` keeps its
  server orchestration (every step a server request) on those views.

## [0.5.0] — 2026-11-06

### Added (additive API and an opt-in visual mode = minor per the policy above; tested as dev builds 0.4.1-dev.1 … dev.2)
- **Desk's selection layout for the List View** (Frappe 15.110 `list_view.js:590-598, 1613-1634, 1855-2127`): `ListView` /
  `FrappeListView` `selectionMode="header"` — no bar row; the header shows "{n} items selected" + Clear; the toolbar's new
  `primaryAction` gives way to an **Actions** menu (`ListActionsMenu`) while rows are selected. Default `"bar"`: no change for
  existing consumers. Shift-click range selection (`:1400-1421`).
- **Typed bulk actions**: `BulkAction` gains `tone`, `hidden(ctx)`, `disabled(ctx)` (with a reason), `confirm`, `group`;
  `resolveBulkActions`, `useBulkActionRunner`, `BulkActionContext`, `BulkActionConfirm`.
- **`AssignDialog`** (Core): Desk's Assign To dialog — users, Assign to me (also for single-assignee hosts), current assignees,
  optional Complete By / Priority / Comment.
- **`useFrappeBulkActions`** (`/frappe`): Desk's Actions (order, gates, workflow items asked on every opening, dialogs) as data;
  `FrappeBulkActions` renders the same as bar buttons. `FrappeListView` `selectionMode="header"` uses it (Assign To → `AssignDialog`).

### Fixed
- `ListView.onSelectionChange` fired only when the NUMBER of selected rows changed: unchecking A and checking B in one update
  left a host that mirrors the selection with A — and its bulk action on the wrong record. It now fires on
  every change of the selected set.

## [0.4.0] — 2026-11-04

Frappe-integrated components: the `@solvfast/ui/frappe` entry (client, provider, hooks, `FrappeListView`, `FrappeForm`,
workflow, assignment, timeline, Import / Export, permissions) and the simulator `@solvfast/ui/frappe/testing`; the CRM
handoff is `docs/release/CRM-HANDOFF.md`. **Known limitation:** the Frappe layer is verified against recorded 15.110
responses and the simulator only; no authenticated real-site session or write has been verified yet (docs/LIMITATIONS.md).

### Added
- **Desk Like (the list's favorite heart).** Core `LikeToggle` (a `<button aria-pressed>`, not optimistic, pending /
  error states) and `ListTable` / `ListView` `like`; `FrappeListView` shows it by default for a logged-in user
  (`like={false}` to opt out, `onLikeError`), toggles through `frappe.desk.like.toggle_like`, updates the cached rows
  without a reload, and offers Desk's "Liked by me" filter (`_liked_by like %user%`). Simulator support.
- **Attach / Attach Image upload** in `FrappeField` / `FrappeForm` (`FrappeAttachField`): file picker → `upload_file`,
  attached to the saved document, private unless the field / DocType makes attachments public, `file_url` stored,
  pending and error states, image preview, Clear.


Work towards 0.4.0 (Frappe-integrated components) on branch `feat/0.4.0-frappe`; see docs/CONTRACT-0.4.md.

### Already in the published 0.3.0 tarball but missing from this changelog (published content ≠ tag `v0.3.0`)
- Column manager: PMO's design (`66af191`).
- Date filters like Frappe's — timespans, `between` on dates (`63bbd1b`).

### Added (in progress)
- `@solvfast/ui/frappe`: the 0.4.0 integration contract (`contract.ts`): metadata bundles, documents and docinfo,
  permissions, structured errors, client surface (documents, workflow, assignment, comments), query keys and
  invalidation rules, realtime port, simulated-backend input.
- Real Frappe 15.110 metadata fixtures (`tests/fixtures/real-15.110/`) and the read-only capture script.

## [0.3.0] — 2026-10-19

Additive: every component in PMO's `components/ui` is now in the package, in the package's look, so PMO and new
BildFast projects can import them from `@solvfast/ui`. Two new entries with optional peer dependencies:
**`@solvfast/ui/chart` needs `recharts` 2**, **`@solvfast/ui/form` needs `react-hook-form` 7** (docs/CONSUMING.md §7).
Apps that don't use the new parts see no change: the existing parity suites were rerun (docs/VALIDATION.md).

### Added — Design System v0.3.0 primitives (as in PMO)
- `Alert` (`AlertTitle`, `AlertDescription`), `Progress`, `Toggle` (+ `toggleVariants`), `ToggleGroup` / `ToggleGroupItem`,
  `StatusDot`, `Pill`, `Accordion` (`AccordionItem`, `AccordionTrigger`, `AccordionContent`), `Collapsible`
  (`CollapsibleTrigger`, `CollapsibleContent`), `Breadcrumb` (`BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`,
  `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`), `Pagination` (`PaginationContent`, `PaginationItem`,
  `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`), `Slider`, `AspectRatio`, `HoverCard`
  (`HoverCardTrigger`, `HoverCardContent`), `ContextMenu` (+ 14 parts), `Menubar` (+ 15 parts), `NavigationMenu`
  (+ 7 parts and `navigationMenuTriggerStyle`).
- Their popups render inside the theme scope and carry the package's popper glass, as the dropdown menu does (hover
  card, context menu, menubar; also the navigation menu's panel, which Radix keeps inline).
- Arabic: pagination and breadcrumb strings come from the package messages; their chevrons, and the context-menu and
  menubar sub-menu chevrons, point the reading way; `Progress` fills from the right.

### Added — from PMO
- `SearchCombobox` (+ `ComboOption`, `SearchComboboxProps`): PMO's async combobox (Link fields, repo pickers) without
  React Query. It loads when opened and 200 ms after typing stops, ignores late answers to older searches, and shows
  "Loading…" instead of "empty" while a search runs. Same props; `queryKey` is optional (a reset key).
- `RichText`, `RichTextEditor`, `sanitizeHtml`, `htmlIsEmpty`: PMO's rich-text editor and viewer, with the package's
  field look and toolbar labels in Arabic and English. The rich-text styles ship in theme.css / full.css (`.sf-rich-text`).
- `PageHeader` (back button, title, subtitle, details row, actions; router-free: `onBack`) and `EditableTitle`.
- New message keys: `back`, `loading`, `pagination`, `previous`, `next`, `morePages`, `breadcrumb`, `editTitle`,
  `textFormatting`, `bold`, `italic`, `underline`, `strikethrough`, `bulletedList`, `numberedList`.

### Added — new entries (optional peer dependencies; the core never imports them)
- **`@solvfast/ui/chart`**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
  `ChartStyle`, `ChartConfig` — the Design System's chart helpers. **New optional peer dependency `recharts`
  `^2.15.0`.**
- **`@solvfast/ui/form`**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`,
  `FormMessage`, `useFormField` — the Design System's react-hook-form bindings. **New optional peer dependency
  `react-hook-form` `^7.50.0`.**

### Added — shell
- `PageHeader` inside `AppShell`: a text title becomes the top bar's title (the page's one `<h1>`, as on Sear's pages)
  while the header is mounted. The header then shows only its back button, subtitle, details and actions. AppShell's
  `title` prop still wins; outside a shell the header has its own `<h1>`.
- `MobileNav` `primary` (also `AppShell` `mobile.primary`): the app picks the mobile bar's items, and "More" lists the
  whole navigation tree. Without it nothing changes (an app whose navigation is all groups got only "Home" and "More").

### Changed
- **`ColumnManager` is PMO's column picker (Frappe CRM's), at the owner's request.** It replaces Sear's checkbox list
  with up/down buttons, so `ListView` and `FrappeListView` get it too:
  - the shown columns are rows you drag by their grip (mouse, touch or pen), or move with ↑ / ↓ on the focused grip;
    the new position is announced;
  - × removes a column;
  - **Add column** opens a searchable list of every other field.
  - Locked columns stay listed at the top. Keys the menu doesn't manage (locked, or not loaded yet) keep their place.
  - New messages: `editColumns`, `addColumn`, `moveColumn`, `moveColumnHint`, `removeColumn`, `columnMoved`,
    `lockedColumn`.
- **Date filters work like Frappe's, at the owner's request** (frappe/public/js/frappe/ui/filters/filter.js):
  - Datetime fields (e.g. Created On) offer Is, After, Before, On or After, On or Before, Between, Timespan and Fiscal
    Year. Date fields also offer Equals / Not equals.
  - "Is" takes Set / Not Set. Between takes From / To (either may be empty). Timespan offers Frappe's 24 periods.
    Fiscal Year offers the site's fiscal years.
  - New operators `between`, `timespan` and `fiscal_year`, with values `"YYYY-MM-DD,YYYY-MM-DD"`, a TIMESPANS key and a
    FiscalYear name.
  - New helpers `operatorsFor`, `defaultOperator`, `operatorLabelKey`, `timespanRange`, `splitRange` / `joinRange`.
  - New props `fiscalYears` / `loadFiscalYears` on `ListView` and `FilterBuilder`. A new date condition starts on
    Between.
  - Client-side date filtering compares calendar days, as the Frappe layer already did: After 15 Oct excludes all of
    15 Oct. Timespans match Frappe's server dates, tested against Frappe 15.110's own output for 7 dates × 24 periods.
  - The Frappe entry sends `between`, Frappe's native `timespan`, and Fiscal Year as a `between` over the year. It reads
    the site's Fiscal Year records (ERPNext) only when the filter opens or a query needs them, once per session; none
    means the option isn't offered. `fiscalYears={false}` turns it off.

### Dependencies
- New: `@radix-ui/react-accordion` 1.2.20, `-aspect-ratio` 1.1.15, `-collapsible` 1.1.20, `-context-menu` 2.3.7,
  `-hover-card` 1.1.23, `-menubar` 1.1.24, `-navigation-menu` 1.2.22, `-progress` 1.1.16, `-slider` 1.4.7, `-toggle`
  1.1.18, `-toggle-group` 1.1.19. They are from the same Radix release as the existing pins, so they reuse the installed
  Radix internals (one copy each; no new internal packages).

### Fixed
- `DateField`, `TimeField`, `DateTimeField`: with an `id` and no `aria-label`, the field is named by its
  `<label htmlFor>`. Before, the name was always "Date" / "Time" / "Date and time", which overrode the label. The
  selected value is now the field's description. Without an `id`, nothing changes.
- Relative to PMO, `sanitizeHtml`: content inside any non-allowed element (`<font>`, `<section>`, a custom tag…) was
  not sanitized, so `<img onerror>`, `javascript:` links and `on*` / `style` attributes got through; `htmlIsEmpty`
  parsed the raw value into a live element (an `<img onerror>` would run); the editor wrote the raw value into the
  page. The package rebuilds the HTML from an allowlist, parses inertly, and only writes and emits sanitized HTML.
- Relative to the Design System: `Progress` passes `value` to Radix (it had no `aria-valuenow`); the display names of
  `MenubarShortcut` and `BreadcrumbEllipsis`.

### Not added (docs/LIMITATIONS.md)
- drawer (vaul), carousel (embla), input-otp, resizable (react-resizable-panels): apps keep their own shadcn copies,
  themed by the package tokens under `.sf-theme`.

## [0.2.0] — 2026-10-18

Additive: four components and a new entry. **Apps that import `@solvfast/ui/toast` need `sonner`** (1.7 or 2) —
docs/CONSUMING.md §5.

### Added
- `Table` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) and
  `RadioGroup` / `RadioGroupItem`: the Design System's primitives, as Sear renders them.
- `Stepper` (`StepperStep`, `StepState`): the Design System's stepper pattern, identical to Sear's. Labels and notes
  take a string or `{ en, ar }`.
- New entry **`@solvfast/ui/toast`**: `Toaster` (the Design System's sonner host — theme- and direction-aware) and
  `toast`.
- New dependency `@radix-ui/react-radio-group` 1.4.7, the version Sear runs. It reuses the Radix internals already
  installed.
- **New optional peer dependency `sonner` (`^1.7.0 || ^2.0.0`).** It is needed only for `@solvfast/ui/toast`. The
  app's own sonner is shared, so `toast()` from "sonner" reaches the package's `Toaster`.

## [0.1.0] — 2026-10-18

The first release, for GitHub Packages (`@solvfast` organisation, private; install with a token — docs/CONSUMING.md).
It is 0.1.0-rc.1 plus the changes below. Frappe layer: simulated-request tests passed; real-site validation is
deferred until the first real-project integration (not done).

### Changed
- **Licence: proprietary.** LICENSE: Copyright (c) 2026 Solvfast, all rights reserved; only Solvfast and those it
  authorises may use, copy or modify the package. `package.json` `license` is `UNLICENSED` (0.1.0-rc.1, never
  published, said `MIT`). README and docs say the same.
- `THIRD-PARTY-NOTICES.md`: the MIT notice of shadcn/ui, from which the primitives derive (via the Design System).
  It ships in the tarball.
- `THIRD-PARTY-NOTICES.md`: also the MIT notice of tailwindcss-animate, whose generated keyframes are in
  `dist/styles/full.css`.
- Docs: CONSUMING — integrating into an existing app (a host that already uses `tailwindcss-animate`, or `@tailwind`
  directives; an app that already owns theme and language), from the Sear integration rehearsal.

### Added
- `StatCard`: the Design System's stat card (liquid glass, label, large value, optional up/down trend pill).
- `IconStatCard`: Sear Studio's overview card (pane, tinted icon square, name, total).
- Both are static by default; `href` makes a link and `onClick` a button. Numbers are formatted for the language.
  Pixel parity with the sources is recorded in docs/VALIDATION.md.

### Changed — Sear's look for tabs, dialogs and the calendar
- **Tabs** look like Sear's `SegmentedTabs` (used across Sear, e.g. the Working Hours form): a liquid-glass pill rail
  with pill tabs, the active one in the primary colour. Was the DS underline strip. Same Radix API and keyboard
  behaviour; full-width and compact are classes (see the showcase).
- **Dialog and AlertDialog** are glassy: Sear's `.sear-glass-dialog` treatment (the poppers' liquid glass) instead of
  the DS aurora gradient, with fallbacks for reduced transparency and browsers without backdrop-filter.
- **Calendar** on its own has the date pickers' glass and rounded corners instead of the DS's opaque, square
  gradient panel. Date pickers are unchanged.

### Added (repository only, not in the package)
- `showcase/`: a browsable component site with live examples of the package's real components, in light/dark and
  Arabic/English (`npm run showcase`, `showcase:build`, `showcase:preview`; `e2e/showcase-smoke.mjs`). See
  showcase/README.md.

## [0.1.0-rc.1] — 2026-10-17 — release candidate (not published)

The first release candidate: theme and primitives (5.1), app shell (5.2), List View (5.3) and the optional Frappe
layer (5.4), with the changes from their reviews. Not published; the owner publishes (docs/RELEASING.md).

**Validation status:** core verified (unit tests, pixel parity with Sear's real components, clean installs for both CSS
paths). Frappe layer: simulated-request tests **passed**; **real-site validation deferred** until the package is
integrated into a real project — not done (docs/LIMITATIONS.md).

### Release preparation (5.5)
- `package.json`: version `0.1.0-rc.1`; `repository` (`solvfast/solvfast-ui`); the tarball also carries CHANGELOG,
  VENDORED and the user docs; scripts `check:package` and `prepublishOnly` (refuses to publish without a clean tree, a
  `v<version>` tag on HEAD and a named copyright holder).
- Package audit in the build (`scripts/check-package.mjs`): exports exist and have types, every import in `dist/` is a
  declared dependency, no unused dependency, no absolute local path in the tarball.
- Docs: `docs/LIMITATIONS.md` (one list of what is not done, not verified or intentionally different),
  `docs/RELEASING.md` (checklist), README rewritten, install-from-GitHub-Packages section in CONSUMING.
- `e2e/frappe-site/`: a prepared real-site validation procedure — **never run**.

### Fixed (5.5)
- Frappe types: `useFrappeMeta`'s `refetch` no longer exposes `@tanstack/query-core` types in the published
  declarations (that package isn't a dependency; strict installers couldn't resolve it). It is now
  `() => Promise<void>`.

### Added — increment 5.4 (Frappe layer, `@solvfast/ui/frappe`)
- `FrappeListView` (ListView over a DocType), `useFrappeList`, `useFrappeMeta`, `FrappeProvider`, `createFrappeClient`
  (same-origin session cookie + CSRF; replaceable transport), `FrappeError`, `frappeRetry`, `invalidateFrappeList`,
  and the pure helpers `buildFrappeListMeta`, `columnsFromMeta`, `filterFieldsFromMeta`, `queryToFrappe`,
  `conditionToFrappe`, `buildListRequest`, `frappeLinkSearch`. Stock methods only: `getdoctype`, `client.get_list`,
  `reportview.get_count`, `search.search_link`. Docs: docs/FRAPPE.md.
- Core additions used by it (usable on their own): `ListView` `searchHint`; `useListState` `selectionScope`; rich-text
  cells (Frappe Text Editor HTML) shown as plain text; messages `fieldId`, `fieldCreated`, `fieldModified`,
  `searchTitleOnly`.
- Rule C2 (Frappe's single `or_filters` list): search uses it across the search fields with "Match all" filters, and
  narrows to the title field with a visible note with "Match any" filters.

### Fixed — Frappe (relative to Sear's never-run Frappe path; docs/FEATURES.md)
- Totals honour "Match any" filters (`reportview.get_count`; Sear sent `or_filters` to `frappe.client.get_count`,
  which drops them).
- Requests never name fields the DocType doesn't have (an old saved filter or a render-only column made Frappe
  reject the whole request).
- A date on a Datetime field matches the whole day; Dynamic Link fields filter as text; ID / Created On / Last Updated
  are localized; link filter values use Frappe's link search.

### Changed — after the 5.3 review
- List View: every filter-row control has an accessible name (Field / Condition / Value / Match); they were unnamed
  comboboxes, as in Sear and PMO.
- List View: no pager or total while the list shows an error.
- List View on phones: the toolbar's buttons wrap instead of widening the page (Sear's list page was 506 px wide at
  390 px, with its page action cut off). Desktop unchanged.
- List View, grouped: all groups are sections of one table (a header row per group with collapse, count and the
  group's select-all), so they share the header's column order and widths; the table scrolls horizontally inside its
  card when narrow. The header's select-all covers the rows on screen (expanded groups). Was one table per group (PMO),
  whose columns didn't line up. New message key `selectGroup`.
- Buttons: the glass variants (default, secondary, outline, ghost, destructive) now use the DS Button's documented
  motion — 180 ms hover, 120 ms press (design_system `button.tsx`, v0.3.0) — instead of the glass engine's 0.4 s /
  0.16 s, which they had in Sear. Nothing else changes: an audit of every element's transition on the primitives,
  shell and list pages differs only on buttons; no motion under `prefers-reduced-motion`; the list pager keeps
  Sear's 150 ms.

### Added — increment 5.3 (List View)
- `ListView` — Sear's data grid (toolbar, glass table, pill pager) with PMO's list features as props: selection and
  bulk actions, group-by, sort menu, quick filters of any type with a field picker, row actions with confirm,
  conditional row styles, keyboard rows, loading / empty / error states. Client and server data modes.
- `useListState` (headless) and the parts: `ListTable`, `GroupedListTable`, `DefaultCell`, `FilterBuilder`,
  `FilterValueInput`, `SavedFilters`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`,
  `BulkActionBar`; the filter model (`applyFilterQuery`, 12 operators), `compareValues` / `sortRows`, `groupRows`,
  `mergeColumns`, storage adapters (`createLocalStorageAdapter`, `ListPrefsStorage`, `SavedFiltersStorage`).
- List strings in Arabic and English. Coverage per feature: docs/FEATURES.md.

### Fixed — list (relative to Sear and PMO; details in docs/FEATURES.md)
- Row actions are a fixed last column — no longer offered in the column manager, the filter fields or sorting.
- Non-sortable columns have no sort button; sorted headers carry `aria-sort`; rows open with Enter.
- Load errors are shown with Retry (Sear's grid showed nothing).
- Sorting: empty values last in both directions; text such as "Room 101" no longer sorts as a date; natural order.
- Server mode: search and text filters wait for a typing pause (one request, not one per keystroke).
- Selection is pruned when search or filters change; a group's select-all reflects that group.
- Filter value inputs keep focus while typing; filter condition ids never collide.
- Saved-filter storage failures reach the app (`onSavedFiltersError`) instead of being swallowed.

### Added — increment 5.2 (app shell)
- `AppShell`, `Sidebar`, `Navbar`, `MobileNav`, `AppSwitcher`, `NotificationPanel` — Sear's StudioShell with its
  navigation, routing, switcher sections, notifications, help and search supplied by the app; `NavItem` model with
  any nesting depth; `relativeTime` / `timeGroup`; shell strings in Arabic and English.

### Fixed — shell (relative to Sear)
- Notification panel is glass in dark mode too (Sear's dark override made it opaque).
- Mobile "More" sheet opens on the start edge in Arabic (Sear: the left edge).
- The app switcher highlights the current app (Sear's name comparison never matched).
- The top bar renders without a provider; app-switcher and shell labels are localized (Sear's were English-only).

### Added — increment 5.1 (foundation)
- Core entry `@solvfast/ui`: `ThemeProvider` (`useTheme`, `useLocale`, `usePortalContainer`), `cn`, and 23 primitives
  vendored from the DS v0.3.0 with Sear's effective look (VENDORED.md), plus `DateField` / `TimeField` / `DateTimeField`.
- Styles: `theme.css` + `glass.css` (+ opt-in `base.css`) for Tailwind 3 apps with the `tailwind-preset`;
  `full.css` (+ opt-in `full-base.css`) precompiled for apps without Tailwind.
- `LICENSE`: full MIT terms; the copyright holder is pending the owner's confirmation.
- Tooling: pinned `upstream/` sources, CSS extraction, boundary check, Sear parity harness (`tools/parity`),
  clean-consumer test (`e2e/consumers`).

### Fixed (relative to Sear / the DS)
- Popovers, selects and menus fall back to a solid surface under `prefers-reduced-transparency` and without
  `backdrop-filter` (Sear's popper glass out-ranked the DS fallbacks).
- Button motion durations 180/120 ms now emit CSS (DS D5) — effective on `ai-outline` and Calendar day buttons; glass
  buttons keep the glass engine's timings, as in Sear. No motion under `prefers-reduced-motion` (verified).
- Path B: Tailwind's preflight is also applied to the scope element's own `::before`/`::after`.
- Hooks never throw outside `ThemeProvider` (Sear's Navbar crashed without its provider).

## 0.4.0-dev.26 (2026-11-03, Phase 26 Lead pre-work)
- `canImport(meta, roles, level0)`, `canExport(roles, level0)`, `readableFields(fields, levels)` in `@solvfast/ui/frappe`
  (Desk `model.js:434-450`, server `permissions.py:600-615`): missing roles / meta / rights deny.
- `DocTypeMeta.allow_import`.
- Client file primitives: `api.download(method, args)` (a whitelisted method that streams a file; JSON refusals become
  `FrappeError`) and `api.uploadFile(file, filename, opts)` (`upload_file`, Desk's multipart fields). Stubbable through
  `createFrappeClient({ files })`; a client with a custom JSON `transport` and no `files` refuses file calls.
- `docs/release/COMPONENT-COMPLETION-MATRIX.md`.

## 0.4.0-dev.27 (2026-11-03, Phase 26 D — permissions)
- **Behaviour change (rule 9):** without `session.roles` nothing is granted beyond the server's `docinfo.permissions` of a
  saved doc; a NEW doc is denied (no fields, no Save) and `usePermissions().known` is false (FrappeForm shows "Read only").
  Pass `session.roles` to `FrappeProvider`. The Administrator USER keeps everything; the "Administrator" ROLE on another user
  is just its DocPerm rows.
- `bulkMenu`: Assign To gated on `read` (server: `assign_to.py:67-68`), was `write`.
- `permissionsKnown`, `isAdministrator` exported. `tests/parity/permissions-matrix.test.tsx` (31 tests, SIMULATED).
- `docs/release/PERMISSION-AUDIT.md`.

## 0.4.0-dev.28 (2026-11-03, Phase 26 C — list Import/Export)
- `FrappeListView`: list menu with **Import** (only when `canImport`; `onImport` or navigation to Data Import) and
  **Export** (only when `canExport`) → `FrappeExportDialog` → server `download_template` (Desk's Data Exporter request;
  the file comes from the server, never from client data). Props `onImport`, `menu`, `ioLabels`. Row checkboxes stay
  opt-in (`selectable` / `bulk`), unchanged from dev.27.
- `startDataImport` and friends reproduce Desk's Data Import call sequence (`savedocs` → `upload_file` → `savedocs` →
  `get_preview_from_template` → `form_start_import`), `useImportStatus` polls `get_import_status`. No preview grid / column
  mapper yet (owner decision). **All verified against stubs only; nothing has run on a site.**
- Columns of permlevel fields the user cannot read are dropped (`restrictMetaToReadable`) when the roles are known.
- Bulk Delete outcome wording: "N requested — the server reports failures in its messages" (`delete_items` answers nothing).
- `docs/release/LISTVIEW-FRAPPE-PARITY.md`: verdict **not Frappe-compatible yet** (missing list in §5).

## 0.4.0-dev.29 (2026-11-03, Phase 26 B — showcase; light-mode popups)
- Light mode: popovers, menus, select lists, command palette, hover cards, dialogs and sheets are solid white
  (`--popover`), no backdrop blur. Dark mode unchanged.
- Showcase (repository only, not in the tarball): "Frappe layer" group with 10 sections on an in-browser simulated
  site, every section labelled SIMULATED; smoke test extended (61 sections × light/dark × en/ar, 38 interactive checks).

## 0.4.0-dev.30 (2026-11-03, Phase 27 E — source maps)
- Source maps no longer embed the TypeScript source (`sourcemapExcludeSources`); they keep line mappings and relative
  `src/` paths. `scripts/check-package.mjs` fails the build when a shipped map carries `sourcesContent` or an absolute
  source path. Packed size 846 kB → 524 kB.

## 0.4.0-dev.31 (2026-11-03, Phase 27 B — list query)
- Nested-set filter operators (Desk's labels: Descendants Of / inclusive / Not Descendants Of / Ancestors Of / Not Ancestors Of), offered
  only for Link fields to tree DocTypes, sent to the server unchanged; en/ar labels.
- Width-based column limit (Desk `list_view.js:375-457`), URL filters (read and write-back), report-view export
  (`export_query` through `api.download`; on a real site it writes an Access Log row) — functions and `useFrappeList`
  options; `FrappeListView` wiring follows in the actions merge.
- Generic `useListState`: `initialQuery`; visible columns follow changes in the columns' default visibility until the user
  picks columns (List View Settings arriving after the first render now apply).

## 0.4.0-dev.32 (2026-11-03, Phase 27 A + B + C merged)
- **Permissions (A):** `FrappeFormView` without a `permissions` prop grants nothing (read-only, "Read only" notice);
  Cancel All only when the cancel rights are known to be true; workflow transitions come from the server's
  `get_transitions` (client-side filtering without roles offers none); the Administrator user without a role list behaves
  as Frappe 15.110 (every role: `permissions.py:506-507`); `canImport` / `canExport` accept the session.
- **List actions (B):** Desk's full Actions menu in the selection bar — Print (`download_multi_pdf`, background above 25),
  Clear Assignment, Apply Assignment Rule, Add Tags, workflow bulk approval — plus **Export offered to everyone as Desk
  does** (the server refuses; the dialog shows it) and **Import navigating to the Data Import list**.
- **List query (B):** `FrappeListView` now **caps generated columns by window width by default**, as Desk
  (`list_view.js:432-444`; app-curated `columns` are never capped; `columnLimit={false}` opts out); `urlFilters`,
  `treeDoctypes`, `hideNameColumn` forwarded; "Export as report" (`export_query`) in the list menu when `canExport`.
- **Import (C):** `FrappeDataImport` — upload, the server's preview and warnings, column mapping (`template_options`),
  Start / Retry, server-confirmed result, import log, errored rows.
- All of the above is tested against stubs / the simulator only; nothing has run on a site.

## 0.4.0-dev.33 (2026-11-03, Phase 27 D — simulator permissions)
- `@solvfast/ui/frappe/testing` only: `createFixtureTransport(backend, { permissions })` evaluates permissions server-side
  (roles as `get_roles`, DocPerm rows, `if_owner`, User Permissions, sharing, permlevel stripping and reset, 403s on
  writes, workflow roles, assignment, `download_template` / `export_query` with `can_export`); seven `simScenario.*`
  builders (Administrator, full access, read-only, restricted DocType, restricted fields, User Permissions, unknown roles).
  Without the option the simulator behaves as before. Handlers for the dev.32 methods (Print, tags, assignment, workflow
  bulk, report export, Data Import). Files it returns are labelled SIMULATED and carry labels and the request only — no
  document values, no counts. The production `./frappe` entry never imports it (`check:boundaries`).

## 0.4.0-dev.34 (2026-11-03, Phase 27.5 — handoff fixes and polish)
- **Fix — custom `rowKey`:** bulk actions, the selection-bar Export and the workflow menu sent the list's UI row keys as
  Frappe document names. `FrappeListView` now resolves the selection through a key → `name` map of every row it has
  shown (selection across pages included) — `documentNamesForKeys`; an unresolvable key withholds the actions.
- **Date display:** an editable Frappe Date field shows the site's `date_format`, like its read-only display
  (`DateField` gained an optional display-only `formatDisplay`; the value stays `YYYY-MM-DD`).
- **Assign To dialog:** DS `DateField` ("Complete by", with its purpose), DS `Select` (Priority; "Default (Medium)" sends
  nothing, as before), DS `Checkbox` / `Input` / `Textarea`, visible labels and hints; payload unchanged.
- **Dark mode:** Saved Filters, Columns and the filter builder's popovers use the DS glass (they were near-black);
  light mode unchanged.
- **"Export as report"** is opt-in (`menu={{ reportExport: true }}`): Desk's List View has no such entry.
- **Polish:** CommentComposer uses the DS Textarea and a DS Popover for @mentions; focus rings and `type="button"` on
  plain buttons (sort headers, group toggles, total, indicator pills, section headers, alert dismiss); translated DS
  file picker in `FrappeDataImport`; checkbox labels dim with their checkbox; form section columns stack on phones.
