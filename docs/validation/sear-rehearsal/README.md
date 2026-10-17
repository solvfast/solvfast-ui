# Integration rehearsal: @solvfast/ui 0.1.0-rc.1 inside a copy of Sear's frontend (2026-10-17)

A disposable copy of Sear's frontend (and of the Design System sources its `@ds` alias points at) was made in the
session's temporary folder. The RC tarball was installed into it, the package was wired in, and the copy was checked
before and after. **Sear's repository, PMO, the Frappe apps, the benches and the published Design System were not
modified** (verified afterwards against hashes taken before). No network was used for installing, and no live
environment was contacted. **Real-site Frappe validation is still deferred** — the Frappe page used a simulated site.

## What was wired in (`integration.diff`)

1. `yarn add file:solvfast-ui-0.1.0-rc.1.tgz --offline` (local tarball + local cache only).
2. Tailwind: the package preset, `node_modules/@solvfast/ui/dist/**/*.js` in `content`, and Sear's own
   `tailwindcss-animate` removed from `plugins` (the preset includes it — see Issue 1).
3. CSS: Sear's three `@tailwind` directives written as the equivalent `@import "tailwindcss/…"` lines, then
   `@import "@solvfast/ui/theme.css"` (Issue 2); `@solvfast/ui/glass.css` imported after the Design System's glass.
4. `ThemeProvider` driven by Sear's `AppContext` (`theme`, `language`, `storageKeys={null}`) around the app.
5. Two routes inside Sear's studio layout, not in its navigation: a `ListView` over Sear's Field Library store, and a
   `FrappeListView` on ToDo against the package playground's simulated Frappe site (with a hidden probe reporting
   which React Query client it uses — rehearsal only).

## Checks

| Check | Result | Evidence |
|---|---|---|
| Offline install | ✅ 1 package added, every dependency already satisfied; no existing package changed version | `install-typecheck-build.txt` |
| One copy of shared libraries | ✅ React, React DOM, React Query, Radix, lucide, cmdk, react-day-picker, …: one copy each; nothing nested under the package; one React and one React Query in the built bundle | `dedupe.txt` |
| Type check (Sear's tsconfig) | ✅ 329 errors before and after, the identical set (all pre-existing in Sear / the Design System); none in the integration files or the package's types | `install-typecheck-build.txt` |
| Production build | ✅ passes; Tailwind warnings back to Sear's 3 pre-existing ones once the duplicate plugin is removed (5 with it) | `install-typecheck-build.txt` |
| Sear's CSS | ✅ every rule of Sear's stylesheet still present (0 lost, 85 package rules added); with the duplicate plugin, 2 dialog animation rules were lost | `css-rules.txt` |
| Existing Sear pages look the same | ✅ 12 pages × light/dark × en/ar + 2 phone shots: 31 pixel-identical, 19 differ only where two baseline runs of unmodified Sear also differ (the top bar, ≤13/255), 0 changed. Workflow components excluded: it differs between baseline runs by itself | `visual-existing-pages.txt` |
| Focus rings and transitions on Sear's own elements | ✅ identical before/after (16 focused elements, with and without reduced motion) | `focus-motion.txt` |
| ThemeProvider integration | ✅ follows Sear's theme and language toggles (html classes, the list's colours, Arabic strings and RTL), keeps them after reload, stores nothing of its own | `behaviour.txt` T1–T5 |
| ListView in Sear | ✅ Sear's store data, search, glass filter popover in the theme scope, column manager, delete with a red confirmation through Sear's store, row click through Sear's router, fits a 390 px phone inside Sear's shell | `behaviour.txt` L1–L8, M1 |
| FrappeListView in Sear | ✅ uses Sear's own React Query client; rows, total and search through the Frappe request path (simulated site) | `behaviour.txt` F1–F4 |
| Download size, existing pages | +about 10 kB JS (+4–5 kB gzip) and +24 kB CSS (+1.7 kB gzip) per page; list code loads only on its pages | `page-weight.txt` |
| Sear's own test suite | ⏭ not run: its Playwright suite drives the live site (`lovable.solvfaster.com`); Sear has no unit tests | — |

`pages-in-sear.webp`: the two rehearsal pages inside Sear's shell (light English, dark Arabic).

## Issues found

1. **Duplicate `tailwindcss-animate`.** The preset includes the plugin; a host that also lists it registers it twice.
   Tailwind then finds some utilities ambiguous and drops them — in Sear, the dialog's
   `data-[state=open]:slide-in-from-top-[48%]` and `data-[state=closed]:slide-out-to-top-[48%]` (invisible in
   reduced-motion screenshots; found by comparing stylesheets). Fix: remove it from the host's `plugins`. Documented
   in the proposed docs patch; no package code change needed.
2. **Hosts with `@tailwind` directives** can't add `@import "@solvfast/ui/theme.css"` after them (an `@import` must come
   first). Fix: use the equivalent `@import "tailwindcss/…"` lines. Docs gap (proposed patch).
3. **Apps that already own theme and language** must drive `ThemeProvider` from their state. Works exactly as
   designed; the docs didn't show it (proposed patch).

No defect in the package's code was found.

## Proposals (not applied)

- `proposed-docs-existing-apps.patch` — CONSUMING: Issues 1–3 with the verified recipe and costs.
- `proposed-licence.patch` — a neutral licence representation while the decision is pending: LICENSE says the
  licence is not decided and names Solvfast as the intended copyright holder; `package.json` `license` becomes
  `SEE LICENSE IN LICENSE` (was `MIT`); README and docs say the same; a THIRD-PARTY-NOTICES.md carries shadcn/ui's
  MIT notice (the primitives derive from shadcn/ui via the Design System); the publish guard keeps blocking.
