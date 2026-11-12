# P0 — 0.7.x consolidation, CRM-exact parity, FormView sidebar: audit and record

Branch `feat/0.7.x/p0-record-rail` (worktree `/home/frappe/sfui-dev/p0-record-rail`), based on tag `v0.7.0-dev.6`
(`2a36ff6`, the package the CRM ran). Local only: not pushed, not published, version unchanged (0.7.0-dev.6).
Reference page: `https://internal.solvfaster.com/serve-fast/crm-app/deals/1` (inspected in a headless browser, mock data).

## 1. Repository and worktree map (2026-11-12)

| What | Where / state |
|---|---|
| Main repo | `/home/frappe/solvfast-ui`, detached HEAD at `0ef45c1` (Release 0.6.0). About 60 worktrees under `/home/frappe/sfui-dev/*` (0.4.0 – 0.7.x feature branches). |
| Tags | `v0.1.0` … `v0.6.0`, `v0.7.0-dev.6`, `v0.7.0`. |
| 0.7.x lines | `feat/0.7.x/p36e-int` (dev.6, published, `c4c349f`); `v0.7.0` = `feat/0.7.x/sayr-brand` `7dbc774` (dev.7 + release commit); `feat/0.7.x/families` `e26ab97` (dev.8 → dev.22, another session, last commit 2026-11-12 01:02; `origin/main` = its dev.15 `c20e8f4`). `v0.7.0` and `families` have diverged (neither contains the other). |
| Remotes | `origin/main`, `origin/feat/0.7.x/{families,sayr-brand,p36e-int}`. |
| Uncommitted work | `families`, `sayr-brand` and this worktree were clean. The other ~57 worktrees were not inspected one by one; none was modified. |
| Consumer | `apps/serve_fast/frontend` (no git). Before: `@solvfast/ui@0.7.0-dev.6` from the registry (dist byte-identical to a build of `v0.7.0-dev.6`, verified). After: `vendor/solvfast-ui-0.7.0-dev.6-<sha>.tgz` of this branch. |

Why this base: the CRM before/after comparison must show only this work. `families` (dev.8–22) and `v0.7.0` (dev.7) carry
Sayr changes the CRM has not taken; merging forward is a follow-up (see §6).

## 2. Inventory and consolidation matrix

### 2.1 ListView — layered, not duplicated

| Implementation | Files | Role | CRM use |
|---|---|---|---|
| `ListView` (Core) | `src/list/*` | The list view (toolbar, filters, saved filters, sort, pagination, selection, bulk, group-by, cards layout, empty / loading / error) | Rendered on `/crm-app` lists through the app adapter `CrmDsListView` (mock data, default) |
| `FrappeListView` + `useFrappeList` | `src/frappe/FrappeListView.tsx`, `src/frappe/list/*` | Frappe adapter **over** `ListView` (reportview, Desk sidebar, list settings, import / export, bulk actions) | `FrappeEntityList` in Frappe data modes |
| `FrappeReportView` (+ `FrappeViews`) | `src/frappe/views/*` | Report view adapter **over** `ListView` (child columns, inline edit, totals) | — |
| `DataGrid` | `src/fields/DataGrid.tsx` | Child-table editor inside forms — not a list view | via `FrappeChildTable` |

No change: there is one list engine with adapters. The duplicates a user sees are **app-side** (`RecordListView`'s legacy
branch for Service Desk / Service Management, `CrmDsListView`, `FrappeEntityList`). The CRM list does not enable
`pageSizes`, `layout="cards"` or `aside`; enabling them would change the reference, so they stay off.

### 2.2 Lifecycle / Workflow

| Implementation | Look | Used by |
|---|---|---|
| `LifecycleRail` + `LifecycleDiagram*` (Core) | The CRM rail (vertical path, who · when, next options, View full lifecycle) | CRM mock path, Tickets, Orders, Connect Fast, Sayr (all through the app's `WorkflowRailWidget`) |
| `LifecycleBar` (Core) + `FrappeWorkflowActions variant="steps"` | A stepper with an Actions menu | CRM **Frappe data** path (`CrmStatusActions`) — a second look |
| `Stepper` (primitive) | Wizard steps | Not a lifecycle (wizards) |

Consolidated: `FrappeWorkflowActions` gains `variant="rail"` (the same `LifecycleRail` component), and the CRM's Frappe
path uses it instead of `LifecycleBar`. `LifecycleBar`, `compact` and `steps` stay for other consumers. No third look.
**It is not identical to the reference rail:** on Frappe data the CRM page header has no Actions button ("one menu
only"), so the rail's next options are buttons that apply the transition (hover underline), where the mock rail's are
plain text and the header carries Actions; and there is no "View full lifecycle". This path is covered by stub-client
unit tests only — the deployed build cannot select a Frappe data mode, and no real site was used.

### 2.3 FormView and sidebars

| Piece | State before | Now |
|---|---|---|
| `FrappeFormView` / `FrappeForm` | No slot for a rail | `aside` slot (CRM 3 + 1 grid), opt-in |
| Desk form sidebar: `FormSidebar`, `SidebarSection`, `FrappeFormSidebar` | Desk order and look | **Unchanged** (the Frappe Sidebar) |
| Sayr rail (`src/sayr/rail.tsx`, `families` only) | Glass cards, sentence case — not the CRM look | Not on this branch; untouched |
| CRM rail (app: `SidebarCard`, `RailSection`, `RelatedRecordRow`, `SidebarCustomizer`, `RailFooter`, `ReferencesPanel`, `RecordAttachments`) | App-local | Ported 1:1 as `RecordRail*` (§3); the app components render the DS ones inside the DS scope |
| Assignment | DS `AssigneeGroup` / `FrappeAssignTo` inside app layout | + `RecordRailAssignment` (layout) |
| Attachments | DS `FrappeAttachments` in an app card string | Card string from `recordRailCardClass` |
| Organization / Tasks / Articles | App only | `RecordRailLinkedRecord`, `RecordRailTasks`, `RecordRailArticles` + `RecordRailArticleReader` |
| CRM main area (header card, tabs, Deal Profile cards, field controls) | App only (`DealDetailPage.tsx`, 2,000 lines) | **Not ported** (see §6) |

## 3. The reference, as inspected

Deal 1 (light / dark × en / ar × 1440 / 820 / 390): the rail is Customize sections · Lifecycle (pinned, not in
Customize) · Assignment · Contacts · Organization · Service Requests · Tickets · Tasks · Pinned Notes · Attachments ·
footer (Created / Last edited / Seen by) · Articles (after the footer, outside Customize). Visibility is per page view
(not persisted); there is no drag reordering (the grip shows on hover but nothing is wired).

Three header styles exist **inside the CRM rail** and were reproduced as they are: uppercase `text-xs` cards (most
sections), the Desk attachments header (Attachments: sentence case, muted), and the Articles panel (`text-sm` header with
a divider and a count pill). All cards are glass panes with 20 px corners — painted by the app's `crm-ds-look.css` on
`.bg-card.rounded-*` inside `.sf-crm main`, which is why the DS components emit the same classes.

Interactions recorded: Customize (checklist), Assignment + (member search, Comment, Complete By, Priority), Attachments
+ (My Device / Library / Link dialog), Organization pencil (in-card "Search organizations…" picker) and × (undo toast),
Tasks "Open in My Work", Articles row (slide-in reader with "Open in Senaiy-Pedia").

## 4. Evidence

| Level | What ran | Result |
|---|---|---|
| Unit / component (jsdom) | `tests/record-rail.test.tsx` (26), `tests/frappe-lifecycle-rail.test.tsx` (7, stub client), `tests/form-aside.test.tsx` (3); full suite | **100 files, 1,869 passed** (10 todo); typecheck, boundaries, package gates OK |
| Browser, visual (live dev site, mock data) | Before / after capture of the rail: every card's computed radius / border / background / shadow / padding / header font, size and position, and its pixels (per-channel threshold 24); full pages. Deal 1 in 12 combos; Lead 8, Deal 6, Contact 1, Organization 1, Ticket TKT-1041 in 4 combos | **368 / 368 cards and every page identical** |
| Browser, functional | Rail: RecordRail present, modules mounted, order, Customize hide / show, assign picker, organization Change / Clear / Undo, article reader open / link / close, attach dialog, Open in My Work, legacy markup on `/deals/1` outside the CRM scope, no page errors | **91 / 91** |
| Browser, regression | Lifecycle interactions (lead / deal / ticket, 6 combos: rail states, contrast, diagram, transitions) | **132 / 132** |
| Browser, app suites | `e2e/ds-assign-attach.cjs` (CRM + Tickets Assign / Attachments) | **134 / 134** |
| | `e2e/tickets-frappe-fields.mjs` | **116 / 116** |
| Real Frappe site | — | **Not run.** The deployed build cannot select the simulated / Frappe data mode; the CRM's Frappe-data Lifecycle rail is covered by the stub-client tests only. |

Measured and fixed during the work: the package's `lucide-react` 1.28 draws `BookOpen`, `Settings2` and `CheckSquare`
slightly differently from the CRM's 0.462 — every glyph is now host-replaceable and the CRM passes its own. A capture
noise floor exists (antialiasing in one combo per browser launch); a re-capture of that combo was identical.

## 5. Files

**Package** (this branch): `src/record/RecordRail.tsx` (new), `src/record/LifecycleRail.tsx` (`onSelectNext`, identical
to `families`), `src/frappe/record/FrappeWorkflowActions.tsx` (`rail`), `src/frappe/form/FrappeFormView.tsx` (`aside`),
`src/theme/messages-ws/recordRail.ts` (new) + index, `src/record/index.ts`, `src/index.ts`, three test files,
`docs/components/record.md` §9.4 / §10, `CHANGELOG.md`, this file.

**CRM app** (`apps/serve_fast/frontend`, no git; originals backed up in the session scratchpad):
`components/SidebarCard.tsx`, `components/record-detail/RailSection.tsx`, `components/RelatedRecordRow.tsx`,
`contacts/components/SidebarCustomizer.tsx`, `components/record-detail/RailFooter.tsx`,
`pages/References/ReferencesPanel.tsx` (each: the DS component inside the DS scope, the original markup outside),
`components/record-detail/RecordAttachments.tsx` (card class), `pages/Deals/DealDetailPage.tsx` (RecordRail + the
Assignment / Organization / Tasks modules in the DS scope), `components/record-lifecycle/CrmRecordPanels.tsx` (Frappe
Lifecycle → `rail`), `package.json` + `yarn.lock` (vendored tarball), `vendor/`.

## 6. Not done / open

- **FormView main area is not in the DS.** The CRM's record header card, tabs, Deal Profile cards and field controls are
  app code; reproducing them is a separate port. Definition-of-done items "FormView matches the CRM reference" and
  "CRM consumes canonical FormView" are **not met**. Delivered: the `aside` slot that lets a DS form host the CRM rail.
- Only the **Deal** page uses the `RecordRail` container and module components directly. Lead, Contact, Organization,
  Ticket and Order render the DS cards, rows, Customize, footer and Articles through the shared app components, but keep
  their own section switch.
- Drag reordering: not implemented (the CRM has none); `dragHandle` is accepted.
- Merge forward into `families` / `v0.7.0` line: not done. `LifecycleRail.tsx` is identical to `families`, so that file
  merges cleanly; `FrappeWorkflowActions`, `FrappeFormView`, the indexes and messages need an ordinary merge. After it,
  the Sayr rail could share `RecordRailCustomize` / storage logic — its glass look must stay.
- Articles count: the CRM counted references whose article was missing; the DS panel counts resolved articles (edge case).
- `SidebarCustomizer` still contains its old DS-scope markup below the new early return (unreachable; safe to delete).
- Frappe-data Lifecycle: no "View full lifecycle" (the diagram needs the app's graph engine and a Frappe workflow model).
