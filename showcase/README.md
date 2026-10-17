# @solvfast/ui — component showcase

A browsable site of the package's components, after the Design System site: a sidebar with grouped pages, light and dark, English and Arabic (left-to-right and right-to-left). Every example renders the real component from `src/`; nothing is a screenshot or a mock-up.

It is a local tool. It is not part of the published package (`files` in `package.json` lists only `dist/` and the docs) and has no dependencies of its own.

## Run it

```sh
npm install                 # once, at the repository root
npm run showcase            # dev server → http://127.0.0.1:4850/
```

## Build it

```sh
npm run showcase:build      # → showcase/dist/ (static; relative paths, hash routes)
npm run showcase:preview    # serves showcase/dist at http://127.0.0.1:4850/
```

`showcase/dist/` works from any static host or sub-path (`base: "./"`, `#/page` routes). It is git-ignored.

## Check it

```sh
npm run showcase:build && npm run showcase:preview   # in one terminal
node e2e/showcase-smoke.mjs                          # in another: [baseUrl] [screenshotDir]
```

The smoke test opens every page in light/dark × English/Arabic and fails on any page error, console error, wrong `dir`/theme on `<html>`, or sideways scrolling (desktop and phone width). It also exercises the interactive examples: dialogs, sheets, menus, the command palette, the date field, list search, selection, filters, the simulated Frappe list and the app shell. It needs `playwright-core`'s Chromium, as the other `e2e/` scripts do.

## How it is put together

| Path | What |
|---|---|
| `vite.config.ts` | Its own Vite config: `@ui` → `../src/index.ts`, `@ui/frappe` → `../src/frappe/index.ts`, port 4850 on 127.0.0.1 |
| `tailwind.config.ts` | The package's preset (path A), scanning the showcase, the playground demos and `src/` |
| `src/routes.ts` | The navigation: groups → pages. Add a page here |
| `src/pages/*.tsx` | One module per group; pages use `Section`, `Example` (live example + "Show code") and `Props` from `src/doc/Doc.tsx` |
| `src/layout/Layout.tsx` | The frame: glass header (language, theme), sidebar with search, menu sheet on small screens |
| `src/demos/AppShellDemo.tsx` | The app shell full screen (`#/demo/app-shell`), embedded on the App shell page |

The List View, Frappe and app-shell pages reuse the playground's demos (`playground/src/showcase`, `playground/src/demo`): Sear's Field Library data, Sear's shell configuration, and the simulated Frappe site. The Frappe page runs entirely in the browser against that simulation; it is not evidence of real-site validation, which is still deferred.

Theme and language are remembered under `sfui-showcase-theme` / `sfui-showcase-lang` in `localStorage`.
