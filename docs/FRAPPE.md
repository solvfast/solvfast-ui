# The Frappe layer — `@solvfast/ui/frappe` (0.7.0-dev.3)

An optional entry point that renders Frappe DocTypes — list, form, record panels, other list views — on **stock Frappe 15
whitelisted methods only** (no app-specific backend). The core package (`@solvfast/ui`) never imports it;
`scripts/check-boundaries.mjs` enforces that on the source and on the built files.

```tsx
import { FrappeListView, FrappeForm } from "@solvfast/ui/frappe";

<FrappeListView doctype="ToDo" onRowClick={(r) => navigate(`/app/todo/${r.name}`)} />
<FrappeForm doctype="ToDo" name={name} />
```

> **Validation status — read this first.** Nothing in this layer has run against an **authenticated real Frappe site**,
> and **no write has been verified on a site**. Read paths (DocType meta, list rows, counts, link search / validation,
> document load, the 403 / 417 error envelopes) were replayed from **recorded real Frappe 15.110 responses**
> (`tests/real/sada-real.test.tsx`). Everything else — saves, submits, workflow, bulk actions, print, e-mail, connections,
> sidebar counts, list settings, Kanban, Import / Export — is tested against stub transports and the in-package
> **simulator** (`@solvfast/ui/frappe/testing`), which does not reproduce Frappe's naming, validation or every permission
> rule. Results obtained on it are "simulated", never "verified against Frappe". Per-feature status: `docs/LIMITATIONS.md`.
> A real-site validation is **prepared, not run** (P36): it requires an owner-approved, isolated staging site (see the
> last section).

## Requirements

| What | Why |
|---|---|
| Frappe 15 (built against the 15.110 source) | the methods and parameters below; other versions untested |
| The page is served by the Frappe site (same origin) | the client authenticates with the logged-in user's session cookie |
| The CSRF token on the page: `window.csrf_token`, set from the page context with `frappe.sessions.get_csrf_token()` (see `docs/components/foundation.md` §9, `readFrappeBoot`), or `window.frappe.csrf_token` (Desk). **Do not** use `{{ frappe.session.csrf_token }}`: in Frappe 15 it renders the string "None", so every POST fails with `CSRFTokenError` once the session has a token. Values `"None"` and `""` are ignored. Or pass the `csrfToken` option | Frappe checks `X-Frappe-CSRF-Token` on every POST from a logged-in session |
| `@tanstack/react-query` ^5 (optional peer dependency; needed only for this entry) | caching, retries, chunked loading |
| `ThemeProvider` from the core package above it | language, direction and messages |
| `session.roles` (from the boot, `readFrappeBoot`) | permission-aware UI. **Without roles nothing is granted** (rule 9): actions, menu entries and create buttons stay hidden. The server stays the authority either way |

No secrets live in browser code: there is no API key or token in the package or its examples. Another auth scheme (token,
cross-origin) plugs in as a custom `transport` (`createFrappeClient({ transport })`); none is provided.

## What the entry contains

| Area | Main exports | Component docs |
|---|---|---|
| Client, provider, errors | `createFrappeClient`, `FrappeProvider`, `useFrappeClient`, `FrappeError`, `FrappeErrorState`, `readFrappeBoot`, `userDefaultsFromBoot` | `docs/components/foundation.md` |
| Data hooks and services | `useMetaBundle`, `useDoc`, `useDocInfo`, `useSaveDoc`, `useDocAction`, `usePermissions`, `formatValue`, `resolveIndicator`, realtime (`useListRealtime`; `createSocketRealtime` is a skeleton) | `foundation.md` |
| List View | `FrappeListView`, `useFrappeList`, bulk actions (`useFrappeSelectionActions`, shared with the Report view), print, Import / Export, saved filters and user settings (`createFrappeSavedFilters`, `createFrappeUserSettings`), the group-by sidebar (`FrappeGroupBySidebar`), `FrappeListSettingsDialog` | `docs/components/list.md` |
| Other list views | `FrappeViews` (switcher host; `bulk`), `FrappeReportView` (`bulk`: Desk's Actions incl. Submit / Cancel), `FrappeImageView`, `FrappeKanbanView`, `FrappeCalendarView`, `availableViews` | `docs/components/views.md` (repository only — not in the npm tarball) |
| Form View | `FrappeForm`, `FrappeFormView`, `FrappeField`, `FrappeLinkField`, `FrappeChildTable`, `FrappeQuickEntry`, `useUnsavedChangesBlocker`, the behaviour engine (`depends_on`, defaults, mandatory, `fetch_from`, undo / redo), `formEvents` (Desk's form events instead of Client Scripts) | `docs/components/forms.md` |
| Record panels | `FrappeWorkflowActions`, `FrappeTimeline`, `FrappeAssignTo`, `FrappeStatusIndicator`, the ⋯ menu (`FrappeRecordMenu`, `formMenuItems`), `FrappeFormPrint`, `FrappeConnections`, `FrappeEmailComposer`, `FrappeReminder` | `docs/components/record.md` |
| Form Sidebar (0.7.0-dev.3) | `FrappeFormSidebar`, `FrappeAttachments`, `FrappeDocTags`, `FrappeAssignTo layout="sidebar"`, `FrappeSidebarShare`, `FrappeSidebarLikes`, `FrappeComments`, `useFormSidebarActions`, the `attachments` / `tags` / `share` / `like` / `comments` helpers | `docs/components/record.md` |
| Global Search (0.7.0-dev.3) | `useFrappeGlobalSearch`, `createFrappeSearchSource`, `deskSearchBootFrom`, `fuzzySearch` (the bar / dialog are Core: `GlobalSearchBar`, `GlobalSearchDialog`) | `docs/components/search.md` |
| Simulator — separate entry `@solvfast/ui/frappe/testing` | `createFixtureTransport`, `simScenario`, `withSimulatedSidebar`, `bulkUpdateHandler`, `bulkDemoBackend` | — (`@solvfast/ui/frappe` never imports it) |

## Methods called

All POST `/api/method/<method>` with a JSON body; objects and lists are sent as JSON strings, as Desk does. Every call
runs as the logged-in user, so DocPerm, permission levels, User Permissions and sharing are Frappe's. The package hides
what the user may not do (from `session.roles` × DocPerm and `docinfo.permissions`), but it never filters anything for
security: a refused call is shown as the server's error.

| Area | Methods |
|---|---|
| Meta and documents | `frappe.desk.form.load.getdoctype`, `getdoc` (incl. `_link_titles`), `get_docinfo`, `get_communications`; `frappe.client.validate_link`; `frappe.desk.search.search_link`, `get_names_for_mentions`; `frappe.client.get` (Kanban Board) |
| List rows and counts | `frappe.desk.reportview.get` (rows, compressed `{keys, values}`, `with_comment_count`); `frappe.desk.reportview.get_count` (same `filters` + `or_filters`, 1001 cap); `frappe.client.get_list` only for lookups (Letter Head, List Filter, Email Template, Fiscal Year, user names) |
| List settings and preferences | `frappe.desk.listview.get_list_settings` (read); `frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings` (write, System Manager); `frappe.model.utils.user_settings.save`; List Filter rows through `frappe.client.insert` / `frappe.client.delete` |
| Sidebar (only with `sidebar`) | `frappe.desk.listview.get_group_by_count`, `frappe.desk.reportview.get_sidebar_stats` |
| Document writes | `frappe.desk.form.save.savedocs` (Save / Submit / Update), `frappe.desk.form.save.cancel`, `frappe.desk.form.linked_with.get_submitted_linked_docs` / `cancel_all_linked_docs`, `frappe.client.is_document_amended`, `frappe.client.delete`, `frappe.rename_doc`, `frappe.client.set_value` (Report view inline edit, Kanban group mode), `run_doc_method`, `upload_file` |
| Workflow | `frappe.model.workflow.get_transitions`, `apply_workflow`, `get_common_transition_actions`, `bulk_workflow_approval` |
| Assignment, comments, tags, likes | `frappe.desk.form.assign_to.add` / `remove` / `close` / `add_multiple` / `remove_multiple`; `frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply`; `frappe.desk.form.utils.add_comment` / `update_comment` / `update_comment_publicity` (delete = `frappe.client.delete` on the Comment); `frappe.desk.doctype.tag.tag.add_tags` / `add_tag` / `remove_tag` / `get_tags`; `frappe.desk.like.toggle_like` |
| Attachments (Form Sidebar) | `upload_file` (multipart, or JSON with `library_file_name` / `file_url`); `frappe.desk.form.utils.remove_attach`; `frappe.core.api.file.get_files_by_search_text` |
| Sharing | `frappe.share.get_users`, `frappe.share.add`, `frappe.share.set_permission` |
| Global Search | `frappe.utils.global_search.search` (`{text, start, limit, doctype}`); the awesome bar itself makes no request (boot lists) |
| Bulk | `frappe.desk.reportview.delete_items`; `frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs` |
| Print | `frappe.utils.print_format.download_multi_pdf` / `download_multi_pdf_async` (list), `download_pdf` (form), `frappe.www.printview.get_html_and_style` (form preview) |
| Connections, e-mail, reminders | `frappe.desk.notifications.get_open_count`; `frappe.core.doctype.communication.email.make`; `frappe.email.doctype.email_template.email_template.get_email_template`; `frappe.automation.doctype.reminder.reminder.create_new_reminder` |
| Views | `frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards` / `update_order_for_single_card`; `frappe.desk.calendar.get_events` (opt-in calendar source) |
| Import / Export | `frappe.core.doctype.data_import.data_import.download_template`, `get_preview_from_template`, `form_start_import`, `get_import_status`, `get_import_logs`, `download_errored_template`, `download_import_log`; `frappe.desk.reportview.export_query` (opt-in "Export as report"; writes an Access Log on the site) |

Why `reportview.get_count` and not `frappe.client.get_count`: in Frappe 15 the latter has no `or_filters` parameter and
Frappe drops arguments a whitelisted function doesn't declare, so "Match any" totals would be wrong.

## What comes from the DocType

| From the meta | Becomes |
|---|---|
| fields | list columns, filter fields and form fields. FrappeField dispatches Desk's fieldtypes; Signature, Geolocation, Barcode, Icon and unknown types are shown read-only and listed in the form's issues banner |
| `in_list_view`, `in_standard_filter`, List View Settings `fields` / `total_fields` | default columns (capped by window width, as Desk) and quick filters |
| `title_field`, `search_fields`, `sort_field` / `sort_order`, `image_field` | search, default order, the form header image, the Image view |
| DocPerm rows × `session.roles`, `docinfo.permissions` | which actions, menu entries, fields and columns are offered |
| `__workflow_docs` | workflow actions in the form, the workflow state in the list indicator, bulk workflow approval |
| `quick_entry` + field flags | Quick Entry eligibility and fields (quick_entry.js:59-110) |
| `__dashboard` | the Connections tab |
| `__print_formats` | print format choices |
| `depends_on` / `mandatory_depends_on` / `read_only_depends_on`, `fetch_from`, defaults | the form's behaviour engine (an interpreter, not `eval`; 18 of 947 installed-app expressions are unsupported by decision and reported on screen) |

## Behaviour summary

- **Lists.** Rows come from `reportview.get` with only the needed fields. Filter values are converted to the field's type;
  "Match all" → `filters`, "Match any" → `or_filters` (search then narrows to the title field and says so). Child-table
  filters become 4-tuples with a distinct count; conditions on fields the DocType no longer has are dropped. Grouping is
  client-side over loaded chunks (opt-in `groupByFields`); the opt-in `sidebar` shows Desk's server group counts.
  Realtime `list_update` refreshes the list (a full reload) when the app supplies a realtime port.
- **Selection (since 0.7.0-dev.2).** Desk's header actions by default: with rows selected the header shows "{n} items
  selected" + Clear and the "Add {DocType}" primary action is replaced in place by the Actions menu (Desk's order and
  gates); `selectionMode="bar"` is an opt-in bulk bar that is not Desk's layout. After an action the selection follows
  Desk's callbacks (`selectionAfterBulk`): Edit and workflow actions keep it; Submit / Cancel clear it only when every
  document went through; dismissing Clear Assignment's confirmation clears it; Assign To / Apply Assignment Rule / Add
  Tags / Delete clear it on success; Export / Print keep it.
- **Report view editing (since 0.7.0-dev.2).** `FrappeReportView` follows Frappe 15.110's report view by default
  (`editable="desk"`, report_view.js `is_editable` + frappe-datatable's `=== false` check): plain fields are editable
  also on DocTypes without a Table field, `read_only_depends_on` is evaluated on the loaded row only when the DocType
  has no Table field, the write right is Desk's `can_write` (level-0 write or create) and the field permlevel is not
  checked; child-table cells save through `frappe.client.set_value` on the child row. `editable="strict"` adds the
  permlevel, write-not-create, submit and `read_only_depends_on` checks; a function decides per cell (`info.desk` =
  Desk's verdict). Details: `docs/components/views.md` §3.
- **Writes are implemented**: form Save / Submit / Update / Cancel (with the linked-document pre-flight) / Amend, delete,
  rename, workflow, assignment, comments, tags, likes, bulk actions, print, e-mail, reminders, List Settings and saved
  filters call the methods above. The UI never reports a success the server did not confirm; refusals show the server's
  message. **None of these writes has been run on a real site.**
- **Batch 2 (0.7.0-dev.3).** `FrappeReportView bulk` gives the checked rows Desk's Actions (Submit / Cancel included)
  with the List view's gates; a document repeated on several Report rows is sent once (deviation). `FrappeFormSidebar`
  renders Desk's form sidebar — Assign, Attachments, Tags, Share, likes · comment count, Comments — over the one shared
  docinfo query; Attach "+" and tag editing are offered to every reader and the server refuses without write, as in Desk.
  `useFrappeGlobalSearch` feeds the Core `GlobalSearchBar` (Desk's awesome bar from boot lists, `global_search.search`
  for documents). All of it is simulator-only.
- **Per-user list settings** go to Frappe's `user_settings` (Desk's `sort_by` / `sort_order` / `filters`, plus the
  package's own keys under `List.sf_ui`) when `serverStorage` is on; saved filters are `List Filter` rows.
- **Errors.** Frappe's message (from `_server_messages` or the exception) is shown by kind, with Retry only where retrying
  can help. With the React Query client the package creates, 4xx errors are not retried and network / 5xx errors are
  retried twice (`frappeRetry`). A server MandatoryError / LinkValidationError on a form save is shown on the field.
- **Form defaults.** `FrappeForm` shows Desk's ⋯ menu and, when the DocType has a dashboard, a Connections tab
  (`menu={false}` / `connections={false}` opt out); `FrappeListView create` opens Quick Entry for eligible DocTypes;
  `FrappeProvider` applies `boot.userDefaults` to new documents (`userDefaults={false}` opts out).
- **Keyboard (form).** Ctrl/⌘+S runs the visible primary action (Desk's `trigger_primary_action`); Ctrl/⌘+Z and
  Ctrl/⌘+Shift+Z / Ctrl/⌘+Y undo / redo outside text inputs; `hotkeys={false}` turns them off.

## Not provided

- Client Scripts are not executed — port them to `formEvents` (D-24).
- Gantt, Dashboard, Map, Tree and Inbox views; Report Builder `save_report`, SQL aggregates and charts.
- Token / OAuth / cross-origin auth (custom `transport` only).

See `docs/LIMITATIONS.md` for the complete list and the reasons.

## Real-site validation — prepared, not run

Nothing in this layer has run against a real Frappe site. P36 prepared a guarded validation (repository only):
`docs/audit/p36/VALIDATION-MATRIX.md` classifies every requirement row of the coverage matrix by the evidence it needs and
names the test that would validate it (86 tests since 0.7.0-dev.3: 73 API reads and writes, 7 browser checks through a
harness of `FrappeForm` / `FrappeListView` / `FrappeViews`, and 6 manual checks; the 11 batch-2 tests cover Report view
Submit / Cancel, the Form Sidebar, Share, Like, Comments and Global Search); `e2e/frappe-site/run-matrix.mjs` runs them,
`staging-seed.py` / `staging-teardown.py` create and remove synthetic `@example.com` accounts and records. **It requires an
owner-approved, isolated staging site** (Frappe 15, its own database, credentials, Redis and workers, not on a production
server) and the owner's written approval file; the scripts refuse production site names, loopback URLs and a missing
approval. How to run it: `e2e/frappe-site/README.md`.

### Frappe server rules to know (read from Frappe 15.110 source, not yet observed on a site)

Frappe's own behaviour, which the package cannot change; the validation run asserts each one (test ids in brackets).

- **`mandatory_depends_on` is client-only** — the server enforces only `reqd`. [F-REQ-2, F-REQ-3]
- **Permlevel writes are reset silently** — a user without write on a field's permlevel gets HTTP 200 and the stored value
  is kept (`validate_higher_perm_levels`). [F-PERMLEVEL-2]
- **Amend is checked against `create`** (and a cancelled source), not the `amend` right. [F-AMEND-2]
- **Saved filters (`List Filter`)** — every Desk User may create global filters and delete other users' filters. [L-SAVED-2]
- **`toggle_like` has no permission check.** [L-LIKE-1]
- **`export_query` writes an Access Log** before it refuses a user without `export`. [L-EXPORT-1]
- **`user_settings.save` merges shallowly** — a Desk save of `List` drops the package's `sf_ui` key. [L-USERSET-1]
- **`global_search.search` filters by DocType only** — every indexed row of a readable DocType in Global Search Settings is
  returned (name + matching snippets), regardless of User Permissions or `if_owner`. [S-GSEARCH-1]
- **Assignment needs read, not write** — any reader may add or remove an assignment; only the assignee may close it.
  [F-SB-ASSIGN-1]
- **Comment delete follows the Comment DocPerm** (System / Website Manager), not authorship; publish = author or System
  Manager. [F-SB-COMMENT-1]
- **Sharing grants only rights the sharer holds**; un-ticking read deletes the share. [S-SHARE-1]

More (bulk responses, User Permissions in lists and sidebar counts): `docs/LIMITATIONS.md` and
`docs/audit/p36/VALIDATION-MATRIX.md` §7 (repository only).
