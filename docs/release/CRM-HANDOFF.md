# CRM handoff — consuming `@solvfast/ui` 0.4.0-dev.34

Audience: the developers who migrate the CRM (`serve_fast` `/crm-app`, isolated work copy `/home/frappe/sfui-dev/crm-base`).
Written 2026-11-03 at the end of Phase 27.5. **No CRM migration has started; this document is the input for it.**

## 1. Which package, exactly

| | |
|---|---|
| Version | `0.4.0-dev.34` (not published; not tagged) |
| Branch / commit | `feat/0.4.0-frappe` in `/home/frappe/solvfast-ui` — commit and tarball SHA-256 in `RELEASE-CHECKLIST-0.4.0-rc.1.md` item 8 |
| Artifact | a local `npm pack` tarball (path in the checklist). GitHub Packages only after the owner approves `0.4.0-rc.1` |
| Status | **NOT READY FOR RC** (checklist §0): package-side scope complete; no authenticated real-session or write evidence |

**How the CRM work copy gets it today:** the Lead's drop script (`/home/frappe/sfui-dev/drop-package.sh`) installs the
packed tarball into the work copy's dependencies (atomic swap, nested `node_modules` kept). Never `npm install` from a
registry for 0.4.0 until rc.1 is published; never install into the live `apps/serve_fast`.

After rc.1 is published (owner decision), the CRM pins it exactly — `"@solvfast/ui": "0.4.0-rc.1"` — with the
`.npmrc` / `NODE_AUTH_TOKEN` setup in `docs/CONSUMING.md`.

## 2. Entry points (all verified in Phase 27.5: built entries load, boundaries enforced by `npm run check:boundaries`)

| Import | What | Needs |
|---|---|---|
| `@solvfast/ui` | Frappe-free core: theme, primitives (Dialog, Select, DateField, …), generic `ListView`, record components (Timeline, AssigneeGroup, AssignPicker, LifecycleBar …), fields | `react`, `react-dom` 18.3 (+ `tailwindcss` 3.4 for CSS path A) |
| `@solvfast/ui/frappe` | Frappe layer: client, `FrappeProvider`, hooks, `FrappeListView`, `FrappeForm`, fields, workflow / assignment / timeline, Import / Export, permissions helpers | `@tanstack/react-query` 5 (optional peer — only if you import this entry) |
| `@solvfast/ui/frappe/testing` | **Simulator only** (`createFixtureTransport`, `simScenario.*`) for tests and demos | never in production code; `./frappe` never imports it |
| `@solvfast/ui/form`, `/toast`, `/chart` | react-hook-form bindings, toasts, charts | their optional peers |
| `@solvfast/ui/theme.css`, `glass.css`, `full.css` … | styles (see `docs/CONSUMING.md` §1 for path A / B) | — |

## 3. Provider and session (required for correct permissions)

Every Frappe component needs a `FrappeProvider` (inside a `QueryClientProvider` or with its own). **Pass the user's real
Frappe roles**: without `session.roles` the package grants nothing beyond the server's `docinfo.permissions` of a saved
document and new documents are read-only (rule 9). The CRM's member roles (`role_admin`, …) are **not** Frappe roles.

```tsx
import { FrappeProvider, createFrappeClient, readFrappeBoot } from "@solvfast/ui/frappe";

const boot = readFrappeBoot();                    // the page's #sf-boot JSON (D-25): user, roles, csrf token, formats, translations
const client = createFrappeClient({ csrfToken: boot?.csrfToken });   // same origin, session cookie

<FrappeProvider client={client} boot={boot}>      {/* session + format context (date_format, number format) come from the boot */}
  <App />
</FrappeProvider>
```

The CRM work copy already has this as `CrmFrappeProvider` (`frontend/src/sear_studio/data/frappe/client.ts`): mock mode
renders children untouched; simulated mode uses `@solvfast/ui/frappe/testing` (only when the build sets
`VITE_CRM_ALLOW_SIMULATED=true`); frappe mode uses the boot. Keep that switch — it is the mock-to-Frappe path.

## 4. Usage examples

```tsx
import { FrappeListView, FrappeForm, FrappeWorkflowActions, FrappeAssignTo, FrappeTimeline, FrappeDataImport, useFrappeApi } from "@solvfast/ui/frappe";

const api = useFrappeApi();                            // the provider's client with the 0.4 document / record API

// List — Desk's columns, filters, saved filters (server), actions menu, Export (all users; the server decides), Import
<FrappeListView
  doctype="Serve Fast Deal"
  serverStorage={{ user: boot.session.user }}          // List Filter + user settings on the server
  bulk={{}}                                             // Desk's Actions: Edit, Export, Assign To, Clear Assignment, Rule, Tags, Print, Submit/Cancel, Delete, Workflow
  onRowClick={(row) => navigate(`/crm-app/deals/${encodeURIComponent(String(row.name))}`)}
  onImport={() => setImporting(true)}                   // default: Desk's Data Import list
  // rowKey={(r) => …}                                 // safe since 27.5: server requests always use the document `name`
  // columnLimit={false}                               // default caps generated columns by width, as Desk
  // menu={{ reportExport: true }}                     // opt-in "Export as report" (export_query)
/>

<FrappeDataImport api={api} doctype="Serve Fast Deal" open={importing} onOpenChange={setImporting} />

// Record
<FrappeForm doctype="Serve Fast Deal" name={id} />
<FrappeWorkflowActions doc={doc} user={user} roles={roles} />
<FrappeAssignTo doc={doc} user={user} canAssign canWrite />
<FrappeTimeline doc={doc} user={user} />
```

## 5. What the CRM should replace (not duplicate)

| CRM today | Replace with |
|---|---|
| `components/record-list/**` table views for Deals / Leads / Contacts / Organizations | `FrappeListView` (keep the CRM's kanban / calendar / gallery views; they are not in the package) |
| Hand-made assignee pickers, comment composer, history tab | `FrappeAssignTo` / `AssignPicker`, `CommentComposer`, `FrappeTimeline` |
| Lifecycle / status buttons wired to a mock store | `FrappeWorkflowActions` + `FrappeStatusIndicator` (Frappe Workflow) — CRM lifecycle *types* stay in the CRM |
| Entity create / edit dialogs with their own field widgets | `FrappeForm` / `FrappeField` (+ `formEvents` for CRM rules) |
| Native `<input type="date">`, `<select>` in CRM forms | DS `DateField`, `Select` from `@solvfast/ui` |
| Any client-built CSV export | `FrappeListView` Export (server `download_template`) |

Stays in the CRM: business rules and lifecycle types, member → Frappe role mapping, pricing, kanban / calendar views,
CRM navigation and page layout, the data-mode switch.

## 6. Migration approach (unchanged from `CRM-ADOPTION-PLAN.md`)

One screen at a time behind a per-screen flag; `mock` stays the default; validate each screen side by side (e2e + the
stage-B visual matrix) in simulated mode first, then with an owner-approved authenticated real-site route. First
candidate: the Deals list, once the ListView and permission gates have real evidence.

## 7. Known limitations the CRM must plan for

- **Evidence:** read paths replayed from recorded real 15.110 responses only; **no authenticated session and no write
  has been verified on a real site** (saves, workflow, assignment, bulk actions, Print, Import, Export).
- **Blocked outside the package:** D-06 CRM DocTypes not created; D-25 boot not deployed (CSRF token renders `"None"`
  without it); no build window; no restricted test user; backups unverified.
- **List View:** not declared Frappe-compatible; actions are selection-bar buttons; Print's background completion needs a
  host task subscriber; URL filters opt-in; realtime is a full-reload skeleton.
- **Import:** no Google Sheets; Data Import `create` is System Manager-only in core (others get a 403 — shown).
- **Formats:** Frappe Date fields show the site's `date_format` in both states (pass it through the boot or
  `formatContext`); Datetime editing keeps the DS display.
