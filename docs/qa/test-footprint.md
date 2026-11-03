# The `SFUI Test` footprint on the CRM site — what it creates and every side effect

Owner: A6 (QA). **Prepared, not executed.** Companion of `backup-safety-net.md` (do that first) and of
`e2e/frappe-site/{seed-crm-site.py,teardown-crm-site.py,sfui_footprint.py,fixtures/}`. Site:
`internal.solvfaster.com`, protected, shared by about 50 projects. Evidence is source reading of
`/home/frappe/lovable_bench/apps/*` (read-only); where something could not be proved from source it says so.

## 1. Effects on the whole site (not only on SFUI rows)

| Effect | Caused by | Evidence | Mitigation |
|---|---|---|---|
| Site-wide cache clear (`frappe.clear_cache()`): every session re-reads boot/meta once; a short burst of cold requests for all projects | Module Def insert; DocType insert adds `clear_cache(doctype=…)` and `clear_user_cache` for the seeding user; at teardown Role removal and User Permission deletion clear it again | `module_def.py` `on_update`; `doctype.py:557-560`; `role.py:64`; `user_permission.py:235` (a User Permission *insert* only publishes a per-user `update_user_permissions` event, `:36-38`) | run in a quiet window; the seed does Module Def + Roles + 6 DocTypes within about a minute |
| DDL: six `CREATE TABLE` statements; MariaDB commits implicitly after each, so a failed seed cannot be rolled back | DocType insert → `frappe.db.updatedb` (`doctype.py:524`) | `doctype.py:518-560` | the manifest is written **before** each call (status `pending`), teardown checks pending entries for existence |
| `Module Def` and `Role` are auto-created by `DocType.on_update` if missing (`make_module_and_roles`, `doctype.py:1852-1880`); with `custom=0` and `developer_mode` the Module Def would also write a folder under the app and edit `modules.txt` (`module_def.py:on_update`) | order of creation | the seed creates the Module Def (`custom=1`) and the Roles (`is_custom=1`) **before** any DocType, so the auto-creation never fires | do not reorder the seed |
| Custom DocTypes survive other projects' `bench migrate`: `remove_orphan_doctypes` only looks at `custom: 0` | `custom=1` on every fixture | `model/sync.py:153`, called from `migrate.py:148` | none needed |
| The traffic of the tests is visible to the shared monitor and to nginx/gunicorn logs | `monitor: 1` in `common_site_config.json` | bench config | tests are few and identifiable by their `@example.com` users |
| The shared Socket.IO server (`:9003`) and Redis (`13004`/`11004`) carry the test realtime events and background jobs | any save / comment / assignment by a test user | `common_site_config.json` | realtime scenarios are tagged `isolated` and are not run here |
| The test users enqueue background jobs on the shared worker | `create_contact` ×5 (§3) | `background_workers: 1` | the seed waits for them; the footprint is 5 users |

## 2. What the seed creates (all recorded in the private manifest; `kind=created`)

| Object | Count | Notes |
|---|---|---|
| Module Def `SFUI Test` | 1 | `custom=1`, `app_name=frappe` (the field is required, `module_def.json`) |
| Role `SFUI Tester`, `SFUI Reader`, `SFUI Approver` | 3 | `desk_access=1`, `is_custom=1` |
| DocType `SFUI Test Parent / Child / Tag Row / Contact / Workflow / Attachments` | 6 | `custom=1`; tables `tab<name>` |
| Workflow State `SFUI Draft / Pending / Approved / Rejected`, Workflow Action Master `SFUI …` ×5 | 4 + 5 | created only if missing; the prefix makes collisions with the shared records impossible |
| Workflow `SFUI Test Workflow Flow` | 1 | `send_email_alert=0`; the `workflow_state` field is part of the DocType, so `Workflow.on_update` does not create a Custom Field (`workflow.py:42-65` creates one only when the field is missing) |
| Users `sfui-{tester,reader,approver,limited,ar}@example.com` | 5 | `send_welcome_email=0`, `no_welcome_mail`, `user_image` preset (see §3) |
| User Permission (`sfui-limited` → one SFUI Test Contact) | 1 | |
| SFUI Test Contact | 61 | crosses the 50-row search page and the 20/100 list page sizes |
| SFUI Test Parent | 3 (one with 12 child rows, one submitted) | `track_changes=1`, `track_seen=1` |
| SFUI Test Workflow | 3 | amounts 200, 5000, and one owned by the approver (self-approval probe) |

Credentials: random, written only to `<private-dir>/users.json` (mode 600, outside the repository). The private
directory also holds the manifest and the approval files. Delete the whole directory after the run.

## 3. Side effects of creating a User (each of the 5)

All from `apps/frappe/frappe/core/doctype/user/user.py` and the hooks of the installed apps.

| Side effect | Source | Handling |
|---|---|---|
| `create_contact` is **enqueued after commit** and creates a `Contact` (+ Contact Email row) for the user, on the shared worker, at an unknown later time | `user.py:228-241`, `1270-1300` | the seed polls up to 120 s and records each Contact (`side_effect`); teardown finds Contacts by `Contact.user` **and** by Contact Email, and deletes them **before** the user, because `User.on_trash` only sets `Contact.user = NULL` (`user.py:539-541`) |
| `update_gravatar` would make an **outbound HTTP request** to a third party per user | `user.py:243-248`, `1245-1250` | prevented: `user_image` is preset, which is the condition that skips the enqueue (`not self.user_image`) |
| `share_with_self`: a DocShare row (write + share) on the user's own User document | `user.py:228-230`, `345-350` | recorded (`side_effect`); removed with the user (`user.py:525`, `delete DocShare where user`) |
| `after_insert`: `Notification Settings` document named after the user; invalidates the `users_for_mentions` and `enabled_users` cache keys | `user.py:165-168`, `notification_settings.py:69-73` | recorded; the seed sets `enable_email_notifications = 0` so assignment / mention Notification Logs never try to mail `@example.com`; removed with the user (`user.py:539-545`) |
| `throttle_user_creation`: more than `throttle_user_limit` (default 60) users in 60 s throws "Throttled" | `user.py:1253-1259` | five users |
| ERPNext hook `User.after_insert → frappe.contacts…update_contact` **updates an existing Contact** whose `email_id` equals the user's name | `erpnext/hooks.py:340-344`; `contact.py:330-340` | `--preflight` aborts if any Contact has the user's email, so nothing real can be adopted |
| ERPNext `User.on_update → set_default_role`: adds the `Customer`/`Supplier` role if the user's Contact is linked to a Customer/Supplier | `erpnext/portal/utils.py:4-19` | no link exists for new Contacts; do not link the SFUI Contacts to ERPNext parties |
| ERPNext `User.validate → validate_employee_role` removes an `Employee` / `Employee Self Service` role with a message when no Employee is mapped | `employee.py:232-250` | the SFUI users have none of those roles |
| HRMS `User.validate → update_approver_user_roles` | `hrms/hooks.py:161-166` | runs, no effect on users without HR roles (not traced further: **UNVERIFIED**) |
| `vault_zad_foods_project` `User.validate → restore_plain_ampersand` | `vault_zad_foods_project/hooks.py:161-165` | harmless on these names |
| `*` hooks run on every document of every doctype: `service_level_agreement.apply` (ERPNext), `frappe_whatsapp.utils.run_server_script_for_doc_event` (looks up WhatsApp notifications by doctype → no match for SFUI), `check_for_running_deletion_job` | `erpnext/hooks.py:327-332`, `frappe_whatsapp/hooks.py:206-220` | SFUI doctypes have no SLA / WhatsApp notification; `--preflight` prints the live hook table so the owner can see any new one |
| 52 apps are installed; hooks of apps not read here may add effects | — | **UNVERIFIED**: `--preflight` prints `frappe.get_hooks("doc_events")` for `User` and `*`; read it before `--apply` |

## 4. Side effects of using the footprint (tests)

| Test action | Rows / effects | Cleanup |
|---|---|---|
| **Opening a document through `getdoc`** | `_seen` is updated when `track_seen`; a `View Log` row when `track_views`; the GET commits (`flags.commit`) (`load.py:55-60`, `app.py:414-420`). **Tests therefore open only SFUI documents.** | `View Log` swept by `reference_doctype` |
| Saving any SFUI document | `Version` (track_changes), `__global_search`/sqlite search index update (`hooks.py:153-161`, `sqlite_search.update_doc_index` is a no-op unless search is enabled and indexed, `sqlite_search.py:1378-1385`), `assignment_rule.apply`, `process_workflow_actions`, `attach_files_to_document`, energy-point evaluation (`hooks.py:179-181`), realtime `doc_update`/`list_update` | `Version` swept; the rest leaves no row unless a rule exists for SFUI doctypes (none) |
| Deleting an SFUI document | a `Deleted Document` row unless deleted with `delete_permanently` | teardown deletes permanently; sweeps `Deleted Document` by `deleted_doctype` |
| Assigning (`assign_to.add`) | `ToDo`, an "Assigned" `Comment` with `docinfo_update`, `_assign` JSON on the row, a `DocShare` if the assignee cannot read, a `Notification Log` (+ email if enabled), `Document Follow` if the assignee follows assigned docs (`assign_to.py:43-139`, `notify_assignment`) | swept: `ToDo.reference_type`, `Comment.reference_doctype`, `DocShare.share_doctype`, `Notification Log.document_type`, `Document Follow.ref_doctype` |
| Adding a comment | `Comment`; mention → `Notification Log` (`utils.py:27-50`, `comment.py:58-60`) | swept |
| Uploading an attachment | `File` row **and the file on disk** (`handler.py:175-263`) + an "Attachment" `Comment` | swept by `File.attached_to_doctype`; `File.on_trash` removes the disk file (`file.py:183-190`) |
| Workflow action | `Workflow Action` rows for approvers, a Workflow `Comment`, state field update, optional email (off) | swept |
| Logging in as an SFUI user | `Activity Log` (login), `Route History`, `Sessions` row, `__UserSettings` on list use (the package keeps list settings in localStorage, Desk does not) | swept by user; sessions cleared |
| Sharing / following / tagging / liking | `DocShare`, `Document Follow`, `Tag Link`/`Tag`, `_liked_by` | swept where keyed by doctype |
| Sending email from a document | `Communication` + `Email Queue` — **not done on this site** (scenarios tagged `isolated`) | swept if it ever happened |

## 5. What teardown removes, and what it cannot

Removes (dry run by default, manifest-driven): sessions; residue rows of §4 by query; documents of the SFUI DocTypes
(submitted ones are cancelled first); the Workflow, then the Workflow States / Action Masters **it created**; User
Permissions; the users' Contacts, then the users (their Notification Settings and DocShares go with them); the
DocTypes, then `DROP TABLE` for the manifest's six `tabSFUI Test …` tables — **deleting a DocType does not drop its
table** (`model/delete_doc.py:67-95` has no DDL; `DocType.after_delete` only clears the controller cache,
`doctype.py:684-686`; tables are dropped only by app uninstall, `installer.py:517`, or `bench trim-database`,
`commands/site.py:1415`) — then the Roles, the Module Def and the `tabSeries` counters `SFUI-CON-`, `SFUI-PAR-`,
`SFUI-WF-`, `SFUI-ATT-`.

Cannot undo, by nature: the cache clears of §1; log lines in `logs/`, monitor and nginx logs; Redis keys that expire on
their own; MariaDB binlog/auto-increment counters; any email that left the host (none is expected).

Verification after teardown: the script prints `remaining after this run:` and exits non-zero if any SFUI DocType,
Role, Module Def, User, Workflow, Contact or `tabSFUI Test%` table is still present. Also run the owner's own
table-count check from `backup-safety-net.md` step 4 (the count should return to the pre-seed number).

## 6. Decisions needed from the owner before `--apply`

1. Approve the footprint in §2 (3 roles and 5 users, not 1 role and fewer users; the fixtures use three roles to
   test read-only, workflow approval and CRUD separately).
2. Approve the quiet window for the cache clears of §1.
3. Say whether `--with-files` is wanted in the backup (`backup-safety-net.md` step 2).
4. Confirm that creating real, enabled `System User` accounts (`@example.com`, random passwords, no email) on this site
   is acceptable; they exist only until teardown.
5. Confirm nobody runs `bench run-tests` against this site while the footprint exists: the site has
   `allow_tests: true` (`commands/utils.py:777-782`).
