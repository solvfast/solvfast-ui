# Agent E — Tests, Showcase, Documentation audit — `@solvfast/ui` 0.6.0

Worktree: `/home/frappe/sfui-dev/p35-pkg` · branch `feat/0.7.x/p35-coverage` · HEAD `0ef45c1` (Release 0.6.0) · audited 2026-11-07.

## 0. How the gates were run (and why not in place)

- The worktree has **no `node_modules`** (and `npm install` is out of scope). Sibling worktree `/home/frappe/sfui-dev/p33-pkg`
  is at the same commit (`0ef45c1`) with a **byte-identical `package-lock.json`** and an installed `node_modules`.
- To keep the repo untouched, the worktree was copied (rsync, without `.git`) to
  `/tmp/claude-1000/-home-frappe-lovable-bench/dd04d141-f975-4eb5-beb5-0ff7b8dc907a/scratchpad/p35/audit/wt` (verified
  `diff -rq` identical before running) with `node_modules` symlinked to p33-pkg's. Every gate ran there.
- Why it mattered: `npm run build` step 1 (`scripts/extract-css.mjs`) **rewrites tracked files** `styles/{theme,glass,base}.css`,
  `styles/sf-classes.json`, `styles/rename-map.json` — not only `dist/`. In the copy the regenerated files were
  sha256-identical to the committed ones (deterministic, no drift), but the brief's "build writes only dist/" is not literally true.
- `showcase:build` outDir = `showcase/dist` (`emptyOutDir: true`), git-ignored — ran in the copy as well.
- Original worktree after the audit: `git status --short` → **empty**; `git status --short --ignored` → empty (nothing created).

## 1. Gate results (verbatim, in the scratch copy)

| Command | Result | Duration (wall) |
|---|---|---|
| `npm run typecheck` | rc=0, no output | 10.5 s |
| `npm test` (vitest run) | rc=0 — **Test Files 52 passed (52); Tests 1144 passed \| 11 todo (1155)**; vitest "Duration 23.39s" | 23.9 s |
| `npm run check:boundaries` | rc=0 — `(dist/ not built yet — source rules only)` `✔ boundaries OK` | 0.16 s |
| `npm run build` | rc=0 — 7/7 steps; boundaries on dist: core 103 modules, toast 4, chart 3, form 4, frappe 148 (no testing-entry line); `✔ package OK`; tarball 600 files, 680.6 kB packed | 11.4 s |
| `npm run check:package` | rc=0 — `exports: 13 · built files scanned: 391`; tarball 600 files, 680.6 kB; `✔ package OK` | 1.3 s |
| `npm run showcase:build` | rc=0 — `✓ 3937 modules transformed`, `✓ built in 7.08s` → `showcase/dist` | 7.7 s |

Notes: 11 `it.todo` (format ×4, errors ×5, dependencies ×2); no `it.fails(` remains (the review-r1/r2 file headers still describe that convention, but no test uses it now).
`check-boundaries` prints no line for the `./frappe/testing` entry (it only asserts `./frappe` never reaches it).
`dist/` holds 199 `.d.ts` files.

## 2. Test inventory

Evidence levels: **U** pure unit (no transport) · **M** mock/stub/recording transport (`vi.fn`) · **S** in-package simulator
(`createFixtureTransport` / `simScenario`) · **R** recorded real Frappe 15.110 data (metadata fixtures `tests/fixtures/real-15.110/*`
or Sada HTTP captures `tests/fixtures/real-15.110-sada/*`) · **Live** = authenticated real site: **none anywhere**.
Counts are vitest's per-file counts from this run.

| File | Tests | Area | Evidence | Form areas | List areas |
|---|---:|---|---|---|---|
| tests/frappe-form.test.tsx | 34 | FrappeForm load/edit/save, depends_on, tabs, submit/cancel, child tables, table events, Link search/validate, Dynamic Link, link_filters/setQuery, Table MultiSelect, fieldtype dispatch, Arabic/RTL, 417 reload, Cancel All, Amend, workflow header, V1/V4 | M + R (real ToDo/Contact/Event/Note meta) + S | A B C E F G H I J N | — |
| tests/frappe-form-model.test.tsx | 29 | expression interpreter (D-23), depends/mandatory/read_only_depends_on, collapsible, docStore set_value, rows (__islocal, idx), defaults, mandatory, fetch map, layout, __newname, action matrix, ladder | U + R (real meta) | B C E G H J N D | — |
| tests/record-form-fixes.test.tsx | 6 | R1-F1 default Link fetch, R1-F6 interpreter, R1-F8 grid permlevel | S + R | E C D G | — |
| tests/parity/dependencies.test.ts | 33 (2 todo) | evaluateDependsOn vs layout.js | U + R (expression corpus) | C | — |
| tests/parity/display-status.test.ts | 39 | perm.js display-status ladder, allow_on_submit | U | D N | — |
| tests/parity/mandatory.test.ts | 23 | checkMandatory parent/child/depends | U | H G C | — |
| tests/parity/format.test.ts | 33 (4 todo) | formatValue numbers/dates/currency/labels | U + R | A J | A |
| tests/parity/errors.test.ts | 53 (5 todo) | exc_type/status classification, _server_messages | U | H | E |
| tests/parity/keys.test.ts | 11 | query keys, cache invalidation, list realtime | U | H | E |
| tests/parity/list.test.ts | 28 | L-01..L-03: reportview.get/get_count shapes, sort tie-break, filter translation, indicator | U | — | A B C E I |
| tests/parity/record.test.ts | 29 | workflowFromMeta, W-02 self-approval, M-07 read-only | U | I | — |
| tests/parity/review-r1.test.ts | 22 | D-23 vs Desk, F-09/W-04 action matrix, C-06 child rows | U | C G I N | — |
| tests/parity/review-r2.test.ts | 11 | copy_doc/amend_doc, evaluator `;`/Boolean/in, grid permlevel | U | N C G D | — |
| tests/parity/permissions-matrix.test.tsx | 31 | 6 DocPerm scenarios × rights, rule 9, permission-denied | S + R | D | F J |
| tests/parity/permissions-p27.test.tsx | 60 | Administrator, missing info denies, unknown roles in FrappeForm, list gating | S + R + M | D N | F J |
| tests/sim-permissions.test.tsx | 43 | simulator's server-side permission model (opt-in) | S | D | B F |
| tests/record-frappe.test.tsx | 20 | workflow model, indicator precedence, version diff, timeline model, state history | U | I J | — |
| tests/record-frappe-ui.test.tsx | 18 | FrappeWorkflowActions, FrappeStatusIndicator, FrappeAssignTo, FrappeTimeline (comments, communications paging) | M | I J (assign/timeline) | — |
| tests/record.test.tsx | 24 | generic Timeline, CommentComposer, AssigneeGroup, LifecycleBar, ActionBar | U/M | J I (generic) | — |
| tests/assign-dialog.test.tsx | 5 | AssignDialog (SIMULATED label, stubbed) | M | — (assign) | F |
| tests/attach.test.tsx | 6 | Attach / Attach Image upload | M | A | — |
| tests/date-display.test.tsx | 6 | Frappe Date display in site format | M | A | A |
| tests/fields.test.tsx | 30 | NumberInput, TimeInput, Duration, LinkInput, TagInput, DataGrid (paging, Add Row), Rating, Color | U/M | A G | — |
| tests/foundation-api.test.ts | 17 | DocumentApi / RecordApi request shapes (getdoc, savedocs, rename, delete…) | M + R | H (API only) | — |
| tests/foundation-boot.test.tsx | 4 | readFrappeBoot, FrappeProvider boot | M | — | — |
| tests/foundation-client.test.ts | 36 | FrappeError kinds, _server_messages, error bodies | U/M | H | E |
| tests/foundation-fixture*.test.ts(x) (3 files) | 7 + 18 + 9 | fixture transport, savedocs/new rows/naming/user_info hardening, list+record call sites | S + R | H G | A I |
| tests/foundation-hooks.test.tsx | 22 | useMetaBundle/useDoc/provider on real metadata fixtures | M + R | D H | — |
| tests/foundation-realtime.test.ts | 2 | createSocketRealtime skeleton | M | — | E |
| tests/frappe-indicator.test.ts | 13 | indicator precedence, colour table | U | J | E |
| tests/frappe.test.tsx | 41 | F31 transport/CSRF, client shapes, F33 meta→columns/filters, F4/F6/F11/F12/F16/F24/F29/F32, C1/C2, date operators, fiscal years, entry boundary | M + S | — | A B C D E F I |
| tests/frappe-list.test.tsx | 38 | reportview decode, rowMeta, List View Settings, count cap 1001, docstatus pills, child-table filters, saved filters (List Filter), user settings, bulk menu by right, delete/assign, realtime debounce, onCreate empty action | M + S | — | A B C E F G I J |
| tests/frappe-list-header.test.tsx | 5 | selectionMode='header' | M | — | F J |
| tests/list.test.tsx | 60 | generic ListView F1–F30, C1–C4, prefs, filters, saved filters, column manager, grouping, selection, row actions, states, i18n | U | — | A B C D F I |
| tests/list-query.test.tsx | 34 | nested-set ops, width column cap, unknown-field guard, URL filters, report-view export | M + S | — | A B H(report export only) J |
| tests/list-actions.test.tsx | 26 | bulk_operations shapes, selection-bar order/gates, Clear Assignment, Assignment Rule, Add Tags, workflow bulk, Print (download_multi_pdf, background) | M | L (list print only) | F J |
| tests/list-io.test.tsx | 30 | export request/field picker, import sequence, menu gating, bulk outcomes, width cap wiring | M | — | F J |
| tests/list-selection-header.test.tsx | 10 | header selection mode, onSelectionChange, AssignDialog | U/M | — | F |
| tests/import-ui.test.tsx | 31 | FrappeDataImport upload/preview/mapping/start/result | M + S | — | J |
| tests/core-io.test.tsx | 17 | CSV helpers, Core ExportDialog, import model | U/M | — | J |
| tests/lead-p26-primitives.test.ts | 8 | canImport/canExport, readableFields, download/upload | U/M | D | J |
| tests/like.test.tsx | 15 | LikeToggle, ListTable like, FrappeListView like (sim) | U + S | — | E |
| tests/rowkey.test.tsx | 9 | custom rowKey → document names for bulk | S | — | F |
| tests/real/sada-real.test.tsx | 16 | **replayed real 15.110 responses**: getdoctype, reportview.get/get_count, search_link, validate_link, getdoc, 403/417 envelopes, Guest CSRF, FrappeListView + FrappeForm render real data | **R** (+ S for replay) | A F G (read) D(403) | A E I (read) |
| tests/merged.test.tsx | 53 | merged DS primitives, popper portals, SearchCombobox | U | — | — |
| tests/cards / extras / shell / theme / sear-look | 9 / 7 / 13 / 7 / 4 | core UI | U | — | — |

### 2a. Coverage by Form View area (A–P)

| Area | Covered by | Gaps (summary) |
|---|---|---|
| A field types | fields, attach, date-display, frappe-form "dispatches fieldtypes" (only Currency/Data/Duration/Int), format | No per-fieldtype interaction test through FrappeField for Select, Check, Datetime, Time, Rating, Color, Text Editor, Code/JSON, Password, Phone, Read Only, HTML/Heading/Button/Image; no test for unsupported-type fallback (Signature, Geolocation…) |
| B layout | frappe-form (Event tabs, p275 columns), frappe-form-model (layout, collapsible) | No test for tab-switch to first missing field's tab via UI, hidden-empty-section/tab pruning in DOM, keyboard tab navigation |
| C conditions | parity/dependencies, frappe-form-model, frappe-form (Note depends_on, mandatory_depends_on), record-form-fixes | read_only_depends_on in the rendered form (2 todo), child-row depends in the grid UI, `fn:` handler path |
| D permissions | sim-permissions, permissions-matrix, permissions-p27, display-status, R1-F8/R1-F15, foundation-hooks | Mostly model + simulator; no recorded-real authenticated docinfo.permissions; permlevel write (not just read) in UI |
| E defaults / fetch_from | frappe-form-model (defaults, fetch map), record-form-fixes R1-F1, frappe-form (link pick fetches) | fetch_if_empty in UI, user defaults from boot in UI, route options through FrappeForm |
| F link | frappe-form (search 500 ms, blur clear, Dynamic Link, link_filters/setQuery), sada-real (search_link/validate_link R) | show_title_field_in_link title display, "Create a new X" / Advanced Search entries (not implemented), keyboard selection in link dropdown |
| G child tables | frappe-form (Add Row, events, Table MultiSelect), fields DataGrid, frappe-form-model rows, parity/mandatory, R1-F8 | Row reorder (gallery claims "reorder"), row edit dialog/expanded row, bulk row delete, paste/upload rows, allow_on_submit grid columns on submitted doc |
| H lifecycle | frappe-form (save, validate false, server error, 417 reload, mandatory dialog), foundation-api | Discard / navigate-away prompt (beforeunload), double-submit guard in UI, Ctrl+S only tested implicitly, after_save→refresh order |
| I workflow | record-frappe, record-frappe-ui, parity/record, R1-F7, R3-F2 | Workflow action confirm + reload in FrappeForm (integration), workflow on dirty form inside FrappeForm |
| J status / header | frappe-indicator, record-frappe-ui (status indicator), V1, Not Saved | Header title editing (title_field), image/avatar, "modified after you opened it" banner (not implemented) |
| K menus | **none** (FrappeFormView has no ⋯ menu; Amend + Reload-on-conflict only) | Print, Email, Duplicate, Copy to clipboard, Rename, Delete, Reload, Customize, Links, Remind Me, Undo/Redo, New — **feature absent, no tests** |
| L print / pdf | **none for forms** (list Print in list-actions only) | Form print view / PDF |
| M connections | **none** (documented "No Connections dashboard") | Connections / dashboard links |
| N submission / allow_on_submit | frappe-form (Submit→Cancel), R1-F5 Amend/Cancel All, review-r1 action matrix, display-status/allow_on_submit model | **No UI test** that an allow_on_submit field is editable on docstatus 1 and "Update" posts it |
| O email composer | **none** (no component) | Email / Communication composer |
| P website link | **none** (no `has_web_view` / "See on Website") | — |

### 2b. Coverage by List View area (A–J)

| Area | Covered by | Gaps (summary) |
|---|---|---|
| A columns / list settings | list (F1–F3, F18, prefs), frappe (F4, F33), frappe-list (rowMeta, List View Settings), list-query (width cap, total_fields) | List View Settings **editing** (not implemented); column width resize |
| B filters | list (F9–F16), frappe (F11, F16, C2, date ops, fiscal year), list-query (nested set, URL filters, injection guard), parity/list, sim-permissions | Child-table filter through the UI popover (model only), "is" Not Set on Link via UI, filter on `_assign`/`_liked_by` |
| C sort / saved filters | list (F5–F7, F17, F36), frappe (F6), frappe-list (List Filter, user settings), parity/list L-03 | Saved filter OR conjunctions (not supported), global vs personal saved filter in UI |
| D group-by / sidebar | list (C1, grouping), frappe (C1 server grouping), e2e/list-groups.mjs | **Group-by sidebar with server counts (`get_group_by_count`), tag stats, assigned-to-me** — not implemented, no tests |
| E row status / metadata / realtime | frappe-list (indicator, docstatus pills, realtime debounce), frappe-indicator, parity/list, like, foundation-realtime, sada-real (_comment_count) | Realtime is a skeleton (full reload): no by-name refresh test; no socket.io real event shape test |
| F bulk / selection | list (C3), list-selection-header, frappe-list-header, list-actions, frappe-list, list-io, rowkey, permissions-p27 | Edit (bulk set value) dialog end-to-end; bulk on rows across pages (keys only) |
| G create / quick entry | frappe-list (onCreate empty action only) | **Quick Entry** (meta `quick_entry` read but no dialog), primary "Add X" button in header, new-doc route |
| H views | list-query (report-view export only) | **Report, Kanban, Calendar, Gantt, Image, Dashboard, Map, Tree, Inbox: none** (excluded F26) |
| I count / pagination | list (pages of 20), frappe-list (1001 cap, exact count click), parity/list L-02, frappe (C1 Load more) | Page-size selector (20/100/500) as Desk, "Load more" in ungrouped Frappe mode |
| J list menu | list-io (menu gating Import/Export), list-query (report export), list-actions, frappe-list-header | Desk list menu items beyond I/O: Toggle Sidebar, Pick Columns / List Settings, User Permissions, Role Permissions, Customize, Edit DocType — absent |

## 3. Missing interaction tests (concrete, per area)

Form (FV):
- **A**: one rendered-FrappeField test per supported fieldtype (Select choose/clear blank, Check toggles 1/0, Datetime round-trip `:00` seconds, Time 12/24 h, Rating fraction ↔ stars, Color invalid → clear, Text Editor sanitize on change, Password passthrough of `*****`, Code/JSON monospace+ltr, Phone tel); unsupported types fall back to raw text box; HTML/Heading/Button/Image display + Button fires event.
- **B**: Missing Fields jumps to the first missing field's tab (UI); empty tab hidden and tab bar hidden when one tab left (DOM); collapsible section forced open after a failed save.
- **C**: read_only_depends_on making a static read-only field writable (currently `it.todo`); depends_on inside a child grid row re-evaluated when the row changes.
- **D**: permlevel-1 *write* vs read in the rendered form; restricted user docinfo.permissions from a recorded authenticated response (needs new capture).
- **E**: fetch_if_empty does not overwrite a filled target; user default from boot applied on a new doc; route options via `FrappeForm`.
- **F**: keyboard ↑/↓/Enter in link dropdown; show_title_field_in_link title shown after pick and after reload.
- **G**: row reorder (move up/down or drag) and the resulting `idx`; row delete of multiple selected rows; allow_on_submit grid column editable on a submitted doc.
- **H**: navigate-away while dirty prompts; Ctrl/⌘+S triggers save (explicit keyboard test); double-click Save sends one request; after_save → refresh event order.
- **I**: FrappeForm + FrappeWorkflowActions integration: apply transition → doc reloaded → header shows new state; disabled while dirty (integration, not only component).
- **J**: title_field editing in header; indicator updates after save/submit inside the form.
- **K/L/M/O/P**: no tests possible until the features exist (menu, print/PDF, connections, email composer, web link). Add as `it.todo` rows so the gap is counted.
- **N**: submitted doc with an allow_on_submit field: edit → primary becomes "Update" → savedocs action "Update" posts only that change; non-allow_on_submit fields stay Read.

List (LV):
- **A**: List View Settings editing (when built); column resize persistence.
- **B**: child-table condition built through the filter popover UI (currently model-level only).
- **C**: saved filter scope (mine/global) shown and deleted only by owner.
- **D**: group-by sidebar counts (`get_group_by_count`) — when built.
- **E**: realtime by-name refresh vs full reload; doc_update event for a row on screen.
- **F**: bulk Edit (set value) dialog → `submit_cancel_or_update_docs` / bulk_update request shape and outcome.
- **G**: Quick Entry dialog for `quick_entry: 1` DocTypes (mandatory fields only, insert, then list reload); header "Add" button.
- **H**: Report view (columns/group-by/totals), Kanban, Calendar etc. — not implemented; record as todo.
- **I**: page-size switch (20/100/500) and count refresh.
- **J**: list ⋯ menu Desk items (Toggle Sidebar, List Settings, Customize, User/Role Permissions) — not implemented.

## 4. Public exports audit (from built `dist/*.d.ts`, TypeScript checker)

| Entry | `.d.ts` | Exports (values / types-only) | In shipped docs* | Not in any doc nor CHANGELOG |
|---|---|---:|---:|---:|
| `@solvfast/ui` (dist/index.d.ts) | ✔ (100 decl files) | 466 (329 / 137) | 179 | 237 |
| `@solvfast/ui/frappe` | ✔ (78 decl files) | 494 (293 / 201) | 189 | 241 |
| `@solvfast/ui/frappe/testing` | ✔ | 25 (11 / 14) | 2 | 22 |
| `@solvfast/ui/form` | ✔ | 8 (8 / 0) | 8 | 0 |
| `@solvfast/ui/toast` | ✔ (`toast` resolves to sonner's d.ts) | 3 (2 / 1) | 2 | 1 (`ToasterProps`) |
| `@solvfast/ui/chart` | ✔ | 7 (6 / 1) | 7 | 0 |

*Shipped docs = README.md + the 8 `docs/*.md` in package.json `files`. Every export resolves to a declaration in `dist/` (except
`toast`, a re-export of sonner). Full lists: `exports.json`, `docaudit.json` in the scratch audit folder.

Undocumented **value** exports (excluding primitive sub-parts whose family is documented, e.g. `DialogPortal`):
- **Core (84):** `defaultMessages cn buttonVariants badgeVariants toggleVariants navigationMenuTriggerStyle ScrollBar`, all
  `DropdownMenu*`/`ContextMenu*` sub-parts, `defaultIsActive pathMatches deepestActive loc relativeTime timeGroup`,
  `FilterValueInput SavedFilters activeConditionCount newCondition OPERATORS_BY_TYPE EMPTY_QUERY getQuickValue setQuickValue operatorsFor defaultOperator operatorLabelKey TIMESPANS timespanRange splitRange joinRange filterFieldsFromColumns groupRows`,
  **`LikeToggle`** (0 mentions in any shipped doc), **`ListActionsContext`**, `NESTED_SET_LABEL isNestedSetOperator`,
  import/export helpers (`useExportDialogLabels orderedSelection DONT_IMPORT useDataImportLabels useImportDialogLabels autoMapColumns mapRow validateImport isMandatoryFor importableRows importPreviewColumns normalizeHeader DATA_IMPORT_LABELS_AR IMPORT_DIALOG_LABELS_AR formatImportMessage importStatusLabel importStatusTone importResultHeadline`),
  field helpers (`FIELD_INPUT FIELD_INVALID isHexColor normalizeDigits DEFAULT_NUMBER_FORMAT toTimeString durationToSeconds`).
- **Frappe (122):** incl. `createFrappeQueryClient loadDocTypeBundle useListRealtime createDocumentApis toMetaBundle normalizeDocInfo FormSkeleton FrappeMessagesProvider ServerHtml useLocalTableController useFormServices runEvent compileExpression applyDefaults gridColumns`, all print constants (`PRINT_METHODS MAX_PRINT_LIMIT …`), workflow-bulk constants, the format/permission services (`formatNumber formatCurrency formatDate buildDocPermissions rolePermissions fieldDisplayStatus readableFields isAdministrator …`), import helpers. **`useDocMutations`** has 0 mentions in shipped docs and no Showcase use.
- **Testing (9 of 11 values):** `fixtureFields BUILTIN_FIXTURE_META SIM_SCENARIO_NAMES SIM_RIGHTS AUTOMATIC_ROLES BUILTIN_PERMISSION_HOOKS COMMENT_PERMISSIONS createPermissionEngine permissionError` — only `createFixtureTransport` and `simScenario` are documented; there is no doc section for the simulator API itself (FRAPPE.md points to `docs/qa/simulator-caveats.md`, which is **not shipped**).
- `src/frappe/testing/importer.ts` is not exported from the testing entry (internal; fine, but undocumented how the simulated Data Import is enabled — Showcase uses `dataImport: "insert"`).

Documented names that do not exist as exports: none of the package's own. Hits are external/upstream names used in prose:
`useToast` (explicitly "not provided"), `useNumberFormatFromCurrency` (a Frappe sysdefault key), `PrerequisiteFieldInput`
(CRM component), `useDataGrid`/`AdvancedFilter`/`TaskList`/`FieldLibraryListPage` (Sear/PMO sources), `useSearchParams`,
`QueryClientProvider`, `useNavigate`/`useLocation`/`useForm` (third-party). No phantom component names.

## 5. Showcase coverage

Groups/sections (`showcase/src/routes.ts`, 52 sections): Foundations (overview, theming) · Components (button, badge, card,
text fields, checkbox/switch, radio, select, tabs, avatar, skeleton/separator, scroll-area, calendar, date-time fields,
search combobox, rich text, form [`@solvfast/ui/form`], toggle, slider, accordion, aspect-ratio) · Data display (stat cards,
status pill, progress, chart, table, List View, List View features, List View states, filters, Export & Import [Core
`ExportDialog`/`DataImportDialog`], Frappe List View [data.tsx]) · Feedback & overlays (tooltip, alert, toast, dialog,
alert-dialog, sheet, popover, dropdown, command, hover-card, context-menu, menubar) · Navigation (breadcrumb, pagination,
navigation-menu) · Patterns (page header/EditableTitle, stepper, app shell, shell parts) · Frappe layer (gallery, list view,
forms, record detail, workflow, assign & comments, permissions playground, import & export, RTL/LTR, light/dark).

Frappe sections render real components over the in-browser simulator: `FrappeListView` (8), `FrappeForm` (13+3),
`FrappeStatusIndicator`, `FrappeTimeline`, `FrappeWorkflowActions`, `FrappeAssignTo`, `FrappeDataImport`, `FrappeExportDialog`,
`LifecycleBar`, `ActionBar`, `StatusBadge`, `CommentComposer`, `AssigneeGroup`.

**Major capabilities with no Showcase example**
- Generic field controls (core, 0.4.0): **`NumberInput`, `TimeInput`, `DurationInput`, `LinkInput`, `TagInput`, `DataGrid`,
  `Rating`, `ColorInput`, `ReadOnlyValue`, `FieldShell`** — no section (only seen indirectly inside FrappeForm).
- **`LikeToggle`** (core and list like column), **`AssignDialog`**, generic **`Timeline`** standalone.
- **`FrappePrintDialog`** (list Print / PDF) — not reachable/explained in any section; `FrappeReportExportDialog` only through the menu.
- **`useDocMutations`**, `useFrappeList` (headless), `createSocketRealtime`, `FrappeChildTable` / `FrappeLinkField` standalone,
  URL filters, nested-set operators, width-based column cap, List View Settings.
- Form View K–P (menus, print, connections, email, website link) and List H (views) — absent from the package, so nothing to show; the Showcase does not claim them.

**Showcase text vs. reality**
- Labelling is disciplined: every Frappe section carries "SIMULATED" strips; `shared.tsx` states writes never ran on a real site.
- **Stale route description**: `routes.ts` `frappe-import-export` says "pending the list-io merge; nothing is ever downloaded
  or imported here" while the page itself runs the implemented (dev.32) Import/Export with `dataImport: "insert"` (simulated
  import inserts into in-browser memory and text files are "downloaded"). Wording contradicts the page.
- **Stale README**: `showcase/README.md` says "uploads (imports) are refused" — the import page now accepts a file and plays
  the server's insert. README still says "0.4.0" / "Phase 26" framing.
- Gallery card `FrappeChildTable` says "add / remove / **reorder**" with status "verified-read"; no test covers reorder and
  "verified" applies to the read path only (the strip says so, the card text does not).
- No Showcase text found that claims a real backend operation succeeded.

## 6. Documentation gaps

1. **Version drift in shipped docs**: `LIMITATIONS.md` title "@solvfast/ui 0.4.0 (pre-release)", status "updated at 0.4.0-dev.34";
   `forms.md` "0.4.0 (A3)"; `FRAPPE.md` "0.4.0 — simulated backend"; `VALIDATION.md` last entry is 0.3.0 (no 0.4/0.5/0.6 evidence log).
2. **Contradictions**: `LIMITATIONS.md` §Frappe layer "Not supported: child tables, … realtime updates" vs the 0.4 status block and
   FrappeChildTable/realtime skeleton; `forms.md` §3 "Attach … **No upload** (P2)" and §12 "Attach upload is P2" vs
   `FrappeAttachField` uploading via `upload_file` (tests/attach.test.tsx).
3. `list.md` has **two "6b" headings** (report-view export and Core Export/Import); Core `ExportDialog`/`DataImportDialog` are
   documented only in `list.md` (0 mentions in README/CONSUMING/FEATURES).
4. Shipped docs link to **unshipped files**: `docs/VALIDATION.md`, `docs/CONTRACT-0.4.md`, `docs/qa/simulator-caveats.md`,
   `docs/release/PERMISSION-AUDIT.md`, `docs/release/LISTVIEW-FRAPPE-PARITY.md`, `docs/validation/*` — dead links in the tarball.
5. `FEATURES.md` covers only the List View (F1–F41); there is **no Form View feature matrix** (A–P) and no List A–J matrix with
   test ids; the "test names start with the row id" promise holds for F/C rows only.
6. No API reference for `@solvfast/ui/frappe/testing` (only 2 of 25 exports named); `useDocMutations`, `LikeToggle`,
   `ListActionsContext`, `useListRealtime` undocumented; ~500 exports (237 core + 241 frappe + 22 testing + 1 toast) appear in no doc or CHANGELOG (many are helpers that
   arguably should not be public — candidates for an "internal" review before 1.0).
7. Form limitations (menus, print, connections, email, website link, undo) are only in `forms.md` §12 — not in
   `LIMITATIONS.md`, which is the file consumers read first.

## 7. Validation strategy for 0.7.0-dev

**Where new tests go**
| Work | File |
|---|---|
| Form View behaviour through `FrappeForm` (menus K, print L, connections M, allow_on_submit N, email O, web link P) | new `tests/frappe-form-actions.test.tsx` (K, L, P), `tests/frappe-form-connections.test.tsx` (M), `tests/frappe-form-email.test.tsx` (O); A–J additions stay in `tests/frappe-form.test.tsx` |
| Pure Form models (new pure functions) | `tests/frappe-form-model.test.tsx`; Desk-cited parity in `tests/parity/<topic>.test.ts` |
| FrappeField per fieldtype (FV A) | new `tests/frappe-fieldtypes.test.tsx` |
| List: quick entry (G), views (H), sidebar (D), settings (A), page size (I), menu (J) | `tests/frappe-list.test.tsx` for wiring; new `tests/frappe-list-views.test.tsx` (H), `tests/frappe-list-sidebar.test.tsx` (D), `tests/frappe-quick-entry.test.tsx` (G) |
| Generic (Frappe-free) list pieces | `tests/list.test.tsx` |
| Permissions of any new action | `tests/parity/permissions-p27.test.tsx` pattern + `tests/sim-permissions.test.tsx` for the simulator side |
| Recorded-real evidence | extend `tests/real/sada-real.test.tsx` only with new **read-only** captures (`tests/fixtures/real-15.110-sada/`) |

**Naming**: keep "row id first". Use area-scoped ids so they don't collide with FEATURES' F1–F41: `FV.K3 Duplicate copies
no_copy fields…`, `LV.G1 Quick Entry shows only mandatory fields…`; add matching rows (FV.A–P, LV.A–J) to a new
`docs/FEATURES-FORM.md` (or FEATURES.md §Form) with the test id. Unimplemented rows get `it.todo("FV.M1 …")` so the gap is counted
in the vitest total. Mark evidence in the describe title as today: `— SIMULATED`, `— REAL (recorded)`.

**Simulator usage**: `createFixtureTransport(backend, { permissions: simScenario("...") })` from `src/frappe/testing` for every UI
flow that writes; assert request shapes on the recorded `FixtureCall`s, and add a negative control (no right → action hidden and
server 403 rendered). Never phrase simulator results as "verified". Each new write method the simulator answers needs a row in
`docs/qa/simulator-caveats.md`.

**e2e**: `e2e/showcase-smoke.mjs` (every section × theme × language; add new sections to `routes.ts` so it picks them up);
`e2e/stage-b-matrix.mjs` / `e2e/frappe-review.mjs` on the playground's simulated site for screenshots of new form/list UI;
`e2e/list-mobile.mjs` + `e2e/list-groups.mjs` for list layout; `e2e/consumers/run.sh` for the clean install of new exports;
`e2e/frappe-site/validate.mjs` remains prepared-not-run (owner approval needed; read-only).

**Gate list (in order)**
```
npm run typecheck
npm test                      # record "Test Files N passed; Tests N passed | N todo"
npm run check:boundaries
npm run build                 # note: also regenerates tracked styles/*; confirm `git status --short` is clean after
npm run check:package
npm run showcase:build && npm run showcase:preview & node e2e/showcase-smoke.mjs
e2e/consumers/run.sh <workDir>    # when exports change
git status --short                # must be empty
```
Suggested gate addition: a script that diffs the export list of each `dist/*.d.ts` against a committed snapshot (the
`exports.cjs` approach used here) so every new/removed public name is a deliberate, documented change.

## Artifacts (scratch, not in the repo)
- `…/p35/audit/gates/*.log`, `summary.txt` — raw gate output
- `…/p35/audit/exports.json`, `docaudit.json`, `doc-missing.txt`, `scripts/exports.cjs`, `scripts/docaudit.cjs`
- `…/p35/audit/wt/` — scratch copy with `dist/` and `showcase/dist/` (safe to delete)
