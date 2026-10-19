# Known limitations — @solvfast/ui 0.3.0

What this release does **not** do, has **not** been verified, or does differently from Sear on purpose.
Evidence for everything that *was* verified is in docs/VALIDATION.md.

## Validation status

| Area | Status |
|---|---|
| Core (theme, primitives, shell, List View) | Verified: unit tests, pixel parity with Sear's real components, clean installs (Tailwind and no-Tailwind) |
| Merged components (0.3.0) | Verified: unit tests, showcase in light/dark × en/ar, clean installs on both paths. **Pixel parity with Sear not run** for them: their look is the Design System's code with the package's tokens and popper glass. Sear uses only a few (Alert, Accordion, HoverCard, Progress, on a handful of Sear Studio screens); a reference for those could be added to `tools/parity` later |
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

## Merged components (0.3.0)

- **Not shipped:** drawer (vaul), carousel (embla-carousel), input-otp, resizable (react-resizable-panels: v2 in Sear and
  the Design System, v4 in PMO and the starter). Apps keep their local shadcn copies; with the preset (path A) their
  token utilities follow the package theme, without the glass surfaces (docs/CONSUMING.md §7).
- The navigation menu's panel (Radix `Viewport`) is not portaled — Radix renders it inline, positioned against the menu
  root. It carries the popper glass but can be clipped by an ancestor with `overflow: hidden`.
- The dropdown menu's sub-menu chevron still points right in Arabic (unchanged from 0.2.0); the new context menu and
  menubar sub-menus mirror theirs.
- Charts: recharts draws left-to-right; in Arabic reverse the category axis yourself (`<XAxis reversed={isRTL} />`).
  recharts 2's own type declarations import lodash types — with `skipLibCheck: false` the app also needs
  `@types/lodash`. recharts 2 is in maintenance upstream (v3 exists; the Design System's chart targets v2).
- SearchCombobox: no cache between comboboxes or openings (each opening searches again); `queryKey` only resets.
- RichTextEditor uses `contenteditable` + `document.execCommand` (deprecated but still supported by browsers), as in
  PMO. `sanitizeHtml` keeps only absolute `http(s):` / `mailto:` links (relative links lose their `href`) and drops
  every attribute — no images, tables, colours or alignment.
- PageHeader's title goes to the AppShell top bar only for text titles; a node title stays in the page (then the page
  has two `<h1>`s: the top bar's and the header's).

## Toasts

- Only sonner's API (`toast()`); shadcn's `useToast()` / `use-toast` is not provided.
- In dark mode a toast is black: sonner's own dark styles outrank the card classes — the same as in the Design System
  and Sear (parity identical).
- sonner 1.7 and 2.x both work (clean installs of each); their default offsets differ by 8 px.

## Packaging and release

- Proprietary (LICENSE): for Solvfast and those it authorises. Published only to GitHub Packages, as a private package;
  `npm publish` is blocked until HEAD is tagged and the tree is clean (`scripts/prepublish-check.mjs`).
- Dependencies are pinned to the exact versions tested; consumers on other versions of the same libraries (e.g.
  `lucide-react`, Radix) get a second copy.
- Installing from GitHub Packages needs the consumer's own GitHub token with `read:packages` (docs/CONSUMING.md).

## Date filters (Frappe's operators, 0.3.0)

- Fiscal Year needs the site's "Fiscal Year" DocType (ERPNext) and read access to it. Without it the option isn't offered.
- Frappe also offers In / Not In on Date fields. The package doesn't: their date-list input isn't built.
- Client-mode Timespans use Sunday as the first day of the week (Frappe's default). A site that changed
  System Settings → First Day of the Week gets that day on the server (FrappeListView) but Sunday in client mode.
- Labels outside dates keep the package's wording ("Contains", "Not equals", "Is set" shown as Is → Set / Not Set);
  only the date operators use Frappe's labels.
