# 0.8.x integration — record (2026-11-12)

Branch `feat/0.8.x/integration` (worktree `/home/frappe/sfui-dev/p08-integration`), local only: not pushed, not tagged,
not published. Version **0.8.0-dev.1**. Owner-approved plan "Option C".

## 1. What was merged

| Step | Commit | Content |
|---|---|---|
| Base | `7dbc774` (tag `v0.7.0`) | The released 0.7.0: dev.6 + dev.7 (Sayr Appearance, first day of the week) + the release commit (group-by fixes in `FrappeGroupBySidebar` / `useGroupByCounts` / `query.ts`). |
| Merge 1 | `12729e7` | `feat/0.7.x/families` at **`e26ab97`** (cutoff = its tip on 2026-11-12; no owner session was reachable — `solvfast-ui-c9` confirmed it is not the owner and the tip). dev.8 → dev.22 (families, FieldDesigner, `@solvfast/ui/sayr`, SayrRecordPage / SayrNewRecordPage, assignee avatars, …). Conflicts: CHANGELOG (families entries under a 0.8.0-dev.1 heading, above 0.7.0; families' "0.7.0-dev.7" heading dropped — 0.7.0 renamed that section), package.json / package-lock.json (0.8.0-dev.1). |
| Merge 2 | `72925c2` | `feat/0.7.x/p0-record-rail` at `755895d`: RecordRail, `FrappeWorkflowActions variant="rail"`, `FrappeFormView aside`. Conflicts: CHANGELOG (P0 notes inside 0.8.0-dev.1); `FrappeFormView.tsx` — families' `unsaved` (`doc.__unsaved \|\| alsoSave.dirty`) is the live context's `dirty`, and `menu` and `aside` share that one context (`liveCtx`); `record/index.ts` and `messages-ws/index.ts` — both sides' exports / message blocks. `LifecycleRail.tsx` was the same change on both sides (no conflict). |
| Rename | `59c9d61` | `@solvfast/ui/sayr`: `SayrRailCardId`; `RecordRailCard` kept there as a deprecated alias (the core `RecordRailCard` is the CRM rail's card component). |

Nothing was lost: 0.7.0's fix, every families commit to the cutoff and every P0 commit are ancestors of the result.
The source branches, their worktrees and every other branch are untouched. `origin/main` (`c20e8f4`, families dev.15)
is an ancestor, so it can fast-forward to this line when the owner decides to push.

Later families commits (after `e26ab97`) merge forward with an ordinary merge.

### Orphan dev.21 build — archived

`eb3b714` (2026-11-11 23:23) is the first build of "0.7.0-dev.21"; `722a981` (23:31, on families) replaced it. Same
parent (`7fc7822`). The only differences: `railOrder` placed an app's extra rail cards **after SLA** in `eb3b714` and
**after Playbook** in `722a981` (`src/sayr/rail.tsx`), with the matching comment, doc (`family.md`), CHANGELOG line and
test (`RP.cards.5`). A tarball of `eb3b714` was vendored at some point (yarn cache). Preserved as branch
`archive/dev.21-eb3b714`; not merged (superseded).

## 2. Gates (independent `npm ci` in this worktree; node 20.20.2, npm 10.8.2)

| Commit | typecheck | boundaries | tests | build | package |
|---|---|---|---|---|---|
| `7dbc774` v0.7.0 (reference) | 0 errors | OK | 99 files, 1,869 passed | OK | OK |
| `12729e7` + families | 0 errors | OK | 102 files, 1,928 passed | OK | OK |
| `72925c2` + P0 | 0 errors | OK | 105 files, 1,964 passed | OK | OK |
| `59c9d61` + rename | 0 errors | OK | 106 files, 1,966 passed | OK | OK |

(10 todo in every run. The boundary check reads `dist/`, so it runs after the build.)

## 3. Artifact

`solvfast-ui-0.8.0-dev.1.tgz` from `59c9d61`: **1,346,991 bytes, sha1 `df6989c45022f403b1c12e38d42fa5b3411a79ea`**,
1,067 files. Reproducible: a second build from a fresh clone with its own `npm ci` produced a byte-identical tarball
(same sha1 / sha512). Stored as `/home/frappe/sfui-dev/drops/solvfast-ui-0.8.0-dev.1-59c9d61.tgz` with its manifest.
`docs/audit/` is not in the package, so this record does not change the tarball.

## 4. CRM regression (without touching the live dev site)

A lab copy of `apps/serve_fast/frontend` (same sources, the live `node_modules` symlinked, `@solvfast/ui` swapped) was
built with the app's own Vite config and served locally the way Frappe serves it (`/serve-fast/*` → `index.html`,
`/assets/serve_fast/serve-fast/*` → the build; anything else read-only from the live site).

- **Harness check:** the lab built with the live package (`0.7.0-dev.6-786327a`) matched the live baseline captures
  (76 / 76 rail cards, pages identical) — so lab differences are package differences.
- **0.8.0-dev.1, visual:** the rail of Deal 1 (12 theme × language × width combinations) and Lead 8, Deal 6, Contact 1,
  Organization 1, Ticket TKT-1041 (4 combinations): **368 / 368 cards identical** (computed styles, size, position,
  pixels) and every full page identical.
- **Open states** (Customize, assign picker, attach dialog, article reader, organization picker): identical layout
  (positions equal to the quarter pixel); while a popover is open, 65 / 69 pixels differ on digit edges at half-pixel
  positions in the main column (deterministic per build; rasterisation). The attach dialog and organization picker are
  not stable between runs of the *same* build, so they are not evidence either way.
- **0.8.0-dev.1, functional:** rail checks 91 / 91, Lifecycle interactions 132 / 132, `e2e/ds-assign-attach.cjs`
  134 / 134, `e2e/tickets-frappe-fields.mjs` 116 / 116, route sweep (19 routes × 2) 38 / 38 with no errors, no API
  calls, no overflow.
- **App typecheck:** the same 29 pre-existing errors (unrelated pages) with either package; none new.
- **Sayr consumers** (copies of `/home/hussein/sear-bench/apps/{sear_product,servefast_framework}/frontend`, apps not
  touched): `servefast_framework` 0 errors with dev.22 and with 0.8.0-dev.1 (it uses `RecordRailExtraCard`);
  `sear_product` the same 18 pre-existing errors with both.

Not run: a real Frappe site; Sayr's own browser checks.

## 5. The live CRM dev site (unchanged)

`internal.solvfaster.com/serve-fast` runs `vendor/solvfast-ui-0.7.0-dev.6-786327a.tgz`: **dev.6 + the P0 RecordRail
commits — not the published 0.7.0-dev.6**, although its package.json says 0.7.0-dev.6. It must **not** be replaced by
the registry's 0.7.0-dev.6: eight app files import RecordRail symbols that exist only in this tarball and in
0.8.0-dev.1. It is to be replaced only by the validated 0.8.0-dev.1 artifact (§3), with the owner's go-ahead, following
the staged procedure: atomic swap keeping the old folder → app typecheck + `vite build` to a scratch folder → only then
`bench build --app serve_fast` → regression → rollback = the previous tarball, lock entry and `vendor/p0-rollback/`.

## 6. Open

- Publishing (dist-tag `next`, never `latest`), tagging and pushing: not done; need the owner's approval and a registry
  token on this server (the registry answers 401 here).
- families commits after `e26ab97`: none so far; merge forward when they appear.
