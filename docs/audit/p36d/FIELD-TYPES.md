# P36d — Frappe Field Types: inventory, coverage and implementation strategy

Workstream D ("fieldtypes"), package `@solvfast/ui` 0.7.0-dev.4, base `feat/0.7.x/p36-int` @ 6ea5eb9.
Target: **Frappe v15.110.0** (`version-15`, tag `v15.110.0`, commit `ab7e5ae`), read-only source at
`/home/frappe/lovable_bench/apps/frappe`. Nothing here was checked against a real Frappe site. The evidence is jsdom unit
tests and the in-package SIMULATOR (`src/frappe/testing`, `createFixtureTransport`).

This document is the field-type reference for agent C (Lead field audit) and for later batches. Row ids `FT-nn` are
stable; where the P35 form audit (`docs/audit/p35/A-form.md` §A) has a row, its id (`A1`…`A45`) is given too. **The P35
`FF:` line numbers are stale.** Use the ones below, taken from `src/frappe/form/FrappeField.tsx` at 6ea5eb9.

## 0. Legend

Frappe paths are relative to `frappe/` in the Frappe app:

| Short | File |
|---|---|
| `controls/x.js:N` | `frappe/public/js/frappe/form/controls/x.js` |
| `formatters.js:N` | `frappe/public/js/frappe/form/formatters.js` |
| `layout.js:N` | `frappe/public/js/frappe/form/layout.js` |
| `perm.js:N` | `frappe/public/js/frappe/model/perm.js` |
| `datatype.js:N` | `frappe/public/js/frappe/utils/datatype.js` (client validators `validate_email` / `_phone` / `_name` / `_url`) |
| `bd:N` | `frappe/model/base_document.py` |
| `doc:N` | `frappe/model/document.py` |
| `dt:N` | `frappe/core/doctype/doctype/doctype.py` (DocType save-time field checks) |
| `utils:N` | `frappe/utils/__init__.py` |
| `model:N` | `frappe/model/__init__.py` |
| `mariadb:N` | `frappe/database/mariadb/database.py` (column type map `setup_type_map` :171-207, `VARCHAR_LEN = 140` in `database/database.py:61`) |

DS paths are relative to the package root:

| Short | File |
|---|---|
| `FF:N` | `src/frappe/form/FrappeField.tsx` |
| `FLF` | `src/frappe/form/FrappeLinkField.tsx` |
| `FAF` | `src/frappe/form/FrappeAttachField.tsx` |
| `FCT` | `src/frappe/form/FrappeChildTable.tsx` |
| `FTMS` | `src/frappe/form/FrappeTableMultiSelect.tsx` |
| `FFV:N` | `src/frappe/form/FrappeFormView.tsx` |
| `FT:N` | `src/frappe/form/model/fieldtypes.ts` |
| `LY:N` | `src/frappe/form/model/layout.ts` |
| `ST:N` | `src/frappe/form/model/status.ts` |
| `FMT:N` | `src/frappe/services/format.ts` (`formatValue`) |

Test files:

| Short | File |
|---|---|
| `t/ft` | `tests/frappe-fieldtypes.test.tsx` |
| `t/ff` | `tests/frappe-form.test.tsx` |
| `t/fld` | `tests/fields.test.tsx` |
| `t/p36d` | `tests/fieldtypes-p36d.test.tsx` (this batch) |

Statuses:
- **COMPLETE.** The value round-trips in Frappe's stored format. The read display matches the formatter. Read, required
  and permission statuses apply. The control's primary interaction matches the native control. Secondary affordances
  may still be listed as gaps.
- **PARTIAL.** It renders and stores a value, but a native behaviour that changes data, validation or the main
  interaction is missing.
- **MISSING.** There is no control. FrappeField shows the raw value READ-ONLY (`FF:193-196`), and the form lists the
  field in its issues banner (`FT:48-54`).

Classes:
- **input**: a standalone value control.
- **composite**: several parts, or child rows.
- **integration**: needs server calls or third-party libraries.
- **display**: no value.
- **layout**: shapes the form.

## 1. The authoritative list (from the source)

| Source | What it says |
|---|---|
| `model:8-43` `data_fieldtypes` | 34 types that store a value: Currency, Int, **Long Int**, Float, Percent, Check, Small Text, Long Text, Code, Text Editor, Markdown Editor, HTML Editor, Date, Datetime, Time, Text, Data, Link, Dynamic Link, Password, Select, Rating, Read Only, Attach, Attach Image, Signature, Color, Barcode, Geolocation, Duration, Icon, Phone, Autocomplete, JSON |
| `model:45-46` | `float_like_fields` {Float, Currency, Percent}; `datetime_fields` {Datetime, Date, Time} |
| `model:48-51` | `attachment_fieldtypes` (Attach, Attach Image) |
| `model:53-64` `no_value_fields` | 10: Section Break, Column Break, Tab Break, HTML, Table, Table MultiSelect, Button, Image, Fold, Heading |
| `model:67-76` `display_fieldtypes` | 8: `no_value_fields` minus the two table types |
| `model:78` `numeric_fieldtypes` | Currency, Int, Long Int, Float, Percent, Check |
| `model:80` `data_field_options` | **Email, Name, Phone, URL, Barcode, IBAN** (the only allowed `options` of a Data field; `dt:1588-1603` warns on any other) |
| `model:82-99` | `default_fields` (doctype, name, owner, creation, modified, modified_by, docstatus, idx); `child_table_fields` (parent, parentfield, parenttype); `optional_fields` (`_user_tags`, `_comments`, `_assign`, `_liked_by`, `_seen`); `table_fields` (Table, Table MultiSelect) |
| `core/doctype/docfield/docfield.json:102-108` (`fieldtype` Select) | **43 options**: the 33 `data_fieldtypes` except Long Int, plus the 10 `no_value_fields`. Custom Field (`custom/doctype/custom_field/custom_field.json`) offers the same 43; Customize Form Field offers 42 (no JSON). |
| `controls/` (44 files) | A `Control<Type>` class for every DocField option except the four layout breaks (Section / Column / Tab Break, Fold — `layout.js:173-195`). Read Only is an alias of Data (`controls/data.js:323`), Percent of Float (`controls/float.js:28`), Long Text of Text (`controls/text.js:17`), Long Int of Int (`controls/int.js:45`). `make_control` maps the fieldtype to `Control` + the type name without spaces (`controls/control.js:45-52`). |
| `formatters.js:10-408` | Formatters: Data :36, Autocomplete :49, Select :52, Float :55, Int :83, Percent :93, Rating :104, Currency :123, Check :163, Link :167, Date :220, Datetime :244, Text :255, Time :274, Duration :281, SmallText :326, TextEditor :329, Code :345, TableMultiSelect :378, Color :390, Icon :398, Attach / AttachImage :406-407. Any other type falls back to **Data** (`get_formatter` :415-418). Dynamic Link is formatted as Link (`frappe.format` :424-428). |

**Discrepancies, recorded rather than dropped.**
- **Long Int** is a data type (`model:11`, `numeric_fieldtypes` `model:78`, a `bigint` column at `mariadb:176`, and the
  `ControlLongInt` alias at `controls/int.js:45`). It is **not** a DocField / Custom Field option. It only appears in
  code-defined or JSON-imported metas. The DS handles it (`FF:83`, `FT:10`).
- **Page Break** is not in `frappe/model`, and it is not a DocField option. The client layout handles it
  (`layout.js:178-181`, a page break plus a section), and Web Form Field offers it
  (`website/doctype/web_form_field/web_form_field.json`). The DS treats it as a Section Break (`LY:24`).
- The controls that are **not field types**: Comment, DateRange, MultiCheck, MultiSelect, MultiSelectList and
  MultiSelectPills (`controls/comment.js`, `date_range.js`, `multicheck.js`, `multiselect*.js`). They are used by
  dialogs, filters and the comment box. They are out of scope here.

Totals:
- 43 DocField types, plus Long Int and Page Break, plus 6 Data options: 51 rows.
- Status of the 43 DocField types: **15 COMPLETE · 24 PARTIAL · 4 MISSING**.
- Data options: 0 COMPLETE · 6 PARTIAL (Email, Name, Phone, URL, Barcode, IBAN).
- P36e (agent T) re-graded every row against `controls/*.js`; the P36d counts were 22 · 17 · 4 and Email / Phone COMPLETE.
  See "P36e corrections" below and `docs/audit/p36d/FRAPPEFIELD-TRACE.md` §D.

## P36e corrections (agent T, 0.7.0-dev.5 @ 844cd2e)

Status corrections only; the per-row text below is otherwise P36d's. The full re-grade, with the native file:line for
each row and every gap of every PARTIAL row, is `docs/audit/p36d/FRAPPEFIELD-TRACE.md` §D. **The `FF:N` line numbers in
this file are from 6ea5eb9 and are stale** (agent C's P36d changes moved them); the trace cites 844cd2e.

| Row | Was | Now | Why (native) |
|---|---|---|---|
| FT-01 Data | COMPLETE | PARTIAL | No duplicate-name check on the `autoname: field:` / `__newname` input (`controls/data.js:189-227`, a validation message); no `with_copy_button` (`:130-144`). The paste warning and `maxlength` now exist (FF:212-218 at 844cd2e). |
| FT-01a Data (Email), FT-01c Data (Phone) | COMPLETE | PARTIAL | The option's own check is Desk's verbatim (FF:88-116), but a Data option is still `ControlData`: FT-01's gaps apply. The DS input is `type="text"` (FF:355), not `email` / `tel` as this file's matrix says. |
| FT-01b Data (Name) | PARTIAL | PARTIAL | Unchanged status, new reason: the Name soft check now exists (FF:90, 113); only FT-01's gaps remain. |
| FT-14 Link | COMPLETE | PARTIAL | No Advanced Search (`controls/link.js:165-174, 347-360`), no filter description (`:309-320`), no translation of values of translated DocTypes (`:111-116`). |
| FT-15 Dynamic Link | COMPLETE | PARTIAL | FT-14's gaps; a Single target is not refused (`controls/dynamic_link.js:26-28`). |
| FT-19 Float | COMPLETE | PARTIAL | Float with `options` uses the currency's number format for input (`controls/float.js:15-20`), the gap already counted against Currency. |
| FT-36 Table | COMPLETE | PARTIAL | Paste from a spreadsheet (`controls/table.js:19-117`); P35 A-form §G lists drag reorder (G4) PARTIAL and grid Download / Upload (G9) MISSING. |
| FT-37 Table MultiSelect | COMPLETE | PARTIAL | A ControlLink: its list has "Create a new" / Advanced Search (`controls/link.js:323-360`), missing here; the field's `link_filters` / `filters` are not applied (FTMS:306-316). |
| FT-39 Column Break | COMPLETE | PARTIAL | `column.js:22-36` renders the column's label and description; FFV:741 renders neither. |
| FT-24 Date / FT-25 Datetime | PARTIAL | PARTIAL | New gaps (844cd2e, `primitives/date-time-field.tsx:122-170`): no typed entry (a calendar button) and **a value cannot be cleared** (native: a text input, `''` → null, `controls/date.js:156-179`). |

## 2. Summary matrix

FF shows a FrappeField dispatch line. The "Core" column is the framework-free control in `src/fields` or
`src/primitives`.

| FT | P35 | Type | Class | Native control | Formatter | Server validation | DS Core | DS Frappe | Status | Proof (tests) |
|---|---|---|---|---|---|---|---|---|---|---|
| FT-01 | A1 | Data | input | `controls/data.js:3-321` | `formatters.js:36` | length `bd:981-1014`; options `bd:922-955` | `<input>` + `FIELD_INPUT` (`fields/FieldShell.tsx`) | `FF:315-324` (DebouncedText `FF:96-118`) | PARTIAL (P36e) | `t/ft` "FV.A19 … A1 Data honours the placeholder"; `t/p36d` P36D.fieldtypes.2 |
| FT-01a | — | Data (Email) | input | `controls/data.js:293-306` → `datatype.js:41` | `formatters.js:36` (plain) | `bd:936-940` → `utils:166` (`split_emails` `utils:209`) | `type=email` | `FF:86-89` soft check, `FF:316` | PARTIAL (P36e) | `t/ff` "dispatches fieldtypes; Read shows formatted text…" (Email `aria-invalid`); P36D.fieldtypes.2 |
| FT-01b | — | Data (Name) | input | `controls/data.js:290-292` → `datatype.js:49` | `formatters.js:36` | `bd:942-943` → `utils:147` (`PERSON_NAME_PATTERN` `utils:38`) | text | `FF:315-324` (no soft check) | PARTIAL | P36D.fieldtypes.2 (round-trip only) |
| FT-01c | — | Data (Phone) | input | `controls/data.js:287-289` → `datatype.js:45` | `formatters.js:36` | `bd:945-946` → `utils:128` (`PHONE_NUMBER_PATTERN` `utils:37`) | `type=tel` | `FF:90` (the same pattern), `FF:316` | PARTIAL (P36e) | P36D.fieldtypes.2 |
| FT-01d | — | Data (URL) | input | `controls/data.js:70-72, 81-122, 307-309` → `datatype.js:53` | `formatters.js:37-40` (a link) | `bd:948-952` → `utils:222` | `type=url` | `FF:91` soft check | PARTIAL | P36D.fieldtypes.2 |
| FT-01e | — | Data (Barcode) | input | `controls/data.js:73-75, 146-173` (scan button) | `formatters.js:36` | none | text | `FF:315-324` | PARTIAL | P36D.fieldtypes.2 |
| FT-01f | — | Data (IBAN) | input | `controls/data.js:76-78, 124-128, 268-278` | `formatters.js:41-44` | `bd:954-955` → `utils:252` | text | `FMT:388-391` (display only) | PARTIAL | P36D.fieldtypes.2 |
| FT-02 | A13 | Small Text | input | `controls/text.js:18-23` (150 px) | `formatters.js:326` → Text | mandatory `bd:760-770` | `primitives/textarea.tsx` | `FF:80, 309-314` | COMPLETE | `t/ft` "FV.A12-A14 …", "FV.A12 a textarea writes 500 ms…"; P36D.fieldtypes.2 |
| FT-03 | A12 | Text | input | `controls/text.js:1-16` (300 px, `max_height`) | `formatters.js:255-273` (newlines → `<br>`) | — | textarea | `FF:80, 309-314` | COMPLETE | same |
| FT-04 | A14 | Long Text | input | `controls/text.js:17` | Data fallback (`formatters.js:415-418`) | — | textarea | `FF:80, 309-314` | COMPLETE | same |
| FT-05 | A15 | Text Editor | integration | `controls/text_editor.js:136-401` (Quill, mentions, image, table) | `formatters.js:329-343` (`ql-editor` wrapper) | mandatory accepts `<img>` `bd:766`; sanitize + linkify `bd:1125`; images extracted `bd:1302` | `primitives/rich-text-editor.tsx` (RichTextEditor, RichText) | `FF:222, 301-302` | PARTIAL | `t/ff` "loads a ToDo, edits a field…"; P36D.fieldtypes.7 |
| FT-06 | A16 | Markdown Editor | integration | `controls/markdown_editor.js:1-104` (Ace + preview + image drop) | Data fallback | — | textarea (mono) | `FF:80-81, 309-314` | PARTIAL | `t/ft` "FV.A12-A14 … A16-A18, A32 …"; P36D.fieldtypes.2 |
| FT-07 | A17 | HTML Editor | integration | `controls/html_editor.js:1-15` (Ace html + preview) | Data fallback | sanitized unless `ignore_xss_filter` `bd:1087-1127` | textarea (mono) | `FF:80-81` | PARTIAL | same |
| FT-08 | A18 | Code | integration | `controls/code.js:1-255` (Ace; `options` = language :183-213; copy :12-38) | `formatters.js:345` (`<pre>`) | Python / PythonExpression `bd:1016-1025`; not sanitized `bd:1117`; `Code`+HTML mandatory `bd:768` | textarea (mono, `dir=ltr`) | `FF:80-81, 309-314` | PARTIAL | same |
| FT-09 | A32 | JSON | integration | `controls/json.js:1-6` (Code, language JSON) | Data fallback | dict → `json.dumps` `bd:400-401`; `json` column `mariadb:206` | textarea (mono) | `FF:80-81` | PARTIAL | same |
| FT-10 | A19 | Password | input | `controls/password.js:1-109` (show / hide :36-53, strength :59-84) | Data fallback | stored in `__Auth`, mask `*****` `bd:1129-1150` | `type=password` | `FF:316` | PARTIAL | `t/ft` "FV.A19 Password renders type=password…"; P36D.fieldtypes.2 |
| FT-11 | A22 | Read Only | input (read) | `controls/data.js:323`; Read by `perm.js:258` / `controls/base_control.js:68` | Data | cast to str `bd:406-407` | `fields/ReadOnlyValue.tsx` | `ST:22`, `FF:220-228` | COMPLETE | `t/ft` "FV.A22 Read Only shows the formatted value…"; P36D.fieldtypes.13 |
| FT-12 | A3 | Select | input | `controls/select.js:1-110` (`set_options` :61-89, `sort_options` :81, `add_options` :111) | `formatters.js:52` (translated) | value ∈ options `bd:892-920` | `primitives/select.tsx` (Radix) | `FF:268-281` | PARTIAL | `t/ft` "FV.A3 Select: newline options…"; P36D.fieldtypes.4 |
| FT-13 | A34 | Autocomplete | input | `controls/autocomplete.js:1-244` (`parse_options` :147-166, `validate` :132-145, `get_query` :169-232) | `formatters.js:49` | none (varchar) | `fields/LinkInput.tsx` + `autocomplete.tsx` | `FF:123-158, 303-304` | PARTIAL | `t/ft` "FV.A34 …" ×3; P36D.fieldtypes.4 |
| FT-14 | A2 | Link | integration | `controls/link.js:10-853` (search :206-475, validate + fetch :701-765, new :175-205 / :323-336, advanced search :165-174) | `formatters.js:167-219` | `get_invalid_links` `bd:787-867`; fetch `bd:869-890` | `fields/LinkInput.tsx` | `FLF`; `FF:233-241` | PARTIAL (P36e) | `t/ff` "searches search_link 500 ms…", "R1-F11…"; `tests/linkinput-p36b/p36c` P36B/P36C.linkinput.*; P36D.fieldtypes.8 |
| FT-15 | A25 | Dynamic Link | integration | `controls/dynamic_link.js:1-32` (`get_options` → `doc[df.options]`) | as Link (`formatters.js:424-428`) | `bd:806-810` (DocType must be set) | LinkInput | `FLF` (FrappeDynamicLinkField); `FF:240` | PARTIAL (P36e) | `t/ff` "standalone Dynamic Link searches the DocType in the sibling field…"; P36D.fieldtypes.9 |
| FT-16 | A7 | Check | input | `controls/check.js:1-45` | `formatters.js:163` | `cint` → 0/1 `bd:394-395, 725-726` | `primitives/checkbox.tsx` | `FF:221, 266-267` | COMPLETE | `t/ft` "FV.A28 … A7 Check writes 0/1"; P36D.fieldtypes.4 |
| FT-17 | A8 | Int | input | `controls/int.js:1-43` (expressions :17-39, select on focus :9-12) | `formatters.js:83` | `cint` `bd:397-398`; int range `bd:1004-1012`; `non_negative` `doc:656-676` | `fields/NumberInput.tsx` (kind int) | `FF:83, 244-254` | COMPLETE | `t/ft` "FV.A8 / A9 / A10 / A11 numbers…"; `t/fld` "evaluates arithmetic…"; P36D.fieldtypes.3 |
| FT-18 | A8 | Long Int | input | `controls/int.js:45` | Int | bigint `mariadb:176`, `bd:1004-1012` | NumberInput | `FF:83` | COMPLETE (not a DocField option) | P36D.fieldtypes.3 |
| FT-19 | A9 | Float | input | `controls/float.js:1-27` (precision :22-26, number format :15-20) | `formatters.js:55-82` | `flt` `bd:403-404, 732-733`; precision 1-6 `dt:1372-1378` | NumberInput (kind float) | `FF:244-254` | PARTIAL (P36e) | `t/ft` FV.A8-A11; P36D.fieldtypes.3 |
| FT-20 | A10 | Currency | input | `controls/currency.js:1-15` (currency precision) | `formatters.js:123-162` | `flt`; `non_negative` | NumberInput (kind currency) | `FF:244-254`; display `FMT:357-361` | PARTIAL | `t/ft` FV.A8-A11; P36D.fieldtypes.3 |
| FT-21 | A11 | Percent | input | `controls/float.js:28` | `formatters.js:93-103` | `flt` | NumberInput (kind percent) | `FF:83` | COMPLETE | `t/ft` FV.A8-A11; P36D.fieldtypes.3 |
| FT-22 | A27 | Rating | input | `controls/rating.js:1-117` (half stars :45-94, display :98-113) | `formatters.js:104-122` | clamped 0..1 `doc:678-685`; options 3..10 `dt:1635-1638`; `decimal(3,2)` | `fields/Rating.tsx` (`allowHalf` default true :28) | `FF:223, 294-298` (stored fraction) | COMPLETE | `t/ft` "FV.A27 Rating stores a 0…1 fraction…"; `t/fld` "Rating: click sets…"; P36D.fieldtypes.6 |
| FT-23 | A26 | Duration | input | `controls/duration.js:1-166` (picker; `hide_days` / `hide_seconds`) | `formatters.js:281-288` | `decimal(21,9)` | `fields/DurationInput.tsx` | `FF:291-293` | COMPLETE | `t/fld` DurationInput ×3; `t/ff` "dispatches fieldtypes…"; P36D.fieldtypes.5 |
| FT-24 | A4 | Date | input | `controls/date.js:1-196` (datepicker; `t` = today :138-154; validate :170-179; `options` JSON :180-195) | `formatters.js:220-233` | `""` → None `bd:409-411` | `primitives/date-time-field.tsx` (DateField) | `FF:282-286` | PARTIAL | `tests/date-display.test.tsx` ×3; `t/ft` "FV.A6 … A4 Date a date trigger"; P36D.fieldtypes.5 |
| FT-25 | A5 | Datetime | input | `controls/datetime.js:1-102` (user ↔ system TZ :47-60, TZ description :65-80) | `formatters.js:244-254` | as Date | DateTimeField | `FF:160-161, 287-288` | PARTIAL | `t/ft` FV.A6/A5/A4; P36D.fieldtypes.5 |
| FT-26 | A6 | Time | input | `controls/time.js:1-112` (`t` = now via `date.js:138-154`; validate :102-111) | `formatters.js:274-280` | as Date | `fields/TimeInput.tsx` (12 h, Now) | `FF:289-290` | PARTIAL | `t/ft` "FV.A6 Time is a time box…"; `t/fld` TimeInput ×3; P36D.fieldtypes.5 |
| FT-27 | A33 | Phone | integration | `controls/phone.js:1-237` (country picker :92-140; stored `+isd-number` :163-187; country list `frappe.geo.country_info.get_country_timezone_info` :13-23) | Data fallback | `validate_phone_number_with_country_code` (`phonenumbers`) `bd:924-926` → `utils:101-125` | `type=tel` | `FF:316` | PARTIAL | `t/ft` "FV.A19 … A33 Phone renders type=tel"; P36D.fieldtypes.2 |
| FT-28 | A28 | Color | input | `controls/color.js:1-117` (picker + swatches :10-84; `#RRGGBB` :107-116) | `formatters.js:390-397` (swatch) | — | `fields/ColorInput.tsx` | `FF:299-300` | PARTIAL | `t/ft` "FV.A28 Color is a hex box…"; `t/fld` "ColorInput accepts #RRGGBB only…"; P36D.fieldtypes.6 |
| FT-29 | A20 | Attach | integration | `controls/attach.js:1-151` (uploader :61-93, clear :36-55, reload :56-60) | `formatters.js:406, 410-413` (link) | not sanitized `bd:1117`; `text` column | `fields/AttachInput.tsx` + `record/AttachDialog` | `FAF`; `FF:256-264` | COMPLETE | `tests/attach.test.tsx` ×6; `tests/attach-image-p36b.test.tsx` P36B.attachimage.*; P36D.fieldtypes.10 |
| FT-30 | A21 | Attach Image | integration | `controls/attach_image.js:1-24` (image/* only) | `formatters.js:407` | as Attach | AttachInput (`image`) | `FAF` | COMPLETE | same |
| FT-31 | A38 | Image | display | `controls/image.js:1-23` (shows `doc[df.options]`) | — | no value | `<img>` | `FF:202` | COMPLETE | `t/ft` "FV.A36 … A38 Image reads doc[options]…"; P36D.fieldtypes.12 |
| FT-32 | A29 | Signature | integration | `controls/signature.js:1-139` (jSignature; data URL) | Data fallback | `longtext` | — | `FF:193-196` read-only raw | MISSING | `t/ft` "FV.A44 Signature / Geolocation / Barcode / Icon…"; P36D.fieldtypes.15 |
| FT-33 | A31 | Barcode | integration | `controls/barcode.js:1-79` (JsBarcode; STORES the `<svg data-barcode-value>` :14-42) | Data fallback | not sanitized `bd:1117`; `longtext` | — | `FF:193-196` | MISSING | same |
| FT-34 | A30 | Geolocation | integration | `controls/geolocation.js:1-258` (Leaflet + draw; GeoJSON FeatureCollection) | Data fallback | `longtext` | — | `FF:193-196` | MISSING | same |
| FT-35 | A35 | Icon | input | `controls/icon.js:1-101` (picker over the sprite's `icon-*` symbols) | `formatters.js:398-405` | — | — | `FF:193-196` | MISSING | same |
| FT-36 | A23 | Table | composite | `controls/table.js:1-158` → `form/grid.js` (paste from a spreadsheet :19-117) | — (no value) | rows validated as child docs; mandatory "Data missing in table" `bd:742-745` | `fields/DataGrid.tsx` | `FCT`; `FF:205-211` | PARTIAL (P36e) | `t/ff` "Contact: Add Row…", "table events…"; P36D.fieldtypes.11 |
| FT-37 | A24 | Table MultiSelect | composite | `controls/table_multiselect.js:1-179` (first Link field :148-157; validate :84-121) | `formatters.js:378-389` | as Table | (pills) | `FTMS`; `FF:212-217` | PARTIAL (P36e) | `t/ff` "adds rows for picked values…"; P36D.fieldtypes.11 |
| FT-38 | — | Section Break | layout | `layout.js:182-184` (`make_section`), `form/section.js` | — | — | — | `LY:24, 31-60`; collapsible `FFV:735-760` | COMPLETE | `tests/frappe-form-model.test.tsx` "inserts a Details tab…", "collapsible sections…"; `tests/frappe-form-p35.test.tsx` "FV.B4…"; P36D.fieldtypes.12 |
| FT-39 | — | Column Break | layout | `layout.js:185-187` (`make_column`) | — | — | — | `LY:31-60` | PARTIAL (P36e) | same |
| FT-40 | — | Tab Break | layout | `layout.js:188-190` (`make_tab`), a "Details" tab first :150-170 | — | — | — | `LY:31-60` | COMPLETE | `t/ff` "Event: a Details tab first…"; P36D.fieldtypes.12 |
| FT-41 | A40 | Fold | layout | `layout.js:175-177, 270-295` ("Show more details" / "Hide details") | — | one Fold, before a Section Break `dt:1416-1427` | — | treated as a Section Break `LY:24` | PARTIAL | P36D.fieldtypes.12 |
| FT-42 | A39 | Heading | display | `controls/heading.js:1-5` (ControlHTML with the label) | — | — | `<h4>` | `FF:200` | COMPLETE | `t/ft` "FV.A36 … A39 Heading is a heading"; P36D.fieldtypes.12 |
| FT-43 | A37 | HTML | display | `controls/html.js:1-33` (`df.options` as HTML, NOT sanitized; scripts write `$wrapper`) | — | — | `sanitizeHtml` | `FF:199` | PARTIAL | `t/ft` "FV.A36 … A37 HTML is sanitized"; P36D.fieldtypes.12 |
| FT-44 | A36 | Button | display | `controls/button.js:1-69` (script handler, else `options` → `run_doc_method` :20-48; always writable :2-5) | — | — | `primitives/button.tsx` | `FF:201` (`onButtonClick`), `FFV` events | PARTIAL | `t/ft` "FV.A36 Button runs onButtonClick…"; P36D.fieldtypes.12 |
| FT-45 | — | Page Break | layout | `layout.js:178-181` (web forms / print) | — | — | — | Section Break `LY:24` | n/a (not a DocField option) | — |

## 3. Rules that apply to every field type

These hold for every row below, so they are not repeated per type.

- **Display status (permissions / read-only / permlevel).**
  - Ladder `perm.js:191-268`:
    - permlevel write (and not `disabled` / virtual) → Write; read → Read; else None;
    - `hidden` → None; `hidden_due_to_dependency` → None;
    - `docstatus > 0` → Read; Read + `allow_on_submit` + docstatus 1 + write → Write;
    - workflow-controlled fields → Read;
    - `read_only` or Read Only → Read;
    - `set_only_once` on a saved document → Read.
  - Control layer `controls/base_control.js:55-134`. In a form, an empty Read field is hidden, except HTML / Image /
    Button / Geolocation. A Read grid makes its cells Read.
  - DS: `ST:21-37` (ladder) and `ST:39-45` (control rules), with the fetch lock `model/fetch.ts`. FrappeField takes the
    form's `status` prop (`FF:62, 170`). Read renders the formatted value, never an input (`FF:220-228`).
  - Server: fields above the user's permlevel are reset to the saved / default value (`bd:1263-1291`, from
    `doc:783-800`). Display types are exempt.
- **Mandatory.**
  - Client: the label gets `reqd` (`controls/base_input.js:227-229`). `has-error` when empty
    (`controls/base_input.js:207-215`), but not on form load and not in a dialog before the primary action.
  - Server: `bd:738-785`. Text Editor and Code (HTML) count an `<img>` as content.
  - No-value types cannot be mandatory, tables excepted (`dt:1268-1273`).
  - DS:
    - `FF:176-179`: the required mark, and `aria-invalid` on an empty required field (not in Read).
    - Missing Fields dialog `FFV`.
    - Server `MandatoryError` mapped to the field (P35 A43).
- **Writing.**
  - Data-like inputs write 500 ms after typing and on change (`controls/data.js:175-188`). In a grid they write on
    change only.
  - Int / Float / Check / Date / Select / Link / Autocomplete set `trigger_change_on_input_event = false`, so they
    write on change.
  - DS: `FF:96-118` (DebouncedText, blur-only in a grid via `onlyInput`). Numbers, dates, selects and links write on
    commit.
- **Length.**
  - Client `maxlength` = `df.length || 140` for Data, Link, Dynamic Link, Password, Select and Read Only, except on
    Singles (`controls/data.js:228-239`). Pasting past it warns (`controls/data.js:19-62`).
  - Server `bd:981-1014`: varchar types, and the int / bigint range.
  - DS: `maxLength` only for Data, Password and Read Only (`FF:82, 317`). There is no Singles exemption and no paste
    warning.
- **Sanitising.** `bd:1087-1127` sanitizes HTML in every string field. These are skipped:
  - `ignore_xss_filter`;
  - Email Data / Small Text / Text;
  - Attach, Attach Image, Barcode and Code;
  - cancelled documents;
  - submitted documents, except `allow_on_submit` fields.

  Text Editor is linkified. The DS sanitizes on its own render paths (`rich-text-editor.tsx` `sanitizeHtml`); the server
  remains the authority.
- **fetch_from.**
  - Client: `controls/link.js:709-765` (`validate_link` with the fetch columns).
  - Server: `bd:806-860` and `bd:869-890`. A Text Editor source is stripped to text for Small Text / Text / Data
    targets.
  - The Read lock on the target: `ST` (`isReadOnlyByFetch`).
  - DS: `FLF` → `onLinkValidated` → the form writes the targets (`model/fetch.ts`).
- **Labels / descriptions / placeholders / translation.**
  - Labels and descriptions are translated with the DocType as context (`controls/base_input.js:153-204`). The
    placeholder is translated (`controls/data.js:244`).
  - DS:
    - label and description through `s.translate(bundle, …)` (`FF:173-174`);
    - placeholder only on Data (`FF:321`), Select (`FF:274`) and Autocomplete (`FF:156`);
    - Link takes `df.placeholder` in FLF.
- **Translatable values.** `df.translatable` adds a translation globe for users who can write Translation
  (`controls/base_control.js:146-182`). The DS has nothing for this.

## 4. Per-type detail

Each type lists its metadata, its validation (client, then server), its keyboard and interaction behaviour, and what is
missing from the DS. "→ C" marks a gap in `src/fields` / `src/frappe/form` that belongs to agent C or a later batch.

### Text and data

**FT-01 Data.**
- Metadata:
  - `length` (default 140);
  - `options` (see FT-01a-f);
  - `placeholder`, `with_copy_button`, `input_css` / `input_class` (`controls/data.js:228-254`);
  - `fetch_from`, `fetch_if_empty`, `depends_on`, `mandatory_depends_on`, `read_only_depends_on`;
  - `unique`: an empty string is saved as NULL (`bd:409-411`);
  - `translatable`.
- Validation: client `controls/data.js:280-313`, server `bd:922-955`.
- Keyboard:
  - A plain `<input>`. It writes 500 ms after typing and on change.
  - When the field is the `autoname: field:` source, typing checks whether the name exists after 1 s
    (`controls/data.js:189-227`).
- Missing:
  - the copy button (`controls/data.js:130-144`);
  - the duplicate-name hint (`controls/data.js:189-227`);
  - the paste-clipped warning (`controls/data.js:19-62`);
  - `maxlength` on Link / Select;
  - the Singles exemption.

  → C, low priority.

**FT-01a Data (Email).**
- The client splits on commas / newlines (`frappe.utils.split_emails`) and checks each address with
  `validate_email` (`controls/data.js:293-306`).
- Server: `validate_email_address(throw=True)` for each address (`bd:936-940`). It is skipped for standard users. It
  is not sanitized (`bd:1116`).
- DS: `FF:89` splits on `,` / newline and checks a simplified pattern. `type=email`, `dir=ltr`.
- Difference: the DS pattern is simpler than `utils:166` / `frappe.utils.validate_type`. The server stays the gate.

**FT-01b Data (Name).**
- Client: `validate_name` (`controls/data.js:290-292`, `datatype.js:49`).
- Server: `validate_name(throw=True)`, `PERSON_NAME_PATTERN` (`utils:38`, `utils:147-162`).
- Missing: no soft check in `dataOptionInvalid` (`FF:86-93`). → C. Add `Name` to `dataOptionInvalid`, using a
  Unicode-aware port of `^[\w][\w\'\-]*( \w[\w\'\-]*)*$`.

**FT-01c Data (Phone).** The rules call this `Data (Phone)`, as distinct from the Phone fieldtype FT-27.
- Client: `validate_phone` (`controls/data.js:287-289`).
- Server: `validate_phone_number` with `([0-9\ \+\_\-\,\.\*\#\(\)]){1,20}$` (`utils:37, 128-144`).
- DS: `FF:90`, the same pattern; `type=tel`, `dir=ltr`.
- No country picker. That is correct here: only the Phone fieldtype has one.

**FT-01d Data (URL).**
- Client: `validate_url`. An "open link" button shows while the value is a valid URL (`controls/data.js:81-122`).
- Read display: an `<a target=_blank>` (`formatters.js:37-40`).
- Server: `validate_url` (`bd:948-952`, `utils:222`).
- DS: soft check `FF:91`, `type=url`.
- Missing: the open-link button, and the Read display as a link. FrappeField's read path gives `ReadOnlyValue` an
  `href` only for Attach (`FF:226`). → C.

**FT-01e Data (Barcode).**
- The client adds a "Scan" button that opens `frappe.ui.Scanner` (`controls/data.js:146-173`). There is no
  validation.
- DS: a plain text box. Missing: the scan affordance. A Core `CameraCapture` exists (`fields/CameraCapture.tsx`), but
  there is no barcode decoder. Needs a peer dependency decision.

**FT-01f Data (IBAN).**
- Input shows grouped by 4 and is stored without spaces (`controls/data.js:124-128, 268-278`).
- Server: `validate_iban` (`bd:954-955`, `utils:252`).
- Display: `formatters.js:41-44`, reproduced in `FMT:388-391`.
- Missing: the input formatting / stripping, and a soft mod-97 check. → C.

**FT-02 / FT-03 / FT-04 Small Text / Text / Long Text.**
- `<textarea>`: Text and Long Text are 300 px, Small Text 150 px, `max_height` applies (`controls/text.js:1-23`).
- Formatter: newlines become `<br>` unless the value holds HTML (`formatters.js:255-273`). Long Text falls back to
  Data.
- DS: textarea, debounced (`FF:309-314`). Read: `ReadOnlyValue multiline` (`FF:227`).
- Missing: the `max_height` metadata. Cosmetic; `dt:1631-1633` only allows px / em.

**FT-05 Text Editor.**
- Native: Quill (`controls/text_editor.js:141-401`) with:
  - a toolbar (:287-315) and keyboard bindings (:363+);
  - `@` mentions (:250-285);
  - images and table actions (:158-182).
- Storage: the value is wrapped in `<div class="ql-editor read-mode">` (:343-357). Script and style tags are removed
  (:317-322).
- Server: linkify-sanitize (`bd:1125`), image extraction to File (`bd:1302`), and mandatory accepts an image
  (`bd:766`).
- DS: `RichTextEditor` (contenteditable + execCommand) and `RichText` (read); plain sanitized HTML. The `ql-editor`
  wrapper is not reproduced, as P35 recorded.
- Missing: mentions, image insert / paste / upload, tables, and the Quill keyboard set. → C / later (Phase 3).

**FT-06 / FT-07 / FT-08 / FT-09 Markdown Editor / HTML Editor / Code / JSON.**
- Native: an Ace editor (`controls/code.js:40-115`).
  - `options` selects the language (Javascript, Python, PythonExpression, HTML, CSS, Markdown, SCSS, JSON, Golang,
    Jinja; :183-213), with VS Code keys.
  - A copy button (:12-38).
  - Markdown and HTML have a live preview (`controls/markdown_editor.js:48-60`, `controls/html_editor.js:9-15`).
    Markdown supports image drop (:64+).
  - JSON = Code with language JSON (`controls/json.js:2-5`).
- Server: Python code is validated (`bd:1016-1025`). Code is never sanitized (`bd:1117`). JSON dicts are serialised
  (`bd:400-401`).
- DS: a monospace `<textarea dir=ltr>` (`FF:80-81, 309-314`).
- Missing: syntax highlighting, the preview, the copy button, and a JSON parse check. → Phase 3. Decide on a peer
  editor (CodeMirror 6 or Ace) as an optional dependency.

**FT-10 Password.**
- Native: show / hide toggle (`controls/password.js:36-53`). Strength meter through
  `frappe.core.doctype.user.user.test_password_strength` (:59-84), only when `enable_password_checks`.
- Server: stored encrypted in `__Auth`; the document keeps `*****` (`bd:1129-1150`). `is_dummy_password` skips
  re-saving the mask (`bd:1159`).
- DS: `type=password` (`FF:316`).
- Missing: the show / hide toggle, and the strength indicator (server call). The mask is sent back unchanged, which is
  harmless (the server skips it), but untested. → C (toggle = Core; strength = Frappe layer).

**FT-11 Read Only.**
- Always Read (`perm.js:258`, `controls/base_control.js:68`). Usually fed by `fetch_from`. Server casts it to str
  (`bd:406-407`).
- DS: `ST:22, 34`; `FF:220-228`. Complete.

**FT-27 Phone (fieldtype).** This is the fieldtype, not Data (Phone).
- Native:
  - a country picker with flags (`controls/phone.js:92-140`);
  - the list comes from `frappe.geo.country_info.get_country_timezone_info`, cached in localforage (:13-23);
  - default country from `sys_defaults.country` (:25-32);
  - stored as `<isd>-<number>`, e.g. `+966-512345678` (:163-187);
  - Backspace on an empty box resets the country (:34-40).
- Server: `validate_phone_number_with_country_code` (`phonenumbers.is_valid_number`). A missing country code raises
  "Country Code Required" (`bd:924-926`, `utils:101-125`).
- DS: `<input type=tel>` (`FF:316`), free text.
- Risk: a value typed without `+isd-` **is rejected by the server**.
- Missing:
  - a Core `PhoneInput` (country select + number);
  - a Frappe wrapper that reads the country list (a server call: needs a simulated handler) and writes `+isd-number`.

  → Phase 1 (CRM contacts use it).

### Choice and links

**FT-12 Select.**
- `options` is a newline list, blank allowed. Native `<select>` (`controls/select.js:1-60`).
- `sort_options` sorts the list (:81, `add_options` :111-139). Labels are translated with the DocType as context.
- Server: the value must be one of the options (`bd:892-920`), except `naming_series`.
- Keyboard: native select.
- DS: Radix Select (`FF:268-281`). Blank option, translated labels, and an unknown stored value is kept.
- Missing: `sort_options`; Desk's type-ahead (native select, versus Radix's typeahead); the
  `attach_files:` / file-list options (`controls/select.js:90-104`). → C, small.

**FT-13 Autocomplete.**
- Static options (newline or JSON, `controls/autocomplete.js:147-166`). A value outside the list is dropped unless
  `ignore_validation` (:132-145).
- `get_query` / `set_query` run a server query (`execute_query_if_exists` :169-232). Scripts can call `set_data`
  (:237-244).
- Server: none.
- DS: `FF:123-158` over LinkInput with in-memory search.
- Missing: `get_query` (a server query) and the `set_data` API. → C (Frappe layer: accept a `query` like Link).

**FT-14 Link.**
- Native:
  - Awesomplete with `tabSelect`, `autoFirst`, `minChars 0`, `maxItems 99` (`controls/link.js:206-232`);
  - the search is `frappe.desk.search.search_link` with `filters` / `query` / `reference_doctype`
    (`set_custom_query` :577-666), plus `link_filters` (:667-700);
  - Tab / Enter pick only when the text matches the item (:418-440);
  - "Create a new X" (:323-336), "Advanced Search" (:165-174);
  - `validate_link_and_fetch` (:709-765) writes the `fetch_from` targets;
  - `only_select` and `ignore_link_validation`;
  - title links via `show_title_field_in_link` (:117-138).
- Server: `get_invalid_links` (`bd:787-867`), cancelled-link check (`bd:856-865`).
- DS: FLF over Core LinkInput — debounced 500 ms search, validation, fetch, titles, create-new, query merge order,
  keyboard. Covered by P36B/P36C.linkinput.* (Space, arrows wrap, Escape restores, IME).
- Missing: the "Advanced Search" dialog (link.js:165-174). Verify Tab-to-pick parity (link.js:418-440). → later.

**FT-15 Dynamic Link.**
- `options` = the fieldname of the sibling DocType field (`controls/dynamic_link.js:2-30`). It searches that DocType.
- Server: `"{0} must be set first"` (`bd:806-810`).
- DS: `FrappeDynamicLinkField`; no search while the DocType is empty. PARTIAL (P36e): the Link gaps of FT-14, and a
  Single DocType target is not refused (`controls/dynamic_link.js:26-28`).

**FT-37 Table MultiSelect.**
- The child DocType's first Link field (`controls/table_multiselect.js:148-157`).
- Validation (:84-121): drop an empty or duplicate last value, and `validate_link` the new one.
- Formatter `formatters.js:378-389`.
- DS: `FTMS` (`FF:212-217`). PARTIAL (P36e): no "Create a new" / Advanced Search entries (TMS is a ControlLink,
  `controls/link.js:323-360`); the field's `link_filters` / `filters` are not applied. `<table>_add` does not fire, as in Desk.

### Numbers

**FT-16 Check.**
- 0 / 1; the label sits beside the box (`controls/check.js:5-17`). Server `cint` (`bd:394-395`).
- DS: Radix Checkbox (`FF:266-267`), read = disabled box (`FF:221`). Complete.

**FT-17 / FT-18 Int / Long Int.**
- `inputmode=numeric`. Focus selects all (`controls/int.js:9-12`). Arithmetic is evaluated, e.g. `2+3` → 5
  (`controls/int.js:17-39`). `cint` truncates.
- Server: `cint`, the int / bigint range (`bd:1004-1012`), `non_negative` (`doc:656-676`).
- DS: NumberInput kind int. It evaluates arithmetic WITHOUT `eval` (`fields/lib/number.ts` `evaluateArithmetic`),
  writes on blur, truncates. Complete.
- Not verified: select-all on focus.

**FT-19 / FT-21 Float / Percent.**
- `flt(value, precision)`, with precision from `df.precision`, else `float_precision` (`controls/float.js:22-26`).
- Number format from the field currency only when `options` is set (:15-20).
- `dt:1372-1378`: precision must be 1..6.
- DS: `FF:246-249`. Read through `FMT:338-356`. Percent: COMPLETE. Float: PARTIAL (P36e) — with `options` Desk formats
  the input in that currency's number format (`controls/float.js:15-20`); the DS always uses the system format.

**FT-20 Currency.**
- Precision: `df.precision`, else `currency_precision`, else the number format's (`controls/currency.js:2-14`).
- The currency comes from `options` (a field name or `:Company`-style lookup, `frappe.meta.get_field_currency`).
- Read display adds the symbol (`formatters.js:123-162`).
- DS: edit precision `FF:248`; read with the currency `FMT:357-361`.
- Missing: the edit path does not resolve the field's currency for the number format (`controls/float.js:15-20`).
  The P35 `parity/format` `it.todo` for `options` → currency is still open. → C.

**FT-22 Rating.**
- Stored as a 0..1 fraction. Stars = `options` (3..10, `dt:1635-1638`).
- Half-star click (`controls/rating.js:45-94`). Clicking the current value clears it unless `reqd`.
- Server: clamped to 0..1 (`doc:678-685`).
- DS: `FF:294-298` (value × max ↔ fraction). Core Rating `allowHalf` defaults to true (`fields/Rating.tsx:28`).
  Keyboard follows RTL (`t/fld`). Complete.

**FT-23 Duration.**
- A popover of d / h / m / s boxes (`controls/duration.js:7-60`), with `hide_days` / `hide_seconds`. Stored as seconds.
- DS: DurationInput (`FF:291-293`). Complete.

### Date and time

**FT-24 Date.**
- Air-datepicker in the user's `date_format` (`controls/date.js:45-131`).
- **`t` sets today** (:138-154).
- Invalid text is cleared with a message (:170-179).
- `options` may be JSON datepicker options (:180-195).
- Stored `YYYY-MM-DD`.
- DS: DateField with the site format display (`FF:282-286`).
- Missing: the `t` shortcut; the `options` JSON (e.g. min / max date). → C, small.

**FT-25 Datetime.**
- Typed in the user's time zone, stored in the system time zone (`controls/datetime.js:47-60`). The description gets
  the zone when they differ (:65-80).
- DS: `FF:160-161, 287-288`.
  - Seconds are forced to `:00`.
  - No time-zone conversion while editing. The read display converts (`FMT:371`).
- Real-site only: a site whose user zone differs from the system zone. → C.

**FT-26 Time.**
- The time picker; `t` = now; invalid text is cleared (`controls/time.js:88-111`). Stored `HH:mm:ss`.
- DS: TimeInput (12 h from `time_format`, a Now button) `FF:289-290`. Missing: the `t` shortcut. → C, small.

### Media and special integrations

**FT-28 Color.**
- An input plus a popover picker with swatches (`controls/color.js:10-84`).
- Only `#RRGGBB` is accepted; anything else becomes null (:107-116).
- Read display: a swatch plus the hex (`formatters.js:390-397`).
- DS: ColorInput (hex box, the same rule) `FF:299-300`.
- Missing: the picker popover; the Read swatch (the DS shows the text only). → Core (C).

**FT-29 / FT-30 Attach / Attach Image.** Covered in P36b.
- Library, Link, Camera, Crop, max_file_size, `remove_attach`, save after upload: `FAF` header and
  `tests/attach-image-p36b.test.tsx`.
- Not reproduced: Google Drive.

**FT-31 Image.**
- Shows the URL in `doc[df.options]` (`controls/image.js:8-22`). No value of its own.
- DS: `FF:202`. Complete.

**FT-32 Signature.**
- jSignature pad. Stored as a base64 data URL (`controls/signature.js:29-57, 130-135`). Reset / Save; the image when
  Read.
- Missing:
  - a Core `SignaturePad` (canvas → PNG data URL, pointer events, RTL-neutral);
  - the FrappeField dispatch.

  → Phase 2.

**FT-33 Barcode.**
- Text in; **the stored value is the JsBarcode `<svg …data-barcode-value>` markup** (`controls/barcode.js:14-42`).
- `options` = the format (:59+).
- Server: not sanitized (`bd:1117`).
- Missing: needs JsBarcode, or an equivalent SVG generator (a peer dependency), and must store the SVG exactly as Desk
  does. Showing only the raw text would break Desk round-trips. → Phase 3, with a dependency decision.

**FT-34 Geolocation.**
- A Leaflet map with draw / locate controls. GeoJSON FeatureCollection (`controls/geolocation.js:37-258`).
- Shown even when empty and Read (`controls/base_control.js:127`, DS `FT:14`).
- Missing: a map (Leaflet as an optional peer). A read-only GeoJSON summary would be a first step. → Phase 3, with a
  dependency decision.

**FT-35 Icon.**
- A popover picker over the SVG sprite's `icon-*` symbols (`controls/icon.js:11-80`). Read shows the icon and its
  name (`formatters.js:398-405`).
- Missing: an icon picker over the app's icon set (the DS uses lucide; Frappe names differ). → Phase 3, low priority.

### Layout and display

**FT-36 Table.**
- Grid with:
  - add / delete / duplicate / move;
  - the row form;
  - paste from a spreadsheet (`controls/table.js:19-117`);
  - `cannot_add_rows` / `cannot_delete_rows`;
  - `static_rows`.
- DS: `FCT` over `DataGrid`. Grid gaps are listed in P35 A-form §G. This audit adds: paste from a spreadsheet.

**FT-38 / FT-39 / FT-40 Section / Column / Tab Break.**
- `layout.js:173-195`. Section options:
  - `collapsible` and `collapsible_depends_on`;
  - a label and a description;
  - `hide_border`.
- A "Details" tab is inserted when the first field is not a Tab Break (`layout.js:150-170`).
- DS: `LY:31-60`; `FFV:735-760` (collapsible, forced open by a missing mandatory field). Section and Tab Break COMPLETE
  (cosmetic gaps: `hide_border`, the remembered collapse state `section.js:13-19`, Tab Break `show_dashboard`). Column
  Break PARTIAL (P36e): its `label` and `description` are not rendered (`column.js:22-36`).

**FT-41 Fold.**
- Everything after it sits behind "Show more details" / "Hide details" (`layout.js:270-295`).
- Only one per form, and it must precede a Section Break (`dt:1416-1427`).
- DS: treated as a Section Break (`LY:24`). Everything is always shown. → C. Collapse the sections after a Fold behind
  a toggle in `FFV`.

**FT-42 Heading.**
- ControlHTML with the label as `<h4>` (`controls/heading.js:2-4`). DS `FF:200`.
- Verify: the empty-Read visibility of Heading through ControlHTML's own status path (`controls/html.js`). Not read in
  this audit.

**FT-43 HTML.**
- `df.options` rendered as HTML (`controls/html.js:10-19`), **not sanitized**. Client scripts write
  `frm.fields_dict.x.$wrapper.html(…)`.
- DS: renders sanitized `df.options` (`FF:199`). The safer choice; a difference from Desk.
- Missing: an equivalent of scripted content. Today that is a meta override through `frm.set_df_property`, or a slot.
  → C (an `htmlSlots` / render-prop for HTML fields).

**FT-44 Button.**
- Native:
  - always writable (`controls/button.js:2-5`);
  - a form-script handler `frm.script_manager.trigger(fieldname)`; otherwise, when `options` is set, the
    **deprecated** `run_doc_method` with `docs` + `method` (:20-48);
  - `primary` and `btn_size`.
- DS: `onButtonClick(fieldname)` → the form's events (`FF:201`, `FFV` `trigger`). The `options` → `run_doc_method`
  path is missing. The simulator refuses `run_doc_method` without a handler (`src/frappe/testing/fixtureTransport.ts`
  `run_doc_method`).
- Missing: `btn_size`. → C.

## 5. Implementation strategy

### 5.1 Architecture per type

| Layer | Holds | Does not hold |
|---|---|---|
| **Core** (`src/fields`, `src/primitives`) | Framework-free controls, value in / value out, a11y, RTL, keyboard: NumberInput, TimeInput, DurationInput, DateField / DateTimeField, LinkInput (+ autocomplete), Rating, ColorInput, AttachInput, RichTextEditor, ReadOnlyValue, DataGrid, Checkbox, Select, Textarea | DocField, permissions, server calls, stored formats |
| **Frappe layer** (`src/frappe/form`, `src/frappe/services`) | `FrappeField` dispatch by `df.fieldtype` → Core control; stored formats (fraction, seconds, `YYYY-MM-DD`, `+isd-number`, SVG barcode); `formatValue`; status ladder; mandatory; `depends_on`; fetch; search / validate / upload; simulator handlers; issues banner for unsupported types | Business rules of any app |
| **CRM / app consumer** | Picks a DocType, passes `doc`, `status`, `bundle`, events (`setQuery`, `onButtonClick`), renders `FrappeForm` / `FrappeField` / `CrmEntityFormFields` | Re-implementing any control or validation |

| Type(s) | Core part | Frappe-layer part | CRM consumes |
|---|---|---|---|
| Data (+ Email / Name / Phone / URL / Barcode / IBAN) | text input, URL open button, copy button, IBAN grouping | `dataOptionInvalid` (+ Name, IBAN), `maxlength` rules | FrappeField |
| Small Text / Text / Long Text / Read Only / Password | textarea, ReadOnlyValue, password reveal | debounce, mask handling, strength call | FrappeField |
| Text Editor | RichTextEditor (+ mentions, image paste) | mention source `get_names_for_mentions`, image upload | FrappeField |
| Code / JSON / HTML Editor / Markdown Editor | `CodeEditor` (optional peer), preview pane | language from `options`, JSON soft check | FrappeField |
| Select / Autocomplete | Select (sort), LinkInput | options parse, `get_query` server search | FrappeField |
| Link / Dynamic Link / Table MultiSelect | LinkInput, pills | `search_link`, `validate_link`, fetch, titles, create-new, advanced search | FrappeField |
| Check / Int / Long Int / Float / Currency / Percent / Rating / Duration | Checkbox, NumberInput, Rating, DurationInput | precision and currency resolution, fraction mapping | FrappeField |
| Date / Datetime / Time | DateField, DateTimeField, TimeInput (`t` key) | site formats, user ↔ system TZ | FrappeField |
| Phone | **PhoneInput** (new) | country list (server), `+isd-number` | FrappeField |
| Color / Icon | ColorInput (+ picker), **IconPicker** (new) | icon set source | FrappeField |
| Attach / Attach Image / Image | AttachInput, FileDropzone, ImageCropper, CameraCapture | `upload_file`, `remove_attach`, docinfo | FrappeField / FrappeAttachHost |
| Signature | **SignaturePad** (new) | data URL value | FrappeField |
| Barcode | **BarcodeInput** (new, peer) | SVG value as Desk | FrappeField |
| Geolocation | **GeoMap** (new, peer) | GeoJSON value | FrappeField |
| Table | DataGrid | child metas, row events, permissions | FrappeForm |
| Section / Column / Tab Break / Fold / Heading / HTML / Button | layout primitives | `buildLayout`, Fold toggle, events, `run_doc_method` | FrappeForm |

### 5.2 Missing components and integration gaps

New Core components:
- `PhoneInput`
- `SignaturePad`
- `CodeEditor` (an optional peer)
- `IconPicker`
- `BarcodeInput` (a peer)
- `GeoMap` (a peer)
- a Color picker popover

New Frappe integrations:
- Phone country list: `frappe.geo.country_info.get_country_timezone_info`, plus a simulated handler.
- Password strength: `frappe.core.doctype.user.user.test_password_strength`.
- Autocomplete `get_query`.
- Link "Advanced Search".
- Button `run_doc_method`.
- Text Editor mentions (`frappe.desk.search.get_names_for_mentions` is already simulated) and image upload.
- Datetime time-zone conversion while editing.

Metadata the DS ignores today:
- `with_copy_button`;
- `sort_options`;
- `max_height`;
- `btn_size`;
- Date `options` JSON;
- the Code `options` language;
- Fold;
- `maxlength` on Link / Select;
- the Singles length exemption.

### 5.3 Prioritised plan

Sizes: S ≤ ½ day · M 1–2 days · L 3–5 days, with tests and a showcase row each.

| Phase | Item | Layer | Size | Why first |
|---|---|---|---|---|
| **1 — data correctness** | Phone fieldtype: Core PhoneInput + `+isd-number` + simulated country list | Core + Frappe | L | The server rejects values the DS writes today (`utils:101-125`) |
| 1 | Data (Name) and Data (IBAN) soft checks; IBAN input strip / grouping | Frappe | S | Server-validated; users get no hint |
| 1 | Datetime edit in the user TZ ↔ system TZ; keep seconds | Frappe | M | Silent data shift on sites with differing zones |
| 1 | Currency: resolve the field currency for the edit format | Frappe | S | Wrong separators / precision in the input |
| 1 | `maxlength` for Link / Dynamic Link / Select; Singles exemption | Frappe | S | The server length check (`bd:981-1014`) |
| **2 — everyday interaction** | Data (URL) open-link button and the Read display as a link; Color swatch in Read | Core + Frappe | S | Common in CRM records |
| 2 | Date / Datetime / Time `t` shortcut; Date `options` JSON (min / max) | Core | S | Desk muscle memory |
| 2 | Password show / hide + strength (server) | Core + Frappe | M | User and settings forms |
| 2 | Fold ("Show more details") | Frappe | S | Long DocTypes |
| 2 | Select `sort_options`; Autocomplete `get_query` | Frappe | M | Script-driven forms |
| 2 | Signature: Core SignaturePad + dispatch | Core + Frappe | M | No dependency needed; used in approvals |
| 2 | Button `options` → `run_doc_method` (deprecated in Desk but still live) + simulated handler | Frappe | S | Legacy DocTypes |
| **3 — rich and peer-dependent** | Code / JSON / HTML / Markdown editor (optional peer) + JSON soft check + previews | Core + Frappe | L | Admin and developer DocTypes |
| 3 | Text Editor mentions, image paste / upload, tables | Core + Frappe | L | Comments / notes parity |
| 3 | Link Advanced Search dialog | Frappe | M | Large link targets |
| 3 | Barcode (SVG value as Desk), Geolocation (map), Icon picker | Core + Frappe | L each | Need dependency decisions |
| 3 | HTML field scripted content (slot / render-prop) | Frappe | S | Client-script parity |
| 3 | Table: paste from a spreadsheet | Core + Frappe | M | Bulk entry |

### 5.4 Top gaps for agent C (owner of `src/fields`, `src/frappe/form`) or the next batch

1. **Phone fieldtype** stores free text. Desk stores `+isd-number`, and the server validates it with `phonenumbers`
   (`controls/phone.js:163-187`, `utils:101-125`). Add a Core PhoneInput and a Frappe wrapper.
2. **`dataOptionInvalid` lacks Name and IBAN** (`FF:86-93`; server `bd:942-955`). IBAN input formatting is missing
   (`controls/data.js:124-128, 268-278`).
3. **Datetime edit time zone**, and seconds lost (`FF:160-161`; `controls/datetime.js:47-60`).
4. **Currency edit format** ignores the field currency (`FF:248`; `controls/float.js:15-20`).
5. **`maxlength`** missing on Link / Dynamic Link / Select, and no Singles exemption (`FF:82`;
   `controls/data.js:228-239`).
6. **Data (URL)**: no open-link button; the Read display is not a link (`FF:226`; `controls/data.js:81-122`,
   `formatters.js:37-40`).
7. **Fold** is rendered as a plain Section Break (`LY:24`; `layout.js:270-295`).
8. **Placeholders** are honoured only by Data / Select / Autocomplete / Link (`FF:156, 274, 321`). Desk sets one on
   every input (`controls/data.js:244`).
9. **Signature** has no control (`FF:193-196`). A Core SignaturePad needs no new dependency.
10. **Password** has no reveal toggle (`controls/password.js:36-53`).
11. **Code-family** types are plain textareas (no language, preview, copy or JSON check). Needs a peer-dependency
    decision.
12. **Button `options`** (`run_doc_method`) and **Autocomplete `get_query`** are not wired.

## 6. Evidence and limits

- Tests: `t/p36d` (P36D.fieldtypes.1-16) and the existing tests cited per row. All jsdom. Server answers come from the
  SIMULATOR (`createFixtureTransport`).
- Showcase: the "Frappe Field Types" group renders every type through the real `FrappeField` from a DocField. Link,
  Dynamic Link, Table MultiSelect and Attach run on the SIMULATED site. MISSING types show a "Not implemented yet" row
  with FrappeField's read-only fallback.
- **Only a real site can confirm:**
  - Phone `phonenumbers` acceptance;
  - Datetime with differing time zones;
  - `run_doc_method`;
  - Text Editor image extraction;
  - the server sanitizer's output;
  - the Password `__Auth` round-trip;
  - Barcode SVG compatibility;
  - permlevel resets on save.
