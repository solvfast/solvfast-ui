# P36 — index (`@solvfast/ui` 0.7.0-dev.2, unreleased)

P36 turned the five open P35 owner decisions into package behaviour and prepared — **but did not run** — a real-site
validation. Integration branch: `feat/0.7.x/p36-int`, base `cd3661c` (0.7.0-dev.1). Nothing was pushed, tagged, published
or deployed. **No Frappe site was contacted, seeded, read or written; every result below is unit / jsdom / simulator
evidence**. The DataGrid mobile card layout (W3) was reverted in batch 2 (owner correction, `ccb232d`).

| Document | What it holds |
|---|---|
| `CHANGELOG.md` → 0.7.0-dev.2 | Added / Changed (what apps must do) / BREAKING / Fixed / validation status |
| `docs/audit/p36/VALIDATION-MATRIX.md` | every COVERAGE row classified (a)–(e), the 75-test real-site catalogue, expected Frappe behaviours (§7) — generated, `node e2e/frappe-site/matrix/render.mjs --check` |
| `e2e/frappe-site/README.md` | how to run the validation: what the owner must provide, commands (none run) |
| `docs/audit/p35/COVERAGE.md` §8 | the 18 rows whose evidence / limitations P36 changed (no status change; 258 / 301) |
| `docs/audit/p35/CRM-MIGRATION.md` §5 | the five decisions from the CRM's side, M10 readiness criteria |

## 1. Owner decisions (final)

| # | Decision | Where it landed | Status |
|---|---|---|---|
| P36-1 | Header-actions selection is the List View standard | W1: `selectionMode="header"` is the default for `ListView` / `FrappeListView`; `"bar"` is opt-in; Desk's per-action selection outcome (`selectionAfterBulk`, exported); Ctrl/⌘-click ticks a row | merged |
| P36-2 | CRM pickers migrate per usage, by semantics only | CRM workstream (`crm/p36-ds`) | CRM work; report pending (`CRM-MIGRATION.md` §5.1) |
| P36-3 | CRM confirmations → `AlertDialog` | CRM workstream (`crm/p36-ds`) | CRM work; report pending (`CRM-MIGRATION.md` §5.2) |
| P36-4 | No Commission `DataGrid` migration until responsive behaviour is verified | W3 card layout **reverted** in batch 2 (`ccb232d`, owner correction: no card layout, keep the table and its horizontal scroll); `DataGrid` unchanged from 0.7.0-dev.1; CRM M10 **not migrated** | reverted; CRM M10 needs owner approval of the editing-model change (`CRM-MIGRATION.md` §5.3) |
| P36-5 | Report view editing = Frappe 15.110 by default, explicit opt-in | W2: `FrappeReportView editable="desk"` default, `"strict"` / function opt-in; child cells; **BREAKING** `isCellEditable` signature vs 0.7.0-dev.1 | merged |

Correction found on the way (P36-5): the P35 premise "Desk makes fields on a DocType without a Table field read-only" was
wrong. `is_editable` returns the falsy `read_only_depends_on` (not `false`), and frappe-datatable 1.20.4 refuses editing
only on `=== false`, so plain fields are editable; Frappe's own Cypress `report_view.js` edits one. Details:
`docs/components/views.md` §3, `CRM-MIGRATION.md` §5.5.

## 2. Workstreams, branches and commits

| Workstream | Branch (worktree) | Commits | Merged as |
|---|---|---|---|
| W1 selection | `feat/0.7.x/p36-selection` (`p36-selection`) | `d0de9d7`, `8943d80` | `25bd634`; integrator `2296c84` exports `selectionAfterBulk` |
| W2 report | `feat/0.7.x/p36-report` (`p36-report`) | `e22a651` | `3a55f7b`; integrator `c660ddc` exports the Report editing helpers and types |
| W3 datagrid | `feat/0.7.x/p36-datagrid` (`p36-datagrid`) | `e3dba29`, `ddd948c` | `7bd1595` — **reverted** in batch 2 (`ccb232d`) |
| W4 realsite | `feat/0.7.x/p36-realsite` (`p36-realsite`) | `8248415`, `8815ec5` | `15a6322` |
| CRM | `crm/p36-ds` (`p36-crm`, the CRM repository) | seen, not yet reported: `8015184`, `431cf9e`, `6310fc0` | not merged into the package (separate repository) |
| Docs integration | `feat/0.7.x/p36-int` | this commit (version 0.7.0-dev.2, CHANGELOG, docs) | — |

`git log --oneline cd3661c..HEAD --first-parent` before the docs commit:

```
15a6322 P36: merge W4 realsite (validation matrix, guarded staging seed/teardown, matrix runner — not run)
2296c84 P36: export selectionAfterBulk from @solvfast/ui/frappe
25bd634 P36: merge W1 selection (Desk header-actions selection is the default)
c660ddc P36: export the Report view editing helpers and types from @solvfast/ui/frappe
3a55f7b P36: merge W2 report (Report view editing = Frappe 15.110 by default, editable opt-in)
7bd1595 P36: merge W3 datagrid (responsive layout)
```

`7bd1595` was reverted in batch 2 by `ccb232d` (owner correction: no DataGrid card layout).

## 3. What was validated (unit / simulator only)

| Area | Evidence | Level |
|---|---|---|
| Selection (W1) | `tests/list-selection-desk.test.tsx` (FrappeListView, no `selectionMode` prop: LV.F2–F12, F16, 15 `selectionAfterBulk` cases); `tests/list-selection-header.test.tsx` (+7 LV.F16 / F17); bar-mode tests kept with an explicit `selectionMode="bar"` | jsdom, stub transports, simulator |
| Report view (W2) | `tests/frappe-views-report.test.tsx`: 26 `LV.H1` (pure rule incl. the Cypress fixture case, strict and function opt-ins, child cells through the SIMULATED `reportSetValueHandler`) | jsdom, simulator |
| DataGrid (W3) | **Reverted** in batch 2 (`ccb232d`): the card layout, its tests and `e2e/datagrid-mobile.mjs` were removed; `DataGrid` is unchanged from 0.7.0-dev.1 | — |
| Real-site tooling (W4) | `tests/frappe-site-guards.test.ts` (23: deny list, URL / site / private-dir / approval guards, redaction, runner refusals, Python guard refusals without frappe, matrix = rendering of the catalogue); `run-matrix.mjs --dry-run` with fake values | local only, no network |
| Integration (this commit) | `npx vitest run`: 75 files, 1505 passed, 10 todo, 0 failed (0.7.0-dev.1: 72 / 1415); `npm run typecheck` exit 0; `check-boundaries` source rules OK; `render.mjs --check` current | — |

Not run at integration: `npm run build` (so `dist/styles/full.css` for consumers without Tailwind is not yet rebuilt), `check:package`, the dist rules of `check:boundaries` (source rules: OK), `showcase:build`, `e2e/showcase-smoke.mjs` (its
list checks were rewritten by W1 for the header default and have not run), `e2e/consumers/run.sh`.

## 4. Blocked — and what the owner must provide

**Real-site validation: prepared, not run.** Every real-site result in `VALIDATION-MATRIX.md` is BLOCKED. 301 applicable
rows: (a) unit 96 · (b) simulator only 103 · (c) needs real-server validation 84 · (d) BLOCKED by definition 5 · (e) not
validatable now 13.

To run it the owner must provide (full detail: `e2e/frappe-site/README.md` §"What the owner must provide"):
1. **An isolated Frappe 15 staging site** — its name (`SFUI_STAGING_SITE` allowlist) and URL (`SFUI_STAGING_URL`); own
   database and credentials, own Redis (cache / queue / socketio) and workers, not on the shared production server; not a
   production name (`*.solvfaster.com`, `*.drooby.ai`, the deny list) and not loopback.
2. A network path from the runner to the staging URL (no tunnel to this server's loopback ports).
3. A private directory outside every git tree (mode 700, `SFUI_STAGING_PRIVATE`) holding the written approval
   `APPROVED_STAGING` (mode 600): site, url, approved_by, approved_at (≤ 30 days old), `isolated_from_production: true`,
   and `allow_write: true` for the write tests.
4. Accounts — created by `staging-seed.py --apply` (synthetic `@example.com`, random passwords written only to the private
   directory) or by the owner with the same names and roles; a System Manager account only with
   `--with-system-manager` (owner decision).
5. Optional infrastructure for the 5 manual tests (PDF engine, capture-only Email Account, background worker, socket.io
   client, a website-generator DocType).

Expected Frappe behaviours the run will confirm or refute (read from Frappe 15.110 source, not yet observed on a site):
`docs/LIMITATIONS.md` §"Frappe 15.110 server rules to know" and `VALIDATION-MATRIX.md` §7.

## 5. Open follow-ups (outside this docs step)

- **CRM workstream** — results in `CRM-MIGRATION.md` §5.1 / §5.2 (branches `crm/p36-ds` `431cf9e`, `crm/p36-needs-070` `bf46479`, `crm/p36-linkinput-review` `6310fc0`).
- **Stale line in the generated matrix:** `VALIDATION-MATRIX.md` §7 last bullet and the L-HDR-1 precondition still say the
  package's `selectionMode` default is `"bar"`. The text comes from `e2e/frappe-site/matrix/catalogue.mjs` (W4); fix it there
  and re-render.
- `reportSetValueHandler` is not exported from `@solvfast/ui/frappe/testing` (optional).
- Before a release: the full gate set (build, `check:package`, showcase build + smoke, clean consumers) on this branch.
- `docs/audit/p35/B-list.md` F16 ("default is still bar") is left as P35 history; COVERAGE §8 and CRM-MIGRATION §5.4 record
  the resolution.

## Batch 1 — integrator's final checks (2026-11-08)

**Package 0.7.0-dev.2** (`feat/0.7.x/p36-int`):

| Check | Result |
|---|---|
| typecheck | clean |
| `npx vitest run` | 1505 passed + the export regression test, 0 failed |
| `npm run build` | ✓ (styles regenerated identical) |
| `check:boundaries` (source + dist rules) | OK |
| `check:package` | OK (778 files, 921.8 kB) |
| showcase smoke | PASS, 74 sections × 4 combinations, 0 console errors |
| consumers a and b | tsc ✓, build ✓, one React copy each |
| Export snapshot (d.ts names) vs 0.6.0 | 0 removed; 227 added (core +87, frappe +136, testing +4). One declaration moved file (`FormSkeleton`). The `isCellEditable` signature break is dev.1 → dev.2 only, never released. |

These are the batch-1 results. The batch-1 `e2e/datagrid-mobile.mjs` PASS no longer applies: batch 2 reverted the DataGrid card layout (`ccb232d`) and removed that check with it.

**CRM:**
- `crm/p36-ds` `431cf9e` on 0.6.0: the full table is in `CRM-MIGRATION.md` §5.2. Bulk actions (`p33/actions-p33.mjs`) 22 / 22 en + ar.
- `crm/p36-needs-070` `bf46479` against a local 0.7.0-dev.2 pack: the results are in §5.2. Bulk actions 22 / 22 en + ar, so the per-action selection changes keep every CRM bulk action working.
- The CRM's explicit `selectionMode="header"` must stay on 0.6.0, where the default is the bar. On 0.7 it becomes redundant.

**Correction to the P35 report (Decision 5).** P35 stated that Desk 15.110 makes fields read-only on DocTypes without a Table field. That was wrong:
- `is_editable` returns the empty `read_only_depends_on` value as is (`report_view.js:772-777`, `build_row` :1330).
- frappe-datatable 1.20.4 refuses only `editable === false` (`cellmanager.js:442-449`).
- So Desk edits those fields. The P35 default was closer to Desk than the P35 report claimed.
- The default now reproduces Desk exactly; `editable="strict"` is the opt-in.

**Server rules read from Frappe source (W4), not observed.** The staging run must check them first:
- the server enforces only `reqd` (`mandatory_depends_on` is client-side);
- a permlevel write without that level returns 200 and the value is silently reset;
- Amend is checked against `create`;
- any Desk User can create global saved filters and delete other users' filters;
- `toggle_like` has no permission check;
- `export_query` writes an Access Log before refusing;
- `user_settings.save` merges shallowly (LV.A6b).
