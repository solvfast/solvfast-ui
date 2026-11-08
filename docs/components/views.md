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
| Report | yes | `FrappeReportView` on `ListView` | sim: `reportview.get` with Desk's child-column field form, `frappe.client.set_value` | filters, search, sort, paging, group-by (loaded rows), column picker including child-table fields, inline edit (Desk 15.110 rule by default, child cells included; `editable` opt-in), totals | `tests/frappe-views-report.test.tsx` (`LV.H1 …`, 26 tests) |
| Image | yes, only when `image_field` names a field | Core `ImageGrid` / `ImageView` + `FrappeImageView` | sim: `reportview.get` with `image_field` + `title_field` | filters, search, sort, paging, selection, keyboard; P36c: Desk's Actions on checked cards (`bulk`) | `tests/frappe-views-image.test.tsx` (`LV.H5 …`, 7 tests), `tests/views-p36c.test.tsx` (`P36C.views.1`–`14`) |
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
- When the user switches views, the filters and sort of the List, Report, Image, Kanban or Calendar view carry over through
  `initialQuery` / `defaultSort` (each view reports its applied state through `onQueryStateChange`; `FrappeListView` has it
  since the P35 integration).

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
- **Inline edit (P36: Desk 15.110 by default).** Which cells can be edited is what Desk actually does. It was read
  from the code paths, not from comments. Citations: `report_view.js` = `frappe/public/js/frappe/views/reports/report_view.js`;
  datatable = `frappe-datatable` 1.20.4 `src/cellmanager.js` (the version pinned in Frappe's `package.json`).

  **How Desk decides.**
  - `build_row` (report_view.js:1285-1337) gives each cell `editable: this.is_editable(col.docfield, d)`. A child-table
    cell gets `editable: Boolean(name && this.is_editable(col.docfield, d))`, where `name` is the row's `Child:name`.
  - `is_editable(df, data)` (:758-780) has two parts. First the base checks: `frappe.model.can_write(this.doctype)`,
    `data.docstatus !== 1 || df.allow_on_submit`, `data.docstatus !== 2`, `!df.read_only`, `!df.is_virtual`,
    `!df.hidden` and `frappe.model.is_non_std_field(df.fieldname)`. If one fails, it returns `false`. Otherwise it returns
    `this.meta.fields.some(df => df.fieldtype === "Table") || (df.read_only_depends_on && !evaluate(...))`.
  - The datatable refuses to edit only when `cell.editable === false` or `column.editable === false` (datatable:442-449).
    So when the DocType has no Table field and the field has no `read_only_depends_on`, `is_editable` returns that
    empty value (`undefined`, `null` or `""`). That is not `=== false`, so **the cell can be edited**.
  - The column-level flag is `is_non_std_field && !read_only && !is_virtual` (:1170-1173). It adds nothing to the cell rule.
  - Frappe's own Cypress test `cypress/integration/report_view.js` confirms this. It edits `enabled` of
    `Custom Submittable DocType`, a DocType without a Table field whose field has no `read_only_depends_on`
    (fixture `cypress/fixtures/custom_submittable_doctype.js`), and expects the `frappe.client.set_value` call.
  - The P35 docs, `CRM-MIGRATION.md` §5.5 and the code comment ("don't check read_only_depends_on if there's child
    table fields") read the trailing clause as "a DocType without a Table field is read-only". The runtime does not
    behave that way.

  **Truth table.** Every row assumes the base checks pass; if one fails the cell is not editable.

  | DocType has a `Table` field | `read_only_depends_on` | Parent cell | Child-table cell |
  |---|---|---|---|
  | yes | none | editable | editable when the row has a child row (`Child:name`) |
  | yes | set (any value) | editable (**not evaluated**) | editable when the row has a child row |
  | no | none | editable (empty value ≠ `false`) | not editable (`Boolean(undefined)`) |
  | no | evaluates false on the row | editable | editable when the row has a child row |
  | no | evaluates true on the row | not editable | not editable |

  A `Table MultiSelect` field does not count as `Table` here (:774). The column picker does offer its fields
  (`frappe.model.table_fields`), so a DocType whose only table is a Table MultiSelect falls under the "no" rows.

  | Base check | Source | Rule |
  |---|---|---|
  | write right | `frappe.model.can_write` (model/model.js:382-384) | `boot.user.can_write` is built from the **permlevel-0** DocPerm rows only (user.py:95-106, 131-137, 171-172; permissions.py:540-543). It counts `write`, and also `create` on a non-Single DocType. The field's permlevel is **not** checked. Child cells use the parent DocType's right. |
  | submitted | `data.docstatus !== 1 \|\| df.allow_on_submit` | Only `allow_on_submit` fields. For a child cell, the child field's flag and the parent row's docstatus. |
  | cancelled | `data.docstatus !== 2` | Never editable. |
  | field flags | `!read_only && !is_virtual && !hidden` | Static flags from the meta (DocField + property setters). |
  | standard field | `is_non_std_field` (model/model.js:64-78, 191-195) | `name`, `owner`, `creation`, `modified`, `modified_by`, `_user_tags`, `_comments`, `_assign`, `_liked_by`, `docstatus`, `idx`, `parent`, `parenttype`, `parentfield`. |
  | fieldtype | — | Not part of the rule. Desk edits any fieldtype through the field's own control (:698-729), and opens Text Editor in a dialog. |

  **`read_only_depends_on` evaluation** (`evaluate_read_only_depends_on`, :731-756). It runs on the **loaded row**:
  `name`, `docstatus`, the visible columns and the `Child:field` keys. It never sees the whole document.
  - A boolean is used as is.
  - `eval:<js>` runs `frappe.utils.eval` (utils.js:1076-1088) with `doc` = the row and nothing else (no `parent`). A
    field that is not loaded is `undefined`, so `eval:doc.locked` is false and the cell is editable. In Desk an error
    is a `frappe.throw` and the row is not built. This package treats the cell as not editable. The pure
    `isCellEditable` reports the problem through its `onIssue` option; `FrappeReportView` does not surface it.
  - `fn:` needs `this.frm`. The report view has none, so it falls through to the fieldname form: `data["fn:…"]` is
    `undefined`, which means editable.
  - Otherwise the expression is a fieldname. Desk reads `data[expression]`: an array counts by its length, any other
    value by its truthiness.

  **Save** (`get_editing_object` → `set_control_value`, :624-696).
  - Desk calls `frappe.db.set_value(cell.doctype, cell.name, {[fieldname]: value})` (db.js:60-73). That is a POST to
    `frappe.client.set_value` with `{doctype, name, fieldname: '{"<field>": value}'}`. Desk's `value: undefined` goes out
    as `value=` (jQuery.param); this package leaves the key out. The server's `if not value:` treats both the same.
  - A child cell sends the **child** DocType and the child row's name.
  - An unchanged value sends nothing (datatable `submitEditing`:553-556).
  - Desk shows the new value at once and puts the old one back on failure. A response without `message` counts as a
    failure (:688-692).
  - On success Desk refreshes the row's keys from the returned document (:639-670). `Child:field` keys come from the
    child row with the same name.

  **What the server enforces** (`frappe.client.set_value`, client.py:173-207 → `Document.save`, document.py:376-435).
  - The `"Cannot edit standard fields"` guard (:182-183) compares the raw `fieldname` argument. The report view always sends
    a JSON object, so this guard never fires for it.
  - A child DocType is resolved to its parent through `parenttype` / `parent`, and the PARENT is saved (:195-203). The
    response is the parent's `as_dict()`.
  - `check_permission("write")` (:404). `check_if_latest` (:850-878) never conflicts, because the document is loaded
    fresh on the server.
  - `check_docstatus_transition` (:880-918): a submitted document needs the **`submit`** right (update after submit),
    and a cancelled one fails with "Cannot edit cancelled document".
  - `validate_higher_perm_levels` (:783-806) **silently resets** a field whose permlevel the user cannot write. No
    error is raised: the save succeeds with the old value.
  - `_validate_update_after_submit` (base_document.py:1050-1085) refuses changes to fields without `allow_on_submit`.
  - Then `validate`, `before_save` / `before_update_after_submit` and the DocType's own checks run.

  **This package.**
  - `isCellEditable(df, row, {fields, levels, issingle?, child?, mode?, onIssue?})` implements the truth table above.
    `fields` is the report DocType's fields and `levels` is `usePermissions(bundle).levels`.
  - Desk's empty "editable" value becomes `true` for a parent cell and `false` for a child cell.
  - `FrappeReportView` applies the rule to every cell, child-table columns included. Child-cell edits post to
    `frappe.client.set_value` on the child row, as Desk does.
  - The cell changes only after the server answers. A refusal keeps the editor open with the server's message; Desk
    instead shows the value at once and reverts it.
  - After a save, every loaded row of that document is refreshed from the response (`rowFromSavedDoc`). Desk refreshes
    only the first one.
  - Cells whose fieldtype has no editor here (outside `INLINE_EDIT_TYPES`: Text Editor, Datetime, Time, Color, Rating,
    Attach, …) stay read-only even when Desk would edit them.
  - Two differences remain. A `read_only_depends_on` that fails to evaluate makes the cell read-only here, where Desk
    throws. Without `session.roles` the rights are unknown (`usePermissions` rule 9), so nothing is editable.

  **Opt-in: a different rule** (the default stays `"desk"`).

  ```tsx
  <FrappeReportView doctype="Task" />                        {/* editable="desk": Frappe 15.110 */}
  <FrappeReportView doctype="Task" editable="strict" />
  <FrappeReportView doctype="Task" editable={(df, row, info) => info.desk && df.fieldname !== "status"} />
  <FrappeReportView doctype="Task" inlineEdit={false} />    {/* no inline editing at all */}
  ```

  - `"strict"` keeps Desk's conditions and adds what the server would refuse or silently undo:
    - the `write` right at level 0 (Desk's `can_write` also accepts `create`);
    - the `write` right on the field's own permlevel;
    - the `submit` right on a submitted document;
    - `read_only_depends_on` evaluated even when the DocType has a Table field.
  - A function receives `(df, row, {desk, doctype, childDoctype?, levels})`. `info.desk` is Desk's verdict for that cell.
  - Whatever the rule says, a child cell needs its child row, and the fieldtype needs an editor.

  The request shape, the child-row save and the server checks were checked in the simulator only. Since P36 that
  includes `reportSetValueHandler` in `src/frappe/testing/handlers/views.ts`, which implements client.py:195-203, the
  submit right and `_validate_update_after_submit`. **The editor behaviour has not been run against a real site.**
- **Actions on the checked rows (P36b, `bulk`).** Desk's `ReportView` extends `ListView` (report_view.js:9): its datatable
  has a checkbox column (`checkboxColumn: true`, :360) and checking a row shows the list's Actions menu
  (`onCheckRow` → `toggle_actions_menu_button`, :371-374; `get_actions_menu_items`, list_view.js:1855-2128). Before
  P36b `FrappeReportView` had no Frappe actions at all — no Submit / Cancel either. `bulk={{}}` (same `FrappeBulkOptions`
  as `FrappeListView`; `FrappeViews bulk` forwards it to the List and Report views) turns the checkboxes on and offers
  exactly the List view's items, gates and outcomes (`useFrappeSelectionActions`, shared): Submit = submittable + level-0
  `submit`, Cancel = `cancel` (`frappe.model.can_cancel`), both hidden under an active Workflow (list_view.js:2108-2120);
  List View Settings `allow_edit` is read as Desk's report view does (report_view.js:53). A document shown on several
  rows (one per child-table row) is sent **once** — Desk would send its name once per checked row, and the server would
  then report the second copy as failed (documented difference, kept by owner decision P36c #3). Every action that takes
  names does this — Submit, Cancel, Edit, Delete, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print,
  Export and the workflow's actions — and the confirmation, the "N succeeded, M failed" line and the selection outcome
  count DOCUMENTS, not rows (regression tests `P36C.views.20`–`31`, `tests/views-p36c.test.tsx`). Without `bulk`
  nothing changes.
- **Totals:** "Show totals" sums the visible numeric columns over the **loaded rows (this page)**, as Desk's
  `get_columns_totals` does (:1523-1549). The totals appear in a card under the table, not in a table row.
- **Group by:** the list's Group by (`groupByFields`) groups the loaded rows (rule C1, chunk of 200).
- **Not reproduced:**
  - Report Builder `save_report`;
  - the SQL aggregate Group By (`aggregate_function` / `aggregate_on_field`, reportview.py:161-176);
  - charts;
  - multi-column sort;
  - column widths;
  - editors for fieldtypes outside `INLINE_EDIT_TYPES`;
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
- **Actions on the checked cards (P36c, `bulk`; owner decision 5).** Desk's `ImageView` extends `ListView`
  (image_view.js:6). Its `setup_view` (:17-21) keeps `setup_check_events` (list_view.js:1375-1429) but not
  `render_header`, every card carries a `list-row-checkbox` (:113-114), and the page head is the List view's
  (`set_primary_action` + `set_actions_menu_items`, list_view.js:157-179, 285-296). So checking a card swaps
  "Add {DocType}" for the Actions menu (`on_row_checked` → `toggle_actions_menu_button`, :1613-1634, 590-598) with the
  List view's items, gates and outcomes (`get_actions_menu_items`, :1855-2128).

  ```tsx
  <FrappeImageView doctype="Item" bulk={{}} primaryAction={<Button>Add Item</Button>} />
  <FrappeViews doctype="Item" bulk={{}} image={{ primaryAction: addItem }} />   // bulk reaches List, Report and Image
  ```

  - `bulk` (the same `FrappeBulkOptions` as the List / Report views) turns the card checkboxes on. The actions come from
    the shared `useFrappeSelectionActions` — no separate implementation: Edit, Export, Assign To, Clear Assignment, Apply
    Assignment Rule, Add Tags, Print, Submit, Cancel, Delete, then the workflow's actions; Submit only with a submittable
    DocType + level-0 `submit`, Cancel with `cancel`, both hidden under an active Workflow; nothing but Export without
    `session.roles`.
  - Outcomes as in the List view: Submit / Cancel clear the selection only when every document went through (a partial
    failure keeps it, the cards reload); Edit and workflow actions keep it; Delete / Assign / Tags clear it; the outcome
    line sits under the cards.
  - Core `ImageView` takes the same props as `ListView` for this: `primaryAction`, `bulkActions`, `renderBulkActions`,
    `selectionMode` ("header" default | "bar"), `renderActionsMenu`, `onActionsOpenChange`, `actionsLabel`. In header
    mode, while cards are selected, a strip above the cards shows select-all (this page), "{n} items selected" and Clear.
    A plain `selectable` `ImageView` with none of those props keeps its cards-only selection (unchanged).
  - The host supplies "Add {DocType}" (`primaryAction`); `FrappeImageView` does not build FrappeListView's create /
    Quick Entry flow.
  - **Differences from Desk:** (1) the selection strip — Desk's Image view has no header row (`get_header_html` is
    commented out, image_view.js:161-177), so it has no select-all, no "{n} items selected" and no Clear; the package
    shows the List view's header content there (owner decision). (2) Desk hides the card checkbox on phones
    (`hidden-xs`, :113); the package keeps it (keyboard: Space on a focused card). (3) Desk's shift-click range select
    (list_view.js:1398-1424) is not reproduced on cards. (4) Desk's Image view requests no `docstatus` (its `set_fields`,
    :23-31, replaces the list's standard fields), so Desk's Print check (bulk_operations.js:16-40) refuses every card of
    a submittable DocType except for the Administrator; the package requests `docstatus` (useFrappeViewList) and checks
    the real value. (5) `bulk` is opt-in, as in the other views.
  - Tests: `tests/views-p36c.test.tsx` (`P36C.views.1`–`14`, SIMULATED). Showcase: "Image view actions (SIMULATED)".

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
- **No selection, no bulk actions** — as Desk: the Kanban board renders cards without row checkboxes
  (kanban_board.bundle.js), so Desk's Actions menu never shows there (P36b check).

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
| `kanban_board.get_kanban_boards` | kanban_board.py:68-75, :48-55 | boards of the DocType (through the transport's row filter / permission engine when the Kanban Board meta is loaded); private boards are visible only to their owner and Administrator | — |
| `kanban_board.update_order_for_single_card` | kanban_board.py:131-161 | write check on the DocType (:137, permission engine when on), column order splice, board saved, the document's `field_name` set; answers the board | Python's `UnboundLocalError` for an unknown column is simulated as a 417 |
| `frappe.desk.calendar.get_events` | calendar.py:31-57 | read check (:25-26), default fields + Color, the `ifnull` range test, the list filters and row permissions through the transport's own filter; answers a list of dicts | — |

P35 integration: the handlers use the transport's handler context (`FixtureContext`: permission engine, row filter, clock); the
permission checks apply only with `createFixtureTransport(…, { permissions })`.
`KANBAN_BOARD_FIXTURE_META`, `VIEWS_DEMO_META` and `viewsDemoBackend` are exported from `@solvfast/ui/frappe/testing`.
`KANBAN_BOARD_FIXTURE_META` contains Kanban Board and Kanban Board Column, a subset of the shipped JSONs.
`viewsDemoBackend()` provides a demo site: Product with images, and Project Task with a Kanban Board on `status`.
Neither is evidence of Frappe behaviour.
