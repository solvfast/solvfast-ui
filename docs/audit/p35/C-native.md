# Agent C — Architecture and native Frappe verification (READ-ONLY audit)

Subject: `@solvfast/ui` 0.6.0 at `/home/frappe/sfui-dev/p35-pkg` (DS paths below are relative to it).
Native reference: Frappe v15.110 at `/home/frappe/lovable_bench/apps/frappe/frappe` (`JS/` = `public/js/frappe/`).
Method: native source read for each behaviour first, then the DS implementation compared line by line. No file
edited except this report; no git, bench, install, build, DB or cache action. Nothing here was run against a site.

Verdict words: MATCHES · DIFFERS-INTENTIONALLY (where documented) · DIFFERS-BUG · NOT IMPLEMENTED · DOC-OVERCLAIM.

---------------------------------------------------------------------------------------------------------------------

## 0. Summary — top findings

| # | Finding | Verdict | Sev | Layer / fix |
|---|---|---|---|---|
| F1 | **Ctrl+S** mirrors `frm.save_or_update` (form.js:731-739), but Desk binds Ctrl+S to `frappe.app.trigger_primary_action` (ui/keyboard.js:187-196 → desk.js:389-403): blur the active input, then click the *visible primary button* (Submit on a clean submittable draft → confirm, Amend on a cancelled doc, nothing when workflow hid the buttons). DS (form/FrappeFormView.tsx:506-513): a clean draft gets "No changes in document"; Submit/Amend never reachable by keyboard; **ignores `saveDisabled`** (Desk's `save_or_update` and the hidden primary both respect it); new doc with `create` but not `write` → button shows Save but Ctrl+S does nothing; handler is on the form `<div>` so it only fires when focus is inside the form (Desk: document-level, `ignore_inputs: true`). Header comment (FrappeFormView.tsx:18) describes the wrong Desk function. | DIFFERS-BUG | Med | Frappe/form: make Ctrl+S call `runPrimary(actions.primary)` (respecting `saveDisabled`, `saving`, workflow-hidden), attach at `document` level while the form is mounted, blur active element first. |
| F2 | **Workflow action apply skips Desk's pre-steps**: form/workflow.js:96-121 runs `frappe.ui.form.check_mandatory(frm)` → `before_workflow_action` → `apply_workflow` → `after_workflow_action`. DS record/FrappeWorkflowActions.tsx:53 calls `w.apply()` directly; no `before/after_workflow_action` exist anywhere in `src/frappe` (grep). `mandatory_depends_on` is never enforced by the server, so a transition Desk blocks goes through. | NOT IMPLEMENTED | Med | Frappe/form: when FrappeForm renders the actions, run `checkMandatory` + `trigger("before_workflow_action")` (with `frm.selected_workflow_action`) before apply, `after_workflow_action` after. |
| F3 | **Saved-doc link titles dropped**: `getdoc` returns `_link_titles` ({"DocType::name": title}) for Link / Dynamic Link / child-table links whose target has `show_title_field_in_link` (desk/form/load.py:62, 425-480). DS `getDoc` (client.ts:379-385) keeps only `docs[0]` + `docinfo`; nothing seeds `useLinkTitles` / `formatContext.linkTitles` from a load (grep: no `_link_titles` reader). Saved forms show raw names for title-link doctypes until the user searches. services/format.ts:65 says the map comes from "getdoc's `_link_titles`" — it does not. | NOT IMPLEMENTED (+ doc overclaim) | Med | Frappe/client: return `res._link_titles` in `LoadedDoc`; `useDoc` seeds the link-title cache. |
| F4 | **"Create a new X" offered without rights**: link.js:323-334 requires `!df.only_select && frappe.model.can_create(doctype)` (boot `can_create`). DS form/services.tsx:76 defaults `canCreate` to `!!onCreateNew` — offered with no permission knowledge, contradicting the package's own rule 9 ("missing information denies"). | DIFFERS-BUG | Low-Med | Frappe/form services: default `canCreate` from `rolePermissions(meta.permissions, session.roles).levels[0].create` (Administrator → true), else false. |
| F5 | **Submitted + dirty shows Update AND Cancel**: toolbar.js:668-689 is an else-if chain — when `can_update()` the status is "Update" and Cancel is not rendered. DS form/model/actions.ts:47-49 computes Cancel independently. Clicking Cancel while dirty runs `frappe.desk.form.save.cancel`, which reloads from DB (save.py:51-60) and DS then `store.replace()`s — the user's `allow_on_submit` edits are silently discarded. | DIFFERS-BUG | Low-Med | Frappe/form model: `secondary = null` when `primary === "Update"`. |
| F6 | **In-app navigation loses unsaved edits**: Desk keeps a dirty doc in `locals` across route changes and only guards full unload (`beforeunload`, form.js:1351-1356, removed on refresh :383). DS keeps edits in component state (`createDocStore`, FrappeFormView.tsx:140) — unmount = loss, no prompt. `beforeunload` itself MATCHES (FrappeFormView.tsx:178-183). | DIFFERS (undocumented) | Med | Frappe/form: expose `isDirty`/`onDirtyChange` (exists) + document that the host router must block; optionally a draft cache keyed by doctype/name. |
| F7 | **`docs/FRAPPE.md` is 0.3-era and shipped** (`package.json` `files`): lists 4 endpoints (the package calls dozens — ~40+ distinct whitelisted methods), says rows come from `frappe.client.get_list` (FrappeListView uses `frappe.desk.reportview.get`, useFrappeList.tsx:294), "Writes are the app's", and "Not supported: child tables, realtime updates, Frappe's per-user list settings" — all contradicted by `FrappeChildTable`, `useListRealtime`, `createFrappeUserSettings`, bulk actions. `docs/LIMITATIONS.md` "Frappe layer" section repeats the same stale "Not supported" line and is titled "0.4.0 (pre-release)" in a 0.6.0 package. | DOC-OVERCLAIM / stale (both directions) | Med (consumer-facing) | Docs: rewrite FRAPPE.md endpoints/behaviour from client.ts header; delete stale "Not supported" bullets. |
| F8 | **Amend permission**: Desk `amend_doc` → `frm.copy_doc` → `validate_form_action("Create")` (form.js:1297-1298) so Desk needs amend **and** create; DS (FrappeFormView.tsx:493-500, actions.ts:51) checks amend only. `copyDoc` (form/model/copy.ts:36-66) also does not start from `get_new_doc` defaults (create_new.js:281-283) — `no_copy` fields of a Duplicate end up empty instead of their default — and does not reset `modified_by`/`lft`/`rgt` or set child `_amended_from` (:306-319). | DIFFERS-BUG | Low | Frappe/form model: apply `applyDefaults` before copying; gate Amend on create too. |
| F9 | **Boundary check ran on source only** (`dist/` not built): part B — including the rule that the Frappe entry never reaches `frappe/testing` (check-boundaries.mjs:128) — did not execute. Source-level grep confirms no non-testing module imports `testing/`, but no *source* rule forbids it (area `frappe` has `deny: [/^\.\.\/shell/]` only). | Gap | Low | scripts/check-boundaries.mjs: add a source rule "src/frappe/** (not testing) must not import ./testing". |

Everything else checked MATCHES or is a documented intentional difference (§1–§7).

---------------------------------------------------------------------------------------------------------------------

## 1. Architecture

| Check | Evidence | Verdict |
|---|---|---|
| Core never imports Frappe | `node scripts/check-boundaries.mjs` → "(dist/ not built yet — source rules only) ✔ boundaries OK", exit 0. Rules A cover lib, list/model, theme, primitives, cards, shell, list, toast, chart, form, fields, record, index.ts (scripts/check-boundaries.mjs:24-41). | MATCHES (source). Dist rules (B) NOT RUN in this audit — no build allowed. |
| Only `src/frappe` makes network calls | Rule at :49; grep of `fetch(`/XHR outside `client.ts` in `src/frappe`: none (realtime takes an app-made socket, services/realtime.ts:25). | MATCHES |
| Dependency injection | `createFrappeClient({ transport, files, fetch, csrfToken, session, baseUrl })` (client.ts:147-166, 456-511); `FrappeProvider` `client` prop; `withFrappeApi` upgrades a 0.3 custom client over its `call` (client.ts:517-529); `FrappeFormServices` overrides search/validate/format/canCreate/onCreateNew/evaluator (form/services.tsx:46-79); realtime is a `RealtimePort` from the app. | MATCHES. Note: `useFrappeClient()` silently falls back to a module-level same-origin singleton when no provider is present (FrappeProvider.tsx:24-27) — an implicit global; acceptable but worth documenting. |
| Simulator not imported by main entry | `src/frappe/index.ts:49` comment only; grep `from ".*testing"` outside `src/frappe/testing`: none. Dist rule exists (check-boundaries.mjs:128) but did not run. | MATCHES (source); see F9. |
| `src/frappe` → core imports | frappe imports theme/primitives/fields/list/record (allowed; only `../shell` denied). | MATCHES |

---------------------------------------------------------------------------------------------------------------------

## 2. API boundaries — endpoint per action

| Action | Native endpoint + args (citation) | DS (citation) | Verdict |
|---|---|---|---|
| Meta | `frappe.desk.form.load.getdoctype(doctype, with_parent, cached_timestamp)` → `docs` (load.py:64-81); also `user_settings` JSON string | client.ts:376, 473; useFrappeList.tsx:53 parses `user_settings` string | MATCHES |
| Load | `getdoc(doctype,name)`; missing → `docs: []` 200 (load.py:22-38); docinfo; `_link_titles` | client.ts:379-385 (404 synthesised for `[]`) | MATCHES except `_link_titles` → F3 |
| Save / Submit / Update | `frappe.desk.form.save.savedocs(doc JSON, action)` (save.py:15-47); queued submit returns nothing (:34-36) | client.ts:390-392; `savedDoc` falls back to `{...sent, __queued:1}` (client.ts:365-372) | MATCHES. Note: on a queued Submit the form still flashes "Submitted" (FrappeFormView.tsx:419) — UNVERIFIED path, Low. |
| Cancel | `frappe.desk.form.save.cancel(doctype,name,workflow_state_fieldname,workflow_state)` (save.py:50-60); Desk sends the state field+value when a workflow exists (save.js:39-52) | client.ts:393-398; FrappeForm.tsx:117-123 | MATCHES |
| Cancel pre-flight | `linked_with.get_submitted_linked_docs` → `_cancel_all` dialog → `cancel_all_linked_docs` → reload → `_cancel(skip_confirm)` (form.js:870-997) | FrappeForm.tsx:130-141; FrappeFormView.tsx:460-492 | MATCHES (sends no `ignore_doctypes_on_cancel_all`; Desk sends `frm.ignore_doctypes_on_cancel_all` — Low, no formEvent hook to set it). |
| Amend check | `frappe.client.is_document_amended(doctype, docname)` (client.py:425-432; toolbar.js:640-645) | FrappeForm.tsx:94-102 | MATCHES (Desk renders a disabled *secondary* button; DS disables primary — cosmetic). |
| Rename | Form title dialog: `frappe.model.rename_doc.update_document_title(doctype, docname, name, title, merge, enqueue:true)` (toolbar.js:116-200); menu Rename: `frappe.rename_doc(doctype, old, new, merge)` (model.js:733-779; __init__.py:1426) | `renameDoc` → `frappe.rename_doc` (client.ts:402-405) | MATCHES the menu path; the title-edit/queued path is NOT IMPLEMENTED (no form UI uses either). |
| Delete | form `frappe.model.delete_doc` → `frappe.client.delete` (JS/model/model.js:715); list `frappe.desk.reportview.delete_items` | client.ts:399-401; list/bulk.ts | MATCHES |
| Validate link | `frappe.client.validate_link(doctype, docname, fields)` → `{name, ...}`; `name` None = invalid (client.py:436-480; link.js:717-764) | client.ts:406-410; form/model/fetch.ts:48-56 | MATCHES |
| Link search | `frappe.desk.search.search_link(txt, doctype, ignore_user_permissions, reference_doctype, page_length, filters, query…)` (link.js:279-300; search.py:37-56); `label` only for `show_title_field_in_link` (search.py:253-275) | client.ts:490-502; FrappeLinkField.tsx:126-148 | MATCHES (page_length defaults to 10, not boot `link_field_results_limit` unless host passes it — Low) |
| Workflow | `get_transitions(doc)` (server filters roles + condition; workflow.py:38-71); `apply_workflow(doc, action)` reloads from DB (:100-150); `can_cancel_document(doctype)` (:153-162) | client.ts:419-425; record/workflow.ts:121-125 computes can_cancel locally from `__workflow_docs` (same logic) | MATCHES |
| Assign | `assign_to.add(args: assign_to JSON list, doctype, name, …)`, `remove(doctype,name,assign_to)` (assign_to.py:42-55, 176-179; sidebar/assign_to.js:300-312) | client.ts:426-438 | MATCHES |
| Comment | `frappe.desk.form.utils.add_comment(reference_doctype, reference_name, content, comment_email, comment_by)` (desk/form/utils.py:27-29) | client.ts:439-446 | MATCHES |
| List rows | `frappe.desk.reportview.get` with `doctype, fields, filters, order_by, start, page_length, view, group_by (child filters), with_comment_count` (base_list.js:460-478; list_view.js:547-556) | list/reportview.ts:39-47 | MATCHES (`view` is stripped server-side, reportview.py:22 — harmless as in Desk). DS also sends `or_filters`, which Desk's list never sends — package extension, supported by reportview. |
| Count | `frappe.db.count` → `reportview.get_count(doctype, filters, fields:[], distinct (child filter), limit 1001)` (db.js:97-117; list_view.js:1001-1030) | list/reportview.ts:53-60; useFrappeList.tsx:306, 377 ("1000+") | MATCHES |
| Group-by counts | `frappe.desk.listview.get_group_by_count(doctype, current_filters, field)` (listview.py:33-89; list_sidebar_group_by.js:96-118) | none | NOT IMPLEMENTED — documented (LISTVIEW-FRAPPE-PARITY §5.6, LIMITATIONS "group-by sidebar with counts") |
| List settings | `frappe.desk.listview.get_list_settings` read; `set_list_settings` write (list_settings.js) | list/settings.ts:22-28 read only | MATCHES read; write NOT IMPLEMENTED (documented) |
| User settings | `frappe.model.utils.user_settings.save(doctype, user_settings JSON)`; server does a **shallow top-level** `current.update()` (user_settings.py:30-45, 66-70) | list/storage.ts:74-109 | MATCHES. Coexistence risk: DS stores its extras under `List.sf_ui`; when the same user then uses Desk, `frappe.model.user_settings.save(doctype, "List", {...})` deep-extends the client copy, so `sf_ui` survives only if Desk's in-memory copy came from the server with it (it does — getdoctype returns it). Low. |
| Like | `frappe.desk.like.toggle_like` | FrappeListView.tsx:132-150 | MATCHES |
| Tags (form) | `frappe.desk.doctype.tag.tag.add_tag` / `remove_tag` (form sidebar) | only bulk `add_tags` (list) | NOT IMPLEMENTED in the form (Agent A scope) |
| Connections | `frappe.desk.form.linked_with.get` / `get_linked_doctypes` | none | NOT IMPLEMENTED — documented (matrix row 24 "no … Connections") |
| Email composer | `frappe.core.doctype.communication.email.make` | none | NOT IMPLEMENTED (no doc claims it) |
| Form print | `/printview`, `frappe.utils.print_format.download_pdf` | none in form; list uses `download_multi_pdf(_async)` (list/print.ts) | NOT IMPLEMENTED in form — documented (matrix row 24 "print") |

---------------------------------------------------------------------------------------------------------------------

## 3. Document states, lifecycle, toolbar

| Behaviour | Native (citation) | DS (citation) | Verdict / Sev |
|---|---|---|---|
| Primary action ladder | `get_action_status` (toolbar.js:668-689): Submit (ds0, saved, clean, `perm.submit`, no workflow) → Save (ds0, not `save_disabled`, with workflow only if dirty) → Update (ds1, dirty, submit) → Cancel (ds1, cancel) → Amend (ds2, amend). Then `set_page_actions` re-checks `frm.perm[0][action_perm_type_map[status]]` (:694-699; map form.js:62-70: Save→write) | form/model/actions.ts:39-56 | MATCHES for Submit/Save/Update/Amend ordering. Differences: F5 (Cancel shown with Update); Save on a **new** doc accepted with `create` alone (actions.ts:53, self-flagged UNVERIFIED) — Desk needs `write` (Low, server-correct since insert checks create). |
| Cancel under workflow | `frappe.model.workflow.can_cancel_document` (toolbar.js:713-722; workflow.py:153-162) | record/workflow.ts:121-125; FrappeFormView.tsx:389 | MATCHES |
| Cancel/Amend under workflow read-only | toolbar `can_cancel/can_amend` test `!this.read_only` (toolbar.js:605, 608) but `toolbar.read_only` is never assigned (only `frm.read_only`, form.js:412); `set_read_only` keeps `cancel` (form.js:1763-1774) → Desk still shows Cancel | `readOnlyPermissions` keeps read/cancel/share/print/email (services/permissions.ts:148-150) | MATCHES |
| Workflow hides Save/Submit/Cancel | `setup_btn` hides btn_primary + btn_secondary when ≥1 action added (form/workflow.js:131-138); actions not shown while `__unsaved` (:80-82) | FrappeForm.tsx:148-150, `formActions` returns none when `workflowActionsShown && !dirty` (actions.ts:40); `useWorkflow` fetches transitions only for saved clean docs (record/useWorkflow.ts:52-59) | MATCHES |
| Transition filter | server roles+condition; client again `frappe.user_roles.includes(allowed) && has_approval_access` (form/workflow.js:84-103) | record/workflow.ts:91-96 | MATCHES |
| Workflow default state for a new doc | `set_default_state` sets `state_field` = first state with matching doc_status (form/workflow.js:60-66, 140-148) | not set client-side (grep) — server fills `states[0].state` (workflow.py:183-186) | DIFFERS-BUG, Low (differs only when `states[0].doc_status != 0`; also the new doc lacks the state value until save) |
| Submit flow | `savesubmit`: confirm "Permanently Submit {0}?" → `before_submit` → `save("Submit")` (runs `validate`, `before_save`, check_mandatory) → `after_save` → `on_submit` (form.js:825-867, 756-822) | FrappeFormView.tsx:396-431 | MATCHES |
| Update flow | `save("Update")` skips validate/before_save (form.js:799-822) | FrappeFormView.tsx:405 | MATCHES |
| Clean Save | save.js:20, 34-37 "No changes in document" (only for action Save) | FrappeFormView.tsx:398 | MATCHES |
| Cancel flow | pre-flight, confirm, `before_cancel`, cancel, `after_cancel` (form.js:870-997) | FrappeFormView.tsx:433-492 | MATCHES |
| Amend | needs `amended_from` field; `is_document_amended`; copy with `from_amend`, `amended_from`, `amendment_date` (form.js:1011-1038; create_new.js:281-320) | form/model/copy.ts:68-75 | MATCHES except F8 |
| `amended_from` naming | server `_get_amended_name` (`name-1`, `-2`) | DS sends `amended_from`; naming server-side | MATCHES (by delegation) |
| Read-only after submit + `allow_on_submit` | perm.js:225-235 | services/permissions.ts:199-200 | MATCHES |
| Cancelled doc | mandatory check skipped for ds2 (save.js:124); fields Read | mandatory.ts:86; ladder step 4 | MATCHES |
| Not Saved indicator | `frappe.get_indicator` returns "Not Saved" orange for `__unsaved` (indicator.js:27-29); title dirty (toolbar.js:767-775) | services/indicator.ts:100-123 (same precedence: workflow → Draft → Cancelled → meta.states → hook → Submitted → status → enabled/disabled) | MATCHES |
| Ctrl+S | see F1 | | DIFFERS-BUG Med |
| Ctrl+B (New), Ctrl+E, Ctrl+J, Shift+D, Ctrl+P, Shift+Ctrl+D, prev/next record, Undo/Redo | toolbar.js:340-539 menu items with shortcuts; form.js:137-218 | none (no form menu) | NOT IMPLEMENTED — partly documented (matrix row 24: no undo, Duplicate, print, rename, prev/next). Ctrl+B / Email / Jump-to-field / Reload / Delete / Remind Me not listed anywhere. Low. |
| Collapsible sections | collapsed unless `collapsible_depends_on` true; forced open if a `reqd` field `== null` (layout.js:463-482; section.js:146-156) | form/model/depends.ts:134-142 | MATCHES, except DS also treats `""` / `[]` as missing (`isEmptyValue`), native tests `== null` only. Low. |
| Post-save docinfo | `send_updated_docs` returns fresh docinfo in the save response (save.py:63-72) | `savedDoc` drops it, `applySavedDoc` invalidates `docinfo` → extra `get_docinfo` request (services/cache.ts:22-31). For a doc created in a `FrappeForm` without `name`, no docinfo is observed after the first save (FrappeForm.tsx:78, 113) → perms = role rows only. | MATCHES (one extra round-trip); Low edge for newly created docs. |

---------------------------------------------------------------------------------------------------------------------

## 4. Permissions

| Behaviour | Native (citation) | DS (citation) | Verdict |
|---|---|---|---|
| Role perms per permlevel | `get_role_permissions` (perm.js:122-153): right at a level if any role grants; `rights_without_if_owner` at level 0 | services/permissions.ts:30-45 | MATCHES |
| Saved doc overlay order | docinfo.permissions onto level 0 → strip if_owner-only rights for non-owners → shared row adds read/write/submit/share (+ email/print from boot when shared read) → read via boot `can_read` (perm.js:69-115) | permissions.ts:137-144 | MATCHES; boot-derived email/print-on-share and `can_read` fallback not reproduced — documented (permissions.ts:98-99). |
| `docinfo.permissions` meaning | `get_doc_permissions`: role perms with `is_owner`, submit=0 if not submittable, import=0 if not allow_import, if_owner overlay, user-permission failure → if_owner-only or {} (permissions.py:196-248) | used as level-0 truth when roles unknown (permissions.ts:126-135); `canImport` never reads it (:257) | MATCHES |
| Administrator | server: every right (permissions.py:107-109, 273-275); Desk UI: user_roles = all roles, so only rights some DocPerm row grants | DS grants every right at every level (permissions.ts:118-124) | DIFFERS-INTENTIONALLY (documented permissions.ts:100-102): DS may show e.g. Delete/Cancel to Administrator where no DocPerm row grants it and Desk would not. Low. |
| Field display ladder | perm.js:191-267 (step 6 workflow is a no-op); control layer: grid Read inheritance unless `allow_on_submit`, blank Read → None except HTML/Image/Button/Geolocation, not for `only_input` (JS/form/controls/base_control.js:100-130) | permissions.ts:185-225 | MATCHES |
| Workflow read-only | `is_read_only`: saved doc whose state's `allow_edit` roles ∩ user roles = ∅ (model/workflow.js:53-70) → `set_read_only` | permissions.ts:159-167, hooks/usePermissions.ts:43-48 | MATCHES (rule 9: no roles → read-only, documented). |
| `workflowLockedFields` | — (perm.js:242-252 never changes status; state field read-only only by its own df) | record/workflow.ts:115-118 exported, comment attributes it to "display-status step 6" | INCORRECT ASSUMPTION in an exported helper (unused internally). Low — fix comment or remove. |
| User permissions on link search | server-side in `search_widget` unless `ignore_user_permissions` (search.py:186); Desk sends `df.ignore_user_permissions` (link.js:289-291) | FrappeLinkField.tsx:139 | MATCHES |
| User-permission defaults on new doc | `get_default_value`: User Permission `is_default` / single allowed record, user defaults (ignored when `df.ignore_user_permissions`), `remember_last_selected_value` (create_new.js:131-186) | form/model/defaults.ts:57-64 uses host `userDefaults` only; does not honour `ignore_user_permissions` for the per-DocType default | DIFFERS, documented UNVERIFIED (defaults.ts:4-6) except the `ignore_user_permissions` case — Low. |
| `if_owner` | perm.js:82-88 | permissions.ts:40, 141 | MATCHES |
| Report/import/export/print/email/share rights | DocPerm columns; `can_import` / `can_export` (model.js:434-450; permissions.py:599-615) | permissions.ts:262-281 | MATCHES |

---------------------------------------------------------------------------------------------------------------------

## 5. Metadata contracts (docfield properties)

| Prop | Native semantics (citation) | DS (citation) | Verdict |
|---|---|---|---|
| `depends_on` | `eval:` via `frappe.utils.eval` with `{doc, parent}`; plain fieldname → truthiness, arrays by length; `fn:` → script_manager; invalid → `frappe.throw` (layout.js:751-791) | form/model/depends.ts:55-81, 116-127 | MATCHES for syntax. DIFFERS-INTENTIONALLY (D-23, LIMITATIONS "18 of 947 unsupported"): an expression outside the interpreter subset (e.g. `frappe.user.has_role(...)`, `frappe.session.user`, `moment`) evaluates **false → field hidden** and is listed in an on-screen note. Hosts must pass `evaluator.globals` (`frappe`) to cover them. |
| `mandatory_depends_on` / `read_only_depends_on` | set df `reqd` / `read_only` to 1/0, **replacing** the static value (layout.js:701-747) | depends.ts:122-123 | MATCHES. Matrix row 29 says "`read_only_depends_on` TODO" — stale (it is implemented). |
| `collapsible`, `collapsible_depends_on` | layout.js:463-482 | depends.ts:134-142 | MATCHES (see §3 `== null` nuance) |
| `fetch_from` / `fetch_if_empty` | fetch map for listed fieldtypes or read_only/virtual (script_manager.js:194-235); client writes every target unconditionally; read-only while link set unless `fetch_if_empty` (base_input.js:56-62) | form/model/fetch.ts:18-65 | MATCHES |
| `permlevel` | perm.js:211 | permissions.ts:190 | MATCHES |
| `allow_on_submit` | perm.js:231-235; grid cells inherit table Read | permissions.ts:200, 222 | MATCHES |
| `in_list_view`, `in_standard_filter` | list columns / standard filters | meta.ts, useFrappeList.tsx | MATCHES (Agent B detail) |
| `allow_in_quick_entry` / quick entry | `make_quick_entry` from link "Create a new" (link.js:175-206) | not referenced anywhere (grep) — `onCreateNew` delegated to host | NOT IMPLEMENTED — documented only as "the app's `onCreateNew` writes back" (FrappeLinkField.tsx:18). |
| `bold` | label/value bold | FrappeField.tsx / FieldShell.tsx reference it | MATCHES (presence) |
| `print_hide`, `image_field`, `translated_doctype` | print; form header image; `__()` on link labels / search (link.js:111-116; search.py:151, 256) | typed in contract.ts only | NOT IMPLEMENTED (image_field, translated_doctype). Low. |
| `ignore_user_permissions` | link search + defaults | link search yes, defaults no | see §4 |
| `search_fields`, `title_field`, `show_title_field_in_link` | search; title; link label (search.py:166-167, 261-271); `_link_titles` on load | list search uses them; label from search remembered (linkTitles.ts) | PARTIAL → F3 |
| Dynamic Link | options = fieldname holding the DocType | FrappeDynamicLinkField (form); list maps it to text (FRAPPE.md "What comes from the DocType") | MATCHES (different layers, both documented) |
| Table MultiSelect | first `Link` field of the child DocType (table_multiselect.js:30-41, 59-66) | FrappeTableMultiSelect.tsx:45 | MATCHES |
| Mandatory check | `check_mandatory`: parent + every row, `reqd` or `mandatory_depends_on` (eval errors throw), Prompt `__newname`, grouped table messages, skip ds2 (save.js:120-301) | form/model/mandatory.ts:55-136 | MATCHES (incl. `fn:` → not required, "every row" precedence). |
| New-doc defaults | create_new.js:131-230 | form/model/defaults.ts | MATCHES except user-permission defaults (documented) |
| Local names | `new-<slug>-<10 random>` (create_new.js:77-80); savedocs relinks attachments by that prefix (save.py:20-22) | fieldtypes.ts:30 | MATCHES |

---------------------------------------------------------------------------------------------------------------------

## 6. Link / grid / other interactions

| Interaction | Native | DS | Verdict |
|---|---|---|---|
| Link validate + fetch on change | link.js:709-764 | FrappeLinkField + fetch.ts | MATCHES |
| Default Link values of a new doc run link triggers | `__run_link_triggers` (form.js:569, 1103-1112) | FrappeFormView.tsx:213-233 | MATCHES |
| Link "Create a new X" | `can_create` + not `only_select` → quick entry / full form with `name_field` (link.js:175-206, 323-334) | F4; quick entry delegated | DIFFERS-BUG (F4) / NOT IMPLEMENTED (quick entry) |
| Grid keyboard | Ctrl+Up/Down add row, Ctrl+Shift+Up/Down top/bottom, Shift+Alt+Down duplicate (form.js:173-218) | fields/DataGrid.tsx:118-127 | MATCHES (arrow / tab cell navigation: Agent A scope) |
| Dirty + beforeunload | form.js:1351-1356 | FrappeFormView.tsx:178-183 | MATCHES; F6 for in-app nav |
| Liked by me | toggles a visible `_liked_by like %user%` filter pill (list_view.js:1440-1454) | FrappeListView.tsx:118-150 folds it into base filters | MATCHES (request); filter not shown as a pill — cosmetic |
| Assigned-to / Created-by sidebar with counts | list_sidebar_group_by.js + `get_group_by_count` | none | NOT IMPLEMENTED — documented |
| Count "20 of 120", "1000+" click-to-count, `disable_count` | list_view.js:655-685, 1001-1030 | useFrappeList.tsx:302-306, 377 | MATCHES (Agent B for label text; "(N rows with children)" variant not checked) |
| `disable_comment_count` | `with_comment_count` 0/1 (list_view.js:547-556) | reportview.ts:43; useFrappeList.tsx:183 | MATCHES |
| `disable_sidebar_stats` | sidebar stats off | no sidebar | N/A |
| `disable_auto_refresh` + realtime `list_update` | subscribe, ignore other doctypes / checked rows / filter editing / bulk, debounce 2 s / 15 s large table, then re-fetch only the changed names (list_view.js:28-33, 1476-1599) | list/realtime.ts:15-39; FrappeListView.tsx:169 | MATCHES except: full list+count invalidation instead of by-name fetch (documented UNVERIFIED), and no "filter area being edited" suppression. Low. |
| `disable_automatic_recency_filters` (large tables) | list_view.js:118-130 | typed in settings.ts:14; usage not verified here | Agent B |

---------------------------------------------------------------------------------------------------------------------

## 7. Documentation claims vs code

| Claim (file) | Reality | Verdict |
|---|---|---|
| FRAPPE.md "Endpoints" table (4 methods), rows via `frappe.client.get_list`, "Writes are the app's", "Not supported: child tables, realtime, per-user list settings" | reportview.get for rows; dozens of methods (~40+); bulk writes built in; FrappeChildTable, useListRealtime, createFrappeUserSettings exist | DOC stale / under- and over-claims (F7). Shipped in the npm `files`. |
| LIMITATIONS.md title "0.4.0 (pre-release)"; "Frappe layer → Not supported: child tables, …, realtime updates, … per-user list settings" | contradicted by the same file's §"Frappe layer 0.4.0 — status" ("Realtime is a skeleton") and by code | DOC inconsistent (F7) |
| FrappeFormView.tsx:18 "Ctrl/⌘+S saves (or updates)" presented as Desk behaviour | Desk Ctrl+S = trigger primary action | Incorrect assumption (F1) |
| services/format.ts:65 linkTitles "getdoc's `_link_titles`" | never read from getdoc | Overclaim (F3) |
| record/workflow.ts:115 "display-status step 6" locks state/update fields | step 6 is a no-op (perm.js:242-252) | Incorrect assumption (Low) |
| COMPONENT-COMPLETION-MATRIX row 29 "`read_only_depends_on` TODO" | implemented (depends.ts:123) | Stale (under-claim) |
| COMPONENT-COMPLETION-MATRIX row 32 "IMPLEMENTED" for workflow actions | missing check_mandatory + before/after_workflow_action (F2) | Mild overclaim |
| LISTVIEW-FRAPPE-PARITY §4 Realtime "IMPLEMENTED" with "Full reload … (UNVERIFIED)" | accurate | OK |
| LIMITATIONS: group-by sidebar, Report/Kanban/Calendar, Client Scripts, 18 unsupported expressions, rule 9 | accurate | OK |
| `docs/release/PERMISSION-AUDIT.md` | not re-audited line by line; its model (rule 9, Administrator = every right, docinfo overlay) matches services/permissions.ts as verified in §4 | OK as far as checked |

---------------------------------------------------------------------------------------------------------------------

## 8. Incorrect assumptions found (condensed)

1. Ctrl+S = `save_or_update` (it is `trigger_primary_action`) — F1.
2. Update and Cancel can coexist on a dirty submitted doc (Desk's ladder is exclusive) — F5.
3. "Leaving the page while dirty asks first" covers in-app navigation (only full unload) — F6.
4. Amend needs only `amend` (Desk also validates `Create`) — F8.
5. A Duplicate/Amend copy needs no defaults (Desk starts from `get_new_doc`) — F8.
6. Workflow update fields / state field are locked by the display ladder — §4.
7. Link titles of a loaded doc are available to the format context — F3.
8. "Create a new X" may be offered when only the callback is known — F4 (contradicts rule 9).
9. Section "missing mandatory" includes empty strings (native `== null`) — §3, Low.

Not wrong, but worth stating: the in-package `depends_on` interpreter is fail-closed (hidden) for anything outside its subset;
an ERPNext-style DocType with `eval:frappe.user.has_role(...)` hides fields Desk shows unless the host supplies
`evaluator.globals`. This is documented (D-23) but has user-visible impact.
