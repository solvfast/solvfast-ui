# Forms — `@solvfast/ui` 0.4.0 (A3)

Generic field controls (core entry `@solvfast/ui`) and Frappe forms (`@solvfast/ui/frappe`). Native behaviour is that
of Frappe 15.110 (`ab7e5ae`) as traced in `apps/serve_fast/docs/frappe-components/11-native-form.md` and
`12-native-controls.md`; section references below (`11 §2.4`, `12 §4`) point there.

**Status (CONTRACT §4).**
- Generic controls are **Implemented**, with unit tests.
- The form engine and the Frappe components are **Simulated & tested**: they ran against `createFixtureTransport` with the real 15.110 metadata in `tests/fixtures/real-15.110` and the QA parity tests in `tests/parity`.
- The CRM's Type fields (`PrerequisiteFieldInput`) are **Integrated with CRM — work copy**.
- Nothing here is *Verified against real Frappe* yet.

Contents: [1. Generic controls](#1-generic-field-controls-core) · [2. FrappeForm / FrappeFormView](#2-frappeform-and-frappeformview) ·
[3. FrappeField](#3-frappefield-and-fieldtype-coverage) · [4. FrappeLinkField](#4-frappelinkfield) ·
[5. FrappeDynamicLinkField](#5-frappedynamiclinkfield) · [6. FrappeChildTable](#6-frappechildtable) ·
[7. FrappeTableMultiSelect](#7-frappetablemultiselect) · [8. The expression evaluator (D-23)](#8-the-expression-evaluator-d-23) ·
[9. formEvents (D-24)](#9-formevents-d-24) · [10. The behaviour engine](#10-the-behaviour-engine-pure-typescript) ·
[11. Known limitations](#11-known-limitations)

---

## 1. Generic field controls (core)

All of them share these rules:

- They are Frappe-free, value in / value out (`value` + `onChange`). They need no DocType, permission or API.
- They are bilingual (EN/AR), work right-to-left (logical CSS, chevrons follow the reading direction), and work in light and dark themes (tokens only).
- They are keyboard operable.
- Text-like controls write on **blur / Enter**, never on each keystroke. Escape reverts the draft.
- Unparsable text is kept and flagged by default (`aria-invalid` plus a screen-reader message). `onUnparsable="clear"` clears it instead, as Desk does.

| Control | Value | What it does |
|---|---|---|
| `NumberInput` | `number \| null` | `kind`: `int` / `float` / `currency` / `percent`. `precision` (Int is always 0). `numberFormat`: any System Settings pattern (`#,###.##`, `#.###,##`, `# ###,##`, `#'###.##`, `#,##,###.##`, …). `rounding`: Banker's (legacy, the default), Banker's, Commercial. It accepts arithmetic (`2*3+1`, evaluated **without eval**) and Arabic digits. `prefix` / `suffix` are visual only: Desk never puts the currency symbol or `%` in the input. `min` / `max` flag the field and never clamp it. |
| `TimeInput` | `"HH:mm:ss"` (or `"HH:mm"` with `withSeconds={false}`) `\| null` | Lenient parsing: `9`, `930`, `9:5`, `9:30 pm`, Arabic digits, `ص`/`م`. `hour12` changes the display only. A **Now** button. No time-zone conversion (Desk applies none to Time). |
| `DurationInput` | seconds `\| null` | One box each for days, hours, minutes and seconds. `hideDays` folds days into hours; `hideSeconds` hides the seconds box. Read-only text comes from `formatDuration` (`1d 2h 3m 4s`, or `0s` when empty). |
| `ReadOnlyValue` | node | How a read-only field shows: text, never an input. `align="end"` for numbers, `multiline`, `href` for links, `emptyText`. |
| `LinkInput` | `string \| null` | A text box that searches (`search(text)`, `debounceMs` default 500). The first result is highlighted. Enter picks it, but only when the typed text appears in the result (Desk's `input_matches_item`). Hand-typed text goes to `onCommitText` on blur. Optional `actions` rows (e.g. "Create a new X"), an `href` open button and a clear (×) button. |
| `TagInput` | `string[]` | Pills with optional search. Chosen values are hidden from the results. × or Backspace removes a pill. Duplicates are dropped. `validate` may reject an entry (silently) or canonicalise it. `allowCreate` adds free text on Enter or comma. |
| `DataGrid<R>` | rows (caller-owned) | An editable table. One row is edited inline at a time. It has a "No." column, row checkboxes with select-all and Delete, Add Row (which jumps to the last page), and per-row Insert Above/Below, Duplicate, Move Up/Down, Delete and Edit Row. Pages hold 50 rows. Required empty cells are marked. Desk's keyboard shortcuts: Ctrl/⌘+↑/↓ inserts above/below, Ctrl/⌘+Shift+↑/↓ inserts at the top/end, Shift+Alt+↓ duplicates, Esc stops editing. `editable={false}`, `canAdd`, `canDelete`. |
| `Rating` | stars `\| null` | A slider whose arrows follow the reading direction, plus Home, End and Delete. Half steps (`allowHalf`). Clicking the current value clears it unless `required`. |
| `ColorInput` | `"#RRGGBB" \| null` | Only `^#[0-9A-F]{6}$` is accepted (a missing `#` is added). A swatch opens the browser's picker. |
| `FieldShell` | — | Label, required star (bold when required, as Desk does), description or error line. |

Helpers exported with them: `parseLocaleNumber`, `formatLocaleNumber`, `roundNumber`, `numberFormatInfo`, `evaluateArithmetic`, `parseTimeText`, `formatTimeText`, `secondsToDuration`, `formatDuration`.

```tsx
import { NumberInput, TimeInput, DataGrid } from "@solvfast/ui";

<NumberInput aria-label="Amount" kind="currency" precision={2} numberFormat="#.###,##" value={amount} onChange={setAmount} />
<TimeInput aria-label="Start" value={start} onChange={setStart} withSeconds={false} />
```

---

## 2. FrappeForm and FrappeFormView

```tsx
import { FrappeProvider, FrappeForm } from "@solvfast/ui/frappe";

<FrappeProvider session={{ user, roles }} formatContext={sysdefaults}>
  <FrappeForm doctype="ToDo" name="TD-0001" events={{ refresh: (frm) => frm.toggleReqd("date", true) }} />
  <FrappeForm doctype="ToDo" newDocDefaults={{ routeOptions: { description: "From the list" } }} onSaved={(d) => navigate(d.name)} />
</FrappeProvider>
```

`FrappeForm` connects `FrappeFormView` to the foundation hooks (`useMetaBundle`, `useDoc`, `usePermissions`, `useSaveDoc`, `useDocAction`) and to A4's workflow layer.
- Without `name`, or with a `new-…` name, it opens a new document using Desk's defaults.
- While loading it shows a skeleton, with a "Loading…" text after 300 ms. On failure it shows `FrappeErrorState` with Retry.
- The title is the title field's value with any HTML stripped (as Desk does), else the name.

`FrappeFormView` is the same form without data fetching. You give it `bundle`, `doc`, `permissions`, `onSave`, and optionally `onCancelDoc`, `onReload`, `getSubmittedLinkedDocs` and `cancelAllLinkedDocs`.

**Main props.**

| Prop | Meaning |
|---|---|
| `events`, `childEvents` | formEvents (§9). |
| `onSaved(doc, action)` | Called after Save, Submit, Update or Cancel succeeds. Route to the new name here. |
| `onDirtyChange(dirty)` | Called when the unsaved state changes. |
| `guardUnload` | Ask before leaving with unsaved changes. Default `true`. |
| `onAmend` / `onAmended` | `onAmend` overrides the amend action. Without it the view makes a local copy (§2 Actions) and calls `onAmended`. |
| `saveDisabled` | Desk's `disable_save`. |
| `workflowActionsShown`, `canCancelWithWorkflow` | `FrappeForm` derives both. |
| `toolbarExtra` | Extra toolbar content. |
| `hideToolbar` | Hide the toolbar. |
| `title` | Title override. |
| `controllerRef` | Receives the `frm` controller. |
| `defaults` | Session user and user defaults for new rows. |

**Layout** (`11 §2.1–2.3`):
- A "Details" tab is inserted when the meta has Tab Breaks and the first field is not one. A first field that is not a Section Break gets an anonymous section. Column Breaks split a section into equal columns.
- A section with no visible field is hidden. A tab is hidden when it is hidden itself, when the user cannot read it, or when it has no visible section. The tab bar disappears when only one tab is left.
- Collapsible sections are closed by default and follow `collapsible_depends_on`. A section is forced open when a required field inside it is empty. This is evaluated at load and after each save; the user's own toggles persist in between.
- New documents with Prompt naming get a "Name" field (`__newname`).

**Display status** (`11 §2.5`):
- It comes from `usePermissions().displayStatus`, which is the `get_field_display_status` ladder plus the control rules (empty read-only fields hidden; read-only grids make their cells read-only).
- On top of that, the form adds the `fetch_from` lock: a fetched field is read-only while its link has a value, unless `fetch_if_empty`.
- A field hidden by `depends_on` never shows.

**Dirty state.** Any change marks the document `__unsaved` and shows the **Not Saved** badge. The badge comes from `resolveIndicator`, in this order: Not Saved → workflow state in its style colour → Draft / Cancelled → `meta.states` → Submitted → status.

**Actions** (`11 §5–7`, `model/actions.ts`). The first rule that matches wins:

| Order | Action | Shown when |
|---|---|---|
| 1 | **Submit** | docstatus 0, saved, clean, submit right, submittable, no workflow. |
| 2 | **Save** | docstatus 0, save not disabled. With a workflow, only when dirty. |
| 3 | **Update** | docstatus 1, dirty, submit right. |
| 4 | **Cancel** | docstatus 1, cancel right. Shown as the secondary button. With a workflow, only when no transition leads to a cancelled state. |
| 5 | **Amend** | docstatus 2, amend right. Disabled when `is_document_amended` returns true. |

The chosen action is then checked again against its own right: Save needs write (or create on a new document), Submit and Update need submit. When there are workflow actions for a clean, saved document, A4's `FrappeWorkflowActions` replaces these buttons.

**How each action runs:**
- **Save**:
  1. A clean document gets "No changes in document" and nothing is sent.
  2. The `validate` and `before_save` events run.
  3. The client mandatory check runs. If fields are missing, a "Missing Fields" dialog opens and the form jumps to the tab of the first missing field.
  4. `savedocs` is called with the whole document, children included and `modified` echoed.
  5. The server's document replaces the local one.
  6. The `after_save` and `refresh` events run.

  A second save while one is running is ignored. Ctrl/⌘+S saves (or updates).
- **Submit**:
  1. A confirmation asks "Permanently Submit {name}?".
  2. The `before_submit` event runs.
  3. The rest follows the Save steps, then `on_submit` runs.
- **Update** skips `validate` and `before_save`.
- **Cancel**:
  1. The pre-flight call `get_submitted_linked_docs` runs. If submitted linked documents exist, they are listed with **Cancel All**, which calls `cancel_all_linked_docs`, then reloads the document and cancels it. When the user cannot cancel every linked DocType (`canCancelAllLinked`, from the session's roles), Desk's explanation replaces the button.
  2. Otherwise a confirmation asks "Permanently Cancel {name}?".
  3. The `before_cancel` event runs.
  4. `desk.form.save.cancel` is called, with the workflow state field and its current value.
  5. The `after_cancel` event runs.
- **Amend**:
  1. The app's `onAmend` runs if given.
  2. Otherwise the view makes a local copy (`amendDoc`: a `copy_doc` of the keys that have a DocField, ignoring `no_copy`, with new child rows, `amended_from` and today's `amendment_date` when that field exists), which needs an `amended_from` field.

**Errors.**
- Server errors are shown with `FrappeErrorState` (one rendering per error kind), and the form stays dirty.
- A **417 TimestampMismatchError** keeps the user's edits on screen and offers **Reload**, which re-reads the document.

**What it needs from the server.**

| Need | Details |
|---|---|
| DocTypes | Any DocType. Workflow, Workflow State and Workflow Action Master if the DocType has a workflow. |
| Load | `frappe.desk.form.load.getdoctype`, `frappe.desk.form.load.getdoc` |
| Save, submit, cancel | `frappe.desk.form.save.savedocs`, `frappe.desk.form.save.cancel` |
| Cancel pre-flight | `frappe.desk.form.linked_with.get_submitted_linked_docs`, `cancel_all_linked_docs` |
| Amend check | `frappe.client.is_document_amended` |
| Links | `frappe.desk.search.search_link`, `frappe.client.validate_link` |
| Workflow | `frappe.model.workflow.get_transitions` / `apply_workflow` (through A4) |
| Rights | read to open; write (create for a new document) to save; submit, cancel and amend for those actions; select or read on Link targets. The server checks all of them again. |

---

## 3. FrappeField and fieldtype coverage

`<FrappeField df value onChange doc parent bundle status />` renders one DocField. Status comes from the form or is passed in. Without one, the dialog rules apply (`12 §1.3`): hidden → nothing, read-only → text. With status **None** nothing renders; with **Read** the value renders as formatted text (`formatValue`, `12 §9`).

Values are written as follows:
- Data-like text: 500 ms after typing stops, and on blur. In a grid cell: on blur only.
- Everything else: on change or blur.

Data fields with options Email, Phone or URL are checked softly: the field is flagged and the server rejects the value on save, as in Desk.

| Fieldtype | Coverage | Notes |
|---|---|---|
| Data, Read Only, Password, Small Text, Text, Long Text | supported | `maxlength` = `length` or 140 (Data / Password / Read Only). A password mask (`*****`) is passed through untouched. |
| Data + options Email / Phone / URL | supported | Soft validation as in Desk. **Name** and **IBAN** options are not validated client-side. |
| Int, Long Int, Float, Currency, Percent | supported | `NumberInput`. Precision: `df.precision` → `currency_precision` / number-format precision (Currency) or `float_precision` (Float, Percent). Number format and rounding come from `FormatContext`. |
| Check, Select | supported | Select options are newline-separated; a blank line is an empty option; labels are translated. |
| Date, Time, Duration, Rating (0…1 fraction), Color | supported | — |
| Datetime | partial | Edited in the browser's time zone; seconds are stored as `:00`. Converting between the system and user zones while editing is UNVERIFIED. The read-only display converts zones through `formatValue`. |
| Text Editor | partial | Stored as sanitized plain HTML. Desk wraps it in a `ql-editor` div, which is a convention, not a contract. No mentions and no image upload. |
| Link, Dynamic Link | supported | §4, §5. |
| Table, Table MultiSelect | supported | §6, §7. |
| HTML, Heading, Button, Image | supported | HTML is sanitized `options`. A Button fires the event named after its fieldname. |
| Code, JSON, HTML Editor, Markdown Editor | partial | Monospace textarea; no syntax editor, no preview. |
| Attach, Attach Image | partial | The file URL is shown and editable. **No upload** (P2: upload is an API not yet built). |
| Phone (fieldtype) | partial | Telephone text box; no country picker. |
| Signature, Geolocation, Barcode, Autocomplete, MultiSelect, MultiCheck, Icon, Date Range | not supported | Falls back to a text box holding the raw stored value. |

---

## 4. FrappeLinkField

```tsx
<FrappeLinkField df={df} value={v} onChange={setV} doc={doc} referenceDoctype="ToDo" query={{ filters: { enabled: 1 } }} />
<FrappeLinkField options="Customer" filters={{ disabled: 0 }} value={v} onChange={setV} aria-label="Customer" />
```

**Search.** It is debounced 500 ms and calls `search_link` with:
- `txt`, `doctype`, and `reference_doctype` (the form's DocType);
- `page_length` = `link_field_results_limit` (10 by default, clamped to 1–50);
- `filters` and `query` when set;
- `ignore_user_permissions` when the DocField has it.

Results show `label`, or the value when there is none. The description shows only when it differs from the value. Duplicate values are merged and their descriptions joined.

**Query resolution order** (`12 §4.4`):
1. `link_filters` (JSON `[[doctype, field, op, value]]`; `eval:` values are evaluated with `doc` and `parent`) is merged **under** the field's query.
2. The field's query (`frm.setQuery` or the `query` prop) may be:
   - an object (`{filters}`, `{query}` or bare filters);
   - a method path;
   - a function `(doc, cdt, cdn)` returning either of the above. Desk merges the whole object a function returns into the request, so its extra keys (for example `translate_values`, or arguments a custom query reads from `frappe.form_dict`) are sent as top-level request arguments (`SearchLinkOptions.args`). They never replace the standard keys. Its `searchfield` is passed as `searchfield`.
3. Empty filter values are dropped, except for keys that are Link or Dynamic Link fields of the form.
4. `filters` (prop or `df.filters`) is merged in.

In 15.110, `link_filters` is enforced **only in the dropdown**: the server accepts any existing value the user is allowed to see.

**Validation.** A picked, typed or set value goes through `validate_link(doctype, value, fetch columns)`:
- A null `name` **clears** the field.
- The canonical name replaces the typed case.
- Fetched values go to `onValidated`, and the form writes the `fetch_from` targets.
- Clearing the link empties those targets.
- `ignore_link_validation` skips the check.
- A failed request (for example a missing select or read right) is shown through the server-message host, and the typed value stays.

**Titles.** Labels of results and picks are remembered per `DocType::name` and shown for the value. The cache is scoped to the provider's client and session user (`useLinkTitles`). `FormatContext.linkTitles` (getdoc's `_link_titles`) is also read.

**Create a new X.** The row is offered when `canCreate(doctype)` is true, `onCreateNew` is set in `<FrappeFormServices>`, and the field has no `only_select`. The app creates the record and calls `setValue(name)`.

**Open-record button.** It uses `linkHref` (default `/app/<slug>/<name>`); return `undefined` to hide it.

**Needs:** select or read on the target DocType, plus the APIs above.

---

## 5. FrappeDynamicLinkField

- `df.options` names the **sibling field** that holds the target DocType. In a grid this is the row's own field.
- `getOptions(doc)` overrides it.
- While the type field is empty, nothing is searched and typed text is cleared.
- Changing the type does **not** clear the value (Desk does not either).
- Rejecting Single DocTypes needs the target's meta and is not done (UNVERIFIED).

---

## 6. FrappeChildTable

It wraps `DataGrid` for a Table field. Inside a form it uses the form's controller; standalone it uses `rows` / `onRowsChange` (and `permissions`).

**Columns:**
- They come from child fields with `in_list_view` that are readable at their permlevel.
- Width is `columns`, else 2 (Small Text 3, Check 1). The running total starts at 1, and the column that takes it past 11 ends the list.
- Without any `in_list_view` field, the first value fields are used (UNVERIFIED Desk choice).

**Editing:**
- Inline editing is used when the child DocType has `editable_grid`; otherwise a click opens the **row form**, a dialog with the child layout and Insert Above/Below, Duplicate and Delete.
- Each row evaluates its own dependencies, with `doc` = the row and `parent` = the form.
- `cannot_add_rows` hides add, insert and duplicate; `cannot_delete_rows` hides delete.
- A table in Read status makes its cells read-only, except `allow_on_submit` fields.
- Pages hold `grid_page_length` rows (default 50).

**Rows** always carry `__islocal: 1` and a `new-<slug>-<10 chars>` name. A row with a client-made name and no `__islocal` is silently dropped by the server. `idx` stays 1…n after every add, insert, duplicate, delete or move.

**Events:** `<table>_add`, `before_<table>_remove` (which can stop a delete), `<table>_remove`, `<table>_delete` (bulk delete), `<table>_move`, `form_render` and `<table>_on_form_rendered`.

---

## 7. FrappeTableMultiSelect

- It uses the **first Link field** of the child DocType and shows it as pills (`TagInput`).
- Search is the Link field's search, with chosen values excluded.
- New entries are checked with `validate_link`. Invalid, blank or duplicate entries are dropped silently, as in Desk.
- The value is the array of child rows.
- `<table>_add` and `_remove` are **not** fired (Desk does not fire them either).
- A child DocType without a Link field shows Desk's error text.

---

## 8. The expression evaluator (D-23)

Desk evaluates `eval:` dependencies with `new Function` and full page access (`11 §2.4`). Decision D-23 (recommended, awaiting the owner) works as follows:

- **By default, an interpreter evaluates the expressions.** Nothing is executed, and no `unsafe-eval` is needed in a Content Security Policy.
- **Supported subset:**
  - literals and array literals;
  - `doc` and `parent`;
  - member access (`.`, `[]`, `?.`) and `.length`;
  - string and array methods `includes`, `indexOf`, `startsWith`, `endsWith`, `toLowerCase`, `toUpperCase`, `trim`;
  - `! - + typeof`, `* / % + -`, `< > <= >=`, `== != === !==` (loose `==` as in JavaScript), `&& || ??`, `?:`, `in`, a trailing `;`, `Boolean()`;
  - the helpers `in_list`, `cint`, `flt`, `cstr`, `is_null` (Desk page globals).
- **Every expression in the captured 15.110 metadata is supported.** QA's differential test shows the interpreter giving the same results as Desk's `new Function` on all supported Frappe-core expressions.
- **Unsupported constructs are reported, never guessed:**
  - unknown globals (`frappe.*`, `window`, `fetch`);
  - assignment, `new`, function literals, template interpolation;
  - calls to anything that is not a bound helper.

  They are listed in a notice above the form when the meta loads (`analyzeDependencies`). A `depends_on` that fails at run time is reported and treated as false.
- **At save, a `mandatory_depends_on` that cannot be evaluated throws** (`Invalid "mandatory_depends_on" expression`), as Desk's `save.js` does.
- **`fn:<name>`** calls a handler from `fnHandlers`. Without one it is reported and treated as true (Desk's promise is always truthy). Outside a form (`hasForm: false`) it reads `doc["fn:…"]`.
- **Opt-in** `evaluator: { mode: "function" }` (via `<FrappeFormServices>`) compiles with `new Function` like Desk. This gives full JavaScript, and **needs `unsafe-eval`** in a CSP.
- **Extra globals** (for example a `frappe` object) go in `globals`; functions must be wrapped with `exprHelper` before expressions can call them.

---

## 9. formEvents (D-24)

Decision D-24 (recommended, awaiting the owner):
- Desk Client Scripts (`__js`, `__custom_js`) are **not executed**: they need jQuery, `cur_frm` and `frappe.*` globals.
- Apps register typed handlers instead, using Desk's event names.
- Handlers run serially and promises are awaited.
- An event that can abort stops when a handler returns `false`, throws, or sets `frm.validated = false`.

| When | Events, in order |
|---|---|
| First open | `setup` (once) → `onload` (first open of a name) → `refresh` |
| Every load and after every save | `refresh` |
| Save | `validate` → `before_save` → (request) → `after_save` → `refresh` |
| Submit | `before_submit` → `validate` → `before_save` → (request) → `after_save` → `refresh` → `on_submit` |
| Update | (request) → `after_save` → `refresh` |
| Cancel | `before_cancel` → (request) → `refresh` → `after_cancel` |
| A parent field changes | `<fieldname>` |
| A child row field changes | `childEvents[<child DocType>][<fieldname>]` with `(frm, cdt, cdn)` |
| Table changes | `<table>_add`, `before_<table>_remove`, `<table>_remove`, `<table>_delete`, `<table>_move`, `form_render`, `<table>_on_form_rendered` |
| A Button field is clicked | `<fieldname>` |

The events that can abort are `validate`, `before_save`, `before_submit`, `before_cancel` and `before_<table>_remove`.

The `frm` controller offers:
- `doc`, `doctype`, `docname`, `isNew`, `isDirty`, `validated`;
- `setValue(field | {map}, value)`, `setRowValue(table, row, field, value)`;
- `setDfProperty(field, prop, value, table?)`, `toggleDisplay`, `toggleReqd`, `toggleEnable`;
- `setQuery(field, query, table?)`;
- `addChild(table, values)`, `clearTable(table)`;
- `trigger(event, cdt?, cdn?)`.

```tsx
<FrappeForm doctype="Sales Memo" name={name}
  events={{
    refresh: (frm) => frm.setQuery("customer", { filters: { disabled: 0 } }),
    kind: (frm) => frm.toggleReqd("note", frm.doc.kind === "B"),
    validate: (frm) => (frm.doc.amount > 0 ? true : false),
  }}
  childEvents={{ "Sales Memo Item": { qty: (frm, cdt, cdn) => frm.setRowValue("items", cdn!, "amount", 0) } }} />
```

---

## 10. The behaviour engine (pure TypeScript)

`src/frappe/form/model` is exported from `@solvfast/ui/frappe` and needs no DOM. It can be tested against recordings.

| Module | Exports | Behaviour |
|---|---|---|
| depends | `resolveFields`, `evaluateDepends`, `analyzeDependencies`, `sectionCollapsed` | A `mandatory_depends_on` result **replaces** a static `reqd`; `read_only_depends_on` sets `read_only` to 1/0. |
| docStore | `createDocStore` | The set_value pipeline: equal values are a no-op, except Link fields, which trigger again. Row operations keep `idx` contiguous. Tracks dirty state and syncs by replacing the document. |
| defaults | `newDoc`, `newChildRow` | The `create_new` order. A field default beats a user default. Today, Now and `__user` are expanded. A Select gets its first option. A required Table gets one empty row. |
| mandatory | `checkMandatory`, `isRequiredNow`, `rowRanges` | Desk's `check_mandatory`. 0 counts as a value. Hidden fields are still checked. Rows are grouped as "every row", "row 3", "rows 1, 3-4 and 6" (`comma_and`) or "in N rows". |
| fetch | `buildFetchMap`, `fetchUpdates`, `isReadOnlyByFetch` | Fetch targets are written unconditionally on the client; the server fetches again on save. |
| layout, actions, status, copy | `buildLayout`, `formActions`, `ladderStatus`, `controlStatus`, `copyDoc`, `amendDoc` | As described in §2. |

---

## 11. Known limitations

**Not reproduced** (by design or decision):
- Desk Client Scripts are not run (D-24).
- `__js` and `__form_grid_templates` are ignored.
- No undo / redo.
- No form viewers.
- No realtime "modified after you opened it" banner. A conflict shows up at save as a 417 with Reload.
- No Connections dashboard.
- No print view, rename dialog, Duplicate menu or prev/next navigation.

**UNVERIFIED** (exact Desk behaviour not confirmed):
- The exact wording and punctuation of the "Missing Fields" lines and the "Cancel All" dialog.
- `ignore_doctypes_on_cancel_all` (set by Desk client scripts) is not sent.
- Datetime zone conversion while editing.
- `show_title_field_in_link` titles: without boot data, a label shows only once the field has seen one.
- The legacy Banker's rounding tie-breaking epsilon.

**Not supported yet:**
- Fieldtypes: see the table in §3. Attach upload is P2.
