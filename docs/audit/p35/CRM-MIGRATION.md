# P35 — CRM Design-System migration (status after WS6 and WS5)

Sources: `D-crm.md` (baseline audit of the CRM at `127c0b4` against `@solvfast/ui` 0.6.0), the WS6 report (CRM branch
`crm/p35-ds-adoption` in `/home/frappe/sfui-dev/p35-crm`, commits `2691d77..12a1c10` on base `c3a761e`) and the WS5 report
(Core capabilities, merged into the package at `e6e4dd2`). CRM paths are relative to `frontend/src/sear_studio/`.

**Package version in the CRM:** `frontend/package.json` pins `@solvfast/ui` **0.6.0**. WS6 used **only 0.6.0 exports** from
the public entry `@solvfast/ui` (no deep imports, no local copies, no style overrides of DS components). Everything in §4
exists in the package at 0.7.0-dev but **cannot be consumed by the CRM until a package release** is published and the pin
is bumped. Nothing in this file was run against a Frappe site; the CRM runs in mock mode.

> **P36 update.** The five owner decisions of §5 are now decided (P36-1 … P36-5); §5 records each outcome, and §3 / §7
> are annotated "(P36)". The package side is 0.7.0-dev.2 (unreleased, `feat/0.7.x/p36-int`); the CRM side is the P36 CRM
> workstream on `crm/p36-ds`. Index: `docs/audit/p36/README.md`.

> **P36b update (batch 2, package 0.7.0-dev.3).** Three CRM branches (local, not merged, not pushed): `crm/p36b-pickers`
> (P1–P5 on the DS `LinkInput` picker mode), `crm/p36b-search` (header Global Search restored) and `crm/p36b-070` (both).
> Commission & Referral (M10) are still not migrated. Details: §8; index: `docs/audit/p36b/README.md`.

## 1. Rules every migration followed

- **Scope gate.** Every DS branch is inside `useDsScope() === true` (the CRM's `DsScopeContext`) or the existing `inDs`
  branch of `RecordListView`; the `else` branch is the previous markup **verbatim**. That keeps Service Desk / Service
  Management (313 shared files, D-crm §2) and the CRM pages still mounted under the legacy `AdminLayout` routes on their
  old rendering.
- **Shared files touched (all gated):** `components/record-list/RecordListView.tsx`, `components/record-menu/EmailView.tsx`,
  `components/record-menu/useRecordMenu.tsx`, `components/record-detail/RecordMoreMenu.tsx`,
  `pages/FieldLibrary/FieldBuilderComponents.tsx`. The SD / SM delete popups (`TicketDetailPage`, `OrderDetailPage`) were not
  touched.

## 2. Per CRM area

| Area (D-crm id) | Previous implementation | DS component adopted (`@solvfast/ui` 0.6.0) | Files changed (commit) | Remaining CRM-specific code | Regression evidence |
|---|---|---|---|---|---|
| Lead / Contact / Organization detail title (M1) | local `InlineEditableTitle` (pencil + ✓ / ✗) | `EditableTitle` (click to edit; Enter / blur saves; Esc cancels; a closed Lead is plain text) — the Deal precedent | `pages/Leads/LeadDetailPage.tsx`, `pages/Contacts/ContactDetailPage.tsx`, `pages/Organizations/OrganizationDetailPage.tsx` (`2691d77`) | rename logic (`renameLead` first / last split, `renameContact`, `renameOrg`) shared by both branches; `InlineEditableTitle` kept for `!inDs` | `crm-qa/p35.mjs`: title button, Esc cancels, Enter saves × 4 entities × 8 combinations; `legacy.mjs`: legacy `<h1>` unchanged |
| Lead header status (M2) | hand-rolled pill with the lifecycle's hex colour | `StatusBadge` with `lifecycleStatusTone(…)` (Deal precedent) | `LeadDetailPage.tsx` (`2691d77`) | the accepted colour → tone deviation (G17); removable once `StatusBadge color` (0.7.0-dev) is consumable | `p35.mjs`: `data-tone` on Lead and Deal |
| Detail Delete confirm, 4 entities (M3) | four `<X>DeletePopup` copies on `AppPopup` (Dialog) | new shared `components/record-detail/CrmDeleteConfirm.tsx` on `AlertDialog*` + destructive `Button` (`role=alertdialog`, `dir` per language; blocked → reasons + Close only; Delete keeps the dialog open until the page closes it) | `CrmDeleteConfirm.tsx` (new), `DealDetailPage.tsx`, `LeadDetailPage.tsx`, `ContactDetailPage.tsx`, `OrganizationDetailPage.tsx` (`b2ce681`) | per-page blocked texts (`DeleteLinkList`); the four legacy popups for `!inDs`; Ticket / Order copies untouched | `p35.mjs`: alertdialog, footer, Esc × 4 × 8, a real delete of a lead × 8; `legacy.mjs`: legacy `role=dialog` unchanged |
| Emails / Calls / Meetings list status (M4) | `InlineStatusSelect` / `StatusPill` with hard-coded HSL | `StatusBadge variant="dot"` (`TONE_TO_DS`) as a `DropdownMenu` trigger; row click still stopped | `pages/Activities/ActivityListShell.tsx` (`32e0157`) | `StatusPill` has no caller (gated anyway) | `p35.mjs`: status cells + menu without navigating × 8; `legacy.mjs`: no `data-tone` on `/activities/calls` |
| Activity detail status (M5) | `StatusDropdown` with its own tone tables | `StatusBadge` as `DropdownMenuTrigger` | `ActivityDetailLayout.tsx` (`32e0157`) | none — but **no page passes `status` today**, so the path is unreachable in the UI | `tsc` + build only |
| Activity form / detail headers (M6) | hand-built back + `<h1>` + Cancel / Save / Edit | `PageHeader` (`onBack`, node title kept in the page, `subtitle`, `meta`, `actions`); Save = DS primary | `ActivityFormLayout.tsx`, `ActivityDetailLayout.tsx` (`32e0157`) | page action buttons (Download, ⋯) supplied by pages | `p35.mjs`: back named and navigates, Cancel / Save, Edit × 8; `outside.mjs` + `legacy.mjs`: legacy routes unchanged |
| ⋯ menu shortcut chips (M13) | `KeyChip` span / `<span>` in `RecordMoreMenu` | `DropdownMenuShortcut` | `components/record-menu/useRecordMenu.tsx`, `components/record-detail/RecordMoreMenu.tsx` (`1059cf9`) | the document menu itself (C4) | `p35.mjs`: DS shortcuts in entity + activity menus × 8; `legacy.mjs`: Ticket / Service Request / legacy menus keep legacy chips (0 DS) |
| Type-form designer colour field (M14) | raw `<input type=color>` + hex `Input` | `ColorInput` | `pages/FieldLibrary/FieldBuilderComponents.tsx` (`bcbc93c`) | — | `p35.mjs`: two ColorInputs, no raw visible colour input, hex accepted × 8 |
| List bulk "Add Tags" (M7) — **reverted on the 0.6.0 branch, kept on `crm/p35-needs-070`** | own chip list + `Input` + suggestion buttons | `TagInput` (`search` over the entity's tags, `allowCreate`) in a local `BulkAddTagsDs` | `components/record-list/RecordListView.tsx` (`2bc2e80`) | "Remove tags" toggle chips and the `AppPopup` | `p35.mjs`: TagInput, Esc in suggestions keeps the dialog, Enter adds a pill, Apply tags on 2 records × 8; `sweep28` + `records-assign` unchanged |
| ⋯ Email composer body (M8) | `components/studio/RichTextEditor` (570-line local editor) | `RichTextEditor` (`ariaLabel`, `minHeight`) | `components/record-menu/EmailView.tsx` (`12a1c10`) | the rest of the composer | `p35.mjs`: DS editor takes typing × 8 (call detail ⋯ → Email) |
| Commission & Referral child tables (M10) | DS `Table` + per-row DS inputs + `AddNewRow` | `DataGrid` — **implemented, not committed** (patch `scratchpad/p35/crm-qa/m10-datagrid.patch`) | — | — | 27 PASS / 1 FAIL; phone regression (§5.3) |

Totals: 7 commits, 13 files, +359 / −27; M1–M8, M13, M14 done; M10 held back; M9, M11, M12, M15 not attempted (owner
decisions or out of scope).

### Regression evidence (WS6, all local static builds; no site, bench, DB or cache)

| Check | Baseline (`c3a761e`) | Final (`12a1c10`) |
|---|---|---|
| CRM typecheck (`npx tsc --noEmit -p tsconfig.app.json`) | 30 errors in 9 files, none in touched files | **30 errors, identical list** at every step |
| `vite build` | ✓ | ✓ |
| Route sweep (qa-p28 `sweep.mjs`, 82 loads) | 0 console errors, 2 pre-existing issues | **same** |
| SD / SM + legacy screenshots (`outside.mjs`, 172 loads) | base vs base: 17 / 172 differ by 2–16 px (noise floor) | **162 identical, 10 differ** — 9 within the noise signature + the CRM's own lifecycle designer canvas (no P35 file on that page); 0 console errors |
| Mock flows (`mock-p34.mjs`) | 16 / 0 | **16 / 0** |
| Records assign (`records-assign.mjs`) | 111 / 0 | **111 / 0** (rerun alone; a first parallel run hit 2 detached-element flakes) |
| 28-list sweep (`sweep.mjs`) | 112 / 112 | **112 / 112** |
| Migrated UI (`crm-qa/p35.mjs`, new) | — | **376 PASS / 0 FAIL**, 0 console / page errors, 8 combinations (light / dark × en / ar × 1440 / 390) |
| Legacy interactions (`crm-qa/legacy.mjs`, new) | 56 / 0 | **56 / 0**; screenshots 27 identical, 3 × 2 px noise |

### M7 reverted on the 0.6.0 branch (integrator, after WS6)

WS6's `p35.mjs` pressed Esc before Apply, so it did not catch that with **@solvfast/ui 0.6.0** the TagInput "No results"
list stays open after Enter and **intercepts the click on Apply** (§7). The P32 tags/assign check (a P35 copy,
`crm-qa/tagsassign-p35.mjs`, which only locates the popup by its Apply button) shows it:

| Build | tags/assign en | tags/assign ar |
|---|---|---|
| `c3a761e` baseline (0.6.0) | 43 / 43 | 43 / 43 |
| `12a1c10` WS6 final (0.6.0, with M7) | **crash at Apply** ("No results … intercepts pointer events") | **crash** |
| `12a1c10` built against the local **0.7.0-dev.1** pack | 43 / 43 | 43 / 43 |
| `d244b64` = `12a1c10` + revert of M7 (0.6.0) | 43 / 43 | 43 / 43 |

So `crm/p35-ds-adoption` = **`d244b64`** (M1–M6, M8, M13, M14 on 0.6.0) and M7 lives on **`crm/p35-needs-070`**
(`12a1c10`), deployable only after a release containing the 0.7.0-dev.1 TagInput fix.

Final regression of `d244b64` (0.6.0, local static build): typecheck 30 errors (identical list); build ✓; route sweep 82
loads, 0 console errors, the 2 pre-existing notes; SD / SM + legacy (`outside.mjs`, 172 loads, 0 console errors) vs
baseline 163 identical, 9 differ by 2–5 px (inside the 2–16 px base-vs-base noise); mock flows 16 / 0; records-assign
111 / 0; 28 lists 112 / 112; tags/assign en 43 / 43, ar 43 / 43; legacy interactions 56 / 0; migrated UI (`p35.mjs`
without the bulk-tags and M10 steps) 344 / 0.

### CRM against 0.7.0-dev.1 (compatibility only — nothing changed in the CRM's package.json / yarn.lock)

`12a1c10` built in a scratch copy whose `node_modules/@solvfast/ui` is the packed 0.7.0-dev.1 tarball: typecheck 30
errors (identical list to 0.6.0); build ✓; route sweep 82 loads, 0 console errors; mock 16 / 0; records-assign 111 / 0;
28 lists 112 / 112; tags/assign 43 / 43 en + ar; legacy 56 / 0; `p35.mjs` 376 / 0 (+8 M10 steps that only apply
with the uncommitted M10 patch); SD / SM: only 2–3 px noise; the only real differences are the 8 legacy CRM detail shots,
where each assignee's role line is back under the name (the P34 follow-up, `AssigneeGroup` `description`).

Result files: `scratchpad/p35/crm-qa/r-*.txt`, `shots-final/results.txt`, `legacy-*/results.txt` (session scratchpad,
not in the repository).

## 3. Not migrated in WS6, with the reason

| Item | Reason |
|---|---|
| M9 record-menu confirm bars → `AlertDialog` / `Alert` | owner decision (modal vs inline) — §5.2. **(P36)** decided: `AlertDialog`; P36 CRM workstream |
| M10 Commission & Referral → `DataGrid` | phone regression + editing-model change — §5.3. **(P36)** still not migrated: the owner's batch-2 rule (keep the table with horizontal scrolling, no card layout) and the editing-model change, which needs owner approval first (§5.3) |
| M11 `SearchableSelect` → `LinkInput`, M12 `ClientPicker` → `LinkInput` | owner decision (behavioural: free text, empty value, avatars) — §5.1. **(P36)** decided: per usage, by semantics; P36 CRM workstream |
| M15 typed dynamic import of `@solvfast/ui/frappe` in `frappeRecordKit.ts` | not in WS6 scope (D-crm §5 items 1–4) |
| N1–N13 | need a DS capability beyond 0.6.0 — §4 |

## 4. "Needs a new DS capability" — now in 0.7.0-dev (not consumable before a release)

| D-crm id (gap) | CRM location (D-crm §3c) | Delivered in the package (0.7.0-dev) | What the CRM can then remove | Still missing |
|---|---|---|---|---|
| N1 (G17) | local `StatusDot` copies in `DealsPage`, `ContactsPage`, `RelatedRecordRow` `StageChip`, `TasksPage`; Lead / Deal header (M2 deviation) | `StatusBadge` / `StatusDot` `color` (any CSS colour or palette token), `STATUS_PALETTE`, `statusColorStyles` | local dots; the colour → tone deviation; list status cells via `ColumnDef.status` (`color` / `tone` per row → `StatusBadge`, added by integration, `CORE.G17 …`) | — |
| N2 (G7) | `record-lifecycle/WorkflowRailWidget.tsx:116` (pre-filtered states) | `LifecycleStateItem.step` (`past` / `current` / `future` / `skipped` / `failed`) | the pre-filtering workaround ("Lost shows Won ticked") | — |
| N3 (G14) | 11 hidden `<input type=file>` + drop zones (Deal / Lead / Contact / Organization detail, ContactsPage, AttachmentFormPage, ClientInfoStep, ProposalDocTemplateForm, EmailView, PrerequisiteFormFields) | `FileDropzone` (accept, multiple, maxSize, maxFiles, keyboard, drag-and-drop, en / ar) | the native inputs and own drop zones | per-file upload progress / error rows (host uploads in `onFilesAdded`) |
| N4 (G20) | `Proposals/complai/ComplaiReadinessStep.tsx:35` native `type="month"` | `MonthInput` (`YYYY-MM`) | the native input | — |
| N5 (G13) | `contacts/components/ActivityTimeline.tsx`, `components/RecentInteractions.tsx` | `TimelineItem.icon` rendered, `tone`, `Timeline onItemSelect`, `showActor` | the CRM's own feed | — |
| N6 (G11) | `RecordPicker.tsx` groups, `ClientPicker` avatars | `Suggestion.group`, `Suggestion.icon` (LinkInput / TagInput) | groups folded into descriptions | — (unblocks M12, §5.1) |
| N7 (G16) | `MultiSearchableSelect.tsx`, `TypeFilterPicker.tsx`, `SellingRules/AppliesToPicker.tsx` | `SearchCombobox` static `options`, `multiple`, `values`, `variant="field"` | the Popover + Command + Checkbox builds | grouped static options, select-all / clear-all, trigger chips |
| N8 | `pages/Proposals/StepRail.tsx` | `Stepper overflowCue` / `followCurrent` | the whole wrapper | — |
| N9 (G23) | `components/overview/StatCard.tsx` legacy-with-delta path | `IconStatCard trend` | the local delta card | — |
| N10 | `components/AddNewRow.tsx` `EmptyHint` + rail-card empty states | `EmptyState` | local empty boxes | — |
| N11 (G15) | `components/email/SlashEmailTextarea.tsx` | `RichTextEditorHandle` (`insertText`, `insertHtml`, `focus`, `getHtml`) + `toolbarEnd` | the textarea editor | the slash-command trigger UI stays in the CRM |
| N12 (G3, G5) | `CrmDsListView` pager | `ListView pageSizes`, `selectAllMatching` (only actions with `allMatching` run) | — | — |
| N13 (G1) | `CrmDsListView` table on phones | `ListView layout="cards" \| "auto"`, `ColumnDef.mobile` | horizontal scroll on phones | — |
| A18 follow-up (P34) | `AssignmentSectionCard.tsx:66`, `CrmAssignees.tsx:91` | `AssigneeGroup variant="list"` renders `description` | — (the role / ToDo line comes back with no CRM change) | — |

Also new in 0.7.0-dev and relevant to the CRM-specific rows of D-crm §3d, **for re-evaluation, not decided**: Core
`KanbanBoard` / `CalendarMonth` / `ImageGrid` (C1, C2), Core `RecordMenu` (C4), `EmailComposer` / `ReminderDialog` (C6),
`FrappeQuickEntry` (C9, Frappe mode only).

## 5. Owner decisions

All five were decided by the owner in P36 (final). The package side is merged on `feat/0.7.x/p36-int` (0.7.0-dev.2,
unreleased); the CRM side is the P36 CRM workstream (branch `crm/p36-ds`). P36 index: `docs/audit/p36/README.md`.

### 5.1 `SearchableSelect` and `ClientPicker` → `LinkInput` (M11, M12) — **owner decided (P36): per-usage semantics**
`SearchableSelect` is shared by ContactsPage, OrganizationFormWorkspace, CrmTypeFormPage, InlineCreateForms and Proposals;
it allows free text (`allowCustom`) and shows subtitles. A scope-gated `LinkInput` branch (in-memory `SearchFn`,
`onCommitText` for free text) changes the keyboard model and the empty-value behaviour for every caller. `ClientPicker`
needs avatars and a "Create New" row: avatars need `Suggestion.icon` (0.7.0-dev, N6).

**Decision (P36-2):** pickers are migrated **per usage, by semantics only** — a picker moves to `LinkInput` where its
meaning is a link to a record, not as a blanket swap of the shared component. See the P36 CRM workstream.

**P36 result.** Every usage was inventoried (`scratchpad/p36/ws/crm.md`), and each was classified by what it selects.

| Usages | Decision | Branch |
|---|---|---|
| Lifecycle, SLA and Assignment Profile on the Lead/Deal type form; "Reuse an existing form" on the proposal type form; the CRM Configuration defaults (P1–P5) | Pick an existing document → `LinkInput` | **Not on the 0.6.0 branch.** P36: held back on `crm/p36-linkinput-review` (`6310fc0`) — a filled `LinkInput` did not open on click and had no check mark. **(P36b)** the package added an opt-in picker mode (0.7.0-dev.3: open on click / tap / Enter when filled, check mark on the current value, Escape restores); P1–P5 now use it on `crm/p36b-pickers` (`0d1e1c6` = `6310fc0` cherry-picked + `31c4999`). Remaining keyboard differences are listed for owner judgement in §8.1. |
| Field designer "Links to" (P6) | Static option list → `SearchCombobox` `options` (0.7.0-dev.1) | `crm/p36-needs-070` (`bf46479`) |
| Country, City, Organization-by-name (7) | Kept: the explicit "Use «typed»" row has no DS equivalent | — |
| `ClientPicker` (3) | Kept: CRM-specific trigger avatar and "Create New Client" | — |
| `MultiSearchableSelect`, `TypeFilterPicker`, `AppliesToPicker` | Kept: no DS removable chips / groups / select-all, even in 0.7 | — |

### 5.2 Record-menu confirm bars → `AlertDialog` (M9) — **owner decided (P36): `AlertDialog`**
`useRecordMenu.tsx:320-350` showed inline delete / unsaved-reload confirmation bars with hex colours.

**Decision (P36-3):** CRM confirmations use the DS `AlertDialog` (modal). See the P36 CRM workstream.

**P36 result: migrated, on `crm/p36-ds`** (0.6.0) = `d244b64` + `8015184` (C1) + `431cf9e` (C2/C3). All three are scope-gated with `useDsScope()`; outside the CRM the old markup is unchanged.

| Id | Location | Previous UI | DS UI | Preserved |
|---|---|---|---|---|
| C1 | ⋯ menu Delete / Delete-blocked / Reload-with-unsaved-changes (`useRecordMenu`) | inline confirmation bars with hex colours | the shared `CrmDeleteConfirm` (`AlertDialog`) | copy, handlers, permission checks, ⇧Ctrl+D. Only Delete is reachable in the CRM (proposal detail); the other two were type-checked and built only. |
| C2 | Unsaved-changes prompt on the Deal / Lead / Contact / Organization detail (`RecordEditSession`) | custom popup | `AlertDialog`: Discard · Stay · Save | Save stays open if validation fails. That path is not reachable in mock mode, so it is not exercised. |
| C3 | "Remove this squad?" in the squad proposal wizard | inline confirm | `AlertDialog`: Keep · red Remove | copy and action |

Regression of `431cf9e` (0.6.0, local build):

| Check | Result |
|---|---|
| Typecheck | 30 errors (identical list) |
| Build | ✓ |
| Route sweep | 82 loads, 0 console errors |
| Mock flows | 16 / 0 |
| Records-assign | 111 / 0 |
| 28 lists | 112 / 112 |
| Legacy interactions | 56 / 0 |
| `p35.mjs` | 344 / 0 (bulk-tags excluded on 0.6.0) |
| `p36.mjs` confirmation steps | 168 / 0 (8 combinations: cancel keeps state, confirm runs, destructive style, Escape) |
| `p36-legacy.mjs` | 10 / 0 (legacy routes keep the old UI) |
| tags/assign | 43 / 43 en + ar |
| SD / SM + legacy (`outside.mjs`, 172 loads, 0 console errors) | 158 identical vs baseline; the SD / SM differences are 2–3 px (base-vs-base noise is 17 shots, up to 16 px); the CRM's own lifecycle / workflow designer canvases differ by edge-rendering noise (inspected visually; they also differ between two baseline runs) |

`crm/p36-needs-070` = `12a1c10` (P35 + M7) + C1–C3 + P6. Integrator re-run against a local **0.7.0-dev.2** pack (header-selection default, Desk per-action selection, Report view, DataGrid layouts — the last reverted afterwards in batch 2): typecheck 30 (identical); build ✓; route sweep 82 loads, 0 console errors; mock 16 / 0; records-assign 111 / 0; 28 lists 112 / 112; legacy 56 / 0; `p35.mjs` 376 / 0; `p36.mjs` (confirmations + "Links to") 216 / 0; `p36-legacy.mjs` 10 / 0; tags/assign 43 / 43 en + ar; SD / SM 2–3 px noise; the only real differences are the 8 legacy CRM detail shots (the assignee role line, P35 AssigneeGroup). No CRM package pin was changed. The workstream ran its suites against the local 0.7.0-dev.1 pack: `p35.mjs` 376 / 0, `p36.mjs` 336 / 0 (with "Links to"), tags/assign 43 / 43 ×2, SD / SM noise only.

### 5.3 M10 `DataGrid` phone layout — **still NOT migrated (owner decision P36-4)**
P35 finding: `DataGrid` had a fixed `min-w-[32rem]`; at 390 px the Commission grid scrolled horizontally (scrollWidth 512
vs 316) and the Share % column was off-screen, while today's DS `Table` shows Name + Share % without scrolling. The editing
model also changes (every row editable → one row at a time, Desk-style; "Add year" → "Add Row"; new No. / checkbox /
row-menu columns).

**P36:** a DataGrid phone card layout was built in the P36 package work (W3) and **reverted in batch 2** (`ccb232d`) on the
owner's correction: no card-based mobile layout, no change to the table's responsive behaviour, horizontal scrolling on
phones is acceptable for now, and Frappe Table fields are not migrated to cards. `DataGrid` is unchanged from 0.7.0-dev.1
(the `32rem` minimum and horizontal scroll remain).

**Decision (P36-4, owner rule from batch 2):** the Commission & Referral tables stay **NOT migrated**. A future M10
migration keeps the table with horizontal scrolling and may proceed only if:
1. the existing editing behaviour is preserved;
2. at 360 and 390 px the tables work with a usable horizontal scroll;
3. nothing becomes inaccessible (every column, editor and action reachable);
4. the CRM workflows stay intact.

**Known blocker:** `DataGrid` edits one row at a time (Desk-style), while the CRM tables let every row be edited at once;
`DataGrid` also adds No. / checkbox / ⋯ row-menu chrome and "Add Row" instead of "Add year". This interaction change
requires **owner approval before any migration**.

### 5.4 `selectionMode` default — **resolved (owner decision P36-1)**
`ListView` / `FrappeListView` now default to `selectionMode="header"` (Desk's header actions: "{n} items selected" + Clear
in the header, the primary action replaced in place by the Actions menu); `"bar"` is an explicit opt-in. The CRM already
passes `"header"` (D-crm A5), so the default flip changes nothing for it. On upgrading to 0.7.0-dev.2 the CRM does get:
- the **no-actions swap**: with rows selected and no applicable action, the primary action still gives way and the Actions
  menu shows a disabled "No actions available for the selection" (before: the primary action stayed);
- Desk's **per-action selection outcome** in `FrappeListView` / `useFrappeBulkActions`: Edit and workflow actions keep the
  selection (the list reloads); Submit / Cancel clear it only when every document went through (partial failure or a
  queued job keeps it); dismissing Clear Assignment's confirmation clears it and reloads — this reaches the CRM only through
  `FrappeEntityList` (Frappe builds; it passes `selectionMode="header"`);
- **Ctrl/⌘-click** on a row ticks it instead of opening it (Core `ListTable`, so also `CrmDsListView`, which passes
  `selectionMode="header"` too). `CrmDsListView`'s own bulk actions keep deciding whether to clear (`renderBulkActions` gets
  `clear`).
The CRM runs in mock mode; nothing was run against it for this change.

### 5.5 Report view editability — **resolved (owner decision P36-5): Frappe 15.110 by default, explicit opt-in**
**The P35 premise was wrong.** P35 read `is_editable` (report_view.js:758-779) as making every field without a
`read_only_depends_on` read-only on a DocType without a Table field. At runtime that is not what happens: with no Table
field and no `read_only_depends_on`, the trailing clause returns that falsy value (`undefined` / `null` / `""`), never
`false`; `build_row` stores it as `cell.editable` (:1330), and frappe-datatable 1.20.4 (pinned by Frappe) refuses editing
only on a strict `=== false` (cellmanager.js:442-449). Plain fields **are** editable — Frappe's own Cypress test
(`cypress/integration/report_view.js`, fixture `custom_submittable_doctype.js`: no Table field) edits `enabled` through
`frappe.client.set_value`. The only effect of the clause: no Table field + `read_only_depends_on` evaluating true → locked
(and child cells, `Boolean(name && …)`).

P36 W2 (`isCellEditable`, `FrappeReportView`): the default `editable="desk"` reproduces 15.110 — `read_only_depends_on`
evaluated on the loaded row on a DocType without a Table field, ignored with one; write right = Desk's `can_write` (level-0
write or create), the field's permlevel not checked (the server silently resets such a change); child-table cells editable
and saved with `set_value` on the child row. `editable="strict"` restores the P35-style checks (field permlevel write,
`write` not `create`, `submit` on submitted documents, `read_only_depends_on` always evaluated); a function gets Desk's
verdict as `info.desk`. 26 `LV.H1` tests (jsdom / simulator). No CRM code change (mock mode); a CRM that wants the P35
permlevel check passes `editable="strict"`. Note for the CRM: `isCellEditable`'s third argument changed from `levels` to
an options object (BREAKING vs 0.7.0-dev.1 only; the CRM does not call it).

## 6. Blocked by mock mode / backend (unchanged from D-crm §3f)

The CRM runs with `CRM_DATA_MODE = 'mock'`; these DS paths are exercised only in simulated or Frappe builds:
B1 `FrappeListView` (`FrappeEntityList`, DealsPage Frappe branch) · B2 `FrappeField` / `useSaveDoc` (`CrmEntityFormFields`,
`CrmEditableCard`, `CrmDocLoader`) · B3 `FrappeTimeline` / `FrappeAssignTo` / `FrappeWorkflowActions` /
`FrappeStatusIndicator` via `frappeRecordKit.ts` · B4 `FrappeDataImport` · B5 server saved filters / user settings · B6
server print formats · B7 realtime · B8 single-owner assign replace (`FrappeAssignTo` `replace`, G9 — **still not in the
package**) · B9 attachment upload and e-mail sending. P35 adds more Frappe-mode capabilities (Quick Entry, the form ⋯
menu, Connections, e-mail composer, sidebar counts) that the CRM can use only in a Frappe build, after a release.

## 7. DS defects seen during the CRM work

- `TagInput` keeps its suggestion list ("No results") open after Enter adds a tag, until focus leaves; in the bulk Tags
  popup it covers the Apply button until Esc / Tab / a click elsewhere (8 / 8 combinations). Candidate fix: close the list
  after a create. **Fixed in 0.7.0-dev.1** (integration: Enter / comma that creates a tag closes the list;
  `CORE.M7 …`, `tests/core-integration.test.tsx`).
- `DataGrid` fixed minimum width on phones (§5.3) — still open. **(P36)** Accepted by the owner for now: the table keeps
  its `32rem` minimum and horizontal scroll (a card layout was built and reverted in batch 2). CRM M10 stays not migrated;
  the editing-model change (one row at a time vs every row editable) needs owner approval first (§5.3).

## 8. P36b (batch 2) — CRM branches

All three branches are in the CRM repository, based on `crm/p36-needs-070` (`bf46479`, which targets 0.7), local only (not
merged, pushed or deployed). The CRM pin is still `@solvfast/ui` 0.6.0; every check below ran on a local static build in
**mock data mode** against a local pack of the package workstream branch — no site, bench, database or cache.

### 8.1 `crm/p36b-pickers` — P1–P5 on the `LinkInput` picker mode
Commits `0d1e1c6` (P36's held-back `6310fc0`, cherry-picked unchanged) and `31c4999` (picker-mode props: `CrmOptionLinkInput`
passes `openOnClickWhenFilled`, `selectedIndicator`, `selectedValue` for the "None" / "No default" / "A new form for this
type" row, `keepValueWhenEmptied`, `debounceMs={0}`, and the SearchableSelect's search placeholder and empty text). Files:
`components/CrmOptionLinkInput.tsx`, `pages/CRM/types/CrmTypeFormPage.tsx`, `pages/Configuration/AppConfigurationPage.tsx`,
`pages/Proposals/ProposalTypeFormPage.tsx`; every change is inside the existing `inDs` gate (the `else` branch is the
SearchableSelect verbatim), so Service Desk / Service Management configuration keep `SearchableSelect`.

| Picker (route) | Migrated | Workstream picker checks (8 combinations) |
|---|---|---|
| P1 Linked Lifecycle (`/crm-app/leads/types/new`, 34 rows incl. "None") | yes | 160 / 0 |
| P2 SLA Policy (same page, 5 rows, no none row — no ×) | yes | 144 / 0 |
| P3 Assignment Profile (same page, 5 rows incl. "None") | yes | 176 / 0 |
| P4 Reuse an existing form (`/crm-app/proposals/types/new`, 13 rows) | yes | 176 / 0 |
| P5 Configuration defaults (`/crm-app/configuration`: Lifecycle / SLA / Decision Tree) | yes | 168 / 0 each |

New check `scratchpad/p36b/crm-qa/linkinput.mjs` (en + ar, light + dark, 1440 + 390-touch): before = 448 notes; after
**1168 PASS / 0 FAIL**, 0 console / page errors. Standard suite vs the integrator's `v072` run: identical (typecheck 30,
route sweep 82 loads / 2 pre-existing issues, mock 16 / 0, records-assign 111 / 0, 28 lists 112 / 112, legacy 56 / 0,
`p35.mjs` 376 / 0, tags/assign 43 / 43 ×2, actions-p33 22 / 22 ×2, `p36-legacy.mjs` 10 / 0); `p36.mjs` (`LINKS_TO=1`)
336 / 0 (the 216 of `v072` + the 120 original P1–P5 checks); SD / SM diff within the base-vs-base noise.

**Remaining differences from the SearchableSelect — for owner judgement** (none loses a function):
- **Space** types a space instead of opening the list (click / tap / Enter / ArrowDown open it) — a text box needs Space.
- **Arrows wrap** at the ends (cmdk stopped at the first / last row).
- **No Ctrl+N / Ctrl+P** (cmdk's Ctrl+N/J/P/K bindings are not reproduced).
- The control is a **text box 4 px shorter** (DS field `h-9`) than the button it replaces (`h-10`).
Also different, judged improvements by the workstream: Tab moves to the next field and closes the list (before, focus
jumped into the portal and the popover stayed open); the field label is the accessible name (before: the value text);
× is an extra way to set "None" on P1 / P3 / P4 / P5. Parity note: Enter then Enter picks the highlighted **first** row
("None" / "No default" / "A new form…") — the SearchableSelect did the same (cmdk highlights the first row), so this is
not a regression; starting the highlight on the current value would be a refinement for both.

### 8.2 `crm/p36b-search` — header Global Search restored
Commits `93ae78a` + `7a6ca1b` (rows and Ctrl/⌘-click new tabs carry the router basename `/serve-fast`). The CRM header
search had been hidden by `edcc736` ("SH-03: no dead navbar search", `AppShell search={false}`) because it did nothing.
`CrmAppLayout.tsx` now passes `search={{ slot: <CrmGlobalSearch …/> }}` (new `components/Layout/CrmGlobalSearch.tsx`);
`CrmAppLayout` is the CRM-only DS shell, so Service Desk / Service Management frames and the shared `TopBar.tsx` are
untouched (QA: `/service-desk-app/tickets` has no global search, 8 / 8).
- **Mock mode (every build checked):** reads the CRM's own stores, the same ones the lists read — contacts, leads (the
  Contacts list's lead scope), organizations, deals — matched on each list's search fields at query time; awesome-bar rows
  "Open {page}" for every sidebar leaf; recents = this tab's visited record / page routes. No per-user visibility rule
  exists in those lists, and none was invented.
- **Frappe / simulated branch: UNVERIFIED.** It uses the package adapter (`createFrappeSearchSource` →
  `frappe.utils.global_search.search`) with `resolveUrl` mapping the Serve Fast DocTypes to `/crm-app/…`. The CRM page boot
  carries no Desk `can_read` / `can_create` lists, so there the awesome bar shows CRM pages + recents only; group titles
  would be raw DocType names. Never run against a backend.
- QA: new `scratchpad/p36b/crm-qa/search-p36b.mjs` **188 / 0**, 0 console errors (8 combinations); standard suite = `v072`.
- **Owner judgement:** at 390 px the search icon is one more 32 px button in the CRM header (title, search, bell, globe,
  theme, home, support), so long titles truncate earlier (e.g. ar "جهات الات…" on Contacts); no overflow.

### 8.3 `crm/p36b-070` — both combined
`f7bd1da` = `crm/p36b-pickers` + `crm/p36b-search` on `bf46479` (the 0.7 branch for the next CRM pin bump).
Regression of crm/p36b-070: see docs/audit/p36b/README.md

### 8.4 Still not migrated
- **Commission & Referral (M10):** unchanged — the tables keep the DS `Table`. A `DataGrid` migration changes the editing
  model (every row editable → one row at a time, "Add year" → "Add Row", extra No. / checkbox / ⋯ columns) and needs
  **owner approval** first; no card layout (owner rule, §5.3).
- Country / City / Organization-by-name, `ClientPicker`, `MultiSearchableSelect`, `TypeFilterPicker`, `AppliesToPicker`:
  unchanged (§5.1).
