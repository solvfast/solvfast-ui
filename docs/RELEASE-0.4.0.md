# Release preparation — `@solvfast/ui` 0.4.0 pre-release (D-30)

Prepared by A1 on 2026-11-03 against the integration tree **`feat/0.4.0-frappe` at `5762c01` (0.4.0-dev.23)**.
**Nothing was published, tagged or pushed.** This file records the exact artifact, the secrets scan and the checklist the
owner follows; re-run §1–§2 on the release commit, because every number below changes with the version string.

Decision recorded (owner, D-30): a **GitHub Packages pre-release** — version `0.4.0-rc.1`, npm dist-tag `next`.

## 1. The artifact

```sh
npm run build                 # tsc declarations + vite library build + boundary and package checks
npm pack --dry-run --json     # what `npm publish` would upload
```

| | dev.23 tarball |
|---|---|
| Name | `@solvfast/ui` |
| File | `solvfast-ui-0.4.0-dev.23.tgz` |
| Packed / unpacked size | 793,048 B / 2,897,787 B |
| Entries | 524 |
| shasum | `df7853b858c7d8b47dee9dd2ea458b1314cf7656` |
| integrity | `sha512-mxouTftJTEhaUCpPIhly2EbFZ1KHao4lDE2iUwrxqo4dFwhqWhN6Wyq2Tz2/sn3j7IdbjnI7bH1INnmXzLc68w==` |

### 1.1 Contents by folder (every file with its size: Appendix A)

| Folder | Files | Bytes |
|---|---:|---:|
| package root (`package.json`, README, LICENSE, CHANGELOG, VENDORED, THIRD-PARTY-NOTICES) | 6 | 56,699 |
| `dist/` (entry files, `tailwind-preset.cjs`) | 5 | 29,910 |
| `dist/frappe` (incl. `dist/frappe/testing`, 6 files) | 201 | 1,302,172 |
| `dist/primitives` | 138 | 405,101 |
| `dist/list` | 36 | 268,611 |
| `dist/fields` | 40 | 206,161 |
| `dist/styles` | 5 | 147,975 |
| `dist/record` | 29 | 140,098 |
| `dist/shell` | 21 | 111,914 |
| `dist/theme` | 6 | 102,684 |
| `dist/chart`, `dist/form`, `dist/toast`, `dist/cards`, `dist/lib` | 33 | 73,464 |
| `docs/` (CONSUMING, FRAPPE, FEATURES, LIMITATIONS) | 4 | 52,998 |

**Excluded — confirmed** (no tarball path starts with them): `tests/` (incl. `tests/fixtures/real-15.110/`, whose
`customer.*.json` is **GPL-3.0 ERPNext metadata with ERPNext's own JS in `__js`**), `playground/`, `e2e/`, `scripts/`,
`upstream/`, `showcase/`, `tools/`, `src/`, `.agent/`, `.npmrc`, `node_modules/`. The package audit inside
`npm run build` (`scripts/check-package.mjs`) fails the build if any of them, an `.npmrc`, a credential or an absolute
local path reaches `dist/`.

Findings to decide before rc.1:
1. **Source maps ship the source.** 166 `.js.map` files; 160 carry `sourcesContent` (the full TypeScript, comments
   included, relative `../../src/…` paths, no absolute paths). Acceptable for a private package; if the owner prefers
   not to ship source text, build maps without `sourcesContent` (Lead: `vite.lib.config.ts`).
2. **The 0.4.0 component docs are not in the tarball.** `files` lists four docs; `docs/components/foundation.md`,
   `record.md`, `list.md` and `forms.md` stay in the repository. Add `"docs/components"` to `files` if consumers should
   get them with the package (Lead: `package.json`).
3. `docs/FRAPPE.md` (shipped) still recommends `window.csrf_token = "{{ frappe.session.csrf_token }}"`, which renders
   `"None"`; point it to `frappe.sessions.get_csrf_token()` / the page boot (`docs/components/foundation.md` §9).

### 1.2 Entry map (`exports`) — every target is in the tarball

| Entry | Types | Code | Notes |
|---|---|---|---|
| `.` | `dist/index.d.ts` | `dist/index.js` | core; the boundary check proves it reaches no `@tanstack/*`, Frappe layer, toast/chart/form entry |
| `./frappe` | `dist/frappe/index.d.ts` | `dist/frappe/index.js` | needs `@tanstack/react-query` 5 |
| `./frappe/testing` | `dist/frappe/testing/index.d.ts` | `dist/frappe/testing/index.js` | **new in 0.4.0**; the SIMULATED backend; the boundary check fails if `./frappe` reaches it |
| `./toast` | `dist/toast/index.d.ts` | `dist/toast/index.js` | needs `sonner` |
| `./chart` | `dist/chart/index.d.ts` | `dist/chart/index.js` | needs `recharts` 2 |
| `./form` | `dist/form/index.d.ts` | `dist/form/index.js` | needs `react-hook-form` 7 |
| `./tailwind-preset` | `dist/tailwind-preset.d.cts` | `dist/tailwind-preset.cjs` | needs `tailwindcss` 3 (and uses `tailwindcss-animate`) |
| `./theme.css`, `./glass.css`, `./base.css`, `./full.css`, `./full-base.css` | — | `dist/styles/*.css` | |
| `./package.json` | — | `package.json` | |

Compared with v0.3.0: one entry added (`./frappe/testing`), none removed or renamed.

### 1.3 Dependencies vs what the built code imports

Every bare import in `dist/**/*.js|cjs` was resolved against `package.json`:

| Package | Declared as | Imported by |
|---|---|---|
| 27 × `@radix-ui/react-*` | dependencies (exact versions) | primitives (`react-direction`: theme; `react-slot`: form too) |
| `class-variance-authority`, `cmdk`, `date-fns`, `react-day-picker` | dependencies | primitives |
| `clsx`, `tailwind-merge` | dependencies | lib |
| `lucide-react` | dependency | cards, fields, frappe, list, primitives, record, shell |
| `tailwindcss-animate` | dependency | `tailwind-preset.cjs` |
| `react` | peer (`^18.3.1`) | every area |
| `react-dom` | peer (`^18.3.1`) | shell (portals) |
| `@tanstack/react-query` | optional peer (`^5.59.0`) | frappe only |
| `sonner` | optional peer (`^1.7.0 \|\| ^2.0.0`) | toast only |
| `recharts` | optional peer (`^2.15.0`) | chart only |
| `react-hook-form` | optional peer (`^7.50.0`) | form only |
| `tailwindcss` | optional peer (`^3.4.0`) | not imported by code; required by consumers of the preset / `theme.css` path |

No undeclared import, no unused dependency. `dependencies`, `peerDependencies` and `peerDependenciesMeta` are
**unchanged since v0.3.0**. Note for consumers: `@solvfast/ui/frappe` is unusable without `@tanstack/react-query`
(optional at the package level because the core entry does not need it).

## 2. Secrets scan

Method: regular expressions over (a) every file of the dev.23 tarball (524, incl. source maps) and (b) every tracked
file of the repository (593): GitHub tokens (`ghp_ gho_ ghu_ ghs_ ghr_ github_pat_`), npm tokens, AWS keys, private-key
blocks, Slack tokens, `_authToken=` with a literal value, URLs with `user:password@`, `Authorization` header values,
`api_key / api_secret / client_secret / password` assignments, `sid=` values, internal hostnames and local paths
(`internal.solvfaster.com`, `lovable_bench`, `/home/frappe`, `127.0.0.1`, `localhost:<port>`), and e-mail addresses.

**Tarball: no findings in any category.**

Repository (not published; visible to anyone who can read the GitHub repository):

| Category | Finding | Assessment |
|---|---|---|
| Tokens, keys, private keys, credential URLs, auth headers, passwords, `sid` | none | — |
| `.npmrc` | `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` | an environment reference, no secret (as designed in RELEASING.md) |
| `_authToken=` pattern hits | `scripts/check-package.mjs`, `scripts/prepublish-check.mjs` | false positives: the detection regexes themselves |
| Internal hostname `internal.solvfaster.com` | `docs/qa/*` (backup and footprint plans), `e2e/frappe-site/teardown-crm-site.py`, `tests/fixtures/real-15.110/README.md` | names the shared bench site; no credentials. Decide whether the repo may name it |
| Local paths `/home/frappe`, `lovable_bench` | `docs/CONTRACT-0.4.md`, `docs/RELEASING.md`, `docs/qa/*`, `docs/validation/*` logs | development-machine paths; harmless, but internal |
| `127.0.0.1`, `localhost:4801/4802` | `docs/validation/*` logs | local dev servers |
| E-mail addresses in fixtures and tests | all synthetic: `@example.com`, `@x.com`, `hello@test.com`, the e2e users `sfui-*@example.com`; **no address in `tests/fixtures/real-15.110/`** (owners are `Administrator`) | no personal data |
| Other e-mail addresses | `developers@frappe.io` (`upstream/frappe-15.110-ab7e5ae/LICENSE`), `noreply@anthropic.com` (commit attribution quoted in `docs/CONTRACT-0.4.md`) | public addresses |
| Git metadata | commit author e-mail of the owner's account in the history | normal for a repository; not in the tarball |
| Licence-sensitive data | `tests/fixtures/real-15.110/customer.*.json`: ERPNext metadata incl. ERPNext JS (`__js`, "GNU General Public License v3") | repository-only test input, documented in the fixtures README; never in `src/` or `dist/` (confirmed) |

## 3. Pre-release checklist

### 3.1 Version and dist-tag
- [ ] `package.json` `version`: **`0.4.0-rc.1`** (not `0.4.0-dev.N`: the `dev` builds are integration snapshots for the
      CRM work copy; `rc.1` is the first candidate offered to consumers). Later fixes: `0.4.0-rc.2` …, then `0.4.0`.
- [ ] Publish with **`npm publish --tag next`**. Without `--tag`, npm moves `latest` to the pre-release and every
      `npm install @solvfast/ui` would get it. Consumers opt in with `npm install @solvfast/ui@next` (or `@0.4.0-rc.1`).
- [ ] After publishing, check: `npm dist-tag ls @solvfast/ui` → `latest: 0.3.0`, `next: 0.4.0-rc.1`.
- [ ] Suggested guard (Lead, `scripts/prepublish-check.mjs`): refuse a version containing `-` when `npm_config_tag`
      is `latest` (npm sets it from `--tag`).

### 3.2 CHANGELOG `[0.4.0-rc.1]` (Lead)
- [ ] Move `[Unreleased]` to `## [0.4.0-rc.1] — <date>` with the per-layer additions (foundation, list, forms, record,
      generic `fields/` and `record/` pieces, `@solvfast/ui/frappe/testing`).
- [ ] **The two commits published in 0.3.0 but missing from its notes** (tag `v0.3.0` = `63bbd1b`, the notes stop at
      `13d6e90`): `66af191` "Column manager: PMO's design" and `63bbd1b` "Date filters like Frappe's" (timespans,
      `between` on dates). List them under 0.3.0 as an erratum or at the top of 0.4.0, as the `[Unreleased]` section
      already drafts.
- [ ] **Breaking-change analysis** (export lists of `v0.3.0` vs the integration tree, per entry, with the TypeScript
      checker):

      | Entry | v0.3.0 exports | dev.23 exports | Removed | Renamed | Added |
      |---|---:|---:|---|---|---:|
      | `.` | 309 | 394 | none | none | 85 |
      | `./frappe` | 34 | 349 | none | none | 315 |
      | `./frappe/testing` | — | 8 | — | — | 8 |
      | `./toast` / `./chart` / `./form` | 3 / 7 / 8 | 3 / 7 / 8 | none | none | 0 |

      No export was removed or renamed. Type- and behaviour-level changes to call out (label **BREAKING** only where a
      consumer's code stops compiling or behaving the same):
      - `Messages` gained required keys (`fe*`, `form*`, `list*`, `rec*`): code that builds a **complete** `Messages`
        object fails to compile; the `ThemeProvider messages` prop is `Partial` and is unaffected. → BREAKING (types,
        rare).
      - `FrappeListMeta` (required `childOf`, `editable`, `fieldDefs`, `hasField`, `isLargeTable`, `isSubmittable`,
        `states`) and `ListRequest` (required `joinsChild`): only code that constructs them by hand breaks; values from
        `buildFrappeListMeta` / `buildListRequest` are unaffected. → BREAKING (types, rare).
      - The Frappe list reads rows with **`frappe.desk.reportview.get`** (compressed) and counts with a limit, instead
        of `frappe.client.get_list`; custom transports or mocks that only answered `get_list` must answer
        `reportview.get` / `get_count` (the simulated backend does). → behaviour change.
      - The list's meta query key is now `["sf-frappe", "list-meta", doctype]` (was `["sf-frappe", "meta", doctype]`);
        apps that invalidated the old key by hand must use the new one or `invalidateFrappeList`. → behaviour change.
      - `createFrappeClient` returns `FrappeApi` (a superset of `FrappeClient`); `FrappeError` gains `kind`,
        `messages`, `exception` (constructor unchanged); `searchLink` options are a superset; `frappeRetry` no longer
        retries `csrf`, `session_expired`, `too_large`; the default CSRF resolver ignores `"None"` / `""`. → additive.
      - `FrappeProvider` renders a server-message host and, by default, shows the messages of successful calls
        (`serverMessages="show"`; set `false` for the 0.3 behaviour). → visible behaviour change.
- [ ] Migration notes (in the changelog or `docs/CONSUMING.md`): the four behaviour changes above; supply `session`
      (roles), `translations` and `formatContext` — or the page boot — to get Desk-equivalent permissions, labels and
      formats; fix the page's CSRF token (`frappe.sessions.get_csrf_token()`); install `@tanstack/react-query` for
      `./frappe`; import the simulator only from `@solvfast/ui/frappe/testing`, never in production code.

### 3.3 Release commit and tag
- [ ] The tag is created **from a clean checkout equal to the published content**: merge to `main`, `git status`
      clean, `npm ci && npm run typecheck && npm run build && npm test`, `npm pack --dry-run` reviewed against §1, then
      `git tag v0.4.0-rc.1` on that exact commit. (The 0.3.0 history shows why: the tag and the notes diverged.)
- [ ] `node scripts/prepublish-check.mjs` must print `✔ ready to publish @solvfast/ui@0.4.0-rc.1` (clean tree, tag on
      HEAD, licence decided, no credential in tracked files). `npm publish` runs it again, then the build and the tests.
- [ ] Re-run the secrets scan of §2 on the final tarball.

### 3.4 `docs/RELEASING.md` steps (owner, with their own token)
1. Prepare and check locally: `npm ci`, `npm run typecheck && npm run build && npm test`, `npm pack --dry-run`,
   `git status` clean, `git tag v0.4.0-rc.1`, `node scripts/prepublish-check.mjs`.
2. Push: `git push origin main` and `git push origin v0.4.0-rc.1`.
3. Publish: `export NODE_AUTH_TOKEN=<classic token with write:packages>` (this shell only), then
   **`npm publish --tag next`**.
4. Check: `npm view @solvfast/ui@0.4.0-rc.1 version dist.tarball` and `npm dist-tag ls @solvfast/ui`.
5. Package settings on github.com stay **Private**, access inherited from `solvfast/solvfast-ui`.
6. Update RELEASING.md's status table for 0.4.0-rc.1 (Lead).

### 3.5 Registry and scope
- Registry **GitHub Packages, `https://npm.pkg.github.com`** — `publishConfig.registry`, so `npm publish` cannot reach
  public npm.
- Scope **`@solvfast`** = the GitHub organisation `solvfast` (GitHub Packages requires scope = owner); `repository` =
  `solvfast/solvfast-ui` links the package to the repository; visibility private; licence `UNLICENSED` (proprietary).
- Authentication: the committed `.npmrc` maps `@solvfast` to GitHub Packages and reads `${NODE_AUTH_TOKEN}`; a
  **classic** token (`write:packages` to publish, `read:packages` to install), SSO-authorised if the organisation
  uses SSO. While preparing this file a read-only `npm view @solvfast/ui versions` answered 401 (no token in this
  environment) — nothing was sent to the registry beyond that unauthenticated GET.

### 3.6 Status to state in the release notes
Contract §4 vocabulary: the Frappe layer is **Simulated & tested** (unit tests, recorded shapes, the simulated backend);
it has **not** been verified against a real site, and the CRM's "frappe" mode boot is prepared but not deployed (D-25).

## Appendix A — every file in the dev.23 tarball

| Size (bytes) | Path |
|---:|---|
| 20,443 | `CHANGELOG.md` |
| 298 | `LICENSE` |
| 5,173 | `README.md` |
| 2,934 | `THIRD-PARTY-NOTICES.md` |
| 22,798 | `VENDORED.md` |
| 2,425 | `dist/cards/StatCard.d.ts` |
| 3,467 | `dist/cards/StatCard.js` |
| 7,350 | `dist/cards/StatCard.js.map` |
| 1,821 | `dist/chart/chart.d.ts` |
| 9,580 | `dist/chart/chart.js` |
| 16,711 | `dist/chart/chart.js.map` |
| 471 | `dist/chart/index.d.ts` |
| 278 | `dist/chart/index.js` |
| 90 | `dist/chart/index.js.map` |
| 907 | `dist/fields/ColorInput.d.ts` |
| 3,287 | `dist/fields/ColorInput.js` |
| 5,624 | `dist/fields/ColorInput.js.map` |
| 2,975 | `dist/fields/DataGrid.d.ts` |
| 12,372 | `dist/fields/DataGrid.js` |
| 22,410 | `dist/fields/DataGrid.js.map` |
| 913 | `dist/fields/DurationInput.d.ts` |
| 3,077 | `dist/fields/DurationInput.js` |
| 5,923 | `dist/fields/DurationInput.js.map` |
| 1,681 | `dist/fields/FieldShell.d.ts` |
| 2,038 | `dist/fields/FieldShell.js` |
| 4,016 | `dist/fields/FieldShell.js.map` |
| 2,230 | `dist/fields/LinkInput.d.ts` |
| 6,595 | `dist/fields/LinkInput.js` |
| 12,123 | `dist/fields/LinkInput.js.map` |
| 2,104 | `dist/fields/NumberInput.d.ts` |
| 4,241 | `dist/fields/NumberInput.js` |
| 8,587 | `dist/fields/NumberInput.js.map` |
| 1,022 | `dist/fields/Rating.d.ts` |
| 3,395 | `dist/fields/Rating.js` |
| 6,390 | `dist/fields/Rating.js.map` |
| 968 | `dist/fields/ReadOnlyValue.d.ts` |
| 1,127 | `dist/fields/ReadOnlyValue.js` |
| 2,491 | `dist/fields/ReadOnlyValue.js.map` |
| 1,868 | `dist/fields/TagInput.d.ts` |
| 7,303 | `dist/fields/TagInput.js` |
| 12,302 | `dist/fields/TagInput.js.map` |
| 1,210 | `dist/fields/TimeInput.d.ts` |
| 3,845 | `dist/fields/TimeInput.js` |
| 6,837 | `dist/fields/TimeInput.js.map` |
| 2,412 | `dist/fields/autocomplete.d.ts` |
| 6,426 | `dist/fields/autocomplete.js` |
| 12,359 | `dist/fields/autocomplete.js.map` |
| 1,743 | `dist/fields/index.d.ts` |
| 3,240 | `dist/fields/lib/number.d.ts` |
| 4,991 | `dist/fields/lib/number.js` |
| 12,998 | `dist/fields/lib/number.js.map` |
| 1,570 | `dist/fields/lib/time.d.ts` |
| 2,957 | `dist/fields/lib/time.js` |
| 7,604 | `dist/fields/lib/time.js.map` |
| 1,649 | `dist/form/form.d.ts` |
| 3,391 | `dist/form/form.js` |
| 7,367 | `dist/form/form.js.map` |
| 370 | `dist/form/index.d.ts` |
| 279 | `dist/form/index.js` |
| 90 | `dist/form/index.js.map` |
| 2,282 | `dist/frappe/FrappeListView.d.ts` |
| 5,030 | `dist/frappe/FrappeListView.js` |
| 9,588 | `dist/frappe/FrappeListView.js.map` |
| 4,264 | `dist/frappe/FrappeProvider.d.ts` |
| 2,901 | `dist/frappe/FrappeProvider.js` |
| 8,388 | `dist/frappe/FrappeProvider.js.map` |
| 9,518 | `dist/frappe/client.d.ts` |
| 15,566 | `dist/frappe/client.js` |
| 38,090 | `dist/frappe/client.js.map` |
| 14,542 | `dist/frappe/contract.d.ts` |
| 616 | `dist/frappe/contract.js` |
| 15,956 | `dist/frappe/contract.js.map` |
| 955 | `dist/frappe/feedback/FrappeErrorState.d.ts` |
| 4,462 | `dist/frappe/feedback/FrappeErrorState.js` |
| 8,813 | `dist/frappe/feedback/FrappeErrorState.js.map` |
| 568 | `dist/frappe/feedback/ServerHtml.d.ts` |
| 2,194 | `dist/frappe/feedback/ServerHtml.js` |
| 4,372 | `dist/frappe/feedback/ServerHtml.js.map` |
| 481 | `dist/frappe/feedback/index.d.ts` |
| 1,831 | `dist/frappe/feedback/messages.d.ts` |
| 4,447 | `dist/frappe/feedback/messages.js` |
| 8,695 | `dist/frappe/feedback/messages.js.map` |
| 380 | `dist/frappe/feedback/tone.d.ts` |
| 359 | `dist/frappe/feedback/tone.js` |
| 892 | `dist/frappe/feedback/tone.js.map` |
| 4,289 | `dist/frappe/form/FrappeChildTable.d.ts` |
| 10,518 | `dist/frappe/form/FrappeChildTable.js` |
| 21,020 | `dist/frappe/form/FrappeChildTable.js.map` |
| 3,253 | `dist/frappe/form/FrappeField.d.ts` |
| 14,117 | `dist/frappe/form/FrappeField.js` |
| 26,323 | `dist/frappe/form/FrappeField.js.map` |
| 2,454 | `dist/frappe/form/FrappeForm.d.ts` |
| 6,850 | `dist/frappe/form/FrappeForm.js` |
| 13,046 | `dist/frappe/form/FrappeForm.js.map` |
| 6,596 | `dist/frappe/form/FrappeFormView.d.ts` |
| 30,621 | `dist/frappe/form/FrappeFormView.js` |
| 59,012 | `dist/frappe/form/FrappeFormView.js.map` |
| 4,946 | `dist/frappe/form/FrappeLinkField.d.ts` |
| 7,554 | `dist/frappe/form/FrappeLinkField.js` |
| 17,547 | `dist/frappe/form/FrappeLinkField.js.map` |
| 851 | `dist/frappe/form/FrappeTableMultiSelect.d.ts` |
| 3,087 | `dist/frappe/form/FrappeTableMultiSelect.js` |
| 6,570 | `dist/frappe/form/FrappeTableMultiSelect.js.map` |
| 4,769 | `dist/frappe/form/events.d.ts` |
| 1,723 | `dist/frappe/form/events.js` |
| 7,866 | `dist/frappe/form/events.js.map` |
| 1,623 | `dist/frappe/form/index.d.ts` |
| 516 | `dist/frappe/form/linkTitles.d.ts` |
| 925 | `dist/frappe/form/linkTitles.js` |
| 2,296 | `dist/frappe/form/linkTitles.js.map` |
| 1,999 | `dist/frappe/form/model/actions.d.ts` |
| 1,031 | `dist/frappe/form/model/actions.js` |
| 4,003 | `dist/frappe/form/model/actions.js.map` |
| 1,534 | `dist/frappe/form/model/copy.d.ts` |
| 2,367 | `dist/frappe/form/model/copy.js` |
| 5,878 | `dist/frappe/form/model/copy.js.map` |
| 3,147 | `dist/frappe/form/model/defaults.d.ts` |
| 4,705 | `dist/frappe/form/model/defaults.js` |
| 11,545 | `dist/frappe/form/model/defaults.js.map` |
| 4,750 | `dist/frappe/form/model/depends.d.ts` |
| 4,545 | `dist/frappe/form/model/depends.js` |
| 12,241 | `dist/frappe/form/model/depends.js.map` |
| 3,724 | `dist/frappe/form/model/docStore.d.ts` |
| 6,439 | `dist/frappe/form/model/docStore.js` |
| 15,639 | `dist/frappe/form/model/docStore.js.map` |
| 2,353 | `dist/frappe/form/model/expression.d.ts` |
| 12,736 | `dist/frappe/form/model/expression.js` |
| 28,517 | `dist/frappe/form/model/expression.js.map` |
| 2,068 | `dist/frappe/form/model/fetch.d.ts` |
| 1,539 | `dist/frappe/form/model/fetch.js` |
| 4,905 | `dist/frappe/form/model/fetch.js.map` |
| 1,108 | `dist/frappe/form/model/fieldtypes.d.ts` |
| 1,356 | `dist/frappe/form/model/fieldtypes.js` |
| 2,864 | `dist/frappe/form/model/fieldtypes.js.map` |
| 1,582 | `dist/frappe/form/model/index.d.ts` |
| 1,857 | `dist/frappe/form/model/layout.d.ts` |
| 2,022 | `dist/frappe/form/model/layout.js` |
| 5,274 | `dist/frappe/form/model/layout.js.map` |
| 3,551 | `dist/frappe/form/model/mandatory.d.ts` |
| 4,222 | `dist/frappe/form/model/mandatory.js` |
| 11,194 | `dist/frappe/form/model/mandatory.js.map` |
| 1,667 | `dist/frappe/form/model/status.d.ts` |
| 1,438 | `dist/frappe/form/model/status.js` |
| 4,031 | `dist/frappe/form/model/status.js.map` |
| 2,621 | `dist/frappe/form/services.d.ts` |
| 2,085 | `dist/frappe/form/services.js` |
| 5,519 | `dist/frappe/form/services.js.map` |
| 598 | `dist/frappe/hooks/index.d.ts` |
| 1,564 | `dist/frappe/hooks/useDoc.d.ts` |
| 2,202 | `dist/frappe/hooks/useDoc.js` |
| 5,595 | `dist/frappe/hooks/useDoc.js.map` |
| 3,961 | `dist/frappe/hooks/useDocMutations.d.ts` |
| 2,802 | `dist/frappe/hooks/useDocMutations.js` |
| 9,160 | `dist/frappe/hooks/useDocMutations.js.map` |
| 1,733 | `dist/frappe/hooks/usePermissions.d.ts` |
| 1,908 | `dist/frappe/hooks/usePermissions.js` |
| 4,852 | `dist/frappe/hooks/usePermissions.js.map` |
| 169 | `dist/frappe/hooks/useRealtime.d.ts` |
| 564 | `dist/frappe/hooks/useRealtime.js` |
| 1,551 | `dist/frappe/hooks/useRealtime.js.map` |
| 3,041 | `dist/frappe/index.d.ts` |
| 9,490 | `dist/frappe/index.js` |
| 149 | `dist/frappe/index.js.map` |
| 1,685 | `dist/frappe/list/FrappeBulkActions.d.ts` |
| 8,797 | `dist/frappe/list/FrappeBulkActions.js` |
| 15,044 | `dist/frappe/list/FrappeBulkActions.js.map` |
| 2,574 | `dist/frappe/list/bulk.d.ts` |
| 1,847 | `dist/frappe/list/bulk.js` |
| 5,902 | `dist/frappe/list/bulk.js.map` |
| 1,407 | `dist/frappe/list/cells.d.ts` |
| 4,427 | `dist/frappe/list/cells.js` |
| 7,698 | `dist/frappe/list/cells.js.map` |
| 2,391 | `dist/frappe/list/indicator.d.ts` |
| 1,679 | `dist/frappe/list/indicator.js` |
| 5,505 | `dist/frappe/list/indicator.js.map` |
| 420 | `dist/frappe/list/realtime.d.ts` |
| 1,133 | `dist/frappe/list/realtime.js` |
| 2,576 | `dist/frappe/list/realtime.js.map` |
| 2,396 | `dist/frappe/list/reportview.d.ts` |
| 1,846 | `dist/frappe/list/reportview.js` |
| 5,551 | `dist/frappe/list/reportview.js.map` |
| 1,521 | `dist/frappe/list/settings.d.ts` |
| 1,606 | `dist/frappe/list/settings.js` |
| 4,531 | `dist/frappe/list/settings.js.map` |
| 2,248 | `dist/frappe/list/storage.d.ts` |
| 3,595 | `dist/frappe/list/storage.js` |
| 8,856 | `dist/frappe/list/storage.js.map` |
| 1,086 | `dist/frappe/list/tuples.d.ts` |
| 2,558 | `dist/frappe/list/tuples.js` |
| 5,340 | `dist/frappe/list/tuples.js.map` |
| 4,132 | `dist/frappe/meta.d.ts` |
| 6,831 | `dist/frappe/meta.js` |
| 16,986 | `dist/frappe/meta.js.map` |
| 4,140 | `dist/frappe/query.d.ts` |
| 6,272 | `dist/frappe/query.js` |
| 16,193 | `dist/frappe/query.js.map` |
| 1,509 | `dist/frappe/record/FrappeAssignTo.d.ts` |
| 2,519 | `dist/frappe/record/FrappeAssignTo.js` |
| 5,169 | `dist/frappe/record/FrappeAssignTo.js.map` |
| 823 | `dist/frappe/record/FrappeStatusIndicator.d.ts` |
| 1,195 | `dist/frappe/record/FrappeStatusIndicator.js` |
| 2,652 | `dist/frappe/record/FrappeStatusIndicator.js.map` |
| 1,809 | `dist/frappe/record/FrappeTimeline.d.ts` |
| 4,445 | `dist/frappe/record/FrappeTimeline.js` |
| 9,083 | `dist/frappe/record/FrappeTimeline.js.map` |
| 1,534 | `dist/frappe/record/FrappeWorkflowActions.d.ts` |
| 2,191 | `dist/frappe/record/FrappeWorkflowActions.js` |
| 4,541 | `dist/frappe/record/FrappeWorkflowActions.js.map` |
| 776 | `dist/frappe/record/data.d.ts` |
| 763 | `dist/frappe/record/data.js` |
| 2,137 | `dist/frappe/record/data.js.map` |
| 1,427 | `dist/frappe/record/index.d.ts` |
| 1,582 | `dist/frappe/record/indicator.d.ts` |
| 1,024 | `dist/frappe/record/indicator.js` |
| 3,282 | `dist/frappe/record/indicator.js.map` |
| 1,093 | `dist/frappe/record/stateHistory.d.ts` |
| 1,648 | `dist/frappe/record/stateHistory.js` |
| 4,030 | `dist/frappe/record/stateHistory.js.map` |
| 3,024 | `dist/frappe/record/timeline.d.ts` |
| 7,939 | `dist/frappe/record/timeline.js` |
| 18,575 | `dist/frappe/record/timeline.js.map` |
| 700 | `dist/frappe/record/useCommunications.d.ts` |
| 1,620 | `dist/frappe/record/useCommunications.js` |
| 3,369 | `dist/frappe/record/useCommunications.js.map` |
| 1,801 | `dist/frappe/record/useWorkflow.d.ts` |
| 2,755 | `dist/frappe/record/useWorkflow.js` |
| 5,356 | `dist/frappe/record/useWorkflow.js.map` |
| 4,306 | `dist/frappe/record/workflow.d.ts` |
| 4,154 | `dist/frappe/record/workflow.js` |
| 10,980 | `dist/frappe/record/workflow.js.map` |
| 3,007 | `dist/frappe/services/boot.d.ts` |
| 2,602 | `dist/frappe/services/boot.js` |
| 7,948 | `dist/frappe/services/boot.js.map` |
| 2,241 | `dist/frappe/services/cache.d.ts` |
| 3,148 | `dist/frappe/services/cache.js` |
| 7,486 | `dist/frappe/services/cache.js.map` |
| 7,499 | `dist/frappe/services/format.d.ts` |
| 12,377 | `dist/frappe/services/format.js` |
| 30,973 | `dist/frappe/services/format.js.map` |
| 1,455 | `dist/frappe/services/index.d.ts` |
| 4,455 | `dist/frappe/services/indicator.d.ts` |
| 4,117 | `dist/frappe/services/indicator.js` |
| 11,302 | `dist/frappe/services/indicator.js.map` |
| 6,105 | `dist/frappe/services/permissions.d.ts` |
| 5,689 | `dist/frappe/services/permissions.js` |
| 15,787 | `dist/frappe/services/permissions.js.map` |
| 1,458 | `dist/frappe/services/realtime.d.ts` |
| 2,868 | `dist/frappe/services/realtime.js` |
| 6,676 | `dist/frappe/services/realtime.js.map` |
| 1,393 | `dist/frappe/services/translate.d.ts` |
| 877 | `dist/frappe/services/translate.js` |
| 2,675 | `dist/frappe/services/translate.js.map` |
| 5,066 | `dist/frappe/testing/fixtureTransport.d.ts` |
| 51,832 | `dist/frappe/testing/fixtureTransport.js` |
| 108,568 | `dist/frappe/testing/fixtureTransport.js.map` |
| 338 | `dist/frappe/testing/index.d.ts` |
| 213 | `dist/frappe/testing/index.js` |
| 90 | `dist/frappe/testing/index.js.map` |
| 5,580 | `dist/frappe/useFrappeList.d.ts` |
| 16,255 | `dist/frappe/useFrappeList.js` |
| 32,551 | `dist/frappe/useFrappeList.js.map` |
| 9,500 | `dist/index.d.ts` |
| 13,155 | `dist/index.js` |
| 179 | `dist/index.js.map` |
| 187 | `dist/lib/cn.d.ts` |
| 178 | `dist/lib/cn.js` |
| 435 | `dist/lib/cn.js.map` |
| 2,160 | `dist/lib/datetime.d.ts` |
| 1,714 | `dist/lib/datetime.js` |
| 5,927 | `dist/lib/datetime.js.map` |
| 250 | `dist/lib/localized.d.ts` |
| 151 | `dist/lib/localized.js` |
| 525 | `dist/lib/localized.js.map` |
| 271 | `dist/lib/relative-time.d.ts` |
| 803 | `dist/lib/relative-time.js` |
| 1,901 | `dist/lib/relative-time.js.map` |
| 558 | `dist/list/ListActionsContext.d.ts` |
| 251 | `dist/list/ListActionsContext.js` |
| 801 | `dist/list/ListActionsContext.js.map` |
| 3,912 | `dist/list/ListView.d.ts` |
| 9,154 | `dist/list/ListView.js` |
| 18,392 | `dist/list/ListView.js.map` |
| 1,998 | `dist/list/model/columns.d.ts` |
| 687 | `dist/list/model/columns.js` |
| 3,079 | `dist/list/model/columns.js.map` |
| 4,694 | `dist/list/model/filters.d.ts` |
| 10,577 | `dist/list/model/filters.js` |
| 23,523 | `dist/list/model/filters.js.map` |
| 516 | `dist/list/model/group.d.ts` |
| 478 | `dist/list/model/group.js` |
| 1,477 | `dist/list/model/group.js.map` |
| 843 | `dist/list/model/sort.d.ts` |
| 1,660 | `dist/list/model/sort.js` |
| 4,235 | `dist/list/model/sort.js.map` |
| 1,560 | `dist/list/model/storage.d.ts` |
| 1,139 | `dist/list/model/storage.js` |
| 3,804 | `dist/list/model/storage.js.map` |
| 2,240 | `dist/list/parts/FilterBuilder.d.ts` |
| 14,542 | `dist/list/parts/FilterBuilder.js` |
| 25,846 | `dist/list/parts/FilterBuilder.js.map` |
| 1,376 | `dist/list/parts/ListFooter.d.ts` |
| 3,529 | `dist/list/parts/ListFooter.js` |
| 5,981 | `dist/list/parts/ListFooter.js.map` |
| 3,231 | `dist/list/parts/ListTable.d.ts` |
| 10,833 | `dist/list/parts/ListTable.js` |
| 19,848 | `dist/list/parts/ListTable.js.map` |
| 2,591 | `dist/list/parts/Toolbar.d.ts` |
| 19,420 | `dist/list/parts/Toolbar.js` |
| 32,428 | `dist/list/parts/Toolbar.js.map` |
| 5,052 | `dist/list/useListState.d.ts` |
| 8,607 | `dist/list/useListState.js` |
| 19,749 | `dist/list/useListState.js.map` |
| 941 | `dist/primitives/accordion.d.ts` |
| 1,776 | `dist/primitives/accordion.js` |
| 3,126 | `dist/primitives/accordion.js.map` |
| 2,231 | `dist/primitives/alert-dialog.d.ts` |
| 4,355 | `dist/primitives/alert-dialog.js` |
| 7,323 | `dist/primitives/alert-dialog.js.map` |
| 737 | `dist/primitives/alert.d.ts` |
| 1,467 | `dist/primitives/alert.js` |
| 2,665 | `dist/primitives/alert.js.map` |
| 251 | `dist/primitives/aspect-ratio.d.ts` |
| 184 | `dist/primitives/aspect-ratio.js` |
| 431 | `dist/primitives/aspect-ratio.js.map` |
| 692 | `dist/primitives/avatar.d.ts` |
| 1,186 | `dist/primitives/avatar.js` |
| 2,341 | `dist/primitives/avatar.js.map` |
| 579 | `dist/primitives/badge.d.ts` |
| 1,261 | `dist/primitives/badge.js` |
| 2,089 | `dist/primitives/badge.js.map` |
| 1,503 | `dist/primitives/breadcrumb.d.ts` |
| 2,832 | `dist/primitives/breadcrumb.js` |
| 5,146 | `dist/primitives/breadcrumb.js.map` |
| 1,348 | `dist/primitives/button.d.ts` |
| 3,733 | `dist/primitives/button.js` |
| 5,837 | `dist/primitives/button.js.map` |
| 568 | `dist/primitives/calendar.d.ts` |
| 8,105 | `dist/primitives/calendar.js` |
| 11,806 | `dist/primitives/calendar.js.map` |
| 923 | `dist/primitives/card.d.ts` |
| 1,674 | `dist/primitives/card.js` |
| 3,211 | `dist/primitives/card.js.map` |
| 301 | `dist/primitives/checkbox.d.ts` |
| 1,229 | `dist/primitives/checkbox.js` |
| 1,893 | `dist/primitives/checkbox.js.map` |
| 635 | `dist/primitives/collapsible.d.ts` |
| 362 | `dist/primitives/collapsible.js` |
| 675 | `dist/primitives/collapsible.js.map` |
| 4,458 | `dist/primitives/command.d.ts` |
| 4,119 | `dist/primitives/command.js` |
| 7,178 | `dist/primitives/command.js.map` |
| 3,030 | `dist/primitives/context-menu.d.ts` |
| 6,736 | `dist/primitives/context-menu.js` |
| 10,789 | `dist/primitives/context-menu.js.map` |
| 3,010 | `dist/primitives/date-time-field.d.ts` |
| 12,221 | `dist/primitives/date-time-field.js` |
| 23,432 | `dist/primitives/date-time-field.js.map` |
| 1,763 | `dist/primitives/dialog.d.ts` |
| 3,809 | `dist/primitives/dialog.js` |
| 6,102 | `dist/primitives/dialog.js.map` |
| 3,091 | `dist/primitives/dropdown-menu.d.ts` |
| 6,866 | `dist/primitives/dropdown-menu.js` |
| 11,013 | `dist/primitives/dropdown-menu.js.map` |
| 641 | `dist/primitives/editable-title.d.ts` |
| 2,069 | `dist/primitives/editable-title.js` |
| 3,880 | `dist/primitives/editable-title.js.map` |
| 570 | `dist/primitives/hover-card.d.ts` |
| 1,348 | `dist/primitives/hover-card.js` |
| 2,049 | `dist/primitives/hover-card.js.map` |
| 245 | `dist/primitives/input.d.ts` |
| 734 | `dist/primitives/input.js` |
| 1,192 | `dist/primitives/input.js.map` |
| 442 | `dist/primitives/label.d.ts` |
| 635 | `dist/primitives/label.js` |
| 1,232 | `dist/primitives/label.js.map` |
| 3,092 | `dist/primitives/menubar.d.ts` |
| 7,575 | `dist/primitives/menubar.js` |
| 12,755 | `dist/primitives/menubar.js.map` |
| 2,011 | `dist/primitives/navigation-menu.d.ts` |
| 4,644 | `dist/primitives/navigation-menu.js` |
| 7,250 | `dist/primitives/navigation-menu.js.map` |
| 1,866 | `dist/primitives/page-header.d.ts` |
| 3,418 | `dist/primitives/page-header.js` |
| 8,241 | `dist/primitives/page-header.js.map` |
| 1,449 | `dist/primitives/pagination.d.ts` |
| 3,149 | `dist/primitives/pagination.js` |
| 5,629 | `dist/primitives/pagination.js.map` |
| 266 | `dist/primitives/pill.d.ts` |
| 522 | `dist/primitives/pill.js` |
| 1,033 | `dist/primitives/pill.js.map` |
| 693 | `dist/primitives/popover.d.ts` |
| 1,415 | `dist/primitives/popover.js` |
| 2,127 | `dist/primitives/popover.js.map` |
| 295 | `dist/primitives/progress.d.ts` |
| 957 | `dist/primitives/progress.js` |
| 1,924 | `dist/primitives/progress.js.map` |
| 523 | `dist/primitives/radio-group.d.ts` |
| 1,285 | `dist/primitives/radio-group.js` |
| 2,273 | `dist/primitives/radio-group.js.map` |
| 1,862 | `dist/primitives/rich-text-editor.d.ts` |
| 5,572 | `dist/primitives/rich-text-editor.js` |
| 12,478 | `dist/primitives/rich-text-editor.js.map` |
| 512 | `dist/primitives/scroll-area.d.ts` |
| 1,482 | `dist/primitives/scroll-area.js` |
| 2,635 | `dist/primitives/scroll-area.js.map` |
| 1,198 | `dist/primitives/search-combobox.d.ts` |
| 4,242 | `dist/primitives/search-combobox.js` |
| 8,467 | `dist/primitives/search-combobox.js.map` |
| 1,922 | `dist/primitives/select.d.ts` |
| 5,287 | `dist/primitives/select.js` |
| 8,613 | `dist/primitives/select.js.map` |
| 301 | `dist/primitives/separator.d.ts` |
| 701 | `dist/primitives/separator.js` |
| 1,337 | `dist/primitives/separator.js.map` |
| 2,055 | `dist/primitives/sheet.d.ts` |
| 4,104 | `dist/primitives/sheet.js` |
| 6,747 | `dist/primitives/sheet.js.map` |
| 140 | `dist/primitives/skeleton.d.ts` |
| 326 | `dist/primitives/skeleton.js` |
| 682 | `dist/primitives/skeleton.js.map` |
| 285 | `dist/primitives/slider.d.ts` |
| 1,077 | `dist/primitives/slider.js` |
| 1,712 | `dist/primitives/slider.js.map` |
| 355 | `dist/primitives/status-dot.d.ts` |
| 618 | `dist/primitives/status-dot.js` |
| 1,338 | `dist/primitives/status-dot.js.map` |
| 2,019 | `dist/primitives/stepper.d.ts` |
| 4,004 | `dist/primitives/stepper.js` |
| 6,901 | `dist/primitives/stepper.js.map` |
| 291 | `dist/primitives/switch.d.ts` |
| 1,243 | `dist/primitives/switch.js` |
| 1,817 | `dist/primitives/switch.js.map` |
| 1,322 | `dist/primitives/table.d.ts` |
| 2,497 | `dist/primitives/table.js` |
| 4,707 | `dist/primitives/table.js.map` |
| 799 | `dist/primitives/tabs.d.ts` |
| 2,065 | `dist/primitives/tabs.js` |
| 3,237 | `dist/primitives/tabs.js.map` |
| 263 | `dist/primitives/textarea.d.ts` |
| 628 | `dist/primitives/textarea.js` |
| 1,075 | `dist/primitives/textarea.js.map` |
| 1,140 | `dist/primitives/toggle-group.d.ts` |
| 1,344 | `dist/primitives/toggle-group.js` |
| 2,798 | `dist/primitives/toggle-group.js.map` |
| 818 | `dist/primitives/toggle.d.ts` |
| 1,395 | `dist/primitives/toggle.js` |
| 2,282 | `dist/primitives/toggle.js.map` |
| 638 | `dist/primitives/tooltip.d.ts` |
| 1,305 | `dist/primitives/tooltip.js` |
| 2,003 | `dist/primitives/tooltip.js.map` |
| 1,203 | `dist/record/ActionBar.d.ts` |
| 4,458 | `dist/record/ActionBar.js` |
| 7,693 | `dist/record/ActionBar.js.map` |
| 2,440 | `dist/record/AssigneeGroup.d.ts` |
| 13,557 | `dist/record/AssigneeGroup.js` |
| 21,827 | `dist/record/AssigneeGroup.js.map` |
| 1,630 | `dist/record/CommentComposer.d.ts` |
| 7,587 | `dist/record/CommentComposer.js` |
| 13,256 | `dist/record/CommentComposer.js.map` |
| 1,605 | `dist/record/LifecycleBar.d.ts` |
| 3,519 | `dist/record/LifecycleBar.js` |
| 6,372 | `dist/record/LifecycleBar.js.map` |
| 509 | `dist/record/StatusBadge.d.ts` |
| 1,218 | `dist/record/StatusBadge.js` |
| 2,259 | `dist/record/StatusBadge.js.map` |
| 2,514 | `dist/record/Timeline.d.ts` |
| 12,101 | `dist/record/Timeline.js` |
| 19,378 | `dist/record/Timeline.js.map` |
| 694 | `dist/record/format.d.ts` |
| 836 | `dist/record/format.js` |
| 2,089 | `dist/record/format.js.map` |
| 1,056 | `dist/record/index.d.ts` |
| 203 | `dist/record/sanitize.d.ts` |
| 1,974 | `dist/record/sanitize.js` |
| 4,206 | `dist/record/sanitize.js.map` |
| 2,518 | `dist/record/types.d.ts` |
| 354 | `dist/record/useAsyncOptions.d.ts` |
| 985 | `dist/record/useAsyncOptions.js` |
| 2,057 | `dist/record/useAsyncOptions.js.map` |
| 2,523 | `dist/shell/AppShell.d.ts` |
| 3,481 | `dist/shell/AppShell.js` |
| 7,469 | `dist/shell/AppShell.js.map` |
| 1,781 | `dist/shell/AppSwitcher.d.ts` |
| 4,631 | `dist/shell/AppSwitcher.js` |
| 8,636 | `dist/shell/AppSwitcher.js.map` |
| 1,896 | `dist/shell/MobileNav.d.ts` |
| 6,392 | `dist/shell/MobileNav.js` |
| 11,039 | `dist/shell/MobileNav.js.map` |
| 1,865 | `dist/shell/Navbar.d.ts` |
| 3,546 | `dist/shell/Navbar.js` |
| 7,058 | `dist/shell/Navbar.js.map` |
| 1,701 | `dist/shell/NotificationPanel.d.ts` |
| 7,593 | `dist/shell/NotificationPanel.js` |
| 12,533 | `dist/shell/NotificationPanel.js.map` |
| 2,099 | `dist/shell/Sidebar.d.ts` |
| 8,077 | `dist/shell/Sidebar.js` |
| 14,543 | `dist/shell/Sidebar.js.map` |
| 1,349 | `dist/shell/nav.d.ts` |
| 962 | `dist/shell/nav.js` |
| 2,740 | `dist/shell/nav.js.map` |
| 1,184 | `dist/styles/base.css` |
| 5,647 | `dist/styles/full-base.css` |
| 111,284 | `dist/styles/full.css` |
| 12,622 | `dist/styles/glass.css` |
| 17,238 | `dist/styles/theme.css` |
| 6,977 | `dist/tailwind-preset.cjs` |
| 99 | `dist/tailwind-preset.d.cts` |
| 2,431 | `dist/theme/ThemeProvider.d.ts` |
| 5,806 | `dist/theme/ThemeProvider.js` |
| 12,382 | `dist/theme/ThemeProvider.js.map` |
| 9,658 | `dist/theme/messages.d.ts` |
| 29,078 | `dist/theme/messages.js` |
| 43,329 | `dist/theme/messages.js.map` |
| 333 | `dist/toast/Toaster.d.ts` |
| 851 | `dist/toast/Toaster.js` |
| 1,828 | `dist/toast/Toaster.js.map` |
| 383 | `dist/toast/index.d.ts` |
| 137 | `dist/toast/index.js` |
| 91 | `dist/toast/index.js.map` |
| 23,463 | `docs/CONSUMING.md` |
| 12,398 | `docs/FEATURES.md` |
| 9,889 | `docs/FRAPPE.md` |
| 7,248 | `docs/LIMITATIONS.md` |
| 5,053 | `package.json` |

## Behaviour change added after this checklist was written

- **List columns capped by width (since 0.4.0-dev.32):** `FrappeListView` caps the columns it generates from the DocType as Desk does (`list_view.js:432-444`: 4 at ≤1366 px, 6, 10 at ≥1920 px; List View Settings `total_fields` wins). App-curated `columns` are never capped. `columnLimit={false}` restores every `in_list_view` column.
- **Export offered to everyone (since 0.4.0-dev.32, owner decision):** reverses the dev.28 gate. The list's Export appears for every user, as in Desk; the server refuses a user without the right and the dialog shows the refusal. Hide it with `menu={{ export: canExport(session, levels[0]) }}`.
- **Import navigates to the Data Import list (since 0.4.0-dev.32):** default `/app/data-import?reference_doctype=<doctype>` (was `/app/data-import/new?…`). `onImport` still overrides (e.g. to open `FrappeDataImport`).
- **"Export as report" in the list menu (since 0.4.0-dev.32):** a package addition — Desk offers report-view export only in the Report view. Shown with the export right; on a real site `export_query` writes an Access Log row.
- **`useListState` visible columns (since 0.4.0-dev.31):** until the user picks columns, the visible set follows changes in the columns' default visibility (List View Settings arriving after the first render now apply).
- **`useImportStatus` query key (since 0.4.0-dev.32):** `["sf-frappe", "data-import", name, since ?? null]` (a fourth element); prefix invalidation is unaffected.
- **Form without permission information (since 0.4.0-dev.32, Phase 27 P2-1):** `FrappeFormView` without a `permissions` prop no longer assumes every right. It is read-only: no Save / Submit / Update / Cancel / Amend, no Ctrl+S, fields shown read-only (blank ones hidden, child tables without Add Row, no naming prompt), and the "Read only" notice (`data-permissions="unknown"`). Pass `permissions={usePermissions(bundle, doc, docinfo)}` (or your own `{ can, levels, known }`); `FrappeForm` already does.
- **Cancel All (since 0.4.0-dev.32, Phase 27 P3-1):** the "Cancel All" button for linked submitted documents is offered only when `canCancelAllLinked` answers `true`. Missing or `undefined` (e.g. `FrappeForm` without `session.roles`) now shows the explanation marked `data-permissions="unknown"` instead of the button; `false` keeps Desk's explanation.
- **Workflow doc without roles shows "Read only" (since 0.4.0-dev.32, Phase 27):** `usePermissions().known` is `false` for a saved document in a workflow when `session.roles` is missing (it was already read-only since dev.26, but without the notice).
- **Workflow actions without roles (since 0.4.0-dev.32, Phase 27 P2-3):** the actions remain the server's `get_transitions` answer (authoritative; the server filtered by the session user's roles). `useWorkflow().readOnly` is now `true` for a saved doc without `roles` (was `false`). `visibleTransitions` without `roles` returns `[]` unless called with `fromServer: true` (the list is the server's answer); without a `user` it keeps only `allow_self_approval` transitions. New `useWorkflow().transitionsKnown` / `refetchTransitions` and `transitionsKnown()`. `FrappeWorkflowActions` shows the error (failed `get_transitions`) or the "Read only" notice (unknown user) next to the state instead of an empty Actions slot. `FrappeForm` hides Save / Cancel for workflow actions only when a session user exists.
- **Administrator without a role list (since 0.4.0-dev.32, Phase 27 P2-4):** `canImport` / `canExport` accept the session in place of the role list (`canImport(meta, session, levels[0])`): `{ user: "Administrator" }` may import an `allow_import` DocType and always export, as the server does (its roles are every Role). Workflow transitions are not filtered by an app-supplied role list for the Administrator, and a workflow state never makes it read-only.
- **"Administrator" role on another user (since 0.4.0-dev.32, Phase 27 P3-6):** `canCancelDoctype` (Cancel All) no longer treats a session that merely lists the "Administrator" role as the Administrator; it reads that role's DocPerm rows like any role (the server only reports that role for the Administrator user).
- **Light-mode popups (since 0.4.0-dev.29):** popovers, dropdown / context menus, menubar panes, select lists, the command palette, hover cards, dialogs, alert dialogs and sheets are solid white (`--popover`) with no backdrop blur in light mode; dark mode keeps the glass. The list's filter, saved-filter and column popovers keep their own inline opaque surface (`--background`, near-white) in both modes.
- **Permissions without roles (since 0.4.0-dev.26, Phase 26 rule 9):** `FrappeForm` / `usePermissions` for a NEW doc with no `session.roles` is now read-only/denied (no fields, no Save; `usePermissions().known === false`, the toolbar says "Read only") — pass `session.roles` to `FrappeProvider`. A saved doc without roles gets exactly the server's `docinfo.permissions` (+ its `shared` row) at level 0 and nothing at permlevels > 0 (previously inferred from the doc's fields); a saved doc in a workflow is read-only without roles. `session.user === "Administrator"` gets everything (as the server does). The list's bulk "Assign To" is offered with read (or write) instead of write only (Desk offers it unconditionally; the server checks read per document).
- **List errors (since 0.4.0-dev.25):** the Frappe list renders `FrappeErrorState` per error kind. A 403 / not-found / validation error no longer offers Retry (0.3.x offered Retry on every error); network / server / rate-limited / unavailable still do.
