# Permission audit — `@solvfast/ui` 0.4.0 (Phase 26 D, release blocker)

Agent perm, worktree `p26-perm`, Frappe 15.110 sources under `apps/frappe` (file:line below). Status words:
**SIMULATED** = unit tests with test doubles (`tests/parity/permissions-matrix.test.tsx`, `display-status`,
`foundation-hooks`, `frappe-list`); **REAL** = `tests/real/sada-real.test.tsx` (recorded calls against a real 15.110
site, two full-rights role holders only). No test users or roles were created anywhere, and none may be.

**Phase 27 (agent perm27, worktree `p27-perm`, on 0.4.0-dev.30):** P2-1, P2-3, P2-4, P3-1 and P3-6 closed — §3 (status,
commit, test), §6 (Administrator, verified in source), §7 (evidence per class). Tests: `tests/parity/permissions-p27.test.tsx`
(60 tests). Evidence classes used below, kept separate: **Implemented** (code), **Tested with simulator or test doubles**,
**Replayed from recorded real responses** (`tests/fixtures/real-15.110*`, read-only captures), **Verified against an
authenticated real session** (none), **Verified with actual writes** (none).

## 1. The model (verified in source — rights are NOT interchangeable)

- Rights: `select read write create delete submit cancel amend print email report import export share`
  (`frappe/permissions.py:12-30`). Each is checked on its own; the only dependencies are DocPerm validation rules on
  save of the DocType (`core/doctype/doctype/doctype.py:1784-1793`: cancel needs submit; submit/cancel/amend need write;
  import needs create). There is no "write implies read" rule.
- DocType level (`has_permission` without a doc, `permissions.py:132-157`): `submit` needs `is_submittable`, `import`
  needs `allow_import` (:142), then `get_role_permissions` (:251-330): a right at permlevel 0 if ANY of the user's roles
  grants it; rights granted only by `if_owner` rows collapse to `select`/`read` for the DocType and move to `if_owner`.
  Administrator: everything, unconditionally (:107-109, :273-275; its roles are every Role, :506-507 — §6).
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
| Create | `FrappeFormView.tsx:383` → `formActions` (`form/model/actions.ts:53`: new doc needs `create` or `write`); no `permissions` prop → no right, no `__newname` prompt (`:296`) (P2-1); `FrappeListView.tsx:93` "Create your first" only via the app's `onCreate` | `create` (or `write`, Desk `form.js` save button parity) | `savedocs` → `doc.insert` → `has_permission("create")` | `useSaveDoc` | rejects with kind permission; cache untouched (matrix §3) | SIMULATED |
| Write | `FrappeFormView.tsx:383` `can("write")`; fields Write/Read by `displayStatus` (no `permissions` → Read, `:199`); Ctrl+S `:510` | `write` at level 0 (+ per-permlevel for fields) | `savedocs` → `has_permission("write")`, permlevel reset of unwritable values | `useSaveDoc`, `api.saveDoc` | as above (p27 §6) | SIMULATED; REAL agreement for 2 holders |
| Delete (document) | **Not offered by any component** — `useDocAction().remove` only (`useDocMutations.ts:71-73`) | app's responsibility (`can("delete")`) | `frappe.client.delete` → `delete_doc` → `has_permission("delete")` | yes | rejects kind permission; `doc` / `docinfo` stay cached (matrix §3) | SIMULATED |
| Submit / Cancel / Amend | `FrappeFormView.tsx:383` → `actions.ts:45-54`; Cancel-All-linked gate `FrappeForm.tsx:50-54` `canCancelDoctype` → `FrappeFormView.tsx:668` (offered only for `true`, P3-1) | `submit` / `cancel` / `amend` at level 0; Cancel All: `cancel` on every linked DocType | `savedocs` submit, `save.cancel`, amend = insert with `create`; `cancel_all_linked_docs` → `linked_doc.cancel()` (`linked_with.py:363-381`) | `useSaveDoc`, `useDocAction().cancel` | rejects kind permission | SIMULATED (form tests, p27 §4) |
| Report | **Not offered** (no report view in 0.4.0) | — | `report` right in `reportview.get` for Report View | — | — | n/a |
| Export | `canExport` (`permissions.ts:277`): System Manager or the Administrator USER (session form, P2-4), else level-0 `export`; `FrappeListView.tsx:88` | `export` | `permissions.py:608-615`, exporters above | `api.download` | rejects kind permission (matrix §3) | SIMULATED; REPLAYED (Administrator, p27 §7); REAL BLOCKED (no limited user) |
| Import | `canImport` (`permissions.ts:262`): `allow_import` AND (System Manager, the Administrator USER, or level-0 `import`); `FrappeListView.tsx:87` | `import` + `allow_import` | `permissions.py:599-605`, `data_import.py:64` (allow_import, everyone) then `:71` | `api.uploadFile` / Data Import insert | rejects kind permission | SIMULATED (matrix §1, p27 §1); REPLAYED (p27 §7); REAL BLOCKED |
| Share | **Not offered** (`can("share")` exposed only) | — | `share.py:216-245 check_share_permission` | — | — | n/a |
| Print / Email | **Not offered** (`can("print")` / `can("email")` exposed; Desk also uses boot `can_print` / `can_email`, not available) | — | print: `print_format` read + print; email: `has_permission("email")` | — | — | n/a |
| Assign (record) | `FrappeAssignTo.tsx:29, 51` `canAssign` prop (default true), remove `:60` (assignee or `canWrite`) | app-supplied; Desk shows to any reader | `assign_to.py:67-68` read on the doc | `useDocAction().assign` | rejects kind permission; `docinfo` is re-fetched only on success | SIMULATED (record tests) |
| Workflow actions | `FrappeWorkflowActions.tsx` → `useWorkflow` (`useWorkflow.ts:62` the server's `get_transitions` answer with `fromServer`; `record/workflow.ts:91-97` role filter when roles are known, none for the Administrator, approval access; `:111` read-only state) | the server's role filter (`get_transitions`); without roles nothing is computed client-side (P2-3) | `get_transitions` (`workflow.py:52` read, `:64-68` roles, condition); `apply_workflow` re-checks (`:104-117`) → `WorkflowTransitionError` / self-approval / `PermissionError` | `useDocAction().applyWorkflow` | rejects kind permission; error under the bar, cache untouched (p27 §5-6) | SIMULATED (record tests, p27 §5-6) |
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
  and `FrappeFormView` shows the read-only notice (`FrappeFormView.tsx:586`). Administrator USER → everything (server rule,
  keyed on the user name — the "Administrator" role on another user gets only its DocPerm rows, `role.py:92-95`).
  Tests: matrix §2, `display-status`, `foundation-hooks`. Release note: `docs/RELEASE-0.4.0.md` "Behaviour change".
- P1-2 `isWorkflowReadOnly` answered false without roles (`permissions.ts:150`). **Fixed**: read-only without roles
  (Administrator excepted).

**P2 (P2-1, P2-3, P2-4 closed in Phase 27; P2-2, P2-5 open)**
- P2-1 `FrappeFormView.tsx:369`: with no `permissions` prop the standalone view assumes every right (`can` → true). It is the
  presentational component and has no permission source; `FrappeForm` always passes one. Document "pass `permissions`";
  consider denying by default in 0.5.
  **Status: FIXED (Phase 27, `abb6a72`, refined in `08d8721`).** No `permissions` → no right
  (`FrappeFormView.tsx:383`: `can` reads `permissions.can` or `permissions.levels[0]`, else false), fields Write → Read
  before the control rules so blank fields hide as in Desk (`:199`), child tables read-only (no Add Row), no `__newname`
  prompt (`:296`), the "Read only" notice with `data-permissions="unknown"` (`:384`, `:601`), Ctrl+S inert (`:510`). Fields
  are SHOWN read-only (the data the app handed over), not hidden. Callers checked (`grep -rn FrappeFormView src tests
  playground showcase`): `FrappeForm.tsx:109` passes `usePermissions` (unchanged); `tests/frappe-form.test.tsx`
  `FrappeFormServicesProbe` now passes the cancel right it relies on (intent kept). Also: `usePermissions().known` is false
  for a saved workflow doc without roles (`usePermissions.ts:46-47`) so that form shows the notice too. Tests:
  permissions-p27 §2 (standalone view, `levels`-only rights, usePermissions without session, revocation), §3.
- P2-2 `bulkDelete` (`bulk.ts:51-54`) returns `failed: []` whatever happened: `delete_items` answers nothing and reports
  failures by realtime msgprint (`reportview.py:608-616`). The bar then says "N succeeded, 0 failed" for a partial
  refusal. Needs the realtime port (`msgprint` event) or a per-name `frappe.client.delete` fallback — list-io's file.
- P2-3 `useWorkflow` / `FrappeWorkflowActions` without `roles` shows every transition (`record/workflow.ts:71`,
  `!opts.roles ||`) and is never read-only (`useWorkflow.ts:67`). Same rule-9 shape as P1-1; the server refuses with
  `WorkflowPermissionError`. Record owner's file — not changed here.
  **Status: FIXED (Phase 27, `064ce46`).** Decision, from source: `useWorkflow` always fetches
  `frappe.model.workflow.get_transitions` (`client.ts:419-420`), which read-checks the doc (`model/workflow.py:52`) and filters
  by state, by `frappe.get_roles()` of the SESSION user and by condition (`:64-68`); Desk filters that same list again with
  the same roles (`form/workflow.js:99-103`). So the server's answer is authoritative without `roles` — it is server-evaluated
  information, like `docinfo.permissions` (rule 9 is about MISSING information). No component computes transitions from the
  definition. What was changed: `visibleTransitions` takes `fromServer` (`record/workflow.ts:91-97`; `useWorkflow.ts:62`
  passes it) — roles unknown and not the server's list → `[]`; user unknown → only `allow_self_approval` transitions
  (`has_approval_access`, `:221-222`, cannot be checked); `transitionsKnown` (`:101`) / `useWorkflow().transitionsKnown`
  (`useWorkflow.ts:76`) say when something was withheld; `useWorkflow().readOnly` without roles → true (`:74`, via
  `isWorkflowReadOnly`); `FrappeWorkflowActions` shows the error (failed `get_transitions`, `:56-62`) or the "Read only"
  notice `data-permissions="unknown"` (unknown user, `:64-70`) next to the state; `FrappeForm.tsx:149` hides Save / Cancel for
  workflow actions only when a session user exists (the actions render only then). Approve / Reject with known roles
  unchanged. Tests: permissions-p27 §5 (client-side vs server list, unknown user, Administrator, useWorkflow without roles,
  403 on `get_transitions`, revocation by an empty re-answer, Approve path, 403 on `apply_workflow`), §6;
  `tests/record-frappe.test.tsx` self-approval test passes `fromServer` (intent kept).
- P2-4 `canImport` / `canExport` take `roles`; a session `{ user: "Administrator" }` without roles yields false (System
  Manager test on the roles array). Callers should pass `["Administrator", …]` or use `isAdministrator(session)`.
  **Status: FIXED in the package (Phase 27, `2b4a8ed`, `064ce46`, replay `e702e92`); one caller change needed.**
  Evidence in §6. `canImport(meta, who, level0)` / `canExport(who, level0)` accept the session in place of the role list
  (`permissions.ts:241-280`): the Administrator USER imports when the DocType has `allow_import` and always exports — with or
  without roles; everyone else unchanged (no roles → false). Workflow: no client role filter and no read-only state for the
  Administrator (`record/workflow.ts:92`, `isWorkflowReadOnly`). `buildDocPermissions` (everything at every level),
  `canCancelDoctype` (true) and `bulkMenu` inputs (`usePermissions().can`) were already user-keyed and are now asserted for
  no / full / partial role lists. **Needed (not this agent's file):** `FrappeListView.tsx:87-88` passes `session?.roles` —
  pass `session` so the list's Import / Export entries see the Administrator without a role list; `FrappeListView.tsx:150`
  passes `levels` only with `session?.roles` — use `perms.known` (or `|| isAdministrator(session)`). Tests: permissions-p27
  §1, §4, §5, §7 (replayed).
- P2-5 Role-less `FrappeTimeline` (`FrappeTimeline.tsx:46, 59`) now hides field changes of permlevel > 0 fields and, for a
  saved doc without `docinfo`, every field change (rule 9). Correct, but apps that relied on the approximation lose
  content silently — the release note covers it.

**P3 (documented; P3-1, P3-6 closed in Phase 27)**
- P3-1 `canCancelDoctype` (`FrappeForm.tsx:46-50`) answers `undefined` without roles and "Cancel All" is then offered
  (`FrappeFormView.tsx:651`); the server refuses per DocType. Rule 9 would hide it; left as is (the brief's standard:
  callable is fine when the refusal surfaces and nothing is applied optimistically).
  **Status: FIXED (Phase 27, `abb6a72`).** "Cancel All" only when `canCancelAllLinked` answers `true`
  (`FrappeFormView.tsx:668`); missing / undefined → the explanation marked `data-permissions="unknown"` (`:663-665`), false →
  Desk's explanation (`data-permissions="denied"`, form.js:925-931). Tests: permissions-p27 §4 (undefined, missing, false,
  true, FrappeForm without roles, Administrator with no / full / partial role list, Clerk vs Reader).
- P3-2 Empty `docinfo.permissions` `{}` WITH roles keeps the role rights (Desk parity, `perm.js:78-82`); the server only
  produces `{}` for a user who fails User Permissions, and such a user cannot load the doc (`load.py:40`). Tested (matrix §4).
- P3-3 `bulkMenu` Edit requires `write` while Desk offers Edit without a right check (`list_view.js:2088-2090`); the package
  hides what the server would refuse (rule D.1). Intentional.
- P3-4 `FrappeProvider.tsx:69` doc comment still says permissions are "approximated" without roles — not this agent's file.
- P3-6 `FrappeForm.tsx:40-50` has its own `isAdministrator` that also fires on the "Administrator" ROLE and answers
  `canCancelDoctype` true for it — the over-grant shape removed from `services/permissions.ts` here; harmless (Cancel All
  is refused by the server) but should use `isAdministrator(session)` from `services/permissions` once exported.
  **Status: FIXED (Phase 27, `2b4a8ed`).** `FrappeForm.tsx:15, 50-54, 136-138` use the services helper (user-keyed,
  `permissions.ts:71`). Evidence that the role never reaches another user: "Administrator" is an automatic role
  (`permissions.py:37`) excluded from `Has Role` in `get_roles` (`:515`); REPLAYED: the recorded second full-rights user's
  roles hold System Manager but not Administrator (p27 §7). `tests/frappe-form.test.tsx` R3-F1 flipped for that session
  (reason cited); Administrator user with a role list still true.
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

Phase 27 (one release-note bullet each, "since 0.4.0-dev.31"):

3. `FrappeFormView` without `permissions` is read-only with the unknown notice (P2-1).
4. "Cancel All" only when `canCancelAllLinked` answers `true` (P3-1).
5. `usePermissions().known === false` for a saved workflow doc without roles (the notice appears).
6. Workflow actions: server list authoritative; `visibleTransitions` without roles needs `fromServer`; `useWorkflow().readOnly`
   true without roles; visible error / unknown state; `FrappeForm` keeps Save / Cancel without a session user (P2-3).
7. `canImport` / `canExport` accept the session; the Administrator without roles imports (`allow_import`) / exports;
   workflow transitions not role-filtered for it (P2-4).
8. `canCancelDoctype` no longer treats the "Administrator" ROLE on another user as the Administrator (P3-6).

Exports needed in `src/frappe/index.ts` / `services/index.ts` (not edited here): `permissionsKnown`, `isAdministrator`
from `services/permissions` (already in `services/index.ts`); Phase 27: `transitionsKnown` and the types
`VisibleTransitionsOptions` (`record/workflow.ts`) and `RolesOrSession` (`services/permissions.ts`) in `record/index.ts` /
`services/index.ts` / `src/frappe/index.ts`. A dedicated message key ("Permissions unknown — pass session.roles") in
`src/theme/messages.ts` would replace the reused `formReadOnly` notice (form, workflow actions) and
`formNoCancelAllPermission` for the unknown Cancel-All case.

## 6. Administrator — verified Frappe 15.110 behaviour

Read in `apps/frappe/frappe` (15.110). This is source reading plus one recorded real capture (REPLAYED, below); no live
session, no writes.

| Question | Frappe 15.110 source | Package (Phase 27) |
|---|---|---|
| Which roles does the server report for "Administrator"? | `permissions.py:497-507` `get_roles`: `if user == "Administrator": return frappe.get_all("Role", pluck="name")` — every Role record. `frappe.get_roles()` (`__init__.py:664-670`) delegates to it. Boot: `utils/user.py:245` `d.roles = self.get_roles()` → Desk `frappe.user_roles = frappe.boot.user.roles` (`desk.js:311`). REPLAYED: the recorded list holds System Manager and Administrator (p27 §7). | `session.roles` may be absent or partial for the Administrator; the package never reads it for that user. |
| Can another user hold the "Administrator" role? | No: `AUTOMATIC_ROLES` (`permissions.py:37`) includes it and `get_roles` reads `Has Role` with `role.notin(AUTOMATIC_ROLES)` (`:515`). `role.py:92-95` resolves the role to the Administrator user. REPLAYED: the second full-rights user's roles lack it. | `isAdministrator` keyed on the user (`permissions.ts:71`); FrappeForm uses it (P3-6). The role on another user = its DocPerm rows. |
| Document / DocType rights | `has_permission`: `if user == "Administrator": return True` (`permissions.py:107-109`), before the `is_submittable` / `allow_import` checks (`:138-144`). `get_role_permissions`: `allow_everything()` (`:273-275`). Fields: never stripped (`document.py:756`), never reset (`:788`). `get_doc_permissions` still sets `submit = 0` / `import = 0` on non-submittable / non-importable DocTypes (`:217-221`) — REPLAYED in the recorded docinfo. | `buildDocPermissions`: every right at every permlevel, with or without roles (`permissions.ts:118-124`); docinfo is not overlaid for it (the server enforces `:107`). `submit` / `import` lead to no action where the DocType forbids them: `formActions` checks `is_submittable`, `bulkMenu` too, `canImport` checks `allow_import` (p27 §7). |
| Import | `can_import` (`permissions.py:599-605`): `"System Manager" in frappe.get_roles()` or `has_permission(doctype, "import")` — both true for the Administrator; but Data Import refuses `allow_import = 0` for everyone (`data_import.py:64`, before the right at `:71`), and Desk checks `meta.allow_import` first (`model.js:435`), then System Manager (`:438`). | `canImport(meta, session, level0)` = `allow_import` for the Administrator, with or without roles. |
| Export | `can_export` (`permissions.py:608-615`): `"System Manager" in frappe.get_roles()` → True; otherwise `get_role_permissions` → `allow_everything` (`:273-275`). Desk: `model.js:446`. | `canExport(session, level0)` = true for the Administrator. |
| Workflow transitions | `get_transitions` keeps `transition.allowed in roles` with `roles = frappe.get_roles()` (`workflow.py:64-67`) — every Role for the Administrator, and `allowed` is a required Link to Role (`workflow_transition.json`) — so every transition of the state whose condition holds. `has_approval_access` is always true for it (`:221-222`). Desk's client filter (`form/workflow.js:103`) passes because `frappe.user_roles` holds every role. | `visibleTransitions`: no client role filter for the Administrator (`record/workflow.ts:92-96`), with or without roles; never self-approval blocked. |
| Workflow read-only | Desk `is_read_only` (`model/workflow.js:53-70`): read-only when no role of `frappe.user_roles` is in the state's `allow_edit` — never for the Administrator (every role). | `isWorkflowReadOnly` / `isReadOnlyState` → false for the Administrator. |
| Cancel All (linked docs) | Desk: `frappe.model.can_cancel` = boot `can_cancel` (`model.js:400-402`), built from the level-0 rows of the user's roles (`utils/user.py:149-150`) — for the Administrator every DocType with some cancel row. Server: `cancel_all_linked_docs` → `linked_doc.cancel()` (`linked_with.py:363-381`) → never refused to the Administrator (`:107`). | `canCancelDoctype` → true for the Administrator (server authority); a DocType with no cancel row at all is the one case where Desk would show the explanation instead. |

## 7. Phase 27 — evidence per class

| Issue | Implemented | Tested with simulator or test doubles | Replayed from recorded real responses | Verified against an authenticated real session | Verified with actual writes |
|---|---|---|---|---|---|
| P2-1 form without permissions | `abb6a72`, `08d8721` | permissions-p27 §2, §3 | none | none | none |
| P2-3 workflow without roles | `064ce46` | permissions-p27 §5, §6; record-frappe | none | none | none |
| P2-4 Administrator without roles | `2b4a8ed`, `064ce46` | permissions-p27 §1, §4, §5 | permissions-p27 §7 (roles list, `get_doc_permissions`, import / export) | none | none |
| P3-1 Cancel All unknown | `abb6a72` | permissions-p27 §4 | none | none | none |
| P3-6 role-keyed Administrator | `2b4a8ed` | permissions-p27 §1; frappe-form R3-F1 | permissions-p27 §7 (another user's roles lack "Administrator") | none | none |

Still open: P2-2 (bulk delete partial failures), P2-5 (documented). BLOCKED as in §4: no permission-limited real user.
