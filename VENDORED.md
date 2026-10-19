# Provenance of vendored code

`@solvfast/ui` does not depend on `@solvfast/design-system` at runtime. The pieces it needs were **copied at pinned
revisions** and adapted here. Pristine copies of every source file are kept in `upstream/` (SHA-256 in
`upstream/SHA256SUMS`), so any file can be diffed against its origin.

| Source | Revision | Pristine copy |
|---|---|---|
| SOLV FAST Design System (`apps/design_system`) | tag `v0.3.0` = `92fc1cd` | `upstream/ds-v0.3.0/` (via `git show v0.3.0:…`) |
| Sear (`apps/sear_product`) | `7abc895-dirty` (HEAD `7abc895` + 231 uncommitted entries, snapshot 2026-10-14) | `upstream/sear-7abc895-dirty/` |
| Solvfast PMO (`apps/solvfast_pmo`, not a git repo) | file hash | `upstream/pmo/` |
| Frappe (`apps/frappe`, read-only reference for 5.4) | v15.110.0, `ab7e5ae` | `upstream/frappe-15.110-ab7e5ae/` (ToDo DocType definition) |

## Rules applied to every vendored file
1. `@/…` imports → relative imports. Sear-only aliases (`@sear/…`) → package modules.
2. **Class rename**: every custom (non-Tailwind) class the DS CSS defines is prefixed `sf-`. The same map is used
   for CSS and TSX (`styles/rename-map.json`, 85 classes; Tailwind's `dark` is not renamed). In TSX the rename is
   applied inside string literals only (`scripts/vendor-primitives.mjs`).
3. Portals render into `usePortalContainer()` (element-scope theming).
4. Patterns (Stepper 0.2.0; PageHeader and EditableTitle 0.3.0) live in `src/primitives/` like the primitives — no separate `src/patterns/` boundary area.

## Files

| Package file | From | Hand changes after vendoring |
|---|---|---|
| `src/primitives/{input,label,badge,card,textarea,switch,avatar,separator,checkbox,scroll-area,skeleton,command}.tsx` | DS `components/ui/*.tsx` | rename + imports only |
| `src/primitives/tabs.tsx` | DS `ui/tabs.tsx` (Radix) + Sear `sear_studio/components/SegmentedTabs.tsx` (untracked in Sear at the `7abc895-dirty` snapshot; copy + sha256 in `upstream/sear-7abc895-dirty/`) | Radix structure and keyboard handling kept (arrow keys follow the reading direction through the theme's DirectionProvider; Home/End); **look replaced by Sear's**: the DS underline strip → SegmentedTabs' liquid-glass pill rail (`sf-glass !rounded-full p-1`) and pill tabs (`rounded-full px-3 py-1`, active `font-medium text-primary` without a fill — as Sear's code renders, although its header comment still mentions a `bg-primary/10` tint). Sear's `fullWidth` / `compact` are classes here (`flex w-full` on the list, `min-w-0 flex-1` and `text-xs [&_svg]:size-3.5` on the tabs) |
| `src/primitives/button.tsx` | DS `ui/button.tsx` | **Subset**: variants default, secondary, outline, ghost, destructive, ai-outline (Sear's 359 `<Button>` uses + its 2 dynamic variants) and `text` (used by Calendar's day buttons); sizes xs, sm, default, icon, icon-sm. Dropped: gradient, gradient-alt, neutral, ai-text, link, success, warning; lg, xl, icon-lg, fab. **D5 fix**: `duration-[180ms]` / `active:duration-[120ms]` (ambiguous in Tailwind 3.4, emitted no CSS) → `duration-180` / `active:duration-120` (defined by the preset); base class `sf-button` (marks package buttons so glass variants keep the documented 180/120 ms, `styles/src/sf-fixes.css`) |
| `src/primitives/{popover,select,dropdown-menu}.tsx` | DS | + `sf-popper` on the popup surface (Select only when `position="popper"`, the default) — carries Sear's popper glass (see styles) |
| `src/primitives/{dialog,alert-dialog,sheet,tooltip}.tsx` | DS | portal container; Dialog and AlertDialog content also carry `sf-glass-dialog` — Sear's glassy dialog (styles) |
| `src/primitives/calendar.tsx` | DS `ui/calendar.tsx` | dead `classNames.table` removed (react-day-picker 10 has no such slot — DS register B5); root also carries `sf-calendar`: on its own the calendar has the date pickers' glass and 16px radius instead of the DS's opaque square aurora panel; inside a popover nothing changes (styles) |
| `src/primitives/{table,radio-group}.tsx` (0.2.0) | DS `ui/table.tsx`, `ui/radio-group.tsx` (what Sear renders: its `components/ui/*` are shims onto them) | rename + imports only |
| `src/primitives/stepper.tsx` (0.2.0) | DS `patterns/Stepper.tsx` = Sear `sear_studio/components/Stepper.tsx` (untracked in Sear at the `7abc895-dirty` snapshot; copy + sha256 in `upstream/sear-7abc895-dirty/`) | `glass` → `sf-glass`; `label`, `note`, `srNote` and `ariaLabel` also take `{ en, ar }`; unused React import dropped |
| `src/toast/Toaster.tsx`, `src/toast/index.ts` (0.2.0, entry `@solvfast/ui/toast`) | DS `ui/sonner.tsx` (Sear mounts it in `main.tsx`) | theme and direction from the package's ThemeProvider (was the DS's `useApp`); sonner `Toaster` props pass through; `sonner` is an optional peer dependency (`^1.7` or `^2`), never imported by the core. Sear Studio's layout also mounts sonner's plain `<Toaster position="top-center" richColors />`; that second host is not carried over |
| `src/primitives/{alert,toggle,toggle-group,status-dot,pill,accordion,collapsible,slider,aspect-ratio}.tsx` (0.3.0) | DS `ui/*.tsx` v0.3.0 (byte-identical to PMO's `components/ui/*.tsx`) | rename + imports only (toggle-group imports `toggleVariants` from `./toggle`) |
| `src/primitives/progress.tsx` (0.3.0) | DS `ui/progress.tsx` (= PMO) | **bug fixes**: `value` reaches the Radix root (the DS kept it back: no `aria-valuenow`, always "indeterminate"); the fill starts at the reading start (`translateX(+…)` in RTL; the DS always filled from the left) |
| `src/primitives/{hover-card,context-menu,menubar}.tsx` (0.3.0) | DS `ui/*.tsx` (PMO's context-menu / menubar use `glass` on their surfaces instead of the DS's `glass-elevated glass-flush`; the DS version is vendored, like the dropdown menu) | popups portal into `usePortalContainer()` and carry `sf-popper`, exactly as `dropdown-menu.tsx`: HoverCard content (the DS had no portal at all; its `sf-glass` surface is kept — in Sear a hover card is plain `.glass` too); ContextMenu/Menubar content (portal container) and sub-content (`sf-popper`; rendered inside the parent's portal), `ContextMenuPortal` / `MenubarPortal` default to the container. Sub-menu chevrons `rtl:rotate-180`. `MenubarShortcut.displayname` → `displayName` (typo) |
| `src/primitives/navigation-menu.tsx` (0.3.0) | DS `ui/navigation-menu.tsx` (PMO: `glass` surface) | the viewport carries `sf-popper`, so its panel has the package's popper glass and its reduced-transparency fallbacks like every other menu surface. **Not portaled**: Radix renders the viewport inline, positioned against the menu root (no portal API); it stays inside the theme scope anyway. In Sear (no popper wrapper) the DS viewport would show the opaque elevated surface |
| `src/primitives/{breadcrumb,pagination}.tsx` (0.3.0) | DS `ui/*.tsx` (= PMO) | strings from the package messages (`breadcrumb`, `more`; `pagination`, `prevPage`, `nextPage`, `previous`, `next`, `morePages`), still overridable with props; separators and previous/next chevrons `rtl:rotate-180`; `BreadcrumbEllipsis` display name typo fixed. Pagination uses `buttonVariants` with `outline` / `ghost` and sizes `icon` / `default` only — all in the package Button subset, so nothing had to be mapped |
| `src/chart/chart.tsx`, `src/chart/index.ts` (0.3.0, entry `@solvfast/ui/chart`) | DS `ui/chart.tsx` (= PMO) | imports; a named `ChartTooltipContentProps` type so the published declaration refers to the app's recharts types instead of inlining the build's (deep `recharts/types/…` paths). `recharts` is an optional peer dependency (`^2.15.0`), never imported by the core |
| `src/form/form.tsx`, `src/form/index.ts` (0.3.0, entry `@solvfast/ui/form`) | DS `ui/form.tsx` (= PMO) | `Label` imported relatively from the core module (one copy in the app); `Form: typeof FormProvider` and an explicit `useFormField` return type, so the declarations refer to the app's react-hook-form (inferred, they inlined 7.79's `FormProvider` props, which 7.50 fails to type-check — found by the clean install on 7.50). `react-hook-form` is an optional peer dependency (`^7.50.0`) |
| `src/primitives/search-combobox.tsx` (0.3.0) | PMO `components/ui/search-combobox.tsx` (sha256 `e203ca554732…`) | **React Query removed** (the core never imports `@tanstack`): options in local state; `search(q)` runs at once on open and 200 ms after typing stops; responses to an older request are dropped; "Loading…" (`loading` message, `role="status"`) instead of "empty" while loading; errors show the empty text. `search` is read through a ref (an inline function doesn't refetch per render). `queryKey` optional — a reset key (options dropped and reloaded when it changes; no shared cache). Package Button (`outline`), Popover, Command |
| `src/primitives/rich-text-editor.tsx` (0.3.0) | PMO `components/ui/rich-text-editor.tsx` (sha256 `933fd9fbd07f…`) | **SECURITY**: `sanitizeHtml` rewritten — PMO unwrapped disallowed elements without visiting the children it moved up (`<font><img src=x onerror=…></font>`, `<section><a href="javascript:…">` passed through intact); now the output is rebuilt from an allowlist (text + the same tags, no attributes except an absolute `http(s):` / `mailto:` `href` on `<a>`), with script/style/iframe/object/embed/SVG/MathML/template… dropped with their content and every parse inert (`<template>`). `htmlIsEmpty` parses inertly (PMO: a live `<div>`, where `<img onerror>` runs). The editor writes only sanitized HTML into the page and emits sanitized HTML (PMO: raw), and re-syncs when `disabled` toggles. Look: `sf-field-fill` (Input/Textarea) instead of `border-input bg-background`; toolbar labels from the package messages; toolbar named (`ariaLabel` or "Text formatting"); focus ring on toolbar buttons. Classes `rich-text` → `sf-rich-text`, `rte-editable` → `sf-rte-editable` |
| `styles/src/sf-components.css` (0.3.0) | PMO `src/index.css:124-146` "Rich-text content" (sha256 `a37b5242731a…`) | renamed (`sf-rich-text`, `sf-rte-editable`), scoped with `:where(.sf-theme)` (no added specificity); appended to the END of theme.css by `scripts/extract-css.mjs` (so it reaches path A's theme.css and path B's full.css; existing rules unchanged) |
| `src/primitives/page-header.tsx` (0.3.0) | PMO `components/layouts/PageHeader.tsx` (sha256 `52b8fbcb146a…`) = DS `layouts/PageHeader.tsx` (= Sear's; pristine copy in `upstream/ds-v0.3.0/layouts/`) + back button + `meta` | router-free (`onBack`; `backTo` and react-router dropped); `backLabel`, default the `back` message; arrow from `useLocale`; the back button is the package's ghost `icon-sm` Button. In an `AppShell`, a text title (`string` / `{ en, ar }`) is published to the top bar through an internal context (`ShellTitleContext`; the last mounted header wins) and no in-page `<h1>` is rendered |
| `src/primitives/editable-title.tsx` (0.3.0) | PMO `components/layouts/EditableTitle.tsx` (sha256 `b37a2ee0865a…`) | the edit box has an accessible name (`ariaLabel` or the `editTitle` message; PMO's had none) and the field look (`sf-field-fill`); focus ring on the title button; a save or Esc closes the editor once (a blur while it unmounts can't save again) |
| `src/primitives/date-time-field.tsx` | Sear `sear_studio/components/DateTimeField.tsx` | imports; `useDirection` → `useLocale`; `field-fill` → `sf-field-fill`. **From PMO's DatePicker** (`components/ui/date-picker.tsx`): optional `captionLayout` / `startMonth` / `endMonth`, and the calendar opens on the selected date's month (`defaultMonth`). PMO's DatePicker is consolidated here (same `YYYY-MM-DD` contract, Sear look). **0.3.0**: with an `id` and no `aria-label`, Date/Time/DateTimeField no longer set `aria-label` (it overrode the `<label htmlFor>`); the value span gets `id="<id>-value"` and is the trigger's `aria-describedby`. Without an `id`, the old self-naming stays |
| `src/lib/datetime.ts` | Sear `sear_studio/lib/datetime.ts` | none |
| `src/lib/cn.ts` | DS `lib/utils.ts` (`cn` only) | comment |
| `tailwind-preset.ts` | DS `tailwind.preset.ts` + Sear `tailwind.config.ts` `brand.*` | + `transitionDuration` 120/180 (D5), + `safelist` of package classes, ESM import of the animate plugin |
| `styles/theme.css`, `glass.css`, `base.css` | DS `styles/ds.css`, `glass-ds/{tokens,engine}.css`, `glass/glass.css` | generated by `scripts/extract-css.mjs`: renamed, scoped to `.sf-theme`, unused rules shaken out, `dim`/`senaiy` themes and the OS auto-dark block dropped |
| `styles/src/sf-overrides.css` | Sear `sear-studio.css` | re-targeted from global selectors to package classes with the same specificity and cascade position (each rule cites its source lines); + reduced-transparency / no-backdrop fallbacks for the popper glass (bug fix); Sear's opt-in `.sear-glass-dialog` (`sear-studio.css:296-318`) is the default for Dialog and AlertDialog (`sf-glass-dialog`), with the popper glass's two fallbacks |

## App shell (increment 5.2)

| Package file | From (Sear, `7abc895-dirty`) | Changes |
|---|---|---|
| `src/shell/AppShell.tsx` | `sear_studio_app/StudioShell.tsx` (`StudioShell`) | same layout and classes (`sear-studio` → `sf-app`); brand, navigation, switcher, notifications, help and search are props; routing is `currentPath` + `onNavigate` (no react-router); rail state key configurable (Sear: `studio_sidebar_collapsed`); 0.3.0: provides the page-title context (a mounted `PageHeader`'s text title is the top bar's title unless `title` is set) and passes `mobile.primary` |
| `src/shell/Sidebar.tsx` | `StudioShell.tsx` `<aside>`, `SidebarItem`, `SidebarGroup` | recursive nesting (Sear: one child level); active rule kept (own href or a descendant, minus `exclude`) |
| `src/shell/Navbar.tsx` | `StudioShell.tsx` `TopBar` | title/help/search/notifications as props; works without a provider (**bug fix**: Sear's crashed); search is Sear's decorative input unless the app makes it controlled |
| `src/shell/MobileNav.tsx` | `StudioShell.tsx` `StudioMobileNav` | **bug fix**: "More" sheet opens on the start edge in both directions (Sear: left edge in Arabic) and slides in from it; sr-only sheet title; 0.3.0: optional `primary` (the bar's items; "More" then lists the whole tree, indented) — omitted, Sear's behaviour |
| `src/shell/AppSwitcher.tsx` | `StudioShell.tsx` `AppSwitcher` + `shared/injection/binaDropdown.js` data shape | sections from props (no `WORKSPACE_SECTIONS`, no `/client-s-ia` URLs); **bug fix**: current app matched by `id` (Sear compared "Sayr Studio" with "Sear Studio", so it never highlighted); localized strings; trigger uses the package Button instead of an inlined copy of its classes |
| `src/shell/NotificationPanel.tsx` | `sear_studio/components/NotificationCenter.tsx` | data and callbacks from props (Sear's in-memory store and demo data stay in Sear); **bug fix**: dark-mode `dark:bg-[#1b1622]` no longer overrides the glass; `#512195` → `--color-deep-violet` (same colour); portals into the theme scope |
| `src/lib/relative-time.ts` | `sear_studio/pages/Notifications/notificationCenterStore.ts` (`timeGroup`, `relativeTime`) | none |
| `src/shell/nav.ts` | `StudioShell.tsx` (`isPathActive`, title rule) | `NavItem` with `id`, localized `label`, `href`; `defaultIsActive`, `deepestActive` |

Playground only (not published): `playground/src/demo/sear-demo.ts` restates Sear's `NAV_ITEMS`, `WORKSPACE_SECTIONS`
and notification seed as package props; `playground/src/demo/sear-assets/` are copies of the Sear images they use.

## List View (increment 5.3)

Sear renders the DS DataGrid (`design_system` v0.3.0 `components/data-grid/*`) with its own engine (`hooks/useDataGrid.ts`,
`lib/data-grid/*`); PMO has its own list components. The package keeps Sear's markup and classes and merges PMO's
features in; feature-by-feature coverage and the fixes are in docs/FEATURES.md.

| Package file | From | Changes |
|---|---|---|
| `src/list/model/filters.ts` | Sear `lib/data-grid/filter-engine.ts` = PMO `lib/filter-engine.ts` (semantically identical) + PMO `lib/quick-filters.ts` | one copy; operator labels are message keys; condition ids unique per page load (**bug fix**, PMO restarted per mount) |
| `src/list/model/sort.ts` | Sear `hooks/useDataGrid.ts` (`compareValues`) + PMO `lib/list-view.ts` (`sortRows`, `sortValue`) | natural string order (PMO); **bug fixes**: empty values last in both directions; only real dates compare as dates |
| `src/list/model/columns.ts` | PMO `lib/list-view.ts` (`ColumnDef`), `lib/meta-columns.tsx` (merge) | localized labels; type / fieldtype for default cells and filters |
| `src/list/model/group.ts` | PMO `components/lists/GroupedListTable.tsx`, `GroupByControl.tsx` | pure function |
| `src/list/model/storage.ts` | Sear `lib/data-grid/storage.ts`; PMO `lib/list-view.ts` prefs | adapter interfaces (sync or async); localStorage default namespaced `sf:list:[user:]<view>:` |
| `src/list/useListState.ts` | Sear `useDataGrid` (client "mock" mode, paging) + PMO `components/lists/useListView.ts` | headless; server mode via `onStateChange`; rules C1 / C3; **bug fixes**: debounced filters, pruned selection |
| `src/list/parts/ListTable.tsx` | DS `DataGrid.tsx` table + Sear `lib/data-grid/cell-render.tsx` + PMO `ListTable.tsx`, `GroupedListTable.tsx` | Sear's classes; PMO selection, keyboard rows, `rowClassName`, groups (in one shared table — PMO drew a table per group); **bug fixes**: no sort button on non-sortable columns, `aria-sort`, error state, group select-all |
| `src/list/parts/FilterBuilder.tsx` | DS `AdvancedFilter.tsx`, `FilterValueInput.tsx` + PMO `AdvancedFilter.tsx`, `FieldCombobox.tsx`, `ui/date-picker.tsx` | Sear's layout; PMO searchable field picker drawn as Sear's select; `DateField` instead of a native date input; link options via `loadOptions` (300 ms debounce); **bug fix**: value inputs no longer remount |
| `src/list/parts/Toolbar.tsx` | DS `SavedFilters.tsx`, `ColumnCustomizer.tsx`, `QuickFilters.tsx` + PMO `ColumnCustomizer.tsx`, `QuickFilters.tsx`, `SortControl.tsx`, `GroupByControl.tsx` | Sear's popovers; PMO drag reorder, locked columns, column search, any-type quick filters with a field picker, sort and group-by menus |
| `src/list/parts/ListFooter.tsx` | DS `DataGrid.tsx` pager + Sear `sear-studio.css:382-420` (pill); PMO `components/tasks/BulkActionBar.tsx` | pager pill rules in `styles/src/sf-overrides.css` (`.sf-datagrid`); generic bulk actions |
| `src/list/ListView.tsx` | DS `DataGrid.tsx` layout as Sear's `FieldLibraryListPage.tsx` uses it | everything app-specific is a prop; row actions with Sear's delete-button look and an optional confirm; **bug fix**: row actions are not a manageable / filterable / sortable column |

Playground only (not published): `playground/src/showcase/FieldLibraryDemo.tsx` rebuilds Sear's Field Library page on
`ListView`; `playground/src/demo/field-library.ts` restates its 9 presets (name, Arabic name, description, field count,
author, age in days).

## Frappe layer (increment 5.4)

| Package file | From | Changes |
|---|---|---|
| `src/frappe/client.ts` | Sear `services/frappe-data.ts` + `lib/api.ts` (`frappeCall`: POST `/api/method`, `X-Frappe-CSRF-Token` from `window.csrf_token`) | configurable client and transport; `FrappeError` from `_server_messages` / exception / status; **bug fixes**: count via `frappe.desk.reportview.get_count` (Sear's `frappe.client.get_count` dropped `or_filters`), link search via `frappe.desk.search.search_link` (Sear: name-only `get_list`) |
| `src/frappe/meta.ts` | Sear `lib/data-grid/frappe-meta.ts` (`buildGridMeta`) | same fieldtype map and defaults; adds search fields and default order from the DocType; **bug fixes**: standard-field labels localized, Dynamic Link → text |
| `src/frappe/query.ts` | Sear `lib/data-grid/filter-to-frappe.ts` + PMO `api/_utils.py` (`_coerce`, `_translate_condition`, unknown-field skip) | browser-side, one copy; **bug fixes**: unknown fields dropped, whole-day Datetime; rule C2; F4 field / F6 order mapping |
| `src/frappe/useFrappeList.ts`, `FrappeListView.tsx`, `FrappeProvider.tsx` | Sear `hooks/useDataGrid.ts` (live path, never run in Sear) | server-mode `ListView` props; React Query (Sear's choice too); chunked grouping (rule C1); no request from the placeholder list shown while the meta loads |

Playground / tests only (not published): `playground/src/demo/mock-frappe.ts` — a simulated Frappe site with the ToDo
DocType's definition copied from `apps/frappe/frappe/desk/doctype/todo/todo.json` (Frappe 15.110, read locally) and
made-up rows; `playground/src/showcase/FrappeDemo.tsx`.

## Number cards

| Package file | From | Changes |
|---|---|---|
| `src/cards/StatCard.tsx` `StatCard` | DS v0.3.0 (`92fc1cd`) `pages/style-guide/StyleGuide.tsx`, section `data` ("Data display — stat cards"): inline markup, not a DS component | same markup and classes (`glass glass--lg` → `sf-glass sf-glass--lg`); label, value and trend as props; the trend pill keeps the DS's `emerald-*` / `rose-*` utilities verbatim (the DS's own register lists them as off-token, D8); `href` / `onClick` render a link / button with `sf-glass--interactive` and a focus ring (the DS card is static) |
| `src/cards/StatCard.tsx` `IconStatCard` | Sear `7abc895` (clean at that commit) `sear_studio/components/overview/DefinitionsGrid.tsx` card + `IconSquare` (`size="sm"`) and `CARD` from `overviewShared.tsx` (pinned in `upstream/sear-7abc895-dirty/overview/`) | same markup and classes (`glass-pane` → `sf-glass-pane`); tint `${color}1a` as in Sear for six-digit hex, `color-mix(… 10%)` for other colours; default colour Sear's violet `#512195`; react-router `Link` → `<a href>` / `<button>` (`href` / `onClick`); no `aria-label` on the link (Sear's hid the count from screen readers — the content names it); numbers formatted like Sear's `fmt` (ar-EG / en-US). Sear's palette rotation and its `StatCard` (defined, not rendered on any page) are not carried over |

## Not carried over (Sear-specific or dead)
`sear-studio.css`: the `Agency` font face (file doesn't exist), `.glass-morphism`, `.glass-card`, `.gradient-border-*`,
`.senaiy-*`, `.transition-smooth`, form-builder container queries, chat-sheet rule,
`button.text-info` (the package's filter action uses `text-primary` directly).
List: Sear's mock-meta `actions` field (a real fixed column instead), `inferFields` (columns are declared), the
`grid:cols:` / `grid:saved:` storage keys (new namespace; no migration), PMO's `PMO Saved Filter` DocType API and
`sonner` toasts (an app adapter and the `onFilterSaved` / `onSavedFiltersError` callbacks replace them).
Shell: `HEADER_HELP` and `FeatureHelp` (daleel), `FULLSCREEN_PATTERNS`, the `bina_*` theme fallback
(`usePortableTheme`), the `shared/` adapters, the BINA DOM-injection helpers.
