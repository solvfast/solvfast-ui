# P35 — consolidated Form View / List View coverage (`@solvfast/ui` 0.7.0-dev.1)

Baseline: `@solvfast/ui` 0.6.0 (`0ef45c1`), audited in `A-form.md` and `B-list.md` (this folder). Now: `0.7.0-dev.1` =
0.6.0 + the five merged P35 package workstreams (WS1 form, WS2 record, WS3 list, WS4 views, WS5 core; merged at `e6e4dd2`)
+ the integration step (`feat/0.7.x/p35-coverage` at `410169d`, merged into `feat/0.7.x/p35-docs`). Integration made the
record features defaults: `FrappeForm` mounts the ⋯ menu (`FrappeRecordMenu`) and a Connections tab, `FrappeListView`
`create` opens `FrappeQuickEntry` (or the host's full form), `FrappeViews` carries the List view's filters and sort,
`FrappeProvider` applies `boot.userDefaults`; it also gave the simulator handlers the permission engine and row filter
(`FixtureContext`). WS6 (CRM adoption) changed the CRM, not the package — see `CRM-MIGRATION.md`.

**Nothing in this file was exercised against an authenticated real Frappe site.** "COMPLETE" means "a cited test exercises
the behaviour"; it never means "verified on a site". The only real-Frappe evidence in the package is recorded 15.110
responses replayed in `tests/real/sada-real.test.tsx` (read paths) and the real 15.110 metas used as test input.

> **P36 update (0.7.0-dev.2).** The denominator (301), the row ids, the status rule and every status are unchanged; P36
> changed only the Test evidence, Location and Known limitations cells of 18 rows — listed with the reason in §8. The
> **real-site classification** of every row (categories (a)–(e), the catalogue test that would validate it, and the
> real-site result, today BLOCKED: not run) is a separate document: `docs/audit/p36/VALIDATION-MATRIX.md`, generated from
> this file's Requirement / Now / Evidence-level columns (`node e2e/frappe-site/matrix/render.mjs --check`). Still no row
> has `real-site` evidence.

> **P36b update (0.7.0-dev.3).** Denominator (301), row ids, the status rule, every status and every evidence level are
> unchanged (**258 / 301**). Batch 2 edited only the Location, Test evidence, Showcase and Known limitations cells of 6
> rows (LV.F8, LV.F9, LV.F12, LV.F14, LV.F18, LV.H1) — §9. The batch-2 features that have no row in the fixed list (Form
> Sidebar, Share / Like / Comments, Global Search, LinkInput picker mode) are recorded **outside the denominator** in §10.
> All batch-2 evidence is jsdom / simulator; no site was contacted.

## 1. The rule (one rule, both matrices)

1. **COMPLETE** — a cited test exercises the row's behaviour through the public API a consumer uses (an exported
   component, hook or helper). The test may run on the in-package simulator (`createFixtureTransport`); the evidence
   column then says `simulator`. A row is COMPLETE when the exported component that provides it is tested, even if
   `FrappeForm` / `FrappeListView` do not mount that component by default; such rows say so in "Known limitations".
2. **PARTIAL** — implemented, but either part of the row's behaviour has no test, or a sub-requirement of the row is not
   implemented although a test exists (e.g. Datetime: dispatch tested, time-zone conversion missing).
3. **Server writes / aggregates the simulator only approximates** may be COMPLETE (simulator). Every such row is listed in
   §5 "Needs real-site validation". This is the precedent the baseline already set (B-list F3 Assign To, F10 Delete,
   F11 workflow bulk approval: COMPLETE on the simulator).
4. **BLOCKED-REQUIRES-REAL-FRAPPE** stays only where the row itself is defined as real-site behaviour: FV.I9, FV.L7,
   LV.A6b, LV.C14, LV.F19 (all BLOCKED in the baseline; none changed).
5. **NOT APPLICABLE** rows stay N/A even when something was built for them (FV.K11 Customize: built as a Desk-URL
   hand-off, not counted). **The denominator is fixed**: Form 181 + List 120 = **301** applicable rows (README.md).

Evidence levels: `unit` = jsdom / pure function / stub transport (`createMockFrappe`, `vi.fn` API); `simulator` = the
in-package SIMULATED backend; `recorded-real` = recorded real Frappe 15.110 responses; `real-site` = a real running
site (**no row has this**). "(+real meta)" = a real 15.110 DocType meta as input to a simulator test.

## 2. Totals (same denominator as the baseline)

| | Applicable rows | COMPLETE baseline (0.6.0) | COMPLETE now (0.7.0-dev.1) | Coverage baseline | Coverage now |
|---|---:|---:|---:|---:|---:|
| Form View (A–P) | 181 | 79 | **155** | 43.6 % | **85.6 %** |
| List View (A–J) | 120 | 69 | **103** | 57.5 % | **85.8 %** |
| **Total** | **301** | **148** | **258** | **49.2 %** | **85.7 %** |

Status counts (C / P / M / N/A / B):

| Section | Rows | Baseline C / P / M / N/A / B | Now C / P / M / N/A / B | Moved |
|---|---|---|---|---|
| FV A. Field rendering | 45 | 13 / 26 / 6 / 0 / 0 | 31 / 14 / 0 / 0 / 0 | 22 |
| FV B. Layout | 8 | 5 / 3 / 0 / 0 / 0 | 6 / 2 / 0 / 0 / 0 | 1 |
| FV C. Conditional logic | 7 | 6 / 1 / 0 / 0 / 0 | 6 / 1 / 0 / 0 / 0 | 0 |
| FV D. Permissions | 11 | 8 / 3 / 0 / 0 / 0 | 9 / 2 / 0 / 0 / 0 | 1 |
| FV E. Defaults / fetch | 7 | 5 / 2 / 0 / 0 / 0 | 7 / 0 / 0 / 0 / 0 | 2 |
| FV F. Link controls | 10 | 5 / 5 / 0 / 0 / 0 | 10 / 0 / 0 / 0 / 0 | 5 |
| FV G. Child tables | 14 | 8 / 5 / 1 / 0 / 0 | 12 / 1 / 1 / 0 / 0 | 4 |
| FV H. Lifecycle | 14 | 10 / 4 / 0 / 0 / 0 | 14 / 0 / 0 / 0 / 0 | 4 |
| FV I. Workflow | 9 | 7 / 0 / 0 / 1 / 1 | 7 / 0 / 0 / 1 / 1 | 0 |
| FV J. Status / header | 11 | 7 / 3 / 1 / 0 / 0 | 10 / 1 / 0 / 0 / 0 | 3 |
| FV K. Menus / actions | 16 | 0 / 5 / 10 / 1 / 0 | 15 / 0 / 0 / 1 / 0 | 15 |
| FV L. Print / PDF | 7 | 0 / 4 / 1 / 1 / 1 | 4 / 1 / 0 / 1 / 1 | 4 |
| FV M. Connections | 6 | 0 / 0 / 6 / 0 / 0 | 6 / 0 / 0 / 0 / 0 | 6 |
| FV N. Submission | 6 | 5 / 1 / 0 / 0 / 0 | 6 / 0 / 0 / 0 / 0 | 1 |
| FV O. Email composer | 9 | 0 / 0 / 9 / 0 / 0 | 8 / 0 / 1 / 0 / 0 | 8 |
| FV P. Website link | 4 | 0 / 0 / 4 / 0 / 0 | 4 / 0 / 0 / 0 / 0 | 4 |
| **FV total** | **184** | **79 / 62 / 38 / 3 / 2** | **155 / 22 / 2 / 3 / 2** | **80** |

| Section | Rows | Baseline C / P / M / N/A / B | Now C / P / M / N/A / B | Moved |
|---|---|---|---|---|
| LV A. Columns | 12 | 9 / 1 / 0 / 1 / 1 | 10 / 0 / 0 / 1 / 1 | 1 |
| LV B. Filters | 15 | 11 / 1 / 3 / 0 / 0 | 13 / 1 / 1 / 0 / 0 | 2 |
| LV C. Sorting & saved filters | 14 | 9 / 1 / 1 / 2 / 1 | 11 / 0 / 0 / 2 / 1 | 2 |
| LV D. Grouping & sidebar | 12 | 6 / 3 / 3 / 0 / 0 | 11 / 1 / 0 / 0 / 0 | 6 |
| LV E. Row status / metadata | 12 | 8 / 2 / 2 / 0 / 0 | 10 / 1 / 1 / 0 / 0 | 2 |
| LV F. Bulk actions | 19 | 15 / 3 / 0 / 0 / 1 | 18 / 0 / 0 / 0 / 1 | 3 |
| LV G. Create & Quick Entry | 9 | 0 / 4 / 5 / 0 / 0 | 9 / 0 / 0 / 0 / 0 | 9 |
| LV H. View switcher | 10 | 0 / 0 / 10 / 0 / 0 | 3 / 2 / 5 / 0 / 0 | 5 |
| LV I. Count & pagination | 9 | 7 / 1 / 1 / 0 / 0 | 8 / 1 / 0 / 0 / 0 | 1 |
| LV J. List menu (⋯) | 11 | 4 / 1 / 6 / 0 / 0 | 10 / 0 / 1 / 0 / 0 | 6 |
| **LV total** | **123** | **69 / 17 / 31 / 3 / 3** | **103 / 6 / 8 / 3 / 3** | **37** |

Of the 258 COMPLETE rows, **177** rest on the simulator for at least part of their evidence and **62** are
listed in §5 because their essential behaviour is a server write or aggregate. Evidence level `real-site`: **0 rows**.

Tests on the merged tree (this worktree after merging `410169d`, `npx vitest run`): **72 files, 1415 passed, 10 todo,
0 failed** (at `e6e4dd2`, before integration: 68 files, 1387 passed). Integration gates (`ws/integration.md` §4, run at
`826013d`; `410169d` changes only `e2e/consumers/run.sh`): typecheck exit 0; `npm run build` exit 0 (775 files, 888.7 kB
packed, styles regenerated identical); `check:boundaries` OK incl. dist rules; `check:package` OK (13 exports, 507 built
files); `showcase:build` OK; `e2e/showcase-smoke.mjs` PASS (73 sections × 4 combinations, 0 page / console errors);
`e2e/consumers/run.sh` both consumers tsc + build OK, one React copy. None of these is a real-site check.

## 3. Reclassifications against the workstream proposals

| Row | Workstream proposal | Here | Why |
|---|---|---|---|
| LV.D6, LV.D7 | WS3 and the integration report: BLOCKED-REQUIRES-REAL-FRAPPE | COMPLETE (simulator), §5 | Implemented and tested on simulator handlers for `get_group_by_count` / `get_sidebar_stats`. Same evidence class as the baseline's COMPLETE F3 / F10 / F11 (simulated server writes); rule 3. WS3 itself offered this ("COMPLETE if the integrator counts sim like F3"). |
| LV.J7 | WS3: BLOCKED | COMPLETE (simulator), §5 | `save_listview_settings` write tested on the simulator; rule 3. |
| LV.H2 | WS4: BLOCKED | COMPLETE (simulator), §5 | All four view levels implemented and sim-tested (board API, `update_order_for_single_card`, `set_value` group mode); rule 3. Board creation / column editing are listed as limitations. |
| LV.H1, LV.H3 | WS4: PARTIAL | PARTIAL | Kept — because of missing features (no `save_report` / aggregates / multi-sort; month view only), not because a sub-path is blocked. |
| FV.L3 | WS2: "COMPLETE (shape only)" | PARTIAL | `download_pdf` is not simulated: only the URL shape and the simulator's refusal are tested. A URL shape is not the behaviour. |
| FV.K14 | WS2: PARTIAL (menu only) | COMPLETE | WS1's docStore history + Ctrl/⌘+Z / Ctrl/⌘+Shift+Z are tested (`FV.K14 …`); WS2's entries call it. |
| FV.K6 | WS2: PARTIAL | COMPLETE | Integration opens the copy in `FrappeForm` (`FV.K6 Duplicate opens the copy in the form…; saving it inserts a new Deal`). |
| FV.K11 | WS2: "integrator decides" | N/A (extra) | Rule 5: the denominator is fixed. Built anyway (Customize → Desk URL, System Manager only). LV.J6 (List Customize) is a separate, counted row. |
| FV.K12 | WS2: COMPLETE via Connections | COMPLETE | "Links" opens the Connections tab (A-form already recommended "subsumed by Connections"). No `linked_with` dialog — stated as a limitation. |
| FV.K3, FV.M1 | WS2: COMPLETE (component) | COMPLETE | Mounted by `FrappeForm` by default after integration and tested there (`tests/frappe-form-integration.test.tsx`). |
| LV.G3–G7, LV.G9 | WS3: "Quick Entry is WS1" (MISSING / PARTIAL) | COMPLETE | WS1's `FrappeQuickEntry` is in the merged tree with 9 tests (`FV.F6 …`, `tests/frappe-quick-entry.test.tsx`). |
| LV.G8 | WS3: PARTIAL | COMPLETE | Both halves are tested through public API: `FrappeQuickEntry` hands back the saved doc (`FV.F6 … hands back the server doc and closes`) and `create.render(p).onCreated` reloads the list (`LV.G1 … onCreated reloads the list and closes`). Integration made it the default and tested the junction (`LV.G1 LV.G8 FV.F6 create={{}} … saving inserts the Note and reloads the list`). |
| FV.E2 | WS1: "COMPLETE with caveat" | COMPLETE | Automatic since integration (`FrappeProvider userDefaults`, `FV.E2 FV.D8 boot user defaults pre-fill …`). |
| FV.A29–A31, FV.A35 | WS1: MISSING → PARTIAL | PARTIAL | Reported and rendered read-only (tested); no real control. |
| FV.A16–A18, A32, A33, A5, A10, A41 | WS1: stay PARTIAL | PARTIAL | Dispatch now tested; the missing sub-features (preview, TZ, currency symbol, placeholders) keep them PARTIAL. |

No row went down. 117 rows moved: 58 PARTIAL → COMPLETE, 52 MISSING → COMPLETE, 7 MISSING → PARTIAL.

## 4. Matrices

Test-file abbreviations. Form (baseline, from A-form.md): `ff` tests/frappe-form.test.tsx · `ffm` tests/frappe-form-model.test.tsx ·
`rff` tests/record-form-fixes.test.tsx · `att` tests/attach.test.tsx · `dd` tests/date-display.test.tsx · `fld` tests/fields.test.tsx ·
`fh` tests/foundation-hooks.test.tsx · `fi` tests/frappe-indicator.test.ts · `rec` tests/record.test.tsx · `rfu` tests/record-frappe-ui.test.tsx ·
`simp` tests/sim-permissions.test.tsx · `p27` tests/parity/permissions-p27.test.tsx · `prr1` / `prr2` tests/parity/review-r1 / review-r2.test.ts ·
`pds` tests/parity/display-status.test.ts · `pmd` tests/parity/mandatory.test.ts · `pdep` tests/parity/dependencies.test.ts ·
`pfmt` tests/parity/format.test.ts · `prec` tests/parity/record.test.ts · `sr` tests/real/sada-real.test.tsx.
Form (P35): `ffp` tests/frappe-form-p35.test.tsx · `fft` tests/frappe-fieldtypes.test.tsx · `fqe` tests/frappe-quick-entry.test.tsx ·
`fra` tests/frappe-record-actions.test.tsx · `ra` tests/record-actions.test.tsx.
List (baseline, from B-list.md): `L` list · `LQ` list-query · `LA` list-actions · `LSH` list-selection-header · `FLH` frappe-list-header ·
`FL` frappe-list · `F` frappe · `LIO` list-io · `RK` rowkey · `LK` like · `PL` parity/list · `SP` sim-permissions · `P27` parity/permissions-p27 ·
`SR` real/sada-real · `FI` frappe-indicator (all `tests/<name>.test.ts(x)`).
List (P35): `flp` tests/frappe-list-p35.test.tsx · `lp` tests/list-p35.test.tsx · `vsw` tests/views-switcher.test.tsx · `fvh` / `fvr` /
`fvk` / `fvc` / `fvi` tests/frappe-views-{host,report,kanban,calendar,image}.test.tsx. Form-row tests (`ffp`, `fqe`) are also cited for List G.
P36: `lsd` tests/list-selection-desk.test.tsx (FrappeListView with no `selectionMode` prop); the 26 `LV.H1` tests are in `fvr`.

Source abbreviations: `FF` src/frappe/form/FrappeField.tsx · `FFV` src/frappe/form/FrappeFormView.tsx · `FForm` src/frappe/form/FrappeForm.tsx ·
`FLF` src/frappe/form/FrappeLinkField.tsx · `FCT` src/frappe/form/FrappeChildTable.tsx · `m/` src/frappe/form/model/. List paths are relative to
`src/frappe/` (Frappe) or `src/list/` (Core) unless stated; record components live in `src/record/` (Core) and `src/frappe/record/` (Frappe);
views in `src/list/views/` (Core) and `src/frappe/views/` (Frappe).

Showcase: hash routes in `showcase/src/routes.ts`. New P35 pages: `#frappe-form-p35`, `#frappe-record-actions`, `#p35-list`,
`#frappe-views` (all labelled SIMULATED) and the Core pages `core-fields`, `file-dropzone`, `combobox-p35`, `empty-trend`, `record-p35`,
`editor-stepper-p35`, `record-extras`. A bold "Now" cell marks a row that moved.

## 4a. Form View (A–P)

### FV.A. Field rendering

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.A1 | Data | COMPLETE | COMPLETE | both | `FF` DebouncedText, soft Email/Phone/URL | ff "dispatches fieldtypes…"; ff "mandatory_depends_on is evaluated at save"; fft "FV.A19 … A1 Data honours the placeholder (A41)" | `#frappe-forms` | simulator (+real meta) | Name/IBAN options not validated |
| FV.A2 | Link | COMPLETE | COMPLETE | Frappe (+Core LinkInput) | `FLF` | ff "searches search_link 500 ms…"; sr "search_link", "validate_link" | `#frappe-forms` todo, `#frappe-form-p35` | simulator; recorded-real (API shape) | see §F |
| FV.A3 | Select | PARTIAL | **COMPLETE** | both | `FF` Select branch | fft "FV.A3 Select: newline options, blank first option, translated labels, an unknown stored value is kept" | `#frappe-forms` travel | unit | — |
| FV.A4 | Date | COMPLETE | COMPLETE | both | `FF` DateField (site `date_format`) | dd (6); fft "FV.A6 … A4 Date a date trigger" | `#frappe-forms` travel | unit | no TZ conversion needed |
| FV.A5 | Datetime | PARTIAL | PARTIAL | both | `FF` DateTimeField | fft "FV.A6 … A5 Datetime a date-time picker trigger" (dispatch only) | — | unit | edited in browser TZ; system↔user TZ conversion while editing not done; seconds forced to `:00` |
| FV.A6 | Time | PARTIAL | **COMPLETE** | both | `FF` → `TimeInput` | fft "FV.A6 Time is a time box (12 h when the site's time_format has 'a')…" | `core-fields` | unit | — |
| FV.A7 | Check | COMPLETE | COMPLETE | both | `FF` | ff "Note: depends_on hides and shows fields"; fft "FV.A28 … A7 Check writes 0/1" | `#frappe-forms` travel | simulator (+real meta) | — |
| FV.A8 | Int / Long Int | COMPLETE | COMPLETE | both | `FF` → NumberInput int | ff "dispatches fieldtypes"; fft "FV.A8 / A9 / A10 / A11 numbers…" | `core-fields` | unit | — |
| FV.A9 | Float | PARTIAL | **COMPLETE** | both | `FF` (df.precision → float_precision) | fft "FV.A8 / A9 / A10 / A11 numbers: … Float rounds to df.precision…" | `core-fields` | unit | — |
| FV.A10 | Currency | PARTIAL | PARTIAL | both | `FF` (precision → currency_precision) | fft "FV.A8 / A9 / A10 / A11 numbers…" (number box); pfmt Currency rows | `#frappe-forms` travel | unit | currency symbol from `df.options` (currency field) not resolved while editing |
| FV.A11 | Percent | PARTIAL | **COMPLETE** | both | `FF` kind percent | fft "FV.A8 / A9 / A10 / A11 numbers…" | — | unit | — |
| FV.A12 | Text | PARTIAL | **COMPLETE** | both | `FF` textarea, 500 ms debounce | fft "FV.A12-A14 Small Text / Text / Long Text are textareas…", "FV.A12 a textarea writes 500 ms after typing stops (and on blur)" | — | unit | — |
| FV.A13 | Small Text | PARTIAL | **COMPLETE** | both | `FF` textarea | fft "FV.A12-A14 …" | `#frappe-forms` travel | unit | — |
| FV.A14 | Long Text | PARTIAL | **COMPLETE** | both | `FF` textarea | fft "FV.A12-A14 …" | — | unit | — |
| FV.A15 | Text Editor | COMPLETE | COMPLETE | both | `FF` RichTextEditor / RichText | ff "loads a ToDo, edits a field…", R1-F4 | `#frappe-forms` todo | simulator (+real meta) | no mentions / image upload |
| FV.A16 | Markdown Editor | PARTIAL | PARTIAL | both | `FF` monospace textarea | fft "FV.A12-A14 …; A16-A18, A32 … monospace, LTR" (dispatch) | — | unit | no preview, no markdown rendering |
| FV.A17 | HTML Editor | PARTIAL | PARTIAL | both | `FF` monospace textarea | fft (same) | — | unit | no preview, no syntax highlighting |
| FV.A18 | Code | PARTIAL | PARTIAL | both | `FF` monospace textarea `dir=ltr` | fft (same) | — | unit | no syntax editor |
| FV.A19 | Password | PARTIAL | **COMPLETE** | both | `FF` `type=password`; skipped on copy | fft "FV.A19 Password renders type=password…"; ff "copy_doc / amend_doc" | — | unit | — |
| FV.A20 | Attach | COMPLETE | COMPLETE | Frappe | `FrappeAttachField.tsx` | att (6) | — | simulator | no library/link/camera source; Clear does not delete the File; `max_attachments` not enforced client-side |
| FV.A21 | Attach Image | COMPLETE | COMPLETE | Frappe | `FrappeAttachField.tsx` (`accept="image/*"`) | att (Attach Image variants) | `#frappe-forms` contact | simulator | as A20 |
| FV.A22 | Read Only | COMPLETE | COMPLETE | both | `m/status.ts`, `FF` read display | ff "searches search_link … pick validates and fetches"; fft "FV.A22 Read Only shows the formatted value, never an input" | `#frappe-forms` todo | simulator (+real meta), unit | — |
| FV.A23 | Table | COMPLETE | COMPLETE | Frappe | `FF` → `FCT` | ff "Contact: Add Row…"; sr "FrappeForm renders the real Sada Lifecycle … child-table rows" | `#frappe-forms` contact | simulator (+real meta); recorded-real (render) | see §G |
| FV.A24 | Table MultiSelect | COMPLETE | COMPLETE | Frappe | `FrappeTableMultiSelect.tsx` | ff "adds rows for picked values…" | `#frappe-forms` travel | simulator | standalone test only; `<table>_add` not fired (Desk parity) |
| FV.A25 | Dynamic Link | COMPLETE | COMPLETE | Frappe | `FLF` | ff "standalone Dynamic Link searches…"; pfmt "Dynamic Link formats like a Link" | — | simulator, unit | in-form validation untested; Single DocTypes (R1-F12) |
| FV.A26 | Duration | COMPLETE | COMPLETE | both | `FF` → DurationInput | ff "dispatches fieldtypes"; fld DurationInput (3) | `core-fields` | unit | — |
| FV.A27 | Rating | PARTIAL | **COMPLETE** | both | `FF` (0…1 fraction × options) | fft "FV.A27 Rating stores a 0…1 fraction: 0.6 of 5 shows 3 stars; picking the 4th writes 0.8" | `core-fields` | unit | — |
| FV.A28 | Color | PARTIAL | **COMPLETE** | both | `FF` → ColorInput | fft "FV.A28 Color is a hex box…" | `core-fields` | unit | — |
| FV.A29 | Signature | MISSING | **PARTIAL** | Frappe | `FF` unsupported branch (raw value read-only), `m/fieldtypes.ts` `analyzeFieldtypes` | fft "FV.A44 Signature / Geolocation / Barcode / Icon show the raw value read-only — no text box" | — | unit | reported and read-only; no signature pad |
| FV.A30 | Geolocation | MISSING | **PARTIAL** | Frappe | same | fft "FV.A44 …" | — | unit | reported and read-only; no map (needs a map peer dependency — decision) |
| FV.A31 | Barcode | MISSING | **PARTIAL** | Frappe | same | fft "FV.A44 …" | — | unit | reported and read-only; no barcode renderer |
| FV.A32 | JSON | PARTIAL | PARTIAL | both | `FF` monospace textarea | fft "FV.A12-A14 …; A16-A18, A32 …" (dispatch) | — | unit | no JSON validation / pretty-print |
| FV.A33 | Phone (fieldtype) | PARTIAL | PARTIAL | both | `FF` `type=tel` | fft "FV.A19 … A33 Phone renders type=tel…" | — | unit | no country picker; no soft check |
| FV.A34 | Autocomplete | MISSING | **COMPLETE** | Frappe (+Core LinkInput) | `FF` Autocomplete branch, `autocompleteOptions` | fft "FV.A34 suggests df.options…", "FV.A34 a typed value outside the list is cleared…", "FV.A34 parse_options…" | — | unit | `_get_options` / `frm.set_df_property(options)` at runtime not covered |
| FV.A35 | Icon | MISSING | **PARTIAL** | Frappe | `FF` unsupported branch | fft "FV.A44 …" | — | unit | reported and read-only; no icon picker |
| FV.A36 | Button | PARTIAL | **COMPLETE** | both | `FF`; `FFV` `trigger(fieldname)` | fft "FV.A36 Button runs onButtonClick; A37 …; A38 …; A39 …" | — | unit | — |
| FV.A37 | HTML | PARTIAL | **COMPLETE** | both | `FF` sanitized `options` | fft "FV.A36 … A37 HTML is sanitized …" | — | unit | — |
| FV.A38 | Image | PARTIAL | **COMPLETE** | both | `FF` (`doc[df.options]`) | fft "FV.A36 … A38 Image reads doc[options] …" | — | unit | — |
| FV.A39 | Heading | PARTIAL | **COMPLETE** | both | `FF` | fft "FV.A36 … A39 Heading is a heading" | — | unit | — |
| FV.A40 | Fold | PARTIAL | PARTIAL | Frappe | `m/layout.ts` (treated as Section Break) | none | — | — | no "Show more" folding |
| FV.A41 | Labels / descriptions / placeholders / options | PARTIAL | PARTIAL | both | `FF` label/description/placeholder | fft "FV.A19 … A1 Data honours the placeholder (A41)"; ff "Arabic: the form chrome is translated" | `#frappe-rtl` | unit, simulator | placeholder still ignored for Link, Text and number controls |
| FV.A42 | Required indicator | PARTIAL | PARTIAL | both | `FF` required → FieldShell | fld "marks required empty cells" (Core grid only) | — | unit | no FrappeField-level assertion |
| FV.A43 | Validation & error messages (server errors on fields) | PARTIAL | **COMPLETE** | Frappe | `m/errors.ts` `fieldErrorsFromFrappeError`; `FFV` field `error` | ffp "FV.A43 LinkValidationError (strict SIMULATED save)…", "FV.A43 MandatoryError (response shaped as document.py:963 + base_document.py:758)…", "FV.A43 fieldErrorsFromFrappeError…"; ff "missing mandatory field opens Missing Fields" | `#frappe-forms` save-error | simulator (MandatoryError body shaped in the test), unit | other exception types map to no field |
| FV.A44 | Unsupported types handling | MISSING | **COMPLETE** | Frappe | `m/fieldtypes.ts` `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`; `FF` read-only fallback; `FFV` issues banner | fft "FV.A44 Signature / Geolocation / Barcode / Icon show the raw value read-only", "FV.A44 the form's banner lists them…" | — | unit | — |
| FV.A45 | Metadata mapping documented | PARTIAL | **COMPLETE** | docs | `docs/components/forms.md` §3 (regenerated) | fft "FV.A45 SUPPORTED_FIELDTYPES covers every type FrappeField dispatches" | — | unit | — |

### FV.B. Layout

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.B1 | Tabs (Details tab, bar hidden with one tab) | COMPLETE | COMPLETE | Frappe | `m/layout.ts`, `FFV` | ff "Event: a Details tab first…"; ffm "inserts a Details tab…" | `#frappe-forms` contact | simulator (+real meta), unit | tab not remembered across loads |
| FV.B2 | Sections | COMPLETE | COMPLETE | Frappe | `m/layout.ts`, `FFV` | ffm "…anonymous sections; columns" | `#frappe-forms` | unit | — |
| FV.B3 | Columns | COMPLETE | COMPLETE | Frappe | `m/layout.ts`, `FFV` | ff "p275: a section's columns stack on a phone…" | `#frappe-forms` contact | simulator (+real meta) | equal widths only |
| FV.B4 | Collapsible sections | PARTIAL | PARTIAL | Frappe | `m/depends.ts`, `FFV` toggle | ffp "FV.B4 a collapsible section starts closed, toggles with aria-expanded…", "FV.B4 a required field forces its section open only while it is null…" | `#frappe-form-p35` | simulator | `collapsible_depends_on` re-evaluated only at load / save, not on every change |
| FV.B5 | Section / Column / Tab breaks | COMPLETE | COMPLETE | Frappe | `m/layout.ts` | ffm layout; prr1 F-01 | — | unit | Page Break = Section Break |
| FV.B6 | Metadata order | COMPLETE | COMPLETE | Frappe | `m/layout.ts` (+ `fieldFilter`) | ffm "inserts a Details tab…"; ffp "FV.B6 fieldFilter: only accepted fields (and breaks) are laid out…" | — | unit, simulator | — |
| FV.B7 | Responsive | PARTIAL | PARTIAL | Core+Frappe | `FFV` grid classes | ff p275 (class assertions) | `#frappe-forms` | unit | no real-viewport e2e for the form |
| FV.B8 | Empty / hidden sections and tabs | PARTIAL | **COMPLETE** | Frappe | `FFV` hidden-section logic | ffp "FV.B4 … B8 a section whose fields are all hidden is not rendered"; ffp "FV.D11 …" | — | simulator | — |

### FV.C. Conditional logic

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.C1 | depends_on | COMPLETE | COMPLETE | Frappe | `m/depends.ts` | ff "Note: depends_on hides and shows fields"; pdep (31); prr1 (270 real expressions) | `#frappe-forms` travel | simulator (+real meta), unit | 18 core expressions unsupported by decision (D-23) |
| FV.C2 | hidden | COMPLETE | COMPLETE | Frappe | `m/status.ts` | ff "dispatches fieldtypes"; pds 2-3 | — | unit | — |
| FV.C3 | mandatory_depends_on | COMPLETE | COMPLETE | Frappe | `m/depends.ts`, `m/mandatory.ts` | ff "mandatory_depends_on is evaluated at save…"; pmd | — | simulator, unit | client-only (as Desk) |
| FV.C4 | read_only_depends_on | COMPLETE | COMPLETE | Frappe | `m/depends.ts` | ffm "…read_only_depends_on sets read_only"; pdep "FV.C4 read_only_depends_on writes df.read_only = 1/0…" (former it.todo) | — | unit | — |
| FV.C5 | State-dependent mandatory | PARTIAL | PARTIAL | Frappe | `m/mandatory.ts` (docstatus 2 skip) | pmd "docstatus 2 skips the check" | — | unit | no test of an expression on `doc.workflow_state` |
| FV.C6 | Recalculation after every change | COMPLETE | COMPLETE | Frappe | `FFV` `resolveFields` per snapshot | ff Note depends_on test | — | simulator | collapsible state not recalculated (B4) |
| FV.C7 | Unsupported expressions reported | COMPLETE | COMPLETE | Frappe | `m/depends.ts`, `FFV` banner | ff "…an unknown global is reported, not guessed (D-23)"; rff R1-F6 | `#frappe-forms` | simulator, unit | an unsupported `depends_on` evaluates false (field hidden, reported) |

### FV.D. Permissions

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.D1 | permlevel | COMPLETE | COMPLETE | Frappe | `m/status.ts`, `FFV`, `FCT` | simp "…the permlevel-1 field absent"; rff "…no Cost column" | `#frappe-permissions` | simulator | — |
| FV.D2 | Role permissions (DocPerm × roles) | COMPLETE | COMPLETE | Frappe | `services/permissions.ts`, `usePermissions` | fh "roles × real ToDo DocPerm rows…"; parity/permissions-matrix | `#frappe-permissions` | simulator, unit | — |
| FV.D3 | read / write | COMPLETE | COMPLETE | Frappe | `FFV`, `m/actions.ts` | simp read-only role; p27 "permission revoked after loading…" | `#frappe-permissions` | simulator | — |
| FV.D4 | create | PARTIAL | PARTIAL | Frappe | `m/actions.ts` (new doc: create OR write) | prr1 "new document: Save"; p27 "no Save on a new one"; fqe "FV.F6 negative: without the create right Save is disabled (rule 9)" | — | unit, simulator | create-only / write-without-create roles on a new doc still untested |
| FV.D5 | submit | COMPLETE | COMPLETE | Frappe | `m/actions.ts` | prr1 "no submit right…"; simp "submit needs submit…"; ff Submit flow | — | simulator, unit | — |
| FV.D6 | cancel | COMPLETE | COMPLETE | Frappe | `m/actions.ts`, `FFV` | p27 "no Cancel on a submitted doc…"; simp server cancel check | — | simulator, unit | — |
| FV.D7 | amend | COMPLETE | COMPLETE | Frappe | `m/actions.ts`, `FFV` | p27 "…no Amend on a cancelled one"; ffp "FV.H6 no Amend without the create right…" | — | simulator, unit | — |
| FV.D8 | User Permissions | PARTIAL | PARTIAL | Frappe (server-side in sim) | `services/boot.ts` `userDefaultsFromBoot` (is_default); `FrappeProvider userDefaults` | simp "User Permissions … lists only rows…"; ffp "FV.E2 userDefaultsFromBoot: … the is_default User Permission wins…"; fint "FV.E2 FV.D8 boot user defaults pre-fill a new document's Link without newDocDefaults; userDefaults={false} opts out" | `#frappe-permissions` | simulator, unit | `is_default` now applied automatically through `FrappeProvider`; search_link User Permission filtering is server-side and unverified |
| FV.D9 | Server authoritative | COMPLETE | COMPLETE | Frappe | `FFV` error path | p27 "direct invocation of hidden actions: the server refuses…" | — | simulator | — |
| FV.D10 | Workflow read-only (allow_edit) | COMPLETE | COMPLETE | Frappe | `usePermissions` → `m/status.ts` | fh "workflow state without an allow_edit role…"; p27 | `#frappe-workflow` | simulator | — |
| FV.D11 | Tab hidden by permlevel | PARTIAL | **COMPLETE** | Frappe | `FFV` tab visibility | ffp "FV.D11 a tab whose fields are all permlevel 1 is hidden for a user who cannot read level 1" | — | simulator | — |

### FV.E. Defaults / fetch

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.E1 | `df.default` keywords, casts, mandatory Table row | COMPLETE | COMPLETE | Frappe | `m/defaults.ts` | ffm "applies df.default keywords…"; ff "a new ToDo gets Desk's defaults" | `#frappe-forms` new-todo | simulator (+real meta), unit | browser clock; `:DocType` defaults reported, left empty |
| FV.E2 | Session / user defaults | PARTIAL | **COMPLETE** | Frappe | `services/boot.ts` `userDefaultsFromBoot`; `FrappeProvider userDefaults` (default `boot.userDefaults`, `false` opts out); `FForm` `newDocDefaults.userDefaults` | ffp "FV.E2 userDefaultsFromBoot…", "FV.E2 FrappeForm newDocDefaults.userDefaults pre-fill a Link…"; fint "FV.E2 FV.D8 boot user defaults pre-fill a new document's Link without newDocDefaults; userDefaults={false} opts out" | — | unit, simulator | `remember_last_selected_value` not reproduced; the app's own `newDocDefaults.userDefaults` wins |
| FV.E3 | fetch_from (+ fetch_if_empty) | COMPLETE | COMPLETE | Frappe | `m/fetch.ts`, `FFV` | ff "…a pick validates and fetches"; ffm fetch map; pds fetch_from lock | `#frappe-forms` todo | simulator (+real meta) | server re-fetches on save |
| FV.E4 | Dependent link values (link_filters `eval:`) | COMPLETE | COMPLETE | Frappe | `FLF` | ff "link_filters (client-only) and setQuery merge…" | — | unit | dependent Links not auto-cleared (Desk neither) |
| FV.E5 | Auto values on a new doc | COMPLETE | COMPLETE | Frappe | `FFV`, `m/layout.ts` | rff "fetches the target of a defaulted Link…"; ffm `__newname` | `#frappe-forms` new-todo | simulator | naming-series preview not shown |
| FV.E6 | Dirty state after auto changes | PARTIAL | **COMPLETE** | Frappe | `m/docStore.ts` | ffp "FV.E6 a Link change on a saved doc writes the fetch_from target and marks the doc Not Saved…" | — | simulator | — |
| FV.E7 | Changing / clearing the linked doc | COMPLETE | COMPLETE | Frappe | `m/fetch.ts` | prr1 "C-02 …"; ff "a hand-typed value … cleared on blur" | — | simulator, unit | — |

### FV.F. Link controls

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.F1 | Autocomplete + server search | COMPLETE | COMPLETE | Frappe (+Core) | `FLF`, `src/fields/autocomplete.tsx` | ff "searches search_link 500 ms…"; fld; sr "search_link → value/description results" | `#frappe-forms` todo | simulator; recorded-real (API) | — |
| FV.F2 | Filters (link_filters, df.filters) | COMPLETE | COMPLETE | Frappe | `FLF` | ff "link_filters (client-only)…" | — | unit | link_filters client-only (as 15.110) |
| FV.F3 | set_query equivalent | COMPLETE | COMPLETE | Frappe | `events.ts`, `FFV` `frm.setQuery` | ff R1-F13 (2) | — | simulator, unit | — |
| FV.F4 | Validation (validate_link) | COMPLETE | COMPLETE | Frappe | `FLF` | ff pick validates; R1-F11; sr "validate_link → canonical name…" | `#frappe-forms` todo | simulator; recorded-real (API) | — |
| FV.F5 | Clear / reselect | PARTIAL | **COMPLETE** | both | `FLF` clear → targets "" | ffp "FV.E6 … F5 clearing empties the target" | — | simulator | — |
| FV.F6 | Create new linked doc | PARTIAL | **COMPLETE** | Frappe | `FLF`, `services.tsx` (create right), `FrappeQuickEntry`, `useQuickEntryHost` | ffp "FV.F6 'Create a new Contact' is offered with create + onCreateNew; not without the create right…"; fqe "FV.F6 FrappeForm: typing in a Link to a quick-entry DocType offers Create; saving it sets the Link" | `#frappe-form-p35` | simulator (+real metas) | **behaviour change**: offered only with the target's create right |
| FV.F7 | Dynamic Link | COMPLETE | COMPLETE | Frappe | `FLF` | ff "standalone Dynamic Link…" | — | simulator | in-form validation untested |
| FV.F8 | Permission-aware results / open link | PARTIAL | **COMPLETE** | Frappe | `services.tsx` `defaultLinkHref` | ffp "FV.F8 the open-record link shows for a role with read on the target, not for one without (rule 9: no roles → none)" | — | simulator | search results filtered server-side only; **behaviour change**: open link hidden without target read |
| FV.F9 | Loading / empty / error states | PARTIAL | **COMPLETE** | Core | `src/fields/autocomplete.tsx` | ffp "FV.F9 search states: 'Searching…' …, 'Search failed' …, 'No results' …" | — | simulator | — |
| FV.F10 | Link titles (show_title_field_in_link) | PARTIAL | **COMPLETE** | Frappe | `client.ts` `getDoc` → `linkTitles`; `FFV` seeds `linkTitles.ts` | ffp "FV.F10 a saved form shows the title of its Link value without searching", "FV.F10 negative…", "FV.F10 the client keeps them…" | — | simulator (getdoc `_link_titles` shaped in the test per load.py) | read from getdoc only (not savedocs); titles of later-set values still need a search |

### FV.G. Child tables

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.G1 | Render | COMPLETE | COMPLETE | Frappe (+Core DataGrid) | `FCT` | ff Contact tests; sr Sada Lifecycle rows | `#frappe-forms` contact | simulator; recorded-real (render) | fallback with no in_list_view unverified; Table fields keep DataGrid's `32rem` minimum and scroll horizontally on a 390 px phone (accepted by the owner for now, P36) |
| FV.G2 | Add row | COMPLETE | COMPLETE | both | `FCT`, `m/docStore.ts` | ff "Contact: Add Row…"; fld insert above / below | `#frappe-forms` contact | simulator | — |
| FV.G3 | Delete rows | COMPLETE | COMPLETE | both | `FFV`, `m/docStore.ts` | ff "table events: … before_<table>_remove…"; prr1 idx | — | simulator, unit | — |
| FV.G4 | Reorder | PARTIAL | **COMPLETE** | both | DataGrid Move Up/Down; `FFV` | ffp "FV.G4 Move Down / Move Up reorder rows (idx 1..n) and fire items_move…" | — | simulator | no drag |
| FV.G5 | Row edit form (dialog) | PARTIAL | **COMPLETE** | Frappe | `FCT` row form | ffp "FV.G5 row form: Edit Row opens 'Editing Row #1 · Items'…" | — | simulator | flat sections (no tabs / collapsible in the row form) |
| FV.G6 | Inline edit | COMPLETE | COMPLETE | both | `FCT`, DataGrid | ff Contact; fld "edits one row inline…" | `#frappe-forms` contact | simulator | Core DataGrid edits one row at a time (Desk) |
| FV.G7 | Child validation & reqd | COMPLETE | COMPLETE | Frappe | `m/mandatory.ts` | ff Contact "…Email ID is required in every row."; pmd child block | — | simulator, unit | — |
| FV.G8 | Child permissions | COMPLETE | COMPLETE | Frappe | `FCT`, `FFV` | rff R1-F8; ff R1-F15; p27 "child table is read-only…" | `#frappe-permissions` | simulator | — |
| FV.G9 | Upload / download (grid CSV) | MISSING | MISSING | — | — | none | — | — | Desk grid Download / Upload absent |
| FV.G10 | Attachments in rows | PARTIAL | PARTIAL | Frappe | `FF` (attaches to the parent) | none in a row context | — | — | untested |
| FV.G11 | Dirty state | COMPLETE | COMPLETE | Frappe | `m/docStore.ts` | ffm "set_value: … dirty flag…" | — | unit, simulator | — |
| FV.G12 | Parent-child save | COMPLETE | COMPLETE | Frappe | savedocs; `m/docStore.ts` | ff Contact "…the row is saved"; ffm "replace() drops __unsaved…" | — | simulator | — |
| FV.G13 | Grid flags | PARTIAL | **COMPLETE** | Frappe | `FCT` | ffp "FV.G13 grid flags from the meta: cannot_add_rows / cannot_delete_rows hide their controls; static_rows…" | — | simulator | — |
| FV.G14 | Table events | PARTIAL | **COMPLETE** | Frappe | `FFV` | ffp "FV.G14 a child field change runs childEvents[child][field]…"; ffp "FV.G4 …" (`_move`); ffp "FV.G5 …" (`form_render`); ff "table events…" | — | simulator | — |

### FV.H. Lifecycle

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.H1 | Save | COMPLETE | COMPLETE | Frappe | `FFV`, `FForm` (useSaveDoc → savedocs) | ff "loads a ToDo, edits a field… saves the whole document through savedocs" | `#frappe-forms` todo | simulator (+real meta) | real-site save not done |
| FV.H2 | Pre-save pipeline | COMPLETE | COMPLETE | Frappe | `FFV` | ff "a clean Save shows No changes…", "validate returning false aborts", "missing mandatory field opens Missing Fields" | `#frappe-forms` new-todo | simulator | no focus on the first missing field |
| FV.H3 | Submit | COMPLETE | COMPLETE | Frappe | `FFV` | ff "saved + clean + submittable → Submit…"; ffp "FV.H3 frm.save('Submit') asks first…" | — | simulator | — |
| FV.H4 | Update (allow_on_submit) | PARTIAL | **COMPLETE** | Frappe | `m/actions.ts` (Update XOR Cancel), `FFV` | ffp "FV.H4 editing an allow_on_submit field shows Update and no Cancel; Update sends savedocs action Update" | — | simulator | **behaviour change**: no Cancel while dirty (C-native F5) |
| FV.H5 | Cancel (+ Cancel All) | COMPLETE | COMPLETE | Frappe | `FFV`, `FForm` | ff Submit→Cancel; R1-F5; p27 Cancel All (8) | — | simulator | — |
| FV.H6 | Amend | COMPLETE | COMPLETE | Frappe | `FFV`, `m/copy.ts`, `FForm` | ff "R1-F5: Amend…"; ffp "FV.H6 no Amend without the create right…"; ffp "FV.K6 … an amendment's rows keep _amended_from" | — | simulator | **behaviour change**: Amend needs amend + create (C-native F8) |
| FV.H7 | State-aware primary action | COMPLETE | COMPLETE | Frappe | `m/actions.ts` | ffm "follows Desk's first-match order"; prr1 F-09/W-04 | — | unit | — |
| FV.H8 | Permission visibility of actions | COMPLETE | COMPLETE | Frappe | `FFV` | p27 P2-1 block (6) | `#frappe-permissions` | simulator, unit | — |
| FV.H9 | Confirmations (Submit / Cancel) | COMPLETE | COMPLETE | Frappe | `FFV` | ff "Permanently Submit SM-1?" + Cancel confirm | — | simulator | — |
| FV.H10 | Loading / error | COMPLETE | COMPLETE | Frappe | `FForm`, `FFV` | ff "V4…", "a server error is shown…", "R1-F4: a 417 timestamp conflict…" | `#frappe-forms` loading / error / save-error | simulator | — |
| FV.H11 | Duplicate-submit prevention | PARTIAL | **COMPLETE** | Frappe | `FFV` `savingRef` | ffp "FV.H11 a double click on Save sends one savedocs" | — | simulator | — |
| FV.H12 | Post-success behaviour | COMPLETE | COMPLETE | Frappe | `FFV` | ff "loads a ToDo…", "a new ToDo…" | `#frappe-forms` | simulator | route change after a rename is the app's |
| FV.H13 | Ctrl/⌘+S | PARTIAL | **COMPLETE** | Frappe | `FFV` (document-level, topmost form) | ffp "FV.H13 Ctrl+S with focus outside the form saves…", "…inside a text box blurs it first…", "…clean saved submittable draft: Ctrl+S runs … Submit…", "…cancelled document: Ctrl+S runs Amend…", "FV.H13 negative…", "…only the topmost mounted form answers…" | `#frappe-form-p35` | simulator | **behaviour change**: Ctrl+S = Desk's primary action (C-native F1); `hotkeys={false}` opts out |
| FV.H14 | Unsaved-changes guard | PARTIAL | **COMPLETE** | Frappe | `FFV` beforeunload + `onDirtyChange`; `unsavedChanges.ts` `useUnsavedChangesBlocker` | ffp "FV.H14 onDirtyChange reports true…", "FV.H14 useUnsavedChangesBlocker: clean → leave; dirty → asks…" | `#frappe-form-p35` | simulator | the host router must call it (router-agnostic); edits are not kept across unmount |

### FV.I. Workflow

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.I1 | Action buttons | COMPLETE | COMPLETE | both | `FrappeWorkflowActions.tsx`; `FForm` | rfu "shows the state and the allowed transitions, applies one"; p27 "Approve path…" | `#frappe-workflow` | simulator, unit | — |
| FV.I2 | Approve / Reject / custom actions (+ Desk pre/post steps) | COMPLETE | COMPLETE | Frappe | `useWorkflow.ts`, `FrappeWorkflowActions` `beforeApply` / `afterApply` | p27 "…Approve and Reject…"; ffp "FV.I2 a mandatory_depends_on field left empty blocks the transition…", "FV.I2 with the value: before_workflow_action…", "FV.I2 negative…" | `#frappe-workflow` | simulator | `condition` evaluated server-side only |
| FV.I3 | Transition permissions | COMPLETE | COMPLETE | Frappe | `record/workflow.ts` | prec W-02; rfu "hides actions the owner may not self-approve"; simp | `#frappe-workflow` | simulator, unit | — |
| FV.I4 | State refresh after apply | COMPLETE | COMPLETE | Frappe | `useDocAction().applyWorkflow` | rfu "after apply, the doc cache holds the BARE doc…" | `#frappe-workflow` | unit | — |
| FV.I5 | Confirmation | COMPLETE | COMPLETE | Core+Frappe | `confirm` prop; ActionBar | rfu "shows the server's refusal…"; rec "asks for confirmation…" | `#frappe-workflow` | unit | opt-in (Desk applies immediately) |
| FV.I6 | Comments on transition | N/A | N/A | — | — | — | — | — | Desk 15.110 takes no comment |
| FV.I7 | Unavailable transitions | COMPLETE | COMPLETE | Frappe | `FrappeWorkflowActions` | rfu "disables the actions … unsaved edits"; p27 "get_transitions refused (403)…" | `#frappe-workflow` | simulator, unit | — |
| FV.I8 | Workflow replaces Save/Submit/Cancel | COMPLETE | COMPLETE | Frappe | `m/actions.ts`, `FForm` | ff R1-F7, R3-F2; ffp "FV.I8 a new document of a workflow DocType starts in the default state…" | — | simulator | — |
| FV.I9 | Against a real Frappe Workflow | BLOCKED | BLOCKED | — | — | — | — | — | needs an approved real site (apply is a write) |

### FV.J. Status / header

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.J1 | Not Saved | COMPLETE | COMPLETE | Frappe | `FFV` via `resolveIndicator` | ff "…marks it Not Saved…" | `#frappe-forms` | simulator | — |
| FV.J2 | Draft | COMPLETE | COMPLETE | Frappe | `services/indicator.ts` | fi "3-4. submittable: Draft and Cancelled…" | — | unit | not asserted inside a form |
| FV.J3 | Submitted | COMPLETE | COMPLETE | Frappe | same | ff Submit test | — | simulator | — |
| FV.J4 | Cancelled | COMPLETE | COMPLETE | Frappe | same | ff Cancel tests | — | simulator | — |
| FV.J5 | Workflow state | COMPLETE | COMPLETE | Frappe | `FFV` | ff R1-F7; fi 2/2b | `#frappe-workflow` | simulator, unit | — |
| FV.J6 | Indicator pill | COMPLETE | COMPLETE | both | `FFV` Badge; `FrappeStatusIndicator` | rfu "FrappeStatusIndicator shows the workflow state…" | `#frappe-record` | simulator, unit | form uses `Badge`, record layer `StatusBadge` (two renderings) |
| FV.J7 | title_field | COMPLETE | COMPLETE | Frappe | `FFV` | ff "V1: an HTML title field is shown as text" | `#frappe-forms` | simulator | — |
| FV.J8 | Naming (New X, `__newname`, name under title) | PARTIAL | PARTIAL | Frappe | `FFV`, `m/layout.ts` | ff "New ToDo"; ffm `__newname` | `#frappe-forms` new-todo | simulator, unit | no naming-series preview; name subtitle untested |
| FV.J9 | image_field | MISSING | **COMPLETE** | Frappe | `FFV` header avatar | ffp "FV.J9 header image from meta.image_field (initials fallback when empty)", "FV.J9 negative…" | `#frappe-form-p35` | simulator | click-to-upload from the header not provided |
| FV.J10 | Header actions | PARTIAL | **COMPLETE** | Frappe | `FFV` `menu` slot, custom buttons, `toolbarExtra` | ffp "FV.K3/K16 menu slot renders after the primary action"; ffp "FV.K1 buttons added in refresh render in the header…" | `#frappe-form-p35` | simulator | — |
| FV.J11 | Title updates live | PARTIAL | **COMPLETE** | Frappe | `FFV` | ffp "FV.J11 the heading follows the title field as it is edited, with Not Saved" | — | simulator | — |

### FV.K. Menus / actions

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.K1 | Custom buttons (`frm.add_custom_button`) | PARTIAL | **COMPLETE** | Frappe | `events.ts` `FormController.addCustomButton/removeCustomButton/clearCustomButtons`; `FFV` | ffp "FV.K1 buttons added in refresh render in the header and run their handler; K2 grouped ones form a dropdown", "FV.K1 buttons are cleared before every refresh…" | `#frappe-form-p35` | simulator | — |
| FV.K2 | Create dropdown | MISSING | **COMPLETE** | Frappe | grouped custom buttons → DropdownMenu | ffp "FV.K1 … K2 grouped ones form a dropdown" | `#frappe-form-p35` | simulator | make_ entries from the dashboard are not generated automatically (app adds them) |
| FV.K3 | Three-dot menu | MISSING | **COMPLETE** | both | Core `RecordMenu`; Frappe `FrappeRecordMenu`, `formMenuItems`; `FForm` `menu` (default on), `FFV` `menu` (node or `(ctx: FrappeFormMenuContext) => node`) | fint "FV.K3 FV.M1 the ⋯ menu and the Connections tab are on by default; menu={false} / connections={false} remove them…", "FV.K3 FV.K16 a System Manager gets Desk's menu in the form, with no extra request for docinfo"; ra "FV.K3 groups items with separators…"; fra "FV.K3 FV.K16 …" | `#frappe-record-actions` | simulator, unit | — |
| FV.K4 | Print (form) | MISSING | **COMPLETE** | Frappe | `FrappeFormPrint`, `formPrint.ts`; menu entry | fint "FV.K4 Print opens FrappeFormPrint for the form's document (get_html_and_style preview)"; fra "FV.K4 FV.L1 Print follows Print Settings…" | `#frappe-record-actions` | simulator | — |
| FV.K5 | Email | MISSING | **COMPLETE** | both | menu → `FrappeEmailComposer` | fint "FV.K5 Email opens FrappeEmailComposer prefilled from the document; sending records a Communication"; fra "FV.K5 FV.K8 FV.K9 FV.K15 …" | `#frappe-record-actions` | simulator | see O |
| FV.K6 | Duplicate | PARTIAL | **COMPLETE** | Frappe | `copyDoc` (from defaults); `FForm` opens the local copy (a host `onDuplicate` replaces it) | fint "FV.K6 Duplicate opens the copy in the form (no request); saving it inserts a new Deal and keeps D-1"; ffp "FV.K6 a Duplicate gets the no_copy field's default…"; fra "FV.K6 FV.K7 …" | `#frappe-record-actions` | simulator | the copy lives in FrappeForm state (a remount or a `name` change drops it); the form keeps its `name` prop — route with `menu.onOpened` |
| FV.K7 | Copy to clipboard | MISSING | **COMPLETE** | Frappe | `FrappeRecordMenu` | fra "FV.K6 FV.K7 … Copy to Clipboard writes JSON.stringify(doc)" | `#frappe-record-actions` | simulator | — |
| FV.K8 | Rename | PARTIAL | **COMPLETE** | both | Core `RenameDialog`; `FrappeRecordMenu` → `frappe.rename_doc` | ra "FV.K8 requires a name…"; fra "FV.K8 Rename sends frappe.rename_doc…" | `#frappe-record-actions` | simulator | title path (`update_document_title`, queued rename) not implemented |
| FV.K9 | Delete | PARTIAL | **COMPLETE** | both | `RecordMenu` confirm; `FrappeRecordMenu` → `frappe.client.delete` | fra "FV.K9 Delete asks 'Permanently delete {title} ({name})?'…", "FV.K9 permission negative…", "FV.K9 a server refusal surfaces…"; ra "FV.K9 a destructive item asks first…" | `#frappe-record-actions` | simulator | — |
| FV.K10 | Reload | PARTIAL | **COMPLETE** | Frappe | menu → the form's reload | fint "FV.K10 Reload re-reads the document from the server (getdoc) and shows the server's value"; fra "FV.K10 FV.K15 FV.K14 Reload asks first when dirty…" | `#frappe-record-actions` | simulator | confirms when dirty (deliberate difference from Desk); not offered for a new document or a local copy |
| FV.K11 | Customize | N/A | N/A | — | extra: `customizeHref`, menu entry for System Manager | fra "FV.K6 FV.K11 FV.K14 …Customize for System Manager only…" (extra, not counted) | `#frappe-record-actions` | simulator | N/A kept (fixed denominator); built anyway as a Desk-URL hand-off |
| FV.K12 | Links (linked_with) | MISSING | **COMPLETE** | Frappe | menu "Links" → `showTab("extra:connections")` | fint "FV.K12 FV.M3 Links switches to the Connections tab, which counts the linked Deal Notes (get_open_count)" | `#frappe-record-actions` | simulator | opens the Connections tab (offered only when it exists); no `linked_with` dialog |
| FV.K13 | Remind Me | MISSING | **COMPLETE** | both | Core `ReminderDialog`; `FrappeReminder` → `create_new_reminder` | ra "FV.K13 default 1 hour from now…"; fra "FV.K13 Remind Me → create_new_reminder…" | `#frappe-record-actions` | simulator | — |
| FV.K14 | Undo / Redo | MISSING | **COMPLETE** | Frappe | `m/docStore.ts` history; `FFV` Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y; menu entries → `frm.undo()` / `frm.redo()` | ffp "FV.K14 Ctrl+Z outside inputs undoes the user's last change…", "FV.K14 negative…"; fint "FV.K14 Undo / Redo in the menu follow the form's history (controller undo / redo)" | `#frappe-form-p35` | simulator | only user input is recorded (as Desk) |
| FV.K15 | New {DocType} | MISSING | **COMPLETE** | Frappe | `formMenuItems` (create, not in_create, not single); `FForm` opens a new document (a host `onNew` replaces it) | fint "FV.K15 New opens a new Deal in the form; a host onNew replaces it"; fra "FV.K5 FV.K8 FV.K9 FV.K15 … New = create, not in_create" | `#frappe-record-actions` | simulator, unit | — |
| FV.K16 | Menu permission-aware & configurable | MISSING | **COMPLETE** | Frappe | `formMenuItems` + `exclude` / `extra`; `FrappeFormMenuOptions` | fint "FV.K16 options pass through: exclude drops entries, extra adds the host's own; a node replaces the menu", "FV.K16 permission negative: a Viewer (read only) gets no Duplicate, Rename, Delete, Print, Email, Customize or New"; fra "FV.K16 every entry…" | `#frappe-record-actions` | unit, simulator | Rename / Delete do not re-route: the host routes with `onRenamed` / `onDeleted` |

### FV.L. Print / PDF

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.L1 | Format selector | PARTIAL | **COMPLETE** | Frappe | `FrappeFormPrint` | fra "FV.K4 FV.L1 …", "FV.L1 FV.L2 FV.L3 formats from the meta (no JS formats), the default letterhead…" | `#frappe-record-actions` | simulator | — |
| FV.L2 | Preview | MISSING | **COMPLETE** | both | Core `PrintPreviewFrame` (sandboxed iframe); `FrappePrintPreview` → `get_html_and_style` | ra "FV.L2 renders server HTML in a sandboxed iframe…"; fra "FV.L1 FV.L2 FV.L3 …" | `#frappe-record-actions` | simulator (placeholder HTML) | the simulator's HTML is a labelled placeholder without values |
| FV.L3 | PDF | PARTIAL | PARTIAL | Frappe | `downloadPdfUrl`, `pdf="link" | "download"` | fra "FV.L1 FV.L2 FV.L3 … the PDF / Full Page URLs"; fra "FV.L3 pdf=\"download\" POSTs download_pdf…; the simulator does not simulate it and the refusal is shown" | `#frappe-record-actions` | unit (URL shape) | `download_pdf` is not simulated: only the URL shape and the refusal path are tested |
| FV.L4 | print_hide | N/A | N/A | — | — | — | — | — | honoured by the server renderer |
| FV.L5 | Loading / errors | PARTIAL | **COMPLETE** | Frappe | `FrappeFormPrint` | fra "FV.L5 refused before any request…", "FV.L5 FV.L6 the server's refusal is shown…" | `#frappe-record-actions` | simulator | — |
| FV.L6 | Server rendering | PARTIAL | **COMPLETE** | Frappe | `FrappePrintPreview` | fra "FV.L5 FV.L6 …" | `#frappe-record-actions` | simulator | — |
| FV.L7 | Real print formats / letterheads | BLOCKED | BLOCKED | — | — | — | — | — | needs a real site |

### FV.M. Connections

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.M1 | Connections tab | MISSING | **COMPLETE** | both | Core `ConnectionsPanel`; `FrappeConnections`; `FForm` `connections` (default on when `connectionsFromMeta` finds a dashboard); `FFV` `extraTabs` | fint "FV.K3 FV.M1 the ⋯ menu and the Connections tab are on by default…; no dashboard → no tab"; ra "FV.M1 groups with count badges…"; ffp "FV.M1 extraTabs…" ×2 | `#frappe-record-actions` | simulator, unit | a form without Tab Breaks gets a "Details" + "Connections" tab bar |
| FV.M2 | Linked doctypes (`meta.__dashboard`) | MISSING | **COMPLETE** | Frappe | `connections.ts` `connectionsFromMeta` | fra "FV.M2 connectionsFromMeta reads the recorded real 15.110 dashboards (User, Customer)…" | `#frappe-record-actions` | unit (recorded-real metas as input) | `override_doctype_dashboards` hooks need a site |
| FV.M3 | Counts (`get_open_count`) | MISSING | **COMPLETE** | Frappe | `useOpenCounts` | fra "FV.M3 FV.M4 FrappeConnections on the real User meta: get_open_count…", "FV.M3 the Deal dashboard counts…"; fint "FV.K12 FV.M3 Links switches to the Connections tab…" | `#frappe-record-actions` | simulator | server counts via `frappe.get_all`; real behaviour unverified |
| FV.M4 | Navigation | MISSING | **COMPLETE** | Frappe | `FrappeConnections` `onOpenList` / `listHref` / `onNew` | fra "FV.M3 FV.M4 …open list / new with the link filter…" | `#frappe-record-actions` | simulator | — |
| FV.M5 | Empty / loading | MISSING | **COMPLETE** | both | `ConnectionsPanel` | ra "FV.M5 empty, notice, loading and error-with-retry states…"; fra "FV.M5 FV.M6 a new document asks to save first…" | `#frappe-record-actions` | unit, simulator | — |
| FV.M6 | Permission-aware | MISSING | **COMPLETE** | Frappe | `FrappeConnections` `canRead`; server READ check | fra "FV.M5 FV.M6 … the server's READ check refuses an outsider…"; "FV.M3 FV.M4 … canRead hides" | `#frappe-record-actions` | simulator | — |

### FV.N. Submission

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.N1 | Read-only after submit | COMPLETE | COMPLETE | Frappe | `m/status.ts` | ff Submit test; pds 4 | — | simulator, unit | — |
| FV.N2 | allow_on_submit | PARTIAL | **COMPLETE** | Frappe | `m/status.ts`, `FCT` | ffp "FV.H4 editing an allow_on_submit field shows Update and no Cancel…"; pds 5 | — | simulator, unit | — |
| FV.N3 | Field exceptions | COMPLETE | COMPLETE | Frappe | `m/status.ts` | pds 1, 7, 8; fh | — | unit | — |
| FV.N4 | Cancelled read-only | COMPLETE | COMPLETE | Frappe | `m/status.ts` | pds "docstatus 2" | — | unit | — |
| FV.N5 | Amended docs | COMPLETE | COMPLETE | Frappe | `m/copy.ts`, `FForm` | ff R1-F5 Amend; prr2 (4); ffp "FV.K6 … an amendment's rows keep _amended_from" | — | simulator, unit | — |
| FV.N6 | Mandatory skipped for cancelled | COMPLETE | COMPLETE | Frappe | `m/mandatory.ts` | pmd "docstatus 2 skips the check" | — | unit | — |

### FV.O. Email composer

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.O1 | Recipients | MISSING | **COMPLETE** | both | Core `EmailComposer`; `FrappeEmailComposer` | ra "FV.O1 FV.O2 FV.O4 FV.O7 FV.O9 sends To / CC / BCC…" | `#frappe-record-actions` | unit | recipient search is the host's (`searchRecipients`); `get_contact_list` not wired |
| FV.O2 | CC / BCC | MISSING | **COMPLETE** | both | same | ra (same test) | `#frappe-record-actions` | unit | — |
| FV.O3 | Templates (Email Template) | MISSING | **COMPLETE** | both | `EmailComposer` templates; `get_email_template` | ra "FV.O3 Add Template prepends…"; fra "FV.O3 Email Templates are listed from the server and applied…" | `#frappe-record-actions` | unit, simulator | Jinja rendering is the server's (simulated) |
| FV.O4 | Attachments | MISSING | **COMPLETE** | both | `EmailComposer` attachment checklist | ra "FV.O1 … attachments…" | `#frappe-record-actions` | unit | — |
| FV.O5 | Preview | MISSING | MISSING | — | — | none | — | — | not implemented |
| FV.O6 | Validation | MISSING | **COMPLETE** | both | `isValidEmail`; disabled reason | ra "FV.O6 validates…", "FV.O6 without the e-mail right…" | `#frappe-record-actions` | unit | — |
| FV.O7 | Sending state | MISSING | **COMPLETE** | both | `EmailComposer` busy | ra "FV.O1 … busy while sending…" | `#frappe-record-actions` | unit | — |
| FV.O8 | Server integration (`communication.email.make`) | MISSING | **COMPLETE** | Frappe | `email.ts` `emailMakeArgs` | fra "FV.O8 sends email.make with Desk's arguments…", "FV.O8 after sending, the document's docinfo query is invalidated…"; sctx "FV.O8 FrappeEmailComposer → email.make → docinfo re-read → FrappeTimeline lists the Communication", "FV.O8 SIM.ctx email.make checks the e-mail right with the engine (if_owner)…" | `#frappe-record-actions` | simulator | `print_letterhead` always 1; no schedule / signature / reply-all; real sending unverified |
| FV.O9 | Errors | MISSING | **COMPLETE** | both | `EmailComposer` error line | ra "FV.O1 … a refusal is shown and the draft kept"; fra "FV.O9 FV.O6 …the SIMULATED server's 403 is shown…" | `#frappe-record-actions` | unit, simulator | — |

### FV.P. Website link

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FV.P1 | "See on Website" | MISSING | **COMPLETE** | Frappe | `FFV` header link | ffp "FV.P1-P4 See on Website: a published website generator (__onload…) links /route in a new tab" | `#frappe-form-p35` | simulator | — |
| FV.P2 | Visibility rule | MISSING | **COMPLETE** | Frappe | `FFV` (`__onload.is_website_generator && published && route`; fallback `has_web_view`) | ffp "FV.P2 See on Website is not shown when unpublished…", "FV.P2 See on Website without __onload…" | `#frappe-form-p35` | simulator | fallback rule is a DS extension |
| FV.P3 | Route / URL | MISSING | **COMPLETE** | Frappe | `FFV` | ffp "FV.P1-P4 …" | `#frappe-form-p35` | simulator | real website routes need a site |
| FV.P4 | Open (new tab) | MISSING | **COMPLETE** | Frappe | `FFV` | ffp "FV.P1-P4 …" | `#frappe-form-p35` | simulator | — |

## 4b. List View (A–J)

### LV.A. Columns

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.A1 | Default columns from `in_list_view`; Subject first | COMPLETE | COMPLETE | Frappe | `meta.ts` `columnsFromMeta`; `useFrappeList.tsx` | F "matches Sear's buildGridMeta…"; FL "without curated columns the title field (else the ID) is the first, visible column"; SR "FrappeListView renders the real Sada Post Type metadata and rows" | `#frappe-list-view` | unit, simulator, recorded-real (read) | — |
| LV.A2 | List View Settings (read) | COMPLETE | COMPLETE | Frappe | `list/settings.ts` | FL "`fields` reorders…"; FL disable_count / disable_comment_count; LQ "List View Settings total_fields wins over the width" | — | unit, simulator | writing: see J7 |
| LV.A3 | Width-based column cap (default on in FrappeListView) | COMPLETE | COMPLETE | Frappe | `list/settings.ts`; `FrappeListView.tsx` | LQ "at ${width} px the list shows…", "responsive: crossing 1366 / 1920…"; LIO "generated columns are capped by width by default" | — | simulator (jsdom width) | Status slot counted at a fixed position |
| LV.A4 | User-configured columns (column manager) | COMPLETE | COMPLETE | Core | `parts/Toolbar.tsx` | L "PMO's column manager…" | `#data` List View | unit | — |
| LV.A5 | Column ordering | COMPLETE | COMPLETE | Core | `parts/Toolbar.tsx` | L "reorder: grip + ↑/↓ keys… and pointer drag" | List View | unit | — |
| LV.A6a | Local persistence per view and user | COMPLETE | COMPLETE | Core | `model/storage.ts`; `useListState.ts` | L "columns, sort, group-by and quick filters survive a remount", "…per view and per user" | — | unit | — |
| LV.A6b | Server persistence in `user_settings` | BLOCKED | BLOCKED | Frappe | `list/storage.ts` | FL "user settings: load from getdoctype's user_settings; save keeps Desk's keys…"; flp "LV.I4 … saved in user_settings List.sf_ui.pageSize" | `#frappe-list-view` | unit, simulator | whether Desk's merge keeps the `List.sf_ui` key is UNVERIFIED on a site; now also stores `pageSize` |
| LV.A7 | Per-column width / resize | N/A | N/A | — | — | — | — | — | Desk's List View has no column resizing |
| LV.A8 | Cell formatting via site formats | COMPLETE | COMPLETE | Frappe + Core | `useFrappeList.tsx`; `services/format.ts`; `ListTable` | FL "numbers, currency and dates use the site's formats", "allocated_to: full name…"; L "F2 default cell per type…" | `#frappe-list-view` | unit, simulator | Select / DocField labels not translated |
| LV.A9 | Custom fields as columns / filters | PARTIAL | **COMPLETE** | Frappe | `meta.ts` | flp "LV.A9 a custom field (is_custom_field: 1) is a column, a quick filter and a filter the request sends" | — | simulator | — |
| LV.A10 | Permlevel > 0 columns hidden | COMPLETE | COMPLETE | Frappe | `meta.ts` `restrictMetaToReadable` | LIO "a level-0 role never sees the Secret column…" | — | simulator | needs `session.roles` |
| LV.A11 | Row-metadata columns offered, hidden by default | COMPLETE | COMPLETE | Frappe | `list/cells.tsx` | FL "row metadata columns are offered, hidden by default…" | `#frappe-list-view` | unit | Desk always shows them; `rowMeta={true}` |

### LV.B. Filters

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.B1 | `in_standard_filter` → quick filters | COMPLETE | COMPLETE | Frappe | `meta.ts` `quickFilterFields` | F "loads meta once…", "a quick filter reaches list and count identically" | `#frappe-list-view` | unit | — |
| LV.B2 | Standard filter bar | COMPLETE | COMPLETE | Core | `Toolbar.tsx` `QuickFilters` | L "the field picker is opt-in…" | List View | unit | — |
| LV.B3 | Operators → Frappe tuples | PARTIAL | PARTIAL | Core + Frappe | `model/filters.ts`; `query.ts` | L, PL (L-04), F, LQ (nested-set) | List View | unit, simulator | no In / Not In on Date fields; Link has no `not like` |
| LV.B4 | Multiple filters | COMPLETE | COMPLETE | Core | `parts/FilterBuilder.tsx` | L "add, edit, AND/OR, remove, clear — and the count badge" | List View | unit | — |
| LV.B5 | AND / OR conjunction | COMPLETE | COMPLETE | Core + Frappe | `query.ts` | L; F "C2 in the UI: with "Match any" filters, search narrows…" | `#frappe-list-view` | unit | OR queries cannot be saved or put in the URL |
| LV.B6 | Child-table field filters | COMPLETE | COMPLETE | Frappe | `meta.ts`; `query.ts` | FL "a child condition becomes [child doctype, field, op, value]…"; PL | — | unit | — |
| LV.B7 | Clear filters | COMPLETE | COMPLETE | Core | `ListView.tsx` | L "F28 two empty messages…" | `#frappe-list-view` | unit | — |
| LV.B8 | URL sync (opt-in) | COMPLETE | COMPLETE | Frappe | `list/urlFilters.ts` | LQ (8 tests) | — | simulator (jsdom location) | off by default; OR / search / sort not written |
| LV.B9 | Unknown-field filters dropped | COMPLETE | COMPLETE | Frappe | `query.ts` | F (2) | — | unit | — |
| LV.B10 | Link filter values from `search_link` | COMPLETE | COMPLETE | Frappe | `useFrappeList.tsx` | F; L | `#frappe-list-view` | unit | — |
| LV.B11 | Indicator pill click → filter | COMPLETE | COMPLETE | Frappe + Core | `list/cells.tsx`; `ListActionsContext.ts` | FL "shows Draft / Submitted / Cancelled pills; clicking one filters by docstatus" | — | unit | — |
| LV.B12 | Standard filter fields (owner, modified_by, docstatus…) | COMPLETE | COMPLETE | Frappe | `meta.ts` | FL "offers owner, modified_by, docstatus (submittable)…" | — | unit | — |
| LV.B13 | Filter by Tags | MISSING | **COMPLETE** | Frappe | `meta.ts` (`_user_tags` field); `FilterField.operators` | flp "LV.B13 / LV.B14 Assigned To and Tags are filter fields offering like / not like / is…" | `#p35-list` | simulator | — |
| LV.B14 | Filter by Assigned To | MISSING | **COMPLETE** | Frappe | `meta.ts` (`_assign` → User) | flp (same test) | `#p35-list` | simulator | — |
| LV.B15 | Default 90-day recency filter | MISSING | MISSING | — | — | none | — | — | not implemented |

### LV.C. Sorting & saved filters

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.C1 | Header-click sort | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts`; `query.ts` | L; F | List View | unit | — |
| LV.C2 | Sort menu (opt-in) | COMPLETE | COMPLETE | Core | `Toolbar.tsx` `SortMenu` | L "F7 sort menu (opt-in) sorts and clears" | `#frappe-list-view` | unit | offers only visible columns |
| LV.C3 | `name` tie-break | COMPLETE | COMPLETE | Frappe | `query.ts` | PL; FL | — | unit | — |
| LV.C4 | DocType default sort | COMPLETE | COMPLETE | Frappe | `meta.ts`; `query.ts` | F "…search fields and the DocType's sort are used" | — | unit | — |
| LV.C5 | Multi-field sort | N/A | N/A | — | — | — | — | — | Desk's List View sorts by one field (Report view: see H1) |
| LV.C6 | Sort persistence | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts`; `list/storage.ts` | L; FL | — | unit | server side: A6b |
| LV.C7 | Saved filters (save / apply / delete) | COMPLETE | COMPLETE | Core + Frappe | `Toolbar.tsx` `SavedFilters`; `list/storage.ts` | L "save, apply and delete through an async adapter…"; FL "saved filters: List Filter rows…"; SP | `#frappe-list-view` | unit, simulator | OR queries refused |
| LV.C8 | Per-user saved filters | COMPLETE | COMPLETE | Frappe | `list/storage.ts` | FL | `#frappe-list-view` | unit | — |
| LV.C9 | Public / shared ("Is Global") | PARTIAL | **COMPLETE** | Core + Frappe | `SavedFilters canSaveGlobal`; `SaveFilterOptions`; `actsAsSystemManagerFor` | lp "LV.C9 'Is Global' only with savedFiltersGlobal…"; flp "LV.C9 a System Manager's global save inserts List Filter with for_user ''…", "LV.C9 negative control: a Reader…" | `#p35-list` | unit, simulator | — |
| LV.C10 | Rename saved filter | N/A | N/A | — | — | — | — | — | Desk has no rename |
| LV.C11 | Delete with confirmation | MISSING | **COMPLETE** | Core | `SavedFilters` AlertDialog | lp "LV.C11 removing asks first (list_filter.js:104-117)…" | `#p35-list` | unit | — |
| LV.C12 | Duplicate filter name rejected | COMPLETE | COMPLETE | Core + Frappe | `list/storage.ts`; `model/storage.ts` | FL (`rejects.toThrow(/already exists/)`); lp "LV.C12 a duplicate name says 'Duplicate Filter Name'… the local adapter rejects it too" | — | unit | **behaviour change**: the localStorage adapter now rejects duplicates |
| LV.C13 | Default / restored filters | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts`; `list/storage.ts` | FL "serverStorage: restores…"; LQ "initialQuery wins…" | — | unit, simulator | — |
| LV.C14 | Filter permissions (List Filter rules) | BLOCKED | BLOCKED | Frappe (server) | `list/storage.ts` | SP "a read-only session keeps its saved filters…" | — | simulator | enforced only by the server; real rules not recorded |

### LV.D. Grouping & sidebar

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.D1 | Group-by menu | COMPLETE | COMPLETE | Core + Frappe | `Toolbar.tsx` `GroupByMenu`; `model/group.ts` | L "groups with counts…"; F "C1 server grouping…" | `#frappe-list-view` | unit | opt-in; client-side over loaded chunks |
| LV.D2 | Group by Assigned To | PARTIAL | **COMPLETE** | Core + Frappe | `model/group.ts` multi-bucket `groupOf`; `useFrappeList.tsx` | lp "LV.D2 groupRows: an array puts the row in every bucket…", "LV.D2 ListView shows a row in each of its groups…"; flp "LV.D2 group by Assigned To: one group per user (full name)…" | `#p35-list` | unit, simulator | — |
| LV.D3 | Group by Created By | PARTIAL | **COMPLETE** | Frappe | `useFrappeList.tsx` (full-name labels) | flp "LV.D3 group by Created By is labelled with the users' full names" | `#p35-list` | simulator | — |
| LV.D4 | Group by Tags | PARTIAL | **COMPLETE** | Frappe | `useFrappeList.tsx` | flp "LV.D4 group by Tags: one group per tag, untagged rows under 'No Tags'" | `#p35-list` | simulator | **behaviour change**: "no value" group labelled "Not Set" / "No Tags" (was "—") |
| LV.D5 | Group by any field incl. custom | COMPLETE | COMPLETE | Frappe | `useFrappeList.tsx` | F "C1 server grouping…"; L | `#frappe-list-view` | unit | — |
| LV.D6 | Sidebar group-by with server counts | MISSING | **COMPLETE** | both | Core `GroupBySidebar`, `ListView aside`; Frappe `FrappeGroupBySidebar`, `useGroupByCounts` (`get_group_by_count`) | lp "LV.D6 lists values with counts…", "LV.D6 ListView aside renders next to the list…"; flp "LV.D6 Assigned To + Created By counts from get_group_by_count…", "LV.D6 the session user is listed first as 'Me'…"; sctx "LV.D6 SIM.ctx get_group_by_count uses the transport's filter: child-table conditions and the session's row permissions" | `#p35-list` | simulator | opt-in (`sidebar`); server aggregate approximated by the simulator (now with child-table filters and row permissions); WS3 and the integration report keep it BLOCKED — reclassified by rule 3 |
| LV.D7 | Sidebar tag stats | MISSING | **COMPLETE** | Frappe | `useTagStats` (`get_sidebar_stats`) | flp "LV.D7 tag stats from get_sidebar_stats; a tag filters `like`, 'No Tags' filters `not like %,%`"; sctx "LV.D7 SIM.ctx get_sidebar_stats counts only readable rows, with child-table filters" | `#p35-list` | simulator | as D6; WS3 and the integration report keep it BLOCKED — reclassified by rule 3 |
| LV.D8 | Group counts (exact / "+") | COMPLETE | COMPLETE | Core | `ListView.tsx` | L "C1 server mode…"; F | `#frappe-list-view` | unit | — |
| LV.D9 | Expand / collapse groups | COMPLETE | COMPLETE | Core | `ListTable.tsx` | L "…collapsible" | List View | unit | collapse state not persisted |
| LV.D10 | Grouping with filters & pagination | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts`; `query.ts` | L "C1 client mode…"; F | `#frappe-list-view` | unit | — |
| LV.D11 | User-configurable sidebar fields | MISSING | **PARTIAL** | Frappe | `FrappeGroupBySidebar` (reads `user_settings.group_by_fields`) | flp "LV.D11 user_settings.group_by_fields add sections…" | `#p35-list` | simulator | Desk's "Edit" modal (and saving it) not built |
| LV.D12 | Group-by choice persisted | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts`; `list/storage.ts` | L | — | unit | server side: A6b |

### LV.E. Row status / metadata

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.E1 | Indicator per row (Desk precedence) | COMPLETE | COMPLETE | Frappe | `list/indicator.ts`; `cells.tsx` | FL; FI; PL (L-06) | — | unit | hidden unless `rowMeta={true}` |
| LV.E2 | Docstatus pills | COMPLETE | COMPLETE | Frappe | `indicator.ts` | FL | — | unit | — |
| LV.E3 | Workflow state in the indicator | PARTIAL | **COMPLETE** | Frappe | `indicatorWorkflowFromMeta`; `FrappeListOptions.workflow` | flp "LV.E3 indicatorWorkflowFromMeta maps getdoctype's __workflow_docs…", "LV.E3 the pill shows the workflow state with its style colour…", "LV.E3 negative control: workflow={false}…" | `#p35-list` | simulator | **behaviour change**: derived from the DocType by default |
| LV.E4 | Comment counts | COMPLETE | COMPLETE | Frappe | `reportview.ts`; `cells.tsx` | FL; PL; SR "…_comment_count appended by the server" | — | unit, recorded-real | — |
| LV.E5 | Like heart | COMPLETE | COMPLETE | Frappe + Core | `FrappeListView.tsx`; `LikeToggle` | LK | `record-extras` | unit, simulator | not optimistic (as Desk) |
| LV.E6 | Assignment avatars | COMPLETE | COMPLETE | Frappe | `cells.tsx` | FL | — | unit | — |
| LV.E7 | Tags shown on rows | MISSING | **COMPLETE** | Frappe | `TagsCell`, `parseTags`, `rowMeta.tags` | flp "LV.E7 the Tags cell shows the row's tags; clicking one filters by it" | `#p35-list` | simulator | — |
| LV.E8 | Realtime refresh | COMPLETE | COMPLETE | Frappe | `list/realtime.ts` | FL (3) | `#frappe-list-view` | simulator (fake port) | full reload; real socket not exercised |
| LV.E9 | Loading state | COMPLETE | COMPLETE | Core + Frappe | `ListTable` | L | `#frappe-list-view` | unit | — |
| LV.E10 | Error state | COMPLETE | COMPLETE | Core + Frappe | `useFrappeList.tsx` | L; F; SR "the real Guest 403…" | `#frappe-list-view` | unit, recorded-real | — |
| LV.E11 | Unseen rows bold | MISSING | MISSING | — | — | none | — | — | not implemented |
| LV.E12 | Relative "modified" time | PARTIAL | PARTIAL | Frappe | "Last Updated" column (absolute) | none | — | — | no relative-time row cell |

### LV.F. Bulk actions

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.F1 | Edit (typed value control) | PARTIAL | **COMPLETE** | Frappe | `FrappeBulkActions.tsx` `BulkEditValue`, `bulkEditValue` | flp "LV.F1 a Link field gets a link search over its target…", "LV.F1 a number field gets a number input…"; LIO "mixed result…"; (P36) flp LV.F1 ×2 ported to the header default — now asserts Edit KEEPS the selection; lsd "LV.F selectionAfterBulk" (15 cases) | `#p35-list` | simulator | (P36) the selection stays after Edit and the list reloads (Desk `done` = `refresh()` only, list_view.js:2066-2069) |
| LV.F2 | Export (selection) | COMPLETE | COMPLETE | Frappe | `FrappeExportDialog` | LIO; RK; (P36) lsd "LV.F2 / LV.F7 Export and Print open their dialogs and never touch the selection…" | `#frappe-import-export` | simulator | real `download_template` not run |
| LV.F3 | Assign To | COMPLETE | COMPLETE | Frappe + Core | `FrappeBulkActions.tsx`; `AssignDialog` | FLH; FL; RK; LSH; (P36) lsd "LV.F3 Assign To: closing the dialog keeps the selection; assigning clears it and reloads" | `#frappe-list-view` | simulator, unit | — |
| LV.F4 | Clear Assignment | COMPLETE | COMPLETE | Frappe | `bulk.ts` | LA; RK; (P36) lsd "LV.F4 Clear Assignment: No / Escape on the confirmation CLEARS the selection and reloads (Desk's reject action…)"; LA Clear Assignment test also asserts cancel clears | `#frappe-list-view` | simulator | (P36) dismissing the confirmation clears the selection and reloads (Desk `reject_action`, list_view.js:1919-1921) |
| LV.F5 | Apply Assignment Rule | COMPLETE | COMPLETE | Frappe | `bulk.ts` | LA; RK; (P36) lsd "LV.F5 Apply Assignment Rule: no confirmation; clears and reloads once the server answered" | `#frappe-list-view` | simulator | — |
| LV.F6 | Add Tags | COMPLETE | COMPLETE | Frappe | `bulk.ts`; `FrappeBulkActions.tsx` | LA; RK; (P36) lsd "LV.F6 Add Tags: Cancel in the dialog keeps the selection…" | `#frappe-list-view` | simulator | — |
| LV.F7 | Print | COMPLETE | COMPLETE | Frappe | `print.ts`; `FrappePrintDialog.tsx` | LA (9); (P36) lsd "LV.F2 / LV.F7 Export and Print…never touch the selection…" | `#frappe-list-view` | simulator | background completion needs the host's `subscribeTask` |
| LV.F8 | Submit | PARTIAL | **COMPLETE** | Frappe | `FrappeBulkActions.tsx` | flp "LV.F8 Submit: click → Desk's confirmation → submit_cancel_or_update_docs(action: submit)…"; (P36) flp LV.F8 ported to the header default; lsd "LV.F8 Submit: every document submitted → cleared + reloaded; some failed → the selection STAYS…"; (P36b) bk "LV.F8 / LV.F9 P36B.bulk.2 Report view … Submit and Cancel between Print and Delete", "LV.F8 P36B.bulk.5 every document submitted…", "LV.F8 P36B.bulk.6 mixed docstatus…", "LV.F8 P36B.bulk.7 a draft that fails validation…", "LV.F8 P36B.bulk.9 the SERVER refuses…", "LV.F8 P36B.bulk.14 List view (header default)…" | `#p36b-bulk` | simulator | (P36) partial failure keeps the selection (Desk throws before `done`, bulk_operations.js:286-298). (P36b) also in the Report view (`FrappeReportView bulk`, report_view.js:9, 360, 371-374); the outcome line adds Desk's "Cannot submit {names}." (bulk_operations.js:286-298); the simulator's built-in `submit_cancel_or_update_docs` now follows bulk_update.py:51-114 (drafts only, unknown name fails the request, 20–500 queued, > 500 refused) |
| LV.F9 | Cancel | PARTIAL | **COMPLETE** | Frappe | `FrappeBulkActions.tsx` | flp "LV.F9 Cancel: click → confirmation → submit_cancel_or_update_docs(action: cancel)…"; (P36) flp LV.F9 ported to the header default; lsd "LV.F9 Cancel queued by the server (no answer): the selection STAYS and nothing reloads…"; (P36b) bk "LV.F8 / LV.F9 P36B.bulk.2 …", "LV.F9 P36B.bulk.8 Cancel: the submitted one linked from a submitted Payment is refused…", "LV.F9 P36B.bulk.10 queued (20 names or more…)" | `#p36b-bulk` | simulator | (P36) a queued job keeps the selection, no reload (bulk_operations.js:300-303). (P36b) also in the Report view; "Cannot cancel {names}."; built-in simulator cancels submitted documents only — the submitted back-link refusal (`check_no_back_links_exist`) is in the opt-in `bulkUpdateHandler`, not the built-in |
| LV.F10 | Delete | COMPLETE | COMPLETE | Frappe | `bulk.ts` | FL; FLH; LIO; RK; P27; (P36) lsd "LV.F10 Delete: dismissing the confirmation keeps the selection; confirming clears it and reloads", "LV.F10 a refused Delete (403) keeps the selection and does not reload…" | `#frappe-list-view` | simulator | failures arrive as a realtime msgprint |
| LV.F11 | Workflow bulk actions | COMPLETE | COMPLETE | Frappe | `workflowBulk.ts` | LA; FLH; RK; (P36) lsd "LV.F11 a workflow action keeps the selection (Desk: no done…) and the list reloads" | `#frappe-list-view` | simulator | (P36) keeps the selection (Desk has no `done`, list_view.js:1802-1826); the package reloads because realtime is paused while rows are selected |
| LV.F12 | Permission-aware menu | COMPLETE | COMPLETE | Frappe | `bulk.ts`; `FrappeListView.tsx` | FL; LA; FLH; P27; (P36) lsd "LV.F12 System Manager, submittable: Edit, Export, …", "LV.F12 a Reader: Export + the read-level actions…", "LV.F12 no session roles: only Export…" (header default); (P36b) bk "LV.F12 P36B.bulk.3 permissions: no submit / cancel right → neither offered…", "LV.F12 P36B.bulk.4 an active Workflow hides Submit / Cancel…" (Report view) | `#frappe-list-view`, `#p36b-bulk` | unit, simulator | (P36b) the Report view uses the same gates (`listActionsMenu`, shared through `useFrappeSelectionActions`) |
| LV.F13 | Destructive confirmation | COMPLETE | COMPLETE | Frappe + Core | `FrappeBulkActions.tsx` | FL; FLH; LA; LSH; flp LV.F8 / LV.F9 (texts now rendered) | — | simulator | — |
| LV.F14 | UI keys → document names | COMPLETE | COMPLETE | Frappe | `FrappeListView.tsx`; (P36b) `list/useFrappeSelectionActions.tsx` (`documentNamesForKeys`, `uniqueNames`) | RK; (P36b) bk "P36B.bulk.11 Report rows repeated per child-table row: a document checked on two rows is sent ONCE and counted once" | — | simulator | (P36b) **deviation from Desk:** the Report view sends a document shown on several child rows once (Desk sends one name per checked row, report_view.js:1339-1352, and the server then reports the second copy as failed) |
| LV.F15 | Selection across filters / pages | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts` | L; F; RK | — | unit, simulator | (P36) header mode (the default) resolves the selected rows across pages (`rowByKey`); opt-in `selectionMode="bar"` still passes current-page rows only |
| LV.F16 | Header selection mode | COMPLETE | COMPLETE | Core + Frappe | `ListView.tsx`; `FrappeListView.tsx` | LSH; FLH; (P36) lsd "LV.F16 no selectionMode prop: 'Add ToDo' ↔ Actions in the same header slot; no bar…"; LSH "LV.F16 default (no selectionMode)…", "LV.F16 clearing the selection restores the primary action…", "LV.F16 Ctrl/⌘-click on a row ticks it…", "LV.F16 Escape closes the Actions menu and keeps the selection…", "LV.F16 renderBulkActions content sits in the toolbar…" | `#frappe-list-view` | unit, simulator | (P36) resolved: `"header"` is the default (owner decision P36-1); `"bar"` is an explicit opt-in (not Desk). Not reproduced: Shift+↑/↓ and drag-select |
| LV.F17 | Empty selection | COMPLETE | COMPLETE | Core | `ListFooter.tsx` | LSH; (P36) LSH "LV.F17 empty selection: the primary action, never an Actions trigger…", "LV.F17 the select-all box: checked only when every row is…" | — | unit | (P36) with rows selected and no applicable action, Actions still replaces the primary action and shows a disabled "No actions available for the selection" (Desk list_view.js:1634); a partial select-all is indeterminate (Desk: unchecked) — deliberate a11y divergence |
| LV.F18 | Outcome reporting | COMPLETE | COMPLETE | Frappe | `FrappeBulkActions.tsx` | LIO; LA; (P36b) bk "LV.F8 P36B.bulk.6 mixed docstatus… the message names…", "P36B.bulk.13 Arabic: Desk's failure sentence in the ar catalogue" | `#frappe-list-view` | simulator | `role=status` line, not a toast. (P36b) Submit / Cancel failures add Desk's sentence "Cannot submit {names}." / "Cannot cancel {names}." to the line; Desk shows it in an error dialog and does not refresh |
| LV.F19 | Every bulk write on a real site | BLOCKED | BLOCKED | Frappe | — | — | — | — | needs an approved real site |

### LV.G. Create & Quick Entry

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.G1 | "+ Add {DocType}" button | PARTIAL | **COMPLETE** | Frappe | `FrappeListView` `create` (gated by level-0 create; default dialog = `FrappeQuickEntry`) | lint "LV.G1 LV.G8 FV.F6 create={{}} on a Quick Entry DocType opens FrappeQuickEntry; saving inserts the Note and reloads the list", "LV.G1 a DocType that is not Quick Entry eligible goes to the host's full form…", "LV.G1 negative: an app render / onCreate still wins, and a Reader (no create right) gets no Add button"; flp "LV.G1 …" ×3 | `#p35-list` | simulator | shown only when `create` is passed |
| LV.G2 | Empty-state "Create your first…" | PARTIAL | **COMPLETE** | Frappe | `FrappeListView` | flp "LV.G2 the empty-state 'Create your first …' only with the create right" | `#p35-list` | simulator | **behaviour change**: gated by the create right |
| LV.G3 | Quick Entry dialog | MISSING | **COMPLETE** | Frappe | `FrappeQuickEntry` (Dialog over `FrappeFormView`), default for `FrappeListView create` | lint "LV.G1 LV.G8 FV.F6 create={{}} on a Quick Entry DocType opens FrappeQuickEntry…"; fqe "FV.F6 shows only the quick-entry fields, saves through savedocs…" | `#frappe-form-p35`, `#p35-list` | simulator | saves through `savedocs` (Desk: `frappe.client.save`); no Submit step |
| LV.G4 | Metadata-driven QE fields | MISSING | **COMPLETE** | Frappe | `m/quickEntry.ts` `quickEntryFields`, `quickEntryFilter` | fqe "FV.F6 real 15.110 metas: ToDo / Note / User eligible…", "FV.F6 the field rule…" | — | unit (recorded-real metas as input) | 15.110 never applies the "too many fields" limit; the port keeps that |
| LV.G5 | Required-field handling in QE | MISSING | **COMPLETE** | Frappe | `FrappeQuickEntry` → `FrappeFormView` mandatory check | fqe "FV.F6 the form's mandatory check runs: Save with an empty required field opens Missing Fields, nothing is sent" | — | simulator | — |
| LV.G6 | Link "Create a new X" | PARTIAL | **COMPLETE** | Frappe | `FLF`; `useQuickEntryHost` | fqe "FV.F6 FrappeForm: typing in a Link to a quick-entry DocType offers Create; saving it sets the Link"; ffp "FV.F6 'Create a new Contact'…" | `#frappe-form-p35` | simulator | — |
| LV.G7 | Client validation in QE | MISSING | **COMPLETE** | Frappe | `FrappeQuickEntry` (same save pipeline as the form) | fqe "FV.F6 the form's mandatory check runs…" | — | simulator | only the mandatory step is asserted inside the dialog; `validate` / `depends_on` are covered by the form tests |
| LV.G8 | Save → refresh list / redirect | MISSING | **COMPLETE** | Frappe | default create: `FrappeQuickEntry onCreated` → `invalidateFrappeList` + close | lint "LV.G1 LV.G8 FV.F6 create={{}} on a Quick Entry DocType opens FrappeQuickEntry; saving inserts the Note and reloads the list"; flp "LV.G1 … onCreated reloads the list and closes" | `#p35-list` | simulator | routing to the new document is the app's |
| LV.G9 | Full-form fallback ("Edit Full Form") | PARTIAL | **COMPLETE** | Frappe | `create.onOpenFullForm`; `FrappeQuickEntry onOpenFullForm`; `FrappeForm onOpenFullForm` | lint "LV.G1 'Edit Full Form' in the default Quick Entry hands the typed document to onOpenFullForm and closes", "LV.G1 a DocType that is not Quick Entry eligible goes to the host's full form with an unsaved new document (no dialog)"; fqe "FV.F6 'Edit Full Form'…" | `#frappe-form-p35` | simulator | without `onOpenFullForm`, a non-eligible DocType shows the whole form in the dialog (Desk would route) |

### LV.H. View switcher

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.H0 | View switcher | MISSING | **COMPLETE** | both | Core `ViewSwitcher`, `switcherOptions`; Frappe `availableViews`, `FrappeViews` (List view `onQueryStateChange` carries filters / sort) | vsw "LV.H0 offers only available, implemented views…", "LV.H0 a bare DocType…"; fvh "LV.H0 showUnavailable lists the rest disabled; filters carry from the Report view into the Kanban view"; lint "LV.H0 onQueryStateChange reports the applied filters and sort", "LV.H0 filters applied in the List view reach the Report view after switching" | `#frappe-views` | unit, simulator | — |
| LV.H1 | Report view | MISSING | **PARTIAL** | Frappe (+Core ListView) | `FrappeReportView` (`editable` prop: `"desk"` default / `"strict"` / function), `report.ts` (`isCellEditable`, `deskCanWrite`, `evaluateReportReadOnlyDependsOn`, `isNonStdField`, `rowFromSavedDoc`, `columnTotals`); (P36b) `bulk` prop (Desk's Actions on checked rows) | fvr "LV.H1 column picker lists every field incl. child-table fields…", "LV.H1 inline edit → frappe.client.set_value…", "LV.H1 a refused save keeps the editor open…", "LV.H1 without write permission (Reader) no cell is editable", "LV.H1 totals row…", "LV.H1 group by (loaded rows)…", "LV.H1 child columns are requested as Desk's report view does…"; (P36, 26 LV.H1 tests in fvr) "LV.H1 DocType WITHOUT a Table field: a plain field IS editable…", "LV.H1 DocType WITHOUT a Table field: read_only_depends_on evaluating false → editable, true → not editable…", "LV.H1 DocType WITH a Table field: a plain field is editable and read_only_depends_on is NOT evaluated…", "LV.H1 write right = Desk's can_write…", "LV.H1 child-table cells: Boolean(name && is_editable)…", "LV.H1 DocType with a Table field: a child cell is edited through set_value on the CHILD row…", "LV.H1 submittable DocType without a Table field (report_view.js's Cypress case)…", "LV.H1 opt-in editable=\"strict\"…", "LV.H1 opt-in editable={fn}…", "LV.H1 an unchanged value sends no request…", "LV.H1 rowFromSavedDoc…"; (P36b) bk "P36B.bulk.1 without `bulk` the Report view is unchanged…", "LV.F8 / LV.F9 P36B.bulk.2 Report view…", "P36B.bulk.11 Report rows repeated per child-table row…", "P36B.bulk.15 FrappeViews `bulk` reaches the Report view…" | `#frappe-views`, `#p36b-bulk` | simulator | no `save_report`, SQL aggregate group-by, charts, multi-sort; editors only for `INLINE_EDIT_TYPES` (Desk edits any fieldtype); child-column row shape and `set_value` on a child row unverified on a site. (P36) editability = Frappe 15.110 by default (owner decision P36-5), child cells editable. (P36b) `bulk` (opt-in) gives the Report view Desk's whole Actions menu incl. Submit / Cancel; still PARTIAL for the reasons above |
| LV.H2 | Kanban | MISSING | **COMPLETE** | both | Core `KanbanBoard`; `FrappeKanbanView`, `kanban.ts` | fvk "LV.H2 columns with counts…", "LV.H2 keyboard: Move to… menu and Alt+Arrow…", "LV.H2 drag and drop…; a rejected move is taken back…", "LV.H2 board mode…", "LV.H2 moving a card → update_order_for_single_card…", "LV.H2 group mode (no board)…", "LV.H2 filters shared… read-only without write permission" | `#frappe-views` | simulator | no board creation, column add / archive, Kanban Settings; Kanban Board API approximated by the simulator; WS4 proposed BLOCKED — reclassified |
| LV.H3 | Calendar | MISSING | **PARTIAL** | both | Core `CalendarMonth`; `FrappeCalendarView` | fvc "LV.H3 monthGrid…", "LV.H3 events on each day they cover…", "LV.H3 Arabic / RTL…", "LV.H3 reportview with the visible range…", "LV.H3 get_events source…", "LV.H3 an explicit field map…" | `#frappe-views` | unit, simulator | month view only; no week / day view, no event drag (`update_event`), no TZ conversion; reportview mode drops rows without an end date |
| LV.H4 | Gantt | MISSING | MISSING | — | — | vsw "LV.H0 … not implemented here (never available)" | `#frappe-views` (marked missing) | — | see LIMITATIONS: configuration is app JavaScript + a Gantt renderer |
| LV.H5 | Image | MISSING | **COMPLETE** | both | Core `ImageGrid`, `ImageView`; `FrappeImageView` | fvi "LV.H5 image or initials, title, detail…", "LV.H5 loading skeleton…", "LV.H5 requests the image_field + title_field…", "LV.H5 filters shared…", "LV.H5 paging…", "LV.H5 a server error…" | `#frappe-views` | unit, simulator | no gallery / zoom, no like heart; Attach Image read is simulator-only |
| LV.H6 | Dashboard | MISSING | MISSING | — | — | — | `#frappe-views` (marked missing) | — | needs Dashboard Chart / Number Card documents |
| LV.H7 | Map | MISSING | MISSING | — | — | — | `#frappe-views` (marked missing) | — | needs a map library and tiles |
| LV.H8 | Tree | MISSING | MISSING | — | — | vsw "LV.H0 is_tree … never available" | `#frappe-views` (marked missing) | — | tree settings are app JavaScript; no tree UI |
| LV.H9 | Inbox | MISSING | MISSING | — | — | — | `#frappe-views` (marked missing) | — | Communication / Email Account only |

### LV.I. Count & pagination

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.I1 | Total count (1001 cap → "1,000+") | COMPLETE | COMPLETE | Frappe | `reportview.ts`; `useFrappeList.tsx` | FL; PL; F; SR | `#frappe-list-view` | unit, recorded-real | — |
| LV.I2 | `disable_count` | COMPLETE | COMPLETE | Frappe | `useFrappeList.tsx` | FL | — | unit | — |
| LV.I3 | Pager | COMPLETE | COMPLETE | Core | `ListFooter.tsx` | L | List View | unit | — |
| LV.I4 | Page-size choice (20 / 100 / 500 / 2500) | MISSING | **COMPLETE** | Core + Frappe | `ListPagination pageSizes`; `useListState().setPageSize`; `DESK_PAGE_SIZES` | lp "LV.I4 choosing a page length shows that many rows…", "LV.I4 negative control…"; flp "LV.I4 Desk's 20 / 100 / 500 / 2500 by default…" | `#p35-list` | unit, simulator | **behaviour change**: FrappeListView shows the picker by default (`pageSizes={[]}` hides) |
| LV.I5 | "Load more" | PARTIAL | PARTIAL | Core + Frappe | `ListView.tsx` | L; F | `#frappe-list-view` | unit | grouped mode only; ungrouped lists page |
| LV.I6 | Empty states | COMPLETE | COMPLETE | Core + Frappe | `ListView.tsx`; `FrappeListView.tsx` | L; FL | `#frappe-list-view` | unit | — |
| LV.I7 | Filter / search change → page 1 | COMPLETE | COMPLETE | Core + Frappe | `useListState.ts` | L; F | — | unit | — |
| LV.I8 | After mutations (invalidate) | COMPLETE | COMPLETE | Frappe | `FrappeBulkActions.tsx`; `useFrappeList.tsx` | FL; F; LK | `#frappe-list-view` | unit, simulator | — |
| LV.I9 | Distinct count with child filters | COMPLETE | COMPLETE | Frappe | `query.ts` | PL; FL | — | unit | — |

### LV.J. List menu (⋯)

| id | Requirement | Baseline | Now | Layer | Location | Test evidence | Showcase | Evidence level | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| LV.J1 | Import | COMPLETE | COMPLETE | Frappe | `FrappeListView.tsx` | LIO; P27 | `#frappe-import-export` | simulator | real import not run |
| LV.J2 | Export in the menu | COMPLETE | COMPLETE | Frappe | `FrappeListView.tsx` | LIO | `#frappe-import-export` | simulator | real `download_template` not run |
| LV.J3 | "Export as report" (opt-in) | COMPLETE | COMPLETE | Frappe | `FrappeListView.tsx` | LIO; LQ | — | simulator | writes an Access Log on a site |
| LV.J4 | User Permissions | MISSING | **COMPLETE** | Frappe | `menu.userPermissions`; `userPermissionsUrl` | flp "LV.J4 / LV.J5 / LV.J6 / LV.J11 a System Manager gets User Permissions, Role Permissions Manager, Customize, List Settings…", "LV.J4 negative controls…" | `#p35-list` | simulator | **behaviour change**: four more entries for System Managers (default on) |
| LV.J5 | Role Permissions Manager | MISSING | **COMPLETE** | Frappe | `menu.rolePermissions`; `rolePermissionsUrl` | flp (same) | `#p35-list` | simulator | — |
| LV.J6 | Customize | MISSING | **COMPLETE** | Frappe | `menu.customize`; `customizeUrl` | flp (same); "LV.J6 Customize on a custom DocType opens the DocType form…" | `#p35-list` | simulator | — |
| LV.J7 | List Settings (write) | MISSING | **COMPLETE** | Frappe | `FrappeListSettingsDialog` → `save_listview_settings` | flp "LV.J7 List Settings: remove / add fields and a check → save_listview_settings with Desk's arguments…" | `#p35-list` | simulator | write approximated by the simulator; WS3 proposed BLOCKED — reclassified |
| LV.J8 | Toggle Sidebar | MISSING | **COMPLETE** | Frappe | menu entry with `sidebar` | flp "LV.J8 'Toggle Sidebar' in the list menu hides and shows it…" | `#p35-list` | simulator | no Ctrl+K shortcut |
| LV.J9 | "Edit DocType" | MISSING | MISSING | — | — | none | — | — | needs `developer_mode` in the session |
| LV.J10 | Permission-aware menu | COMPLETE | COMPLETE | Frappe | `FrappeListView.tsx`; `services/permissions.ts` | LIO; P27; flp "LV.J4 negative controls…" | — | simulator, recorded-real (roles replay) | — |
| LV.J11 | Navigation from menu entries | PARTIAL | **COMPLETE** | Frappe | `onNavigate(url, entry)` | flp "LV.J4 / LV.J5 / LV.J6 / LV.J11 …each navigates to Desk's route", "LV.J6 … Import goes through onNavigate too" | `#p35-list` | simulator | — |

## 5. Needs real-site validation

COMPLETE rows whose essential behaviour is a server write, a server aggregate or a response shape that no recorded real
response covers. Derivation: every COMPLETE row whose cited test reaches a write method (`savedocs`, `cancel`, `delete`,
`rename_doc`, `set_value`, `client.insert`, `user_settings.save`, `assign_to.*`, `add_tags`, `bulk_*`, `toggle_like`,
Data Import) or a P35 simulator handler (`src/frappe/testing/handlers/*.ts`: `get_group_by_count`, `get_sidebar_stats`,
`save_listview_settings`, `get_open_count`, `communication.email.make`, `get_email_template`, `get_html_and_style`,
`create_new_reminder`, `kanban_board.*`, `calendar.get_events`), plus the two reads whose response shape was built in the
test. **62 rows.** The BLOCKED rows (FV.I9, FV.L7, LV.A6b, LV.C14, LV.F19) and the PARTIAL rows with server paths
(LV.H1 child columns + `set_value`, LV.H3 `get_events`, LV.D11 `user_settings.group_by_fields`, FV.L3 `download_pdf`)
come on top.

| Row | Requirement | Since | Server method(s) | Evidence level | What the simulator / test does not prove |
|---|---|---|---|---|---|
| FV.A20 | Attach | baseline | `upload_file` | simulator | size limits, `max_attachments`, private/public File rules |
| FV.A21 | Attach Image | baseline | `upload_file` | simulator | as A20; image handling |
| FV.A43 | Validation & error messages (server errors on fields) | P35 | `savedocs` → MandatoryError / LinkValidationError | simulator (MandatoryError body shaped in the test), unit | the MandatoryError body is shaped in the test (document.py:963, base_document.py:758); message wording on translated sites |
| FV.D9 | Server authoritative | baseline | server refusals (simulated permission engine) | simulator | real DocPerm / User Permission / sharing evaluation |
| FV.F6 | Create new linked doc | P35 | `savedocs` (Quick Entry insert) | simulator (+real metas) | naming, server validation, Desk uses `frappe.client.save` |
| FV.F10 | Link titles (show_title_field_in_link) | P35 | `getdoc` `_link_titles` (read) | simulator (getdoc `_link_titles` shaped in the test per load.py) | the response key is shaped in the test per load.py:62, 425-480 |
| FV.G12 | Parent-child save | baseline | `savedocs` with child rows | simulator | child naming / idx on the server |
| FV.H1 | Save | baseline | `savedocs` Save | simulator (+real meta) | timestamps, naming, server hooks |
| FV.H3 | Submit | baseline | `savedocs` Submit | simulator | queued submit, `on_submit` hooks |
| FV.H4 | Update (allow_on_submit) | P35 | `savedocs` Update | simulator | allow_on_submit validation on the server |
| FV.H5 | Cancel (+ Cancel All) | baseline | `frappe.desk.form.save.cancel`, `get_submitted_linked_docs`, `cancel_all_linked_docs` | simulator | linked-doc graph and cancel cascade |
| FV.H6 | Amend | baseline | `savedocs` (amendment), `is_document_amended` | simulator | `amended_from` naming (`-1`, `-2`) |
| FV.H11 | Duplicate-submit prevention | P35 | `savedocs` | simulator | — |
| FV.H13 | Ctrl/⌘+S | P35 | `savedocs` via Ctrl/⌘+S | simulator | — |
| FV.I1 | Action buttons | baseline | `apply_workflow` | simulator, unit | a real Workflow (FV.I9 stays BLOCKED) |
| FV.I2 | Approve / Reject / custom actions (+ Desk pre/post steps) | P35 | `apply_workflow` (+ client pre/post steps) | simulator | transition `condition`s |
| FV.I4 | State refresh after apply | baseline | `apply_workflow` response | unit | docstatus changes made by the transition |
| FV.K6 | Duplicate | P35 | `savedocs` (insert of the local copy) | simulator | naming of the new document, `no_copy` handling on the server |
| FV.K8 | Rename | P35 | `frappe.rename_doc` | simulator | merge, link updates, queued rename |
| FV.K9 | Delete | P35 | `frappe.client.delete` | simulator | link checks (LinkExistsError), `on_trash` |
| FV.K13 | Remind Me | P35 | `create_new_reminder` | simulator | Reminder notification delivery |
| FV.L1 | Format selector | P35 | getdoctype `__print_formats`, Letter Head list | simulator | site print formats |
| FV.L2 | Preview | P35 | `frappe.www.printview.get_html_and_style` | simulator (placeholder HTML) | real rendering — the simulator returns placeholder HTML |
| FV.L5 | Loading / errors | P35 | `get_html_and_style` refusals, Print Settings | simulator | stored Print Settings on a site |
| FV.L6 | Server rendering | P35 | `get_html_and_style` | simulator | as L2 |
| FV.M3 | Counts (`get_open_count`) | P35 | `frappe.desk.notifications.get_open_count` | simulator | count semantics (`frappe.get_all`, no permission filter), 1 s timeout, `override_doctype_dashboards` |
| FV.M4 | Navigation | P35 | `get_open_count` + list navigation | simulator | as M3 |
| FV.M6 | Permission-aware | P35 | `get_open_count` READ check | simulator | as M3 |
| FV.O3 | Templates (Email Template) | P35 | `get_email_template` | unit, simulator | Jinja rendering |
| FV.O8 | Server integration (`communication.email.make`) | P35 | `frappe.core.doctype.communication.email.make` | simulator | actual sending, Email Account choice, `send_me_a_copy`, read receipts |
| FV.O9 | Errors | P35 | `email.make` refusal | unit, simulator | as O8 |
| FV.P3 | Route / URL | P35 | `__onload.is_website_generator`, `route` | simulator | website routes / publication on a site |
| LV.C7 | Saved filters (save / apply / delete) | baseline | `frappe.client.insert` / `frappe.client.delete` (List Filter) | unit, simulator | List Filter permissions (LV.C14 stays BLOCKED) |
| LV.C8 | Per-user saved filters | baseline | List Filter `for_user` | unit | as C7 |
| LV.C9 | Public / shared ("Is Global") | P35 | List Filter insert with `for_user = ''` | unit, simulator | who may create / delete global filters |
| LV.C12 | Duplicate filter name rejected | baseline | List Filter insert (duplicate) | unit | server-side duplicate rule |
| LV.D6 | Sidebar group-by with server counts | P35 | `frappe.desk.listview.get_group_by_count` | simulator | SQL aggregate, permission filtering, child-table conditions — the simulator handler uses a local matcher without them |
| LV.D7 | Sidebar tag stats | P35 | `frappe.desk.reportview.get_sidebar_stats` | simulator | as D6 |
| LV.E5 | Like heart | baseline | `frappe.desk.like.toggle_like` | unit, simulator | — |
| LV.E8 | Realtime refresh | baseline | `list_update` realtime event | simulator (fake port) | socket delivery and room joins (fake port only) |
| LV.F1 | Edit (typed value control) | P35 | `submit_cancel_or_update_docs` (update) | simulator | per-document failures |
| LV.F3 | Assign To | baseline | `assign_to.add_multiple` | simulator, unit | assignment rules, notifications |
| LV.F4 | Clear Assignment | baseline | `assign_to.remove_multiple` | simulator | — |
| LV.F5 | Apply Assignment Rule | baseline | `assignment_rule.bulk_apply` | simulator | rule evaluation |
| LV.F6 | Add Tags | baseline | `tag.add_tags` | simulator | — |
| LV.F7 | Print | baseline | `download_multi_pdf(_async)` | simulator | PDF output, `task_complete` |
| LV.F8 | Submit | P35 | `submit_cancel_or_update_docs` (submit) | simulator | per-document failures (realtime msgprint); (P36b) `queue_in_background` / Submission Queue, the 20–500 background job with a running worker, controller validations — the built-in simulator now follows bulk_update.py's eligibility and thresholds |
| LV.F9 | Cancel | P35 | `submit_cancel_or_update_docs` (cancel) | simulator | as F8; (P36b) back links: Dynamic Link / Single not simulated |
| LV.F10 | Delete | baseline | `reportview.delete_items` | simulator | failures arrive as a realtime msgprint |
| LV.F11 | Workflow bulk actions | baseline | `bulk_workflow_approval` | simulator | transition conditions, queueing ≥ 20 |
| LV.F13 | Destructive confirmation | baseline | bulk writes after confirmation | simulator | as F8–F10 |
| LV.F18 | Outcome reporting | baseline | bulk write responses | simulator | as F8–F10 |
| LV.G1 | "+ Add {DocType}" button | P35 | `savedocs` through the create dialog | simulator | as FV.F6 |
| LV.G3 | Quick Entry dialog | P35 | `savedocs` (Quick Entry) | simulator | as FV.F6 |
| LV.G8 | Save → refresh list / redirect | P35 | `savedocs` then list reload | simulator | as FV.F6 |
| LV.H2 | Kanban | P35 | `get_kanban_boards`, `frappe.client.get` (Kanban Board), `update_order_for_single_card`, `frappe.client.set_value` | simulator | board order with a filtered list (the server pops `old_index` blindly, kanban_board.py:147-151) |
| LV.H5 | Image | P35 | `reportview.get` with the `image_field` column (read) | unit, simulator | no recorded response includes an Attach Image column |
| LV.I4 | Page-size choice (20 / 100 / 500 / 2500) | P35 | `frappe.model.utils.user_settings.save` (`List.sf_ui.pageSize`) | unit, simulator | whether Desk's merge keeps `sf_ui` (LV.A6b) |
| LV.J1 | Import | baseline | Data Import (insert, `form_start_import`, status, logs) | simulator | every step is a write |
| LV.J2 | Export in the menu | baseline | `download_template` | simulator | unapproved read on the shared site |
| LV.J3 | "Export as report" (opt-in) | baseline | `export_query` | simulator | writes an Access Log |
| LV.J7 | List Settings (write) | P35 | `list_view_settings.save_listview_settings` | simulator | Property Setter side effects on a site |

## 6. New features implemented (P35)

Every item below is additive (no export removed or renamed — diff of `src/index.ts`, `src/frappe/index.ts`, `src/fields/index.ts`,
`src/record/index.ts`, `src/frappe/{form,record,form/model}/index.ts` between `0ef45c1` and `e6e4dd2` shows additions only;
the integration export snapshot of the built `dist/*.d.ts` confirms **0 removed exports** against 0.6.0 and 66 widened
signatures — CHANGELOG.md lists the ones a consumer could notice).
Component docs: `docs/components/forms.md` (WS1), `record.md` §5 (WS2), `list.md` (WS3), `views.md` (WS4), `p35-core.md` (WS5).

| # | Feature (rows) | Previous gap | Architectural decision | Public API | Files | Tests | Showcase |
|---|---|---|---|---|---|---|---|
| 1 | Desk-native fixes (C-native F1–F6, F8) (FV.H13, I2, F10, F6, F8, H4, H14, H6) | Ctrl+S saved instead of running the primary action; workflow apply skipped mandatory + before/after events; getdoc `_link_titles` dropped; Link create/open not permission-aware; Update + Cancel on a dirty submitted doc; no in-app unsaved guard; Amend without create; copies not from defaults | Follow Desk's source line by line (cited in code); document-level hotkey owned by the topmost form | `FrappeFormViewProps.hotkeys`, `FrappeWorkflowActionsProps.beforeApply/afterApply`, `FormController.selectedWorkflowAction/checkMandatory/save(action)`, `linkTitlesOf`, `LoadedDocWithTitles`, `FormServices.builtin`, `defaultLinkHref`, `useUnsavedChangesBlocker`, `copyDoc/amendDoc(…, { defaults })` | `FFV`, `FForm`, `FLF`, `services.tsx`, `events.ts`, `unsavedChanges.ts`, `m/actions.ts`, `m/copy.ts`, `client.ts`, `record/FrappeWorkflowActions.tsx` | `ffp` FV.H13 ×6, FV.I2 ×3, FV.F10 ×3, FV.F6, FV.F8, FV.H4, FV.H14 ×2, FV.H6, FV.K6, FV.I8, FV.B4 | `#frappe-form-p35` |
| 2 | Unsupported fieldtypes + Autocomplete (FV.A29–A31, A34, A35, A44, A45) | silent text box for unknown types; Autocomplete ignored `options` | Unsupported = raw value read-only + listed in the form's issues banner; Autocomplete on Core `LinkInput` | `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`, `FieldtypeIssue`, `autocompleteOptions` (FrappeField) | `FF`, `m/fieldtypes.ts`, `FFV` | `fft` (16) | — |
| 3 | Server errors on fields (FV.A43) | server MandatoryError / LinkValidationError shown only as a page error | Parse Frappe's exception field list / messages into a field map; clear on the field's next change | `fieldErrorsFromFrappeError`, `FieldErrorSource` | `m/errors.ts`, `FFV` | `ffp` FV.A43 ×3 | `#frappe-forms` save-error |
| 4 | Form slots, header image, See on Website (FV.J9, J10, P1–P4, B6; enables K3, M1) | no menu / extra-tab slot; no image_field; no website link | Fixed slot contract on `FrappeFormView` so record features plug in without editing the form | `menu`, `extraTabs`, `fieldFilter`, `buildLayout(meta, { isNew, fieldFilter })` | `FFV`, `m/layout.ts` | `ffp` FV.K3/K16, FV.M1 ×2, FV.B6, FV.J9 ×2, FV.P1–P4, FV.P2 ×2 | `#frappe-form-p35` |
| 5 | Quick Entry + Link "Create a new X" (FV.F6; LV.G3–G9) | no quick-entry dialog; create offered without rights | Literal port of quick_entry.js:59-110; dialog = `FrappeFormView` with `fieldFilter` (one save pipeline); saves through `savedocs` | `FrappeQuickEntry`, `useQuickEntryHost`, `quickEntryFields`, `quickEntryFilter`, `FrappeFormProps.onOpenFullForm` | `FrappeQuickEntry.tsx`, `m/quickEntry.ts`, `FForm` | `fqe` (9) | `#frappe-form-p35` |
| 6 | User defaults from boot (FV.E2, D8) | the app had to compute user defaults | Read `defaults` / `user_permissions` from the boot payload; since integration `FrappeProvider` applies them automatically | `FrappeBootPayload.defaults/user_permissions`, `FrappeBoot.userDefaults`, `userDefaultsFromBoot` | `services/boot.ts` | `ffp` FV.E2 ×2 | — |
| 7 | Undo / Redo (FV.K14) | not implemented | docStore history of user input only (base_control.js:220), erased on replace | `DocStore.undo/redo/canUndo/canRedo/eraseHistory`, `HistoryEntry`, `FormController.undo/redo` | `m/docStore.ts`, `FFV`, `events.ts` | `ffp` FV.K14 ×2 | `#frappe-form-p35` |
| 8 | Custom buttons / Create dropdown (FV.K1, K2) | apps rendered their own buttons | `frm.add_custom_button` semantics, cleared before every refresh | `FormController.addCustomButton/removeCustomButton/clearCustomButtons`, `CustomButton` | `events.ts`, `FFV` | `ffp` FV.K1 ×2 | `#frappe-form-p35` |
| 9 | Form ⋯ menu (FV.K3–K10, K12, K13, K15, K16) | no document menu | Core `RecordMenu` (generic, confirm via AlertDialog) + pure `formMenuItems` rule table in Desk order + `FrappeRecordMenu` | `RecordMenu`, `groupMenuItems`, `RenameDialog`, `ReminderDialog`; `formMenuItems`, `FORM_MENU_ORDER`, `printAllowedForStatus`, `customizeHref`, `FrappeRecordMenu`, `FrappeReminder` | `src/record/{RecordMenu,RenameDialog,ReminderDialog}.tsx`, `src/frappe/record/{formMenu.ts,FrappeRecordMenu.tsx,FrappeReminder.tsx}` | `ra`, `fra` (FV.K* tests) | `#frappe-record-actions` |
| 10 | Form print + preview (FV.K4, L1, L2, L5, L6; L3 partial) | list-only print | Server-rendered HTML in a sandboxed iframe (no scripts, no same-origin); PDF via `download_pdf` URL | `PrintPreviewFrame`, `printSrcDoc`; `FrappeFormPrint`, `FrappePrintPreview`, `printPreviewArgs`, `downloadPdfUrl`, `printViewUrl`, `downloadPdfArgs`, `parsePrintPreview` | `src/record/PrintPreviewFrame.tsx`, `src/frappe/record/{formPrint.ts,FrappeFormPrint.tsx,FrappePrintPreview.tsx}` | `ra` FV.L2; `fra` FV.L* | `#frappe-record-actions` |
| 11 | Connections (FV.M1–M6, K12) | not implemented | Parse `meta.__dashboard` (real 15.110 shapes) + `get_open_count`; Core panel is presentational | `ConnectionsPanel`; `connectionsFromMeta`, `connectionFilters`, `useOpenCounts`, `FrappeConnections` | `src/record/ConnectionsPanel.tsx`, `src/frappe/record/{connections.ts,useOpenCounts.ts,FrappeConnections.tsx}` | `ra` FV.M1, FV.M5; `fra` FV.M2–M6 | `#frappe-record-actions` |
| 12 | E-mail composer (FV.O1–O4, O6–O9) | not implemented | Core composer (no backend) + Frappe adapter with Desk's `email.make` arguments; docinfo re-read after send | `EmailComposer`, `isValidEmail`, `EmailDraft`; `FrappeEmailComposer`, `emailMakeArgs`, `emailDefaults` | `src/record/EmailComposer.tsx`, `src/frappe/record/{email.ts,FrappeEmailComposer.tsx}` | `ra` FV.O*; `fra` FV.O* | `#frappe-record-actions` |
| 13 | Workflow state in list indicator (LV.E3) | workflow only when the app passed it | Derived from getdoctype `__workflow_docs` by default; `workflow={false}` opts out | `indicatorWorkflowFromMeta`, `FrappeListOptions.workflow` | `list/indicator.ts`, `useFrappeList.tsx` | `flp` LV.E3 ×3 | `#p35-list` |
| 14 | Assigned To / Tags as fields (LV.B13, B14, D2–D4, E7) | `_assign` / `_user_tags` grouped as raw strings; no filters, no tag cell | Core multi-bucket grouping (`groupOf` may return several buckets); Frappe filter fields with `like` | `GroupBucket`, `FilterField.operators`; `TagsCell`, `parseTags` | `src/list/model/{group,filters}.ts`, `ListTable.tsx`, `meta.ts`, `list/cells.tsx` | `lp` LV.D2 ×2; `flp` LV.D2–D4, B13/B14, E7 | `#p35-list` |
| 15 | Group-by sidebar + tag stats + Toggle Sidebar (LV.D6, D7, J8; D11 partial) | no sidebar | Core presentational `GroupBySidebar` + `ListView aside`; Frappe hooks over Desk's methods; **opt-in** (`sidebar`) so default lists make no extra requests | `GroupBySidebar`, `ListViewProps.aside/asideOpen`, `ListActions.removeCondition/query`; `FrappeGroupBySidebar`, `useGroupByCounts`, `useTagStats`, `FrappeListViewProps.sidebar` | `src/list/parts/GroupBySidebar.tsx`, `src/frappe/list/FrappeGroupBySidebar.tsx`, `FrappeListView.tsx` | `lp` LV.D6 ×2; `flp` LV.D6 ×2, D7, D11, J8 | `#p35-list` |
| 16 | Add {DocType} + gated empty-state create (LV.G1, G2) | app-supplied button; empty-state create ungated | Desk's `can_create`; unknown roles hide it (rule 9) | `FrappeListViewProps.create`, `FrappeListCreate` | `FrappeListView.tsx` | `flp` LV.G1 ×3, LV.G2 | `#p35-list` |
| 17 | Page sizes, select all matching, phone cards (LV.I4; CRM G1, G3, G5) | fixed page size; no all-matching; table only on phones | Picker default-on in FrappeListView (Desk's sizes); all-matching runs only query-based actions | `ListPagination pageSize/pageSizes/onPageSize`, `useListState().setPageSize/allMatching/selectAllMatching`, `ListViewProps.pageSizes/selectAllMatching/layout`, `ColumnDef.mobile`, `BulkAction.allMatching`, `SelectionMatching`, `DESK_PAGE_SIZES` | `ListFooter.tsx`, `useListState.ts`, `ListTable.tsx`, `ListView.tsx`, `FrappeListView.tsx` | `lp` LV.I4 ×2, G5 ×2, G1 ×2; `flp` LV.I4, G5 | `#p35-list` |
| 18 | Saved filters: Is Global, delete confirm, duplicates (LV.C9, C11, C12) | all-or-nothing global flag; no confirm; local adapter replaced duplicates | Optional 4th `save` argument keeps the adapter contract compatible | `SavedFilter.global`, `SaveFilterOptions`, `SavedFiltersStorage.save(…, opts)`, `SavedFilters canSaveGlobal`, `ListViewProps.savedFiltersGlobal`, `actsAsSystemManagerFor` | `Toolbar.tsx`, `model/storage.ts`, `useListState.ts`, `list/storage.ts`, `services/permissions.ts` | `lp` LV.C9, C11, C12; `flp` LV.C9 ×2 | `#p35-list` |
| 19 | List menu entries + List Settings dialog (LV.J4–J7, J11) | "not reproduced by decision" | System-Manager gate as Desk; navigation through `onNavigate` | `menu.userPermissions/rolePermissions/customize/listSettings`, `onNavigate`, `userPermissionsUrl`, `rolePermissionsUrl`, `customizeUrl`, `FrappeListSettingsDialog`, `initialListSettingsFields` | `FrappeListView.tsx`, `list/FrappeListSettingsDialog.tsx` | `flp` LV.J4–J7, J11 | `#p35-list` |
| 20 | Bulk Edit typed value (LV.F1) | plain text input for every type | The field's own control (bulk_operations.js:381-404) | `BulkEditValue`, `bulkEditValue` | `list/FrappeBulkActions.tsx` | `flp` LV.F1 ×2 | `#p35-list` |
| 21 | View switcher + Report / Image / Kanban / Calendar (LV.H0–H3, H5) | List view only | Headless list state shared by every view (`useFrappeViewList`); switcher offers only implemented, available views | Core `ViewSwitcher`, `ViewToolbar`, `ImageGrid`, `ImageView`, `KanbanBoard`, `CalendarMonth` (+ helpers); Frappe `availableViews`, `FrappeViews`, `FrappeReportView`, `FrappeImageView`, `FrappeKanbanView`, `FrappeCalendarView`, `useFrappeViewList` | `src/list/views/*`, `src/frappe/views/*`, `testing/handlers/views.ts` | `vsw`, `fvh`, `fvr`, `fvi`, `fvk`, `fvc` (42) | `#frappe-views` |
| 22 | Core capabilities the CRM needed (D-crm N1–N11, A18) | see `CRM-MIGRATION.md` §4 | All optional props; without them the 0.6.0 markup renders (tested per gap) | `StatusBadge/StatusDot color`, `STATUS_PALETTE`, `resolveStatusColor`, `statusColorStyles`; `LifecycleStateItem.step`, `LifecycleStep`; `FileDropzone`; `SearchCombobox options/multiple/values/variant`; `TimelineItem.icon/tone`, `Timeline onItemSelect/showActor`; `Suggestion.group/icon`; `IconStatCard trend`; `EmptyState`; `RichTextEditorHandle`, `toolbarEnd`; `MonthInput`; `Stepper overflowCue/followCurrent`; `AssigneeGroup` description line | `src/primitives/*`, `src/record/*`, `src/fields/{FileDropzone,MonthInput,autocomplete}.tsx`, `src/cards/StatCard.tsx` | `tests/core-p35.test.tsx` (44, `CORE.*`) | `core-fields`, `file-dropzone`, `combobox-p35`, `empty-trend`, `record-p35`, `editor-stepper-p35`, `record-extras` |

| 23 | Integration: defaults and wiring (FV.K3–K6, K10, K12, K14–K16, M1, M3, E2, D8; LV.G1, G3, G8, G9, H0) | record features had to be mounted by the app; Duplicate could not open in the form; Quick Entry not the list default; List filters did not reach other views; user defaults manual; simulator handlers role-only | Defaults on with explicit opt-outs (`menu={false}`, `connections={false}`, `userDefaults={false}`); the menu gets the live form through `FrappeFormMenuContext`; docinfo passed only for the loaded name | `FrappeForm menu` / `connections`, `FrappeFormMenuOptions` (`onOpened`), `FrappeFormConnectionsOptions`, `FrappeFormMenuContext`; `FrappeListCreate.onOpenFullForm` / `defaults`; `FrappeListViewProps.onQueryStateChange`; `FrappeProviderProps.userDefaults`; `ColumnDef.status`; `FixtureContext` (testing) | `FForm`, `FFV`, `FrappeListView.tsx`, `views/FrappeViews.tsx`, `FrappeProvider.tsx`, `src/fields/TagInput.tsx`, `src/list/model/columns.ts`, `testing/fixtureTransport.ts`, `testing/handlers/*` | `tests/frappe-form-integration.test.tsx` (12), `frappe-list-integration.test.tsx` (6), `sim-context.test.tsx` (7), `core-integration.test.tsx` (3) | `#frappe-record-actions` (now FrappeForm's default menu + tab) |

## 7. Remaining gaps

### 7.1 Missing functionality (status MISSING)
- **Form:** FV.G9 grid CSV download / upload; FV.O5 e-mail preview.
- **List:** LV.B15 default 90-day recency filter on large tables; LV.E11 unseen rows in bold; LV.J9 "Edit DocType";
  LV.H4 Gantt, LV.H6 Dashboard, LV.H7 Map, LV.H8 Tree, LV.H9 Inbox (reasons: `docs/components/views.md` §7 — configuration
  that lives in app JavaScript or other server documents, extra libraries, low relevance).

### 7.2 Partial
- **Form:** FV.A5 Datetime (no TZ conversion while editing, seconds dropped) · A10 Currency (no symbol from `df.options`) ·
  A16 Markdown / A17 HTML Editor (no preview) · A18 Code (no syntax editor) · A29 Signature / A30 Geolocation / A31 Barcode /
  A35 Icon (read-only, no control) · A32 JSON (no validation) · A33 Phone (no country picker) · A40 Fold (no folding) ·
  A41 placeholders on non-Data controls · A42 required mark untested at FrappeField level · B4 `collapsible_depends_on`
  not recomputed on change · B7 no real-viewport e2e · C5 workflow-state mandatory expression untested · D4 create-only /
  write-only roles on a new doc untested · D8 search_link User Permission filtering is server-side and unverified · G10 attach in a row
  untested · J8 naming-series preview · L3 `download_pdf` not simulated.
- **List:** LV.B3 Date In / Not In · D11 sidebar "Edit" modal · E12 relative modified time · H1 Report (no `save_report`,
  aggregates, charts, multi-sort; child-cell edit added in P36) · H3 Calendar (month only) · I5 "Load more" only when grouped.

### 7.3 Backend-dependent
- BLOCKED: FV.I9 real Workflow · FV.L7 real print formats / letterheads · LV.A6b `user_settings` `List.sf_ui` merge ·
  LV.C14 List Filter permissions · LV.F19 every bulk write on a real site.
- The 62 rows of §5, plus the server sub-paths of LV.H1, H3, D11 and FV.L3.

### 7.4 Real-Frappe validation gaps
- No authenticated real-site session has been run (`e2e/frappe-site/` is prepared, never run). No write has been verified
  on a site. Restricted users, User Permissions and sharing were tested only on the simulator.
- Realtime: only a fake port (`createSocketRealtime` is a skeleton).
- Simulator fidelity limits found in P35 (test-fidelity, not product behaviour): the P35 list handlers use a local row
  matcher (no child-table conditions, no simulated permissions); `reportview.get` answers one row per parent for child
  columns and has no `aggregate_function`; `frappe.client.set_value` has no child-table branch (P36: the opt-in
  `reportSetValueHandler` in `src/frappe/testing/handlers/views.ts` adds it for the Report view tests; the builtin is
  unchanged); `download_pdf` is not
  simulated; print preview HTML is a placeholder. Since integration the P35 handlers use the transport's permission
  engine and row filter (`FixtureContext`, `tests/sim-context.test.tsx`); still not simulated: Communication Links, the
  engine for `get_kanban_boards` when the Kanban Board meta is not loaded, Kanban's `private` permission query.

### 7.5 Known bugs and deviations
- Fixed by integration: `TagInput` no longer keeps its "No results" list open after Enter / comma creates a tag
  (`CORE.M7 …`, `tests/core-integration.test.tsx`); `ListView` status cells render a configured colour through
  `ColumnDef.status` (`CORE.G17 …`).
- Form menu: Rename / Delete do not re-route — the host routes with `onRenamed` / `onDeleted`; Duplicate / New open a local
  document in FrappeForm state (a remount or a `name` change drops it, as for Amend).
- `FrappeListView create` without `create.onOpenFullForm`: a DocType that is not Quick Entry eligible shows the whole form
  in the Quick Entry dialog (Desk routes to the full form).
- **DataGrid** has a fixed `min-w-[32rem]`: on a 390 px phone it scrolls horizontally (blocked the CRM M10 migration).
  **(P36)** Unchanged and accepted by the owner for now: no card layout, horizontal scrolling on phones (a card layout
  built in P36 W3 was reverted in batch 2). CRM M10 stays not migrated (`CRM-MIGRATION.md` §5.3).
- **Kanban** with a filtered list: `update_order_for_single_card` pops `old_index` blindly (kanban_board.py:147-151) and
  can move a different name — Desk behaves the same; documented in `views.md` §5.
- **Report view** inline edit deliberately does not reproduce report_view.js:772-777 (see `views.md` §3), so the package
  allows editing on DocTypes Desk 15.110 would leave read-only — owner decision recorded in `CRM-MIGRATION.md` §5.5.
  **(P36) Superseded, and the premise was wrong:** Desk 15.110 does NOT leave plain fields read-only on a DocType without a
  Table field (`is_editable` returns the falsy `read_only_depends_on`, and frappe-datatable blocks editing only on
  `=== false`; Frappe's own Cypress `report_view.js` edits such a field). The package now follows 15.110 by default
  (`editable="desk"`); `"strict"` is an opt-in (`views.md` §3, `CRM-MIGRATION.md` §5.5).
- **Quick Entry** saves through `savedocs`; Desk uses `frappe.client.save` and offers Submit after saving a submittable DocType.
- `emailMakeArgs` always sends `print_letterhead: 1` (Desk reads a checkbox).
- `buildListRequest` drops Attach Image fields; the views add `image_field` through `extraFields`.
- C-native F9 is still open: no *source* boundary rule forbids `src/frappe/**` from importing `./testing` (the dist rule
  exists but needs a build).
- `selectionMode` default is still `"bar"` although header mode is the Desk-like layout (owner decision).
  **(P36) Resolved:** `"header"` is the default; `"bar"` is an explicit opt-in (LV.F16).

### 7.6 Future enhancements
Report Builder (`save_report`, aggregates, charts) · Kanban board creation / column editing / settings · Calendar week and
day views, event drag, Calendar View documents · Gantt / Tree / Dashboard adapters · Datetime TZ while editing · Markdown /
HTML previews, signature pad, JSON validation · sidebar "Edit" modal and "assigned to me" · rename title path
(`update_document_title`) · e-mail preview, schedule, signature, reply-all · Quick Entry Submit step · filters carried from
an export-list snapshot gate in CI (the integration snapshot script exists in the session scratchpad only).

## 8. P36 changes (0.7.0-dev.2)

**No status, denominator, evidence level or requirement text changed** — totals in §2 stand (258 / 301). P36 edited the
Test evidence and Known limitations cells (and, for LV.H1, the Location cell) of the rows below. Every new test is jsdom /
simulator evidence; none ran against a site. Owner decisions P36-1 … P36-5 and the workstreams: `docs/audit/p36/README.md`.

| Row | P36 change | Why | Evidence added |
|---|---|---|---|
| LV.F16 | limitation "default is still `"bar"` (owner decision pending)" → resolved | owner decision P36-1: Desk's header actions are the default for `ListView` and `FrappeListView`; `"bar"` is opt-in | `lsd` LV.F16; LSH LV.F16 ×5 (default, restore, Ctrl/⌘-click, Escape, `renderBulkActions`) |
| LV.F17 | tests + limitation | the primary action now gives way on the selection alone ("No actions available" item); indeterminate select-all documented | LSH LV.F17 ×2 |
| LV.F1 | tests ported; limitation | Edit keeps the selection (Desk) | flp LV.F1 ×2 (ported); `lsd` `selectionAfterBulk` table (15) |
| LV.F4 | tests + limitation | cancel of Clear Assignment's confirmation clears + reloads (Desk `reject_action`) | `lsd` LV.F4; LA |
| LV.F8, LV.F9 | tests ported; limitation | Submit / Cancel clear only when every document went through; queued keeps | flp ported; `lsd` LV.F8, LV.F9 |
| LV.F11 | tests + limitation | workflow action keeps the selection | `lsd` LV.F11 |
| LV.F2, F3, F5, F6, F7, F10, F12 | tests only | per-action selection outcome now asserted under the header default (unchanged behaviour) | `lsd` LV.F2/F7, F3, F5, F6, F10 ×2, F12 ×3 |
| LV.F15 | limitation reworded | the current-page-rows limit now applies only to the opt-in bar | — |
| LV.H1 | tests, location, limitation | Report view editing = Frappe 15.110 by default (owner decision P36-5), child-cell edit added; status stays **PARTIAL** (`save_report`, aggregates, charts, multi-sort) | fvr: 26 LV.H1 tests (was 9) |
| FV.G1, FV.G6 | limitation | FV.G1: Table fields keep DataGrid's `32rem` minimum and horizontal scroll on phones, accepted by the owner for now; FV.G6: one row edited at a time stated. (A DataGrid card layout from P36 W3 was reverted in batch 2; no card-layout claim remains.) | — |

Also annotated in place, marked "(P36)": §7.2 H1, §7.4 `set_value` child branch, §7.5 DataGrid, Report view, `selectionMode`.

Real-site classification: `docs/audit/p36/VALIDATION-MATRIX.md` — 301 applicable rows: (a) unit 96 · (b) simulator 103 ·
(c) needs real-server validation 84 · (d) BLOCKED 5 · (e) not validatable now 13; real-site result BLOCKED (not run) for
every row. Its §7 L-HDR-1 note "the package's `selectionMode` default is still `"bar"`" predated the W1 merge; (P36b) it has
since been corrected and now states the `"header"` default.

## 9. P36b changes (0.7.0-dev.3)

**No status, denominator, evidence level or requirement text changed** — totals in §2 stand (258 / 301); §5 still lists the
same 62 rows. Batch 2 (P36b) edited the Location, Test evidence, Showcase and Known limitations cells of the rows below, each
marked "(P36b)" in place. Every new test is jsdom / simulator evidence; none ran against a site. Index:
`docs/audit/p36b/README.md`.

Test-file abbreviations (P36b): `bk` tests/bulk-p36b.test.tsx · `fsb` tests/form-sidebar-p36b.test.tsx · `soc`
tests/social-p36b.test.tsx · `gs` tests/global-search-p36b.test.tsx · `lip` tests/linkinput-p36b.test.tsx.

| Row | P36b change | Why | Evidence added |
|---|---|---|---|
| LV.F8, LV.F9 | tests, showcase, limitation | Submit / Cancel are now also offered in the Report view (`FrappeReportView bulk`, Desk: `ReportView extends ListView`, report_view.js:9, checkbox column :360, `onCheckRow` :371-374); Desk's "Cannot submit / cancel {names}." sentence; the built-in simulator follows bulk_update.py:51-114 | bk LV.F8 ×6, LV.F9 ×3 (incl. LV.F8 / LV.F9 P36B.bulk.2) |
| LV.F12 | tests, showcase, limitation | the Report view uses the List view's gates (Submit: submittable + level-0 submit + no active Workflow; Cancel: cancel + no active Workflow) through the shared `useFrappeSelectionActions` | bk LV.F12 P36B.bulk.3, .4 |
| LV.F14 | location, tests, limitation | a document shown on several Report rows (one per child-table row) is sent **once** — a documented deviation (Desk sends one name per checked row, report_view.js:1339-1352) | bk P36B.bulk.11 |
| LV.F18 | tests, limitation | Desk's failure sentence added to the outcome line (en + ar) | bk P36B.bulk.6, .13 |
| LV.H1 | location, tests, showcase, limitation | `bulk` gives the Report view Desk's Actions menu; status stays **PARTIAL** (`save_report`, aggregates, charts, multi-sort) | bk P36B.bulk.1, .2, .11, .15 |

Not changed but related: LV.E5 (list like heart) — the sidebar's `FrappeSidebarLikes` uses the same `toggle_like` and is
counted in §10, not here; FV.A20 / FV.A21 (Attach **fields**) — the sidebar's attachments use the same `upload_file` but
are a different surface (§10). The default `LinkInput` (FV.A2, FV.F1–F9) is unchanged; its picker mode is opt-in (§10).

Real-site classification: the catalogue gained 11 P36b tests (`docs/audit/p36/VALIDATION-MATRIX.md` §5; L-BULK-5 and
V-REPORT-2 attach to LV.F8 / LV.F9 / LV.F14 / LV.F18 / LV.H1, F-SB-LIKE-1 to LV.E5; the others have no COVERAGE row). No row
changed category; the real-site result of every row is still BLOCKED (not run).

## 10. P36b additions (outside the fixed denominator)

Features the owner asked for in batch 2 that have **no row** in the fixed P35 requirement list. They are recorded here with
the same status rule (§1: COMPLETE = a cited test exercises the behaviour through the public API) and evidence levels, but
they are **not counted** in §2 (the denominator stays 301, coverage stays 258 / 301). Ids are local to this table.

| id | Feature | Status | Layer | Public API | Test evidence | Showcase | Evidence level | Real-site test (prepared, not run) | Known limitations / deviations from Desk |
|---|---|---|---|---|---|---|---|---|---|
| P36b-1 | LinkInput picker mode (open on click when filled, check mark on the current value) | COMPLETE | Core | `LinkInput` `openOnClickWhenFilled`, `selectedIndicator`, `selectedValue`, `keepValueWhenEmptied`, `emptyText`, `searchPlaceholder` (opt-in; defaults unchanged) | lip P36B.linkinput.1–13 (incl. negative controls .10–.12 for the unchanged default) | `#p36b-linkinput` | unit | — (Core control, no server) | deliberate deviation from Desk's Link (link.js:35-41 never opens on a filled box); Space types instead of opening, arrows wrap, no Ctrl+N/P (owner judgement, `docs/audit/p36b/README.md`) |
| P36b-2 | Form Sidebar (Desk's order: Assigned To, Attachments, Tags, Share, likes · comments, last edited / created) | COMPLETE | both | Core `FormSidebar`, `SidebarSection`; Frappe `FrappeFormSidebar` (Share / Likes / comment count / Comments by default) | fsb P36B.sidebar.1–5, .22 | `#frappe-form-sidebar` | simulator | — (render only; the parts below have API tests) | not hidden on phones (Desk: `hidden-xs hidden-sm`); no sidebar image, Follow, Reviews, auto-repeat, page views; `FrappeFormView` does not mount it — the host places it |
| P36b-3 | Assign (sidebar) | COMPLETE | both | `FrappeAssignTo layout="sidebar"` (`allowComplete`, `bundle`), Core `AssigneeGroup` `onComplete` / `canComplete`, `AssignDialog defaultDetails` | fsb P36B.sidebar.6–8 | `#frappe-form-sidebar` | simulator | F-SB-ASSIGN-1 | one row per assignee with Done / × inline (Desk: avatar stack + "Assignments" dialog); no "Assign To User Group" |
| P36b-4 | Attachments (sidebar): upload, Library, Link, remove, `max_attachments`, `protect_attached_files` | COMPLETE | both | Core `AttachmentList`, `AttachDialog`; Frappe `FrappeAttachments`, `useFormSidebarActions`, `attachments.ts` helpers | fsb P36B.sidebar.9–16, .20 | `#frappe-form-sidebar` | simulator | F-SB-ATTACH-1, F-SB-ATTACH-2 | "+" offered to every reader, as Desk (server refuses, handler.py:220-221); remove needs write (attachments.js:161-174); no upload percentage, Camera, Google Drive, crop / optimize; Library is a text search (no folder tree) |
| P36b-5 | Tags (sidebar) | COMPLETE | both | Core `TagList`; Frappe `FrappeDocTags`; `tags.ts` (`docTags`, `sanitizeTag`) | fsb P36B.sidebar.17–19, .21; simp `tag.add_tags` (write via `update_tags`) | `#frappe-form-sidebar` | simulator | F-SB-TAGS-1 | add / remove offered to every reader, as Desk (tag.py:152 refuses); a refused pill is removed with the server message (Desk keeps it) |
| P36b-6 | Share | COMPLETE | both | Core `ShareDialog`, `SharedAvatars`; Frappe `FrappeSidebarShare`, `share.ts` | soc P36B.social.1–11 | `#p36b-social` | simulator | S-SHARE-1 | full name + id in rows; "Everyone" pill; read-only hint with the reason; `disable_document_sharing` is a prop (`sharingDisabled`); a saving row is disabled until the answer |
| P36b-7 | Like (sidebar) | COMPLETE | both | Core `LikedBy`; Frappe `FrappeSidebarLikes`, `like.ts` | soc P36B.social.12–15 | `#p36b-social` | simulator | F-SB-LIKE-1 | liked-by list opens from the count button (Desk: hover popover, none on touch); not optimistic, as Desk |
| P36b-8 | Comments: add, edit, delete, publish, @mention | COMPLETE | both | Frappe `FrappeComments` (`variant="list" \| "count"`), `comments.ts`; Core `Timeline` `onTogglePublish` / `canPublish` / `isPublished`; `FrappeTimeline allowPublish` | soc P36B.social.16–22 | `#p36b-social` | simulator | F-SB-COMMENT-1 | edit not optimistic (Desk shows the new text first); Delete / Publish are icon buttons with Desk's confirmations; the comment list is rendered in the sidebar slot (Desk: form footer) |
| P36b-9 | Global Search: awesome bar + Global Search dialog | COMPLETE | both | Core `GlobalSearchBar`, `GlobalSearchDialog`, `Navbar search={{ slot }}`; Frappe `useFrappeGlobalSearch`, `createFrappeSearchSource` | gs P36B.search.1–15 | `#p36b-search` | unit, simulator | S-GSEARCH-1, S-GSEARCH-2 | no calculator, random, `#tag` search, Help, executables, Marketplace rows; phones get an icon + full-screen dialog (Desk keeps the 300 px bar); dialog error + Retry and keyboard navigation are additions; result href is the canonical `/app/<slug>/<name>` |

Server rules the batch-2 real-site tests assert (read from Frappe 15.110 source, not observed on a site): see
`docs/LIMITATIONS.md` "Frappe 15.110 server rules to know" and `docs/audit/p36b/README.md` §4.
