# List layer — `ListView` and `FrappeListView`

Two layers (`docs/CONTRACT-0.4.md` §1):

| Layer | Folder | Entry | Knows Frappe? |
|---|---|---|---|
| Generic list | `src/list/` | core `@solvfast/ui` | No. Rows, columns and callbacks in; renders in any React app. |
| Frappe list | `src/frappe/{FrappeListView.tsx,useFrappeList.tsx,query.ts,meta.ts}`, `src/frappe/list/` | `@solvfast/ui/frappe` | Yes. Builds the requests, decodes the answers, plugs the generic list into a site. |

**Status (CONTRACT §4):** *Implemented* and *Simulated & tested* (recorded payload shapes, the playground mock, `createFixtureTransport`).
Nothing here is *Verified against real Frappe*. Native behaviour is traced from Frappe 15.110 source (`apps/serve_fast/docs/frappe-components/13`);
points not traced are **UNVERIFIED**. Strings come from the `frappe:list` message block (English and Arabic); logical utilities and tokens only.

---

## 1. `FrappeListView`

```tsx
import { FrappeProvider, FrappeListView, createFrappeClient } from "@solvfast/ui/frappe";

<FrappeProvider client={createFrappeClient()} session={{ user: "a@x.com", roles: ["Sales User"] }}>
  <FrappeListView doctype="Serve Fast Deal" onRowClick={(row) => navigate(String(row.name))} />
</FrappeProvider>
```

Works without a provider too (it creates one with the default same-origin client). Everything not listed below is a `ListView` prop (section 8).

**Needs:** DocTypes read by the user: the DocType itself (`frappe.desk.form.load.getdoctype`), `List View Settings` (optional), `User` (optional, full names),
`Fiscal Year` (optional, ERPNext). **Permissions:** `read` on the DocType; the server applies user permissions and sharing (rows come from `DatabaseQuery`).

| Prop | What it does |
|---|---|
| `doctype` | The DocType. Columns, filter fields, quick filters (`in_standard_filter`), title and search fields, default sort come from its meta. |
| `columns` | Curated `ColumnDef[]` shown first; the DocType's other fields follow (hidden unless `in_list_view`). A curated label also names its field in filters/search. |
| `fieldLabels` | `{ fieldname: string \| {en, ar} }` for generated columns and filter fields (DocField labels arrive untranslated). |
| `baseFilters` | `[field, op, value][]` AND-ed into every request (a scope). Changing them clears the selection. |
| `searchFields` | Default: title field + the DocType's `search_fields` + `name`. Search uses `or_filters` (one list; with "Match any" filters it narrows to the title field and says so). |
| `pageSize` / `pageSizes` / `groupByFields` / `chunkSize` | Page size (default 20). P35: `pageSizes` defaults to Desk's 20 / 100 / 500 / 2500 (`base_list.js:374-418`; `pageSizes={[]}` hides the picker); the choice is kept with the prefs (`user_settings` `List.sf_ui.pageSize` with `serverStorage` — Desk itself keeps no page length). Group-by is opt-in and groups the loaded rows (chunks of `chunkSize`, "Load more"); `_assign` / `_user_tags` group per user / per tag (a row sits in each of its groups), User fields are labelled with full names. |
| `quickFilterFields` | Override the quick-filter fields (`[]` = none; filters stay in the Filter popover). |
| `rowMeta` | Indicator / tags / assignees / comment count / likes columns. Default: offered in the column manager, hidden. `true`: shown. `false`: none. `{ comments: false }` / `{ tags: false }` turns single ones off. The Tags cell shows `_user_tags`; clicking a tag filters by it. |
| `workflow` / `getIndicator` | Inputs of the indicator (section 5). P35: `workflow` defaults to the DocType's active Workflow (`indicatorWorkflowFromMeta`); `workflow={false}` turns it off. |
| `listSettings` | Read List View Settings (default `true`). |
| `columnLimit` / `hideNameColumn` | Desk default columns (Phase 27, section 3) — **on by default in `FrappeListView`** (`columnLimit={false}` opts out), opt-in in `useFrappeList`: without curated `columns`, cap them to List View Settings `total_fields`, else 4 / 6 / 10 slots by window width (≤ 1366 px / default / ≥ 1920 px), following resizes, and append the ID column (`hideNameColumn` turns it off). |
| `treeDoctypes` | Link targets that are trees (nested set): their Link fields offer Descendants Of / Ancestors Of … (section 2). The DocType itself and its child tables are detected from their metas. |
| `urlFilters` | **Opt-in** filters in the page URL, Desk's format (`?status=Open&priority=["!=","Low"]`; section 4a): `true`, or `{ read, write, routeOptions? }`. |
| `formatContext` | `FormatContext` for `formatValue` (number/date formats, currencies). Default: the provider's `formatContext`. |
| `bulk` | Bulk actions (section 6). Turns `selectable` on. |
| `selectionMode` / `primaryAction` | 0.4.1: `"header"` = Desk's own selection layout (`list_view.js:590-598, 1613-1634`) and the design system's intended one: no bar row — the header shows "{n} items selected" + Clear, and `primaryAction` (or the built-in "Add {DocType}") gives way to an **Actions** menu with the `bulk` actions in Desk's order, the workflow's actions appended (asked on every opening) and Assign To as Desk's dialog (`AssignDialog`: Assign to me, users, Complete By, Priority, Comment → `add_multiple`). The **default is still `"bar"`** (a bulk bar above the table, 0.4.x; changing the default is an open owner decision). `useFrappeBulkActions` returns the same actions as data. |
| `selectAllMatching` | P35, header mode: once the page is fully checked the header offers "Select all {n} matching" (section 6). |
| `serverStorage` | Saved filters and user settings on the server (section 4). |
| `realtime` / `realtimeDebounceMs` | Reload on `list_update` (section 7). |
| `create` | P35: Desk's "Add {DocType}" (`list_view.js:279-296`) as the primary action, **only with the create right** (level-0 `create` from `session.roles`; unknown roles → hidden, rule 9). `{ label?, onCreate?, render? }`: `render({ open, onOpenChange, onCreated })` is a dialog the list opens (e.g. a Quick Entry); `onCreated(doc)` reloads the list (`invalidateFrappeList`) and closes it. `false` = never (no empty-state create either). An app `primaryAction` still wins. **P35 integration:** without `render` / `onCreate` (and no `onCreate` prop) the dialog is `FrappeQuickEntry` for a Quick Entry eligible DocType (`quickEntryFields(meta).eligible`); for any other DocType "Add" calls `create.onOpenFullForm(newDoc)` (the host's full-form route; also Quick Entry's "Edit Full Form"); without it the Quick Entry dialog shows the whole form. `create.defaults` = new-document defaults. |
| `onQueryStateChange` | P35 integration: `(state: ListQueryState) => void` — the applied filters, sort, search and page after each change (e.g. to carry them into another view; `FrappeViews` does). |
| `sidebar` | P35, opt-in: Desk's list sidebar (section 5a) — group-by counts from the server and tag stats; adds "Toggle Sidebar" to the menu. |
| `onNavigate` | P35: where menu entries navigate (`(url, entry)`), default `location.assign(url)` — Import (without `onImport`), User Permissions, Role Permissions Manager, Customize. |
| `onImport` / `menu` / `ioLabels` | The list's "⋯" menu: **Import** (when `canImport`: DocType `allow_import` and System Manager or the level-0 `import` right, as Desk's `list_view.js:1703`) and **Export** (always, as Desk — the server refuses without the right). `onImport` replaces the default navigation to Desk's Data Import **list** filtered on the DocType (`/app/data-import?reference_doctype=…`, Desk's `set_route("list","data-import",{reference_doctype})`). `menu={{ import: false }}` / `{ export: false }` / `false` hides entries; `menu={{ reportExport: true }}` adds the opt-in "Export as report" (`export_query`, gated by `canExport` — Desk's List View has no such entry, Phase 27.5); `ioLabels` localizes them and the Export dialog (English by default). Section 6a. P35: for System Managers (the Administrator user included) the menu also has **User Permissions** (`/app/user-permission?allow=<doctype>`), **Role Permissions Manager** (`/app/permission-manager?doctype=<doctype>`), **Customize** (`/app/customize-form?doc_type=<doctype>`, or `/app/doctype/<doctype>` for a custom DocType) and **List Settings** (section 3), as `list_view.js:1714-1785`; `menu={{ userPermissions: false }}` etc. turns one off. Desk gates Customize on creating Custom Field + Property Setter, which stock Frappe grants to System Manager / Administrator only. |
| `onCreate` | Offers "Create your first {DocType}" in the empty list — P35: **only with the create right** (before 0.7 it was offered to everyone, although the prop doc said otherwise). Empty states follow Desk (`list_view.js:497-537`): "You haven't created a {DocType} yet" (+ the create action) when nothing exists; "No {DocType} found with matching filters" (+ Clear filters) when filters or search hide everything. |
| `belowToolbar` | A node between the toolbar and the table (e.g. state chips). |
| `rowKey`, `client`, `fiscalYears`, `storage`, … | `rowKey` default `row.name`. It is the UI identity (selection, kept across pages); every server request (bulk actions, Export, workflow) uses the document `name`, resolved through `documentNamesForKeys` (0.4.0-dev.34). `storage` (explicit) wins over `serverStorage`. |

**Errors.** A failed request renders `FrappeErrorState` in the table area: the server's own message and one action per error kind. Retry only for network, server, rate-limited and unavailable errors; a 403 (permission), not found, validation, duplicate, mandatory, link or too-large error has no action, because retrying cannot succeed. *Changed from 0.3.0, which offered Retry on every error (its F29 test now expects none on a 403).*

**Subject first.** Without curated `columns`, the title field (else the ID) is always the first, visible column, as in Desk. Curated columns keep full control.

*Phase 27:* `columnLimit` (default **on** in `FrappeListView`, as Desk; `columnLimit={false}` opts out), `hideNameColumn`,
`treeDoctypes` and `urlFilters` are `useFrappeList` options that `FrappeListView` forwards. The Report-view export (section 6b) is
a dialog + functions; `FrappeListView` shows it only with `menu={{ reportExport: true }}`.

**Cells.** Int, Float, Percent, Currency, Date, Datetime and Time cells without a custom `render` go through `formatValue` (docs 12 §9), never wrapping
(`whitespace-nowrap`, tabular numerals). A Currency column's currency field (its `options`) is requested with the rows. User columns (`owner`,
`modified_by`, Link → `User`) show the full name: `user_info` of the response (assignees only), then a best-effort `User` lookup, then the id.

**Hooks.** `useFrappeList(options)` returns the props for `ListView`; `useFrappeMeta(doctype)` returns the list meta (`meta`, `bundle` as a `MetaBundle`, `userSettings`).
`invalidateFrappeList(queryClient, doctype?)` reloads lists and counts after the app writes. Query keys: `["sf-frappe","list"|"count"|"list-meta"|"list-settings", doctype, …]`.

---

## 2. The requests

Rows: **`frappe.desk.reportview.get`** (not `frappe.client.get_list`; the generic client `getList` stays on `get_list`). Only `reportview.get` supports
`with_comment_count` and returns `user_info` for assignee avatars. Arguments:

```
doctype, fields (JSON), filters (JSON), or_filters (JSON), order_by, start, page_length,
view: "List", with_comment_count: 1 | 0, [group_by]
```

- **Fields:** `name` + the visible columns' fields (+ fields a column renders from, `metaFields`) + Desk's standard row fields
  `docstatus, owner, modified, _assign, _comments, _liked_by, _user_tags` + what the indicator reads (`status`, `enabled`, workflow state field)
  + Currency companions. Unknown fields are dropped (Frappe rejects a whole request on one).
- **`order_by`:** the column's field, plus Desk's tie-break `, name <dir>` unless the field is `name`, `creation` or `modified`.
- **Child-table filters:** a condition on `Child DocType.field` is sent as `[child, field, op, value]`; the request then joins the child table:
  fields fully quoted (`` `tabDT`.`f` ``), `group_by` the parent name, and the count uses `distinct`.
- **Nested-set operators** (Phase 27): on a Link field whose target is a tree, the filter also offers Descendants Of, Descendants Of
  (inclusive), Not Descendants Of, Ancestors Of, Not Ancestors Of (Desk: `filter.js:32-36`, shown only for
  `frappe.boot.nested_set_doctypes`, `:440-446`). The value is one node (Link picker); the condition is sent unchanged —
  `["parent_task", "descendants of (inclusive)", "TASK-1"]` — and the server expands it from `lft` / `rgt` (`db_query.py:794-842`).
  Tree targets: the DocType and its child tables when their meta has an `lft` field or `is_tree` (Desk's own boot rule,
  `boot.py:70-72`), plus `treeDoctypes` (a React page has no boot list). Generic model: `FilterField.tree`, `NESTED_SET_OPERATORS`;
  a client-mode list cannot evaluate them (the condition filters nothing there). Labels: Frappe's English and Arabic until the
  catalogue has `opDescendantsOf` … (`operatorLabel`).
- **Response:** compressed `{ keys, values, user_info }`, or `[]` for no rows. `decodeReportview(res)` expands it; `reportviewGet(client, doctype, args)` is the call.
- **Count:** `frappe.desk.reportview.get_count` with `limit: 1001` (`COUNT_UPPER_BOUND`). At the bound the footer reads **"1,000+"**; clicking it counts exactly
  (no limit). While the count is capped, "next page" stays on as long as a page comes back full. List View Settings `disable_count` skips the count entirely.

```ts
import { reportviewGet, reportviewCount } from "@solvfast/ui/frappe";
const { rows, userInfo } = await reportviewGet(client, "ToDo", { fields: ["name", "status", "_assign"], order_by: "modified desc", limit_page_length: 20 });
const { count, capped } = await reportviewCount(client, "ToDo", { filters: [["status", "=", "Open"]], limit: 1001 });
```

---

## 3. List View Settings

`frappe.desk.listview.get_list_settings` is read (whitelisted, no permission check; answers `null` when none exists or the call fails — the list works without it).
Honoured: `disable_count`, `disable_comment_count` (no `with_comment_count`, no comments column), `disable_auto_refresh` (no realtime),
`total_fields` and `fields` (JSON `[{fieldname}]`: the title column first, then those in order; `status_field` is the indicator; at most `total_fields` visible;
the rest stay in the column manager), `allow_edit` (bulk Edit/Delete with a workflow), `disable_sidebar_stats` (no tag stats in the sidebar). **The user's own column choice still wins.**

**Writing them (P35, SIMULATED only).** The menu's **List Settings** (System Managers, `list_view.js:1772-1785`) opens `FrappeListSettingsDialog` (Desk's
`list_settings.js`): the fields in order (subject first and fixed, `status_field` not removable), "Maximum Number of Fields", Add field, and the checks.
Save → `frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings(doctype, listview_settings, removed_listview_fields)`
(`list_view_settings.py:29-46`, which also flips `in_list_view` through Property Setters); the list then uses the saved row from the response (Desk's
`refresh_columns`) and reloads the meta. Not exercised on a real site (a write).

`fetchListSettings(client, doctype)` and `applyColumnSettings(columns, settings, titleField)` are exported.

**Desk's default columns (`columnLimit`, Phase 27; default on in `FrappeListView`, opt-in in `useFrappeList`).** Desk caps `this.columns` with `slice(0, total_fields || width)`
where width = 4 at `innerWidth <= 1366`, 10 at `>= 1920`, else 6 (`list_view.js:433-444`). What counts, in order:

| Slot | Desk (`list_view.js`) | Package (`capDefaultColumns`) |
|---|---|---|
| 1 | Subject: title field, else ID (`:381-395`) | the subject column — always shown |
| 2 | Tag (`:396-399`) — always in the list, rendered hidden (`:709`, `:799-809`) | an empty slot (the package's Tags cell is a row-metadata column, uncounted) |
| 3 | Status, when `frappe.has_indicator` (`:401-407`); with List View Settings `fields`, only if they list `status_field` | the indicator column when shown; otherwise the `status` field column (Desk drops `status` when it has an indicator, `:414-416`); otherwise an empty slot |
| 4… | `in_list_view` fields (not virtual, not the title), or List View Settings `fields` in their order | the other visible columns, in order |
| after the cap | ID, when `title_field` is set and is not `name` and `hide_name_column` is off (`:446-457`) | the `name` column, shown after the last kept column (`hideNameColumn` turns it off) |

Never counted: assignees, comment count, likes (Desk draws them in the row's activity area, not as columns). So a 1366 px
window shows the subject + 2 columns (+ ID); 1600 px: + 4; 1920 px: + 8. `total_fields` wins over the width. The cap
follows the window across the 1366 / 1920 bounds (Desk computes it once per setup); without a window (SSR, hydration) it
is 6. Only generated columns are capped: curated `columns` are not. The user's own column choice still wins (the list
follows a changed default only until the user picks columns). Exported: `deskColumnLimit(width)`, `capDefaultColumns(columns, options)`.

---

## 4. Saved filters and user settings (server-backed storage)

```tsx
<FrappeListView doctype="ToDo" serverStorage={{ user: "a@x.com" }} />          // both
<FrappeListView doctype="ToDo" serverStorage={{ userSettings: true, savedFilters: false }} />
```

Adapters for the generic list's `storage` prop (also usable alone):

| Adapter | Backend | Notes |
|---|---|---|
| `createFrappeSavedFilters(client, { user, meta, global? })` → `SavedFiltersStorage` | `List Filter` rows: `frappe.client.get_list` (mine + global: `for_user` = user or empty), `frappe.client.insert`, `frappe.client.delete` | Filters are stored as Desk's 4-tuples `[doctype, field, op, value]`, so Desk can load them. **AND only:** an OR query is refused (`UnstorableQueryError`). Duplicate names are rejected. P35: `save(viewKey, label, query, { global: true })` stores `for_user = ""` per save — the list's **Is Global** checkbox, offered to System Managers / the Administrator only (`list_filter.js:6, 40-46`; `ListView savedFiltersGlobal`, which `FrappeListView` sets from the session); listed filters carry `global` (a globe marker). The adapter-wide `global: true` option (0.6.0) still makes every save global. `List Filter` is readable by every Desk User (personal vs shared is a client-side split in Desk too). |
| `createFrappeUserSettings(client, { doctype, initial, meta })` → `ListPrefsStorage` | `user_settings` from `getdoctype`; saved with `frappe.model.utils.user_settings.save(doctype, user_settings)` (500 ms debounce, skipped when unchanged) | Sort and filters use Desk's keys (`List.sort_by`, `List.sort_order`, `List.filters`); the package's extras (columns, quick filters, group-by, P35 page size) live in `List.sf_ui`. Restores the filters on load (`persistQuery`). |

`tuplesToQuery` / `queryToTuples` convert between the two models (nested-set operators included); tuples on unknown fields or unsupported operators are dropped (as Desk drops invalid saved filters).
**UNVERIFIED:** that Desk's deep merge keeps the `sf_ui` key.

**Saved-filter UI (Core `SavedFilters`, P35).** Removing asks first ("Are you sure you want to remove the {name} filter?", `list_filter.js:104-117`); a
name that already exists shows "Duplicate Filter Name" and cannot be saved (`list_filter.js:127, 135-137`). The localStorage adapter now **rejects** a
duplicate name like the Frappe adapter (before 0.7 it silently replaced the old filter).

### 4a. URL filters (`urlFilters`, opt-in, Phase 27)

Desk's list routes carry the filters in the query string (`list_view.js:2130-2183` read, `:1664-1696` write):
`/app/todo?status=Open&priority=["!=","Low"]&Order Item.item_code=X`. With `urlFilters`:

- **read** (once the meta is loaded): every `key=value` pair is a filter — Equals, or `["op", value]` JSON; a repeated key gives one filter per
  value; `Child DocType.field` or a bare child-table field (resolved like Desk's `get_doctype_for_field`). The URL's filters replace the restored
  ones (Desk does the same, `:559-571`) through the new generic `initialQuery` option. **Keys that are not fields of the DocType (or of a loaded
  child table) are ignored** and reported in `useFrappeList().urlFilters.ignored` — never sent to the server as a fieldname; values are always values;
  unparsable JSON and operators the list cannot show are ignored. `routeOptions` (Desk's `frappe.route_options`) is read when the query string is empty.
- **write**: after every applied change, `history.replaceState` (no history entry) with Desk's format (`=` raw, else `JSON.stringify([op, value])`).
  Other query parameters are kept (Desk replaces the whole string). An OR query cannot be written — its filter parameters are removed. Search text and sort are not written.
  `replaceState` fires no `popstate`: a router hook reading the search string (e.g. React Router's `useSearchParams`) sees the change at its next navigation (Desk has the same property).
- Never on the server (no `window`). Functions: `parseUrlFilters(search | URLSearchParams | route_options, meta)`, `filtersToUrl(query, meta, currentSearch)`.

---

## 5. Indicator (status pill)

`rowMeta` adds a status column per `frappe.get_indicator`. One implementation serves list rows and form docs: **`resolveIndicator`** in `src/frappe/services/indicator.ts`
(`indicatorFor` in the record layer and `getIndicator` in the list layer are thin adapters). First match wins:

1. `__unsaved` → "Not Saved", orange (forms only)
2. workflow state, when the DocType has a workflow that does not `override_status` (or `showWorkflowState`) and the state is not in `avoid_status_override`; colour from the Workflow State `style` (Success green, Warning orange, Danger red, Primary blue, Inverse black, Info light-blue; none → gray)
3. submittable and docstatus 0 → Draft (red)  4. docstatus 2 → Cancelled (red) (switched off by `has_indicator_for_draft/cancelled`)
5. `meta.states` row titled like `status` (its colour)  6. the app hook (`getIndicator`)
7. submittable and docstatus 1 → Submitted (blue)
8. `status` value coloured by `guess_colour` (substring, case-sensitive: Pending/Review/Medium → orange; Open/Urgent/High/Failed/Rejected/Error → red; Closed/Completed/Approved/Paid/Active… → green; Submitted → blue; else gray)
9. `enabled`  10. `disabled`

The column appears when the DocType has an indicator (`hasIndicator`: submittable, workflow, hook, `enabled`/`disabled`, or `status` with `meta.states`). Clicking a pill filters by
its value. With `columnLimit`, a DocType with an indicator spends Desk's Status slot (section 3) whether or not the column is shown. One colour table maps every vocabulary (`colourTone`, `styleTone`, `toListTone`, `feedbackTone`).

```tsx
<FrappeListView doctype="Sales Order" rowMeta
  workflow={{ stateField: "workflow_state", styles: { Approved: "Success", Rejected: "Danger" } }} />
```

**Workflow (P35).** By default the workflow comes from the DocType: getdoctype's `__workflow_docs` (`indicatorWorkflowFromMeta`, as Desk's
`frappe.workflow.setup`, `model/workflow.js:10-21`) — state field, Workflow State styles, `override_status`, `avoid_status_override` — and the state
field is requested with the rows. A `workflow` prop overrides it; `workflow={false}` drops it.

---

## 5a. Assigned To, Tags and the group-by sidebar (P35)

- **Filter fields.** Desk's std fields "Assigned To" (`_assign`) and "Tags" (`_user_tags`) are filter fields (`model.js:120-137`) with only
  `like` / `not like` / `is` (`FilterField.operators`), the value picked from User / Tag; a condition is sent as `["_assign", "like", "%user%"]`.
- **Grouping.** `groupByFields={["_assign", "_user_tags", "owner"]}`: one group per user / tag (Core `GroupByOption.groupOf` may return several
  buckets; selection stays keyed by the row), rows without a value under "Not Set" / "No Tags", User fields labelled with full names.
- **Sidebar** (`sidebar`, opt-in; Core `GroupBySidebar` in `ListView`'s `aside`): "Assigned To", "Created By" and `user_settings.group_by_fields`
  (or `sidebar.fields`) with counts from `frappe.desk.listview.get_group_by_count(doctype, current_filters, field)` (`listview.py:33-89`; the
  field's own condition removed first, zero counts / Guest / Administrator dropped, the session user first as "Me", `list_sidebar_group_by.js:163-188`),
  and tag stats from `frappe.desk.reportview.get_sidebar_stats` (`reportview.py:623-696`) unless `disable_sidebar_stats`. A value filters the list
  (`_assign like %u%`, `= v`, "Not Set" → `is not set`; a tag → `_user_tags like %tag%`, "No Tags" → `not like %,%`); the applied value again removes it.
  "Toggle Sidebar" in the menu. Counts ignore an OR query (the method takes AND filters only). SIMULATED handlers only; no real-site evidence.
  Hooks: `useGroupByCounts`, `useTagStats`; component `FrappeGroupBySidebar`.

---

## 6. Bulk actions

```tsx
<FrappeListView doctype="ToDo" bulk={{}} />                                   // gates from usePermissions
<FrappeListView doctype="ToDo" bulk={{ permissions: { read: true, delete: true }, only: ["delete"] }} />   // explicit override
<FrappeListView doctype="Sales Invoice" bulk={{ print: { settings: boot.print_settings, subscribeTask } }} />  // Print Settings from your boot
```

Desk's Actions menu (`list_view.js:1855-2128`) — with `selectionMode="header"` as Desk's **Actions** dropdown in the toolbar (the header shows
"{n} items selected"; no extra row), with the default `"bar"` as buttons in a selection bar above the table (sticky, so it never scrolls away) — **in Desk's
order** (`:2088-2128`, workflow last `:163-168`). The gate is `usePermissions(bundle).can()` (session roles + the DocType's permissions); the `permissions` prop
(a rights map or `can(ptype)`) overrides it. **No rights → no actions** (Export excepted, as in Desk). Phase 27 (SIMULATED tests only: `tests/list-actions.test.tsx`).

| Action | Shown when | Endpoint |
|---|---|---|
| Edit | an editable field exists, `write`, and no workflow (or `allow_edit`) | `frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs` (`action: "update"`, `data: {field: value}`). P35: the value is the field's own control (`BulkEditValue`: Select, Check, Link search, Date, Datetime, Time, number, text — `bulk_operations.js:381-404`); empty → `null` with Desk's "You have not entered a value" note; numbers are sent as numbers. |
| Export | always (Desk, `:2092`; section 6a) | opens the Export dialog on the checked names |
| Assign to | `read` (Desk offers it to everyone, `list_view.js:2095`; the server requires read on each document, `assign_to.py:67-68`) | `frappe.desk.form.assign_to.add_multiple` (`bulk_assign`, `re_assign`); user picked with `AssignPicker` (searches `search_link` on `User`) with comment, due date, priority |
| Clear Assignment | `read` (Desk: everyone, `:2097`) — confirms with Desk's "Are you sure you want to clear the assignments?" | `frappe.desk.form.assign_to.remove_multiple` (`names`, and Desk's `ignore_permissions: true` — the server then checks no permission; at most 5 open assignments per document are cancelled, `assign_to.py:25-38, 182-192`) |
| Apply Assignment Rule | `read` (Desk: everyone, `:2099`); no confirmation | `frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply` (more than 5 → one background job per document; no rule → nothing happens) |
| Add Tags | `read` (Desk: everyone, `:2101`) — dialog with `TagInput` over `search_link` on `Tag`; a new tag is accepted (the server creates the Tag) | `frappe.desk.doctype.tag.tag.add_tags` (`tags`, `dt`, `docs`) |
| Print | level-0 `print` (`frappe.model.can_print`, `model.js:452-455`) | see below |
| Submit / Cancel | submittable, `submit` / `cancel`, no workflow | `submit_cancel_or_update_docs`, `action: "submit"` / `"cancel"` |
| Delete | `delete`, and no workflow (or `allow_edit`) | `frappe.desk.reportview.delete_items` (more than 10 are enqueued by the server) |
| Workflow ▾ | the DocType has an active Workflow (`__workflow_docs`; `bulk.hasWorkflow` overrides) and `read` | each opening asks `frappe.model.workflow.get_common_transition_actions` (the checked rows, owner included) and lists the server's answer (none → nothing to run); an action → `frappe.model.workflow.bulk_workflow_approval` (< 20 in the request, 20–500 enqueued, > 500 refused by the server) |

**Print** (`list/print.ts`, `list/FrappePrintDialog.tsx`; Desk `bulk_operations.js:7-167`). Before the dialog, Desk's filter (`checkPrintable`): for a submittable DocType only
submitted documents, drafts / cancelled only when Print Settings allow them, anything for the Administrator role; none → "Select at least 1 record"; more
than 500 → refused. **This filter matters:** the server's synchronous path silently leaves out every document it refuses (`print_format.py:145-147`), so a
wrong selection would give a PDF with pages missing, not an error. Desk reads Print Settings from boot; most users cannot read them, so pass them as
`bulk.print.settings` (`allow_print_for_draft`, `allow_print_for_cancelled`, `pdf_page_size`, `enable_raw_printing`); without them the DocType's defaults
apply (drafts allowed, cancelled not). The dialog: Letter Head (`frappe.client.get_list("Letter Head")`, default first, "No Letterhead"), Print Format
(getdoctype's `__print_formats`, "Standard", the DocType's default first; no JS formats; raw formats only with `enable_raw_printing`), Page Size ("Custom" →
height / width in mm, both > 0), Background Print (forced above 25). Sync: `api.download("frappe.utils.print_format.download_multi_pdf", {doctype, name, format,
no_letterhead, letterhead, options})` — the server's PDF handed to the browser (`saveFile`), a refusal shown in the dialog. Background:
`download_multi_pdf_async` → `{task_id}`; the link arrives on realtime `task_complete:<task_id>`, which the contract's `RealtimePort` does not carry — pass
`bulk.print.subscribeTask(taskId, onComplete)` (e.g. over your Socket.IO client) and the dialog offers "Download PDF" with the server's `file_url`; without it
the dialog says the job is queued (the server saves the PDF as a private File) — **NOT REPRODUCED** beyond that.

**Outcome line** (under the list): what the server answered, never more. `submit_cancel_or_update_docs` answers the failed names: "N succeeded, M failed: B, D".
Methods that answer nothing per document — delete, clear assignment, assignment rule, tags, workflow approval — say "Action: N requested — the server reports
failures in its messages" (`listBulkRequested`); an enqueued job says "queued, will run in the background". The list reloads and the selection clears unless
everything failed; a refusal (403 …) shows the server's message and changes nothing. `onDone(kind, outcome, names, action?)` / `onError(error, kind)` report each action.

**Select all matching (P35, `selectAllMatching`, header mode).** Once every row on the page is checked, the header offers "Select all {n} matching".
Then the actions get `ctx.allMatching = { total }`: only actions marked `allMatching: true` run — in `FrappeListView` that is **Export**, which exports by the
list's filters (`by_filter` with the current filters, not names); every other Frappe bulk method takes document names, so those items are shown disabled with
the reason, and the workflow items are hidden. Unchecking a row, Clear, or a query / search change ends it. Desk has no such mode.

Functions: `listActionsMenu` (every item, Desk order), `bulkMenu` (the five dev.26 kinds), `bulkDelete`, `bulkSubmitCancelOrUpdate`, `bulkAssign`,
`bulkClearAssignment`, `bulkApplyAssignmentRule`, `bulkAddTags`, `commonTransitionActions`, `bulkWorkflowApproval`, `workflowDocs`, `checkPrintable`,
`printFormatOptions`, `letterheadOptions`, `pdfOptions`, `downloadMultiPdf`, `downloadMultiPdfAsync`; components `FrappeBulkActions`, `FrappePrintDialog`.
Messages: the `frappe:list` block of `src/theme/messages.ts` (en + ar).

### 6a. Import and Export (Phase 26) — server-authorised, SIMULATED only

Full parity table and verdict: `docs/release/LISTVIEW-FRAPPE-PARITY.md` (repository only). Nothing here has run against a site (Import writes; Export is an unapproved read).

**Gates.** Import: `canImport(meta, roles, levels[0])` (`services/permissions.ts`, Desk's `model.js:434-442`) — `allow_import` AND (System Manager OR
level-0 `import`); needs `session.roles` (without them Import is not offered). Import is a DocType-level right: never read it off a document's `docinfo`
(the server forces it to 0). **Export has no client gate** — Desk pushes it unconditionally (`list_view.js:2075-2092`) and so does the package (Phase 27
owner decision #1, reversing Phase 26 rule D.1). A user without the right can open the dialog; the server refuses (`exporter.py:116-126` `can_export`) and
the dialog shows the refusal as `FrappeErrorState` (kind permission) — no file, no success. `canExport(roles, levels[0])` (System Manager OR level-0
`export`) stays exported for an app that prefers to hide the entry: `menu={{ export: canExport(roles, levels[0]) }}`. The server decides either way
(`exporter.py:116-126`, `data_import.py:59-75`).

**Export** (`list/export.ts`, `list/FrappeExportDialog.tsx`): Desk's Data Exporter dialog (`data_exporter.js`) — file type Excel / CSV, export type All /
Filtered (the list's current filters) / Selected (`[doctype, "name", "in", names]` from the selection bar, `bulk_operations.js:463-474`) / 5 records / Blank
template, field groups per DocType and child table (child groups keyed by the **table fieldname**, `exporter.py:63-67`) with Select All / Select Mandatory /
Unselect All; fields the user cannot read (permlevel) are not offered. The file comes from the server — `api.download("…data_import.download_template",
{doctype, file_type, export_records, export_fields, export_filters})`, objects JSON-encoded as Desk's `open_url_post` form does — and is handed to the
browser (`saveFile`). A refusal is shown in the dialog (`FrappeErrorState`); there is no success toast and never a client-built file.
Functions: `downloadExportTemplate`, `exportPickerGroups`, `mandatorySelection`, `selectedNamesFilter`, `saveFile`.

**Import** (`list/import.ts`, `list/FrappeDataImport.tsx`, `list/ImportPreview.tsx`, `list/ColumnMapping.tsx`, `list/importMapping.ts`; Phase 27 UI) —
SIMULATED only; every step is a write on a site (BLOCKED). The functions reproduce the Data Import tool's client sequence (`data_import.js`, `attach.js:137-144`):
`startDataImport(api, { referenceDoctype, importType, file, filename, submitAfterImport?, muteEmails?, start? })` = `createDataImport` (`savedocs`, new Data Import)
→ `attachImportFile` (`upload_file` attached to it, private → `savedocs` with `import_file`; the server parses the file here) → `get_preview_from_template` →
`form_start_import`. `remapImportColumns(api, doc, changed)` = `saveColumnMapping` (`template_options.column_to_field_map`, keyed by FILE column index) + the preview
requested again (`data_import.js:302-309`). `useImportStatus(api, name, { since })` polls `get_import_status` + the document; `importRunning` decides from the server's
answers only (unchanged `modified` since Start → queued; mid-run Partial Success → running). Also `getImportLogs`, `downloadErroredRows`, `downloadImportLog`,
`downloadImportTemplate`, `parseTemplateWarnings`.

`<FrappeDataImport>` is what an app opens from `FrappeListView`'s `onImport` (whose default still routes to Desk). It needs `ThemeProvider` and a
`QueryClientProvider` (no `FrappeProvider`; `api` is a prop):

```tsx
const [open, setOpen] = useState(false);
<FrappeListView doctype="Sales Order" onImport={() => setOpen(true)} />
<FrappeDataImport api={api} doctype="Sales Order" open={open} onOpenChange={setOpen}
  onGoToList={() => setOpen(false)} docHref={(dt, name) => `/orders/${name}`} />
```

Steps: **Upload** (import type, Submit After Import for submittable DocTypes, Don't Send Emails, "Download Template" = the exporter dialog, a `.csv / .xls / .xlsx`
file) → **Preview** (`FrappeImportPreview`: the server's columns with the field each is matched / mapped to, skipped columns marked, the first rows as returned, "Showing
only first N rows out of M"; `FrappeImportWarnings`: template + preview warnings grouped by row / column; "Map Columns" → `FrappeColumnMapping`, a searchable picker per
column with "Don't Import", the DocType's fields and child-table fields `<table>.<field>`) → **Import** ("Start Import" / "Retry" = `form_start_import`; Queued / In
Progress from the poll) → **Result** (status, the headline from the server's counts, the import log with messages and traceback, Export Errored Rows on Partial Success,
Export Import Log from 5000 rows, Retry, "Go to {DocType} List"). **Nothing is shown as imported before `get_import_status` reports the run finished**; a job stopped by
template warnings returns to the preview with them. Refusals are the server's (`FrappeErrorState`): a 403 on the first save comes with the note that Frappe core grants
Data Import `create` to System Manager only; a refused or empty file can be replaced on the same Data Import; 417 "Scheduler is inactive" on start.

Props that matter: `bundle` (optional — else read with `api.getMetaBundle`), `importType`, `open` / `onOpenChange` (dialog; without them an inline panel), `pollIntervalMs`
(default 2000), `subscribe` (optional `(event, handler) => unsubscribe` over the app's socket: Desk's `data_import_progress` line and an immediate re-poll on
`data_import_refresh`; completion still comes from the poll), `onFinished`, `onGoToList`, `docHref`, `labels` (English and Arabic defaults, `DATA_IMPORT_LABELS_EN` /
`_AR`; the package catalogue has no keys for them yet), `exportLabels`. State lives in the component: closing the dialog keeps the import and its poll; unmounting stops
polling, never the server's job. Not reproduced: Google Sheets URL, "Report Error", changing the import type after the Data Import exists, frappe-datatable features,
re-reading the preview after a run (imported rows are greyed only from a preview answer that carries the log). Parity rows: `docs/release/LISTVIEW-FRAPPE-PARITY.md` (repository only) §2.

---

### 6b. Report-view export (Phase 27) — SIMULATED only; on a site it writes an Access Log (BLOCKED)

Desk's Report view → Export (`report_view.js:1646-1722`, dialog `report_utils.js:173-241`) over
**`frappe.desk.reportview.export_query`**. The server runs the query, checks `can_export` (System Manager, the role's `export`, or `if_owner`
export with every row's owner checked — `permissions.py:608-616`) and streams the file; **it writes an Access Log row first, on every call**
(`reportview.py:410-415`). Desk offers the entry only when `frappe.model.can_export` — use `canExport(session.roles, levels[0])`.

```tsx
const f = useFrappeList({ doctype: "ToDo" });
<FrappeReportExportDialog api={api} doctype="ToDo" open={open} onOpenChange={setOpen} {...f.reportExport!}
  selectedNames={checked} offerTranslate={language !== "en"} />
```

- `downloadReportExport(api, { doctype, fields, filters, or_filters, order_by, fileFormat: "Excel" | "CSV", selectedItems?, title?, pageLength?,
  csvDelimiter?, csvQuoting?, translateValues?, addTotalsRow?, background? })` → `api.download("frappe.desk.reportview.export_query", …)` with
  Desk's fields, non-strings JSON-encoded as Desk's `open_url_post` does (`reportExportArgs`). `selected_items` makes the server REPLACE the filters
  with `name in (…)`; `pageLength` = only the rows shown (Desk's "Export all N rows?" left unchecked).
- Result: `{ kind: "file", file }` (hand it to the browser with `saveFile`) or, for `background`, `{ kind: "background", message }` — an `api.call`
  as Desk's `frappe.call`; the server enqueues the job, e-mails the link and returns no file. A refusal rejects with the `FrappeError` (403 → `kind: "permission"`); no file.
- The dialog: File Format (Excel default), Selected rows (n) / All matching rows, Export in Background, CSV Delimiter / CSV Quoting (CSV), "Export all N rows?"
  (or "…matching rows?" when the count is off), "Translate values" (`offerTranslate`). English labels, `labels` override. No CSV Preview box.
- `useFrappeList().reportExport` = `{ fields (visible columns' real fields, `name` first), filters, or_filters, order_by, shownCount, totalCount }`.
- **Never a client-built file.** In `FrappeListView`'s ⋯ menu only with `menu={{ reportExport: true }}` (opt-in since dev.34).

### 6c. Core `ExportDialog` and `DataImportDialog` (0.5.1-dev, no backend)

The same Export Data dialog and Data Import tool, from the **core** entry, for an app without a Frappe server.
`FrappeExportDialog` renders `ExportDialog`; `FrappeImportPreview` / `FrappeImportWarnings` / `FrappeColumnMapping`
render the Core views (`ImportPreviewTable`, `ImportWarningsPanel`, `ColumnMappingForm`). `FrappeDataImport` keeps its
server orchestration (every step a server request); `DataImportDialog` orchestrates a client-side import.

```tsx
<ExportDialog open={open} onOpenChange={setOpen}
  groups={[{ key: "Contact", label: "Contacts", reqd: true, fields }]}   // fields: { fieldname, label, reqd, mandatory }
  selectedCount={checked.length} counts={{ all: rows.length, by_filter: filtered.length }} lockMandatory
  onExport={async ({ fileType, records, fields }) => saveBlob(new Blob([buildCsv(headers, data)]), "contacts.csv")} />

<DataImportDialog open={open} onOpenChange={setOpen} description="Contacts" adapter={{
  fields: [{ key: "email", label: "Email", mandatory: true, aliases: ["البريد"], validate: (v) => isEmail(v) ? null : "Not a valid email" }],
  parse: async (file) => { const [headers, ...rows] = parseCsv(await file.text()); return { headers, rows }; },
  duplicates: { identity: (row) => row.email?.toLowerCase(), existing: (id) => byEmail.get(id)?.name },
  runUnavailable: "importing needs the backend",          // or run: async ({ rows }, onProgress) => ({ success, failed, errors })
  template: { groups, onExport: writeTemplate },          // "Download Template" → ExportDialog on Blank Template
}} />
```

| | |
|---|---|
| Export states | fields with label, key, "(Mandatory)"; Select All / Select Mandatory / Unselect All; `lockMandatory`; nothing selected → Export disabled + "Select at least one field to export."; loading ("Downloading…"); a rejected `onExport` → the error in the dialog (`renderError`); resolved → closed. |
| Import steps | Upload (Import Type, file, Download Template) → Preview ("{file}: {n} rows, {m} columns", warnings by row / column, counts ready / errors / duplicates, duplicate handling, grid with each column's field, Map Columns) → Import (progress) → Result (the run's counts only). `runUnavailable` → Start Import disabled with the reason, nothing imported, no success. |
| Labels | Export: the catalogue's `export*` keys (en / ar). Import: `DATA_IMPORT_LABELS_EN/AR` + `IMPORT_DIALOG_LABELS_EN/AR`, by the ThemeProvider language; `labels` overrides. |
| XLSX | not in the package (no dependency): read / write it in the host with a spreadsheet library. |

## 7. Realtime refresh

```tsx
<FrappeListView doctype="ToDo" realtime={port} />   // port: RealtimePort (contract.ts) — your Socket.IO adapter
```

On `list_update` for this DocType the list (and count) reload after a quiet period: **2 s, 15 s for `is_large_table`** (`realtimeDebounceMs` overrides). Events are **ignored while rows are selected**
or a bulk action is running, and nothing is replayed afterwards. **No "refresh" prompt** (Desk 15.110 has none). Off when List View Settings `disable_auto_refresh` is set.
UNVERIFIED: Desk re-requests only the changed names and leaves the count alone.

---

## 8. The generic `ListView` (no Frappe)

```tsx
import { ListView, type ColumnDef } from "@solvfast/ui";

<ListView rows={rows} columns={columns} rowKey={(r) => r.id} viewKey="deals" selectable
  bulkActions={[{ key: "x", label: "Archive", run: async (keys) => archive(keys) }]} />
```

`mode="client"` (default) filters, searches, sorts, groups and pages the rows itself; `mode="server"` takes the current page + `total` and calls `onStateChange(state)` (debounced 300 ms)
with the search, filter query, sort, page and visible columns. Props worth knowing: `columns` (`ColumnDef`: `key`, `label`, `field`, `type`, `fieldtype`, `render`, `hidden`, `sortable`, `filterable`, `metaFields`),
`filterFields`, `quickFilterFields`, `groupByOptions`, `rowActions`, `bulkActions` / `renderBulkActions`, `controls`, `toolbarActions`, `belowToolbar`, `emptyMessage`, `loading`/`error`/`onRetry`,
`totalLabel`/`hasMore`/`onTotalClick` (capped or hidden totals), `onSelectionChange`, `storage` (`{ prefs, saved }` adapters; default localStorage), `loadOptions` (link search).
Custom cells can use `useListActions().applyCondition(field, operator, value)` to filter the list they are in (P35: also `removeCondition(field)` and the current `query`).

**P35 additions (all optional; defaults unchanged):** `pageSizes` (the pager's page-length buttons, the choice kept in `ListPrefs.pageSize`;
`useListState().setPageSize`), `aside` / `asideOpen` (a side panel such as `GroupBySidebar`, inside the list's `ListActionsContext`),
`selectAllMatching` (header mode; `useListState().allMatching` / `selectAllMatching()`; `BulkActionContext.allMatching`, `BulkAction.allMatching`;
`run(keys, rows, ctx)` gets the context only for an all-matching selection), `layout="table" | "cards" | "auto"` (one card per row on phones;
`ColumnDef.mobile`: `"primary"` = the card title, `false` = not on the card), `savedFiltersGlobal` (the Is Global checkbox; `SavedFiltersStorage.save`
takes `{ global }`), `GroupByOption.groupOf` returning several buckets, `FilterField.operators`.

**Selection layout (0.4.1).** `selectionMode="bar"` (still the default) shows the bulk bar above the table. `selectionMode="header"` is Frappe Desk's and the layout the design system intends (no separate bulk bar): no extra row; while rows are selected the table header shows "{n} items selected" with a Clear button instead of the column titles, and the toolbar's `primaryAction` (e.g. New) is replaced by an **Actions** menu built from `bulkActions` (+ `renderActionsMenu` items; `onActionsOpenChange`, `actionsLabel`). Shift-click checks a range (Desk `list_view.js:1400-1421`). A `BulkAction` may set `tone: "destructive"`, `hidden(ctx)`, `disabled(ctx)` (a string is the reason shown with the item), `confirm` (AlertDialog first; a function gets the selection) and `group` (a separator between groups); `run(keys, rows)` gets exactly the selected keys (P35: plus `ctx` for an all-matching selection, see above). `ListActionsMenu`, `useBulkActionRunner` and `resolveBulkActions` are exported for custom toolbars. `onSelectionChange` fires on every change of the selected set (0.4.0: only when its size changed).

```tsx
<ListView rows={rows} columns={columns} rowKey={(r) => r.id} selectable selectionMode="header"
  primaryAction={<Button onClick={create}>New</Button>}
  bulkActions={[
    { key: "export", label: "Export", run: (keys) => exportRows(keys) },
    { key: "delete", label: "Delete", tone: "destructive", group: "z", confirm: (c) => ({ title: `Delete ${c.keys.length}?` }), run: (keys) => remove(keys) },
  ]} />
```

---

## 9. Known limitations (not reproduced)

- URL filters are opt-in (`urlFilters`); the width-based column cap is on by default in `FrappeListView` but opt-in in `useFrappeList` (`columnLimit`). The default 90-day recency filter on large tables (`disable_automatic_recency_filters`) is not reproduced.
- Nested-set operators need the app to name tree Link targets the page has no meta for (`treeDoctypes`); they filter nothing in client mode.
- Sidebar (P35): opt-in; the "Edit" dialog for `user_settings.group_by_fields` (Desk's `make_group_by_fields_modal`) is not reproduced (the app passes `sidebar.fields`); counts ignore OR queries; "assigned to me" counters are not reproduced.
- URL filters: the package keeps non-filter query parameters (Desk replaces the whole string); OR queries, search text and sort are not written.
- Selection: the default is still `"bar"`; `selectionMode="header"` gives Desk's Actions dropdown. "Select all matching" can run only query-based actions (Export in `FrappeListView`). Print's background completion (`task_complete`) needs a host `subscribeTask`, and its draft / cancelled filter needs the site's Print Settings from the host.
- Views: the Report view itself, Kanban, Calendar and the other Desk views are not part of this layer; report-view export (`export_query`) is available as `downloadReportExport` / `FrappeReportExportDialog`.
- Create: the package draws "Add {DocType}"; the dialog behind it is the app's (`create.render`), a route (`create.onCreate`), or by default `FrappeQuickEntry` / `create.onOpenFullForm` (P35 integration).
- Import: progress is polled, not realtime (the preview, column mapping and log are `FrappeDataImport`'s, section 6a).
- Export: the in-dialog filter editor and record-count message.
- Permlevel columns are dropped only when the session's roles are known; without them the header of an unreadable field is still offered (the server strips the values).
- Saved filters cannot store OR conjunctions. Realtime is a full reload, not Desk's by-name refresh. "Edit DocType" (System Manager + developer mode) is not in the menu (the session carries no `developer_mode`).
- Owner columns resolve names through a `User` read; a site that hides the User list shows ids.
- Simulated only: all behaviour above is tested against recorded shapes and the fixture transport, never a live site. New P35 server calls (`get_group_by_count`, `get_sidebar_stats`, `save_listview_settings`) have SIMULATED handlers only.
