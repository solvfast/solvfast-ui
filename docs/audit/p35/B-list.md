# Agent B — List View audit of `@solvfast/ui` 0.6.0

Worktree `/home/frappe/sfui-dev/p35-pkg`, commit `0ef45c1` (Release 0.6.0). READ-ONLY audit; `git status` clean before and after.

## Conventions

- **Tests are cited from source at 0ef45c1, not executed in this audit.** The worktree has no `node_modules`; installing is
  forbidden, and a sibling worktree's vitest binary would not resolve p35's imports. (An `npx vitest` attempt tried to
  fetch vitest into the user-level npx cache, failed with ENOTEMPTY, and changed nothing in the repo.)
- **COMPLETE** = implemented AND a test exercises the behaviour. A UI item needs a rendered (RTL) test; a pure-logic item
  (request builder, menu gate) can be COMPLETE on a unit test. Implemented but untested = PARTIAL.
- **BLOCKED-REQUIRES-REAL-FRAPPE** = implemented and tested against a mock or the simulator, but the item depends on
  server behaviour that no recorded response covers. The item stays blocked until it runs on a real site.
- **Evidence classes:**
  - `mock` = `createMockFrappe` / stub transports (tests/frappe.test.tsx, tests/frappe-list.test.tsx, parity/list).
  - `sim` = the simulator `src/frappe/testing/fixtureTransport.ts` (list-actions, list-io, rowkey, sim-permissions,
    frappe-list-header, like, list-query).
  - `rec` = recorded real Frappe 15.110 responses (tests/real/sada-real.test.tsx). These cover read paths only:
    getdoctype, reportview.get, get_count, search_link, the Guest 403.
  - `site` = a real site. **No list behaviour in this package was exercised on a real site.**
- **Layer:** `Core` = `src/list/**` (no Frappe). `Frappe` = `src/frappe/**`.
- **Showcase:** `SC:frappe` = `showcase/src/pages/frappe/index.tsx` (FrappeListViewPage :99-170, Approval Memo :385,
  Travel Request import/export :695-704). `SC:data` = `showcase/src/pages/data.tsx`. `SC:scen` =
  `showcase/src/pages/frappe/scenarios.tsx:225`.

Test file abbreviations: `L`=tests/list.test.tsx, `LQ`=tests/list-query.test.tsx, `LA`=tests/list-actions.test.tsx,
`LSH`=tests/list-selection-header.test.tsx, `FLH`=tests/frappe-list-header.test.tsx, `FL`=tests/frappe-list.test.tsx,
`F`=tests/frappe.test.tsx, `LIO`=tests/list-io.test.tsx, `RK`=tests/rowkey.test.tsx, `LK`=tests/like.test.tsx,
`PL`=tests/parity/list.test.ts, `SP`=tests/sim-permissions.test.tsx, `P27`=tests/parity/permissions-p27.test.tsx,
`SR`=tests/real/sada-real.test.tsx, `FI`=tests/frappe-indicator.test.ts, `FF`=tests/frappe-form.test.tsx.
The number after a file is the line of the `it(...)`.

---

## A. Columns

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| A1 | Default columns from `in_list_view`; Subject (title field, else ID) first | COMPLETE | Frappe | meta.ts:141-150 `columnsFromMeta`; useFrappeList.tsx:482-489 | F:160 "matches Sear's buildGridMeta…", F:180 "no in_list_view field → the title field…", FL:589 "without curated columns the title field (else the ID) is the first, visible column", SR:165 "FrappeListView renders the real Sada Post Type metadata and rows" | SC:frappe | mock, sim, rec | — |
| A2 | List View Settings (read): `fields` order, `total_fields`, `status_field`, `disable_count`, `disable_comment_count`, `disable_auto_refresh`, `allow_edit` | COMPLETE (read only) | Frappe | list/settings.ts:22-62; useFrappeList.tsx:455-457, 476, 595 | FL:203 "`fields` reorders (title first), `total_fields` caps…", FL:209, FL:84 "disable_comment_count… disable_count → no count call", FL:492 "disable_auto_refresh turns it off", LQ:244 "List View Settings total_fields wins over the width" | — | mock, sim | Writing the settings is missing (see J7). `disable_sidebar_stats` and `disable_automatic_recency_filters` are read but nothing uses them, because there is no sidebar and no recency filter. |
| A3 | Desk width-based column cap (4/6/10 slots, Tag/Status slots, ID column appended), responsive to resize | COMPLETE | Frappe | settings.ts:71-137; useFrappeList.tsx:330-337, 516-524; FrappeListView.tsx:123 (default **on**) | LQ:212, LQ:217, LQ:233 "at ${width} px the list shows…", LQ:250 "responsive: crossing 1366 / 1920 re-caps…", LQ:276, LQ:289, LIO:510 "generated columns are capped by width by default" | — | sim (jsdom width) | **Doc drift:** docs/components/list.md §9 still calls the cap "opt-in". It is opt-in in `useFrappeList` and default-on in `FrappeListView`. |
| A4 | User-configured columns: add/remove in the column manager, searchable "Add column", locked columns | COMPLETE | Core | parts/Toolbar.tsx:76-230; useListState.ts:438 | L:539 "PMO's column manager: × removes, Add column lists every other field…", L:592, L:609 | SC:data, SC:frappe | unit | — |
| A5 | Column ordering (drag + keyboard ↑/↓, announced) | COMPLETE | Core | Toolbar.tsx:99-140 | L:557 "reorder: grip + ↑/↓ keys… and pointer drag" | SC:data | unit | — |
| A6a | Column/sort/group/quick-filter persistence, localStorage (`sf:list:<viewKey>`), per user via `userKey` | COMPLETE | Core | model/storage.ts:142-158; useListState.ts:374-377 | L:171 "columns, sort, group-by and quick filters survive a remount", L:186, L:523 "…per view and per user" | — | unit | — |
| A6b | Server persistence in `user_settings` (Desk keys `sort_by`/`sort_order`/`filters` + package `List.sf_ui`) | BLOCKED-REQUIRES-REAL-FRAPPE | Frappe | list/storage.ts:201-250; FrappeListView.tsx:238-245 | FL:300 "user settings: load from getdoctype's user_settings; save keeps Desk's keys, batches, skips unchanged", FL:324 | SC:frappe (`serverStorage`) | mock | storage.ts:147 itself marks it **UNVERIFIED** whether Desk's deep merge keeps the unknown `sf_ui` key. An OR query is not stored. |
| A7 | Per-column width / resize | NOT APPLICABLE | Core | ColumnDef has `className` only (model/columns.ts:20) | — | — | — | Desk's List View has no column resizing. Report View does; see H1. |
| A8 | Cell formatting: Int/Float/Currency/Percent/Date/Datetime/Time via site formats, Check yes/no, User links → full name, nowrap | COMPLETE | Frappe + Core | useFrappeList.tsx:499-515; services/format.ts; parts/ListTable.tsx:45 DefaultCell | FL:532 "numbers, currency and dates use the site's formats", FL:564 "allocated_to: full name from the User lookup…", FL:579, L:83 "F2 default cell per type, in English and Arabic" | SC:frappe | mock, sim | Select/DocField labels are not translated (LIMITATIONS); use `fieldLabels`. |
| A9 | Custom fields as columns/filters | PARTIAL | Frappe | meta.ts:105-150 (reads `meta.fields`, which getdoctype returns with custom fields merged) | none: every fixture has `is_custom_field: null` | — | — | Works by construction but no test covers it. **Rec:** add a fixture field with `is_custom_field: 1, in_list_view: 1, in_standard_filter: 1` to the simulator ToDo and assert column, quick filter and request (tests/frappe-list.test.tsx). |
| A10 | Permlevel > 0 columns hidden when the user cannot read them | COMPLETE | Frappe | meta.ts `restrictMetaToReadable`; useFrappeList.tsx:357-362 | LIO:410, LIO:424 "a level-0 role never sees the Secret column and never requests the field" | — | sim | Needs `session.roles`; without roles the header still shows (the server strips the values). |
| A11 | Row-metadata columns (indicator, assignees, comments, likes) offered in the column manager, hidden by default | COMPLETE | Frappe | list/cells.tsx:66-74; useFrappeList.tsx:490-498 | FL:62 "row metadata columns are offered, hidden by default…", FL:70 | SC:frappe | mock | Default hidden (0.3.x look). Desk always shows them; `rowMeta={true}` shows them. |

## B. Filters

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| B1 | `in_standard_filter` → quick filters | COMPLETE | Frappe | meta.ts:201 `quickFilterFields`; FrappeListView.tsx:252 | F:308 "loads meta once… columns, quick filters and total from the DocType", F:321 "a quick filter reaches list and count identically" | SC:frappe | mock | — |
| B2 | Standard filter bar (inline quick-filter controls; optional user-chosen fields) | COMPLETE | Core | Toolbar.tsx:234 `QuickFilters` | L:304, L:318, L:327 "the field picker is opt-in, and the chosen fields survive a remount" | SC:data, SC:frappe | unit | — |
| B3 | Operators (like/not like/=/!=/in/not in/>/</>=/<=/is set/not set/between/timespan/fiscal year/nested-set) → Frappe tuples | PARTIAL | Core + Frappe | model/filters.ts:51-102; query.ts:41-77 | L:195, L:204, L:227, L:882, L:890, L:904, L:923, PL:77-107 (L-04), F:208, F:219, F:228, F:518, LQ:61-134 | SC:data | unit, mock, sim | Desk offers In / Not In on Date fields; the package does not (LIMITATIONS:128). Link has no `not like`. **Rec:** Core `OPERATORS_BY_TYPE.date` + a date-list value input in FilterBuilder.tsx. |
| B4 | Multiple filters (add / edit / remove, count badge) | COMPLETE | Core | parts/FilterBuilder.tsx | L:349 "add, edit, AND/OR, remove, clear — and the count badge", L:372, L:385 | SC:data | unit | — |
| B5 | AND / OR conjunction (OR → `or_filters`; search narrows to the title field and says so) | COMPLETE | Core + Frappe | query.ts:82-95, 168-178 | L:349, F:277, F:284, F:291, F:355 "C2 in the UI: with "Match any" filters, search narrows…" | SC:frappe | mock | One conjunction for the whole query, no nested groups. This goes beyond Desk's List View, which is AND only. OR queries cannot be saved (List Filter, user_settings) or written to the URL. |
| B6 | Child-table field filters (4-tuples, join, distinct count) | COMPLETE | Frappe | meta.ts:123-138; query.ts:89-91, 162-184 | FL:223, FL:230 "a child condition becomes [child doctype, field, op, value]…", PL:46 | — | mock | — |
| B7 | Clear filters (builder Clear; "Clear filters" in the filtered-empty state) | COMPLETE | Core | ListView.tsx:168-172 | L:349, L:814 "F28 two empty messages…", FL:595 | SC:frappe | unit, mock | — |
| B8 | URL sync (read `?field=value` / `["op",v]` / route options; write back with replaceState) | COMPLETE (opt-in) | Frappe | list/urlFilters.ts; useFrappeList.tsx:530-546 | LQ:305, LQ:318, LQ:331, LQ:339, LQ:350, LQ:369, LQ:396, LQ:403 | — | sim (jsdom location) | Off by default (`urlFilters`), while Desk always syncs. OR, search and sort are not written. Non-filter parameters are kept. |
| B9 | Filters on fields the DocType no longer has are dropped, not sent | COMPLETE | Frappe | query.ts:86 | F:238, F:421 | — | mock | — |
| B10 | Link filter values from `search_link` | COMPLETE | Frappe | useFrappeList.tsx:377-383 | F:446, L:449 | SC:frappe | mock | — |
| B11 | Indicator pill click → filter (Desk filter-on-click) | COMPLETE | Frappe + Core | cells.tsx:13-23; ListActionsContext.ts; ListView.tsx:188-191 | FL:188 "shows Draft / Submitted / Cancelled pills; clicking one filters by docstatus" | — | mock | — |
| B12 | Standard filter fields: owner, modified_by, docstatus (submittable), creation/modified | COMPLETE | Frappe | meta.ts:105-118 | FL:223 "offers owner, modified_by, docstatus (submittable)…" | — | mock | — |
| B13 | Filter by **Tags** (`_user_tags like %tag%`) | MISSING | Frappe | `_user_tags` is in `known` (meta.ts:181) but not in the filter fields | — | — | — | Desk lists "Tags" among the standard filter fields and in the sidebar. **Rec:** add `{name:"_user_tags", label:t("listTags"), type:"text"}` to `filterFieldsFromMeta` (meta.ts:105-118), with a tag picker value input (reuse `TagInput` + `searchLink("Tag")`). |
| B14 | Filter by **Assigned To** (`_assign like %user%`) | MISSING | Frappe | same as B13 | — | — | — | **Rec:** add `_assign` as a `link`→User filter field, mapped to `like %user%` in query.ts (Desk's `assigned_to` sidebar filter does this). |
| B15 | Default 90-day recency filter on large tables (`disable_automatic_recency_filters`) | MISSING | Frappe | — (list.md §9 says so) | — | — | — | Low priority. **Rec:** useFrappeList, when `meta.isLargeTable && !settings.disable_automatic_recency_filters`, sets `initialQuery` to `creation timespan "last 90 days"`… verify Desk's exact rule in list_view.js first. |

## C. Sorting & saved filters

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| C1 | Header-click sort (asc/desc, aria-sort), server `order_by` from the column's real field | COMPLETE | Core + Frappe | useListState.ts:436-437; query.ts:154-158 | L:143, L:137, F:264, F:321 | SC:data, SC:frappe | unit, mock | — |
| C2 | Sort menu (Desk SortSelector) with Clear | COMPLETE (opt-in) | Core | Toolbar.tsx:291 `SortMenu`; ListView.tsx:210 | L:156 "F7 sort menu (opt-in) sorts and clears" | SC:frappe (`controls.sortMenu`) | unit | Offers only the **visible** columns (`columns={s.visibleColumns}`). Desk's selector offers the standard fields + list fields whatever is shown. |
| C3 | `name` tie-break (sort_selector.js:198-208) | COMPLETE | Frappe | query.ts:115-117 | PL:23, PL:26, FL:114 | — | unit | — |
| C4 | DocType default sort (`sort_field` / `sort_order`) | COMPLETE | Frappe | meta.ts:190-191; query.ts:157-158 | F:171 "…search fields and the DocType's sort are used" | — | mock | — |
| C5 | Multi-field sort | NOT APPLICABLE | — | — | — | — | — | Desk's List View sorts by one field + the name tie-break, which the package reproduces. Multi-sort exists only in Report View (H1). |
| C6 | Sort persistence (local prefs; `user_settings.sort_by/sort_order`) | COMPLETE | Core + Frappe | useListState.ts:436; storage.ts:232, 243 | L:171, FL:300 | — | unit, mock | Server side: see A6b. |
| C7 | Saved filters: save / apply / delete (localStorage or `List Filter` rows) | COMPLETE | Core + Frappe | Toolbar.tsx:34 `SavedFilters`; useListState.ts:424-475; storage.ts:168-199 | L:492 "save, apply and delete through an async adapter; onFilterSaved fires", L:508, L:515, FL:279 "saved filters: List Filter rows — listed for me + global, inserted with 4-tuples, deleted", SP:244, LQ:98 | SC:frappe (`serverStorage`) | unit, mock, sim | OR queries are refused (`UnstorableQueryError`). |
| C8 | Per-user saved filters (`for_user = session user`, listed with the global ones) | COMPLETE | Frappe | storage.ts:170-175, 190 | FL:279 | SC:frappe | mock | — |
| C9 | Public / shared ("Is Global") filters | PARTIAL | Frappe | storage.ts:163-165, 190 (`global` adapter option) | (no test for `global: true`) | — | — | All-or-nothing adapter flag: no per-save "Is Global" checkbox (Desk: list_filter.js:40-66, 155), no System Manager gate, no global marker in the list. **Rec:** see Gap 7. |
| C10 | Rename saved filter | NOT APPLICABLE | — | — | — | — | — | Desk has no rename (list_filter.js: save/remove only). |
| C11 | Delete saved filter **with confirmation** | MISSING | Core | Toolbar.tsx:50 (`onClick={() => onDelete(s.id)}`, no confirmation) | — | — | — | Desk confirms ("Are you sure you want to remove the {0} filter?", list_filter.js:109). **Rec:** an AlertDialog in `SavedFilters` (reuse the `RowActionsCell` confirm pattern, ListView.tsx:123-141). |
| C12 | Duplicate filter name rejected | COMPLETE | Core + Frappe | storage.ts:189; storage local replaces by label (model/storage.ts:152) | FL:292 (inside FL:279) `rejects.toThrow(/already exists/)` | — | mock | Local adapter silently **replaces** a same-name filter, while the Frappe adapter rejects it. The two adapters disagree. |
| C13 | Default / restored filters (user_settings `filters`; `initialQuery`; URL wins) | COMPLETE | Core + Frappe | useListState.ts:366; storage.ts:236 | FL:324 "serverStorage: restores the saved filters from user_settings…", LQ:403 "initialQuery wins over a restored query" | — | mock, sim | `listview_settings.filters` (Desk JS hook) has no equivalent. Pass `initialQuery`. |
| C14 | Filter permissions (who may list / insert / delete a List Filter, global filter deletion by non-owners) | BLOCKED-REQUIRES-REAL-FRAPPE | Frappe (server) | storage.ts:191, 195 | SP:244 "a read-only session keeps its saved filters (List Filter: Desk User)…" | — | sim | Enforced only by the server. Real-site List Filter permission rules are not recorded. |

## D. Grouping & sidebar

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| D1 | Group-by menu (toolbar), groups in one table | COMPLETE | Core + Frappe | Toolbar.tsx:325 `GroupByMenu`; model/group.ts; ListTable.tsx:112-200; useFrappeList.tsx:634-645 | L:627 "groups with counts, rows without a value last, collapsible", L:639, F:376 "C1 server grouping: chunks, "Showing X of Y", '+' on counts, Load more appends" | SC:frappe (`groupByFields`), SC:data | unit, mock | Opt-in via `groupByFields`. Client-side over loaded chunks (200). This is not Desk's sidebar (D6). |
| D2 | Group by **Assigned To** | PARTIAL (incorrect buckets) | Frappe | useFrappeList.tsx:639-643 `groupOf` → `String(row._assign)` | — | — | — | `_assign` is a JSON array string, so each distinct array (`["a@x","b@x"]`) becomes its own bucket. Rows are not grouped per user, and labels are raw JSON. **Rec:** Gap 2 (multi-bucket `groupOf`). |
| D3 | Group by **Created By** (`owner`) | PARTIAL | Frappe | same | — | — | — | Buckets are correct, but labels are raw user ids (no full name, unlike the owner column, useFrappeList.tsx:505-511). No test. **Rec:** use `userName()` in `groupOf` labels for owner/User links. |
| D4 | Group by **Tags** | PARTIAL (incorrect buckets) | Frappe | same | — | — | — | `_user_tags` is `",a,b"`, so there is one bucket per raw string. Same fix as D2. |
| D5 | Group by any field incl. custom fields | COMPLETE | Frappe | useFrappeList.tsx:634 (any `meta.known` field) | F:376, L:627 | SC:frappe | mock | Mechanism tested with status/priority; custom field untested (A9). |
| D6 | Sidebar group-by with **server counts** (`frappe.desk.listview.get_group_by_count`, Assigned To + Created By + user fields) | MISSING | — | — (list.md §9; PARITY §5.6) | — | — | — | **Rec:** Gap 3. The simulator has no handler for this yet. |
| D7 | Sidebar tag stats (`get_sidebar_stats`) / "Show Tags" | MISSING | — | — | — | — | — | **Rec:** Gap 3 (same sidebar). |
| D8 | Group counts (exact when complete, `+` when partial) | COMPLETE | Core | ListView.tsx:180, 224-229; ListTable group header | L:687 "C1 server mode: partial data is announced, counts carry '+', Load more fetches…", F:376 | SC:frappe | unit, mock | Counts are exact only once all chunks are loaded. Server counts are D6. |
| D9 | Expand / collapse groups | COMPLETE | Core | ListTable.tsx:121, 185-198 | L:627 "…collapsible" | SC:data | unit | Collapse state is not persisted. |
| D10 | Grouping with filters & pagination (paging off while grouped, chunks + Load more, selection per group) | COMPLETE | Core + Frappe | useListState.ts:399-404; query.ts:151, 185-186 | L:676 "C1 client mode: grouping covers every row and turns paging off", L:687, L:665, F:299, F:376 | SC:frappe | unit, mock | — |
| D11 | User-configurable sidebar group-by fields (`user_settings.group_by_fields`, "Edit" modal) | MISSING | — | — | — | — | — | Depends on D6. |
| D12 | Group-by choice persisted | COMPLETE | Core + Frappe | useListState.ts:439; storage.ts:235, 242 | L:171 | — | unit | Server persistence: see A6b. |

## E. Row status / metadata

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| E1 | Indicator per row (Desk precedence: workflow → docstatus → meta.states → hook → Submitted → status guess_colour → enabled/disabled) | COMPLETE | Frappe | list/indicator.ts; cells.tsx:13-23; useFrappeList.tsx:467-474 | FL:129-153, FL:188 (rendered), FI:17-91, PL:115-154 (L-06) | — | unit, mock | Hidden by default unless `rowMeta={true}`. With the default width cap, the `status` field column takes the Status slot (LQ:289). |
| E2 | Docstatus (Draft / Submitted / Cancelled pills) | COMPLETE | Frappe | indicator.ts | FL:136, FL:188 | — | mock | — |
| E3 | **Workflow** status in the indicator | PARTIAL | Frappe | useFrappeList.tsx:470 uses only `o.workflow` (app prop) | FL:129 / FI:20 (pure logic, given a config) | — | unit | Not derived from the DocType. `workflowFromMeta` (client.ts:356) and `usePermissions().workflow` already read `__workflow_docs`, but the list indicator ignores them, so a workflow DocType shows status/docstatus unless the app passes `workflow`. **Rec:** Gap 1. |
| E4 | Comment counts (`with_comment_count`, `_comment_count`) | COMPLETE | Frappe | reportview.ts; cells.tsx:42-46 | FL:70, FL:84, PL:54, PL:60, SR:65 "…_comment_count appended by the server" | — | mock, rec | — |
| E5 | Like heart + count + "Liked by me" | COMPLETE | Frappe + Core | FrappeListView.tsx:116-150; cells.tsx:48-52; record/LikeToggle | LK:24-117 (Core), LK:150, LK:158, LK:169, LK:187, LK:196, LK:211 | — | unit, sim | Not optimistic, same as Desk. |
| E6 | Assignment info (avatars from `user_info`) | COMPLETE | Frappe | cells.tsx:25-40 | FL:70, FL:564 | — | mock | — |
| E7 | Tags shown on rows | MISSING | Frappe | `_user_tags` requested (query.ts:150) but no cell renders it | — | — | — | Desk renders a tag column that the sidebar's "Show Tags" reveals (list_view.js:799-809). **Rec:** `TagsCell` in cells.tsx + `rowMeta.tags` (Gap 2). |
| E8 | Realtime refresh (`list_update`, 2 s / 15 s debounce, suppressed during selection or a bulk run, `disable_auto_refresh`) | COMPLETE | Frappe | list/realtime.ts; FrappeListView.tsx:169 | FL:459, FL:475, FL:492 | SC:frappe ("Simulate server event") | sim (fake port) | A full reload; Desk refreshes changed names only (marked UNVERIFIED). A real socket.io `list_update` has not been exercised (`createSocketRealtime` is a skeleton, tests/foundation-realtime.test.ts:20). |
| E9 | Loading state (skeleton rows) | COMPLETE | Core + Frappe | ListTable; useFrappeList.tsx:673 | L:808 | SC:frappe (Loading scenario), SC:data | unit | — |
| E10 | Error state (`FrappeErrorState`, Retry only when useful) | COMPLETE | Core + Frappe | useFrappeList.tsx:675 | L:823, F:395, F:414, SR:186 "the real Guest 403 renders as a permission error with no Retry action" | SC:frappe (403 scenario) | mock, rec | — |
| E11 | Unseen rows in bold (`_seen`, `track_seen`) | MISSING | Frappe | — | — | — | — | Minor. **Rec:** request `_seen` when `meta.track_seen`; `rowClassName` bold when the session user is not in it. |
| E12 | Relative "modified" time on each row (Desk's right-hand "2 h") | PARTIAL | Frappe | "Last Updated" column exists (hidden, absolute format) | — | — | — | Minor. **Rec:** a `modified` row-meta cell using `lib/relative-time.ts`. |

## F. Bulk actions

All write paths: **site = none.** All are simulator / mock only. See F19.

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| F1 | **Edit** (field + value → `submit_cancel_or_update_docs` update) | PARTIAL | Frappe | FrappeBulkActions.tsx:135-137, 221-242 | LIO:435 "mixed result: the server's failed names are shown…" (clicks Edit, runs update), FL:386-392 | SC:frappe | sim, mock | Value input is a plain text `Input` for Link / Date / Datetime / numbers (only Select and Check get typed controls). Desk uses the field's own control. **Rec:** render the value with `FrappeField`/`LinkInput`/`date-time-field` (Gap 10). |
| F2 | **Export** (selection → exporter preset by_filter on names) | COMPLETE | Frappe | FrappeListView.tsx:215, 232; FrappeExportDialog | LIO:335, LIO:276, RK:124 | SC:frappe :695 | sim | Real download_template BLOCKED (see F19). |
| F3 | **Assign To** (header: Desk dialog; bar: popover) → `add_multiple` | COMPLETE | Frappe + Core | FrappeBulkActions.tsx:166-176, 265-267; record/AssignDialog | FLH:75, FL:431, RK:94, LSH:147, LSH:162, LSH:175 | SC:frappe | sim, mock | — |
| F4 | **Clear Assignment** (confirm → `remove_multiple`) | COMPLETE | Frappe | bulk.ts:126-129 | LA:84, LA:229, LA:249, RK:74 | SC:frappe | sim | — |
| F5 | **Apply Assignment Rule** (`bulk_apply`, no confirm) | COMPLETE | Frappe | bulk.ts:136-139 | LA:90, LA:263, RK:74 | SC:frappe | sim | — |
| F6 | **Add Tags** (TagInput over search_link Tag, create allowed) | COMPLETE | Frappe | bulk.ts:146-149; FrappeBulkActions.tsx:243-249 | LA:97, LA:279, RK:106 | SC:frappe | sim | — |
| F7 | **Print** (Desk's draft/cancelled check, letterhead, PDF options, >25 background) | COMPLETE | Frappe | print.ts; FrappePrintDialog.tsx; FrappeBulkActions.tsx:143-151 | LA:120, LA:139, LA:155, LA:319, LA:344, LA:362, LA:381, LA:409, LA:426 | SC:frappe | sim | Background completion needs the host's `subscribeTask`; draft rules need Print Settings from the host. |
| F8 | **Submit** | PARTIAL (test gap) | Frappe | FrappeBulkActions.tsx:130, 205 | LA:182 (menu position only), FL:386 (request shape) | — | sim, mock | No rendered click → confirm → `submit_cancel_or_update_docs(action:"submit")` test. The code path is shared with Delete, which is tested. **Rec:** add one RTL test in LA. |
| F9 | **Cancel** | PARTIAL (test gap) | Frappe | FrappeBulkActions.tsx:131, 206 | LA:182, FL:386-389 | — | sim, mock | Same as F8. |
| F10 | **Delete** (destructive confirm → `delete_items`; >10 queued) | COMPLETE | Frappe | bulk.ts:91-95; FrappeBulkActions.tsx:129 | FL:380, FL:402, FLH:93, LIO:458, RK:61, P27:569 | SC:frappe | sim, mock | Failures are a realtime msgprint, so the UI says "requested" and never claims success. |
| F11 | **Workflow** bulk actions (asked on every menu opening; `bulk_workflow_approval`) | COMPLETE | Frappe | workflowBulk.ts; FrappeBulkActions.tsx:153-197 | LA:103, LA:444, LA:475, LA:497, LA:513, FLH:114, RK:140 | SC:frappe :385-426 | sim | — |
| F12 | Permission-aware menu (Desk order; nothing but Export when rights unknown) | COMPLETE | Frappe | bulk.ts:41-66; FrappeListView.tsx:163, 216 | FL:352, FL:365, FL:515, LA:173, LA:191, LA:205, LA:217, FLH:105, P27:191, P27:331 | SC:frappe (Sales User session) | unit, sim | Clear Assignment / Assignment Rule / Add Tags require READ. Desk offers them unconditionally (documented decision). |
| F13 | Destructive confirmation (Delete, Submit, Cancel, Clear Assignment) | COMPLETE | Frappe + Core | FrappeBulkActions.tsx:200-216; ListFooter `confirm` | FL:402, FLH:93, LA:229, LSH:63 "…destructive confirm" | — | sim | The Submit/Cancel confirmation texts are not rendered in any test (F8/F9). |
| F14 | Selected-record handling: UI keys → document names, never sends unknown keys | COMPLETE | Frappe | FrappeListView.tsx:99-103, 153-161, 208-209, 228-236 | RK:53, RK:61-174 | — | sim | — |
| F15 | Selection when filters / search / pages change (kept across pages; pruned on query change; server mode cleared; base-filter change clears) | COMPLETE | Core + Frappe | useListState.ts:406-415 | L:707, L:721, L:732, F:432, RK:157 "a selection kept across pages still resolves to names…" | — | unit, mock, sim | In **bar mode** `ctx.rows` = current page rows only (`s.selectedRows()`, useListState.ts:462; LIMITATIONS "List View"), so Print's check and workflow common actions see fewer rows than keys for a cross-page selection. Header mode uses `rowByKey` across pages (FrappeListView.tsx:156-161, 230). |
| F16 | **Header selection mode** (no extra bulk row; header shows "{n} items selected" + Clear; primaryAction → Actions menu); no duplicate selection UI | COMPLETE | Core + Frappe | ListView.tsx:69-81, 163, 185-187, 213-216, 231; ListTable.tsx:146, 218-226; FrappeListView.tsx:226-237, 261-264 | LSH:38 "no extra row…", LSH:51, LSH:63, LSH:98 (shift-click range), LSH:110, LSH:117, FLH:59 "no bar; '{n} items selected' in the header…" | SC:frappe (layout picker, default "header" in the showcase) | unit, sim | **Default is still `"bar"`** (ListView.tsx:150; FrappeListView passes through), while the design intent is header mode. **Docs are stale:** PARITY §5 item 4, list.md §9 bullet 4 and LIMITATIONS still say "buttons in the selection bar, not Desk's Actions dropdown". Do NOT reintroduce a separate bar. Consider making `"header"` the FrappeListView default (minor-version change) and fixing the three docs. |
| F17 | Empty selection (bar hidden at 0; header: primaryAction returns) | COMPLETE | Core | ListFooter.tsx:77 (`if (!count) return null`); ListView.tsx:187 | LSH:51 "…gives way to the Actions menu while rows are selected, then returns", LSH:38 | — | unit | — |
| F18 | Outcome reporting (server's failed names; "N requested" for silent methods; queued) and reload | COMPLETE | Frappe | FrappeBulkActions.tsx:108-125 | LIO:435, LIO:458, LA:229, LA:249, LA:263 | SC:frappe (log) | sim | The message shows under the list as a `role=status` line, not a toast. |
| F19 | Every bulk write on a real site (incl. Print PDF, workflow approval, tags, assignment, delete) | BLOCKED-REQUIRES-REAL-FRAPPE | Frappe | — | — | — | sim only | PARITY §5.1. |

## G. Create & Quick Entry

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| G1 | "+ Add {DocType}" button | PARTIAL | Core slot | ListView.tsx:68 `primaryAction` (app-supplied) | LSH:51, FLH:59 (slot behaviour) | SC:frappe (app button "New ToDo") | unit, sim | No built-in button, no create-permission gate, no label. **Rec:** Gap 4. |
| G2 | Empty-state "Create your first {DocType}" | PARTIAL | Frappe | FrappeListView.tsx:64, 258 | FL:595 | SC:frappe (Empty scenario) | mock | **Not gated by the create right**, although the prop doc says "Desk: only when the user may create". **Rec:** `onCreate && perms.can("create")` (Gap 6). |
| G3 | Quick Entry dialog | MISSING | — | none in src (`quick_entry` exists only as a contract type, contract.ts:80) | — | — | — | **Rec:** Gap 4. |
| G4 | Metadata-driven QE fields (`meta.quick_entry`, `reqd`/`allow_in_quick_entry`, not read_only/virtual, mandatory Table → full form, prompt autoname, >7 → full form) | MISSING | — | Desk rule: frappe/public/js/frappe/form/quick_entry.js:59-110 | — | — | — | **Rec:** pure `quickEntryFields(meta)` in src/frappe/form/model/quickEntry.ts. |
| G5 | Required-field handling in QE | MISSING | — | Full form has it: form/model/mandatory.ts | (full form: FF:146 "a new ToDo gets Desk's defaults; a missing mandatory field opens Missing Fields and nothing is sent") | — | sim | Reuse mandatory.ts via FrappeFormView. |
| G6 | Link "Create a new X" from a link field | PARTIAL | Frappe form | FrappeLinkField.tsx:18, 179-185 (`onCreateNew` app hook) | none | — | — | Untested, and there is no QE host to open. **Rec:** test it in FF; let `FrappeQuickEntry` serve as the default `onCreateNew`. |
| G7 | Client validation in QE (`validate`, depends_on, mandatory_depends_on) | MISSING | — | Full form: FF:168, FF:204 | — | — | — | Comes with FrappeFormView reuse. |
| G8 | Save → refresh list / redirect | MISSING | — | `invalidateFrappeList` exported (useFrappeList.tsx:372) for apps | F:477 (app-driven invalidation) | — | mock | **Rec:** QE `onSaved` → `invalidateFrappeList(qc, doctype)` + `onCreated(doc)`. |
| G9 | Full-form fallback ("Edit Full Form"; new doc route) | PARTIAL | Frappe form | FrappeForm.tsx:74-87 (new doc when `name` empty/`new-…`) | FF:146 | SC:frappe forms | sim | The app routes. There is no "Edit full form" hand-off carrying the typed values. **Rec:** `onOpenFullForm(doc)` prop on the QE. |

## H. View switcher

Sub-flags: (1) switcher UI, (2) view implementation, (3) connected to real data, (4) actions/filters.
`grep -ri "kanban|gantt|calendar view|ViewSwitcher|image_field|inbox|map"` over src finds nothing list-related.

| # | View | Status | (1) | (2) | (3) | (4) | Notes / reuse |
|---|---|---|---|---|---|---|---|
| H0 | View switcher (list_view_select.js) | MISSING | no | — | — | — | Core `ViewSwitcher` (DropdownMenu) + Frappe `availableViews(meta)` would be cheap, but useless until at least one more view exists. |
| H1 | Report | MISSING | no | no | partial: `export_query` helpers only (reportExport.ts, FrappeReportExportDialog) | no | Biggest-value view. Could reuse `useListState` + `fields/DataGrid.tsx` (editable grid) + `reportviewGet`; needs column picker over child fields, group-by/aggregates, multi-sort, inline edit (`frappe.client.set_value`). |
| H2 | Kanban | MISSING | no | no | no | no | `useListState` is headless (docstring: "apps can build other views (kanban, cards) on the same state"). Needs Kanban Board doctype (`frappe.desk.doctype.kanban_board.kanban_board.*`), so it is backend-dependent. |
| H3 | Calendar | MISSING | no | no | no | no | Desk's field mapping lives in `<doctype>_calendar.js` (JS hooks) + `get_events`. The page has no meta for it, so app config is required. `primitives/calendar.tsx` is a date picker, not a view. |
| H4 | Gantt | MISSING | no | no | no | no | Same as Calendar (JS-side field map). |
| H5 | Image | MISSING | no | no | no | no | `image_field` exists only as a contract type (contract.ts:86). Cheap: a card grid over `useListState` rows + `image_field`. |
| H6 | Dashboard | MISSING | no | no | no | no | `cards/StatCard`, `chart/` exist; Desk's doctype dashboard needs Dashboard Chart/Number Card docs. |
| H7 | Map | MISSING | no | no | no | no | Only for DocTypes with Geolocation fields. Low relevance. |
| H8 | Tree | MISSING | no | no | no | no | Only nested-set *operators* exist (LQ:61-134). Tree view needs `frappe.desk.treeview.get_children`. |
| H9 | Inbox | MISSING | no | no | no | no | Communication + Email Account only. Low relevance. |

## I. Count & pagination

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| I1 | Total count (`reportview.get_count`, 1001 cap → "1,000+", click to count exactly) | COMPLETE | Frappe | reportview.ts; useFrappeList.tsx:595-601, 668-672 | FL:96, PL:33, PL:34, PL:42, F:134, SR:77 | SC:frappe | mock, rec | — |
| I2 | `disable_count` → no count call | COMPLETE | Frappe | useFrappeList.tsx:595 | FL:84 | — | mock | — |
| I3 | Current page / pager (pill pager, RTL chevrons) | COMPLETE | Core | ListFooter.tsx:16 | L:279 | SC:data, SC:frappe | unit | — |
| I4 | Page-size choice (Desk 20 / 100 / 500 / 2500; 100 default on large screens, base_list.js:47, 375) | MISSING | Core | `pageSize` prop only (useListState.ts:337) | — | — | — | **Rec:** Gap 5. |
| I5 | "Load more" | PARTIAL | Core + Frappe | ListView.tsx:224-229; useFrappeList.tsx:677 | L:687, F:376 | SC:frappe (grouped) | unit, mock | Grouped mode only. Ungrouped uses a pager, while Desk appends (a documented design difference). |
| I6 | Empty states (none yet vs no match + Clear filters) | COMPLETE | Core + Frappe | ListView.tsx:167-178; FrappeListView.tsx:256-258 | L:814, FL:595 | SC:frappe (Empty), SC:data | unit, mock | — |
| I7 | Filter / search change → page 1, list + count refetched with the same filters | COMPLETE | Core + Frappe | useListState.ts:434-435 | L:294, F:308, F:321, F:340 | — | unit, mock | — |
| I8 | After mutations (bulk run / app writes → invalidate list + count; like updates in place) | COMPLETE | Frappe | FrappeBulkActions.tsx:120; useFrappeList.tsx:372-374; FrappeListView.tsx:137-145 | FL:402, F:477, LK:169 | SC:frappe | mock, sim | — |
| I9 | Distinct count when a child-table filter joins | COMPLETE | Frappe | query.ts:163; useFrappeList.tsx:599 | PL:46, FL:230 | — | mock | — |

## J. List menu (⋯)

| # | Item | Status | Layer | file:line | Test(s) | Showcase | Evidence | Limitations / recommendation |
|---|---|---|---|---|---|---|---|---|
| J1 | **Import** (gated by `canImport`: allow_import + System Manager / import right; default → `/app/data-import?reference_doctype=`; `onImport` override) | COMPLETE | Frappe | FrappeListView.tsx:178, 186, 193 | LIO:251, LIO:262, LIO:304, LIO:319, P27:171, P27:205 | SC:frappe :695-704 | sim | Real import BLOCKED (writes). |
| J2 | **Export** in the menu (offered to everyone, server refuses) | COMPLETE | Frappe | FrappeListView.tsx:179, 194 | LIO:262, LIO:276, LIO:294, LIO:368, LIO:389 | SC:frappe | sim | Real `download_template` BLOCKED (unapproved read). |
| J3 | "Export as report" (opt-in, `canExport`) | COMPLETE (opt-in) | Frappe | FrappeListView.tsx:181, 195 | LIO:478, LIO:489, LIO:496, LIO:503, LQ:424-546 | — | sim | Not a Desk List View entry. On a site it writes an Access Log (BLOCKED). |
| J4 | **User Permissions** (System Manager → `/app/user-permission?allow=<doctype>`, list_view.js:1714-1722) | MISSING | — | PARITY §1 row 24 "NOT REPRODUCED (by decision)" | — | — | — | A navigation link. **Rec:** Gap 8. |
| J5 | **Role Permissions Manager** (System Manager → `permission-manager` with `doctype`, :1725-1733) | MISSING | — | same | — | — | — | Navigation only. Gap 8. |
| J6 | **Customize** (can create Custom Field + Property Setter → customize-form `doc_type`, or doctype form if `meta.custom`, :1735-1754) | MISSING | — | same | — | — | — | Navigation only. Gap 8. |
| J7 | **List Settings** (System Manager; dialog → `list_view_settings.save_listview_settings`, list_settings.js:44-45) | MISSING | — | settings.ts:1-4 says "writing… is not reproduced" | — | — | — | Real UI + a write. Simulator-testable. Gap 9. |
| J8 | **Toggle Sidebar** (Ctrl+K) | MISSING | — | no sidebar | — | — | — | Depends on D6 (Gap 3). |
| J9 | "Edit DocType" (System Manager + developer_mode) | MISSING | — | — | — | — | — | Needs `boot.developer_mode`, which the session does not carry. Low priority. |
| J10 | Permission-aware menu (Import/Export/Report-export gates; rule 9: unknown roles → no Import / no report export) | COMPLETE | Frappe | FrappeListView.tsx:177-181; services/permissions.ts | LIO:251, LIO:304, LIO:503, P27:171, P27:179, P27:205, P27:605 | — | sim, rec (P27:588-614 replays recorded roles) | Covers only the entries that exist. |
| J11 | Navigation from menu entries | PARTIAL | Frappe | FrappeListView.tsx:105, 186 | LIO:319 | — | sim | Only Import navigates. J4-J6 do not exist. |

---

## Counts per section

| Section | Rows | COMPLETE | PARTIAL | MISSING | NOT APPLICABLE | BLOCKED |
|---|---|---|---|---|---|---|
| A Columns | 12 | 9 | 1 | 0 | 1 | 1 (A6b) |
| B Filters | 15 | 11 | 1 | 3 | 0 | 0 |
| C Sort & saved filters | 14 | 9 | 1 | 1 | 2 | 1 |
| D Grouping & sidebar | 12 | 6 | 3 | 3 | 0 | 0 |
| E Row status/metadata | 12 | 8 | 2 | 2 | 0 | 0 |
| F Bulk actions | 19 | 15 | 3 | 0 | 0 | 1 |
| G Create & Quick Entry | 9 | 0 | 4 | 5 | 0 | 0 |
| H View switcher | 10 | 0 | 0 | 10 | 0 | 0 |
| I Count & pagination | 9 | 7 | 1 | 1 | 0 | 0 |
| J List menu | 11 | 4 | 1 | 6 | 0 | 0 |
| **Total** | **123** | **69** | **17** | **31** | **3** | **3** (+ every write path; see below) |

(A has 12 rows because A6 is split into A6a and A6b.)

Even the COMPLETE rows have **no real-site evidence**. Read paths for meta, rows, count, link search and the 403 are
backed by recorded 15.110 responses. Everything else runs on mocks or the simulator.

## Documentation discrepancies found (claims vs code)

1. docs/release/LISTVIEW-FRAPPE-PARITY.md §5 item 4, docs/components/list.md §9 bullet 4, and docs/LIMITATIONS.md all
   say "Bulk actions are buttons in the selection bar, not Desk's Actions dropdown". This is stale since 0.4.1
   `selectionMode="header"` (tested: LSH, FLH). The default nevertheless remains `"bar"` (ListView.tsx:150).
2. docs/components/list.md §9 bullet 1 calls the width cap "opt-in". `FrappeListView` turns it on by default
   (FrappeListView.tsx:123, LIO:510).
3. docs/LIMITATIONS.md "Frappe layer" says "Not supported: child tables, … realtime updates, … Frappe's per-user list
   settings". All three are implemented: child-table filters (FL:230), realtime (FL:459), user_settings (FL:300).
4. docs/components/list.md §9 "Import: the preview grid, column mapper and import-log table … (functions only)"
   conflicts with PARITY §5.2, which says FrappeDataImport covers the preview, mapper and log (Agent A/E territory; just
   flagging it).
5. FrappeListView `onCreate` doc ("Desk: only when the user may create") does not match the code, which has no
   permission gate (FrappeListView.tsx:258).

## Prioritized gaps implementable now (Core / Frappe; unit + simulator testable)

1. **Workflow state in the row indicator, derived from the DocType** (Frappe). Small.
   - API: `FrappeListOptions.workflow?: IndicatorWorkflow | false`. The default is derived from the bundle.
   - New pure helper in list/indicator.ts:
     `indicatorWorkflowFromMeta(meta: DocTypeMeta): IndicatorWorkflow | undefined`, built on `workflowFromMeta`. Mapping:
     `stateField ← workflow_state_field`, `styles ← states[].style`, `overrideStatus ← override_status`,
     `avoidStatusOverride ← states.filter(s => s.avoid_status_override).map(s => s.state)`. Verify the last two against
     indicator.js:26-122.
   - Also request the state field (`indicatorFields` already does once `workflow` is set).
   - Files: src/frappe/list/indicator.ts, src/frappe/useFrappeList.tsx:467-474, src/frappe/index.ts (export).
   - Test: tests/frappe-list.test.tsx with the simulator's Approval Memo (it already has a Workflow), asserting the pill
     shows the workflow state with its style.
2. **Assigned To / Tags as first-class fields**: filter fields, a tags cell, and per-user/per-tag grouping (Core + Frappe).
   - Core: `GroupByOption.groupOf` may return `{key,label} | {key,label}[]`. `groupRows` puts the row in each bucket.
     The select-all and selection semantics stay key-based.
   - Files: src/list/model/group.ts, src/list/parts/ListTable.tsx (row keys may repeat across groups; React keys need
     the group prefix).
   - Frappe: in `useFrappeList` groupOf, split `_assign` (JSON) and `_user_tags` (comma) and label owner/User links with
     `userName()`. Add `_assign` (link→User, `like %u%`) and `_user_tags` (text/tag) to `filterFieldsFromMeta`, plus the
     operator mapping in query.ts. Add `TagsCell` + `rowMeta.tags` in cells.tsx.
   - Files: src/frappe/meta.ts:105-118, src/frappe/query.ts, src/frappe/useFrappeList.tsx:634-645, src/frappe/list/cells.tsx.
   - Tests: tests/list.test.tsx (multi-bucket), tests/frappe-list.test.tsx.
3. **Group-by sidebar with server counts + tag stats + Toggle Sidebar** (Frappe + Core part).
   - Core `GroupBySidebar` (src/list/parts/GroupBySidebar.tsx): `{ sections: {field,label,items:{value,label,count}[]}[]; active?: Record<string,string>; onSelect(field,value) }`, presentational.
   - ListView gets `aside?: ReactNode` and `asideOpen?` (toggle).
   - Frappe `useGroupByCounts(doctype, fields, filters)` → `frappe.desk.listview.get_group_by_count(doctype, current_filters, field)` (listview.py:33). Default fields `assigned_to`, `owner`, + `user_settings.group_by_fields`.
   - `FrappeGroupBySidebar`: clicking applies through `setQuery` / `ListActionsContext.applyCondition` (assigned_to → `_assign like`).
   - Menu "Toggle Sidebar".
   - Simulator: add `get_group_by_count` and `get_sidebar_stats` handlers in src/frappe/testing/fixtureTransport.ts.
   - Files: those plus src/list/ListView.tsx, src/frappe/FrappeListView.tsx.
4. **Quick Entry + "Add {DocType}"** (Frappe).
   - `quickEntryFields(meta): { eligible: boolean; fields: DocField[]; reason?: "not_quick_entry"|"mandatory_table"|"no_fields"|"too_many" }`, ported from quick_entry.js:59-110.
   - `<FrappeQuickEntry doctype open onOpenChange onCreated(doc) onOpenFullForm(doc) defaults />`: Dialog over `FrappeFormView`. It needs a new `fieldFilter?: (df) => boolean` (or `onlyFields`) prop threaded into `buildLayout`. Save via the existing `useDocMutations`, then `invalidateFrappeList`.
   - FrappeListView `create?: "quick-entry" | "route" | (() => void)` renders a default `primaryAction` "Add {DocType}" only when `perms.can("create")`.
   - Files: new src/frappe/form/model/quickEntry.ts, new src/frappe/form/FrappeQuickEntry.tsx, src/frappe/form/FrappeFormView.tsx, src/frappe/form/model/layout.ts, src/frappe/FrappeListView.tsx.
   - Tests: simulator ToDo (quick_entry=1 in its meta?) via savedocs. The Link "Create a new X" path (G6) gets its first test here.
5. **Page-size picker** (Core).
   - `ListPagination` `pageSizes?: number[]`, `onPageSize`. `useListState` gets `setPageSize` (persisted in `ListPrefs.pageSize`, page reset to 0).
   - FrappeListView default `[20,100,500]`.
   - Files: src/list/parts/ListFooter.tsx, src/list/useListState.ts, src/list/model/storage.ts, src/list/ListView.tsx, src/frappe/list/storage.ts (`List.page_length`? check Desk's user_settings key).
   - Test: tests/list.test.tsx.
6. **Create gating** (Frappe, trivial): empty-state create and any default Add only with `perms.can("create")`.
   FrappeListView.tsx:258. Test in tests/frappe-list.test.tsx with a read-only session.
7. **Saved filters: delete confirmation, per-save "Is Global" (System Manager only), global marker** (Core + Frappe).
   - `SavedFilter.global?: boolean`. `SavedFiltersStorage.save(viewKey, label, query, opts?: { global?: boolean })` (optional 4th arg keeps compatibility).
   - `SavedFilters` props `canSaveGlobal?`.
   - Make the local adapter reject duplicates like the Frappe one (C12).
   - Files: src/list/parts/Toolbar.tsx:34-68, src/list/model/storage.ts, src/list/useListState.ts:466-474, src/frappe/list/storage.ts:186-193.
8. **List menu navigation entries** (Frappe).
   - `menu.userPermissions | rolePermissions | customize` (default true, gated as Desk: System Manager; Customize needs create on Custom Field + Property Setter).
   - URL helpers next to `dataImportListUrl`: `/app/user-permission?allow=`, `/app/permission-manager?doctype=` (verify the route-option encoding, router.js:548-566), `/app/customize-form?doc_type=`, or `/app/doctype/<dt>` when `meta.custom`.
   - `onNavigate?(route)` override.
   - Files: src/frappe/FrappeListView.tsx, src/frappe/services/permissions.ts. Test in tests/list-io.test.tsx.
9. **List Settings dialog** (Frappe, write):
   `FrappeListSettingsDialog` (fields picker reusing `ColumnManager`, total_fields, the disable_* checkboxes) →
   `frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings`, then invalidate `list-settings`.
   Needs a simulator handler. System Manager-gated menu entry.
10. **Bulk Edit typed value control** (Frappe): in FrappeBulkActions.tsx:229-241, render `FrappeField` (or `LinkInput` /
    date-time-field / NumberInput) for the chosen field's fieldtype. Test in tests/list-io.test.tsx.
11. **Test-only gaps** (no code): Submit/Cancel click-through (tests/list-actions.test.tsx), a custom-field fixture (A9),
    Link "Create a new X" (G6), and groupBy owner/_assign (D2-D4, which will fail today).
12. **Defaults/docs**: consider `selectionMode` default `"header"` for FrappeListView, and fix doc discrepancies 1-5.
13. **Larger, later**: Image view (card grid over `useListState`, `image_field`) and a view switcher. Report view (H1)
    over `useListState` + DataGrid. Kanban needs the Kanban Board server API (simulator handlers first).

## Backend-dependent / BLOCKED-REQUIRES-REAL-FRAPPE

- Every write path on a real site:
  - bulk Edit, Submit, Cancel, Delete (`delete_items` realtime msgprint), Assign, Clear Assignment, Assignment Rule,
    Add Tags, Print (`download_multi_pdf[_async]` + `task_complete`), workflow `bulk_workflow_approval`;
  - saved filters (`List Filter` insert/delete; global-filter permissions, C14);
  - `user_settings.save` and the `List.sf_ui` deep-merge (A6b, marked UNVERIFIED in source);
  - like toggle;
  - Data Import.
- Reads that are unapproved or have side effects: `download_template` (export) and `export_query` (writes an Access Log).
- Realtime over a real socket (`list_update` delivery, room joins); the package has only a skeleton `createSocketRealtime`.
- Server-only semantics the simulator models but nobody verified: `get_group_by_count` (to be added), User Permission
  filtering of lists and counts, `if_owner`, List View Settings write (`save_listview_settings` updates Property Setters).
- Views whose configuration is not in the DocType meta: Kanban (Kanban Board docs), Calendar/Gantt (`<doctype>_calendar.js`
  field maps + `get_events`), Dashboard (Dashboard Chart / Number Card docs), Map (Geolocation), Inbox (Email Account).
