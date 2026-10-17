# @solvfast/ui

SOLV FAST product UI kit: Sear's design, packaged — theme, primitives, app shell and List View, with an optional
Frappe layer. React 18 · Tailwind 3 (or precompiled CSS) · Radix.

**Status: 0.1.0** — a private package on GitHub Packages (install: [docs/CONSUMING.md](docs/CONSUMING.md#install)). The
Frappe layer has passed tests against simulated Frappe requests; real-site validation is deferred until the package is
integrated into a real project (not done). See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Entry points

| Import | What |
|---|---|
| `@solvfast/ui` | `ThemeProvider`, primitives (Button, Card, Dialog, Popover, Select, …), `AppShell` (navbar, sidebar, mobile nav, app switcher, notifications), `ListView` and its parts, `useListState` |
| `@solvfast/ui/frappe` | `FrappeListView`, `useFrappeList`, `FrappeProvider`, `createFrappeClient` — needs `@tanstack/react-query` 5; the core never imports it |
| `@solvfast/ui/tailwind-preset` | Tailwind 3 preset (path A) |
| `@solvfast/ui/theme.css`, `glass.css`, `base.css` | styles for apps with Tailwind (path A) |
| `@solvfast/ui/full.css`, `full-base.css` | precompiled styles for apps without Tailwind (path B) |

## Quick start (app with Tailwind 3)

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
```
```tsx
// main.tsx — glass is a separate stylesheet, loaded after the Tailwind one
import "./index.css";
import "@solvfast/ui/glass.css";
import { ThemeProvider, ListView } from "@solvfast/ui";

<ThemeProvider defaultLanguage="ar">
  <ListView rows={rows} columns={columns} rowKey={(r) => r.id} />
</ThemeProvider>
```
Everything else — the no-Tailwind path, the shell, the List View, fonts, installing from GitHub Packages — is in
[docs/CONSUMING.md](docs/CONSUMING.md).

## Documentation

- [docs/CONSUMING.md](docs/CONSUMING.md) — installing and using the package
- [docs/FRAPPE.md](docs/FRAPPE.md) — the Frappe layer: requirements, endpoints, behaviour, limits
- [docs/FEATURES.md](docs/FEATURES.md) — List View feature coverage and fixes relative to Sear and PMO
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — what is not done, not verified, or intentionally different
- [CHANGELOG.md](CHANGELOG.md) · [VENDORED.md](VENDORED.md) (where the code comes from) · [docs/VALIDATION.md](docs/VALIDATION.md) (evidence) · [docs/RELEASING.md](docs/RELEASING.md) (release checklist)

## Development

```bash
npm run build          # dist/ (JS, .d.ts, styles, preset) + boundary check + package audit
npm test               # unit tests (vitest)
npm run typecheck
e2e/run-parity.sh <out>          # pixel parity against Sear's real components (tools/parity, read-only)
e2e/consumers/run.sh <work>      # pack + install into clean apps (Tailwind path A and no-Tailwind path B)
node e2e/list-parity.mjs <playground> <tools/parity> <out>   # List View vs Sear's Field Library page
node e2e/frappe-review.mjs <playground> <out>              # FrappeListView on a simulated Frappe site (no network)
```

## Licence

Not decided yet. Intended copyright holder: Solvfast. See [LICENSE](LICENSE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (shadcn/ui-derived code, used under its MIT License). Publishing is
blocked until the licence is decided.
