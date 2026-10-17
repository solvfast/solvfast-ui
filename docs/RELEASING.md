# Releasing @solvfast/ui

The owner publishes. Nothing in this repository pushes, tags or publishes on its own. `npm publish` runs
`prepublishOnly` (`scripts/prepublish-check.mjs`, then a full build and the tests), which refuses unless the working
tree is clean, `HEAD` is tagged `v<version>`, and LICENSE states a decided licence.

## Checklist — 0.1.0-rc.1 (2026-10-17)

| # | Item | Status |
|---|---|---|
| 1 | Build: JS (ESM, one module per source), `.d.ts`, styles, preset | ✅ `npm run build` |
| 2 | Exports: every `exports` entry exists; JS entries have types | ✅ `npm run check:package` (part of the build) |
| 3 | Dependencies: every import in `dist/` is declared; no unused dependency; types don't reach undeclared packages | ✅ `check:package` — it caught `@tanstack/query-core` in the Frappe types, fixed |
| 4 | Core never imports Frappe / React Query / the network; the Frappe entry never imports the shell | ✅ `check:boundaries` (source and built files) |
| 5 | Type check (strict), unit tests | ✅ `npm run typecheck`, `npm test` |
| 6 | Clean installs from the tarball: Tailwind app (path A) and no-Tailwind app (path B), incl. `@solvfast/ui/frappe` — strict `tsc`, build, one React, one React Query | ✅ `e2e/consumers/run.sh` |
| 7 | Visual and behaviour regressions against Sear; path A vs path B | ✅ primitives 51+1/52, shell 30/44 and list 32/44 (the rest intended), phones, grouped columns, motion, Frappe demo 32/32; A vs B in the documented families (docs/VALIDATION.md, 5.5) |
| 8 | Tarball: only `dist/`, README, LICENSE, CHANGELOG, VENDORED, user docs; no absolute local paths; no secrets | ✅ `check:package` + review of `npm pack --dry-run` |
| 9 | Docs: README, CONSUMING, FRAPPE, FEATURES, LIMITATIONS, CHANGELOG, VENDORED, VALIDATION | ✅ |
| 10 | Frappe layer against simulated requests | ✅ passed |
| 11 | Frappe layer against a real site | ⏸ **deferred, not done** — at first integration into a real project (docs/FRAPPE.md) |
| 12 | Licence | ⛔ **not decided** (intended copyright holder: Solvfast) — blocks publishing. Third-party notices (shadcn/ui, MIT) are in THIRD-PARTY-NOTICES.md whatever is chosen |
| 12a | Provenance of the glass engine CSS (`styles/glass.css`, part of `theme.css` / `full.css`): the Design System calls it a "vendored Glass DS"; its files name no author, source or licence | ⛔ **owner to confirm** it is Solvfast's own work — or, if third-party, add its licence/notice to THIRD-PARTY-NOTICES.md |
| 12b | Ownership of the code derived from the Design System, Sear and PMO (all Solvfast projects; the Design System's repository is under a personal GitHub account) | ⛔ owner to confirm it belongs to Solvfast |
| 13 | GitHub repository: the owner reports one exists for `@solvfast/ui` (URL not yet known here); `package.json` `repository` (`solvfast/solvfast-ui`) is an assumption until confirmed; push this repo | ⛔ owner |
| 14 | Version and tag: `0.1.0-rc.1` now; the owner tags (`git tag v<version>`) on a clean tree | ⛔ owner's approval |
| 15 | Dependency ranges: exact pins (the tested set) or `^` ranges (fewer duplicate copies in apps) | ❓ owner's decision |
| 16 | Publish to GitHub Packages (`publishConfig.registry`), e.g. `npm publish --tag next` for a release candidate | ⛔ owner |

## Owner's steps (when ready)

1. Decide the licence; put its text and the copyright holder in LICENSE and its identifier in `package.json` `license`
   (keep THIRD-PARTY-NOTICES.md), commit.
2. Decide items 15 and the version (`0.1.0-rc.1`, or `0.1.0`); update `package.json` and CHANGELOG if it changes.
3. `git tag v<version>` on the clean commit; push the repository and the tag.
4. With your own token (`write:packages`, never committed): `npm publish` (add `--tag next` for a release
   candidate so it doesn't become `latest`).
