# Using @solvfast/ui

Status: **0.0.0, increment 5.2** — theme, primitives, styles and the app shell. The List View and the Frappe layer
arrive in later increments. Requirements: React 18.3, a bundler that understands package `exports` (Vite, etc.).

## Install
Published by the owner to GitHub Packages (`@solvfast` scope). Until then, install a tarball built with `npm pack`.

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

## 4. Fonts
Not bundled. Add to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Zain:wght@400;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## Known limitations (5.1)
- Path B: a sheet whose edge lands on a half pixel (e.g. the 75 %-wide sheet at 390 px) can rasterise with
  text/edge anti-aliasing that differs slightly from path A. Styles and layout are identical (docs/VALIDATION.md).
- Button motion: glass buttons use the glass engine's timings (as in Sear); 180/120 ms apply to `ai-outline`.
- Path B: glass controls can re-rasterize slightly differently from path A after a stylesheet is added at runtime
  (e.g. when a menu opens, ≤27/255 on the bell's glass). Styles are identical (docs/VALIDATION.md).
- React 19 and Tailwind 4 are untested.
- Badge `brand` uses `bg-primary/12`, which emits no CSS in Tailwind 3 (as in Sear today, DS B7) — kept for parity
  pending a design decision.
