# CRM reference behaviour: P0 T2 (2026-11-12)

The CRM experience that P0 must reproduce, observed on a **frozen control build**, never on the live CRM.

## 1. Source and method

| Item | Value |
|---|---|
| Snapshot | `20261112T183811Z-crm-p0`, captured 2026-11-12T18:38:13Z, sources hash `4916432ed565adba…`, `--verify` OK (procedure: `p0-lab/CONTROL.md`) |
| Control build | `p0-lab/control/20261112T183811Z-crm-p0/a/out`: byte-identical to run `b` and to the live build of 18:38Z (T1) |
| `@solvfast/ui` in the control | `0.7.0-dev.6` from `vendor/solvfast-ui-0.7.0-dev.6-786327a.tgz` (sha256 `0d316141…`). This snapshot already contains the P0 app adapters (see §3.8). Package code is cited from the installed `dist`; the source files cited (`src/record/ActionBar.tsx`, `LifecycleRail.tsx`) are identical at commit `786327a` (the tarball's) and `755895d` |
| Served by | `p0-lab/crmlab/serve.mjs` on `127.0.0.1:4590`: the build's files; every other **GET** is proxied to the dev site; **every non-GET request is refused (405)** |
| Data | Every page captured runs on the CRM's **mock** data (browser `localStorage`, reset for each probe). The probes recorded **0 non-GET requests** |
| What did **not** come from the control build | Logged **during page load** of Deal 1 / 2 / 5, Lead 8, Ticket and the Deals list (en and ar, two runs; requests made later by interactions weren't logged): only **Google Fonts** (`fonts.googleapis.com/css2`, Geist, Geist Mono, Zain, IBM Plex Sans Arabic from `fonts.gstatic.com`). **No request reached the dev site** (no `/api`, no assets). The fonts are a third-party live input: identical within these runs, not pinned by the snapshot |
| Code traced | The snapshot's own sources (`control/…/a/apps/serve_fast/frontend/src/sear_studio`), and the installed package |
| Scripts (`p0-lab/scripts/`) | `lifecyclecap.mjs`, `dialogcap.mjs`, `listcap.mjs`, `respcap.mjs` (new; run by `t2-capture.sh`, compared by `t2cmp.py`); `extracap.mjs` (new; with the Attachments list and the rail cards, run by `t2-extra.sh`); `t2-datecheck.sh` (new); `control-baselines.sh` (new; runs the existing `maincap.mjs` / `pagecap.mjs`, which gained an optional `CLOCK` variable to shift the browser clock; unset = unchanged behaviour) |
| Evidence | `p0-lab/runs/t2-20261112T183811Z-crm-p0-{r1,r2}/` and `p0-lab/runs/t2x-20261112T183811Z-crm-p0-{r1,r2}/` (facts JSON + screenshots); `p0-lab/baselines/control-20261112T183811Z-crm-p0-{r1,r2,r3}-{main,pages}/` |

**Evidence labels.**
- **V-browser**: observed in the control build in a browser (a facts file or screenshot is cited).
- **V-code**: read in the snapshot's sources (file cited).
- **I**: inferred, not observed.
- **U**: unverified.

An inference is never promoted to a fact.

## 2. Baselines and repeatability

**Reference baselines.** These are the control-build baselines T10 compares against; they replace the earlier `*-live-*` baselines. Two scopes:
- Deal 1 main column + toolbar: 17 states, `maincap.mjs`, 12 theme/language/width combinations;
- the other record pages: Lead 8, Contact 1, Organization 1, Ticket TKT-1041, Service Request REQ-208, and the legacy `/deals/1`; page, tabs, edit, dirty and the unsaved prompt; `pagecap.mjs`, 4 combinations.

| Comparison | Structural signatures | Screenshots |
|---|---|---|
| `r1` vs `r2` | main 320 / 320 identical; pages 244 / 244 identical | pages 244 / 244 identical; main 299 / 320: **21 differ, all in `light-en-390`** (1–136 scattered anti-aliasing pixels, max channel delta 50) |
| `light-en-390` re-captured alone on an idle machine (`r3-main-390check`) | — | vs `r1`: 27 / 27 identical; vs `r2`: the same 21 differ |
| **`r1` vs `r3`** (a full third run, alone on the machine) | **main 320 / 320, pages 244 / 244 identical** | **main 320 / 320, pages 244 / 244 identical** |

**Why `r2` differs.** `r2` is the outlier: `r1`, `r3` and the 390 re-capture all agree. `r2` was the only run captured while other probes (the T2 runs) used the same server and machine. That this concurrency caused the different glyph anti-aliasing is **I**; the cause wasn't isolated.
- **The reference pair is `r1` + `r3`.**
- `r2` is kept unchanged, as evidence of the noise source. Rule for T10: captures run alone on the machine.

Known capture gaps (identical in every run, unchanged from the live baselines):
- `contact1` / `org1` dirty: no typable field reached by the script;
- Deal title edit in `light-ar-820` and `dark-ar-820` (in all three runs).

**The baselines are date-dependent.** They are valid only for captures made on the same day.
- Shifting the browser clock by +7 days (`t2-datecheck.sh`, `light-en-1440`):
  - Lead 8 and Ticket are unchanged: 24 / 24 identical.
  - Deal: 2 / 27 files differ, `won` and `lost`, 12 nodes each. A Recent Interactions timestamp ("Nov 11, 08:42 AM") is seeded relative to today; its text and width change.
- By code, Deal close dates are relative to the current month (`closeDate(0, 15)`, `contacts/data/mockData.ts:356`). Lifecycle "Last Modified" dates are relative to today (`d(2)`, `mockLifecycles.ts:124`).
- **Rule for T10:** capture the control and the candidate in the same session, alone on the machine. Today's `r1` / `r3` remain the repeatability evidence, not a reference for another day.

**Rail cards (control).** A new control baseline for T7 / T10, replacing `rail-live-20261112`:
- `t2x-*/rail/`: `lab-railcap.mjs` with the pages and combinations `labfull.sh` uses, plus Deal 2 (Won) and Deal 5 (Lost). 8 pages × 4 combinations, 432 files per run. `r1` vs `r2`: **identical** (part of the `t2x` comparison below).
- `t2d-*/rail12-{r1,r2}/`: Deal 1, 2 and 5 in **all 12 combinations** (T7's acceptance scope). `r1` vs `r2`: **36 / 36 card-facts files and 468 / 468 screenshots identical.**
- The Won / Lost Actions menu ("No actions from this status") is captured in 4 combinations (`lifecycle/`), not 12.

**T2 complements** (`t2-extra.sh`, runs `r1` and `r2`, captured alone on the machine): **35 / 35 facts files identical; 417 / 419 screenshots identical.** The 2 others are the Deal print page in `light-en-1440` and `light-ar-1440`: the preview prints its own "Printed on <date, time>" line (08:03 vs 08:08 PM). A wall-clock value, not a rendering difference.

**T2 probes** (`t2-capture.sh`, runs `r1` and `r2`, `t2cmp.py`): **9 / 9 facts files and 241 / 241 screenshots identical** (clock minutes normalised in facts, the only time-dependent value).
- No probe step failed.
- 0 non-GET requests.

## 3. Lifecycle

### 3.1 Header Actions menu (mock data)

| # | Behaviour | Evidence | Label |
|---|---|---|---|
| L1 | One **Actions** button in the toolbar on Deal, Lead and Ticket. It's the package `ActionBar` (`variant="menu"`) inside the CRM's DS scope. Ticket TKT-1041 is in that scope too; the legacy menu didn't render on any captured page | `lifecycle/facts-*.json` `actionsButton`, `menu`; `RecordActionsButton.tsx` | V-browser + V-code |
| L2 | The menu lists the manual transitions out of the current state, by transition name: Deal 1 (Negotiation) "Await Client"; Lead 8 (New) "Start Working"; Ticket (Assigned) "Start Work"; Lead (Working) "Qualify / Nurture / Disqualify" | `menu.items`; `dialogs/facts-*.json` `leadConvert.steps[].items` | V-browser |
| L3 | Transitions with `trigger: 'automatic'` are excluded. Roles are **not** passed by Deal, Lead or Ticket (`actionsFromState(lc, stateId)`), so mock data has no role filtering. The list bulk path accepts a `bulkRole` (`RecordListView.tsx:1025`), but no page passes one | `lifecycleShared.ts` `actionsFromState`; call sites `DealDetailPage.tsx:1248`, `LeadDetailPage.tsx:295`, `TicketDetailPage.tsx:263`; `bulkRole` used only inside `RecordListView.tsx` (grep of the snapshot's `src`) | V-code |
| L4 | **The menu items show no destination colour or tone.** The CRM computes `tone: lifecycleStatusTone(destination)`, but the package `ActionBar` menu renders `DropdownMenuItem{label}` and ignores `tone`. Only the legacy menu (outside the DS scope) draws a colour dot | `actions-menu-*.png` (text only); `RecordActionsButton.tsx` (`RecordActionsButtonDs`); installed `node_modules/@solvfast/ui/dist/record/ActionBar.js`: `jsx(DropdownMenuItem, { disabled: a.disabled, onSelect: …, children: a.label })` | V-browser + V-code. **Corrects** the earlier plan, which listed "each item carries its destination state's tone" as visible behaviour |
| L5 | A transition with an unmet structured `condition` stays visible, disabled, with its reason appended to the label ("Name — reason"). The CRM only wires this on Orders (`disabledReasonFor`). Deal, Lead and Ticket don't | `RecordActionsButton.tsx`; `OrderDetailPage.tsx:1057` | V-code (Orders not captured) |
| L6 | A state with no manual way out (Won, Lost) still shows the Actions button. Its menu reads "No actions from this status" | `deal2-won` / `deal5-lost` `menu`; `*-actions-menu-*.png` | V-browser |
| L7 | **Dirty record:** the CRM replaces the menu with its own **disabled** button, `title="Save your changes first"` (ar: «احفظ تغييراتك أولاً»). Clicking it opens nothing. It looks different from the enabled trigger: a Zap icon and `h-8 gap-1.5` | `dirtyActions` (Deal, Lead, Ticket); `*-dirty-toolbar-*.png`; `RecordActionsButton.tsx:53-63` | V-browser (attribute) + V-code. The native tooltip itself isn't rendered by a headless browser; the `title` value is what was verified |
| L8 | Lead: in one trial, Actions wasn't yet disabled 400 ms after typing; in every later run, measured 1 s after typing, it was | trial `t2-lifecycle-trial` (400 ms) vs `-trial2`, `r1`, `r2` (1 s) | V-browser for the single observation. That the Lead's dirty state is **debounced** is **I** (not traced in code) |
| L9 | **A transition runs at once, with no confirmation**, on Deal (Await Client, and Mark Lost, a closed state), Lead (Start Working, Qualify, Convert To Deal) and Ticket (Start Work) | `transition.dialog = null`; `leadConvert`; `dealChain[].dialog = null`; `deal1-after-lost-*.png` | V-browser |
| L10 | After a transition: a toast. Deal and Ticket: "Moved to “<state>”" («تم الانتقال إلى «…»»). Lead: "Lead status updated". Lead conversion: "Lead converted to deal". The rail and the header badge update in place (no reload): on Deal 1, Negotiation (info) → Awaiting Client (`bg-warning/15 text-warning`) → Lost (`bg-destructive/15`), and after Lost the closed notice appears. A `status` history entry is logged with notify and no undo step | `transition.toasts`, `before` / `after`; `t2x-*/extra/facts-*.json` `dealChain`; `handleStageChange`, `transitionStage`, `runTransition` | V-browser (toast, rail, badge, notice) + V-code (history entry) |
| L11 | Lead → Converted: a lead **without** a linked contact first opens a 3-choice dialog (Cancel / Convert without contact / Create contact and convert, plus a duplicate-contact branch). Lead 8 has a contact and converted directly | `LeadDetailPage.tsx:536-546, 1038-1062`; `leadConvert` | Contact path V-browser. The 3-choice dialog is V-code only; **U** in the browser. No seeded lead can reach it: a seeded lead "IS its own contact" (`recordKind` unset, `LeadDetailPage.tsx:310-312`), and `recordKind: 'lead'` is only set when a lead is created in the session (`ContactsPage.tsx:865`) |
| L12 | Closed record (Won / Lost) ⇒ the page is locked: a closed notice, cards read-only, Delete blocked ("Closed — move it through Actions instead") | `closedNotice` after Mark Lost; `DealDetailPage.tsx` (`isLocked`, `DealDeletePopup`) | V-browser (notice) + V-code |
| L13 | **Bulk transitions (lists):** when every selected record has the same Type and Status, the list's bulk Actions menu offers that state's transitions as "<action> → <destination>" (Deals: "Await Client → Awaiting Client"). Deals keeps Won / Lost out of bulk ("need a close reason") | `lists/facts-*.json` `deals.selection.actionsMenu`; `RecordListView.tsx:1022-1026, 1348-1360`; `DealsPage.tsx:724-729` | V-browser + V-code |

### 3.2 Header status badge

| # | Behaviour | Evidence | Label |
|---|---|---|---|
| B1 | Deal and Lead: a pill in the lifecycle **tone** from `lifecycleStatusTone`: `open` → info, `on_hold` → warning, `closed` → by the state colour (saturation < 0.15 → neutral; red hue → danger; otherwise success). Deal 1 Negotiation = info (`bg-info/15 text-info`), Deal 2 Won = success, Deal 5 Lost = danger (`bg-destructive/15 text-destructive`), Lead 8 New = info; Awaiting Client = warning (L10) | `t2x-*/extra/facts-*.json` `badges` (classes + computed colours, en and ar, two runs); `WorkflowRailWidget.tsx` `lifecycleStatusTone` | V-browser + V-code |
| B2 | Ticket: the badge uses the **state's own colour** (`rgba(37,208,254,.1)` background, colour text, no tone class), not a tone | `badges.ticket` | V-browser. **Two badge mechanisms coexist in the CRM** |
| B3 | There is no "failure" or "outcome" field. "Lost reads red" comes only from the seed colour `#ef4444` of a `closed` state | `mockLifecycles.ts` `dealStatuses`; the state editor (§3.6) has no colour field | V-code + V-browser |

### 3.3 Lifecycle rail card (read-only)

| # | Behaviour | Evidence | Label |
|---|---|---|---|
| R1 | Package `LifecycleRail`. Past rows, then the current row ("<state> — Current" for screen readers), then **next**: one target → a row; several → a box; none → "End of lifecycle". Then "View full lifecycle". **No clickable options** (0 `data-next-option` buttons on every record) | `rail.nextButtons = 0`; `*-rail-*.png`; `WorkflowRailWidget.tsx` | V-browser |
| R2 | The path is the **shortest path** from the lifecycle root to the current state (`pathToState`), not the record's real history. Each row's "who · when" is the transition log's entry for that state if present, otherwise a deterministic synthetic one (`createdBy`, `createdAt + i days`; first row "Created by …") | Deal 1: Qualification Apr 15 → Proposal Apr 16 → Negotiation Apr 17 (one day apart); after a transition the new row shows the real actor and time ("Await Client by Sara Al-Otaibi · Nov 12, 2026, HH:MM") | V-browser + V-code |
| R3 | **"Next" isn't the Actions list.** The rail shows every outgoing transition's target (deduplicated), **including automatic ones and regardless of role**. Actions excludes automatic transitions. A target already on the path is tagged "back" | `WorkflowRailWidget.tsx` (the "WHAT CAN HAPPEN NEXT" block; its header comment still says "the SAME options the Actions button offers", contradicted by the code) | V-code. On the captured records both lists are equal (no automatic or role-limited edges) |
| R4 | Won and Lost render the same way: the current row in the normal current style, then "End of lifecycle". **No failed or lost step kind** | `deal2-won-rail-*.png`, `deal5-lost-rail-*.png` | V-browser. **Resolves the U item:** the CRM has no terminal-failure rail style, so per the agreed rule T7 adds none |
| R5 | Ticket rows show no date ("Khaled", "System"): ticket log times are relative strings ("45m ago"), and the rail shows a date only for ISO times | `ticket.rail`; `WorkflowRailWidget.tsx` `parseTime` | V-browser + V-code |

### 3.4 "View full lifecycle" diagram

| # | Behaviour | Evidence | Label |
|---|---|---|---|
| D1 | A dialog. Title "<Entity> lifecycle · <lifecycle name>"; subtitle "<record> · currently <state>". A React Flow graph with dagre top-to-bottom layout and one node per state: name; phase ("Open", "On Hold", "Closed") · who · when for reached states; a "Current" tag. Edge labels = transition names. Legend: Done / Current / Not reached / Path taken. Controls: zoom in, zoom out, fit view. No minimap | `diagram` facts; `*-diagram-*.png`; `LifecycleDiagramPopup.tsx` (imports `reactflow`, `@dagrejs/dagre` and the package's `LifecycleDiagramDialog`, `LifecycleStateCard`, `LifecycleEdgeLabel`) | V-browser + V-code |
| D2 | Phase icon per node: open = dot, on hold = pause, closed = check. **Won and Lost both show the closed check.** The path taken is drawn in green; the current node is highlighted | `deal5-lost-diagram-light-en-1440.png` | V-browser |
| D3 | Arabic: the dialog follows the page direction | `diagram.dir` in `dark-ar-1440` | V-browser |

### 3.5 Diagram renderer coupling (for E3)

`LifecycleDiagramPopup.tsx` depends on the CRM types `Lifecycle`, `LifecycleStatus` and `LifecycleState`; on `entityLabel` and `stateLabel` (mock lifecycle module); and on `pathToState`, `statusById` and `stateLabelOf` (`lifecycleShared`). Package dependencies: `reactflow ^11.11.4` and `@dagrejs/dagre ^3.1.3`. **V-code.** The visual parts (dialog, state card, edge label, colours) are already the package's.

### 3.6 Lifecycle configuration (R8)

| # | Item | Evidence | Label |
|---|---|---|---|
| C1 | `/crm-app/configuration/lifecycles/:entity` is a DS list (search, Saved, Filter, Group by, Sort by, Columns; columns Lifecycle Name / Statuses / Last Modified; Create Lifecycle). A row opens the designer `/crm-app/configuration/lifecycles/deal/lc_default_deal`: a React Flow canvas (6 nodes, 5 edges), Auto-layout, Add Status, Save, Build with Senaiy, and a minimap | `resp/facts.json` `config`, `designer`; `config-*.png` | V-browser |
| C2 | **State panel:** Status name; Phase (Open / On Hold / Closed); Only Allow Edit For (edit restriction); Optional status; Closure Survey (closed states); Linked Playbook. **No colour, Arabic name or outcome control** | `stateEditor` (Lost); `config-state-lost-*.png` | V-browser |
| C3 | **Transition panel:** Transition Action (from → name → to); Allow For (edit restriction); Allow Self Approval; Condition (with "Generate with Senaiy"); Trigger Type (Manual / …); Workflow Configuration (a linked approval workflow) | `transitionEditor` (Mark Lost) | V-browser |
| C4 | Data contract (types): `LifecycleStatus {id, name, nameAr?, state: 'open'│'on_hold'│'closed', color?, position, entryRule?, closureSurveyId?, closureSurveyChannels?, editRestriction?, isOptional?, linkedPlaybookId?, docStatus?}`; `LifecycleTransition {id, name?, nameAr?, fromId, toId, workflowId?, trigger?: 'manual'│'automatic'│'conditional', condition?, conditionMessage(Ar)?, createApprovalTask?, afterDays?, allowSelfApproval?, editRestriction?}`; `Lifecycle {id, name, nameAr?, entity, scope, statuses, transitions, …}` | `pages/CRM/lifecycles/mockLifecycles.ts` | V-code |
| C5 | In the designer, the node dot is the **phase** colour (Proposal is cyan although its seed colour is `#512195`; Lost is green although its seed colour is `#ef4444`), while the record badge uses the state colour (B1) | `config-state-lost-*.png` vs `mockLifecycles.ts` | V-browser + V-code (I: the designer ignores `color`) |

### 3.7 Lifecycle facts still unverified

| Item | Why | When |
|---|---|---|
| Frappe-data Lifecycle in a browser | A production build can't select a Frappe data mode. `?crm_data=simulated` is honoured only in builds made with `VITE_CRM_ALLOW_SIMULATED=true` (`data/frappe/client.ts`). The control rendered mock data with that parameter (`deal1-qsim`) | T7: simulated lab build (labelled "simulated"); P1: a real site (E5, "pending") |
| Server role filtering, self-approval, `apply_workflow` | Backend | P1 (E5) |
| The 3-choice Convert dialog in a browser | No seeded lead can reach it: every seeded lead is its own contact (L11) | Reachable only by creating a lead in the session; not needed for P0 parity (lead conversion stays app logic) |
| The native `title` tooltip's rendering | Headless browsers don't render native tooltips | The attribute value is verified (L7) |
| Condition-blocked actions (L5) on Deal / Lead / Ticket | Those pages don't wire `disabledReasonFor` | Only Orders does |

### 3.8 Frappe data: what the snapshot contains

- On Frappe data, Deal and Lead hide the header Actions (`{!frappeDoc && <RecordActionsButton …/>}`). The rail is `CrmStatusActions variant="steps"`. **V-code.**
- **In this snapshot**, `CrmStatusActions` maps `steps` → `FrappeWorkflowActions variant="rail"`, the **clickable** rail added by my P0 change (`CrmRecordPanels.tsx:42-75`). **V-code.**
- Before P0, it passed `variant` straight through: `steps` was the old stepper with the Actions menu inside the rail (`vendor/p0-rollback/src/…/CrmRecordPanels.tsx.orig:59`). **V-code.**
- Neither was ever browser-verified.
- Per E2, T7 replaces both with the mock experience (header Actions plus a read-only rail). That is an **intentional unification**, not parity with an earlier Frappe behaviour.

## 4. Responsive record page (R3)

Deal 1. At 1440 and 820 px the app sidebar takes the first 280 px (main column 847 / 516 px); at 390 px there is no sidebar (main column 358 px, x = 16).

| # | Behaviour | Evidence | Label |
|---|---|---|---|
| P1 | 4 tabs (About, History, Activities, Revenue) of **equal width** fill the bar at every width: 207 px at 1440, 124 px at 820, 85 px at 390. **No truncation, no horizontal scroll** (`scrollWidth = clientWidth`); icon plus label at every width. In RTL the order is mirrored | `resp/facts.json` `tabs`, `tablist`; `resp/deal1-page-{light-en,light-ar}-{1440,820,390}.png` (icons viewed: en at 1440, 820 and 390; ar at 390) | V-browser |
| P2 | The rail moves **below** the main column under the `lg` breakpoint (it's below at 820 and at 390, beside it at 1440) | `railBelowMain` | V-browser |
| P3 | The toolbar stays one row at 390 (Back, Save, Actions, ⋯), with no page horizontal scroll | `toolbar`, `pageScrollX = false` | V-browser |
| P4 | Quick actions (Log Call, Meeting ▾, Note, More ▾) wrap under the title at 390 | `quickActions` | V-browser |
| P5 | **At 820 px the header's title column collapses to about 5 px:** the title is hidden and the facts stack one word per line | `deal1-page-light-en-820.png`; `quickActions[0].rect` width 5 | V-browser. Cause (I): the header's `md:flex-row` gives the quick-action cluster the row at a main width of 516 px. An observed CRM defect: parity keeps it in P0; changing it is a separate CRM decision |

## 5. Lists (R7)

All five lists captured (`/crm-app/deals`, `leads`, `contacts`, `organizations`, `/service-desk-app/tickets`) render the package `ListView` through `CrmDsListView` (Service Desk Tickets included: its toolbar is the DS one). **V-browser + V-code.**

| Capability | CRM evidence | Label |
|---|---|---|
| Search (`Search…`); a non-matching term empties the table (filtered-empty state below) | inventory; `emptyFiltered` | V-browser. Live search, with no debounce (`searchDebounceMs={0}`): V-code |
| Quick filters: two pick-list fields (Deals / Leads / Tickets: Status, Phase; Contacts: Industry, Organization; Organizations: Industry, Country), labelled "All · <field>" | inventory | V-browser |
| Saved filters: canned chips as removable saved filters (Deals: Open, On Hold, Closed, My Deals, Unassigned, High Priority, Closing This Month; Tickets add At Risk, Breached) + "Save current as…" | `popups.Saved` | V-browser |
| Filter builder ("Filters · No filters · Add filter") | `popups.Filter` | V-browser |
| Group by (pick-list fields; Deals: None, Status, Priority, Assignee, Organization, Primary Contact, Phase, Tags, Team) | `popups["Group by"]` | V-browser |
| Sort by: a menu of the visible columns | `popups["Sort by"]` | V-browser. **One** key (`sortRows(rows, {key, dir})`): V-code |
| Columns: "Edit columns": move / remove each column, "Add column" (first column fixed) | `popups.Columns` | V-browser |
| Type selector (Deal Type / Lead Type / Ticket Type: All Types + types): an app control in the toolbar | `popups["Deal Type:All Types"]` | V-browser |
| Views: Deals = Table / Board / Calendar; Leads, Tickets = Table / Board; Contacts, Organizations = table only. Board and Calendar are the CRM's own components (`contacts/components/KanbanBoard`, `record-list/CalendarView`); in Board / Calendar the list toolbar keeps only the type selector, the view switcher, Articles and New | `views.*` + `view-*.png`; `DealsPage.tsx:872-1011` | V-browser + V-code |
| Gallery view: Attachments only (`views={['table','gallery']}`, app `GalleryView`) | `AttachmentsListPage.tsx:168, 200`; `t2x-*/gallery/` (`/crm-app/activities/attachments`: DS list toolbar + Table / Gallery switch; Gallery = file cards with the linked record) | V-browser + V-code |
| Selection: header checkbox, "N items selected · Clear selection", a bulk **Actions** menu: Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule (disabled with its reason inline), Add Tags, Remove Tags (disabled with reason when none), Print, Delete, plus lifecycle transitions (L13) | `selection` | V-browser |
| ⋯ List menu: Import, Print list, Export, Reload (Tickets: Reload only) | `popups["List menu"]` | V-browser (the items) |
| What Export, Import and Print list open (Deals) | **Export:** dialog "Export Data": File Type (CSV), Export Type ("All Records (8)"), field checklist with Select All / Select Mandatory / Unselect All (each field with its key and "(Mandatory)" or a conditional rule), Cancel / Export. **Import:** dialog "Data Import", 4 steps (Upload, Preview, Import, Result), Import Type "Insert New Records", file chooser (CSV, XLS or XLSX), Download Template, Upload and Preview. **Print list:** no dialog; the browser print is called directly | `t2x-*/extra/facts-*.json` `listMenu`; `deals-Export-*.png`, `deals-Import-*.png` | V-browser (opened and closed; nothing was exported or imported). Which component draws each dialog wasn't traced: **U** for the source, V-browser for the content |
| Like (heart column, "Liked by me" filter) | inventory (`Liked by me`) | V-browser |
| Primary action (New Deal / New Lead / Add Contact / Add Organization / New Ticket) | inventory | V-browser |
| Related Articles popover ("Articles N"): app control | `popups.Articles*` | V-browser |
| Filtered-empty state: "No records match the current filters." + "Clear filters", pager "Total: 0". The same on all five lists | `emptyFiltered` | V-browser |
| Empty list with no filter (the `emptyMessage` / `emptyAction` "New …") | `CrmDsListView.tsx:297-298` | V-code; **U** in the browser (no empty seeded list) |
| Pager: previous / next, "Total: N", page size 20 (`pageSize ?? 20`) | inventory; `CrmDsListView.tsx` | V-browser + V-code |
| Loading and error states | Props passed (`loading`, `error`, `onRetry`); mock data loads synchronously | V-code; **U** in the browser (no reachable state on mock data) |
| 390 px (dark, Arabic): every list stays a **table** (no card layout); same toolbar, columns and bulk menu as at 1440 | `lists/facts-dark-ar-390.json` (`tableVisible: true`, `cards: 0`); `lists/*-dark-ar-390.png` | V-browser |
| No CRM evidence of: column resize / pin, multi-sort, nested AND/OR, row context menu, server group counts, "select all matching" | Not observed in any toolbar, menu or popover captured; `CrmDsListView` passes no prop for them | **Not observed** + V-code (props). The filter builder's inside ("Add filter") wasn't opened, so whether the package builder offers AND/OR groups **by default** is **U** |

## 6. Record dialogs (candidates only)

| Dialog | CRM reference | Label |
|---|---|---|
| **Delete** (⋯ ▸ Delete, Shift+Ctrl+D) | Deal: the package `AlertDialog` (`CrmDeleteConfirm`), title "Delete <name>?". Blocked when closed or linked: "This record can't be deleted:" + linked records as links + **Close only**. Otherwise "This can't be undone." + Cancel / Delete (destructive). Lead: the same title with "Linked — 1 deal" and Close, without the "can't be deleted" sentence. Ticket: a `role=dialog` (not an alert dialog), "This ticket can't be deleted: Linked — 1 task" | V-browser (blocked variants: Deal 1, Lead 8, Ticket) + V-code (`DealDetailPage.tsx:1865-1905`, `CrmDeleteConfirm.tsx`). The confirmable variant: **U** in the browser (every probed record was linked) |
| **Remind me** (Shift+R) | The app's `AppPopup` (not the package `ReminderDialog`): When (select, default "In 1 hour"), Note (optional), Cancel / Set reminder; toast "Reminder set". The same on Deal, Lead and Ticket | V-browser + V-code (`DealRemindPopup`) |
| **Print** | Not a dialog: the page is replaced by a print page (Back, Print, Print Format, Language, Letter Head, iframe preview with a "Printed on <date, time>" line, "Print opens your browser's print dialog…"), built from the package `PrintPreviewFrame` / `PrintView` / `FrappeFormPrint` (`CrmRecordPrint`) | V-browser (`t2x-*/extra/facts-*.json` `print`, `deal1-print-*.png`) + V-code |
| **Convert** (Lead) | §3.1 L11 | V-code (dialog) |
| **Duplicate** | Navigates to the list with `?new=1` (no dialog) | V-browser |

## 7. Corrections to earlier statements

1. The Actions menu items show **no destination tone** in the CRM's DS scope (L4). Earlier plans listed tones as visible behaviour.
2. The rail's "next" is **not** the same list as the Actions menu: it includes automatic transitions and ignores roles (R3).
3. The dirty Actions button is a **separate** CRM button, visually different from the enabled trigger: a Zap icon (L7).
4. Ticket TKT-1041 and the Service Desk Tickets list are **inside** the DS scope (DS Actions menu, DS list). `CrmDsListView`'s header comment says Service Desk keeps the legacy list; the browser shows otherwise.
5. Two status-badge mechanisms: tone (Deal, Lead) vs state colour (Ticket) (B1, B2).
6. The control snapshot's Frappe-data rail is the P0 **clickable** rail, not the pre-P0 stepper (§3.8).

## 8. What T3–T10 take from this

These are reference facts, not new decisions. Each P0 task must keep the matching row identical to the control.

- **T5 (tabs):** the CRM's 4 tabs: equal width, no scroll, no truncation down to 390 px (P1). Overflow behaviour for more tabs has **no CRM evidence**. Any scrolling for a 5–6-tab page is an extension and must be labelled as one.
- **T7 (Lifecycle):** the reference rows are:
  - L6, L7, L9 (no-actions text, the dirty button and its title, immediate run);
  - B1 (badge tone rule);
  - R1–R4 (read-only rail, shortest path per E4, next = every outgoing edge, no failure kind);
  - §3.4–§3.5 (diagram contract, per E3 A).
- **For the owner: conflicts between this evidence and earlier wording.** These are not decided here.
  1. **E2 says "destination tones"; the control's Actions menu shows none (L4).** Exact parity means plain items. Showing tones would be a visible change to the CRM, labelled as an improvement. **Your ruling is needed before T7.**
  2. **The 820 px header collapse (P5)** is current CRM behaviour. P0 parity keeps it. Whether the DS `RecordPage` should reproduce or fix it is your call, and it affects T10's 820 px comparisons.
  3. **The two badge mechanisms (B1 tone vs B2 Ticket state colour):** P0 keeps each page as it is. Unifying them would be a CRM change.
- **T9 (ListView spec):** §5 is the evidence table. Board, Calendar and Gallery are app components, today outside the DS.
- **Dialogs:** §6. Delete, Remind and Convert stay app-side candidates. Print already uses the package's print parts.

## 9. Integrity at the end of T2

| Check | Result |
|---|---|
| `snapshot.sh --verify 20261112T183811Z-crm-p0` | OK |
| `sha256sum -c out.sha256` on control `a/out` and `b/out` | OK (unchanged since T1) |
| Dependency mirror `snapshot-deps/20261112T183811Z-crm-p0` | read-only, unchanged |
| Live CRM, its `vendor/` tarballs, `vendor/p0-rollback/` | untouched; only read (code tracing was done on the snapshot's copy) |
| DS worktree `feat/0.8.x/record-page` | HEAD `b995fd2`; the only change is this new file, uncommitted |
| New lab files | `p0-lab/scripts/{lifecyclecap,dialogcap,listcap,respcap,extracap}.mjs`, `t2-capture.sh`, `t2-extra.sh`, `t2-datecheck.sh`, `t2cmp.py`, `control-baselines.sh`; an optional `CLOCK` variable in `maincap.mjs` / `pagecap.mjs`; evidence under `p0-lab/runs/t2-*`, `t2x-*`, `t2d-*` and `p0-lab/baselines/control-*`. The trial runs (`runs/t2-*-trial*`) are kept but aren't evidence |
