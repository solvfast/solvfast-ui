# List views — switcher, Report, Image, Kanban, Calendar

Desk shows one DocType in several views (`frappe.views.view_modes`: List, Report, Dashboard, Gantt, Kanban, Calendar,
Image, Inbox, Tree, Map — `frappe/public/js/frappe/list/list_view_select.js`). This package implements **List, Report,
Image, Kanban and Calendar**. It does not implement **Gantt, Dashboard, Map, Tree or Inbox**. A switcher never offers a
view that is not implemented (see §1).

| Layer | Folder | Entry | Knows Frappe? |
|---|---|---|---|
| Core views | `src/list/views/` | core `@solvfast/ui` | No. They are presentational and driven by `useListState` (filters, search, sort, paging, selection). |
| Frappe adapters | `src/frappe/views/` | `@solvfast/ui/frappe` | Yes. They fetch through `frappe.desk.reportview.get` / `get_count`, the Kanban Board API and `frappe.client.set_value`. |
| Simulated handlers | `src/frappe/testing/handlers/views.ts` | (tests, showcase) | They are SIMULATED. Each one cites the Frappe 15.110 Python it reproduces. |

**Status (CONTRACT §4):** the views are *Implemented* and *Simulated & tested* (Testing Library and `createFixtureTransport`).
**None of them has been verified against a real Frappe site.** Strings come from `src/theme/messages-ws/views.ts` (en + ar).

## The four levels per view

Each row answers four questions: (1) is there a switcher entry, (2) does the view exist, (3) is it connected to data,
(4) does it support actions and filters. For level 3, "sim" means the simulator only and "site" would mean a real site.
No view here reaches "site".

| View | (1) Switcher | (2) Implementation | (3) Data | (4) Actions / filters | Evidence (tests) |
|---|---|---|---|---|---|
| List | yes | `FrappeListView` (pre-existing, WS3) | sim + recorded reads (pre-existing) | yes (pre-existing) | B-list.md sections A–J |
| Report | yes | `FrappeReportView` on `ListView` | sim: `reportview.get` with Desk's child-column field form, `frappe.client.set_value` | filters, search, sort, paging, group-by (loaded rows), column picker including child-table fields, inline edit (permission-aware), totals | `tests/frappe-views-report.test.tsx` (`LV.H1 …`, 9 tests) |
| Image | yes, only when `image_field` names a field | Core `ImageGrid` / `ImageView` + `FrappeImageView` | sim: `reportview.get` with `image_field` + `title_field` | filters, search, sort, paging, selection, keyboard | `tests/frappe-views-image.test.tsx` (`LV.H5 …`, 7 tests) |
| Kanban | yes, when the DocType has a Kanban Board or a Select field | Core `KanbanBoard` + `FrappeKanbanView` | sim: `get_kanban_boards`, `frappe.client.get` (board), `reportview.get` (all rows), `update_order_for_single_card` / `set_value` | move by drag, by the "Move to…" menu or by Alt+Arrow keys; filters and search; read-only without write permission | `tests/frappe-views-kanban.test.tsx` (`LV.H2 …`, 8 tests) |
| Calendar | yes, with a field map or a Date / Datetime field | Core `CalendarMonth` + `FrappeCalendarView` | sim: `reportview.get` with a date range, or `frappe.desk.calendar.get_events` | month navigation, filters and search, event click | `tests/frappe-views-calendar.test.tsx` (`LV.H3 …`, 6 tests) |
| Gantt | no (disabled, "not implemented") | no | no | no | `LV.H0` availableViews tests |
| Dashboard | no (disabled, "not implemented") | no | no | no | `LV.H0` |
| Map | no (disabled: "not implemented", or "no location fields") | no | no | no | `LV.H0` |
| Tree | no (disabled: "not implemented", or "not a tree") | no | no | no | `LV.H0` |
| Inbox | no (disabled: "not implemented", or "only for Communication") | no | no | no | `LV.H0` |

The switcher and the host component are covered by `tests/views-switcher.test.tsx` (9 tests),
`tests/frappe-views-host.test.tsx` (2 tests) and `tests/views-showcase.test.tsx` (1 smoke test).

---

## 1. Switcher — `ViewSwitcher` (Core) and `availableViews(meta)` (Frappe)

```tsx
import { ViewSwitcher } from "@solvfast/ui";
import { availableViews, useFrappeAvailableViews, FrappeViews } from "@solvfast/ui/frappe";

<ViewSwitcher views={availableViews(meta, { kanbanBoards })} value={view} onChange={setView} showUnavailable={false} />
// or everything wired:
<FrappeViews doctype="Task" showUnavailable calendar={{ start: "exp_start_date", end: "exp_end_date", title: "subject" }} />
```

- `ViewOption = { view, available, reason?, label? }`. Only `available` views can be chosen. Unavailable views are hidden.
  With `showUnavailable` they are listed but disabled, each with its reason.
- `switcherOptions` turns any `available: true` for a view this package does not implement into `available: false,
  reason: "not_implemented"`. A host cannot make Gantt, Dashboard, Map, Tree or Inbox selectable.
- `availableViews(meta: DocTypeMeta, { kanbanBoards?, calendar? })` follows Desk's conditions
  (list_view_select.js:52-133), limited to what is implemented:
  - List and Report are always available.
  - Image needs `meta.image_field` to name a field.
  - Kanban needs a board, or a visible Select field (group mode). It is never offered for `File`.
  - Calendar needs a passed field map, or a Date / Datetime field found by `calendarFieldMapFromMeta`.
  - Tree needs `is_tree`; Map needs latitude and longitude, or a `location` Geolocation field; Inbox needs Communication.
    In all three cases the reason is "not implemented".
- `useFrappeAvailableViews(doctype)` combines the meta with `get_kanban_boards`.
- `FrappeViews` renders the switcher and the chosen view. It never renders a view that is not available.
- When the user switches views, the filters and sort of the Report, Image, Kanban or Calendar view carry over through
  `initialQuery` / `defaultSort` (each view reports its applied state through `onQueryStateChange`).
  **Limitation:** filters set in the List view do not carry over, because `FrappeListView` does not report its state.

## 2. Shared row source — `useFrappeViewList`

Every Frappe view reads its rows the way the list does. It reuses `useFrappeMeta`, `buildListRequest` (filters, search,
sort and paging from `useListState`), `reportviewGet` and `reportviewCount`. On top of that it adds what the views need:

- `extraFields`: fields the list request drops, such as `image_field` (an Attach Image field is not a list column) or a
  board's `field_name`.
- `childColumns`: child-table fields as columns named `Child:field`.
- `pageSize: 0`: every row, as Desk's Kanban requests (kanban_view.js:80).
- `fetchRows`: another source for the same request (Calendar `get_events`).

Rows are cached under `["sf-frappe","list",doctype,…]`, so `invalidateFrappeList(qc, doctype)` refreshes the views too.
`patchCachedRows(qc, doctype, name, patch)` updates the rows of both FrappeListView's cache and the views' cache.

## 3. Report — `FrappeReportView`

```tsx
<FrappeReportView doctype="Task" groupByFields={["status"]} inlineEdit totals />
```

- **Column picker:** the list's `ColumnManager` lists every field of the DocType, hidden until chosen. It also lists the
  child tables' fields ("Qty (Items)"). Child columns are requested as Desk does (report_view.js:869-884):
  - every parent field is fully qualified: `` `tabTask`.`name` ``;
  - each child field gets an alias: `` `tabTask Item`.`qty` as 'Task Item:qty' ``, plus `` `tabTask Item`.`name` as 'Task Item:name' ``;
  - the order is qualified and there is no `group_by` (report_view.js:136), so a site answers one row per child row.

  **The simulator answers one row per parent with its first child row.** No recorded real response covers this request
  form, the response key form (the decoder strips quotes around `'Child:f'` defensively) or the row-per-child shape.
  This sub-path is BLOCKED-REQUIRES-REAL-FRAPPE.
- **Inline edit:** `isCellEditable(df, row, levels)` ports report_view.js:758-771:
  - the user has the write right on the field's permlevel;
  - the document is not submitted, unless the field has `allow_on_submit`;
  - the document is not cancelled;
  - the field is not read-only, virtual or hidden, and is not a standard field.

  It differs from Desk on purpose in three ways:
  - 15.110's trailing clause (:772-777) makes fields of a DocType without a Table field read-only. That looks like a
    defect, so it is not reproduced.
  - A field with `read_only_depends_on` is never edited inline, because the expression is not evaluated here.
  - Child cells are read-only.

  A save calls `frappe.client.set_value({doctype, name, fieldname: {"<field>": value}})` (Desk `set_control_value`,
  :682-697). The cell changes only after the server answers. A refusal keeps the editor open and shows the server's message.
- **Totals:** "Show totals" sums the visible numeric columns over the **loaded rows (this page)**, as Desk's
  `get_columns_totals` does (:1523-1549). The totals appear in a card under the table, not in a table row.
- **Group by:** the list's Group by (`groupByFields`) groups the loaded rows (rule C1, chunk of 200).
- **Not reproduced:**
  - Report Builder `save_report`;
  - the SQL aggregate Group By (`aggregate_function` / `aggregate_on_field`, reportview.py:161-176);
  - charts;
  - multi-column sort;
  - column widths;
  - editing child cells;
  - `add_totals_row` in user settings.

## 4. Image — `ImageGrid`, `ImageView` (Core) and `FrappeImageView`

```tsx
<ImageGrid rows={rows} rowKey={(r) => r.id} image={(r) => r.photo} title={(r) => r.name} detail={(r) => r.city}
  indicator={(r) => <StatusDot tone="success" />} selection={{ isSelected, toggleRow }} onOpen={open} />
<FrappeImageView doctype="Item" imageUrl={(u) => `https://site.example${u}`} />
```

- **Cards:** each card shows the image, or the title's initials (Desk `get_abbr`), the title, a detail line (the first
  non-empty list field, as `item_details_html`) and an indicator slot.
- **Keyboard:** the cards form one roving tab stop.
  - The arrow keys move between cards; Left and Right swap in RTL.
  - Home and End jump to the first and last card.
  - Enter opens a card; Space selects it.
- **States:** loading shows skeleton cards; there are also an empty state and an error state.
- **Paging:** the list pager.
- **Data:** `FrappeImageView` requests `image_field` and `title_field` with the list fields (image_view.js:21-29). No
  recorded real `reportview.get` response includes an Attach Image column, so reading that field is simulator-only evidence.
- **Not reproduced:** the PhotoSwipe gallery and zoom, `get_attached_images`, the Like heart on cards.

## 5. Kanban — `KanbanBoard` (Core) and `FrappeKanbanView`

```tsx
<KanbanBoard columns={cols} rows={rows} rowKey={(r) => r.id} columnOf={(r) => r.stage} title={(r) => r.title}
  order={{ todo: ["b", "a"] }} onMove={async (m) => save(m)} canMove={(r) => !r.locked} onAddCard={(col) => create(col)} />
<FrappeKanbanView doctype="Task" board="Task Board" />      // or groupBy="priority"
```

- **Core board:**
  - columns show a card count and an indicator dot;
  - each column keeps its card order;
  - cards move by HTML5 drag and drop (onto a column, or before a card), by the "Move to…" menu, or by Alt+Left /
    Alt+Right (swapped in RTL);
  - a move shows at once; if `onMove` rejects, the card goes back (as kanban_board.bundle.js:203-209 does);
  - moves are announced in a live region;
  - there is an "Add card" slot.
- **Board mode:**
  1. `get_kanban_boards(doctype)` (kanban_board.py:68-75).
  2. The board is loaded with `frappe.client.get("Kanban Board", name)` (kanban_view.js:141-147).
  3. The board's active columns are shown; archived ones are hidden.
  4. Each column's `order` JSON sets the card order.
  5. The board's `filters` are ANDed with the list filters.
  6. The board's `fields` are shown on the cards.
  7. Every row is requested (`page_length: 0`).
  8. A move calls `update_order_for_single_card({board_name, docname, from_colname, to_colname, old_index, new_index})`
     (kanban_board.py:131-161; args as kanban_board.bundle.js:175-184).
  9. The answer replaces the board, and the card's field is patched.

  **Desk quirk, reproduced:** the server pops `old_index` from the column's `order` JSON without checking the name
  (kanban_board.py:147-151). With a list filter active, the displayed column omits cards that are still in `order`, so
  the index sent can pop a different name than the card that moved. Desk sends Sortable DOM indices and behaves the same
  way, so this is Desk's behaviour, not a defect introduced here.
- **Group mode:** this is a package addition with no Desk equivalent. It is used when there is no board, or when `groupBy`
  is set. The columns are the Select field's options, plus "Not set". A move calls `frappe.client.set_value`.
- **Gates:**
  - moves need the write right on the DocType (Desk: kanban_board.py:137, checked on the server);
  - only drafts can move, unless the field has `allow_on_submit`;
  - without write permission the board is read-only and says why.
- **Not reproduced:**
  - creating a board (`quick_kanban_board`);
  - adding, archiving or reordering columns, and choosing column indicator colours;
  - the Kanban Settings dialog;
  - "Save filters";
  - card assignment and like;
  - `last_kanban_board`.

## 6. Calendar — `CalendarMonth` (Core) and `FrappeCalendarView`

```tsx
<CalendarMonth month="2026-11-01" onMonthChange={setMonth} events={events} onEventClick={open} weekStartsOn={1} />
<FrappeCalendarView doctype="Task" fieldMap={{ start: "exp_start_date", end: "exp_end_date", title: "subject" }} />
<FrappeCalendarView doctype="Event" source={{ method: "frappe.desk.calendar.get_events" }} />
```

- **Core month grid:**
  - the grid shows whole weeks (`monthGrid`) and is Monday-first by default;
  - a multi-day event appears on every day it covers;
  - each day shows a limited number of events, then "+n more";
  - today is marked with `aria-current="date"`;
  - there are Today, Previous and Next buttons; Previous and Next swap in RTL.
- **Field map:** Desk's field map is app code (`<doctype>_calendar.js`, calendar.js:118-125) or a Calendar View document.
  Neither is in the meta, so you pass `fieldMap`, or `calendarFieldMapFromMeta` guesses one:
  - start: the first Date or Datetime field, preferring names with start, from or begin;
  - end: a field whose name says end, to, till, until or due;
  - title: the title field;
  - color: the first Color field (calendar.py:37-39).
- **Default source:** `reportview.get` with `[start, "<=", last visible day]` and `[end, ">=", first visible day]`, plus
  the list's filters. **This differs from Desk's `get_events`:** a row with an empty end date is not shown (calendar.py:49-55
  uses `ifnull(end, '2199-12-31')`).
- **Optional source:** `source: { method }` sends Desk's `get_events` arguments
  (`doctype, start, end, field_map, filters`, calendar.js:358-367).
- **Untested paths:** the demo DocType uses Date fields only. These paths have no test yet:
  - the `23:59:59` end bound for a Datetime start field;
  - an `allDay` mapped to a Check field.
- **Not reproduced:**
  - week and day views;
  - dragging or resizing events (`update_event`);
  - selecting days to create an event;
  - the weekend toggle;
  - Calendar View documents;
  - time-zone conversion.

## 7. Why Gantt, Dashboard, Map, Tree and Inbox are not implemented

| View | What Desk needs | Why not here |
|---|---|---|
| Gantt | `frappe.views.calendar[doctype]` (JS field map with progress and dependencies), frappe-gantt library | Configuration is app JavaScript, not meta. It needs a Gantt renderer and `update_event` writes. Out of P35 Phase 1. |
| Dashboard | Dashboard Chart / Number Card documents for the DocType (`frappe.desk.doctype.dashboard_chart…`) | Server documents and chart sources outside the DocType meta. The Core `chart/` and `cards/` exist, but there is no Frappe adapter. |
| Map | `get_coords_method` (listview settings, JS), or latitude and longitude fields, or a `location` Geolocation field; a Leaflet map | Needs a map library and tile server. Low relevance (B-list H7). |
| Tree | `frappe.treeview_settings[doctype]` (JS) or `is_tree`; `frappe.desk.treeview.get_children`, `add_node` | Nested-set operators exist (list filters) but there is no tree UI. The tree settings are app JavaScript. |
| Inbox | Communication + Email Account documents (`frappe.boot.email_accounts`) | Applies to Communication only, and depends on mail accounts. Low relevance (B-list H9). |

`availableViews` reports them as unavailable, with the reason "not implemented" where Desk would offer them.

## 8. Simulated server handlers (`src/frappe/testing/handlers/views.ts`)

| Method | Frappe 15.110 source | Simulated | Not simulated |
|---|---|---|---|
| `kanban_board.get_kanban_boards` | kanban_board.py:68-75, :48-55 | boards of the DocType; private boards are visible only to their owner and Administrator | permission engine |
| `kanban_board.update_order_for_single_card` | kanban_board.py:131-161 | column order splice, board saved, the document's `field_name` set; answers the board | write check (:137); Python's `UnboundLocalError` for an unknown column is simulated as a 417 |
| `frappe.desk.calendar.get_events` | calendar.py:31-57 | default fields + Color, the `ifnull` range test, filters (operator subset); answers a list of dicts | read check (:25-26), User Permissions |

`KANBAN_BOARD_FIXTURE_META` contains Kanban Board and Kanban Board Column, a subset of the shipped JSONs.
`viewsDemoBackend()` provides a demo site: Product with images, and Project Task with a Kanban Board on `status`.
Neither is evidence of Frappe behaviour.
