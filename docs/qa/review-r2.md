# Review R2 - closure of R1 and Stage B visual matrix (0.4.0-dev.16)

Reviewer: A6. Part 1 confirms each R1 fix against the native source and looks for regressions. Part 2 is the Stage B visual
matrix (brief §10) over the package playground. Everything ran on the SIMULATED backend (`createFixtureTransport`, real 15.110
metadata); nothing touched a site. Evidence: `tests/parity/review-r2.test.ts` (11 tests: 9 pins, 2 `it.fails`),
`tests/parity/review-r1.test.ts` (the R1 `it.fails` were already flipped by the Lead and pass as normal tests),
screenshots in `/tmp/a6-shots/` (80, not committed), `e2e/stage-b-matrix.mjs`, `playground/src/showcase/FrappeSimPage.tsx`
(`?view=frappe-sim&c=<scenario>`). Severity: P1 blocks 0.4.0, P2 fix before the CRM relies on it, P3 backlog.

**Verdict: no P1. All 7 R1 P2 items and F2/F11/F15 are closed correctly. Two small regressions/gaps in the new amend code (P2/P3),
one native-parity detail in Cancel All (P3). The visual matrix found 3 P2 and 6 P3 defects, none in dark contrast of text or
RTL mirroring of the chrome.**

## 1. R1 closures

| R1 | Closure | Native evidence | Result |
|---|---|---|---|
| F1 default Link triggers | `FrappeFormView.tsx` effect after load: for a new doc with `__run_link_triggers`, every top-level `Link` value goes through `validateLink` + fetch once | `form.js:1103-1112` iterates `fields_dict` Link fields only, then deletes the flag: same scope | Closed. Gap kept: Desk's `field.set_value(v, true)` also fires the field's change events; here only validate/fetch run (P3, A3) |
| F2 one-row "every row" | `mandatory.ts` now `bad.length === rows.length` | `save.js:221` | Closed (`review-r1.test.ts`, was `it.fails`, now `it`) |
| F3 stale fetch targets | `fetch.ts:49-55` clears the link and every target on `name:null` | `link.js:761-764` | Closed (test flipped) |
| F4 timestamp conflict | `FrappeFormView.tsx` `onRetry` -> `reload()` only for `kind === "timestamp"`; `FrappeForm.onReload` refetches and drops `saved` | `form.js:1117-1131, 1309` | Closed. Label still reads "Retry" (V7, P3) |
| F5 cancel pre-flight / amend | `startCancel` -> `get_submitted_linked_docs` -> list dialog -> `cancel_all_linked_docs` -> reload -> `before_cancel` -> cancel (no second confirm) ; Amend = local `amendDoc` | `form.js:870-993` (`savecancel`, `_cancel_all`, `_cancel(..., skip_confirm=true)`), `form.js:1011-1034` | Closed with three deviations below (R2-F1..F3) |
| F6 evaluator | trailing `;` stripped, `Boolean`, `in` operator | `utils.js:1076-1086` compiles `let out = <code>; return out` | Closed. Re-ran the 947 installed-app expressions: 929 supported (was 890), **0 mismatches** against `new Function` (8 seeded documents each); 18 still reported unsupported (`frappe.boot.*` 9, arrow functions 4, `&` 2, `erpnext.*` 2, `cur_frm` 1). `frappe.boot.developer_mode` could now be bound from `readFrappeBoot` (P3, A3) |
| F7 workflow wiring | `FrappeForm` computes `canCancelWithWorkflow`, `workflowActionsShown`, mounts `FrappeWorkflowActions`; header badge via `resolveIndicator` | `toolbar.js:593,668-699`; `indicator.js:26-122` | Closed (screenshot `form-workflow`) |
| F8 grid permlevel | `gridColumns(childMeta, canRead)` filters before the width budget, only inside a form | `grid.js:1015-1021` | Closed (`review-r2.test.ts`) |
| F9 cancel posts state | `onCancelDoc` sends `workflowStateField` and `workflowState` | `save.js:48-52`, `save.py:57-58` | Closed |
| F11 validate_link errors | `FrappeLinkField` shows the error through `useFrappeMessages` | `request.js:149-170`, `client.py:443-454` | Closed |
| F15 standalone table | `permissions` prop; ladder applied when given | `perm.js:196-203` | Closed (still writable by default without `permissions`, as documented) |

### New findings from the review of the fixes

| ID | Scenario | Our code | Native evidence | Sev | Owner |
|---|---|---|---|---|---|
| R2-F1 | Amend copies the cancelled document's `_assign`, `_comments`, `_liked_by`, `_user_tags` into the new draft (stale assignees/comment counts) | `form/model/copy.ts` `copyValues` copies every non-skipped key | `create_new.js:303-308` copies only keys that have a DocField (`df && ...`); those four are not DocFields. `review-r2.test.ts` (`it.fails`) | P2 | A3 |
| R2-F2 | Amend does not set `amendment_date` | `copy.ts` `amendDoc` | `form.js:1021-1023` sets it to today when the field exists. `review-r2.test.ts` (`it.fails`) | P3 | A3 |
| R2-F3 | "Cancel All" is always offered; Desk offers it only when the user can cancel every linked DocType and otherwise states "You do not have permissions to cancel all linked documents." Desk also passes `ignore_doctypes_on_cancel_all` | `FrappeFormView.tsx` linked dialog (`props.cancelAllLinkedDocs &&`) | `form.js:925-930` (`can_cancel`, `frappe.model.can_cancel`) | P3 | A3 (resolves the header's "UNVERIFIED") |
| R2-F4 | While the workflow transitions load, a workflow DocType briefly shows Cancel/Save before the actions replace them (`workflowActionsShown` is false until `wf.transitions` arrives) | `FrappeForm.tsx` (`wf.transitions.length > 0`) | `toolbar.js:593,668-699`, `form/workflow.js:134-141` | P3 | A3 |

Regressions checked and not found: save lifecycle and action matrix unchanged (`review-r1.test.ts`, `tests/frappe-form.test.tsx`),
Ctrl+S, double-submit guard, `replace()` semantics, evaluator equivalence, row model (idx, `__islocal`), error-kind mapping.

## 2. Simulator after hardening (A1)

Re-read against `docs/qa/simulator-caveats.md`: child rows with a client-invented name and no `__islocal` are now dropped
(`fixtureTransport.ts:267-289,473-474`, matches `base_document.py:618-620`), `format:`/`naming_series` expand `{YYYY}`, `{MM}`, `{field}`
(`:214-226`), `strict` validates Link and Select values in Frappe's order (`:464-469`, `:482-501`), `user_info` carries names. Still
simulated, unchanged from the caveats file: permissions (all rights), `docinfo.shared`, workflow conditions and self-approval, files,
realtime, delete/rename link checks, update-after-submit, Data formats and lengths. `strict` is opt-in; the default remains permissive.

## 3. Stage B visual matrix

Setup: `npm run playground:build`, served by `python3 -m http.server --bind 127.0.0.1`; `node e2e/stage-b-matrix.mjs
http://127.0.0.1:4833/ /tmp/a6-shots`. 80 screenshots at 1280x900, reduced motion. Scenarios x {light,dark} x {EN/LTR, AR/RTL}; the
three scenarios marked * also run the mixed combinations (AR UI in an LTR page, EN UI in an RTL page) via `&dir=`.

| Scenario | States covered |
|---|---|
| `form-contact`* (real Contact meta, 2 child tables, Dynamic Link table) | normal, dirty not needed; `form-contact-row-form` (row dialog) |
| `form-new` (ToDo) | Missing Fields dialog after Save |
| `form-link-dropdown` (ToDo `allocated_to`) | open Link dropdown with title/description rows |
| `form-error` | load error (403) |
| `form-save-error` | 417 timestamp conflict with edits kept |
| `form-loading` | skeleton (latency 1 h) |
| `form-readonly` (submitted Approval Memo) | read-only fields, Submitted badge |
| `form-workflow` | workflow state badge + Actions menu |
| `list`* , `list-bulk-menu`, `list-filters` | normal, 2 rows selected + bulk bar, filter popover |
| `list-empty`, `list-error`, `list-loading` | empty, 403 error, skeleton |
| `timeline`*, `workflow` | comments, assignment, version line, composer; lifecycle actions + assignees |

The script reports page errors, console errors and horizontal overflow: **none occurred** in any of the 80 shots (the four early
`form-link-dropdown` timeouts were a wrong selector in my script, fixed). Disabled state is reached only through read-only/submitted
(the simulator has no permission-denied field state); the saving-in-flight disabled state needs a slow save and is not captured.

### Visual defects

| ID | Defect (shot) | Our code | Native / rule | Sev | Owner |
|---|---|---|---|---|---|
| V1 | The form title shows raw HTML when `title_field` is a Text Editor: `<p>Review visa documents for the Jeddah team</p>` (`*__form-link-dropdown`, `form-todo`) | `FrappeFormView.tsx` `title` = `String(titleField \|\| doc.name)` | `toolbar.js:44-67` strips HTML from the title; docs 11 §7. Also X6 (server text as text) | P2 | A3 |
| V2 | The list has no Subject/ID column: ToDo's `description` (title field) is not `in_list_view`, so rows are only status/priority/date/reference with no way to tell records apart (`*__list`) | `meta.ts` `columnsFromMeta` (in_list_view only) | `list_view.js:375-486`: Subject = `title_field` else ID, always first; ID column appended (checklist L-06) | P2 | A2 |
| V3 | The selection bar sits after the 20-row page; with more than a screenful it is off-screen after selecting rows (`light-ar__list-bulk-menu`; full-page probe shows "2 محدد / تعديل / إسناد إلى / حذف / مسح التحديد" at the bottom) | list selection bar placement (`src/list/parts`) | Desk swaps the page header's primary action for the Actions menu with "N items selected" (`list_view.js:590-598,1613-1635`) | P2 | A2 |
| V4 | The skeleton is almost invisible in dark (blocks ~#1b1c26 on the glass gradient) and no text appears after 300 ms (`dark-ar__form-loading`, `form-loading`) | `FrappeForm.tsx` `FormSkeleton` (aria-busy only); `primitives/skeleton` tone | contract §3 "never a spinner without text for > 300 ms"; scenarios.md X7 | P2 (text) / P3 (dark tone) | A3 / A1 |
| V5 | The timestamp error panel's action says "Retry" though it reloads the document; the message and hint repeat the same sentence (`light-en__form-save-error`) | `FrappeErrorState.tsx` (one label for `onRetry`) | R1-F4 intent (Desk: "Refresh") | P3 | A1 |
| V6 | A 403 panel offers Retry (`light-ar__form-error`) | `FrappeForm.tsx` passes `onRetry` to every kind; `FrappeErrorState` shows it whenever given | `permission` is not retryable (scenarios.md §2.1) | P3 | A1 / A3 |
| V7 | Empty list says "No data yet" with "Total: 0" and no create action (`dark-en__list-empty`) | list empty state | `list_view.js:497-537`: "You haven't created a {0} yet" + "Create your first {0}" when `can_create`; with filters "No {0} found with matching filters" | P3 | A2 |
| V8 | Version lines in Arabic mix English field names/values into the sentence with no isolation: "غيّر أنت قيمة Title من Annual travel budget إلى … 2027, Amount من 12500 إلى 14000" (`dark-ar__workflow`, `timeline`) | `record/timeline.ts` `fmt` interpolation | scenarios.md X3: wrap LTR tokens in `<bdi>` / `dir="ltr"` | P3 | A4 |
| V9 | The Link input shows two focus rings (orange outer, cyan inner) and its dropdown is narrower than the input and offset from its start edge in RTL (`dark-ar__form-link-dropdown`) | `fields/LinkInput.tsx`, input wrapper | scenarios.md X5 (one visible focus ring) | P3 | A3 |
| V10 | The filter popover is translucent: table header text ("Due Date", "Reference Type") bleeds through behind its first row (`light-en__list-filters`) | popover surface token (glass) | readability | P3 | A2 / theme |

Checked and fine: RTL mirroring of toolbar, badges, select chevrons, pagination arrows, clear buttons, dialog close buttons and table
column order; dark-theme text contrast in forms, lists, dialogs and timeline; no horizontal overflow; long Arabic+Latin and long
email values truncate or wrap inside their cells; Missing Fields dialog and error panels readable in both themes and directions.
Out of scope of the components (fixture defect, see R1 note): Arabic runs show English field labels because the `*.ar.json`
captures carry no translations.

## 4. Tests and artefacts added

- `tests/parity/review-r2.test.ts`: copy/amend semantics, evaluator pins, grid permlevel columns, and `it.fails` for R2-F1 and R2-F2.
- `playground/src/showcase/FrappeSimPage.tsx` + a `view=frappe-sim` route in `playground/src/main.tsx` (playground only).
- `e2e/stage-b-matrix.mjs` (`ONLY=<scenario>` re-runs one).
