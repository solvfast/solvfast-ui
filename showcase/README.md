# @solvfast/ui — component showcase

A browsable site of the package's components, built like the Design System site:
- **Layout.** One long page. The overview is the hero; every other section sits collapsed under its heading (open it with its chevron or from the sidebar).
- **Sidebar.** Groups as on the DS site: Foundations, Components, Data display, Feedback & overlays, Patterns. It has a search field, follows the section in view, and collapses to an icon rail.
- **Header.** A glass bar that turns into a floating pill when you scroll, with the language and theme switches.
- **Phones.** A sticky bar shows the current section and opens the menu.
- **Themes and languages.** Light and dark; English and Arabic (left-to-right and right-to-left).

Every example renders the real component from `src/`; nothing is a screenshot or a mock-up. Addresses: `#<section>` opens a section (e.g. `#tabs`); `#/demo/app-shell` is the app-shell demo, full screen.

It is a local tool. It is not part of the published package (`files` in `package.json` lists only `dist/` and the docs) and has no dependencies of its own.

## Run it

```sh
npm install                 # once, at the repository root
npm run showcase            # dev server → http://127.0.0.1:4850/ (port 4850 is strict: stop anything else on it first)
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

The smoke test opens every section from its address in light/dark × English/Arabic. It fails on any page error, console error, wrong `dir` or theme on `<html>`, more than one section open, a section not scrolled into view, or sideways scrolling (desktop and phone width). It also checks:
- **Browsing:** sections are collapsed by default; the section toggle, the rail collapse, the header pill and the phone menu work.
- **Interactive examples:** dialogs, sheets, menus, the command palette, tabs, the date field, list search, selection, filters, the stat cards, the simulated Frappe list and the app shell; from 0.3.0 also toggles, slider and progress direction, accordion, search combobox, rich text (toolbar, and an XSS sample that must not run), form validation, charts, hover card, context menu, menubar, breadcrumb, pagination, navigation menu, and the page header (in and out of the app shell). It needs `playwright-core`'s Chromium, as the other `e2e/` scripts do.

## How it is put together

| Path | What |
|---|---|
| `vite.config.ts` | Its own Vite config: `@ui` → `../src/index.ts`, `@ui/frappe` → `../src/frappe/index.ts`, port 4850 on 127.0.0.1 |
| `tailwind.config.ts` | The package's preset (path A), scanning the showcase, the playground demos and `src/` |
| `src/routes.ts` | The navigation: groups → sections. Add a section here |
| `src/App.tsx` | The one page: hero, collapsible sections (bodies load when first opened), scroll-spy, `#section` addresses |
| `src/pages/*.tsx` | Section bodies, one module per group; they use `Section` (a block), `Example` (live example + "Show code") and `Props` from `src/doc/Doc.tsx` |
| `src/layout/Layout.tsx` | The frame: header bar/pill (language, theme), the sidebar and its icon rail, the phone bar and menu |
| `src/demos/AppShellDemo.tsx` | The app shell full screen (`#/demo/app-shell`), embedded on the App shell page |

The List View, Frappe and app-shell pages reuse the playground's demos (`playground/src/showcase`, `playground/src/demo`): Sear's Field Library data, Sear's shell configuration, and the simulated Frappe site. The Frappe page runs entirely in the browser against that simulation; it is not evidence of real-site validation, which is still deferred.

Theme and language are remembered under `sfui-showcase-theme` / `sfui-showcase-lang` in `localStorage`.
