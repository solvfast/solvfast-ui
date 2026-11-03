# Review R3 - closure of R2 (0.4.0-dev.21)

Reviewer: A6. Simulated backend only; nothing touched a site. Evidence: full vitest 772 passed / 16 todo (the two R2 `it.fails`
were already flipped to `it` and pass), real-browser re-run of the Stage B matrix on dev.21 (12 scenarios x light/dark x EN/AR, plus
mixed-direction runs for `form-contact` and `list`; 0 page errors, 0 console errors, 0 horizontal overflow), screenshots in
`/tmp/a6-shots/r3/` (not committed), `e2e/stage-b-geometry.mjs` (new: bounding-box and text checks in a real browser).
Severity: P1 blocks 0.4.0, P2 before the CRM relies on it, P3 backlog.

**Verdict: no P1, no P2 open. All R2 items are closed; every V1-V10 is confirmed fixed in a real browser. Three P3 observations remain.**

## 1. R2 code items

| ID | Native evidence | Closure | Result |
|---|---|---|---|
| R2-F1 amend copies non-DocField keys | `create_new.js:303-308` (`df && ...`) | `form/model/copy.ts` `copyValues`: `if (!df) continue` | Closed (`review-r2.test.ts`, test now a normal `it`) |
| R2-F2 `amendment_date` | `form.js:1021-1023` | `amendDoc` sets `todayString()` when the field exists | Closed (test flipped) |
| R2-F3 Cancel All gated by cancel rights | `form.js:925-931` (`can_cancel` over every linked doctype; message "You do not have permissions to cancel all linked documents.") | `FrappeForm` `canCancelAllLinked` -> `rolePermissions(meta.permissions, session.roles).levels[0].cancel` for each linked DocType; the dialog shows the explanation instead of the button when false | Closed. See R3-F1 |
| R2-F4 workflow flicker | `toolbar.js:593,668-699` | `workflowActionsShown` also true while `wf.isLoading` for a saved clean workflow doc | Closed for the transition load. See R3-F2 |
| V1 HTML title | `toolbar.js:44-67` | `htmlToText(String(titleField \|\| "")) \|\| doc.name` | Closed |
| V4 skeleton | contract §3 | `FormSkeleton` uses `bg-foreground/10` and a `role=status` "Loading..." after 300 ms | Closed |
| V5/V6 error actions | scenarios.md §2.1 | `FrappeErrorState`: Retry only for network/server/rate_limited/unavailable; timestamp -> Reload with its own hint (no repeated sentence); permission/not_found/duplicate/mandatory/link/validation/too_large have no action | Closed |
| V8 bidi | scenarios.md X3 | `timeline.ts` `f(ctx, ...)` wraps interpolated tokens in U+2068..U+2069 when `ctx.isolate` | Closed (real browser) |
| V2 Subject column | `list_view.js:375-486` | `useFrappeList` puts the title field (else `name`) first when the app passes no `columns` | Closed. The "ID column after truncation" rule is still absent (P3, unchanged from R1-F14 scope) |
| V3 bulk bar | `list_view.js:590-598,1613-1635` | bar now renders between toolbar and table | Closed |
| V7 empty states | `list_view.js:497-537` | filtered: "No records match…" + Clear filters; unfiltered: `emptyMessage` ("You haven't created a ToDo yet" in the sim page), optional `emptyAction` | Closed (create CTA is opt-in by the app) |
| V9, V10 | scenarios.md X5 | `LinkInput` focus ring `ring-ring/60` + `focus-visible:outline-none`; popover `max-w-[90vw]`; opaque filter popover | Closed |

Regressions looked for and not found: save lifecycle and action matrix (`review-r1.test.ts`), evaluator equivalence on Frappe core's
270 expressions, row model, error-kind mapping, form tests (`tests/frappe-form.test.tsx`, `record-form-fixes.test.tsx`).

### New observations

| ID | Observation | Code | Native | Sev | Owner |
|---|---|---|---|---|---|
| R3-F1 | `canCancelAllLinked` uses the role rows of the DocType only. Desk's `frappe.model.can_cancel` reads boot `can_cancel`, which for Administrator is every DocType. If an app passes `session.roles` without the full list Administrator gets, Cancel All is hidden wrongly | `FrappeForm.tsx` `canCancelAllLinked` | `form.js:925`, `model.js:366-460` | P3 | A3 (treat `Administrator` as allowed) |
| R3-F2 | The "no flicker" guard needs `wf.workflow`; until the workflow definition itself has loaded the form can still show Save/Cancel for a fraction of a second | `FrappeForm.tsx` (`!!wf.workflow && ...`) | `toolbar.js:668-699` | P3 | A3 |
| R3-F3 | Summaries now contain invisible U+2068/U+2069 characters (they are plain strings that other code, such as aria-labels, copy, or search, may reuse) | `record/timeline.ts`, `record/format.ts` `isolate` | n/a (UX hygiene) | P3 | A4 (strip them where a summary is used as text identity) |

## 2. Stage B visual re-run

Ran `npm run playground:build`, served by `python3 -m http.server --bind 127.0.0.1`, `ONLY=<scenario> node e2e/stage-b-matrix.mjs
http://127.0.0.1:4833/ /tmp/a6-shots/r3` for `form-link-dropdown`, `form-loading`, `form-save-error`, `form-error`, `list`,
`list-bulk-menu`, `list-filters`, `list-empty`, `timeline`, `workflow`, `form-workflow`, `form-contact`; then
`node e2e/stage-b-geometry.mjs ... /tmp/a6-shots/r3`.

| Item | Verdict | Evidence |
|---|---|---|
| V1 raw HTML title | **Confirmed fixed** | geometry check: title has no `<`/`>` in all 4 theme/language runs ("Review visa documents for the Jeddah team"); `*__form-link-dropdown` |
| V2 no Subject column | **Confirmed fixed** | `light-ar__list-bulk-menu`: "Description" column first, titles visible |
| V3 off-screen bulk bar | **Confirmed fixed** | same shot: "2 محدد / تعديل / إسناد إلى / حذف / مسح التحديد" above the table |
| V4 skeleton | **Confirmed fixed** | `dark-ar__form-loading`: visible blocks and "جارٍ التحميل..." |
| V5 Retry on timestamp | **Confirmed fixed** | `light-en__form-save-error`: button "Reload", single sentence |
| V6 Retry on 403 | **Confirmed fixed** | `*__form-error`: no action button (also covered in code) |
| V7 empty list | **Confirmed fixed** | `light-en__list-empty`: "You haven't created a ToDo yet" |
| V8 Arabic version lines (real browser) | **Confirmed fixed** | `geom-dark-ar__timeline.png` reads "غيّر أنت قيمة Status من Open إلى Closed, Priority من High إلى Low" in the right order; DOM text contains U+2068 around every token |
| V9 Link dropdown RTL alignment (real browser) | **Confirmed fixed** | bounding boxes in all 4 runs: dropdown start offset 0 px and width 596 = input width 596 (LTR and RTL); screenshots show a single focus ring (`geom-*__link.png`, `*__form-link-dropdown`). My earlier "double focus ring" count heuristic in the geometry script was unreliable (it counted ancestors) and was removed |
| V10 translucent popover | **Confirmed fixed** | `light-en__list-filters`: header text no longer shows through |

Still not covered by any shot: the disabled-while-saving state (the simulator saves instantly) and the Contact row-form dialog at mobile
width (the matrix is 1280 px only). Both are listed for the first real-site session.

## 3. Files

`docs/qa/review-r3.md`, `e2e/stage-b-geometry.mjs`. No `src/**` edits; no new tests (nothing left to flip).
