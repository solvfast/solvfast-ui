# The Frappe layer — `@solvfast/ui/frappe` (0.7.0-dev.1)

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
| List View | `FrappeListView`, `useFrappeList`, bulk actions, print, Import / Export, saved filters and user settings (`createFrappeSavedFilters`, `createFrappeUserSettings`), the group-by sidebar (`FrappeGroupBySidebar`), `FrappeListSettingsDialog` | `docs/components/list.md` |
| Other list views | `FrappeViews` (switcher host), `FrappeReportView`, `FrappeImageView`, `FrappeKanbanView`, `FrappeCalendarView`, `availableViews` | `docs/components/views.md` (repository only — not in the npm tarball) |
| Form View | `FrappeForm`, `FrappeFormView`, `FrappeField`, `FrappeLinkField`, `FrappeChildTable`, `FrappeQuickEntry`, `useUnsavedChangesBlocker`, the behaviour engine (`depends_on`, defaults, mandatory, `fetch_from`, undo / redo), `formEvents` (Desk's form events instead of Client Scripts) | `docs/components/forms.md` |
| Record panels | `FrappeWorkflowActions`, `FrappeTimeline`, `FrappeAssignTo`, `FrappeStatusIndicator`, the ⋯ menu (`FrappeRecordMenu`, `formMenuItems`), `FrappeFormPrint`, `FrappeConnections`, `FrappeEmailComposer`, `FrappeReminder` | `docs/components/record.md` |
| Simulator — separate entry `@solvfast/ui/frappe/testing` | `createFixtureTransport`, `simScenario` | — (`@solvfast/ui/frappe` never imports it) |

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
| Assignment, comments, tags, likes | `frappe.desk.form.assign_to.add` / `remove` / `add_multiple` / `remove_multiple`; `frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply`; `frappe.desk.form.utils.add_comment` / `update_comment` (delete = `frappe.client.delete` on the Comment); `frappe.desk.doctype.tag.tag.add_tags`; `frappe.desk.like.toggle_like` |
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
- **Writes are implemented**: form Save / Submit / Update / Cancel (with the linked-document pre-flight) / Amend, delete,
  rename, workflow, assignment, comments, tags, likes, bulk actions, print, e-mail, reminders, List Settings and saved
  filters call the methods above. The UI never reports a success the server did not confirm; refusals show the server's
  message. **None of these writes has been run on a real site.**
- **Per-user list settings** go to Frappe's `user_settings` (Desk's `sort_by` / `sort_order` / `filters`, plus the
  package's own keys under `List.sf_ui`) when `serverStorage` is on; saved filters are `List Filter` rows.
- **Errors.** Frappe's message (from `_server_messages` or the exception) is shown by kind, with Retry only where retrying
  can help. With the React Query client the package creates, 4xx errors are not retried and network / 5xx errors are
  retried twice (`frappeRetry`). A server MandatoryError / LinkValidationError on a form save is shown on the field.
- **Keyboard (form).** Ctrl/⌘+S runs the visible primary action (Desk's `trigger_primary_action`); Ctrl/⌘+Z and
  Ctrl/⌘+Shift+Z / Ctrl/⌘+Y undo / redo outside text inputs; `hotkeys={false}` turns them off.

## Not provided

- Client Scripts are not executed — port them to `formEvents` (D-24).
- Gantt, Dashboard, Map, Tree and Inbox views; Report Builder `save_report`, SQL aggregates and charts.
- Token / OAuth / cross-origin auth (custom `transport` only).

See `docs/LIMITATIONS.md` for the complete list and the reasons.

## Real-site validation — not done

The decision (2026-10-17) is to validate against a real Frappe site when the package is first integrated into a real
project, with an approved test account. `e2e/frappe-site/` (repository only) holds a prepared, never-run read-only
procedure (`validate.mjs`): list load, search, "Match any" / "Match all" totals, link search, date filters, an obsolete
saved filter, CSRF refusal and Frappe's own permissions. Write paths need an approved site.
