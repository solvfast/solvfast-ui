# Caveats of the simulated backend (`@solvfast/ui/frappe/testing`, `createFixtureTransport`)

Owner: A6 (QA). Reviewed against `src/frappe/testing/fixtureTransport.ts` (0.4.0-dev.7) and the native source
(Frappe 15.110.0, `/home/frappe/lovable_bench/apps/frappe`). Purpose: text for the docs that ship with the simulator so a
reader cannot mistake "it works against the simulator" for "it behaves like Frappe". Status vocabulary of the contract:
results on this backend are **Simulated & tested**, never **Verified against real Frappe**.

## Suggested banner (for README / docs/FRAPPE.md / the CRM's simulated mode)

> The simulated backend reproduces request and response **shapes** only. By default it has no users, roles or permissions
> (the session user may do everything); the opt-in `permissions` option (§4, Phase 27) APPROXIMATES the server's
> permission decisions for one session — still simulated. It has no link, select, format or length validation, no server-side fetch_from, no
> naming series shared across DocTypes, no workflow conditions or self-approval, no View Log, File or
> Notification records. A green test here says the component builds the right requests and renders the right shapes. It
> says nothing about what Frappe will accept, reject, rename or hide.

## 1. Where it could be mistaken for native

| Area | Simulator | Native (evidence) | Misleading because | Parity scenarios it cannot answer |
|---|---|---|---|---|
| **Permissions** | default: `docinfo.permissions` is always every right (submit/cancel/amend only if submittable); no roles, `permlevel`, `if_owner`, User Permissions, DocShare; `update_comment` allows the single session user only. **Opt-in `permissions` (Phase 27): see §4** — roles × DocPerm rows, `if_owner`, User Permissions, DocShare, permlevel stripping, 403s, approximated | server evaluates roles, owner, user permissions, shares (`permissions.py:196-307`); unreadable permlevel fields are ABSENT (`document.py:754-781`); `getdoc` 403 carries `_error_message` (`load.py:40-45`) | every button shows, every field is Write, no field is ever absent, 403 never occurs, "read-only user" cannot be simulated | M-03..M-08, T-08, H-05, S-04 |
| **Naming** | `field:`, `naming_series:`, `format:` and `#` handled by regex; counters are per DocType and per prefix; `format:` with `{YYYY}`, `{MM}`, `{fieldname}` is NOT expanded (braces are stripped, so `INV-{YYYY}-{####}` becomes `INV-YYYY-0001`); `Prompt`/`autoincrement`/`By script` unsupported; default is a random 10-char hash | `make_autoname` / `_format_autoname` (`model/naming.py`), counters in `tabSeries` keyed by prefix and shared across DocTypes, rolled back on failure | names in screenshots look native but are not; two DocTypes sharing a prefix would collide natively and not here | F-07, C-06 |
| **New vs existing document** | a document with a `name` that is not stored is INSERTED even without `__islocal`; child rows with no `name`, `__islocal`, or a `new-…` name are re-named and kept | native: a posted doc with a name but no `__islocal` goes through `save()` and fails (`DoesNotExistError`); a child row with a client-invented `name` and no `__islocal` is UPDATEd, matches nothing and is silently not saved (`base_document.py:618-620`; checklist C-06) | **masks the exact bug class a form can have**: a form that invents row names passes here and loses rows on a real site | C-06, F-07 |
| **Validation** | static `reqd` (parent and rows), timestamp, docstatus transitions, "not submittable" only | also link existence (`LinkValidationError`), selects, Email/Name/Phone/URL/IBAN, length, `non_negative`, `unique`, `set_only_once`, permlevel resets, `allow_on_submit`/`UpdateAfterSubmitError`, server `fetch_from` overwrite, workflow state validation, order links -> hooks -> mandatory (`document.py:380-437`, `base_document.py:775-1000`) | saves almost always succeed; error kinds `link`, `validation`, `duplicate`(unique) are never produced by validation, only by hand-fed envelopes | F-08, F-10, C-15, C-16, W-07 |
| **Update after submit** | any field of a submitted document can be changed with action `Update` | only `allow_on_submit` fields (`document.py:932`) | "Update" always looks permitted | F-09 |
| **Timestamp** | compared only when the client sends `modified`; `modified` has fake microseconds (always `…000`); children are not compared | `check_if_latest` (`document.py:850`) with real microseconds | conflict tests pass with string compare only | F-12 |
| **Messages** | success sends a green `alert` message "Saved"/"Cancelled"; mandatory lists one message per field with no `raise_exception` | native: `Saved`/`Submitted` alert (`save.py` end); mandatory msgprints each field, then `MandatoryError "[DT, name]: f1, f2"` | wording and count differ; `visibleMessages` filtering is never exercised by the simulator's own errors | T-04 |
| **`getdoc`** | `_link_titles` is always `{}`; no `__onload`; no `_seen`/View Log writes; `communications`, `attachments`, `shared`, `views`, `milestones` are always empty; `versions` exist for `track_changes` DocTypes (A1, dev.21+: native `{changed, added, removed, row_changed}` shape, values formatted like the server's `get_formatted` — an approximation of `frappe/utils/formatters.py` + `fmt_money`, not the server itself) | titles for title-link doctypes (`load.py:55-60`), `__onload`, `track_seen`/`track_views` side effects, Version rows from `track_changes` | link-title and timeline-version rendering cannot be tested; the `real-ro` vs `real-rw` distinction of `getdoc` is invisible | C-01, H-02, H-03, H-07 |
| **`getdoc` of a missing name** | returns `{docs: []}` | same (`load.py:33-38`); `get_docinfo`/`frappe.client.get` of a missing name return 404 in both | (accurate - keep) | T-03 |
| **reportview / get_list** | `get` returns `[]` when there are no rows and `{keys, values, user_info}` otherwise (accurate); `_comment_count` is appended whenever `with_comment_count` is 1; `user_info` is `{fullname: <the email>, image: null}` for every `_assign` user | native adds `_comment_count` per `list_view`/`reportview.py` rules (doc 14: UNVERIFIED when `_comments` not selected); `user_info` has real full names and images | avatars show emails; a list that depends on `_comment_count` without selecting `_comments` works here | L-01, L-06 |
| **Filters and sort** | supported operators: `= != like not like in not in > < >= <= between timespan is`; others (`ancestors of`, `descendants of`…) throw `ValidationError`; sort via `localeCompare`; timespan windows are Monday-first and computed in the browser's local zone; `like` is a case-insensitive JS regex | MariaDB collation, nested-set operators (`db_query.py:794-840`), site first-day-of-week, server date (`data.py:734-820`) | tree filters fail only here; ordering of accented/Arabic text and week boundaries differ | L-03, L-04, L-05 |
| **Count** | `get_count` / `reportview.get_count` count the in-memory rows, cap at `limit`; `distinct` is ignored | `select count(*) from (…limit)`; distinct for child filters (`reportview.py:53-72`) | child-table filter counts are plausible but not parent-distinct | L-02 |
| **search_link** | substring match on `name`, title and `search_fields` of any field type; names starting with the text first; `enabled`/`disabled` filters honoured; no `idx desc` popularity, no position relevance, no translated-doctype path, `reference_doctype`/`ignore_user_permissions` ignored; `query` (custom) ignored | `search.py:131-232` (LIKE on text-like types only, relevance by position, link-count `idx`, user-permission filtering) | ranking looks right on small data and is not | C-01, M-08 |
| **validate_link** | case-insensitive canonical `name` or `{name:null}`; any requested field is returned | permission check and "Cannot Fetch Values" for unreadable fields (`client.py:443-485`) | never exercises the read-denied branch | T-13, C-02 |
| **Workflow** | roles filter only if `options.roles` is passed (default: all roles allowed) — with `permissions` by the evaluated roles, plus the read check and the self-approval check (§4); `condition` is not evaluated; no self-approval check by default; no `allow_edit` read-only; no `WorkflowPermissionError`; error class for a bad action is `WorkflowTransitionError` (this one is correct, `model/workflow.py:21,114`); posted edits are discarded on `apply_workflow` (correct); a Workflow comment is added (Desk does too) but no Workflow Action row | `get_transitions` filters role, condition, state (`workflow.py:39`); `has_approval_access` (`:116,221`); `validate_workflow` (`:166`) | every transition is always offered; conditions such as `doc.amount < 1000` never hide anything | W-01..W-04, W-07, M-07 |
| **Assignment** | by default any user can add/remove/close; `close` does not check the assignee; no sharing, no `check_permission` (with `permissions`: read check, read share for an assignee without read, assigner's share right, assignee-only close — §4); no Notification Log/follow; the "Assigned" / "Assignment Completed" comment texts follow `todo.py validate` with full names (A1, dev.21+); `add` returns max 5 (correct) and the duplicate message is a normal server message (correct) | `assign_to.py:43-232` | S-04/S-05 behaviour (share, assignee-only close) is invisible | S-04, S-05, S-07 |
| **Comments** | `add_comment` trusts `comment_email`/`comment_by` (as native); `update_comment` checks the single user; **no delete permission model by default** (`frappe.client.delete` of a Comment always works; with `permissions`: the Comment rows of `comment.json` and read on the document, §4) | owner-or-Administrator edit; delete needs `Comment` delete right (System Manager/Website Manager, `comment.json`) | an ordinary owner can delete here and not in Desk | H-04, H-05 |
| **Files** | `files.upload` accepts only a Data Import's file (kept in memory for the simulated preview / job, §4.1b) and refuses the rest (417); no `remove_attach`, `attachments` stay `[]`; `files.download` answers `download_template`, `download_multi_pdf`, `export_query` and the Data Import logs with text files labelled SIMULATED that carry labels, counts, row numbers and the request echo — never document values (permission-checked with `permissions`, §4) | `handler.py:175-263`, `utils.py:19-23` | attachment UI cannot be exercised | H-07 |
| **Realtime** | none from the simulator | `doc_update`/`list_update`/`docinfo_update` | conflict banners and list refresh never trigger | F-12, L-10, H-06 |
| **Bulk / delete / rename** | `delete` ignores links (`LinkExistsError`); the submitted check exists; permissions only with `permissions` (§4: delete right, rename write right, `delete_items` failures published as the realtime msgprint into `store.published`); rename does not check `allow_rename` or rewrite links | `delete_doc.py:60-150` (`check_if_doc_is_linked`, submitted check); `rename_doc` | delete/rename always succeed | F-09, L-08 |
| **Users and session** | one session user (`backend.user`, default Administrator; `permissions.user` when given); Administrator bypasses every native check, so a permission model hides errors when the simulated user is Administrator — use the non-Administrator scenarios of §4 | `permissions.py:107-109` | the default user is the one that never sees a permission error | M-*, T-06 |

## 2. What the simulator does well (safe to rely on for shapes)

- Error bodies are built as Frappe builds them (`exc_type`, double-JSON `_server_messages`, status) and parsed by the client's
  own `toFrappeError`, so `kind`, `messages` and `status` are exercised exactly as over HTTP.
- `getdoc` of a missing name returns `[]`; `reportview.get` returns `[]` for no rows and the compressed
  `{keys, values, user_info}` otherwise; `get_count` honours `limit`; `Field not permitted in query` is a `DataError`.
- `apply_workflow` reloads from the store and discards posted edits; `WorkflowStateError` for an unset state.
- `assign_to.add` returns at most 5 rows; duplicates come back as a server message, not an error.
- Docstatus transitions and the "Cannot edit cancelled document" refusal.

## 3. Rules for anyone reporting on it

1. Say "Simulated" in every report that used it (contract §4). Never "verified" or "native".
2. Do not use it to settle a parity checklist item whose **Tag** is `real-ro`, `real-rw` or `isolated`; use it only for `sim`
   items, and only for shapes and client logic.
3. When a simulated run passes and the area appears in section 1, add the real-site follow-up to the report ("unverified:
   permissions, validation, naming").
4. For permission-sensitive UI, build the test on `buildDocPermissions`/`fieldDisplayStatus` with explicit levels (as
   `tests/parity/display-status.test.ts` does). The opt-in permission model (§4) adds server-side refusals and stripped
   values to a simulated run; it is an approximation, so permission parity items still need a real site.
5. Suggested hardening for the simulator (A1/Lead decision, none required for shape tests): expand `{YYYY}`/`{MM}`/`{field}` in
   `format:`; reject a stored-name-less document that lacks `__islocal`; keep client-invented child names when `__islocal` is
   absent so the C-06 failure reproduces; add an optional `strict` mode that validates Link existence, Select options and
   Data formats; make the default `roles` explicit (no roles = deny, not allow); return real `user_info` names.

## 4. Opt-in permission model (`createFixtureTransport(backend, { permissions })`, Phase 27)

Source: `src/frappe/testing/permissions.ts` (the evaluator) wired into `fixtureTransport.ts`; tests:
`tests/sim-permissions.test.tsx`. Status: **Simulated & tested**. It is an approximation of Frappe 15.110 rebuilt from the
source; it has never been compared with a site. Without the option the simulator is unchanged (full suite green).

`permissions = { user, roles?, userType?, userPermissions?, shares?, users?, hooks?, strictUserPermissions?,
disableSharing?, clientRoles? }`. Named builders: `simScenario.administrator / fullAccess / readOnly / restrictedDoctype /
restrictedFields / userPermissions / unknownRoles` — the NAME states the intent, the rights come from the DocType's DocPerm
rows × the roles passed. `transport.store.session` is the `FrappeSession` the CLIENT should get (roles as `get_roles` lists
them, or none for `clientRoles: "unknown"`); `transport.permissions` exposes the evaluator.

### 4.1 Rules reproduced (with the native lines)

| Rule | Native | Simulator |
|---|---|---|
| Roles of a user | `get_roles` `permissions.py:497-528`: Guest → [Guest]; Administrator → every Role; else Has Role + All + Guest (+ Desk User for a System User) | same; "every Role" = the roles named in the site's DocPerm rows, workflows and declared users; the user type comes from `userType`, else the stored User, else System User |
| Administrator user | `has_permission` `:107-109`, `get_role_permissions` `:273-275`, `apply_fieldlevel_read_permissions` `document.py:756-757` | every check passes, nothing stripped; `docinfo.permissions` still zeroes submit / import for non-submittable / non-importable DocTypes (`:217-221`) |
| Role rights at level 0 + `if_owner` | `get_role_permissions` `:251-310` | same, incl. "only read / select stay for if_owner-only rights" and create never owner-bound |
| Document rights (`docinfo.permissions`) | `get_doc_permissions` `:196-250` via `load.py:129` | same: controller hook, submittable / importable, if_owner overlay, User Permission denial → owner's if_owner rights (no create) or `{}`; `{"null": 0}` when a hook denies with `ptype` None (ToDo, reproduced) |
| `has_permission` | `:77-193` | same order: Administrator, sharing disabled for `share`, child DocType via the parent, doc / DocType rights, then DocShare (`false_if_not_shared` `:162-187`: read / write / share / submit, email / print via read, `everyone` rows except for Guest) |
| User Permissions | `has_user_permission` `:320-433` (STEP 1 on the DocType's own names; STEP 2 every Link field of the doc and its child rows; `applicable_for` `:741-752`; empty values pass unless strict) | same (tree `hide_descendants` / create-under-parent not simulated); `strictUserPermissions` = System Settings "Apply Strict User Permissions" |
| Controller hooks | `has_controller_permissions` `:436-454`, `permission_query_conditions` `db_query.py:1125-1138` | only what you declare in `hooks` (can only deny), plus the built-in ToDo pair (`todo.py:148-171`) |
| `getdoctype` | no permission check (`load.py:62-79`) | meta loads for every scenario |
| `getdoc` | `load.py:22-61`: missing → `check_doctype_permission` then `[]`; unreadable → `check_doctype_permission` ("No permission for X"), else 403 "Insufficient Permission for X name" with the check logs | same bodies (`_error_message` + `_server_messages`) |
| `get_docinfo` / `frappe.client.get` | `load.py:103-105` bare PermissionError; `client.py:93-111` `check_permission` | same |
| Save / insert / submit / cancel | `insert` create `document.py:300`; `_save` write `:404`; `check_docstatus_transition` `:880-915` (0→1 and 1→1 submit, 1→2 cancel); failure via `_handle_permission_failure` `:245-258` (DocType-level "No permission for X" first, else "You need the 'p' permission on X name …") | same, on the POSTED doc (owner, Link values); a new doc is checked without a name (`set_local_name` `save.py:75-84`) |
| permlevel values on read | `apply_fieldlevel_read_permissions` `document.py:754-781`; getdoc serialises `as_dict(no_nulls=True)` (`utils/response.py:225-226`) | getdoc: keys ABSENT; `savedocs` / `cancel` (`send_updated_docs` `save.py:62-70`) and `frappe.client.get`: keys present as null; `client.insert` / `save` / `set_value` / `apply_workflow` answer `as_dict()` WITHOUT stripping (`client.py:203-246`, `workflow.py:99-153`) — reproduced |
| permlevel values on write | `validate_higher_perm_levels` `document.py:783-806`, `reset_values_if_no_permlevel_access` `base_document.py:1263-` | values of levels the roles cannot WRITE are reset to the stored ones (child rows by name; new rows untouched) or, on a new doc, to the field default |
| Lists (`reportview.get / get_list / get_count`, `client.get_list / get_count`, `get_value`, `search_link`) | `check_read_permission` `db_query.py:135, 566-585` (select-only → `select`); `build_match_conditions` `:993-1057` (no read + no User Permission on the DocType → shared names only or 403 "No permission to read X"; if_owner-only read → owner = user `:1024-1028`, `requires_owner_constraint` `:1445-1462`; User Permissions `add_user_permissions` `:1065-1123` incl. `name` and `reference_doctype`; hook conditions ANDed; shared names ORed `:1051-1052`) | same row predicate; `search_link` passes `reference_doctype` and honours `ignore_user_permissions` (`search.py:185-204`) |
| Columns of lists | `apply_fieldlevel_read_permissions` `db_query.py:668-760`, `get_permitted_fields` `model/__init__.py:216-261`, `get_permitted_fieldnames` `meta.py:589-631` | unreadable columns are dropped (absent from `keys`), `*` expands to permitted columns; core DocTypes (User, …) and DocTypes without rows unrestricted; select-only → search fields; level 0 added when a doc is shared |
| Delete | `check_permission_and_not_submitted` `delete_doc.py:240-256` | delete right (Administrator exempt) before the submitted check; Comments use `comment.json` rows |
| `delete_items` | `reportview.py:575-616`: each item, retried once, failures by REALTIME msgprint | same; the msgprint goes to `store.published`, the answer is `{}` |
| Rename | `rename_doc.py:378-388` write (and merge target) | same message (417) |
| `validate_link` | `client.py:436-485`: select or read on the DocType else 403; values via `get_value`, "Cannot Fetch Values" | same |
| `is_document_amended` / linked docs | `client.py:425-432` (false without read); `linked_with.py:45` | same |
| Workflow | `get_transitions` read + roles `workflow.py:52, 63-68`; `has_approval_access` `:116-117, 221-222`; then the save path | same (conditions still not evaluated) |
| Assignment | `assign_to.py:67-68` read; `:101-114` read share for an assignee without read via `share.add` → `check_share_permission` `share.py:216-244`; `:129-133` message; `:197-198` assignee-only close; `:206-207` read on remove | same; other users' roles from `users` (default: automatic roles only) |
| Comments | `utils.py:31-32` read to add; `:59-63` owner + read to edit; delete via `comment.json` rows | same |
| `download_template` | `data_import.py:188` read; `exporter.py:116-126` + `can_export` `permissions.py:608-616` (System Manager or export; if_owner export → every row owned) | same; then a SIMULATED text file (labels + request echo, no values); blank template needs read only |

### 4.1b Phase 27 list actions and Data Import (handlers added after the dev.32 merge)

| Method | Native | Simulator |
|---|---|---|
| `assign_to.remove_multiple` | `assign_to.py:181-192` → `remove` → `set_status` `:195-213`; Desk sends `ignore_permissions` → no check | same: no check with `ignore_permissions`, read per doc without it; open ToDos cancelled, "Assignment Completed" comments, `_assign` |
| `assignment_rule.bulk_apply` | `assignment_rule.py:231-245`, `apply :267-296`; no permission check; > 5 names enqueued | no Assignment Rule records are simulated → the "no enabled rule" no-op (a missing name still 404s for ≤ 5 names) |
| `tag.add_tags` (+ `search_link` on Tag) | `tag.py:42-116`: no permission check, Tag master created, `_user_tags = ",a,b"` | same (built-in Tag meta with `tag.json` rows: All read / write / create) |
| `get_common_transition_actions` | `workflow.py:332-353`: per row `get_transitions` (read on the stored doc, roles), self-approval with the owner the CLIENT sent, intersection; an unset state ends the scan | same (conditions still not evaluated) |
| `bulk_workflow_approval` | `workflow.py:237-329`: < 20 now, ≤ 500 enqueued with the alert, > 500 refused; the result is a REALTIME "Workflow Status" msgprint | same, the "enqueued" batch runs at once; the msgprints go to `store.published` |
| `download_multi_pdf` (files) | `print_format.py:27-39, 72-225`: per document `get_print` → `validate_print_permission` (`printview.py:123, 367-378`: read OR print) and Print Settings draft / cancelled (`:137-142`); the sync path SWALLOWS every refusal → silently left out | same decisions; the answer is a text file `SIMULATED-<DocType>-not-a-pdf.txt` that says which requested names would be printed / left out — never a PDF, never values. Print Settings from `options.printSettings` |
| `download_multi_pdf_async` | `print_format.py:40-70`: `{task_id}` (201), later `task_complete:<id>` | `{task_id}`; `task_complete:<id>` in `store.published` with `file_url: null` (nothing rendered) |
| `export_query` (files; background via call) | `reportview.py:352-466`: **writes an Access Log row FIRST** (`make_access_log` `:410-415`, also when refused — a SITE WRITE), then `DatabaseQuery.execute` (403 without read), `can_export` (403 "You are not allowed to export X doctype", if_owner rows checked), the file; background → msgprint, e-mail | same order; the Access Log row is kept in the store (`docs.get("Access Log")`); the file is `SIMULATED-<title>-not-a-<csv|xlsx>.txt` with the column LABELS, the row COUNT and the request — never values; background answers the msgprint (no e-mail) |
| Data Import `savedocs` | `data_import.json`: create / write System Manager only; `validate` `data_import.py:44-91`: template state reset on a new file, BLOCKED DocTypes, `allow_import`, `import` right on the target (403), the template parsed on save ("Invalid template file for import", "Import template should contain a Header and atleast one row.") | same, through the permission model and a built-in Data Import meta (named by hash, natively `format:{reference_doctype} Import on {creation}`) |
| `upload_file` (files) | `handler.py:175-282`: write on the target (`check_write_permission`) | write checked; only a Data Import's file is accepted and kept IN MEMORY for the preview / job; every other upload is refused (417) |
| `get_preview_from_template` | `data_import.py:143-149` (read) → `ImportFile` (`importer.py:404-513`): header matching by label / fieldname / "ID" / child "Label (Table)" (`:1078-1218`), `template_options.column_to_field_map` (`:814-830`, `Column.parse :879-948`: mapping, "Don't Import" keeps the match but skips, duplicates, unmatched), rows `[row_number, …]`, first 10 | same for **CSV only** — `.xlsx` / `.xls` are refused with a message labelled SIMULATED; no date-format guessing, no value warnings, child-table columns matched but not turned into child rows |
| `form_start_import` / `get_import_status` / `get_import_logs` | `:152-156` (write; enqueue; scheduler), `:219-256` (read); the job `importer.py:64-240` | the job runs at once. **Default dry run**: each row is checked (create / write right, mandatory, Link values) and logged — NOTHING is written and every log row says so ("SIMULATED dry run …"); `options.dataImport: "insert"` makes the simulator play the server and insert / update through its save path (log rows labelled). Status Success / Partial Success / Error; `data_import_refresh` in `store.published`; Retry skips rows already logged as successful. ⚠ In a dry run the `success` counts of `get_import_status` mean "passed the simulated checks", yet `FrappeDataImport` derives its headline from them ("Successfully imported N records") — label the screen when you use the default |
| `download_errored_template` / `download_import_log` (files) | `:205-216` (read) | a text file labelled SIMULATED with the logged ROW NUMBERS only |

### 4.2 Not reproduced (a site may decide differently)

- **Custom DocPerm**, Role Profiles, Module Profiles, `select`-only nuances beyond search fields, Guest / website
  permissions (`has_website_permission`), portal users.
- Controller hooks of any DocType other than ToDo (e.g. Contact / Address `address_and_contact.has_permission`, User,
  Event, File, Communication) unless declared in `hooks`; Server Script permission queries (`db_query.py:1133-1136`).
- Tree DocTypes: User Permissions with `hide_descendants` / create under an allowed parent (`permissions.py:350-356`).
- `is_default` User Permissions as defaults for new documents; User Permissions on child-table Link fields in LISTS
  (natively only the parent's Link fields filter rows, as here — the document check also looks at child rows).
- The share rights a user may GRANT (`check_share_permission` second half, `share.py:235-244`), `frappe.share.add` /
  `remove` as whitelisted methods (only `assign_to.add` creates shares), "Disable Document Sharing" beyond `share` and
  assignment, notifications / follow on share.
- Permission of `get_list` on CHILD DocTypes without `parent` (natively 403 "Please specify a valid parent DocType").
- `print` / `email` rights in boot (`can_print` / `can_email`) — Desk's client side, not the server.
- Messages: `_server_messages` wording and HTML follow the source but titles / indicators are approximations; the
  `exception` traceback line appears only where noted (export refusal).
- Phase 27 handlers: Assignment Rules, Print Formats / rendering, Letter Heads (none seeded), e-mails, File records,
  XLSX parsing, the importer's value / date-format warnings and child-table rows, background job queues (everything
  "enqueued" runs at once), realtime delivery (kept in `store.published`).
- Everything outside permissions listed in §1 still applies (validation, naming, links, files, realtime …).

### 4.3 The "unknown roles" scenario

The SERVER is never without role information: `get_roles` (`permissions.py:508-523`) always appends All and Guest (and
Desk User for a System User) to the Has Role rows. `simScenario.unknownRoles(user)` therefore evaluates the server with the
automatic roles only — DocPerm rows for All / Desk User still apply (ToDo's "All" row: the user reads / writes the ToDos
allocated to or assigned by them) — while the CLIENT is given no roles (`store.session.roles` undefined), so the package
shows its rule-9 "unknown / read only" state. Pass `roles` with it when the server should know more than the client.

