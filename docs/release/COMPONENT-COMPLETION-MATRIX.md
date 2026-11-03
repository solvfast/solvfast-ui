# Component completion matrix — @solvfast/ui 0.4.0-dev.32 (2026-11-03; first written at dev.25; rows 7, 21–23 updated at dev.28; rows 7, 15, 17, 18, 21–24 at dev.32; row 14 at dev.33)

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
| 7 | `usePermissions` / `buildDocPermissions` / `rolePermissions` / `fieldDisplayStatus` / `canImport` / `canExport` / `readableFields` / `permissionsKnown` / `isAdministrator` | Frappe | IMPLEMENTED (dev.32) | `./frappe` | `src/frappe/hooks/usePermissions.ts`, `services/permissions.ts` | parity/display-status 39, permissions-matrix 31, **permissions-p27 60**, lead-p26 8, sada-real | ✓ | ✓ agrees with the server for the two Sada role holders (weak: both full-rights); **Administrator role list and `get_doc_permissions` replayed** (P2-4) | rule 9: missing information denies; Administrator user = every role (`permissions.py:506-507`), the "Administrator" ROLE on another user is just a role | restricted users, permlevel > 0, User Permissions, sharing: BLOCKED (no restricted test user may be created) | No |
| 8 | `formatValue` family (`formatNumber`, `formatCurrency`, `formatDate`, `formatDuration`…) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/format.ts` | parity/format 29 (+4 todo) | ✓ | NOT VERIFIED (formats compared with Desk source, not a site) | Banker's rounding epsilon UNVERIFIED | 4 TODO | No |
| 9 | `translateLabel` / `translateText` / `withTranslations` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/translate.ts` | parity/format | ✓ | NOT VERIFIED; `getdoctype` returns no `__messages` in 15.110 (real finding) | Arabic fixtures are a known defect (identical to EN) | needs an app/boot dictionary | No |
| 10 | `FrappeErrorState` / `describeError` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/feedback/FrappeErrorState.tsx` | frappe-list, sada-real | ✓ | ✓ real 403 renders as permission with no Retry (fixed `6f1fc36`) | Retry only for network/server/rate-limited/unavailable | — | No |
| 11 | `FrappeMessagesProvider` / `useFrappeMessages` / `ServerHtml` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/feedback/` | frappe-form, record-frappe-ui | ✓ | NOT VERIFIED | — | — | No |
| 12 | `resolveIndicator` + list/record indicator aliases | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/services/indicator.ts`, `list/indicator.ts`, `record/indicator.ts` | frappe-indicator 13 | ✓ | NOT VERIFIED | two legacy aliases kept (debt) | `listview_settings.get_indicator` not reproduced | No |
| 13 | Realtime: `createSocketRealtime`, `useRealtimeInvalidation`, `useListRealtime` | Frappe | **PARTIALLY IMPLEMENTED** (skeleton) | `./frappe` | `src/frappe/services/realtime.ts`, `hooks/useRealtime.ts`, `list/realtime.ts` | foundation-realtime 2 | fake socket only | BLOCKED (no socket session) | full reload, not Desk's by-name refresh | reconnect behaviour UNVERIFIED | No |
| 14 | `createFixtureTransport` (simulator) + `simScenario.*` permission scenarios | Frappe (testing entry) | IMPLEMENTED (dev.33) | `./frappe/testing` | `src/frappe/testing/{fixtureTransport,permissions,importer}.ts` | foundation-fixture 7, -hardening 18, -sites 9, **sim-permissions 43** | n/a (it is the simulator) | n/a | opt-in server-side permission evaluation (roles, DocPerm, if_owner, User Permissions, sharing, permlevel strip/reset, 403s); handlers for Print, tags, assignment, workflow bulk, report export, Data Import; not reproduced: `docs/qa/simulator-caveats.md` §4.2 | ships as its own entry; `./frappe` never imports it (`check:boundaries`) | n/a |
| 15 | `FrappeListView` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/FrappeListView.tsx`, `useFrappeList.tsx`, `meta.ts`, `query.ts` | frappe-list, frappe, parity/list, list-io, list-actions 26, list-query 34, sada-real | ✓ | ✓ renders real Sada Post Type metadata and rows (jsdom) | Desk's menu and actions (dev.32); width cap ON by default (`columnLimit={false}` opts out); URL filters opt-in; actions are selection-bar buttons, not Desk's dropdown; see `LISTVIEW-FRAPPE-PARITY.md` §5 | browser on a real site NOT VERIFIED; not declared Frappe-compatible | No |
| 16 | `decodeReportview` / `reportviewGet` / `reportviewCount` / `COUNT_UPPER_BOUND` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/list/reportview.ts` | parity/list, sada-real | ✓ | ✓ compressed `{keys, values}`, `[]`, `_comment_count`, count | — | — | No |
| 17 | `buildFrappeListMeta` / `columnsFromMeta` / `filterFieldsFromMeta` / `capDefaultColumns` / `treeDoctypesOf` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/meta.ts`, `list/settings.ts` | frappe-list, parity/list, list-query | ✓ | ✓ built from real metas | width cap counts Tag/Status slots in fixed positions; permlevel headers dropped when rights are known | — | No |
| 18 | `queryToFrappe` / `conditionToFrappe` / `buildListRequest` / `orderByWithTieBreak` / nested-set operators / URL filters | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/query.ts`, `list/urlFilters.ts`, `src/list/model/filters.ts` | parity/list, frappe, list-query | ✓ | NOT VERIFIED: the Sada capture built `form_dict` by hand (`capture-real-sada.py:44-49`), not through `buildListRequest` | nested-set operators sent unchanged (server expands them, `db_query.py:794-842`); URL filters keep non-filter params, no OR/search/sort write-back | — | No |
| 19 | List View Settings: `fetchListSettings` / `applyColumnSettings` | Frappe | IMPLEMENTED (read only) | `./frappe` | `src/frappe/list/settings.ts` | frappe-list, sada-real | ✓ | ✓ `get_list_settings` null on Sada | no settings editor | — | No |
| 20 | Saved filters + user settings (server storage): `createFrappeSavedFilters`, `createFrappeUserSettings`, `queryToTuples` | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/list/storage.ts`, `tuples.ts` | frappe-list | ✓ | BLOCKED (writes List Filter / `__UserSettings`) | OR conjunctions cannot be stored | — | No |
| 21 | Bulk actions: `listActionsMenu` / `bulkMenu`, delete, submit/cancel/edit, assign, **Clear Assignment, Assignment Rule, Add Tags, Print (`FrappePrintDialog`), workflow bulk approval**, `FrappeBulkActions` | Frappe | **PARTIALLY IMPLEMENTED** | `./frappe` | `src/frappe/list/{bulk,print,workflowBulk}.ts`, `FrappeBulkActions.tsx`, `FrappePrintDialog.tsx` | frappe-list, list-io, list-actions 26, permissions-matrix | ✓ | BLOCKED (writes) | Desk's full menu in Desk's order (dev.32); buttons, not a dropdown; Delete / Clear Assignment outcomes cannot list failures (the server answers nothing) | **Print background completion (`task_complete`) needs a host `subscribeTask`** — without it the dialog stays "queued"; Print Settings must come from the host; bulk actions send the row keys as document names, so a custom `rowKey` breaks them (pre-existing) | No |
| 22 | **Export**: `FrappeExportDialog` / `downloadExportTemplate` (Data Exporter `download_template`) and **report-view export** (`FrappeReportExportDialog` / `downloadReportExport`, `export_query`) | Frappe | IMPLEMENTED (dev.32) | `./frappe` | `src/frappe/list/{export,reportExport}.ts`, `FrappeExportDialog.tsx`, `FrappeReportExportDialog.tsx`, `client.ts` `download` | list-io, list-query, lead-p26 | ✓ stubs | BLOCKED (`download_template`: unapproved read; `export_query`: writes an Access Log) | list Export offered to everyone as Desk (owner decision; the server refuses, the dialog shows it); report-view export gated by `canExport` as Desk's report view; "Filtered Records" uses the list's filters | never run on a site | No |
| 23 | **Import**: list entry → Data Import list; **`FrappeDataImport`** (upload, server preview + warnings, **column mapping**, Start/Retry, server-confirmed result, log, errored rows); `startDataImport` and helpers | Frappe | IMPLEMENTED (dev.32) | `./frappe` | `src/frappe/list/{import,importMapping}.ts`, `FrappeDataImport.tsx`, `ImportPreview.tsx`, `ColumnMapping.tsx` | list-io, import-ui 30 | ✓ stubs (Desk's exact sequence) | BLOCKED (every step is a write) | not reproduced: Google Sheets, "Report Error", changing import type after creation, re-reading the preview after a run; progress by polling unless the app passes `subscribe` | never run on a site | No |
| 24 | `FrappeForm` / `FrappeFormView` (load, save lifecycle, submit/cancel/amend, Cancel All, read-only, skeleton) | Frappe | IMPLEMENTED | `./frappe` | `src/frappe/form/FrappeForm.tsx`, `FrappeFormView.tsx` | frappe-form 33, record-form-fixes 6, review-r1 22, review-r2 11, permissions-p27, sada-real | ✓ | ✓ renders the real Sada Lifecycle with child rows (jsdom); save BLOCKED | no Client Scripts (D-24), no undo, viewers, Connections, print, rename, Duplicate, prev/next; **without permission information the view is read-only (dev.32)**; Cancel All only when known true | Attach upload P2 | No |
| 25 | `FrappeField` (fieldtype coverage) | Frappe | **PARTIALLY IMPLEMENTED** | `./frappe` | `src/frappe/form/FrappeField.tsx` | frappe-form, fields 30 | ✓ | ✓ (fields rendered from real metas) | fieldtypes not supported listed in `forms.md` §3 (Attach, Geolocation, Signature, …) | P3: a read-only Date shows the format-context pattern (`yyyy-mm-dd`) while the editable `DateField` shows "20 Nov 2026" for the same value (showcase finding, sim27) | No |
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

Frappe-kind rows: 37 (1–35, 45, 46). **Counting rule (fixed at dev.25, unchanged):** 46 units; a new component that serves an existing unit (Print → 21, the
import UI → 23, report export → 22) is counted inside that unit, never as a new row. Of those, 14 (simulator) and 45 (types) are excluded from the verification percentages; 22 and 23 were MISSING at
dev.25 and are counted from dev.28, leaving **35 verifiable Frappe units**.

| Measure | Count | % |
|---|---:|---:|
| IMPLEMENTED (complete against its own contract) | 40 / 46 | 87 % |
| PARTIALLY IMPLEMENTED (rows 13, 21, 25, 33) | 4 / 46 | 9 % |
| MISSING | 0 / 46 | 0 % (22 and 23 were MISSING at dev.25) |
| n/a (14 simulator, 45 types) | 2 / 46 | 4 % |
| VERIFIED — SIMULATED | 35 / 35 verifiable Frappe units | 100 % |
| VERIFIED — REAL FRAPPE, read path (rows 1, 2, 3, 5, 7*, 10, 15, 16, 17, 19, 24, 25, 26, 27, 34, 46) | 16 / 35 | 46 % |
| BLOCKED for real verification (every write path: 6, 13, 20, 21, 33 whole; parts of 1, 24, 32) | 5 whole + 3 partial | — |
| PRODUCTION READY (0.4 Frappe layer) | **0** | 0 % |

\* row 7's real check is weak (full-rights users only). Row 18 was moved to NOT VERIFIED (see its cell).

**Honest completion figure:** 40/46 = **87 % implemented** (dev.25: 80 %, dev.28: 85 %); **46 % of verifiable Frappe units touched by real responses on the read path,
0 % on writes, 0 % production ready.** The 0.3.x generic list/form rows (36, 37, 44) were already published and are the only shipped units.

## 3. What is genuinely ready to demonstrate (showcase scope)

Demonstrable now, on the simulated site, with the label "simulated; read path verified against recorded real 15.110 responses" where
row "Real Frappe" says ✓: FrappeListView (15–19), FrappeForm + fields + Link + child table (24–27), FrappeErrorState (10), permissions ladder (7, with
the roles supplied), workflow actions / timeline / assign (32–35, simulated only), generic record and list components (36–43).

**Demonstrable from dev.32, simulated only:** Import (list entry, `FrappeDataImport` with preview and column mapping), Export
(list Export for everyone with the server's refusal shown; report-view export with the right), Desk's full Actions menu
(Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk approval), width cap, nested-set and URL filters. The
showcase's simulated Export answer is a labelled text file with no business data. Realtime (13) is a skeleton.

**Not production ready, and why (applies to every 0.4 unit):** no write has run against a real site; no authenticated
session has been tested; permission behaviour with restricted users is verified only against test doubles and the
simulator (no restricted real user exists or may be created). The no-roles fallback is no longer optimistic (rule 9,
dev.27; forms without permission information, dev.32).

## 4. Sources checked for this matrix

`src/frappe/index.ts` + every sub-index (exports); `tests/**` (counts: `grep -cE '^\s*(it|test)\('`); `docs/components/*.md` "Known limitations";
`docs/qa/review-r3.md`; `apps/serve_fast/docs/frappe-components/{60,61,62}.md`; native: `frappe/public/js/frappe/model/model.js:434-450`,
`frappe/public/js/frappe/list/list_view.js:1699-2128`, `bulk_operations.js:463-474`, `frappe/permissions.py:136-225, 600-615`,
`frappe/desk/reportview.py:352-400`, `frappe/core/doctype/data_import/{data_import.py:60-260, exporter.py:105-130}`, `data_export/exporter.py:31-75`.
