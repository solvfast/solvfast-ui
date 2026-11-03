# @solvfast/ui — component showcase

A browsable site of the package's components, built like the Design System site:
- **Layout.** One long page. The overview is the hero; every other section sits collapsed under its heading (open it with its chevron or from the sidebar).
- **Sidebar.** Groups as on the DS site: Foundations, Components, Data display, Feedback & overlays, Patterns, and (0.4.0) the Frappe layer. It has a search field, follows the section in view, and collapses to an icon rail.
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
- **Interactive examples:** dialogs, sheets, menus, the command palette, tabs, the date field, list search, selection, filters, the stat cards, the simulated Frappe list and the app shell; from 0.4.0 the ten Frappe-layer sections (scenario and session pickers, the realtime button, bulk bar gating, the Missing Fields dialog, depends_on, 403 / 417, a comment, a workflow transition, an assignment, a mention, the seven permission scenarios with their simulated 403s and filtered rows, the role picker, the Export dialog and its recorded request, the RTL and themed panes); from 0.3.0 also toggles, slider and progress direction, accordion, search combobox, rich text (toolbar, and an XSS sample that must not run), form validation, charts, hover card, context menu, menubar, breadcrumb, pagination, navigation menu, and the page header (in and out of the app shell). It needs `playwright-core`'s Chromium, as the other `e2e/` scripts do.

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

## The Frappe layer group (Phase 26)

Ten sections (`src/pages/frappe/`) show the 0.4.0 Frappe components on a **simulated Frappe site** that runs in the browser
(`playground/src/demo/sim-site.ts`: `createFixtureTransport` with the real Frappe 15.110 metadata of ToDo / User / Contact from
`tests/fixtures/real-15.110`, plus two authored demo DocTypes — Approval Memo with a workflow, Travel Request with `depends_on`,
a Table MultiSelect, a permlevel-1 field, role rows and `allow_import`). A manager can drive every control without a developer:

| Section | What works |
|---|---|
| `#frappe-gallery` | a card per component with its matrix status and a link |
| `#frappe-list-view` | ToDo list: search, filters, saved filters (List Filter rows in the simulator), columns, sort, paging, selection, bulk delete / assign, the ⋯ menu, a "simulate server event" button for the realtime hook, loading / empty / 403 scenarios, two sessions |
| `#frappe-forms` | Contact (child tables, Dynamic Link), new ToDo (mandatory, Link search), Travel Request (depends_on, Table MultiSelect), submitted memo, save error 417, loading, 403; (Phase 27) a saved Travel Request under the seven **permission scenarios** with a "send a save anyway" button that shows the simulated server's 403 |
| `#frappe-record` | FrappeStatusIndicator + FrappeTimeline: comments with mentions, versions, assignment logs |
| `#frappe-workflow` | FrappeWorkflowActions (stepper and compact) on the Approval Flow; generic LifecycleBar / ActionBar |
| `#frappe-assign` | FrappeAssignTo (add / remove through the simulator); generic AssigneeGroup / AssignPicker; CommentComposer |
| `#frappe-permissions` | (Phase 27) the seven **permission scenarios** — Administrator, full-access role, read-only role, restricted DocType, restricted fields (permlevel 1), User Permissions (+ a DocShare), unknown roles — each driving the client session AND the simulator's server-side evaluation: the client's rights on the saved document beside the simulated server's answers (getdoc, list keys, saves, delete, another DocType, export), the list as the server filters it, the document as the session sees it; then the role picker over `usePermissions`, `canImport`, `canExport`, `bulkMenu`, the permlevel-1 field status and what the UI hides (incl. the rule-9 "roles unknown" case), also on the permission-evaluating simulator |
| `#frappe-import-export` | the gated Import / Export entries, `FrappeExportDialog`, the exact `download_template` request the package posts (recorded, then decided by the simulator's file server: read + `can_export`), the 403 case |
| `#frappe-rtl` · `#frappe-themes` | the same list and form in Arabic RTL and English LTR, and in light and dark, side by side (element-scoped `ThemeProvider`s) |

**Labels.** Every section carries a status strip: *SIMULATED — in-browser Frappe simulator, demo data*, and, where
`docs/release/COMPONENT-COMPLETION-MATRIX.md` says so (rows 10, 15–19, 24–27), *read path verified against recorded real Frappe 15.110
responses — tests/real/sada-real.test.tsx*. Nothing on these pages is evidence of real-site behaviour; no write has ever run on a site.
The simulated file transport never builds an export from client data: it records the request and the simulator's file server
answers a 403 or a small text file labelled SIMULATED that carries the column labels and the request — never document values;
uploads (imports) are refused. **Permissions (Phase 27):** the Forms, Permissions and Import & export sections run the simulator's
opt-in server-side permission model (`createFixtureTransport(…, { permissions })`, `docs/qa/simulator-caveats.md` §4), so 403s,
filtered rows, stripped permlevel values and `docinfo.permissions` come from the simulated server; every permission scenario
carries the strip *SIMULATED — in-browser simulator; permission decisions are the simulator's approximation of the Frappe server*.
The other sections still run the simulator without it (every right), as their labels say.

The List View, Frappe and app-shell pages reuse the playground's demos (`playground/src/showcase`, `playground/src/demo`): Sear's Field Library data, Sear's shell configuration, and the simulated Frappe site. The Frappe page runs entirely in the browser against that simulation; it is not evidence of real-site validation, which is still deferred.

Theme and language are remembered under `sfui-showcase-theme` / `sfui-showcase-lang` in `localStorage`.
