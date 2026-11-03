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
| `pageSize` / `groupByFields` / `chunkSize` | Page size (default 20). Group-by is opt-in and groups the loaded rows (chunks of `chunkSize`, "Load more"). |
| `quickFilterFields` | Override the quick-filter fields (`[]` = none; filters stay in the Filter popover). |
| `rowMeta` | Indicator / assignees / comment count / likes columns. Default: offered in the column manager, hidden. `true`: shown. `false`: none. `{ comments: false }` turns single ones off. |
| `workflow` / `getIndicator` | Inputs of the indicator (section 5). |
| `listSettings` | Read List View Settings (default `true`). |
| `formatContext` | `FormatContext` for `formatValue` (number/date formats, currencies). Default: the provider's `formatContext`. |
| `bulk` | Bulk actions (section 6). Turns `selectable` on. |
| `serverStorage` | Saved filters and user settings on the server (section 4). |
| `realtime` / `realtimeDebounceMs` | Reload on `list_update` (section 7). |
| `onImport` / `menu` / `ioLabels` | The list's "⋯" menu: **Import** (when `canImport`: DocType `allow_import` and System Manager or the level-0 `import` right) and **Export** (when `canExport`). `onImport` replaces the default navigation to Desk's Data Import (`/app/data-import/new?reference_doctype=…`). `menu={{ import: false }}` / `{ export: false }` / `false` hides entries; `ioLabels` localizes them and the Export dialog (English by default). Section 6a. |
| `onCreate` | Offers "Create your first {DocType}" in the empty list. Empty states follow Desk (`list_view.js:497-537`): "You haven't created a {DocType} yet" (+ the create action) when nothing exists; "No {DocType} found with matching filters" (+ Clear filters) when filters or search hide everything. |
| `belowToolbar` | A node between the toolbar and the table (e.g. state chips). |
| `rowKey`, `client`, `fiscalYears`, `storage`, … | `rowKey` default `row.name`. `storage` (explicit) wins over `serverStorage`. |

**Errors.** A failed request renders `FrappeErrorState` in the table area: the server's own message and one action per error kind. Retry only for network, server, rate-limited and unavailable errors; a 403 (permission), not found, validation, duplicate, mandatory, link or too-large error has no action, because retrying cannot succeed. *Changed from 0.3.0, which offered Retry on every error (its F29 test now expects none on a 403).*

**Subject first.** Without curated `columns`, the title field (else the ID) is always the first, visible column, as in Desk. Curated columns keep full control.

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
the rest stay in the column manager), `allow_edit` (bulk Edit/Delete with a workflow). **The user's own column choice still wins.** Writing the settings is a
Desk admin concern (it flips `in_list_view` through Property Setters) and is not reproduced.

`fetchListSettings(client, doctype)` and `applyColumnSettings(columns, settings, titleField)` are exported.

---

## 4. Saved filters and user settings (server-backed storage)

```tsx
<FrappeListView doctype="ToDo" serverStorage={{ user: "a@x.com" }} />          // both
<FrappeListView doctype="ToDo" serverStorage={{ userSettings: true, savedFilters: false }} />
```

Adapters for the generic list's `storage` prop (also usable alone):

| Adapter | Backend | Notes |
|---|---|---|
| `createFrappeSavedFilters(client, { user, meta, global? })` → `SavedFiltersStorage` | `List Filter` rows: `frappe.client.get_list` (mine + global: `for_user` = user or empty), `frappe.client.insert`, `frappe.client.delete` | Filters are stored as Desk's 4-tuples `[doctype, field, op, value]`, so Desk can load them. **AND only:** an OR query is refused (`UnstorableQueryError`). Duplicate names are rejected. `global: true` stores `for_user = ""` (Desk offers it to System Managers). `List Filter` is readable by every Desk User (personal vs shared is a client-side split in Desk too). |
| `createFrappeUserSettings(client, { doctype, initial, meta })` → `ListPrefsStorage` | `user_settings` from `getdoctype`; saved with `frappe.model.utils.user_settings.save(doctype, user_settings)` (500 ms debounce, skipped when unchanged) | Sort and filters use Desk's keys (`List.sort_by`, `List.sort_order`, `List.filters`); the package's extras (columns, quick filters, group-by) live in `List.sf_ui`. Restores the filters on load (`persistQuery`). |

`tuplesToQuery` / `queryToTuples` convert between the two models; tuples on unknown fields or unsupported operators are dropped (as Desk drops invalid saved filters).
**UNVERIFIED:** that Desk's deep merge keeps the `sf_ui` key.

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
its value. One colour table maps every vocabulary (`colourTone`, `styleTone`, `toListTone`, `feedbackTone`).

```tsx
<FrappeListView doctype="Sales Order" rowMeta
  workflow={{ stateField: "workflow_state", styles: { Approved: "Success", Rejected: "Danger" } }} />
```

**Needs:** the `Workflow` is passed in (`workflow` prop); Desk reads it from `frappe.boot`, which a React page does not have (UNVERIFIED how a host should load it).

---

## 6. Bulk actions

```tsx
<FrappeListView doctype="ToDo" bulk={{}} />                                   // gates from usePermissions
<FrappeListView doctype="ToDo" bulk={{ permissions: { read: true, delete: true }, only: ["delete"] }} />   // explicit override
```

Shown in the selection bar, which sits above the table (sticky) so it never scrolls away. The gate is `usePermissions(bundle).can()` (session roles + the DocType's permissions); the `permissions` prop (a rights map or `can(ptype)`) overrides it. **No rights → no actions.**

| Action | Shown when | Endpoint |
|---|---|---|
| Edit | an editable field exists, `write`, and no workflow (or `allow_edit`) | `frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs` (`action: "update"`, `data: {field: value}`) |
| Submit / Cancel | submittable, `submit` / `cancel`, no workflow | same, `action: "submit"` / `"cancel"` |
| Assign to | `read` (Desk offers it to everyone, `list_view.js:2095`; the server requires read on each document, `assign_to.py:67-68`) | `frappe.desk.form.assign_to.add_multiple` (`bulk_assign`, `re_assign`); user picked with `AssignPicker` (searches `search_link` on `User`) with comment, due date, priority |
| Delete | `delete`, and no workflow (or `allow_edit`) | `frappe.desk.reportview.delete_items` (more than 10 are enqueued by the server) |

Destructive actions confirm. The outcome line ("N succeeded, M failed" / "queued, will run in the background") is shown under the list; the list reloads and the selection clears unless
everything failed. For 20–500 submit/cancel documents the server enqueues and answers nothing: treated as *queued* (UNVERIFIED at runtime). `onDone`/`onError` report each action.
Delete (`delete_items`) answers nothing — failures arrive as a realtime msgprint (`reportview.py:608-616`) — so the bar says "N requested — the server reports
failures in its messages" and never "0 failed". When the server answers with failed names (`submit_cancel_or_update_docs`), the line reads "N succeeded, M failed: B, D" — the server's names, never a plain
success line; a 403 shows the server's message and changes nothing (no reload, no cache change).
**Not offered:** Print, Clear Assignment, Apply Assignment Rule, Add Tags, workflow bulk approval. **Export** is in the selection bar (section 6a).

Functions: `bulkMenu`, `bulkDelete`, `bulkSubmitCancelOrUpdate`, `bulkAssign`; component `FrappeBulkActions`.

### 6a. Import and Export (Phase 26) — server-authorised, SIMULATED only

Full parity table and verdict: `docs/release/LISTVIEW-FRAPPE-PARITY.md`. Nothing here has run against a site (Import writes; Export is an unapproved read).

**Gates** (`services/permissions.ts`, Desk's `model.js:434-450`): `canImport(meta, roles, levels[0])` — `allow_import` AND (System Manager OR level-0 `import`);
`canExport(roles, levels[0])` — System Manager OR level-0 `export`. Both need `session.roles`; without them nothing is offered. Import is a DocType-level right:
never read it off a document's `docinfo` (the server forces it to 0). **Departure from Desk:** Desk's list shows Export to everyone (`list_view.js:2092`) and
lets the server refuse; the package hides it (Phase 26 rule D.1). The server decides either way (`exporter.py:116-126`, `data_import.py:59-75`).

**Export** (`list/export.ts`, `list/FrappeExportDialog.tsx`): Desk's Data Exporter dialog (`data_exporter.js`) — file type Excel / CSV, export type All /
Filtered (the list's current filters) / Selected (`[doctype, "name", "in", names]` from the selection bar, `bulk_operations.js:463-474`) / 5 records / Blank
template, field groups per DocType and child table (child groups keyed by the **table fieldname**, `exporter.py:63-67`) with Select All / Select Mandatory /
Unselect All; fields the user cannot read (permlevel) are not offered. The file comes from the server — `api.download("…data_import.download_template",
{doctype, file_type, export_records, export_fields, export_filters})`, objects JSON-encoded as Desk's `open_url_post` form does — and is handed to the
browser (`saveFile`). A refusal is shown in the dialog (`FrappeErrorState`); there is no success toast and never a client-built file.
Functions: `downloadExportTemplate`, `exportPickerGroups`, `mandatorySelection`, `selectedNamesFilter`, `saveFile`.

**Import** (`list/import.ts`): the Data Import tool's client sequence (`data_import.js`, `attach.js:137-144`) as functions — `startDataImport(api, {
referenceDoctype, importType, file, filename, submitAfterImport?, start? })`: `savedocs` (new Data Import) → `upload_file` (attached to it, private) →
`savedocs` with `import_file` (the server parses the template here) → `get_preview_from_template` → `form_start_import`. Then `useImportStatus(api, name)`
polls `get_import_status` (+ the document for `template_warnings`) until the job leaves Pending; `getImportLogs`, `downloadErroredRows`, `downloadImportLog`,
`downloadImportTemplate` (= blank template). **No preview grid, no column mapper, no log table** — the host builds them or routes to Desk (`onImport` default).
Note: the Data Import DocType grants `create` to System Manager only; a role with `import` but not System Manager is refused at the first save (as in Desk).

---

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
Custom cells can use `useListActions().applyCondition(field, operator, value)` to filter the list they are in.

---

## 9. Known limitations (not reproduced)

- Width-based column cap (4/6/10) when `total_fields` is unset; the default 90-day recency filter on large tables; List View Settings editing.
- Nested-set filter operators; filters from the URL query; the group-by sidebar with server counts (`get_group_by_count`), tag stats (`get_sidebar_stats`) and "assigned to me" counters.
- Other bulk actions (section 6: Print, Clear Assignment, Assignment Rule, Add Tags, workflow approval); Report view (incl. its `export_query` export), Kanban, Calendar and the other Desk views (the CRM keeps its own for those).
- Import: the preview grid, column mapper and import-log table of Desk's Data Import form (functions only, section 6a); progress is polled, not realtime.
- Export: the in-dialog filter editor and record-count message; Export hidden without the `export` right where Desk shows it to everyone.
- Permlevel columns are dropped only when the session's roles are known; without them the header of an unreadable field is still offered (the server strips the values).
- Saved filters cannot store OR conjunctions. Realtime is a full reload, not Desk's by-name refresh.
- Owner columns resolve names through a `User` read; a site that hides the User list shows ids.
- Simulated only: all behaviour above is tested against recorded shapes and the fixture transport, never a live site.
