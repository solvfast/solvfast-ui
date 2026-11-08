# Known limitations — @solvfast/ui 0.7.0-dev.3 (unreleased)

What this version does **not** do, has **not** been verified, or does differently on purpose. The row-by-row status of the
Form View and List View requirements is in `docs/audit/p35/COVERAGE.md` (repository only).

## Validation status

**No authenticated real-site validation has been done.** No write of any kind has been verified on a real Frappe site,
and no restricted user has been tested on one. "COMPLETE" in the coverage matrix means "a test exercises it", never
"verified on a site".

**Real-site validation: prepared, not run** (P36). A guarded validation against a Frappe 15 staging site is ready in the
repository — the requirement matrix `docs/audit/p36/VALIDATION-MATRIX.md`, the runner `e2e/frappe-site/run-matrix.mjs`,
staging seed / teardown scripts — but nothing has run: it **requires an owner-approved, isolated staging site** (own
database, credentials, Redis and workers; never a production site — the scripts refuse production names and loopback).
Until it runs, every real-site result is BLOCKED. P36 batch 2 (0.7.0-dev.3) added 11 catalogue tests for its server paths
(86 in all); none has run.

| Area | Evidence |
|---|---|
| Core 0.1–0.3 (theme, primitives, shell, List View) | Unit tests, pixel parity with Sear's real components, clean installs (Tailwind and no-Tailwind) |
| Core additions 0.4–0.7 (fields, record components, Export / Import dialogs, views, sidebar, record menu, e-mail composer, file dropzone, …) | Unit tests in jsdom and a Showcase smoke render (jsdom). No pixel parity, no manual screen-reader pass; 0.7.0-dev additions have not been checked in a real browser |
| Frappe layer — read paths | Replayed from **recorded real Frappe 15.110 responses** and anonymous HTTP (`tests/real/sada-real.test.tsx`): meta, list rows, counts, link search / validation, document load, the 403 / 417 envelopes |
| Frappe layer — everything else | **Simulator only** (`@solvfast/ui/frappe/testing`) or stub transports — see the next section |
| Frappe layer — an authenticated real site | **Not done.** Prepared, not run (P36): matrix, guarded staging seed / teardown and runner in `docs/audit/p36/` and `e2e/frappe-site/` (repository only); needs an owner-approved isolated staging site |

## Simulator-only areas

The simulator answers from memory. It models Frappe's request and response shapes and an opt-in permission engine
(roles, DocPerm, `if_owner`, User Permissions, sharing, permlevel), but not Frappe's naming, server validation, hooks,
SQL or every permission rule. These behaviours have **only** simulator (or stub) evidence:

- **Every write:** form Save / Submit / Update / Cancel / Cancel All / Amend, Quick Entry save, delete, rename, workflow
  apply and bulk approval, assignment, comments, tags, likes, list bulk actions (Edit, Submit, Cancel, Delete, Assign,
  Clear Assignment, Assignment Rule, Add Tags), Print, e-mail sending, reminders, List View Settings, saved filters
  (`List Filter`), `user_settings`, Data Import, Report view inline edit (`frappe.client.set_value`), Kanban moves
  (`update_order_for_single_card`), `upload_file`.
- **Every batch-2 server path (0.7.0-dev.3):** bulk Submit / Cancel from the Report view
  (`submit_cancel_or_update_docs`); the Form Sidebar — `assign_to.add` / `close` / `remove`, `upload_file` incl. the JSON
  `library_file_name` / `file_url` forms (never run: the source says `upload_file` reads them from a JSON body),
  `frappe.desk.form.utils.remove_attach`, `tag.add_tag` / `remove_tag` / `get_tags`,
  `frappe.core.api.file.get_files_by_search_text`; sharing (`frappe.share.get_users` / `add` / `set_permission`); likes
  from the sidebar (`toggle_like`); comments (`add_comment`, `update_comment`, `update_comment_publicity`,
  `frappe.client.delete` on Comment, Mention notifications); Global Search (`frappe.utils.global_search.search` — the
  simulator has no MyISAM ranking, stopwords, minimum word length or 15-minute index lag, and with no Global Search
  Settings single in the store every DocType with a global-search field is searchable).
- **Simulator wrappers still needed for batch 2:** the built-in docinfo answers `attachments: []` / `tags: ""` and
  `files.upload` refuses everything but Data Import unless the transport is wrapped in `withSimulatedSidebar` (exported
  from `@solvfast/ui/frappe/testing`); the built-in bulk handler does not refuse Cancel for submitted back links — the
  opt-in `bulkUpdateHandler` does (it also goes through the form path and its permission checks).
- **Server reads and aggregates no recorded response covers:** sidebar counts (`get_group_by_count`,
  `get_sidebar_stats`), connection counts (`get_open_count`), Kanban boards (`get_kanban_boards`, the board document),
  `calendar.get_events`, print preview HTML (`get_html_and_style` — the simulator returns a labelled placeholder), Email
  Templates (`get_email_template`), `reportview.get` with child-table columns or an Attach Image column, getdoc's
  `_link_titles` and the MandatoryError body (both shaped in the tests from Frappe's source), `download_template` and
  `export_query` (unapproved read / writes an Access Log).
- **Not simulated at all:** `frappe.utils.print_format.download_pdf` (form PDF — only the URL shape is tested).
- **Realtime:** a fake port only; `createSocketRealtime` is a skeleton, no socket.io session has been run.
- **Permissions with restricted users, User Permissions and sharing:** simulator and recorded role lists only.

## Not implemented

**List views.** Gantt, Dashboard, Map, Tree and Inbox are not implemented and never offered by the view switcher
(`availableViews` reports them unavailable):

| View | Why not |
|---|---|
| Gantt | Desk's configuration is app JavaScript (`frappe.views.calendar[doctype]` field map with progress and dependencies), not meta; it needs a Gantt renderer and `update_event` writes |
| Dashboard | needs Dashboard Chart / Number Card documents and chart sources outside the DocType meta; the Core `chart/` and `cards/` exist but there is no Frappe adapter |
| Map | needs a map library and a tile server, plus `get_coords_method` (app JavaScript) or location fields; low relevance |
| Tree | tree settings are app JavaScript (`frappe.treeview_settings`) with `get_children` / `add_node`; only the nested-set filter operators exist |
| Inbox | applies to Communication only and depends on Email Accounts; low relevance |

The implemented views are partial: **Report** has no Report Builder `save_report`, no SQL aggregate group-by, no
charts, no multi-column sort and no column widths, and inline editors exist only for `INLINE_EDIT_TYPES` (Desk edits any
fieldtype); **Calendar** is a month view only (no week /
day view, no event drag / resize, no Calendar View documents, no time-zone conversion; in `reportview` mode rows without
an end date are left out); **Kanban** cannot create a board, add / archive / reorder columns or edit Kanban Settings;
**Image** has no gallery / zoom. In `FrappeViews` the List view's filters and sort carry into the other views
(`onQueryStateChange`).

**Form View.** Grid CSV download / upload; e-mail preview (and schedule, signature, reply-all); Markdown / HTML Editor
previews and a code editor; real controls for Signature, Geolocation, Barcode and Icon (shown read-only and reported);
Datetime time-zone conversion while editing (seconds are dropped); the currency symbol from `df.options`; Fold
("Show more"); placeholders on non-Data controls; naming-series preview; the rename *title* path
(`update_document_title`); a Submit step after a Quick Entry save; Client Scripts (use `formEvents`, decision D-24).

**List View.** Desk's 90-day recency filter on large tables; unseen rows in bold; "Edit DocType"; the sidebar's "Edit"
modal for group-by fields (they are read from `user_settings`, not editable); In / Not In on Date fields; "Load more" for
ungrouped lists (they page).

## Frappe layer — behaviour notes

- **Auth:** same-origin session cookie + CSRF only. Other schemes need a custom `transport`.
- **Permissions (rule 9):** without `session.roles` nothing is granted beyond the server's `docinfo.permissions` for a
  saved document; a new document, and a form without permission information, are read-only; create buttons, menu entries
  and Link "Create a new X" stay hidden. The Administrator user is treated as Frappe 15.110 does (every role).
- **One `or_filters` list:** with "Match any" filters, search narrows to the title field (the list says so). OR queries
  cannot be saved (`List Filter`, `user_settings`) or written to the URL.
- **Grouping** is client-side over loaded rows (chunks of 200, "Load more"); counts are exact once all rows are loaded.
  Server counts are in the opt-in group-by sidebar (`sidebar`).
- **Labels:** DocField labels and Select values are shown as defined on the server; pass `fieldLabels` / curated columns
  for translations.
- **Datetime filters** compare in the server's time zone, as Frappe does.
- **Realtime** is a full reload on `list_update` (Desk refreshes changed names only).
- **Selection layout:** `selectionMode` defaults to `"header"` (Desk's layout: "{n} items selected" in the header, the
  primary action replaced by the Actions menu; since 0.7.0-dev.2). `"bar"` is an opt-in that is not Desk's layout; in bar
  mode `bulkActions` get row objects for the current page only. Not reproduced: Desk's Shift+↑/↓ row checking and
  drag-select; a partial select-all shows as indeterminate (Desk: unchecked); in server mode a new query clears the
  selection; realtime updates are paused while rows are selected (actions that keep the selection reload explicitly).
- **Select all matching** (header mode) runs only query-based actions (Export by filter); name-based actions are disabled
  with a reason.
- **Print:** list background PDFs need the host's `subscribeTask` to see completion; the draft / cancelled rules need the
  site's Print Settings from the host.
- **Report view inline edit** follows Frappe 15.110's report view by default (`editable="desk"`, since 0.7.0-dev.2):
  `read_only_depends_on` is evaluated on the loaded row on a DocType without a Table field and ignored with one; the
  write right is Desk's `can_write` (level-0 write **or create**) and the field's permlevel is not checked — so the editor
  can appear where the server then refuses (create-only user: 403) or silently resets the value (permlevel without
  write). `editable="strict"` adds those checks on the client. Expressions that use more than `doc` are outside the
  package's interpreter.
- **Quick Entry** saves through `savedocs` (Desk: `frappe.client.save`).
- **Kanban** with a filtered list: the server's `update_order_for_single_card` pops `old_index` blindly
  (kanban_board.py:147-151), as on Desk.
- **Import:** not reproduced — Google Sheets, "Report Error", changing the import type after creation.
- **Form ⋯ menu (default on, `menu={false}` opts out):** Rename and Delete call the server but do not re-route — the host
  routes with `onRenamed` / `onDeleted`. Duplicate and New open an unsaved document in the same form; it lives in
  FrappeForm state (a remount or a change of the `name` prop drops it, as for Amend) and the form keeps its `name` prop —
  route with `menu.onOpened`. Reload is not offered for a new document or a local copy.
- **Connections tab** (default on when the DocType has a dashboard, `connections={false}` opts out): a form without Tab
  Breaks therefore shows a "Details" + "Connections" tab bar.
- **List create** (`create={{ … }}` without `render` / `onCreate`): Quick Entry for eligible DocTypes; a DocType that is not
  eligible goes to `create.onOpenFullForm`, and without it the Quick Entry dialog shows the whole form (Desk would route).
- **User defaults:** `FrappeProvider` applies `boot.userDefaults` to new documents (`userDefaults={false}` opts out);
  `remember_last_selected_value` is not reproduced.
- **Report view bulk actions** (`FrappeReportView bulk`, since 0.7.0-dev.3) are opt-in, as in `FrappeListView`; Desk
  always shows the checkboxes. A document shown on several Report rows (one per child-table row) is sent once — Desk sends
  one name per checked row and the server reports the repeat as failed. No `task_id` progress bar. The Image view has no
  Actions surface (Desk's Image view inherits the List view's), a follow-up.
- **Form Sidebar** (`FrappeFormSidebar`, since 0.7.0-dev.3): the host places it (`FrappeFormView` does not mount it);
  not hidden on phones; no sidebar image, Follow / Followed by, Reviews (energy points), auto-repeat, page views or
  sidebar extension; no "Assign To User Group"; uploads show waiting / uploading / uploaded / failed but no percentage
  (`fetch` has no upload progress); no Camera, Google Drive, crop or optimize; the Library tab is a text search
  (`get_files_by_search_text`), not Desk's folder tree. Attach "+" and tag editing are offered to every reader, as Desk;
  the server refuses without write. `disable_document_sharing` is not read from the site: pass `sharingDisabled`.
- **Global Search** (`GlobalSearchBar` + `useFrappeGlobalSearch`, since 0.7.0-dev.3): not reproduced — calculator,
  random password, `#tag` search, Help table, executables (Background Jobs), Marketplace rows; `desk_settings.search_bar`
  gating is the app's choice to render the bar. The awesome bar's rows come from the boot lists the app passes
  (`deskSearchBootFrom(frappe.boot)`); a boot without `can_read` / `can_create` lists (e.g. a custom page boot) yields
  pages and recents only. Recents are in memory per tab, as Desk's `route_history`.
- **LinkInput picker mode** (opt-in, since 0.7.0-dev.3): Space types (it does not open), arrows wrap at the ends, no
  Ctrl+N/J/P/K bindings; `FrappeLinkField` does not expose the picker props.
- **Simulator coverage gaps:** Communication Links are not simulated; `get_kanban_boards` skips the permission engine when
  the Kanban Board meta is not loaded; Kanban's `private` permission query is a local rule.
- **`@solvfast/ui/frappe/testing`** (the simulator) ships as its own entry; `@solvfast/ui/frappe` never imports it.

### Frappe 15.110 server rules to know (read from Frappe 15.110 source, not yet observed on a site)

These are Frappe's behaviour, not the package's. They were read from the 15.110 source in P36 and are asserted by the
prepared validation run (`docs/audit/p36/VALIDATION-MATRIX.md` §7, test ids in brackets) — **none has been observed on a
site yet**.

- **`mandatory_depends_on` is client-only.** The server enforces only `reqd`; a conditionally mandatory field is enforced
  by the form (the package does, on the simulator). Any other client that writes skips it. [F-REQ-2, F-REQ-3]
- **Permlevel writes are reset silently.** A user without write on a field's permlevel who changes it gets HTTP 200 and the
  stored value is kept (`validate_higher_perm_levels`), not a 403. Lists drop unreadable permlevel fields silently.
  [F-PERMLEVEL-2, L-PERM-2]
- **Amend is checked against `create`.** Amending is an insert: the server checks `create` and that the source is
  cancelled, not the `amend` right ("amend needs amend + create" is a client gate). [F-AMEND-2]
- **Saved filters are open to every Desk user.** `List Filter` grants read / write / create / delete to every Desk User
  with no owner rule: anyone can create a global filter or delete another user's filter; the package's "Is Global" gate
  is client-side. [L-SAVED-2]
- **`toggle_like` has no permission check.** [L-LIKE-1]
- **`export_query` writes an Access Log** before it refuses a user without `export`. [L-EXPORT-1]
- **`user_settings.save` merges shallowly:** a Desk save of `List` without the package's `sf_ui` key drops it (LV.A6b).
  [L-USERSET-1]
- Also: bulk submit / cancel / update answer HTTP 200 with a per-document failed list, bulk delete reports failures by
  realtime msgprint [L-BULK-2, L-BULK-3]; User Permissions filter list rows silently while `getdoc` of a hidden record is
  403 [L-PERM-1]; whether User Permissions apply to the sidebar's `assigned_to` counts (`frappe.qb.get_query`) is recorded,
  not known [L-GROUP-1].
- **Global search filters by DocType only** (0.7.0-dev.3 feature). `frappe.utils.global_search.search` returns rows of
  every DocType in Global Search Settings that the user can read (`get_can_read`, which also counts DocTypes in which a
  single document is shared), with **no per-row check**: the name and the matching field snippets of every indexed
  document of such a DocType are returned, even ones User Permissions or `if_owner` hide (opening one is still refused).
  The index syncs every 15 minutes. [S-GSEARCH-1, S-GSEARCH-2]
- **Assignment needs read, not write.** `assign_to.add`, `remove` and `close` check only read on the document (`close`
  also requires the session user to be the assignee, else 417); Desk's sidebar offers remove only to the assignee or a
  writer, but the server lets any reader remove an assignment. Assigning a user who cannot read the document shares it
  with them — only if the **assigner** holds the `share` right (the automatic share runs `frappe.share.add` as the
  assigner); otherwise the request fails with 403 and nothing is assigned. With sharing disabled → "Missing Permission".
  [F-SB-ASSIGN-1]
- **Tags need write, checked after the write.** `add_tag` / `remove_tag` set `_user_tags` and then `update_tags` checks
  write; the refusal rolls the request back. `modified` is never touched. [F-SB-TAGS-1, L-TAG-2]
- **Sharing grants only what the sharer holds.** `share` itself is never restricted, but granting read / write / submit
  needs that right; un-ticking read deletes the share (the answer has no `message`); DocShare cascades share / write /
  submit ⇒ read and submit ⇒ write. [S-SHARE-1]
- **Comments:** edit = author or Administrator (403); publish = author or System Manager (417, a plain `frappe.throw`);
  delete = the Comment DocPerm (System Manager / Website Manager), not authorship. Mention notifications are enqueued
  (they need a worker). [F-SB-COMMENT-1]
- **Attachments:** removal needs the file's owner or write on the attached document; with `protect_attached_files` a
  submitted document's files cannot be removed and a cancelled one's need delete. [F-SB-ATTACH-1, F-SB-ATTACH-2]
- **Bulk Submit / Cancel:** an unknown name fails the whole request (404) after earlier documents were committed; a name
  sent twice is reported failed the second time. [L-BULK-5, V-REPORT-2]

## Known bugs

- `DataGrid` has a fixed minimum width (`32rem`): on a 390 px phone it scrolls horizontally, and so do Frappe Table fields
  (`FrappeChildTable`). Accepted by the owner for now (P36 batch 2: no card layout for DataGrid or Table fields; a card
  layout built during P36 was reverted before release).

## Environment

- React 18.3 only; React 19 untested. Tailwind 3.4 (path A) or no Tailwind (path B); Tailwind 4 untested.
- Frappe 15 only (built and tested against the 15.110 source); other versions untested.
- Browsers: all visual and interaction checks ran in Chromium (Playwright). Firefox and Safari are untested; the glass
  styles include `-webkit-backdrop-filter` and fall back to more opaque, blur-free surfaces without `backdrop-filter`
  or under `prefers-reduced-transparency`.
- Accessibility: names, roles, keyboard rows, `aria-sort`, focus rings, reduced motion and reduced transparency are
  tested automatically; no manual screen-reader pass has been done.

## Intended differences from Sear

Documented with screenshots in docs/VALIDATION.md and docs/FEATURES.md.
- List: row actions are a fixed last column (8 of 44 parity shots); the toolbar wraps on phones (4 of 44).
- Shell: notification panel glass in dark mode, Arabic app-switcher labels, current-app highlight, "More" sheet on the
  start edge in Arabic (14 of 44 shell parity shots).
- Buttons: 180 ms hover / 120 ms press on every variant (Sear's glass buttons use 0.4 s / 0.16 s).
- List: grouped rows share one table and column layout.

## Rendering

- Path B (no Tailwind): a sheet whose edge falls on a half pixel (e.g. the 75 %-wide sheet at 390 px) can anti-alias
  slightly differently from path A; glass can re-rasterize slightly differently after a stylesheet is added at runtime
  (≤27/255 seen). Computed styles are identical.
- Badge `brand` uses `bg-primary/12`, which Tailwind 3 doesn't generate (as in Sear today) — kept for parity.

## List View

- Client mode keeps every row in memory and renders the visible page; there is no virtualization (large data sets:
  use server mode).
- Server mode: the selection keeps keys across pages, but `bulkActions` receive row objects only for rows on the
  current page (keys for all).
- Grouped: collapsing a group can re-balance column widths (all groups still share the header's columns).
- `layout="auto"` switches to cards only where a phone media query matches; `layout="cards"` forces them.
- Select all matching ends when a row is unchecked or the query changes.

## Merged components (0.3.0)

- **Not shipped:** drawer (vaul), carousel (embla-carousel), input-otp, resizable (react-resizable-panels: v2 in Sear and
  the Design System, v4 in PMO and the starter). Apps keep their local shadcn copies; with the preset (path A) their
  token utilities follow the package theme, without the glass surfaces (docs/CONSUMING.md §7).
- The navigation menu's panel (Radix `Viewport`) is not portaled — Radix renders it inline, positioned against the menu
  root. It carries the popper glass but can be clipped by an ancestor with `overflow: hidden`.
- The dropdown menu's sub-menu chevron still points right in Arabic (unchanged from 0.2.0); the new context menu and
  menubar sub-menus mirror theirs.
- Charts: recharts draws left-to-right; in Arabic reverse the category axis yourself (`<XAxis reversed={isRTL} />`).
  recharts 2's own type declarations import lodash types — with `skipLibCheck: false` the app also needs
  `@types/lodash`. recharts 2 is in maintenance upstream (v3 exists; the Design System's chart targets v2).
- SearchCombobox: no cache between comboboxes or openings (each opening searches again); `queryKey` only resets.
- RichTextEditor uses `contenteditable` + `document.execCommand` (deprecated but still supported by browsers), as in
  PMO. `sanitizeHtml` keeps only absolute `http(s):` / `mailto:` links (relative links lose their `href`) and drops
  every attribute — no images, tables, colours or alignment.
- PageHeader's title goes to the AppShell top bar only for text titles; a node title stays in the page (then the page
  has two `<h1>`s: the top bar's and the header's).

## Toasts

- Only sonner's API (`toast()`); shadcn's `useToast()` / `use-toast` is not provided.
- In dark mode a toast is black: sonner's own dark styles outrank the card classes — the same as in the Design System
  and Sear (parity identical).
- sonner 1.7 and 2.x both work (clean installs of each); their default offsets differ by 8 px.

## Packaging and release

- Proprietary (LICENSE): for Solvfast and those it authorises. Published only to GitHub Packages, as a private package;
  `npm publish` is blocked until HEAD is tagged and the tree is clean (`scripts/prepublish-check.mjs`).
- Dependencies are pinned to the exact versions tested; consumers on other versions of the same libraries (e.g.
  `lucide-react`, Radix) get a second copy.
- Installing from GitHub Packages needs the consumer's own GitHub token with `read:packages` (docs/CONSUMING.md).

## Date filters (Frappe's operators, 0.3.0)

- Fiscal Year needs the site's "Fiscal Year" DocType (ERPNext) and read access to it. Without it the option isn't offered.
- Frappe also offers In / Not In on Date fields. The package doesn't: their date-list input isn't built.
- Client-mode Timespans use Sunday as the first day of the week (Frappe's default). A site that changed
  System Settings → First Day of the Week gets that day on the server (FrappeListView) but Sunday in client mode.
- Labels outside dates keep the package's wording ("Contains", "Not equals", "Is set" shown as Is → Set / Not Set);
  only the date operators use Frappe's labels.
