# The Frappe layer — `@solvfast/ui/frappe`

An optional entry point that runs the List View on a Frappe DocType with **stock Frappe APIs only** (no app-specific
backend). The core package (`@solvfast/ui`) never imports it; `scripts/check-boundaries.mjs` enforces that on the
source and on the built files.

```tsx
import { FrappeListView } from "@solvfast/ui/frappe";

<FrappeListView doctype="ToDo" onRowClick={(r) => navigate(`/app/todo/${r.name}`)} />
```

Status: built and tested against **simulated requests only** (a recording transport and a simulated site that uses the
real ToDo DocType definition). It has **not** been run against a live site yet; that check is waiting for your approval
(see "Not yet verified").

## Requirements

| What | Why |
|---|---|
| Frappe 15 (verified against the 15.110 source in this bench) | the endpoints and parameters below; other versions untested |
| The page is served by the Frappe site (same origin) | v0.1 authenticates with the logged-in user's session cookie |
| The CSRF token on the page: `window.csrf_token` (as Sear's and PMO's `www/*.html` set it: `<script>window.csrf_token = "{{ frappe.session.csrf_token }}";</script>`), or `window.frappe.csrf_token` (Desk), or the `csrfToken` option | Frappe checks `X-Frappe-CSRF-Token` on every POST from a logged-in session |
| `@tanstack/react-query` ^5 (optional peer dependency of the package; needed only for this entry) | caching, retries, chunked loading |
| `ThemeProvider` from the core package above it | language, direction and messages |

No secrets live in browser code: there is no API key or token in the package or its examples.

## Endpoints (all POST `/api/method/<method>`, JSON body)

| Method | Used for | Arguments sent |
|---|---|---|
| `frappe.desk.form.load.getdoctype` | DocType meta (read from `docs`) | `doctype` |
| `frappe.client.get_list` | rows | `doctype`, `fields`, `filters`, `or_filters`, `order_by`, `limit_start`, `limit_page_length` (lists as JSON strings) |
| `frappe.desk.reportview.get_count` | the total, with the same `filters` and `or_filters` | `doctype`, `filters`, `or_filters` |
| `frappe.desk.search.search_link` | link-field filter values (Frappe's own link search: search fields, title, permissions) | `doctype` (the link target), `txt`, `page_length`, `reference_doctype` |

Why `reportview.get_count` and not `frappe.client.get_count`: the latter's signature in Frappe 15 is
`get_count(doctype, filters=None, debug=False, cache=False)`, and Frappe drops arguments a whitelisted function doesn't
declare (`frappe.call` → `get_newargs`), so `or_filters` sent there are silently ignored. Sear's data grid did that, so
its totals were wrong whenever filters used "Match any". `reportview.get_count` reads `or_filters` explicitly.

Permissions are Frappe's: every call runs as the logged-in user, so row-level permissions, field permission levels and
user permissions apply. The package does not filter anything for security.

## What comes from the DocType

| From the meta | Becomes |
|---|---|
| fields (not layout, not hidden; fieldtype mapped as in Frappe CRM) | columns and filter fields |
| `in_list_view` | the columns shown by default (if none: the title field and the first four fields) |
| `in_standard_filter` | the quick filters shown by default |
| `title_field`, `search_fields`, `name` | the fields searched |
| `sort_field`, `sort_order` | the default order (else `modified desc`) |
| always added | ID (`name`), Created On (`creation`), Last Updated (`modified`) — labels in the UI language |

Fieldtype mapping: Data, Small Text, Text, Long Text, Text Editor, Code, Read Only, Phone, Time → text; Select →
select; Link → link (with link search); **Dynamic Link → text** (its `options` names another field, not a DocType, so
link search can't apply); Date, Datetime → date; Int, Float, Currency, Percent → number; Check → boolean. Layout and
binary fields (Section/Column/Tab Break, HTML, Table, Attach, Image, Signature, Password, JSON, …) are never offered.

## Behaviour

- **Fetching.** Only the fields of the visible columns are requested, plus `name` and, when grouped, the group field.
  Column keys are mapped to fields; a column that only renders (no field) or a field the DocType doesn't have never
  reaches a request (Frappe would reject the whole request).
- **Filters.** The List View's conditions become Frappe filters: values are converted to the field's type (Check → 1/0,
  numbers → numbers); a date-only value on a Datetime field covers the whole day (`=` → `between`); conditions on fields
  that no longer exist (e.g. in an old saved filter) are dropped. "Match all" → `filters`; "Match any" with two or more
  conditions → `or_filters`.
- **Search (rule C2).** Frappe accepts one `or_filters` list. With "Match all" filters, search looks in every search
  field (`or_filters`). With "Match any" filters, `or_filters` is taken, so search looks in the title field only
  (AND-ed) and the list says so under the toolbar.
- **Base filters.** `baseFilters` (Frappe filter lists) are AND-ed into every request; changing them clears the
  selection.
- **Grouping (rule C1).** Group-by is opt-in (`groupByFields`). Grouped lists load in chunks (`chunkSize`, default 200)
  instead of pages; while fewer than the total are loaded, a banner says "Showing X of Y records…", counts end in "+",
  and **Load more** fetches the next chunk.
- **Errors.** Frappe's message (from `_server_messages` or the exception) is shown with Retry; no pager or total is
  shown while there is nothing to show. Automatic retries: with the React Query client the package creates, 4xx errors
  (PermissionError, CSRFTokenError, ValidationError…) are not retried and network / 5xx errors are retried twice; with
  your own client, its settings apply (use the exported `frappeRetry` as its `retry` to get the same policy).
- **Writes are the app's.** The package confirms (e.g. a red "Delete" dialog) and calls your `onSelect` / bulk action;
  you call Frappe (`frappe.client.delete`, your own API…), then `invalidateFrappeList(queryClient, doctype)` to reload.

## API

- `FrappeListView` — `ListView` props plus `doctype`, `columns` (curated, placed first), `baseFilters`, `searchFields`,
  `groupByFields`, `chunkSize`, `pageSize`, `fieldLabels` (per-field labels, e.g. Arabic), `client`.
- `FrappeProvider` — `client`, `queryClient`. Uses the app's React Query client when there is one; otherwise creates
  one. `FrappeListView` creates a provider itself when neither is present.
- `createFrappeClient({ baseUrl, csrfToken, credentials, transport, fetch })` — `transport` replaces HTTP (tests,
  another auth scheme).
- `useFrappeList`, `useFrappeMeta` — the same data for custom layouts; `useFrappeList(...).listProps` spreads onto
  `ListView`.
- Pure helpers: `buildFrappeListMeta`, `columnsFromMeta`, `filterFieldsFromMeta`, `queryToFrappe`,
  `conditionToFrappe`, `buildListRequest`, `frappeLinkSearch`, `invalidateFrappeList`, `toFrappeError`, `FrappeError`.
- React Query keys: `["sf-frappe", "meta" | "list" | "count", doctype, …]`.

## Limitations

- **Auth:** same-origin session cookie + CSRF only (v0.1). Token / OAuth / cross-origin setups are possible through a
  custom `transport` and are not provided (Phase 3 decision).
- **Labels:** DocField labels and Select option values are shown as defined on the server (not translated by the
  package); pass `fieldLabels` or curated columns for Arabic. Standard fields and all package text are localized.
- **One `or_filters` list:** see Search above.
- **Grouping** is client-side over the loaded rows (no server group counts); counts are exact only once everything is
  loaded (until then they end in "+").
- **Not supported:** child tables (Table fields), virtual DocTypes, realtime updates (lists refresh on change, Retry or
  `invalidateFrappeList`), report view features (group-by SQL, aggregates), Frappe's per-user list settings
  (`user_settings`; the List View's own preferences are used).
- **Datetime filters** compare in the server's time zone, as Frappe does.

## Not yet verified

A read-only check on a live site (ToDo list: load, search, filter with "Match any", count, link search, permissions)
— waiting for your approval of the site and how the test session authenticates. Planned checks include that
`reportview.get_count` returns the filtered total with `or_filters`.
