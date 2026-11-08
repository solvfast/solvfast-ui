# Global search — Desk's awesome bar and Global Search dialog (P36b)

The header search of Frappe Desk v15.110, reproduced in two layers:

- **Core** (`@solvfast/ui`, Frappe-free, `src/shell/search/`): `GlobalSearchBar` (the navbar "awesome bar") and
  `GlobalSearchDialog` (the Global Search dialog). They read a `GlobalSearchSource` and call `onSelect` — no data, no
  router.
- **Frappe adapter** (`@solvfast/ui/frappe`, `src/frappe/search/`): `useFrappeGlobalSearch` (→ the bar's `{ source,
  onSelect }`) and `createFrappeSearchSource` build Desk's rows from the boot lists (Desk's fuzzy ranking: `fuzzySearch`)
  and call `frappe.utils.global_search.search`. Navigation is injected (`onNavigate(url, info)`). The Frappe entry never
  imports the shell (scripts/check-boundaries.mjs), so the app renders the Core bar with the hook's props.

Chrome strings: `src/theme/messages-ws/search.ts` (`globalSearch…`, en + ar). Tests: `tests/global-search-p36b.test.tsx`
(`P36B.search.1–15`). Showcase: Frappe → *Global search (SIMULATED)*.

## Quick start

```tsx
import { AppShell, GlobalSearchBar } from "@solvfast/ui";
import { useFrappeGlobalSearch, deskSearchBootFrom } from "@solvfast/ui/frappe";

function HeaderSearch() {
  const navigate = useNavigate();
  return <GlobalSearchBar {...useFrappeGlobalSearch({ boot: deskSearchBootFrom(window.frappe?.boot), onNavigate: (url) => navigate(url) })} />;
}
<AppShell search={{ slot: <HeaderSearch /> }} … />
```

`search={{ slot }}` (new, additive) renders the node at every width — the bar shows its input from `md` up and an icon
button below it. The existing `search` forms (object, node, `false`) are unchanged.

**Phone header (P36c).** Below `md` the search icon is one more 32×32 header button, so the `Navbar` keeps the title's
room by spacing, not by shrinking anything: the pane's inline padding is 12px (desktop 24px) and the icon buttons sit 2px
apart (desktop 4px) — 18px more title width at every phone width (in the CRM: 106 → 124px at 390px, 76 → 94px at 360px).
The buttons keep the DS header size (`icon-sm`, 32×32, above WCAG 2.5.8's 24px), the trigger keeps its accessible name
(`globalSearchOpen`), one tap opens the full-screen dialog, and Ctrl/⌘+G still opens it. Long titles still truncate with an
ellipsis; nothing wraps or overflows.

An app without Frappe data passes its own source to the Core bar:

```tsx
const source: GlobalSearchSource = {
  suggest: (q) => pages.filter(…).map(toItem),            // sync or async; sorted by `index` desc
  recent: () => recentItems,                                // 0–1 characters
  search: async (q, { signal }) => [{ id: "Deals", title: "Deals", kind: "remote", items: [...] }],
  more: async (q, group, start, limit) => […],             // "More" in a remote group's list
};
<GlobalSearchBar source={source} onSelect={(item, { newTab }) => navigate(item.href!)} />
```

## API

```ts
interface SearchItem { id; label; labelMarks?; description?; details?: SearchItemDetail[]; index?; type?; href?; image?: string | null; data? }
interface SearchResultGroup { id; title; items: SearchItem[]; kind?: "nav" | "remote" }
interface GlobalSearchSource {
  suggest(query): SearchItem[] | Promise<SearchItem[]>;
  recent?(query): SearchItem[];
  search?(query, { signal }): Promise<SearchResultGroup[]>;
  more?(query, group, start, limit): Promise<SearchItem[]>;
}
GlobalSearchBar({ source, onSelect(item, { newTab }), placeholder?, debounceMs = 100, minChars = 2, maxItems = 99, shortcut = true,
                  dialogDebounceMs?, className?, inputClassName? })
GlobalSearchDialog({ open, onOpenChange, source, onSelect, initialQuery?, debounceMs = 300, minChars = 2, sectionSize = 4, pageSize = 20 })
markSegments(text, marks) → TextSegment[]; Marked

// @solvfast/ui/frappe
useFrappeGlobalSearch({ onNavigate(url, info: DeskSearchTarget & { newTab }), boot?, translate?, history?, routeTitles?, currentList?,
                        resolveUrl?(route) → url | undefined, limit = 100, call? }) → { source, onSelect }
fuzzyMatch(pattern, str) → [matched, score, indices]; fuzzySearch(keywords, text) → { score, marks }; fillTemplate(template, value, marks)
createFrappeSearchSource({ call, boot?, translate?, history?, routeTitles?, currentList?, resolveUrl?, limit? }) → GlobalSearchSource
DeskSearchBoot { can_read?, can_create?, can_search?, can_get_report?, single_types?, all_reports?, page_info?, allowed_workspaces?,
                 dashboards?, frequently_visited_links? }    deskSearchBootFrom(frappe.boot)
DeskSearchTarget { route: string[]; routeOptions?; url; kind; doctype?; name? }
awesomeBarItems / awesomeBarRecent / navGroups / dedupeAwesomeBar / get* (one per Desk builder) / deskRouteUrl / deskSlug
fetchGlobalSearch(call, { text, start, limit, doctype }) / makeDescription / globalRowToItem / groupGlobalRows / GLOBAL_SEARCH_METHOD
recordDeskRoute(route) / deskRouteHistory() / clearDeskRouteHistory()
```

## Behaviour (Desk source → here)

| Desk (v15.110) | Here |
|---|---|
| Placeholder `Search or type a command (Ctrl + G)` / `⌘ + G` (navbar.html:29) | same (`globalSearchPlaceholder`) |
| Ctrl/⌘+G focuses the bar, not while an input has focus (keyboard.js:198-206, 43-47) | same; on phones it opens the dialog |
| 100 ms debounce, trimmed text, inner spaces collapsed (AB:65-92) | same |
| ≥ 2 chars: "Search for {0}" (index 100) + rows from the boot lists; sorted by index desc; ≤ 99; first row selected (AB:17-58, 75-81) | same (fuzzy scores ported, "cust" → Customer List 186.05 above Search for) |
| < 2 chars: recent pages (this tab's route history) + frequently visited links (AB:82-87; SU:9-127) | same; the adapter records each opened route (`recordDeskRoute` for the app's own route changes) |
| Rows: New X, Find x in X, X List / X Report / New X, single DocTypes, reports, pages, Calendar / Email Inbox, workspaces, dashboards, recents (SU:129-357) | same, from `DeskSearchBoot` |
| Find {0} in {current list} (index 90, AB:316-340) | `currentList` |
| ↑/↓ wrap, Enter picks, Esc blurs; choosing clears + blurs (AWL:78-90; AB:109-143) | same; Ctrl/⌘-click → `newTab` |
| Dialog: 300 ms; "Search for anything" / "Searching ..." / "No Results found"; nav groups then server groups; All Results (4 + More); a group's list (20 + More → `start` = rows shown, `limit` 20, `doctype`); "N results found" (SD) | same |
| `global_search.search` `{text, start, limit, doctype}`, first call limit 100 (SU:472-489, SD:54) | same |
| Result = docname, description = matching fields with marks, route `["Form", doctype, name]` (SU:371-470) | same; href `/app/<slug>/<name>` |

## Differences from Desk (with reasons)

- **Not reproduced:** the calculator (Desk `eval`s the text, AB:343-368 — no `eval` in the package), "Generate Random
  Password", "Help on Search", Background Jobs / Generate Tracking URL executables, Marketplace apps (frappecloud links)
  and `#tag` search (needs the Tag endpoints; tags are another workstream) — none has a navigation target in an app
  header. Desk's `desk_settings.search_bar` / `notifications` switches are the app's choice (render the bar or not).
- **Mobile:** Desk keeps the 300 px bar in its expanded navbar on phones (navbar.html:2); the package header has no room
  for it next to the title and toggles, so below `md` it is an icon that opens the dialog (whose idle state lists the
  recent rows — an addition: Desk's idle dialog shows only "Search for anything").
- **Additions:** an error state with Retry (Desk leaves "Searching ..." up and shows its generic error dialog,
  SU:472-489); ↑/↓/Enter in the dialog (Desk has none); a loading row for async `suggest`; stale responses dropped.
- **Not reproduced Desk quirks:** a nav group's "More" in the dialog re-shows the same first 20 rows (SD:181-185) — here
  it shows the next rows; a row repeated by the server for "a & b" (GS:486-511) is shown once.
- **New X** opens `/app/<slug>/new` (Desk calls `frappe.new_doc`, which may open Quick Entry).
- The dialog's result href is the canonical `/app/<slug>/<name>` (Desk renders `/app/Form/<DocType>/<name>` and lets the
  router convert it, SD:317-325).
- Labels are plain text with `<mark>` runs computed from the fuzzy match (Desk builds HTML strings).

## Permissions

The awesome bar shows what the boot lists allow (`can_read` ∩ `can_search` for lists, `can_create` for New,
`can_get_report` for Report views, role-filtered `all_reports` / `page_info`). Global search results are filtered by the
**server**: only DocTypes in Global Search Settings that the user can read (`get_can_read`, GS:482). There is no
row-level check on the server — a user who can read a DocType sees the snippet of every indexed row in it; opening the
document is still permission-checked by the form. The adapter adds no filtering of its own.

## Simulator

`frappe.utils.global_search.search` (`src/frappe/testing/handlers/search.ts`) returns `{doctype, name, content, rank[, image]}`
rows built from the store and the metas' `in_global_search` fields (`show_name_in_global_search` adds "Name"). Searchable
DocTypes: a stored "Global Search Settings" single (`allowed_in_global_search` rows by `idx`), else every DocType with a
global-search field (SIMPLIFIED). With `permissions`, DocTypes the user cannot read/write/create are dropped (DocType
level, as on the server). The ranking (`MATCH … AGAINST('+word*' IN BOOLEAN MODE)`) is approximated. SIMULATED.

## Confirm on a real site

Doctype group order (the server iterates a Python set), MyISAM full-text behaviour (minimum word length, stopwords,
ranks), the 15-minute index lag, `frappe.boot` lists in a non-Desk page (an app must inject them — `deskSearchBootFrom`),
and the `/app/<slug>/new` route for New X.
