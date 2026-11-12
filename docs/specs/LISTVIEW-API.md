# ListView API — evidence-classified specification (P0 T9)

Status: **proposal for review** (no code in P0). Reference: the CRM's lists as captured from the frozen control
`20261112T183811Z-crm-p0` (`docs/audit/p08/CRM-REFERENCE.md` §5). Rule: an API change needs CRM evidence; everything else is
classified, not built.

Evidence labels as in CRM-REFERENCE: **V-browser** (observed in the control build), **V-code** (read in the snapshot or the
package), **I** (inferred), **U** (unverified).

## 1. What exists

One list engine, Core and Frappe:

| Piece | Where | Role |
|---|---|---|
| `ListView` (+ `useListState`, `ListTable`, model: `filters`, `sort`, `group`, `storage`) | Core `src/list` | The list: search, quick filters, filter builder, saved filters, group by, sort (header + menu), columns, selection + bulk actions, like, pager, empty / loading / error. `mode="client"` (pipeline inside) or `"server"` (the host fetches on `onStateChange`) |
| `KanbanBoard`, `CalendarMonth`, `ImageView`, `ViewSwitcher` | Core `src/list/views` | Other views (not composed into `ListView`) |
| `ExportDialog`, `DataImportDialog` | Core `src/list/io` | List I/O dialogs |
| `FrappeListView` (`useFrappeList`), `FrappeReportView` / `FrappeViews` (`useFrappeViewList`), `FrappeExportDialog`, `FrappeReportExportDialog` | `@solvfast/ui/frappe` | Desk list / report / views over a site |
| `DataGrid` | Core | An **editing** grid (child tables) — separate from the list, unchanged |

## 2. How the CRM uses it (V-browser + V-code)

Every CRM list in the DS scope (Deals, Leads, Contacts, Organizations, Service Desk Tickets, Attachments) is `ListView`
through the app adapter `CrmDsListView`:

- **`mode="server"` with a hand-rolled client pipeline**: the adapter wraps rows, runs the package's own
  `applyFilterQuery` + search + `sortRows` + slicing, and passes one page back as `rows` / `total`.
  Why: the host needs **the filtered, sorted result and the visible columns** (its ⋯ Export list / Print list act on them;
  `onResult(filtered, visibleKeys, active)`), and `ListView`'s client mode does not expose them (V-code:
  `useListState.ts` client pipeline; no result callback).
- Canned chips as pre-seeded saved filters; two quick filters picked from the filter fields; group-by from pick-list
  fields; `sortMenu`; header selection with an Actions menu of bulk actions (incl. lifecycle transitions); like; primary
  action; toolbar extras (type selector, view switcher, Articles, ⋯ menu); page size 20; `viewKey` persistence.
- **Board, Calendar and Gallery are app components** (`KanbanBoard` of the app, `CalendarView`, `GalleryView`), switched by
  app state; in those views the list toolbar is replaced by the app's.

## 3. Capability matrix

| Capability | CRM evidence | Package today | Class |
|---|---|---|---|
| Search, quick filters, filter builder, saved filters (canned + "Save current as…"), clear | V-browser (all 5 lists) | Available | **Covered** |
| Filter builder: one conjunction (all AND / all OR) | V-browser (builder opened, "Add filter"); V-code (`FilterQuery {conjunction, conditions}`) | Available (flat) | **Covered** |
| Sort: one key, header + "Sort by" menu | V-browser + V-code (`sortRows(rows, {key, dir})`) | Available | **Covered** |
| Group by (client) | V-browser | Available | **Covered** |
| Columns: show / hide / reorder ("Edit columns", first column fixed) | V-browser | Available | **Covered** |
| Header selection, "N selected · Clear", bulk Actions menu (disabled items with a reason) | V-browser | Available | **Covered** |
| Like, primary action, toolbar actions, row click | V-browser | Available | **Covered** |
| Pager (prev / next, Total), page size 20 | V-browser + V-code | Available | **Covered** |
| Filtered-empty state + Clear filters | V-browser (5 lists) | Available | **Covered** |
| Empty (no filter) state with a New action | V-code (`emptyMessage`, `emptyAction`); **U** in the browser | Available | Covered (unverified visually) |
| Loading / error + Retry | V-code (props passed); **U** in the browser (mock data loads synchronously) | Available | Covered (unverified visually) |
| 390 px: still a table, same toolbar | V-browser (dark-ar-390) | Available | **Covered** |
| ⋯ List menu: Import, Print list, Export, Reload | V-browser | Dialogs available (Core + Frappe); the menu is the app's | **Covered** (composition) |
| **The client result for the host** (filtered + sorted rows, visible columns, filters active?) | V-code: the CRM hand-rolls the pipeline in server mode to get it | **Missing** | **Gap — proposed (§4)** |
| Board (Kanban), Calendar, Gallery under the list toolbar | V-browser: app components | Core views exist, not used by the CRM | **App-level** (no change) |
| A shared query across views | None: the CRM's Board / Calendar drop the list's query | Missing | **Not required** |
| Data-source abstraction (`source`, `localSource`, `frappeSource`) | Only one host pattern (the CRM adapter); the gap it would solve is §4's | Missing | **Deferred** (re-evaluate with a second consumer) |
| Page sizes picker, mobile cards, group sidebar, server group counts, "select all matching" | Not used by the CRM | Available (`pageSizes`, `layout`, `aside`, `selectAllMatching`) | **Not required** |
| Column resize / pin, multi-sort, nested AND/OR groups, row context menu, rename saved filter | No evidence | Missing | **Future extension** (not proposed) |
| Two Frappe fetch hooks, two export dialogs (`FrappeExportDialog`, `FrappeReportExportDialog`) | — (package internals) | Duplication | **Internal tidy-up**, separate from the API |

## 4. The one proposed change

`ListView` (client mode) reports its result to the host:

```ts
interface ListViewProps<T> {
  // …existing props unchanged…
  /** Client mode: called when the filtered result changes — every matching row (sorted, all pages), the visible column
   *  keys, and whether a search or filter is active. For actions on "what the list shows" (export, print, counts). */
  onResultChange?: (result: { rows: T[]; visibleColumns: string[]; filtered: boolean }) => void;
}
```

- Additive; nothing changes for existing code. Server mode: not called (the host already has its result).
- With it, the CRM adapter can use `mode="client"` and drop its copy of the pipeline (row wrapping for flat filter values
  stays in the adapter: that is its data mapping). Parity gate: the CRM lists' captures (§2 of CRM-REFERENCE, 5 lists ×
  combos) identical before and after.
- Tests: the callback's rows equal `applyFilterQuery` + search + `sortRows` over `rows` for a set of queries; it fires
  on query / search / sort / column changes, not on paging.

## 5. Not proposed (and why)

- **A `views` prop, a shared view store, Board / Calendar / Gallery inside `ListView`**: the CRM composes its own views and
  replaces the toolbar there; nothing reuses a list query across views.
- **`source` / `localSource` / `frappeSource`**: one consumer pattern today; §4 removes its reason to exist. The Frappe
  adapters keep their props.
- **Nested filter groups, multi-sort, resize, pin, row context menu**: no CRM evidence.
- **Merging the Frappe fetch hooks / export dialogs**: an internal refactor with no API effect; to be planned separately.

## 6. Open items

| Item | Status |
|---|---|
| Empty (no filter), loading and error states in the browser | **U** — no reachable state on the CRM's mock data; verify on a simulated or real site (P1) |
| Which component draws the CRM's Export / Import dialogs | **U** (content V-browser); does not affect §4 |
| `FrappeListView` on a real site (reportview with OR filters, permissions, `user_settings` columns, saved filters) | Pending — P1 real-site validation (E5) |
