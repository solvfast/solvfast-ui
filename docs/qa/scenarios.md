# Regression and UX matrix — `@solvfast/ui` 0.4.0 Frappe components

Owner: A6 (QA). Companion of `parity-checklists.md` (behaviour parity) — this file is about **how the UI behaves**:
locale, direction, theme, keyboard and the five states. Nothing here has been executed. Rules come from
`docs/CONTRACT-0.4.md` §3 (loading → `Skeleton`; error → `<FrappeErrorState>`; empty → own empty state; disabled and
read-only from `fieldStatus` / `can()`; logical utilities only; tokens only; strings via `useLocale().t`).

## 1. Environment axes

| Axis | Values | Notes |
|---|---|---|
| Locale | EN, AR | Package strings from `src/theme/messages.ts` (`frappe:<area>` blocks, both languages). Server labels through `translateLabel` (meta `__messages`); server messages are shown as sent (not translated by the package). |
| Direction | LTR, RTL | Normally EN/LTR and AR/RTL. **Mixed cases are mandatory:** AR strings in an LTR host and EN data in an RTL host (a CRM in Arabic UI showing English customer names; Frappe's `language` and the host's `dir` are independent). |
| Theme | light, dark | Token scope only. Every state below is checked in both. |

Minimum run per component: the 4 "natural + mixed" combinations `EN·LTR`, `AR·RTL`, `AR·LTR`, `EN·RTL`, each in light
and dark = **8 renders**. Visual (Playwright screenshot) coverage is per state × those 8; unit/RTL tests assert
attributes and class names (no hex values, no `left/right/ml/mr/pl/pr` utilities).

### Cross-cutting assertions (apply to every row of every table)

- X1 No `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left/right`, `rounded-l/r*` in the component output; logical
  equivalents only. Chevrons, arrows and "next/previous" icons flip with `isRTL`.
- X2 No hex/rgb literal in the component (tokens only); dark theme has no unreadable text (contrast of the text on the
  surface token for the state's tone: info, success, warning, danger).
- X3 Data that is inherently LTR renders `dir="ltr"` (or `<bdi>`) inside RTL: emails, URLs, phone numbers, doc names
  such as `CRM-DEAL-2026-00012`, code, JSON, IBAN, numbers with `-` sign, ISO dates. Arabic free text in an LTR input uses
  `dir="auto"` (text/textarea/comment box).
- X4 Numbers: Frappe sends plain numbers; display uses the user's `number_format` (e.g. `#,###.##`, `#.###,##`), Western
  digits unless the host formats otherwise; the minus sign stays attached to the number in RTL (`-1,234.50`, not
  `1,234.50-`).
- X5 Focus is visible (ring token) in light and dark; focus order follows DOM order, which follows visual order in RTL.
- X6 Server text (messages, errors, labels) is rendered as text — never as HTML — except through the sanitizer.
- X7 An error never leaves a blank area; a spinner never shows without accompanying text after 300 ms.
- X8 Reduced motion: no required animation to understand a state.

## 2. State matrix per component

Legend: **L** loading · **E** empty · **R** error · **D** disabled · **O** read-only. "Test layer": `unit` (Testing
Library + jsdom), `visual` (Playwright, 8 renders), `real` (needs the footprint).

### 2.1 Foundation

| Component | L | E | R | D | O | Test layer |
|---|---|---|---|---|---|---|
| `<FrappeErrorState>` | n/a | n/a | One layout for every `FrappeErrorKind`: `permission` (lock icon, no retry), `not_found` (no retry), `duplicate`/`validation`/`mandatory`/`link` (messages list, no retry), `timestamp` (Reload action), `csrf` (Reload action), `session_expired` (Sign in action), `too_large` (limit text), `network`/`server` (Retry action). Shows `messages[].message` as text; shows `exception` only when present. | Retry button disabled while retrying, with text | n/a | unit + visual |
| `useFrappeMessages().show` | n/a | n/a | Stacked dialog, `raise_exception`-only filter, `alert` → toast, indicator → tone (red, orange, green, blue, yellow, gray) | Dialog primary action disabled while in flight | n/a | unit |
| Provider / transport | Global skeleton only at first meta load | n/a | `network` banner with retry; `session_expired` takes over the whole area | n/a | n/a | unit + real |

### 2.2 Form

| Component | L | E | R | D | O | Test layer |
|---|---|---|---|---|---|---|
| `FrappeForm` shell | Skeleton of the layout (sections/fields) while `useMetaBundle` + `useDoc` pending; text "Loading…" after 300 ms | New doc: defaults applied, no "empty" state. Doc not found (`200 []`): not-found error state, not a blank form | `useDoc` error → `<FrappeErrorState>` with Retry; save error: server messages dialog and the form stays dirty with data intact; `timestamp`: banner with Reload | Whole form disabled while saving (buttons only); Save disabled with no changes shows the orange "No changes in document" alert instead of a dead click | Fields Read per `fieldStatus`; workflow read-only: fields Read, Save hidden; `docstatus>0`: Read except `allow_on_submit`; page title still shows indicator | unit + visual + real |
| Layout (tabs/sections/columns) | Tab bar skeleton | A section with no visible control is not rendered; a tab with none is hidden; one visible tab → no tab bar | Validation error activates the tab and opens the collapsed section of the first offending field | n/a | Read-only sections keep collapse behaviour | unit |
| Missing Fields dialog | n/a | n/a | Title "Missing Fields", red; lines per parent field and grouped child rows (every row / list / "in N rows" > 10 ranges) | n/a | n/a | unit |
| Toolbar / primary action | Skeleton button | n/a | n/a | Submit/Cancel/Amend hidden unless the `docinfo.permissions` right; "Already amended as X" disabled Amend with tooltip | n/a | unit |
| Indicator pill | n/a | n/a | n/a | n/a | "Not Saved" orange while dirty; workflow style colours | unit + visual |

### 2.3 Field controls

| Component | L | E | R | D | O | Test layer |
|---|---|---|---|---|---|---|
| Data / Text / Small Text | n/a | Placeholder per `df.placeholder` | `has-error` style for Email/URL/Phone/Name invalid (soft); server error message under the form | `disabled` attr when Read and not hidden | Read + null → control hidden; Read + value → formatted text | unit + visual |
| Int / Float / Currency / Percent | n/a | empty string (not `0`) for null; `0` shown | invalid text becomes `null`/0 per parse rules; error style optional | disabled | formatted by user number format + currency symbol (symbol only in read-only) | unit + visual (EN/AR number formats) |
| Check / Select | n/a | Select with `df.placeholder`: placeholder when empty; first option otherwise | n/a | disabled | Check disabled box | unit |
| Date / Datetime / Time / Duration | n/a | empty | "Date X must be in format: …" and the field clears | disabled | formatted text in user format | unit + visual (RTL calendar header arrows flip) |
| Link | Dropdown row "Searching…" with text after 300 ms (Desk is silent; package adds text per §3) | Only action rows ("Create a new X", "Advanced Search") when no results; "No results" text otherwise | Search error inline in the dropdown with retry; `validate_link` permission error → permission state, value kept | disabled, no dropdown | formatted link `/app/<slug>/<name>` only when readable, plain text otherwise; open-document arrow hidden for select-only | unit + visual |
| Dynamic Link | as Link | Empty sibling doctype: input disabled-like with hint "Select {sibling label} first" (Desk: silent empty dropdown) | as Link | as Link | as Link | unit |
| Child table (grid) | Skeleton rows | Empty grid: "No rows"/Add Row (Desk empty state) | Row errors marked per row; grouped message | Add/Delete/Move hidden; cells Read | rows Read; static cells formatted | unit + visual |
| Table MultiSelect | n/a | Placeholder | as Link | disabled pills | pills without × | unit |
| Attach / Attach Image | Per-file progress with text | "Attach" affordance | 403/413/417 text per `FileUploader.vue:619-653` (limit shown); `too_large` from non-JSON 413 | disabled | link to file; private files open with session cookie | unit + real |
| Password | n/a | empty | n/a | disabled | masked `*****`, never the secret | unit |

### 2.4 List

| Component | L | E | R | D | O | Test layer |
|---|---|---|---|---|---|---|
| `FrappeListView` | Skeleton rows on first load; previous rows kept (dimmed) on refetch | With filters: "No {0} found with matching filters. Clear filters…"; without: "You haven't created a {0} yet" (+ create button only if `can_create`) | `<FrappeErrorState>` in the body, filters and toolbar stay usable; count failure shows rows without total (never "0 of 0") | Create/bulk actions disabled per `can()` and `boot.read_only`; refresh disabled while fetching | Checkbox column absent without bulk rights; readable columns only (unreadable columns silently absent) | unit + visual + real |
| Filters | n/a | "No filters" | Invalid saved filter dropped silently; URL filter on unknown field dropped | n/a | n/a | unit |
| Paging / count | "…" in count | n/a | n/a | Next/Prev disabled at the ends | n/a | unit |
| Bulk bar | n/a | n/a | per-doc failure list (`bulk_update` returns `failed_docs`) | disabled while running | hidden | unit |

### 2.5 Workflow, assignment, timeline

| Component | L | E | R | D | O | Test layer |
|---|---|---|---|---|---|---|
| Workflow actions menu | Skeleton button | No transitions: menu absent, plain Save/Submit rules apply | `WorkflowPermissionError`/"Self approval is not allowed" in the messages dialog; `apply_workflow` failure keeps the doc and states | Disabled while the request is in flight; hidden when dirty | State shown as indicator only | unit + real |
| Assignment | Avatar skeleton | "No assignments" with + (when allowed) | duplicate/share messages are plain dialogs; permission error | + hidden without read/write as server allows; own-row ✓ shown only to the assignee | avatars only; > 5 assignees reconcile with `docinfo` | unit + real |
| Timeline | Skeleton items | Only "created"/"edited" lines (never fully empty) | Load-more failure inline with retry; comment add failure keeps the draft | Comment box disabled while posting | Edit/Delete shown per owner/Administrator and `can('delete','Comment')`; no composer without read | unit + visual |
| Comment composer | n/a | Placeholder "Type a reply / comment"; submit hidden until non-empty | failure keeps text | disabled while posting | hidden | unit |

## 3. Keyboard matrix

Native shortcut → expected package behaviour. "Native" is cited; "Pkg" is the minimum the package must provide (the
Lead decides what is in scope; items marked *(UX)* are not data contracts).

| Area | Key | Native behaviour (source) | Package expectation |
|---|---|---|---|
| Global | Ctrl/Cmd+S | Triggers the primary action, works inside inputs (`keyboard.js:187-279`) | Save when the form is dirty and permitted; no browser "save page" |
| Global | Esc | Closes the topmost dialog (`keyboard.js:243-271`) | Closes dialog/popover/dropdown; focus returns to the opener |
| Form | Tab / Shift+Tab | Moves between visible controls; hidden-by-dependency fields are skipped | Order follows DOM; in RTL still DOM order; hidden fields not focusable |
| Link | ↑ ↓ | Moves through results (Awesomplete) | Listbox semantics: `aria-activedescendant`, wrap not required |
| Link | Enter / Tab | Selects the highlighted item only if the typed text is contained in its label or description (`link.js:476-480`); empty box + Tab closes (UX) | Same rule; Enter never submits the form while the list is open |
| Link | Esc | Closes list | Closes list, keeps typed text |
| Link | Focus with empty box | Opens default results (`link.js:35-41`) | Opens list on focus/click |
| Grid | Ctrl+↓ / Ctrl+↑ / Ctrl+Shift+↓ / Ctrl+Shift+↑ | Insert a row below / above / at the end / at the top of the focused cell's row (Cypress `grid_keyboard_shortcut.js` 18-42, on `Contact.email_ids`) | Same four insertions; Arrow keys move between cells in inline mode *(UX)*; Esc leaves the cell |
| Grid | Shift+click, Ctrl+click on row checkboxes | Range / toggle selection | Same (list too) |
| Date | `t` | Sets today / now (`date.js:138-155`) | Optional (UX) |
| Duration | d/h/m/s inputs `min 0` | `duration.js:84-96` | Arrow keys step; paste of seconds accepted |
| List | ↑ ↓ / Enter / Space / Shift+↑↓ | Row focus, open, toggle, range (`list_view.js:1152-1259`) | Rows are focusable; Space toggles when a checkbox column exists; Enter opens (link) |
| List | Ctrl/Meta+click | Toggle checkbox (`list_view.js:1296-1331`) | Same |
| Comment box | Ctrl+Enter | Submits (`comment.js:44-50`) | Same; Enter inserts a newline |
| Comment box | `@` | Mentions search, debounce 300 ms (`text_editor.js:261`) | Optional; stored markup `span.mention[data-id]` |
| Dialogs | Enter | Confirms only `confirm` dialogs (`messages.js:29-63`) | Same; never submits a destructive action on Enter in a warn dialog |

Accessibility baseline for all of the above: every interactive element has an accessible name (translated), dialogs
trap and restore focus, status changes are announced (`role="status"`/`aria-live=polite` for toasts and saved
alerts, `role="alert"` for errors), and tab lists follow the ARIA tabs pattern (Cypress finds tabs by
`role=tab`, `depends_on.js`).

## 4. Regression matrix (what must not break when each area changes)

| Change in | Re-run | Why |
|---|---|---|
| Transport / `FrappeError` | `tests/parity/errors.test.ts`, T-* sim scenarios, every `<FrappeErrorState>` visual | One mapping feeds every component |
| `usePermissions` / `fieldStatus` | `tests/parity/display-status.test.ts`, form + grid + list column visibility visuals | Same ladder drives forms, grids and list columns |
| Dependency evaluator | `tests/parity/dependencies.test.ts`, `mandatory.test.ts`, F-02..F-06 | `mandatory_depends_on` feeds the save check |
| `formatValue` / locale | `tests/parity/format.test.ts`, EN/AR visuals of list rows and read-only forms | Number/date formats are locale-sensitive |
| Query keys / invalidation | `frappeKeys` test, a save → list refetch → count scenario | Wrong keys cause stale lists silently |
| Theme tokens / messages | AR + dark visuals of every state; `messages.ts` has both `en` and `ar` for each `frappe:*` key | Missing AR key shows the key or English |
| Boundary rules | `node scripts/check-boundaries.mjs` | Core must stay Frappe-free |

## 5. Data set for UX runs (fixtures, not production data)

- Long labels (> 60 chars), a label with an Arabic and a Latin word, a field with a 2,000-char description.
- Names: `CRM-DEAL-2026-00012` (LTR token in RTL), Arabic names, names with `&` (Frappe escapes `&` in `User.clean_name`,
  hence plain-text rendering is checked), emoji.
- Numbers: `0`, `-0.5`, `1234567.891`, `1e-7`, a Currency with precision 0 and 3.
- Dates: `2026-01-02`, a Datetime with microseconds, a Time `9:30:00` (unpadded hour), a leap day.
- Tables: 0, 1, 11, 61 rows (grid pagination threshold), a row with every column empty.
- Lists: 0 rows, 1 row, exactly one page, 1,001 rows (count upper bound).
- Users: `sfui-reader`, `sfui-tester`, `sfui-limited`, `sfui-ar` as defined in `parity-checklists.md`.
