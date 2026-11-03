# CRM adoption plan — `@solvfast/ui` 0.4.0 in Serve Fast CRM (Phase 26 G, 2026-11-03)

Plan only. **No migration was started in this phase**; nothing in `crm-base`, the live `apps/serve_fast` or the site
was changed. Sources read (read-only): `crm-base` `crm/integration` at `7f46d50` —
`frontend/src/sear_studio/data/frappe/{client,index,fixtureBackend,draftMetas}.ts` and
`docs/frappe-components/{70,71,72}`; the live discovery docs `30`, `60`, `61`, `62` under
`apps/serve_fast/docs/frappe-components/`; the package's `COMPONENT-COMPLETION-MATRIX.md`.

## 0. Gates (nothing below starts before these)

**The first CRM ListView integration against a real site happens only after all three hold:**
1. ListView parity reviewed and accepted (`docs/release/LISTVIEW-FRAPPE-PARITY.md`, agent list-io — pending);
2. the permission gates pass (`docs/release/PERMISSION-AUDIT.md`, agent perm — pending; rule 9: no optimistic rights
   without `session.roles`);
3. an **authenticated real-site route** exists and is approved by the owner: today every authenticated route writes
   (session creation), so none was used (`62` §2 "Blocked"); the CRM page boot (D-25, `71`) is merged into the work copy
   only, never served (`60` B3).

Plus the standing gate from `50` D-06: `FrappeForm` / `FrappeListView` for CRM entities **after CRM DocTypes exist**
(`serve_fast` has 0 DocTypes; `72` is design only, 12 open questions).

## 1. Which CRM screens can use the package immediately — in SIMULATED mode only

Already wired on `crm/integration` 7f46d50 behind `CRM_DATA_MODE` (`client.ts`), browser-verified in simulated mode
(`61` §2, `60` rounds 13–15): **Deals, Leads, Contacts, Organizations — list (table view) and detail**. Each page
wraps itself in `CrmFrappeProvider` and branches on the mode; in `mock` (the default) the provider renders its children
untouched and no package Frappe code runs.

| Screen | Simulated today | Real site today | Why not real |
|---|---|---|---|
| Organizations list / detail | ✓ `FrappeListView`, `FrappeForm` fields, timeline, assignee | ✗ | no `Serve Fast Organization` DocType (D-06); no boot (D-25) |
| Contacts list / detail | ✓ | ✗ | same; plus the Lead = Contact decision (`72` §2, option A recommended) |
| Leads list / detail | ✓ (re-renders Contacts with a lifecycle) | ✗ | same |
| Deals list / detail, create dialog | ✓ incl. lifecycle (Phase / Status), demo Deal Type fields | ✗ | same; workflow mapping lives in `fixtureBackend` only |

"Immediately" therefore means: keep running these four screens in simulated mode for review and parity work
(`?crm_data=simulated` in builds made with `VITE_CRM_ALLOW_SIMULATED=true`). No screen can switch to `frappe` mode now.

## 2. Which package components are ready (for simulated use; none production ready)

From the matrix (46 units, 0 production ready): IMPLEMENTED and used by the CRM pages — `FrappeProvider`, client +
errors, `useMetaBundle`/`useDoc`/`useDocInfo` + cache rules (now 5 more tests, `keys.test.ts`), `formatValue`,
`translateLabel`, `FrappeErrorState`, `FrappeListView` (+ reportview, meta, query, settings, storage),
`FrappeForm`/`FrappeField`/`FrappeLinkField`/`FrappeChildTable`, behaviour engine, `FrappeWorkflowActions`,
`FrappeTimeline`, `FrappeStatusIndicator`, generic list/record/field controls. Real-Frappe evidence exists for the
read path of client, list and form rendering (`62`). PARTIAL: permissions, realtime, bulk, assign.

## 3. Package gaps to close first (before any real-site screen)

| Gap | Where | Blocks |
|---|---|---|
| **Import / Export** MISSING (matrix rows 22–23; pre-work primitives only) | package, agent list-io | CRM lists that need the native list menu; owner decides whether rc.1 ships without |
| **Permission rule 9**: a new doc without `session.roles` is optimistic (read/write/create granted) | `src/frappe/services/permissions.ts`, agent perm | any CRM page in `frappe` mode where the boot is absent or a guest arrives (`crmIsGuest()`) |
| **Realtime skeleton** (fake socket only; full reload instead of by-name refresh; reconnect UNVERIFIED) | `services/realtime.ts`, `list/realtime.ts` | live list refresh in the CRM; acceptable to ship disabled (`disable_auto_refresh`) |
| **D-06 DocTypes not created** (`72` design only; `Serve Fast *` prefix; Lead = Contact question) | owner decision + migration approval, outside the package | every `frappe`-mode screen |
| **D-25 boot not deployed** (`71`; CSRF token renders `"None"` today, R-2) | `crm/boot` merged into the work copy only; needs an approved build window | every POST from the CRM page in `frappe` mode; formats, roles, translations |
| `getdoctype` sends no `__messages` in 15.110 (TODO classification F4) | boot dictionary (D-25) | Arabic labels on real metadata |

## 4. CRM business logic that stays in the CRM (never moves into the package)

- **Lifecycle / Type model**: `lifecycleStore`, `crmTypeStore`, Deal/Lead Types, playbooks, SLA cards, prerequisites
  (`PrerequisiteFormFields`, `lead_prerequisites` JSON). The package sees a Frappe Workflow (`WorkflowInfo`) and
  DocFields; the mapping lifecycle → workflow is CRM code (`fixtureBackend.ts`, later the server).
- **Vocabulary**: the UI says **Phase / Status**, never State / Workflow (`70`, `72` §1.2) — a CRM re-skin over
  `FrappeWorkflowActions` / `FrappeStatusIndicator`.
- **Member roles ≠ Frappe roles**: `memberStore` roles (`CRM_ROLES` in `mappers.ts`) drive CRM UI; Frappe roles
  (`session.roles` from the boot) drive package permissions. The CRM maps one to the other; the package never knows
  "member".
- **Views**: Kanban board, calendar, gallery, board transitions (`contacts/components/KanbanBoard`, `CalendarView`,
  `GalleryView`) stay CRM; the package provides table views only (`70` §1: "Kanban last").
- **Pricing / estimates**, orders, tickets, reminders, print/email menus (`components/record-menu/*`), the
  `RecordEditSession` unsaved-changes shell, `RailFooter` — CRM composition (`70` §2).

## 5. One screen at a time — feature flag per screen

Mechanism already in `client.ts`: build-time `VITE_CRM_DATA_MODE` (`mock` | `simulated` | `frappe`) and the
per-page `CrmFrappeProvider` wrapper. Extend it with one flag **per screen** so a single list can go real while the
rest stays mock, e.g. `VITE_CRM_FRAPPE_SCREENS=organizations.list` read by the page's provider; absent → `mock`.

Order (from `70` §1–2, simplest first): **Organizations list → Contacts list → Leads list → Deals list**, then details
**Deal → Lead → Organization → Contact**, then timeline/history, workflow, assignment; Kanban last. Each step: wrap,
flag on in a scratch build, side-by-side review, flag on in the live build after the gates, mock path untouched.

## 6. Preserving mock mode (default unchanged)

- `mock` is the default in every build and is the only mode a production build can select besides an explicit
  build-time `VITE_CRM_DATA_MODE=frappe` (`client.ts:21-39`; URL and sessionStorage can never select a mode in
  production, a stored value is cleared, a stray demo Type is purged).
- The `VITE_CRM_ALLOW_SIMULATED` gate is **proven** (`60` round 24 "production gate proven"): a default build contains
  no simulator, no fixture backend, no draft metas, no demo Deal Type and no `@solvfast/ui/frappe/testing` chunk
  (`import.meta.env.VITE_CRM_ALLOW_SIMULATED === "true"` folds to `false`; `draftMetas.ts` registry is empty).
- Rule kept from `60` round 15: mock-mode behaviour changes are rejected until the replacement is verified.

## 7. Parity validation before replacing a screen

1. **Side-by-side e2e** — the screen in `mock` and in the candidate mode, same data, same states (EN/AR × light/dark ×
   page/search/filter/sort/mobile), screenshots diffed with `e2e/compare.py` as in the package's `list-parity.mjs`.
2. **Stage-B matrix** (`61` §2: R2 80 shots, R3 12 scenarios in a real browser) re-run for the screen.
3. **Real-site read checks** — only once an authenticated route is approved: metadata, rows/count, search_link,
   validate_link, getdoc + docinfo, server `get_doc_permissions` vs `usePermissions`, for the screen's DocType,
   recorded the way `62` did (read-only transaction, pseudonymised) and replayed in `tests/real/`.
4. Writes (save/submit/assign/comment) stay BLOCKED until the owner approves a write-capable test footprint
   (`docs/qa/test-footprint.md`, `backup-safety-net.md`).
5. The screen's flag goes live only when 1–3 pass and the Lead records it in `60`.
