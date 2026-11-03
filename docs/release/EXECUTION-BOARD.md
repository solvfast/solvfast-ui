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
| 27 B query | `7c044f4`, `51a4440` | dev.31 | nested-set operators, width cap, URL filters, report-view export | 900 |
| 27 A perm + B actions + C import | `aaeabac`, `b33c11e`, `fa73dee` | dev.32 | form/workflow/Administrator permission fixes; Desk's Actions menu; Export for everyone; Import → Data Import list; `FrappeDataImport` (preview + mapping); Lead wiring (width cap default on, report export entry) | 1023 |
| 27 D sim | `556b8d4` | dev.33 | simulator permission evaluation + seven scenarios; handlers for the new methods; showcase role-limited documents; simulated files without counts | 1066 + 11 todo |

## Phase 27 workstreams (2026-11-03) — all merged into `feat/0.4.0-frappe`

| Workstream | Owner / branch (head) | Result | Evidence class |
|---|---|---|---|
| A permissions | perm27 · `feat/0.4.0/p27-perm` (`15bc165`) | P2-1, P2-3, P2-4, P3-1, P3-6 closed; 60 tests | test doubles; Administrator replayed from recorded real responses |
| B list actions | actions27 · `feat/0.4.0/p27-actions` (`983aec5`) | Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk; Export for everyone; Import → Data Import list; 26 tests | test doubles |
| B list query | query27 · `feat/0.4.0/p27-query` (`6025c15`) | width cap, nested-set operators, URL filters, report-view export; 34 tests | test doubles |
| C import | import27 · `feat/0.4.0/p27-import` (`35718ca`) | `FrappeDataImport`: preview, column mapping, server-confirmed result; 30 tests | test doubles |
| D simulator | sim27 · `feat/0.4.0/p27-sim` (`5c4c396`) | server-side permission evaluation, seven scenarios, showcase; 43 tests | simulator |
| E artifact | Lead (`b177315`, final pack at `556b8d4`) | maps without source; dev.33 tarball inspected | local pack only |
| F docs | Lead | matrix, parity, audit, checklist, adoption plan, this board | — |

Nothing in Phase 27 is verified against an authenticated real session or with actual writes.

Operational blockers carried over unchanged: no authenticated real-site route; no restricted test user (none may be created);
D-06 CRM DocTypes not created; D-25 boot not deployed; no build window; backups unverified and backup cron failing.
