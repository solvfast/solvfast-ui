# Component completion matrix — @solvfast/ui 0.4.0-dev.28 (2026-11-03; first written at dev.25, rows 7, 21, 22, 23 updated after the Phase 26 merges)

**Denominator (fixed before counting): 46 units** = every component, hook and service group exported from `@solvfast/ui/frappe`
(`src/frappe/index.ts` at `017c7f9`), plus the generic list, record and field controls the contract names (`docs/CONTRACT-0.4.md` §1–2,
`docs/components/{foundation,forms,list,record}.md`), plus the two list capabilities this phase requires and the package does not have
(Import, Export). Core primitives (Button, Dialog, …, 60+ exports of `@solvfast/ui`) are 0.1–0.3 work and are not counted here.

**Status words.** IMPLEMENTED · PARTIALLY IMPLEMENTED · MISSING · VERIFIED — SIMULATED (fixture transport or recorded payloads) ·
VERIFIED — REAL FRAPPE (recorded real 15.110 responses from Sada, or real HTTP as Guest; see `docs/…/62`, `tests/real/sada-real.test.tsx`) ·
NOT VERIFIED · BLOCKED (cannot be verified without a site write or an authenticated session) · PRODUCTION READY (no unit is; see §3).

Evidence for the "Real" column comes only from `tests/real/sada-real.test.tsx` (16 tests). "Real" there means recorded in-process responses
and anonymous HTTP through the built client, **not** an authenticated session from an app. Nothing has been written to a real site.

## 1. Matrix

| # | Unit | Kind | Status | Export | Source | Tests | Simulated | Real Frappe | Differences from native | Remaining limitations | Prod ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `createFrappeClient` / `FrappeApi` (call, getList, getDoc, getMetaBundle, searchLink, validateLink, savedocs, cancel, delete, rename, run_doc_method) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/client.ts` | foundation-client 11, foundation-api 17, frappe 41, sada-real | ✓ | **read calls ✓** (getdoctype, getdoc, reportview, search_link, validate_link, get_list_settings); writes BLOCKED | retries/`frappeRetry` policy is the package's own | writes untested on a site | No |
| 2 | `FrappeError` / `toFrappeError` / `frappeErrorKind` / `parseServerMessages` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/client.ts` | parity/errors 14 (+5 todo), sada-real | ✓ | **✓ real HTTP**: 403 → permission, 417 → validation, Guest + bogus CSRF not rejected | — | 409 / 413 / session-expiry / logged-in CSRF: BLOCKED (need a session) | No |
| 3 | `FrappeProvider`, `useFrappeClient/Api/Settings`, `createFrappeQueryClient` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/FrappeProvider.tsx` | frappe, foundation-hooks 22 | ✓ | ✓ (used by every real-response test) | — | — | No |
| 4 | `readFrappeBoot` / `formatContextFromBoot` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/boot.ts` | foundation-boot 4 | ✓ | NOT VERIFIED (D-25 boot merged into the CRM work copy, never served) | boot shape is the package's `#sf-boot` JSON, not Desk's `frappe.boot` | needs a build window | No |
| 5 | `useMetaBundle` / `useDoc` / `useDocInfo` (+ cache rules `applySavedDoc`…) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/hooks/useDoc.ts`, `services/cache.ts` | foundation-hooks, parity/keys 6 (+5 todo) | ✓ | ✓ getdoc + docinfo normalised from real responses | cache keys are the package's (`sf-frappe`) | 5 cache-invalidation rules are TODO tests | No |
| 6 | `useSaveDoc` / `useDocAction` (save, submit, cancel, delete, rename, run method, workflow, assign, comment) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/hooks/useDocMutations.ts` | foundation-hooks, record-frappe 20 | ✓ | BLOCKED (writes) | — | never run against a site | No |
| 7 | `usePermissions` / `buildDocPermissions` / `rolePermissions` / `fieldDisplayStatus` / `canImport` / `canExport` / `readableFields` / `permissionsKnown` | Frappe | IMPLEMENTED (dev.27) | `./frappe` | `src/frappe/hooks/usePermissions.ts`, `services/permissions.ts` | parity/display-status 39, permissions-matrix 31, lead-p26 8, sada-real | ✓ | ✓ agrees with the server for the two Sada role holders — **weak** (both full-rights) | rule 9: missing information denies (Desk would use role rows it always has); Administrator keyed on the user name | restricted users, permlevel > 0, User Permissions, sharing: BLOCKED / not testable on Sada | No |
| 8 | `formatValue` family (`formatNumber`, `formatCurrency`, `formatDate`, `formatDuration`…) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/format.ts` | parity/format 29 (+4 todo) | ✓ | NOT VERIFIED (formats compared with Desk source, not a site) | Banker's rounding epsilon UNVERIFIED | 4 TODO | No |
| 9 | `translateLabel` / `translateText` / `withTranslations` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/translate.ts` | parity/format | ✓ | NOT VERIFIED; `getdoctype` returns no `__messages` in 15.110 (real finding) | Arabic fixtures are a known defect (identical to EN) | needs an app/boot dictionary | No |
| 10 | `FrappeErrorState` / `describeError` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/feedback/FrappeErrorState.tsx` | frappe-list, sada-real | ✓ | ✓ real 403 renders as permission with no Retry (fixed `6f1fc36`) | Retry only for network/server/rate-limited/unavailable | — | No |
| 11 | `FrappeMessagesProvider` / `useFrappeMessages` / `ServerHtml` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/feedback/` | frappe-form, record-frappe-ui | ✓ | NOT VERIFIED | — | — | No |
| 12 | `resolveIndicator` + list/record indicator aliases | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/indicator.ts`, `list/indicator.ts`, `record/indicator.ts` | frappe-indicator 13 | ✓ | NOT VERIFIED | two legacy aliases kept (debt) | `listview_settings.get_indicator` not reproduced | No |
| 13 | Realtime: `createSocketRealtime`, `useRealtimeInvalidation`, `useListRealtime` | Frappe | **PARTIALLY IMPLEMENTED** (skeleton) | `./frappe` | `src/frappe/services/realtime.ts`, `hooks/useRealtime.ts`, `list/realtime.ts` | foundation-realtime 2 | fake socket only | BLOCKED (no socket session) | full reload, not Desk's by-name refresh | reconnect behaviour UNVERIFIED | No |
| 14 | `createFixtureTransport` (simulator) | Frappe (testing entry) | IMPLEMENTED | `./frappe/testing` | `src/frappe/testing/fixtureTransport.ts` | foundation-fixture 7, -hardening 18, -sites 9 | n/a (it is the simulator) | n/a | known differences in `docs/qa/simulator-caveats.md` | boundary-checked out of `./frappe` | n/a |
| 15 | `FrappeListView` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/FrappeListView.tsx`, `useFrappeList.tsx`, `meta.ts`, `query.ts` | frappe-list 38, parity/list 28, sada-real | ✓ | ✓ renders real Sada Post Type metadata and rows (jsdom) | no Import / Export menu entries (native `list_view.js:1703`, `:2075`); no width-based column cap; no 90-day recency filter; columns do not drop permlevel > 0 fields the user cannot read (server strips values; header still offered) | browser on a real site NOT VERIFIED | No |
| 16 | `decodeReportview` / `reportviewGet` / `reportviewCount` / `COUNT_UPPER_BOUND` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/list/reportview.ts` | parity/list, sada-real | ✓ | ✓ compressed `{keys, values}`, `[]`, `_comment_count`, count | — | — | No |
| 17 | `buildFrappeListMeta` / `columnsFromMeta` / `filterFieldsFromMeta` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/meta.ts` | frappe-list, parity/list | ✓ | ✓ built from real metas | no permlevel filtering (see 15) | — | No |
| 18 | `queryToFrappe` / `conditionToFrappe` / `buildListRequest` / `orderByWithTieBreak` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/query.ts` | parity/list, frappe | ✓ | NOT VERIFIED: the Sada capture built `form_dict` by hand (`capture-real-sada.py:44-49`), not through `buildListRequest`; the Guest `getList` was refused (403) before the query ran | nested-set operators missing | — | No |
| 19 | List View Settings: `fetchListSettings` / `applyColumnSettings` | Frappe | IMPLEMENTED (read only) | `./frappe` | `src/frappe/list/settings.ts` | frappe-list, sada-real | ✓ | ✓ `get_list_settings` null on Sada | no settings editor | — | No |
| 20 | Saved filters + user settings (server storage): `createFrappeSavedFilters`, `createFrappeUserSettings`, `queryToTuples` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/list/storage.ts`, `tuples.ts` | frappe-list | ✓ | BLOCKED (writes List Filter / `__UserSettings`) | OR conjunctions cannot be stored | — | No |
| 21 | Bulk actions: `bulkMenu`, `bulkDelete`, `bulkSubmitCancelOrUpdate`, `bulkAssign`, `FrappeBulkActions` (+ selection-bar Export) | Frappe | **PARTIALLY IMPLEMENTED** | `./frappe` | `src/frappe/list/bulk.ts`, `FrappeBulkActions.tsx` | frappe-list, list-io, permissions-matrix | ✓ | BLOCKED (writes) | missing: Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk approval (`list_view.js:2075-2128`); Assign To gated on `read` (server rule), Desk shows it to all; Delete outcome cannot list failures (`delete_items` answers nothing) | queued (20–500) outcome UNVERIFIED at runtime | No |
| 22 | **Export** (`FrappeExportDialog`, `downloadExportTemplate` → Data Exporter `download_template`; menu + selection bar) | Frappe | IMPLEMENTED (dev.28) | `./frappe` | `src/frappe/list/export.ts`, `FrappeExportDialog.tsx`, `client.ts` `download` | list-io 22, lead-p26 | ✓ stubs | BLOCKED (unapproved read; the file path writes nothing — `desk/utils.py:60-66`) | hidden without the `export` right where Desk shows it to all (rule D.1); filtered export uses the list's filters (no in-dialog FilterGroup); Report-view `export_query` not reproduced | never run on a site | No |
| 23 | **Import** (gated list menu entry → Data Import; `startDataImport` sequence, `useImportStatus`, templates, errored rows, logs) | Frappe | **PARTIALLY IMPLEMENTED** (dev.28) | `./frappe` | `src/frappe/list/import.ts`, `client.ts` `uploadFile` | list-io | ✓ stubs (Desk's exact call sequence) | BLOCKED (every step is a write) | no preview grid / column mapper / log table (functions only; ~300–400 lines, owner decision); progress polled, not realtime; default route `/app/data-import/new?reference_doctype=` vs Desk's list route | never run on a site | No |
| 24 | `FrappeForm` / `FrappeFormView` (load, save lifecycle, submit/cancel/amend, Cancel All, read-only, skeleton) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/FrappeForm.tsx`, `FrappeFormView.tsx` | frappe-form 33, record-form-fixes 6, review-r1 22, review-r2 11, sada-real | ✓ | ✓ renders the real Sada Lifecycle with child rows (jsdom); save BLOCKED | no Client Scripts (D-24), no undo, viewers, Connections, print, rename, Duplicate, prev/next | Attach upload P2 | No |
| 25 | `FrappeField` (fieldtype coverage) | Frappe | **PARTIALLY IMPLEMENTED** | `./frappe` | `src/frappe/form/FrappeField.tsx` | frappe-form, fields 30 | ✓ | ✓ (fields rendered from real metas) | fieldtypes not supported listed in `forms.md` §3 (Attach, Geolocation, Signature, …) | — | No |
| 26 | `FrappeLinkField` / `FrappeDynamicLinkField` / `useLinkTitles` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/FrappeLinkField.tsx`, `linkTitles.ts` | frappe-form, sada-real (search_link, validate_link) | ✓ | ✓ search and validation on real responses | Dynamic Link with Single DocTypes (R1-F12, P3) | — | No |
| 27 | `FrappeChildTable` / `gridColumns` / `useLocalTableController` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/FrappeChildTable.tsx` | frappe-form, frappe-form-model 29 | ✓ | ✓ real child rows (Lifecycle Status / Transition) | no row-form dialog parity beyond the grid | — | No |
| 28 | `FrappeTableMultiSelect` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/FrappeTableMultiSelect.tsx` | frappe-form | ✓ | NOT VERIFIED (no such field in Sada) | — | — | No |
| 29 | Behaviour engine: expression evaluator (D-23), depends_on, defaults, mandatory, fetch_from, doc store | Frappe | IMPLEMENTED | `./frappe` (`form/model`) | `src/frappe/form/model/*` | parity/dependencies 31 (+2 todo), mandatory 23, frappe-form-model | ✓ (929/947 installed-app expressions equal Desk; 18 unsupported by decision) | NOT VERIFIED on a site | 18 expressions unsupported (D-23 ratified) | `read_only_depends_on` TODO | No |
| 30 | `formEvents` / `runEvent` / `resolveLinkQuery` (D-24) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/events.ts` | frappe-form (policy tests) | ✓ | NOT VERIFIED | compatibility boundary documented (`forms.md` §10) | — | No |
| 31 | `FrappeFormServices` / `useFormServices` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/services.tsx` | frappe-form | ✓ | NOT VERIFIED | — | — | No |
| 32 | `FrappeWorkflowActions` / `useWorkflow` / `useWorkflowDefinition` / workflow helpers | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/record/FrappeWorkflowActions.tsx`, `useWorkflow.ts`, `workflow.ts` | record-frappe 20, record-frappe-ui 18, parity/record 29 | ✓ | NOT VERIFIED (Sada has no Frappe Workflow; `__workflow_docs` empty) — applying is a write | `condition` server-only; queued submissions return no doc | brief flash P3 | No |
| 33 | `FrappeAssignTo` | Frappe | **PARTIALLY IMPLEMENTED** | `./frappe` | `src/frappe/record/FrappeAssignTo.tsx` | record-frappe-ui | ✓ | BLOCKED (writes) | close / bulk / group assignment missing | `single` is a UI choice | No |
| 34 | `FrappeTimeline` / `buildTimelineItems` / `formatVersion` / `useCommunications` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/record/FrappeTimeline.tsx`, `timeline.ts`, `useCommunications.ts` | record-frappe-ui, parity/record | ✓ | ✓ docinfo arrays normalised from real responses (empty on Sada) | no energy points, hook items, reply buttons, viewers | comment publish/unpublish missing | No |
| 35 | `FrappeStatusIndicator` / `stateEntries` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/record/FrappeStatusIndicator.tsx`, `stateHistory.ts` | record-frappe-ui | ✓ | NOT VERIFIED | — | translated-site `workflow_logs` UNVERIFIED | No |
| 36 | Generic `ListView` + `useListState`, `ListTable`, `GroupedListTable` | Generic | IMPLEMENTED | `.` | `src/list/` | list 59, merged 34 | n/a | n/a | — | — | 0.3.x shipped |
| 37 | Generic `FilterBuilder`, `SavedFilters`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`, `BulkActionBar` | Generic | IMPLEMENTED | `.` | `src/list/parts/` | list, merged | n/a | n/a | — | — | 0.3.x shipped |
| 38 | Generic `Timeline`, `filterItems`, `sortItems` | Generic | IMPLEMENTED | `.` | `src/record/` | record 23 | n/a | n/a | — | — | No (new in 0.4) |
| 39 | Generic `CommentComposer` (mentions, `draftToHtml`, sanitiser) | Generic | IMPLEMENTED | `.` | `src/record/` | record | n/a | n/a | — | jsdom only | No |
| 40 | Generic `AssigneeGroup` / `AssignPicker` | Generic | IMPLEMENTED | `.` | `src/record/` | record | n/a | n/a | — | — | No |
| 41 | Generic `LifecycleBar` / `ActionBar` / `StatusBadge` | Generic | IMPLEMENTED | `.` | `src/record/` | record | n/a | n/a | — | — | No |
| 42 | Generic field controls: `NumberInput`, `TimeInput`, `DurationInput`, `ReadOnlyValue`, `LinkInput`, `TagInput`, `DataGrid`, `Rating`, `ColorInput`, `FieldShell` | Generic | IMPLEMENTED | `.` | `src/fields/` | fields 30 | n/a | n/a | — | — | No |
| 43 | `ListActionsContext` / `useListActions` | Generic | IMPLEMENTED | `.` | `src/list/` | list | n/a | n/a | — | — | No |
| 44 | `@solvfast/ui/form` (react-hook-form wiring) | Generic | IMPLEMENTED | `./form` | `src/form/` | merged | n/a | n/a | — | — | 0.3.x shipped |
| 45 | Contract types + query keys (`src/frappe/contract.ts`) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/contract.ts` | compile-time | ✓ | ✓ (real responses typed through them) | — | — | n/a |
| 46 | `invalidateFrappeList` / `frappeLinkSearch` / `loadDocTypeBundle` (0.3.x helpers) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/useFrappeList.tsx` | frappe 41 | ✓ | ✓ (`loadDocTypeBundle` on real metas) | — | — | No |

## 2. Counts (denominator 46)

Frappe-kind rows: 37 (1–35, 45, 46). Of those, 14 (simulator) and 45 (types) are excluded from the verification percentages; 22 and 23 were MISSING at
dev.25 and are counted from dev.28, leaving **35 verifiable Frappe units**.

| Measure | Count | % |
|---|---:|---:|
| IMPLEMENTED (complete against its own contract) | 39 / 46 | 85 % |
| PARTIALLY IMPLEMENTED (rows 13, 21, 23, 25, 33) | 5 / 46 | 11 % |
| MISSING | 0 / 46 | 0 % (22 and 23 were MISSING at dev.25) |
| n/a (14 simulator, 45 types) | 2 / 46 | 4 % |
| VERIFIED — SIMULATED | 35 / 35 verifiable Frappe units | 100 % |
| VERIFIED — REAL FRAPPE, read path (rows 1, 2, 3, 5, 7*, 10, 15, 16, 17, 19, 24, 25, 26, 27, 34, 46) | 16 / 35 | 46 % |
| BLOCKED for real verification (every write path: 6, 13, 20, 21, 33 whole; parts of 1, 24, 32) | 5 whole + 3 partial | — |
| PRODUCTION READY (0.4 Frappe layer) | **0** | 0 % |

\* row 7's real check is weak (full-rights users only). Row 18 was moved to NOT VERIFIED (see its cell).

**Honest completion figure:** 39/46 = **85 % implemented** (dev.25: 80 %); **46 % of verifiable Frappe units touched by real responses on the read path,
0 % on writes, 0 % production ready.** The 0.3.x generic list/form rows (36, 37, 44) were already published and are the only shipped units.

## 3. What is genuinely ready to demonstrate (showcase scope)

Demonstrable now, on the simulated site, with the label "simulated; read path verified against recorded real 15.110 responses" where
row "Real Frappe" says ✓: FrappeListView (15–19), FrappeForm + fields + Link + child table (24–27), FrappeErrorState (10), permissions ladder (7, with
the roles supplied), workflow actions / timeline / assign (32–35, simulated only), generic record and list components (36–43).

**Demonstrable from dev.28, simulated only:** the gated Import/Export entries and the Export dialog (22, 23); no file is produced in the showcase. Realtime (13) is a skeleton. Bulk actions (21)
cover delete / submit / cancel / edit / assign only.

**Not production ready, and why (applies to every 0.4 unit):** no write has run against a real site; no authenticated session has been
tested; permission behaviour with restricted users is unverified; the no-roles permission fallback is optimistic.

## 4. Sources checked for this matrix

`src/frappe/index.ts` + every sub-index (exports); `tests/**` (counts: `grep -cE '^\s*(it|test)\('`); `docs/components/*.md` "Known limitations";
`docs/qa/review-r3.md`; `apps/serve_fast/docs/frappe-components/{60,61,62}.md`; native: `frappe/public/js/frappe/model/model.js:434-450`,
`frappe/public/js/frappe/list/list_view.js:1699-2128`, `bulk_operations.js:463-474`, `frappe/permissions.py:136-225, 600-615`,
`frappe/desk/reportview.py:352-400`, `frappe/core/doctype/data_import/{data_import.py:60-260, exporter.py:105-130}`, `data_export/exporter.py:31-75`.
