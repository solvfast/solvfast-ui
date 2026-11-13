# P0 — final parity record (T5–T10)

Status: **P0 complete, for review.** Package `@solvfast/ui` **0.8.0-dev.5**, branch `feat/0.8.x/record-page`. Not published,
tagged, pushed or merged; the live CRM and its dependencies are unchanged. P1 / P2 not started.

Reference: the CRM, frozen as snapshot **`20261112T183811Z-crm-p0`** (sources `4916432e…`; procedure and evidence in the lab's
`CONTROL.md`). All CRM evidence below comes from builds of that snapshot, never the live site. Lab root:
`/home/frappe/sfui-dev/p0-lab` (paths below are relative to it).

## 1. What was compared

| | Control | Candidate |
|---|---|---|
| Build | `control/<id>/a` — the snapshot as is (vendored @solvfast/ui 0.7.0-dev.6) | `control/<id>/final` — the snapshot + `changesets/final` |
| Package | `vendor/solvfast-ui-0.7.0-dev.6-786327a.tgz` | `pack-final/solvfast-ui-0.8.0-dev.5.tgz` (sha256 `caccf079…`; = `changesets/final/ds.tgz`) |
| Output hash (manifest) | `227c2842…` | `c5c8d0a0…` (deps `c25067f3…`) |
| Install | offline (no online fallback) | offline (no online fallback) |
| Served on | 127.0.0.1:4590 | 127.0.0.1:4610 |

The candidate's CRM-side changes are **lab patches only** (`changesets/final/*.patch`; never applied to the live CRM):
`RecentInteractions`, `RecordEditSession`, `RecordMoreMenu` (from T3: the neutral names), `CrmRecordPanels`,
`RecordActionsButton`, `WorkflowRailWidget`, `DealDetailPage`, `LeadDetailPage` (T7: the Lifecycle contract and
`LifecycleActions`). Candidate typecheck: no errors beyond the control's 8 pre-existing files.

## 2. Results (control vs candidate, `scripts/p0-final.sh`, `scripts/p0-final-r2.sh`)

Captures ran one target at a time, alone on the machine. The first control pass (23:24 UTC) and the candidate pass
(00:01 UTC) fell on **different dates**; the mock data's dates are relative to today, so every date text moved by one
day (e.g. "Nov 4" → "Nov 5"). The control's visual captures were re-taken on the candidate's date (`runs/p0final-r2-control-*`,
00:42 UTC) and compared with that. Behaviour suites were not affected and are reported from the first pass.

### 2.1 Visual and structural captures

| Capture | Scope | Facts / signatures | Screenshots |
|---|---|---|---|
| Deal page main column + toolbar (`maincap`) | 12 combos (light/dark × en/ar × 1440/820/390), 320 states | 308 / 320 identical; **12 expected** (below) | **320 / 320 identical** |
| Other record pages (`pagecap`): Lead 8, Contact 1, Org 1, Ticket, REQ-208, legacy Deal 1 | 4 combos | 244 / 244 | 244 / 244 |
| Rails (`lab-railcap`): Deal 1 / 2 / 5 × 12 combos; Lead 8, Deal 6, Contact 1, Org 1, Ticket × 4 | | 56 / 56 | 712 / 712 |
| Lifecycle probes (`lifecyclecap`): Actions menu, dirty, transition, rail, diagram | 4 combos | 4 / 4 | 124 / 124 |
| Dialogs (`dialogcap`) | 2 combos | 2 / 2 | 9 / 9 |
| Responsive / config (`respcap`) | 7 combos | 1 / 1 | 13 / 13 |
| Lists (`listcap`): Deals, Leads, Contacts, Orgs, Tickets | 2 combos | 2 / 2 | noise only (§2.3) |

**The 12 expected differences** (`menu-dots-*`, every combo): the ⋯ record menu's items. `RecordMenu` (package) wraps each
item label in a `<span>` (`<div>New Deal</div>` → `<div><span>New Deal</span></div>`): 8 more nodes, same text, same
pixels (0 differing screenshots). Known since T3.

### 2.2 Behaviour suites (both targets, same session)

| Suite | Control | Candidate |
|---|---|---|
| `editix` (edit session: open, dirty, save, cancel, guard) | 72 pass, 0 fail | 72 pass, 0 fail |
| `lab-railix` (rail interactions) | 91 pass, 0 fail | 91 pass, 0 fail |
| `lab-interact` (header, menus, dialogs, keyboard) | 66 pass, 0 fail | 66 pass, 0 fail |
| app e2e `ds-assign-attach` | 134 pass, 0 fail | 134 pass, 0 fail |
| app e2e `tickets-frappe-fields` | 116 pass, 0 fail | 116 pass, 0 fail |
| app e2e `ds-record-menus` (every record menu's items) | log | **identical log** |
| app e2e `ds-route-sweep` (38 routes × light-en-1440, dark-ar-390: overflow, `/api` calls, errors) | 38 clean | 38 clean |

The e2e suites are the app's own, run from the snapshot copy (`control/<id>/a/apps/serve_fast/frontend/e2e`). Ten capture
steps time out on **both** targets, the same set (`pagecap`: `contact1` / `org1` "dirty" × 4 combos; `maincap`:
`title-edit` at light-ar-820 and dark-ar-820). They also occur in earlier lab runs (e.g. `runs/t4-t3-dev3b-main.log`); they
are limits of the capture scripts' selectors, not differences between control and candidate.

### 2.3 Noise and time-dependence (how differences were resolved)

- **Dates**: above — re-captured on the same date; after that, 0 date differences.
- **Lists**: the screenshots vary between runs of the **same** build (control vs control, 25 min apart: 4 and 17 files,
  3–30 pixels). Lists were re-captured back to back (`runs/p0final-r3-{control,candidate}-lists`, `-b` = control again).
  No list screenshot differs in every control / candidate pair (2 candidate runs × 3 control runs), and facts are
  identical in all of them. A larger Tickets difference (column widths, ~34 k pixels) appeared only between the first
  candidate pass and a later control pass; it is absent back to back (time-relative SLA text in the auto table layout).
- **First-capture pixel noise** in single combinations (seen in T4, T7, T8) resolved by re-capture; facts identical.
  Policy: a difference is a finding only if it repeats in a re-capture or appears in facts.

## 3. Stage evidence (T5–T9)

| Stage | Change (package) | Evidence |
|---|---|---|
| T5 `RecordTabs` | `overflow?: "fill" \| "scroll"` (default `fill` = previous markup), `ariaLabel?`, `RecordTab.hidden?` | `tests/record-page.test.tsx` (fill DOM = 0.8.0-dev.4; scroll markup; hidden; keyboard en / RTL); `gates-rp-t5` |
| T6 `RecordSectionCard` | read-only record card (DOM = a read-only `RecordEditableCard`) | `tests/record-section-card.test.tsx` (5); `gates-rp-t6` |
| T7 Lifecycle | Core `record/lifecycle.ts`, `LifecycleActions`; `FrappeWorkflowActions` `variant="actions"`, read-only `rail` (`applyFromRail` = old clickable rail), `steps` deprecated; `workflowLifecycle` | `tests/lifecycle-contract.test.tsx` (15), `tests/frappe-lifecycle-rail.test.tsx`; CRM mock: `runs/t7-compare.out`, `runs/t7r-*` (main 320/320, rails and lifecycle facts identical to T4); **simulated** Frappe: `runs/t7-sim-t7-sim`, `runs/t7-sim-t4-sim`, `runs/t7-sim-dirty`; `gates-rp-t7`, `gates-rp-t7b` |
| T8 dental showcase | `showcase/src/pages/record-page-dental.tsx` (package components only) | `scripts/dentalcap.mjs`; `runs/t8-dental-r1..r3` (12 combos, all checks pass; r2 = r3), `runs/t8-dental-plain`; `gates-rp-t8` |
| T9 ListView spec | `docs/specs/LISTVIEW-API.md` (no code) | capability matrix vs the CRM's 5 lists; one proposal (`onResultChange`) |
| T10 | this record | §2; `gates-rp-t10` |

**E2 on simulated Frappe data** (lab build with `VITE_CRM_ALLOW_SIMULATED=true`, `?crm_data=simulated`; *simulated*, not a
real site): Deal 1 shows the header Actions menu (`Await Client`) and a read-only rail (no buttons); the transition moves it
to Awaiting Client (next: Won, Lost); editing disables Actions with "Save your changes first" / "احفظ تغييراتك أولاً". The
T4 build on the same data has no header Actions and a clickable rail. This is an intentional unification (E2), not a
claim about how the earlier Frappe implementation behaved.

## 4. Gates at the final HEAD

`gates-rp-t10` at `b241f65` (0.8.0-dev.5): typecheck 0 errors; vitest **111 files, 2,040 passed** (10 todo); build OK; boundaries OK; package OK; tree clean after the gates.

## 5. Artifact

| | |
|---|---|
| File | `pack-final/solvfast-ui-0.8.0-dev.5.tgz` |
| From commit | `b241f652a67d751e2f372fe4c161ead43090c20c` (this record is outside the package's `files`) |
| Size | 1,379,582 bytes, 1,088 files (each equal to the tree; `package.json` byte-identical to HEAD; check-package OK) |
| sha256 | `caccf079dfdf1c7325314a18f6dd79c874f12e2c20fc83ca27b7d1b93d1ef4f6` |
| integrity | `sha512-fNLHzShnf4Ued2q4PwawtLqVd+wCiuZKgyLvj6hPfjCrw/ElKw2mR5CBcqCjZgo4XT8UgrWMWGOQte2Jua8o4Q==` |

The parity candidate (§2) was built with **this exact tarball** (`changesets/final/ds.tgz`, same sha256).
`glass.css` is byte-identical to 0.8.0-dev.3 throughout P0.

## 6. Open items (not P0)

| Item | Status |
|---|---|
| Frappe behaviour on a real site (workflow actions, permissions, `FrappeListView`) | **Pending — P1** (E5). P0 covers unit tests and the *simulated* backend only |
| Lead on simulated data | Not covered: the CRM renders Lead 8 from mock data even in simulated mode |
| Lifecycle diagram entry (`lifecycle-diagram`, E3 option B) | P1 |
| ListView `onResultChange` | Proposed only (T9) |
| Deal header collapse at 820 px | Known CRM defect, preserved (T2 ruling) |
| Empty / loading / error list states in the browser | Unverified (no reachable state on mock data) |
| Lab servers | the control (4590) was stopped after T10; the candidate server (4610) is stopped by the script. Port 4850 (owner's showcase preview) was never touched |
