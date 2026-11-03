# Release checklist — `@solvfast/ui@0.4.0-rc.1` → GitHub Packages, dist-tag `next` (D-30)

Phase 26 F, 2026-11-03, prepared in worktree `p26-release` from `ddbf977` (0.4.0-dev.26) + `46d0c78` (tests).
Supersedes the checklist part (§3) of `docs/RELEASE-0.4.0.md` (dev.23); the artifact numbers are in
`docs/release/ARTIFACT-INSPECTION.md`.

**Nothing is published until the owner approves four things explicitly: the artifact (§2 item 8), the version
string `0.4.0-rc.1`, the registry (GitHub Packages, private) and the dist-tag `next`.** No tag, push or publish was
made in this phase. **Status refreshed by the Lead at `0.4.0-dev.33` (Phase 27).** Status words: **DONE (evidence)** · **PENDING — owner** · **PENDING — agent <name>** ·
**PENDING — Lead**.

## 1. What this release is

- A **release candidate** of the Frappe-integrated package, offered to consumers under `next`; `latest` stays
  `0.3.0`. Nothing in it is production ready: `COMPONENT-COMPLETION-MATRIX.md` counts **0 of 46 units** production
  ready, Import/Export MISSING, and real-Frappe evidence limited to read paths on Sada
  (`docs/frappe-components/62`). The release notes must say so (§4).
- Consumers opt in with `npm install @solvfast/ui@next` (or `@0.4.0-rc.1`); fixes ship as `rc.2`, …, then `0.4.0`.

## 2. Checklist

| # | Item | Status | Evidence / what is missing |
|---|---|---|---|
| 1 | Component inventory reviewed | **DONE** | `docs/release/COMPONENT-COMPLETION-MATRIX.md` (46 units, status per unit, real/simulated columns, 0 production ready; corrections in `ddbf977`) |
| 2 | Critical components implemented | **DONE (simulated) — PENDING owner acceptance** | dev.33: 40 / 46 units implemented, 4 partial (realtime skeleton; Print background completion needs a host task subscriber; some fieldtypes; assignment close/group), 2 n/a. Import, Export, report export, Desk's Actions menu, width cap, nested-set and URL filters added in Phase 27. Evidence class: tested with stubs / the simulator; read paths replayed from recorded real responses; **no authenticated real session, no writes**. |
| 3 | ListView parity reviewed | **DONE — verdict: NOT declared Frappe-compatible** | `LISTVIEW-FRAPPE-PARITY.md` §5 (dev.32): release-relevant Desk behaviours implemented with Desk's request shapes; compatibility not claimed because no behaviour ran against a real session; remaining differences listed (actions as bar buttons, Print background, URL-filter write-back, group-by sidebar, views). |
| 4 | Import / Export parity reviewed | **DONE (simulated) — live BLOCKED** | Export offered to everyone as Desk (owner decision 3), the server's refusal shown; report-view export gated like Desk's report view; Import → Data Import list (decision 4); `FrappeDataImport` with preview + column mapping and server-confirmed completion (decision 5). `tests/list-io` 33, `import-ui` 30, `list-query` 34. Real site: BLOCKED (writes; Access Log; unapproved read). |
| 5 | Permission tests passed | **DONE (simulated + 1 replayed case)** | `PERMISSION-AUDIT.md` §3, §6, §7: P1-1, P1-2 (dev.27) and P2-1, P2-3, P2-4, P3-1, P3-6 (dev.32) closed; `permissions-matrix` 31 + `permissions-p27` 60 + `sim-permissions` 43 tests; Administrator behaviour replayed from recorded real responses. **No restricted real user exists or may be created: real-server permission verification is BLOCKED.** Open: P2-2 (bulk delete cannot list failures — the server answers nothing), P2-5 (documented). |
| 6 | Known limitations documented | **DONE** | `docs/LIMITATIONS.md` retitled 0.4.0 with a Frappe-layer status section (commit `6710a8a`); component docs `docs/components/*.md` ship in the tarball. |
| 7 | Package tests passed | **DONE at dev.33** | `tsc --noEmit` clean · `vitest run` **1066 passed / 11 todo / 0 failed** (44 files) · `npm run build` with `check:boundaries` and `check:package` OK · showcase smoke PASS (61 sections × light/dark × en/ar + interactions + phone) on the merged head. |
| 8 | Artifact inspected | **DONE at dev.33 — PENDING owner approval** | `solvfast-ui-0.4.0-dev.33.tgz`: 573 entries, 646,955 B packed, 2,442,461 B unpacked; SHA-256 `0ded63130a9a57df368a7cde647fc6c2a4a96d26ee70b0c2520dc6b522892ff7`; 13 exports, all targets present; no repo-only folders; 0 secret / local-path / Sada-fixture hits. Re-pack on the rc.1 commit (every hash changes with the version). |
| 9 | No secrets | **DONE** | `docs/qa/secret-audit.md` (re-run 2026-11-03: no credential/token/key/password in either repository's history; findings P1–P6 are env references, e-mails and the already-public commit identity) + this phase's grep over the unpacked tarball: one `${NODE_AUTH_TOKEN}` env reference in `docs/CONSUMING.md`, nothing else (`ARTIFACT-INSPECTION.md` §2.7). `prepublish-check.mjs` re-scans tracked files at publish time |
| 10 | Source maps reviewed | **DONE (owner decision 2 applied)** | `sourcemapExcludeSources: true` (`b177315`); dev.33: 181 maps, 0 with `sourcesContent`, 0 absolute paths; `check:package` fails the build if a map embeds source (negative test run). |
| 11 | Demo showcase working | **DONE (simulated)** | Frappe-layer sections incl. the seven simulator permission scenarios (decision 8), Import with `FrappeDataImport`, Export for everyone, Desk's Actions; every scenario labelled SIMULATED; the simulated export file carries labels + the request only (decision 6). Smoke PASS on `556b8d4`. |
| 12 | No live changes | **DONE (Phases 26–27)** | Package worktrees and the session scratchpad only; live `apps/serve_fast` and its docs untouched since 15:28 UTC (before Phase 26); no bench command, database write, user, credential, migration, build on the bench, push, tag or publish. |
| 13 | CHANGELOG `[0.4.0-rc.1]` | **PENDING — Lead** | `CHANGELOG.md` still has `[Unreleased]`. Move it to `## [0.4.0-rc.1] — <date>`; include the two 0.3.0 erratum commits (`66af191`, `63bbd1b`), the breaking-type notes and the four behaviour changes drafted in `RELEASE-0.4.0.md` §3.2, plus Phase 26 items (`canImport`/`canExport`/`readableFields`, `allow_import`, download/upload primitives, matrix) |
| 14 | `docs/FRAPPE.md` CSRF advice | **DONE** | `docs/FRAPPE.md:29` now says "**Do not** use `{{ frappe.session.csrf_token }}`" and points to `frappe.sessions.get_csrf_token()` / `readFrappeBoot` (finding 3 of `RELEASE-0.4.0.md` resolved) |
| 15 | Version bump | **PENDING — owner (go) + Lead (edit)** | see §3 |
| 16 | Tag `v0.4.0-rc.1` | **PENDING — owner** | only after items 2–6, 8, 10, 11, 13 are accepted; `prepublish-check.mjs` refuses to publish without the tag on HEAD |
| 17 | `latest`-protection guard | **PENDING — Lead (optional)** | `RELEASE-0.4.0.md` §3.1 suggested refusing a pre-release version when `npm_config_tag` is `latest`; `scripts/prepublish-check.mjs` has **no such guard** today. Without it, forgetting `--tag next` would move `latest` to the rc |
| 18 | Published package checked | **PENDING — owner (after publish)** | `npm view @solvfast/ui@0.4.0-rc.1 version dist.tarball`; `npm dist-tag ls @solvfast/ui` → `latest: 0.3.0`, `next: 0.4.0-rc.1`; package stays **Private**, access inherited from `solvfast/solvfast-ui` |

## 3. Version bump: `0.4.0-dev.N` → `0.4.0-rc.1` (no tag until approval)

On the integration branch, from a clean tree, by the Lead when the owner says go:

1. `npm version 0.4.0-rc.1 --no-git-tag-version` — offline; updates `package.json` and `package-lock.json` only. The
   flag is load-bearing: plain `npm version` would commit **and tag**, which "no tag until approval" rules out. (Do not
   use `npm install --package-lock-only`: it may contact the registry.)
2. `CHANGELOG.md`: `[Unreleased]` → `## [0.4.0-rc.1] — <date>` (item 13).
3. `docs/LIMITATIONS.md` title and Frappe section (item 6); `docs/RELEASING.md` status table row for 0.4.0-rc.1.
4. `npm run typecheck && npm run build && npm test && npm pack --dry-run` — compare with `ARTIFACT-INSPECTION.md`
   (only version-derived numbers may differ, plus the items decided in 6/10/13).
5. Commit: `release: 0.4.0-rc.1` with the `Co-Authored-By` trailer. **No tag in this step.**
6. Owner reviews the commit and the dry-run listing → approves → **owner** creates `git tag v0.4.0-rc.1` on that commit.

## 4. Release notes must state (status, honestly)

- Verified against real Frappe: **read paths only** (metadata, list rows/count, search_link, validate_link, getdoc +
  docinfo, permissions for two full-rights users, 403/417 envelopes) on Sada 15.110, from recorded responses and Guest
  HTTP — `tests/real/sada-real.test.tsx` (16) and `docs/frappe-components/62`.
- Not verified: every write (save, submit, cancel, delete, rename, assign, comment, workflow), authenticated sessions,
  permission-limited users, realtime over a socket, uploads, the boot (D-25 not deployed).
- Missing: Import, Export. Partial: permissions (rule 9), bulk actions, assignment, realtime.
- Everything else is "Simulated & tested" (`createFixtureTransport`, `@solvfast/ui/frappe/testing`) — never evidence
  of Frappe behaviour.

## 5. The exact commands the OWNER runs — only after approving artifact, version, registry and tag

```sh
cd /home/frappe/solvfast-ui                       # the canonical repository, clean checkout of the release commit
git status                                        # must be clean
npm ci && npm run typecheck && npm run build && npm test
npm pack --dry-run                                # review against docs/release/ARTIFACT-INSPECTION.md
git tag v0.4.0-rc.1                               # owner only, on the approved commit
node scripts/prepublish-check.mjs                 # must print: ✔ ready to publish @solvfast/ui@0.4.0-rc.1
git push origin feat/0.4.0-frappe                 # or main after the merge the owner chooses
git push origin v0.4.0-rc.1
export NODE_AUTH_TOKEN=<classic token with write:packages>   # this shell only; never in a file
npm publish --tag next                            # prepublishOnly re-runs the guard, the build and the tests
npm dist-tag ls @solvfast/ui                      # expect  latest: 0.3.0   next: 0.4.0-rc.1
npm view @solvfast/ui@0.4.0-rc.1 version dist.tarball
```

`publishConfig.registry` = `https://npm.pkg.github.com`, so the command cannot reach public npm; the committed
`.npmrc` maps `@solvfast` to GitHub Packages and reads `${NODE_AUTH_TOKEN}`. **Without `--tag next` npm would move
`latest` to the rc** (item 17). Until the owner runs these lines, nothing exists on any registry.
