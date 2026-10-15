# @solvfast/ui

SOLV FAST product UI kit: Sear's design, packaged — primitives, theme, app shell and List View, with an optional
Frappe layer (`@solvfast/ui/frappe`). React 18 · Tailwind 3 (or precompiled CSS) · Radix.

- Using it: [docs/CONSUMING.md](docs/CONSUMING.md) · Frappe: [docs/FRAPPE.md](docs/FRAPPE.md)
- List View feature coverage: [docs/FEATURES.md](docs/FEATURES.md) · Validation: [docs/VALIDATION.md](docs/VALIDATION.md)
- Where the code comes from: [VENDORED.md](VENDORED.md)
- Changes: [CHANGELOG.md](CHANGELOG.md)

```bash
npm run build          # dist/ (JS, .d.ts, styles, preset) + boundary check
npm test               # unit tests (vitest)
npm run typecheck
e2e/run-parity.sh <out>          # pixel parity against Sear's real components (tools/parity, read-only)
e2e/consumers/run.sh <work>      # pack + install into clean apps (Tailwind path A and no-Tailwind path B)
node e2e/list-parity.mjs <playground> <tools/parity> <out>   # List View vs Sear's Field Library page
node e2e/frappe-review.mjs <playground> <out>              # FrappeListView on a simulated Frappe site (no network)
```
