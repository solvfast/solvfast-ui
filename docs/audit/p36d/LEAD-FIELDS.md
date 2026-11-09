# P36d workstream C "fields": CRM Lead Details field audit against native Frappe 15.110

Branches: package `feat/0.7.x/p36d-fields` (base 6ea5eb9), CRM `crm/p36d-fields` (base c38335f).
Evidence is unit tests (jsdom), the in-package SIMULATOR and Playwright runs on local scratch builds with mock data.
Nothing here was checked against a real Frappe site, and nothing touched one.

Modes used in every row:
- **MOCK**: the live CRM data mode. LeadDetailPage renders its own editors over the in-memory stores. Observed on
  `/crm-app/leads/2` in a local build. The legacy route keeps the old editors; every change below is gated on `dsScope`.
- **SIM**: a build with `VITE_CRM_ALLOW_SIMULATED=true`, opened with `?crm_data=simulated`. `CrmEditableCard` →
  `CrmEntityFormFields` → package `FrappeField` over the DRAFT meta, served by `createFixtureTransport`. Labelled SIMULATED.

Field type source: the DRAFT meta `frontend/src/sear_studio/data/frappe/meta/serve_fast_lead.json` (38 fields). For
page fields that are not in it, the source is given in the row: the Contact or Organization DRAFT meta, the Field Library
`FormField.type` mapped through `mappers.ts` `FIELDTYPE` (`formFieldToDocField`), or "derived".

Probe: `scratchpad/p36d/fields/probe.mjs` (attributes and interactions, before and after builds). Raw results are in
`p36d/fields/before/probe.json` and `p36d/fields/after/probe.json`, with shots alongside. `orgpick.mjs` covers Link
keyboard picking.

## 1. Inventory and parity (Lead Profile card editors)

Status: **OK** native-equivalent · **FIXED** (this workstream; level in brackets) · **GAP** remaining (§4).

| Field | Frappe type (+options) | Mode | Current component (after) | Expected native behaviour (file:line) | Actual behaviour (before → after) | Status |
|---|---|---|---|---|---|---|
| lead_type | Link → Serve Fast CRM Type, `link_filters` kind=lead | MOCK | `CrmMockLinkInput` (DS `LinkInput`, Desk mode) over active lead types | Link input: type to search (link.js:262-266, 500 ms debounce), title shown (link.js:117-132), typed text validated, unknown text clears (link.js:708-760), maxlength 140 (data.js:229-238) | before: Radix Select (no typing, no clearing) → after: combobox, maxlength 140, title shown, typed name or title kept, unknown text cleared | FIXED [CRM] |
| lead_type | same | SIM | `FrappeField` → `FrappeLinkField` | same + `search_link` with link_filters (FrappeLinkField parseLinkFilters) | combobox, maxlength 140 (was none). It shows `leadtype_2` and the search is empty because the simulator has no "Serve Fast CRM Type" meta or docs | OK (sim data gap §4) |
| lead_source | Select `\nwebsite\nreferral\npartner\ncold_call\nevent\nsocial\nother` | MOCK | DS-scope Radix Select with an empty first option | native `<select>` whose first option is empty, so the value can be cleared (select.js:61-88, :111-136); labels through `__()` (select.js:172-175) | before: no empty option, cannot clear → after: empty option clears the value; labels from the CRM's leadSourceLabels (they act as the translation) | FIXED [CRM] |
| lead_source | same | SIM | `FrappeField` Select | same | empty option plus raw keys (`cold_call`), which is native `__(value)` with no translation | OK; label proposal §4 |
| job_title | Data | MOCK | CRM `Input` + maxLength 140 | `<input type=text autocomplete=off maxlength=140>` (data.js:4-15, :229-238), written on input with a 500 ms debounce and on change (data.js:175-188) | before: no maxlength (accepted 200 chars) → after: 140 | FIXED [CRM] |
| job_title | Data | SIM | `FrappeField` Data | same | type=text, maxlength 140, autocomplete=off (new) | OK / FIXED [Frappe layer] |
| organization | Link → Serve Fast Organization (`show_title_field_in_link` 1, title company_name); `organization_name` fetch_from | MOCK | `CrmMockLinkInput` over listOrganizations, open link → `/crm-app/organizations/<id>` | Link search shows title and description; Enter picks; the title is shown for the value; a typed unknown value clears; open-record button (link.js:16-27) | before: Radix Select of every org, no search → after: typed "Rot" lists Rotana Hotels, Enter picks it and shows the title, `zzz` + Tab clears, typing the name "5" resolves to Rotana Hotels, open link `/serve-fast/crm-app/organizations/5` (orgpick.mjs) | FIXED [CRM] |
| organization | same | SIM | `FrappeLinkField` | same + `validate_link` with fetch → organization_name | before: showed the raw name **"2"** → after: shows **"Aramco Travel Desk"** through `frappe.desk.search.get_link_title` (link.js:120-132; search.py:327-334); search, pick, unknown cleared and fetch_from as before. No open button: CrmEntityFormFields sets `linkHref: () => undefined` on purpose | FIXED [Frappe layer]; open link GAP §4 |
| email | Data, options Email | MOCK | CRM `Input` dir=ltr, maxLength 140, autocomplete=off, aria-invalid + red border from `dataOptionInvalid` | text input; `validate` flags with Desk's email pattern over `split_emails` (data.js:293-306, utils.js:470-473, :839-853); `has-error` (base_input.js:217-226); the server refuses on save "{0} is not a valid Email Address" (base_document.py:922-955 → utils/__init__.py:166-197) | before: no flag, saved "not-an-email" → after: `a@b.c` and `not-an-email` flagged; Save refused with the server's message; nothing stored | FIXED [CRM] |
| email | same | SIM | `FrappeField` Data | same | before: `type=email`, package pattern accepted `a@b.c` → after: `type=text`, Desk pattern, `a@b.c` flagged. Save of an invalid address is still ACCEPTED: the simulator has no `_validate_data_fields` | FIXED [Frappe layer]; server GAP §4 |
| mobile | Data, options Phone (not the Phone fieldtype) | MOCK | `Input` dir=ltr, maxLength 140, autocomplete=off, aria-invalid | text input (no tel type, no country picker); `/^([0-9 +_\-,.*#()]){1,20}$/` on the raw text (data.js:287-289, utils.js:455-456); the server refuses with "{0} is not a valid Phone Number" (utils/__init__.py:128-144) | before: no flag → after: `05x-abc` flagged, Save refused with the server message | FIXED [CRM] |
| mobile | same | SIM | `FrappeField` Data | same | before: `type=tel` → after: `type=text`, flagged; simulator save accepts it | FIXED [Frappe layer]; server GAP §4 |
| work_phone | Data/Phone, from the Contact meta (not in the Lead meta) | MOCK | as mobile | as mobile | as mobile | FIXED [CRM] |
| work_phone | – | SIM | not rendered (not a Lead DocField) | – | absent in SIM (mode difference, not a bug) | n/a |
| annual_revenue | Currency, non_negative | MOCK | DS `NumberInput kind=currency precision=2 selectOnFocus` | text input, number format and precision (currency.js:29-42, float.js:2-13), arithmetic (int.js:14-37), select on focus (int.js:7-12, inherited), written on change/blur; negative values are refused by the server only: "Value cannot be negative for {doctype}: {label}" (document.py:656-676) | before: `type=number` (spinner; `1000*2` cannot be typed) → after: `32,000,000.00`, `1000*2` → `2,000.00`, focus selects all, `-5` not flagged, Save refused with the server message | FIXED [CRM] |
| annual_revenue | same | SIM | `FrappeField` → NumberInput | same | before: no select-on-focus → after: selects on focus; `inputmode=decimal` (native: numeric, §4); simulator accepts -5 | FIXED [Frappe layer]; server GAP §4 |
| address | Small Text | MOCK | `Textarea rows=5` | textarea, 150 px (text.js:18-23), no maxlength | before: single-line `Input` → after: textarea | FIXED [CRM] |
| address | Small Text | SIM | `FrappeField` textarea | same; placeholder through `__()` (data.js:244) | textarea; placeholder now passed (was dropped) | OK / FIXED [Frappe layer] |
| city, country | Data | MOCK | `Input` maxLength 140 | Data | before: no maxlength → after: 140 | FIXED [CRM] |
| city, country | Data | SIM | `FrappeField` Data | Data | maxlength 140, autocomplete=off | OK |
| lost_reason | Small Text, `depends_on` + `mandatory_depends_on` lifecycle_stage=='Unqualified' | MOCK | `Textarea` aria-required; Save refuses an empty value | mandatory when Unqualified: label marked as required, "Missing Fields" on save (save.js:182-262, is_docfield_mandatory :268) | before: an empty value saved → after: refused with "Missing Fields: …: Lost Reason" (CRM app only) | FIXED [CRM] |
| lost_reason | same | SIM | `FrappeField` via CrmEditableCard + `crmMissingFields` (`checkMandatory` evaluates mandatory_depends_on) | same | already native (required, refused) | OK |

## 2. Inventory: the rest of the page

| Field / area | Frappe type (source) | Mode | Component | Native expectation | Observed | Status |
|---|---|---|---|---|---|---|
| Header name (first_name, last_name; ar: first_name_ar, last_name_ar) | Data reqd ×2; ar Data ×2 | both | DS `EditableTitle` → `renameLead` splits on whitespace | two separate required Data fields; title = full_name (read_only, computed) | a single word sets last_name "" (native: Mandatory). In SIM it writes the MOCK store while a Frappe doc is shown (two truths) | GAP, not mine (header) §4 |
| Salutation | Select `\nMr\nMs\nMrs\nDr` (Contact meta) | both | text "Mr." | Select formatter | read-only display; no editor on the page | OK (display) |
| Status pill | lifecycle_stage: Link → Workflow State, read_only | both | StatusBadge / CrmStatusActions | read-only Link with the workflow indicator | read-only | OK |
| Phase pill | derived from lifecycle_stage | SIM | text pill | – | read-only | OK |
| Header subline job title / org button | job_title Data; organization Link | both | text + button opening the org | Link display opens the record | OK | OK |
| Highlight row: Lead Type / Lead Source / Assignee | Link / Select / contact_owner Link User | both | chips / text / avatar | read-only formatted values | CRM labels (lead_source translated) | OK |
| Info rows: Full name, Arabic name, Job title, Email | full_name Data read_only; *_ar Data; Data; Data/Email | both | InfoRow text | Data formatter (formatters.js:36-48) | plain text | OK |
| Info row "Phone" | mobile, Data/Phone; meta label "Mobile" | both | InfoRow | label "Mobile" | the label reads "Phone" and the editor reads "Mobile" | GAP (label) §4 |
| Info rows Work phone, Industry, Employees | Contact Data/Phone; Contact `industry` Data; Organization `employee_range` Select | both | InfoRow | formatted values | read-only | OK |
| Info row Annual Revenue | Currency | both | Intl currency, 0 decimals, locale digits in ar | format_currency, precision 2 (formatters.js:123-161) → `$ 32,000,000.00` | `$32,000,000` / Arabic digits | GAP (display) §4 |
| Info row Created on | creation (standard Datetime) | both | date only | Datetime formatter | date shown | OK |
| Info row "Last activity (derived)" | derived from activities; the meta `last_activity` (Date, read_only) is not shown | both | text | – | labelled derived | OK (documented) |
| Prerequisites card | `lead_prerequisites` JSON (json.js:1-6, Ace editor) holding Field Library values; each value's type = FormField.type → `FIELDTYPE` (mappers.ts): dropdown→Select, text→Data, date→Date, file_upload→Attach, long_text→Small Text, email/phone→Data(Email/Phone) | MOCK | `PrerequisiteFieldInput` | per mapped DocField | text/email/phone now type=text, maxlength 140, Email/Phone flagged (DS scope only); required check already existed; date stays `<input type=date>`, file stays a name-only picker | partly FIXED [CRM]; GAP §4 |
| Prerequisites card | same | SIM | read-only + SampleDataNote (CrmEditableCard without `frappe`) | – | read-only on purpose ("no second truth") | GAP (owner decision) §4 |
| Rail: Lifecycle | lifecycle_stage | both | CrmStatusActions / WorkflowRailWidget | workflow actions | not a field editor | OK |
| Rail: Assignment | contact_owner (Link User) + `_assign` | both | CrmAssignee / CrmAssignTo | assign_to sidebar | out of field scope (P32/P35 audits) | n/a |
| Rail: Organization | organization Link | MOCK | RecordPicker (pencil / ×) | Link | a picker, not a Link input; writes the same field as the profile card | GAP (owner) §4 |
| Rail: Organization | same | SIM | locked (isLocked) | – | read-only | OK |
| Rail: Playbook, Tasks, Notes, Attachments, footer | other DocTypes (ToDo, Note, File) / owner, creation | both | cards | – | not Lead DocFields; Attachments belongs to the integrator | n/a |
| Popups: Email (To, Cc, Subject, Message), Remind (interval, note), Delete | Communication / reminder, not Lead DocFields | MOCK | CRM inputs | – | out of scope (not Lead fields) | n/a |
| Activities tab create forms (note, email, call, meeting, task, chat, attachment) | Note / Communication / Event / ToDo | MOCK | CRM forms | – | out of scope | n/a |
| Meta fields NOT on the page | priority (Select Low/Medium/High/Urgent), organization_name(_ar) (fetched, read_only), converted_deal (Link read_only, shown as a deal banner), converted_at (Date read_only), last_activity (Date read_only), job_title_ar / name_ar editors | – | – | – | priority cannot be seen or edited anywhere on the page (print only) | GAP (owner) §4 |

## 3. Fixes and their level

Package (`@solvfast/ui` 0.7, Frappe layer `src/frappe/form` unless stated):
1. `dataOptionInvalid` now uses Desk's four `validate_type` patterns verbatim (utils.js:450-480, checked textually by
   `p36d/fields/recheck.mjs`). Email runs over the new `splitEmails` (utils.js:839-853). Phone, Name and URL use the
   raw text. The Name option is new. Before: a home-made email pattern (accepted `a@b.c`), a home-made URL pattern, and
   trimming.
2. A Data input is always `type="text" autocomplete="off"` (data.js:4-15); it was `email`, `tel` or `url` by option. LTR
   is kept for Email, Phone and URL. The Phone FIELDTYPE keeps `tel`.
3. maxlength `df.length || 140` on Data, Link, Dynamic Link, Password and Read Only, not on a Single (data.js:229-238).
   Link inputs had none.
4. Desk's "Data Clipped" message (title and text, orange) when a pasted text is longer than maxlength (data.js:19-62),
   on Data and Link inputs. The Customize Form note is not reproduced. New strings are in `messages-ws/fields.ts` (en+ar).
5. Float, Currency and Percent select their text on focus, as Int does (int.js:7-12 is inherited by float.js:1, :29).
6. Placeholders go through `__()` (data.js:244, select.js:31). Link, Small Text and Text now receive the placeholder.
7. Link titles: a value whose title is not cached is titled through `frappe.desk.search.get_link_title` (link.js:117-132,
   utils.js:1585-1604). Errors are swallowed and the name stays. New `FormServices.getLinkTitle` (optional, with a
   default). There is no boot `link_title_doctypes`: the request is skipped only when the target meta is already loaded
   and says "no titles".
8. SIMULATED handler `frappe.desk.search.get_link_title` in `src/frappe/testing/handlers/fields.ts` (search.py:327-334:
   title, docname or null; an unknown DocType gives DoesNotExistError).
9. Core `src/fields/LinkInput.tsx`: two additive typed props, `maxLength?: number` and `onPaste?`, placed on the
   `<input>`. Defaults are unchanged: without them nothing is set. These props already passed through the rest spread at
   runtime, so this is a typing and placement change only. Committed in 676cda7, before the owner froze LinkInput.
10. `splitEmails` is exported from `src/frappe/form/index.ts` (`// P36d fields`).

CRM (`crm/p36d-fields`; every change only inside `dsScope` / `inDs`, legacy and SD/SM unchanged):
1. `CrmEntityFormFields.tsx` adds `CrmMockLinkInput` (the DS LinkInput in Desk mode over an in-memory list, with
   validate_link semantics and an open link through `useHref`), `crmDataInvalid`, `crmMockSaveErrors` (the server's
   messages for Email, Phone and non_negative, guarding the mock store) and `CRM_DATA_MAXLENGTH`.
2. `LeadDetailPage.tsx` Lead Profile `renderEdit` + save:
   - lead_type and organization use the Link input;
   - lead_source gets its empty option;
   - Data inputs get maxlength 140, and Email / Phone are flagged;
   - annual_revenue uses NumberInput (currency, precision 2, select on focus);
   - address is a textarea;
   - Save refuses invalid Email / Phone and negative revenue with the server messages.
   Lost Reason: aria-required, and an empty value is refused ("Missing Fields").
3. `PrerequisiteFormFields.tsx`, inside the DS scope only: text, email and phone inputs become type=text, maxlength 140,
   autocomplete=off, and Email / Phone are flagged.

## 4. Remaining mismatches and owner-decision proposals

1. **Simulator server validation (not my file).** `fixtureTransport.ts` `save()` does not run `_validate_data_fields`
   (base_document.py:922-955), `_validate_non_negative` (document.py:656-676) or `_validate_length`
   (base_document.py:981-1010). In SIM, `not-an-email`, `05x-abc` and `-5` are saved. Need: the fixtureTransport owner
   adds them. A workstream handler cannot wrap `savedocs`, because `save` is not on the context.
2. **Header rename (not mine).** `renameLead` splits on whitespace, so a one-word name sets last_name "" (native: Mandatory).
   In SIM it writes the mock store while a Frappe doc is shown. Proposal: in SIM, route it through `useSaveDoc` with
   first_name/last_name, or lock it; in MOCK, refuse an empty last name.
3. **Priority** (Select, in the meta) is not on the page in either mode. Proposal: add it to the Lead Profile card (both
   modes; CrmEditableCard `fields`). Product decision.
4. **Prerequisites in SIM are read-only.** The native field is the JSON blob `lead_prerequisites` (an Ace JSON editor).
   Proposal: keep the Type-field rendering, and in SIM write through `formFieldToDocField` + FrappeField, saving JSON in
   `lead_prerequisites`. This is a big change. In MOCK, the date input (`<input type=date>`, not Desk's datepicker in the
   user date format) and the file input (stores only a file name) also remain. The earlier owner ruling keeps package
   controls out of mock mode for prerequisites.
5. **Replacing every mock editor with FrappeField** when no Frappe document exists: not done (owner decision). The mock
   editors now mirror the semantics instead.
6. **Display formatting.** Annual Revenue shows 0 decimals and locale digits; native shows `format_currency` with precision 2
   and the system number format. The "Phone" info-row label differs from the meta label "Mobile". Lead Source shows CRM
   labels in MOCK and raw keys in SIM: proposal to give the DRAFT meta Select human options or translations (A5, meta
   owner).
7. **Organization open-record link in SIM** is hidden on purpose (`linkHref: () => undefined` in CrmEntityFormFields).
   Proposal: a `linkHref` mapping to `/crm-app/<entity>/<name>`.
8. **Rail Organization picker (MOCK)** is a RecordPicker writing `organization`, a second editor of one Link field.
   Proposal: keep it as the rail's Kind B pattern (P34 spec) or make it read-only.
9. **Package details deliberately left alone:**
   - Number inputs use `inputmode=decimal`; Desk inherits `numeric` from Int (int.js:3), which hides the decimal key on iOS.
   - FrappeLinkField and LinkInput show a clear × that Desk's Link does not have.
   - The Select shows a stray value as an extra item; Desk shows a blank `<select>` (select.js:41-60).
   - The label is bold for reqd/bold fields; Desk bolds the INPUT (base_input.js:229-236). Changing this is visual and
     DS-wide.
   - Desk keeps a stale `df.invalid` when the value is emptied (data.js:281-283); the package clears it.
   - The Name pattern is ASCII-only on the client, as in Desk, so Arabic names are flagged there while the server's
     Python `\w` accepts them.
10. The simulator has no "Serve Fast CRM Type" meta or docs, so lead_type in SIM shows `leadtype_2` and searches nothing
    (data gap in fixtureBackend.ts, not mine).
11. Focus colours: not changed; agent A owns them. The invalid state uses `border-destructive` /
    `focus-visible:ring-destructive/40` on the CRM inputs (the same token as the DS FIELD_INVALID).

## 5. Frappe source and metadata inspected (v15.110, read-only)

- controls/data.js:1-323 (input type :4-5, autocomplete :15, paste :19-62, URL :81-122, change :175-188, maxlength
  :228-254, validate :280-313; Read Only = Data :323)
- controls/link.js (title :102-145, :152-163; search debounce :262-266; create :323-334; link_filters :599-702; validate
  :704-760)
- controls/select.js:1-185; int.js:1-43; float.js:1-26; currency.js (float.js:29-42); text.js:1-23 (Small Text 150 px);
  json.js:1-6 (ControlCode / Ace); date.js:1-35; phone.js:4 (ControlPhone extends ControlData); base_input.js:207-236;
  base_control.js:195-244
- utils/utils.js:450-480 validate_type, :839-853 split_emails, :1564-1604 link titles; utils/datatype.js:41-55
- form/formatters.js: Data :36-48, Select :52, Currency :123-161, Link :167, Date :220, Text :255, SmallText :326
- form/save.js:182-270 (Missing Fields)
- server: model/base_document.py:892-955 (_validate_selects, _validate_data_fields), :981-1010 (_validate_length);
  model/document.py:656-676 (_validate_non_negative); utils/__init__.py:37-41 (patterns), :101-222 (validate_phone_number,
  validate_name, validate_email_address, split_emails, validate_url); desk/search.py:327-334 (get_link_title); boot.py:437-444
- DRAFT metas: serve_fast_lead.json (38 fields), serve_fast_contact.json (salutation, work_phone, industry),
  serve_fast_organization.json (title company_name, show_title_field_in_link 1, employee_range); Field Library:
  fieldDefinitionStore.ts, resolvePrerequisites; mappers.ts FIELDTYPE / formFieldToDocField

## 6. Files changed

Package:
- src/frappe/form/FrappeField.tsx
- src/frappe/form/FrappeLinkField.tsx
- src/frappe/form/services.tsx
- src/frappe/form/index.ts
- src/frappe/testing/handlers/fields.ts (new)
- src/frappe/testing/handlers/index.ts
- src/theme/messages-ws/fields.ts (new)
- src/theme/messages-ws/index.ts
- src/fields/LinkInput.tsx (typed props only, see §3.9)
- tests/fields-p36d.test.tsx (new)
- docs/audit/p36d/LEAD-FIELDS.md (new)

CRM:
- components/forms/CrmEntityFormFields.tsx
- pages/Leads/LeadDetailPage.tsx (Lead Profile and Lost Reason editors and save only)
- components/PrerequisiteFormFields.tsx

## 7. Tests

`tests/fields-p36d.test.tsx`, 11 tests:
- P36D.fields.1: input type, autocomplete, maxlength, dir; Phone fieldtype negative control.
- P36D.fields.2: pattern vectors (Email / Phone / Name / URL, empty).
- P36D.fields.3: flagged, not refused; valid negative control.
- P36D.fields.4: Data Clipped, with a within-limit negative control.
- P36D.fields.5: select on focus for Int / Float / Currency / Percent.
- P36D.fields.6: translated placeholders on Data / Small Text / Link.
- P36D.fields.7: Link maxlength + paste.
- P36D.fields.8: title via get_link_title, with a request-shape assertion. SIMULATED.
- P36D.fields.9: no-title / missing / unknown DocType keep the name, no dialog (negative controls).
- P36D.fields.10: simulated handler shapes.
- P36D.fields.11: LinkInput prop pass-through, with a negative control.

With the src changes stashed, 9 of the 11 fail. P36D.fields.9 and .11 are negative or pass-through controls.

CRM Playwright: `p36d/fields/probe.mjs` (before/after, MOCK and SIM) and `orgpick.mjs`.

## 8. Gates

Package (/home/frappe/sfui-dev/p36d-fields):
- `npm run typecheck`: 0 errors.
- `node scripts/check-boundaries.mjs`: boundaries OK.
- `npx vitest run` (full suite): 86 files, 1689 passed, 10 todo, 0 failed.
  - A first run made while the CRM builds were running had 7 timeouts at 5 s in list tests. Re-run alone: 104/104 passed.
  - A clean re-run of the full suite then passed.
- `tests/fields-p36d.test.tsx`: 11/11.

CRM, scratch copies built against a local pack of this branch (0.7.0-dev.4 + P36d), in `p36d/fields/crm/{final,final-sim}`:
- `tsc -p tsconfig.app.json`: 30 errors, equal to the baseline; 0 in the changed files.
- vite build: OK, both the plain build and the `VITE_CRM_ALLOW_SIMULATED=true` build.

Regressions (QA_PORT=5413):

| Check | Result | Baseline |
|---|---|---|
| p36.mjs, LINKS_TO=1 | PASS 336 / FAIL 0, console/page errors 0 | v072: 216/0 |
| linkinput.mjs | PASS 1448 / FAIL 0 / NOTE 0, errors 0 | – |
| runqa.sh `p36dfields`: outside | 172 loads, console errors 0 | – |
| runqa.sh: route sweep | 82 loads, 2 known HSCROLL issues (prop-new-pkg / prop-edit wizard steps) | identical to v072 |
| runqa.sh: mock flows | PASS 16 / FAIL 0 | v072: 16/0 |
| runqa.sh: records-assign | PASS 111 / FAIL 0 | v072: 111/0 |
| runqa.sh: 28 lists | 112/112 PASS | v072: 112/112 |
| Field probe, all 16 combos (light/dark × en/ar × 1440/390 × MOCK/SIM) | 0 console/page errors | – |

The field probe covers 11 MOCK editors and 10 SIM editors, all rendered with the expected attributes. Shots are in
`p36d/fields/after-all/`, with BEFORE shots in `p36d/fields/before/`.

SD/SM screenshot diff (`p28-qa-shots/p35-out-p36dfields`):
- vs v073f: identical 171, different 1. The difference is `sd-playbook-1__dark-ar-390`, 2 px at the clock area
  (125,9), which is noise.
- `legacy-lead-2` is identical in all four shots, so the legacy route is unchanged.
- vs base1: identical 158, different 14, all within the known base1-vs-base2 noise (155 identical / 17 different).
- Out: `p36d/fields/r-diff-*.txt`.

## 9. Only a real site can confirm

- The real server messages and dialogs on saving an invalid Email / Phone or a negative Currency (the SIM does not
  validate these).
- `get_link_title` timing and permissions on a site where `boot.link_title_doctypes` is known.
- The Serve Fast CRM Type search with `link_filters`.
- The mobile keyboards (`inputmode`).
- How the real DocTypes are finalised (the metas are DRAFT): field lengths, options labels, and whether `lead_source`
  and `priority` keep these options.

## 10. CHANGELOG lines (for the integrator)

- FrappeField: Data options Email / Phone / Name / URL validate with Frappe's own patterns (`split_emails` for
  addresses). The input is always `type="text" autocomplete="off"`. New `splitEmails` export.
- FrappeField / FrappeLinkField: Desk's maxlength on Link and Dynamic Link, and the "Data Clipped" paste message.
  Numeric inputs select on focus. Placeholders are translated and reach Link and Text inputs.
- FrappeLinkField: titles of `show_title_field_in_link` targets are fetched with `frappe.desk.search.get_link_title`
  (new optional `FormServices.getLinkTitle`); new SIMULATED handler.
- LinkInput: typed `maxLength` / `onPaste` props.
