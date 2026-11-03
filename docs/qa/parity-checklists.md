# Parity checklists — native Frappe 15.110.0 vs `@solvfast/ui` 0.4.0 (P1 areas)

Owner: A6 (QA). Status: **prepared, nothing here has been executed against any site.** Native evidence: Frappe
15.110.0 (`ab7e5ae`) at `/home/frappe/lovable_bench/apps/frappe` (read-only), traced in
`apps/serve_fast/docs/frappe-components/10–14`; where a scenario cites a doc and the source differs, the source wins
(see "Doc-vs-source findings" at the end). Contract: `docs/CONTRACT-0.4.md`, `src/frappe/contract.ts`.

## How to read a scenario

Every scenario has the same fields so that a review can grep them:

- **Tag** (exactly one):
  - `sim` — checkable against the simulated backend (`createFixtureTransport`) or recorded payloads. Proves shapes and
    client logic only, **never** Frappe parity.
  - `real-ro` — needs the real site, read-only (metadata, list reads, `search_link`, `get_count`, `validate_link`,
    `get_docinfo`/`has_permission`). No row is created, changed or logged. **`getdoc` is not read-only** (it writes
    `_seen` and View Log, `load.py:55-60`; GET requests commit when `flags.commit` is set, `app.py:414-420`), so
    opening a document is `real-rw` unless the document is an SFUI one and the footprint exists.
  - `real-rw` — needs the approved `SFUI Test` footprint (`e2e/frappe-site/seed-crm-site.py`) and only touches
    documents of the SFUI DocTypes.
  - `isolated` — must never run on the CRM site (server controllers, load, deadlock, 413, site settings, email,
    cross-version).
- **Pre** — preconditions. **Action** — what the user (or the harness) does. **Requests** — expected method + key
  args in Desk's wire format (objects/arrays JSON-stringified, `10` C1 §10). **Outcome** — visible result.
- **Source** — native file:line / Cypress spec / Python test. "Cypress: none" means no spec pins it; the scenario then
  derives from source reading only and the review must say so.
- **Pkg** — package-side note: where doc 13 §1.13 / §10 already records a deliberate divergence, it is listed here
  so a review does not report it twice.

Users used by `real-rw` scenarios (created by the seed script, all `@example.com`): `sfui-tester` (role SFUI Tester:
CRUD + submit/cancel, permlevel 0 and 1), `sfui-reader` (SFUI Reader: read only), `sfui-approver` (SFUI Approver:
workflow role), `sfui-limited` (SFUI Tester + a User Permission on SFUI Test Contact), `sfui-ar` (SFUI Tester,
`language = ar`). Fixture DocTypes: `SFUI Test Parent / Child / Tag Row / Contact / Workflow / Attachments`.

Each scenario has ONE `**Tag:**` (the strictest environment needed to finish it). A `(also has a simulated part)` suffix
means the client-side logic can be pre-checked on `sim`. Counts: `grep -o '^- \*\*Tag:\*\* [a-z-]*' docs/qa/parity-checklists.md | sort | uniq -c`.

---

## 1. Transport and errors (T)

#### T-01 Request shape of a method call
- **Tag:** sim
- **Pre:** client built with a recording transport. **Action:** call any POST method, e.g. `cancelDoc`.
- **Requests:** `POST /api/method/frappe.desk.form.save.cancel`, headers `Accept: application/json`,
  `X-Frappe-CSRF-Token` when a token is known, `credentials: same-origin`; body fields JSON-stringified when object or
  array (`savedocs.doc` MUST be a JSON string: `save.py:18` calls `json.loads`).
- **Outcome:** no `cmd` param, no `X-Frappe-CMD`; GET only for `getdoc`, `getdoctype`, `get_value`, `search_link`,
  `reportview.get*` (whitelist `methods=` is enforced, `handler.py:99-110`).
- **Source:** `request.js:87-100,256-279,400-405`; `desk/form/save.py:16-18`; `10` C1 §10. Cypress: none dedicated.
  Python: `test_client.py::test_array_values_in_request_args` (120).

#### T-02 Envelope success: `message`, `docs`, `docinfo`, `_link_titles`, `__messages`
- **Tag:** sim
- **Pre:** recorded `getdoc` response. **Action:** `getDoc("SFUI Test Parent", name)`.
- **Requests:** `GET frappe.desk.form.load.getdoc {doctype, name}`.
- **Outcome:** result is `{doc: docs[0], docinfo}`; there is **no `message` key** (`getdoc` returns None); link titles
  are merged into the title cache; `__messages` merged into the translation map.
- **Source:** `load.py:22-63`; `request.js:284-300`. Python: `test_form_load.py::test_load` (14).

#### T-03 `getdoc` of a name that does not exist is `200 []`, not 404
- **Tag:** sim
- **Tag note:** the real-rw variant (open a non-existent name of an SFUI DocType as `sfui-tester`) is run once in the first real-site session
- **Pre:** user has doctype permission. **Action:** `getDoc(dt, "does-not-exist")`.
- **Requests:** `GET getdoc`. **Outcome:** body `{"docs": []}`-less empty list (`message` absent, `docs` absent;
  `load.py:33-38` returns `[]` after `frappe.clear_last_message()`). The package must surface a `not_found`
  `FrappeError` (contract gap: the contract maps `not_found` only from `DoesNotExistError` 404; see open question 1)
  and never render a blank form.
- **Source:** `load.py:33-38`; `model.js:308-333` (`with_doc` leaves `locals` empty). Python: none. Cypress: none.

#### T-04 `_server_messages` double JSON
- **Tag:** sim
- **Pre:** body `{"_server_messages": "[\"{\\\"message\\\": \\\"X\\\", \\\"indicator\\\": \\\"red\\\"}\"]"}` with a 417.
- **Action:** any failing call. **Outcome:** `FrappeError.messages = [{message:"X", indicator:"red"}]`; a message
  array that contains any `raise_exception: 1` item yields **only** those items for display; `alert: 1` items are
  toasts, others dialog entries, stacked in one dialog.
- **Source:** `response.py:189` (`_make_logs_v1` :178-195); `request.js:451-465`; `messages.js:151-176`. Python:
  `test_api.py::test_logs` (342).

#### T-05 Error kind mapping by `exc_type`, then status
- **Tag:** sim
- **Pre:** recorded envelopes (one per row of the table in `tests/parity/errors.test.ts`).
- **Action:** feed each to the client. **Outcome:** `PermissionError`403→`permission`; `DoesNotExistError`404→
  `not_found`; `DuplicateEntryError`409→`duplicate`; `UniqueValidationError`417→`duplicate`;
  `TimestampMismatchError`**417**→`timestamp`; `MandatoryError`417→`mandatory`; `LinkValidationError`,
  `CancelledLinkError`(subclass), `LinkExistsError`417→`link`; any other `ValidationError` subclass
  (`InvalidEmailAddressError`, `CharacterLengthExceededError`, `WorkflowPermissionError`…)→`validation`;
  `CSRFTokenError`400→`csrf`; `session_expired:1` or 401→`session_expired`; non-JSON 413→`too_large`; status 0→
  `network`; 5xx / unparseable→`server`. Precedence: `exc_type` subclass specificity (a `DoesNotExistError` is also a
  `ValidationError`) before the generic 417 rule.
- **Source:** `exceptions.py:18-19,34-39,50-51,75-76,96,116,144-166,184`; `app.py:326`. Python:
  `test_api.py::test_logs`, `test_404s` (336), `test_unauthorized_call` (170).
- **Pkg:** classes with no contract kind (`NameError` 409, `RateLimitExceededError` 429 which *is* a ValidationError,
  `InReadOnlyMode` 503, `LinkExpired` 410) — see open question 2.

#### T-06 Session expiry beats the status code
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim (envelope) · real-rw (precondition: expire the `sid` of `sfui-tester` only)
- **Pre:** valid session, then the session row is removed. **Action:** any call.
- **Requests:** original call. **Outcome:** body carries top-level `session_expired: 1` (`sessions.py:326-333`, with
  the status of the underlying error, normally 403 for a Guest hitting a non-guest method); kind `session_expired`
  regardless of status; the UI shows the login prompt, never a permission message. A 403 *without* the flag is
  `permission`.
- **Source:** `request.js:432-438`; `sessions.py:326-333`; `10` correction 2. Cypress: `login.js` (login only).

#### T-07 CSRF: only enforced once `/app` rendered in that session
- **Tag:** real-rw
- **Tag note:** real-rw (needs two sessions of `sfui-tester`)
- **Pre:** session A created via `POST /api/method/login` only (no stored csrf token); session B created and then
  `GET /app` rendered (`get_csrf_token`, `sessions.py:194-203`; `www/app.py:35`).
- **Action:** `POST` any write without `X-Frappe-CSRF-Token` in A, then in B; then in B with the token scraped from
  `frappe.csrf_token = "…"` in the `/app` HTML. **Outcome:** A passes, B → 400 `CSRFTokenError` (`kind: csrf`, message
  "Invalid Request"), B+token → 200. The client must retry never silently with a stale token and must expose
  `csrf` so the host can refresh.
- **Source:** `auth.py:83-98`, `31` (`UNSAFE_HTTP_METHODS`); `10` C2 §5. Python: none named for CSRF (`10` says
  UNVERIFIED). Cypress: helpers read `window.frappe.csrf_token` (`support/commands.js:65-76`).

#### T-08 403 with `_error_message`
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim · real-rw (reader opens a Parent it may not read via User Permission)
- **Pre:** `getdoc` where read is denied. **Action:** `getDoc`. **Outcome:** `permission`, text =
  "Insufficient Permission for {DocType} {name}" taken from `_error_message`; server messages are *not* also shown
  (Desk nulls `_server_messages`, `request.js:144-170`).
- **Source:** `load.py:40-45`; `request.js:153-160`. Python: `test_permissions.py::test_if_owner_permission_on_getdoc` (524).

#### T-09 413 is non-JSON and is read from the status
- **Tag:** isolated
- **Tag note:** isolated (needs a body > `max_content_length`; 25 MB default, `app.py:199-202`)
- **Pre:** a throw-away site. **Action:** upload a file larger than the limit with `upload_file` (limit =
  `get_max_file_size()` for that path). **Outcome:** Werkzeug HTML 413 → kind `too_large`, never a JSON parse error;
  message uses the server limit (Desk's text falls back to 5 MB when `boot.max_file_size` is missing, `request.js:190`,
  which differs from the 25 MB server default — a package must not copy the 5 MB figure).
- **Source:** `app.py:140-141,199-202`; `request.js:190`. Python: none. Cypress: none.

#### T-10 Deadlock / timeout (500 JSON with `exc_type`)
- **Tag:** isolated
- **Action:** provoke `QueryDeadlockError` / `QueryTimeoutError` on a throw-away site. **Outcome:** HTTP 500 JSON (the
  508 rewrite is skipped for JSON, `app.py:341-354`); kind `server`, a retry affordance; `exception` text only when
  tracebacks are allowed. Never hang a spinner.
- **Source:** `request.js:235-254,344-352`; `10` correction 3.

#### T-11 Network failure
- **Tag:** sim
- **Action:** transport rejects (status 0). **Outcome:** `network`, retry button in `<FrappeErrorState>`; Desk shows
  "Connection Lost" (`request.js:30-39`).

#### T-12 Link/validation messages keep server HTML out of the DOM
- **Tag:** sim
- **Pre:** `_server_messages` with `<script>` / `<a href=javascript:>` content. **Outcome:** sanitized before render
  (contract: "sanitize before rendering").
- **Source:** contract `FrappeMessage` ("sanitize before rendering"); Desk passes server HTML to `frappe.msgprint` (`messages.js:117-309`). Cypress: none.

#### T-13 `validate_link` read-denied is a message, not an error
- **Tag:** real-rw
- **Tag note:** real-rw (`sfui-reader` fetching a field it cannot read)
- **Requests:** `GET/POST frappe.client.validate_link {doctype, docname, fields:["…"]}`. **Outcome:** 200 with
  `{name}` only and an orange "Cannot Fetch Values" message; no exception.
- **Source:** `client.py:471-485`. Python: `test_client.py::test_client_validatate_link` (161).

---

## 2. Metadata, permissions and display status (M)

#### M-01 `getdoctype` bundle: parent first, then child metas
- **Tag:** real-ro
- **Pre:** any readable DocType with a Table field (e.g. `Contact`, fixtures `contact.en.json`). **Action:**
  `getMetaBundle("Contact")`. **Requests:** `GET frappe.desk.form.load.getdoctype {doctype, with_parent:1,
  cached_timestamp?}`. **Outcome:** `MetaBundle.meta` = `docs[0]`, `children` keyed by name (Contact Email, Contact
  Phone, Dynamic Link…); `user_settings` ignored without error; the literal string `use_cache` keeps the cached meta.
- **Source:** `load.py:66-96`; `model.js:240-287`. Python: `test_form_load.py`. Fixtures: `tests/fixtures/real-15.110/`.

#### M-02 Arabic `__messages` and `translateLabel`
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim (fixtures `*.ar.json`) · real-ro (live capture of one DocType in `ar`)
- **Action:** `translateLabel(bundle, "First Name")`. **Outcome:** the Arabic string from `meta.__messages`; an unknown
  label returns the input unchanged; context-translated labels (`__(label, null, parent)`) fall back to the plain key.
- **Source:** `meta.js:15-22`; `base_input.js:154-165`. Cypress: `control_link.js` translated Gender (252, 285).

#### M-03 Display-status ladder, one case per rung
- **Tag:** sim
- **Pre:** `perm` per permlevel, `df`, `doc`. **Action:** `fieldStatus(df, doc)`. **Outcome (in order):**
  1. no perm object: hidden→None, `read_only`/`is_virtual`→Read, else Write;
  2. permlevel write & not `disabled` & not virtual→Write; read only→Read; none→None;
  3. `hidden`→None; 4. `hidden_due_to_dependency`→None;
  5. `docstatus>0` & Write→Read; 6. Read & `allow_on_submit` & `docstatus==1` & permlevel write→Write
     (docstatus 2 stays Read);
  7. workflow-managed field (state field, `update_field`) stays Read; 8. `read_only` or fieldtype Read Only→Read;
  9. `set_only_once` & saved (`!__islocal`)→Read.
- **Source:** `perm.js:191-265` (the ladder), `docs 11 §2.5`. Cypress: `depends_on.js`, `grid.js`
  (`toggle_display`/`toggle_enable`); Python: `test_permissions.py::test_set_only_once` (259).
- **Pkg:** step 7 reads the `cur_frm` global in Desk (`perm.js:239-250`), so it only fires inside an open form.

#### M-04 "Read + empty → hidden" is the control's rule, not the ladder's
- **Tag:** sim
- **Action:** render a read-only field with `null`, `""`, `"  "`, `0`. **Outcome:** null/blank hidden, `0` shown; HTML,
  Image, Button, Geolocation never hidden.
- **Source:** `base_control.js:123-131`; `datatype.js:31` (`is_null`).

#### M-05 permlevel>0 fields are ABSENT (not null) without read access
- **Tag:** real-rw
- **Tag note:** real-rw (`sfui-reader` vs `sfui-tester` on one Parent with a permlevel-1 field)
- **Requests:** `getdoc`. **Outcome:** key missing from `docs[0]` and from child rows for the reader; the form renders
  no control for it (status None) and **does not send the key back** on save; for the tester the field is present.
- **Source:** `document.py:754-781`; `10` C5 §2. Python: `test_form_load.py::test_fieldlevel_permissions_in_load` (25),
  `…_for_child_table` (107).

#### M-06 Document permissions come from `docinfo.permissions`
- **Tag:** real-rw
- **Pre:** Parent owned by `sfui-tester`; `sfui-reader` opens it. **Outcome:** Save/Submit/Delete absent; Print/Email
  per `docinfo.permissions`; `can("write")` is false even if the role-level DocPerm grants write elsewhere;
  `if_owner` rows grant only the owner (`has_if_owner_enabled`).
- **Source:** `load.py:99-143`; `permissions.py:196-307`; `perm.js:42-117`. Python: `test_permissions.py`
  (`test_if_owner_permission_overrides_properly` 469, `test_if_owner_permission_on_getdoc` 524). Cypress:
  `permissions.js` (has_perm 8, get_perm 22).

#### M-07 Workflow read-only shrinks permissions
- **Tag:** real-rw
- **Tag note:** real-rw (workflow fixture, `sfui-tester` without the state's `allow_edit` role)
- **Outcome:** doc opens read-only (fields Read, only read/cancel/share/print/email retained); `Save` hidden.
- **Source:** `workflow.js:53`; `form.js:1763`. Cypress: none.

#### M-08 Link search honours User Permissions
- **Tag:** real-rw
- **Tag note:** real-rw (`sfui-limited`)
- **Requests:** `search_link {txt, doctype:"SFUI Test Contact", reference_doctype, page_length}`. **Outcome:** only
  permitted Contacts; with `ignore_user_permissions:true` honoured only when the user also has select/read.
- **Source:** `search.py:185-206`. Python: `test_search.py::test_reference_doctype` (155).

#### M-09 `get_doc_permissions` / `has_permission` helpers
- **Tag:** real-ro
- **Requests:** `GET frappe.client.has_permission {doctype, docname, perm_type}`. **Outcome:** `{has_permission: bool}`
  agrees with `docinfo.permissions[ptype]` for the same doc.
- **Source:** `client.py:315-336`.

---

## 3. Form layout, dependencies, mandatory, save (F)

#### F-01 Layout from meta: implicit section, tabs, columns
- **Tag:** sim
- **Tag note:** sim (real metas from fixtures)
- **Pre:** `todo.en.json`, `contact.en.json`. **Outcome:** a leading anonymous section when the first field is not a
  Section Break; a "Details" tab is prepended when a Tab Break exists but the first visible field is not a Tab Break;
  columns split equally; sections with no visible control collapse (`empty-section`); a tab with no visible sections
  is hidden; with a single visible tab the tab bar is hidden.
- **Source:** `layout.js:139-171,389-416`; `tab.js:34-58`. Cypress: `form_tab_break.js`, `depends_on.js` (tab).

#### F-02 `depends_on` forms
- **Tag:** sim
- **Action:** evaluate with `doc`/`parent`. **Outcome:** `eval:doc.test_field=='Value'` true/false; plain fieldname
  truthy (arrays by length); `fn:` only with a form (else plain-name truthiness of `doc["fn:…"]` = false); boolean
  passes through; a throwing `eval:` surfaces "Invalid depends_on expression"; `!field` is **not** valid syntax (it
  reads `doc["!field"]`).
- **Source:** `layout.js:751-791`. Cypress: `depends_on.js` (display, tab).

#### F-03 `mandatory_depends_on` replaces static `reqd` (client)
- **Tag:** sim
- **Pre:** field with `reqd=1` and `mandatory_depends_on=eval:doc.test_field=='Some Value'`. **Outcome:** condition
  false → treated as not mandatory (dependency-derived `reqd` overrides the static one); true → mandatory. The
  server knows neither: a `mandatory_depends_on` field passes server validation empty; a static `reqd` hidden field
  still fails.
- **Source:** `layout.js:701-711,721-749`; `base_document.py:775`; `11 §2.4`. Cypress: `depends_on.js` "should set the
  field as mandatory depending on other fields value".

#### F-04 `read_only_depends_on`, including a whole Table
- **Tag:** sim
- **Outcome:** field and, for a Table, every row control become Read; flips back when the condition is false. Row
  context: `doc` = the row, `parent` = form doc.
- **Source:** `layout.js:701-749,763`. Cypress: `depends_on.js` "should set the table and its fields as read only…".

#### F-05 `collapsible_depends_on` and forced-open sections
- **Tag:** sim
- **Outcome:** collapsed = NOT truthy(expr); a collapsible section containing an empty `reqd` field is forced open;
  a validation error opens the section and activates its tab.
- **Source:** `layout.js:463-477`; `section.js:146-155`; `form.js:1952`. Cypress: `form.js` "Jump to field in
  collapsed section" (110), `form_tab_break.js` (9).

#### F-06 Client mandatory check and the "Missing Fields" dialog
- **Tag:** sim
- **Outcome:** parent and every child row checked; empty = null/undefined/blank string/empty Table (rows=0), `0` counts
  as filled; `docstatus 2` skipped; Prompt autoname without `__newname` reports "Name"; one dialog titled
  "Missing Fields", indicator red, body "Please fill the following mandatory fields before saving:" then
  `{Label} is required.` lines; tables grouped: every row → "In {Table}, {Label} is required in every row.", a row
  list, or "in N rows" when more than 10 ranges.
- **Source:** `save.js:104-247`. Cypress: `depends_on.js` (dialog assertion). Python: none.
- **Pkg:** hidden-by-dependency fields with static `reqd` ARE still checked (no display filter in `save.js:118-160`).

#### F-07 Save request: whole doc, `action`, exact `modified`
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim · real-rw
- **Requests:** `POST frappe.desk.form.save.savedocs {doc: JSON(whole doc incl. child arrays), action: "Save"}`.
  **Outcome:** response `docs[0]` replaces the local doc (new name, no `__islocal`/`__unsaved`); new child rows carry
  `__islocal:1` (or omit `name`); existing rows send their real `name`; stale `modified` → 417
  `TimestampMismatchError`; a clean form shows "No changes in document" and sends nothing.
- **Source:** `save.js:4-100`; `save.py:16-72`; `document.py:850`. Python: `test_document.py::test_conflict_validation`,
  `test_insert_with_child`. Cypress: `form.js` "create a new form" (34).

#### F-08 Server error order: links, then hooks, then mandatory
- **Tag:** real-rw
- **Tag note:** real-rw (SFUI Test Parent with a link to a missing Contact and an empty reqd field)
- **Outcome:** `LinkValidationError` ("Could not find …") appears before the mandatory error; a `validate` hook can
  fill a mandatory field.
- **Source:** `document.py:380-437,946-967`. Python: `test_document.py::test_mandatory`, `test_link_validation`.

#### F-09 Submit / Update / Cancel matrix
- **Tag:** real-rw
- **Outcome:** Submit→`savedocs` action `Submit`, docstatus 1; Update (allow_on_submit edits) skips client
  `validate`/`before_save` but still checks mandatory; Cancel→`frappe.desk.form.save.cancel {doctype,name}` after
  `get_submitted_linked_docs`; write permission is required for all three.
- **Source:** `form.js:825-1002`; `save.py:16-72`; `document.py:404`. Python: `test_document.py::test_update_after_submit`.

#### F-10 Fetch from: client fill via `validate_link`, server overwrite on save
- **Tag:** real-rw
- **Requests:** `frappe.client.validate_link {doctype, docname, fields: JSON([source fields])}`. **Outcome:** targets
  are overwritten on link change; clearing the link blanks them; on save the server re-fetches (unless
  `fetch_if_empty` and already filled), so a client-typed target value is not authoritative.
- **Source:** `link.js:709-765`; `base_document.py:787-880`. Python: `test_todo.py::test_fetch`, `test_fetch_if_empty`.
  Cypress: `control_link.js` "should update dependant fields (via fetch_from)" (177).

#### F-11 New-doc defaults
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim (+ real-ro for user-default inputs)
- **Outcome:** Select without default → first option; Check/Int → `cint`; `Today`, `__user`, `user_fullname`, `Now`
  (Datetime in system tz); Link defaults only if permitted; client defaults win over server fill.
- **Source:** `create_new.js:82-250`; `create_new.py:18-182`; `base_document.py:189`.

#### F-12 Conflict banner / reload
- **Tag:** isolated (also has a simulated part)
- **Tag note:** isolated for the realtime transport · sim for the 417 path
- **Outcome:** 417 `timestamp` offers Reload keeping the user's edits visible; with realtime, a dirty form gets a
  "Refresh" banner, a clean one reloads (1 s debounce).
- **Source:** `form.js:1117-1131`; `model.js:152-178`. Cypress: `socket_updates.js` "Shows version conflict warning" (14).

#### F-13 Dirty guard and double submit
- **Tag:** sim
- **Outcome:** `beforeunload` guard only while dirty; second Save click while saving is ignored.
- **Source:** `form.js:1352`; `save.js:76-81`.

---

## 4. Field controls (C)

### 4a. Link
#### C-01 Search request shape and debounce
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim · real-ro (against a CRM doctype, e.g. Customer)
- **Action:** type "ab" into a Link. **Requests:** after 500 ms `search_link {txt, doctype, ignore_user_permissions,
  reference_doctype, page_length: link_field_results_limit||10, filters?, query?}`. **Outcome:** rows show `label`
  (title doctypes) else `value`; `description` only when different from the value; duplicates merged; "Create a new X"
  only if `can_create` and not `only_select`.
- **Source:** `link.js:264-368`; `search.py:36-57,253-275`. Python: `test_search.py::test_link_field_order` (66),
  `test_search_relevance` (167). Cypress: `control_link.js` (45, 127).
- **Pkg:** package default page size and `SearchLinkOptions` per contract.

#### C-02 Blur with a hand-typed value validates and clears invalid
- **Tag:** real-rw
- **Tag note:** real-ro (`validate_link` on an existing CRM doctype) · real-rw
- **Requests:** `frappe.client.validate_link {doctype, docname}`. **Outcome:** `name:null` → field cleared; found →
  canonical case stored; empty/whitespace → `""`; no request right after a selection (`_validated`).
- **Source:** `link.js:373-386,701-765`. Cypress: `control_link.js` (79, 92). Python: `test_client.py` (161).

#### C-03 Query resolution order and `link_filters`
- **Tag:** sim
- **Outcome:** `link_filters` JSON merged *under* `get_query`; `eval:` values evaluated with `{doc,parent}`; server never
  re-checks them (any existing permitted value saves).
- **Source:** `link.js:577-699`; `docfield.py:90`.

#### C-04 Keyboard selection quirk
- **Tag:** sim
- **Outcome:** Tab/Enter with typed text selects only if the text is contained in the item's label or description.
- **Source:** `link.js:476-480` (UX, not a data contract).

### 4b. Dynamic Link
#### C-05 Doctype resolved from the sibling field of the same doc/row
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim · real-rw
- **Outcome:** `df.options` is a *fieldname*; empty sibling → no request, empty dropdown, typed value cleared on blur;
  Single doctype → "not a valid DocType for Dynamic Link"; inside a grid it reads the row's sibling; changing the type
  does not clear the target (package may, as a documented improvement).
- **Source:** `dynamic_link.js:2-31`; `link.js:267-268`. Cypress: `control_dynamic_link.js` (79, 94, 109).
  Python: `base_document.py` "must be set first".

### 4c. Child table
#### C-06 Row identity: new rows must be local
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim · real-rw
- **Outcome:** a new row with a client-invented `name` and **no** `__islocal` is UPDATEd (matches nothing) and silently
  not saved; rows without `name` or with `__islocal:1` are inserted; `idx` contiguous 1..n after add/delete/move;
  deleting a row on the client deletes it on save; an empty array deletes all rows.
- **Source:** `base_document.py:330-338,618-620`; `document.py:466-505`; `create_new.js:252-278`. Python:
  `test_document.py::test_insert_with_child` (81).

#### C-07 Columns, inline vs row form, read-only grid
- **Tag:** sim
- **Outcome:** columns = `in_list_view`, not hidden, permlevel-readable, widths from `columns` (default 2, Check 1)
  until the 12-col budget is exceeded; `editable_grid` unset → click opens the row form; Read status disables
  add/delete; per-row `depends_on`/`read_only_depends_on` use `doc`=row, `parent`=form.
- **Source:** `grid.js:993-1110`; `grid_row.js:28-42`. Cypress: `grid.js`, `depends_on.js`, `form.js` (81, 119).

#### C-08 Child validation messages
- **Tag:** real-rw
- **Outcome:** server `Row #n: Value missing for: …`; client range text per F-06.
- **Source:** `document.py:946-967`; `save.js:195-246`.

#### C-09 Table MultiSelect
- **Tag:** real-rw
- **Outcome:** exactly one used Link field; values shown as pills; select/backspace/× remove rows.
- **Source:** `table_multiselect.js`; `12 §11`. Cypress: `table_multiselect.js` (8, 31, 40, 50).

### 4d. Dates
#### C-10 Storage vs display formats
- **Tag:** sim
- **Outcome:** send `YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss` (system tz, no suffix), `HH:mm:ss`; accept
  `YYYY-MM-DD HH:mm:ss.ffffff` and unpadded `9:30:00` from the server; display in user `date_format`/`time_format`;
  Datetime display converted system→user tz; Time not converted; invalid input clears with "Date X must be in format".
- **Source:** `datetime.js:6-8,157-205`; `date.js:156-179`; `datetime.js` (control) `:47-60`; `time.js:88-111`.
  Cypress: `control_date.js` (23, 67), `datetime.js` (28, 72, 107).

#### C-11 Duration
- **Tag:** sim
- **Outcome:** seconds number; display `1d 2h 3m 4s`; `hide_days`/`hide_seconds`; empty → `0s` in formatters.
- **Source:** `duration.js:84-124`; `utils.js:1115-1197`; `formatters.js:281-288`.

### 4e. Numbers
#### C-12 Parse, precision, rounding
- **Tag:** sim
- **Outcome:** user group separators stripped, decimal separator normalised; arithmetic `1+2*3` accepted only for
  digits and `+-*/().`; precision `df.precision` → Currency: `currency_precision`/number-format → `float_precision` or 3
  (meta) while the control itself has no fallback of 3; three rounding methods from System Settings; Percent has no
  clamp and no `%` in the input.
- **Source:** `float.js:2-28`; `currency.js:2-14`; `number_format.js:90-258`; `meta.js:323-338`. Cypress:
  `control_float.js` (21), `control_currency.js` (24), `rounding.js` (7, 45). Python: `test_utils.py` rounding tests.

#### C-13 Currency resolution without ERPNext records
- **Tag:** real-ro
- **Tag note:** real-ro (CRM has ERPNext) — **Outcome:** `df.options` as a fieldname uses `doc[fieldname]`;
  `Company:company:default_currency` only works when the Company record is loaded client side, else system currency.
- **Source:** `meta.js:290-321`.

#### C-14 `formatValue` per fieldtype
- **Tag:** sim
- **Outcome:** Float drops decimals when the value has none; Percent default precision 2 plus `%`; Currency symbol
  placement; Check disabled box; Link title-or-name; Date/Datetime/Time per user format; unknown types fall back to
  Data; URL values never injected unescaped (Desk bug at `formatters.js:36-48`).
- **Source:** `formatters.js:420-438` + table in `12 §9`. Cypress: `control_data.js` (41).

#### C-15 Data option validators are soft in forms
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim (flag) · real-rw (hard rejection on save)
- **Outcome:** client marks `has-error` for Email/URL/Phone/Name; the form still posts; server raises
  `InvalidEmailAddressError`/`InvalidPhoneNumberError`/`InvalidNameError`/`ValidationError` (URL).
  Examples that must flag: email `captian`, URL `jkl`, `abcd.com`, phone `america`, name ` 777Hello`; valid:
  `hello@test.com`, `https://frappe.io`, `89787878`, `James Bond`.
- **Source:** `data.js:274-313`; `base_document.py:922-955`. Cypress: `data_field_form_validation.js` (24, 29, 37, 41).

#### C-16 Password, Select, Check
- **Tag:** real-rw
- **Outcome:** password comes back as `*****`; posting back all-`*` keeps the secret; Select outside options → 417
  "cannot be … It should be one of"; Check coerced with `cint`.
- **Source:** `base_document.py:892-920,1129-1160`.

---

## 5. List (L)

#### L-01 Query shape (package uses `get_list`; Desk uses `reportview.get`)
- **Tag:** real-ro
- **Requests (package):** `GET frappe.client.get_list {doctype, fields, filters, order_by, limit_start,
  limit_page_length, or_filters?}` and `get_count {doctype, filters, limit?}`. **Outcome:** same rows and count as
  `reportview.get`/`get_count` for the same filters (same `DatabaseQuery`).
- **Source:** `reportview.py:25-72`; `base_list.js:460-478`. **Pkg:** accepted divergence — no `_comment_count`,
  `user_info`, `group_by` (`13 §1.13`).

#### L-02 Count upper bound
- **Tag:** real-ro
- **Outcome:** native sends `limit:1001` and shows `1,000+` for a large table, click recounts exactly; unbounded
  `count(*)` on big tables is the documented package gap.
- **Source:** `list_view.js:34,658-684,1001-1032`; `reportview.py:53-72`.

#### L-03 Default sort and tie-break
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim · real-ro
- **Outcome:** `meta.sort_field`/`sort_order` else `modified desc`; non-`name/creation/modified` sorts append
  `` `name` <dir> `` so offset paging neither skips nor duplicates (package gap noted).
- **Source:** `sort_selector.js:198-208`; `base_list.js:56-57`.

#### L-04 Filter operators and serialization
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim (serialization) · real-ro (counts)
- **Outcome:** 3-tuples accepted; `like` auto-wrapped `%v%`; `in` list; Check `1/0`; `is set` → `!= ''`; Datetime
  `between` bounds from midnight to 23:59:59.999999; nested-set operators accepted by name.
- **Source:** `filter_utils` `:459-504`; `db_query.py:767-989`; `data.py:1888-1975`. Python: `test_db_query.py`
  (`test_between_filters_date_bounds`, `test_in_not_in_filters`, `test_is_set_is_not_set`).

#### L-05 Timespan filters resolved server side
- **Tag:** real-ro
- **Outcome:** `last 7 days` = [today-7, today]; `last 6 months` = quarter-aligned window; Cypress has no active spec
  (`relative_time_filters.js` is commented out) — the review must say "no native test".
- **Source:** `data.py:734-820`.

#### L-06 Columns, indicator, title/ID rules
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim (+ real-ro for a doctype with workflow/status)
- **Outcome:** Subject = `title_field` else `ID`; Status indicator precedence workflow → draft → cancelled →
  `meta.states` → submitted → `status` → enabled/disabled; `ID` column appended after truncation when a title field
  exists; column cap by width (4/6/10).
- **Source:** `list_view.js:375-486,1105-1121`; `indicator.js:26-122`.

#### L-07 Empty states
- **Tag:** sim
- **Outcome:** with filters "No {0} found with matching filters. Clear filters…"; without "You haven't created a {0}
  yet" + create button only when `can_create`.
- **Source:** `list_view.js:497-537`.

#### L-08 Selection and bulk actions
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim (selection) · real-rw (bulk)
- **Outcome:** selection survives refresh; Shift-click range; select-all = loaded rows only; bulk Edit →
  `bulk_update.submit_cancel_or_update_docs`; Assign To → `assign_to.add_multiple`; Add Tags → `tag.add_tags`.
- **Source:** `list_view.js:1296-1423,1601-1611`; `bulk_operations.js`. Cypress: `list_view.js` (13, 21).

#### L-09 Paging
- **Tag:** real-ro (also has a simulated part)
- **Tag note:** sim · real-ro
- **Outcome:** native is append ("Load more", sizes 20/100/500/2500); package offset paging is accepted; page size
  and total must agree with the count.
- **Source:** `base_list.js:374-424`. Cypress: `list_paging.js` (13, Report view).

#### L-10 Realtime refresh
- **Tag:** isolated
- **Tag note:** isolated (needs Socket.IO + Redis; shared with live sites)
- **Outcome:** `list_update` debounced 2 s (15 s large tables), ignored while rows are selected; refetch with
  `name in [names]`; no "click to refresh" prompt exists natively.
- **Source:** `list_view.js:1476-1599`. Cypress: `socket_updates.js` "List view updates in realtime on insert" (28).

#### L-11 Filters from URL / saved filters
- **Tag:** sim
- **Outcome:** `field=value` and `field=["op",value]` parse; unknown field dropped (native throws "Invalid filter").
- **Source:** `list_view.js:2130-2184,1682-1697`.

---

## 6. Workflow (W)

#### W-01 Transitions for a saved clean document
- **Tag:** real-rw
- **Requests:** `GET/POST frappe.model.workflow.get_transitions {doc}`. **Outcome:** only transitions whose `state`
  equals the doc state, role allowed, `condition` true; empty for new docs; unset state → `WorkflowStateError`.
- **Source:** `workflow.py:39`. Python: `test_workflow.py::test_approve`, `test_workflow_condition`,
  `test_default_condition`, `test_get_common_transition_actions`.

#### W-02 Self-approval
- **Tag:** real-rw
- **Outcome:** owner without `allow_self_approval` does not see the action; forced call → "Self approval is not allowed".
- **Source:** `form/workflow.js:86-97`; `workflow.py:116,221`.

#### W-03 `apply_workflow` discards unsaved edits
- **Tag:** real-rw
- **Requests:** `POST frappe.model.workflow.apply_workflow {doc: JSON, action}`. **Outcome:** server reloads from the DB;
  the package saves first (or warns) and replaces the local doc with the response; client mandatory check runs first.
- **Source:** `workflow.py:99`; `workflow.js:110-120`. Python: `test_workflow.py::test_wrong_action`.

#### W-04 Buttons replaced by the Actions menu
- **Tag:** real-rw (also has a simulated part)
- **Tag note:** sim · real-rw
- **Outcome:** with an active workflow, Submit is not offered (`can_submit` false), Save only when dirty, Cancel only
  if no transition reaches a docstatus-2 state (`can_cancel_document`); actions cleared when the form is dirty.
- **Source:** `toolbar.js:593,668-699,758-759`; `workflow.py:154`.

#### W-05 Indicator from Workflow State style
- **Tag:** sim
- **Outcome:** Success green, Warning orange, Danger red, Primary blue, Inverse black, Info light-blue, default gray;
  unsaved → "Not Saved" orange first.
- **Source:** `indicator.js:26-122`; `toolbar.js:44-67`.

#### W-06 Side effects of a transition
- **Tag:** real-rw
- **Tag note:** real-rw (footprint only; `send_email_alert` off)
- **Outcome:** a Workflow Action row for approvers, a Workflow comment in the timeline, `update_field` set.
- **Source:** `hooks.py:155` (`process_workflow_actions`); `workflow.py` comment. Python: `test_workflow.py::
  test_if_workflow_actions_were_processed_using_role`.

#### W-07 Server enforcement of state change
- **Tag:** real-rw
- **Outcome:** editing the state field directly by a user without a transition → `WorkflowPermissionError` (kind
  `validation`).
- **Source:** `workflow.py:166`.

---

## 7. Assignment (S)

#### S-01 Add assignment
- **Tag:** real-rw
- **Pre:** saved SFUI Parent. **Requests:** `POST frappe.desk.form.assign_to.add {doctype, name, assign_to: JSON(["u"]),
  description?, date?, priority?, bulk_assign:false, re_assign:false}`. **Outcome:** returns `[{owner,name}]`, at most
  **5**; ToDo created with priority default Medium; Assigned comment in docinfo `assignment_logs`; list `_assign` updated.
- **Source:** `assign_to.py:25-39,43-139`. Python: `test_assign.py::test_assign`. Cypress: `sidebar.js` (85).

#### S-02 Unsaved document
- **Tag:** sim
- **Outcome:** "Please save the document before assignment"; no request.
- **Source:** `assign_to.js:50-53`.

#### S-03 Duplicate and share messages are modal msgprints
- **Tag:** real-rw
- **Outcome:** "Already in the following Users ToDo list" and "Shared with the following Users with Read access" arrive
  in `_server_messages` as ordinary messages, not toasts (the `alert` flag is passed inside `.format()`).
- **Source:** `assign_to.py:131-137`.

#### S-04 Assignee without access is auto-shared
- **Tag:** real-rw
- **Tag note:** real-rw (`sfui-reader` w/o read on a Parent via User Permission)
- **Outcome:** DocShare read row appears in `docinfo.shared`; with System Settings `disable_document_sharing` it
  throws "Missing Permission" (the setting is site-wide → `isolated` for that branch).
- **Source:** `assign_to.py:102-113`.

#### S-05 Remove (cancel) and close
- **Tag:** real-rw
- **Requests:** `assign_to.remove {doctype,name,assign_to}`; `assign_to.close`. **Outcome:** remove sets ToDo
  Cancelled (server allows any user with read; UI shows it to assignee or writers); close only for the assignee;
  both return the (capped) list.
- **Source:** `assign_to.py:177-232`; `assign_to.js:344-358`. Python: `test_assign.py::test_assignment_removal`.

#### S-06 Re-read after save (assignment rules)
- **Tag:** isolated
- **Tag note:** isolated (needs an Assignment Rule; creating one is a site-wide automation)
- **Outcome:** `assignment_rule.apply` can change assignments on any save; the component refetches `docinfo`.
- **Source:** `hooks.py:151-181`; `assignment_rule.py:267`.

#### S-07 More than five assignees
- **Tag:** real-rw
- **Outcome:** `add` returns 5, `docinfo.assignments` returns all; the component must reconcile (merge or refetch).
- **Source:** `assign_to.py:38` vs `load.py:353-363`.

---

## 8. Timeline and comments (H)

#### H-01 Merge docinfo buckets into one ordered timeline
- **Tag:** sim
- **Outcome:** items from `communications`, `comments`, `versions`, `assignment_logs`, `attachment_logs`, `info_logs`,
  `workflow_logs`, `like_logs` ordered by `creation` (communications by `communication_date`); created/edited lines
  always present; `views` only in "show all activity"; share events are **never** shown natively (`share_logs` key
  is never set).
- **Source:** `form_timeline.js:135-175,374`; `base_timeline.js:46-78`; `load.py:130,149`.

#### H-02 Version line formatting
- **Tag:** sim
- **Tag note:** sim (recorded `Version.data`)
- **Outcome:** docstatus 1 → "submitted this document", 2 → "cancelled"; max 3 changed fields, values stripped of HTML
  and truncated to 40 chars; `row_changed` "in row #N"; added/removed rows aggregated; fields hidden from the user are
  skipped.
- **Source:** `version_timeline_content_builder.js:3-367`. Python: `test_version.py::test_get_diff`.

#### H-03 Communications paging
- **Tag:** real-rw
- **Requests:** `get_communications {doctype,name,start,limit:21}`. **Outcome:** 20 shown + "Load More"; comments are
  never paged.
- **Source:** `form_timeline.js:193-280`; `load.py:211-219`.

#### H-04 Add comment
- **Tag:** real-rw
- **Requests:** `POST frappe.desk.form.utils.add_comment {reference_doctype, reference_name, content, comment_email,
  comment_by}`. **Outcome:** returns the Comment; pushed at top; count refreshed; empty/whitespace-only content blocked
  client side; `@mention` markup `span.mention[data-id]`; Ctrl+Enter submits.
- **Source:** `utils.py:27-50`; `footer.js:21-58`; `comment.js:44-71`. Python: `test_comment.py`.
- **Pkg:** send the real user as `comment_email`; the server trusts it (A11 §12).

#### H-05 Edit / delete permissions
- **Tag:** real-rw
- **Requests:** `update_comment {name, content}`; `frappe.client.delete {doctype:"Comment", name}`. **Outcome:** edit
  only by owner or Administrator (server `utils.py:58-59`); delete shown only if the user may delete Comment — owners
  without that right cannot delete in Desk (Comment DocPerm: System Manager, Website Manager).
- **Source:** `form_timeline.js:614-662,692-734`; `comment.json`.

#### H-06 Realtime `docinfo_update`
- **Tag:** isolated
- **Outcome:** own comments not re-inserted; add pushes, update replaces by name, delete removes.
- **Source:** `form.js:1996-2030`; `comment.py:78-96`. Cypress: none for comments.

#### H-07 Attachments in the sidebar/timeline
- **Tag:** real-rw
- **Tag note:** real-rw (`SFUI Test Attachments`)
- **Requests:** `POST upload_file` multipart (`file,is_private,folder,doctype,docname,fieldname`); remove
  `POST frappe.desk.form.utils.remove_attach {fid}`; `get_docinfo`. **Outcome:** File doc returned; attachment log
  appears; removal respects "Protected File" on submitted docs.
- **Source:** `handler.py:175-263`; `utils.py:19-23`; `file.py:510-538`. Python: `test_file.py::test_attachment_limit`.
  Cypress: `file_uploader.js`, `sidebar.js` (50, 59).

#### H-08 Realtime msgprint/progress
- **Tag:** isolated
- **Outcome:** `msgprint` event routed to the message host; progress `{percent|progress:[n,total]}`.
- **Source:** `socketio_client.js:76-90`. Cypress: `socket_updates.js` (41, 50, 70).

---

## Doc-vs-source findings (source wins)

1. **Doc 41 §4 says "409 timestamp mismatch".** `TimestampMismatchError` is a plain `ValidationError` subclass with no
   status of its own, so Desk receives **417** (`frappe/exceptions.py:18-19,156-157`). 409 belongs to `NameError`
   and `DuplicateEntryError` (`exceptions.py:50-51,96`). The contract (`timestamp ← … (417)`) is right; doc 41 is wrong.
2. **413 limit.** Desk's client text falls back to **5 MB** (`request.js:190-196`, `frappe.boot.max_file_size ||
   5242880`) while the server default is **25 MB** (`app.py:199-202`). Docs state only the server value.
3. **Display ladder, workflow rung.** Doc 11 §2.5 step 6 says "`frm.read_only`"; the code reads the `cur_frm`
   global and its `states.update_fields` (`perm.js:239-250`), so the rung is inert outside an open Desk form.
4. **`fn:` in `depends_on`.** Source: `fn:` is honoured only when a form exists; otherwise it falls through to
   `doc["fn:…"]` truthiness (`layout.js:775-787`). Doc 11 says "needs a form"; the fall-through behaviour is not stated.
5. **Hidden fields in `check_mandatory`.** Doc 11 §5.6 marks "hidden-by-dependency fields still checked" as UNVERIFIED.
   Resolved by reading `save.js:118-160`: the loop filters only on `reqd`/`mandatory_depends_on`/Fold, not on display
   status, so they **are** checked.
6. Everything else spot-checked agrees with docs 10–14: `getdoc` `[]` (`load.py:33-38`), `savedocs` `json.loads`
   (`save.py:18`) and docstatus map (`:26-31`), assign `limit=5` (`assign_to.py:38`), `remove_attach` reads only `fid`
   (`utils.py:19-23`), Comment delete perms (`comment.json`), `session_expired` (`sessions.py:326-333`), the `*` hook
   chain (`hooks.py:151-181`).

## Open questions

1. How do `getDoc`/`useDoc` represent a missing document (`200 []`)? Proposal: throw `FrappeError{kind:"not_found",
   status:404}` synthesised by the client.
2. Kind for classes the contract does not list: `NameError` 409 (not `DuplicateEntryError`), `RateLimitExceededError`
   429 (a ValidationError), `TooManyRequestsError` 429, `InReadOnlyMode` 503, `LinkExpired` 410. Proposal: map by status
   first for 429/503/410 → `server` with `retryAfter`-style handling, or add kinds.
3. Is the extra roles/users set (SFUI Reader, SFUI Approver) acceptable in the footprint, or must everything use
   `SFUI Tester` plus User Permissions?

<!-- tag counts are produced by: grep -o '^- \*\*Tag:\*\* [a-z-]*' docs/qa/parity-checklists.md | sort | uniq -c -->
