# @solvfast/ui

SOLV FAST product UI kit: Sear's design, packaged — theme, primitives, app shell and List View, with an optional
Frappe layer. React 18 · Tailwind 3 (or precompiled CSS) · Radix.

**Status: 0.2.0** — a private package on GitHub Packages (install: [docs/CONSUMING.md](docs/CONSUMING.md#install)). The
Frappe layer has passed tests against simulated Frappe requests; real-site validation is deferred until the package is
integrated into a real project (not done). See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Entry points

| Import | What |
|---|---|
| `@solvfast/ui` | `ThemeProvider`, primitives (below), `PageHeader`, `AppShell` (navbar, sidebar, mobile nav, app switcher, notifications), `ListView` and its parts, `useListState` |
| `@solvfast/ui/frappe` | `FrappeListView`, `useFrappeList`, `FrappeProvider`, `createFrappeClient` — needs `@tanstack/react-query` 5; the core never imports it |
| `@solvfast/ui/toast` | `Toaster`, `toast` — needs `sonner` 1.7 or 2 (optional peer dependency); the core never imports it |
| `@solvfast/ui/chart` | `ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)`, `ChartStyle` — needs `recharts` 2 (optional peer dependency); the core never imports it |
| `@solvfast/ui/form` | `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField` — needs `react-hook-form` 7 (optional peer dependency); the core never imports it |
| `@solvfast/ui/tailwind-preset` | Tailwind 3 preset (path A) |
| `@solvfast/ui/theme.css`, `glass.css`, `base.css` | styles for apps with Tailwind (path A) |
| `@solvfast/ui/full.css`, `full-base.css` | precompiled styles for apps without Tailwind (path B) |

## Components

Everything PMO's `components/ui` has (0.3.0), in Sear's look:
- **Actions and inputs:** Button, Input, Textarea, Label, Checkbox, Switch, RadioGroup, Select, Toggle, ToggleGroup,
  Slider, DateField / TimeField / DateTimeField, Calendar, SearchCombobox, RichTextEditor (+ RichText, `sanitizeHtml`),
  Form (`@solvfast/ui/form`).
- **Display:** Badge, Card, Avatar, Separator, Skeleton, ScrollArea, Table, Alert, Progress, StatusDot, Pill,
  Accordion, Collapsible, AspectRatio, StatCard, IconStatCard, Stepper, Chart (`@solvfast/ui/chart`).
- **Overlays and menus:** Dialog, AlertDialog, Sheet, Popover, Tooltip, HoverCard, DropdownMenu, ContextMenu, Menubar,
  Command, Toaster (`@solvfast/ui/toast`).
- **Navigation and layout:** AppShell (Sidebar, Navbar, MobileNav, AppSwitcher, NotificationPanel), PageHeader,
  EditableTitle, Breadcrumb, Pagination, NavigationMenu, Tabs; ListView.
- **Not shipped:** drawer, carousel, input-otp, resizable — keep your shadcn copies (docs/CONSUMING.md §7).

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

Proprietary — Copyright (c) 2026 Solvfast. All rights reserved. Only Solvfast and those it authorises may use, copy
or modify this package ([LICENSE](LICENSE); `"license": "UNLICENSED"`). Third-party parts keep their own licences:
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
