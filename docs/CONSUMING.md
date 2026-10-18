# Using @solvfast/ui

Status: **0.1.0**, a private package on GitHub Packages. Theme, primitives, styles, the app shell, the List View and
the optional Frappe layer (`@solvfast/ui/frappe`: simulated-request tests passed; real-site validation deferred, not
done — docs/FRAPPE.md). Known limitations: docs/LIMITATIONS.md. Requirements: React 18.3, a bundler that understands package `exports` (Vite, etc.).

## Install
`@solvfast/ui` is a **private** package on GitHub Packages (organisation `solvfast`), so installing it needs a token —
the same setup as `@solvfast/design-system`.

1. **Token (once per developer).** On GitHub: Settings → Developer settings → Personal access tokens → **Tokens
   (classic)** → Generate, with the **`read:packages`** scope (GitHub Packages' npm registry does not accept
   fine-grained tokens). If the organisation uses SSO, choose *Configure SSO → Authorize* for `solvfast`. Your account
   needs read access to the `solvfast/solvfast-ui` repository (or to the package).
2. **Keep it in an environment variable, never in a file you commit** — e.g. in `~/.bashrc` / `~/.zshrc`, or the CI
   secret store:
   ```sh
   export NODE_AUTH_TOKEN=<your token>
   ```
3. **`.npmrc` next to the app's `package.json`** (safe to commit — it holds no secret):
   ```ini
   @solvfast:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```
4. **Install** (pin the version):
   ```sh
   npm install @solvfast/ui@0.1.0        # or: yarn add @solvfast/ui@0.1.0 · pnpm add @solvfast/ui@0.1.0
   ```
   Peer dependencies: `react` and `react-dom` 18.3; `tailwindcss` 3.4 for path A; `@tanstack/react-query` 5 for
   `@solvfast/ui/frappe`. A `401`/`403` means the token is missing (`NODE_AUTH_TOKEN` not exported in that shell), lacks
   `read:packages`, isn't SSO-authorised, or your account has no access to the package.

Without the registry (e.g. to try a local build): `npm pack` in this repository, then
`npm install <path>/solvfast-ui-0.1.0.tgz` in the app.

## 1. Choose a CSS path

### Path A — your app uses Tailwind 3 (Sear, PMO, …)
```js
// tailwind.config.js
import sfPreset from "@solvfast/ui/tailwind-preset";
export default {
  presets: [sfPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./node_modules/@solvfast/ui/dist/**/*.js"],
};
```
```css
/* src/index.css */
@import "tailwindcss/base.css";
@import "tailwindcss/components.css";
@import "tailwindcss/utilities.css";
@import "@solvfast/ui/theme.css";
@import "@solvfast/ui/base.css"; /* optional: Sear's page rules — body surface, Zain headings, Arabic body size */
```
```ts
// main.tsx — glass is a SEPARATE stylesheet, loaded after the Tailwind one (never @import it into index.css:
// Tailwind appends its variant utilities to the end of that file and the cascade would change).
import "./index.css";
import "@solvfast/ui/glass.css";
```
Put package additions in `theme.extend`: a top-level `theme` key in your config replaces the preset's.

**Existing apps (verified on a copy of Sear, 2026-10-17):**
- *Already using `tailwindcss-animate`?* Remove it from your own `plugins` — the preset includes it. Registered twice,
  Tailwind finds some utilities ambiguous and drops them (in Sear: the dialog's `slide-in-from-top-[48%]` and
  `slide-out-to-top-[48%]`); the build warns "is ambiguous and matches multiple utilities".
- *Stylesheet uses `@tailwind base; @tailwind components; @tailwind utilities;`?* Replace those three lines with the
  equivalent `@import "tailwindcss/base.css";` (and `components`, `utilities`) so `@import "@solvfast/ui/theme.css";`
  can follow them — an `@import` must come before every other rule. Tailwind produces the same CSS for both forms.

### Path B — your app does not use Tailwind
```ts
import "@solvfast/ui/full.css";
import "@solvfast/ui/full-base.css"; // optional, as base.css above
```
- `full.css` contains only the utilities the package's own components use. Style your own layout with your own CSS.
  A `className` you pass to a package component works only with utilities the package already uses.
- Do **not** load a second copy of Tailwind utilities after `full.css` (that reorders the cascade). If your app uses
  Tailwind, use path A.
- Tailwind's preflight is included but scoped to `.sf-theme` (see below).

## 2. Wrap the app in ThemeProvider
```tsx
import { ThemeProvider } from "@solvfast/ui";
<ThemeProvider defaultLanguage="ar">
  <div className="sf-app min-h-screen">{/* your app */}</div>
</ThemeProvider>
```
- Adds `sf-theme`, `dark` (dark theme), `data-theme`, `lang`, `dir` to `<html>` and sets Radix direction. **The
  package's tokens and resets apply only under `.sf-theme`**, so nothing is styled until you mount the provider.
- `sf-app` on your app root gives Sear's app surface (and the dark-mode aurora).
- `storageKeys`: localStorage keys, read in order, all written (default `sf-theme` / `sf-lang`; `null` disables). Sear
  keeps its users' choices with `{ theme: ["bina_theme", "theme", "app_theme"], language: ["bina_lang", "app_lang"] }`.
- Controlled use: `theme` + `onThemeChange`, `language` + `onLanguageChange`. Strings: `messages={{ ar: {...}, en: {...} }}`.
- `scope="element"`: classes go on a wrapper `<div>` instead of `<html>`; popups render inside it.
- Hooks (`useTheme`, `useLocale`) work outside the provider too (read-only fallback from `<html>`).

### An app that already owns theme and language
Drive `ThemeProvider` from your app's own state, so there is a single owner and nothing stored twice:
```tsx
function SfuiThemeBridge({ children }) {
  const { theme, language } = useApp(); // your app's context
  return <ThemeProvider theme={theme} language={language} storageKeys={null}>{children}</ThemeProvider>;
}
```
Verified in Sear: the package follows Sear's theme and language toggles, keeps them after a reload, stores nothing of
its own, and leaves Sear's existing pages visually unchanged — 31 of 50 screenshots pixel-identical, the other 19
differing only within the run-to-run noise of unmodified Sear (docs/validation/sear-rehearsal/). Cost on Sear's existing pages: about +4–5 kB gzip JS (3.8–4.7 measured) and +1.7 kB gzip CSS; list pages load
their code only when visited. `FrappeListView` uses the app's React Query client when there is one.

## 3. App shell
`AppShell` is Sear's shell: sidebar (brand, app switcher, navigation, collapsible rail), glass top bar (title, help,
search, notifications, language and theme), one scrolling content area, and a mobile bottom bar with a "More" sheet.
Everything app-specific is a prop; the package has **no router** — pass the current path and a navigate function.
```tsx
import { AppShell, type NavItem } from "@solvfast/ui";
const items: NavItem[] = [
  { id: "overview", href: "/studio/overview", icon: LayoutDashboard, label: { en: "Overview", ar: "نظرة عامة" } },
  { id: "calendars", href: "/studio/calendars", icon: Calendar, label: { en: "Calendars", ar: "التقاويم" },
    children: [{ id: "holidays", href: "/studio/calendars/holidays", label: { en: "Holidays", ar: "العطلات" } }] },
];
const location = useLocation(); const navigate = useNavigate();      // e.g. react-router — or any router
<AppShell
  brand={{ name: "Sayr Studio", logoSrc: logo, logoClassName: "w-14 h-14", nameClassName: "text-brand-violet", href: "/workspace" }}
  items={items} currentPath={location.pathname} onNavigate={(href) => navigate(href)}
  switcher={{ sections, currentAppId: "sear-studio", home: { href: "/workspace" }, exit: { href: "/workspace", iconSrc } }}
  notifications={{ items: notifications, onItemClick: (n) => { markRead(n.id); navigate(n.link) }, onMarkAllRead }}
  help={<MyHelpLink />}            // per page, next to the title
  search={{ value, onChange, onSubmit }}   // omit for Sear's search box with no behaviour; false hides it
  mobile={{ exit: { href: "/workspace" } }}
  collapsedStorageKey="studio_sidebar_collapsed"   // keep Sear users' rail state
>
  {page}
</AppShell>
```
- Active state: an item is active when the path equals its `href` or is nested under it, or a child is active; `exclude`
  lists sub-paths owned by a sibling. Override with `isActive(item, currentPath)`.
- The title defaults to the deepest active item's label (pass `title` to fix it).
- The parts are exported too — `Sidebar`, `Navbar`, `MobileNav`, `AppSwitcher`, `NotificationPanel` — for custom layouts.
- `NotificationItem`: `{ id, body, at (epoch ms), read, iconSrc?, source? }`; the panel groups by Today / Yesterday /
  Earlier and shows relative times. The app owns the data: mark items read in `onItemClick` / `onMarkAllRead`.

## 4. List View
`ListView` is Sear's data grid (search, saved filters, advanced filter, column manager, glass table, pill pager) with
PMO's list features available as props. Defaults look and behave like Sear; the extra controls appear only when used.
```tsx
import { ListView, type ColumnDef } from "@solvfast/ui";
const columns: ColumnDef<Task>[] = [
  { key: "subject", label: { en: "Subject", ar: "الموضوع" }, type: "text" },
  { key: "status", label: { en: "Status", ar: "الحالة" }, type: "select", fieldtype: "Select", options },
  { key: "due", label: { en: "Due", ar: "الاستحقاق" }, type: "date", fieldtype: "Date" },
  { key: "owner", label: { en: "Owner", ar: "المسؤول" }, type: "link", hidden: true },   // offered in the column manager
];
<ListView
  rows={tasks} columns={columns} rowKey={(t) => t.name}
  viewKey="Task"                                   // persists columns, sort, group-by, quick filters, saved filters
  onRowClick={(t) => navigate(`/tasks/${t.name}`)}
  rowActions={[{ key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, tone: "destructive",
                 confirm: { title: { en: "Delete this task?", ar: "حذف هذه المهمة؟" } }, onSelect: remove }]}
  toolbarActions={<Button onClick={create}>New task</Button>}
  emptyMessage={<>No tasks yet <Button size="sm" onClick={create}>New task</Button></>}
  // PMO features — all optional:
  selectable bulkActions={[{ key: "close", label: "Close", run: (keys, rows) => close(keys) }]}
  groupByOptions={[{ key: "status", label: "Status", groupOf: (t) => ({ key: t.status || "__none__", label: t.status || "—" }) }]}
  quickFilterFields={["status", "owner"]}
  controls={{ sortMenu: true, quickFiltersCustomizable: true }}
  rowClassName={(t) => (t.overdue ? "bg-destructive/5" : undefined)}
  loadOptions={(field, text) => searchLinks(field.link_doctype, text)}   // link-field filter values
  onFilterSaved={() => toast.success("Saved")} onSavedFiltersError={() => toast.error("Couldn't save")}
/>
```
- **Columns.** `type` (`text`, `select`, `number`, `date`, `boolean`, `link`) drives the default cell, the filter input
  and the sort; `fieldtype` (Frappe names: `Currency`, `Int`, `Check`, …) refines the cell. `render` replaces the cell,
  `sortValue` the sort key. `alwaysVisible` locks a column; `hideable: false` keeps it out of the column manager.
- **Data modes.** `mode="client"` (default): pass every row; search, filters, sort, grouping and paging run locally and
  nothing touches the network. `mode="server"`: pass the current page (or loaded rows) and `total`, set `loading` /
  `error` / `onRetry`, and fetch in `onStateChange(state)` — it fires once per change, after a 300 ms typing pause.
  The Frappe entry (`@solvfast/ui/frappe`) wires this to Frappe's REST API.
- **Grouping.** One table: each group is a section with its own header row (collapse, count, select-all for the
  group), so columns line up across groups. Client mode groups every row and shows no pager while grouped. Server mode groups the loaded rows; if
  fewer than `total` are loaded, a banner says so and **Load more** calls `onLoadMore`.
- **Row actions** are a fixed last column (never sorted, filtered, hidden or moved). With `confirm`, the package shows
  the confirmation dialog — red confirm button when `tone: "destructive"` — and calls your `onSelect` only after the
  user confirms; the deletion itself (API call, optimistic update, toast) is yours.
- **Selection** is kept across pages and sorting, and pruned when the search or filters change.
- **Storage.** Default: `localStorage` under `sf:list:<viewKey>:…`. Per-user keys or a server: pass
  `storage={{ prefs, saved }}` (e.g. from `createLocalStorageAdapter({ userKey })`, or your own `SavedFiltersStorage`,
  whose methods may return promises); `storage={null}` keeps everything in memory.
- **Headless.** `useListState` is the same state without the UI, for other views (cards, kanban); the parts
  (`ListTable`, `FilterBuilder`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`,
  `BulkActionBar`) are exported for custom layouts.
- Keep the `ListView` root's last child the pager (the default): the pager's pill style depends on it. While `error`
  is set there is no pager or total.
- **Frappe DocTypes:** `<FrappeListView doctype="ToDo" />` from `@solvfast/ui/frappe` fills all of the above from the
  DocType (columns, filters, quick filters, search, sort, link search, server paging, chunked grouping). Needs
  `@tanstack/react-query` ^5 and a page served by the Frappe site. See docs/FRAPPE.md.

## 5. Fonts
Not bundled. Add to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Zain:wght@400;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## Known limitations
The full list is in docs/LIMITATIONS.md. The ones most likely to matter:
- The Frappe layer has passed tests against **simulated** Frappe requests only. **Real-site validation is deferred**
  until the package is integrated into a real project; it has not been done.
- React 19, Tailwind 4, Frappe other than 15, and browsers other than Chromium are untested.
- Intended differences from Sear: the fixed Actions column, the wrapping toolbar on phones, 180/120 ms buttons, and
  the shell fixes (docs/VALIDATION.md).
- Proprietary (LICENSE): use is limited to Solvfast and those it authorises.
