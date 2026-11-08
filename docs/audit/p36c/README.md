# P36c — owner decisions on the batch-2 open items (`@solvfast/ui` 0.7.0-dev.4, unreleased)

P36c is the owner's final decision batch on what P36 batch 2 (`docs/audit/p36b/README.md`) left open. Integration branch
`feat/0.7.x/p36-int` (`package.json` 0.7.0-dev.4), base `7e8f957` (0.7.0-dev.3). Nothing was pushed, tagged, published or
deployed. **No Frappe site was contacted, seeded, read or written: every result below is jsdom / simulator evidence (and,
for LinkInput and the header, Playwright in Chromium on local static builds — the showcase, and the CRM in mock data
mode).**

| Document | What it holds |
|---|---|
| `CHANGELOG.md` → 0.7.0-dev.4 | Added / Changed (incl. the default changes) / Fixed / Deviations from Desk / Validation status |
| `docs/audit/p35/COVERAGE.md` §11 (and §10 P36b-1, P36b-3) | the 8 rows whose cells P36c edited; no status change, **258 / 301** |
| `docs/audit/p36/VALIDATION-MATRIX.md` §5 | the 3 P36c real-site tests (prepared, not run; 94 in the catalogue) — generated from `e2e/frappe-site/matrix/catalogue.mjs` |
| `docs/audit/p35/CRM-MIGRATION.md` §9 | the CRM side: pickers' final state on `crm/p36b-070`, the header gain, Commission & Referral not migrated |
| `docs/LIMITATIONS.md` | Image view bulk actions, Assign To User Group, LinkInput picker keyboard, phone Navbar, new server rules |
| `docs/components/views.md` §2–4, `record.md` (Assign), `forms.md` (LinkInput), `search.md` ("Phone header (P36c)") | component docs, written by the workstreams |

## 1. Decisions → implementation → evidence

| # | Owner decision (final) | Implementation | Evidence (jsdom / simulator unless stated) |
|---|---|---|---|
| 1 | **LinkInput:** do not accept the differences without review; fix the 4 px height; verify Space against Frappe; investigate Ctrl+N/P; preserve native keyboard behaviour; keep search, selection, Escape, a11y; document intentional differences | Height: **no change** — LinkInput already has the DS field height (36 px = Input / Select / DateField); the 4 px came from the old CRM picker, a 40 px DS `Button`. Space: a plain Space on a filled, closed picker with nothing typed opens the full list, like Desk's Select (a native `<select>`). Ctrl+N/P: cmdk's `vimBindings`, not Desk — **not added**. Arrow wrap: kept (= Awesomplete). Keyboard opens (Enter / ArrowDown / Space) now select the shown text — a **bug fix** (typing appended to the label after a keyboard pick). Picker mode only; no API change | `tests/linkinput-p36c.test.tsx` P36C.linkinput.1–10 (mutation: disabling the Space branch fails .1 and .8; negative controls .4 / .10 for the default mode); P36b's 13 tests unchanged; Chromium: showcase probe 32 / 32, CRM `linkinput.mjs` 1448 / 0 (the P36b script unchanged: 1168 / 0) |
| 2 | **Header at 390 px acceptable;** check whether more title space is possible without overflow or redesign | `Navbar` below `md`: 12 px inline padding (was 16), 2 px icon gaps (was 4) → title **+18 px** at 390 and 360. **A DEFAULT change for every `Navbar` / `AppShell` consumer on phones** (no opt-out prop); desktop unchanged; buttons stay 32 × 32 | `tests/header-p36c.test.tsx` P36C.header.1–3 (with Navbar.tsx reverted .1 and .3 fail); CRM in Chromium (27 routes × en/ar × light/dark × 390/360): title 106 → 124 px / 76 → 94 px, truncated titles 68 → 48 per theme, 0 overflow, search trigger named, standard CRM suite identical |
| 3 | **Report view keeps its de-duplication** (intended deviation) + regression tests for every name-taking action | No code change; tests only | `tests/views-p36c.test.tsx` P36C.views.20–31: Submit, Cancel, Delete, Edit, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Export, Workflow — each document on two rows, every name sent once, counts per document (negative control: with `uniqueNames` made the identity all 12 fail) |
| 4 | **Commission & Referral NOT migrated;** every-row editing stays; no card layout; horizontal scroll kept | No change (package or CRM) | `CRM-MIGRATION.md` §9.3 |
| 5 | **Image view Actions** approved | `FrappeImageView bulk` → Desk's Actions on checked cards through the shared `useFrappeSelectionActions`; Core `ImageView` gains the List view's selection props; `FrappeViews bulk` reaches the Image view | P36C.views.1–14 (+ .32); showcase `#p36c-views` (SIMULATED) |
| 6 | **Assign To User Group** approved | Core `AssignDialog groups`; `FrappeAssignTo layout="sidebar"` `userGroups` and `FrappeBulkOptions.userGroups` (both default on). Desk **replaces** the users with the group's members (first 20) and unticks Assign to me — the owner's brief said "merge"; Desk replaces; **Desk followed** | `tests/usergroup-p36c.test.tsx` P36C.usergroup.1–14 (negative .7 / .9 / .11); showcase `#frappe-assign-user-group` (SIMULATED) |
| 7 | (cut off in the owner's message) | **Nothing changed.** The LinkInput default-mode candidates stay as they are, pending the owner | — |

Integrator changes in this batch (`44bff60`): the simulator ships Frappe's **User Group / User Group Member metas by
default** (`BUILTIN_FIXTURE_META`, so the new group field works on every simulated site, e.g. the playground and older
showcase pages, instead of answering "DocType User Group not found"); **bulk Edit follows the DocType meta once it loads**
(the Report and Image views mount `useFrappeBulkActions` before the meta and opened an empty field picker) + regression
test P36C.views.32 (fails without the fix).

## 2. Per decision — what was read, what changed

### 2.1 LinkInput picker mode (decision 1)
- **Native spec read (Frappe 15.110, read only):** Desk Link = Awesomplete 1.1.5 (`form/controls/link.js:211-216`;
  awesomplete.js keydown `:72-92` handles only Enter / Tab / Esc / ↑ / ↓ while open — Space types and the input event
  searches "label "); Desk Select = native `<select>` (`controls/select.js:2`) — Space opens; Desk's `ctrl+p` is Print
  (`form/form.js:167`) and `frappe.ui.keys` shortcuts return early inside inputs (`ui/keyboard.js:44-47`); Ctrl+N/J/P/K
  are cmdk 1.1.1's `vimBindings` (default on), which the replaced CRM `SearchableSelect` inherited.
- **Space, per state (picker mode):** filled + closed + nothing typed → opens the full list, text selected, no space
  inserted; list open / text typed / empty box → types; Ctrl / Alt / Meta / Shift + Space and IME composition → left alone;
  disabled / read-only → nothing; default mode → types (unchanged).
- **Changed code:** `src/fields/LinkInput.tsx` (Space branch; keyboard opens call `openFull(true)`), comment-only
  `src/fields/autocomplete.tsx`; showcase `p36b-linkinput` gained "Keyboard, compared with Desk" and a height row;
  `docs/components/forms.md`.
- **Height measured** (Chromium, `getBoundingClientRect`): CRM P1–P5 pickers 40 px before P36 (SearchableSelect button),
  36 px in P36b and P36c; DS Input and Select triggers on the same pages 36 px throughout. Guard: P36C.linkinput.7 (class
  token parity) and a "box = 36 px" check in the CRM script.

### 2.2 Phone header (decision 2)
- `src/shell/Navbar.tsx`: pane `px-4 md:px-6` → `px-3 md:px-6`; right group `gap-1` → `gap-0.5 md:gap-1`. No API change.
- Rejected options (with reasons in the workstream report): no gap (tiles read as one strip), 28 px buttons (smaller touch
  targets; the bell is in `NotificationPanel`), moving search into a menu (two taps, a redesign), smaller title font (a DS
  typography change), hiding logo / language / theme (removes functions).
- CRM: **no commit** — the gain comes from the package (`CRM-MIGRATION.md` §9.2).

### 2.3 Report view de-dup (decision 3)
Desk's `get_checked_items(true)` (report_view.js:1339-1352) returns one name per checked datatable row, so a document shown
on several child rows is sent several times and the server reports the repeat as failed (or, for other methods, answers
with a duplicate message — see V-REPORT-3). The package's `uniqueNames` (`useFrappeSelectionActions`) keeps sending each
document once. The tests synthesise the one-row-per-child response with a transport wrapper (the simulator returns the
first child row only).

### 2.4 Image view Actions (decision 5)
Desk: `ImageView extends ListView` (image_view.js:6) and keeps its check events (`:17-21`) and a per-card checkbox
(`:113-114`, `hidden-xs`), but its header is commented out (`:161-177`: no select-all, no "{n} items selected") and its rows
carry no `docstatus` (`set_fields`, `:23-31`). The package: card checkboxes (Space toggles the focused card), Add ↔ Actions
in the header slot, the List view's gates (`listActionsMenu`) and selection outcomes (`selectionAfterBulk`), shared dialogs
(Edit, Add Tags, Print, Assign To, Export), the outcome line under the cards; `selectionMode="bar"` still available.
Files: `src/list/views/ImageView.tsx`, `src/list/parts/ListTable.tsx` (`SelectionHeaderContent` exported from its module
only), `src/frappe/views/FrappeImageView.tsx`, `src/frappe/views/FrappeViews.tsx`, `docs/components/views.md`.

### 2.5 Assign To User Group (decision 6)
Desk (assign_to.js:142-160, :191-197): a Link to User Group after the users field; on change it unticks Assign to me and
`frappe.db.get_list("User Group Member", {parent_doctype: "User Group", filters: {parent}, fields: ["user"]})` — `db.js`
adds `limit: 20` — then `set_value("assign_to", members)`, which **replaces** the pills (multiselect_pills.js:77-80). The
list's bulk Assign To uses the same dialog (bulk_operations.js:225-238). Server: `reportview.get_list` →
`check_read_permission(child, parent_doctype)` → `has_child_permission` (permissions.py:763-846) → read on User Group,
which the automatic **Desk User** role has (user_group.json). `assign_to.add` assigns disabled users and reports open
duplicates ("Already in the following Users ToDo list"); neither is filtered client-side, as Desk.
Files: `src/record/AssignDialog.tsx`, `src/frappe/record/userGroups.ts` (new), `src/frappe/record/FrappeAssignTo.tsx`,
`src/frappe/list/FrappeBulkActions.tsx`, `src/theme/messages-ws/sidebar.ts` (4 keys, en + ar),
`src/frappe/testing/handlers/sidebar.ts` (`childTableList`), `docs/components/record.md`.

## 3. Intentional differences from Frappe (complete for P36c)

**LinkInput picker mode** (opt-in; picker mode only — the default mode used by `FrappeLinkField` is Desk's Link):
1. Click / tap / Enter / ArrowDown / Space on a FILLED box opens the FULL list (Desk's Link lists only on an empty-box
   focus, link.js:35-41) — select parity for pickers over a known list; Space per Desk's Select.
2. Every open selects the shown text so typing replaces it (no Desk equivalent).
3. `selectedIndicator`: `aria-selected` on the current value; the highlight via `aria-activedescendant` (Awesomplete marks
   the highlight).
4. `keepValueWhenEmptied` (Desk clears an emptied Link).
5. Escape restores the shown value (Awesomplete closes and leaves the text).
6. Home / End move to the first / last row while the list is open and nothing is typed (Desk's Select / the WAI-ARIA
   listbox; Desk's Link: caret).
7. Both modes: ArrowDown on a CLOSED box opens the list (pre-existing WAI-ARIA combobox convention; Awesomplete ignores it).
No longer differences after the review: height (36 px), arrow wrap (= Awesomplete), Ctrl+N/P (absent in Desk too).

**Image view Actions:** a selection strip (select-all on the page, count, Clear) Desk's Image view does not have; the card
checkbox stays on phones (Desk `hidden-xs`); the rows request `docstatus`, so Print works on submittable DocTypes (Desk's
Print check, bulk_operations.js:16-40, refuses every image card for non-Administrators); no shift-click range select
(list_view.js:1398-1424); "Add {DocType}" is the host's `primaryAction` (no built-in create / Quick Entry); `bulk` is
opt-in (Desk always shows the checkboxes); inherited from P36b: partial failure = a status line + reload (Desk:
`frappe.throw`, no refresh), no `task_id` progress. Like heart, PhotoSwipe gallery, `get_attached_images`: still not
reproduced.

**Report view:** a document shown on several rows is sent once (owner decision 3).

**Assign To User Group:** (a) Assign to me: Desk unticks it and (if it was ticked) empties the list before the members
arrive; the DS replaces the list on success and keeps it on a refused read. (b) A status line / "{0} has no members." note
under the field (Desk shows nothing). (c) Refusals shown under the field (Desk: modal "Not permitted"). (d) Hand-typed text
that is not a listed group is discarded. (e) A known full name instead of the user id in the pill. (f) The request does not
carry `assign_to_me` / `assign_to_user_group` (ignored by the server); the members read goes by POST (Desk: GET). (g) A
repeated member row is listed and sent once (Desk keeps it; only import / API can store one). The 20-member cap is Desk's
own limitation, reproduced. The opt-in bar's `AssignPicker` popover has no group field (Desk has no popover).

**Phone header:** DS chrome; Desk keeps its 300 px search bar on phones (navbar.html:2) — no Desk equivalent of this spacing.

## 4. Remaining gaps

- **No real-site validation** of anything in P36c (the 3 catalogue tests below are prepared, not run).
- Real-site-only: the server answers of the bulk methods from Image-view cards; the one-row-per-child `reportview.get`
  shape the de-dup tests synthesise; a real User Group's member order (ties on `modified`) and the 20 cap; User Permissions
  on the member rows; the 403 body when a site narrows User Group's permissions; `assign_to.add` on a disabled member.
- Real devices: VoiceOver / NVDA when Space opens the picker; hardware-keyboard Space on iOS / Android; tap accuracy at 2 px
  header spacing; iOS / Android title widths (measured in Chromium with the CRM's web font only).
- Not done (out of scope or owner pending): item 7 (default-mode LinkInput candidates); `TagInput` measures 38 px vs 36 px;
  the DS `Command` / `SearchCombobox` still inherit cmdk's Ctrl+N/J/P/K and `loop: false`; `FrappeBulkActions`' user search
  lacks Desk's `{user_type: "System User", enabled: 1}` filter (pre-existing); Image view shift-click range select.
- `docs/audit/p36/VALIDATION-MATRIX.md`'s title still says 0.7.0-dev.3 — the title is hard-coded in
  `e2e/frappe-site/matrix/render.mjs`, which this docs step did not edit; the content is current (`--check` passes).
- The staging teardown does not know User Group: F-SB-ASSIGN-2 deletes the group it creates in its own `finally`; a
  crashed run can leave one "SFUI P36 RUN … group" (remove by hand).

## 5. Real-site tests (prepared, not run)

| Test | Rows | What it asserts |
|---|---|---|
| V-IMAGE-2 | LV.H5, LV.F8, LV.F9 | `reportview.get` with `attach_image` + `docstatus`; bulk Submit / Cancel of checked cards and the reload |
| F-SB-ASSIGN-2 | LV.F3 | User Group search and members read as a Desk User; `limit`; 403 without / with an invalid `parent_doctype`; `assign_to.add` / `add_multiple` with the members; creates and deletes its own group (needs `sysmgr`) |
| V-REPORT-3 | LV.F14, LV.H1, LV.F1, LV.F3, LV.F6, LV.F10 | what update, `add_multiple`, `add_tags` and `delete_items` do with a name sent twice (Desk's per-row names) |

LinkInput and the Navbar have no real-site test (client-only).

## 6. Incidents

**P36c header workstream — unquoted heredoc ran commands in `/home/frappe/lovable_bench` (~20:35 UTC, 2026-11-08).** While
writing its report, the header agent left a shell heredoc unquoted, so bash executed the backticked command names in the
text in the session's working directory `/home/frappe/lovable_bench` (not a git repository, no `package.json`):
- `npm run typecheck`, `npm run build`, `node scripts/check-boundaries.mjs` and `git checkout -- styles` failed at once (no
  `package.json` / "not a git repository") — nothing was built, packed or checked out.
- **`npx vitest run` did run** there and executed the jsdom unit tests it found under `apps/socotech`, `apps/hotelswave`,
  `apps/hotelswave_ota`, `apps/sear_product` and `apps/ai_copilot` (not serve_fast, not frappe; no bench, Python or site
  access; no URL in its output).
- Its only artefact was a new vitest results cache under `/home/frappe/lovable_bench/node_modules/.vite/` (that
  `node_modules` did not exist before) — **removed**.
- The integrator verified that **no file under `/home/frappe/lovable_bench/apps` changed after 20:33 UTC**.
- Lesson: report heredocs must be quoted (`<<'EOF'`); every command runs with an explicit `cd` into the package worktree.

## 7. Commits (`git log --oneline --first-parent 7e8f957..HEAD`, before this docs commit)

| Commit | What |
|---|---|
| `0be423b` | merge **views** (`e0a0942`, `8c17ec7`, `d7f4ec8`, `dd3d8f0`): Image view Actions; Report de-dup regression tests |
| `2b5f066` | merge **usergroup** (`615c81b`, `1dcc355`, `f34b2f6`, `c60d13d`, `fb6602e`, `8e1403e`): Assign To User Group |
| `44bff60` | integrator: simulator User Group metas by default; bulk Edit follows the meta + P36C.views.32 |
| `2bb5dd1` | merge **linkinput** (`6597ba0`, `fd7f42c`, `1e6b18f`): Space / keyboard-open text selection; 36 px confirmed |
| `a1efeb1` | merge **header** (`cef4cec`, `7f9a4ee`): phone Navbar spacing |
| `2fb762a` | version 0.7.0-dev.4 |

CRM (separate repository, local only): `crm/p36b-070` = `f7bd1da` + `c38335f` (comment-only, from `crm/p36c-pickers`);
`crm/p36c-header` has no commit.

## 8. Docs-step checks (this commit)

Run by the docs step at the docs commit (package directory, load average ≈ 1.4):

| Check | Result |
|---|---|
| `npx vitest run` | **85 files, 1678 passed, 10 todo, 0 failed** (52 s) |
| `node e2e/frappe-site/matrix/render.mjs --check` | VALIDATION-MATRIX.md is current |
| `npx vitest run tests/frappe-site-guards.test.ts` | 23 passed (incl. "VALIDATION-MATRIX.md is the rendering of the catalogue", 301 applicable rows, 62 §5 rows) |

Not run by the docs step (integrator's): typecheck, build, boundaries, package check, CRM regression.

## Integrator gate results

Integrator run on `feat/0.7.x/p36-int` at 0.7.0-dev.4 (package gates at 6ea5eb9; CRM `crm/p36b-070` c38335f against a local pack of this version, sha1 b3c568ffee15, mock mode). SIMULATOR / mock evidence only — no real Frappe site.

| Check | Result |
|---|---|
| `npm run typecheck` | OK |
| `npx vitest run` | 85 files: 1678 passed, 10 todo, 0 failed |
| `npm run build` | OK; tarball 899 files, 1089.4 kB (styles/* restored after the build) |
| `check:boundaries` (source + dist) | OK |
| `check:package` | OK |
| `node e2e/frappe-site/matrix/render.mjs --check` | VALIDATION-MATRIX.md is current (94 tests prepared, none run) |
| CRM regression (`crm/p36b-070` against a local pack of 0.7.0-dev.4, mock mode) | tsc 30 errors (= baseline); vite build OK; route sweep 82 loads / 0 console errors; mock flows 16/0; records-assign 111/0; 28 lists 112/112; legacy 56/0; p35 376/0; p36 336/0; p36-legacy 10/0; LinkInput 1448/0; Global Search 188/0; lifecycle labels PASS; tags+assign en 43/43, ar 43/43; actions en 22/22, ar 22/22 (first ar run hit an 8 s wait timeout in the assign dialog; two reruns 22/22); SD/SM outside shots vs v073f: 171 identical, 1 different (sd-playbook-1 dark-ar-390, 2 px = known noise) |
