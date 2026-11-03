# `it.todo` classification — @solvfast/ui 0.4.0-dev.26 (Phase 26 E, 2026-11-03)

Scope: every `it.todo` in `tests/` at `ddbf977` (0.4.0-dev.26): **16**, in four parity files. Each row says what the
todo asserts, whether the behaviour exists in `src/` (with the line), the native source it cites (checked against
`apps/frappe` 15.110 read-only), and one class:

- **Converted** — written as a real test in this phase (allowed only in `tests/parity/keys.test.ts`).
- **Safe to defer** — the behaviour exists or the gap is documented; the test can be written later without a site.
- **Required before RC** — must be done before `0.4.0-rc.1`.
- **Bug** — the todo describes behaviour the code gets wrong.
- **Unsupported behaviour** — the package does not implement it; documented as a limitation.

Result after this phase: **vitest 812 passed / 11 todo** (was 807 / 16). Nothing was deleted or hidden: the 11
remaining todos are listed below with their reason.

| Class | Count | Rows |
|---|---:|---|
| Converted | 5 | K1–K5 |
| Safe to defer | 9 | E1–E5, F1, F3, F4, D1 |
| Unsupported behaviour | 1 | F2 (and the 3-part `options` branch of F1) |
| Safe to defer — already covered elsewhere, specific case not asserted | 1 | D2 |
| Required before RC | 0 | — |
| Bug | 0 | — |

Honesty note: none of the rows below is real-Frappe verification. Where a native source is cited it was read in
`apps/frappe` (read-only); the only real evidence in the package is `tests/real/sada-real.test.tsx` and
`docs/frappe-components/62-real-frappe-verification.md`.

## 1. `tests/parity/keys.test.ts:54-58` — cache invalidation rules (5) → **Converted**

The `describe.skip` block ("PENDING A1 hooks") was written before A1 implemented the rules. They exist, once, in
`src/frappe/services/cache.ts` and are called by the hooks (`src/frappe/hooks/useDocMutations.ts:23,68,72,76,83,87-103`,
`src/frappe/hooks/useRealtime.ts`). The list's quiet period is in `src/frappe/list/realtime.ts:12-13,28-33`
(`useListRealtime`, used by `FrappeListView.tsx:61`). All five now run against a real `QueryClient` with every key
seeded first and a second doctype (`Note`) proving that a `ToDo` rule never bleeds across doctypes.

| # | Todo | Implementation | Test now asserts |
|---|---|---|---|
| K1 | save/submit/update/cancel/amend/rename/workflow action: set doc, invalidate docinfo, list, count; rename removes the old doc key | `applySavedDoc` (`cache.ts:23-33`), `applyRenamedDoc` (`cache.ts:43-56`) | doc **set** (not invalidated); docinfo/list/count invalidated; `previousName` keys removed (new-doc naming); `__queued` → doc invalidated instead of set; rename moves the cached doc to the new name, removes old keys, re-reads |
| K2 | delete: remove doc + docinfo, invalidate list and count | `applyDeletedDoc` (`cache.ts:36-40`) | both keys removed, list + count invalidated |
| K3 | comment/assignment/attachment/share/follow: invalidate docinfo and list | `applyDocInfoChange` (`cache.ts:59-64`) | docinfo + list invalidated; doc and count untouched |
| K4 | realtime `doc_update` newer than cached `modified` → invalidate doc + docinfo; older or equal → no-op | `applyRealtimeEvent` (`cache.ts:74-88`) | older: no-op; equal: no-op; newer: doc + docinfo invalidated, list untouched; `docinfo_update` → docinfo only |
| K5 | realtime `list_update`: invalidate list + count, debounced 2 s (15 s large tables), never while rows are selected | cache half `cache.ts:75`; debounce half `list/realtime.ts` | cache rule immediate; hook with fake timers: two events 1 s apart reload once 2 s after the last; large table 15 s; `suppressed` drops the event with no later reload |

Caveat kept from the source comment (`list/realtime.ts:4-5`, UNVERIFIED): Desk re-requests only the changed names and
leaves the count alone; the package refetches the list query and the count. The test asserts the package's rule.

## 2. `tests/parity/errors.test.ts:102-106` — exception classes with "no contract kind" (5) → **Safe to defer**

The describe is titled "classes with no contract kind (open question 2) — expectations to settle". The question has
since been settled in code: every class the five todos name is in `KIND_BY_EXC` (`src/frappe/client.ts:56-70`) and the
status fallback (`client.ts:77-93`), with codes that match `apps/frappe/frappe/exceptions.py`:

| # | Todo | `exceptions.py` | Package mapping (`client.ts`) | Class |
|---|---|---|---|---|
| E1 | `NameError` 409 (not `DuplicateEntryError`) | `:50-51` 409; `DuplicateEntryError(NameError)` `:96` | `NameError → "validation"` (`:64`); `DuplicateEntryError → "duplicate"` (`:60`); status 409 → `validation` (`:86`) | Safe to defer |
| E2 | `RateLimitExceededError` / `TooManyRequestsError` 429 | `:79-80` 429; `:128-129` 429 (ValidationError subclass) | both → `"rate_limited"` (`:66`); 429 → `rate_limited` (`:89`) | Safe to defer |
| E3 | `InReadOnlyMode` / `QueueOverloaded` / `SessionStopped` 503 | `:252-253`, `:260-261`, `:58-59` all 503 | all → `"unavailable"` (`:67`); 503 → `unavailable` (`:90`) | Safe to defer |
| E4 | `LinkExpired` 410 | `:301-302` 410 (ValidationError subclass) | → `"not_found"` (`:65`); 410 → `not_found` (`:85`) | Safe to defer |
| E5 | `InvalidAuthorizationHeader` / `Prefix` / `Token` (CSRFTokenError subclasses, 400, API-key auth) | `:75-76` 400; `:273-282` subclasses | all four → `"csrf"` (`:69`) | Safe to defer |

Why deferred and not converted: `errors.test.ts` is outside this agent's edit scope, and the parent's guidance is that
these rows want real server status codes. What a later phase can do **without a site**: add the five as rows of the
existing `rows` table (`errors.test.ts:28-34`) through `classifyResponse` (`tests/parity/seam.ts:74`), because the
`exc_type → kind` mapping is pure. What still needs a site: confirming that the server really sends these
`exc_type` strings with these status codes to a JSON client (`docs/…/62` confirmed only 403 `PermissionError` and
417 `ValidationError` as Guest; 409 / 413 / session expiry are BLOCKED without an authenticated session —
`COMPONENT-COMPLETION-MATRIX.md` row 2). Not a bug: no row contradicts the native codes.

## 3. `tests/parity/format.test.ts` (4)

| # | Line | Todo | Evidence | Class |
|---|---|---|---|---|
| F1 | 85 | Currency without a resolvable currency field falls back to `sysdefaults.currency` (`meta.js:290-321`) | `fieldCurrency` (`src/frappe/services/format.ts:177-184`): no `options` → `ctx.currency` (the boot's `sysdefaults.currency`) or the default; `options` naming a doc field with an empty value → fallback. This matches `meta.js:291,316-320`. **But** the 3-part form `options = "Currency:company:default_currency"` (`meta.js:294-312`: resolve the referenced record, then its field, then session defaults) returns the fallback with the comment `UNVERIFIED parity: needs the referenced record loaded` (`format.ts:181`) | fallback: **Safe to defer** (testable now with a `FormatContext`); 3-part options: **Unsupported behaviour** (document in `LIMITATIONS.md`) |
| F2 | 86 | negative numbers keep the minus attached in RTL (`number_format.js:120-125`) — assert on a bidi-aware renderer | The cited lines are the digit-grouping loop; the minus is handled at `number_format.js:103-104,142` (`(is_negative ? "-" : "") + …`, a plain leading hyphen-minus). The package's `formatNumber` produces the same string; whether it stays attached in an RTL run is a rendering (bidi) question, not a string one, and the todo itself says so | **Unsupported behaviour** as a unit test (needs a browser/bidi assertion; candidate for the Stage-B matrix) — not a bug |
| F3 | 141 | context-qualified labels: Desk calls `__(label, null, parent doctype)`; "the bundle has no context map to test with" | `translateText` resolves `"<text>:<context>"` before `"<text>"` (`src/frappe/services/translate.ts:14-17`); `translateLabel` defaults the context to `bundle.doctype` (`:20-24`). The behaviour exists; a synthetic dictionary `{ "Status:ToDo": "…" }` would test it today. `foundation-hooks.test.tsx:50-54` and `foundation-boot.test.tsx:61` test the dictionary precedence but not the `:context` key | **Safe to defer** (quick win for the next test phase; no site needed) |
| F4 | 149 | KNOWN FIXTURE DEFECT: the seven `tests/fixtures/real-15.110/*.ar.json` are byte-identical to `*.en.json` and carry `__messages = null`; re-capture with an uncached `FormMeta` | Confirmed: `cmp` shows all 7 pairs identical. **The remedy in the todo text is futile**: in 15.110 `getdoctype` never fills `meta.__messages` — `desk/form/meta.py:21` only lists the key; the only writer of `response["__messages"]` is `translate.send_translations`, called solely from `desk/page/setup_wizard/setup_wizard.py:395`. Desk gets labels from `boot.__messages` (`boot.py:313`). So an uncached re-capture would produce identical files again; Arabic label assertions need an app/boot dictionary (D-25 boot, `docs/frappe-components/71`). This is already stated in `translate.ts:5-8` and matrix row 9 | **Safe to defer** — owner decision: (a) rewrite the todo as "Arabic labels come from the boot dictionary; fixtures carry none", or (b) approve a read-only re-capture to prove the point on the site. Any capture needs owner approval; none was run |

## 4. `tests/parity/dependencies.test.ts` (2)

| # | Line | Todo | Evidence | Class |
|---|---|---|---|---|
| D1 | 77 | `fn:` with a form triggers the registered handler (always-truthy promise in Desk, UNVERIFIED in practice) — decide whether to support | Supported through `EvaluatorOptions.fnHandlers` (`src/frappe/form/model/depends.ts:40,76`); without a handler `analyzeDependencies` reports `unsupported` (`:95-96`). Desk's own semantics (a script-manager trigger whose promise is truthy) are marked UNVERIFIED in the todo | **Safe to defer** — the todo is a product decision ("decide whether to support"); the package's handler registry is testable now; parity with Desk needs a site with a client script |
| D2 | 111 | `read_only_depends_on` writes `df.read_only = 1/0`, so a static `read_only=1` field becomes writable when the condition is false (`layout.js:721-749`) | Implemented: `resolveFields` assigns `df.read_only = truthy ? 1 : 0` (`depends.ts:123`), i.e. the dependency result **replaces** the static flag, as `layout.js` does. `tests/frappe-form-model.test.tsx:121-131` asserts `read_only` 0/1 from `read_only_depends_on`, but on a field **without** a static `read_only: 1`; the exact "static 1 → 0" case of the todo is not asserted anywhere | **Safe to defer** — one assertion (`{ read_only: 1, read_only_depends_on: "locked" }` with `locked: 0` → `0`) in a later test phase; behaviour exists |

## 5. Remaining todo inventory (11) — for the RC notes

| File | Lines | Count | Class |
|---|---|---:|---|
| `tests/parity/errors.test.ts` | 102–106 | 5 | Safe to defer (mapping exists; real codes need a session) |
| `tests/parity/format.test.ts` | 85, 86, 141, 149 | 4 | Safe to defer ×3 (85 fallback, 141, 149), Unsupported ×1 (86; plus the 3-part branch of 85) |
| `tests/parity/dependencies.test.ts` | 77, 111 | 2 | Safe to defer ×2 |

Nothing is "Required before RC" and nothing is a "Bug". Two items need an owner decision before they can move:
F4 (re-capture or rewrite) and D1 (support `fn:` handlers as Desk does, or keep the registry).
