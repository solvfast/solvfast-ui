# CRM package-gap plan — G1–G28 (Phase 29 review, 2026-11-04)

Source: the Phase 28 gap register (`/home/frappe/sfui-dev/crm-base/docs/frappe-components/80-p28-migration-board.md` §5),
raised by the CRM migration agents against `@solvfast/ui` **0.4.0-dev.34**. **This is a plan for review: no package code is
changed, nothing is released.** The CRM wrote no local duplicate of any package component; where it needed a workaround, the
workaround is named below.

## Classes
- **A — Required before CRM production.** In the CRM's production path (frappe mode, Layer 2 — `FrappeListView`, `FrappeForm`,
  `FrappeTimeline`, `FrappeAssignTo`, …, and the DS-scope pages) the gap produces wrong output, an accessibility failure, or an
  English-only surface for Arabic users, and the CRM's workaround is fragile or absent.
- **B — Required for broader Frappe compatibility.** Matters for any Frappe app built on the package (or for Desk parity); the CRM
  has a working, non-duplicating workaround today.
- **C — Safe to defer.** Polish or convenience; a CRM workaround exists and nothing is wrong.

Size: **S** ≤ 1 day incl. tests · **M** 1–3 days · **L** > 3 days.

## Register

| Gap | Component (file) | CRM impact today / workaround | Class | Smallest generic fix | Size |
|---|---|---|---|---|---|
| G1 | `ListTable` / `ListView` (`src/list/parts/ListTable.tsx`, `src/list/ListView.tsx`) — and therefore `FrappeListView` | **Frappe mode:** the four entity lists render `FrappeListView` (via `FrappeEntityList`), which has no phone layout → sideways scroll on phones in production. Mock mode uses the CRM's `RecordListView` cards (and Phase 29 moves E's five lists there). | **A** | `layout?: "table" \| "cards" \| "auto"` on `ListTable` / `ListView` (default `"table"`, so no consumer changes) + `ColumnDef.mobile?: "primary" \| "secondary" \| "hidden"`; cards = title line + secondary pairs + row actions, same selection model | M |
| G2 | `ColumnManager` (`src/list/parts/Toolbar.tsx`) | Reset / Show totals live in a CRM gear menu next to it | C | `footer?: ReactNode` | S |
| G3 | `ListPagination` (`src/list/parts/ListFooter.tsx`) | CRM keeps its own pager (numbered pages, sizes) in mock mode; frappe-mode lists use the package pager (prev / next) | B | `pageCount?`, `pageSizes?`, `pageSize?`, `onPageSize?`, numbered pages with gaps | S |
| G4 | `SortMenu` (`src/list/parts/Toolbar.tsx`) | CRM keeps its own sort control (search > 10 fields, one-click direction) in mock mode | B | `searchable?: number`, `clearable?: boolean`, `ColumnDef.defaultSortDir`, direction toggle, `aria-label` | S |
| G5 | `BulkActionBar` / `useListState` | "Select all N matching" stays CRM-side in mock mode; absent in frappe mode | C | `selectAllMatching?: { total, active, onSelectAll }` | S |
| G6 | `FrappeBulkActions` workflow menu (`src/frappe/list/FrappeBulkActions.tsx`) | **Arabic users see English workflow action names in the bulk menu** in frappe mode (single-record menus are translated by the CRM via `translate`) | **A** | route each action label through the provider's `translateLabel` (same path `FrappeWorkflowActions` uses) + optional `bulk.actionLabel?(action)` | S |
| G7 | `LifecycleBar` (`src/record/LifecycleBar.tsx`) | **Wrong visual:** "done" is decided by position, so a Lost deal shows Won ticked (and a converted lead its untaken branches). CRM filters the states it passes as a partial workaround; `FrappeWorkflowActions`' stepper has the same flaw. | **A** | `LifecycleStateItem.step?: "past" \| "current" \| "future"` (default: by position, as today) + a second-chip slot for Phase | S |
| G8 | `FrappeTimeline` (`src/frappe/record/FrappeTimeline.tsx`) | Version rows of the workflow-state field (and the Phase field the workflow writes) show as ordinary changes; CRM hides them with `canSeeField` | B | tag Version lines that only touch the workflow state field as kind `state` (so `hiddenKinds=['state']` works) | S |
| G9 | `FrappeAssignTo` `single` (`src/frappe/record/FrappeAssignTo.tsx`) | **CRM single-owner rule enforced client-side after the fact** (`CrmRecordPanels` unassigns the previous assignee in `onChanged`) — fragile on real latency (backend contract: also enforce server-side) | **A** | `replace?: boolean` with `single`: add the new assignee, then remove the others through the same `useDocAction`, report a partial failure | S |
| G10 | `ActionBar` (`src/record/ActionBar.tsx`) | Lost the destination-status colour dot and the menu heading vs the legacy menu | C | tone dot per item + `heading?` | S |
| G11 | `LinkInput` (`src/fields/LinkInput.tsx`) | Related records listed first with the group appended to the description; contact avatars lost | C | `Suggestion.group?`, `Suggestion.icon?` | S |
| G12 | `AssigneeGroup` (`src/record/AssigneeGroup.tsx`) | Role shown as a separate row | C | render `description` as a second line in the list variant | S |
| G13 | `Timeline` (`src/record/Timeline.tsx`) | `TimelineItem.icon` declared but never rendered; actor only on comments; no select handler (CRM puts the actor in `summary`; `ActivityTimeline` stays CRM's own feed) | B | render `icon`; actor prefix for non-comment items; `onItemSelect` | S |
| G14 | core | No file picker / drop zone: hidden native `<input type=file>` behind a DS button in 7+ places | B | `FileDropzone` / `FileInput` (`accept`, `multiple`, `maxSize`, `onFiles`, keyboard-operable) in `src/fields/` | M |
| G15 | `RichTextEditor` (`src/primitives/rich-text-editor.tsx`) | Email bodies stay on the CRM's `SlashEmailTextarea` (slash templates, AI generate) | C | `toolbarEnd` slot + ref `insertText` / `insertHtml` / `focus` | S |
| G16 | `SearchCombobox` (`src/primitives/search-combobox.tsx`) | The CRM's `SearchableSelect` stays for static option pickers | C | `variant="field"`, `valueLabel`, static `options` | S |
| G17 | `StatusBadge` (`src/record/StatusBadge.tsx`), `StatusDot` (`src/primitives/status-dot.tsx`) | **CRM-configured status colours are replaced by tone colours** (e.g. Negotiation orange → info blue) on detail headers; lists keep custom dots. Product-visible deviation from the configured lifecycle. | **A** | `color?: string` override (CSS colour) used for the dot / tint, tone kept for contrast text | S |
| G18 | `NumberInput` (`src/fields/NumberInput.tsx`) | `onInput` + `parseLocaleNumber` workaround for live totals; no step arrows | C | `onDraftChange`; `step` + ArrowUp / ArrowDown | S |
| G19 | `EditableTitle`, `PageHeader` in `AppShell` | Node titles used so the page keeps its title; fixed `text-lg` | C | `className` on `EditableTitle`; `PageHeader` inline-title option | S |
| G20 | `DateField` (`src/primitives/date-time-field.tsx`) | One `type="month"` input stays native (`ComplaiReadinessStep`) | C | month granularity (`YYYY-MM`) | S |
| G21 | `Input` / `Textarea` / `SelectTrigger` | Validation errors shown as text only (no invalid border); Button glass shadow hides ring utilities | B | `aria-[invalid=true]` destructive border/ring styles in the primitives | S |
| G22 | `FieldShell` (`src/fields/FieldShell.tsx`) | Labels bound manually (`PField`) | C | auto-generated id passed to the control (render prop) | S |
| G23 | `IconStatCard` (`src/cards/StatCard.tsx`) | Delta cards stay CRM-local on Overview | C | `trend?` slot | S |
| G24 | `ColumnDef` (`src/list/model/columns.ts`) | SLA Level hint moved below the toolbar | C | `headerHint?` | S |
| G25 | `TabsList` (`src/primitives/tabs.tsx`) | `min-w-max` wrapper workaround for many tabs | C | `scrollable` | S |
| G26 | `FrappeDataImport` (`src/frappe/list/FrappeDataImport.tsx`) | CRM passes `DATA_IMPORT_LABELS_AR` explicitly | B | catalogue keys (message blocks en / ar) so the provider language applies | S |
| G27 | `FrappeExportDialog` (`src/frappe/list/FrappeExportDialog.tsx`) | CRM supplies the Arabic dialog chrome; **field labels and the DocType heading stay raw English meta labels** for Arabic users | **A** | catalogue keys for the chrome + forward `FrappeListView`'s `fieldLabels` (and `translateLabel`) to the field picker | S |
| G28 | `FrappeListView` Export / Import dialogs | **Focus goes to `<body>` after Escape** (the menu item that opened the dialog unmounted) — keyboard users lose their place | **A** | keep a ref to the ⋯ trigger (and the bulk-bar Export button) and refocus it in `onCloseAutoFocus` | S |

**Counts (28):** A = 7 (G1, G6, G7, G9, G17, G27, G28) · B = 7 (G3, G4, G8, G13, G14, G21, G26) · C = 14 (G2, G5, G10, G11, G12, G15, G16, G18, G19, G20, G22, G23, G24, G25). G1 also benefits every Frappe app built on `FrappeListView`.

## Implementation plan for class A (for review — not started)

| Step | Gap(s) | Files | Tests | Notes |
|---|---|---|---|---|
| 1 | G28 | `src/frappe/FrappeListView.tsx` | keyboard test: Escape returns focus to the ⋯ trigger / bulk Export | S, no API change |
| 2 | G6, G27 | `src/frappe/list/FrappeBulkActions.tsx`, `src/frappe/list/FrappeExportDialog.tsx`, `src/theme/messages.ts` (en / ar keys), `FrappeListView.tsx` (forward `fieldLabels`) | Arabic render tests of the bulk workflow menu and the export dialog (chrome + field labels) | additive props; English output unchanged |
| 3 | G7 | `src/record/LifecycleBar.tsx`, `src/frappe/record/FrappeWorkflowActions.tsx` (pass `step` from workflow logs / current state) | Lost / converted cases: untaken branches not ticked | default behaviour unchanged when `step` is absent |
| 4 | G17 | `src/record/StatusBadge.tsx`, `src/primitives/status-dot.tsx` | colour override + contrast in light / dark | additive |
| 5 | G9 | `src/frappe/record/FrappeAssignTo.tsx` | stub transport: replace removes the previous ToDo; partial failure surfaced | additive (`replace`) |
| 6 | G1 | `src/list/parts/ListTable.tsx`, `src/list/ListView.tsx`, `src/list/model/columns.ts`, `src/frappe/FrappeListView.tsx` (forward `layout`) | phone layout tests (jsdom: card markup per row, selection, row actions) + showcase smoke at 390 px | the only M item; default `"table"` keeps every current consumer unchanged |

Release path after review: implement on a package branch from `474558e`, full suite + build + boundaries + showcase smoke, version `0.4.0-dev.35`, re-drop into the CRM work copy, CRM re-validation of the touched surfaces. No publish, tag or push without owner approval (`RELEASE-CHECKLIST-0.4.0-rc.1.md` §0 still NOT READY FOR RC).
