# P36 batch 2 (P36b) — index (`@solvfast/ui` 0.7.0-dev.3, unreleased)

Batch 2 delivered the owner's feature requests on top of P36 batch 1: the **LinkInput picker mode** (and the CRM pickers
P1–P5 on it), **Submit / Cancel in the Report view**, Frappe **Global Search** (package + CRM header), and the **Form
Sidebar** — Assign, Attach, Tags (D1) and Share, Like, Comments (D2). Integration branch `feat/0.7.x/p36-int`
(`package.json` 0.7.0-dev.3). Nothing was pushed, tagged, published or deployed. **No Frappe site was contacted, seeded,
read or written: every result below is unit / jsdom / simulator evidence (and, for the CRM, Playwright on local static
builds in mock data mode).**

| Document | What it holds |
|---|---|
| `CHANGELOG.md` → 0.7.0-dev.3 | Added / Changed / Fixed / Deviations from Desk / Validation status |
| `docs/audit/p35/COVERAGE.md` §9–§10 | the 6 rows whose cells batch 2 edited (no status change, 258 / 301) and the batch-2 features outside the fixed denominator |
| `docs/audit/p36/VALIDATION-MATRIX.md` §5 | the 11 batch-2 real-site tests (prepared, not run; 86 in the catalogue) — generated from `e2e/frappe-site/matrix/catalogue.mjs` |
| `docs/audit/p35/CRM-MIGRATION.md` §8 | the CRM branches `crm/p36b-pickers`, `crm/p36b-search`, `crm/p36b-070` |
| `docs/LIMITATIONS.md`, `docs/FRAPPE.md`, `docs/CONSUMING.md` §10 | new APIs / endpoints, simulator-only status, Frappe server rules to know |
| `docs/components/forms.md` (LinkInput), `list.md` §6, `views.md` §3–5, `record.md` (Form Sidebar; Share, Like, Comments), `search.md` | component docs, written by the workstreams |

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

## 2. Workstreams, branches and commits

All package branches are based on `a85d734` (batch-2 extension points). CRM branches are in the CRM repository, based on
`bf46479` (`crm/p36-needs-070`).

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

Tests added (all jsdom / simulator): `tests/linkinput-p36b.test.tsx` (13), `tests/bulk-p36b.test.tsx` (21),
`tests/global-search-p36b.test.tsx` (15), `tests/form-sidebar-p36b.test.tsx` (22), `tests/social-p36b.test.tsx` (22).
Showcase pages (all backend operations labelled SIMULATED): `#p36b-linkinput`, `#p36b-bulk`, `#p36b-search`,
`#frappe-form-sidebar`, `#p36b-social`.

## 3. Frappe source inspected, per feature (Frappe 15.110, read only)

| Feature | Files (and lines) |
|---|---|
| LinkInput picker mode | `public/js/frappe/form/controls/link.js:35-41` (focus lists only when empty), `:211-216` (Awesomplete `minChars 0`, `autoFirst`), `:307`, `:432`, `:476`; Awesomplete 1.1.5 `awesomplete.js:73-92` (keys), `:248-257` (`aria-selected` on the highlight); `form/controls/select.js:2` (native select); `desk/search.py:37` (not called — Core control) |
| Report view Submit / Cancel | `public/js/frappe/list/list_view.js:161-180, 585-598, 1588-1599, 1855-1887, 1999-2051, 2088-2128`; `list/bulk_operations.js:275-308`; `views/reports/report_view.js:9, 53, 360, 371-374, 1339-1352`; `views/image/image_view.js:6, 113`; `views/kanban/*.js` (no checkbox); `model/model.js:395-412`; `utils/user.py:146-150`; `core/doctype/doctype/doctype.py:1785-1808`; `desk/form/meta.py:234-244`; `desk/doctype/bulk_update/bulk_update.py:51-114`; `model/document.py:380-404, 880-915, 1080-1105, 1175-1186`; `model/delete_doc.py:265-331, 432-445` |
| Global Search | `public/js/frappe/ui/toolbar/awesome_bar.js` (10-58, 65-99, 109-143, 147-261, 295-380), `search_utils.js` (5-620), `fuzzy_match.js` (17-180), `search.js` (10-400), `search.html`, `navbar.html:2-35`, `toolbar.js:74-86, 155-169`, `keyboard.js:43-56, 152-155, 198-206`, `router.js:11, 303-306, 423-478`, `list/list_view.js:2130-2148`; `utils/global_search.py` (35-136, 233-279, 347-462, 465-526, 529-583); `query_builder/custom.py:44-48`; `model/meta.py:217-223`; `utils/user.py:130-208`; `desk/doctype/global_search_settings/*` (py 22-103); `boot.py:69-191`; `hooks.py:201-206, 376-393` |
| Form Sidebar (Assign, Attach, Tags) | `public/js/frappe/form/templates/form_sidebar.html` (1-171); `form/sidebar/form_sidebar.js:24, 51-61, 70-120, 122-150, 186-198, 237-287`; `form/sidebar/assign_to.js:13-63, 94-231, 244-373`; `form/sidebar/attachments.js:7-260`; `file_uploader/FileUploader.vue:386-400, 443, 533-698`; `FileBrowser.vue:120-130`; `ui/tag_editor.js:35-101`; `ui/tags.js:34-89`; `form/form.js:586-591, 1990-2033`; `desk/form/load.py:100-143, 146-196, 353-395, 483-503`; `desk/form/assign_to.py:25-233`; `handler.py:173-282`; `core/doctype/file/file.py:93-128, 183-190, 333-357, 510-538, 793-813, 872-911`; `desk/form/utils.py:19-23`; `desk/doctype/tag/tag.py:34-70, 87-175`; `core/api/file.py:65-82`; `app.py:302-314` |
| Share / Like / Comments | `share.py:20-268`; `core/doctype/docshare/docshare.py:33-91`; `permissions.py:111-113`; `public/js/frappe/model/model.js:462-473`; `form/sidebar/share.js:12-202`, `templates/set_sharing.html`; `desk/like.py:15-91`; `public/js/frappe/ui/like.js:4-127`; `form/templates/form_sidebar.html:139-161`; `desk/form/utils.py:26-79`; `core/doctype/comment/comment.py:25-150`, `comment.json` (permissions); `desk/notifications.py:390-440`; `desk/doctype/notification_log/notification_log.py:73-117`; `desk/form/load.py:108, 130, 146-183, 212-219`; `form/footer/footer.js:8-72`; `form/footer/form_timeline.js:607-676, 723-760`; `form/templates/timeline_message_box.html` |

Workstream reports with the full spec (session scratchpad, not in the repository): `scratchpad/p36b/ws/{linkinput,bulk,
search,search-native-spec,sidebar,social}.md`.

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
4. No upload percentage (package uploads use `fetch`), no Camera / Google Drive / crop / optimize; Library = text search
   (`get_files_by_search_text`), no folder tree.
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

**Frappe server rules the real-site tests will confirm** (read from source; Frappe's behaviour, not the package's):
`global_search.search` filters by DocType only (no per-row check) [S-GSEARCH-1]; `assign_to.add` / `remove` / `close`
need read only, `close` only by the assignee (417) [F-SB-ASSIGN-1]; tags write `_user_tags` and then check write (rolled
back on refusal) [F-SB-TAGS-1]; sharing grants only rights the sharer holds, un-ticking read deletes the share [S-SHARE-1];
`toggle_like` has no permission check [F-SB-LIKE-1, L-LIKE-1]; comment edit = author (403), publish = author or System
Manager (417), delete = Comment DocPerm (System / Website Manager) [F-SB-COMMENT-1]; an unknown name fails a whole bulk
request (404) and a repeated name fails the second time [L-BULK-5, V-REPORT-2].

## 5. What is simulator-only

Every batch-2 server path: `submit_cancel_or_update_docs` from the Report view; `assign_to.add` / `close` / `remove`;
`upload_file` (multipart and the JSON `library_file_name` / `file_url` forms), `remove_attach`,
`get_files_by_search_text`; `tag.add_tag` / `remove_tag` / `get_tags`; `frappe.share.get_users` / `add` /
`set_permission`; `toggle_like` (sidebar); `add_comment`, `update_comment`, `update_comment_publicity`,
`frappe.client.delete` (Comment), Mention notifications; `frappe.utils.global_search.search`. Simulator limits: no MyISAM
ranking / stopwords / 15-minute index lag; the built-in docinfo answers `attachments: []` / `tags: ""` unless wrapped in
`withSimulatedSidebar`; the built-in bulk handler does not refuse Cancel for submitted back links (the opt-in
`bulkUpdateHandler` does); a queued bulk job runs at once; no realtime `docinfo_update` / `list_update` delivery.
The CRM Global Search was checked in **mock mode** only (CRM stores); its Frappe branch is unverified.

## 6. Real-site blockers

The 11 batch-2 catalogue tests (`docs/audit/p36/VALIDATION-MATRIX.md` §5) are BLOCKED like every other test: they need an
owner-approved, isolated staging site (`docs/audit/p36/README.md` §4). On top of the P36 requirements:
- **F-SB-ATTACH-2** needs `protect_attached_files = 1` on SFUI Test Parent (Customize Form; the staging seed does not set
  it) — otherwise it reports BLOCKED.
- **S-GSEARCH-2** (manual) needs a System Manager, the scheduler (`sync_global_search` every 15 min) and an SFUI field
  marked In Global Search; S-GSEARCH-1 records result contents and needs the optional `sysmgr` account to read Global
  Search Settings.
- **F-SB-COMMENT-1** needs the site's worker for the Mention Notification Log (recorded, not asserted) and the optional
  `sysmgr` account for the Comment delete positive (else BLOCKED).
- **L-BULK-5**'s 20-name job needs the worker for its recorded outcome.
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

- `FrappeLinkField` could expose the picker-mode props (`src/frappe/form`).
- `client.ts`: `UploadFileOptions.onProgress` (XHR) for a real percentage; `libraryFileName` / `fileUrl` in `uploadFile`
  (now sent through `call`, relying on `upload_file` reading a JSON body, app.py:302-314).
- Fold `withSimulatedSidebar`'s docinfo attachments / tags and upload routing into `fixtureTransport.ts`, and the
  back-link refusal into the built-in bulk handler.
- `scripts/check-boundaries.mjs`: a `search` area if Core search moves out of `src/shell/search/`.
- `FrappeFormView` does not mount `FrappeFormSidebar` (the host places it).
- **Stale counts outside this step's files:** `docs/audit/p36/README.md` and `e2e/frappe-site/README.md` still say "75
  tests" (now 86). `e2e/frappe-site/matrix/render.mjs` (not edited) still titles the matrix "0.7.0-dev.1", its §3
  `AREAS` table does not list the batch-2 tests (they are in §5), and its §7 list of expected behaviours has none of the
  batch-2 server rules (they are in §4 above and in LIMITATIONS.md). Batch-2 tests without a COVERAGE row render with an
  empty "Rows" line.

## Integrator gate results

TODO(integrator): typecheck, `check-boundaries` (source + dist), `npm run build` / `check:package` / showcase build and
smoke, `e2e/consumers/run.sh`, and the regression of `crm/p36b-070` against a local 0.7.0-dev.3 pack (typecheck, build,
runqa, legacy, `p35.mjs`, `p36.mjs`, `p36-legacy.mjs`, tags/assign, actions-p33, `linkinput.mjs`, `search-p36b.mjs`, SD /
SM diff vs `v072` and the base noise).

Docs step (this commit): `npx vitest run` — 79 files, 1585 passed, 10 todo, 0 failed; `node
e2e/frappe-site/matrix/render.mjs --check` — current; `tests/frappe-site-guards.test.ts` — 23 passed.
