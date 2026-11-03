# Release checklist — `@solvfast/ui@0.4.0-rc.1` → GitHub Packages, dist-tag `next` (D-30)

Phase 26 F, 2026-11-03, prepared in worktree `p26-release` from `ddbf977` (0.4.0-dev.26) + `46d0c78` (tests).
Supersedes the checklist part (§3) of `docs/RELEASE-0.4.0.md` (dev.23); the artifact numbers are in
`docs/release/ARTIFACT-INSPECTION.md`.

**Nothing is published until the owner approves four things explicitly: the artifact (§2 item 8), the version
string `0.4.0-rc.1`, the registry (GitHub Packages, private) and the dist-tag `next`.** No tag, push or publish was
made in this phase. **Status refreshed by the Lead at `0.4.0-dev.29` after merging list-io, perm and showcase.** Status words: **DONE (evidence)** · **PENDING — owner** · **PENDING — agent <name>** ·
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
| 2 | Critical components implemented | **PARTIAL — PENDING owner acceptance** | Implemented: client, errors, provider, boot, hooks + cache rules, permissions (partial), formats, translations, realtime skeleton, simulator, `FrappeListView`, reportview, list meta/query/settings/storage, bulk (partial), `FrappeForm`/fields/link/child table, behaviour engine, workflow, assign (partial), timeline, status (matrix rows 1–35). **MISSING: Import (row 23) and Export (row 22)**; PARTIAL: permissions row 7 (optimistic new doc without `session.roles` — Phase 26 rule 9), realtime row 13, bulk row 21, assign row 33. The owner decides whether an rc may ship without Import/Export |
| 3 | ListView parity reviewed | **DONE — verdict: NOT Frappe-compatible yet** | `docs/release/LISTVIEW-FRAPPE-PARITY.md` (list-io, merged dev.28). Missing: import preview grid / column mapper / log table, Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk approval, width-based column cap, nested-set and URL filters, Report-view export. Owner decides whether rc.1 ships with these documented gaps. |
| 4 | Import / Export parity reviewed | **DONE (simulated) — PENDING owner acceptance** | Same document §Import/§Export. Desk's exact server requests reproduced and tested against stubs (`tests/list-io.test.tsx`, 22). **Never run on a site** (Import = writes; Export = an unapproved read). Departures: Export hidden without the right (Desk shows it to all); default Import route; no preview/mapper UI. |
| 5 | Permission tests passed | **DONE (simulated)** | `docs/release/PERMISSION-AUDIT.md`; `tests/parity/permissions-matrix.test.tsx` 31 tests (six brief scenarios × six rights, missing info, 403s, revocation, direct invocation, bulk mixed, permlevel, User Permissions, sharing, Administrator). P1-1/P1-2 fixed (rule 9). Open: P2-1 standalone `FrappeFormView` without `permissions` assumes all rights; P2-3 workflow transitions without roles; P2-4 `canImport/canExport` for user Administrator without roles. **Real-server verification BLOCKED** (no restricted test user; none may be created). |
| 6 | Known limitations documented | **DONE** | `docs/LIMITATIONS.md` retitled 0.4.0 with a Frappe-layer status section (commit `6710a8a`); component docs `docs/components/*.md` ship in the tarball. |
| 7 | Package tests passed | **DONE** | `npx tsc --noEmit`: clean · `npx vitest run`: **812 passed / 11 todo / 0 failed** (37 files) · `npm run build` (incl. boundaries + package audit): OK · `check:boundaries` OK · `check:package` OK — exact outputs in `ARTIFACT-INSPECTION.md` §1. The 11 todos are classified in `TODO-TESTS-CLASSIFICATION.md` (0 required before RC, 0 bugs) |
| 8 | Artifact inspected | **DONE at dev.29 — PENDING owner approval of the artifact** | `solvfast-ui-0.4.0-dev.29.tgz`: 537 entries, 866,570 B packed, 3,116,621 B unpacked, shasum `7b22fba8362723a86ee185c9fc1f3499b494b66c`; no tests/src/playground/showcase/e2e/scripts/tools/upstream/.npmrc; secrets/absolute-path grep: 0 hits. Re-pack on the rc.1 commit (the version string changes every hash). |
| 9 | No secrets | **DONE** | `docs/qa/secret-audit.md` (re-run 2026-11-03: no credential/token/key/password in either repository's history; findings P1–P6 are env references, e-mails and the already-public commit identity) + this phase's grep over the unpacked tarball: one `${NODE_AUTH_TOKEN}` env reference in `docs/CONSUMING.md`, nothing else (`ARTIFACT-INSPECTION.md` §2.7). `prepublish-check.mjs` re-scans tracked files at publish time |
| 10 | Source maps reviewed | **DONE — PENDING owner decision** | dev.29: 169 maps, 163 carry TypeScript source text. Options: A keep · B `sourcemapExcludeSources: true` in `vite.lib.config.ts` · C no maps. |
| 11 | Demo showcase working | **DONE (simulated)** | `showcase/` "Frappe layer" group, 10 sections, every one labelled SIMULATED; `e2e/showcase-smoke.mjs` PASS: 61 sections × light/dark × en/ar + phone width + 38 interactive checks, 0 page/console errors (agent showcase, on the merged dev.28 tree; dev.29 adds only the CHANGELOG and version). Light-mode popups solid white confirmed in-browser. |
| 12 | No live changes | **DONE (this phase)** | This phase wrote only inside `/home/frappe/sfui-dev/p26-release` (and the session scratchpad). The shared bench (`/home/frappe/lovable_bench`), the live `apps/serve_fast`, the Frappe source and the Sada site were **read only**; no `bench`, database, migration, build window or network install. For the earlier rounds the Lead's re-hash of `apps/serve_fast` against the baseline (0 diffs) is recorded in `docs/frappe-components/61` §1 and `60` |
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
