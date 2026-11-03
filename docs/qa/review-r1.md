# Review R1 - forms, list, record and foundation against the parity checklists (0.4.0-dev.10)

Reviewer: A6. Scope: `src/frappe/form/**`, `src/frappe/record/**`, `src/frappe/list/**`, `services/`, `hooks/` read against
`docs/qa/parity-checklists.md` and the native source (`/home/frappe/lovable_bench/apps/frappe`). Not duplicated here (already
assigned by the Lead): the `record/useWorkflow` cache-shape bug (A4) and the missing assignees/versions in simulated docinfo (A1).
Everything is **Simulated & tested** or read from source; nothing was run against a site. Runnable evidence:
`tests/parity/review-r1.test.ts` (22 tests: 20 regression pins that pass, 2 `it.fails` for confirmed gaps) plus the already
enabled parity suites. Severity: **P1** blocks 0.4.0, **P2** fix before the CRM relies on it, **P3** backlog.

**Verdict: no P1 gap found.** The save lifecycle, action matrix, display status, dependency engine, mandatory check, Link
search/validate, child-row model, list request shapes, workflow helpers and timeline match the checklists. Seven P2 and
eight P3 items follow.

## 1. Gaps

| ID | Scenario | Our code | Native evidence | Sev | Owner |
|---|---|---|---|---|---|
| R1-F1 | F-10/F-11 defaults: a new document's default Link values never run `validate_link`, so `fetch_from` targets stay empty until the user re-selects. `newDoc` sets `__run_link_triggers` but nothing reads it | `form/model/defaults.ts:123` (set, never consumed; grep finds no other use) | `form.js:569` -> `trigger_link_fields` (`form.js:1103-1112`): for a new doc with the flag, every Link field is re-set so fetch runs | P2 | A3 |
| R1-F2 | F-06 Missing Fields: a table with ONE row missing a column reads "in row 1"; Desk says "in every row" because the every-row test comes first | `form/model/mandatory.ts:126` (`rows.length > 1`) | `form/save.js:221` `if (rows.length === te.total_rows)` precedes the single-row case. Test: `review-r1.test.ts` (`it.fails`) | P3 | A3 |
| R1-F3 | C-02/F-10: `validate_link` answering `name:null` clears the link but leaves the previously fetched targets (e.g. `contact_email`) stale | `form/model/fetch.ts:49-55` returns only `{link: null}`; `FrappeFormView.tsx:303-309` then deletes the link key, so nothing is written | `link.js:722-764`: an invalid value is cleared and an empty link clears every fetch target. Test: `review-r1.test.ts` (`it.fails`) | P2 | A3 |
| R1-F4 | F-12 conflict: after a 417 `TimestampMismatchError` the form shows the error but offers no way to reload the document while keeping the user's edits visible | `FrappeFormView.tsx:482` renders `FrappeErrorState` without `onRetry`; no reload path in `FrappeForm.tsx` | Desk: Refresh banner and `reload_doc` (`form.js:1117-1131, 1309`); the 417 comes from `document.py:850` | P2 | A3 |
| R1-F5 | F-09 Cancel/Amend: no pre-flight for submitted linked documents; Amend only calls the app's `onAmend` (no local copy with `amended_from`, no `is_document_amended` check) | header note `FrappeFormView.tsx:18-20`; `actions.ts` takes `alreadyAmended` from the caller | `form.js:870-` (`get_submitted_linked_docs`, Cancel All), `form.js:1011` (`amend_doc`), `client.py:425` | P2 | A3 (cancel pre-flight), A5 (amend copy) |
| R1-F6 | D-23 interpreter: 57 of the 947 `eval:` expressions in the installed apps are reported unsupported. 37 end in a trailing `;` (valid in Desk because it compiles `let out = <code>; return out`), 9 use `frappe.boot.*`/`frappe.*`, 4 use arrow functions (`.every(x => ...)`), 2 use bitwise `&`, plus `Boolean(...)`, `cur_frm`, and the `in` operator. They are listed, not guessed | `form/model/expression.ts` (tokenizer `OPS`, ~l.40-78) | `layout.js:751-791` + `utils.js:1076-1086`. Differential check on Frappe core's 270 expressions: **0 mismatches** where the interpreter accepts (6 seeded documents each; `review-r1.test.ts`). Trailing `;` test is `it.fails` | P2 (the `;` strip is trivial and removes 65% of the unsupported) | A3 |
| R1-F7 | W-04/W-05 wiring: `FrappeForm` does not derive `canCancelWithWorkflow` (`canCancelDocument`) or `workflowActionsShown` from the workflow it already has; the header badge shows Draft/Submitted/Not Saved only, never the workflow state with its style colour | `FrappeForm.tsx:57-78`; `FrappeFormView.tsx:397-400` | `toolbar.js:593,668-699`, `workflow.py:154`; `indicator.js:26-122` (workflow state after "Not Saved"). The pieces exist in `record/workflow.ts` and `FrappeStatusIndicator` | P2 | A3 wires, A4 supplies |
| R1-F8 | C-06/C-07 grid columns ignore the field's permlevel read right, so an unreadable permlevel column renders as a header over blank cells | `FrappeChildTable.tsx:80-93` (`gridColumns(childMeta)` has no permission input) | `grid.js:1015-1021` filters by `frm.get_perm(permlevel, "read")` | P2 | A3 |
| R1-F9 | Cancel with a workflow does not post the current state: `onCancelDoc` passes `workflowStateField` only, and the client sends the pair only when both exist | `FrappeForm.tsx:73` | `form/save.js:48-52` posts `workflow_state_fieldname` AND `workflow_state`; `save.py:57-58` sets the field before `doc.cancel()` | P3 | A3 |
| R1-F10 | C-01 Link titles are kept in a module-level `Map` shared by every provider/user in the page, never cleared | `FrappeLinkField.tsx:32-34` | Desk's `frappe._link_titles` is per page load; titles of one user can leak into another session in a long-lived SPA | P3 | A3 |
| R1-F11 | T-13/C-02 `validate_link` failures are swallowed (`catch {}`); the typed, unvalidated value stays and no message is guaranteed | `FrappeLinkField.tsx:159-163` | `request.js:149-170` shows the 403 dialog; `client.py:443-454` raises on missing select/read right. Needs a check that the client's `subscribeMessages` path really reports it | P3 | A3 |
| R1-F12 | C-05 Dynamic Link pointing at a Single DocType should error ("not a valid DocType for Dynamic Link"); it searches normally | `FrappeLinkField.tsx:215-218` | `dynamic_link.js:26-28` | P3 | A3 |
| R1-F13 | C-03 query as a function: extra keys in the returned object (`translate_values`, custom args) are dropped | `form/events.ts` `resolveLinkQuery` | `link.js:631-657` merges them into the request args | P3 | A3 |
| R1-F14 | L-04 filters: no nested-set operators (`descendants of`, `ancestors of`, `(inclusive)`); `is_large_table` only affects the realtime debounce, not the automatic "last 90 days" recency filter | `query.ts`, `list/model/filters.ts`; `meta.ts:154` | `db_query.py:794-840`, `list_view.js:118-138` (both already listed in doc 13 §1.12, §4.6) | P3 | A2 |
| R1-F15 | Standalone table (no form controller): the `FrappeChildTable` fallback uses `ladderStatus(f,row)` without permissions, so a standalone table is always writable unless `status` is passed | `FrappeChildTable.tsx:125-128` | `perm.js:196-203` (no-perm branch is only for dialogs) | P3 | A3 |

Notes on severity: nothing above loses data. R1-F3 and R1-F1 can leave a field blank that Desk would fill; the server
re-fetches on save (`base_document.py:787-880`) so the stored document is correct, only the UI lags. R1-F4 is the main
usability gap for concurrent edits.

## 2. Checked and conforming (P1)

| Area | Evidence |
|---|---|
| Save lifecycle (F-07, F-13) | `FrappeFormView.tsx:323-358`: clean Save -> "No changes" without a request; Submit confirm -> `before_submit` -> `validate` -> `before_save` -> mandatory -> `savedocs`; Update skips `validate`/`before_save`; double submit guard; server doc replaces the local one; `after_save` then `on_submit`. Matches `form.js:741-1002`, `save.js:4-100`. Pinned by `tests/frappe-form.test.tsx` and the action-matrix tests in `review-r1.test.ts` |
| Primary actions (F-09, W-04) | `model/actions.ts` equals `toolbar.js:668-699`: Submit (clean, saved, submit right, no workflow), Save (dirty with workflow), Update (dirty, submit), Cancel secondary (workflow gate), Amend (disabled when amended) |
| Display status (M-03, M-04) | `services/permissions.ts` ladder and `controlDisplayStatus`: `tests/parity/display-status.test.ts` (38 tests, pass) |
| depends / mandatory (F-02..F-06) | `tests/parity/{dependencies,mandatory}.test.ts` enabled and passing; interpreter equals Desk on every accepted real expression (R1-F6) |
| Link (C-01..C-04) | 500 ms debounce, `search_link` args (`reference_doctype`, `page_length`, `filters`, `query`, `ignore_user_permissions`), `link_filters` merged under the field query, empty filters dropped unless a Link field, canonical-case replacement, null name clears: `FrappeLinkField.tsx:110-218`, `tests/frappe-form.test.tsx:243-299`. Tab/Enter match rule in `fields/LinkInput.tsx` |
| Child rows (C-06) | new rows `__islocal`, `new-<slug>-<10>` name, parent links, defaults; `idx` contiguous after insert/delete/move; duplicate skips name/idx/owner/creation; `before_<table>_remove` abort; `cannot_add_rows`/`cannot_delete_rows`; `grid_page_length` 50; row context `doc`=row, `parent`=form: `docStore.ts`, `FrappeChildTable.tsx`, pinned in `review-r1.test.ts` |
| List (L-01..L-06) | `reportview.get` args, `[]` for no rows, `get_count` with `limit: 1001`, `distinct` for child filters, name tie-break, indicator precedence: `tests/parity/list.test.ts` (28, pass) |
| Workflow/timeline (W-02..W-05, H-01..H-05) | `tests/parity/record.test.ts` (29, pass): self-approval, read-only state, `canCancelDocument`, version lines, comment rights, no share events |
| Errors/messages (T-04, T-05) | `tests/parity/errors.test.ts` (48, pass); the Lead's 429/503/410/NameError decisions are not yet in the code and are not tested here |

## 3. Not reviewable on the simulator

Everything tagged `real-ro`, `real-rw` or `isolated` in the checklists (permissions, naming, server validation order, realtime,
files, workflow conditions) - see `docs/qa/simulator-caveats.md`. Those are for the first approved real-site session.

## 4. Tests added in this review

- `tests/parity/review-r1.test.ts`: differential evaluator check (270 Frappe-core expressions), action matrix, row model,
  layout/defaults pins, and two `it.fails` (R1-F2, R1-F3) plus one for the trailing `;` (R1-F6). When an owner fixes a gap, flip
  `it.fails` to `it`.
- `tests/parity/frappe-core-eval-expressions.json`: the 270 `eval:` expressions of Frappe core's DocTypes (MIT). The 947 across
  ERPNext/HRMS/other apps were used for the counts above only and are not stored (licences).
- Gaps with no cheap runnable test (need a rendered form or a permission input): R1-F1, F4, F5, F7, F8, F9, F10, F11. Each has
  the exact line and native reference above so the owner can write the component test.
