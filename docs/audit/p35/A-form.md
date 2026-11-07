# Agent A — Form View audit of `@solvfast/ui` 0.6.0 (p35-pkg, branch feat/0.7.x/p35-coverage, HEAD 0ef45c1)

Read-only audit. Nothing in the worktree was edited. Native reference: Frappe 15.110 at
`/home/frappe/lovable_bench/apps/frappe/frappe/public/js/frappe/form/*` (cited only where it shapes a recommendation;
Agent C owns native comparison).

## Method and evidence base

- Read every file in `src/frappe/form/**`, `src/frappe/form/model/**`, the record layer used by the form
  (`src/frappe/record/*`, `src/record/{ActionBar,LifecycleBar,StatusBadge}.tsx`), `src/frappe/hooks/useDocMutations.ts`,
  `src/frappe/list/{print.ts,FrappePrintDialog.tsx}`, `src/fields/{DataGrid,autocomplete,LinkInput,FieldShell}.tsx`.
- Enumerated every `describe`/`it` in `tests/**` and read the bodies of all form-relevant tests.
- **Test run**: the worktree has no `node_modules` (`npx vitest` fails with ERR_MODULE_NOT_FOUND). I rsynced the tree
  (no `.git`) into a scratchpad folder (deleted after the run) and symlinked `/home/frappe/sfui-dev/p33-pkg/node_modules` (its
  dependencies/devDependencies/peerDependencies are byte-identical to p35 by `jq` diff). Result for the 25 form-relevant
  files (`frappe-form`, `frappe-form-model`, `record-form-fixes`, `attach`, `real/sada-real`, `record-frappe`,
  `record-frappe-ui`, `sim-permissions`, `foundation-hooks`, `frappe-indicator`, `record`, `date-display`, `fields`,
  `parity/*`): **629 passed, 11 todo, 0 failed**.
- "Exercised against" legend: **U** = unit / pure function or stub client (`vi.fn` API), **S** = in-package simulator
  (`createFixtureTransport`, `src/frappe/testing`), **R** = recorded real Frappe 15.110 responses
  (`tests/real/sada-real.test.tsx`, `tests/fixtures/real-15.110*` metas), **Site** = a real running site.
  **Nothing in this package has been exercised against a real site** (`e2e/frappe-site/README.md`: "PREPARED, NOT RUN").
  Real metas (ToDo/Contact/Note/Event/User/Customer/File, captured from 15.110) are used *as input* to simulator tests;
  where a row says "S (+real meta)" the metadata is real but the server answers are simulated.
- Showcase: hash routes in `showcase/src/routes.ts:88-99`; the form demos are `#frappe-forms`
  (`showcase/src/pages/frappe/index.tsx:202`, scenarios contact / new-todo / todo / travel / travel-saved / readonly /
  error / loading / save-error), `#frappe-permissions` (`index.tsx:585`, Travel Request form per role),
  `#frappe-workflow` (`:396`), `#frappe-record` (`:291`), `#frappe-rtl` (`:765`), `#frappe-themes` (`:787`),
  `#frappe-gallery` (`:52`). The showcase sim-site (`playground/src/demo/sim-site.ts`) defines only Check, Column
  Break, Currency, Data, Date, Link, Section Break, Select, Small Text, Table MultiSelect; the Contact and ToDo demos
  use the real metas (adding Text Editor, Table, Read Only, Dynamic Link, Attach Image, Tab Break…). Every other
  fieldtype has **no showcase presence**.
- Abbreviations: `FFV` = `src/frappe/form/FrappeFormView.tsx`, `FF` = `src/frappe/form/FrappeField.tsx`,
  `FForm` = `src/frappe/form/FrappeForm.tsx`, `FLF` = `src/frappe/form/FrappeLinkField.tsx`,
  `FCT` = `src/frappe/form/FrappeChildTable.tsx`, `m/` = `src/frappe/form/model/`. Test files: `ff` =
  `tests/frappe-form.test.tsx`, `ffm` = `tests/frappe-form-model.test.tsx`, `rff` = `tests/record-form-fixes.test.tsx`,
  `p27` = `tests/parity/permissions-p27.test.tsx`, `simp` = `tests/sim-permissions.test.tsx`,
  `rfu` = `tests/record-frappe-ui.test.tsx`, `fld` = `tests/fields.test.tsx`.

### Docs-vs-code discrepancies found (claims that are wrong or stale)

1. `docs/components/forms.md` §3 says Attach / Attach Image: "The file URL is shown and editable. **No upload**". Wrong:
   `src/frappe/form/FrappeAttachField.tsx:47-62` uploads through `api.uploadFile` (`upload_file`), and
   `tests/attach.test.tsx` (6 tests, S) covers it. Also the FF header comment (`FF:16`) is correct, forms.md is stale.
2. `docs/release/COMPONENT-COMPLETION-MATRIX.md` row 27 says "no row-form dialog parity beyond the grid" — a row-form
   dialog *exists* (`FCT:190-229`, Insert Above/Below, Duplicate, Delete) but has **zero tests**.
3. Matrix row 29 says "`read_only_depends_on` TODO" and `tests/parity/dependencies.test.ts:111` is an `it.todo`, but the
   behaviour is implemented (`m/depends.ts:123`) and asserted in `ffm:121` ("read_only_depends_on sets read_only").
4. Matrix row 25 / forms.md §3 present unsupported types as "falls back to a text box" — true, but this fallback is
   **silent** (no report), unlike the expression evaluator which reports unsupported input.
6. `tests/parity/review-r1.test.ts:144` labels its block "R1 gaps (native expectation, currently failing)" but F-06 and
   C-02 pass in this run — the label is stale (C-02 is used as evidence for E7).
5. Matrix row 24 says "no … print, rename, Duplicate" — consistent with code; but `copyDoc` (Duplicate model) and
   `useDocAction().rename/remove` exist and are tested; only the form UI entry is missing.

---

## A. Field rendering

| # | Item | Status | Layer | Evidence (file:line) | Tests | Showcase | Exercised | Known limitations | Recommendation (PARTIAL/MISSING) |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Data | COMPLETE | both | `FF:261-270` (DebouncedText 500 ms / blur, maxlength 140), `FF:78-85` soft Email/Phone/URL | `ff` "dispatches fieldtypes…" (Email aria-invalid); `ff` "mandatory_depends_on is evaluated at save" (types Title); `ff` Contact First Name | `#frappe-forms` travel/contact | S (+real meta) | Name/IBAN options not validated | — |
| A2 | Link | COMPLETE | Frappe (+Core LinkInput) | `FF:181-189` → `FLF:110-208` | `ff` "searches search_link 500 ms…", "a hand-typed value … cleared", R1-F11, R1-F13; `real/sada-real` "search_link", "validate_link" (client calls) | `#frappe-forms` todo (Assigned By) | S, R (API-level only) | see §F | — |
| A3 | Select | PARTIAL | both | `FF:216-229` (newline options, blank option, translated labels, unknown current value kept) | Only indirectly: `ff` "a new ToDo gets Desk's defaults" (first option sent), `ffm` "applies df.default keywords, Select first option" | `#frappe-forms` travel / todo | S (+real meta) | No test opens the Select or picks an option at FrappeField level | Add a FrappeField Select test (pick, blank option, unknown value, Arabic label) in `tests/frappe-form.test.tsx` |
| A4 | Date | COMPLETE | both | `FF:230-234` (site `date_format` display, value `YYYY-MM-DD`) | `tests/date-display.test.tsx` (6: three formats, Arabic, round-trip pick) | `#frappe-forms` travel | U (FrappeProvider + stub transport) | no TZ conversion (none needed for Date) | — |
| A5 | Datetime | PARTIAL | both | `FF:235-236`, `toDsDatetime/fromDsDatetime` `FF:114-115` (seconds forced to `:00`) | none at FrappeField level (formatter: `parity/format` "Datetime: converted system tz -> user tz") | none | U (format only) | Edited in browser TZ; system↔user TZ while editing UNVERIFIED; seconds lost | Add dispatch test; convert via `formatContext.timeZone` on edit (`FF`), test with simulator boot |
| A6 | Time | PARTIAL | both | `FF:237-238` → `src/fields/TimeInput.tsx` (hour12 from time_format) | Core only: `fld` "TimeInput … parses leniently", "commits a normalized value on blur", "Now sets the current time" | none | U | FrappeField dispatch untested | Dispatch test in `tests/frappe-form.test.tsx` |
| A7 | Check | COMPLETE | both | `FF:214-215` (0/1), read `FF:169` | `ff` "Note: depends_on hides and shows fields" (clicks Public → dependent field appears) | `#frappe-forms` travel | S (+real meta) | — | — |
| A8 | Int / Long Int | COMPLETE | both | `FF:75,192-202` → NumberInput kind int | `ff` "dispatches fieldtypes" (Qty value 5); Core `fld` "NumberInput writes on blur … Int truncates" | none | U | — | — |
| A9 | Float | PARTIAL | both | `FF:195-197` (df.precision → float_precision) | Core `fld` NumberInput "Float rounds to precision"; format `parity/format` Float rows; Float column rendered in `rff` R1-F8 (not edited) | none | U | Frappe-level precision resolution untested | Dispatch test with `formatContext.floatPrecision` |
| A10 | Currency | PARTIAL | both | `FF:196` (df.precision → currency_precision → number format); read via `formatValue` | `ff` "dispatches fieldtypes" (read-only "1,234.50"); `parity/format` Currency rows | `#frappe-forms` travel (amount) | U | Editing path (precision, symbol adornment) untested; Currency field-specific symbol (`options` → currency field) `it.todo` in `parity/format:85` | Edit test; resolve currency from `df.options` |
| A11 | Percent | PARTIAL | both | `FF:75` kind percent | `parity/format` Percent (display only) | none | U | edit dispatch untested | Dispatch test |
| A12 | Text | PARTIAL | both | `FF:72,255-260` textarea, debounce | none | none | — | untested | Dispatch test |
| A13 | Small Text | PARTIAL | both | `FF:72,255-260` | none (rendered in Travel Request, not asserted) | `#frappe-forms` travel | S | untested | Dispatch test |
| A14 | Long Text | PARTIAL | both | `FF:72,255-260` | none | none | — | untested | Dispatch test |
| A15 | Text Editor | COMPLETE | both | `FF:249-250` RichTextEditor, read `FF:170` RichText; sanitized HTML | `ff` "loads a ToDo, edits a field…" (sends `<p>Call Ann today</p>`), R1-F4, V1 (HTML title stripped) | `#frappe-forms` todo | S (+real meta) | No mentions / image upload; `ql-editor` wrapper not reproduced | — |
| A16 | Markdown Editor | PARTIAL | both | `FF:72-73` monospace textarea | none | none | — | no preview, no markdown | Reuse `RichText`-style preview tab; test |
| A17 | HTML Editor | PARTIAL | both | `FF:72-73` monospace textarea | none | none | — | no preview, no syntax | Same as A16 with sanitized `ServerHtml` preview |
| A18 | Code | PARTIAL | both | `FF:72-73` monospace textarea `dir=ltr` | none | none | — | no syntax editor | Dispatch test; optional code editor peer |
| A19 | Password | PARTIAL | both | `FF:262` `type=password`; `m/copy.ts:29` skipped on copy | `ff` "copy_doc / amend_doc" (skip only) | none | U | `*****` mask passed through; render untested | Dispatch test asserting type=password and mask not re-sent unchanged |
| A20 | Attach | COMPLETE | Frappe | `src/frappe/form/FrappeAttachField.tsx:47-94` | `tests/attach.test.tsx` "uploads through upload_file…", "pending…refusal", "unsaved document…public", "with a value…Clear", "read-only…" | none | S | No library/link/camera source; Clear does not delete File; max_attachments not enforced client-side | — |
| A21 | Attach Image | COMPLETE | Frappe | same + `accept="image/*"` preview | `tests/attach.test.tsx` (same tests, Attach Image variants) | `#frappe-forms` contact (image) | S | as A20 | — |
| A22 | Read Only | COMPLETE | both | `m/status.ts:22,34` (ladder rung 7), read display `FF:168-176` | `ff` "searches search_link … pick validates and fetches" (Read Only `assigned_by_full_name` shows "Ann Xu"); `parity/display-status` "fieldtype Read Only" | `#frappe-forms` todo | S (+real meta), U | — | — |
| A23 | Table | COMPLETE | Frappe | `FF:153-159` → `FCT` | `ff` "Contact: Add Row creates an __islocal row…", "table events…"; `real/sada-real` "FrappeForm renders the real Sada Lifecycle … child-table rows" | `#frappe-forms` contact | S (+real meta), R (render) | see §G | — |
| A24 | Table MultiSelect | COMPLETE | Frappe | `FF:160-165` → `FrappeTableMultiSelect.tsx:38-88` | `ff` "adds rows for picked values (first Link field), validates, removes with ×" | `#frappe-forms` travel | S | Standalone test only (not inside FrappeForm); `<table>_add` not fired (Desk parity) | — |
| A25 | Dynamic Link | COMPLETE | Frappe | `FLF:221-224` | `ff` "standalone Dynamic Link searches the DocType in the sibling field…"; `parity/format` "Dynamic Link formats like a Link" | none | S/U | Validation inside a form untested; Single DocTypes (R1-F12) | — |
| A26 | Duration | COMPLETE | both | `FF:239-241` | `ff` "dispatches fieldtypes" (hours box = 1 for 3600 s); Core `fld` DurationInput (3 tests) | none | U | — | — |
| A27 | Rating | PARTIAL | both | `FF:242-246` (stored 0…1 fraction × options max) | Core `fld` "Rating: click sets…" only | none | U | the fraction mapping (Frappe-specific) is untested | Dispatch test: value 0.6 with options 5 → 3 stars; click → 0.8 |
| A28 | Color | PARTIAL | both | `FF:247-248` → ColorInput | Core `fld` "ColorInput accepts #RRGGBB only" | none | U | dispatch untested | Dispatch test |
| A29 | Signature | MISSING | — | falls to `FF:261-270` text box | none | none | — | raw base64 shown in a text box | Core `SignaturePad` (canvas → data URL) in `src/fields/`, dispatch in `FF` |
| A30 | Geolocation | MISSING | — | falls to text box (only `SHOW_WHEN_EMPTY` mention `m/fieldtypes.ts:14`) | `parity/display-status` (empty-read rule only) | none | — | GeoJSON shown as raw text | Read-only GeoJSON summary first; map needs a peer dep (Leaflet) — decision |
| A31 | Barcode | MISSING | — | falls to text box | none | none | — | — | Text input + SVG render via a peer (JsBarcode) — decision |
| A32 | JSON | PARTIAL | both | `FF:72-73` mono textarea | none | none | — | no JSON validation / pretty-print | Parse-on-blur soft-invalid like `dataOptionInvalid` |
| A33 | Phone (fieldtype) | PARTIAL | both | `FF:262` `type=tel` | none (Data+Phone option soft check untested too) | none | — | no country picker | Dispatch test; soft check as Data+Phone |
| A34 | Autocomplete | MISSING | — | falls to text box (options ignored) | none | none | — | `df.options` list / `_get_options` not used | Reuse `src/fields/autocomplete.tsx` with static options (+ `frm.set_df_property(options)`), in `FF` |
| A35 | Icon | MISSING | — | falls to text box | none | none | — | — | Icon picker over the app's icon set — low priority |
| A36 | Button | PARTIAL | both | `FF:149`; event wiring `FFV:362` (`trigger(fieldname)`) | none | none | — | Button click → event untested | Test in `ff`: Button field click runs `events[fieldname]` (and childEvents in a row) |
| A37 | HTML | PARTIAL | both | `FF:147` sanitized `options` | `parity/display-status` "HTML… stay Read when empty" (status only) | none | U | render untested; `frm.set_df_property(options)` → override path untested | Render test |
| A38 | Image | PARTIAL | both | `FF:150` (`doc[df.options]`) | none | none | — | untested | Render test |
| A39 | Heading | PARTIAL | both | `FF:148` | none | none | — | untested | Render test |
| A40 | Fold | PARTIAL | Frappe | `m/layout.ts:8,20` treated as Section Break ("UNVERIFIED for Fold's folding") | none | none | — | no "Show more" folding | Collapse everything after Fold behind a toggle in `FFV:renderSection`; test |
| A41 | Labels / descriptions / placeholders / options | PARTIAL | both | label+translate `FF:127`, description `FF:128` → FieldShell, placeholder only Data `FF:267` / Select `FF:222`; section description `FFV:576` | labels: many (`ff` uses `name: /Description/` etc.), Arabic chrome `ff` "Arabic: the form chrome is translated"; descriptions / placeholders: none | `#frappe-rtl` | S | placeholder ignored for Link (`FLF` takes `placeholder` but FF never passes it), Text, numbers; meta `__messages` absent in 15.110 getdoctype (`parity/format` it.todo) | Pass `df.placeholder` to every control; tests for description + placeholder |
| A42 | Required indicator | PARTIAL | both | `FF:130` required → FieldShell mark; missing marker `FF:132-133` (aria-invalid) | Core DataGrid `fld` "marks required empty cells"; no FrappeField-level assertion | — | U | — | Test: reqd field shows the mark and `aria-invalid` when empty; not when Read |
| A43 | Validation & error messages | PARTIAL | both | Missing Fields dialog `FFV:409-415,645-653`; soft Data validation `FF:78-85`; server error `FFV:617-620` (FrappeErrorState); `error` prop `FF:59` never fed by the form | `ff` "missing mandatory field opens Missing Fields", Contact per-row line; `parity/mandatory` (23); `ff` "dispatches fieldtypes" (Email) | `#frappe-forms` new-todo, save-error | S, U | Server `MandatoryError` / `LinkValidationError` not mapped to the offending field; Phone/URL soft checks untested | Map `FrappeError.kind` mandatory/link messages to fields (parse "Value missing for … : field"), feed `error` in `FFV:renderField`; tests with simulator 417 |
| A44 | Unsupported types handling | MISSING | Frappe | `FF:261` "Data and the string types without their own control" — silent fallback | none | none | — | not reported; user can type into e.g. Signature/Geolocation raw values | See gap #1 below: report via the form's issues banner (`FFV:622-634`) and render read-only by default |
| A45 | Metadata mapping documented | PARTIAL | docs | `docs/components/forms.md` §3 table | n/a | — | — | stale (Attach "No upload"); omits Fold/Page Break, Image's `options`, Signature etc. silent fallback | Regenerate the table from `FF` (one row per fieldtype incl. fallback behaviour) |

## B. Layout

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| B1 | Tabs (incl. inserted Details tab, bar hidden with one tab) | COMPLETE | Frappe | `m/layout.ts:28-60`; `FFV:301-307,636-643` | `ff` "Event: a Details tab first, a tab bar…"; `ffm` "inserts a Details tab…"; `parity/review-r1` F-01 | `#frappe-forms` contact | S (+real meta), U | Tab never remembered across loads | — |
| B2 | Sections (anonymous + labelled, description) | COMPLETE | Frappe | `m/layout.ts:38-43`; `FFV:555-580` | `ffm` "…anonymous sections; columns" | `#frappe-forms` | U | — | — |
| B3 | Columns (equal split) | COMPLETE | Frappe | `m/layout.ts:44-48`; `FFV:563` | `ff` "p275: a section's columns stack on a phone…"; `ffm` layout | `#frappe-forms` contact | S (+real meta) | equal widths only | — |
| B4 | Collapsible sections (+ collapsible_depends_on, forced open by missing reqd) | PARTIAL | Frappe | model `m/depends.ts:134-142`; UI toggle `FFV:309-319,569-577` | `ffm` "collapsible sections: closed by default…" (model only) | none | U | UI toggle, aria-expanded, open-on-missing after Save untested; collapse only re-evaluated at load / save (`FFV:319`), not on every change (Desk refreshes on dependency refresh) | UI test in `ff`; re-run `sectionCollapsed` for `collapsible_depends_on` on change |
| B5 | Section / Column / Tab breaks | COMPLETE | Frappe | `m/layout.ts:51-57` | `ffm` layout test; `parity/review-r1` F-01 | — | U | Page Break = Section Break | — |
| B6 | Metadata order | COMPLETE | Frappe | `m/layout.ts:51` iterates `meta.fields` in order | `ffm` "inserts a Details tab…; anonymous sections; columns" (order asserted) | — | U | — | — |
| B7 | Responsive | PARTIAL | Core+Frappe | `FFV:562-563` `grid-cols-1 sm:grid-cols-[…]`; tab list `overflow-x-auto` `FFV:638` | `ff` p275 (class assertions in jsdom) | `#frappe-forms` | U | no real-viewport e2e for the form (e2e scripts cover list/shell) | Add a form state to `e2e/stage-b-geometry.mjs` / showcase smoke at 375 px |
| B8 | Empty / hidden sections and tabs | PARTIAL | Frappe | `FFV:299-305` (hidden break, no visible control, tab permlevel read) | indirectly `p27` "…blank fields are hidden" (fields, not sections) | — | S | section/tab hiding not asserted | Test: section whose fields are all hidden disappears; tab with only permlevel-1 fields hidden for a level-0 user |

## C. Conditional logic

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| C1 | depends_on | COMPLETE | Frappe | `m/depends.ts:55-80,121`; `FFV:187` | `ff` "Note: depends_on hides and shows fields"; `ffm` "fieldname truthiness, eval…"; `parity/dependencies` (31 run); `parity/review-r1` "every expression the interpreter accepts returns what new Function returns" (270 real exprs) | `#frappe-forms` travel | S (+real meta), U | 18 core expressions unsupported by decision (D-23) | — |
| C2 | hidden | COMPLETE | Frappe | `m/status.ts:29`; `FFV:192` | `ff` "dispatches fieldtypes" (Hidden absent); `parity/display-status` 2-3 | — | U | — | — |
| C3 | mandatory_depends_on | COMPLETE | Frappe | `m/depends.ts:122`, `m/mandatory.ts:55-65` | `ff` "mandatory_depends_on is evaluated at save…"; `parity/mandatory` (mandatory_depends_on block); `ffm` "a dependency-derived reqd REPLACES the static reqd" | — | S, U | client-only (server ignores it, as Desk) | — |
| C4 | read_only_depends_on | COMPLETE | Frappe | `m/depends.ts:123` (replaces static read_only) | `ffm` "…read_only_depends_on sets read_only" | — | U | No UI test; `parity/dependencies:111` still `it.todo` (stale) | Turn the it.todo into a test |
| C5 | State-dependent mandatory (docstatus / workflow state) | PARTIAL | Frappe | Only through `mandatory_depends_on` expressions that read `doc.docstatus` / `doc.workflow_state`; mandatory check skipped when docstatus 2 `m/mandatory.ts:86` | `parity/mandatory` "docstatus 2 skips the check" | — | U | no workflow-state-specific required rules (Desk has none either) | Test an expression on `doc.workflow_state` |
| C6 | Recalculation after every change | COMPLETE | Frappe | `FFV:187` (`resolveFields` memo on every doc snapshot) | `ff` Note depends_on test (re-evaluated after click) | — | S | collapsible state not recalculated (B4) | — |
| C7 | Unsupported expressions (not silently ignored) | COMPLETE | Frappe | `m/depends.ts:84-104` (analyze at load), runtime issues `FFV:163-169`, banner `FFV:622-634` | `ff` "…an unknown global is reported, not guessed (D-23)"; `parity/review-r2` "still unsupported (reported, not guessed)"; `rff` R1-F6 | `#frappe-forms` | S, U | an unsupported `depends_on` evaluates to false (field hidden) — reported but the field disappears | — |

## D. Permissions

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| D1 | permlevel | COMPLETE | Frappe | `m/status.ts:21-36`; `FFV:189-203`; grid columns `FCT:81-95,137` | `simp` "the CLIENT given store.session renders the saved doc read-only: … the permlevel-1 field absent"; `rff` "a user without permlevel-1 read sees no Cost column"; `parity/display-status` 1 | `#frappe-permissions` | S | — | — |
| D2 | Role permissions (DocPerm × roles) | COMPLETE | Frappe | `src/frappe/services/permissions.ts`, `usePermissions` | `foundation-hooks` "roles × real ToDo DocPerm rows…"; `parity/permissions-matrix` (6 scenarios) | `#frappe-permissions` | S, U | — | — |
| D3 | read / write | COMPLETE | Frappe | `FFV:383-392`; `m/actions.ts:53` | `simp` read-only role test (no Save); `p27` "permission revoked after loading…removes Save" | `#frappe-permissions` | S | — | — |
| D4 | create | PARTIAL | Frappe | `m/actions.ts:53` (new doc: create OR write — "UNVERIFIED") | `parity/review-r1` "new document: Save" (with rights); `p27` "no Save on a new one" (no perms) | — | U | create-only / write-without-create roles untested | Test a create-only role and a write-only role on a new doc (simulator) |
| D5 | submit | COMPLETE | Frappe | `m/actions.ts:45,54` | `parity/review-r1` "no submit right: clean draft keeps Save"; `simp` "submit needs submit; cancel needs cancel" (server); `ff` Submit flow | — | S, U | — | — |
| D6 | cancel | COMPLETE | Frappe | `m/actions.ts:49`; `FFV:604` | `p27` "no Cancel on a submitted doc… without permissions"; `simp` server cancel check | — | S, U | — | — |
| D7 | amend | COMPLETE | Frappe | `m/actions.ts:51`; `FFV:608` | `p27` "…no Amend on a cancelled one"; `parity/review-r1` "cancelled: Amend, disabled when already amended" | — | U | — | — |
| D8 | User Permissions | PARTIAL | Frappe (server-side sim) | client: none beyond `ignore_user_permissions` forwarding `FLF:139`; defaults: `m/defaults.ts:4-6` (is_default UNVERIFIED, not applied) | `simp` "User Permissions … lists only rows whose Link values are allowed", "moving it to a disallowed Link value is refused" (server) | `#frappe-permissions` | S | client never pre-fills the default User Permission value (Desk does) | Load `frappe.core.doctype.user_permission.user_permission.get_user_permissions` (boot) → `DefaultsContext.userDefaults` in `FForm:85` |
| D9 | Server authoritative | COMPLETE | Frappe | client never assumes success; errors through `FFV:424-426` | `p27` "direct invocation of hidden actions: the server refuses…" (3 tests), "server-side refusal: 403 on apply_workflow…" | — | S | — | — |
| D10 | Workflow read-only (allow_edit) | COMPLETE | Frappe | `usePermissions` workflowReadOnly → `m/status.ts:33` | `foundation-hooks` "workflow state without an allow_edit role shrinks to read-only"; `p27` "a saved doc in a workflow without session.roles: read-only…" | `#frappe-workflow` | S | — | — |
| D11 | Tab hidden by permlevel | PARTIAL | Frappe | `FFV:303` | none | — | — | untested | Test in `p27` style |

## E. Defaults / fetch

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| E1 | `df.default` (keywords Today/Now/__user/user_fullname, casts, Select first option, Time now, mandatory Table row) | COMPLETE | Frappe | `m/defaults.ts:63-94,115-147` | `ffm` "applies df.default keywords…", "mandatory Table fields get one empty row…"; `ff` "a new ToDo gets Desk's defaults" | `#frappe-forms` new-todo | S (+real meta), U | browser clock (TZ UNVERIFIED); `:DocType` defaults reported, left empty `m/defaults.ts:73` | — |
| E2 | Session / user defaults | PARTIAL | Frappe | `m/defaults.ts:54-61` (`userDefaults`); `FForm:85` passes only `session.user/fullName` + app `newDocDefaults` | `ffm` "field default overrides a user default; user default by DocType for Links" | — | U | FrappeForm does not load `frappe.defaults` user defaults / User Permission `is_default` / `remember_last_selected_value` — the app must pass them | Read user defaults from boot (`src/frappe/services/boot.ts`) into `FForm` `newDoc` |
| E3 | fetch_from (+ fetch_if_empty lock) | COMPLETE | Frappe | `m/fetch.ts:34-65`; `FFV:206-211,361-377` | `ff` "…a pick validates and fetches" (assigned_by_full_name = Ann Xu); `ffm` "builds the fetch map from the real ToDo meta…"; `parity/display-status` fetch_from lock (3) | `#frappe-forms` todo | S (+real meta) | server re-fetches on save (authoritative) | — |
| E4 | Dependent link values (link_filters with `eval:` on doc fields) | COMPLETE | Frappe | `FLF:39-56,124-141` | `ff` "link_filters (client-only) and setQuery merge in Desk's order" | — | U | dependent Links are not auto-cleared when their parent changes (Desk neither) | — |
| E5 | Auto values on a new doc (default Link triggers validate_link + fetch once, `__newname`, naming) | COMPLETE | Frappe | `FFV:214-233`; `m/layout.ts:22-26` | `rff` "fetches the target of a defaulted Link without the user re-selecting it, once"; `ffm` "adds the __newname field for new documents with Prompt naming" | `#frappe-forms` new-todo | S | naming-series preview not shown | — |
| E6 | Dirty state after auto changes | PARTIAL | Frappe | fetch writes via `store.setValues` mark `__unsaved` (`m/docStore.ts:101`); defaults → new doc already dirty | `ffm` "set_value: … dirty flag" (manual set only) | — | U | no test that a fetch-driven write marks the doc dirty / "Not Saved" on a saved doc | Test: change Link on saved ToDo → fetch target written → "Not Saved" |
| E7 | Changing / clearing the linked doc | COMPLETE | Frappe | `m/fetch.ts:49-56` (null result clears link + targets; clear → "") | `parity/review-r1` "C-02: validate_link answering name:null leaves no stale fetch targets"; `ff` "a hand-typed value that does not exist is cleared on blur" | — | S, U | — | — |

## F. Link controls

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Autocomplete + server search (search_link, 500 ms, reference_doctype, page_length) | COMPLETE | Frappe (+Core LinkInput / autocomplete) | `FLF:143-148,189-207`; `src/fields/autocomplete.tsx` | `ff` "searches search_link 500 ms after typing…"; Core `fld` "searches 500 ms after typing stops…"; `real/sada-real` "search_link → value/description results" | `#frappe-forms` todo | S, R (API) | — | — |
| F2 | Filters (`link_filters`, `df.filters`, keep-empty for Link keys) | COMPLETE | Frappe | `FLF:61-78` | `ff` "link_filters (client-only) and setQuery merge…" | — | U | link_filters client-only (as 15.110) | — |
| F3 | set_query equivalent | COMPLETE | Frappe | `events.ts:95-115`, `FFV:266` (`frm.setQuery`) | `ff` R1-F13 (2 tests) | — | S, U | — | — |
| F4 | Validation (validate_link, canonical case, invalid clears, error shown) | COMPLETE | Frappe | `FLF:150-170` | `ff` pick validates; "hand-typed value … cleared"; R1-F11 (403 shown, value kept); `real/sada-real` "validate_link → canonical name + fetch values; missing → name null" | `#frappe-forms` todo | S, R (API) | — | — |
| F5 | Clear / reselect | PARTIAL | both | `FLF:152` clear → `onValidated(null)` → targets "" | Core `fld` "…clears with the × button"; model `fetchUpdates(null)` | — | U | Frappe-level clear → fetch targets cleared untested in UI | UI test in `ff` |
| F6 | Create new linked doc | PARTIAL | Frappe | `FLF:179-187`; `services.tsx:71-72` (`canCreate` defaults to `!!onCreateNew`) | Core `fld` "shows the title, an open link and action rows (create new)"; Frappe wiring untested | — | U | app must supply `onCreateNew`; no quick-entry dialog; not permission-aware by default | Default `canCreate` from the target's create right (usePermissions over `useMetaBundle(target)`); optional `FrappeQuickEntry` dialog built from `FrappeFormView` with `quick_entry` meta; tests |
| F7 | Dynamic Link | COMPLETE | Frappe | `FLF:221-224` | `ff` "standalone Dynamic Link…" | — | S | in-form validation untested | — |
| F8 | Permission-aware results | PARTIAL | Frappe | server-side via search_link; `ignore_user_permissions` forwarded `FLF:139` (`foundation-api` "searchLink: … ignore_user_permissions only when given"); open-record link always shown `services.tsx:73` | `foundation-api` test; simulator search does not apply User Permissions to search_link (verify) | — | S/U | `linkHref` shown even for select-only users unless app overrides | Hide the open link when the user lacks read on the target (usePermissions(target).can("read")) |
| F9 | Loading / empty / error states | PARTIAL | Core | `src/fields/autocomplete.tsx:110-115` ("Searching…", "Search failed", "No results"); busy on validate `FLF:203` | none | — | — | untested | Tests: slow search shows Searching…, rejected search shows failure, empty shows No results |
| F10 | Link titles (show_title_field_in_link) | PARTIAL | Frappe | `src/frappe/form/linkTitles.ts`; `FLF:172` | `ff` R1-F10 (cache scoping); `parity/format` "Link shows the cached title…" | — | U | titles for values not picked in this session need boot `link_title` / `_link_titles` from getdoc (UNVERIFIED) | Read `__link_titles` / docinfo titles from getdoc into the cache |

## G. Child tables

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| G1 | Render (columns by in_list_view / width budget) | COMPLETE | Frappe (+Core DataGrid) | `FCT:81-95,137-159` | `ff` Contact tests; `rff` R1-F8; `real/sada-real` Sada Lifecycle rows | `#frappe-forms` contact | S, R (render) | fallback when no in_list_view is UNVERIFIED | — |
| G2 | Add row (append / insert at) | COMPLETE | both | `FCT:183-184`; `m/docStore.ts:145-157` | `ff` "Contact: Add Row creates an __islocal row…"; `ffm` "new rows carry __islocal…"; Core `fld` "Desk's keyboard shortcuts insert above / below and duplicate" | `#frappe-forms` contact | S | — | — |
| G3 | Delete rows | COMPLETE | both | `FFV:344-351`; `m/docStore.ts:165-174` | `ff` "table events: … before_<table>_remove can stop a delete"; Core `fld` "adds, deletes the selection…"; `parity/review-r1` "idx stays 1..n after insert, delete and move" | — | S, U | — | — |
| G4 | Reorder | PARTIAL | both | Move Up/Down menu `src/fields/DataGrid.tsx:218-219`; `FFV:352` | `ffm`/`parity/review-r1` (docStore `moveRow` only) | — | U | no drag; UI Move untested; `<table>_move` event untested | UI test in `ff` |
| G5 | Row edit form (dialog) | PARTIAL | Frappe | `FCT:190-229` (child layout, Insert Above/Below, Duplicate, Delete, `form_render` events) | none | — | — | untested; flat sections (no tabs/collapsible in the row form) | Tests: open row (non-editable_grid child), edit, insert above, delete, events fire |
| G6 | Inline edit | COMPLETE | both | `FCT:163,171-189`; DataGrid inline editor | `ff` Contact (types Email ID in the cell); Core `fld` "edits one row inline at a time; Escape stops" | `#frappe-forms` contact | S | — | — |
| G7 | Child validation & reqd | COMPLETE | Frappe | `m/mandatory.ts:105-133`; cell invalid `FCT:158` | `ff` Contact "…Email ID is required in every row."; `parity/mandatory` child-table block (9) | — | S, U | — | — |
| G8 | Child permissions | COMPLETE | Frappe | `FCT:133-137`; `FFV:355` | `rff` R1-F8; `ff` R1-F15; `p27` "child table is read-only (no Add Row…)" | `#frappe-permissions` | S | — | — |
| G9 | Upload / download (grid CSV) | MISSING | — | none | none | — | — | Desk grid Download/Upload (grid.js) absent | Core: CSV helpers already in `src/list/io/` → `DataGrid` toolbar "Download"/"Upload" props; Frappe: map columns to child fields in `FCT` |
| G10 | Attachments in rows | PARTIAL | Frappe | `FF:204-211` (in a grid, attaches to the parent, attach.js:80-87) | none in a row context | — | — | untested | Test Attach cell in a row form uploads with parent doctype/name |
| G11 | Dirty state | COMPLETE | Frappe | `m/docStore.ts:89-91` (row ops set `__unsaved`) | `ffm` "set_value: no-op on equal values, … dirty flag…"; `ff` Contact (Not Saved implied by save) | — | U, S | — | — |
| G12 | Parent-child save | COMPLETE | Frappe | savedocs with full rows; `m/docStore.ts:196` replace | `ff` Contact "…the row is saved" (`__islocal` row with `parentfield`); `ffm` "replace() drops __unsaved / __islocal" | — | S | — | — |
| G13 | Grid flags (cannot_add_rows, cannot_delete_rows, static_rows, grid_page_length, editable_grid) | PARTIAL | Frappe | `FCT:131,161-167` | Core `fld` "read-only / cannot add / cannot delete hide their controls", "pages above 50 rows"; mapping from meta untested | — | U | — | Test each flag through `FrappeChildTable` |
| G14 | Table events (`_add`, `before_…_remove`, `_remove`, `_move`, `form_render`, `<table>_on_form_rendered`, child field events) | PARTIAL | Frappe | `FFV:333-358,276-279` | `ff` "table events: <table>_add and before_<table>_remove…" | — | S | `_move`, `form_render`, child field-change events untested | Tests |

## H. Lifecycle

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| H1 | Save | COMPLETE | Frappe | `FFV:396-431`; `FForm:116` (useSaveDoc → savedocs) | `ff` "loads a ToDo, edits a field… saves the whole document through savedocs"; `foundation-hooks` useSaveDoc | `#frappe-forms` todo | S (+real meta) | real-site save BLOCKED (matrix row 24) | — |
| H2 | Pre-save pipeline (No changes, validate / before_save, check_mandatory → Missing Fields + jump to tab) | COMPLETE | Frappe | `FFV:398,405-415` | `ff` "a clean Save shows No changes…", "validate returning false aborts", "missing mandatory field opens Missing Fields" | `#frappe-forms` new-todo | S | jump-to-tab (`scrollToField` `FFV:325-330`) untested; no actual scroll/focus to the field | Focus the first missing control |
| H3 | Submit | COMPLETE | Frappe | `FFV:399,404,422` | `ff` "saved + clean + submittable → Submit (confirm, before_submit, savedocs Submit) → Cancel" | — | S | — | — |
| H4 | Update (allow_on_submit edit on docstatus 1) | PARTIAL | Frappe | `m/actions.ts:48`; `FFV:405` (skips validate/before_save) | `parity/review-r1` "submitted: … Update only when dirty and submit right" (model) | — | U | no UI test edits an allow_on_submit field and clicks Update | `ff` test with Sales Memo + `allow_on_submit` field |
| H5 | Cancel (+ linked-doc pre-flight, Cancel All) | COMPLETE | Frappe | `FFV:433-492`; `FForm:117-142` | `ff` Submit→Cancel; R1-F5 Cancel All; R2-F3; `p27` Cancel All block (8) | — | S | — | — |
| H6 | Amend | COMPLETE | Frappe | `FFV:493-500`; `m/copy.ts:71-75`; `FForm:94-102` is_document_amended | `ff` "R1-F5: Amend makes a local copy…; disabled when already amended"; `parity/review-r2` amend block | — | S | — | — |
| H7 | State-aware primary action | COMPLETE | Frappe | `m/actions.ts:39-56` | `ffm` "follows Desk's first-match order", "re-checks the permission…"; `parity/review-r1` F-09/W-04 (8) | — | U | — | — |
| H8 | Permission visibility of actions | COMPLETE | Frappe | `FFV:383-392,604-613` | `p27` P2-1 block (6) | `#frappe-permissions` | S, U | — | — |
| H9 | Confirmations (Submit / Cancel) | COMPLETE | Frappe | `FFV:674-685` | `ff` "Permanently Submit SM-1?" + Cancel confirm | — | S | — | — |
| H10 | Loading / error | COMPLETE | Frappe | skeleton `FForm:58-72`; errors `FForm:104-106`, `FFV:617-620`; timestamp Reload | `ff` "V4: the loading state shows text after 300 ms", "a server error is shown with FrappeErrorState…", "R1-F4: a 417 timestamp conflict keeps the edits and offers Reload" | `#frappe-forms` loading / error / save-error | S | button `loading` state not asserted | — |
| H11 | Duplicate-submit prevention | PARTIAL | Frappe | `savingRef` `FFV:397,434`; buttons disabled while saving `FFV:605,608` | none | — | — | untested | Test: double click Save → one savedocs |
| H12 | Post-success behaviour (server doc replaces local, after_save → refresh → on_submit, onSaved, "Saved" notice) | COMPLETE | Frappe | `FFV:416-423` | `ff` "loads a ToDo…" (event order), "a new ToDo…" (onSaved gets real name, no __islocal) | `#frappe-forms` (onSaved line) | S | no route change for a renamed new doc (app's job via onSaved) | — |
| H13 | Ctrl/⌘+S | PARTIAL | Frappe | `FFV:506-513` | `p27` "…Ctrl+S inert" (negative only) | — | U | positive path (save / update) untested | Test |
| H14 | Unsaved-changes guard | PARTIAL | Frappe | `FFV:178-183` (beforeunload only) | none (`guardUnload={false}` in tests) | — | — | in-app navigation not guarded (no router hook) | Export `useUnsavedGuard(dirty)` for app routers; test beforeunload listener |

## I. Workflow

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| I1 | Action buttons (Actions menu) | COMPLETE | both (Core ActionBar / LifecycleBar, Frappe FrappeWorkflowActions) | `src/frappe/record/FrappeWorkflowActions.tsx`; `FForm:152-157` | `rfu` "shows the state and the allowed transitions, applies one"; `p27` "Approve path with known roles (FrappeForm)…" | `#frappe-workflow` | S, U | — | — |
| I2 | Approve / Reject / custom actions | COMPLETE | Frappe | transitions from `get_transitions` (`useWorkflow.ts`) | `p27` "FrappeForm for the Administrator…: Approve and Reject on a doc it owns" | `#frappe-workflow` | S | `condition` evaluated server-side only | — |
| I3 | Transition permissions (roles, self-approval) | COMPLETE | Frappe | `src/frappe/record/workflow.ts` | `parity/record` W-02 (5); `rfu` "hides actions the owner may not self-approve"; `simp` "transitions follow the evaluated roles…" | `#frappe-workflow` | S, U | — | — |
| I4 | State refresh after apply | COMPLETE | Frappe | `useDocAction().applyWorkflow` cache update | `rfu` "after apply, the doc cache holds the BARE doc…" | `#frappe-workflow` | U | — | — |
| I5 | Confirmation | COMPLETE | Core+Frappe | `confirm` prop; ActionBar confirm | `rfu` "shows the server's refusal when apply fails" (confirm dialog); `record` "asks for confirmation, then runs…" | `#frappe-workflow` (confirm) | U | opt-in (Desk applies immediately) | — |
| I6 | Comments on transition | NOT APPLICABLE | — | Desk 15.110 workflow actions take no comment; history is `workflow_logs` (shown by steps variant) | — | — | — | — | — |
| I7 | Unavailable transitions (none / refused / unsaved / unknown user) | COMPLETE | Frappe | FrappeWorkflowActions disabled reason, error state | `rfu` "disables the actions … while the form has unsaved edits"; `p27` "get_transitions refused (403)…", "revocation…", "unknown user…" | `#frappe-workflow` | S, U | — | — |
| I8 | Workflow replaces Save/Submit/Cancel | COMPLETE | Frappe | `m/actions.ts:40`; `FForm:148-150` | `ff` R1-F7, R3-F2; `parity/review-r1` workflow rows | — | S | — | — |
| I9 | Against a real Frappe Workflow | BLOCKED-REQUIRES-REAL-FRAPPE | — | matrix row 32 ("Sada has no Frappe Workflow"; apply is a write) | — | — | — | — | Run e2e harness on an approved site |

## J. Status / header

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| J1 | Not Saved | COMPLETE | Frappe | `FFV:520-532` via `resolveIndicator` | `ff` "…marks it Not Saved…" | `#frappe-forms` | S | — | — |
| J2 | Draft | COMPLETE | Frappe | `src/frappe/services/indicator.ts` | `frappe-indicator` "3-4. submittable: Draft and Cancelled…" | — | U | not asserted inside a form | — |
| J3 | Submitted | COMPLETE | Frappe | same | `ff` Submit test (`formSubmitted`) | — | S | — | — |
| J4 | Cancelled | COMPLETE | Frappe | same | `ff` Cancel tests (`formCancelled`) | — | S | — | — |
| J5 | Workflow state | COMPLETE | Frappe | `FFV:523-528` | `ff` R1-F7 ("Approved"); `frappe-indicator` 2/2b | `#frappe-workflow` | S, U | — | — |
| J6 | Indicator pill | COMPLETE | both | `FFV:600` Badge; `FrappeStatusIndicator` (StatusBadge) | `rfu` "FrappeStatusIndicator shows the workflow state…"; `record` "StatusBadge carries the label" | `#frappe-record` | S, U | form uses `Badge`, record layer uses `StatusBadge` (two renderings) | Use StatusBadge in `FFV:600` for one look |
| J7 | title_field | COMPLETE | Frappe | `FFV:516-519` (HTML stripped) | `ff` "V1: an HTML title field is shown as text" | `#frappe-forms` | S | — | — |
| J8 | Naming (New X, `__newname` prompt, name under title) | PARTIAL | Frappe | `FFV:296,519,598`; `m/layout.ts:22-26` | `ff` "New ToDo"; `ffm` "__newname field for … Prompt naming"; name subtitle untested | `#frappe-forms` new-todo | S, U | no naming-series select / preview; `field:` autoname relies on the field | Test subtitle; naming_series hint |
| J9 | image_field | MISSING | — | only in `src/frappe/contract.ts:86` | none | — | — | header shows no image/avatar | Avatar (Core `primitives/avatar`) from `doc[meta.image_field]` in `FFV` header; click → FrappeAttachField upload; tests |
| J10 | Header actions | PARTIAL | Frappe | `toolbarExtra` slot `FFV:121,603`; FForm puts workflow actions there `FForm:152-158` | `p27` Approve path (uses the slot) | `#frappe-workflow` | S | no built-in menu (see K) | — (see K) |
| J11 | Title updates live | PARTIAL | Frappe | title computed per render from the store snapshot `FFV:516-519` | none | — | — | untested | Test: edit title field → heading changes, Not Saved shown |

## K. Menus / actions

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| K1 | Custom buttons (`frm.add_custom_button`) | PARTIAL | Frappe | only `toolbarExtra` ReactNode; `FormController` (`events.ts:24-46`) has no addCustomButton | none | — | — | apps render their own buttons; not groupable under a dropdown | `FormController.addCustomButton(label, fn, group?)` → state in FFV rendered via Core ActionBar/DropdownMenu |
| K2 | Create dropdown (make_ from dashboard / custom) | MISSING | — | none | none | — | — | — | After K1: groups rendered as a "Create" dropdown |
| K3 | Three-dot menu | MISSING | — | none | none | — | — | — | See gap #2 (`FrappeFormMenu`) |
| K4 | Print (form) | MISSING | — | list-only `src/frappe/list/FrappePrintDialog.tsx` | — | — | — | — | See L |
| K5 | Email | MISSING | — | none | none | — | — | — | See O |
| K6 | Duplicate | PARTIAL | Frappe (model) | `copyDoc` `m/copy.ts:36-68` (exported) | `ff` "copy_doc / amend_doc…"; `parity/review-r2` R1-F5 closure | — | U | no menu entry; FrappeForm cannot be opened on an in-memory copy (only via FrappeFormView `doc`) | Menu item → `copyDoc` → `onDuplicate(copy)` / FFV `store.replace(copy)` like amend `FFV:493-500` |
| K7 | Copy to clipboard | MISSING | — | none | none | — | — | — | Menu item: `navigator.clipboard.writeText(JSON.stringify(doc))` (toolbar.js:426) |
| K8 | Rename | PARTIAL | Frappe (hook) | `useDocAction().rename` (`useDocMutations.ts:74-77`, `frappe.rename_doc`) | `parity/keys` "…a rename also removes the old doc key" | — | U | no UI; `allow_rename` not consulted | Rename dialog (Core Dialog + Input) gated by `meta.allow_rename` + write; `onRenamed(newName)` |
| K9 | Delete | PARTIAL | Frappe (hook) | `useDocAction().remove` (`frappe.client.delete`) | `foundation-hooks` "…delete removes keys"; `parity/keys` "delete: remove doc + docinfo…"; `simp` "delete is refused (no delete right)" (server) | — | U, S | no UI | Menu item with AlertDialog confirm, gated by `can("delete")`, `onDeleted` |
| K10 | Reload | PARTIAL | Frappe | `onReload` `FForm:124-129`; only reachable from the timestamp error `FFV:619` | `ff` R1-F4 | — | S | no menu entry; dirty doc not confirmed before reload | Menu item (confirm when dirty) |
| K11 | Customize | NOT APPLICABLE | — | Desk "Customize Form" is a Desk-only page; consuming apps have no equivalent route | — | — | — | — | — |
| K12 | Links (linked_with dialog) | MISSING | — | only `get_submitted_linked_docs` for cancel | none | — | — | — | Subsumed by Connections (M) |
| K13 | Remind Me | MISSING | — | none | none | — | — | — | `frappe.automation.doctype.reminder.reminder.create_new_reminder` dialog (reminders.js); simulator handler |
| K14 | Undo / Redo | MISSING | — | stated not implemented `FFV:31` | none | — | — | — | docStore history stack (undo_manager.js) + Ctrl+Z/Y; pure-model tests |
| K15 | New {DocType} | MISSING | — | none (app routes) | none | — | — | — | Menu item calling `onNew()` gated by `can("create")` |
| K16 | Menu permission-aware & configurable | MISSING | — | no menu exists | none | — | — | — | `formMenuItems()` pure function with `perms` + `exclude/extra` |

## L. Print / PDF

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Format selector | PARTIAL | Frappe (list) | `FrappePrintDialog.tsx` (Print Format / Letter Head / page size) | list tests (`simp` "download_multi_pdf: unprintable documents are left out silently…") | `#frappe-list-view` bulk print | S | not offered on the form | Reuse dialog with `names={[doc.name]}` from the form menu |
| L2 | Preview | MISSING | — | none | none | — | — | Desk print view HTML preview absent | `frappe.www.printview.get_html_and_style` → sandboxed iframe / `ServerHtml`; simulator handler returning SIMULATED HTML |
| L3 | PDF | PARTIAL | Frappe | `src/frappe/list/print.ts` `downloadMultiPdf` (server PDF) | list/simulator test above | — | S | form-level single-doc PDF (`download_pdf`) not wired | Use `frappe.utils.print_format.download_pdf` for one doc |
| L4 | print_hide | NOT APPLICABLE | — | honoured by the server renderer; the package never renders prints client-side | — | — | — | — | — |
| L5 | Loading / errors | PARTIAL | Frappe | dialog `FrappeErrorState` | list tests | — | S | form context untested | Test once wired |
| L6 | Server rendering | PARTIAL | Frappe | PDF always from server (`print.ts:1-20`) | — | — | S | HTML preview missing | L2 |
| L7 | Real print formats / letterheads | BLOCKED-REQUIRES-REAL-FRAPPE | — | simulator emits a placeholder PDF | — | — | — | — | e2e on a real site |

## M. Connections

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Connections tab | MISSING | — | `FFV:31` "Not implemented … connections" | none | — | — | — | Gap #3 |
| M2 | Linked doctypes (`meta.__dashboard`) | MISSING | — | the real 15.110 fixtures carry `__dashboard` (todo/contact/event/user/customer…), unused | none | — | — | — | Parse `meta.__dashboard` (`frappe/desk/form/meta.py:258`) |
| M3 | Counts (`get_open_count`) | MISSING | — | simulator has no `frappe.desk.notifications.get_open_count` handler | none | — | — | — | Add simulator handler (count by `fieldname` / `non_standard_fieldnames`) |
| M4 | Navigation (open list filtered by this doc / new linked doc) | MISSING | — | none | none | — | — | — | `services.linkHref` / `onOpenList(doctype, filters)` |
| M5 | Empty / loading | MISSING | — | none | none | — | — | — | — |
| M6 | Permission-aware | MISSING | — | none | none | — | — | — | Hide doctypes without read (`usePermissions` per target meta); server also filters counts — verify in `frappe/desk/notifications.py:246+` |

## N. Submission

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| N1 | Read-only after submit | COMPLETE | Frappe | `m/status.ts:31` | `ff` Submit test (Title textbox gone); `parity/display-status` 4 | — | S, U | — | — |
| N2 | allow_on_submit | PARTIAL | Frappe | `m/status.ts:32`; grid exception `m/status.ts:41`; `FCT:135` | `parity/display-status` 5 (3); `parity/display-status` "a Write cell of a Read grid…" | — | U | no UI test of editing an allow_on_submit field then Update (H4) | see H4 |
| N3 | Field exceptions (set_only_once, read_only after allow_on_submit, virtual, disabled) | COMPLETE | Frappe | `m/status.ts:21-36` | `parity/display-status` 1, 7, 8; `foundation-hooks` "boolean flags count…" | — | U | — | — |
| N4 | Cancelled read-only | COMPLETE | Frappe | `m/status.ts:31` (docstatus>0) | `parity/display-status` "docstatus 2" | — | U | — | — |
| N5 | Amended docs (amended_from, amendment_date, already-amended) | COMPLETE | Frappe | `m/copy.ts:71-75`; `FForm:94-102` | `ff` R1-F5 Amend; `parity/review-r2` (4) | — | S, U | — | — |
| N6 | Mandatory skipped for cancelled | COMPLETE | Frappe | `m/mandatory.ts:86` | `parity/mandatory` "docstatus 2 skips the check" | — | U | — | — |

## O. Email composer

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| O1 | Recipients | MISSING | — | no composer anywhere in `src/` (only `useCommunications` paging of *received* communications) | none | — | — | — | Gap #7 |
| O2 | CC / BCC | MISSING | — | — | — | — | — | — | — |
| O3 | Templates (Email Template) | MISSING | — | — | — | — | — | — | — |
| O4 | Attachments | MISSING | — | — | — | — | — | — | — |
| O5 | Preview | MISSING | — | — | — | — | — | — | — |
| O6 | Validation | MISSING | — | — | — | — | — | — | — |
| O7 | Sending state | MISSING | — | — | — | — | — | — | — |
| O8 | Server integration (`frappe.core.doctype.communication.email.make`) | MISSING | — | — | — | — | — | — | — |
| O9 | Errors | MISSING | — | — | — | — | — | — | — |

## P. Website link

| # | Item | Status | Layer | Evidence | Tests | Showcase | Exercised | Known limitations | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| P1 | "See on Website" | MISSING | — | none (Desk: `form.js:1149-1158`, `doc.__onload.is_website_generator` + `doc.route`) | none | — | — | — | Gap #9 |
| P2 | Visibility rule | MISSING | — | — | — | — | — | — | — |
| P3 | Route / URL | MISSING | — | — | — | — | — | — | — |
| P4 | Open (new tab) | MISSING | — | — | — | — | — | — | — |

---

## (1) Counts per section

| Section | Rows | COMPLETE | PARTIAL | MISSING | NOT APPLICABLE | BLOCKED |
|---|---|---|---|---|---|---|
| A Field rendering | 45 | 13 | 26 | 6 | 0 | 0 |
| B Layout | 8 | 5 | 3 | 0 | 0 | 0 |
| C Conditional | 7 | 6 | 1 | 0 | 0 | 0 |
| D Permissions | 11 | 8 | 3 | 0 | 0 | 0 |
| E Defaults / fetch | 7 | 5 | 2 | 0 | 0 | 0 |
| F Link controls | 10 | 5 | 5 | 0 | 0 | 0 |
| G Child tables | 14 | 8 | 5 | 1 | 0 | 0 |
| H Lifecycle | 14 | 10 | 4 | 0 | 0 | 0 |
| I Workflow | 9 | 7 | 0 | 0 | 1 | 1 |
| J Status / header | 11 | 7 | 3 | 1 | 0 | 0 |
| K Menus / actions | 16 | 0 | 5 | 10 | 1 | 0 |
| L Print / PDF | 7 | 0 | 4 | 1 | 1 | 1 |
| M Connections | 6 | 0 | 0 | 6 | 0 | 0 |
| N Submission | 6 | 5 | 1 | 0 | 0 | 0 |
| O Email composer | 9 | 0 | 0 | 9 | 0 | 0 |
| P Website link | 4 | 0 | 0 | 4 | 0 | 0 |
| **Total** | **184** | **79** | **62** | **38** | **3** | **2** |

Caveat on COMPLETE: every COMPLETE row is unit / simulator / recorded-response evidence only. None is real-site
verified; the only recorded-real form evidence is render-only (`real/sada-real` "FrappeForm renders the real Sada
Lifecycle document…") plus API-shape tests for search_link / validate_link / getdoc.

## (2) Gaps implementable now (Core or Frappe layer) and testable with unit tests + the in-package simulator

Ordered by user impact × cost. Layering: generic UI in Core (`src/record`, `src/fields`), Frappe wiring in
`src/frappe/form` / `src/frappe/record`, simulator handlers in `src/frappe/testing/fixtureTransport.ts`.

1. **Report unsupported fieldtypes instead of a silent text box (A29-A31, A34-A35, A44).**
   API: `FormServices.onUnsupportedFieldtype?(df)`; `analyzeFieldtypes(bundle): FieldtypeIssue[]` in
   `m/fieldtypes.ts` (with a `SUPPORTED_FIELDTYPES` set); FFV merges them into the existing issues banner; FF renders
   unsupported types as `ReadOnlyValue` (raw value) unless `FormServices.renderUnsupported` is given.
   Files: `src/frappe/form/model/fieldtypes.ts`, `src/frappe/form/model/depends.ts` (issue union or new type),
   `src/frappe/form/FrappeField.tsx`, `src/frappe/form/FrappeFormView.tsx:145-147,622-634`, `src/frappe/form/services.tsx`,
   `src/theme/messages.ts` (en+ar key), `tests/frappe-form.test.tsx`. Then real controls for Autocomplete (reuse
   `src/fields/autocomplete.tsx` with `df.options` lines) and Signature (Core canvas control).
2. **Form menu (K3, K6-K10, K15, K16) — `FrappeFormMenu`.**
   API: pure `formMenuItems({ meta, doc, perms, dirty, has }): FormMenuItem[]` (Duplicate, Copy to Clipboard, Rename,
   Delete, Reload, New, Print) + `<FrappeForm menu={{ exclude?: string[]; extra?: FormMenuItem[]; onNew?; onDuplicate?(copy);
   onRenamed?(name); onDeleted?() }} />`. Core: `src/record/RecordMenu.tsx` (DropdownMenu + confirm via AlertDialog, reuse
   `ActionBar` confirm pattern). Frappe: `src/frappe/form/FrappeFormMenu.tsx` using `copyDoc`, `useDocAction().rename /
   remove`, `onReload`, `usePermissions().can`, `meta.allow_rename`. Simulator already answers `frappe.rename_doc` and
   `frappe.client.delete` with permission checks. Files: new `src/record/RecordMenu.tsx`, `src/record/index.ts`,
   new `src/frappe/form/FrappeFormMenu.tsx`, `src/frappe/form/FrappeForm.tsx`, `src/frappe/form/FrappeFormView.tsx`
   (menu slot next to `toolbarExtra`, `store.replace(copy)` for Duplicate like `amend`), `src/frappe/form/index.ts`,
   `src/theme/messages.ts`, tests in `tests/frappe-form.test.tsx` + `tests/sim-permissions.test.tsx` (role without delete
   sees no Delete; server refusal surfaces).
3. **Connections tab (M1-M6).**
   API: `connectionsFromMeta(meta): ConnectionGroup[]` (parse `meta.__dashboard`: `fieldname`, `non_standard_fieldnames`,
   `transactions[{label, items}]`, `internal_links`); `useOpenCounts(doctype, name)` → `frappe.desk.notifications.get_open_count`;
   `<FrappeConnections doc bundle onOpenList?(doctype, filters) onNew?(doctype, defaults) />`; FFV gets an optional
   `extraTabs` / `connections` prop rendering it as the last tab. Core: `src/record/ConnectionsPanel.tsx` (groups,
   count badges, empty/loading/error). Simulator: handler counting stored docs by link field; response shape from `_get_linked_document_counts`
   (`frappe/desk/notifications.py:267+`: keys `count`, `external_links_found` with `{doctype, open_count, count}` items —
   verify the full shape before building the handler). Files: new
   `src/frappe/record/connections.ts`, `src/frappe/record/FrappeConnections.tsx`, `src/record/ConnectionsPanel.tsx`,
   `src/frappe/form/FrappeFormView.tsx` (tab list `FFV:636-643`), `src/frappe/testing/fixtureTransport.ts`,
   `tests/record-frappe-ui.test.tsx` (+ a test against the real `__dashboard` in `tests/fixtures/real-15.110/contact.en.json`).
4. **Close the untested-but-implemented gaps (test-only, cheap).** Row-form dialog (G5), Move Up/Down + `_move` (G4),
   grid flags (G13), `form_render` / child field events (G14), Update with allow_on_submit (H4/N2), duplicate-submit (H11),
   Ctrl+S positive (H13), collapsible UI (B4), hidden sections/tabs (B8, D11), Button event (A36), Select / Time / Datetime /
   Rating / Color / Percent / Float / Currency-edit / text-type dispatch (A3-A19, A27-A28), Link clear / Searching / failed /
   no results (F5, F9), fetch-driven dirty (E6), title live update (J11). Files: `tests/frappe-form.test.tsx`,
   `tests/frappe-form-model.test.tsx`, `tests/fields.test.tsx`; convert `tests/parity/dependencies.test.ts:111` it.todo.
5. **Server errors mapped to fields (A43).** API: `fieldErrorsFromFrappeError(err, bundle): Record<string, string>`
   (MandatoryError "Value missing for {doctype}: {label}", LinkValidationError "Could not find {label}: {value}" — source
   `frappe/model/base_document.py`); FFV keeps `fieldErrors` state and passes `error` to `FrappeField` (prop already
   exists `FF:59`). Files: `src/frappe/form/model/errors.ts` (new), `src/frappe/form/FrappeFormView.tsx:424-426,535-553`,
   simulator 417 responses in `fixtureTransport.ts` (MandatoryError already simulated for savedocs — verify), tests.
6. **Form-level Print (K4, L1, L3, L5; L2 simulated).** API: menu item "Print" opens `FrappePrintDialog` with
   `names={[doc.name]}` (+ `checkPrintable` for drafts); `<FrappePrintPreview doctype name format letterhead />` via
   `frappe.www.printview.get_html_and_style` in a sandboxed iframe. Files: `src/frappe/list/FrappePrintDialog.tsx` (reuse
   as-is), new `src/frappe/form/FrappeFormPrint.tsx`, `src/frappe/testing/fixtureTransport.ts` (preview handler returning
   labelled SIMULATED HTML), tests.
7. **Email composer (O1-O9).** Core `src/record/EmailComposer.tsx`: recipients/CC/BCC via `TagInput`, subject, body via
   `RichTextEditor`, attachment checklist (from `docinfo.attachments`), template picker slot, validation (≥1 recipient,
   email format via `dataOptionInvalid("Email")`), sending state, error line. Frappe `src/frappe/record/FrappeEmailComposer.tsx`:
   `frappe.core.doctype.communication.email.make` (args per `frappe/core/doctype/communication/email.py`), Email Template
   via `frappe.email.doctype.email_template.email_template.get_email_template`, contacts via `search_link`/`get_contact_list`,
   then invalidate docinfo so `FrappeTimeline` shows it. Simulator handlers that append a Communication to docinfo.
   Tests in `tests/record.test.tsx` (Core) + `tests/record-frappe-ui.test.tsx` (S).
8. **Link create-new permission default + open-link visibility (F6, F8).** `services.canCreate` default = target's
   create right (`useMetaBundle(target)` + `rolePermissions`), `linkHref` undefined without read. Files:
   `src/frappe/form/services.tsx:71-73`, `src/frappe/form/FrappeLinkField.tsx:173-187`; tests with simulator roles.
9. **Header image_field + "See on Website" (J9, P1-P4).** `FFV` header: Avatar from `doc[meta.image_field]`
   (Core `primitives/avatar`), "See on Website" link when `doc.__onload?.is_website_generator && doc.route`
   (form.js:1149-1158) or `meta.has_web_view` + published field. Files: `src/frappe/form/FrappeFormView.tsx:594-614`,
   `src/theme/messages.ts`, tests (simulator doc with `__onload`).
10. **User defaults wiring (E2, D8).** Load user defaults / default User Permissions from boot into `newDoc`. Files:
    `src/frappe/services/boot.ts`, `src/frappe/form/FrappeForm.tsx:83-87`, simulator boot payload, `tests/foundation-boot.test.tsx`.
11. **Undo / Redo (K14).** `docStore` history (`undo()`, `redo()`, snapshots per field change, cleared on replace) +
    Ctrl+Z / Ctrl+Shift+Z in `FFV:506-513`. Pure-model tests in `tests/frappe-form-model.test.tsx`.
12. **Grid CSV download/upload (G9)** and **Remind Me (K13)**: DataGrid toolbar props + child-field mapping (reuse
    `src/list/io` CSV utils); Reminder dialog over `frappe.automation.doctype.reminder.reminder.create_new_reminder`
    with a simulator handler.
13. **Custom buttons / Create dropdown (K1, K2).** `FormController.addCustomButton(label, handler, group?)`,
    `removeCustomButton`, `clearCustomButtons`; rendered by FFV with Core DropdownMenu for groups. Files:
    `src/frappe/form/events.ts:24-46`, `src/frappe/form/FrappeFormView.tsx:252-272,594-614`; tests in `ff`.
14. **Docs** — fix `docs/components/forms.md` §3 (Attach uploads; silent fallback list; Fold) and the matrix rows 25/27/29.

## (3) Gaps that need a real backend (BLOCKED-REQUIRES-REAL-FRAPPE or only provable there)

- Real write path: savedocs Save / Submit / Update / Cancel / Amend / Cancel All on a 15.110 site (matrix row 24 "save
  BLOCKED"); `apply_workflow` on a real Frappe Workflow (I9); `upload_file` limits (size, `max_attachments`, private/public).
- Print: real Print Formats, letterheads, `print_hide`, `download_pdf` / `download_multi_pdf` output and Print Settings
  (`allow_print_for_draft/cancelled`) (L7).
- Email: actual sending, Email Account selection, Jinja rendering of Email Templates, `send_me_a_copy`, read receipts.
- Connections: real `__dashboard` overrides from app hooks (`override_doctype_dashboards`), `get_open_count` permission
  filtering and the 1 s statement timeout behaviour, `external_links_found`.
- User Permissions `is_default` and `remember_last_selected_value` defaults; search_link applying User Permissions.
- Datetime editing with system time zone ≠ user time zone (A5); `show_title_field_in_link` titles from boot (F10).
- D-23 expressions from installed custom apps beyond Frappe core (only core's 270 compared); Client Scripts are out of
  scope by decision D-24 (apps must port them to `formEvents`).
- Website generator routes / `has_web_view` publication for "See on Website" URLs (P3).
- Realtime "document modified after you opened it" (`doc_update`) inside the form (stated not implemented, `FFV:31`).
