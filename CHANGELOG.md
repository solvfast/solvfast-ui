# Changelog — @solvfast/ui

Versioning: SemVer 0.x — patch = no API or visual change; minor = additive or intentional visual change;
breaking changes bump the minor while in 0.x and are labelled **BREAKING**. Tags are created only on a clean tree,
with the owner's approval. Releases are published by the owner (GitHub Packages, `@solvfast` org).

## [Unreleased]

### Changed
- Licence metadata no longer states a licence while the decision is pending: LICENSE says the licence is not decided
  and names Solvfast as the intended copyright holder; `package.json` `license` is `SEE LICENSE IN LICENSE` (was
  `MIT` in 0.1.0-rc.1, whose LICENSE held the MIT text with a pending holder). README and docs say the same.
- `THIRD-PARTY-NOTICES.md`: the MIT notice of shadcn/ui, from which the primitives derive (via the Design System).
  It ships in the tarball.

## [0.1.0-rc.1] — 2026-10-17 — release candidate (not published)

The first release candidate: theme and primitives (5.1), app shell (5.2), List View (5.3) and the optional Frappe
layer (5.4), with the changes from their reviews. Not published; the owner publishes (docs/RELEASING.md).

**Validation status:** core verified (unit tests, pixel parity with Sear's real components, clean installs for both CSS
paths). Frappe layer: simulated-request tests **passed**; **real-site validation deferred** until the package is
integrated into a real project — not done (docs/LIMITATIONS.md).

### Release preparation (5.5)
- `package.json`: version `0.1.0-rc.1`; `repository` (`solvfast/solvfast-ui`); the tarball also carries CHANGELOG,
  VENDORED and the user docs; scripts `check:package` and `prepublishOnly` (refuses to publish without a clean tree, a
  `v<version>` tag on HEAD and a named copyright holder).
- Package audit in the build (`scripts/check-package.mjs`): exports exist and have types, every import in `dist/` is a
  declared dependency, no unused dependency, no absolute local path in the tarball.
- Docs: `docs/LIMITATIONS.md` (one list of what is not done, not verified or intentionally different),
  `docs/RELEASING.md` (checklist), README rewritten, install-from-GitHub-Packages section in CONSUMING.
- `e2e/frappe-site/`: a prepared real-site validation procedure — **never run**.

### Fixed (5.5)
- Frappe types: `useFrappeMeta`'s `refetch` no longer exposes `@tanstack/query-core` types in the published
  declarations (that package isn't a dependency; strict installers couldn't resolve it). It is now
  `() => Promise<void>`.

### Added — increment 5.4 (Frappe layer, `@solvfast/ui/frappe`)
- `FrappeListView` (ListView over a DocType), `useFrappeList`, `useFrappeMeta`, `FrappeProvider`, `createFrappeClient`
  (same-origin session cookie + CSRF; replaceable transport), `FrappeError`, `frappeRetry`, `invalidateFrappeList`,
  and the pure helpers `buildFrappeListMeta`, `columnsFromMeta`, `filterFieldsFromMeta`, `queryToFrappe`,
  `conditionToFrappe`, `buildListRequest`, `frappeLinkSearch`. Stock methods only: `getdoctype`, `client.get_list`,
  `reportview.get_count`, `search.search_link`. Docs: docs/FRAPPE.md.
- Core additions used by it (usable on their own): `ListView` `searchHint`; `useListState` `selectionScope`; rich-text
  cells (Frappe Text Editor HTML) shown as plain text; messages `fieldId`, `fieldCreated`, `fieldModified`,
  `searchTitleOnly`.
- Rule C2 (Frappe's single `or_filters` list): search uses it across the search fields with "Match all" filters, and
  narrows to the title field with a visible note with "Match any" filters.

### Fixed — Frappe (relative to Sear's never-run Frappe path; docs/FEATURES.md)
- Totals honour "Match any" filters (`reportview.get_count`; Sear sent `or_filters` to `frappe.client.get_count`,
  which drops them).
- Requests never name fields the DocType doesn't have (an old saved filter or a render-only column made Frappe
  reject the whole request).
- A date on a Datetime field matches the whole day; Dynamic Link fields filter as text; ID / Created On / Last Updated
  are localized; link filter values use Frappe's link search.

### Changed — after the 5.3 review
- List View: every filter-row control has an accessible name (Field / Condition / Value / Match); they were unnamed
  comboboxes, as in Sear and PMO.
- List View: no pager or total while the list shows an error.
- List View on phones: the toolbar's buttons wrap instead of widening the page (Sear's list page was 506 px wide at
  390 px, with its page action cut off). Desktop unchanged.
- List View, grouped: all groups are sections of one table (a header row per group with collapse, count and the
  group's select-all), so they share the header's column order and widths; the table scrolls horizontally inside its
  card when narrow. The header's select-all covers the rows on screen (expanded groups). Was one table per group (PMO),
  whose columns didn't line up. New message key `selectGroup`.
- Buttons: the glass variants (default, secondary, outline, ghost, destructive) now use the DS Button's documented
  motion — 180 ms hover, 120 ms press (design_system `button.tsx`, v0.3.0) — instead of the glass engine's 0.4 s /
  0.16 s, which they had in Sear. Nothing else changes: an audit of every element's transition on the primitives,
  shell and list pages differs only on buttons; no motion under `prefers-reduced-motion`; the list pager keeps
  Sear's 150 ms.

### Added — increment 5.3 (List View)
- `ListView` — Sear's data grid (toolbar, glass table, pill pager) with PMO's list features as props: selection and
  bulk actions, group-by, sort menu, quick filters of any type with a field picker, row actions with confirm,
  conditional row styles, keyboard rows, loading / empty / error states. Client and server data modes.
- `useListState` (headless) and the parts: `ListTable`, `GroupedListTable`, `DefaultCell`, `FilterBuilder`,
  `FilterValueInput`, `SavedFilters`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`,
  `BulkActionBar`; the filter model (`applyFilterQuery`, 12 operators), `compareValues` / `sortRows`, `groupRows`,
  `mergeColumns`, storage adapters (`createLocalStorageAdapter`, `ListPrefsStorage`, `SavedFiltersStorage`).
- List strings in Arabic and English. Coverage per feature: docs/FEATURES.md.

### Fixed — list (relative to Sear and PMO; details in docs/FEATURES.md)
- Row actions are a fixed last column — no longer offered in the column manager, the filter fields or sorting.
- Non-sortable columns have no sort button; sorted headers carry `aria-sort`; rows open with Enter.
- Load errors are shown with Retry (Sear's grid showed nothing).
- Sorting: empty values last in both directions; text such as "Room 101" no longer sorts as a date; natural order.
- Server mode: search and text filters wait for a typing pause (one request, not one per keystroke).
- Selection is pruned when search or filters change; a group's select-all reflects that group.
- Filter value inputs keep focus while typing; filter condition ids never collide.
- Saved-filter storage failures reach the app (`onSavedFiltersError`) instead of being swallowed.

### Added — increment 5.2 (app shell)
- `AppShell`, `Sidebar`, `Navbar`, `MobileNav`, `AppSwitcher`, `NotificationPanel` — Sear's StudioShell with its
  navigation, routing, switcher sections, notifications, help and search supplied by the app; `NavItem` model with
  any nesting depth; `relativeTime` / `timeGroup`; shell strings in Arabic and English.

### Fixed — shell (relative to Sear)
- Notification panel is glass in dark mode too (Sear's dark override made it opaque).
- Mobile "More" sheet opens on the start edge in Arabic (Sear: the left edge).
- The app switcher highlights the current app (Sear's name comparison never matched).
- The top bar renders without a provider; app-switcher and shell labels are localized (Sear's were English-only).

### Added — increment 5.1 (foundation)
- Core entry `@solvfast/ui`: `ThemeProvider` (`useTheme`, `useLocale`, `usePortalContainer`), `cn`, and 23 primitives
  vendored from the DS v0.3.0 with Sear's effective look (VENDORED.md), plus `DateField` / `TimeField` / `DateTimeField`.
- Styles: `theme.css` + `glass.css` (+ opt-in `base.css`) for Tailwind 3 apps with the `tailwind-preset`;
  `full.css` (+ opt-in `full-base.css`) precompiled for apps without Tailwind.
- `LICENSE`: full MIT terms; the copyright holder is pending the owner's confirmation.
- Tooling: pinned `upstream/` sources, CSS extraction, boundary check, Sear parity harness (`tools/parity`),
  clean-consumer test (`e2e/consumers`).

### Fixed (relative to Sear / the DS)
- Popovers, selects and menus fall back to a solid surface under `prefers-reduced-transparency` and without
  `backdrop-filter` (Sear's popper glass out-ranked the DS fallbacks).
- Button motion durations 180/120 ms now emit CSS (DS D5) — effective on `ai-outline` and Calendar day buttons; glass
  buttons keep the glass engine's timings, as in Sear. No motion under `prefers-reduced-motion` (verified).
- Path B: Tailwind's preflight is also applied to the scope element's own `::before`/`::after`.
- Hooks never throw outside `ThemeProvider` (Sear's Navbar crashed without its provider).
