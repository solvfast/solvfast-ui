# Forms — `@solvfast/ui` 0.4.0 (A3), updated 0.7.x (P35 form)

Generic field controls (core entry `@solvfast/ui`) and Frappe forms (`@solvfast/ui/frappe`). Native behaviour is that
of Frappe 15.110 (`ab7e5ae`) as traced in `apps/serve_fast/docs/frappe-components/11-native-form.md` and
`12-native-controls.md`; section references below (`11 §2.4`, `12 §4`) point there.

**Status (CONTRACT §4).**
- Generic controls are **Implemented**, with unit tests.
- The form engine and the Frappe components are **Simulated & tested**: they ran against `createFixtureTransport` with the real 15.110 metadata in `tests/fixtures/real-15.110` and the QA parity tests in `tests/parity`.
- The CRM's Type fields (`PrerequisiteFieldInput`) are **Integrated with CRM — work copy**.
- Nothing here is *Verified against real Frappe* yet.

**P35 (0.7.x, form workstream)** — what changed, in short (details in the sections below; evidence is unit / SIMULATED
backend only, nothing ran against a real site):
- Ctrl/⌘+S runs the **visible primary action** like Desk's `trigger_primary_action` (Save / Submit → confirm / Update /
  Amend), document-wide while the form is the topmost one; respects `saveDisabled`; `hotkeys={false}` opts out (§2).
- A dirty submitted document shows **Update only** (no Cancel); **Amend needs create + amend**; Duplicate / Amend copies
  start from the new-document defaults (§2 Actions).
- Workflow actions run the mandatory check (incl. `mandatory_depends_on`) and `before_workflow_action` /
  `after_workflow_action` (§9).
- getdoc's `_link_titles` show Link titles on load (§4); "Create a new X" needs the target's **create** right and the open
  link its **read** right (§4) — behaviour change, see there.
- New: `menu` / `extraTabs` / `fieldFilter` slots, header image, "See on Website" (§2), **Quick Entry** (§2.1), unsaved
  in-app navigation helper (§2.2), user defaults from the boot (§2.3), undo / redo and custom buttons (§9), server
  MandatoryError / LinkValidationError shown on the fields (§2 Errors), unsupported fieldtypes reported and read-only,
  an Autocomplete control (§3).

Contents: [1. Generic controls](#1-generic-field-controls-core) · [2. FrappeForm / FrappeFormView](#2-frappeform-and-frappeformview) ·
[3. FrappeField](#3-frappefield-and-fieldtype-coverage) · [4. FrappeLinkField](#4-frappelinkfield) ·
[5. FrappeDynamicLinkField](#5-frappedynamiclinkfield) · [6. FrappeChildTable](#6-frappechildtable) ·
[7. FrappeTableMultiSelect](#7-frappetablemultiselect) · [8. The expression evaluator (D-23)](#8-the-expression-evaluator-d-23) ·
[9. formEvents (D-24)](#9-formevents-d-24) · [10. Compatibility boundary](#10-compatibility-boundary) ·
[11. The behaviour engine](#11-the-behaviour-engine-pure-typescript) · [12. Known limitations](#12-known-limitations)

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
| `LinkInput` | `string \| null` | A text box that searches (`search(text)`, `debounceMs` default 500). The first result is highlighted. Enter picks it, but only when the typed text appears in the result (Desk's `input_matches_item`). Hand-typed text goes to `onCommitText` on blur. Optional `actions` rows (e.g. "Create a new X"), an `href` open button and a clear (×) button. **Picker mode (0.7, opt-in, defaults unchanged):** `openOnClickWhenFilled` — a click or tap opens the full list (search `""`) even when the box shows a value; the shown text is selected so typing replaces it and filters; Escape restores; picking replaces the value; Enter on a closed box opens the list; Home / End go to the first / last row while nothing is typed; a decorative chevron toggles the list with a pointer. `selectedIndicator` — the current value's row has a check mark and `aria-selected="true"` (the highlight is then carried by `aria-activedescendant` only; by default `aria-selected` marks the highlighted row, as Desk's Awesomplete does). `selectedValue` — the value to mark when it is not `value` (e.g. a "None" row shown through `displayValue` while `value` is `null`). `keepValueWhenEmptied` — an emptied box that is left restores the value instead of clearing it (the × still clears). `emptyText` — the no-results text. `searchPlaceholder` — the placeholder while the list is open and the box is empty. Desk's Link control has none of this (it lists results only when an empty box gets focus, `link.js:35-41`); it is for pickers that replace a select. |
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
| `menu` (P35) | `ReactNode` rendered in the header action area **after** the primary action (e.g. a "⋯" menu). |
| `extraTabs` (P35) | `Array<{ key, label, render() }>` appended after the form's own tabs (keys are namespaced, they never collide with Tab Break fieldnames). A form without Tab Breaks then shows its fields under a **Details** tab. `render` runs only while its tab is active. |
| `fieldFilter` (P35) | `(df) => boolean`: only accepted meta fields (breaks included) are laid out; a filtered-out break folds its fields into the previous container. Hidden / permission statuses still apply. The mandatory check still covers **every** required field, so keep required fields in. Quick Entry uses it. |
| `hotkeys` (P35) | Default `true`: Ctrl/⌘+S, Ctrl/⌘+Z, Ctrl/⌘+Shift+Z / Ctrl/⌘+Y while this is the topmost mounted form. `false` registers nothing. |
| `onOpenFullForm` (FrappeForm, P35) | Quick Entry's "Edit Full Form" (and a target that is not quick-entry eligible) hands the unsaved document here; route to the full form. |

**Header** (P35): the title, the name under it, the indicator, and — from `meta.image_field` — an avatar of the image
(initials when empty; nothing when the DocType has no `image_field`). **See on Website** (form.js:1149-1158) links
`/<route>` in a new tab for a saved website generator whose server `__onload` says `is_website_generator` and
`published`; without `__onload` (a document not read through getdoc) the DS falls back to `meta.has_web_view` + the
DocType's `is_published_field` + `doc.route` (a DS extension; Desk relies on `__onload`).

**Layout** (`11 §2.1–2.3`):
- A "Details" tab is inserted when the meta has Tab Breaks and the first field is not one. A first field that is not a Section Break gets an anonymous section. Column Breaks split a section into equal columns.
- A section with no visible field is hidden. A tab is hidden when it is hidden itself, when the user cannot read it, or when it has no visible section. The tab bar disappears when only one tab is left.
- Collapsible sections are closed by default and follow `collapsible_depends_on`. A section is forced open when a required field inside it is **null** (section.js:150 `== null`; since P35 an empty string no longer forces it open). This is evaluated at load and after each save; the user's own toggles persist in between.
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
| 4 | **Cancel** | docstatus 1, cancel right, **not while Update is offered** (toolbar.js:668-689 is an else-if chain; P35 — before, both showed and Cancel discarded the `allow_on_submit` edits). Shown as the secondary button. With a workflow, only when no transition leads to a cancelled state. |
| 5 | **Amend** | docstatus 2, amend **and create** right (Desk's `amend_doc` → `copy_doc` → `validate_form_action("Create")`, form.js:1297-1298; P35 — before, amend alone). Disabled when `is_document_amended` returns true. |

The chosen action is then checked again against its own right: Save needs write (or create on a new document), Submit and Update need submit. When there are workflow actions for a clean, saved document, A4's `FrappeWorkflowActions` replaces these buttons. For a DocType with a workflow, Save and Cancel stay hidden until both the workflow definition and the user's transitions have loaded, so they never flash.

**How each action runs:**
- **Save**:
  1. A clean document gets "No changes in document" and nothing is sent.
  2. The `validate` and `before_save` events run.
  3. The client mandatory check runs. If fields are missing, a "Missing Fields" dialog opens and the form jumps to the tab of the first missing field.
  4. `savedocs` is called with the whole document, children included and `modified` echoed.
  5. The server's document replaces the local one.
  6. The `after_save` and `refresh` events run.

  A second save while one is running is ignored.
- **Ctrl/⌘+S** (P35, Desk `trigger_primary_action`, desk.js:389-403): the focused input is blurred first (a pending text
  edit is written, which may turn Submit into Save), then the **visible primary action** runs: Save, Submit (its
  confirmation), Update or Amend. Nothing happens with `saveDisabled`, without the right, without `permissions`, while
  workflow actions replace the buttons, or while one of the form's dialogs is open. The listener is on `document`
  (focus need not be inside the form) and only the **topmost** mounted form answers (a Quick Entry dialog over a form
  wins). Before P35 it was a `save_or_update` on the form `<div>` only, ignoring `saveDisabled`.
- **Submit**:
  1. A confirmation asks "Permanently Submit {name}?".
  2. The `before_submit` event runs.
  3. The rest follows the Save steps, then `on_submit` runs.
- **Update** skips `validate` and `before_save`.
- **Cancel**:
  1. The pre-flight call `get_submitted_linked_docs` runs. If submitted linked documents exist, they are listed with **Cancel All**, which calls `cancel_all_linked_docs`, then reloads the document and cancels it. When the user cannot cancel every linked DocType, Desk's explanation replaces the button. This is `canCancelAllLinked`, mirroring Desk's `can_cancel`: Administrator can cancel every DocType; anyone else needs a cancel right at permlevel 0 from their roles.
  2. Otherwise a confirmation asks "Permanently Cancel {name}?".
  3. The `before_cancel` event runs.
  4. `desk.form.save.cancel` is called, with the workflow state field and its current value.
  5. The `after_cancel` event runs.
- **Amend**:
  1. The app's `onAmend` runs if given.
  2. Otherwise the view makes a local copy (`amendDoc`: a `copy_doc` of the keys that have a DocField, ignoring `no_copy`, with new child rows, `amended_from` and today's `amendment_date` when that field exists), which needs an `amended_from` field.
  `copyDoc` / `amendDoc` (P35, create_new.js:281-320) start from a new document: field defaults first (a `no_copy` field
  of a Duplicate gets its default), `__run_link_triggers`, `modified_by` = the user, `lft` / `rgt` never copied; child
  rows start from the child defaults and, when amending, carry `_amended_from` = the source row.
- **New workflow document** (P35): its workflow state field is set to the first workflow state whose `doc_status` is the
  document's docstatus (form/workflow.js:143-151, model/workflow.js:28-38).

**Errors.**
- Server errors are shown with `FrappeErrorState` (one rendering per error kind), and the form stays dirty.
- A **417 TimestampMismatchError** keeps the user's edits on screen and offers **Reload**, which re-reads the document.
- **On the fields** (P35): a `MandatoryError` or `LinkValidationError` from the server also marks the fields it names —
  `fieldErrorsFromFrappeError(err, bundle, translate)` reads the exception's field list (`[DocType, name]: a, b`,
  document.py:963) and the messages (`Value missing for {doctype}: {label}`, child `… Row #n: Value missing for: {label}`,
  base_document.py:738-776; `Could not find {label}: {value}` / `Row #n: {label}: {value}`, document.py:982), matching raw
  and translated labels. A child-row error goes on its Table field. The field's error clears on its next change; the
  form jumps to the first one.

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
| Rights | read to open; write (create for a new document) to save; submit, cancel and amend (+ create) for those actions; select or read on Link targets. The server checks all of them again. |
| Quick Entry | the target DocType's getdoctype (`quick_entry`, fields) and `savedocs` |

### 2.1 Quick Entry (P35)

```tsx
import { FrappeQuickEntry, quickEntryFields } from "@solvfast/ui/frappe";

<FrappeQuickEntry doctype="Note" open={open} onOpenChange={setOpen}
  defaults={{ nameField: typed }} onCreated={(doc) => select(doc.name)} onOpenFullForm={(draft) => routeToForm(draft)} />
```

- `quickEntryFields(meta)` → `{ eligible, fields, reason? }` is a literal port of quick_entry.js:59-110: fields with
  `reqd` or `allow_in_quick_entry`, not `read_only` / `is_virtual` / Tab Break; Prompt naming prepends "{DocType} Name";
  eligible only with `meta.quick_entry = 1`, no required `Table` (Table MultiSelect does not count) and at least one
  field. Desk's `too_many_mandatory_fields` is never called in 15.110, so there is no field limit.
- The dialog is a `FrappeFormView` with `fieldFilter` = those fields and `usePermissions` (no create right → Save
  disabled). Save runs the form pipeline (validate, mandatory check, …) and saves through **savedocs** (`useSaveDoc`);
  Desk's Quick Entry posts `frappe.client.save` instead (same server-side `doc.save()`), and then offers Submit for a
  submittable DocType — not reproduced (open the full form). Ctrl/⌘+S saves (the dialog's form is topmost).
- **Edit Full Form** → `onOpenFullForm(draft)`; a DocType that is not eligible calls `onOpenFullForm(newDoc)` at once
  and closes (Desk routes to the form). Without `onOpenFullForm` the dialog shows the whole form.
- **Link "Create a new X"**: inside `FrappeForm`, when the app gives no `onCreateNew`, a quick-entry eligible target opens
  this dialog (typed text → the name field) and the saved name is written into the Link (Desk `update_calling_link`).
- The list's "Add" button: `FrappeListView create={{}}` (no `render` / `onCreate`) opens this dialog for an eligible
  DocType and calls `create.onOpenFullForm(newDoc)` for any other (P35 integration, see list.md §1).

### 2.2 Unsaved changes and in-app navigation (P35)

Desk keeps a dirty document in `locals` across routes and only guards `beforeunload` (form.js:1351-1356). Here the edits
live in the component, so a route change unmounts and loses them: the **host router** must ask. `onDirtyChange(dirty)`
reports the state; `useUnsavedChangesBlocker(dirty, { message?, confirm?, beforeUnload? })` → `{ dirty, confirmLeave(), message }`
is router-agnostic:

```tsx
const [dirty, setDirty] = React.useState(false);
const guard = useUnsavedChangesBlocker(dirty);
<FrappeForm doctype="ToDo" name={name} onDirtyChange={setDirty} />
// react-router 6.4+: useBlocker(() => guard.dirty && !guard.confirmLeave());  other routers: if (!guard.confirmLeave()) return;
```

### 2.3 User defaults (P35)

`readFrappeBoot()` now also reads `defaults` (`frappe.defaults.get_defaults(user)`, Desk `boot.user.defaults`) and
`user_permissions` (`get_user_permissions`) into `boot.userDefaults` (`userDefaultsFromBoot`: the `is_default` User
Permission wins, a single allowed value counts — defaults.js:4-41). Pass it on:
`<FrappeProvider boot={boot}>` forwards it (P35 integration): `FrappeSettings.userDefaults` = the provider's `userDefaults`
prop, else `boot.userDefaults`, else an outer provider's; `userDefaults={false}` opts out. FrappeForm (new document, the
menu's New, child-row defaults), FrappeQuickEntry and FrappeListView's create fallback apply it unless given their own
(`newDocDefaults.userDefaults` / `defaults.userDefaults` win). A field's own `default` still wins over a user default.

### 2.4 The form's "⋯" menu and Connections tab (P35 integration)

`FrappeForm` renders Desk's form menu and Connections tab by default:

| Prop | Default | Values |
|---|---|---|
| `menu` | `FrappeRecordMenu` (record.md §5.2) in the view's `menu` slot | `false` none · an options object (`exclude`, `extra`, `printSettings`, `onDuplicate`, `onNew`, `onRenamed`, `onDeleted`, `onPrint`, `onEmail`, `onRemind`, `onCustomize`, `deskUrl`, `printProps`, `emailProps`, `onOpened(doc, "duplicate" \| "new")`, …) · any node / `(ctx) => node` replaces it |
| `connections` | a "Connections" tab (`FrappeConnections` in `extraTabs`, before the app's own) when `connectionsFromMeta(meta)` is not null | `false` none · options passed to `FrappeConnections` (`onOpenList`, `listHref`, `onNew`, `canRead`, `canCreate`, `labelFor`) + `label` |

Wiring: **Duplicate** opens `copyDoc`'s unsaved copy in this form and **New** a `newDoc` (as Amend does — until saved
or the `doctype` / `name` props change; route with `onOpened`, or pass `onDuplicate` / `onNew` to route instead);
**Reload** = the form's reload (not offered for a new document, a local copy or a saved amendment); **Undo / Redo** = the
controller's history (`frm.undo()` / `canUndo`); **Print / Email / Remind Me** = the package's dialogs; **Links** = the
Connections tab. Rename and Delete call the server; route with `onRenamed` / `onDeleted` (the form keeps its `name`).
A DocType with a dashboard therefore shows a tab bar ("Details" + "Connections") even without Tab Breaks.

`FrappeFormView`'s `menu` slot also accepts `(ctx: FrappeFormMenuContext) => node` — `ctx = { frm, doc, dirty,
reload?, showTab(key), tabs }`, evaluated on every render with the form's live state.

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
| Date (display) | supported | Editable and read-only both show the site's `date_format` (`formatContext` / boot), as Desk; the DS `DateField` gets it through `formatDisplay` (display only — the value stays `YYYY-MM-DD`, no time-zone conversion). Since 0.4.0-dev.34. |
| Datetime | partial | Edited in the browser's time zone; seconds are stored as `:00`. Converting between the system and user zones while editing is UNVERIFIED. The read-only display converts zones through `formatValue`. |
| Text Editor | partial | Stored as sanitized plain HTML. Desk wraps it in a `ql-editor` div, which is a convention, not a contract. No mentions and no image upload. |
| Link, Dynamic Link | supported | §4, §5. |
| Table, Table MultiSelect | supported | §6, §7. |
| HTML, Heading, Button, Image | supported | HTML is sanitized `options`. A Button fires the event named after its fieldname. |
| Code, JSON, HTML Editor, Markdown Editor | partial | Monospace textarea; no syntax editor, no preview. |
| Attach, Attach Image | supported | Uploads through `upload_file` (`FrappeAttachField`, `tests/attach.test.tsx`); Clear does not delete the File; no library / link / camera source; `max_attachments` not enforced client-side. |
| Phone (fieldtype) | partial | Telephone text box; no country picker. |
| Autocomplete (P35) | supported | Suggestions from `df.options` (lines, or a JSON list of strings / `{label, value}`, autocomplete.js:147-166); a typed value outside the list is cleared unless `ignore_validation`; an empty list accepts anything. Server-side `_get_options` / `frm.set_query` on Autocomplete are not used. |
| Fold, Page Break | partial | Treated as a Section Break (no "Show more" folding). |
| Signature, Geolocation, Barcode, Icon, any other type | not supported | **P35**: listed in the form's issues banner (`analyzeFieldtypes`, `SUPPORTED_FIELDTYPES`) and the raw stored value is shown **read-only** in every status (JSON for objects). Before 0.7 they silently fell back to an editable text box. |

`SUPPORTED_FIELDTYPES` (exported) is the list of fieldtypes with a control; `analyzeFieldtypes(bundle)` returns the
others for the parent and child DocTypes.

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

**Titles.** Labels of results and picks are remembered per `DocType::name` and shown for the value. The cache is scoped to the provider's client and session user (`useLinkTitles`). **P35 (F3):** getdoc's `_link_titles` (desk/form/load.py:62, 425-480 — Link / Dynamic Link / child-table link values whose target has `show_title_field_in_link`) are kept by the client (`getDoc` → `linkTitles` and `docinfo._link_titles`, `linkTitlesOf`) and seeded into that cache when the form renders, so a saved form shows titles without searching. `FormatContext.linkTitles` is also read (pass titles there for read-only formatting outside a form).

**Create a new X** (link.js:323-334). Not for `only_select`. **P35 (F4), behaviour change:** by default it is offered only
when the session may **create** the target DocType — its DocPerm rows × `session.roles`, read from the target's meta once
the field is focused; the Administrator user always; no roles → never (rule 9). Before 0.7 the default was "whenever
`onCreateNew` is given", without any permission knowledge. An app `canCreate` in `<FrappeFormServices>` decides alone.
Something must create the record: the app's `onCreateNew` (it calls `setValue(name)`), or — inside `FrappeForm`, without
`onCreateNew` — Quick Entry for a quick-entry eligible target (§2.1).

**Open-record button.** It uses `linkHref` (default `/app/<slug>/<name>`). **P35 (F4), behaviour change:** the default URL
is given only when the session may **read** the target (same source: the target's meta is read when the field has a
value; Administrator always; no roles → hidden). An app `linkHref` decides alone; return `undefined` to hide it.

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

Desk evaluates `eval:` dependencies with `new Function` and full page access (`11 §2.4`). **Decided policy (D-23, ratified by the owner):** the interpreter is the default. An expression outside its subset is explicitly unsupported: it is reported and never guessed, and the package never silently runs a different interpretation of it. It works as follows:

- **By default, an interpreter evaluates the expressions.** Nothing is executed, and no `unsafe-eval` is needed in a Content Security Policy.
- **Supported subset:**
  - literals and array literals;
  - `doc` and `parent`;
  - member access (`.`, `[]`, `?.`) and `.length`;
  - string and array methods `includes`, `indexOf`, `startsWith`, `endsWith`, `toLowerCase`, `toUpperCase`, `trim`;
  - `! - + typeof`, `* / % + -`, `< > <= >=`, `== != === !==` (loose `==` as in JavaScript), `&& || ??`, `?:`, `in`, a trailing `;`, `Boolean()`;
  - the helpers `in_list`, `cint`, `flt`, `cstr`, `is_null` (Desk page globals).
- **Every expression in the captured 15.110 metadata is supported.** Over Frappe core, QA's differential test accepts 929 of 947 real expressions with 0 mismatches against Desk's `new Function`. The 18 others stay explicitly unsupported (reported, never evaluated).
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

**Decided policy (D-24, ratified by the owner):** `formEvents` is the package's customization API. The package does **not** claim compatibility with Desk Client Scripts (see §10).
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

| A workflow action is chosen (P35) | mandatory check (Missing Fields; nothing sent when it fails) → `before_workflow_action` (with `frm.selectedWorkflowAction`) → `apply_workflow` → `after_workflow_action` (form/workflow.js:96-121) |

The events that can abort are `validate`, `before_save`, `before_submit`, `before_cancel`, `before_workflow_action` and `before_<table>_remove`. (Desk stops a workflow action only when a handler throws; here `false` / `frm.validated = false` stop it too.)

The `frm` controller offers:
- `doc`, `doctype`, `docname`, `isNew`, `isDirty`, `validated`;
- `setValue(field | {map}, value)`, `setRowValue(table, row, field, value)`;
- `setDfProperty(field, prop, value, table?)`, `toggleDisplay`, `toggleReqd`, `toggleEnable`;
- `setQuery(field, query, table?)`;
- `addChild(table, values)`, `clearTable(table)`;
- `trigger(event, cdt?, cdn?)`;
- P35: `save(action?)` (the form's pipeline, after a permission check; resolves true when saved; `"Submit"` opens the
  "Permanently Submit" confirmation and resolves false, as Desk's `savesubmit`), `checkMandatory()`
  (opens Missing Fields), `selectedWorkflowAction`;
- P35: `undo()`, `redo()`, `canUndo`, `canRedo` — Desk's `UndoManager` (undo_manager.js): only the user's field changes
  are recorded (not script or fetch writes, base_control.js:220); undo sets the old value through `setValue`, so field
  events run; a new change does not clear the redo stack (as Desk); loading or saving erases the history (form.js:391).
  Shortcuts: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y — outside text inputs, where the browser's own text undo runs
  (keyboard.js:47). "Nothing left to undo / redo" shows as the form notice. Read `canUndo` / `canRedo` when your menu opens.
- P35: `addCustomButton(label, handler, group?)`, `removeCustomButton(label, group?)`, `clearCustomButtons()` — Desk's
  `frm.add_custom_button`: ungrouped buttons appear in the header; a `group` (e.g. "Create") becomes a dropdown. Buttons
  are cleared before every `refresh` (form.js:724), so add them in `refresh`.

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

## 10. Compatibility boundary

What the package reproduces, and what it deliberately does not (D-23 and D-24, decided).

**Supported:**
- Every DocField property the form reads from meta: layout, `depends_on`, `mandatory_depends_on`, `read_only_depends_on`, `collapsible_depends_on`, `fetch_from`, `link_filters`, permissions, and so on.
- `eval:` expressions within the interpreter's subset (§8), the plain fieldname form, and `fn:` through registered `fnHandlers`.
- `formEvents`, with Desk's event names and order (§9): `setup`, `onload`, `refresh`, `validate`, `before_save`, `after_save`, `before_submit`, `on_submit`, `before_cancel`, `after_cancel`, field names, the `<table>_*` events, `form_render`, and Button fields.
- The frm-like controller: `doc`, `doctype`, `docname`, `isNew`, `isDirty`, `validated`, `setValue`, `setRowValue`, `setDfProperty`, `toggleDisplay`, `toggleReqd`, `toggleEnable`, `setQuery`, `addChild`, `clearTable`, `trigger`.

**Not supported (by decision):**
- Desk Client Scripts: the `Client Script` DocType, the `__custom_js` and `__js` code from `getdoctype`, and `frappe.ui.form.on(...)` handlers defined in that code. The package never evaluates them.
- jQuery or DOM access from handlers (`frm.fields_dict.x.$wrapper`, `$(...)`), `cur_frm`, `locals[cdt][cdn]`, and `frappe.ui.form.*` objects.
- In `eval:` expressions: `frappe.*` (including `frappe.boot.*`, `frappe.user.*`, `frappe.datetime.*`), `window`, `document`, arrow functions and other function literals, bitwise operators (`& | ^ ~ << >>`), assignment, `new`, and template interpolation. They are reported when the meta loads, never evaluated. An app that needs full JavaScript must opt in to `evaluator: { mode: "function" }` (CSP `unsafe-eval`) and accept Desk's semantics.
- `frm.set_intro`, `frm.dashboard`, `frappe.msgprint` called from inside the form. The app renders its own UI: `useFrappeMessages().show` for messages. (`frm.add_custom_button` is supported since P35 as `frm.addCustomButton`, §9.)

**Migrating a Client Script to formEvents.** Desk:

```js
frappe.ui.form.on("Sales Order", {
  refresh(frm) {
    frm.set_query("customer", () => ({ filters: { disabled: 0 } }));
    frm.toggle_reqd("delivery_date", frm.doc.order_type === "Sales");
  },
  customer(frm) { frm.set_value("contact_person", ""); },
  validate(frm) {
    if (frm.doc.discount_percentage > 50) { frappe.msgprint("Discount too high"); frappe.validated = false; }
  },
});
frappe.ui.form.on("Sales Order Item", {
  qty(frm, cdt, cdn) { const row = locals[cdt][cdn]; frappe.model.set_value(cdt, cdn, "amount", row.qty * row.rate); },
});
```

The same with formEvents:

```tsx
const messages = useFrappeMessages();
<FrappeForm doctype="Sales Order" name={name}
  events={{
    refresh: (frm) => {
      frm.setQuery("customer", () => ({ filters: { disabled: 0 } }));
      frm.toggleReqd("delivery_date", frm.doc.order_type === "Sales");
    },
    customer: (frm) => frm.setValue("contact_person", ""),
    validate: (frm) => {
      if (Number(frm.doc.discount_percentage) > 50) { messages.show([{ message: "Discount too high", indicator: "red" }]); return false; }
    },
  }}
  childEvents={{
    "Sales Order Item": {
      qty: (frm, _cdt, cdn) => {
        const row = (frm.doc.items as FrappeDoc[]).find((r) => r.name === cdn)!;
        frm.setRowValue("items", cdn!, "amount", Number(row.qty) * Number(row.rate));
      },
    },
  }} />
```

How the Desk calls map:

| Desk | formEvents |
|---|---|
| `frm.set_value` | `frm.setValue` |
| `frappe.model.set_value(cdt, cdn, …)` | `frm.setRowValue(table, cdn, …)` |
| `locals[cdt][cdn]` | the row in `frm.doc[table]` |
| `frm.set_query` | `frm.setQuery` |
| `frm.toggle_*` | `frm.toggle*` |
| `frm.set_df_property` | `frm.setDfProperty` |
| `frappe.validated = false` | `return false` (or `frm.validated = false`) |
| `frappe.call` / `frm.call` | the app's `useFrappeApi().call` / `runDocMethod` |
| `cur_frm` | the `frm` argument, or `controllerRef` |

Server-side logic (controllers, Server Scripts) runs unchanged, because the package saves through Desk's own endpoints.

---

## 11. The behaviour engine (pure TypeScript)

`src/frappe/form/model` is exported from `@solvfast/ui/frappe` and needs no DOM. It can be tested against recordings.

| Module | Exports | Behaviour |
|---|---|---|
| depends | `resolveFields`, `evaluateDepends`, `analyzeDependencies`, `sectionCollapsed` | A `mandatory_depends_on` result **replaces** a static `reqd`; `read_only_depends_on` sets `read_only` to 1/0. |
| docStore | `createDocStore` | The set_value pipeline: equal values are a no-op, except Link fields, which trigger again. Row operations keep `idx` contiguous. Tracks dirty state and syncs by replacing the document. |
| defaults | `newDoc`, `newChildRow` | The `create_new` order. A field default beats a user default. Today, Now and `__user` are expanded. A Select gets its first option. A required Table gets one empty row. |
| mandatory | `checkMandatory`, `isRequiredNow`, `rowRanges` | Desk's `check_mandatory`. 0 counts as a value. Hidden fields are still checked. Rows are grouped as "every row", "row 3", "rows 1, 3-4 and 6" (`comma_and`) or "in N rows". |
| fetch | `buildFetchMap`, `fetchUpdates`, `isReadOnlyByFetch` | Fetch targets are written unconditionally on the client; the server fetches again on save. |
| layout, actions, status, copy | `buildLayout`, `formActions`, `ladderStatus`, `controlStatus`, `copyDoc`, `amendDoc` | As described in §2. |
| quickEntry (P35) | `quickEntryFields`, `quickEntryFilter` | §2.1. |
| errors (P35) | `fieldErrorsFromFrappeError` | §2 Errors. |
| fieldtypes (P35) | `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes` | §3. |
| docStore history (P35) | `store.undo/redo/canUndo/canRedo/eraseHistory`, `setValue(…, { record: true })` | §9. |

---

## 12. Known limitations

**Not reproduced** (by design or decision):
- Desk Client Scripts are not run (D-24).
- `__js` and `__form_grid_templates` are ignored.
- No form viewers.
- No realtime "modified after you opened it" banner. A conflict shows up at save as a 417 with Reload.
- No Connections dashboard.
- No print view, rename dialog, Duplicate menu or prev/next navigation (the `menu` slot hosts an app's or another workstream's menu).
- Quick Entry does not offer Submit after saving a submittable DocType (Desk does).

**UNVERIFIED** (exact Desk behaviour not confirmed):
- The exact wording and punctuation of the "Missing Fields" lines and the "Cancel All" dialog.
- `ignore_doctypes_on_cancel_all` (set by Desk client scripts) is not sent.
- Datetime zone conversion while editing.
- `show_title_field_in_link` titles: getdoc's `_link_titles` are used (P35); titles of values set later (not searched) still need a search. `_link_titles` of other responses (savedocs) are not read.
- The legacy Banker's rounding tie-breaking epsilon.

**Not supported yet:**
- Fieldtypes: see the table in §3 (Signature, Geolocation, Barcode, Icon are reported and read-only).

**Simulated vs. a real site.** Everything above is exercised by unit tests or the in-package SIMULATED backend
(`createFixtureTransport`, with real 15.110 metadata where noted). The P35 tests shape two real responses the simulator
does not produce: getdoc's `_link_titles` and a MandatoryError raised by the server after the client check passed.
Needs a real site to verify: Link titles from a live getdoc, `apply_workflow` on a real Workflow (with the new pre-steps),
the server messages' exact (translated) wording parsed by `fieldErrorsFromFrappeError`, user defaults / User Permissions
in a real boot, Quick Entry against real `quick_entry` DocTypes.
