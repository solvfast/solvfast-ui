# Permission audit — `@solvfast/ui` 0.4.0 (Phase 26 D, release blocker)

Agent perm, worktree `p26-perm`, Frappe 15.110 sources under `apps/frappe` (file:line below). Status words:
**SIMULATED** = unit tests with test doubles (`tests/parity/permissions-matrix.test.tsx`, `display-status`,
`foundation-hooks`, `frappe-list`); **REAL** = `tests/real/sada-real.test.tsx` (recorded calls against a real 15.110
site, two full-rights role holders only). No test users or roles were created anywhere, and none may be.

## 1. The model (verified in source — rights are NOT interchangeable)

- Rights: `select read write create delete submit cancel amend print email report import export share`
  (`frappe/permissions.py:12-30`). Each is checked on its own; the only dependencies are DocPerm validation rules on
  save of the DocType (`core/doctype/doctype/doctype.py:1784-1793`: cancel needs submit; submit/cancel/amend need write;
  import needs create). There is no "write implies read" rule.
- DocType level (`has_permission` without a doc, `permissions.py:132-157`): `submit` needs `is_submittable`, `import`
  needs `allow_import` (:142), then `get_role_permissions` (:251-330): a right at permlevel 0 if ANY of the user's roles
  grants it; rights granted only by `if_owner` rows collapse to `select`/`read` for the DocType and move to `if_owner`.
  Administrator: everything, unconditionally (:107-109, :288-290).
- Document level (`get_doc_permissions`, :196-250): role rights, then `submit = 0` for non-submittable, **`import = 0`
  always** (:221), the `if_owner` overlay for the owner (:224-230), then User Permissions (:232-244: a non-owner that
  fails them gets `{}`; the owner keeps only `if_owner` rights and never `create`). Shares (`share.py:155`) are a
  fallback for read / write / share / submit (email / print count as read) — `has_permission :159-191`.
- Fields: a field at permlevel N is readable when a role row at level N grants `read` (`meta.py:633-641`); the server
  strips the others from `getdoc` (`load.py:53`) and from `reportview.get` (`db_query.py:668-760`).
- Desk client (`model/perm.js:42-117`): role rows × `frappe.user_roles` per permlevel; for a saved doc every key of
  `docinfo.permissions` overwrites level 0, non-owners lose `if_owner`-only rights, the user's `docinfo.shared` row adds
  read / write / submit / share. Import / Export / Print / Email / Share are DocType-level (`model.js:434-472`): System
  Manager always may import (if `allow_import`) and export; otherwise `frm.perm[0].<right>` or boot `can_<right>`.
- Server methods behind the package's actions: `savedocs` (write / create / submit), `frappe.client.delete`
  (`delete`), `reportview.delete_items` (`reportview.py:575-620`: `frappe.delete_doc` per item; failures are a realtime
  msgprint, the response is empty), `bulk_update.submit_cancel_or_update_docs` (`bulk_update.py:53-120`: `doc.submit()`
  / `cancel()` / `save()` per doc; the failed names are the response, 20-500 docs are enqueued and answer nothing),
  `assign_to.add_multiple` → `add` (`assign_to.py:60-68`: `doc.check_permission()` = **read**, `document.py:225`),
  exports (`reportview.py:420 can_export`, `data_import/exporter.py:116-124`, `data_export/exporter.py:367`), import
  (`data_import.py:71 has_permission(…, "import")`).

## 2. Action table — where the PACKAGE decides, what the SERVER checks, how a refusal surfaces

"Callable" = the action can still be invoked through package code when hidden (the server is the authority). "Refusal" =
how a 403 arrives: `createFrappeClient` classifies 403 / `PermissionError` as `FrappeError.kind === "permission"`
(`src/frappe/client.ts:55-57, 84`, 403 message precedence :140). No hook or component applies a change before the server
answers: `useSaveDoc` / `useDocAction` update the cache in `onSuccess` only (`src/frappe/hooks/useDocMutations.ts:23, 68,
72, 76`), `FrappeBulkActions.run` reloads the list only after a non-failed outcome (`src/frappe/list/FrappeBulkActions.tsx:54-63`).

| Action | Package decision (file:line) | Right the package checks | Native check | Callable when hidden? | Refusal handling | Status |
|---|---|---|---|---|---|---|
| Read (form) | `FrappeForm.tsx:86` → `usePermissions`; fields `fieldDisplayStatus` (`permissions.ts:176`), tabs `FrappeFormView.tsx:291` (`read` at the tab's permlevel) | `read` per permlevel | `load.py:40 has_permission("read")`, field stripping `:53` | `api.getDoc` — the server answers 403 | `FrappeForm.tsx:101` → `FrappeErrorState` (kind permission, no Retry) | SIMULATED (matrix §2, §4, §5); REAL read for 2 holders |
| Read (list rows) | `FrappeListView.tsx:56` `usePermissions(bundle)`; columns are what `reportview.get` returns | — (Desk: `list_view.js:38-52` read) | `db_query.py:566-585`, field stripping `:668-760` | yes | list `FrappeErrorState` per kind (RELEASE "List errors") | SIMULATED (list tests, list-io) |
| Create | `FrappeFormView.tsx:369-371` → `formActions` (`form/model/actions.ts:53`: new doc needs `create` or `write`); `FrappeListView.tsx:93` "Create your first" only via the app's `onCreate` | `create` (or `write`, Desk `form.js` save button parity) | `savedocs` → `doc.insert` → `has_permission("create")` | `useSaveDoc` | rejects with kind permission; cache untouched (matrix §3) | SIMULATED |
| Write | `FrappeFormView.tsx:369` `can("write")`; fields Write/Read by `displayStatus`; Ctrl+S `:495` | `write` at level 0 (+ per-permlevel for fields) | `savedocs` → `has_permission("write")`, permlevel reset of unwritable values | `useSaveDoc` | as above | SIMULATED; REAL agreement for 2 holders |
| Delete (document) | **Not offered by any component** — `useDocAction().remove` only (`useDocMutations.ts:71-73`) | app's responsibility (`can("delete")`) | `frappe.client.delete` → `delete_doc` → `has_permission("delete")` | yes | rejects kind permission; `doc` / `docinfo` stay cached (matrix §3) | SIMULATED |
| Submit / Cancel / Amend | `FrappeFormView.tsx:369` → `actions.ts:45-54`; Cancel-All-linked gate `FrappeForm.tsx:46-50` `canCancelDoctype` | `submit` / `cancel` / `amend` at level 0 | `savedocs` submit, `save.cancel`, amend = insert with `create` | `useSaveDoc`, `useDocAction().cancel` | rejects kind permission | SIMULATED (form tests) |
| Report | **Not offered** (no report view in 0.4.0) | — | `report` right in `reportview.get` for Report View | — | — | n/a |
| Export | `canExport` (`permissions.ts:252`): System Manager, else level-0 `export`. No component yet (Lead primitives) | `export` | `permissions.py:609-615`, exporters above | `api.download` | rejects kind permission (matrix §3) | SIMULATED; REAL BLOCKED (no limited user) |
| Import | `canImport` (`permissions.ts:239`): `allow_import` AND (System Manager or level-0 `import`) | `import` + `allow_import` | `permissions.py:142, 600-606`, `data_import.py:71` | `api.uploadFile` / Data Import insert | rejects kind permission | SIMULATED (matrix §1); REAL BLOCKED |
| Share | **Not offered** (`can("share")` exposed only) | — | `share.py:216-245 check_share_permission` | — | — | n/a |
| Print / Email | **Not offered** (`can("print")` / `can("email")` exposed; Desk also uses boot `can_print` / `can_email`, not available) | — | print: `print_format` read + print; email: `has_permission("email")` | — | — | n/a |
| Assign (record) | `FrappeAssignTo.tsx:29, 51` `canAssign` prop (default true), remove `:60` (assignee or `canWrite`) | app-supplied; Desk shows to any reader | `assign_to.py:67-68` read on the doc | `useDocAction().assign` | rejects kind permission; `docinfo` is re-fetched only on success | SIMULATED (record tests) |
| Workflow actions | `FrappeWorkflowActions.tsx:33` → `useWorkflow` (`record/workflow.ts:70-71` allowed role, `:75` read-only state) | transition `allowed` role (needs `roles` prop; **without roles every transition is shown**) | `apply_workflow` → `WorkflowPermissionError` | `useDocAction().applyWorkflow` | rejects kind permission | SIMULATED (record tests); see P2-3 |
| Bulk Edit | `bulk.ts:28` | `write` (+ editable fields, workflow `allow_edit`) — stricter than Desk (`list_view.js:2088-2090` checks no right) | `bulk_update.py:100-103 doc.save()` per doc | `bulkSubmitCancelOrUpdate` | failed names → `BulkOutcome.failed` (matrix §3); a 403 on the call rejects | SIMULATED |
| Bulk Submit / Cancel | `bulk.ts:29-30` | `submit` / `cancel`, not with a workflow (Desk `:2109-2121`) | `doc.submit()` / `doc.cancel()` per doc | same | same | SIMULATED |
| Bulk Assign To | `bulk.ts:36` | `read` (or `write`) — Desk offers it unconditionally (`:2095`); server needs read per doc | `assign_to.py:67-68` | `bulkAssign` | rejects kind permission | SIMULATED (resolved the UNVERIFIED comment) |
| Bulk Delete | `bulk.ts:37` | `delete` (+ workflow `allow_edit`, Desk `:2123-2126`) | `delete_doc` per item (`reportview.py:588-616`) | `bulkDelete` | the call itself answers nothing: partial failures are NOT in `BulkOutcome.failed` (realtime msgprint only); a 403 on the call rejects | SIMULATED; see P2-2 |
| Bulk Export / Print / Clear assignment / Assignment rule / Tags | **Not offered** (`BulkKind` has no such entry) | — | — | — | — | n/a |

## 3. Findings

**P1 (fixed in dev.26, this branch)**
- P1-1 `buildDocPermissions` without `session.roles` granted read / write / create to a NEW doc and inferred permlevel > 0
  readability from the doc's keys (`permissions.ts`, old :80-95). Violates rule 9. **Fixed**: nothing is granted beyond the
  server's `docinfo.permissions` (+ `shared` row) for a saved doc; a new doc is denied; `usePermissions().known === false`
  and `FrappeFormView` shows the read-only notice (`FrappeFormView.tsx:586`). Administrator user → everything (server rule).
  Tests: matrix §2, `display-status`, `foundation-hooks`. Release note: `docs/RELEASE-0.4.0.md` "Behaviour change".
- P1-2 `isWorkflowReadOnly` answered false without roles (`permissions.ts:150`). **Fixed**: read-only without roles
  (Administrator excepted).

**P2 (open — need an owner decision or another agent's file)**
- P2-1 `FrappeFormView.tsx:369`: with no `permissions` prop the standalone view assumes every right (`can` → true). It is the
  presentational component and has no permission source; `FrappeForm` always passes one. Document "pass `permissions`";
  consider denying by default in 0.5.
- P2-2 `bulkDelete` (`bulk.ts:51-54`) returns `failed: []` whatever happened: `delete_items` answers nothing and reports
  failures by realtime msgprint (`reportview.py:608-616`). The bar then says "N succeeded, 0 failed" for a partial
  refusal. Needs the realtime port (`msgprint` event) or a per-name `frappe.client.delete` fallback — list-io's file.
- P2-3 `useWorkflow` / `FrappeWorkflowActions` without `roles` shows every transition (`record/workflow.ts:71`,
  `!opts.roles ||`) and is never read-only (`useWorkflow.ts:67`). Same rule-9 shape as P1-1; the server refuses with
  `WorkflowPermissionError`. Record owner's file — not changed here.
- P2-4 `canImport` / `canExport` take `roles`; a session `{ user: "Administrator" }` without roles yields false (System
  Manager test on the roles array). Callers should pass `["Administrator", …]` or use `isAdministrator(session)`.
- P2-5 Role-less `FrappeTimeline` (`FrappeTimeline.tsx:46, 59`) now hides field changes of permlevel > 0 fields and, for a
  saved doc without `docinfo`, every field change (rule 9). Correct, but apps that relied on the approximation lose
  content silently — the release note covers it.

**P3 (documented)**
- P3-1 `canCancelDoctype` (`FrappeForm.tsx:46-50`) answers `undefined` without roles and "Cancel All" is then offered
  (`FrappeFormView.tsx:651`); the server refuses per DocType. Rule 9 would hide it; left as is (the brief's standard:
  callable is fine when the refusal surfaces and nothing is applied optimistically).
- P3-2 Empty `docinfo.permissions` `{}` WITH roles keeps the role rights (Desk parity, `perm.js:78-82`); the server only
  produces `{}` for a user who fails User Permissions, and such a user cannot load the doc (`load.py:40`). Tested (matrix §4).
- P3-3 `bulkMenu` Edit requires `write` while Desk offers Edit without a right check (`list_view.js:2088-2090`); the package
  hides what the server would refuse (rule D.1). Intentional.
- P3-4 `FrappeProvider.tsx:69` doc comment still says permissions are "approximated" without roles — not this agent's file.
- P3-5 `docs/release/COMPONENT-COMPLETION-MATRIX.md` row 7 (a) is resolved by P1-1; (b) by the Lead's `canImport` /
  `canExport`; (c) is now asserted (matrix §1). Row not edited here (Lead's file).

## 4. BLOCKED for real-server verification

No permission-limited test user exists on the Sada site and none may be created. Therefore REAL evidence covers only two
full-rights role holders (`sada-real.test.tsx:105-116`: `usePermissions().can` agrees with `get_doc_permissions` for
read / write / create / delete) and Guest 403s (`:125-135`). Untested against a real server: Read-only / Export-only /
Import-only roles, `allow_import` 0, permlevel > 0 stripping for a restricted role, User Permissions, shared-only access,
`if_owner` for a non-owner, partial bulk failures. These are exactly the matrix rows — SIMULATED only.

## 5. Behaviour changes made (release-note lines in `docs/RELEASE-0.4.0.md`)

1. Rule 9 for `buildDocPermissions` / `usePermissions` (new doc denied, saved doc = server's docinfo, permlevels > 0
   denied, workflow read-only without roles, Administrator everything; `known` flag + "Read only" notice).
2. Bulk "Assign To" offered with `read` (or `write`) instead of `write` only.

Exports needed in `src/frappe/index.ts` / `services/index.ts` (not edited here): `permissionsKnown`, `isAdministrator`
from `services/permissions`. A dedicated message key ("Permissions unknown — pass session.roles") in
`src/theme/messages.ts` would replace the reused `formReadOnly` notice.
