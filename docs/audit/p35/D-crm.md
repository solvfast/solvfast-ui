# Agent D — CRM Design-System adoption audit (read-only)

- CRM source: `/home/frappe/sfui-dev/p35-crm` branch `crm/p35-ds-adoption` @ `127c0b4` (clean). All paths below are relative to
  `frontend/src/sear_studio/` unless they start with `frontend/` or `screens/`.
- DS surface audited against: `/home/frappe/sfui-dev/p35-pkg` @ tag **v0.6.0** (`0ef45c1 Release 0.6.0`, clean tree). The
  barrels `src/index.ts`, `src/fields/index.ts`, `src/frappe/index.ts`, `src/toast/index.ts`, `src/form/index.ts`,
  `src/chart/index.ts` are treated as the authoritative 0.6.0 export list. **No installed copy of `@solvfast/ui` exists
  under p35-crm** (no `node_modules`); the only installed copy found is `crm-deps/node_modules/@solvfast/ui` = `0.6.0-dev.1`
  (not the pinned release). `frontend/package.json:39` pins `"@solvfast/ui": "0.6.0"`.
- Method: route table from `screens/servefast_native/ServeFastApp.tsx:307-417` (CRM) / `:420-…` (SD, SM), a static
  import-closure per app shell (python, `@/` alias + relative imports), then a pattern sweep over the CRM closure and
  reading of every feature's implementation site. Nothing was edited, built or run.

## 0. Headline findings

1. **The CRM is already far along.** Inside `CrmAppLayout` the CRM runs under `DsScopeContext=true`; the legacy kit
   (`components/ui/*`, 25 modules) is generated as `dsSwitch(Legacy, Sf.X)` wrappers, so every primitive the CRM imports
   from `@/components/ui/*` renders the 0.6.0 component in scope. **No non-switched `ui/*` module (table, pagination, chart,
   form, skeleton, alert-dialog, …) is imported anywhere in the CRM closure.** Every list (28 routes) is the DS `ListView`
   via `CrmDsListView`; Export / Import / Assign / bulk-delete are DS dialogs; detail pages use `ActionBar`,
   `LifecycleBar`, `StatusBadge`, `Timeline`, `CommentComposer`, `TagInput`, `LinkInput`, `AssigneeGroup`, `AssignPicker`.
2. **No illegal DS imports.** 101 files import the package, public entries only. Import statements: `@solvfast/ui` 91,
   `@solvfast/ui/frappe` 13 static + 1 dynamic (`frappeRecordKit.ts:24`), `@solvfast/ui/toast` 1,
   `@solvfast/ui/frappe/testing` 1 dynamic (`data/frappe/client.ts:57`, simulated builds only;
   vite aliases it to a throwing stub otherwise, `frontend/vite.config.js:30`), plus CSS entries `theme.css`/`base.css`
   (`frontend/src/index.css:10-11`) and `glass.css` (`frontend/src/main.jsx:11`) and `tailwind-preset`
   (`frontend/tailwind.config.js:4`). `tailwind.config.js:14` scans `node_modules/@solvfast/ui/dist/**/*.js` — Tailwind
   content globbing, not an import: acceptable. No `dist/` or relative paths into the package anywhere. Note: a separate
   `@ds` alias (`vite.config.js` → `../../design_system/frontend`, legacy glass engine) is imported once app-wide
   (`frontend/src/main.jsx:9 @ds/styles/glass/glass.css`) — not `@solvfast/ui`, not CRM-specific; leave as is.
3. **Isolation is a runtime invariant, not a file boundary.** 313 of the 519 files the CRM renders are also rendered by
   Service Desk and/or Service Management (incl. `RecordListView`, `CrmDsListView`, `crmDataIO`, `HistoryTab`,
   `RailSection`, `useRecordMenu`, `TasksPage`, SLA, Automations, Lifecycles, Playbooks, AppConfiguration). Several of those
   shared files already import `@solvfast/ui` directly; **only `useDsScope()` branches / `dsSwitch` keep SD/SM on the legacy
   render.** Every migration in a shared (S) file must be a scope-gated branch. In addition, CRM pages are still mounted
   under `AdminLayout` legacy routes (`/contacts`, `/deals/:id`, `/leads/:id`, `/organizations/:id`, `/activities/*`,
   `/data-quality` …, `ServeFastApp.tsx:520-590`) which render **outside** the DS scope when no app scope is in
   sessionStorage (`resolveScopedPath`, `ServeFastApp.tsx:186-222`); 75 "CRM-only" files are reachable that way. So even
   CRM-only (O) files should gate DS-only markup with `useDsScope()` (the existing precedent, e.g. `DealDetailPage.tsx:1382`).
4. **The three package-side plan docs are stale.** `CRM-ADOPTION-PLAN.md` says "No migration was started" and proposes a
   per-screen flag `VITE_CRM_FRAPPE_SCREENS` — never implemented (only `VITE_CRM_DATA_MODE`, `data/frappe/client.ts:25-40`).
   `CRM-HANDOFF.md` §5 says replace list views with `FrappeListView` — what shipped (LV-REPLACE, P32, P33) is the **Core**
   `ListView` in mock mode, with `FrappeListView` only in simulated builds. `CRM-GAP-PLAN.md` (written vs 0.4.0-dev.34):
   0.5.0/0.6.0 closed none of its class-A items except indirectly (Export/Import dialogs, `AssignDialog`,
   `selectionMode="header"`); verified still open in 0.6.0 source: **G1** (no card layout in `ListTable`), **G3**
   (`ListPagination` has no page sizes), **G5** (no `selectAllMatching`), **G7** (`LifecycleStateItem` has no `step`,
   `record/types.ts:43`), **G9** (`FrappeAssignTo` no `replace`), **G11** (`Suggestion` = value/label/description only),
   **G13** (`record/Timeline.tsx` renders a fixed per-kind icon, never `item.icon`; no `onItemSelect`), **G14** (no Core
   file input; only `FrappeAttachField` and the import dialogs' internal inputs), **G16** (`SearchCombobox` async-only),
   **G17** (`StatusBadge`/`StatusDot` tone-only), **G20** (`date-time-field.tsx` has no month granularity), **G23**
   (`IconStatCard` has no trend; only the different-looking `StatCard` has `trend`, `cards/StatCard.tsx:51`).

## 1. CRM route inventory (from the router)

`ServeFastApp.tsx:306-417`, all under `<FlagGuard flag="crm"><CrmAppLayout/></FlagGuard>` (+ two out-of-shell CRM routes
wrapped in `CrmDsScope`: `/crm-app/automations/:module/:id/build` → `WorkflowBuilderPage`, `/crm-app/configuration/lifecycles/:entity/:id` → `LifecycleDesignerPage`).

| Area | Routes | Page component(s) | O/S |
|---|---|---|---|
| Overview / dashboard | `/crm-app/overview` | `pages/Overview/CrmOverviewPage` + `components/overview/*` | O + S widgets |
| Contacts | `/contacts`, `/contacts/:id` | `ContactsPage`, `ContactDetailPage` | O |
| Organizations | `/organizations`, `/:id` | `OrganizationsPage` (+`OrganizationFormWorkspace`), `OrganizationDetailPage` | O |
| Leads | `/leads`, `/leads/types[/new|/:id/edit]`, `/leads/:id` | `LeadsModulePage` → `ContactsPage` leads mode; `LeadTypesPage`/`LeadTypeFormPage` → `CrmTypesTab`/`CrmTypeFormPage`; `LeadDetailPage` | O |
| Deals | `/deals`, `/deals/types…`, `/deals/:id` | `DealsModulePage` → `DealsPage`; `DealTypesPage`/`DealTypeFormPage`; `DealDetailPage` | O |
| Task types | `/task-types…`, `/activities/tasks/types…` | `TaskTypesTab`, `TaskTypesPage`, `TaskTypeFormPage` | S |
| Activities | `/activities/{emails,calls,meetings,notes,attachments}[/new|/:id|/:id/edit]`, `/activities/tasks` | `Emails/*`, `Calls/*`, `Meetings/*`, `Notes/*`, `Attachments/*` (+`ActivityListShell`, `ActivityDetailLayout`, `ActivityFormLayout`); `TasksPage` (+`TaskDetailPage`, `NewTaskWorkspace`) | O; Tasks S |
| Proposals (quotes) | `/proposals`, `/proposals/types…`, `/proposals/new[/:typeId]`, `/proposals/:id[/edit]`, `/proposals/templates…` (+legacy redirects) | `pages/Proposals/CrmProposalsModule` (wizards: package / squad / complai / generic) | O |
| Selling rules / products & pricing | `/selling-rules/{discount-rules,commercial-terms,promotional-offers}`, `/commission-referral` | `DiscountRulesPage`, `CommercialTermsPage`, `PromotionalOffersPage`, `CommissionReferralPage` | O |
| Configuration / settings | `/configuration`, `/configuration/lifecycles/:entity`, lifecycle designer | `AppConfigurationPage app="crm"`, `LifecyclesListPage`, `LifecycleDesignerPage` | S |
| Automations | `/automations/:module[/:id]`, builder | `AutomationsPage`, `WorkflowDetailPage`, `WorkflowBuilderPage` | S |
| Data quality | `/data-quality`, `/duplicates/:id`, `/missing/:id` | `DataQualityPage`, `DuplicateDetailPage`, `MissingDataDetailPage` | O |
| SLA | `/sla`, `/sla/policies…` | `SLAPage`, `SLAPolicyFormPage`, `SLAPolicyDetailPage` | S |
| Playbooks | `/playbooks…` | `PlaybooksListPage`, `CreatePlaybookPage`, `PlaybookEditorPage` | S |

There is no separate CRM "Reports", "Products" or "Quotes" route: products/pricing live in Selling Rules + Proposals
pricing steps; quotes = Proposals; Reports (`/reports`) is an AdminLayout page behind the `serviceDesk` flag (not CRM).

## 2. Service Desk / Service Management isolation

**SD/SM-only files (32, never rendered by the CRM):** `components/Layout/ServiceDeskAppLayout.tsx`,
`components/Layout/ServiceManagementAppLayout.tsx`, `components/Layout/AppSwitcherMenu.tsx`, `components/Layout/MobileNav.tsx`,
`components/DueDateCell.tsx`, `components/ui/alert-dialog.tsx`, `pages/Tickets/{TicketDetailPage,TicketTypeFormPage,TicketTypesPage,TicketTypesTab,TicketsModulePage,TicketsModuleTabs,TicketsPage}.tsx`,
`pages/TicketCatalog/{TicketCatalogItemFormPage,TicketCatalogPage}.tsx`,
`pages/Orders/{OrderDetailPage,OrderFormWorkspace,OrdersPage,RelatedRecords,RequestTypesPage,ServiceRequestsModulePage,ServiceRequestsModuleTabs}.tsx`,
`pages/ServiceCatalog/{ServiceCatalogFormPage,ServiceCatalogPage,ServiceCategoriesTab,ServiceCategoryFormPage,mockServiceCategories}.ts(x)`,
`pages/AssignmentEngine/{AssignmentEnginePage,AssignmentRuleDetailPage,AssignmentRuleFormPage}.tsx`,
`pages/Overview/{TicketsOverviewPage,ServiceOverviewPage}.tsx`.

**SD/SM directories:** `pages/Tickets/`, `pages/TicketCatalog/`, `pages/Orders/`, `pages/ServiceCatalog/`, `pages/AssignmentEngine/`
(+ the two layouts and two overview pages above). **They DO share files with the CRM**: the CRM imports
`pages/Tickets/{mockTickets,mockTicketTypes,CustomerAvatar,ticketFormShared,NewTicketForm}`, `pages/Orders/mockOrders`,
`pages/TicketCatalog/mockTicketCatalog`, `pages/ServiceCatalog/mockServiceCatalog`, `pages/AssignmentEngine/mockData`
(related-record rails on CRM detail pages), plus 313 shared files overall (full list:
`/tmp/claude-1000/-home-frappe-lovable-bench/dd04d141-f975-4eb5-beb5-0ff7b8dc907a/scratchpad/p35/audit/shared.txt`;
CRM-only: `crm_only.txt`, SD/SM-only: `sdsm_only.txt`, CRM-only-but-also-AdminLayout: `crm_only_also_admin.txt`, same folder).
Shared by route (not just import): `TasksPage`, `TaskTypes*`, `SLA*`, `Automations*`, `LifecyclesListPage`, `LifecycleDesignerPage`,
`Playbooks*`, `AppConfigurationPage` are mounted in all three shells.

**Invariant every S-row below must keep:** DS-only markup only inside `useDsScope()===true` (or via a `dsSwitch` wrapper);
the `!inDs` branch byte-for-byte unchanged. SD/SM duplicates of the CRM popups (`TicketDetailPage.tsx:1482-1547`,
`OrderDetailPage.tsx:1425-1489`) are out of scope and must not be touched.

**Other out-of-scope areas:** Sada (`frontend/src/screens/sada/`) and the Sear Studio mount (`frontend/src/sear_studio_app/`)
are not mounted by `frontend/src/App.jsx` at all (only `/omnichannel/*` and `ServeFastApp`); no CRM file imports them.
CRM closure files outside `sear_studio/`: `screens/my_work/{mockWorkItems,useCanOpenWorkItem}`,
`screens/organization_structure/roles/*` (5, data/permissions), `shared/i18n/LanguageProvider.jsx`,
`shared/notifications/notificationCategories.ts` — data only, no DS work proposed there. Omnichannel (`connect_fast`, `@cf/`)
data is imported by CRM detail pages; not in scope.

## 3. Migration matrix

O = file rendered only by the CRM shell (may also be reachable via AdminLayout legacy routes); S = shared with SD/SM.
"Verifiable": Y = in the default mock build; Sim = only in a `VITE_CRM_ALLOW_SIMULATED=true` build; N = needs a Frappe site.

### 3a. ALREADY USING DS CORRECTLY

| # | CRM location (file:line) | Current implementation | DS equivalent (export · entry) | Action | Reason | Risk | Verifiable |
|---|---|---|---|---|---|---|---|
| A1 | `components/Layout/CrmAppLayout.tsx:188,240` (O) | `AppShell`, `ThemeProvider` element scope, `AppSwitcher` nav tree; `Toaster` | `AppShell`, `ThemeProvider` · core; `Toaster` · `/toast` | keep | — | — | Y |
| A2 | `components/ui/*.tsx` (25 `dsSwitch` wrappers, S) + `ui/ds-scope.tsx` | legacy kit → DS in scope (Button, Input, Label, Select, Textarea, Badge, Popover, DropdownMenu incl. `DropdownMenuShortcut`, Card, Command, Switch, Checkbox, Tabs, Tooltip, ToggleGroup, Separator, Avatar, Dialog, Calendar, Toggle, Sheet, RadioGroup, ScrollArea, Progress, Collapsible) | same names · core | keep (temporary bridge) | every primitive the CRM imports from `ui/*` is switched (the only other `ui/*` import, `ui/SenaiyIcon.tsx`, is a CRM brand icon, not a DS primitive) | — | Y |
| A3 | `components/ui/input.tsx:14-45` (S) | `Input type=date/time/datetime-local` → DS fields in scope | `DateField`, `TimeField`, `DateTimeField` · core | keep | covers ~35 date/time inputs in forms + filters | — | Y |
| A4 | `components/ui/ds-segmented.tsx` (S); `contacts/components/ViewSwitcher.tsx` (S); overview `TimeRangePills`/`ChannelMixWidget`/`DistributionWidget` | segmented control / **view switching** (table · board · calendar) | `Tabs/TabsList/TabsTrigger` · core | keep | — | — | Y |
| A5 | `components/record-list/CrmDsListView.tsx:267,287` (S, used only in scope) | every list: search, quick filters, **filters** (FilterBuilder), **saved filters** (localStorage adapter), **grouping**, sort, **list columns** (ColumnManager), **pagination**, **bulk selection** (`selectionMode="header"`), Like column, **empty / filtered-empty / loading / error** states — 28 routes (parity doc §4) | `ListView`, `applyFilterQuery`, `sortRows`, `createLocalStorageAdapter`, `EMPTY_QUERY` · core | keep | — | — | Y |
| A6 | `components/record-list/RecordListView.tsx:1288-1298, 2005-2060` (S, `inDs` branch) | **bulk actions** (Edit, Export, Assign, Clear assignment, Assignment rule, Tags, Print, Delete, lifecycle) | `BulkAction` · core | keep | — | — | Y |
| A7 | `RecordListView.tsx:1614, 1903` (S) | bulk clear-assignment / bulk delete **confirmation** | `AlertDialog*` · core | keep | — | — | Y |
| A8 | `RecordListView.tsx:1351` (S) | bulk **assign dialog** (several assignees + Desk ToDo details, mock ToDo store `services/crmAssignments.ts`) | `AssignDialog` · core | keep | — | — | Y |
| A9 | `RecordListView.tsx:1835` + `record-list/crmDataIO.ts` (S) | **export dialog** (CSV/XLSX, selected/filtered/all) | `ExportDialog`, `ExportRequest` · core | keep | — | — | Y |
| A10 | `RecordListView.tsx:1851` + `crmDataIO.ts` (S) | **import dialog** (parse, map, validate, duplicates, run into mock stores) | `DataImportDialog`, `DataImportAdapter` · core | keep | — | — | Y |
| A11 | `components/record-lifecycle/RecordActionsButton.tsx:64` (S) | detail **workflow actions** (lifecycle transitions) | `ActionBar` · core | keep | — | — | Y |
| A12 | `components/record-lifecycle/WorkflowRailWidget.tsx:113,116` (S) | detail **status indicator** + lifecycle stepper | `StatusBadge`, `LifecycleBar` · core | keep (see N2) | — | — | Y |
| A13 | `pages/Deals/DealDetailPage.tsx:1382-1402` (O) | Deal header title + status | `EditableTitle`, `StatusBadge` · core | keep — precedent for M1/M2 | — | — | Y |
| A14 | `components/record-detail/RecordEditSession.tsx:118` (S) | "Not saved" pill | `StatusBadge` · core | keep | — | — | Y |
| A15 | `components/record-detail/HistoryTab.tsx:258,266,273,277,291` (S) | **timeline / activity + comments** (add, edit, delete, mentions) | `Timeline`, `CommentComposer`, `draftToHtml`, `htmlToDraft` · core | keep | — | — | Y |
| A16 | `components/record-detail/RailSection.tsx:100` (S) | detail **tags** | `TagInput` · core | keep | — | — | Y |
| A17 | `components/record-detail/RecordPicker.tsx:91` (S); `pages/Deals/components/DealFields.tsx:111,195` (O) | detail / create **link controls**; money fields | `LinkInput`, `NumberInput`, `parseLocaleNumber` · core | keep (see N6) | — | — | Y |
| A18 | `record-lifecycle/AssignmentSectionCard.tsx:66`, `AssignmentRailCard.tsx:124` (S); `record-list/CrmAssignees.tsx:91` (S) | detail **assign** (P34: all four entities) | `AssigneeGroup`, `AssignPicker` · core | keep | — | — | Y |
| A19 | `components/AppPopup.tsx:44-60` (S) | every CRM popup (bulk edit, email, remind, list settings, delete) in scope | `Dialog*` · core | keep (see M3) | — | — | Y |
| A20 | `components/sales/WizardStepper.tsx:41`, `components/RecordFormStepper.tsx:75` (O/S) | wizard steppers | `Stepper` · core | keep (see N8) | — | — | Y |
| A21 | `components/overview/StatCard.tsx:22` (S) | dashboard stat cards (no-delta variant) | `IconStatCard` · core | keep (see N9) | — | — | Y |
| A22 | `pages/Activities/ActivityRichTextField.tsx:72`; `ActivityDetailParts.tsx:32,61,110` (O) | activity body editor; status chips; feed; HTML render | `RichTextEditor`, `StatusBadge`, `Timeline`, `RichText` · core | keep | — | — | Y |
| A23 | `pages/Activities/Calls/CallFormPage.tsx:59,74` (O) | call duration / date | `DurationInput`, `DateTimeField` · core | keep | — | — | Y |
| A24 | `pages/Tasks/NewTaskWorkspace.tsx:712` (S) | task parent picker | `SearchCombobox` · core | keep | — | — | Y |
| A25 | `CrmTypeFormPage.tsx:175`, `SellingRules/RuleFormShell.tsx`, `Proposals/CrmProposalsModule.tsx`, `DataQuality/{Duplicate,MissingData}DetailPage.tsx`, `SLA/*`, `Automations/WorkflowDetailPage.tsx`, `playbooks/CreatePlaybookPage.tsx` | page headers | `PageHeader` · core | keep | — | — | Y |
| A26 | `pages/Proposals/PField.tsx`, `NumberField.tsx` (O) | proposal **form fields / layout** | `FieldShell`, `NumberInput` · core | keep | — | — | Y |
| A27 | `SLA/SLAPolicyFormPage.tsx:346`, `Configuration/AppConfigurationPage.tsx` (S) | config tables | `Table*`, `RadioGroup`, `StatusBadge` · core | keep | — | — | Y |
| A28 | `DataQuality/DuplicateDetailPage.tsx`, `SLA/SLAPolicyDetailPage.tsx`, `CRM/shared/RowDeleteAction.tsx` | confirmation dialogs | `AlertDialog*` · core | keep | — | — | Y |
| A29 | 73 CRM files `import { toast } from 'sonner'` + `lib/toastHost.ts` | **toasts** routed to the DS host while it is mounted (one sonner store; DS `/toast` re-exports the same `toast`) | `toast`, `Toaster` · `/toast` | keep. Optional hygiene: import `toast` from `@solvfast/ui/toast` in O files only | functionally identical | — | Y |
| A30 | `PlaybookChecklistCard.tsx:60`, `TaskDetailPage.tsx:414` (S) | checklist checkboxes (raw `@radix-ui/react-checkbox` only in the `!inDs` branch) | `Checkbox` · core | keep | — | — | Y |

### 3b. SHOULD MIGRATE TO EXISTING DS COMPONENT — doable now with 0.6.0 exports

| # | CRM location (file:line) | Current implementation | DS equivalent (export · entry) | Action | Reason | Risk / effort | Verifiable |
|---|---|---|---|---|---|---|---|
| M1 | `pages/Leads/LeadDetailPage.tsx:1045`, `pages/Contacts/ContactDetailPage.tsx:1213`, `pages/Organizations/OrganizationDetailPage.tsx:953` (O, also AdminLayout) | local `components/InlineEditableTitle.tsx` (pencil + ✓/✗) | `EditableTitle` · core | in a `useDsScope()` branch render `<EditableTitle>` exactly as `DealDetailPage.tsx:1382-1387`; keep `InlineEditableTitle` for `!inDs` | Deal already migrated; three entities lag; one detail-title behaviour across CRM | Low · S (≈1 h each). Contact/Org/Lead `onSave` keep name-splitting logic | Y |
| M2 | `LeadDetailPage.tsx:1062-1067` (O) | hand-rolled status pill (`style` colour + dot) | `StatusBadge` (+ `lifecycleStatusTone` from `WorkflowRailWidget`) · core | scope-gated `StatusBadge` like `DealDetailPage.tsx:1402` | Deal precedent; tokens work in dark mode | Low · S. Known G17 colour deviation (configured colour → tone), already accepted on Deal | Y |
| M3 | `DealDetailPage.tsx:1920`, `LeadDetailPage.tsx:1592`, `ContactDetailPage.tsx:1685`, `OrganizationDetailPage.tsx:1434` (O) | four copies of `<X>DeletePopup` built on `AppPopup` (Dialog) | `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, … · core | in scope: one CRM-local `CrmDeleteConfirm` on `AlertDialog` (blocked case: body lists reasons + only Cancel/Close); keep the four legacy popups for `!inDs` | destructive confirm should be `role=alertdialog` (list bulk delete already is, A7); removes 4 duplicates | Low–Med · M (½–1 day). Don't touch Ticket/Order copies | Y |
| M4 | `pages/Activities/ActivityListShell.tsx:155-200` (O) | `StatusPill` / `InlineStatusSelect` with hard-coded HSL tones (Emails/Calls/Meetings list cells) | `StatusBadge variant="dot"` (+ `DropdownMenu` trigger) · core; mapping `TONE_TO_DS` already exists in `ActivityDetailParts.tsx:16` | scope-gated StatusBadge | tones map 1:1 (green→success … purple→brand) | Low · S | Y |
| M5 | `pages/Activities/ActivityDetailLayout.tsx:16-110,238` (O) | `StatusDropdown` (own tone tables) on Call/Meeting/Note/Attachment detail | `StatusBadge` as `DropdownMenuTrigger` · core | same as M4 | same | Low · S | Y |
| M6 | `ActivityFormLayout.tsx:24-45`, `ActivityDetailLayout.tsx:229-240` (O, also AdminLayout `/activities/*`) | hand-built back + title + Cancel/Save header | `PageHeader` (`onBack`, `title`, `subtitle`, `actions`) · core | scope-gated `PageHeader` (precedent `CrmTypeFormPage.tsx:174-180`) | consistent headers across CRM | Low · S | Y |
| M7 | `components/record-list/RecordListView.tsx:1766-1810` (S) | bulk **Add / Remove Tags** dialog: own chip list + `Input` + suggestion buttons | `TagInput` (`value`, `onChange`, `search`, `allowCreate`) · core | in scope use `TagInput` for "Add tags" (remove list can stay checkbox chips) | same control as detail tags (A16) | Low–Med · S. Shared file → gate; the popup is declared before the `if (inDs)` split but the legacy bar never offers Tags (parity doc §6, `RecordListView.tsx` tags rule), so in practice it opens only in scope | Y |
| M8 | `components/record-menu/EmailView.tsx:102` (S; via `useRecordMenu` on Activity detail pages, Duplicate detail) | `components/studio/RichTextEditor` (570-line local editor) | `RichTextEditor` (`value`, `onChange`, `placeholder`, `minHeight`) · core | scope-gated swap | same API subset; DS editor already used by A22 | Low–Med · S | Y |
| M9 | `components/record-menu/useRecordMenu.tsx:320-350` (S) | inline delete / unsaved-reload confirm bars with hex colours (`#e5484d`, `#fe4e18`) | `AlertDialog` (delete) / `Alert` (reload bar) · core | scope-gated; owner decision: modal vs inline | consistent confirmations, tokens | Med · S–M (UX change → owner sign-off) | Y |
| M10 | `pages/SellingRules/CommissionReferralPage.tsx:68-153` (O) | **child tables** = DS `Table` + per-cell DS inputs + local `AddNewRow` | `DataGrid` (`columns`, `editable`, `inlineEdit`, `canAdd`, `onAddRow`, `onDeleteRows`) · core | migrate the two tables (Commission rows, Years) | DS has the editable child table since 0.4.0 | Med · M. Check `canDelete` "absent, not disabled" rule and phone layout | Y |
| M11 | `components/SearchableSelect.tsx` (S) — used by `ContactsPage`, `OrganizationFormWorkspace`, `CrmTypeFormPage`, `InlineCreateForms`, Proposals | Popover + Command combobox (already DS primitives in scope), `allowCustom`, `subtitle` | `LinkInput` with an in-memory `SearchFn` (`onCommitText` for allowCustom, `description` for subtitle) · core | optional scope-gated branch inside `SearchableSelect` (one change covers all callers) | precedent `DealFields.tsx:109-120`; field-style trigger, keyboard model of DS | Med · S–M. Behavioural (free text, empty-value) → test each caller. Cleaner after G16 | Y |
| M12 | `pages/sales/ClientPicker.tsx` (O; proposal Client-Info steps) | Popover + Command with avatars + "Create New" row | `LinkInput` + `SuggestionAction` ("Create new client") · core | migrate if avatars may go (else wait for N6/G11) | — | Med · S | Y |
| M13 | `components/record-menu/useRecordMenu.tsx:84` `KeyChip`; `record-detail/RecordMoreMenu.tsx:78` shortcut `<span>` (S) | hand-made shortcut chips in **document menus** | `DropdownMenuShortcut` · core (already re-exported by the kit) | swap inside scope only (kit's legacy shortcut would restyle SD) | DS menu typography/RTL | Low · XS | Y |
| M14 | `pages/FieldLibrary/FieldBuilderComponents.tsx:280,1194` (S; type-form designer on Lead/Deal Type forms) | raw `<input type="color">` | `ColorInput` · core | scope-gated | only raw input left in CRM closure | Low · XS | Y |
| M15 | `components/record-lifecycle/frappeRecordKit.ts:24` (O) | `await import('@solvfast/ui/frappe') as unknown as Record<string, unknown>` + runtime feature detection ("installed drop has no record wrappers") | `FrappeTimeline`, `FrappeAssignTo`, `FrappeWorkflowActions`, `FrappeStatusIndicator` · `/frappe` (all present in 0.6.0) | typed dynamic import (keep lazy chunk, drop the feature-detect fallback) | the pinned release always has them; untyped access hides prop drift | Low · XS | Sim |

### 3c. REQUIRES NEW DS CAPABILITY (cannot reach the CRM before a package release > 0.6.0)

| # | CRM location (file:line) | Current implementation | Closest DS today | Needed capability | Gap id | Verifiable after release |
|---|---|---|---|---|---|---|
| N1 | list status cells `pages/Deals/DealsPage.tsx:500,537,566,572,818`, `pages/Contacts/ContactsPage.tsx:1253,1294,1323,1341`; `components/RelatedRecordRow.tsx:22` `StageChip`; `pages/Tasks/TasksPage.tsx:402,414,669`; Kanban column accents | local `StatusDot` copies with the lifecycle's configured colour | `StatusBadge` / `StatusDot` (tone only) | `color?: string` override on `StatusBadge`/`StatusDot` (and `ListView` status cells) | G17 | Y |
| N2 | `WorkflowRailWidget.tsx:116` (states pre-filtered as workaround) | `LifecycleBar` ticks by position (Lost shows Won ticked) | `LifecycleBar` | `LifecycleStateItem.step: past/current/future` | G7 | Y |
| N3 | **attachments / file pickers**: `DealDetailPage.tsx:211-216`, `LeadDetailPage.tsx:215`, `ContactDetailPage.tsx:165,1204`, `OrganizationDetailPage.tsx:947`, `ContactsPage.tsx:1098`, `Activities/Attachments/AttachmentFormPage.tsx:78`, `Proposals/package/steps/ClientInfoStep.tsx:143`, `Proposals/ProposalDocTemplateForm.tsx:254`, `record-menu/EmailView.tsx:127`, `PrerequisiteFormFields.tsx:258` | hidden native `<input type=file>` + own drop zones | none in Core (`FrappeAttachField` is /frappe + server upload) | Core `FileInput` / `FileDropzone` (accept, multiple, maxSize, keyboard) | G14 | Y |
| N4 | `Proposals/complai/ComplaiReadinessStep.tsx:35` | native `type="month"` (shim passes it through) | `DateField` | month granularity | G20 | Y |
| N5 | `contacts/components/ActivityTimeline.tsx` (S, CRM unified feed on all 4 details), `components/RecentInteractions.tsx` (O) | own feed with per-kind icons / tints / click-to-open | `Timeline` | render `TimelineItem.icon`, actor on non-comment items, `onItemSelect` | G13 | Y |
| N6 | `RecordPicker.tsx` groups; `ClientPicker` avatars | groups folded into description | `LinkInput` / `Suggestion` | `Suggestion.group`, `Suggestion.icon` | G11 | Y |
| N7 | `components/MultiSearchableSelect.tsx` (O), `components/TypeFilterPicker.tsx` (S, list type scope control), `pages/SellingRules/AppliesToPicker.tsx` (O) | multi-select combobox built from Popover+Command+Checkbox | `SearchCombobox` (single, async), `TagInput` (free tags) | static-option multi-select combobox (`SearchCombobox` `options`, `multiple`, `variant="field"`) | G16 (+ multi) | Y |
| N8 | `pages/Proposals/StepRail.tsx` (O) | scroll-cue wrapper around the DS Stepper | `Stepper` | overflow indicators / auto-scroll to current | new | Y |
| N9 | `components/overview/StatCard.tsx` legacy-with-delta path (S) | delta cards stay local | `IconStatCard` (no trend); `StatCard` has `trend` but is a different card (no icon square) — usable now only if the owner accepts the visual change | `trend?` slot on `IconStatCard` | G23 | Y |
| N10 | `components/AddNewRow.tsx` `EmptyHint` (S) + rail-card empty states | local empty-state boxes | `ListView` empty only | Core `EmptyState` | new | Y |
| N11 | `components/email/SlashEmailTextarea.tsx` (S; `EmailFormPage`, `EmailDetailPage`, `EmailThreadsGrid`, `InlineCreateForms`) | slash templates + AI generate on a textarea | `RichTextEditor` | `toolbarEnd` slot + `insertText/insertHtml` ref | G15 | Y |
| N12 | `CrmDsListView` (accepted DS pager) | — | `ListPagination`, `BulkActionBar` | page sizes / numbered pages; "select all N matching" | G3, G5 | Y |
| N13 | phones: `CrmDsListView` table | horizontal scroll on phones | `ListTable` | `layout="cards"` + `ColumnDef.mobile` | G1 | Y |

### 3d. CRM-SPECIFIC — KEEP IN CRM

| # | CRM location | What | Reason |
|---|---|---|---|
| C1 | `contacts/components/KanbanBoard.tsx` (S), `record-list/boardTransition.ts` (S) | Kanban board (Deals, Leads, Tasks) | no Board view in DS; plan §4 "Kanban last"; built from DS primitives in scope |
| C2 | `record-list/CalendarView.tsx`, `GalleryView.tsx` (O) | calendar / gallery views | same |
| C3 | `pages/CRM/lifecycles/*`, `pages/CRM/types/*` (`StageStatusesSection.tsx`, `CrmTypeFormPage.tsx`), `pages/CRM/statuses/StatusCombobox.tsx`, `lib/lifecycleStates.ts`, `record-lifecycle/lifecycleShared.ts` | lifecycle / Type model, designer | business model (plan §4); DS sees only tones/actions |
| C4 | `record-detail/RecordMoreMenu.tsx`, `record-menu/useRecordMenu.tsx` (S) | **document ⋯ menu** (New, Print, Email, Duplicate, Copy link, Reload, Undo/Redo, Remind, Customize, Delete + shortcuts) | no Core document menu; DS `DropdownMenu` in scope (M13 for shortcuts) |
| C5 | `record-menu/PrintPreview.tsx`, `lib/printRecord.tsx`, `RecordListView` `printList` | **print** (client HTML print) | `FrappePrintDialog` is server print formats (B6) |
| C6 | `RecordListView` email/remind popups, `record-menu/{ReminderPanel,remindersStore,recordCommsStore}`, detail `<X>EmailPopup/<X>RemindPopup` | **email / reminder actions** (mock comms log) | CRM composition on `AppPopup` (DS Dialog); consolidating the 4 copies is a CRM refactor, not DS |
| C7 | `components/RelatedRecordRow.tsx`, `contacts/components/{SidebarRelationPanel,SortableSidebar,SidebarCustomizer,EntityRightSidebar}`, `pages/References/ReferencesPanel.tsx` | **related records** rails | no DS related-records component; primitives already DS (N1 for chips) |
| C8 | `record-detail/{RecordEditSession,RailFooter,RailSection,recordHistoryStore,followersStore,tagsStore}` | edit session / undo / followers / tag store | CRM state; DS pieces inside (A14, A16) |
| C9 | `contacts/components/{InlineCreateForms,InlineActivityChooser,InlineActivityFlows}`, `DealsPage` `CreateDealWorkspace`, `OrganizationFormWorkspace`, `NewTaskWorkspace` | **quick entry / create** forms (full-page workspaces) | no Core quick-entry/form-layout component (FrappeForm is /frappe, B2); fields already DS via kit + A3 |
| C10 | `pages/Proposals/**` engines, docx fill, pricing; `SellingRules` stores; `components/PriceBuilder.tsx` | quotes / pricing business logic | business |
| C11 | `data/frappe/client.ts` (data-mode switch), `services/crmAssignments.ts` (mock ToDo store), `record-list/crmDataIO.ts` (adapter), `filterEngine.ts`, `entityFilterFields.ts`, `listPrefsStore.ts` | adapters / mock stores | the CRM side of DS contracts |
| C12 | `pages/FieldLibrary/FormLayoutBuilder.tsx`, `components/TypeFormRenderer.tsx`, `TypeFormSection.tsx`, `PrerequisiteFormFields.tsx` (S) | type-driven **form layouts** | CRM/Studio form designer (M14 for colour input) |
| C13 | `components/overview/*` widgets, `pages/Overview/CrmOverviewPage.tsx` | dashboard lists/breakdowns (no charts; recharts unused by CRM) | `/chart` available if charts are wanted later |

### 3e. NOT APPLICABLE

| # | Location | Why |
|---|---|---|
| X1 | `!inDs` branches of shared files: `RecordListView` legacy list (`:2237-2400`), `RecordFilterPanel.tsx`, `templates/SortDropdown.tsx`, `ColumnCustomizer.tsx`, `ResponsiveTable.tsx`, `PrintListButton.tsx`, `record-list/MockImportPreview.tsx`, page `ImportWorkspace`/`ExportWorkspace` (`DealsPage.tsx:843-848`), `HistoryTabLegacy`/`InlineCommentEdit` (`HistoryTab.tsx:102`), `RailSection` legacy tag input (`:142`), radix `BrandCheckbox` (`TaskDetailPage.tsx:70`) | serve SD/SM and AdminLayout legacy routes only; must stay unchanged |
| X2 | `components/ui/legacy/*`, non-switched `ui/{table,pagination,chart,form,skeleton,alert,accordion,breadcrumb,hover-card,slider,drawer,menubar,context-menu,navigation-menu,carousel,resizable,input-otp,sidebar,toast,toaster,sonner,alert-dialog}.tsx` | not imported by any CRM closure file |
| X3 | `pages/Deals/DealsPage.tsx:60` `MetricsBar` import (state only, never rendered) | dead import — CRM cleanup, not DS |
| X4 | `frontend/src/screens/sada/`, `frontend/src/sear_studio_app/` | not mounted by `App.jsx`; out of scope |
| X5 | navbar search | intentionally off (`AppShell search={false}`, commit edcc736) |

### 3f. BLOCKED BY MOCK MODE / BACKEND (already DS code, exercised only in simulated or frappe mode)

| # | CRM location | DS component · entry | Blocker |
|---|---|---|---|
| B1 | `record-list/FrappeEntityList.tsx`, `DealsPage.tsx:798-840` (+Contacts/Orgs/Leads equivalents) | `FrappeListView` · /frappe | `CRM_DATA_MODE !== 'mock'`; D-06 DocTypes, D-25 boot (plan §0) — Sim |
| B2 | `components/forms/CrmEntityFormFields.tsx`, `data/frappe/{CrmEditableCard,CrmDocLoader}.tsx` | `FrappeField`, `FrappeFormServices`, `useSaveDoc`, `newChildRow` · /frappe | same — Sim |
| B3 | `record-lifecycle/CrmRecordPanels.tsx` via `frappeRecordKit.ts` | `FrappeTimeline`, `FrappeAssignTo`, `FrappeWorkflowActions`, `FrappeStatusIndicator` · /frappe | same — Sim (also M15) |
| B4 | `contacts/components/CrmFrappeImport.tsx`, `DealsFrappeImport` | `FrappeDataImport` · /frappe | server Data Import — Sim |
| B5 | `serverStorage` on FrappeListView | `createFrappeSavedFilters`, `createFrappeUserSettings` · /frappe | server List Filter — N |
| B6 | Print with print formats / PDF | `FrappePrintDialog`, `downloadMultiPdf` · /frappe | server print formats — N |
| B7 | live list refresh | `useListRealtime` · /frappe | socket — N |
| B8 | single-owner assign replace (`CrmRecordPanels` unassigns after the fact) | `FrappeAssignTo` `replace` (G9, not in 0.6.0) | new capability + server — N |
| B9 | attachments upload, email send | `FrappeAttachField` / Communication | no file/email backend in mock mode — N |

## 4. Counts

| Classification | Rows |
|---|---|
| ALREADY USING DS CORRECTLY | 30 (A1–A30) |
| SHOULD MIGRATE TO EXISTING DS COMPONENT (0.6.0, now) | 15 (M1–M15) |
| REQUIRES NEW DS CAPABILITY | 13 (N1–N13) |
| CRM-SPECIFIC — KEEP IN CRM | 13 (C1–C13) |
| NOT APPLICABLE | 5 (X1–X5) |
| BLOCKED BY MOCK MODE / BACKEND | 9 (B1–B9) |

Feature coverage (the requested list): form fields A2/A3/A17/A26 · form layouts C12/A26 · form actions A25/M6 · workflow actions
A11 · status indicators A12/A13/M2/M4/M5/N1/N2 · document menus C4/M13 · link controls A17/M11/M12/N6/N7 · child tables M10 ·
export A9 · import A10/B4 · filters / saved filters / grouping / columns / pagination / bulk selection A5 · bulk actions A6/A7 ·
assign A8/A18/B8 · tags A16/M7 · quick entry C9 · view switching A4/C1/C2 · related records C7 · print/email C5/C6/M8 ·
confirmations A7/A28/M3/M9 · toasts A29 · empty states A5/N10 · timeline/activity A15/N5 · comments A15 · attachments N3/B9.

## 5. Recommended order (0.6.0 only, no package release)

1. M1 + M2 + M6 + M4/M5 — pure scope-gated swaps in CRM-only files, Deal/CrmTypeForm precedents, ≈1 day total, low risk.
2. M3 (one `AlertDialog` delete confirm for the 4 entities) + M13 + M14 — ≈1 day, low risk.
3. M7 (bulk tags `TagInput`) + M8 (EmailView editor) — shared files, gate carefully; verify SD Tickets list/detail unchanged.
4. M10 (`DataGrid` in Commission & Referral) — medium; owner check of row-edit behaviour.
5. M11/M12 (pickers → `LinkInput`) and M9 (record-menu confirm bars) — behavioural; owner decision first.
Validation for every step: CRM mock build EN/AR × light/dark × phone, plus the SD/SM route sweep (the existing P32 "other-apps
diff") and one AdminLayout legacy route (`/contacts/<id>` with empty sessionStorage) to prove the `!inDs` path is unchanged.

DS capabilities to request for the next release (priority for the CRM): N1 `color` on StatusBadge/StatusDot (G17) ·
N2 LifecycleBar `step` (G7) · N3 Core FileInput/Dropzone (G14) · N7 static/multi SearchCombobox (G16) · N5 Timeline icon /
onItemSelect (G13) · N13 ListTable cards on phones (G1) · then N6, N9, N10, N11, N4, N8, N12.
