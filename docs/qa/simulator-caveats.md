# Caveats of the simulated backend (`@solvfast/ui/frappe/testing`, `createFixtureTransport`)

Owner: A6 (QA). Reviewed against `src/frappe/testing/fixtureTransport.ts` (0.4.0-dev.7) and the native source
(Frappe 15.110.0, `/home/frappe/lovable_bench/apps/frappe`). Purpose: text for the docs that ship with the simulator so a
reader cannot mistake "it works against the simulator" for "it behaves like Frappe". Status vocabulary of the contract:
results on this backend are **Simulated & tested**, never **Verified against real Frappe**.

## Suggested banner (for README / docs/FRAPPE.md / the CRM's simulated mode)

> The simulated backend reproduces request and response **shapes** only. It has no users, roles or permissions (the
> session user may do everything), no link, select, format or length validation, no server-side fetch_from, no
> naming series shared across DocTypes, no workflow conditions or self-approval, no Version, View Log, File or
> Notification records. A green test here says the component builds the right requests and renders the right shapes. It
> says nothing about what Frappe will accept, reject, rename or hide.

## 1. Where it could be mistaken for native

| Area | Simulator | Native (evidence) | Misleading because | Parity scenarios it cannot answer |
|---|---|---|---|---|
| **Permissions** | `docinfo.permissions` is always every right (submit/cancel/amend only if submittable); no roles, `permlevel`, `if_owner`, User Permissions, DocShare; `update_comment` allows the single session user only | server evaluates roles, owner, user permissions, shares (`permissions.py:196-307`); unreadable permlevel fields are ABSENT (`document.py:754-781`); `getdoc` 403 carries `_error_message` (`load.py:40-45`) | every button shows, every field is Write, no field is ever absent, 403 never occurs, "read-only user" cannot be simulated | M-03..M-08, T-08, H-05, S-04 |
| **Naming** | `field:`, `naming_series:`, `format:` and `#` handled by regex; counters are per DocType and per prefix; `format:` with `{YYYY}`, `{MM}`, `{fieldname}` is NOT expanded (braces are stripped, so `INV-{YYYY}-{####}` becomes `INV-YYYY-0001`); `Prompt`/`autoincrement`/`By script` unsupported; default is a random 10-char hash | `make_autoname` / `_format_autoname` (`model/naming.py`), counters in `tabSeries` keyed by prefix and shared across DocTypes, rolled back on failure | names in screenshots look native but are not; two DocTypes sharing a prefix would collide natively and not here | F-07, C-06 |
| **New vs existing document** | a document with a `name` that is not stored is INSERTED even without `__islocal`; child rows with no `name`, `__islocal`, or a `new-…` name are re-named and kept | native: a posted doc with a name but no `__islocal` goes through `save()` and fails (`DoesNotExistError`); a child row with a client-invented `name` and no `__islocal` is UPDATEd, matches nothing and is silently not saved (`base_document.py:618-620`; checklist C-06) | **masks the exact bug class a form can have**: a form that invents row names passes here and loses rows on a real site | C-06, F-07 |
| **Validation** | static `reqd` (parent and rows), timestamp, docstatus transitions, "not submittable" only | also link existence (`LinkValidationError`), selects, Email/Name/Phone/URL/IBAN, length, `non_negative`, `unique`, `set_only_once`, permlevel resets, `allow_on_submit`/`UpdateAfterSubmitError`, server `fetch_from` overwrite, workflow state validation, order links -> hooks -> mandatory (`document.py:380-437`, `base_document.py:775-1000`) | saves almost always succeed; error kinds `link`, `validation`, `duplicate`(unique) are never produced by validation, only by hand-fed envelopes | F-08, F-10, C-15, C-16, W-07 |
| **Update after submit** | any field of a submitted document can be changed with action `Update` | only `allow_on_submit` fields (`document.py:932`) | "Update" always looks permitted | F-09 |
| **Timestamp** | compared only when the client sends `modified`; `modified` has fake microseconds (always `…000`); children are not compared | `check_if_latest` (`document.py:850`) with real microseconds | conflict tests pass with string compare only | F-12 |
| **Messages** | success sends a green `alert` message "Saved"/"Cancelled"; mandatory lists one message per field with no `raise_exception` | native: `Saved`/`Submitted` alert (`save.py` end); mandatory msgprints each field, then `MandatoryError "[DT, name]: f1, f2"` | wording and count differ; `visibleMessages` filtering is never exercised by the simulator's own errors | T-04 |
| **`getdoc`** | `_link_titles` is always `{}`; no `__onload`; no `_seen`/View Log writes; `versions`, `communications`, `attachments`, `shared`, `views`, `milestones` are always empty | titles for title-link doctypes (`load.py:55-60`), `__onload`, `track_seen`/`track_views` side effects, Version rows from `track_changes` | link-title and timeline-version rendering cannot be tested; the `real-ro` vs `real-rw` distinction of `getdoc` is invisible | C-01, H-02, H-03, H-07 |
| **`getdoc` of a missing name** | returns `{docs: []}` | same (`load.py:33-38`); `get_docinfo`/`frappe.client.get` of a missing name return 404 in both | (accurate - keep) | T-03 |
| **reportview / get_list** | `get` returns `[]` when there are no rows and `{keys, values, user_info}` otherwise (accurate); `_comment_count` is appended whenever `with_comment_count` is 1; `user_info` is `{fullname: <the email>, image: null}` for every `_assign` user | native adds `_comment_count` per `list_view`/`reportview.py` rules (doc 14: UNVERIFIED when `_comments` not selected); `user_info` has real full names and images | avatars show emails; a list that depends on `_comment_count` without selecting `_comments` works here | L-01, L-06 |
| **Filters and sort** | supported operators: `= != like not like in not in > < >= <= between timespan is`; others (`ancestors of`, `descendants of`…) throw `ValidationError`; sort via `localeCompare`; timespan windows are Monday-first and computed in the browser's local zone; `like` is a case-insensitive JS regex | MariaDB collation, nested-set operators (`db_query.py:794-840`), site first-day-of-week, server date (`data.py:734-820`) | tree filters fail only here; ordering of accented/Arabic text and week boundaries differ | L-03, L-04, L-05 |
| **Count** | `get_count` / `reportview.get_count` count the in-memory rows, cap at `limit`; `distinct` is ignored | `select count(*) from (…limit)`; distinct for child filters (`reportview.py:53-72`) | child-table filter counts are plausible but not parent-distinct | L-02 |
| **search_link** | substring match on `name`, title and `search_fields` of any field type; names starting with the text first; `enabled`/`disabled` filters honoured; no `idx desc` popularity, no position relevance, no translated-doctype path, `reference_doctype`/`ignore_user_permissions` ignored; `query` (custom) ignored | `search.py:131-232` (LIKE on text-like types only, relevance by position, link-count `idx`, user-permission filtering) | ranking looks right on small data and is not | C-01, M-08 |
| **validate_link** | case-insensitive canonical `name` or `{name:null}`; any requested field is returned | permission check and "Cannot Fetch Values" for unreadable fields (`client.py:443-485`) | never exercises the read-denied branch | T-13, C-02 |
| **Workflow** | roles filter only if `options.roles` is passed (default: all roles allowed); `condition` is not evaluated; no self-approval check; no `allow_edit` read-only; no `WorkflowPermissionError`; error class for a bad action is `WorkflowTransitionError` (this one is correct, `model/workflow.py:21,114`); posted edits are discarded on `apply_workflow` (correct); a Workflow comment is added (Desk does too) but no Workflow Action row | `get_transitions` filters role, condition, state (`workflow.py:39`); `has_approval_access` (`:116,221`); `validate_workflow` (`:166`) | every transition is always offered; conditions such as `doc.amount < 1000` never hide anything | W-01..W-04, W-07, M-07 |
| **Assignment** | any user can add/remove/close; `close` does not check the assignee; no sharing, no `check_permission`, no Notification Log/follow; the "Assigned" comment text is plain `user assigned u` (native is HTML); `add` returns max 5 (correct) and the duplicate message is a normal server message (correct) | `assign_to.py:43-232` | S-04/S-05 behaviour (share, assignee-only close) is invisible | S-04, S-05, S-07 |
| **Comments** | `add_comment` trusts `comment_email`/`comment_by` (as native); `update_comment` checks the single user; **no delete permission model** (`frappe.client.delete` of a Comment always works) | owner-or-Administrator edit; delete needs `Comment` delete right (System Manager/Website Manager, `comment.json`) | an ordinary owner can delete here and not in Desk | H-04, H-05 |
| **Files** | none: no `upload_file`, `remove_attach`, `attachments` stay `[]` | `handler.py:175-263`, `utils.py:19-23` | attachment UI cannot be exercised | H-07 |
| **Realtime** | none from the simulator | `doc_update`/`list_update`/`docinfo_update` | conflict banners and list refresh never trigger | F-12, L-10, H-06 |
| **Bulk / delete / rename** | `delete` ignores links (`LinkExistsError`), submitted-state ("cannot delete submitted") and permissions; rename does not check `allow_rename`, merge or link rewriting | `delete_doc.py:60-150` (`check_if_doc_is_linked`, submitted check); `rename_doc` | delete/rename always succeed | F-09, L-08 |
| **Users and session** | one session user (`backend.user`, default Administrator); Administrator bypasses every native check, so even a "faithful" permission model would hide errors when the simulated user is Administrator | `permissions.py:107-109` | the default user is the one that never sees a permission error | M-*, T-06 |

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
   `tests/parity/display-status.test.ts` does), not on the simulator.
5. Suggested hardening for the simulator (A1/Lead decision, none required for shape tests): expand `{YYYY}`/`{MM}`/`{field}` in
   `format:`; reject a stored-name-less document that lacks `__islocal`; keep client-invented child names when `__islocal` is
   absent so the C-06 failure reproduces; add an optional `strict` mode that validates Link existence, Select options and
   Data formats; make the default `roles` explicit (no roles = deny, not allow); return real `user_info` names.
