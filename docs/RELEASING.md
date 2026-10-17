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
| 7 | Visual and behaviour regressions against Sear; path A vs path B | ✅ primitives 48+4/52 (the 4 at 1/255; reference: Sear's SegmentedTabs and glassy dialog), tab strips 36/36, number cards 18/20 (2 = run-to-run noise), shell 30/44 and list 32/44 (the rest intended), phones, grouped columns, motion, Frappe demo 32/32; A vs B in the documented families (docs/VALIDATION.md, 5.5) |
| 8 | Tarball: only `dist/`, README, LICENSE, CHANGELOG, VENDORED, user docs; no absolute local paths; no secrets | ✅ `check:package` + review of `npm pack --dry-run` |
| 9 | Docs: README, CONSUMING, FRAPPE, FEATURES, LIMITATIONS, CHANGELOG, VENDORED, VALIDATION | ✅ |
| 10 | Frappe layer against simulated requests | ✅ passed |
| 11 | Frappe layer against a real site | ⏸ **deferred, not done** — at first integration into a real project (docs/FRAPPE.md) |
| 12 | Licence | ⛔ **not decided** (intended copyright holder: Solvfast) — blocks publishing. The one decision: who may use the package — only Solvfast (a proprietary licence: `"license": "UNLICENSED"` and "Copyright (c) 2026 Solvfast. All rights reserved." in LICENSE) or anyone (an open-source licence such as MIT or Apache-2.0). Keep THIRD-PARTY-NOTICES.md either way. Only possible once 12a and 12b are settled: a licence can only be granted by whoever holds the rights |
| 12a | Glass engine CSS (DS `styles/glass-ds/{tokens,engine}.css`; in `styles/glass.css`, `theme.css`, `full.css`) | ⛔ **owner to confirm who wrote it.** What the files show: headed "GLASS DS", they carry the SOLV FAST brand colours and a `senaiy` theme, but no author, source or licence; they entered the DS in a "BildFast sync" commit by the BildFast bot (2026-08-18). If it was written for Solvfast it falls under 12b; if it came from elsewhere, its source and licence are needed |
| 12b | Rights to the code the package is built from — nearly all of it is derived from the Design System, Sear Studio and PMO (VENDORED.md) | ⛔ **owner to confirm.** What the repositories show (2026-10-17, read locally): the DS repository is `github.com/AbdulrahmanCE/design_system` and Sear's is `github.com/zmohamed-del/sear_product`, both personal accounts; PMO here is not a git repository. Their commits are by `IsmailAkram200 <Ismailakram200@gmail.com>` and `BildFast Bot <bot@solvfast.com>`. Each app's `license.txt` contains only the words "MIT License" (no copyright holder, no terms), so it grants nothing to rely on; `app_publisher = "Solvfast"` in hooks.py is scaffold metadata. **Needed:** confirmation that the people behind these accounts wrote this code for Solvfast (employment or contract), or their permission to use it in the package |
| 13 | GitHub repository: **https://github.com/solvfast/solvfast-ui** (confirmed by the owner, 2026-10-17); `package.json` `repository` already points there, and the `@solvfast` scope matches the org, as GitHub Packages requires. Private (anonymous requests get 404). This local repository has no remote yet: the owner adds it and pushes. Pushing the repository (not the package) also ships `upstream/` — verbatim copies of DS, Sear and PMO files (same question as 12b) and Frappe's `todo.json` (MIT, © Frappe Technologies, whose notice must go with it) | ⛔ owner (push) |
| 14 | Version and tag: `package.json` still says `0.1.0-rc.1`; HEAD is not the rc.1 tree recorded in docs/VALIDATION.md (5.5): since `9dac49d` the tarball gained the neutral LICENSE, THIRD-PARTY-NOTICES.md, doc changes, two components (`StatCard`, `IconStatCard`) and Sear's look for tabs, dialogs and the calendar. **Recommended: `0.1.0`** (0.x already says "early"; a fix is a cheap 0.1.1). The owner sets it and tags on a clean tree | ⛔ owner's decision |
| 15 | Dependencies. **Recommended: keep them as they are** — React, React DOM, React Query and Tailwind as peer dependencies with ranges (the app provides one copy; verified), the other libraries pinned to the exact tested versions. Trade-off: an app that already has *different* versions of those libraries (PMO differs on 16) gets a second copy of them — a bigger bundle, no functional problem; moving to `^` ranges later is non-breaking | ❓ owner's decision |
| 16 | Publish to GitHub Packages (`publishConfig.registry`), e.g. `npm publish --tag next` for a release candidate | ⛔ owner |

## Owner's steps (when ready)

1. Decide the licence; put its text and the copyright holder in LICENSE and its identifier in `package.json` `license`
   (keep THIRD-PARTY-NOTICES.md). Settle 12a and 12b.
2. In the same commit: the version (`0.1.0-rc.2` for another candidate, or `0.1.0`) in `package.json`, and CHANGELOG's
   `[Unreleased]` heading renamed to it; item 15 if it changes.
3. `git tag v<version>` on the clean commit; then `git remote add origin https://github.com/solvfast/solvfast-ui.git`,
   `git push -u origin main` and `git push origin v<version>` (with your own credentials).
4. With your own token (`write:packages`, never committed): `npm publish` (add `--tag next` for a release
   candidate so it doesn't become `latest`).
