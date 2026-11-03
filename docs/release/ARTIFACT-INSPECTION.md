# Artifact inspection — `@solvfast/ui` 0.4.0-dev.26 (Phase 26 E, 2026-11-03)

Inspected in worktree `p26-release` at `ddbf977` (tests converted in `46d0c78` do not change `dist/`).
**Nothing was published, tagged or pushed.** `npm pack` wrote only into the session scratchpad; `npm publish` was not
run, not even `--dry-run`. All numbers are from this worktree's own `npm run build` + `npm pack --dry-run --json` and
from unpacking the real tarball.

## 1. Checks run in isolation (exact outputs)

Tooling: node v20.20.2, npm 10.8.2, tsc 5.9.3, vitest 2.1.9.

| Check | Command | Result | Wall time |
|---|---|---|---|
| Types | `npx tsc --noEmit -p tsconfig.json` | exit 0, no diagnostics | 10.1 s |
| Tests (at dev.26) | `npx vitest run` | **37 files, 807 passed, 16 todo (823)** | 14.49 s |
| Tests (after `46d0c78`) | `npx vitest run` | **37 files, 812 passed, 11 todo (823)** | 15.97 s |
| Build | `npm run build` | 7/7 steps OK: CSS 16.8 / 12.3 / 1.2 kB, `full.css` 108.7 kB; boundaries OK; package audit OK | 11.8 s |
| Boundaries | `npm run check:boundaries` | core entry reaches 95 modules, none import `@tanstack/*`, sonner, recharts, react-hook-form, the Frappe layer or the toast/chart/form entries; toast 4, chart 3, form 4, frappe 123 modules | 0.2 s |
| Package audit | `npm run check:package` | `exports: 13 · built files scanned: 343`; `tarball: 528 files, 814.3 kB packed`; ✔ package OK | 1.3 s |
| Frappe demo e2e | `node e2e/frappe-review.mjs http://127.0.0.1:4811/ <scratch>` on the static playground build (SIMULATED site, no Frappe) | 32 shots taken; **28 states pass, 4 fail** — the `error` state in every theme/lang: `getByRole("alert")` timed out | 74.7 s |
| List parity e2e (generic `ListView` vs Sear's Field Library page; a Sear visual-regression check, **not Frappe parity**, no bearing on the gates) | `node e2e/list-parity.mjs http://127.0.0.1:4811/ http://127.0.0.1:4812/ <scratch>` on the static playground and `tools/parity` builds, then `python3 e2e/compare.py` | 44 + 44 shots, no page errors; **16 identical, 28 different** (5.5 record: 32 identical, 12 intended — `docs/VALIDATION.md:159`, `docs/validation/5.5/06-list.txt`). The 12 intended families are unchanged (`columns-open`, `column-shown`, `mobile` × 4 combos). **16 new differences, two families, for the list owner:** (a) `empty` × 4 — the package's filtered-empty state now reads "No records match the current filters." with a "Clear filters" button where Sear shows "No data yet" (0.4.0 empty-state work; intentional if documented); (b) `filter-open`, `filter-condition`, `saved-open` × 4 — the open popover's glass backdrop: Sear's reference shows the blurred table behind the panel, the package's panel is flat (max delta 38–44/255 light, 83–124/255 dark; the 5.5 note allowed ≤10/255 for this family). Unexplained here — either the popper glass regressed in 0.4.0 or the backdrop filter did not render in this headless run; needs a look by agent showcase / the list owner | 3 m 07 s + compare |

**e2e `error` finding (playground drift, not a package defect).** `playground/src/showcase/FrappeDemo.tsx:27` arms the
simulated failure on `frappe.client.get_list`, but since 0.4.0 the list reads rows with `frappe.desk.reportview.get`
(`docs/RELEASE-0.4.0.md` §3.2, behaviour change). The failure never fires, the list renders normally (screenshot
`light-en__error.png` shows the full ToDo list) and the alert is never shown. Fix belongs to the playground owner
(agent showcase): arm `failNext` on `frappe.desk.reportview.get`. The 28 other states (page, search, C2 hint, link
search, confirm delete, grouped, mobile × 4 combos) passed. SIMULATED only.

## 2. The tarball

```sh
npm run build && npm pack --dry-run --json          # listing
npm pack --pack-destination <scratchpad>             # real tarball, unpacked there and grepped
```

| | dev.23 (`docs/RELEASE-0.4.0.md` §1) | **dev.26 (this inspection)** | Changed |
|---|---|---|---|
| File | `solvfast-ui-0.4.0-dev.23.tgz` | `solvfast-ui-0.4.0-dev.26.tgz` | version |
| Entries | 524 | **528** | +4 (`docs/components/*.md`) |
| Packed size | 793,048 B | **833,888 B** | +40,840 B |
| Unpacked size | 2,897,787 B | **3,010,949 B** | +113,162 B |
| shasum | `df7853b8…` | `81f3d232ef821fcd91e56228052bec183d0d9bd2` | yes (every build with a new version string) |
| integrity | `sha512-mxouTft…` | `sha512-uG2OhZITVCWbxi/R4Wd+j2j+ujV6+jI4xCzX2fasB1tJElbrk1Q9o1YrrmdadPfrehb0tCp0f90NE3APHU7Fhw==` | yes |

### 2.1 Contents by folder (files / bytes)

| Folder | dev.23 | **dev.26** | Δ bytes |
|---|---|---|---:|
| package root (`package.json`, README, LICENSE, CHANGELOG, VENDORED, THIRD-PARTY-NOTICES) | 6 / 56,699 | 6 / 57,534 | +835 |
| `dist/` (entry files, `tailwind-preset.cjs`) | 5 / 29,910 | 5 / 29,910 | 0 |
| `dist/frappe` (incl. `dist/frappe/testing`) | 201 / 1,302,172 | 201 / 1,322,777 | +20,605 (Phase 26 pre-work: `canImport`/`canExport`/`readableFields`, `allow_import`, download/upload primitives) |
| `dist/primitives` | 138 / 405,101 | 138 / 405,101 | 0 |
| `dist/list` | 36 / 268,611 | 36 / 269,558 | +947 |
| `dist/fields` | 40 / 206,161 | 40 / 206,161 | 0 |
| `dist/styles` | 5 / 147,975 | 5 / 147,975 | 0 |
| `dist/record` | 29 / 140,098 | 29 / 140,098 | 0 |
| `dist/shell` | 21 / 111,914 | 21 / 111,914 | 0 |
| `dist/theme` | 6 / 102,684 | 6 / 102,684 | 0 |
| `dist/chart`, `dist/form`, `dist/toast`, `dist/cards`, `dist/lib` | 33 / 73,464 | 33 / 73,464 (6 / 28,951 · 6 / 13,146 · 6 / 3,623 · 3 / 13,242 · 12 / 14,502) | 0 |
| `docs/` (CONSUMING, FRAPPE, FEATURES, LIMITATIONS) | 4 / 52,998 | 4 / 52,998 | 0 |
| **`docs/components/`** (foundation, forms, list, record) | — | **4 / 90,775** | **new** |
| Total | 524 / 2,897,787 | 528 / 3,010,949 | +4 / +113,162 |

Every number not marked changed is identical to dev.23. The four new entries resolve finding 2 of
`RELEASE-0.4.0.md` §1.1 ("the 0.4.0 component docs are not in the tarball"): `package.json` `files` now lists the
four `docs/components/*.md`.

By type: 167 `.js`/`.cjs`, 176 `.d.ts`/`.d.cts`, 166 `.js.map`, 5 `.css`, 14 Markdown/JSON.

### 2.2 `exports` map vs files

`exports` has 13 keys (`.`, `./frappe`, `./frappe/testing`, `./toast`, `./chart`, `./form`, `./tailwind-preset`,
`./theme.css`, `./glass.css`, `./base.css`, `./full.css`, `./full-base.css`, `./package.json`). Every target (20 paths:
types + code per JS entry, one per CSS entry) exists in the unpacked tarball — checked file by file, and by
`check-package.mjs` step 1. Unchanged since dev.23 (one entry added vs v0.3.0: `./frappe/testing`).

### 2.3 `files` (package.json) vs what was packed

`files`: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `VENDORED.md`, `docs/CONSUMING.md`, `docs/FRAPPE.md`,
`docs/FEATURES.md`, `docs/LIMITATIONS.md`, `THIRD-PARTY-NOTICES.md`, `docs/components/{foundation,forms,list,record}.md`.
Packed root files: exactly `CHANGELOG.md, LICENSE, README.md, THIRD-PARTY-NOTICES.md, VENDORED.md, package.json`;
packed docs: exactly the 8 listed. No `.npmignore` exists (none needed: `files` is an allow-list).

**Excluded — confirmed on the unpacked tarball:** 0 entries under `tests/` (so `tests/fixtures/real-15.110/`,
including the GPL-3.0 ERPNext `customer.*.json`, and `tests/fixtures/real-15.110-sada/`), `src/`, `playground/`,
`e2e/`, `scripts/`, `showcase/`, `tools/`, `upstream/`, `.agent/`; no `.npmrc`. `check-package.mjs` step 4 enforces
the folder list on every build.

### 2.4 Source maps — owner decision needed

| | dev.23 | dev.26 |
|---|---|---|
| `.js.map` files | 166 | 166 |
| carrying a `sourcesContent` key | (not counted) | 166 |
| with non-empty source text | 160 | 160 — the 6 with `sources: []` are the entry modules `dist/index.js.map`, `dist/frappe/index.js.map`, `dist/frappe/testing/index.js.map`, `dist/toast/index.js.map`, `dist/chart/index.js.map`, `dist/form/index.js.map` (re-export files; vite emits no mapping for them) |
| source text shipped | — | 993,593 characters of TypeScript (comments included) |
| bytes of maps | — | 1,524,625 B = 50.6 % of the unpacked size |
| `sources` paths | relative `../../src/…`, no absolute paths | same: every `sources` entry of all 166 maps matches `^(\.\./)+src/` (checked programmatically); 0 absolute paths |

The maps ship the full TypeScript source of the package to anyone who can install it (private GitHub Packages scope;
the licence is proprietary). Options — the owner decides, nothing changed here:

| Option | `vite.lib.config.ts` change | Effect |
|---|---|---|
| **A. Keep** (current) | none | best debugging for consumers; source text in the tarball (+1.5 MB unpacked, maps compress well: packed 834 kB in all) |
| **B. Maps without source text** | in `build.rollupOptions.output` add `sourcemapExcludeSources: true` | maps keep the file/line mapping (`../../src/x.ts:12`), drop `sourcesContent`; consumers see paths and lines but not the code; size roughly −1.0 MB unpacked |
| C. No maps | `build.sourcemap: false` | 166 files fewer; stack traces point into `dist/*.js` only |

Recommendation for an **rc** to a private registry: A or B are both defensible; B if the owner does not want the source
text outside the repository. Either way, `check-package.mjs` already fails the build on an absolute local path in any
packed file, so the maps can never leak `/home/…`.

### 2.5 Dependencies vs what `dist` imports

`scripts/check-package.mjs` resolves every bare import in `dist/**/*.{js,cjs,d.ts,d.cts}` (343 files) against
`dependencies` + `peerDependencies` and fails on an undeclared import or an unused dependency. Output (dev.26):

```
exports: 13 · built files scanned: 343 · npm imports: @radix-ui/react-accordion, @radix-ui/react-alert-dialog,
@radix-ui/react-aspect-ratio, @radix-ui/react-avatar, @radix-ui/react-checkbox, @radix-ui/react-collapsible,
@radix-ui/react-context-menu, @radix-ui/react-dialog, @radix-ui/react-direction, @radix-ui/react-dropdown-menu,
@radix-ui/react-hover-card, @radix-ui/react-label, @radix-ui/react-menubar, @radix-ui/react-navigation-menu,
@radix-ui/react-popover, @radix-ui/react-progress, @radix-ui/react-radio-group, @radix-ui/react-scroll-area,
@radix-ui/react-select, @radix-ui/react-separator, @radix-ui/react-slider, @radix-ui/react-slot, @radix-ui/react-switch,
@radix-ui/react-tabs, @radix-ui/react-toggle, @radix-ui/react-toggle-group, @radix-ui/react-tooltip,
@tanstack/react-query, class-variance-authority, clsx, cmdk, date-fns, lucide-react, react, react-day-picker, react-dom,
react-hook-form, recharts, sonner, tailwind-merge, tailwindcss, tailwindcss-animate
tarball: 528 files, 814.3 kB packed (@solvfast/ui@0.4.0-dev.26)
✔ package OK
```

42 imported packages = 35 `dependencies` (27 Radix + cva, clsx, cmdk, date-fns, lucide-react, react-day-picker,
tailwind-merge, tailwindcss-animate) + 7 `peerDependencies` (react, react-dom, `@tanstack/react-query`, sonner,
recharts, react-hook-form, tailwindcss — the last five optional). No undeclared import, no unused dependency.
`dependencies`, `peerDependencies` and `peerDependenciesMeta` are unchanged since v0.3.0 (and since dev.23).
Per-entry imports (`check:boundaries`) are unchanged from `RELEASE-0.4.0.md` §1.3: the core entry imports no
`@tanstack/*`, sonner, recharts or react-hook-form; `./frappe` is unusable without `@tanstack/react-query`.

### 2.6 Licence files

`LICENSE` ("Copyright (c) 2026 Solvfast. All rights reserved … proprietary"), `THIRD-PARTY-NOTICES.md` (shadcn/ui,
Tailwind preflight, tailwindcss-animate — MIT) and `VENDORED.md` are in the tarball; `package.json` `license` is
`UNLICENSED`. `prepublish-check.mjs` refuses to publish while LICENSE says "not decided". No GPL material: the only
GPL-3.0 input (`tests/fixtures/real-15.110/customer.*.json`) is confirmed absent (§2.3).

### 2.7 Secrets and local paths in the unpacked tarball

```sh
grep -rEl "/home/|BEGIN .*PRIVATE|_authToken|ghp_|gho_|github_pat_|npm_[A-Za-z0-9]{30}|/tmp/|/Users/|lovable_bench|internal\.solvfaster" package/
```

**One hit, not a secret:** `docs/CONSUMING.md:23` — `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`, the
environment-variable reference consumers put in their own `.npmrc` (finding P1 of `docs/qa/secret-audit.md`, re-run
2026-11-03: "no credential, token, key or password" in either repository's history). Zero hits for `/home/`, `/tmp/`,
`/Users/`, private-key blocks, GitHub/npm token prefixes, the bench hostname or `lovable_bench`. The 166 source maps
were included in the grep (their `sources` are relative). `check-package.mjs` step 4 runs the same absolute-path and
token checks on every build.

## 3. Differences from `docs/RELEASE-0.4.0.md` §1 (dev.23) — every number that changed

1. Entries 524 → **528**; packed 793,048 → **833,888 B**; unpacked 2,897,787 → **3,010,949 B**; new shasum / integrity.
2. `docs/components/` (4 files, 90,775 B) is now packed — finding 2 resolved.
3. `dist/frappe` 1,302,172 → 1,322,777 B; `dist/list` 268,611 → 269,558 B; root 56,699 → 57,534 B (CHANGELOG / docs text).
4. Source maps: 166 / 160 non-empty unchanged; this inspection adds the byte count (1,524,625 B) and the two config options.
5. Finding 3 of §1.1 (`docs/FRAPPE.md` recommended the broken `{{ frappe.session.csrf_token }}` template) —
   **resolved**: `docs/FRAPPE.md:29` now says "Do not use" it and points to `frappe.sessions.get_csrf_token()` /
   `readFrappeBoot` (checklist item 14).
6. Tests: 780 (dev.23) → 807 → **812 passed**, 16 → **11 todo**.
