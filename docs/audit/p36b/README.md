# P36 batch 2 (P36b) — index (`@solvfast/ui` 0.7.0-dev.3, unreleased)

Batch 2 delivered the owner's feature requests on top of P36 batch 1: the **LinkInput picker mode** (and the CRM pickers
P1–P5 on it), **Submit / Cancel in the Report view**, Frappe **Global Search** (package + CRM header), and the **Form
Sidebar** — Assign, Attach, Tags (D1) and Share, Like, Comments (D2); two mid-batch tasks followed: Desk's **Attach /
Attach Image** control (E attachimage) and the design-system label **Workflow → Lifecycle** (F lifecycle). Integration branch `feat/0.7.x/p36-int`
(`package.json` 0.7.0-dev.3). Nothing was pushed, tagged, published or deployed. **No Frappe site was contacted, seeded,
read or written: every result below is unit / jsdom / simulator evidence (and, for the CRM, Playwright on local static
builds in mock data mode).**

| Document | What it holds |
|---|---|
| `CHANGELOG.md` → 0.7.0-dev.3 | Added / Changed / Fixed / Deviations from Desk / Validation status |
| `docs/audit/p35/COVERAGE.md` §9–§10 | the 9 rows whose cells batch 2 edited (incl. FV.A20, FV.A21, FV.G10 mid-batch; no status change, 258 / 301) and the batch-2 features outside the fixed denominator |
| `docs/audit/p36/VALIDATION-MATRIX.md` §5 | the 16 batch-2 real-site tests (11 + F-ATTIMG-1 … -5; prepared, not run; 91 in the catalogue) — generated from `e2e/frappe-site/matrix/catalogue.mjs` |
| `docs/audit/p35/CRM-MIGRATION.md` §8 | the CRM branches `crm/p36b-pickers`, `crm/p36b-search`, `crm/p36b-070` |
| `docs/LIMITATIONS.md` (incl. "Attach / Attach Image", the Lifecycle terminology note), `docs/FRAPPE.md`, `docs/CONSUMING.md` §10 | new APIs / endpoints, simulator-only status, Frappe server rules to know |
| `docs/components/forms.md` (LinkInput; §3 / §3.1 Attach Image), `list.md` §6, `views.md` §3–5, `record.md` (Form Sidebar; Share, Like, Comments; Terminology), `search.md` | component docs, written by the workstreams |

## 1. Owner instructions (batch 2) — summary

- **No DataGrid mobile card layout** (correction): the W3 card layout was reverted (`ccb232d`); no card layout anywhere, no
  change to any table's responsive behaviour; horizontal scrolling on phones is accepted.
- **List selection = Desk's header actions** (P36-1, in force): with ≥ 1 row selected, Actions replaces "Add" in the same
  header area; Edit and workflow actions keep the selection; Submit / Cancel clear it only when every document succeeded.
- **Reproduce native Frappe**: the Frappe 15.110 source (`apps/frappe`, read only) is the specification; cite file:line;
  never simulate a server operation by changing only local UI state.
- **Real-site validation is impossible now**: evidence = unit tests + the in-package simulator, labelled so; never claim
  real Frappe validation. Every site on the server is production or a client site; there is no staging site.
- Requested features: CRM configuration pickers to behave like the select they replace (click opens, check mark); Submit
  / Cancel on the Frappe table views; a working global search like Frappe's (package + CRM header); Desk's form sidebar
  (Assign, Attach, Tags, Share, Like, Comments — the comments slot drawn last).
- **Mid-batch, E attachimage:** the Attach Image field (and Attach) must behave like Desk's native control — the uploader
  and its sources, private / public, save after upload, Clear, preview, the form image — reproduced from the Frappe source,
  not approximated; the integrator extended the ownership so `FrappeFormView` is the control's form (`FrappeAttachHost`) and
  the uploader gained Optimize, thumbnails, the public warning, Crop and Camera.
- **Mid-batch, F lifecycle:** a **label change only** — the design system calls Frappe's Workflow feature "Lifecycle"
  (ar "دورة الحياة", the CRM's own term); Frappe's Workflow functionality, APIs, state transitions, permissions, fields,
  DocTypes and server text stay untouched (message keys too, because apps override them).

## 2. Workstreams, branches and commits

Package branches A–D are based on `a85d734` (batch-2 extension points); the mid-batch branches E and F on `a172a9b`
(0.7.0-dev.3, after the first batch-2 docs). CRM branches are in the CRM repository, based on `bf46479`
(`crm/p36-needs-070`).

| Workstream | Branch | Commits | Merged as |
|---|---|---|---|
| A linkinput | `feat/0.7.x/p36b-linkinput` | `a0bcda0`, `ba04f07` | `8a15879` |
| A — CRM | `crm/p36b-pickers` | `0d1e1c6` (= `6310fc0`), `31c4999` | CRM repository, not merged |
| B bulk | `feat/0.7.x/p36b-bulk` | `4f0c588`, `6f2f349`, `a020cf4`, `cbc3959`, `1967379` | `3ef750a`; integrator `86fbfc4` (simulator bulk_update fidelity) |
| C search | `feat/0.7.x/p36b-search` | `171ec49`, `127e8d7`, `e007e5d` | `c85fc02` |
| C — CRM | `crm/p36b-search` | `93ae78a`, `7a6ca1b` | CRM repository, not merged |
| D1 sidebar | `feat/0.7.x/p36b-sidebar` | `5e86bc5`, `d4c0e12`, `dc9edc6`, `ce3ce71`, `bb3b217`, `66f1cfd` | `2e66fb7`; integrator `45efe8d`, `3b0925a` |
| D2 social | `feat/0.7.x/p36b-social` | `e5b53dd`, `7da0ad4`, `eea65a5`, `3b695c3`, `4bc5950`, `4997f37`, `8c28649` | `c403a2b` (incl. docinfo `published`) |
| CRM 0.7 | `crm/p36b-070` | `f7bd1da` (merge of `31c4999` + `7a6ca1b`) | CRM repository, not merged |
| E attachimage (mid-batch) | `feat/0.7.x/p36b-attachimage` | `9812f00`, `dd2163d`, `289fce3`, `07035c7` | `1a58be2`; integrator `2dd3c6e` (sidebar Optimize) |
| F lifecycle (mid-batch) | `feat/0.7.x/p36b-lifecycle` | `c16c6b6`, `e067090`, `a24f2f3` | `6c7bf58` (no CRM change: the CRM overrides both keys) |

Integrator changes on top of the workstreams:
- `ccb232d` / `360de88` — DataGrid card layout reverted; docs cleaned of card-layout claims.
- `a85d734` — extension points (per-workstream simulator handler modules, message catalogues).
- `86fbfc4` — the built-in simulator `submit_cancel_or_update_docs` follows bulk_update.py:51-114 (drafts-only Submit,
  submitted-only Cancel, Update not on cancelled, an unknown name fails the request, 20–500 enqueued, > 500 refused);
  fixture tests updated to the native semantics.
- `c403a2b` — simulator docinfo comments carry `published` (load.py:158).
- `45efe8d` — `FrappeFormSidebar` renders D2's Share / Likes / comment count / Comments by default; Attach "+" and Tags add
  / remove follow Desk (no client gate, the server refuses; attachment remove still needs write, attachments.js:161);
  simulator `add_tags` enforces write through `update_tags` (tag.py:105-120, 147-152); `@solvfast/ui/frappe/testing`
  exports `withSimulatedSidebar`, `bulkUpdateHandler`, `bulkDemoBackend`.
- `3b0925a` — corrects the P27 simulator test that read "no permission check" for `tag.add_tags`.
- `963bd85` — version 0.7.0-dev.3.
- `2dd3c6e` — the Form Sidebar uploader offers Optimize like Desk (FileUploader `allow_toggle_optimize` default true,
  FileUploader.vue:305-307; attachments.js:249-258 does not override it): `FrappeAttachments` passes `allowOptimize` and
  forwards `optimize` through `useFormSidebarActions` to `upload_file`; test P36B.sidebar.23.

```
git log --oneline --first-parent a85d734~3..HEAD   (before this docs commit)
963bd85 P36b: version 0.7.0-dev.3
c85fc02 P36b: merge C search (Global Search bar + dialog, Frappe adapter hook)
8a15879 P36b: merge A linkinput (opt-in picker mode: open on click when filled, selected check mark)
3b0925a P36b: simulator test — tag.add_tags enforces write through update_tags (tag.py:105-120, 147-152), correcting the P27 'no permission check' reading
45efe8d P36b: sidebar integration — Share / Likes / comment count / Comments render by default (D2 parts), Attach "+" and Tags add / remove follow Desk (no client gate; server refuses), simulator add_tags write check (tag.py update_tags), testing exports
2e66fb7 P36b: merge D1 sidebar (Form Sidebar: Assign, Attach, Tags + parent)
c403a2b P36b: merge D2 social — resolve append blocks; simulator docinfo comments carry `published` (load.py:158)
86fbfc4 P36b: simulator bulk_update follows bulk_update.py (drafts-only Submit, submitted-only Cancel, update not on cancelled, unknown name fails the request, 20–500 enqueued, > 500 refused); fixture tests updated to the native semantics
3ef750a P36b: merge B bulk (Submit / Cancel in the Report view, shared selection actions)
360de88 P36 batch 2 docs: remove the reverted DataGrid card-layout claims (DataGrid unchanged from 0.7.0-dev.1; CRM M10 stays not migrated)
a85d734 P36 batch 2: extension points for the search / sidebar / social workstreams (simulator handlers, messages)
ccb232d P36 batch 2: revert the DataGrid mobile card layout (owner correction: no card layout; keep the table and its horizontal scroll)
cf3fd48 P36: batch 1 integrator checks, Report-view correction to the P35 report, server rules to confirm on staging
```

```
git log --oneline --first-parent a172a9b..HEAD   (mid-batch, before this docs commit)
6c7bf58 P36b: merge F lifecycle (DS label Workflow → Lifecycle / دورة الحياة; APIs, fields, keys unchanged)
2dd3c6e P36b: Form Sidebar uploader offers Optimize like Desk (FileUploader allow_toggle_optimize default true) and forwards it to upload_file; test
1a58be2 P36b: merge E attachimage (native Attach / Attach Image: uploader, save after upload / clear, Optimize, Crop, Camera, header image menu)
```

Tests added (all jsdom / simulator): `tests/linkinput-p36b.test.tsx` (13), `tests/bulk-p36b.test.tsx` (21),
`tests/global-search-p36b.test.tsx` (15), `tests/form-sidebar-p36b.test.tsx` (23, `.23` by the integrator),
`tests/social-p36b.test.tsx` (22); mid-batch `tests/attach-image-p36b.test.tsx` (37), `tests/lifecycle-p36b.test.ts` (1;
guard: no en / ar message value says Workflow), and adapted `tests/attach.test.tsx` (6) and `tests/list-actions.test.tsx`
(the bar button now reads "Lifecycle").
Showcase pages (all backend operations labelled SIMULATED): `#p36b-linkinput`, `#p36b-bulk`, `#p36b-search`,
`#frappe-form-sidebar`, `#p36b-social`, `#p36b-attachimage`; the lifecycle task changed visible text only (Frappe ›
Lifecycle `#frappe-workflow` — id kept —, P35 list, P36b bulk, Frappe overview cards, simulator note).

## 3. Frappe source inspected, per feature (Frappe 15.110, read only)

| Feature | Files (and lines) |
|---|---|
| LinkInput picker mode | `public/js/frappe/form/controls/link.js:35-41` (focus lists only when empty), `:211-216` (Awesomplete `minChars 0`, `autoFirst`), `:307`, `:432`, `:476`; Awesomplete 1.1.5 `awesomplete.js:73-92` (keys), `:248-257` (`aria-selected` on the highlight); `form/controls/select.js:2` (native select); `desk/search.py:37` (not called — Core control) |
| Report view Submit / Cancel | `public/js/frappe/list/list_view.js:161-180, 585-598, 1588-1599, 1855-1887, 1999-2051, 2088-2128`; `list/bulk_operations.js:275-308`; `views/reports/report_view.js:9, 53, 360, 371-374, 1339-1352`; `views/image/image_view.js:6, 113`; `views/kanban/*.js` (no checkbox); `model/model.js:395-412`; `utils/user.py:146-150`; `core/doctype/doctype/doctype.py:1785-1808`; `desk/form/meta.py:234-244`; `desk/doctype/bulk_update/bulk_update.py:51-114`; `model/document.py:380-404, 880-915, 1080-1105, 1175-1186`; `model/delete_doc.py:265-331, 432-445` |
| Global Search | `public/js/frappe/ui/toolbar/awesome_bar.js` (10-58, 65-99, 109-143, 147-261, 295-380), `search_utils.js` (5-620), `fuzzy_match.js` (17-180), `search.js` (10-400), `search.html`, `navbar.html:2-35`, `toolbar.js:74-86, 155-169`, `keyboard.js:43-56, 152-155, 198-206`, `router.js:11, 303-306, 423-478`, `list/list_view.js:2130-2148`; `utils/global_search.py` (35-136, 233-279, 347-462, 465-526, 529-583); `query_builder/custom.py:44-48`; `model/meta.py:217-223`; `utils/user.py:130-208`; `desk/doctype/global_search_settings/*` (py 22-103); `boot.py:69-191`; `hooks.py:201-206, 376-393` |
| Form Sidebar (Assign, Attach, Tags) | `public/js/frappe/form/templates/form_sidebar.html` (1-171); `form/sidebar/form_sidebar.js:24, 51-61, 70-120, 122-150, 186-198, 237-287`; `form/sidebar/assign_to.js:13-63, 94-231, 244-373`; `form/sidebar/attachments.js:7-260`; `file_uploader/FileUploader.vue:386-400, 443, 533-698`; `FileBrowser.vue:120-130`; `ui/tag_editor.js:35-101`; `ui/tags.js:34-89`; `form/form.js:586-591, 1990-2033`; `desk/form/load.py:100-143, 146-196, 353-395, 483-503`; `desk/form/assign_to.py:25-233`; `handler.py:173-282`; `core/doctype/file/file.py:93-128, 183-190, 333-357, 510-538, 793-813, 872-911`; `desk/form/utils.py:19-23`; `desk/doctype/tag/tag.py:34-70, 87-175`; `core/api/file.py:65-82`; `app.py:302-314` |
| Attach / Attach Image (mid-batch) | `public/js/frappe/form/controls/attach.js:2-150` (button / row :2-28, Clear :36-55, Reload :56-60, 146-150, `set_upload_options` :70-93, `on_upload_complete` :137-144), `attach_image.js:153-174`; `form/formatters.js:406-413`; `file_uploader/file_uploader.bundle.js:31-47, 141-161`; `FileUploader.vue:1-191, 270-307, 352-356, 424-445, 469-513, 533-703`; `FilePreview.vue:1-160`; `ImageCropper.vue`; `ui/capture.js:80-134`; `form/sidebar/user_image.js:1-86`, `form_sidebar.js:17-22, 70-73`, `templates/form_sidebar.html:8-18`, `form/sidebar/attachments.js:199-291`; `form/quick_entry.js:127-131`, `ui/field_group.js:5-7`, `form/layout.js:248-252`; `handler.py:173-282`; `desk/form/save.py:20-22`; `core/doctype/file/utils.py:377-419`; `model/document.py:333`; `core/api/file.py:86-91`; `desk/form/utils.py:19-23`; `core/doctype/file/file.py:300-357, 510-540, 757-767, 872-910`; `utils/image.py:45-72`; `app.py:197-200` (docs step) |
| Lifecycle label (mid-batch) | `public/js/frappe/list/list_view.js:160-170, 1800-1826, 2106-2122` (workflow items appended to Actions with no group label; Submit / Cancel hidden under an active Workflow); `model/workflow.py:39, 99, 238, 332` (APIs unchanged) |
| Share / Like / Comments | `share.py:20-268`; `core/doctype/docshare/docshare.py:33-91`; `permissions.py:111-113`; `public/js/frappe/model/model.js:462-473`; `form/sidebar/share.js:12-202`, `templates/set_sharing.html`; `desk/like.py:15-91`; `public/js/frappe/ui/like.js:4-127`; `form/templates/form_sidebar.html:139-161`; `desk/form/utils.py:26-79`; `core/doctype/comment/comment.py:25-150`, `comment.json` (permissions); `desk/notifications.py:390-440`; `desk/doctype/notification_log/notification_log.py:73-117`; `desk/form/load.py:108, 130, 146-183, 212-219`; `form/footer/footer.js:8-72`; `form/footer/form_timeline.js:607-676, 723-760`; `form/templates/timeline_message_box.html` |

Workstream reports with the full spec (session scratchpad, not in the repository): `scratchpad/p36b/ws/{linkinput,bulk,
search,search-native-spec,sidebar,social,attachimage,lifecycle}.md`.

## 4. Deviations from Desk (each deliberate)

**LinkInput picker mode** (opt-in; the default `LinkInput` and `FrappeLinkField` are unchanged)
1. Opens the full list on click / tap / Enter on a filled box (Desk: never, link.js:35-41) — owner requirement (parity with
   the select it replaces).
2. `aria-selected` + check mark on the current value (Awesomplete marks the highlight, awesomplete.js:248-257); the
   highlight is exposed with `aria-activedescendant`.
3. `keepValueWhenEmptied`: an emptied box restores the value (Desk clears an emptied Link).
4. Escape restores the shown value (Awesomplete leaves the text); Home / End move in the open list.

**Report view Submit / Cancel**
1. Partial failure: a status line with the per-document result + Desk's "Cannot submit {names}." sentence, the list
   reloads and keeps the selection (Desk: error dialog, no refresh) — P36 rule.
2. A document shown on several Report rows is sent once (Desk: once per checked row, the server reports the repeat as
   failed) — accurate per-document results. **Owner decision pending** (§7).
3. No `task_id` / progress bar; `bulk` is opt-in in both table views (Desk always shows checkboxes); the Cancel gate also
   requires submittable (equivalent: doctype.py:1785-1808).

**Global Search**
1. Not reproduced: calculator (Desk `eval`s), random password, Help table, executables, Marketplace rows, `#tag` search.
2. Phones (< md): an icon opening a full-screen dialog (Desk keeps a 300 px bar); the dialog's idle state lists recents.
3. Additions: dialog error state + Retry, ↑/↓/Enter + ARIA in the dialog, loading row for async suggestions, stale answers
   dropped. Desk quirks not reproduced: nav-group "More" re-showing the first 20; duplicate rows for "a & b".
4. "New X" → `/app/<slug>/new` (Desk may open Quick Entry); result href = canonical `/app/<slug>/<name>`.

**Form Sidebar (Assign, Attach, Tags)**
1. Assignees one per row with Done / × inline (Desk: avatar stack + "Assignments" dialog); no "Assign To User Group".
2. Attach "+" and tag add / remove are offered to every reader, **as Desk** (integrator `45efe8d`; the server refuses:
   handler.py:220-221, tag.py:152). Attachment remove still needs write (attachments.js:161-174).
3. A refused tag pill is removed with the server message (Desk keeps it, tags.js:69-76).
4. No upload percentage (package uploads use `fetch`), no Google Drive; Library = text search
   (`get_files_by_search_text`), no folder tree. (Mid-batch: the shared `AttachDialog` brought thumbnails, the public
   warning, Crop and Camera; `2dd3c6e` turned on Desk's Optimize switch.)
5. Empty-section texts ("No attachments", "No tags"); a line when `max_attachments` is reached (Desk only hides "+").
6. The comment list is drawn in the sidebar's last slot (owner); Desk's comment box is in the form footer.
7. Not reproduced: sidebar image, beta notice, Reviews, Follow / Followed by, auto-repeat, page views, sidebar extension,
   the "+" keyboard shortcut. Not hidden on phones (Desk: `hidden-xs hidden-sm`); the host places the sidebar.

**Share / Like / Comments**
1. Share rows show full name + id; an "Everyone" pill; a read-only hint naming the reason; `disable_document_sharing` is a
   prop (`sharingDisabled`) — the server enforces it anyway; docinfo is re-read after each change (Desk: when the dialog
   closes); a saving row is disabled until the answer.
2. The liked-by list opens from the count button (Desk: hover popover only, none on touch).
3. Comment edit is not optimistic (Desk shows the new text before `update_comment` returns); Delete / Publish are icon
   buttons with Desk's confirmations; Desk's "commented" word is not shown; count buttons have accessible names.

**Attach / Attach Image** (mid-batch E; details `docs/LIMITATIONS.md` "Attach / Attach Image")
1. Not reproduced: Google Drive and app-registered upload handlers; upload percentage (`fetch`); `df.options` merged into
   the uploader options (attach.js:89-91).
2. Crop is dependency-free (no cropperjs): move / 4 corner handles / keyboard, ratios 1:1 / 4:3 / 16:9 / Free, start box
   80 % centred, kept in the image; no rotate / zoom (Desk disables zoom / scale too); output = canvas `toBlob` in the
   original type and name.
3. Camera: `getUserMedia` first on every device, the `capture` input as fallback (Desk uses `capture` on phones,
   capture.js:80-81, 118-134); `force_web_capture_mode_for_uploads` not read.
4. The image menu is in the form header (no sidebar image block); its Remove saves with the form's default action
   ("Update" on a submitted document; Desk passes none → "Save").
5. The preview popover also opens on keyboard focus; Reload File re-sends this session's last local file; the Clear lookup
   uses the docinfo query cache, the form's docinfo, then Files this control uploaded (Desk pushes the new File into
   docinfo, attachments.js:277-291).
6. Simulator: `optimize_image` is not run (bytes are not stored); `withSimulatedSidebar`'s JSON `upload_file` record does
   not carry `optimize` (asserted at the client → files-transport boundary and on the real multipart body instead).

**Lifecycle** (mid-batch F): none in behaviour. Desk's word is "Workflow"; the design system's chrome says "Lifecycle"
(owner) — only in the opt-in bar button and the "none applies" item, since Desk shows no group label for the workflow items
in the Actions menu. Server text (e.g. the "Workflow Status" msgprint) still arrives in Frappe's wording.

**Frappe server rules the real-site tests will confirm** (read from source; Frappe's behaviour, not the package's):
`global_search.search` filters by DocType only (no per-row check) [S-GSEARCH-1]; `assign_to.add` / `remove` / `close`
need read only, `close` only by the assignee (417), and assigning a user who cannot read needs the assigner's `share`
right (the automatic share runs as the assigner; 403 otherwise) [F-SB-ASSIGN-1]; tags write `_user_tags` and then check write (rolled
back on refusal) [F-SB-TAGS-1]; sharing grants only rights the sharer holds, un-ticking read deletes the share [S-SHARE-1];
`toggle_like` has no permission check [F-SB-LIKE-1, L-LIKE-1]; comment edit = author (403), publish = author or System
Manager (417), delete = Comment DocPerm (System / Website Manager) [F-SB-COMMENT-1]; an unknown name fails a whole bulk
request (404) and a repeated name fails the second time [L-BULK-5, V-REPORT-2]; `upload_file` stores `cint(is_private)`
(omitted → public) [F-ATTIMG-5]; a `new-…` upload needs write on a new document and is relinked on insert only for the
Attach field's own File [F-ATTIMG-3]; a body above `max_file_size` is refused with 413 before the handler (app.py:197-200)
[F-ATTIMG-4]; `optimize_image` shrinks only image/* file parts and keeps the result only if smaller [F-ATTIMG-1].

## 5. What is simulator-only

Every batch-2 server path: `submit_cancel_or_update_docs` from the Report view; `assign_to.add` / `close` / `remove`;
`upload_file` (multipart and the JSON `library_file_name` / `file_url` forms), `remove_attach`,
`get_files_by_search_text`; `tag.add_tag` / `remove_tag` / `get_tags`; `frappe.share.get_users` / `add` /
`set_permission`; `toggle_like` (sidebar); `add_comment`, `update_comment`, `update_comment_publicity`,
`frappe.client.delete` (Comment), Mention notifications; `frappe.utils.global_search.search`; mid-batch, the Attach
control's `upload_file` (`fieldname`, `new-…` docname, `optimize`), `frappe.core.api.file.get_max_file_size`,
`remove_attach` + the following `savedocs`, and the relink of `new-…` Files on insert. Simulator limits: no MyISAM
ranking / stopwords / 15-minute index lag; the built-in docinfo answers `attachments: []` / `tags: ""` unless wrapped in
`withSimulatedSidebar`; the built-in bulk handler does not refuse Cancel for submitted back links (the opt-in
`bulkUpdateHandler` does); a queued bulk job runs at once; no realtime `docinfo_update` / `list_update` delivery.
`optimize_image` is not simulated. The CRM Global Search was checked in **mock mode** only (CRM stores); its Frappe branch
is unverified. The lifecycle label was checked on the CRM (`crm/p36b-070` @ `f7bd1da`, read only) in mock and simulated
mode: no text or visual change, because `CrmAppLayout.tsx:173-176` overrides both keys.

## 6. Real-site blockers

The 16 batch-2 catalogue tests (`docs/audit/p36/VALIDATION-MATRIX.md` §5) are BLOCKED like every other test: they need an
owner-approved, isolated staging site (`docs/audit/p36/README.md` §4). On top of the P36 requirements:
- **F-SB-ATTACH-2** needs `protect_attached_files = 1` on SFUI Test Parent (Customize Form; the staging seed does not set
  it) — otherwise it reports BLOCKED.
- **S-GSEARCH-2** (manual) needs a System Manager, the scheduler (`sync_global_search` every 15 min) and an SFUI field
  marked In Global Search; S-GSEARCH-1 records result contents and needs the optional `sysmgr` account to read Global
  Search Settings.
- **F-SB-COMMENT-1** needs the site's worker for the Mention Notification Log (recorded, not asserted) and the optional
  `sysmgr` account for the Comment delete positive (else BLOCKED).
- **L-BULK-5**'s 20-name job needs the worker for its recorded outcome.
- **F-ATTIMG-1** (Optimize) is manual: `run-matrix.mjs`'s upload helper sends only a text/plain part with doctype / docname
  / is_private (run-matrix.mjs:132-137), so an image with `optimize` (and `fieldname`) must be sent from Desk, the Showcase
  or a harness page against staging — or after extending the helper. F-ATTIMG-3 sends `fieldname` through the JSON form
  (`file_url`). **F-ATTIMG-4** reports BLOCKED when the site's `max_file_size` is above 30 MiB (the runner will not send a
  larger body); a front proxy's own 413 would also satisfy it (recorded). Camera on real devices and crop quality per
  browser have no catalogue test (manual device check).
- No harness page wires the Form Sidebar, the Report view `bulk` or the search bar, so these API tests validate Frappe's
  answers, not the package screens; a browser pass needs harness work.

## 7. Owner decisions pending

1. **LinkInput picker keyboard differences** (CRM P1–P5): Space types instead of opening, arrows wrap, no Ctrl+N/P,
   the text box is 4 px shorter than the button it replaces (`CRM-MIGRATION.md` §8.1). Accept, or ask for changes.
2. **Search icon in the 390 px CRM header**: one more 32 px button; long titles truncate earlier (e.g. ar
   "جهات الات…" on Contacts); no overflow (`CRM-MIGRATION.md` §8.2).
3. **Report view de-duplication** of a document shown on several rows (deviation from Desk, §4) — keep, or send per row
   as Desk.
4. **Commission & Referral `DataGrid` editing model** (M10): every row editable → one row at a time; still not migrated
   and needs approval (`CRM-MIGRATION.md` §5.3, §8.4).
5. **Image view Actions**: Desk's Image view inherits the List view's Actions menu; `FrappeImageView` has none — needs a
   Core Actions surface for non-table views (follow-up, not done).
6. **"Assign To User Group"** in the sidebar's Add to ToDo dialog — not built (needs a User Group read).
7. **Default-mode LinkInput candidates** (kept unchanged by the rules): scroll the highlighted row into view, ignore IME
   Enter, restore typed text on Escape — would also help `TagInput`.
8. **CRM Frappe-mode search**: the CRM page boot carries no Desk `can_read` / `can_create` lists, so a Frappe build's
   awesome bar would show pages + recents only; group titles would be raw DocType names.

## 8. Follow-ups outside this docs step

Mid-batch (attachimage / lifecycle):
- `e2e/frappe-site/run-matrix.mjs` `Session.upload`: accept `fieldname`, `folder`, `optimize`, `max_width` / `max_height`
  and a content type, so F-ATTIMG-1 can be automated and F-ATTIMG-2 / -5 can send exactly the package's multipart body.
- `e2e/frappe-site/matrix/render.mjs` §3 `AREAS` "attachments" lists F-ATT-1 only (the F-ATTIMG tests are in §5).
- `src/frappe/testing/handlers/sidebar.ts` `withSimulatedSidebar.files.upload`: record `optimize` in the JSON
  `upload_file` args.
- `src/record/index.ts` / `src/index.ts`: export `defaultOptimize`, `canOptimize`, `canCrop` if wanted publicly.
- FV.G10 stays PARTIAL until a test drives an Attach cell / row form through `FrappeChildTable` (P36B.attachimage.16
  mounts `FrappeField` with `parent`); the staging seed's SFUI Test Child has no Attach field for a real-site row test.
- Stale after the mid-batch merges (files outside this step): `e2e/frappe-site/README.md:91` says 86 catalogue tests (now
  91); `docs/components/record.md:575` still says the sidebar has no camera or image cropping.

- `FrappeLinkField` could expose the picker-mode props (`src/frappe/form`).
- `client.ts`: `UploadFileOptions.onProgress` (XHR) for a real percentage; `libraryFileName` / `fileUrl` in `uploadFile`
  (now sent through `call`, relying on `upload_file` reading a JSON body, app.py:302-314).
- Fold `withSimulatedSidebar`'s docinfo attachments / tags and upload routing into `fixtureTransport.ts`, and the
  back-link refusal into the built-in bulk handler.
- `scripts/check-boundaries.mjs`: a `search` area if Core search moves out of `src/shell/search/`.
- `FrappeFormView` does not mount `FrappeFormSidebar` (the host places it).
- Check whether the simulator's `assign_to.add` models the assigner's `share` right when it shares the document with an
  assignee who cannot read it (assign_to.py:112 → share.py:51-52, 223-226); the real-site test F-SB-ASSIGN-1 asserts it.
- MyISAM boolean mode treats `-` as NOT (`'+sfui-writer*'`): the package passes the user's text through as Desk does; how
  hyphenated queries behave is for the real-site run (S-GSEARCH-1 / -2) to show.
- **Stale counts outside this step's files:** `docs/audit/p36/README.md` still says "75 tests" (now 91;
  `e2e/frappe-site/README.md` was set to 86 in `a172a9b` and is stale again, above). `a172a9b` retitled the matrix
  "0.7.0-dev.3"; `e2e/frappe-site/matrix/render.mjs`'s §3 `AREAS` table does not list the batch-2 tests (they are in §5), and its §7 list of expected behaviours has none of the
  batch-2 server rules (they are in §4 above and in LIMITATIONS.md). Batch-2 tests without a COVERAGE row render with an
  empty "Rows" line.

## Integrator gate results

TODO(integrator): typecheck, `check-boundaries` (source + dist), `npm run build` / `check:package` / showcase build and
smoke, `e2e/consumers/run.sh`, and the regression of `crm/p36b-070` against a local 0.7.0-dev.3 pack (typecheck, build,
runqa, legacy, `p35.mjs`, `p36.mjs`, `p36-legacy.mjs`, tags/assign, actions-p33, `linkinput.mjs`, `search-p36b.mjs`, SD /
SM diff vs `v072` and the base noise).

Docs step (this commit): `npx vitest run` — 79 files, 1585 passed, 10 todo, 0 failed; `node
e2e/frappe-site/matrix/render.mjs --check` — current; `tests/frappe-site-guards.test.ts` — 23 passed.
