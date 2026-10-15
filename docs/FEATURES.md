# List View — feature coverage

The List View consolidates Sear's DataGrid (look, engine) and the PMO list features. Each row below is one feature of
the approved matrix; every non-excluded row has a test in `tests/list.test.tsx` (test names start with the row id) or,
for rows that need a backend, is scheduled for the Frappe entry (increment 5.4). Visual parity with Sear is in
docs/VALIDATION.md.

Source: **S** Sear only · **P** PMO only · **B** both, consolidated · **A** adaptation / new · **X** excluded.

## Features

| # | Feature | Src | In `@solvfast/ui` | Status |
|---|---|---|---|---|
| F1 | Column definitions, renderer per column | B | `ColumnDef.render`; type-aware default otherwise | ✅ tested |
| F2 | Type-aware default cell | B | `DefaultCell`: date, datetime, currency, number, percent, check, select badge, link, `—` for blank; numbers and dates `dir="ltr"`; localized in ar/en | ✅ tested |
| F3 | Curated + generated columns, de-duplicated | P | `mergeColumns` (by key, field and `metaFields`); `columnsFromMeta` comes with the Frappe entry | ✅ tested (core part) |
| F4 | Fetch only visible fields | B | `onStateChange` reports `visible`; request building is in the Frappe entry | ⏳ 5.4 |
| F5 | Client sort | B | `compareValues` / `sortRows`, column `sortValue` override, natural string order | ✅ tested |
| F6 | Server sort | S | `order_by` from the sort state | ⏳ 5.4 |
| F7 | Sort UI with clear and `aria-sort` | P + A | header toggle on every list; `SortMenu` with "Clear sort" (opt-in, `controls.sortMenu`) | ✅ tested |
| F8 | Saved preferences per view | B | `ListPrefsStorage`; default localStorage `sf:list:<viewKey>:prefs` (columns, sort, group-by, quick filters) | ✅ tested |
| F9 | Filter model, 12 operators | B | one copy of the shared model | ✅ tested (equal to Sear's and PMO's tables) |
| F10 | Client filter evaluation | B | `applyFilterQuery` | ✅ tested (every operator × type × AND/OR against both upstream engines) |
| F11 | Frappe filter translation | B + A | — | ⏳ 5.4 |
| F12 | Search, several fields, debounced | B + A | `searchFields` (default: first text column); `searchDebounceMs` (server 300 ms) | ✅ tested (client part; server requests in 5.4) |
| F13 | Pagination with the glass pager | S | Sear's pager markup + pill styles; 20 per page | ✅ tested + parity |
| F14 | Quick filters: any type, field picker, saved choice | P | `quickFilterFields`; picker opt-in (`controls.quickFiltersCustomizable`); choice persisted | ✅ tested |
| F15 | Advanced filter with a searchable field picker | B | Sear's layout + PMO's searchable picker (styled as Sear's select) | ✅ tested + parity |
| F16 | Value inputs: date picker, async link | P + A | glass `DateField` (YYYY-MM-DD); `loadOptions` with 300 ms debounce | ✅ tested |
| F17 | Saved filters | B / X | one UI over `SavedFiltersStorage` (sync or async); localStorage default, per view and per user | ✅ tested (PMO's server DocType is an app adapter) |
| F18 | Column manager | B + A | Sear's popover + drag reorder, keyboard up/down, locked columns, search above 10 columns | ✅ tested; parity except the intended Actions difference (below) |
| F19 | Group-by | P + A | `groupByOptions`, `GroupByMenu`, collapsible groups with counts, empty group last | ✅ tested |
| F20 | Row selection | P + A | `selectable`; rules C3 | ✅ tested |
| F21 | Bulk action bar | A | `bulkActions` (`run(keys, rows)`) or `renderBulkActions` | ✅ tested |
| F22 | Keyboard rows | P | rows focusable, Enter opens | ✅ tested |
| F23 | Conditional row styling | P | `rowClassName` | ✅ tested |
| F24 | Row actions | A | `rowActions`: Sear's delete-button look, a fixed last column, optional confirm dialog (red for destructive actions; the app's `onSelect` does the work), per-row `hidden` | ✅ tested; parity except the intended Actions difference (below) |
| F25 | Toolbar slot and control flags | B | `toolbarActions`; `controls.{search,savedFilters,filter,columns}` | ✅ tested |
| F26 | Alternative views (kanban, gantt, tree) | X | apps build them on `useListState` | — |
| F27 | Loading state | B | Sear's look: skeleton rows | ✅ tested |
| F28 | Empty state | B | the app's `emptyMessage` (any content: icon, call to action) when nothing exists; the generic message when filters hide everything (PMO's rule) | ✅ tested + parity |
| F29 | Error state with retry | P | `error` + `onRetry` | ✅ tested |
| F30 | Client data mode | B | `mode="client"` (default): no network | ✅ tested |
| F31 | Frappe data mode (stock REST) | S | `@solvfast/ui/frappe` | ⏳ 5.4 |
| F32 | Base filters | S | Frappe option | ⏳ 5.4 |
| F33 | Metadata (`in_list_view`, `in_standard_filter`, `title_field`, standard fields ID / Created On / Last Updated) | S | Frappe entry | ⏳ 5.4 |
| F34 | Responsive and RTL | B | horizontal scroll inside the card; logical properties | ✅ parity (mobile + Arabic shots) |
| F35 | i18n | A | list messages in ar/en, overridable through `ThemeProvider` messages | ✅ tested |
| F36 | Save-filter feedback | A | `onFilterSaved(filter)`, `onSavedFiltersError(error, action)` | ✅ tested |
| F37 | Permission gating | X | the app passes `selectable`, `bulkActions`, `rowActions` per permission | — |
| F38 | Derived / renamed fields | X | column `render` | — |
| F39 | Hand-written access control | X | stock DocPerm | — |
| F40 | Per-DocType custom endpoints | X | stock REST | — |
| F41 | Visual look | S | Sear is the reference | ✅ parity (docs/VALIDATION.md) |

## Intentional visual difference from Sear

Row actions are a fixed last column, separate from the data columns: not sortable, filterable, hideable or
reorderable. Sear's Field Library modelled them as an ordinary `actions` field, so 8 of the 44 list-parity
screenshots differ (column manager open, and the column order after showing a hidden column, in light/dark × en/ar);
the other 36 are pixel-identical. Evidence: `docs/validation/5.3/actions-column/`.

## Behaviour rules

| Rule | Behaviour | Tests |
|---|---|---|
| C1 grouping and paging | Client mode groups every filtered row and turns paging off while grouped. Server mode groups the loaded rows; when fewer than `total` are loaded a banner says so ("Showing X of Y records, grouped…"), offers **Load more** (`onLoadMore`), and group counts end in "+". | client and server tests, with ungrouped paging as the negative control |
| C2 search with OR filters | Frappe has one `or_filters` list | ⏳ 5.4 |
| C3 selection | Keyed by `rowKey`; kept across sort and pages; pruned to still-matching rows when search or filters change (client), cleared on a new query (server); select-all acts on the visible page or on one group | survives sort/paging (negative control), pruned, server cleared, grouped select-all |
| C4 controls Sear never had | Sort menu, group-by menu, quick-filter picker, selection and bulk bar appear only when the app asks for them, in Sear's toolbar style | opt-in test; screenshots for design review (docs/validation/5.3) |

## Fixed (relative to Sear and PMO)

Each fix has a test that fails when the old behaviour is put back (mutation check, docs/validation/5.3).

| Fix | Was | Source |
|---|---|---|
| Row actions are a fixed last column, not offered in the column manager, the filter field list or sorting | an `actions` field: could be hidden, moved, filtered ("Actions" in the field list) and "sorted" | Sear `FieldLibraryListPage.tsx` |
| Non-sortable columns have no sort button | every header was a button | Sear DataGrid |
| Rows are focusable, Enter opens them; sorted headers carry `aria-sort` | mouse only, no ARIA | Sear DataGrid |
| Load errors are shown, with Retry | errors were silent | Sear DataGrid |
| Empty values sort last in both directions | first when sorting descending (`compareValues × direction`) | Sear `useDataGrid.ts` |
| Only real dates (Date objects, ISO / Frappe date strings) compare as dates | `Date.parse` read "Task 10" as October 2001 and "Room 101" as the year 101 | Sear `useDataGrid.ts` |
| Strings sort naturally ("Task 2" before "Task 10") | plain string order | Sear (PMO already did) |
| Search and text filters are debounced in server mode: one request per typing pause | a request per keystroke | both |
| Selection is pruned when search or filters change | stale selections stayed and bulk actions acted on them | PMO `TaskList.tsx` |
| Select-all in a group reflects that group | compared a group's rows with the whole selection | PMO `ListTable.tsx` |
| Filter value inputs keep their DOM node and focus while typing | declared inside render, remounted on every keystroke | PMO `AdvancedFilter.tsx` |
| Condition ids never collide | the counter restarted on each mount | PMO `AdvancedFilter.tsx` |
| Saved-filter storage failures reach the app (`onSavedFiltersError`) | swallowed | — (new adapter API) |
| "Add filter" uses the theme primary directly | Sear recoloured every `button.text-info` | Sear `sear-studio.css` |
