# 0.8.0-dev.2 — the CRM record page in the DS: record (2026-11-12)

Branch `feat/0.8.x/record-page` (worktree `/home/frappe/sfui-dev/p08-record-page`), from `feat/0.8.x/integration`.
Local only — not pushed, not tagged, not published. The live CRM is untouched: every CRM-side change is a patch applied
in a lab copy (`/home/frappe/sfui-dev/p0-lab/crmlab`, patches in `p0-lab/patches/`).

## 1. Method

- **Reference:** the live CRM (`internal.solvfaster.com/serve-fast`, package `0.7.0-dev.6-786327a`), captured before any
  CRM change: Deal 1's main column + toolbar in 15 states (page; History / Activities / Revenue tabs; the More ▾ and
  Meeting ▾ menus; the toolbar's Actions and ⋯ menus; title edit; Deal Profile edit, dirty, refused; the unsaved prompt;
  Prerequisites edit; a won and a lost deal) × 12 theme / language / width combinations, and the other record pages
  (Lead, Contact, Organization, Ticket, Service Request, the legacy `/deals/1` outside the CRM scope): page, tabs, edit,
  dirty, the unsaved prompt × 4 combinations. Each state: a **structural signature** (every element's tag, role, text,
  rect to ¼ px and 21 computed styles) and screenshots. Captured twice; both runs identical (deterministic).
- **Candidate:** a lab copy of the CRM (same sources, its node_modules, `@solvfast/ui` swapped for this branch), built
  with the app's Vite config and served the way Frappe serves it. Harness check: the lab built with the live package
  matched the live captures exactly.
- **Gate:** signatures and screenshots of the candidate equal to the reference; behaviour checks (edit flow, menus, rail,
  lifecycle, the app's own e2e suites) with the same results as on the live site.

## 2. What moved into the DS

| CRM piece (serve_fast) | DS | Where the CRM uses it (lab) |
|---|---|---|
| Page container, toolbar, 3 + 1 grid (Deal page) | `RecordPage` (+ `sf-record-page` surfaces) | Deal page, inside the DS scope |
| Header card, halo icon, title row, facts, value, chips | `RecordHeaderCard variant="crm"`, `RecordHeaderIcon` | Deal |
| Quick-action pills, Meeting ▾, More ▾ | `RecordQuickAction`, `RecordQuickActionMenu` | Deal |
| Tab bar | `RecordTabs` | Deal |
| `RecordEditSession`, `EditableCard`, `NotSavedPill`, `PageSaveButton` | `RecordEditSession`, `RecordEditableCard`, `RecordNotSavedPill`, `RecordSaveButton` | every record page (the CRM's module is now an adapter: its wording, toast, shell guard, and the legacy popup / markup outside the CRM scope) |
| Tiles, info rows, Probability ring, Prerequisites list, summary card, closed notice | `RecordInfoTile`, `RecordInfoRow`, `RecordScoreRing`, `RecordFieldList`, `RecordInsightCard`, `RecordClosedNotice` | Deal |
| Edit view label / grid | `RecordField`, `RecordFieldGrid` | Deal Profile |
| `RecentInteractions` | `RecordInteractions` | every page using it (adapter) |
| ⋯ menu (`RecordMoreMenu`) | `RecordMenu` (+ `contentClassName`, `shortcutDir`, `layout`) | every record page (adapter) |

Stays in the app: domain content (the Senaiy summary text, Deal Health, which interactions are inbound), stores, undo /
history, routing, permissions, keyboard shortcuts of the ⋯ menu, the History / Activities / Revenue tab contents.

## 3. Results (lab run `full1`, 2026-11-12)

| Check | Result |
|---|---|
| Deal main column + toolbar, 17 states × 12 combinations (signatures, baseline noise removed) | 308 / 320 identical; the 12 others are `menu-dots` (RecordMenu's label `<span>`, one more node per item) |
| Other pages + the legacy `/deals/1` (Lead, Contact, Organization, Ticket, Service Request; page, tabs, edit, dirty, the unsaved prompt) × 4 | 244 / 244 identical |
| Screenshots (Deal + other pages) | 564 / 564 identical beyond the baseline's own noise |
| Rails and full pages, 6 pages × 4 | 272 / 272 cards, pages identical |
| Edit flow (save, refusal, prompt answers, Ctrl+S, cancel, closed, the app sidebar and Back while dirty) × 3 | 72 / 72 (live: the same checks pass) |
| Rail 91 / 91 · Lifecycle 66 / 66 · `ds-assign-attach` 134 / 134 · `tickets-frappe-fields` 116 / 116 · `ds-record-menus` same items as live · route sweep 38 / 38 | pass |
| Showcase (no app CSS) vs the live CRM, light and dark: header, rail cards, editable card, tiles, interactions, tabs | same surfaces |

Baseline noise (differs between two live captures): "View all" buttons by 1 px, some header names on Lead / Contact.
Not captured: Contact / Organization dirty (no typable field reached by the script); Deal title edit at 820 px.

## 4. Decisions for the owner

1. **`sf-record-page` surfaces ship in glass.css.** The package's own glass pane is solid in light mode; a `RecordPage`
   paints its cards as the CRM does (airy glass in both themes). Opt-in (only inside `RecordPage`), but it is a
   visual-identity choice for the package.
2. **The quick-action pills differ between CRM pages today:** Deal's are the DS outline pill; Lead / Contact / Organization
   pass the older colours (`bg-card/60 border-border/70`). The DS reproduces each as it is; unifying them is a CRM change.

## 5. Not done

- The Frappe adapter (`FrappeFormView` rendering this page, sections as `RecordEditableCard`s bound to the form
  controller's dirty / save).
- Lead, Contact, Organization, Ticket, Service Request, Order: header, toolbar, tabs and About cards not yet on the DS
  components (their edit session, ⋯ menu, interactions card and rail cards are).
- The History / Activities / Revenue tab contents and the Deal Health card (app content).
