# Foundation — client, provider, hooks, permissions, formatting, errors, boot, simulated backend

`@solvfast/ui/frappe` (0.4.0). The pieces every Frappe-aware component of the package is built on, and that an app can
use directly. Native behaviour reproduced here is traced from the Frappe 15.110.0 source (`ab7e5ae`) in
`apps/serve_fast/docs/frappe-components/10–14`; section numbers below ("docs 11 §2.5") refer to those files. The record
components built on these pieces are documented in [record.md](record.md).

> **Status.** Everything on this page is **Simulated & tested**: unit tests with stubbed `fetch`, recording transports,
> the simulated backend, and the real 15.110 `getdoctype` captures in `tests/fixtures/real-15.110/`. **Nothing has been
> verified against a real site yet.** Items marked UNVERIFIED are reasoned from source only.

Contents: [1 Requirements](#1-requirements) · [2 Client](#2-client-createfrappeclient--frappeapi) ·
[3 Provider](#3-frappeprovider) · [4 Hooks and cache](#4-hooks-and-the-cache) · [5 Permissions](#5-permissions-usepermissions) ·
[6 Formatting](#6-formatting-formatvalue--formatcontext) · [7 Translations](#7-translations-translatelabel) ·
[8 Errors and messages](#8-errors-and-server-messages) · [9 Boot](#9-page-boot-readfrappeboot) ·
[10 Realtime](#10-realtime-skeleton) · [11 Simulated backend](#11-simulated-backend-frappetesting) ·
[12 Limitations](#12-known-limitations-and-unverified-points)

## 1. Requirements

| What | Why |
|---|---|
| Frappe 15 (traced against 15.110) | the endpoints and argument names below; other versions untested |
| The page is served by the Frappe site (same origin) | the session cookie authenticates; cross-origin cookies are not Frappe's default |
| A valid CSRF token on the page | every POST carries `X-Frappe-CSRF-Token` (see §9 — the `frappe.session.csrf_token` Jinja expression renders `"None"`) |
| `@tanstack/react-query` ^5, React 18 | caching, mutations; peer dependencies |
| Stock Frappe only | no app-specific backend; Core DocTypes Comment, ToDo, Version, File, Workflow, Workflow State, Currency, User are used where noted |

## 2. Client: `createFrappeClient` / `FrappeApi`

```ts
import { createFrappeClient } from "@solvfast/ui/frappe";
const client = createFrappeClient({ session: { user: "ann@example.com", fullName: "Ann" } }); // same origin
const { doc, docinfo } = await client.getDoc("ToDo", "TD-0001");
```

Options: `baseUrl` (default same origin), `csrfToken` (string or function; default `window.csrf_token`, then
`window.frappe.csrf_token` — `"None"` and `""` count as missing), `credentials`, `fetch`, `transport` (replace HTTP,
e.g. the simulated backend), `session` (`add_comment` identity). Every call is `POST /api/method/<method>` with a JSON
body; objects and lists are sent as JSON strings, as Desk does.

`createFrappeClient()` returns a `FrappeApi` = the 0.3 client + `DocumentApi` + `RecordApi` (contract.ts).
`withFrappeApi(client)` upgrades any 0.3-style client over its `call`.

| Method | Native endpoint (args) | Returns | Needs on the site |
|---|---|---|---|
| `call(method, args)` | any whitelisted method | the whole response body | — |
| `getMeta` / `getMetaBundle(dt)` | `frappe.desk.form.load.getdoctype` (`doctype`) | `MetaBundle` (DocType + child-table DocTypes) | read on the DocType |
| `getDoc(dt, name)` | `frappe.desk.form.load.getdoc` | `{ doc, docinfo }`; a missing name (Frappe answers 200 with no docs) → `FrappeError` kind `not_found` | read; unreadable permlevel fields are ABSENT |
| `getDocInfo(dt, name)` | `frappe.desk.form.load.get_docinfo` | `DocInfo` (comments, versions, assignments, `permissions`, `user_info`…) | read |
| `saveDoc(doc, action)` | `frappe.desk.form.save.savedocs` (`doc` JSON, `action` Save / Submit / Update) | the saved doc (`localname` on a new doc) | create (insert) or write; submit for Submit / Update |
| `cancelDoc(dt, name, {workflowStateField, workflowState}?)` | `frappe.desk.form.save.cancel` | the cancelled doc | write + cancel |
| `deleteDoc(dt, name)` | `frappe.client.delete` | — | delete; fails with kind `link` while other documents link to it |
| `renameDoc(dt, old, new, {merge})` | `frappe.rename_doc` (`old`, `new`, `merge`) — what Desk uses | the new name | write, `allow_rename` |
| `validateLink(dt, value, fetchFields?)` | `frappe.client.validate_link` (`docname`, `fields` JSON) | `{ name: canonical or null, values }` | select or read on the target |
| `runDocMethod(doc, method, args?)` | `run_doc_method` (`docs` = the LOCAL doc JSON) | `{ doc, message }` | read + a whitelisted controller method |
| `searchLink(dt, txt, opts)` | `frappe.desk.search.search_link` (`page_length`, `reference_doctype`, `filters`, `query`, `searchfield`, `ignore_user_permissions`; `opts.args` = a custom query's extra keys) | `[{ value, label?, description }]` | select or read |
| `getList` / `getCount` | `frappe.client.get_list` / `frappe.desk.reportview.get_count` | rows / number | read |
| `getWorkflow(dt)` | from `getdoctype` → `__workflow_docs` (how Desk obtains it) | `WorkflowInfo` or null | Workflow, Workflow State (Core) |
| `getWorkflowTransitions(doc)` | `frappe.model.workflow.get_transitions` (`doc` JSON) | transitions allowed for the user's roles and conditions | read |
| `applyWorkflow(doc, action)` | `frappe.model.workflow.apply_workflow` | the doc (the server RELOADS it: unsaved edits are discarded) | the transition's role |
| `addAssignment(dt, name, users, opts)` | `frappe.desk.form.assign_to.add` (`assign_to` JSON) | ≤ 5 open assignments (Frappe's cap; `docinfo.assignments` is uncapped) | read on the doc; ToDo |
| `removeAssignment(dt, name, user)` | `frappe.desk.form.assign_to.remove` | open assignments | read |
| `addComment(dt, name, html)` | `frappe.desk.form.utils.add_comment` (`comment_email`, `comment_by` from `session`) | the Comment | read; Comment |
| `updateComment(id, html)` | `frappe.desk.form.utils.update_comment` | — | owner or Administrator |
| `deleteComment(id)` | `frappe.client.delete` on Comment | — | delete on Comment (System / Website Manager only, by default) |
| `subscribeMessages(fn)` | — | the `_server_messages` of SUCCESSFUL responses ("Saved" alert …) | — |

Limitations: a queued submission (`queue_in_background`) returns no doc; `saveDoc` / `applyWorkflow` then return the
sent doc flagged `__queued: 1` (UNVERIFIED shape). `getdoc`'s `_link_titles` are not surfaced.

## 3. `FrappeProvider`

```tsx
import { FrappeProvider, readFrappeBoot } from "@solvfast/ui/frappe";

<FrappeProvider boot={readFrappeBoot()} onAlert={(m) => toast(m.message)}>
  <App />
</FrappeProvider>
```

| Prop | Default | Purpose |
|---|---|---|
| `client` | a same-origin `createFrappeClient()` (with the boot's token if `boot`) | any FrappeClient; wrapped once with `withFrappeApi` |
| `queryClient` | the app's, else a new one (no retry on 4xx, csrf, session_expired, too_large) | React Query cache |
| `session` | `boot.session` | `{ user, fullName, roles }` — roles drive permissions and workflow read-only |
| `translations` | `boot.translations` | source → translation dictionary for labels |
| `formatContext` | `boot.formatContext` | settings for `formatValue` |
| `boot` | — | `readFrappeBoot()` result; fills the three above unless given explicitly |
| `serverMessages` | `"show"` | `"show"`: show success messages of this client's calls + host `useFrappeMessages`; `"host"`; `false` |
| `onAlert` | built-in alert region | route `alert` messages (e.g. to `@solvfast/ui/toast`) |

Hooks: `useFrappeApi()` (the provider's FrappeApi), `useFrappeClient()`, `useFrappeSettings()`, `useFormatContext()`.
An inner provider inherits the outer one's settings for props it does not set.

## 4. Hooks and the cache

| Hook | Query key (`frappeKeys`) | Notes |
|---|---|---|
| `useMetaBundle(doctype?)` → `UseQueryResult<MetaBundle, FrappeError>` | `metaBundle(dt)` | stale 5 min; the provider's `translations` are folded into `meta.__messages` |
| `useDoc(doctype?, name?)` → `UseQueryResult<LoadedDoc, FrappeError>` | `doc(dt, name)` holds the **FrappeDoc**; `docinfo(dt, name)` seeded from the same getdoc | one request on first load; a docinfo invalidation refreshes `data.docinfo` without re-reading the doc |
| `useDocInfo(doctype?, name?)` | `docinfo(dt, name)` | stale 30 s |
| `useSaveDoc()` → mutation `{ doc, action }` | sets `doc` under the server's name (drops a new doc's `new-…` keys); invalidates `docinfo`, `list`, `count` | `__queued` → invalidates `doc` instead |
| `useDocAction()` | `cancel` (set doc …), `remove` (remove doc + docinfo; invalidate list, count), `rename` (old keys removed, re-read under the new name), `runMethod` (cache untouched), `applyWorkflow`, `assign`, `unassign`, `addComment`, `updateComment`, `deleteComment` (invalidate docinfo + list) | every rule lives in `services/cache.ts`; components never invent keys |
| `useRealtimeInvalidation(port, dt, name?)` | doc_update newer than the cached `modified` → doc + docinfo; docinfo_update → docinfo; list_update → list + count | needs a RealtimePort (§10) |

Use `applySavedDoc`, `applyDeletedDoc`, `applyRenamedDoc`, `applyDocInfoChange`, `applyRealtimeEvent` when you call the
client yourself.

```tsx
const { data, error, refetch } = useDoc("CRM Lead", id);
const save = useSaveDoc();
if (error) return <FrappeErrorState error={error} onRetry={refetch} />;
await save.mutateAsync({ doc: { ...data!.doc, status: "Qualified" }, action: "Save" });
```

## 5. Permissions: `usePermissions`

```ts
const { levels, can, fieldStatus, displayStatus, workflow, workflowReadOnly, known } = usePermissions(bundle, doc, docinfo);
```

- **Rights per permlevel** (`frm.perm`, perm.js `get_perm`): with `session.roles`, the DocPerm rows × roles; on a
  saved doc every key of `docinfo.permissions` (server-evaluated: ownership, user permissions, shares) overwrites level 0;
  for a non-owner the rights granted only by `if_owner` rows are removed; the user's `docinfo.shared` row adds read /
  write / submit / share.
- **Without roles** (no `session.roles`): Phase 26 **rule 9 — missing information denies** (since 0.4.0-dev.26). A saved
  doc gets exactly the server-evaluated level 0 (`docinfo.permissions`, which already applied ownership, `if_owner` and
  User Permissions — permissions.py:196-250 — plus the user's `docinfo.shared` row, load.py:130); permlevels > 0 get
  nothing (Desk reads them from the role rows, which are missing — nothing is inferred from which fields the doc
  carries). A NEW doc gets nothing: no read / write / create, the form renders no fields and no Save. `known` is then
  `false` (`permissionsKnown`): show "permissions unknown", not "forbidden" — and pass `session.roles`
  (`frappe.user_roles` in Desk, `frappe.auth.get_logged_user` + roles from boot in an SPA). Before dev.26 a new doc was
  optimistic (read / write / create) and permlevels > 0 were inferred.
- **Administrator** (verified in Frappe 15.110 source, `docs/release/PERMISSION-AUDIT.md` §6): `session.user ===
  "Administrator"` gets every right at every permlevel, **with or without `session.roles`** — the server never checks
  further (permissions.py:107-109, :273-275; document.py:756, :788) and its roles are every Role record
  (`get_roles`, :506-507). The "Administrator" *role* on another user is just a role (its DocPerm rows; perm.js:59-61 only
  adds `read`) — and the server never reports it for anyone else (automatic role, :37, :515). `canImport` /
  `canExport` take the session too (`canImport(meta, session, levels[0])`): the Administrator imports when the DocType
  has `allow_import` (model.js:435; Data Import refuses it otherwise, data_import.py:64) and always exports (:609).
- **Workflow read-only** (`frappe.workflow.is_read_only`): a saved doc whose state's `allow_edit` roles the user lacks →
  rights shrink to read / cancel / share / print / email. Needs roles; without them a saved doc in a workflow is
  read-only (rule 9; Administrator excepted) and, since dev.31, `known` is `false` there (the form shows "Read only").
- **`fieldStatus(df, doc, parent?)`** = `frappe.perm.get_field_display_status`, step by step (docs 11 §2.5): permlevel
  rights (write and not disabled / virtual → Write, read → Read, else None) → `hidden` → `hidden_due_to_dependency`
  (set by whoever evaluates `depends_on`) → submitted demotes Write → `allow_on_submit` re-promotes on docstatus 1 →
  workflow step (a no-op in Desk, kept as such) → `read_only` / "Read Only" → `set_only_once` on a saved doc. Boolean
  and 0/1 flags both count.
- **`displayStatus`** adds the form control's rules: a Write cell of a Read table is Read; a Read field with a blank value
  is hidden (except HTML / Image / Button / Geolocation). `isFetchLocked(df, doc)` tells whether a `fetch_from` field
  renders read-only.

**Forms without permission information.** `FrappeFormView` without a `permissions` prop denies every right (since
0.4.0-dev.31, P2-1): fields read-only, no Save / Submit / Update / Cancel / Amend, no Ctrl+S, the "Read only" notice
(`data-permissions="unknown"`). Pass `usePermissions(...)` (as `FrappeForm` does) or your own `{ can, levels, known }`.
"Cancel All" (linked submitted documents) is offered only when `canCancelAllLinked` answers `true` (P3-1).

The server is the authority: these reproduce Desk's UX; nothing is skipped because the client checked it. The full
action-by-action audit (which right gates what, what the server checks, how a refusal surfaces) is
`docs/release/PERMISSION-AUDIT.md`.

## 6. Formatting: `formatValue` / `FormatContext`

```ts
formatValue(1234.5, { fieldname: "amount", fieldtype: "Currency" }, doc, useFormatContext()); // "SAR 1,234.50"
```

Desk's read-only formatters (`frappe.format`, docs 12 §9) as plain strings: Int (no grouping; File Size), Float (no
decimals when integral; with `options` → Currency), Percent (precision default 2), Currency (precision chain, symbol
side, hidden symbol, per-currency number format), Check (`checkLabels`), Select (translated), Date, Datetime (system →
user time zone, Intl only), Time (no zone), Duration (`1d 2h 3m 4s`, `0s`, hide_days / hide_seconds), Link / Dynamic Link
(link title when known), Data (IBAN grouped). `undefined` (an unreadable, absent field) is always `""`.

| FormatContext | Desk source | Default |
|---|---|---|
| `dateFormat`, `timeFormat`, `numberFormat` | `sysdefaults.date_format` / `time_format` / `number_format` | `yyyy-mm-dd`, `HH:mm:ss`, `#,###.##` |
| `floatPrecision`, `currencyPrecision` | `sysdefaults.float_precision` / `currency_precision` | none (Desk's fallbacks: 3 / 2) |
| `currency`, `currencies` | `sysdefaults.currency`, `:Currency` boot docs | `USD`, none |
| `hideCurrencySymbol`, `useNumberFormatFromCurrency`, `roundingMethod` | `sysdefaults` | No, No, Banker's Rounding (legacy) |
| `timeZone {system, user}` | `boot.time_zone` | no conversion |
| `linkTitles`, `translate`, `checkLabels`, `durationUnits` | `_link_titles`, `__`, — | none, identity, Yes/No, d h m s |

Limitations: `Company:link:field` currency options fall back to the default currency (the record is not loaded);
Text Editor / HTML values are returned as stored (render through a sanitizer); digits are always Latin (Desk also
formats with Latin digits).

## 7. Translations: `translateLabel`

`translateLabel(bundle, text, dictionary?, context?)` = Desk's `__(text, null, doctype)`: the key `"text:DocType"`, then
`"text"`, else the text unchanged. **Frappe 15.110's `getdoctype` sends no `__messages`** (the real `ar` and `en`
captures are identical); Desk gets the dictionary from its boot. Supply it through `FrappeProvider translations` or the
page boot (§9); `useMetaBundle` then folds it into the bundle.

## 8. Errors and server messages

`FrappeError` keeps `status` / `excType` and adds `kind`, `messages` (parsed `_server_messages`) and `exception` (the
last traceback line, when the site allows tracebacks).

| kind | From | | kind | From |
|---|---|---|---|---|
| `permission` | PermissionError, 403 | | `csrf` | CSRFTokenError (400) |
| `not_found` | DoesNotExistError, 404, LinkExpired / 410, getdoc's 200 with no docs | | `session_expired` | body `session_expired: 1` (any status), 401 |
| `duplicate` | DuplicateEntryError (409), UniqueValidationError | | `too_large` | 413 (Werkzeug HTML) |
| `timestamp` | TimestampMismatchError (417) | | `rate_limited` | TooManyRequestsError, RateLimitExceededError, 429 |
| `mandatory` | MandatoryError | | `unavailable` | 503: InReadOnlyMode, QueueOverloaded, SessionStopped |
| `link` | LinkValidationError, CancelledLinkError, LinkExistsError | | `network` | status 0 |
| `validation` | any other 417, FrappeTypeError, NameError (409) | | `server` | anything else (5xx, unparseable) |

- `<FrappeErrorState error onRetry? onReload? loginUrl? compact? />` — one rendering for every component: title per
  kind, the server's messages as sent (the `raise_exception` ones when present; HTML through an allow-list, never raw)
  and a hint. One action per kind, never a pointless one: Retry (`onRetry`) only for network / server / rate_limited /
  unavailable; Reload (`onReload`, else `onRetry`) for a timestamp conflict, whose hint replaces the server sentence;
  Reload page for csrf; Log in for session_expired (`/login?redirect-to=…`); none for permission, not_found,
  duplicate, mandatory, link, validation, too_large.
- `useFrappeMessages().show(messages)` — Desk's msgprint semantics (docs 14 §B3): if any message raises, only those
  show; `alert` / `toast` messages go to a 7 s alert; the others stack in one dialog titled by the last message.
  `FrappeProvider` hosts it and, by default, shows the messages of successful responses (as Desk does).
- Strings come from the `fe…` keys of the `frappe:foundation` message block (English and Arabic); replace them per key
  with `<ThemeProvider messages={{ en: { feErrPermission: "…" } }}>`. Server messages are shown as sent.

## 9. Page boot: `readFrappeBoot`

The page's server render can provide what Desk gets from its boot — the CSRF token, the session user and roles, the
format settings and the translations — without a new endpoint. `readFrappeBoot(source = window.__sf_boot)` maps the
injected JSON to `{ session, lang, csrfToken, formatContext, translations, sysdefaults, isGuest }` (undefined when
absent or unrendered, e.g. under Vite's dev server); pass it as `<FrappeProvider boot>`.

Server side (reference implementation: CRM branch `crm/boot`, `serve_fast/www/serve_fast.py` and
`docs/frappe-components/71-frappe-mode-boot.md`): `frappe.sessions.get_csrf_token()` + commit (as Desk's `www/app.py`),
the current user's id / full name / roles / lang, the display sysdefaults, time zones, enabled currencies and
`frappe.translate.get_messages_for_boot()`; JSON via `frappe.as_json` with `<`, `>`, `&` escaped, in a
`<script type="application/json">` block. Only the current user's own data; a guest gets `{"user": "Guest"}`.
Not deployed anywhere yet (owner decision D-25).

## 10. Realtime (skeleton)

`createSocketRealtime(socket)` adapts an app-created Socket.IO client (same origin, namespace `/<site>`,
`withCredentials`) to `RealtimePort`: `doc_subscribe` / `doctype_subscribe` rooms, reference-counted, re-subscribed on
`connect`; `doc_update`, `docinfo_update`, `list_update` forwarded. Use with `useRealtimeInvalidation`. The package does
not depend on `socket.io-client`. Tested against a fake socket only; realtime needs the site's Node service and Redis.

## 11. Simulated backend (`@solvfast/ui/frappe/testing`)

```ts
import { createFixtureTransport } from "@solvfast/ui/frappe/testing";
const transport = createFixtureTransport({ meta: { ToDo: todoMeta }, docs: { ToDo: [...] }, workflows: {...} }, { strict: true });
<FrappeProvider client={createFrappeClient({ transport })}>…</FrappeProvider>
```

**What it is:** an in-memory backend answering every method the package calls (getdoctype, getdoc, savedocs, cancel,
reportview get / get_count, search_link, workflow, assignments, comments, bulk actions, linked-docs pre-flight,
amend …) in Frappe's request / response **shapes**. Errors are built as Frappe's bodies and parsed by the same
`toFrappeError`. It keeps named documents with child rows, bumps and checks `modified`, checks static `reqd`, docstatus
transitions, drops client-invented child rows like Frappe does, names documents like `model/naming.py`, derives
assignees from ToDo docs, writes Version docs and Workflow comments. Options: `strict` (Link existence and Select
options), `roles`, `permissions` (below), `handlers` (extra methods, `run_doc_method:<name>`), `listSettings`, `now`.

**Simulated permissions (opt-in, Phase 27).** Pass `permissions` and the simulator evaluates every call for that
session, approximating the server (frappe/permissions.py, db_query.py, document.py, load.py — rules and lines in
[the caveats §4](../qa/simulator-caveats.md#4-opt-in-permission-model-createfixturetransportbackend--permissions--phase-27)):

```ts
import { createFixtureTransport, simScenario } from "@solvfast/ui/frappe/testing";
const transport = createFixtureTransport(backend, {
  permissions: simScenario.userPermissions("omar@example.com", ["Data Entry"],
    [{ allow: "User", for_value: "omar@example.com", applicable_for: "Travel Request" }],
    { shares: [{ share_doctype: "Travel Request", share_name: "TR-0002", user: "omar@example.com", read: 1 }] }),
});
<FrappeProvider client={createFrappeClient({ transport, files: transport.files })} session={transport.store.session}>…
```

- Roles as `get_roles` gives them (assigned + All + Guest, + Desk User for a System User); the **Administrator** user
  passes everything. DocPerm rows × roles at level 0 with `if_owner`; User Permissions (`allow`, `for_value`,
  `applicable_for`, strict mode); DocShare rows (`shares`; `assign_to.add` adds a read share like Desk); controller hooks
  you declare (`hooks`, built-in: ToDo).
- `getdoctype` always loads; `getdoc` / lists / counts / `get_value` / `search_link` answer **403** without read and
  return only the rows the session may read; `docinfo.permissions` = `get_doc_permissions`, `docinfo.shared` = the
  doc's shares; permlevel > 0 values the roles cannot read are stripped from docs (absent in getdoc, null after a save)
  and dropped from list columns; saves reset values of permlevels the roles cannot write.
- `savedocs` (create / write / submit / cancel), `delete`, `delete_items`, `rename_doc`, `apply_workflow` (+ self-approval),
  `assign_to.*`, comments and `transport.files.download` (`download_template` + `can_export`) refuse with the server's
  error bodies (403 `_error_message` + check logs).
- Seven named builders (`simScenario.*`): administrator, full-access role, read-only role, restricted DocType, restricted
  fields (permlevel), User Permissions, unknown roles (the client gets no roles — rule 9 — while the server evaluates the
  automatic roles, as `get_roles` always appends them). `transport.store.session` is the session to give the client.
- Phase 27 list actions and Data Import are simulated too (caveats §4.1b): `remove_multiple`, `bulk_apply` (no rules →
  no-op), `add_tags`, workflow common actions / bulk approval, `download_multi_pdf(_async)`, `export_query` (an Access
  Log row first, as on a site), and the Data Import sequence over CSV files — a **dry run** by default (rows checked and
  logged, nothing written; `dataImport: "insert"` makes the simulator insert them, labelled). Every file the simulator
  answers is a text file labelled SIMULATED — never a PDF / CSV / XLSX with document values.
- Without `permissions` nothing changes (every right, as before).

**What it is NOT:** evidence of Frappe behaviour. Without `permissions` it has no permission model (the session user may
do everything); with it, the decisions are an approximation (no Custom DocPerm, no hooks other than declared / ToDo, no
tree User Permissions …). No format / length / unique validation, no server-side `fetch_from`, no workflow conditions,
no file storage (the `files` transport answers `download_template` with a text file labelled SIMULATED — labels and
request echo, never data — and refuses uploads), no realtime. A green test on it says the component builds the right
requests and renders the right shapes — nothing about what a site accepts. Report results on it as "Simulated". Read
**[the simulator caveats](../qa/simulator-caveats.md)** (QA) before relying on it for anything else.

## 12. Known limitations and UNVERIFIED points

- Not run against a real site: every behaviour above is from source reading and simulated tests.
- Permissions without `session.roles` deny what they cannot establish (rule 9, §5); pass the roles.
- Queued submissions (`__queued`), `Company:x:y` currency options; the simulator's Version values imitate the
  server's `get_formatted` (formatters.py + `fmt_money`) but are not produced by it.
- Translations need an app or boot dictionary (§7); the `ar` dictionary size per page load is not measured.
- Workflow `allow_edit` is a client UX rule here; whether the server enforces it on a plain save is UNVERIFIED.
- Realtime reconnect behaviour and payload details beyond the cited emitters.
