# P36e — FrappeField trace: how Frappe DocField types are implemented and consumed in @solvfast/ui

Agent T ("trace"), package `@solvfast/ui` **0.7.0-dev.5**, branch `feat/0.7.x/p36e-trace` from `feat/0.7.x/p36e-int`
@ **844cd2e**. Every line number below is from 844cd2e. Agent F edits `FrappeField.tsx` and `model/fieldtypes.ts` in
parallel; this document grades the source as it is at 844cd2e, and F reports its changes to the integrator.

Native reference: **Frappe v15.110.0** (`ab7e5ae`), read only, at `/home/frappe/lovable_bench/apps/frappe`. Evidence is the
source read for this document plus jsdom tests (`tests/trace-p36e.test.tsx`, P36E.trace.*). Server answers came from the
in-package SIMULATOR or from a transport that rejects everything. **Nothing here was checked against a real Frappe site.**

Abbreviations:
- Package (repo-relative):
  - `FF` = `src/frappe/form/FrappeField.tsx`
  - `FLF` = `src/frappe/form/FrappeLinkField.tsx`
  - `FAF` = `src/frappe/form/FrappeAttachField.tsx`
  - `FCT` = `src/frappe/form/FrappeChildTable.tsx`
  - `FTMS` = `src/frappe/form/FrappeTableMultiSelect.tsx`
  - `FFV` = `src/frappe/form/FrappeFormView.tsx`
  - `FFm` = `src/frappe/form/FrappeForm.tsx`
  - `SVC` = `src/frappe/form/services.tsx`
  - `ST` = `src/frappe/form/model/status.ts`
  - `FT` = `src/frappe/form/model/fieldtypes.ts`
  - `LY` = `src/frappe/form/model/layout.ts`
  - `DEP` = `src/frappe/form/model/depends.ts`
  - `FMT` = `src/frappe/services/format.ts`
  - `CL` = `src/frappe/client.ts`
  - `PROV` = `src/frappe/FrappeProvider.tsx`
- Native: `c/x.js:N` = `frappe/public/js/frappe/form/controls/x.js`; `layout.js`, `column.js`, `section.js` and `tab.js` sit
  in `frappe/public/js/frappe/form/`.
- CRM: `/home/frappe/sfui-dev/p36e-crm-int/frontend/src/sear_studio/…` (read only), branch `crm/p36e-int` @ 5e67559.

---

## A. Exact implementation locations

### A.1 The main FrappeField

| Path | Symbol | Responsibility | Layer | Direct dependencies |
|---|---|---|---|---|
| `src/frappe/form/FrappeField.tsx:186-364` | `FrappeField` (props `FrappeFieldProps` :56-81) | One DocField → one control. It does the following: <br>• computes the display status (:193-195); <br>• translates the label, description and placeholder (:197-198, :209); <br>• applies the mandatory mark (:200-203), the Data soft check (:201), and `maxlength` with the paste warning (:212-218); <br>• wraps the control in `FieldShell` (:219-225); <br>• dispatches by `df.fieldtype` (:228-363). | Frappe | **Core:** `FieldShell`, `NumberInput`, `TimeInput`, `DurationInput`, `LinkInput`, `ReadOnlyValue`, `Rating`, `ColorInput` (`src/fields`); `Checkbox`, `Textarea`, `Button`, `Select`, `DateField` / `DateTimeField`, `RichTextEditor` / `RichText` / `sanitizeHtml` (`src/primitives`); `useLocale` (`src/theme`). <br>**Frappe:** `useFormServices` (SVC), `useFrappeMessages`, `controlStatus` / `ladderStatus` (ST), `isEmptyValue` (DEP), `SUPPORTED_FIELDTYPES` (FT), `FrappeLinkField` / `FrappeDynamicLinkField`, `FrappeAttachField`, `FrappeChildTable`, `FrappeTableMultiSelect`. |
| `FF:119-141` | `DebouncedText` (internal) | Text that writes 500 ms after typing stops and on blur (blur only in a grid: `debounce={!onlyInput}`, FF:347, 359). | Frappe | `Textarea`, `FIELD_INPUT` |
| `FF:162-181` | `AutocompleteControl` (internal) | Autocomplete over `df.options` on `LinkInput`. | Frappe | `LinkInput`, `autocompleteOptions` (FF:146-160) |

### A.2 The fieldtype dispatch

There is **no registry**. The dispatch is a fixed chain of `if` statements plus one `switch` inside `FrappeField`. An
app cannot register a control for a custom fieldtype; a custom fieldtype lands in the read-only fallback.

| Lines | Branch |
|---|---|
| `FF:228-231` | Not in `SUPPORTED_FIELDTYPES` (`FT:141-147`): the raw value, read-only, in every status, marked `data-unsupported-fieldtype`. This covers Signature, Barcode, Geolocation, Icon and custom types. |
| `FF:234-237` | Display types: HTML, Heading, Button, Image. |
| `FF:240-252` | Table, then Table MultiSelect. |
| `FF:255-263` | Every type in status Read except Link / Dynamic Link. Check is a disabled box, Text Editor is `RichText`, Rating is read-only stars, and the rest go through `formatValue` → `ReadOnlyValue`. |
| `FF:268-276` | Link and Dynamic Link (both statuses). |
| `FF:279-290` | `NUMBER_KIND` (FF:86): Int, Long Int, Float, Currency, Percent. |
| `FF:292-300` | Attach and Attach Image. |
| `FF:301-343` | `switch`: Check, Select, Date, Datetime, Time, Duration, Rating, Color, Text Editor, Autocomplete. |
| `FF:345-350` | `TEXTAREA_TYPES` (FF:83): Small Text, Text, Long Text, Code, JSON, HTML Editor, Markdown Editor. The `MONO_TYPES` (FF:84) are monospace with `dir=ltr`. |
| `FF:351-363` | Fall-through: Data, Password (`type=password`), Phone (`type=tel`). Read Only is never Write (ST:180), so it reaches FF:259. |

The groups that decide the layout and the status live in `FT`:
- `LAYOUT_TYPES` :4;
- `DISPLAY_TYPES` :6;
- `TABLE_TYPES` :9;
- `SHOW_WHEN_EMPTY` :14;
- `SUPPORTED_FIELDTYPES` :141.

`analyzeFieldtypes` (`FT:152-158`) lists the unsupported fields for the form's issues banner (FFV:195).

### A.3 Field-specific renderers (Frappe layer)

| Path | Symbol | Responsibility | Dependencies |
|---|---|---|---|
| `src/frappe/form/FrappeLinkField.tsx:131-268` | `FrappeLinkField` | Link control. <br>• Search: `search_link`, 500 ms, FLF:165-170; the query merge order is FLF:146-163, `parseLinkFilters` :56-73 and `mergeLinkFilters` :78-95. <br>• Validation: `validate_link`, which also returns the fetch values (FLF:172-192). <br>• Titles: the cache, then `get_link_title` (FLF:194-227). <br>• Create-new rights from the target's meta (FLF:200-212). <br>• The open link (FLF:228). <br>• Read display (FLF:231-233). | `LinkInput`, `ReadOnlyValue`, `useFormServices`, `useLinkTitles`, `useFrappeMessages`, `useFrappeSettings`, `useMetaBundle` (React Query!), `rolePermissions`, `quickEntryFields`, `resolveLinkQuery` |
| `FLF:281-284` | `FrappeDynamicLinkField` | The target is `doc[df.options]`, or `getOptions(doc)`. It then renders `FrappeLinkField`. | `FrappeLinkField` |
| `src/frappe/form/linkTitles.ts:302-318` | `linkTitleCache`, `useLinkTitles` | The `DocType::name → title` cache, scoped to the provider's client and the session user. | `useFrappeClient`, `useFrappeSettings` |
| `src/frappe/form/FrappeAttachField.tsx:175-205` | `FrappeAttachField` | Attach and Attach Image. <br>• Upload, Library and Link through `useFrappeAttach` (FAF:95-173). <br>• Clear → `remove_attach` (FAF:146-162). <br>• Inside a `FrappeAttachHost`, the form is saved after an upload or a clear (FAF:181-194). | `AttachInput` (Core), `AttachDialog` (`src/record`), `useFrappeApi`, `QueryClientContext` (optional), `useAttachHost` |
| `src/frappe/form/attachHost.tsx:219-240` | `FrappeAttachHost`, `useAttachHost`, `attachSaveAction` | The form an Attach control saves (Desk's `this.frm`). | — |
| `src/frappe/form/FrappeChildTable.tsx:118-232` | `FrappeChildTable` | The Table field. <br>• Columns: `gridColumns` FCT:81-95. <br>• Cells are `FrappeField onlyInput` (FCT:150-156). <br>• The row form dialog (FCT:190-229). <br>• Standalone tables use `useLocalTableController` FCT:57-78. | `DataGrid` (Core), `Dialog`, `createDocStore`, `resolveFields`, `buildLayout`, `ladderStatus` / `controlStatus`, `usePermissions` (no query), `FrappeField` |
| `src/frappe/form/FrappeTableMultiSelect.tsx:270-320` | `FrappeTableMultiSelect` | Pills over the first Link field of the child DocType. It searches, validates and adds or removes child rows. | `TagInput` (Core), `ReadOnlyValue`, `useFormServices`, `useLinkTitles`, `useLocalTableController` |
| `src/frappe/form/FrappeFormImage.tsx:357-397` | `FrappeFormImage` | The form header's `image_field` menu (Upload / Remove). It is not a FrappeField branch. | `useFrappeAttach`, `Avatar`, `DropdownMenu` |

### A.4 Shared Core controls (`src/fields`, `src/primitives`; no Frappe import, enforced by `scripts/check-boundaries.mjs`)

| Control | Path:line | Used for |
|---|---|---|
| `FieldShell`, `FIELD_INPUT`, `FIELD_INVALID` | `src/fields/FieldShell.tsx:30, 62, 65` | label, required mark, description, error line of every field |
| `LinkInput` | `src/fields/LinkInput.tsx:99` (+ `autocomplete.tsx` `useSuggestions`, `mergeDuplicates`) | Link, Dynamic Link, Autocomplete |
| `TagInput` | `src/fields/TagInput.tsx:45` | Table MultiSelect |
| `NumberInput` | `src/fields/NumberInput.tsx:42` (+ `lib/number.ts`) | Int, Long Int, Float, Currency, Percent |
| `TimeInput` | `src/fields/TimeInput.tsx:28` (+ `lib/time.ts`) | Time |
| `DurationInput` | `src/fields/DurationInput.tsx:29` | Duration |
| `Rating` | `src/fields/Rating.tsx:28` | Rating |
| `ColorInput` | `src/fields/ColorInput.tsx:22` | Color |
| `ReadOnlyValue` | `src/fields/ReadOnlyValue.tsx:27` | every Read display; unsupported types |
| `AttachInput` | `src/fields/AttachInput.tsx:70` | Attach, Attach Image |
| `DataGrid` | `src/fields/DataGrid.tsx:69` | Table |
| `FileDropzone`, `ImageCropper`, `CameraCapture` | `src/fields/*.tsx` | inside `AttachDialog` (`src/record/AttachDialog.tsx:98`, Core `record` layer) |
| `Checkbox` | `src/primitives/checkbox.tsx:8` (Radix) | Check |
| `Select`… | `src/primitives/select.tsx:11, 17` (Radix) | Select |
| `DateField`, `DateTimeField` | `src/primitives/date-time-field.tsx:122, 256` (vendored from Sear) | Date, Datetime |
| `Textarea` | `src/primitives/textarea.tsx:6` | text and code types |
| `RichTextEditor`, `RichText`, `sanitizeHtml` | `src/primitives/rich-text-editor.tsx:144, 95, 73` | Text Editor; HTML (sanitized) |
| `Button` | `src/primitives/button.tsx` | Button |

### A.5 Metadata normalisation and adaptation

| Path:line | Symbol | What it does | Layer |
|---|---|---|---|
| `CL:337` | `toMetaBundle` | Turns the `getdoctype` response into a `MetaBundle {doctype, meta, children}` (`contract.ts:104-109`). | Frappe |
| `CL:400` | `getMetaBundle` | Calls `frappe.desk.form.load.getdoctype` and then `toMetaBundle`. | Frappe |
| `src/frappe/hooks/useDoc.ts:21-32` | `useMetaBundle` | Reads the bundle through React Query, applies `withTranslations` and caches it for 5 min. | Frappe |
| `src/frappe/services/translate.ts:20, 27` | `translateLabel`, `withTranslations` | `__()` for labels, options and descriptions (the meta's `__messages`, then the provider's dictionary). | Frappe |
| `DEP:116-127` | `resolveFields` → `EffectiveField` (DEP:107) | Evaluates `depends_on` → `hidden_due_to_dependency`, `mandatory_depends_on` → `reqd`, and `read_only_depends_on` → `read_only` (DEP:121-123). | Frappe |
| `LY:31-63` | `buildLayout` | Tabs, sections and columns (A.8). | Frappe |
| `src/frappe/form/model/fetch.ts:34, 49, 59` | `buildFetchMap`, `fetchUpdates`, `isReadOnlyByFetch` | The `fetch_from` map, the target updates, and the read lock on the target. | Frappe |
| `src/frappe/form/model/defaults.ts:84, 97, 115` | `applyDefaults`, `newChildRow`, `newDoc` | New-document and new-row defaults (Select → first option, :47-50, :77). | Frappe |
| `ST:179-203` | `ladderStatus`, `controlStatus` | Display status (C.6). | Frappe |
| `FT:152` | `analyzeFieldtypes` | Fields that have no control. | Frappe |
| CRM `components/forms/CrmEntityFormFields.tsx:46-51` | `crmEntityBundle` | Builds a bundle from the DRAFT metas (`getDraftMetas`, `data/frappe/meta/*.json`). | CRM |

### A.6 Validation and formatting

| Path:line | Symbol | Rule |
|---|---|---|
| `FF:88-116` | `dataOptionInvalid`, `splitEmails` (FF:97) | Desk's client patterns, verbatim (`utils.js:450-480`). Email, Phone, Name and URL are FLAGGED, not refused. |
| `FF:212-218` | `maxLength` / `onPaste` | `df.length` ‖ 140 for Data, Link, Dynamic Link, Password and Read Only (not Select; `c/data.js:229-238` includes Select). Singles are exempt. "Data Clipped" message. |
| `FF:171-175` | Autocomplete `accept` | A value outside the list is cleared unless `ignore_validation` (`c/autocomplete.js:132-145`). |
| `FLF:172-192` | `commit` | `validate_link`. A `null` name clears the field; the canonical name replaces the typed one; on error the value is kept and the error is shown. |
| `FTMS:290-294, 317` | `onChange`, `validate` | Duplicates are dropped and new entries are validated with `validate_link`. |
| `src/fields/lib/number.ts` | `parseLocaleNumber`, `evaluateArithmetic`, `roundNumber` | Number parsing and arithmetic (no `eval`). |
| `src/fields/ColorInput.tsx` (`isHexColor`), `src/fields/lib/time.ts` (`parseTimeText`) | | `#RRGGBB` only; `HH:mm:ss`. Anything else is cleared (`onUnparsable="clear"`). |
| `src/frappe/form/model/mandatory.ts:55, 85` | `isRequiredNow`, `checkMandatory` | The Save-time Missing Fields check (FFV:511), and in the CRM `crmMissingFields` (CrmEntityFormFields.tsx:60-65). |
| `src/frappe/form/model/errors.ts:28` | `fieldErrorsFromFrappeError` | Maps a server MandatoryError / LinkValidationError → `FrappeField.error`. |
| `FMT:326-395` | `formatValue` | The Read display of every type (`frappe.format`), through `SVC.formatValue` (SVC:85). |

### A.7 Frappe API integration used by field types

| Server method | Called from | Through | Needs |
|---|---|---|---|
| `frappe.desk.search.search_link` | `FLF:165-170` (Link / Dynamic Link), `FTMS:306-316` | `SVC:83` → `CL:520-537` | client |
| `frappe.client.validate_link` | `FLF:180`, `FTMS:317`, `FFV:287` (default link values of a new document) | `SVC:84` → `CL:436-440` | client |
| `frappe.desk.search.get_link_title` | `FLF:216-227` | `SVC:98-101` | client |
| `frappe.desk.form.load.getdoctype` (target meta, for rights / quick entry) | `FLF:208` (only for a non-Administrator session with roles, or for Quick Entry) | `useMetaBundle` → `CL:400` | client **and** a React Query `QueryClient`. The hook runs on every render, so a Link throws without a QueryClient even when nothing is fetched (trace.4). |
| `upload_file` (multipart) | `FAF:125-130` | `api.uploadFile` → `CL:539` → files transport (`CL:316`, `/api/method/upload_file`) | client with a FILE transport |
| `upload_file` (Library: `library_file_name`; Link: `file_url`) | `FAF:131-132` | `api.call` | client |
| `frappe.core.api.file.get_max_file_size` | `FAF:137` (when the uploader opens) | `api.call` | client (a failure means "no limit") |
| `frappe.core.api.file.get_files_by_search_text` | `FAF:168` → `src/frappe/record/useFormSidebarActions.ts:87-91` | `api.call` | client |
| `frappe.desk.form.utils.remove_attach` | `FAF:154` (Clear, inside a form) | `api.call` | client |
| Dynamic Link | no call of its own; its target is a sibling value (`FLF:282`) | — | — |

### A.8 Layout and display components that are not inputs

| Type | Where | Rendered by |
|---|---|---|
| Section Break, Fold, Page Break | `LY:23, 56` (`SECTION_LIKE`) | `FFV:732-757` `renderSection`. Label, description, collapsible (FFV:746-753); `sectionCollapsed` DEP:134. |
| Column Break | `LY:57` | `FFV:741`: one `div` per column. Its label and description are **not** rendered. |
| Tab Break | `LY:55`, "Details" tab `LY:52` | `FFV:410-419` visibility, plus the tab bar. |
| Heading | `FF:235` | `<h4>{label}</h4>` |
| HTML | `FF:234` | `sanitizeHtml(df.options)`, not translated or rendered as a template |
| Button | `FF:236` | `Button` → `onButtonClick(fieldname)` → the form's event (`FFV:474`) |
| Image | `FF:237` | `<img src={doc[df.options]}>`, or nothing |
| Form image (`image_field`) | `FrappeFormImage` | the header avatar menu |

### A.9 Public exports and import paths

| Import | Gives | Source |
|---|---|---|
| `@solvfast/ui/frappe` | `FrappeField`, `dataOptionInvalid`, `splitEmails`, `FrappeForm`, `FrappeFormView`, `FrappeLinkField`, `FrappeDynamicLinkField`, `FrappeChildTable`, `gridColumns`, `useLocalTableController`, `FrappeTableMultiSelect`, `FrappeAttachField`, `useFrappeAttach`, `attachUploadOptions`, `FrappeAttachHost`, `FrappeFormImage`, `FrappeFormServices`, `useFormServices`, `defaultLinkHref`, `linkTitleCache`, `useLinkTitles`, and the whole model: `resolveFields`, `ladderStatus`, `controlStatus`, `buildLayout`, `newDoc`, `applyDefaults`, `checkMandatory`, `buildFetchMap`, `fetchUpdates`, `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`, … | `src/frappe/form/index.ts:5-39` and `model/index.ts:1-27`, re-exported by `src/frappe/index.ts:54` |
| `@solvfast/ui/frappe` | `FrappeProvider`, `useFrappeClient`, `useFrappeApi`, `useFrappeSettings`, `createFrappeClient`, `FrappeError`; hooks (`useMetaBundle`, `useDoc`, `useSaveDoc`, `usePermissions`); services (`formatValue`, `translateLabel`, …) | `src/frappe/index.ts:5-8, 44-47` |
| `@solvfast/ui` (root) | the Core controls: `LinkInput`, `NumberInput`, `TimeInput`, `DurationInput`, `Rating`, `ColorInput`, `ReadOnlyValue`, `AttachInput`, `DataGrid`, `TagInput`, `FieldShell`, and primitives `Checkbox`, `Select…`, `DateField`, `DateTimeField`, `Textarea`, `RichTextEditor` | `src/index.ts:164` (`export * from "./fields"`), `:25-28`, `:63`, `:100` |
| `@solvfast/ui/frappe/testing` | `createFixtureTransport`, `withSimulatedSidebar` (SIMULATED backend, never for production) | `src/frappe/testing/index.ts` |
| `@solvfast/ui/form` | **not** FrappeField: the 0.3 react-hook-form bindings (`src/form`) | `package.json` `exports["./form"]` |

Not public: `autocompleteOptions` (FF:146), `DebouncedText`, `childMetaOf` (FCT:52). A consumer should import
`FrappeField` and the model helpers from `@solvfast/ui/frappe`, and the generic controls from `@solvfast/ui`.

---

## B. Rendering flow from metadata to UI (real call chains)

### B.0 The common prefix

**Metadata source** (one of three):
1. **Server meta.**
   - `FFm:100` `useMetaBundle(doctype)` → `useDoc.ts:25-31` `useQuery` → `CL:400` `getdoctype` → `CL:337` `toMetaBundle`.
   - Document: `FFm:102` `useDoc` (getdoc + docinfo); a new one comes from `FFm:109` `newDoc(bundle, {user, userDefaults…})`.
2. **Hand-built DocField(s)**, passed straight to `<FrappeField df>`. This is what `tests/trace-p36e.test.tsx` does.
3. **CRM DRAFT metas.**
   - `CrmEntityFormFields.tsx:46-51` `crmEntityBundle` (from `getDraftMetas`).
   - The document is synthesised at `:99`: `{doctype, name: "new-<entity>", __islocal: 1, ...values}`.

**Form path.**
1. `FFm:173-239` renders `<FrappeFormView bundle doc docinfo permissions onSave …>`.
2. `FFV:187` `createDocStore(bundle, doc, defaults)`; the document is read back with `useSyncExternalStore` (FFV:188).
3. `FFV:250` `resolveFields(meta.fields, doc, doc, evaluator, overrides)` gives the effective DocFields.
4. `FFV:252-266` `statusOf`:
   - with `permissions.displayStatus` from `usePermissions`, it uses that (`src/frappe/services/permissions.ts:214-223`);
   - otherwise it uses `ladderStatus` and then `controlStatus`;
   - without `permissions` it demotes Write → Read (FFV:262).
5. `FFV:399-402` `buildLayout(meta)` → `FFV:856` `currentTab.sections.map(renderSection)` → `FFV:741` `c.fields.map(renderField)`.
6. `FFV:711-730` `renderField` gives `<FrappeField df={eff} value={doc[f]} onChange={(v) => store.setValue(f, v, undefined, {record: true})} doc={doc} bundle status={st} error={fieldErrors[f]} table={…} {...linkProps(eff, meta.name)}>`.
7. `FFV:376-381`: `store.onFieldChange` → the form's events (`trigger(fieldname)`).

**Direct path:** `<FrappeField df value onChange [doc] [bundle] [status] …>`. The status comes from FF:194 (C.6).

**Inside FrappeField.**
- `FF:189` `useFormServices()` → `SVC:75-104`: `useFrappeApi` (PROV:30), `useFormatContext`, `useFrappeSettings`, and the `FrappeFormServices` overrides.
- `FF:193` `rowDoc`, `FF:194` status, `FF:195` None → `null`, then the dispatch (A.2).

### B.1 Data

| Hop | Location |
|---|---|
| dispatch | `FF:228` (supported) → not display / table / read / link / number / attach / switch / textarea → `FF:351-363` |
| renderer | `DebouncedText` `FF:119-141`, `<input type="text" autocomplete="off" maxLength onPaste>` (`FF:359`). `dir=ltr` for options Email / Phone / URL (`FF:356`). |
| Core control | a plain `<input>` with `FIELD_INPUT` (`FieldShell.tsx:62`). There is no Core TextInput component. |
| soft validation | `FF:201` `dataOptionInvalid(df.options, value)` → `aria-invalid` plus a screen-reader status line (`FF:361`) |
| value / change | Typing → `setDraft`; 500 ms later, or on blur → `onChange(text)` (`FF:124, 131-136`). In the form: `store.setValue` (FFV:721). |
| Read | `FF:259-262` `formatValue` (FMT:386-393; IBAN grouped) → `ReadOnlyValue` |

### B.2 Link

| Hop | Location |
|---|---|
| dispatch | `FF:268-276` builds `linkProps` (`doc: rowDoc`, `parent`, `referenceDoctype: bundle?.doctype`, `query`, `fetchFields`, `onValidated`, `formFields`, `maxLength`, `onPaste`) |
| renderer | `FLF:131` `FrappeLinkField`; target = `options ?? df.options` (`FLF:140`) |
| Core control | `LinkInput` (`src/fields/LinkInput.tsx:99`) with `search`, `onChange`, `onCommitText`, `debounceMs=500`, `actions` (create-new), `href`, `displayValue` (title) — `FLF:247-265` |
| search | `FLF:165-170` → `s.searchLink` (`SVC:83`) → `CL:520-537` `frappe.desk.search.search_link {txt, doctype, reference_doctype, page_length, filters?, query?, …}` |
| pick / typed text | `FLF:253-254` → `commit` `FLF:172-192`: <br>• `onChange(v)`; <br>• `s.validateLink(target, v, fetchFields)` (`CL:436-440` `frappe.client.validate_link`); <br>• then `onChange(r.name)` or `onChange(null)`; <br>• then `onValidated(r)`. |
| fetch_from | `FFV:481-486` `onLinkValidated` → `fetchUpdates` → `store.setValues` |
| title | cache (`FLF:194`), else `get_link_title` (`FLF:216-227`, `SVC:98-101`) |
| Read | `FLF:231-233` → `ReadOnlyValue` with `href` (rights-gated, `FLF:228`) |

### B.3 Dynamic Link

| Hop | Location |
|---|---|
| dispatch | `FF:275` → `<FrappeDynamicLinkField {...linkProps}>` |
| target | `FLF:282`: `props.doc?.[df.options]`. In the form, `doc` = the row or the document (FFV:722; a grid cell's `doc` is the row, FCT:154). Standalone without `doc`, `rowDoc` has no sibling (FF:193), so the target is "". |
| then | the B.2 chain with `options={target}`. An empty target searches nothing (`FLF:166`) and a typed value is cleared (`FLF:175`). |

### B.4 Select

| Hop | Location |
|---|---|
| dispatch | `FF:304-317` |
| options | `str(df.options).split("\n")` (`FF:305`), deduplicated, labels via `s.translate(bundle, o)` (`FF:312`). An unknown stored value is kept as an extra item (`FF:313`). |
| Core control | Radix `Select` (`src/primitives/select.tsx:11-17`). The blank option is mapped to the sentinel `"\u0000"` (`FF:306`). |
| value / change | `onValueChange` → `onChange(v === EMPTY ? "" : v)` (`FF:309`) |
| default | not FrappeField's job: `defaults.ts:47-50, 77` (first option) via `newDoc` / `newChildRow` |

### B.5 Date

| Hop | Location |
|---|---|
| dispatch | `FF:318-322` |
| Core control | `DateField` (`src/primitives/date-time-field.tsx:122-170`): a **button** with a Popover calendar. There is no text input. |
| display | `formatDisplay={(v) => s.formatValue(v, df, rowDoc)}` (`FF:322`), so the site's `dateFormat` (FMT). |
| value / change | `CalendarUI.onSelect(d)` → `onChange(toDateValue(d))` → `FF:321` `onChange(v || null)`; stored `YYYY-MM-DD`. Deselecting is ignored (`if (d)`), so **a value cannot be cleared** (P36E.trace.11). |

### B.6 Check

| Hop | Location |
|---|---|
| dispatch | Write `FF:302-303`; Read `FF:256` (a disabled box) |
| Core control | Radix `Checkbox` (`src/primitives/checkbox.tsx:8`) inside `FieldShell inline` |
| value / change | `checked={!!Number(value)}`; `onCheckedChange(c)` → `onChange(c === true ? 1 : 0)` |

### B.7 Table

| Hop | Location |
|---|---|
| dispatch | `FF:240-246` → `<FrappeChildTable df bundle parent rows onRowsChange controller={props.table} status>` |
| child meta | `bundle.children[df.options]` (`FCT:52-54`). Without it the control renders only the DocType name in red (`FCT:128`). |
| rows controller | form: `FFV:445-471` `tableController` (`store.addRow` / `deleteRows` / `moveRow` / `setValue`, plus `<table>_add` / `before_<table>_remove` events); standalone: `useLocalTableController` (`FCT:57-78`), with the same docStore row model, through `onRowsChange` → `onChange(rows)` (`FF:243`) |
| Core control | `DataGrid` (`src/fields/DataGrid.tsx:69`): columns from `gridColumns` (`FCT:81-95`), inline edit or the row form |
| cells | `FCT:150-156`: `<FrappeField onlyInput markMissing={false} doc={row} parent={parent} status={statusFor(..)} {...cellProps}>`, which recurses into the dispatch |
| row form | `FCT:190-229`: the child layout from `buildLayout(childMeta)`, a FrappeField per field |

### B.8 Attach / Attach Image

| Hop | Location |
|---|---|
| dispatch | Write `FF:292-300`; the target document is `parent ?? rowDoc` (in a grid: the parent, `c/attach.js:80-87`). Read `FF:261` (a link to the file). |
| renderer | `FAF:175-205` `FrappeAttachField` → `useFrappeAttach` (`FAF:95-173`) |
| Core control | `AttachInput` (`src/fields/AttachInput.tsx:70`): the "Attach" button, or the file row with Reload / Clear; plus `AttachDialog` (`src/record/AttachDialog.tsx:98`: My Device / Library / Link, private switch, crop, camera) |
| upload options | `attachUploadOptions` `FAF:59-69`: <br>• target `{doctype, docname, fieldname}` only when both doctype and docname are known (without a `doc`, `rowDoc.name` is "", so the upload is unattached); <br>• `image/*` for Attach Image; <br>• private unless `make_attachment_public` / `make_attachments_public`. |
| upload | `FAF:125-130` `api.uploadFile` (`CL:539`, files transport); Library / Link `FAF:131-132` `api.call("upload_file")`; max size `FAF:137` |
| value / change | `onUploaded(url)` → `onChange(url)`. Inside `FrappeAttachHost` (FFV:770, host FFV:369-373) the form is then saved (`FAF:181-184`). Clear → `onChange(null)`, then in a form `remove_attach` and save (`FAF:187-194`). |

---

## C. The actual public API

**C.1 Does FrappeField get the whole DocField or only the fieldtype?** The whole DocField: `df: EffectiveField` (FF:57;
`DEP:107`, a `FrappeDocField` plus `hidden_due_to_dependency`). It reads the following properties:
- `fieldtype`, `fieldname`, `label`, `description`, `placeholder`, `options`;
- `reqd`, `read_only`, `hidden`, `bold`, `length`, `precision`, `hide_days` / `hide_seconds`;
- `primary`, `ignore_validation`, `ignore_link_validation`, `link_filters`, `filters`, `only_select`, `ignore_user_permissions`;
- `make_attachment_public`, `fetch_from` / `fetch_if_empty` (status), `allow_on_submit`.

**C.2 Props and required inputs** (`FF:56-81`):

| Kind | Props |
|---|---|
| Required | `df`, `value`, `onChange(value)` |
| Optional context | `doc`, `parent`, `bundle`, `status` |
| Optional rendering | `onlyInput`, `markMissing` (default true), `error`, `id`, `className` |
| Optional Link | `query`, `fetchFields`, `onLinkValidated`, `formFields` |
| Optional Table | `table` (a `TableController`) |
| Optional Button | `onButtonClick` |

There are **no** `frm`, `meta` or `doctype` props.

**C.3 How context is passed.**

| Context | How |
|---|---|
| `value` / `onChange` | Controlled. The caller holds the value. FrappeField never writes to a document. |
| `doc` | The document or child row the field belongs to. It is used for Dynamic Link, Image, status and fetch locks, `link_filters` `eval:`, and the Attach target. Without it a stand-in `{doctype: bundle?.doctype ?? "", name: "", [fieldname]: value}` is used (FF:193). |
| `bundle` | It plays the role of `meta`: translations, the child metas of Table / Table MultiSelect, `reference_doctype`, and `issingle` for `maxlength`. |
| doctype | Only through `bundle.doctype` or `doc.doctype`. |
| `frm` | There is no `frm` prop. Its parts arrive separately: <br>• `status` (the permission ladder); <br>• `table` (row operations); <br>• `query` (`setQuery`); <br>• `onButtonClick` (script events); <br>• the attach host (React context `FrappeAttachHost`); <br>• the services (React context `FrappeFormServices` / `FrappeProvider`). |

**C.4 Where Link and Dynamic Link get their target.**
- Link: `df.options` (`FLF:140`); an `options` prop on `FrappeLinkField` overrides it.
- Dynamic Link: `doc[df.options]`, the value of the sibling field (`FLF:282`), or a `getOptions(doc)` prop on
  `FrappeDynamicLinkField`.
- Desk's dialog / list / page lookups (`c/dynamic_link.js:6-21`) have no equivalent. Pass `doc`.

**C.5 Where Select options come from.**
- `df.options`, split on newlines (`FF:305`). A blank line is a blank option.
- Labels are translated through `__()` with the bundle (`FF:312`).
- Not supported: `sort_options` (`c/select.js:81`); an array of `{label, value}` objects that a script sets
  (`c/select.js:63-67`, `parse_option`) — it is coerced with `String()`; the attachment list (`c/select.js:90-104`).

**C.6 Defaults, reqd, read_only, hidden, depends_on, permissions and validation.**

| Concern | FrappeField itself | Who else |
|---|---|---|
| `default` | **Not applied** (P36E.trace.10: an empty Data with `default` stays empty) | `newDoc` / `applyDefaults` / `newChildRow` (`defaults.ts:84-148`), called by `FFm:109`, `createDocStore` (FFV:187) and `docStore.addRow`. CRM: `crmNewDocValues` (CrmEntityFormFields.tsx:54-57). |
| `reqd` | Required mark (`FF:200`); `aria-invalid` when empty and `markMissing` (`FF:202`); never blocks | `checkMandatory` on Save (FFV:511); the server MandatoryError → `error` (`errors.ts:28`) |
| `read_only`, Read Only type, virtual | `ladderStatus` → Read (`ST:180-183`) → the formatted value, no input (`FF:255-263`) | — |
| `hidden` | → None → renders `null` (`FF:195`; P36E.trace.10) | — |
| `depends_on`, `mandatory_depends_on`, `read_only_depends_on` | **Not evaluated** (P36E.trace.8) | The caller must pass `resolveFields(...)` output (`DEP:116-123`): FFV:250, FCT:132, CRM CrmEntityFormFields.tsx:100 |
| permissions (permlevel, docstatus, submit, workflow, `set_only_once`) | Only through the `status` prop. Without it, the dialog ladder (no permissions) applies: **Write** unless hidden or read-only (`ST:181-184`, `FF:194`). | `FFV:252-266` (`permissions.displayStatus`). FrappeFormView **without** `permissions` is Read-only (FFV:262; rule 9). A standalone FrappeField is Write. That asymmetry is proven in P36E.trace.9. |
| `fetch_from` | Read lock while the link has a value (`controlStatus` ST:200) | the form writes the targets (FFV:481-486) |
| validation | Data soft check, `maxlength`, Autocomplete list, Link `validate_link`, number / colour / time parsing (A.6) | The server is the gate on save. |

**C.7 Can it work without a real Frappe document? Without a FrappeProvider or client?** Proven by
`tests/trace-p36e.test.tsx`. Every case uses a hand-built DocField and no `doc` / `bundle` / `status`, except where the
row says otherwise.

| Type | (a) FrappeProvider + SIMULATOR | (b) FrappeProvider + transport that rejects everything | (c1) no FrappeProvider, no QueryClientProvider | (c2) no FrappeProvider, a bare QueryClientProvider |
|---|---|---|---|---|
| Data | Renders and writes on blur. Demands nothing. (trace.1) | Same. (trace.1) | Same. (trace.1) | Same. (trace.1) |
| Select | Renders and writes the pick. Demands nothing. (trace.1) | Same. (trace.1) | Same. (trace.1) | Same. (trace.1) |
| Date | Renders the date in the default format. Demands nothing. **Cannot be cleared** (trace.11). (trace.1) | Same. (trace.1) | Same. (trace.1) | Same. (trace.1) |
| Check | Renders and writes 1 / 0. Demands nothing. (trace.1) | Same. (trace.1) | Same. (trace.1) | Same. (trace.1) |
| Link | Renders. <br>• Typing → `search_link`. <br>• Blur with text → `validate_link`; an unknown name is **cleared**. <br>• A value → `get_link_title`. (trace.2) | Renders. <br>• Search → "Search failed". <br>• Typed text → `validate_link` rejected; the value is **kept** and the error dialog shows. <br>• `get_link_title` fails silently; the name stays shown. (trace.3) | **THROWS** "No QueryClient set" (`useMetaBundle` → `useQuery`, FLF:208 runs on every render). (trace.4) | Renders. <br>• It talks to the **same-origin** `/api/method/*` through the default client (PROV:26). <br>• Search fails; the typed value is kept. <br>• The error is only `console.warn`-ed: there is no messages host (`messages.tsx:29-31`). (trace.5) |
| Attach | Renders "Attach". Opening the uploader → `get_max_file_size`. A file upload needs a file transport: the base simulator refuses it (417), and `withSimulatedSidebar` stores it. (trace.6, trace.7) | Renders. `get_max_file_size` is rejected; there is no limit and the dialog still opens. An upload fails with "no file transport" (CL:488-490). (trace.6, trace.7) | Renders. The fetch is rejected, as in (b). (trace.6) | Same as (c1). (trace.6) |
| Table (extra) | — | — | Renders from a hand-built bundle. Add Row writes `{doctype, parentfield, idx: 1, __islocal: 1}`. Demands nothing. (trace.12) | — |
| Table MultiSelect (extra) | — | — | Renders: FTMS never reaches `useMetaBundle`. Typing demands `search_link` from the same-origin client. (trace.14) | — |
| Link via `FrappeFormServices` overrides (extra) | — | — | — | Searches, validates and shows the title from **local** data. **Zero fetches.** (trace.13) |

Answers:
- **Without a real document:** yes, for every type. `rowDoc` is synthesised (FF:193). Three things degrade without a
  `doc`:
  - Dynamic Link has no target;
  - Image has no source;
  - Attach uploads unattached (trace.7).
- **Without a FrappeProvider:**
  - Data, Select, Date, Check, Attach, Table and Table MultiSelect render and work (trace.1, 6, 12, 14).
  - ThemeProvider is optional too (`useLocale` has a fallback, `ThemeProvider.tsx:196-198`). This is source-backed but
    not exercised: every test case keeps a ThemeProvider.
  - **Link and Dynamic Link need a React Query `QueryClientProvider`** (trace.4; Dynamic Link renders FrappeLinkField,
    FLF:283). Table MultiSelect does not (trace.14).
  - Without a provider, Link, Dynamic Link and Table MultiSelect silently use the page's same-origin Frappe client
    (PROV:26).
  - With `FrappeFormServices` overrides for `searchLink`, `validateLink` and `getLinkTitle`, a Link needs no server at
    all (trace.13). Two things still touch the client: `useLinkTitles`, and `useMetaBundle` for a session with roles that
    is not the Administrator. With no session, neither ever fetches.
- **Capabilities that need a live server** (or the SIMULATOR):
  - Link / Dynamic Link / Table MultiSelect: search, validation (the canonical name, clearing invalid values, fetch_from
    values), titles of title-link DocTypes, and the target's meta for create / read rights and Quick Entry.
  - Attach / Attach Image: upload, Library search, upload by link, `max_file_size`, and `remove_attach` on Clear.
  - The form around the fields: getdoctype, getdoc, savedocs, permissions, docinfo.
  - Everything else is client-only: the Data / Select / number / date / time / duration / rating / colour / check / text
    controls, layout, status, mandatory marks, `depends_on` (once the caller evaluates it), and child-table row editing.

### C.8 Real usage (file:line)

**CRM — `components/forms/CrmEntityFormFields.tsx:99-152`.** This path runs only in "simulated" / "frappe" data mode
(`:97` returns `fallback` in mock mode).

```tsx
// :99-101 — a synthesised NEW document + evaluated dependencies
const doc: FrappeDoc = { doctype: bundle.doctype, name: `new-${entity}`, __islocal: 1, docstatus: 0, ...values };
const eff = resolveFields(bundle.meta.fields, doc, doc);
// :110 — CRM routes differ from Desk: no open-record link
<FrappeFormServices value={{ linkHref: () => undefined }}>
  // :120 — status from the permission-less ladder (always Write unless read_only / hidden)
  const status = controlStatus(ladderStatus(df, doc), df, doc);
  // :126-147
  <FrappeField df={df} value={values[fieldname]} onChange={(v) => set(fieldname, v)} doc={doc} bundle={bundle}
    status={status} markMissing={showMissing} formFields={byName}
    {...(isLink ? { fetchFields: entries.map((e) => e.source), onLinkValidated: … fetchUpdates(entries, fieldname, r) … } : {})} />
```

**CRM — `data/frappe/CrmEditableCard.tsx:21-63`.** An existing document is edited through `CrmEntityFormFields` (`:48-51`)
and saved with `useSaveDoc` (`:36`). The provider is `data/frappe/client.ts:116-117` (`FrappeProvider client
session formatContext`). The client is the simulator, `createFixtureTransport` + `withSimulatedSidebar` (`client.ts:63-69`).

Finding: `CrmEditableCard` edits an **existing** document, but `CrmEntityFormFields` always passes the synthesised
`new-<entity>` document (CrmEntityFormFields.tsx:99). This has three effects:
- an Attach field in a card would upload against `new-lead`, not the record;
- `set_only_once` fields stay editable;
- the status ignores the user's permissions (`ladderStatus` without permissions, :120).

This is reported to M (the CRM owner). It is not changed here.

**Showcase.**
- `showcase/src/pages/p36d-fieldtypes.tsx:66-71` `LiveField` renders `<FrappeField df value onChange doc status error
  onButtonClick>` inside `FtProvider` (`:46-55`, FrappeProvider over a SIMULATED site).
- `showcase/src/pages/frappe/index.tsx:217-222` renders `<FrappeForm doctype="Contact" name=…>` and similar forms on the simulator.
- `showcase/src/pages/p36b-attachimage.tsx:76` renders `<FrappeForm doctype="Site Visit" name="SV-0001">`.

**Tests.**
- `tests/fieldtypes-p36d.test.tsx:58-61` (`Live`, a controlled FrappeField over the simulator).
- `tests/trace-p36e.test.tsx` `Live` / `mountIn` (the four environments).

**PROPOSED** (not used by any consumer yet; it relies only on today's public API, proven by trace.13). A Link in a
mock-mode page, with no Frappe server:

```tsx
// PROPOSED
<QueryClientProvider client={qc}>
  <FrappeFormServices value={{ searchLink: localSearch, validateLink: localValidate, getLinkTitle: localTitle, linkHref: () => undefined }}>
    <FrappeField df={draftMeta.fields.find((f) => f.fieldname === "organization")!} value={v} onChange={setV} doc={doc} status="Write" />
  </FrappeFormServices>
</QueryClientProvider>
```

Agent M is building a local services adapter under `src/frappe/form/`. That adapter is the intended home for this
pattern. Pass `status` explicitly: the default is Write (C.6).

---

## D. All 43 DocField types, re-verified

Grades are against the native control (`c/*.js`). The rules are those of FIELD-TYPES.md §0:
- **Complete**: the stored format, the Read display, the statuses and the main interaction all match. Only cosmetic or
  secondary affordances are missing.
- **Partial**: a native behaviour that changes data, validation or the main interaction is missing. A Data option is
  graded as its native control (`ControlData` + the option), so FT-01's gaps apply to every option.
- **Missing**: no control.

A showcase entry, a placeholder, a type in `SUPPORTED_FIELDTYPES` or a shallow render test does not count.

Totals for the 43 DocField types: **15 Complete · 24 Partial · 4 Missing**. P36d had 22 · 17 · 4. Data options:
**0 Complete · 6 Partial**; P36d had Email and Phone Complete.

| Field Type | Status | Actual Renderer | Source File | Core/Frappe | Validation | Real Frappe Dependency | Tests | Native spec |
|---|---|---|---|---|---|---|---|---|
| Data | Partial | `DebouncedText` `<input type=text>` | FF:351-363, 119-141 | Frappe over a plain input | maxlength 140 (FF:212); server `bd:981-1014` | none | P36D.fieldtypes.2; P36D.fields.1-4; trace.1 | `c/data.js:3-321` |
| ↳ Data (Email) | Partial | same, `dir=ltr` | FF:356, 108-116 | Frappe | soft: every `split_emails` address (FF:111) | none | P36D.fields.1-3 | `c/data.js:293-306` |
| ↳ Data (Name) | Partial | same | FF:113 | Frappe | soft: `NAME_RE` (ASCII `\w`, as Desk) | none | P36D.fields.2 | `c/data.js:290-292` |
| ↳ Data (Phone) | Partial | same, `dir=ltr` | FF:112 | Frappe | soft: `PHONE_RE` | none | P36D.fields.1-2 | `c/data.js:287-289` |
| ↳ Data (URL) | Partial | same, `dir=ltr` | FF:114 | Frappe | soft: `URL_RE` | none | P36D.fields.2 | `c/data.js:70-122, 307-309` |
| ↳ Data (Barcode) | Partial | same | FF:351-363 | Frappe | none (as Desk) | none | P36D.fieldtypes.2 | `c/data.js:73-75, 146-173` |
| ↳ Data (IBAN) | Partial | same; Read grouped (FMT:388-391) | FF:351-363 | Frappe | none client-side | none | P36D.fieldtypes.2 | `c/data.js:76-78, 124-128, 268-278` |
| Small Text | Complete | `DebouncedText multiline` → `Textarea` | FF:345-350 | Core Textarea + Frappe | — | none | FV.A12-A14 (`frappe-fieldtypes`); P36D.fieldtypes.2 | `c/text.js:18-23` |
| Text | Complete | same | FF:345-350 | same | — | none | same | `c/text.js:1-16` |
| Long Text | Complete | same | FF:345-350 | same | — | none | same | `c/text.js:17` |
| Text Editor | Partial | `RichTextEditor` / `RichText` | FF:337-338, 257 | Core primitive + Frappe | sanitize on render | none | P36D.fieldtypes.7 | `c/text_editor.js:136-401` |
| Markdown Editor | Partial | mono `Textarea` | FF:345-350 | Core + Frappe | — | none | FV.A16-A18 | `c/markdown_editor.js:1-104` |
| HTML Editor | Partial | mono `Textarea` | FF:345-350 | Core + Frappe | — | none | same | `c/html_editor.js:1-15` |
| Code | Partial | mono `Textarea dir=ltr` | FF:345-350 | Core + Frappe | — | none | same | `c/code.js:1-255` |
| JSON | Partial | mono `Textarea` | FF:345-350 | Core + Frappe | none (no parse check) | none | same | `c/json.js:1-6` |
| Password | Partial | `<input type=password>` | FF:355 | Frappe | maxlength | none (strength would need `test_password_strength`) | FV.A19 | `c/password.js:1-109` |
| Read Only | Complete | `ReadOnlyValue` (always Read, ST:180) | FF:259-262 | Core + Frappe | — | none | FV.A22; P36D.fieldtypes.13 | `c/data.js:323` |
| Select | Partial | Radix `Select` | FF:304-317 | Core primitive + Frappe | none client-side (as Desk) | none | FV.A3; P36D.fieldtypes.4; trace.1 | `c/select.js:1-185` |
| Autocomplete | Partial | `AutocompleteControl` → `LinkInput` | FF:162-181, 339-340 | Core + Frappe | value ∈ list unless `ignore_validation` | none (no `get_query`) | FV.A34 ×3; P36D.fieldtypes.4 | `c/autocomplete.js:1-244` |
| Link | Partial | `FrappeLinkField` → `LinkInput` | FF:268-276; FLF | Frappe over Core | `validate_link` | **search_link, validate_link, get_link_title, getdoctype (target)** | P36D.fieldtypes.8; linkinput-p36b/c/d; P36D.fields.7-10; trace.2-5, 13 | `c/link.js:10-853` |
| Dynamic Link | Partial | `FrappeDynamicLinkField` → `FrappeLinkField` | FLF:281-284 | Frappe | as Link | as Link | P36D.fieldtypes.9 | `c/dynamic_link.js:1-32` |
| Check | Complete | Radix `Checkbox` | FF:302-303, 256 | Core + Frappe | 0/1 | none | FV.A7; P36D.fieldtypes.4; trace.1 | `c/check.js:1-45` |
| Int | Complete | `NumberInput kind=int` | FF:279-290 | Core + Frappe | arithmetic, truncation | none | FV.A8-A11; P36D.fieldtypes.3; P36D.fields.5 | `c/int.js:1-43` |
| Long Int *(not a DocField option)* | Complete | same | FF:86 | Core + Frappe | same | none | P36D.fieldtypes.3 | `c/int.js:45` |
| Float | Partial | `NumberInput kind=float` | FF:279-290 | Core + Frappe | precision | none | FV.A8-A11; P36D.fieldtypes.3 | `c/float.js:1-27` |
| Currency | Partial | `NumberInput kind=currency` | FF:279-290 | Core + Frappe | currency precision | none | same | `c/currency.js:1-15` |
| Percent | Complete | `NumberInput kind=percent` | FF:279-290 | Core + Frappe | precision | none | same | `c/float.js:28` |
| Rating | Complete | `Rating` (×max ↔ 0…1 fraction) | FF:330-334, 258 | Core + Frappe | clear unless reqd | none | FV.A27; P36D.fieldtypes.6 | `c/rating.js:1-117` |
| Duration | Complete | `DurationInput` (seconds) | FF:327-329 | Core + Frappe | — | none | DurationInput ×3; P36D.fieldtypes.5 | `c/duration.js:1-166` |
| Date | Partial | `DateField` (calendar button) | FF:318-322 | Core primitive + Frappe | — | none | date-display ×3; P36D.fieldtypes.5; trace.1, 11 | `c/date.js:1-196` |
| Datetime | Partial | `DateTimeField` | FF:323-324 | Core primitive + Frappe | — | none | FV.A5; P36D.fieldtypes.5 | `c/datetime.js:1-102` |
| Time | Partial | `TimeInput` | FF:325-326 | Core + Frappe | unparsable → cleared | none | FV.A6; P36D.fieldtypes.5 | `c/time.js:1-112` |
| Phone | Partial | `<input type=tel>` | FF:355 | Frappe | none | none (the country list would need `get_country_timezone_info`) | FV.A33 | `c/phone.js:1-237` |
| Color | Partial | `ColorInput` | FF:335-336 | Core + Frappe | `#RRGGBB` else cleared | none | FV.A28; P36D.fieldtypes.6 | `c/color.js:1-117` |
| Attach | Complete | `FrappeAttachField` → `AttachInput` + `AttachDialog` | FF:292-300; FAF | Frappe over Core | max size (server) | **upload_file, get_max_file_size, get_files_by_search_text, remove_attach** | attach.test ×6; P36B.attachimage.*; P36D.fieldtypes.10; trace.6-7 | `c/attach.js:1-151` |
| Attach Image | Complete | same, `image/*` | FF:292-300; FAF:67 | Frappe over Core | same | same | same | `c/attach_image.js:1-24` |
| Image | Complete | `<img src={doc[options]}>` | FF:237 | Frappe | — | none | FV.A38; P36D.fieldtypes.12 | `c/image.js:1-23` |
| Signature | Missing | read-only raw value | FF:228-231 | Frappe | — | — | P36D.fieldtypes.15 | `c/signature.js:1-139` |
| Barcode | Missing | read-only raw value | FF:228-231 | Frappe | — | — | P36D.fieldtypes.15 | `c/barcode.js:1-79` |
| Geolocation | Missing | read-only raw value | FF:228-231 | Frappe | — | — | P36D.fieldtypes.15 | `c/geolocation.js:1-258` |
| Icon | Missing | read-only raw value | FF:228-231 | Frappe | — | — | P36D.fieldtypes.15 | `c/icon.js:1-101` |
| Table | Partial | `FrappeChildTable` → `DataGrid` | FF:240-246; FCT | Frappe over Core | mandatory rows (mandatory.ts) | none (child meta from the bundle) | frappe-form Contact; P36D.fieldtypes.11; trace.12 | `c/table.js:1-158`, `form/grid.js` |
| Table MultiSelect | Partial | `FrappeTableMultiSelect` → `TagInput` | FF:247-252; FTMS | Frappe over Core | `validate_link`, duplicates dropped | **search_link, validate_link** | frappe-form "adds rows…"; P36D.fieldtypes.11 | `c/table_multiselect.js:1-179` |
| Section Break | Complete | `renderSection` | LY:56; FFV:732-757 | Frappe | — | none | frappe-form-model; FV.B4; P36D.fieldtypes.12 | `layout.js:182-184`, `section.js` |
| Column Break | Partial | a column `div` | LY:57; FFV:741 | Frappe | — | none | P36D.fieldtypes.12 | `layout.js:185-187`, `column.js:22-36` |
| Tab Break | Complete | tab bar + panels | LY:52-55; FFV:410-419 | Frappe | — | none | frappe-form "Event: a Details tab…"; P36D.fieldtypes.12 | `layout.js:188-190`, `tab.js` |
| Fold | Partial | treated as a Section Break | LY:23 | Frappe | — | none | P36D.fieldtypes.12 | `layout.js:175-177, 270-295` |
| Heading | Complete | `<h4>` | FF:235 | Frappe | — | none | FV.A39 | `c/heading.js:1-5` |
| HTML | Partial | `sanitizeHtml(df.options)` | FF:234 | Core sanitizer + Frappe | sanitized | none | FV.A37 | `c/html.js:1-33` |
| Button | Partial | `Button` → `onButtonClick` | FF:236; FFV:474 | Core + Frappe | — | none (no `run_doc_method`) | FV.A36 | `c/button.js:1-69` |
| Page Break *(not a DocField option)* | Partial † | treated as a Section Break | LY:23 | Frappe | — | none | — | `layout.js:178-181, 266-268` |

† FIELD-TYPES.md and the showcase data keep `n/a` for Page Break. It is not a DocField option, and P36D.fieldtypes.1
(not T's file) pins `n/a`. Graded on behaviour it would be Partial: no `.page-break` separator.

### D.1 What each Partial type is missing (native file:line)

- **Data**:
  - the duplicate-name check on the `autoname: field:<this>` / `__newname` input (`c/data.js:189-227`, a validation message);
  - `with_copy_button` (`:130-144`);
  - `input_css` / `input_class` (`:248-253`);
  - the `translatable` globe (`c/base_control.js:146-182`).

  P36d's paste warning and `maxlength` are now present (FF:212-218). Select has no `maxlength` (`c/data.js:230`
  includes Select).
- **Data (Email / Name / Phone)**: only FT-01's gaps. The option's own check is verbatim.
- **Data (URL)**: the open-link button (`c/data.js:81-122`); the Read display as a link (`formatters.js:37-40`; FF:261
  gives `href` only to Attach).
- **Data (Barcode)**: the Scan button (`c/data.js:146-173`).
- **Data (IBAN)**:
  - grouping in the input (`c/data.js:268-273`);
  - the spaces are **stored** (no `parse` strip, `:274-279`), so data changes;
  - no client check.
- **Text Editor**:
  - Quill mentions (`c/text_editor.js:250-285`);
  - image insert and upload (`:158-182`);
  - tables;
  - the `ql-editor` wrapper on the stored value (`:343-357`).
- **Markdown / HTML Editor, Code, JSON**:
  - the Ace editor with syntax colouring and the `options` language (`c/code.js:40-115, 183-213`);
  - the copy button (`:12-38`);
  - the preview (`c/markdown_editor.js:48-60`, `c/html_editor.js:9-15`);
  - image drop (Markdown);
  - JSON validity.
- **Password**: the show / hide toggle (`c/password.js:36-53`); the strength meter (`:59-84`, a server call).
- **Select**:
  - `sort_options` (`c/select.js:81, 118-120`);
  - options given as `{label, value}` objects (`:63-67, 117`);
  - the attachment-list options (`:90-104`);
  - `maxlength` (`c/data.js:230`).
- **Autocomplete**: `get_query` / `set_query` (a server query, `c/autocomplete.js:169-232`); `set_data` (`:237-244`).
- **Link**:
  - Advanced Search (`c/link.js:165-174, 347-360`);
  - the filter description in the list (`:309-320`);
  - translated values for `boot.translated_doctypes` (`:111-116`);
  - custom `link_options` (`:338-345`).
- **Dynamic Link**: Link's gaps; a Single DocType target is not refused (`c/dynamic_link.js:26-28`).
- **Float**: with `options`, the input uses that currency's number format (`c/float.js:15-20`).
- **Currency**: the edit format ignores the field's currency (`c/float.js:15-20`, `c/currency.js:2-14`; display OK,
  FMT:357-361).
- **Date**:
  - no typed entry (`DateField` is a button; `c/date.js` is a text input with `parse` / `validate` :156-179);
  - **a value cannot be cleared** (P36E.trace.11);
  - the `t` key for today (`:138-154`);
  - `options` JSON for the datepicker (`:180-195`).
- **Datetime**:
  - Date's typed-entry and clear gaps;
  - user ↔ system time zone while editing (`c/datetime.js:47-60`);
  - the seconds are forced to `:00` (FF:184).
- **Time**: the `t` key (`c/date.js:138-154`).
- **Phone**: the country picker and the stored `+isd-number` (`c/phone.js:92-187`). The server rejects a number without a
  country code (`utils/__init__.py:101-125`).
- **Color**: the picker popover with swatches (`c/color.js:10-84`); the Read swatch (`formatters.js:390-397`).
- **Table**:
  - paste from a spreadsheet (`c/table.js:19-117`);
  - drag reorder (P35 A-form G4);
  - grid Download / Upload (G9);
  - the untested row form / flags / events (G5, G13, G14).
- **Table MultiSelect**:
  - no "Create a new" / Advanced Search entries (it is a ControlLink, `c/link.js:323-360`);
  - its own `link_filters` / `filters` are not applied (FTMS:306-316).
- **Column Break**: its label and description (`column.js:22-36`).
- **Fold**: the "Show more details" toggle (`layout.js:270-295`).
- **HTML**:
  - Desk renders `df.options` through `__()` and `frappe.render` as a template, unsanitized (`c/html.js:10-18`);
  - scripts write `$wrapper` (`:19-31`).
- **Button**:
  - `options` → `run_doc_method` (`c/button.js:20-48`);
  - `btn_size` (`:9`);
  - `df.click` outside a form (`:29-31`).

Complete types still carry these cosmetic or secondary gaps:
- Small Text / Text: `max_height`, `translatable`.
- Image: the missing-image placeholder (`c/image.js:16-20`).
- Section Break: `hide_border`, and the remembered collapse state (`section.js:13-19`).
- Tab Break: `show_dashboard`.
- Attach: script-set `df.options` upload options (`c/attach.js:89-91`) and Google Drive.
- Percent: UNVERIFIED on a site whose default currency has its own number format (`c/float.js:15-20` applies to
  Percent too).

### D.2 What changed against FIELD-TYPES.md, and why

| Row | P36d | Now | Why |
|---|---|---|---|
| Data | Complete | Partial | Validation hint (`c/data.js:189-227`) and `with_copy_button` missing |
| Data (Email), Data (Phone) | Complete | Partial | Graded as the native ControlData: FT-01's gaps apply. The DS input is `type=text` (FF:355), not `email` / `tel`. |
| Link | Complete | Partial | Advanced Search, filter description, translated values |
| Dynamic Link | Complete | Partial | Link's gaps + the Single check |
| Float | Complete | Partial | the same currency-format gap that already made Currency Partial |
| Table | Complete | Partial | spreadsheet paste; P35 §G G4 / G9 |
| Table MultiSelect | Complete | Partial | the ControlLink list entries; its own filters |
| Column Break | Complete | Partial | label and description not rendered |
| Date, Datetime (still Partial) | — | — | new gaps: no typed entry, cannot be cleared |

FIELD-TYPES.md got a "P36e corrections" section, new totals in §1 and the new statuses in §2. Its `FF:N` line numbers are
from 6ea5eb9 and **stale**; this document cites 844cd2e.

### D.3 Signature, Barcode, Geolocation, Icon

`grep -rniE "signature|barcode|geolocation|jsbarcode|leaflet|geojson|icon.?picker"` over `src/`, `showcase/src`
(outside the P36d field-type pages) and `playground` finds **no implementation**. Only these mentions exist:
- type lists (`src/frappe/meta.ts:27-28` SKIP for list columns; `FT:14` SHOW_WHEN_EMPTY);
- the Map view's "not implemented" reason (`src/frappe/views/availableViews.ts:87-88`);
- comments.

None of the four is implemented elsewhere, and none is implemented but disconnected. All four are **truly missing**:
`SUPPORTED_FIELDTYPES` excludes them, and FF:228-231 shows the raw stored value read-only (P36D.fieldtypes.15). Neither
`package.json` dependencies nor `node_modules` contain a signature, barcode or map library.

| Type | Native stored value | Native library | Producing it in the DS |
|---|---|---|---|
| Signature | A **PNG data URL** (`data:image/png;base64,…`): `jSignature("getData")` with the default export plugin = `canvas.toDataURL()` (`frappe/public/js/lib/jSignature.min.js:1221, 1404`), stored by `on_save_sign` → `set_value(base64_img)` (`c/signature.js:130-135`). Reset stores `""` (`:125-128`). Loaded back with `setData(value)` (`:93`). | jSignature (vendored, `c/signature.js:13`) | **No third-party library needed**: a pointer-events canvas + `toDataURL("image/png")`. Read = `<img src>` (`:70-78`). Desk's pad height is 200 px (`:33-40`). |
| Barcode | **SVG markup**: JsBarcode renders into `<svg>`, then `data-barcode-value=<text>` and `width="100%"` are set, and the wrapper's HTML is stored (`c/barcode.js:44-57`, `get_barcode_html`). `parse` converts typed text to that SVG (`:14-23`); a value already starting `<svg` is kept, and a loaded plain value is converted in place (`:25-42`). `df.options` is JSON JsBarcode options (`format`, EAN → EAN8 / EAN13, `valueField`, `:59-78`). | `jsbarcode` ^3.11 (`frappe/package.json:57`; `c/barcode.js:1`) | **Needs a barcode encoder.** JsBarcode, or an equivalent SVG generator, as an optional peer. Byte-for-byte equality with Desk's SVG needs JsBarcode itself. |
| Geolocation | A **GeoJSON FeatureCollection string**: `JSON.stringify(this.editableLayers.toGeoJSON())` on draw / edit / delete (`c/geolocation.js:207-222`, i.e. :215, :221). Circles add `properties.point_type` / `radius` (`:117-143`). Shown even when empty (`FT:14`). | Leaflet + leaflet.draw + L.Control.Locate + easy-button (`frappe/public/js/libs.bundle.js:3-6`) | **Needs a map library** to draw and edit; a read-only summary (feature count, the first point) needs none. |
| Icon | **The icon name string** from the Frappe sprite (`#icon-<name>` symbols, `c/icon.js:11-16`); the picker's `on_change` → `set_value(icon)` (`:51-53`); the empty value falls back to "folder-normal" for display only (`:98-100`). | Frappe's own `icon_picker` + the SVG sprite (`c/icon.js:1`) | **No third-party library**, but it needs the **Frappe icon set**: the DS uses lucide, whose names differ. A free-text input with a preview of known names is possible without the sprite. |

Agent F is implementing some of these in parallel (`feat/0.7.x/p36e-ftypes`). The table above grades 844cd2e. When F's
types land:
- `SUPPORTED_FIELDTYPES` changes;
- P36D.fieldtypes.1 / .15 / .16 (MISSING ⇔ unsupported, four unsupported rows) need the integrator's update;
- the showcase data and FIELD-TYPES.md must move together, as P36E.trace.20 enforces.

---

## E. Showcase honesty

Each type falls into one of four kinds of evidence:

| Kind | What it means | Types |
|---|---|---|
| **Real functional implementation (client-only)** | The control works in any React app without a server. The showcase shows the real control. | Data (+ 6 options), Small / Long Text, Text, Text Editor, Markdown / HTML Editor, Code, JSON, Password, Read Only, Select, Autocomplete, Check, Int, Long Int, Float, Currency, Percent, Rating, Duration, Date, Datetime, Time, Phone, Color, Image, Heading, HTML, Button (the click event only), Table (rows, row form), Section / Column / Tab Break, Fold, Page Break |
| **Frappe-layer integration, request shapes exercised on the SIMULATOR only** | Real code that calls whitelisted methods; in the showcase and the tests the answers come from `createFixtureTransport`. | Link, Dynamic Link, Table MultiSelect (search_link / validate_link / get_link_title), Attach, Attach Image (upload_file, get_max_file_size, file search, remove_attach) |
| **Showcase-only demonstration** | Exists only to show a state. | The "FT Demo" document and its values (`p36d-fieldtypes.tsx:57-60`); the 1.5 s latency "Loading" card; the server-error strings in `SAMPLES[*].serverError` (written by hand, not produced by a server); the Button counter (`p36d-fieldtypes.tsx:71`) |
| **Real Frappe integration** | Verified against a real site. | **None.** RULES: no site access. Nothing is claimed. |

The four Missing types are shown as they really render today: a read-only raw value. That fallback is real behaviour,
not a mock-up of a future control.

Changes to `showcase/src/pages/p36d-fieldtypes-data.ts` (statuses, `ds` and `gap` strings only):
- Statuses now equal FIELD-TYPES.md §2.
- The `ds` strings of Data (Email / Phone / URL) said `type=email` / `type=tel` / `type=url`. The source renders
  `type=text` (FF:355, P36d). They now say `type=text, dir=ltr, Desk's soft check`.
- The gap of Data (Name) said "No soft check". The check exists (FF:113).
- The gap of Data said "paste-clipped warning". It exists (FF:213-218).
- Link, Dynamic Link, Table MultiSelect, Attach and Attach Image now say "server calls SIMULATED in the showcase".
- Every demoted row and the Date / Datetime rows list the gaps above, in English and Arabic.

Consistency: P36E.trace.20 parses the §2 matrix of FIELD-TYPES.md and requires the same FT ids with the same statuses as
`FIELD_TYPES`. P36E.trace.21 requires the §1 totals lines to equal the counts in the data. The page's counters
(`p36d-fieldtypes.tsx:127-142`) read the same data, so the page, the data and the audit cannot drift.

---

## Architecture

```
 metadata                         form engine (src/frappe/form)                  field (Frappe layer)            Core (src/fields, src/primitives)
 ────────                         ────────────────────────────                  ────────────────────            ─────────────────────────────────
 getdoctype ─► toMetaBundle ─┐
 (CL:400, 337) useMetaBundle │    FrappeForm (FFm:97) ── useDoc / usePermissions / useSaveDoc
 hand-built DocField ────────┼──► FrappeFormView (FFV:182)
 CRM draft metas ────────────┘      createDocStore ─ value store, row model, history (FFV:187)
                                    resolveFields ─ depends_on / mandatory / read_only (FFV:250)
                                    statusOf ─ permissions.displayStatus | ladder+control (FFV:252)
                                    buildLayout ─ Tab / Section / Column / Fold (LY:31)
                                    renderField (FFV:711) ───────────────────► FrappeField (FF:186)
                                    linkProps / tableController / AttachHost      │ status (FF:194) · label/translate
                                                                                  │ mandatory mark · soft check · maxlength
                                    direct use (CRM, showcase, tests) ──────────► │ dispatch by df.fieldtype (FF:228-363)
                                                                                  ├─ Data/Password/Phone ─────────────► <input> + FieldShell
                                                                                  ├─ text/code types ─────────────────► Textarea
                                                                                  ├─ numbers ─────────────────────────► NumberInput
                                                                                  ├─ Check / Select / Date(time) ─────► Checkbox / Select / DateField
                                                                                  ├─ Time / Duration / Rating / Color ► TimeInput / DurationInput / Rating / ColorInput
                                                                                  ├─ Text Editor / HTML ──────────────► RichTextEditor / sanitizeHtml
                                                                                  ├─ Link / Dynamic Link ─► FrappeLinkField ─► LinkInput
                                                                                  │     └ useFormServices ─► FrappeApi ─► search_link / validate_link / get_link_title
                                                                                  ├─ Attach(Image) ─► FrappeAttachField ─► AttachInput + AttachDialog
                                                                                  │     └ useFrappeAttach ─► upload_file / get_max_file_size / remove_attach
                                                                                  ├─ Table ─► FrappeChildTable ─► DataGrid ─► FrappeField (cells, recursive)
                                                                                  ├─ Table MultiSelect ─► FrappeTableMultiSelect ─► TagInput
                                                                                  ├─ Heading / Button / Image ────────► h4 / Button / img
                                                                                  └─ unsupported (Signature, Barcode, Geolocation, Icon) ─► ReadOnlyValue (raw)
 services: FrappeProvider (client, session, formatContext, translations, messages host) ─► useFormServices (SVC:75) ◄─ FrappeFormServices overrides
 transport: fetch /api/method/* (CL:254) │ createFixtureTransport (SIMULATED) │ any FrappeTransport
```

## File map

| Area | Files |
|---|---|
| Field dispatch | `src/frappe/form/FrappeField.tsx` |
| Field renderers (Frappe) | `src/frappe/form/FrappeLinkField.tsx`, `linkTitles.ts`, `FrappeAttachField.tsx`, `attachHost.tsx`, `FrappeChildTable.tsx`, `FrappeTableMultiSelect.tsx`, `FrappeFormImage.tsx`, `FrappeQuickEntry.tsx` (Link "Create a new") |
| Form | `src/frappe/form/FrappeForm.tsx`, `FrappeFormView.tsx`, `FormSkeleton.tsx`, `events.ts` (formEvents, `resolveLinkQuery`), `unsavedChanges.ts`, `services.tsx` (`FrappeFormServices`, `useFormServices`), `index.ts` |
| Behaviour model | `src/frappe/form/model/`: `fieldtypes.ts`, `status.ts`, `depends.ts`, `expression.ts`, `layout.ts`, `defaults.ts`, `docStore.ts`, `mandatory.ts`, `fetch.ts`, `errors.ts`, `actions.ts`, `copy.ts`, `quickEntry.ts`, `index.ts` |
| Foundation | `src/frappe/FrappeProvider.tsx`, `client.ts`, `contract.ts`, `hooks/useDoc.ts`, `hooks/usePermissions.ts`, `hooks/useDocMutations.ts`, `services/format.ts`, `services/translate.ts`, `services/permissions.ts`, `feedback/messages.tsx`, `record/attachments.ts`, `record/useFormSidebarActions.ts` (`searchFiles`) |
| Core controls | `src/fields/`: `FieldShell.tsx`, `LinkInput.tsx`, `autocomplete.tsx`, `TagInput.tsx`, `NumberInput.tsx`, `TimeInput.tsx`, `DurationInput.tsx`, `Rating.tsx`, `ColorInput.tsx`, `ReadOnlyValue.tsx`, `AttachInput.tsx`, `FileDropzone.tsx`, `ImageCropper.tsx`, `CameraCapture.tsx`, `DataGrid.tsx`, `lib/number.ts`, `lib/time.ts`; `src/primitives/`: `checkbox.tsx`, `select.tsx`, `date-time-field.tsx`, `textarea.tsx`, `rich-text-editor.tsx`, `button.tsx`; `src/record/AttachDialog.tsx` |
| Simulator | `src/frappe/testing/fixtureTransport.ts` (search_link :1239, validate_link :1151, files :1563-1613), `handlers/fields.ts` (get_link_title), `handlers/form.ts` (get_max_file_size), `handlers/sidebar.ts` (`upload_file`, `withSimulatedSidebar`) |
| Exports | `src/frappe/index.ts:54`, `src/index.ts:164`, `package.json` `exports` |
| Showcase | `showcase/src/pages/p36d-fieldtypes.tsx`, `p36d-fieldtypes-data.ts`, `p36b-attachimage.tsx`, `frappe/index.tsx`, `frappe-p35-form.tsx` |
| Tests | `tests/trace-p36e.test.tsx` (this audit), `fieldtypes-p36d.test.tsx`, `fields-p36d.test.tsx`, `frappe-fieldtypes.test.tsx`, `frappe-form.test.tsx`, `frappe-form-model.test.tsx`, `frappe-form-p35.test.tsx`, `attach.test.tsx`, `attach-image-p36b.test.tsx`, `date-display.test.tsx`, `linkinput-p36b/c/d.test.tsx`, `fields.test.tsx` |
| Audit docs | `docs/audit/p36d/FIELD-TYPES.md` (statuses corrected), this file |
| CRM consumers (read only) | `components/forms/CrmEntityFormFields.tsx`, `data/frappe/CrmEditableCard.tsx`, `data/frappe/client.ts` (CrmFrappeProvider), `data/frappe/draftMetas.ts`, `data/frappe/meta/*.json` |
| Native reference | `frappe/public/js/frappe/form/controls/*.js`, `form/layout.js`, `section.js`, `column.js`, `tab.js`, `form/formatters.js`, `form/grid.js`, `frappe/model/__init__.py`, `frappe/model/base_document.py` |
