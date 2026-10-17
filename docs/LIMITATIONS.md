# Known limitations — @solvfast/ui 0.1.0-rc.1

What this release candidate does **not** do, has **not** been verified, or does differently from Sear on purpose.
Evidence for everything that *was* verified is in docs/VALIDATION.md.

## Validation status

| Area | Status |
|---|---|
| Core (theme, primitives, shell, List View) | Verified: unit tests, pixel parity with Sear's real components, clean installs (Tailwind and no-Tailwind) |
| Frappe layer — simulated requests | **Passed**: exact request shapes, filters, search, counts, errors, link search, grouping, against a recording transport and a simulated Frappe site (docs/VALIDATION.md, 5.4) |
| Frappe layer — a real Frappe site | **Deferred — not done.** It will be validated when the package is first integrated into a real project. Until then nothing here claims it works against a live site. A prepared, never-run procedure is in `e2e/frappe-site/` |

## Environment

- React 18.3 only; React 19 untested. Tailwind 3.4 (path A) or no Tailwind (path B); Tailwind 4 untested.
- Frappe 15 only (built and tested against the 15.110 source); other versions untested.
- Browsers: all visual and interaction checks ran in Chromium (Playwright). Firefox and Safari are untested; the glass
  styles include `-webkit-backdrop-filter` and fall back to more opaque, blur-free surfaces without `backdrop-filter`
  or under `prefers-reduced-transparency`.
- Accessibility: names, roles, keyboard rows, `aria-sort`, focus rings, reduced motion and reduced transparency are
  tested automatically; no manual screen-reader pass has been done.

## Intended differences from Sear

Documented with screenshots in docs/VALIDATION.md and docs/FEATURES.md.
- List: row actions are a fixed last column (8 of 44 parity shots); the toolbar wraps on phones (4 of 44).
- Shell: notification panel glass in dark mode, Arabic app-switcher labels, current-app highlight, "More" sheet on the
  start edge in Arabic (14 of 44 shell parity shots).
- Buttons: 180 ms hover / 120 ms press on every variant (Sear's glass buttons use 0.4 s / 0.16 s).
- List: grouped rows share one table and column layout.

## Rendering

- Path B (no Tailwind): a sheet whose edge falls on a half pixel (e.g. the 75 %-wide sheet at 390 px) can anti-alias
  slightly differently from path A; glass can re-rasterize slightly differently after a stylesheet is added at runtime
  (≤27/255 seen). Computed styles are identical.
- Badge `brand` uses `bg-primary/12`, which Tailwind 3 doesn't generate (as in Sear today) — kept for parity.

## List View

- Client mode keeps every row in memory and renders the visible page; there is no virtualization (large data sets:
  use server mode).
- Server mode: the selection keeps keys across pages, but `bulkActions` receive row objects only for rows on the
  current page (keys for all).
- Grouped: collapsing a group can re-balance column widths (all groups still share the header's columns).

## Frappe layer

- Auth: same-origin session cookie + CSRF only. Other schemes need a custom `transport`.
- Frappe accepts one `or_filters` list: with "Match any" filters, search narrows to the title field (the list says so).
- Grouping is client-side over loaded rows (chunks of 200, "Load more"); group counts are exact only once all rows are
  loaded (until then they end in "+").
- DocField labels and Select values are shown as defined on the server; pass `fieldLabels` / curated columns for
  translations.
- Not supported: child tables, virtual DocTypes, realtime updates, report-view features (SQL group-by, aggregates),
  Frappe's per-user list settings.
- Datetime filters compare in the server's time zone, as Frappe does.

## Packaging and release

- Not published. The licence is **not decided** (intended copyright holder: Solvfast); `npm publish` is blocked until
  it is (and until HEAD is tagged and the tree is clean — `scripts/prepublish-check.mjs`).
- Dependencies are pinned to the exact versions tested; consumers on other versions of the same libraries (e.g.
  `lucide-react`, Radix) get a second copy.
- Installing from GitHub Packages needs the consumer's own GitHub token with `read:packages` (docs/CONSUMING.md).
