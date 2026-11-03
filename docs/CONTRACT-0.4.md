# @solvfast/ui 0.4.0 — Integration Contract, Ownership and Rules

Owner of this file and of `src/frappe/contract.ts`: **the Lead** (coordinator, integration owner). Agents implement
against them; changes go through the Lead. Native behaviour references: `apps/serve_fast/docs/frappe-components/10–14`
(Frappe 15.110.0, `ab7e5ae`). Real metadata fixtures: `tests/fixtures/real-15.110/` (captured read-only from the CRM site).

## 1. Layers (unchanged principle: the core never imports Frappe)

| Layer | Folder | Entry | May import |
|---|---|---|---|
| Generic controls (value in / value out, no metadata) | `src/fields/` | core `.` | primitives, theme, lib |
| Generic record pieces (timeline, assignees, status/lifecycle bar, comment composer) | `src/record/` | core `.` | primitives, theme, lib, fields |
| Frappe contract (types, keys) | `src/frappe/contract.ts` | `./frappe` | — |
| Frappe services, hooks, feedback, simulated backend | `src/frappe/{services,hooks,feedback,testing}/` + `client.ts`, `FrappeProvider.tsx` | `./frappe` | everything except shell |
| Frappe list | `src/frappe/{FrappeListView.tsx,useFrappeList.ts,query.ts,meta.ts,list/}` + generic `src/list/` | `./frappe` / `.` | — |
| Frappe forms | `src/frappe/form/` | `./frappe` | fields, primitives, services/hooks |
| Frappe record (workflow, assignment, timeline, lifecycle) | `src/frappe/record/` | `./frappe` | record, fields, primitives, services/hooks |

`scripts/check-boundaries.mjs` enforces this. A component that renders without a Frappe site belongs in `fields/` or
`record/`; its Frappe wrapper belongs in `src/frappe/…`.

## 2. Hooks and utilities the foundation provides (signatures are part of the contract)

```ts
useMetaBundle(doctype?: string): UseQueryResult<MetaBundle, FrappeError>          // key: frappeKeys.metaBundle
useDoc(doctype?: string, name?: string): UseQueryResult<LoadedDoc, FrappeError>    // keys: doc + docinfo (seeded)
useDocInfo(doctype?: string, name?: string): UseQueryResult<DocInfo, FrappeError>
useSaveDoc(): UseMutationResult<FrappeDoc, FrappeError, { doc: FrappeDoc; action: "Save" | "Submit" | "Update" }>
useDocAction(): { cancel, remove, rename, runMethod }  // mutations; apply the invalidation rules in contract.ts
usePermissions(bundle?: MetaBundle, doc?: FrappeDoc, docinfo?: DocInfo): {
  levels: DocPermissions; can(ptype: PermType, permlevel?: number): boolean;
  fieldStatus(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc): FieldDisplayStatus;   // docs 11 §2.5 ladder
}
translateLabel(bundle: MetaBundle, text: string): string        // uses meta.__messages
formatValue(value: unknown, df: FrappeDocField, doc?: FrappeDoc, ctx?: FormatContext): string  // docs 12 §9
<FrappeErrorState error onRetry />                              // one rendering of FrappeError for every component
useFrappeMessages(): { show(messages: FrappeMessage[]): void }  // msgprint semantics (docs 14 B)
createFixtureTransport(backend: FixtureBackend): FrappeTransport // simulated backend — shapes only, never parity
```

`createFrappeClient()` returns an object implementing `FrappeClient` (0.3.x methods) **plus** `DocumentApi` and
`RecordApi` from `contract.ts`. The existing `searchLink(doctype, txt, opts)` gains the `SearchLinkOptions` fields
(backward compatible). `FrappeError` keeps its constructor and adds the `FrappeErrorInfo` fields.

## 3. UI rules every component follows

- **States:** loading → `Skeleton`; error → `<FrappeErrorState>`; empty → the component's own empty state; disabled and
  read-only from `fieldStatus` / `can()`. Never a blank area, never a spinner without text for > 300 ms.
- **Text:** package strings only through `useLocale().t(key)`, keys added in your `frappe:<area>` block of
  `src/theme/messages.ts` in **both** `en` and `ar`. Server labels via `translateLabel`; server messages as sent.
- **Direction:** logical utilities only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`); chevrons follow `isRTL`.
- **Theme:** tokens only (no hex), light and dark from the theme scope.
- **Server is the authority:** client checks reproduce Desk's UX; nothing is skipped because the client checked it.

## 4. Status vocabulary (progress board and reports)

`Implemented` → `Simulated & tested` (fixture transport / recorded payloads) → `Integrated with CRM — work copy` →
`Integrated with CRM — deployed` (only after an approved build window) → `Verified against real Frappe` (only on the
real site, after the test footprint is approved) → `Fully completed` (all five stages of the brief §10). A UI that
renders is none of these by itself.

## 5. Ownership — package (`/home/frappe/sfui-dev/pkg-*`, branches `feat/0.4.0/<area>`, integration `feat/0.4.0-frappe`)

| Owner | May edit | Must not edit |
|---|---|---|
| Lead | `src/frappe/contract.ts`, `src/frappe/index.ts`, `src/index.ts`, `package.json`, `package-lock.json`, `vite.lib.config.ts`, `tsconfig*.json`, `scripts/**`, `CHANGELOG.md`, `docs/CONTRACT-0.4.md`, `docs/FRAPPE.md`, `src/theme/messages.ts` outside the blocks | — |
| A1 Foundation | `src/frappe/client.ts`, `FrappeProvider.tsx`, `src/frappe/{services,hooks,feedback,testing}/**`, `tests/foundation*.test.ts(x)`, block `frappe:foundation` | list, form, record files |
| A2 List | `src/frappe/{FrappeListView.tsx,useFrappeList.ts,query.ts,meta.ts}`, `src/frappe/list/**`, `src/list/**` (API-compatible changes only), `tests/list.test.tsx`, `tests/frappe.test.tsx`, `e2e/list-parity.mjs`, block `frappe:list` | foundation, form, record |
| A3 Forms | `src/fields/**`, `src/frappe/form/**`, `tests/fields*.test.tsx`, `tests/frappe-form*.test.tsx`, block `frappe:form` | `src/form/**` (RHF bindings), list, record |
| A4 Record | `src/record/**`, `src/frappe/record/**`, `tests/record*.test.tsx`, block `frappe:record` | list, form |
| A6 QA | `e2e/frappe-site/**`, `docs/qa/**`, `tests/parity/**` (new) | source files (`src/**`) |

**Exports:** agents never edit `src/index.ts` / `src/frappe/index.ts`; they list the exports they need in their report
and the Lead adds them at merge. Tests import from relative paths.

## 6. Ownership — CRM work copy (`/home/frappe/sfui-dev/crm-*`, branches `crm/<area>`, integration `crm/integration`)

Paths are under `frontend/src/sear_studio/` unless stated.

| Owner | May edit |
|---|---|
| Lead | `frontend/src/App.jsx`, `main.jsx`, `screens/servefast_native/ServeFastApp.tsx`, `components/Layout/**`, `components/ui/**`, `vite.config.js`, `package.json`, `yarn.lock`, `tsconfig*.json` |
| A2 List | `components/record-list/**`, list pages `pages/{Deals,Leads,Contacts,Organizations}/*Page.tsx` (not `*DetailPage.tsx`) |
| A3 Forms | `components/{TypeFormRenderer,PrerequisiteFormFields,RecordFormStepper}.tsx`, entity create/edit dialogs it identifies (declare them in its first report) |
| A4 Record | `components/record-lifecycle/**`, `components/record-detail/{HistoryTab,recordHistoryStore,followersStore}.*`, `lib/lifecycleStates.ts`, assignment UI files it identifies (declare first) |
| A5 CRM migration | NEW `data/frappe/**` (simulated backend, mappers, draft metas), `components/record-detail/{RecordEditSession,RailSection,RecordMoreMenu,RecordPicker}.tsx`, `pages/{Deals,Leads,Contacts,Organizations}/*DetailPage.tsx`, `docs/frappe-components/70-*.md` |

Detail pages are owned by A5: A3 and A4 deliver components plus a wiring note; A5 wires them in.

## 7. Rules for every agent

- **Never write in `/home/frappe/lovable_bench`** (the live bench). DocType JSON under the live app would be installed by
  other projects' `bench migrate` (~4 a day); frontend edits would be published by anyone's `bench build`. Draft
  DocType metas live as JSON under `data/frappe/meta/` in the CRM work copy.
- **No `bench`, no database access, no network installs, no new dependencies** (`package.json` is the Lead's), no
  `git push`, no tags, no publishing.
- Package checks: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run <your tests>`, and **`npm run build` before every
  commit you want merged** (declarations use `tsconfig.build.json`, an older lib — no `Array.prototype.at`; the dist
  boundary check rejects `csrf` or `/api/` strings, including message-key names, in core modules).
  CRM checks: `npx tsc --noEmit -p tsconfig.app.json` (baseline: 43 errors — never add any) and, when needed,
  `npx vite build --outDir /tmp/<agent>-build` (never the default outDir).
- **Commit after each unit of work** on your branch, with the attribution line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Keep `.agent/STATUS.md` (untracked) current: done, in
  progress, next, blockers, export requests — so a stopped run can resume without loss.
- Report honestly in the §4 vocabulary. Anything simulated says so.
