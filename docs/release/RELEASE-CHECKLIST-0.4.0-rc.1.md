# Release checklist — `@solvfast/ui@0.4.0-rc.1` → GitHub Packages, dist-tag `next` (D-30)

Phase 26 F, 2026-11-03, prepared in worktree `p26-release` from `ddbf977` (0.4.0-dev.26) + `46d0c78` (tests).
Supersedes the checklist part (§3) of `docs/RELEASE-0.4.0.md` (dev.23); the artifact numbers are in
`docs/release/ARTIFACT-INSPECTION.md`.

**Nothing is published until the owner approves four things explicitly: the artifact (§2 item 8), the version
string `0.4.0-rc.1`, the registry (GitHub Packages, private) and the dist-tag `next`.** No tag, push or publish was
made in this phase. Status words: **DONE (evidence)** · **PENDING — owner** · **PENDING — agent <name>** ·
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
| 3 | ListView parity reviewed | **PENDING — agent list-io** | `docs/release/LISTVIEW-FRAPPE-PARITY.md` (being written). Until it lands: matrix row 15 lists the known gaps (no Import/Export menu, no width-based column cap, no 90-day recency filter, permlevel columns) |
| 4 | Import / Export parity reviewed | **PENDING — agent list-io** | same document; today nothing is implemented beyond the pre-work primitives (`canImport`, `canExport`, `readableFields`, `allow_import`, `download`/`uploadFile`, `ddbf977`) |
| 5 | Permission tests passed | **PENDING — agent perm** | `docs/release/PERMISSION-AUDIT.md` (being written). Existing evidence: `parity/display-status` 38 tests, `usePermissions` agrees with the server's `get_doc_permissions` for the two (full-rights) Sada role holders — weak (`62` §1); rule 9 change not yet made |
| 6 | Known limitations documented | **PENDING — Lead** | `docs/LIMITATIONS.md` (shipped in the tarball) is still titled **"0.3.0"** and its "Frappe layer" section predates 0.4.0. Needs the 0.4.0 limitations: matrix "Remaining limitations" column, the 3-part currency `options` (TODO classification F1), RTL minus (F2), no `__messages` from `getdoctype` (F4), Import/Export missing, realtime full-reload, permissions rule 9 |
| 7 | Package tests passed | **DONE** | `npx tsc --noEmit`: clean · `npx vitest run`: **812 passed / 11 todo / 0 failed** (37 files) · `npm run build` (incl. boundaries + package audit): OK · `check:boundaries` OK · `check:package` OK — exact outputs in `ARTIFACT-INSPECTION.md` §1. The 11 todos are classified in `TODO-TESTS-CLASSIFICATION.md` (0 required before RC, 0 bugs) |
| 8 | Artifact inspected | **DONE — PENDING owner approval of the artifact** | `ARTIFACT-INSPECTION.md`: 528 entries, 833,888 B packed, every `exports` target present, `files` allow-list exact, repository-only folders and `tests/fixtures` absent, dependencies = imports. **Re-run on the rc.1 commit** (numbers change with the version string) |
| 9 | No secrets | **DONE** | `docs/qa/secret-audit.md` (re-run 2026-11-03: no credential/token/key/password in either repository's history; findings P1–P6 are env references, e-mails and the already-public commit identity) + this phase's grep over the unpacked tarball: one `${NODE_AUTH_TOKEN}` env reference in `docs/CONSUMING.md`, nothing else (`ARTIFACT-INSPECTION.md` §2.7). `prepublish-check.mjs` re-scans tracked files at publish time |
| 10 | Source maps reviewed | **DONE — PENDING owner decision** | 166 maps, 160 with source text (993,593 chars of TypeScript, 1.5 MB unpacked), relative paths only. Options A keep / B `sourcemapExcludeSources: true` / C no maps (`ARTIFACT-INSPECTION.md` §2.4). Decide before the rc build |
| 11 | Demo showcase working | **PENDING — agent showcase** | `npm run showcase:build` not run in this phase. Finding from the playground e2e (SIMULATED): the `?demo=error` state no longer shows an error because `FrappeDemo.tsx:27` arms the failure on `frappe.client.get_list` while the list now calls `frappe.desk.reportview.get` — 4 of 32 `frappe-review.mjs` states fail for that reason; the other 28 pass |
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
