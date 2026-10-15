# @solvfast/ui

SOLV FAST product UI kit: Sear's design, packaged — primitives, theme, (soon) app shell and List View, with an
optional Frappe layer. React 18 · Tailwind 3 (or precompiled CSS) · Radix.

- Using it: [docs/CONSUMING.md](docs/CONSUMING.md)
- Where the code comes from: [VENDORED.md](VENDORED.md)
- Changes: [CHANGELOG.md](CHANGELOG.md)

```bash
npm run build          # dist/ (JS, .d.ts, styles, preset) + boundary check
npm test               # unit tests (vitest)
npm run typecheck
e2e/run-parity.sh <out>          # pixel parity against Sear's real components (tools/parity, read-only)
e2e/consumers/run.sh <work>      # pack + install into clean apps (Tailwind path A and no-Tailwind path B)
```
