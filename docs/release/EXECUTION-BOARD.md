# Execution board — @solvfast/ui 0.4.0 (package repository)

_Lead-maintained, package-side. From Phase 27 this file replaces updates to the live app's
`apps/serve_fast/docs/frappe-components/60-execution-board.md`, which the owner has frozen (no live-app edits, docs included).
That file's last entry is Round 24 (2026-11-03 15:28 UTC, before Phase 26)._

## Evidence classes (used everywhere in `docs/release/`)

| Class | Meaning | Where it exists today |
|---|---|---|
| **Implemented** | code exists and is exported | see `COMPONENT-COMPLETION-MATRIX.md` |
| **Tested — simulator / test doubles** | vitest against `createFixtureTransport` or stub transports | the whole suite except `tests/real/` |
| **Replayed — recorded real responses** | real Frappe 15.110 responses captured read-only on Sada (2026-11-03) and anonymous HTTP, replayed through the package | `tests/real/sada-real.test.tsx` only (16 tests, read paths) |
| **Verified — authenticated real session** | the package talking to a site as a logged-in user | **none** (no authorized session route) |
| **Verified — actual writes** | saves, imports, exports, workflow on a real site | **none** (writes not approved) |

## Phases

| Phase | Integration head | Version | What landed | Tests |
|---|---|---|---|---|
| 24 (real read-only) | `e14a080` | dev.25 | Sada recorded responses + Guest HTTP; list 403 without Retry | 799 + 16 todo |
| 26 A | `3791890` | dev.25 | completion matrix | — |
| 26 pre-work | `ddbf977` | dev.26 | `canImport` / `canExport` / `readableFields`, client `download` / `uploadFile` | 807 |
| 26 D (perm) | `95d09bf` | dev.27 | rule 9 (missing information denies), 31-test permission matrix, audit | 839 |
| 26 E/F/G (release) | `fd60256` | dev.27 | 5 todo → tests, TODO classification, artifact inspection, rc.1 checklist, CRM adoption plan | 844 + 11 todo |
| 26 C (list-io) | `d46c0b5`, `8a1c63c` | dev.28 | Export dialog (`download_template`), Data Import sequence, gated menu, permlevel columns, parity doc | 866 + 11 todo |
| 26 B (showcase) | `6fbb959` | dev.28 | Frappe-layer showcase, 10 sections, smoke 61 × 4 | 866 |
| 26 cosmetics | `c1746f4` | dev.29 | light-mode popups solid white | 866 |
| 27 E (artifact) | `b177315` | dev.30 | source maps without TypeScript source + package audit | 866 |

## Phase 27 workstreams (started 2026-11-03)

| Workstream | Owner / branch | Scope | State |
|---|---|---|---|
| A permissions | perm27 · `feat/0.4.0/p27-perm` | form without permission info, workflow with unknown roles, Administrator without role list | running |
| B list actions | actions27 · `feat/0.4.0/p27-actions` | Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk approval; Export visible like Desk; Import → Data Import list | running |
| B list query | query27 · `feat/0.4.0/p27-query` | width-based column cap, nested-set filters, URL filters, report-view export | running |
| C import | import27 · `feat/0.4.0/p27-import` | import preview + column mapping, server-confirmed completion | running |
| D simulator | sim27 · `feat/0.4.0/p27-sim` | explicit permission scenarios, showcase role-limited documents | running |
| E artifact | Lead | maps without source (done `b177315`), final pack + inspection | in progress |
| F docs | Lead | matrix, parity, audit, checklist, adoption plan, this board | in progress |

Operational blockers carried over unchanged: no authenticated real-site route; no restricted test user (none may be created);
D-06 CRM DocTypes not created; D-25 boot not deployed; no build window; backups unverified and backup cron failing.
