# List View — feature coverage

The List View consolidates Sear's DataGrid (look, engine) and the PMO list features. Each row below is one feature of
the approved matrix; every non-excluded row has a test in `tests/list.test.tsx` or, for the Frappe entry,
`tests/frappe.test.tsx` (test names start with the row id). Visual parity with Sear is in
docs/VALIDATION.md.

Source: **S** Sear only · **P** PMO only · **B** both, consolidated · **A** adaptation / new · **X** excluded.

## Features

| # | Feature | Src | In `@solvfast/ui` | Status |
|---|---|---|---|---|
| F1 | Column definitions, renderer per column | B | `ColumnDef.render`; type-aware default otherwise | ✅ tested |
| F2 | Type-aware default cell | B | `DefaultCell`: date, datetime, currency, number, percent, check, select badge, link, rich text (Text Editor HTML) as plain text, `—` for blank; numbers and dates `dir="ltr"`; localized in ar/en | ✅ tested |
| F3 | Curated + generated columns, de-duplicated | P | `mergeColumns` (by key, field and `metaFields`); `FrappeListView` puts curated `columns` first, then `columnsFromMeta` | ✅ tested |
| F4 | Fetch only visible fields | B | visible columns' fields + `metaFields` + `name` (+ group field); render-only columns and unknown fields never requested | ✅ tested (5.4) |
| F5 | Client sort | B | `compareValues` / `sortRows`, column `sortValue` override, natural string order | ✅ tested |
| F6 | Server sort | S | `order_by` from the sorted column's field; otherwise the DocType's `sort_field` / `sort_order` | ✅ tested (5.4) |
| F7 | Sort UI with clear and `aria-sort` | P + A | header toggle on every list; `SortMenu` with "Clear sort" (opt-in, `controls.sortMenu`) | ✅ tested |
| F8 | Saved preferences per view | B | `ListPrefsStorage`; default localStorage `sf:list:<viewKey>:prefs` (columns, sort, group-by, quick filters) | ✅ tested |
| F9 | Filter model, 12 operators | B | one copy of the shared model | ✅ tested (equal to Sear's and PMO's tables) |
| F10 | Client filter evaluation | B | `applyFilterQuery` | ✅ tested (every operator × type × AND/OR against both upstream engines) |
| F11 | Frappe filter translation | B + A | Sear's translator + PMO's type coercion; unknown fields dropped; whole-day Datetime; AND → `filters`, OR → `or_filters` | ✅ tested (5.4; equal to Sear's on its operators) |
| F12 | Search, several fields, debounced | B + A | `searchFields` (client default: first text column; Frappe default: title + `search_fields` + ID); `searchDebounceMs` (server 300 ms) | ✅ tested (client and Frappe: one request per pause) |
| F13 | Pagination with the glass pager | S | Sear's pager markup + pill styles; 20 per page | ✅ tested + parity |
| F14 | Quick filters: any type, field picker, saved choice | P | `quickFilterFields`; picker opt-in (`controls.quickFiltersCustomizable`); choice persisted | ✅ tested |
| F15 | Advanced filter with a searchable field picker | B | Sear's layout + PMO's searchable picker (styled as Sear's select) | ✅ tested + parity |
| F16 | Value inputs: date picker, async link | P + A | glass `DateField` (YYYY-MM-DD); `loadOptions` with 300 ms debounce; Frappe: stock `search_link` on the link's DocType | ✅ tested |
| F17 | Saved filters | B / X | one UI over `SavedFiltersStorage` (sync or async); localStorage default, per view and per user | ✅ tested (PMO's server DocType is an app adapter) |
| F18 | Column manager | B + A | Sear's popover + drag reorder, keyboard up/down, locked columns, search above 10 columns | ✅ tested; parity except the intended Actions difference (below) |
| F19 | Group-by | P + A | `groupByOptions`, `GroupByMenu`, collapsible groups with counts, empty group last; all groups in one table, so they share the header's column order and widths (horizontal scroll when narrow) | ✅ tested (structure in unit tests; widths measured in the browser, `e2e/list-groups.mjs`) |
| F20 | Row selection | P + A | `selectable`; rules C3 | ✅ tested |
| F21 | Bulk action bar | A | `bulkActions` (`run(keys, rows)`) or `renderBulkActions` | ✅ tested |
| F22 | Keyboard rows | P | rows focusable, Enter opens | ✅ tested |
| F23 | Conditional row styling | P | `rowClassName` | ✅ tested |
| F24 | Row actions | A | `rowActions`: Sear's delete-button look, a fixed last column, optional confirm dialog (red for destructive actions; the app's `onSelect` does the work), per-row `hidden` | ✅ tested; parity except the intended Actions difference (below) |
| F25 | Toolbar slot and control flags | B | `toolbarActions`; `controls.{search,savedFilters,filter,columns}` | ✅ tested |
| F26 | Alternative views (kanban, gantt, tree) | X | apps build them on `useListState` | — |
| F27 | Loading state | B | Sear's look: skeleton rows | ✅ tested |
| F28 | Empty state | B | the app's `emptyMessage` (any content: icon, call to action) when nothing exists; the generic message when filters hide everything (PMO's rule) | ✅ tested + parity |
| F29 | Error state with retry | P | `error` + `onRetry`; no pager or total while erroring; Frappe: the server's message (403, 417, 5xx, network) | ✅ tested |
| F30 | Client data mode | B | `mode="client"` (default): no network | ✅ tested |
| F31 | Frappe data mode (stock REST) | S | `@solvfast/ui/frappe`: `FrappeListView`, `useFrappeList`, session cookie + CSRF, four stock methods (docs/FRAPPE.md) | ✅ passed against simulated requests; **real-site validation deferred (not done)** |
| F32 | Base filters | S | `baseFilters`, AND-ed into list and count; changing them clears the selection | ✅ tested (5.4) |
| F33 | Metadata (`in_list_view`, `in_standard_filter`, `title_field`, standard fields ID / Created On / Last Updated) | S | `buildFrappeListMeta` (equal to Sear's on regular fields); standard-field labels localized; Dynamic Link filtered as text | ✅ tested (5.4) |
| F34 | Responsive and RTL | B | horizontal scroll inside the card; toolbar buttons wrap on phones; logical properties | ✅ `e2e/list-mobile.mjs` (page fits 360/390 px, en/ar); Arabic parity shots |
| F35 | i18n | A | list messages in ar/en, overridable through `ThemeProvider` messages; every filter control named; Frappe: `fieldLabels` for DocField labels | ✅ tested |
| F36 | Save-filter feedback | A | `onFilterSaved(filter)`, `onSavedFiltersError(error, action)` | ✅ tested |
| F37 | Permission gating | X | the app passes `selectable`, `bulkActions`, `rowActions` per permission | — |
| F38 | Derived / renamed fields | X | column `render` | — |
| F39 | Hand-written access control | X | stock DocPerm | — |
| F40 | Per-DocType custom endpoints | X | stock REST | — |
| F41 | Visual look | S | Sear is the reference | ✅ parity (docs/VALIDATION.md) |

## Intentional visual differences from Sear

Row actions are a fixed last column, separate from the data columns: not sortable, filterable, hideable or
reorderable. Sear's Field Library modelled them as an ordinary `actions` field, so 8 of the 44 list-parity
screenshots differ (column manager open, and the column order after showing a hidden column, in light/dark × en/ar);
the other 36 are pixel-identical. Evidence: `docs/validation/5.3/actions-column/`.

On phones the toolbar's buttons wrap onto a second line instead of making the page wider than the screen (Sear's
page was 506 px wide at 390 px, cutting off its "Create" button, and shifted in Arabic). Desktop is unchanged; the 4
mobile parity shots differ. Evidence: `docs/validation/5.3-review/mobile-toolbar/`.

With both, the list matches Sear in **32 of 44** parity screenshots; the other 12 are these two differences.

## Behaviour rules

| Rule | Behaviour | Tests |
|---|---|---|
| C1 grouping and paging | Client mode groups every filtered row and turns paging off while grouped. Server mode groups the loaded rows; when fewer than `total` are loaded a banner says so ("Showing X of Y records, grouped…"), offers **Load more** (`onLoadMore`), and group counts end in "+". | client and server tests, with ungrouped paging as the negative control |
| C2 search with OR filters | Frappe has one `or_filters` list: with "Match all" filters search uses it across the search fields; with "Match any" filters search narrows to the title field (AND-ed) and a note under the toolbar says so | all branches incl. one-condition and one-field cases; in the UI with the note (5.4) |
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
| On phones the toolbar wraps and the page fits the screen | wider than the screen; the page action was cut off | Sear DataGrid toolbar |
| Groups share one column layout (one table, a header row per group) | a separate table per group, so column widths differed from group to group | PMO `GroupedListTable.tsx` |
| Filter value inputs keep their DOM node and focus while typing | declared inside render, remounted on every keystroke | PMO `AdvancedFilter.tsx` |
| Condition ids never collide | the counter restarted on each mount | PMO `AdvancedFilter.tsx` |
| Saved-filter storage failures reach the app (`onSavedFiltersError`) | swallowed | — (new adapter API) |
| Every filter-row control has an accessible name (Field / Condition / Value / Match) | unnamed comboboxes | Sear, PMO |
| Frappe count honours "Match any" filters (`reportview.get_count`) | `or_filters` sent to `frappe.client.get_count`, which drops them: wrong totals | Sear `services/frappe-data.ts` |
| Frappe requests never name unknown fields (old saved filters, render-only columns) | Frappe rejects the whole request (417 "Field not permitted in query") | Sear |
| A date on a Datetime field (Created On, Last Updated) matches the whole day | compared with midnight | Sear |
| Dynamic Link fields filter as text | offered link search on a DocType named after a field | Sear `frappe-meta.ts` |
| Standard fields ID / Created On / Last Updated in the UI language | English only | Sear `frappe-meta.ts` |
| Link filter values use Frappe's link search (search fields, title, permissions) | a name-only `get_list` | Sear `services/frappe-data.ts` |
| "Add filter" uses the theme primary directly | Sear recoloured every `button.text-info` | Sear `sear-studio.css` |
