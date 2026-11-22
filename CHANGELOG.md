# Changelog — @solvfast/ui

Versioning: SemVer 0.x — patch = no API or visual change; minor = additive or intentional visual change;
breaking changes bump the minor while in 0.x and are labelled **BREAKING**. Tags are created only on a clean tree,
with the owner's approval. Releases are published by the owner (GitHub Packages, `@solvfast` org).

## [Unreleased]

## 0.11.0-dev.4 — Each section saves itself (sectionEdit, editScope "section")

**Behaviour change.** A record page read first (`sectionEdit`, `editScope` "section", the default) now works like the
CRM reference's Tickets / Deals cards: one section is open at a time, and its header has **Cancel** and **Save** (Update
on a submitted document) and, after a change, **Not saved**. The toolbar no longer shows Save or the Not saved tag
(Submit, Amend and the workflow's actions stay). Opening another section while the open one has unsaved changes asks
Save / Discard / Keep editing (`UnsavedChangesDialog`). With one section open, its Save saves that section's changes
only. `editScope` "record" is unchanged. Tests RE.dirty.1, .3, .5, .6, .8 and RP.view.2.

## 0.11.0-dev.3 — The record page tells the host when a rail change is saved

Additive. `SayrRecordPage` takes `notify(message)`: after a lifecycle move, an assignment change or a playbook step (each
saved at once) it is called with "Saved", for the host's toast. Test RP.lifecycle.4.

## 0.11.0-dev.2 — `oneForm` keeps the app's `fieldFilter`

Fix. `SayrRecordPage` with `oneForm` replaced the app's `fieldFilter` with its own (drop the tab breaks), so a field the
app left out still showed. Both apply now. Test RP.view.7.

## 0.11.0-dev.1 — The record header no longer repeats who created the record

Visual. `SayrRecordPage`'s header card no longer shows who created the record and when: the rail's footer card shows it
(with who last edited it), so it is not repeated (message `rpCreatedOn` removed). Test RP.header.2.

## 0.10.0 — one line again: the 0.9.0 release and the 0.7.x line, consolidated (2026-11-18)

The published **0.9.0** with the 0.7.x `main` line (**0.7.0-dev.23 … dev.36**, never published) merged into it (a true
merge: both histories are kept), then the conflicts and duplicates resolved. Every export and component prop of 0.9.0
is still there (`npm run check:api` against `api/0.9.0.json`: 0 removals); the breaking changes below are behavioural
or type-level. Gates: typecheck, check:boundaries, check:api, the full vitest suite of both lines.

### BREAKING (relative to 0.9.0)
- **"View full lifecycle" opens the lifecycle diagram in place** (`LifecycleGraphDialog`) on `SayrRecordPage` and
  `SayrNewRecordPage`, instead of opening Sayr Studio in a new tab. A host that passes `lifecycleHref` keeps 0.9.0's
  new-tab link (deprecated, below). Needs a Sayr server sending `initial_state` / `transitions` (sear_product b45f539
  and 3fc2461); with an older server the dialog shows the states without arrows.
- `FrappeTypeForm` `designer(typeDoctype, ctx)`: `typeDoctype` is now `string | null` (null: a new type, designed on its
  creation page with `ctx.newType`). Strictly typed callers accept `null`.
- `SayrRecordPage` / `SayrNewRecordPage` `extraCards`: a card whose `id` is a built-in card's (`notes`, `attachments`, …)
  replaces that card in its place (0.9.0 kept the built-in).
- `SayrRecordPage` leaves out the Lifecycle, SLA and Playbook cards when the record's DocType has no lifecycle deployed
  (0.9.0 showed them with "No lifecycle / No SLA / No playbook").
- `workflowLifecycle()` gives Frappe Workflow states a phase: submitted (doc_status 1), cancelled (2) and terminal
  states are `closed`, the others `open` (0.9.0: all `open`). A closed Danger or unstyled state carries a colour for
  `lifecycleTone`. Hosts that drew every Frappe state as open see closed icons and tones.

### Deprecated (removed in 0.11.0 unless stated)
- `lifecycleHref` on `SayrRecordPage` and `SayrNewRecordPage`, and the `defaultLifecycleHref` export
  (`@solvfast/ui/sayr`). Passing `lifecycleHref` keeps the 0.9.0 link and logs one console warning in development.
- `RecordRailCard` in `@solvfast/ui/sayr` (alias of `SayrRailCardId`) and `RecordHeaderCard` `variant="crm"` (alias
  of `"page"`): removed by 1.0.

### Added
- From the 0.7.x line (entries below): translated link DocTypes (`FrappeProvider` `translatedDoctypes`); the type form
  designed on its creation page and wizard-mode step moves; **`SchedulingCalendar`**; rail extra cards with `title` /
  `action`; **record page tabs** (`pageTabs`, `pageTab`, `onPageTabChange`, `RecordPageTab`); `headerLine` /
  `headerActions` and `RecordHeaderCard` `nameAction` / `subtitle` / `actions`; **`viewFirst`** with section editing
  (`FrappeForm` `sectionEdit`, `UnsavedChangesDialog` in `./frappe`); the in-page lifecycle diagram
  (`LifecycleGraphDialog`, `LifecycleGraphData`, `LifecyclePathStep` in `./sayr`).
- **`editScope?: "section" | "record"`** on `SayrRecordPage` (with `viewFirst`) and `FrappeForm` / `FrappeFormView`
  (with `sectionEdit`). `"section"` (default): each section's own Edit / Cancel. `"record"`: one **Edit** by the
  record's name (`data-record-edit`) opens every editable section; Save and one **Cancel** (`data-record-cancel-edit`);
  no section buttons. Same mechanism, same read view. `header` may be `(ctx: FrappeFormHeaderContext) => node`.
- **`stateInHeader?: boolean`** on `SayrRecordPage`: default on only when the record has a Sayr lifecycle.
- **Lifecycle: one model, two renderers.** `LifecycleGraphView` (core, dependency-free SVG; the 0.7.x `LifecycleGraph`
  component, renamed) draws the core `LifecycleGraph` model: `graph`, `initial?`, `currentLabel?`, `labels?`, `dir?`,
  `className?`. `layoutLifecycle(graph, initial?, { rtl? })` returns the placed states and routed edges
  (`LifecycleLayout`, `LifecycleLayoutNode`, `LifecycleLayoutEdge`). `LifecycleFlow` (`./lifecycle-diagram`, React Flow)
  draws the same model. `LifecycleGraph` nodes may carry `meta` / `metaTitle` (additive).
- `FrappeWorkflowActions` `hideCurrent` (compact: no state badge — the page shows the state elsewhere).
- Type `SayrNewType` exported from `./sayr`. Messages `lcDiagram`, `lcTransitions`, `lcTransitionItem`,
  `lcTransitionItemPlain`, `lcReached`, `rpEdit`, `rpCancelEdit`.
- `npm run check:api` / `api:report`: the public API report and its check against the published 0.9.0.

### Changed / fixed
- **Opening a section is not a change**: Not Saved, an enabled Save, `onDirtyChange(true)`, the leave guard and the
  "modified after you opened it" banner react only to a changed value (0.7.0-dev.35 marked the form dirty on opening).
  A clean refresh just updates the values; Reload of a newer copy also updates what Cancel puts back.
  While a section is open and nothing has changed, Save is **held**: shown and clickable (`data-primary-held`), never
  disabled — pressing it right after typing commits the field and saves on that first press; with nothing changed it
  just closes the open sections (no request).
  While held, an invisible, unannounced placeholder keeps Not Saved's place, so the first change does not move Save on
  a narrow, wrapping toolbar (a press landing there was lost on phones).
- `SayrRecordPage` no longer hides a Frappe Workflow's or a status field's state on records without a Sayr lifecycle
  (0.7.0-dev.35 showed it nowhere); while the record page loads, the toolbar state never flashes on a lifecycle record.
- Read view: Desk's column order kept, description-list semantics, theme-token icon tiles, no capitals or letter-spacing
  on Arabic labels.
- **`SayrRecordPage surface`** (new, opt-in): `"glass"` gives the page the record page's glass surfaces and makes the
  header card and the section cards the rail cards' pane (light: white with rim and shadow; dark: airy glass). Default
  `"plain"`: unchanged (the root keeps its classes; glass.css's new rules are all scoped to `sf-sayr-record-glass`).
- `AssignDialog` ("Add to ToDo"): a long user name or e-mail no longer widens the dialog past its edge (the row label,
  its description, the picked chips and the dialog body shrink and truncate; was 49 px over at 1440 and 171 px at 390 on
  Sada); a Latin e-mail on an Arabic page is cut at its end.
- Section cards: an unlabelled section after the first is titled from its own visible fields ("Lifecycle · Status Since";
  translated), so two cards never both read "Details" (the first unlabelled section stays "Details"); a section's Edit
  button is named with its title.
- `SayrRecordPage`: the two fields Sayr's deployment adds to a lifecycle DocType (`sear_lifecycle` "Lifecycle",
  `sear_state_since` "Status Since") read in the UI language when the site has no translation of them (ar: "دورة الحياة",
  "الحالة منذ"), so the card titled from them is not English on an Arabic page. A site translation, or a label the site
  renamed, is used as is.
- `LifecycleGraphView`: mirrors in right-to-left languages (was forced left-to-right), a text alternative (hidden list
  of transitions, each state's progress; en / ar), self-transitions drawn as loops, arrow-head ids unique per graph.
- `LifecycleDiagramDialog` (and so `LifecycleGraphDialog`): closing it gives focus back to the button that opened it, as
  the package's other dialogs do (Radix alone dropped it on `<body>` when there is no `DialogTrigger`).
- `LifecycleGraphView`: an arrow's label keeps off the Current badge and the done tick at a state's top end corner; a
  self-loop's label starts just past the card's end edge (on the current state it sat on the badge).
- A new type's first save no longer brings the DocType's hidden fields back into the arranged order.
- Arabic: wizard steps "Move earlier / Move later" said forward / back (the inverse) — now «نقل لموضع أسبق» /
  «نقل لموضع لاحق»; the History tab is «سجل النشاط» («السجل» means "record" across the DS).
- Messages: the duplicate `lcPhase*` keys of the 0.7.x line are removed (0.9.0's wording kept).
- Tests: the second `FD.ui.7d` is renumbered `FD.ui.7f`.

### Migration
- **From 0.9.0:** no code change needed. Check the behaviour changes above (lifecycle dialog; Lifecycle/SLA/Playbook
  cards on DocTypes without a lifecycle; Frappe Workflow phases). To keep linking to Sayr Studio for now, pass
  `lifecycleHref={defaultLifecycleHref}` (deprecated).
- **From 0.7.0-dev.23 … dev.36 (the 0.7.x line):** you also get the 0.8.0 / 0.9.0 changes since 0.7.0-dev.22 (see 0.8.0
  and 0.9.0 below), notably: `LifecycleBar` and `FrappeWorkflowActions variant="steps"` / `currentMarker` /
  `showCurrentEntry` are gone (use `variant="rail"` — read-only unless `applyFromRail` — or `"actions"`); new default
  form behaviour (shortcuts Ctrl/⌘+P/E, Shift+D; fields locked while saving; the "modified after you opened it"
  banner). The 0.7.x `LifecycleGraph` component is now `LifecycleGraphView` and takes the model (`graph`).
  `viewFirst` hosts that relied on dev.32's one Edit pass `editScope="record"`.
- **Sayr server:** sear_product with b45f539 (record page: `initial_state`, `transitions`), 3fc2461 (type preview) and
  61e1308 (`new_type_deployment`, `target_fields[].hidden`).

## 0.7.0-dev.23 … 0.7.0-dev.35 — the 0.7.x `main` line, folded into 0.10.0 (never published)

These builds were made on `main` after it diverged from the 0.8.x/0.9.x line at 0.7.0-dev.22 (e26ab97). As SemVer
pre-releases of 0.7.0 they sort **below** the published 0.7.0; 0.10.0 supersedes all of them. Two labels were used for
two different builds each: **dev.33** (7afb046, then 108f768 — the LifecycleGraph arrow-routing fix) and **dev.35**
(ceb058e, then 86cba02 — the read view as the CRM reference). Their entries are kept as written.

### 0.7.0-dev.36 — The form designer names the Sayr Platform Administrator role

Patch (main 67ec684, merged into 0.10.0). `createSayrFieldDesignerAdapter`'s refusal (403) says "Designing this form
needs the Sayr Platform Administrator role.": Sayr's roles are named Sayr, no longer Sear. The Arabic text is unchanged
(منصة سير). Test FD.sayr.5.

### 0.7.0-dev.35 — A record is edited section by section; the state shows once; an unsaved-changes dialog

Visual. `FrappeFormView` / `FrappeForm` `sectionEdit`: a saved record reads until a section's own **Edit**, which opens
that section only, with its own **Cancel** (that section's saved values back); an open section counts as not saved
(Not Saved tag, Save); Save saves every open section and closes them; a field to fix opens its section.
`SayrRecordPage viewFirst` now uses it: **BREAKING** (small) the one Edit beside `#name` and the toolbar's Cancel are
gone (`data-record-edit`, `data-record-cancel-edit`, messages `rpEdit` / `rpCancelEdit`).
`stateInHeader` (`SayrRecordPage` always): the toolbar's state tag and the workflow bar's state badge are left out, the
header card shows the state (`LifecycleBar` / `FrappeWorkflowActions` `hideCurrent`).
New `UnsavedChangesDialog` (`@solvfast/ui/frappe`): Save and leave / Discard / Keep editing, for a host's router guard.
The read view is the CRM reference's: with `sectionEdit` each section is a card (icon tile, title, Edit / Cancel) and a
section that reads shows its fields as rows (an internal read row: an icon tile by field type, the label small and
upper-case, the value under it, "— Not provided" when empty), two to a line; help texts show only while editing.
*(0.10.0: the read row is internal, not exported; 0.10.0 keeps Desk's column order, uses a description list and no
upper-case on Arabic labels.)*
Tests RP.view.1–4, UC.1–2.

### 0.7.0-dev.34 — A record's view shows its blank fields; no lifecycle cards where no lifecycle is deployed

Visual. `FrappeFormView viewOnly` (and `SayrRecordPage viewFirst`) keeps a blank field it could edit, read and empty,
so its label stays and a section keeps its columns; before, it was hidden, and a section showed a lone field on one
side. `SayrRecordPage` leaves out the Lifecycle, SLA and Playbook cards when the record's DocType has no lifecycle
deployed (a contact, an organization) instead of saying "No lifecycle / No SLA / No playbook". Test RP.lifecycle.2.

### 0.7.0-dev.33 — View full lifecycle opens the whole diagram in a dialog

**BREAKING** (small): `SayrRecordPage` / `SayrNewRecordPage` `lifecycleHref` and `defaultLifecycleHref` are removed:
"View full lifecycle" no longer opens Sayr Studio in a new tab. It opens `LifecycleGraphDialog`: every state and
transition (Sayr's `record_state` / `type_preview` now send `initial_state` and `transitions`), the record's current
state, the states it passed with who and when, and the path taken in the success colour; "<type> lifecycle ·
<lifecycle>", "<record> · currently <state>". A new record's preview opens its type's lifecycle the same way.
Additive: `LifecycleGraph` (a dependency-free layered diagram with arrows, labels and + / − / fit) and
`layoutLifecycle`; `RecordPageData.lifecycle.initial_state` / `transitions`, `LifecycleGraphData`. Messages
`lcPhaseOpen`, `lcPhaseOnHold`, `lcPhaseClosed`, `lcZoomIn`, `lcZoomOut`, `lcFit`, `rpLifecycleOf`, `rpCurrently`.
Tests RP.lifecycle.3, RP.new.2.

### 0.7.0-dev.32 — A record page can open view-first, with Edit; the header takes a key line and buttons

Additive. `SayrRecordPage viewFirst`: the record's fields open read-only (blank ones hidden, as Desk does) with no Save;
**Edit**, beside the record's code, makes them editable with **Cancel** and **Save**, and a Save or a Cancel (which
drops what was typed) goes back to the view. `headerLine` (a key line under the title, or a function of the record) and `headerActions` (the app's
buttons at the end of the header card). Underneath: `FrappeFormView` / `FrappeForm` `viewOnly` (every field read, no
Save / Update nor Ctrl+S; workflow actions and the menu stay) and `RecordHeaderCard` `nameAction`, `subtitle`,
`actions`; the header card shows the record's photo (its
DocType's `image_field`) instead of its initials; `renderField` is told the field's `status` ("Read" in the view), so an app-drawn field can read too. Messages `rpEdit`, `rpCancelEdit`. Tests RP.view.1–3.

### 0.7.0-dev.31 — The type form designer leaves hidden fields out

A type's own hidden fields (a system link, a derived title) are no longer shown on the designer's canvas as locked
fields: nobody places them. They stay out of the saved order too, and Sayr keeps them after the arranged fields.
A field added in the designer and set hidden stays on the canvas. Test FD.sayr.9.

### 0.7.0-dev.30 — A new type's form keeps the fields its DocType was made with

Fix. A new type is made with more than its shared fields (e.g. the SLA section its Configuration deploys), which its
design could not show; a step added after the shared block was then anchored inside them and refused. Its Save now reads
the made form first and places those fields after the shared block, before the form's own rows. *(0.10.0: hidden made
fields stay out, as on load.)*
FD.sayr.8 covers it.

### 0.7.0-dev.29 — A new type's form is designed on its creation page

Additive for apps; one signature widens. jsdom tests only. Needs Sayr's `deployments.new_type_deployment`.

- `FrappeTypeForm`'s `designer` is called for a new type too, with `typeDoctype` `null` and `context.newType`
  (`{ parent, doctype() }`): the designer starts from the family's shared fields (locked, movable) and Wizard mode, and
  the same Save creates the type, then saves the form onto the DocType it made. `designer`'s first argument is now
  `string | null` (**BREAKING** for a host typed `(doctype: string) => …`).
- `SayrFieldDesigner` takes `doctype: string | null` and `newType`; `createSayrFieldDesignerAdapter(api, target)` takes a
  DocType or a `SayrNewType`. Tests FD.sayr.8, FAM.screens.6.

### 0.7.0-dev.28 — SayrRecordPage: a page tab keeps what was just typed

Fix. A page tab opens on mouse-down, before the focused field loses focus and commits what was typed; the form's body
then left with it and the edit was lost. The tab now takes focus off the field first. Test RP.tabs.3.

### 0.7.0-dev.27 — SayrRecordPage: page tabs (About, History, the app's own)

Additive (a page given no `pageTabs` is unchanged). jsdom tests only.

- `SayrRecordPage` takes `pageTabs` (`RecordPageTab`: `{ id, label, icon, render(doc) }`): a full-width tab bar under the
  header card, **About** (the form, its own tab bar below), **History** (`FrappeTimeline`: comments and changes), then
  the app's tabs (rendered only while open). `pageTab` / `onPageTabChange` let the app open one (e.g. from a rail card).
  The form stays mounted while another tab is open, so unsaved edits are kept.
- `FrappeFormView` / `FrappeForm`: `pageTabBar` (under `header`) and `pageTabPanel` (shown instead of the form's tab bar
  and fields while set).
- Messages: `rpAbout`, `rpHistory`, `rpPageTabs`. Tests RP.tabs.1–2.

### 0.7.0-dev.26 — SayrRecordPage: an app card can replace a built-in card, with a title and an action

Additive (nothing changes for an app that passes no such card). jsdom tests only.

- `RecordRailExtraCard` takes `title` (the card's header, e.g. with a count; `label` stays its Customize sections name)
  and `action` (beside the title, e.g. an Add button).
- An app card whose `id` is a built-in card's (`assignment`, `sla`, `playbook`, `tasks`, `notes`, `attachments`) replaces
  that card in its place; `railOrder` no longer lists it twice. `SayrNewRecordPage` keeps the built-in preview.
- Test RP.cards.6.

### 0.7.0-dev.25 — SchedulingCalendar: guests' events on one grid, a meeting's time picked on it

Additive (new component; nothing else changes). jsdom tests only.

- `SchedulingCalendar` (Core, `src/calendar/`): every guest's events on one shared Day / Week time grid (side by side
  where they overlap, in the guest's colour, "Busy" without a title) or a Month grid of chips ("+N more"); the meeting
  being scheduled (`proposal`) on top in the primary colour. Click a slot, drag across slots, drag the proposal or its
  bottom edge, or use the arrow keys on it (Shift resizes): each gives a new slot snapped to `slotMinutes` through
  `onProposalChange` only. A month day click keeps the proposal's times and opens Day view. Toolbar (Today, previous /
  next mirrored in RTL, range, Day | Week | Month, Working hours only), a legend and a resizable height (pointer and
  keyboard). View, date, working-hours switch and height are controlled or not. docs/components/scheduling-calendar.md.
- Slot helpers: `toLocalDate`, `slotFromDrag`, `moveSlot`, `resizeSlot`, `shiftSlot`, `slotOnDay`; types `ScheduleGuest`,
  `ScheduleEvent`, `ScheduleSlot`, `ScheduleView`, `SchedulingCalendarProps`, `SchedulingCalendarLabels`.
- Messages (`messages-ws/schedule.ts`): `schedToday`, `schedPrev`, `schedNext`, `schedDay`, `schedWeek`, `schedMonth`,
  `schedView`, `schedWorkingHoursOnly`, `schedBusy`, `schedMore`, `schedLegend`, `schedProposal`, `schedProposalHint`,
  `schedResizeProposal`, `schedResizePanel`, `schedGrid`.

### 0.7.0-dev.24 — Wizard mode: steps move, turning it off asks first

Hosts that pass `FieldDesigner`'s `wizard` / show family records. jsdom tests only.

- `FieldDesigner` with wizard mode on: a step the author added moves to another place, with all its sections and
  fields: drag it onto another step, or select it and use Move earlier / Move later. The first step (the form's
  standard fields) stays first. *(0.10.0 note: the `moveTab` layout helper is internal — not exported from the package.)*
- Turning wizard mode off when the author added steps asks first ("Turn off Wizard mode?"); Turn off merges their
  sections into one form in step order, Cancel keeps the steps.
- The Wizard mode help reads "Split the form into ordered steps, shown one after another when a record is created."
- `FrappeNewFamilyRecord`: a wizard type's creation page says "Step N of M" above its stepper.
- Messages: `fdMoveStepEarlier`, `fdMoveStepLater`, `fdConfirmMergeTitle`, `fdConfirmMergeBody`, `fdConfirmMergeAction`,
  `famStepOf`; `fdWizardHint` reworded.

### 0.7.0-dev.23 — links show translated DocTypes in the UI language

Additive. jsdom tests only.

- `FrappeLinkField`: a Link to a translated DocType (Desk `boot.translated_doctypes`, e.g. Country) shows its value
  and its search results translated (`__()` of the name, from the provider's translations), as Desk's link control does.
  Other DocTypes keep the name or the title.
- `FrappeProvider` / `FrappeSettings` `translatedDoctypes`; `readFrappeBoot` reads `translated_doctypes` from the page
  boot (`FrappeBoot.translatedDoctypes`).

## 0.9.0 — 2026-11-15

Stable release of the 0.9.0 line (owner-approved). **0.9.0 is the verified 0.9.0-dev.3 source**: the only changes are
the version (`package.json`, the root entries of `package-lock.json`) and this entry. Additive — no 0.8.0 export changed
or was removed; the public API is the dev.3 API, names unchanged (owner decision). The detail is in the dev.1–dev.3
entries below.

- **Type configuration page** — `TypeConfigPage` and its parts; the field library in two modes (**All fields**,
  **Selected fields**); import and label rules (`planFieldImport`, `typeFormConflicts`, `typeSaveBlock`, …). No default
  page subtitle or section description. docs/components/type-config.md
- **Form builder** — `FormBuilder` (wizard steps, sections side by side, 1–4 field columns, 28 field types, every
  Field Library property, locked standard fields, drag and drop with keyboard / panel alternatives, interactive canvas
  previews that are never saved), `FieldTypePicker`, `FormFieldInspector`, `FieldLivePreview`, the field-type registry
  and a pure model. `TypeFormSection builder` renders it. docs/components/form-builder.md
- **Glass** — the record page's surface rules also apply inside `TypeConfigPage` and `FormBuilder` (no new values).
- **Docs** — `CONSUMING.md`: a `PageHeader` subtitle inside `AppShell` is its own strip; only for content the design has.

Upgrade from 0.8.0: no change needed. Verified: CRM Lead / Deal / Task Type pages migrated in the lab and compared with
0.8.0 behaviour; drag and drop verified in Chromium (Firefox / WebKit not available in the lab — every drag action also
has a panel / keyboard path).

## 0.9.0-dev.3 — form builder: interactive previews, moving without dragging (Core, additive)

- **Interactive canvas previews** (`FormBuilder interactivePreviews`, default on): each field on the canvas is its real
  control to try — type, pick, tick, rate, format text — as in the Field Library builder. What is entered there lives
  only in the preview (`FieldLivePreview`): it starts from the field's default value, starts over when the type or the
  default changes, and has no way to change the field or the form; configuration stays in `FormFieldInspector`, whose
  panel says so. `interactivePreviews={false}`: the decorative previews of 0.9.0-dev.2.
- **Moving without dragging** (any browser, keyboard): a field's panel has **Move to** (section, column); a section's
  panel has **Move to step** (wizard) and **Place beside** (another section of its step, or its own row). Together with
  the Arrow / Alt + Arrow handles, every drag action has a non-drag path.
- Field and section handles are focusable `role="button"` spans (Enter / Space select, arrows reorder): Firefox starts no
  drag from a draggable `<button>`.
- Messages: `fbPreview*`, `fbMove*`, `fbPlaceBeside`, `fbOwnRow`, … (en + ar).

## 0.9.0-dev.2 — the form builder (Core, additive)

The type form builder of the SOLV FAST Field Library / CRM type pages, extracted as a package capability and plugged
into the type configuration page. docs/components/form-builder.md

- **`FormBuilder`** — steps (wizard mode: add, rename, icon, show-when condition, reorder by drag or Alt + Arrow, move
  sections onto a step, delete with "move sections to…" or delete), sections (add at the end or between, rename,
  description, 1–3 field columns — 4 with `advancedFieldTypes` — side by side in rows of up to 3 by dropping on an edge,
  collapsible / starts collapsed, reorder by drag or Arrow keys, delete with "move fields to…" or delete — standard
  fields are always rescued), fields (add into a column, move between sections and columns, reorder by drag or Arrow
  keys, full width, delete; standard `core` fields locked with `lockCore`), empty-step warning. Controlled
  (`value` / `onChange`, `{ wizard, steps }`), glass surfaces (`sf-form-builder`).
- **`FieldTypePicker`** ("Add a field") — the 28 Field Library types in 9 groups with icons, names and descriptions
  (en / ar), search; Table and Display Value with `advanced`. Registry `FORM_FIELD_TYPES` (capabilities per type),
  `FORM_FIELD_GROUPS`, `fieldTypeInfo`, `pickFieldTypes`, `tableColumnTypes`.
- **`FormFieldInspector`** — the property sections each type takes: Basics (title, helper, placeholder / search hint,
  required, type-aware default value), Value from, Table (rows source, columns: type, user-entered / derived, options,
  one nested level), Choices (options; Arabic labels and live sources with `advanced`), Link target (object, inline
  "Limit the records shown" rules), Validation (unique, max length, min / max), Conditions (show / required / read-only
  when), Auto-fill, Display (list view, print, closed, filter, search, bold, hidden, read only, translatable).
- **App data in, no app code**: `linkTargets`, `sources`, `stepIcons`, `renderCondition`, `renderTitleInput`,
  `renderFieldProperties`, `renderSectionProperties`, `labels`.
- **Model** (pure, exported): `newFormField`, `newSection`, `newStep`, `normalizeForm`, `setWizard` / `enableWizard` /
  `disableWizard`, `addSection`, `deleteSection`, `moveSection`, `placeAside`, `setSectionColumns`, `nudgeSection`,
  `addField`, `removeField`, `updateField`, `moveField`, `nudgeField`, `addStep`, `updateStep`, `reorderStep`,
  `removeStep`, `rowGroups`, `rowCountOf`, `maxFieldCols`, … and the types `FormBuilderValue` / `FormBuilderStep` /
  `FormBuilderSection` / `FormBuilderField`.
- **`TypeFormSection builder`** renders the builder; its wizard switch drives it. `TypeWizardToggle` = `WizardToggle`.
- **Glass**: the record page's surface rules (glass.css, from styles/src/sf-record-page.css) now also apply inside
  `TypeConfigPage` (`sf-type-config`) and `FormBuilder` (`sf-form-builder`) — the CRM's surfaces in both themes, with no
  new values. Inside the CRM both rule sets apply with identical declarations.
- Messages `fb*` (en + ar). Showcase: *Type configuration* uses the builder; *FormBuilder on its own*.
- Tests: `tests/form-builder.test.tsx`.

## 0.9.0-dev.1 — the type configuration page (Core, additive)

A type's settings page (Lead Type, Deal Type, Task Type, Asset Type…) as reusable parts, extracted from the CRM's
Lead / Deal / Task Type pages, which now use them. No existing export changed. docs/components/type-config.md

- **UI** (`@solvfast/ui`): `TypeConfigPage` (one header: the app's title, a subtitle only when passed; ordered sections;
  action row), `TypeConfigSection`, `TypeAppearanceSection` (the `IconColorPicker`, or the app's picker), `TypeSettingsGrid`,
  `TypeSettingField` (label, required mark, manage link, the app's control, hint lines), `TypeFormSection` (library
  button + picker, wizard switch, label problems, then the app's form designer), `TypeWizardToggle`, `TypeFormIssues`,
  `TypeConfigFooter`, and **`TypeFieldPicker`** — field selection in two modes: **All fields** (a whole library group in
  one click) and **Selected fields** (fields picked one by one across groups, with search; fields that cannot be added
  are shown with the reason). `useFieldImportSummary` words an import's result.
- **Rules** (pure, structural types — any steps → sections → fields model fits): `planFieldImport` (one-time copy; standard
  fields never; reserved and present labels skipped and counted; new ids; side-by-side rows kept; empty sections dropped;
  `mode: "all" | "selected"`), `appendImportedSections`, `fieldImportStatus`, `typeFormConflicts` (blocking label clashes,
  with an `exempt` predicate), `typeFormReservedWarnings`, `typeFormFields`, `typeSaveBlock` (`busy` / `name` /
  `conflicts` / `unchanged`), `normLabel`.
- **Messages**: `tc*` (en + ar). No default page subtitle or section description.
- **Showcase**: Patterns → *Type configuration* (an Asset Type page; the picker alone).
- Tests: `tests/type-config.test.tsx` (rules, parts, both picker modes, a whole non-CRM type page).
- Docs: `docs/CONSUMING.md` — a `PageHeader` `subtitle` / `meta` inside `AppShell` is its own strip under the top bar; pass
  one only when the page's design has that content, never a made-up page description.

## 0.8.0 — 2026-11-14

Stable release of the 0.8.0 line (owner-approved). **0.8.0 is byte-for-byte the 0.8.0-dev.10 source**: the only changes
are the version (`package.json`, the root entries of `package-lock.json`) and this entry. The per-step detail is in the
0.8.0-dev.1 … 0.8.0-dev.10 entries below; this entry summarises the line relative to the last published release,
**0.7.0**. One **BREAKING** change (the legacy lifecycle stepper, below); everything else is additive or an intentional,
recorded behaviour / visual change.

**BREAKING — removed**
- **`LifecycleBar`** and its type **`LifecycleBarProps`** (`@solvfast/ui`) — the old vertical stepper, deprecated since
  0.8.0-dev.5.
- **`FrappeWorkflowActions variant="steps"`** (`@solvfast/ui/frappe`) and its stepper-only props **`currentMarker`** and
  **`showCurrentEntry`**. `FrappeWorkflowActionsProps["variant"]` is now `"compact" | "actions" | "rail"` (a JavaScript
  caller still passing `"steps"` gets the compact badge + menu).
- The stepper's six message keys (en + ar): `recCurrentState`, `lcSteps`, `lcStepDone`, `lcStepNotReached`,
  `coreStepSkipped`, `coreStepFailed`.

**Retained lifecycle API** (unchanged by the removal)
- Core contract (framework-free): `LifecycleDefinition` + `lifecycleTone`, `lifecycleRoots`, `lifecyclePath`,
  `lifecycleTransitionsFrom`, `lifecycleNext`, `lifecycleGraph`.
- Components: `LifecycleRail`; `LifecycleActions` (the header Actions menu, built on `ActionBar`);
  `LifecycleDiagramDialog`, `LifecycleStateCard`, `LifecycleEdgeLabel`, `LifecycleDiagramLegend`,
  `LIFECYCLE_DIAGRAM_COLORS`, `LifecycleStepDot`; `ActionBar`, `StatusBadge`, type `LifecycleStep`, `lifecycleStates` /
  `LifecycleStateItem`, `stateEntries`.
- `@solvfast/ui/lifecycle-diagram`: `LifecycleFlowDialog` (with `LifecycleFlow`, `lifecycleFlowLayout`, `roundedPath`).
- `FrappeWorkflowActions`: `variant="compact"` (the default; FrappeForm's toolbar — same DOM and classes as before,
  proven against the 0.8.0-dev.9 capture), `variant="actions"`, `variant="rail"`. Frappe workflow semantics are unchanged.

**Migration**
- The stepper (`<LifecycleBar variant="steps">`) → **`LifecycleRail`** (`path`, `next`, `ended`, `onViewAll`); for the
  full diagram, **`lifecycleGraph`** with **`LifecycleFlowDialog`** (`@solvfast/ui/lifecycle-diagram`).
- The stepper's actions → **`LifecycleActions`** or, on Frappe data, **`FrappeWorkflowActions variant="actions"`**.
- `<LifecycleBar variant="compact">` (badge + menu) → `StatusBadge` + `ActionBar` side by side, or on Frappe data
  `FrappeWorkflowActions` with the default `variant="compact"`.
- A Frappe Lifecycle card → **`FrappeWorkflowActions variant="rail"`** (read-only by default; `applyFromRail` to run
  transitions from it).
- Callers of **`FrappeWorkflowActions variant="steps"`** → **`variant="rail"`**. `currentMarker` / `showCurrentEntry`
  have no replacement (the rail marks the current state itself; `railLabels.current`).

**Added since 0.7.0** (additive; see the dev entries)
- The Sayr families line (`@solvfast/ui/sayr`; entries labelled 0.7.0-dev.8 … 0.7.0-dev.22, built after 0.7.0 and never
  published) and `RecordRail` with its rail modules (0.8.0-dev.1); `FrappeWorkflowActions variant="rail"`,
  `FrappeFormView` / `FrappeForm` `aside`.
- The record page: `RecordPage` (`surface` "glass" | "plain"), `RecordHeaderCard variant="page"` (`"crm"` kept as a
  deprecated alias), `RecordTabs` (`overflow`, `hidden` tabs), `RecordSectionCard`, `RecordEditSession` and the About
  cards (0.8.0-dev.2 … dev.5).
- The Lifecycle contract, `LifecycleActions`, `FrappeWorkflowActions variant="actions"`, `workflowLifecycle`
  (0.8.0-dev.5); the new entry **`@solvfast/ui/lifecycle-diagram`** with **new optional peer dependencies `reactflow`
  ^11.11.4 and `@dagrejs/dagre` ^3.1.3** (only that entry imports them) and its stylesheet
  `@solvfast/ui/lifecycle-diagram.css` (0.8.0-dev.6).
- Run 1 P1 / P2 closures (0.8.0-dev.6): data-loss fixes (Text Editor "desk" sanitizer profile, Datetime, comment edit,
  save freeze), accessibility and navigation work, one translation path for the list layer, `ListView` totals /
  `onResultChange` / sort-menu options, form shortcuts, and more.
- Phase 4 CRM parity additions (0.8.0-dev.9): `BulkEditDialog`, `BulkTagsDialog`, `BulkAction.preflight`,
  `printListDocument` / `printList`, the XLSX writer and reader, `RecordMenu bindShortcuts`, `RecordRailAssignment team`
  changes, `fuzzyMatch` / `fuzzySearch` / `fillTemplate` / `createRouteHistory` in Core.

**Behaviour and visual changes to note when upgrading from 0.7.0** (each recorded in its dev entry)
- D-64 (0.8.0-dev.6 … dev.8): Desk indicator colours resolve to theme tokens; tinted pills' text (`StatusBadge` tone
  pills, `Badge` success / warning / info, `statusColorStyles(...).pill`) is mixed 45 % with the foreground for contrast;
  `statusColorStyles(...).text` stays at 55 %.
- B-03: the list's Status (indicator) column is shown by default (the `status` field's own column is then hidden).
- C-25: `DateTimeField` no longer rounds the minute down to the interval.
- Dialog / sheet focus returns to the opener; navigation items are links (`<a href>`); `PageHeader` renders a node title
  inside an `AppShell` as `<h2>`.

**For users of the 0.8.0 pre-releases** (not in 0.7.0): since 0.8.0-dev.5, `FrappeWorkflowActions variant="rail"` (added in
0.8.0-dev.1) is read-only by default (`applyFromRail` restores the clickable rail).

## 0.8.0-dev.10 — removal of the legacy lifecycle component — **BREAKING (0.8.0 pre-release line)**

Owner-approved cleanup. The CRM uses only the new lifecycle implementation (`LifecycleRail`, `LifecycleActions`,
`lifecycleGraph` / `lifecycleNext` / `lifecyclePath` / `lifecycleTone`, `LifecycleFlowDialog`, the docstatus helpers); the
old vertical stepper, deprecated since 0.8.0-dev.5, is removed. No runtime dependency change.

**Removed (BREAKING)**
- **`LifecycleBar`** and its type **`LifecycleBarProps`** (`@solvfast/ui`; `src/record/LifecycleBar.tsx`).
- **`FrappeWorkflowActions variant="steps"`** (`@solvfast/ui/frappe`) and its stepper-only props **`currentMarker`** and
  **`showCurrentEntry`**. `FrappeWorkflowActionsProps["variant"]` is now `"compact" | "actions" | "rail"`; the console
  deprecation warning is gone with it. (A JavaScript caller still passing `"steps"` gets the compact badge + menu.)
- The stepper's chrome strings, now unused (en + ar): `recCurrentState`, `lcSteps`, `lcStepDone`, `lcStepNotReached`,
  `coreStepSkipped`, `coreStepFailed`.

**Migration**
- The stepper (`<LifecycleBar variant="steps">`, `FrappeWorkflowActions variant="steps"`) → **`LifecycleRail`** (generic:
  `path` = the states entered with `meta` "who · when", `next`, `ended`, `onViewAll`) or, on Frappe data,
  **`FrappeWorkflowActions variant="rail"`** (path from the workflow log, read-only by default; `applyFromRail` to run
  transitions from it).
- The menu inside the stepper → **`LifecycleActions`** (generic header Actions menu) or **`FrappeWorkflowActions
  variant="actions"`**.
- `<LifecycleBar variant="compact">` (badge + menu) → `StatusBadge` + `ActionBar` side by side (both unchanged), or on
  Frappe data **`FrappeWorkflowActions`** with the default `variant="compact"`.
- `currentMarker` / `showCurrentEntry`: no replacement (the rail marks the current state itself; `railLabels.current`).

**Unchanged**
- `FrappeWorkflowActions variant="compact"` (the default; FrappeForm's toolbar) renders the same DOM and classes as before
  (`StatusBadge` + `ActionBar`, now rendered by FrappeWorkflowActions itself): proven against HTML captured on 0.8.0-dev.9
  (`tests/fixtures/workflow-actions-compact.before.json`, 17 scenarios). `actions` and `rail` are unchanged. Frappe
  workflow semantics (apply_workflow, transitions, roles / permissions, docstatus, confirm, beforeApply / afterApply,
  mandatory checks) are unchanged.
- Kept: `ActionBar`, `StatusBadge`, `LifecycleStepDot`, type `LifecycleStep`, `lifecycleStates` / `LifecycleStateItem`
  (the compact badge's label and tone; `by` / `at` / `step` stay on the type as host data — no package component renders
  them), `stateEntries` (the rail's who · when).

Tests: `tests/workflow-actions-compact-dom.test.tsx` (compact DOM = the dev.9 capture; compact / actions / rail apply
through the simulated fixture transport), `tests/lifecycle-legacy-removed.test.ts` (not exported from `.` / `./frappe`,
the retained API is, dist scan). Stepper-only tests removed; their retained assertions ported to the rail and the dot atom.
Docs: `record.md` §1, §2.1, §2.5, §3.1, §3.6, §8.3, §9.5; `p35-core.md` G7; `CONSUMING.md`. Showcase: the stepper demos
are now `LifecycleRail` / `LifecycleActions`.

## 0.8.0-dev.9 — Phase 4: CRM parity proposals (Core, additive)

Owner-approved Phase 4 of the CRM parity plan (gap ids from the CRM parity gap audit §3). Everything is **additive**: no
existing API changes, no visual change to an existing component unless the host opts in, no new dependency. Core stays
Frappe-free (`check:boundaries`). Tests: `tests/phase4-parity-dev9.test.tsx`, `tests/phase4-io-dev9.test.ts`. Docs:
`list.md` §6c and §8b, `record.md` §5.1 and §10.3, `search.md` API.

- **L-01 `BulkEditDialog`** (new): set values on every selected record — several [Field][Value] rows (each field once;
  `multiple={false}` = Desk's single field), the field type's own value control (select, check, date, datetime, time,
  int / float / currency, text, long-text, link via `search`), typed values to `onApply` (numbers, booleans, empty → `null`);
  Apply disabled until a row has a field; a rejected `onApply` is shown in the dialog. Also `BulkEditValueInput`,
  `bulkEditTypedValue`. `FrappeBulkActions`' Edit is unchanged.
- **L-03 `BulkTagsDialog`** (new): `mode="add"` (the package `TagInput`, suggestions as a list or a search) and
  `mode="remove"` ("tag · n" checkboxes from `existing`; with no tags it says so and Apply is disabled with that reason).
  `countTags(tagLists)` builds `existing`.
- **L-02 `BulkAction.preflight`** (new, optional): `preflight(ctx) → { blocked: { key, reason }[] }`. When it blocks any
  selected key the runner lists them with reasons, its button counts what will run ("Delete 2"), only Close is offered when
  nothing may run, `run` receives only the allowed keys (rows too with the new optional `rowKey`), then `onSkipped(keys)`.
  Actions without `preflight` run exactly as before.
- **L-05 `printListDocument` / `printList`** (new): a clean list printout — heading, optional subtitle, "{n} records", one
  table with exactly the given columns and every given row, escaped, no app chrome; printed through `printHtmlDocument`.
- **L-06 XLSX writer** (new): `buildXlsx(headers, rows, { sheetName?, rtl? }): Blob` — one sheet, inline strings and
  numbers, stored ZIP with CRC-32, deterministic (`buildXlsxBytes`, `xlsxParts`, `zipStored`, `crc32` exported too). A host
  passes `ExportDialog fileTypes={["Excel", "CSV"]}` and writes Excel with it.
- **L-07 XLSX reader and import hint**: `parseXlsx(file): Promise<string[][]>` (first sheet; shared / inline strings,
  numbers, booleans; deflated entries through the platform's `DecompressionStream`; `.xls` refused). `DataImportDialog`'s
  file hint now names what `adapter.accept` lists (`importFileHint`: ".csv" → "CSV", ".csv,.xlsx" → "CSV or XLSX", en / ar;
  known types in a fixed order) unless `labels.fileHint` is given; the default accept, and ".csv,.xlsx,.xls", keep
  "CSV, XLS or XLSX". The hint paragraph gains a `data-import-file-hint` attribute.
- **M-07 `RecordMenu bindShortcuts`** (new, opt-in): the items' `shortcut` hints become working keys through the same
  confirm as a click; not while typing, while a dialog / menu is open, for hidden / disabled items or a disabled / busy
  menu; exact modifiers, "Ctrl" also ⌘; removed on unmount. `parseShortcut`, `shortcutMatches` exported.
- **AS-06 `RecordRailAssignment team`**: `team` also takes `onChange`, `options`, `changeLabel` → a "Change team" menu on
  the team row. Without `onChange` the row's markup is unchanged.
- **S-07** Core now exports `fuzzyMatch`, `fuzzySearch`, `fillTemplate` (moved from the Frappe layer to `src/lib/fuzzy.ts`;
  `@solvfast/ui/frappe` re-exports the same functions) and the new framework-free `createRouteHistory({ max, storage?,
  key?, equals? })` (`record`, `list`, `recent`, `clear`).
- Strings: new catalogue keys `bke*`, `btg*`, `bpf*`, `rrChangeTeam` (en / ar).

## 0.8.0-dev.8 — Run 1: D-64 scope correction

- **D-64 scope**: 0.8.0-dev.7 also moved `statusColorStyles(...).text` (plain text with no tint, e.g. the CRM's rail
  card status labels) to 45 %; the CRM parity run (`p0-lab/runs/run1-run1c-rail`) showed it as a visible change outside
  D-64 (decision 8 covers text on a tint). `text` is back to P35's 55 %; only `.pill` (text on its 15 % tint) uses 45 %.
  Test: `run1-acceptance` "D-64 scope". 0.8.0-dev.7 is superseded (lab only, never published).

## 0.8.0-dev.7 — Run 1: D-64 contrast correction and acceptance tests

- **D-64 contrast correction (visible, decision 8)**: tinted pills' text is now the colour mixed **45 %** with the
  foreground (was 55 % in 0.8.0-dev.6): `StatusBadge` tone pills, `Badge` success / warning / info and
  `statusColorStyles(...).pill` (custom / Desk colours on a tint). `statusColorStyles(...).text` (plain text, no tint)
  keeps 55 % (unchanged since P35). Measured in a browser on the CRM lab build (`p0-lab/runs/run1-d64-*`), the
  0.8.0-dev.6 info pills on Glass reached only 4.42:1 (the palette calculation had assumed a white card). At 45 % every
  palette colour is ≥ 5.31:1 on the tint over white, Glass (246 / 246 / 248) and a darker panel (236 / 236 / 240), light
  and dark (`p0-lab/run1/d64-contrast-measured.py`). Tests pinning the mix (`core-p35` P35 colour, `run1-step4` D-64) follow.
- Tests: `tests/run1-acceptance.test.tsx` asserts the audit acceptance items the ledger reconciliation found unasserted
  (A-25, A-29, B-02, B-26, B-38, B-42, B-55, B-56, B-61, C-25, C-79, C-81…C-84, D-08, D-41, D-54, D-64, E-14). No
  behaviour change. E-14 "export sends add_totals_row" stays open (`it.todo`).

## 0.8.0-dev.6 — Run 1: P1 / P2 closures

Run 1 of the P1 / P2 roadmap (owner authorization 2026-11-13; rows keep their Phase-30 ids, `docs/specs/` and
`p0-lab/run1/LEDGER.md` hold the per-row record). Real site: every server-dependent row is simulator-tested only (I5 pending).

**Step 1 — data loss and P1 defects**
- **C-29 Text Editor (data loss)**: `sanitizeHtml(html, profile)` / `RichText profile` / `RichTextEditor profile` — new
  `"desk"` profile keeps what Desk's Text Editor (Quill 2) stores: headings, tables, images (http(s), `/files/…`,
  png/jpeg/gif/webp data URLs), colours / alignment / direction (a listed set of CSS properties; no `url()`, expressions,
  escapes or positioning), Quill's `ql-*` classes and `data-list` / `data-row`, mention spans, site-relative links.
  `FrappeField` Text Editor (edit and read) uses it. The default `"basic"` profile is **unchanged** (CRM `RichTextEditor`,
  `EmailComposer`). The editor never emits on mount or on a synced value. New handle method `replaceBeforeCaret`, props
  `onKeyDown` / `onInputCaret`.
- **C-24 Date**: `DateField` opt-in aids `clearable` (Clear button; the selected day again clears), `showToday`,
  `parseDisplay` + `parseHint` (typed entry in the popover), `invalid`. `FrappeField` Date uses them (typed in the site's
  `date_format` via `parseUserDate`); a required empty Date is `aria-invalid`. Without the props the DS field is unchanged.
- **C-25 Datetime (data loss)**: the minute is never rounded down to the interval any more (an off-interval minute is kept
  in the list) — **behaviour fix for every `DateTimeField`**, including the CRM's call forms (10:37 stayed 10:30 on Apply).
  Opt-in `withSeconds` (value `YYYY-MM-DDTHH:mm:ss`; Apply without touching the time keeps the seconds), `showNow`,
  `clearable`, `invalid`. `FrappeField` Datetime: every minute, seconds kept, Clear / Now, edited in the user's time zone
  and stored in the system's (`datetimeToUserInput` / `datetimeFromUserInput`; simulator only).
- **D-28 comment edit (data loss)**: an HTML comment is edited in `CommentRichEditor` (new export: `RichTextEditor` with the
  "desk" profile + @mentions): formatting, links, images and mentions survive; image-only comments can be saved.
  Plain-text comments (`bodyFormat: "text"`) keep `CommentComposer`. New comments are still written in `CommentComposer`.
- **C-71 save freeze (data loss)**: `FrappeFormView`'s fields are `inert` + `aria-busy` while saving / cancelling; a value
  written during the request is re-applied over the server's answer (the form stays Not Saved).
- **D-55 / K1**: `FrappeWorkflowActions` outside `FrappeForm`: `frm` (the host form's controller) runs Desk's sequence
  (check_mandatory → before_workflow_action → apply → after_workflow_action); without it, the document is checked against
  its meta's mandatory fields (Missing Fields dialog; `checkMandatory={false}` opts out).
- **E-19 report export**: the list's "Export as report" sends the checked rows as `selected_items`; the dialog's labels
  come from the catalogue (`rx*`, en / ar; `reportExportLabels(t)`).
**Step 2 — P1 accessibility**
- **A-09 `NotificationPanel`**: focus moves into the panel on open and back to the bell on close (Escape, ×, outside,
  a row); the bell is named with the unread count ("Notifications, 3 unread", en / ar) and controls the panel; opt-in
  `onMarkRead` (per-row "Mark as read", does not open the row) and `loading`. Look unchanged.
- **A-27 `MobileNav`**: default mode lists a group's whole sub-tree in More (indented) — every child reachable on a phone;
  the bar is a named landmark (`ariaLabel`, default "Main navigation"); More has `aria-haspopup` / `aria-controls`.
  (The CRM passes `primary`: unchanged.)
- **B-42 focus return (G28)**: `DialogContent`, `AlertDialogContent` and `SheetContent` give focus back to the element
  that opened them (a menu item → its menu's trigger; `DropdownMenuItem` notes it) — every list dialog opened from the ⋯
  or Actions menu now returns focus to its trigger. New prop `returnFocus` overrides. No visual change.
- **D-01 / D-07 `AssigneeGroup variant="avatars"`**: the stack is one button named with every assignee (overflow included)
  that opens the full list with Remove / Done (keyboard and touch); the hover-only remove on an avatar is gone (it was
  unreachable). `FrappeAssignTo`: `canWrite` omitted → the user's write right (`usePermissions`, meta loaded); a failed
  `get_docinfo` is an error, not "nobody assigned". The CRM uses `variant="list"`: unchanged.
- **D-62 lifecycle stepper**: `FrappeWorkflowActions variant="steps"` (deprecated, kept) ticks only states the record
  entered; a state it never entered before the current one is "skipped". `LifecycleBar`'s list is named "Lifecycle"
  (translated; was the untranslated "lifecycle") and each step has a screen-reader state (completed / not reached).
- Tests changed with the behaviour: `shell` NotificationPanel test (bell name now counts unread);
  `frappe-lifecycle-rail` steps test selects the list by `data-lifecycle-steps` (its name is translated now).

**Step 3 — one translation path**
- **B-61 (G58)**: the list layer reads the provider's translations (Desk `__(text, null, doctype)`; `FrappeProvider
  translations`, boot `__messages`, the meta's own): column / filter labels, child-table labels, Select options and
  Select cell values (stored values unchanged), the DocType's name (Add, empty states), status words.
  `useFrappeTranslate(bundle)` (new, `@solvfast/ui/frappe`), `buildFrappeListMeta(…, { translate })`,
  `useFrappeList().translate`. English sites without a dictionary: unchanged.
- **B-03 (decision B-D2)**: the Status (indicator) column is **shown by default** (was offered, hidden); as Desk
  (list_view.js:412-416) the `status` field's own column is then hidden (still offered). `rowMeta` options unchanged.
- **B-38** bulk workflow actions, **D-54** `FrappeWorkflowActions` / `FrappeStatusIndicator` (default `translate` = the
  provider's translations; was identity), **B-39** the exporter's DocType, group, ID and field labels, the report export's
  DocType title: in the session language.
- **D-41**: a communication's delivery status in the session language (site translation, then the package's `commStatus*`
  catalogue); the medium as the entry icon (Email / Phone / Meeting / Other — form_timeline.js:227-238).
  `FrappeTimeline`'s default `translate` is the provider's (was identity).
- **A-51 dialog base**: the × is named from the catalogue (was "Close" in every language; `DialogContent`, `SheetContent`);
  new `DialogContent` props `dismissible={false}` (Desk `static`: no Escape / outside close, no ×), `hideClose`,
  `size` ("sm" | "md" | "lg" | "xl" | "full"; "md" = the unchanged default); `DialogTitle indicator`.
- Tests changed with the behaviour: `list-query` "spends Desk's Status slot" (the indicator now takes the slot, the
  status field column is hidden — expected headers unchanged, test renamed).

**Step 4 — accessibility and navigation**
- **A-28** `AppShell`: a "Skip to main content" link (en / ar) is the first Tab stop; `<main>` is focusable.
- **A-29** `AppShell documentTitle` (default on): the tab title is "{page} · {brand}" (function or `false`); restored on unmount.
- **A-23** `Sidebar`: a named landmark ("Main navigation"); the current item is scrolled into view; `NavItem.section` = a
  collapsible heading over its items.
- **A-25** navigation targets are links (`<a href>`): Sidebar items, MobileNav items, AppSwitcher apps — a plain click
  still goes through `onNavigate`, Ctrl / ⌘ / middle click open a new tab. No visual change.
- **B-02** `ColumnDef.href` / `title` (Core); `FrappeListView` / `useFrappeList` `formHref`: the Subject is a link to Desk's
  `/app/<slug>/<name>` (titled, the name when the title is empty); Ctrl/⌘-click on a link no longer opens the row.
- **B-56** list keyboard: the rows are one Tab stop (roving tabindex); ↑ / ↓ move, Space ticks, Shift+↑ / ↓ extends,
  Enter opens; ignored inside controls. Table and card layouts.
- **C-08** `FrappeField`: `aria-required` on required controls, the description is the control's `aria-describedby`;
  Rating and Text Editor take the invalid / required state; `Input`, `Textarea`, `SelectTrigger` show `aria-invalid`.
- **C-57** `DataGrid`: one Tab stop per row (its first editable cell); Enter / F2 opens the row with that editor focused;
  ↑ / ↓ in an editor move to the same column of the previous / next row; Tab past the last editor of the last row adds a
  row; Add Row opens the new row with its first editor focused.
- **A-22** `ThemeProvider locale` + `useLocale().locale / setLocale`, `isRtlLanguage`, `RTL_LANGUAGES` (ar, he, fa, ps):
  the direction follows Frappe's RTL list; chrome stays en / ar. `FrappeProvider` applies `boot.lang`
  (`applyBootLanguage={false}` opts out).
- **A-61** `FrappeProvider onSessionExpired` ("redirect" = Desk's `/login?redirect-to=…`, or a function): fired once per
  burst for any query / mutation answering session expired. Opt-in (no global action by default). `loginRedirectUrl`.
- **C-79** `FrappeFormView`: a newer server copy while dirty shows "modified after you opened it" + Reload (keeps the
  edits until Reload); `FrappeForm realtime` (doc_subscribe); `FrappeForm` shows the newer of its save answer and the
  loaded copy (was: its own save hid a later change).
- **D-43** communications paging counts automated messages (Desk: 21 of both kinds); no duplicates when paging.
- **D-64 (intentional visible change, decision 8)**: Desk's indicator colour names all resolve to theme tokens (new
  `--indicator-blue / -light-blue / -pink / -darkgrey`, light and dark; `DESK_INDICATOR_COLOURS`); the Frappe form header,
  record chip and list Status pill paint Desk's colour. **Tinted pills' text is darker / lighter for contrast** (≥ 4.5:1
  on the tint): `StatusBadge` tone pills and `Badge` success / warning / info — visible on every CRM status badge.
- Tests changed with the behaviour: `shell` / `merged` / `run1-step2` nav items are queried as links (A-25); `list` F22
  (one Tab stop: other rows `tabindex=-1`, B-56); `fields` DataGrid add test (the new row opens for editing first,
  C-57). A Sayr-named AppShell test pins the backdrop as the shell's first child: the skip link is placed after it (no
  Sayr file changed).

**Step 5 — CRM-evidenced completion**
- **C-81…C-84 form shortcuts (decision 10)**: `FrappeRecordMenu shortcuts` binds Ctrl/⌘+P Print, Ctrl/⌘+E Email, Shift+D
  Duplicate, Shift+Ctrl/⌘+D Delete (asks first) — topmost menu only, not while typing or with a dialog open, only for the
  entries offered. `FrappeForm` turns it on (off with `hotkeys={false}` / `menu={{ shortcuts: false }}`). A host with its
  own menu (the CRM's `useRecordMenu`, which binds on `window`) gets no package binding: no double handlers. Print shows
  its Ctrl+P hint.
- **B-26** `ListView controls.sortMenuOptions` (`options` independent of the visible columns, `directionToggle`,
  `clearable`), `SortMenu directionToggle / clearable`; `sortOptionsFromMeta` (Desk's sort-selector options) — passed by
  `FrappeListView` when the host turns `sortMenu` on. Off by default (decision B-D3).
- **B-48** `FrappeListView`: a new document starts with the list's "=" / tree filters on editable non-standard fields (Desk
  make_new_doc); the app's `create.defaults.routeOptions` win.
- **B-55** `ListView emptyFilteredAction`, `emptyDescription`, `emptyIllustration`; `FrappeListView` offers "Create a new
  {DocType}" in the filtered-empty state to a user who may create (decision B-D5) and the DocType's description.
- **A-33** `StatCard` / `IconStatCard`: `state` ("loading" | "empty" N/A | "error"), `errorText`, `format`, `compact`
  (1.2M), `menu`. Without them: unchanged. (The Frappe Number Card binding stays deferred: decision 5.)
- **A-42 / C-67** `EditableTitle`: an async `onSave` shows the new title busy and reverts with the message on failure;
  `className`. `PageHeader`: inside an AppShell a node title is an `<h2>` (one `<h1>` per page — G19); `titleInShell`
  makes it the top bar's `<h1>` (e.g. an EditableTitle). `RenameDialog title / allowNameChange`. `FrappeFormView
  onRenameTitle` + `FrappeForm onRenamed`: the form title opens Desk's title / rename dialog
  (`frappe.model.rename_doc.update_document_title`; simulator handler added).
- **E-14** `ListView totals`: a `<tfoot>` totals row (a "Total" row header; numeric columns or `ColumnDef.total`; summed
  over every filtered row; per currency with `ColumnDef.currency`), the user's "Show totals row" switch in the column
  manager remembered with the prefs (`ListPrefs.showTotals`). The Report view's own totals card is unchanged (shipped
  views frozen, decision 3).
- Tests changed with the behaviour: `merged` PageHeader test (a node title in a shell is an `<h2>`, not a second
  `<h1>`); `frappe-form-integration` FV.K4 picks `/^Print/` (the item now carries its Ctrl+P hint).

**Step 6 — tests-only closures** (the behaviour existed; now asserted): A-05 awesome-bar new tab (Ctrl/⌘-click,
Ctrl+Enter); A-06 Dashboard rows, frequent links, "Find x in Y"; C-69 the beforeunload guard; D-08 a refused Done shown
inline; D-13 the share dialog in Arabic / RTL; E-01 the view switcher by keyboard (en / ar); E-59 moves within a Kanban
column (drop + Desk's update_order args). One addition with E-59: **`KanbanBoard` Alt+↑ / ↓ reorder a card within its
column** — the keyboard equivalent of the existing in-column drag (accessibility; the shipped view otherwise unchanged).

**Step 7 — initiative P1**
- **I1 `@solvfast/ui/lifecycle-diagram`** (new entry, owner decision E3 option B): `LifecycleFlow`, `LifecycleFlowDialog`,
  `lifecycleFlowLayout`, `roundedPath` — the CRM's React Flow + dagre diagram ported onto Core's `lifecycleGraph`
  contract and look. **New optional peer dependencies `reactflow` ^11.11.4 and `@dagrejs/dagre` ^3.1.3** (dev-installed at
  the CRM's exact versions); only this entry imports them (boundary check: Core and the other entries never do).
  Stylesheet `@solvfast/ui/lifecycle-diagram.css` (the zoom controls on the theme tokens; load after
  `reactflow/dist/style.css`). Phase words `lcPhaseOpen / OnHold / Closed` (en / ar).
- **I3 `ListView onResultChange`** (docs/specs/LISTVIEW-API.md §4): client mode reports `{ rows, visibleColumns, filtered }`
  (every matching row, sorted, all pages) on query / search / sort / column / row changes; never on paging; never in
  server mode.
- **D-64 fix-up**: the four new indicator tokens moved to `styles/src/sf-components.css` (`styles/theme.css` is
  generated: the step 4 edit was regenerated away by the build and never shipped; the tests could not see CSS variables).
  **C-29 styles**: `.sf-rich-text` now styles what the desk profile keeps (h1/h2/h4–h6, tables, images, pre, hr, Quill
  alignment / direction / indent classes).

**Review fixes (before the CRM parity run)**
- B-61: a translated Select cell keeps its pill (`Badge`), as the untranslated one.
- C-29: a site-relative URL may not start `/\` (browsers read `/\host` as `//host`) — href and img src.
- A-25: a navigation item without an `href` stays a button (`NavTarget`: link with href, button without).
- I3: `onResultChange` does not re-fire for the same result (same row objects, columns, flag) — a host that re-renders
  with a fresh array and sets state in the callback cannot loop.
- C-25: Apply without touching the date or time returns the value exactly as it was (never rebuilt through a local Date).
- A-22: `boot.lang` is applied once per page load and language — a provider mounted again never undoes the user's switch.
- B-03: with curated columns (`columns`), the indicator column stays offered, hidden (the app decides; no second Status).
- `.sf-rich-text` Quill bullet lists (`li[data-list=bullet]`) show bullets; the list rows' index map is computed once.
- `VENDORED.md` lists every Run 1 edit to a vendored primitive (a re-vendor would revert them).

- Tests changed with the behaviour (old → new): `merged`/sanitizer pins unchanged; comment-edit tests in `record`,
  `social-p36b` (P36B.social.18), `history-p36d` (P36D.history.8) now type into the rich editor; `trace-p36e`
  P36E.trace.11 asserted the Date defect (no clear, no typing) and now asserts the fix.

## 0.8.0-dev.5 — P0: RecordTabs, RecordSectionCard, the Lifecycle contract, a second-domain showcase, the ListView spec

Additive; nothing changes for existing code.
- **T5 `RecordTabs`**: `overflow?: "fill" | "scroll"` (default `"fill"` = the 0.8.0-dev.4 markup, tested), `ariaLabel?`, and
  `RecordTab.hidden?`. `"scroll"` is the CRM's scrollable tab bar (Deal / Ticket / Order Activities sub-tabs: an
  `overflow-x-auto` wrapper, a `min-w-max` list, `whitespace-nowrap` tabs). `hidden` = the CRM's conditional (feature
  flagged) tabs. Keyboard (arrows, RTL reversed) skips hidden tabs (tested).
- **T6 `RecordSectionCard`**: a read-only record page card — the shell of `RecordEditableCard` without editing (same DOM
  as a read-only editable card, tested). Docs §11.5: composing a record page (slots; Core vs adapter vs app).
- **T7 Lifecycle** (docs §9.4–§9.5; reference: CRM-REFERENCE.md §3):
  - Core contract `record/lifecycle.ts` (framework-free): `LifecycleDefinition`, `lifecycleTone`, `lifecycleRoots`,
    `lifecyclePath` (shortest path), `lifecycleTransitionsFrom`, `lifecycleNext`, `lifecycleGraph` (diagram model; no
    renderer in Core).
  - `LifecycleActions`: the header Actions menu (plain items, immediate run, per-item disabled reason, blocked button).
  - `FrappeWorkflowActions`: new `variant="actions"` (the header menu, `blockedReason`, `blockedIcon`); `variant="rail"` is
    now **read-only by default** (where the workflow goes from here) — `applyFromRail` keeps the previous clickable rail
    (an intentional change of the rail's default; its only consumer is the CRM lab). `variant="steps"` **deprecated**
    (kept, unchanged; warns once in the console). `compact` unchanged. `workflowLifecycle(workflow)` (`@solvfast/ui/frappe`).
    Consumer check: no app passes `steps` to the package (the CRM maps its own `steps` to `rail`); the showcase's
    workflow demo now shows `actions` + `rail`.
- **T8** showcase › Record page (dental patient): the record page parts for another domain, package components only (a
  patient journey on the Lifecycle contract, five scrolling tabs, an edit session, an app card and rail section, an
  embedded ListView). Captured in light / dark × en / ar × 390 / 820 / 1440: no CRM CSS or strings, no truncated tab.
- **T9** `docs/specs/LISTVIEW-API.md`: the ListView API classified against the CRM's lists (covered / gap / app-level /
  not required / future). One proposed change (not implemented): `onResultChange` in client mode.
- **T10** parity: a CRM build from the frozen control snapshot `20261112T183811Z-crm-p0` with this package (and the CRM-side
  lab patches) compared with the control build, every capture and behaviour suite in one session. Record:
  `docs/audit/p08/P0-FINAL.md`. Not published; the live CRM is unchanged.

## 0.8.0-dev.4 — RecordPage `surface` (P0 T4)

Additive; nothing changes for existing code (glass stays the default).
- `RecordPage` **`surface?: "glass" | "plain"`** (new type `RecordPageSurface`). `"glass"` is the **default**: no
  `surface` and `surface="glass"` render exactly what 0.8.0-dev.3 rendered (root class `sf-record-page p-4 md:p-6
  max-w-[1600px] mx-auto`; same DOM, tested). `"plain"` is an explicit opt-out: no `sf-record-page`, so no record page
  glass styling; the components keep their own surfaces. Nothing else differs between the two (DOM, roles, focus order).
- The glass rules and tokens are unchanged; `glass.css` is byte-identical to 0.8.0-dev.3 (`sf-record-page.css` changed
  in its source comment only). Showcase: the record page demo passes `surface` and has a Glass / Plain switch.

## 0.8.0-dev.3 — neutral RecordPage naming (P0 T3)

No visual or behaviour change; existing code keeps working.
- `RecordHeaderCard`: **`variant="page"`** is the record page header's name. `variant="crm"` (0.8.0-dev.2) stays as a
  **deprecated alias** with identical output (tested: the same DOM for every prop, en and ar, alone and inside a
  `RecordPage`). New exported type `RecordHeaderCardVariant` (`"default" | "page" | "crm"`).
  The page header's `data-record-header` attribute now reads `"page"` (was `"crm"`; no consumer selects on it).
- Messages: the internal module `messages-ws/recordPageCrm.ts` is now one module per component, as the other message
  modules: `recordEditSession.ts` (`res*`) and `recordAbout.ts` (`rpg*`). Not exported; keys and wording are unchanged
  (tested against the 0.8.0-dev.2 values).
- Docs: the prop docs of `RecordPage`, `RecordQuickActionMenu`, `RecordMenu` and `RecordRail` and the file docs of
  `RecordRail`, `RecordAbout`, `RecordEditSession` and `RecordHeaderCard` use neutral wording (no app component names). The
  CRM record page is named only as the reference. Showcase: `variant="page"`.

## 0.8.0-dev.2 — the CRM record page: RecordPage, the CRM header, the edit session, the About cards

Additive (nothing changes for a consumer that does not use the new components or props). docs/components/record.md §11.
- `RecordPage` (+ `sf-record-page` surfaces in glass.css: the CRM's airy glass cards, any app), `RecordHeaderCard
  variant="crm"` + `RecordHeaderIcon`, `RecordQuickAction`, `RecordQuickActionMenu`, `RecordTabs`.
- `RecordEditSession` (page-level Save and single-card models, the unsaved-changes prompt), `RecordEditableCard`,
  `RecordNotSavedPill`, `RecordSaveButton`, `useRecordEditSession`; `res*` messages.
- About cards: `RecordInfoTile`, `RecordInfoRow`, `RecordScoreRing`, `RecordFieldList`, `RecordInsightCard`,
  `RecordClosedNotice`, `RecordInteractions`; `rpg*` messages.
- `RecordMenu`: `contentClassName`, `shortcutDir`, `layout` (defaults unchanged).
- Evidence: a lab build of the CRM on these components matched the live CRM Deal page — main column and toolbar in 15
  states (tabs, menus, title edit, profile edit / dirty / refused, the unsaved prompt, prerequisites edit, won and lost
  deals) × 4 combinations: structural signatures and screenshots identical (the ⋯ menu: one more <span> per item, same
  pixels); the edit flow behaves identically (40 checks on both). jsdom tests: record-page, record-edit-session.

## 0.8.0-dev.1 — integration: 0.7.0 + the Sayr families line + RecordRail

The first prerelease after 0.7.0 (`feat/0.8.x/integration`, from tag `v0.7.0`). It merges `feat/0.7.x/families` at
`e26ab97` and `feat/0.7.x/p0-record-rail`. The families entries below keep the labels they were vendored under
(0.7.0-dev.8 … 0.7.0-dev.22: built after 0.7.0 but never published to the registry; as SemVer prereleases those labels
sort below 0.7.0, which is why this line continues as 0.8.0-dev.N). 0.7.0's group-by fixes, which the families line
did not have, are included. Nothing below changes for a consumer of 0.7.0 that does not use the new APIs.

### RecordRail, Lifecycle on Frappe data, FormView aside (from `feat/0.7.x/p0-record-rail`)

**RecordRail — the CRM record page's right rail as DS components** (docs/components/record.md §10)
- New Core `RecordRail`, `RecordRailCard`, `RecordRailSection`, `RecordRailRow`, `RecordRailCustomize`,
  `RecordRailFooter`, and the modules `RecordRailAssignment`, `RecordRailLinkedRecord` (Organization),
  `RecordRailTasks`, `RecordRailArticles` + `RecordRailArticleReader`; `recordRailCardClass` for the Attachments card
  (`FrappeAttachments`). A 1:1 port of the CRM's rail pieces (same DOM and classes); on the CRM Deal page the migrated
  rail is pixel-identical to the pre-migration capture. Hosts can pass their own glyphs.
- The Desk form sidebar (`FormSidebar`, `FrappeFormSidebar`) is unchanged; both sidebar systems remain.
- `rr*` messages (en / ar).

**Lifecycle on Frappe data**
- `FrappeWorkflowActions variant="rail"`: the record's Lifecycle as `LifecycleRail` (path from workflow logs / versions,
  the server's transitions as buttons that apply them, back-moves tagged, End of lifecycle only when no transition
  leaves the state). `onViewAll`, `railLabels`. `compact` and `steps` are unchanged.
- `LifecycleRail` gains `onSelectNext` (the same change as on `feat/0.7.x/families`).

**FormView**
- `FrappeFormView` / `FrappeForm` `aside`: a record rail next to the form (3 + 1 columns from `lg` up). Absent → the
  layout is unchanged.

### Naming
- `@solvfast/ui/sayr`: the rail's card-id type is now `SayrRailCardId`. `RecordRailCard` stays there as a **deprecated
  alias** (same type), because the core entry's `RecordRailCard` is the CRM rail's card component.

## 0.7.0-dev.22 — a family's extra registry columns and the new record's form hooks

Additive. jsdom tests only.

- `FamilyDescriptor.extraFields`: more registry columns read into `FamilyType.row` (e.g. a type's unit price and
  currency); a column the registry lacks is skipped.
- `FrappeNewFamilyRecord` / `SayrNewRecordPage` `formProps(type)`: the chosen type's form gets `events`, `childEvents`
  and `renderField` (e.g. a price filled on a new record, a quantity stepper drawn by the app).

## 0.7.0-dev.21 — locked fields show a lock; the app adds its own rail cards

Additive, with a visual change in the form builder. jsdom tests only.

- `FieldDesigner`: a field shared from the family parent (a locked field) shows a lock instead of the share icon; its
  note says it moves to any position, section or step but is never removed, renamed or given another field type.
- `SayrRecordPage` / `SayrNewRecordPage` `extraCards`: the app's own rail cards (`RecordRailExtraCard`:
  `{ id, label, icon, render(doc) }`), after Playbook, in Customize sections, hidden per DocType like the others. On a new
  record they wait for it. Exports `railOrder`, `RecordRailExtraCard`.

## 0.7.0-dev.20 — assignee avatars name their user and filter by them

Additive. jsdom tests only.

- `FrappeListView` Assigned To cell (Desk's assignee avatars): each avatar shows its user's full name in a tooltip on
  hover or focus, and a click filters the list by that user (`_assign like %user%`, the sidebar's Assigned To filter)
  without opening the row. A "+N" shows the other names. The group's native `title` is gone; each avatar is a button
  labelled with the user's name (`data-assignee` holds the user id).

## 0.7.0-dev.19 — the type on a new record is a searchable link field

Visual change (the type picker). jsdom tests only.

- `FrappeNewFamilyRecord` (and so `SayrNewRecordPage`): the type picker is a `LinkInput` instead of a `Select`: typing
  searches the loaded types by their English or Arabic name or their name, a click opens the whole list, × clears it
  back to empty (no type: the form waits). The id `sf-family-type` and the label are unchanged.
- Changing or clearing the type warns only after the user has changed a field (`FormController.canUndo`); before, a new
  record counted as changed as soon as it opened, so every switch warned.
- Labels `searchTypes`, `noMatchingTypes`; messages `famSearchTypes`, `famNoMatchingTypes`.

## 0.7.0-dev.18 — "Not sure? Find the right type" on a new record

Additive. jsdom tests only.

- `@solvfast/ui/sayr` `SayrTypeFinder`: walks a Sayr decision tree (`sear_product.apis.routing.routing.decision_tree_walk`)
  in a dialog, one answer at a time, with Back and Start over. An outcome that is one of the types offered gets "Use this
  type", which picks it; an outcome in another registry, or a type not offered, shows a warning and the type stays empty;
  a walk error is shown as the server words it. Exports `WALK_TREE_METHOD`, `TreeStep`.
- `SayrNewRecordPage` `decisionTree`: the tree behind the "Not sure? Find the right type" link under the type picker;
  none, no link.
- `FrappeNewFamilyRecord` `typeHelp({ types, choose })`: content under the type picker (both layouts).
- Messages: the `tf…` block.

## 0.7.0-dev.17 — rowMeta can show single columns by default

Additive. jsdom tests only.

- `FrappeListView` / `useFrappeList` `rowMeta` object: a column set `true` (e.g. `{ assignees: true }`, Desk's assignee
  avatars) is shown by default; the others stay offered in the column manager, hidden. `false` still removes one;
  `true` (all shown) and the default (all offered, hidden) are unchanged. `rowMetaColumns` `hidden` also takes a
  per-column function.

## 0.7.0-dev.16 — Field cards show their control

Visual change in `FieldDesigner`. jsdom tests only.

- Each field's card draws its control under the label: a text box for text, a checkbox beside the label for a check, a
  toolbar and an area for an editor, a dropdown (its first choice) for a choice, a search box for a link, a drop zone for
  a file or image, a pad for a signature, a map for a location, a grid for a table, stars for a rating, a date or number
  box… The type's name stays at the card's end. Decorative only (`aria-hidden`, no focus): the card is what is selected
  and dragged.
- Core `FieldPreview` / `previewKind` (+ `FieldPreviewProps`): the preview for a Frappe fieldtype ("Check") or a Field
  Library type key ("checkbox"). Type icons now also follow Frappe fieldtypes.
- Messages: the `fp…` block.

## 0.7.0-dev.15 — Wizard mode decides the form's shape

Intentional visual change for hosts that pass `FieldDesigner`'s `wizard` / show family records. jsdom tests only.

- `FieldDesigner` with `wizard` offered and **off**: the form is one list — every tab's sections in order, no tab bar,
  no Add tab (Add section adds at the end). Turning wizard mode **off** removes the tabs added on the type (`own`,
  not `native`), so their fields join the step before, in the same order. **On**: the tabs are steps ("Step N ·",
  Add step, Step name, Remove step, a locked step's note), and a field dragged onto a step is highlighted there
  (`data-drop-target`) and moves to it. Hosts without `wizard` are unchanged.
- `FrappeNewFamilyRecord` `layout="record"`: a type without wizard mode is one form again (no tab bar); a wizard type
  walks its steps with Back / Next (unchanged).
- `SayrRecordPage` `oneForm`: every field in one form, no tab bar (for a type without wizard mode). Default unchanged:
  the DocType's tabs as the full-width bar.
- Messages: `fdStepName`, `fdRemoveStep`, `fdStepLocked`; `fdWizardHint` reworded.

## 0.7.0-dev.14 — SayrNewRecordPage: a new record laid out like the record page

Additive. jsdom tests only; the record page (dev.13) was checked on a real site.

- `@solvfast/ui/sayr`: `SayrNewRecordPage` — Back and Create on top, a header card (title, Not Saved, who and today)
  holding the type picker, the type's tabs as a full-width bar, and a rail that previews the chosen type through Sayr's
  `sear_product.apis.tickets.tickets.type_preview`: the lifecycle and its first status, the SLA policy with its targets
  per priority, the assignment profiles; Playbook, Tasks, Pinned Notes and Attachments say they come after the record is
  created. "Customize sections" as on the record page (same storage key). Exports `TYPE_PREVIEW_METHOD`, `TypePreviewData`.
- `FrappeNewFamilyRecord`: `layout: "record"`, `aside(type)`, `backLabel`, label `title` (default "New record").
- Core `RecordHeaderCard` (+ `RecordHeaderCardProps`, `RecordHeaderFact`): the record page's header card; SayrRecordPage
  now uses it.
- SayrRecordPage: Pinned Notes says "No notes yet" when empty; the next actions follow the server's list (no write gate);
  the header and cards are read again when the record's `modified` changes (a save or a toolbar workflow action).
- Messages: `rpNoNotes`, `rpChooseTypePreview`, `rpAfterCreate`, `rpStartsIn`, `rpStatusesCount`,
  `rpNoAssignmentProfile`, `rpPr…`; `famNewRecord`.

## 0.7.0-dev.13 — SayrRecordPage: a record opened as a page

Additive. jsdom tests only; checked on a real site (servefast-dev) before vendoring.

- `@solvfast/ui/sayr`: `SayrRecordPage` — header card (title, name, status, creator's name, created on, type chip),
  the record's own tabs as a full-width bar, and a rail: Lifecycle (current status, next actions that run
  `execute_transition`, "View full lifecycle" to the builder), Assignment, SLA (read only), Playbook, Tasks (scroll past
  five), Pinned Notes (comments), Attachments, Created by / Last edited by; "Customize sections" per DocType
  (localStorage). Reads `sear_product.apis.tickets.tickets.record_page` (needs Sayr with that endpoint). Also exports
  `RECORD_RAIL_CARDS`, `RECORD_PAGE_METHOD`, `TRANSITION_METHOD`, `defaultLifecycleHref`.
- `@solvfast/ui/frappe`: `useRefreshDoc()` — read a document and its docinfo again after an outside change.
- `FrappeFormView` / `FrappeForm`: `header` (shown under the toolbar instead of its title block), `toolbarStart`, and
  `tabBar: "record"` (full-width tabs).
- `LifecycleRail`: `onSelectNext` makes the next options buttons.
- `AssignDialog`: `threePriorities` (Low / Medium / High only, Medium preselected). `FrappeAssignTo`: `comment` (the
  dialog's Comment instead of the title field) and `threePriorities`.
- Messages: the `rp…` block.

## 0.7.0-dev.12 — Families: the field set picker is a searchable link field

jsdom tests only. Deploy a field set: the published sets are a `SearchCombobox` (description and field count under
each) instead of a list of cards. `INSPECTED_PROPERTIES` no longer lists `collapsible` (a Section Break's, not a field's).
Messages `fdChooseSetShort`, `fdSearchSets`, `fdNoMatchingSets`, `fdFieldsCount`; `fdOtherSet` removed.

## 0.7.0-dev.11 — Families: fields added on a type's form, one Save

jsdom tests only; no real-site run. **BREAKING** for `FieldDesigner` hosts: fields are removed from the properties
panel (no Remove button on the cards), the Add fields dialog is now the "Deploy a field set" panel, and
`context.wizard.onChange` no longer saves on its own.

**The Form section** — docs/components/family.md §7, §8, §11
- `FieldDesigner`: a canvas with a properties panel beside it. Add field (per column) from the adapter's field types,
  edited in the new `FieldInspector` with every property a field set's field has; Add section / Add tab (Add step);
  Deploy a field set in the panel. `onPendingChange` hands its changes to a host's Save (no Save form button then).
- New adapter methods (optional): `makeSection`, `fieldTypes`, `linkTargets`, `linkTargetFields`. `DesignerItem`
  gains `own` and `definition`. New core exports: `FieldInspector`, `INSPECTED_PROPERTIES`, `designerKeys`,
  `FieldDefinition`, `FieldTypeRegistry` (+ related types); `src/record` adds `keyFromLabel`, `deriveKey`, `ownKeys`,
  `retype`, `definitionProblem`.
- `@solvfast/ui/sayr`: the form's own fields live in the deployment's `own_fields` (needs Sayr with that table);
  rows are anchored by tokens (`@own::<key>`, `@section::<label>` added); `definitionOfRow` / `rowOfDefinition`.
- `FrappeTypeForm`: `context.onPendingChange`; Wizard mode is set on the type and saved with it.
- `FrappeFormView` / `FrappeForm`: `alsoSave: { dirty, save }` — outside changes that count as unsaved and are
  saved after the document (alone when only they changed).
- Messages: the `fd…` block rewritten; new `fi…` block (the inspector).

## 0.7.0-dev.10 — Families: the Appearance section

Additive. jsdom tests only; no real-site run.

- Core `IconColorPicker` (+ `APPEARANCE_ICONS`, `APPEARANCE_ICON_NAMES`, `APPEARANCE_COLORS`): Sayr Studio's icon +
  colour picker with a preview; icons imported by name. Messages `icIcon`, `icColor`, `icNoIcon`, `icNoIconSelected`,
  `icPreview`.
- `FrappeTypeForm` draws the icon field with it (`appearancePicker`, default on); the colour field and
  `appearance_column` leave the form.
- `FrappeFormView` / `FrappeForm` `renderField(df, {value, doc, setValue})`.

## 0.7.0-dev.9 — Families: Wizard mode and a new type's defaults

Additive. jsdom tests only; no real-site run.

**Wizard mode** — docs/components/family.md §9
- `FamilyType.wizard` (registry `wizardField`, default `wizard_mode`); `FrappeNewFamilyRecord` walks a wizard type's tabs
  as steps (`Stepper`, Back / Next, Create on the last step).
- `FrappeTypeForm` `designer(typeDoctype, context)`: `context.wizard = { on, onChange }`, saved with
  `frappe.client.set_value`; the field is kept off the type's form. `FieldDesigner` `wizard` prop: the switch, and tabs
  labelled "Step N · …". Messages `famBack`, `famNext`, `famSteps`, `fdWizard`, `fdWizardHint`, `fdStep`.
- `FrappeFormView` / `FrappeForm`: `activeTab`, `hideTabBar`, `onTabsChange`.

**A new type's defaults**
- `FrappeTypeForm` `defaults`: values a new type starts with (through `newDocDefaults.routeOptions`).

## 0.7.0-dev.8 — Families: the family screens, a type's Form section and @solvfast/ui/sayr

Additive: nothing changes for a consumer that does not use the new components. jsdom tests only; no real-site run.

**Families** (Sayr's inheritance: a parent, a type registry, one DocType per type) — docs/components/family.md
- Core `FamilyTabs`: the Records | Types tabs above a family's pages; `records={false}` shows Types alone.
- Frappe `FrappeNewFamilyRecord`: the type first (enabled types with a DocType, both names), then that type's form in one
  list (Tab Breaks left out), Cancel / Create; changing the type after filling fields asks first.
- Frappe `FrappeFamilyRecord`: a record opened from its parent row, in its type's DocType.
- Frappe `FrappeTypeForm`: the registry's form, Configuration (Linked Lifecycle, SLA Policy, Assignment Profile) shown
  by default or hidden with `configuration={false}`; a `designer` slot under a saved type.
- `FamilyDescriptor` (field names per family, Sayr's by default), `useFamilyTypes`, `useFamilyRecord`,
  `fetchFamilyTypes`, `fetchFamilyRecord`, `SAYR_CONFIGURATION_FIELDS`. Stock methods only (`getdoctype`, `get_list`).
- Messages `famRecords` … `famNotFound` (en + ar).

**A type's Form section** (placement only) — docs/components/family.md §7–8
- Core `FieldDesigner` over a `FieldDesignerAdapter`: tabs → sections → columns; standard fields locked, shared ones
  movable, a field set's fields movable and removable; Add fields (from a published set, as a new section or into one),
  Add tab, remove an added section or tab; moves by drag or by the up / down buttons (keyboard); Save form asks before
  removing fields that hold values and before withdrawing every added field. Layout model ported from Sayr's Field Library
  canvas (`toLayout`, `fromLayout`, `moveItem`, `stepItem`, `insertSectionAfter`, `appendTab`, `removeSection`,
  `removeTab`, `previousId`, `kindOfFieldtype`). Messages `fdTitle` … `fdRecords` (en + ar).
- **New entry `@solvfast/ui/sayr`** — the only one that calls Sayr's own methods: `SayrFieldDesigner`,
  `createSayrFieldDesignerAdapter` (Sayr's `doctype_deployment`, `Sear Field Deployment` save, `save_field_order`,
  `withdraw_deployment`, `deployment_removal_impact`), `sayrToken`. `check-boundaries` keeps core, `./frappe` and the
  other entries from reaching it.

## 0.7.0 — Sayr's Appearance and First Day of the Week

Stable package release. Additive, plus the group-by sidebar compatibility fixes under **Fixes** below (they change
what `FrappeGroupBySidebar` and `useGroupByCounts` do with numeric server values); apart from those, nothing changes
for a consumer that does not pass the new props. Ported from Sayr (sear_product), where these pieces lived in the app;
Sayr and ServeFast now take them from the package. Automated package tests and builds passed; no authenticated
real-site validation has been performed.

**Brand colours** (Sayr: System Settings › Appearance)
- New `applyBrandTheme(brand, isDark, defaults?)`, `brandTokens`, `hexToHsl`, `DEFAULT_BRAND_COLORS` and the
  `<BrandTheme brand />` component. The primary sets `--primary`, `--ring`, `--brand-violet`, `--primary-foreground`,
  `--btn-primary-bg` / `-fg`; the secondary `--brand-sky`, `--brand-cyan`, inline on `<html>`. At the default colours
  nothing is set. In dark mode a dark primary is lifted to 60% lightness with dark text on it. Needs the
  ThemeProvider's default `scope="document"`.

**Workspace background**
- New `WorkspaceBackground` type, `colorBackground`, `imageLayerStyle`, `imageOverlayStyle`, `isImageBackground`,
  `BACKGROUND_PRESETS`, `presetBackground`, `DEFAULT_WORKSPACE_BACKGROUND`, `BACKGROUND_INTENSITY_CAP` (35),
  `BACKGROUND_MAX_COLORS` (6) and `<WorkspaceBackdrop bg isDark? base? />`. A photo's URL is quoted, so file names with
  spaces or brackets (Frappe's `logo (3).png`) work.
- `AppShell` `background`: the backdrop behind the sidebar and pages, in the shell's own stacking context (`relative
  isolate`, backdrop `-z-10`): over the shell's background and the dark aurora, under everything else.

**Header**
- New `UserMenu` (`ShellUser`: `name`, `fullName`, `image?`, `onProfile`, `onLogout`) and `userInitials`: the photo or
  Frappe's initials; the menu shows the name and email, My Profile and Log out (en/ar strings `account`, `myProfile`,
  `logOut`).
- New `CompanyLogo` (`src`, `darkSrc?`, `alt?`).
- `Navbar` / `AppShell` `companyLogo` (before the title, desktop only; optional `onClick`) and `user` (last in the bar).

**First Day of the Week**
- `FormatContext.firstDayOfWeek` (0 Sunday … 6 Saturday), read by `formatContextFromBoot` from
  `sysdefaults.first_day_of_the_week`.
- `DateField` / `DateTimeField` `weekStartsOn`; `FrappeField` Date and Datetime pass the FormatContext's. Unset: the
  calendar locale's (Saturday in Arabic, Sunday in English), as before.

**Fixes** (`FrappeGroupBySidebar`; Frappe's `get_group_by_count` sends Check and Int values as JSON numbers)
- `useGroupByCounts` now matches its `GroupByCount.name: string | null` type: a numeric `name` becomes its decimal
  string (`0` → `"0"`). Strings, null and `count` are passed as sent. An app that read the numbers from the hook gets
  strings now.
- Check: `0` / `"0"` / `false` show No, anything else Yes (Desk's `name == "0"`, list_sidebar_group_by.js:223); a click
  filters `= 0` / `= 1`; a filter-builder Check filter (`"true"` / `"false"`) shows as applied and is removed on click.
  Before, a numeric value showed Yes for both and a click sent no request.
- Int: a numeric value filters `= n`, shows as applied when the filter builder set it, and works with the section
  search. Before, a click threw (`value.trim`) and unmounted the list, and the search threw.
- String values (and every other field) behave as before. The server's number shape was checked with a read-only
  server-side call on a local Frappe 15.109 bench; the hook and sidebar flows are jsdom tests (stubbed / SIMULATED).

## 0.7.0-dev.6 — P36e FrappeField trace, field types, FrappeField without a server, Frappe-like print, docstatus, Lifecycle rail

P36e follows up on the P36d Lead Details audit. Evidence comes from jsdom tests, the in-package SIMULATOR and Playwright
runs on local CRM builds (mock data and simulated builds). **Nothing was validated on a real Frappe site**: the 96
prepared real-site tests are still Pending.

**FrappeField without a Frappe server**
- New `FrappeLocalForm`, `createLocalFormServices`, `localSearchLink` / `localValidateLink` / `localLinkTitle`,
  `createNoServerClient` / `noServerClient`, `localModeError` and `useFormCapabilities` (`SERVER_CAPABILITIES` /
  `LOCAL_CAPABILITIES`).
- `FrappeField` / `FrappeLinkField` / Dynamic Link run with no server. Link search, validate_link and get_link_title run
  locally over rows the host supplies (desk/search.py, client.py semantics).
- The client refuses every server call with a non-retried `LocalModeError`. Nothing reaches the network; tests assert
  it.
- `useFormCapabilities()` reports what local mode cannot do: permissions, custom queries, Create New, uploads and
  server save validation.

**Field types** (`docs/audit/p36d/FIELD-TYPES.md`: 43 DocField types now **16 Complete · 27 Partial · 0 Missing**)
- Source trace and re-grade (`docs/audit/p36d/FRAPPEFIELD-TRACE.md`): locations, call chains, public API and FrappeField
  without a provider. The 43 types were re-graded against `controls/*.js`, from 22 / 17 / 4 to 15 / 24 / 4 before the
  new controls. The showcase data now matches the table, with a drift-guard test.
- New Core `SignatureInput`: canvas → PNG data URL, as jSignature stores it. FrappeField Signature fields use it.
  **Complete.**
- New Core `IconInput` and Frappe `FrappeIconField`: a picker over Desk's icon names, with glyphs where the page carries
  Desk's sprite. **Partial.**
- New Core `BarcodeInput` with `sanitizeSvg`: shows a stored JsBarcode SVG (sanitised) and clears it. Generating a
  barcode needs `jsbarcode` (not included; owner decision). **Partial.**
- New Core `GeolocationInput` with `parseGeolocation`: a read-only list of GeoJSON features. Drawing needs Leaflet +
  Leaflet.draw (not included; owner decision). **Partial.**
- Signature, Icon, Barcode and Geolocation are no longer reported as unsupported. New `PARTIAL_FIELDTYPES`.

**Print**
- New Frappe-free Core components:
  - `PrintView` / `PrintViewDialog`: Desk's print page;
  - `PrintDocumentsDialog`: Desk's list "Print Documents";
  - `composePrintDocument` + `printHtmlDocument`: one HTML document, one record per page, `@page` size in mm for every
    Desk size and Custom, dir / lang, a no-script CSP, printed through a hidden iframe.
- `PrintPreviewFrame` gains `srcDoc`.
- `FrappeFormPrint` and `FrappePrintDialog` render the Core components, with unchanged behaviour. `FrappeFormPrint` gains
  `variant="page"` with `onBack`.
- `PRINT_PAGE_SIZES`, `NO_LETTERHEAD` and `MAX_PRINT_LIMIT` now live in Core and are still exported from
  `@solvfast/ui/frappe`.

**Docstatus (submittable DocTypes, lifecycle-driven)**
- New Core module `src/record/docstatus.ts`: Frappe's docstatus rules as pure functions. Messages are in
  `messages-ws/submit.ts` (en / ar).
  - Rules covered: check_docstatus_transition, the apply_workflow docstatus step, validate_docstatus, mandatory checks,
    update after submit, delete and linked-delete, amend names.
  - For hosts without a server (the CRM's submittable Proposals).
- Changed: the `FrappeListView` indicator pill takes Desk's docstatus description as its title on submittable DocTypes.
  Visible wherever the package is updated.
- Fixed: `FrappeForm` Amend under a workflow starts in the docstatus-0 default state, as Desk's `set_default_state` does.
  This affects every workflow DocType's Amend.
- New SIMULATED `withSubmitRules(transport)`:
  - update after submit is enforced on savedocs, save, set_value and bulk update;
  - a new document gets the first workflow state on save;
  - `delete_items` deletes item by item.

**Simulator** (SIMULATED)
- The fixture transport's save runs Frappe's `_validate_data_fields` (Data options Email / Name / Phone / URL / IBAN),
  `_validate_non_negative` and `_validate_length`, in document.py:624-646 order.
- Messages and exception types are verbatim.
- Not reproduced: the Phone fieldtype's `phonenumbers` check.

**Tests:** `trace-p36e` (P36E.trace.*), `ftypes-p36e` (P36E.ftypes.1-19), `mock-p36e` (P36E.mock.1-10),
`print-p36e` (P36E.print.1-11), `sim-validate-p36e` (P36E.sim.1-9), `submit-p36e` (P36E.submit.1-17).

**Lifecycle — one shared rail + diagram look for CRM and Tickets** (another session's `feat/0.7.x/lifecycle-ds`, 954b084; first
shipped to the CRM inside the vendored `0.7.0-dev.5-954b084` tarball, published here)

**Added (core entry, Frappe-free)**
- `LifecycleRail` — the record lifecycle card: past states, the current state, what can happen next (one dashed row, or a
  box of options with back-moves tagged; optional `disabled` options), End of lifecycle, View full lifecycle. View model
  props only (`path`, `next`, `ended`, `onViewAll`, `labels`).
- `LifecycleDiagramDialog`, `LifecycleStateCard`, `LifecycleEdgeLabel`, `LifecycleDiagramLegend`, `LIFECYCLE_DIAGRAM_COLORS`
  — the full-lifecycle diagram look; the consumer keeps its graph engine (React Flow + dagre in the CRM) and layout.
- `LifecycleStepDot` — the shared dot atom. `lc*` chrome strings (en / ar).

**Changed (intentional visual change)**
- `LifecycleBar`: past steps and their connectors are `success` (were `primary`); the current label is `primary`;
  connectors to unreached steps are dashed. API and `data-step` markup unchanged.

Tests: `tests/lifecycle.test.tsx`. Docs: `docs/components/record.md` §9. Showcase: Record status, lifecycle & feed.

## 0.7.0-dev.5 (unreleased) — P36d CRM Lead Details audit + Frappe field parity

P36d: the CRM Lead Details page was audited as the first reference page for DS / Frappe parity. Evidence is jsdom tests,
the in-package SIMULATOR and Playwright runs on local mock-data CRM builds. Nothing was validated on a real Frappe site.

**Changed defaults (owner decisions)**
- **LinkInput** (owner decision, P36c item 7). Three behaviours are now the default in every mode; before, they were
  picker mode only:
  - the highlighted row is scrolled into view;
  - keys pressed during an IME composition (`isComposing` / keyCode 229) belong to the IME;
  - Escape restores the previously shown value.

  Two consequences:
  - `SuggestionList` (used by LinkInput and TagInput) ignores the Escape that ends an IME composition.
  - This differs from Desk, whose Link only closes the list on Escape. Typing, the arrows, Enter, the blur commit and
    picker mode are unchanged.

  Tests: `tests/linkinput-p36d.test.tsx` (P36D.linkinput.1-9).
- **Focus colour**:
  - Inside `.sf-theme`, the glass focus token `--c-focus` is the theme ring (violet in light, flame in dark). It used to
    be Sky cyan (#25D0FE).
  - DateField, TimeField, DateTimeField, MonthInput and EditableTitle show one focus ring instead of a ring stacked on a
    browser outline.
  - CRM Lead page audit: 223 of 490 focus stops were cyan before, 0 after.
  - Tests: `tests/visual-p36d.test.tsx` (P36D.visual.1-7).

**Frappe field parity (`FrappeField` / `FrappeLinkField`)**
- Data fields with options Email / Phone / Name / URL:
  - validate with Frappe's own patterns (`utils.js` validate_type), using `split_emails` for e-mail addresses;
  - the input is always `type="text" autocomplete="off"`, as in Desk (`data.js`);
  - new `splitEmails` export.
- Desk's maxlength (`df.length || 140`) applies to Link and Dynamic Link, with the "Data Clipped" paste message.
  Numeric inputs select their text on focus. Placeholders are translated and reach Link and Text inputs.
- Link titles of `show_title_field_in_link` targets are fetched with `frappe.desk.search.get_link_title` (new optional
  `FormServices.getLinkTitle`), with a SIMULATED handler.
- `LinkInput` has typed `maxLength` and `onPaste` props.
- Tests: `tests/fields-p36d.test.tsx` (P36D.fields.1-11).

**Record Detail history (`Timeline` / `FrappeTimeline`)**
- Timeline wording, avatars and links:
  - Desk relative times (`timeFormat: "desk"`) and author avatars (`showAvatars`);
  - Copy Link;
  - the absolute date follows the app language.
- Communications as cards, with delivery status and attachments. Automated messages read "Notification sent to …".
- Version lines: "via …", "Impersonated by" and "[Action taken by]". `additional_timeline_content` entries that carry
  content are shown.
- Error, Published and edit-box behaviour:
  - a failed load shows `FrappeErrorState` with Retry;
  - the Published marker always shows;
  - the edit box always says Save.
- See `docs/components/record.md` §7. Tests: `tests/history-p36d.test.tsx` (P36D.history.1-15).

**Frappe Field Types foundation**
- `docs/audit/p36d/FIELD-TYPES.md`: the Frappe 15.110 inventory.
  - Scope: 43 DocField types, Long Int, Page Break and the 6 Data options.
  - For each: the native control, formatter and server validation with file:line, and DS coverage (22 complete,
    17 partial, 4 missing: Signature, Barcode, Geolocation, Icon).
  - The Core / Frappe / CRM strategy and a phased plan.
- `docs/components/frappe-field-types.md`: the consumer guide.
- Showcase: a new **Frappe Field Types** group with four pages: Inventory, Inspect a field type, Links & files
  (SIMULATED), and Layout & display types.
- Tests: `tests/fieldtypes-p36d.test.tsx` (P36D.fieldtypes.1-16).

**Audit records:** `docs/audit/p36d/` (README, LEAD-FIELDS, FIELD-TYPES).

## 0.7.0-dev.4 (unreleased) — P36 owner decisions

P36c — the owner's final decisions on the batch-2 open items: LinkInput picker keyboard reviewed against Desk, a small
phone-header title gain, the Report view's de-duplication kept and pinned by tests, Commission & Referral not migrated,
**Image view Actions** and **Assign To User Group** implemented. `package.json` `version` is `0.7.0-dev.4` (not tagged, not
published). Coverage of the fixed P35 list is unchanged (**258 / 301**; `docs/audit/p35/COVERAGE.md` §11). **No real-site
validation:** evidence is jsdom unit tests and the in-package simulator. Index: `docs/audit/p36c/README.md` (repository
only).

Owner decisions (final): (1) LinkInput picker: review every difference against Desk, keep native keyboard behaviour,
document the intentional differences; (2) the 390 px header is acceptable, take a small title-space gain without a
redesign; (3) the Report view keeps its per-document de-duplication (intended deviation) with regression tests for every
name-taking action; (4) CRM Commission & Referral is **not** migrated (every-row editing, no card layout, horizontal
scroll kept); (5) the Image view gets Desk's Actions; (6) Assign To User Group is added. Item 7 of the owner's message was
cut off: the LinkInput **default-mode** candidates are unchanged, pending the owner.

### Added
- **Image view Actions (`@solvfast/ui/frappe`)** — `FrappeImageView` `bulk?: FrappeBulkOptions` gives the checked cards
  Desk's Actions menu, as Desk's Image view inherits it from the List view (image_view.js:6, :17-21, :113): Edit, Export,
  Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete and the workflow's actions,
  with the List view's permission gates and selection outcomes through the shared `useFrappeSelectionActions`. "Add
  {DocType}" (the host's `primaryAction`) gives way to Actions while cards are checked. `FrappeViews` `bulk` now reaches
  the Image view too (`image.bulk` overrides). Opt-in, as in the List / Report views.
- **Core `ImageView`** (additive) gains the List view's selection props — `primaryAction`, `bulkActions`,
  `renderBulkActions`, `selectionMode`, `renderActionsMenu`, `onActionsOpenChange`, `actionsLabel` — and, with any of them,
  the Add ↔ Actions swap and a selection strip (select-all on the page, "{n} items selected", Clear). A plain `selectable`
  `ImageView` is unchanged.
- **Assign To User Group** — Core `AssignDialog` `groups?: AssignGroupSource` (`search`, `members`, `label`, `placeholder`,
  `debounceMs`; hidden with `single`) and `uniqueMembers`; Frappe `FrappeAssignTo layout="sidebar"` `userGroups` (Add to
  ToDo) and `FrappeBulkOptions.userGroups` (the list / report Actions → Assign To dialog), both **default on**, and the
  helpers `userGroupSource`, `getUserGroupMembers`, `searchUserGroups`, `userGroupMembersArgs`, `USER_GROUP_DOCTYPE`,
  `USER_GROUP_MEMBER_DOCTYPE`, `USER_GROUP_MEMBERS_FIELD`, `USER_GROUP_MEMBERS_METHOD`, `USER_GROUP_MEMBERS_LIMIT`. As
  Desk (assign_to.js:142-160): picking a group **replaces** the users to assign with its members and unticks Assign to me;
  the members are read with `frappe.desk.reportview.get_list` on User Group Member (`parent_doctype: "User Group"`,
  `limit: 20` — Desk's `frappe.db.get_list` default, so a group expands to its first 20 members). Empty group → list
  emptied, Add disabled; a refused read shows the server message under the field. The `assign_to.add` / `add_multiple`
  payloads are unchanged (only the `assign_to` list changes). The opt-in bar's `AssignPicker` popover has no group field.
- **Messages** (en + ar): `sbAssignGroup`, `sbAssignGroupSearch`, `sbAssignGroupEmpty`, `sbAssignGroupMembers`.
- **Simulator (SIMULATED)** — `withSimulatedSidebar` answers `frappe.desk.reportview.get_list` on a child DocType with
  `parent_doctype` (Frappe's has_child_permission: a valid parent with a table of the child, then read on the parent;
  `limit` / `start` / `fields`), recorded in `store.calls`.

### Changed (behaviour visible to 0.7.0-dev.3 consumers)
1. **`Navbar` on phones — a default change for every `Navbar` / `AppShell` consumer.** Below `md` the header uses 12 px
   inline padding (was 16 px) and 2 px between its icon buttons (was 4 px). The page title gets 18 px more at every phone
   width (CRM: 106 → 124 px at 390 px, 76 → 94 px at 360 px; truncated CRM titles 68 → 48 per theme over 27 routes × en /
   ar × 390 / 360). Buttons stay 32 × 32 (`icon-sm`), the search trigger keeps its accessible name and Ctrl/⌘+G; desktop
   (≥ `md`) is unchanged. No opt-out prop.
2. **LinkInput picker mode keyboard** (`openOnClickWhenFilled`, opt-in): a plain **Space** on a filled, closed box with
   nothing typed opens the full list instead of appending a space (Desk's Select is a native `<select>`); Space still
   types once the list is open, while typing, on an empty box, with a modifier or during IME composition, and never in the
   default mode. **Every keyboard open (Enter / ArrowDown / Space) selects the shown text**, as a click does (see Fixed).
   No prop or API change; the default mode (`FrappeLinkField`) is unchanged.
3. **Assign To dialogs show a group field by default:** `FrappeAssignTo layout="sidebar"` (`userGroups={false}` opts out)
   and the Actions → Assign To dialog of `FrappeListView` / `FrappeReportView` (`bulk={{ userGroups: false }}` opts out).
4. **Simulator ships Frappe's User Group and User Group Member metas by default** (`createFixtureTransport`,
   `BUILTIN_FIXTURE_META`; integrator `44bff60`), so the group field works on every simulated site. A consumer test that
   counted the built-in metas, or expected "DocType User Group not found", sees them.
5. `useFrappeBulkActions` follows the DocType meta once it loads: bulk **Edit** opens on the first editable field (see
   Fixed).

### Fixed
- **Bulk Edit in the Report and Image views opened an empty field picker** (integrator `44bff60`): `useFrappeBulkActions`
  chose its field while the view's DocType meta was still the empty placeholder. It now follows the meta once it arrives.
  Regression test `P36C.views.32` (fails without the fix).
- **LinkInput picker mode, keyboard reopen:** after a keyboard pick the caret sat after the label, so Enter / ArrowDown
  reopened with the text unselected and typing appended to it ("Enterprise dealsSMB", 0 rows). Every keyboard open now
  selects the shown text (`P36C.linkinput.9`; default mode unchanged, `.10`).

### Deviations from Desk (each deliberate; details in `docs/audit/p36c/README.md` §3)
- **LinkInput picker mode** (opt-in; supersedes the 0.7.0-dev.3 LinkInput entry): opens the full list on a filled box (click / tap / Enter / ArrowDown / Space; Desk's
  Link never does, link.js:35-41), selects the shown text, marks the current value (`aria-selected`), Escape restores the
  shown value, Home / End move in the open list, `keepValueWhenEmptied`. **Reviewed and no longer differences:** arrows
  wrap (= Awesomplete), no Ctrl+N / Ctrl+P (cmdk's `vimBindings`; not Desk keys), height = the DS field height, 36 px (the
  4 px came from the old CRM picker, a 40 px `Button`).
- **Image view Actions:** a selection strip (select-all on the page, count, Clear) that Desk's Image view lacks (its header
  is commented out, image_view.js:161-177); the card checkbox stays on phones (Desk `hidden-xs`); the rows request
  `docstatus`, so **Print works** on submittable DocTypes (Desk's image rows carry none and its Print check refuses every
  card for non-Administrators); no shift-click range select; `bulk` is opt-in.
- **Report view** keeps sending a document shown on several rows **once** (owner decision 3), now pinned for every
  name-taking action: Submit, Cancel, Delete, Edit, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print,
  Export, Workflow (`P36C.views.20–31`).
- **Assign To User Group:** a repeated member row is listed and sent once (Desk sends it twice and the server answers
  "Already in … ToDo list"); a status / "has no members" line under the field; a refusal is shown under the field and keeps
  the list (Desk: modal msgprint); a known full name replaces the user id in the pill; a refused members read keeps the
  list (Desk unticks Assign to me first, which empties the list when it was ticked). The owner's brief said "merge"; Desk **replaces**, and
  the package follows Desk.
- **Phone header:** DS chrome with no Desk equivalent (Desk keeps its 300 px search bar on phones).

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written. Evidence: `tests/views-p36c.test.tsx`
  (27), `tests/usergroup-p36c.test.tsx` (14), `tests/linkinput-p36c.test.tsx` (10), `tests/header-p36c.test.tsx` (3) — jsdom
  + the simulator. LinkInput and the header were also measured in Chromium on local static builds (showcase; CRM in mock
  mode) — not a Frappe site.
- Coverage of the fixed list is unchanged (**258 / 301**); 8 rows gained evidence (LV.F1, LV.F3, LV.F8, LV.F9, LV.F12,
  LV.F14, LV.H1, LV.H5) — `docs/audit/p35/COVERAGE.md` §11.
- Real-site validation stays **prepared, not run**: the catalogue gained 3 P36c tests (now **94**: 80 API, 7 browser,
  7 manual) — V-IMAGE-2, F-SB-ASSIGN-2 (needs the `sysmgr` account), V-REPORT-3 (`docs/audit/p36/VALIDATION-MATRIX.md` §5).
  LinkInput and the Navbar are client-only. Every real-site result is BLOCKED.
- Integration gates at this docs commit: `npx vitest run` — 85 files, 1678 passed, 10 todo, 0 failed (0.7.0-dev.3: 81 files, 1624); `node e2e/frappe-site/matrix/render.mjs --check` current;
  `tests/frappe-site-guards.test.ts` 23 passed. Integrator gates (typecheck, boundaries, build, CRM regression):
  `docs/audit/p36c/README.md` "Integrator gate results".

## 0.7.0-dev.3 (unreleased) — P36 batch 2

P36 batch 2 (P36b) — owner-requested features: LinkInput picker mode, Submit / Cancel in the Report view, Frappe Global
Search, the Form Sidebar (Assign, Attach, Tags) and its Share / Like / Comments parts; mid-batch, Desk's **Attach / Attach
Image** control and the **Workflow → Lifecycle** label in the design system's chrome. `package.json` `version` is
`0.7.0-dev.3` (not tagged, not published). Coverage of the fixed P35 list is unchanged (**258 / 301**); the batch-2 features
without a requirement row are recorded outside the denominator (`docs/audit/p35/COVERAGE.md` §9–§10). **No real-site
validation:** every new server path is simulator-only. Index: `docs/audit/p36b/README.md` (repository only).

### Added
- **LinkInput picker mode (Core, opt-in)** — for Link pickers over a known list: `openOnClickWhenFilled` (click / tap /
  Enter / ArrowDown opens the FULL list on a filled box, the shown text selected; Escape closes and restores the shown
  value; Home / End move in the open list; decorative chevron), `selectedIndicator` + `selectedValue` (check mark and
  `aria-selected` on the current value, the highlight via `aria-activedescendant`; `selectedValue` marks a "None" row),
  `keepValueWhenEmptied`, `emptyText`, `searchPlaceholder`. Defaults unchanged, so `FrappeLinkField` is unchanged.
- **Report view Submit / Cancel (`@solvfast/ui/frappe`)** — `FrappeReportView` `bulk?: FrappeBulkOptions` gives the
  checked rows Desk's whole Actions menu, as the Report view inherits it from the List view (report_view.js:9, 360,
  371-374): Edit, Export, Assign, Tags, Print, **Submit** (submittable + submit right + no active Workflow), **Cancel**
  (cancel right + no active Workflow), Delete, workflow actions. `FrappeViews` `bulk` forwards it to the List and Report
  views (`list.bulk` / `report.bulk` override per view). New `useFrappeSelectionActions` (the selection → Actions wiring
  shared by `FrappeListView` and `FrappeReportView`) and `uniqueNames`.
- **Global Search** — Core `GlobalSearchBar` / `GlobalSearchDialog` (Desk's awesome bar and Global Search dialog:
  Ctrl/⌘+G, 100 ms / 300 ms debounce, index-ranked rows, "Search for …", grouped results with All Results (4 + More) and
  per-group paging (20 + More), loading / empty / error + Retry, keyboard, RTL; phones get an icon + full-screen dialog),
  types `GlobalSearchSource`, `SearchItem`, `SearchResultGroup`; `Navbar` `search={{ slot }}` (`NavbarSearchSlot`, rendered
  at every width). Frappe adapter `useFrappeGlobalSearch` / `createFrappeSearchSource` over
  `frappe.utils.global_search.search` (`{text, start, limit, doctype}`) and Desk's boot lists (`DeskSearchBoot`,
  `deskSearchBootFrom`, Desk's fuzzy ranking `fuzzySearch`), routing through `onNavigate(url, info)`.
- **Form Sidebar** — Core `FormSidebar`, `SidebarSection`, `AttachmentList`, `AttachDialog`, `TagList`
  (`FORM_SIDEBAR_SECTIONS`); Frappe `FrappeFormSidebar` (Desk's order: Assigned To, Attachments, Tags, Share,
  likes · comments, last edited / created; Share / Likes / comment count / Comments render by default, a host node or
  `null` replaces each), `FrappeAttachments` (upload, Library, Link, remove, `max_attachments`, `protect_attached_files`),
  `FrappeDocTags`, `FrappeAssignTo layout="sidebar"` (+ `allowComplete`, `bundle`), `useFormSidebarActions`, and the
  `attachments.ts` / `tags.ts` helpers. All sections read the one shared docinfo query (`useRecordDocInfo`).
- **Share / Likes / Comments** — Core `ShareDialog`, `SharedAvatars`, `LikedBy` (`SHARE_RIGHTS`); Frappe
  `FrappeSidebarShare` (`frappe.share.get_users / add / set_permission`), `FrappeSidebarLikes`
  (`frappe.desk.like.toggle_like`, reads `doc._liked_by`), `FrappeComments` (`variant="list" | "count"`; add, edit, delete,
  publish, @mentions; `focusCommentBox`) and the `share.ts` / `like.ts` / `comments.ts` helpers; Core `Timeline`
  `onTogglePublish` / `canPublish` / `isPublished` (+ labels); `FrappeTimeline` `allowPublish` (default off). Never
  optimistic: the UI changes only after the server answered.
- **Attach / Attach Image (mid-batch, `@solvfast/ui/frappe`)** — `FrappeAttachField` reproduces Desk's control
  (attach.js, attach_image.js, FileUploader.vue): "Attach" opens the uploader dialog (My Device / Library / Link / Camera;
  per file a thumbnail, Private + Desk's public-file warning, Optimize, Crop), `image/*` for Attach Image (drop too), the
  site's `max_file_size` read on every opening (a file of that size or more is skipped); uploads carry `fieldname` and
  `folder` "Home"; "Clear" asks, then (in a form) removes the File with `remove_attach` and saves; "Reload File"; the image
  preview is Desk's 150 px popover (hover and focus). New: `FrappeAttachHost` / `useAttachHost` / `attachSaveAction`
  (the form an Attach control saves — `FrappeFormView` provides it), `useFrappeAttach`, `attachUploadOptions`,
  `fileIdForUrl`, `MAX_FILE_SIZE_METHOD`, `ATTACH_FIELD_FOLDER`; `FrappeFormImage` (the form header image's Change →
  Upload / Remove menu for users who can write, on saved documents, unless the image field is read-only);
  `FrappeFormView` `attachHost?: boolean` (default true).
- **Core (mid-batch)** — `AttachInput` + `parseAttachValue` (Desk's Attach button / attached-file row); `ImageCropper`
  (`initialCropBox`, `clampCropBox`, `CropBox`; dependency-free, ratios 1:1 / 4:3 / 16:9 / Free, keyboard); `CameraCapture`
  (`cameraSupported`, `captureFileName`, `dataUrlToFile`). `AttachDialog` (additive): `onUpload(file, isPrivate,
  { optimize })`, `allowOptimize` (default false; per image on above 200 KB, never SVG), `allowCrop`, `cropAspectRatio`,
  `allowCamera`, thumbnails, the public-file warning, the drop zone hides once `maxFiles` files are listed.
- `createFrappeClient().uploadFile`: `UploadFileOptions.optimize` / `maxWidth` / `maxHeight` → multipart `optimize`,
  `max_width`, `max_height` (handler.py:229-235). `UploadAttachmentVars.optimize` (`useFormSidebarActions`).
- Additive props: `TagInput` `exclude`, `autoFocus`; `AssigneeGroup` `hideHeading`, `onComplete`, `canComplete`;
  `AssignDialog` `defaultDetails`.
- **Messages** (en + ar): `listBulkCannotSubmit` "Cannot submit {names}.", `listBulkCannotCancel` "Cannot cancel {names}.",
  the search / sidebar / social chrome strings (`src/theme/messages-ws/{search,sidebar,social}.ts`), and the Attach strings
  `formAttachReload`, `formAttachErrors`, `formAttachPreview`, `formImageChange` / `formImageUpload` / `formImageRemove` and
  the uploader's `formUp*` keys (`messages-ws/form.ts`).
- **Simulator (`@solvfast/ui/frappe/testing`, SIMULATED)** — built-in handlers for `frappe.utils.global_search.search`
  (DocType-level read filter, Global Search Settings order), `upload_file` (JSON `library_file_name` / `file_url`),
  `frappe.desk.form.utils.remove_attach`, `tag.add_tag` / `remove_tag` / `get_tags`,
  `frappe.core.api.file.get_files_by_search_text`, `frappe.share.get_users` / `add` / `set_permission`,
  `update_comment_publicity`, and an `add_comment` that records Mention notifications. New exports: `withSimulatedSidebar`
  (docinfo attachments / tags + attachment uploads), `bulkUpdateHandler` (opt-in: the form path + submitted back links),
  `bulkDemoBackend`. Mid-batch: `frappe.core.api.file.get_max_file_size` (System Settings → conf → 25 MiB, core/api/file.py:86-91)
  and a `savedocs` that relinks Files uploaded against a `new-…` name (relink_mismatched_files, file/utils.py:377-419).

### Changed (behaviour visible to 0.7.0-dev.2 consumers)
1. **Bulk Submit / Cancel failure wording** (`FrappeBulkActions`, List and Report views): the outcome line now adds Desk's
   sentence "Cannot submit {names}." / "Cannot cancel {names}." (bulk_operations.js:286-298). Desk shows it in an error
   dialog and does not refresh; the package keeps its status line, keeps the selection and reloads (P36 rule).
2. **Report view de-duplicates names (documented deviation from Desk).** With `bulk`, a document shown on several Report
   rows (one per child-table row) is sent once and counted once in the confirmation. Desk sends one name per checked row
   (report_view.js:1339-1352) and the server then reports the second copy as failed.
3. `FrappeListView` builds its selection actions through `useFrappeSelectionActions` (extracted unchanged; no behaviour
   change).
4. `FrappeTimeline` wraps its comment composer in `<div data-sf-comment-box>` (the sidebar comment counter focuses it) —
   a DOM change only.
5. **Simulator fidelity changes that can affect consumers' own tests** (`createFixtureTransport`):
   - `submit_cancel_or_update_docs` follows bulk_update.py:51-114: Submit takes drafts only (submitting an already
     submitted document is now reported as **failed**, before it "succeeded" as an update), Cancel takes submitted
     documents only, Update skips cancelled ones; an **unknown name fails the whole request** (404; documents before it
     stay changed); 20–500 names answer with no `message` and the alert "Bulk operation is enqueued in background." (the
     job runs at once in the simulator); more than 500 → 417 "Too Many Documents".
   - `tag.add_tags` checks **write** on each document when the transport has permissions (tag.py:147-152 `update_tags`);
     the P27 test that read "no permission check" was corrected.
   - `get_docinfo` / getdoc docinfo `comments` carry `published` (load.py:158).
   - `add_comment` (social handler) truncates the parent's `_comments` entries at 100 characters (comment.py:130-131) and
     writes Mention Notification Log rows.
   - Mid-batch: `savedocs` re-attaches `new-…` Files of Attach / Attach Image fields to the inserted name (created in the
     last 60 minutes, same `file_url` and field); the upload stub records `optimize`.
6. **`FrappeFormView` saves after an Attach upload or Clear (mid-batch attachimage).** It now provides `FrappeAttachHost`,
   so an Attach / Attach Image field inside it saves the form after an upload or a Clear, as Desk's `frm.save()`
   (attach.js:45, 141) — "Update" on a submitted document (an `allow_on_submit` field). Pass `attachHost={false}` for the
   old value-only behaviour; `FrappeQuickEntry` passes it (Desk's quick-entry controls have no `frm`). A bare `FrappeField`
   outside a host still only sets / clears the value.
7. **Attach / Attach Image field behaviour** (`FrappeAttachField`, mid-batch): "Attach" opens the uploader dialog instead of
   the OS file picker; an unsaved document's upload is attached to its `new-…` name (was unattached; Frappe relinks it on
   insert); "Clear" asks for confirmation and, in a form, deletes the File via `remove_attach` (the File was kept); the link
   text is the stored URL (was the file name); the Attach Image thumbnail is now a hover / focus preview; the uploader
   rejects non-images for Attach Image and files ≥ the site's `max_file_size`.
8. **Form Sidebar uploader offers Optimize** (integrator `2dd3c6e`): Desk's sidebar keeps FileUploader's
   `allow_toggle_optimize` default (FileUploader.vue:305-307; attachments.js:249-258), so `FrappeAttachments` passes
   `allowOptimize` and forwards `optimize` to `upload_file` (on by default for images above 200 KB). Thumbnails, the
   public-file warning, Crop and Camera come with the shared `AttachDialog`.
9. **Design-system label Workflow → Lifecycle (mid-batch lifecycle).** `listBulkWorkflow` "Workflow" → **"Lifecycle"**
   (ar "سير العمل" → **"دورة الحياة"**; the opt-in `selectionMode="bar"` menu button) and `listBulkWorkflowNone` → "No
   lifecycle action applies to all the selected documents" (ar "لا يوجد إجراء في دورة الحياة ينطبق على كل المستندات
   المحددة"; the disabled item in the Actions menu). Consumers that do not override these keys see the new text; apps that
   override them (the CRM does, `CrmAppLayout.tsx:173-176`) see no change. Message keys, component / hook / prop names,
   test ids (`sf-bulk-workflow`), Frappe methods, fields, DocTypes and server-sent text are unchanged; Showcase and docs
   follow. Guard test `P36B.lifecycle.1` (no en / ar message value says Workflow).

### Fixed
- Simulator: bulk Submit of a submitted document succeeded; bulk calls had no 20 / 500 thresholds and an unknown name was
  reported as a per-document failure instead of failing the request (Changed 5).
- Simulator: `tag.add_tags` accepted a user without write.
- Simulator: docinfo comments lacked `published`, so the "Published" marker never showed.
- Attach / Attach Image (mid-batch; Desk mismatches of the previous control): an upload on an unsaved document went out unattached (no
  doctype / docname / fieldname, so Frappe could not relink it on insert); Clear left the File on the server and did not
  save; the site's `max_file_size` and Attach Image's `image/*` restriction were not enforced before the request (only the
  OS picker's `accept`).

### Deviations from Desk (each deliberate; details in `docs/audit/p36b/README.md` §4)
- **LinkInput picker mode** opens on click / Enter on a filled box (Desk's Link never does, link.js:35-41) and marks the
  current value (Awesomplete marks the highlight) — owner requirement (select parity); opt-in. Space types instead of
  opening, arrows wrap, no Ctrl+N/P bindings.
- **Report view** sends each document once (Changed 2).
- **Bulk outcome** is a status line + reload, not Desk's error dialog without refresh (Changed 1); no `task_id` progress bar.
- **Global Search:** no calculator (Desk `eval`s), random password, `#tag` search, Help table, executables or Marketplace
  rows; phones get an icon + full-screen dialog (Desk keeps a 300 px bar); the dialog adds an error state with Retry and
  ↑/↓/Enter navigation; "New X" goes to `/app/<slug>/new` (Desk may open Quick Entry); result links are the canonical
  `/app/<slug>/<name>`.
- **Form Sidebar:** assignees listed one per row with Done / × (Desk: avatar stack + "Assignments" dialog); no "Assign To
  User Group"; no upload percentage or Google Drive (Camera, Crop and Optimize arrived mid-batch); Library is a text
  search (no folder tree);
  empty-section texts; a refused tag pill is removed with the server message (Desk keeps it); not hidden on phones (Desk
  `hidden-xs hidden-sm`); not reproduced: sidebar image (the image menu is in the form header), Follow, Reviews,
  auto-repeat, page views; the comment list is in
  the sidebar slot (Desk: form footer). Attach "+" and Tags add / remove are offered to every reader as in Desk (the
  server refuses: handler.py:220-221, tag.py:152); removing an attachment still needs write (attachments.js:161).
- **Share / Like / Comments:** full name + id in share rows; an "Everyone" pill; a read-only hint naming the reason;
  `disable_document_sharing` is a prop (`sharingDisabled`); a saving share row is disabled until the answer; the liked-by
  list opens from the count button (Desk: hover only); comment edit is not optimistic (Desk shows the new text first);
  Delete / Publish are icon buttons with Desk's confirmations; the count focuses the comment box.
- **Attach / Attach Image:** no Google Drive / app upload handlers, no upload percentage (`fetch`); the cropper is
  dependency-free (no cropperjs; no rotate / zoom — Desk disables zoom too); Camera uses `getUserMedia` first on every
  device (Desk: the `capture` input on phones; the package falls back to it) and ignores
  `force_web_capture_mode_for_uploads`; the preview also opens on focus; Reload File re-sends this session's last local
  file; the image menu is in the form header and its Remove saves with the form's default action ("Update" when
  submitted; Desk: "Save"); `df.options` is not merged into the uploader options; the Clear lookup also uses Files this
  control uploaded (Desk pushes the new File into docinfo). The simulator does not run `optimize_image`.
- **Lifecycle:** Desk says "Workflow"; the design system says "Lifecycle" (owner wording) in its own chrome only — Desk
  shows no group label for workflow items in the Actions menu, so the label appears only in the opt-in bar button and the
  "none applies" item.

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written in batch 2. Evidence is jsdom + the
  in-package simulator: `tests/bulk-p36b.test.tsx` (21), `tests/form-sidebar-p36b.test.tsx` (23, incl. `.23` Optimize),
  `tests/social-p36b.test.tsx` (22), `tests/global-search-p36b.test.tsx` (15), `tests/linkinput-p36b.test.tsx` (13),
  `tests/attach-image-p36b.test.tsx` (37), `tests/attach.test.tsx` (6, adapted), `tests/lifecycle-p36b.test.ts` (1).
- Coverage of the fixed list is unchanged (**258 / 301**): FV.A20 / FV.A21 stay COMPLETE with new evidence; FV.G10 stays
  PARTIAL (the row test mounts `FrappeField` with `parent`, not `FrappeChildTable`) — `docs/audit/p35/COVERAGE.md` §9.
- Real-site validation stays **prepared, not run**: the catalogue gained 16 batch-2 tests (now **91**: 77 API, 7 browser,
  7 manual) — `docs/audit/p36/VALIDATION-MATRIX.md` §5 (L-BULK-5, V-REPORT-2, F-SB-ASSIGN-1, F-SB-ATTACH-1, F-SB-ATTACH-2,
  F-SB-TAGS-1, S-SHARE-1, F-SB-LIKE-1, F-SB-COMMENT-1, S-GSEARCH-1, S-GSEARCH-2; mid-batch F-ATTIMG-1 Optimize (manual),
  F-ATTIMG-2 Clear, F-ATTIMG-3 new-document relink, F-ATTIMG-4 `max_file_size`, F-ATTIMG-5 private default). Every
  real-site result is BLOCKED.
- Integration gates at this docs commit: `npx vitest run` — 81 files, 1624 passed, 10 todo, 0 failed (first batch-2 docs
  commit: 79 files, 1585; 0.7.0-dev.2 batch 2 before the merges: 74 files, 1492); `node e2e/frappe-site/matrix/render.mjs
  --check` current; `tests/frappe-site-guards.test.ts` 23 passed. Integrator gates (typecheck, boundaries, build, CRM
  regression): `docs/audit/p36b/README.md` "Integrator gate results".

## 0.7.0-dev.2 (unreleased) — P36

P36 — owner decisions on the P35 open items, and real-site validation **prepared, not run**. `package.json` `version` is
`0.7.0-dev.2` (not tagged, not published). Coverage of the fixed P35 list is unchanged (**258 / 301**,
`docs/audit/p35/COVERAGE.md` §8 lists the rows whose evidence changed). **No real-site validation has been done;** every
write path is still simulator-only. Index: `docs/audit/p36/README.md` (repository only).

Owner decisions (final): (1) Desk's header-actions selection is the List View standard; (2) CRM pickers migrate per usage,
by semantics only; (3) CRM confirmations use `AlertDialog`; (4) no CRM Commission `DataGrid` migration until its responsive
behaviour is verified; (5) Report view editing matches Frappe 15.110 by default, with an explicit opt-in. (2)–(4) are CRM
work; the package delivers (1) and (5). `DataGrid` is unchanged from 0.7.0-dev.1 (see Reverted).

### Added
- **List (Core)** — Ctrl/⌘-click on a row toggles its selection instead of opening it (Desk `list_view.js:1296-1306`; not
  on links).
- **Report view (`@solvfast/ui/frappe`)** — `FrappeReportView` `editable`: `"desk"` (default) | `"strict"` (adds the
  field-permlevel write, `write`-not-`create`, `submit` on submitted documents, `read_only_depends_on` always evaluated) |
  `(df, row, info) => boolean` (`info.desk` = Desk's verdict). Child-table cells are editable as in Desk and save through
  `frappe.client.set_value` on the child row.
- **Exports from `@solvfast/ui/frappe`** — `deskCanWrite`, `evaluateReportReadOnlyDependsOn`, `isNonStdField`,
  `rowFromSavedDoc`, `updateCachedRows`; types `ReportEditable`, `ReportEditInfo`, `ReportEditMode`, `ReportEditOptions`;
  `selectionAfterBulk(kind, outcome, count)` (Desk's selection outcome per bulk action, `src/frappe/list/bulk.ts`).
- **Messages** — `listNoActions` ("No actions available for the selection"), en + ar.
- **Simulator (not public)** — `reportSetValueHandler` in `src/frappe/testing/handlers/views.ts`: SIMULATED
  `frappe.client.set_value` with the child-table branch, the submit right and update-after-submit validation. It is **not**
  exported from `@solvfast/ui/frappe/testing` (the showcase imports it directly) and not part of the builtin handlers.
- **Real-site validation infrastructure (repository only, NOT RUN)** — `docs/audit/p36/VALIDATION-MATRIX.md` (every COVERAGE
  row classified, 75-test catalogue), `e2e/frappe-site/run-matrix.mjs` (matrix runner: `--dry-run`, `--write`,
  `--browser`), `staging-seed.py` / `staging-teardown.py` with `fixtures/staging/*.json`, `guards.mjs` /
  `staging_guards.py` / `production-denylist.json` (refuse production names, loopback, a missing owner approval or a
  private directory inside a repository), a FrappeForm / FrappeListView / FrappeViews harness, `tests/frappe-site-guards.test.ts`
  (23 tests).

### Changed (behaviour visible to 0.7.0-dev.1 consumers)
1. **List selection follows Frappe Desk's header actions by default** (owner decision 1). `ListView` and `FrappeListView`
   now default to `selectionMode="header"`: no bulk bar; with ≥ 1 row selected the header shows "{n} items selected" +
   Clear, and the primary action ("Add {DocType}" / `primaryAction`) is replaced in place by the Actions menu; clearing
   the selection restores it. `selectionMode="bar"` remains as an explicit opt-in (not Desk's layout).
   **What apps must do:**
   - Any `ListView` / `FrappeListView` with `selectable` (or `bulk`) and no `selectionMode` now renders the header mode:
     `bulkActions` are Actions-menu items, and the column titles are replaced by the count while rows are selected (header
     sorting is unavailable during a selection — offer `controls.sortMenu`). To keep the bar, pass `selectionMode="bar"`.
   - Put the "New" button in `primaryAction`, not `toolbarActions`: only `primaryAction` gives way to the Actions menu
     (Desk's swap); `toolbarActions` content is never hidden.
   - `renderBulkActions` content renders in the toolbar next to the Actions menu (header) instead of inside the bar.
   - In header mode the selected rows are resolved across pages (`rowByKey`), so Print's draft / cancelled check and the
     workflow `get_common_transition_actions` see every selected row; opting back into `"bar"` keeps the current-page-only
     `ctx.rows`.
2. Header mode swaps the primary action on the selection alone (Desk `list_view.js:1634`): when no action applies, the
   Actions menu shows a disabled "No actions available for the selection" item instead of bringing the primary action back.
3. `FrappeListView` / `useFrappeBulkActions` / `FrappeBulkActions`: **the selection after an action follows Desk's
   callbacks** (`selectionAfterBulk`). Edit and workflow actions keep the selection (the list reloads); Submit / Cancel
   clear it only when every document went through (a partial failure keeps it and reloads; a queued job keeps it, no
   reload); dismissing Clear Assignment's confirmation clears the selection and reloads (Desk's `reject_action`). Assign
   To / Apply Assignment Rule / Add Tags / Delete (clear on success) and Export / Print (keep) are unchanged.
4. **`FrappeReportView` / `isCellEditable` (LV.H1): inline editing follows Frappe 15.110's report view by default**
   (owner decision 5), verified from report_view.js `is_editable` + `build_row` and frappe-datatable's `=== false` check.
   On a DocType without a Table field, plain fields are editable and a field with `read_only_depends_on` is editable when
   it evaluates false on the loaded row (true → read-only); with a Table field `read_only_depends_on` is not evaluated; the
   write right is Desk's `can_write` (level-0 write or create) and the field's permlevel is not checked (the server
   silently resets such a change). Before (0.7.0-dev.1): `read_only_depends_on` fields were never editable, a permlevel
   without write locked the cell, and child cells were read-only. `editable="strict"` restores the per-permlevel check.
5. `FrappeReportView` refreshes the edited row (every loaded row of that document) from the returned document, sends
   nothing for an unchanged value, and treats a response without `message` as a failure — the editor stays open (Desk).
6. Repository only: `e2e/frappe-site/seed-crm-site.py` and `teardown-crm-site.py` now refuse to run (they targeted a
   production site); the legacy `seed.py` / `validate.mjs` and the harness proxy refuse anything but an approved staging site.

Unchanged: `DataGrid` (byte-identical to 0.7.0-dev.1: the `32rem` minimum and horizontal scrolling on phones), so
`FrappeChildTable` and other existing grids are unaffected. `package.json` `exports` unchanged.

### Reverted (owner decision, P36 batch 2)
- **DataGrid mobile card layout** — implemented in the 0.7.0-dev.2 work (W3, merge `7bd1595`: `DataGrid layout="table" |
  "cards" | "auto"`, `cardsBelow`, `minTableWidth`, `DataGridColumn.mobile`, the `coreGridEditRow` message, the showcase
  page, `e2e/datagrid-mobile.mjs`, `tests/datagrid-p36.test.tsx`) and reverted before release (`ccb232d`). Owner: no
  card-based mobile layout, no change to the table's responsive behaviour; horizontal scrolling on phones is acceptable
  for now; Frappe Table fields are not migrated to cards. `DataGrid` is unchanged from 0.7.0-dev.1. (`ListView`'s phone
  cards, `layout="cards" | "auto"` + `ColumnDef.mobile` from 0.7.0-dev.1, are a different feature and stay.)

### BREAKING (vs 0.7.0-dev.1)
- `isCellEditable(df, row, levels)` → `isCellEditable(df, row, { fields, levels, issingle?, child?: { name }, mode?: "desk" |
  "strict", onIssue? })`. Migrate: pass the DocType's `fields` and the user's `levels` in the options object; pass
  `mode: "strict"` for the 0.7.0-dev.1 permlevel check. (0.7.0-dev.1 was never released; 0.6.0 has no `isCellEditable`.)

### Fixed
- Header selection mode: the primary action no longer stays visible while rows are selected and no action applies.
- `FrappeReportView`: a response without `message` was treated as a successful save; an unchanged value sent a
  `set_value` request.
- The Report view editability deviation recorded in P35 (`views.md` §3, "deliberately not :772-777") rested on a misread of
  Desk; the rule now matches 15.110 (Changed 4).

### Docs
- `docs/LIMITATIONS.md`, `docs/FRAPPE.md`, `docs/CONSUMING.md`, `docs/release/LISTVIEW-FRAPPE-PARITY.md`: header selection is
  the default; Report view editability; real-site status "prepared, not run"; Frappe 15.110 server
  rules the validation run must confirm (read from source, not yet observed on a site).
- `docs/components/list.md` (selection default, "The selection after an action"), `views.md` §3 (truth table, save path,
  opt-in), `docs/FEATURES.md` (F20, F21, C3, C4) — updated by the workstreams.
- `docs/audit/p35/COVERAGE.md` (§8 P36 changes; no status change), `docs/audit/p35/CRM-MIGRATION.md` (§5 decisions),
  new `docs/audit/p36/README.md` and `VALIDATION-MATRIX.md` (repository only).

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written in P36; every real-site result in
  `VALIDATION-MATRIX.md` is BLOCKED (not run). Running it needs an owner-approved, isolated staging site
  (`docs/audit/p36/README.md` §"What the owner must provide").
- Evidence for the P36 changes is jsdom / simulator only (`tests/list-selection-desk.test.tsx`,
  `tests/list-selection-header.test.tsx`, `tests/frappe-views-report.test.tsx` 26 `LV.H1`, `tests/frappe-site-guards.test.ts`
  23).
- Integration gates (batch 2, after the DataGrid revert): `npx vitest run` — 74 files, 1492 passed, 10 todo, 0 failed
  (batch 1 before the revert: 75 files, 1505; 0.7.0-dev.1: 72 files, 1415 passed); `npm run typecheck` exit 0; `check-boundaries` source rules OK. Not run at integration: `npm run build` (so `dist/styles/full.css` for consumers without Tailwind has not been rebuilt), `check:package`, `showcase:build`, `e2e/showcase-smoke.mjs` (its list checks were rewritten for the header
  default by W1 and have not run), `e2e/consumers/run.sh`.

## 0.7.0-dev.1 (unreleased)

P35 — Form View / List View coverage. Coverage of the fixed P35 requirement list (`docs/audit/p35/COVERAGE.md`, repository
only): **148 / 301 = 49.2 % at 0.6.0 → 258 / 301 = 85.7 %** (Form 155 / 181, List 103 / 120). **No authenticated real-site
validation has been done; every write path is simulator-only** (`docs/LIMITATIONS.md`). `package.json` `version` is
`0.7.0-dev.1` (not tagged); `files` now also ships `docs/components/views.md` and `docs/components/p35-core.md`.

Exports: **0 removed** against 0.6.0 (snapshot of the built `dist/*.d.ts`, TypeScript checker: `.` 466 → 553, `./frappe`
494 → 620, `./frappe/testing` 25 → 29, `toast` / `chart` / `form` unchanged); `package.json` `exports` unchanged (13
entries). 66 exports changed signature, all widening; the ones a consumer could notice are listed under "Export
signatures" below.

Gates (integration, at `826013d`; `410169d` changes only `e2e/consumers/run.sh`, whose gate was re-run): typecheck exit 0;
`npm test` 72 files, 1415 passed, 10 todo, 0 failed; `npm run build` exit 0 (775 files, 888.7 kB packed; extracted styles
regenerated identical); `check:boundaries` OK (source + dist rules); `check:package` OK (13 exports, 507 built files);
`showcase:build` OK; `e2e/showcase-smoke.mjs` PASS (73 sections × light / dark × en / ar, 0 page / console errors);
`e2e/consumers/run.sh` both clean consumers (Tailwind 3 + preset; no Tailwind) tsc + build OK, one React copy. None of these
is a real-site check.

### Added
- **Form (`@solvfast/ui/frappe`)**
  - `FrappeQuickEntry` (Desk's Quick Entry dialog over `FrappeFormView`, "Edit Full Form" hand-over), `useQuickEntryHost`,
    `quickEntryFields` / `quickEntryFilter` (port of quick_entry.js:59-110); `FrappeForm` opens it from a Link's
    "Create a new X" when the target is quick-entry eligible; `FrappeFormProps.onOpenFullForm`.
  - `FrappeFormView` slots and options: `menu`, `extraTabs`, `fieldFilter`, `hotkeys`; header image from `meta.image_field`;
    "See on Website" (`__onload.is_website_generator` + `published` + `route`, fallback `has_web_view`).
  - Undo / Redo: `DocStore.undo/redo/canUndo/canRedo/eraseHistory`, `HistoryEntry`; Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y.
  - `FormController`: `addCustomButton` / `removeCustomButton` / `clearCustomButtons` (grouped buttons form a dropdown),
    `save(action?)`, `checkMandatory()`, `selectedWorkflowAction`, `undo()` / `redo()` / `canUndo` / `canRedo`;
    `before_workflow_action` is abortable; `FrappeWorkflowActionsProps.beforeApply` / `afterApply`.
  - Server save errors on fields: `fieldErrorsFromFrappeError` (MandatoryError, LinkValidationError).
  - Fieldtypes: Autocomplete control (`df.options`); `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`, `FieldtypeIssue`.
  - `useUnsavedChangesBlocker` (router-agnostic in-app navigation guard); `defaultLinkHref`; `FormServices.builtin`,
    `FormServices.quickEntry`.
  - Client / boot: `getDoc` keeps getdoc's `_link_titles` (`linkTitlesOf`, `LoadedDocWithTitles`); `userDefaultsFromBoot`,
    `FrappeBootPayload.defaults` / `user_permissions`, `FrappeBoot.userDefaults`.
- **Record (Core `@solvfast/ui` + `@solvfast/ui/frappe`)**
  - Core: `RecordMenu`, `groupMenuItems`, `RenameDialog`, `PrintPreviewFrame`, `printSrcDoc`, `ConnectionsPanel`,
    `EmailComposer`, `isValidEmail`, `ReminderDialog` (+ `toFrappeDatetime`, `remindAtFor`, `reminderSetText`).
  - Frappe: the form ⋯ menu `FrappeRecordMenu` + `formMenuItems` / `FORM_MENU_ORDER` / `printAllowedForStatus` /
    `customizeHref` (Print, Email, Links, Duplicate, Copy to Clipboard, Rename, Reload, Delete, Remind Me, Undo / Redo,
    Customize, New — Desk's order and rules); `FrappeFormPrint`, `FrappePrintPreview` (+ `downloadPdfUrl`, `printViewUrl`,
    …); `FrappeConnections`, `connectionsFromMeta`, `useOpenCounts`; `FrappeEmailComposer`, `emailMakeArgs`;
    `FrappeReminder`.
- **List**
  - Core: `GroupBySidebar` and `ListView` `aside` / `asideOpen`; multi-bucket grouping (`GroupBucket`); page-size picker
    (`ListPagination pageSize/pageSizes/onPageSize`, `useListState().setPageSize`, `ListViewProps.pageSizes`); "Select all
    {n} matching" (`ListViewProps.selectAllMatching`, `BulkAction.allMatching`, `SelectionMatching`); phone cards
    (`ListViewProps.layout: "table" | "cards" | "auto"`, `ColumnDef.mobile`); `SavedFilter.global`, `SaveFilterOptions`,
    `SavedFilters canSaveGlobal`, `ListViewProps.savedFiltersGlobal`; `FilterField.operators`; `ListActions.removeCondition`.
  - Frappe: workflow state in the row indicator from the DocType (`indicatorWorkflowFromMeta`); Assigned To / Tags filter
    fields, per-user / per-tag grouping, `TagsCell`; group-by sidebar with server counts and tag stats (`sidebar`,
    `FrappeGroupBySidebar`, `useGroupByCounts`, `useTagStats`) + "Toggle Sidebar"; "Add {DocType}" (`create`,
    `FrappeListCreate`); menu entries User Permissions / Role Permissions Manager / Customize / List Settings
    (`FrappeListSettingsDialog`, `save_listview_settings`), `onNavigate`, `userPermissionsUrl`, `rolePermissionsUrl`,
    `customizeUrl`; typed Bulk Edit value (`BulkEditValue`); `DESK_PAGE_SIZES`; `actsAsSystemManagerFor`.
- **Views** — Core: `ViewSwitcher`, `ViewToolbar`, `ImageGrid`, `ImageView`, `KanbanBoard`, `CalendarMonth` and helpers;
  Frappe: `FrappeViews`, `availableViews`, `FrappeReportView` (column picker incl. child fields, permission-aware inline
  edit, totals), `FrappeImageView`, `FrappeKanbanView` (Kanban Board or Select-field mode), `FrappeCalendarView`,
  `useFrappeViewList`. Gantt, Dashboard, Map, Tree and Inbox are not implemented (`docs/components/views.md` §7).
- **Core capabilities for the CRM** — `StatusBadge` / `StatusDot` `color` (+ `STATUS_PALETTE`, `resolveStatusColor`,
  `statusColorStyles`); `LifecycleStateItem.step` (`past` / `current` / `future` / `skipped` / `failed`); `FileDropzone`;
  `SearchCombobox` static `options`, `multiple`, `values`, `variant`; `TimelineItem.icon` rendered + `tone`,
  `Timeline onItemSelect` / `showActor`; `Suggestion.group` / `icon` (LinkInput, TagInput); `IconStatCard trend`;
  `EmptyState`; `RichTextEditorHandle` (`insertText`, `insertHtml`, `focus`, `getHtml`) + `toolbarEnd`; `MonthInput`;
  `Stepper overflowCue` / `followCurrent`; `AssigneeGroup` list variant shows `description` under the name.
- **Integration (defaults and wiring)** — `FrappeForm` `menu?: boolean | FrappeFormMenuOptions | ReactNode | ((ctx) => ReactNode)`
  and `connections?: boolean | FrappeFormConnectionsOptions` (types exported; `FrappeFormMenuOptions.onOpened(doc, "duplicate"
  | "new")`); `FrappeFormView` `menu` also takes a function of `FrappeFormMenuContext` (`frm`, live `doc`, `dirty`, `reload`,
  `showTab`, `tabs`); `FrappeListCreate.onOpenFullForm` / `defaults`; `FrappeListViewProps.onQueryStateChange` (FrappeViews
  uses it to carry the List view's filters and sort); `FrappeProviderProps.userDefaults` / `FrappeSettings.userDefaults`;
  Core `ColumnDef.status` (`color` / `tone` / `variant` → the default cell renders a `StatusBadge`).
- **Simulator (`@solvfast/ui/frappe/testing`)** — handlers receive a `FixtureContext` (exported type: permission engine,
  `assertDoc` / `assertDoctype`, the transport's row filter `rows`, `printSettings()`, clock, user, options); two-argument
  handlers still work. The entry re-exports `KANBAN_BOARD_FIXTURE_META`, `VIEWS_DEMO_META`, `viewsDemoBackend`.
  SIMULATED handlers for `get_group_by_count`, `get_sidebar_stats`,
  `save_listview_settings`, `get_open_count`, `get_html_and_style`, `communication.email.make`, `get_email_template`,
  `create_new_reminder`, `get_kanban_boards`, `update_order_for_single_card`, `calendar.get_events`.
- **Showcase** — SIMULATED pages `#frappe-form-p35`, `#frappe-record-actions`, `#p35-list`, `#frappe-views`; Core pages
  `core-fields`, `file-dropzone`, `combobox-p35`, `empty-trend`, `record-p35`, `editor-stepper-p35`, `record-extras`.

### Changed (behaviour visible to 0.6.0 consumers)
The 32 behaviour changes reported by the integration (`ws/integration.md` §2), in its order, then the export signatures.

**Integration**
1. `FrappeForm` renders Desk's ⋯ menu (`FrappeRecordMenu`) by default; `menu={false}` opts out, a node replaces it.
2. `FrappeForm` adds a "Connections" tab by default when the DocType has a dashboard (`meta.__dashboard` with
   transactions); a form without Tab Breaks therefore gets a "Details" + "Connections" tab bar. `connections={false}` opts out.
3. Duplicate / New from that menu open the unsaved document in the same form; saving it inserts a new document. The form's
   `name` prop is unchanged — route with `menu.onOpened`.
4. `FrappeForm` no longer passes the loaded docinfo, or offers Reload, when the shown document is not the loaded name
   (local copy, new document, saved amendment). Before, a saved amendment and the cancelled original shared docinfo.
5. `FrappeProvider` forwards `boot.userDefaults` to new documents (FrappeForm, Quick Entry, list create);
   `userDefaults={false}` opts out; the app's own `newDocDefaults.userDefaults` wins.
6. `FrappeListView create={{ … }}` with neither `render` nor `onCreate`: before, no Add button; now Add opens
   `FrappeQuickEntry` (eligible DocType), or calls `create.onOpenFullForm`, or shows the Quick Entry dialog with the whole form.
7. `FrappeViews` carries the List view's filters and sort into the other views.
8. `TagInput` closes its suggestion list after Enter / comma creates a tag.
9. Simulator (`@solvfast/ui/frappe/testing`, SIMULATED): record / list / views handlers refuse through the permission
   engine (if_owner, User Permissions, shares) with Frappe's messages instead of a role-only check; `get_group_by_count` /
   `get_sidebar_stats` apply child-table filters and row permissions, equal counts ordered by value; `get_events` supports
   every simulated operator and needs read, `update_order_for_single_card` needs write; `get_docinfo` lists stored
   Communications and `get_communications` returns them (was `[]`); a stored "Print Settings" single also governs the
   builtin multi-PDF print check.

**Form**
10. **Ctrl/⌘+S runs the visible primary action** (Save / Submit → confirm / Update / Amend; Desk's
    `trigger_primary_action`), at document level, only the topmost form; it blurs the focused input first and does nothing
    with `saveDisabled`, without rights or while workflow actions replace the buttons; `hotkeys={false}` opts out. Before:
    save / update, only with focus inside the form.
11. A dirty submitted document shows **Update and no Cancel** (toolbar.js:668-689).
12. **Amend needs the amend and the create right.**
13. Duplicate / Amend copies start from the new-document defaults, with `__run_link_triggers` and `modified_by` reset
    (`no_copy` fields get their default; child rows keep `_amended_from`).
14. **Link "Create a new X" needs the target's create right by default** (was: whenever `onCreateNew` was given).
15. **The open-record link is hidden without read on the target**, and for a session without roles. App overrides
    (`canCreate`, `linkHref`) still decide alone.
16. **Unsupported fieldtypes** (Signature, Geolocation, Barcode, Icon, …) **are read-only** and listed in the form's
    banner (were editable text boxes).
17. `""` in a required field no longer forces a collapsible section open (only `null`, section.js:150).
18. A new document of a workflow DocType gets the workflow's default state.
19. The form header shows the `image_field` avatar and "See on Website".
20. `frm.save("Submit")` asks for confirmation first (Desk `savesubmit`).

**List**
21. **`FrappeListView` shows the page-size picker by default** (20 / 100 / 500 / 2500, stored in `user_settings`
    `List.sf_ui.pageSize`); `pageSizes={[]}` hides it.
22. **System Managers see four more ⋯ entries:** User Permissions, Role Permissions Manager, Customize, List Settings
    (`menu={{ … : false }}` per entry). Import also navigates through `onNavigate` when given.
23. **The empty-state "Create your first …" needs the create right** (was ungated).
24. **The localStorage saved-filter adapter rejects duplicate names** (it replaced them).
25. **Workflow DocTypes get the workflow indicator by default** (`workflow={false}` opts out); with the width cap it takes
    Desk's Status slot.
26. The Frappe group-by "no value" bucket is labelled **"Not Set" / "No Tags"** (was "—"); Assigned To / Tags rows go into
    one group per user / tag, user groups labelled with full names.
27. Saved filters ask for confirmation before removal (System Managers also get an "Is Global" checkbox in FrappeListView).
28. Group-row React keys are prefixed by the group.

**Core**
29. `AssigneeGroup variant="list"` renders `Assignee.description` as a second line (rows without one are unchanged).
30. `RichTextEditor` is a `forwardRef` component: JSX use is unchanged; calling it as a plain function no longer type-checks.
31. `SearchComboboxProps.search` / `onSelect` are optional.
32. `TimelineItem.icon` is rendered (it was ignored).

Also from WS1 (not in the integration list): workflow transitions run Desk's pre-steps — mandatory check (incl.
`mandatory_depends_on`) → `before_workflow_action` → `apply_workflow` → `after_workflow_action`; `frm.save()` checks the
right first.

**Export signatures** (no export removed; every change widens, but these can be noticed):
- `RichTextEditor`: function component → `ForwardRefExoticComponent<RichTextEditorProps & RefAttributes<RichTextEditorHandle>>`.
- `GroupByOption.groupOf` may return `GroupBucket | GroupBucket[]`: code that *calls* it must handle an array; code that
  implements it is unaffected.
- `SearchComboboxProps.search` / `onSelect` are optional — a narrowing only for code that reads the props.
- `Messages` gained required keys and the message-key union grew: a full hand-typed `Messages` object, or a `t` typed
  against 0.6.0's keys passed to `operatorLabel` / `TimelineContext.t` / `buildFrappeListMeta` / `columnsFromMeta` /
  `filterFieldsFromMeta`, no longer type-checks. `useLocale().t` and `Partial` messages are unaffected.
- `FormController`, `DocStore` and `FormServices` gained required members (undo / redo / canUndo / canRedo, custom buttons,
  `save`, `checkMandatory`, `selectedWorkflowAction`, `eraseHistory`, `builtin`): only hand-written mocks need them.
- Widened (optional props / params, new union members): e.g. `ListViewProps`, `ColumnDef` (`mobile`, `status`),
  `FrappeListViewProps`, `FrappeFormProps` / `FrappeFormViewProps` (`menu` also a function), `FrappeProviderProps`
  (`userDefaults`), `FixtureHandler` (optional `ctx`), `BulkAction.run` / `resolveBulkActions` / `SavedFiltersStorage.save`
  (optional extra parameter), `copyDoc` / `amendDoc` / `buildLayout` (optional option), `FrappeListOptions.workflow`
  (accepts `false`). `FormSkeleton` moved to its own module and is still exported from `@solvfast/ui/frappe`.

### Fixed (native Frappe 15.110 mismatches, `docs/audit/p35/C-native.md`)
- F1 Ctrl+S (above). F2 workflow pre / post steps (above). F3 getdoc `_link_titles` are kept and seed the link-title cache,
  so saved forms show Link titles without a search. F4 Link create / open permission defaults (above). F5 Update without
  Cancel (above; `tests/parity/review-r1.test.ts` updated to the native expectation). F6 in-app navigation:
  `onDirtyChange` + `useUnsavedChangesBlocker`. F8 Amend right and copy defaults (above). F7 stale `docs/FRAPPE.md` /
  `docs/LIMITATIONS.md` (Docs below). **F9 not fixed:** no source boundary rule yet forbids `src/frappe/**` from importing
  `./testing` (the dist rule exists).

### Docs
- `docs/FRAPPE.md` rewritten: the entry's contents, every whitelisted method called (rows via `reportview.get`;
  `get_list` for lookups only), writes, `user_settings`, realtime, validation status.
- `docs/LIMITATIONS.md` rewritten for 0.7.0-dev.1: no authenticated real-site validation, simulator-only areas, views not
  implemented and why, known bugs; stale "Not supported: child tables, realtime, per-user list settings" removed.
- `docs/components/forms.md` (P35 APIs, behaviour changes, regenerated fieldtype table — Attach uploads), `record.md` §5,
  `list.md` (stale "selection-bar buttons only", "sidebar not reproduced", "List Settings read only" removed),
  `views.md` (new), `p35-core.md` (new) — both now shipped (`package.json` `files`); integration added forms.md §2.3 / §2.4
  (provider defaults, menu / connections / `FrappeFormMenuContext`), list.md `create` defaults and `onQueryStateChange`,
  record.md / views.md simulator notes, p35-core.md status columns and TagInput.
- `docs/audit/p35/COVERAGE.md`, `docs/audit/p35/CRM-MIGRATION.md` (new); `docs/release/COMPONENT-COMPLETION-MATRIX.md` and
  `LISTVIEW-FRAPPE-PARITY.md` marked superseded where stale.

## [0.6.0] — 2026-11-06

Version decision: **0.6.0** (minor), not 0.5.1. Reason, checked on the public surface `v0.5.0..HEAD`: `src/index.ts` gains
new exports (ExportDialog, DataImportDialog, the import model / views / labels, buildCsv / parseCsv / saveBlob …);
`src/frappe/index.ts` and `package.json` `exports` are unchanged; nothing is removed or renamed (`GroupedImportWarnings` /
`ImportFieldOption` are now aliases of identical Core types; `ExportDialogLabels` gains optional keys). Behaviour visible to
existing consumers changes on purpose: `FrappeExportDialog` labels follow the language (Arabic under `ar`), an empty
selection shows a hint, the File Type resets to CSV on each opening, and both import / export dialogs keep wide content
inside at phone widths. New public API + intentional visual change = minor under the policy above. Dev builds were numbered
0.5.1-dev.1 … dev.5 before this check; they continue as 0.6.0-dev.N. No release commit or tag.

### Added (additive; dev builds 0.6.0-dev.N — not released)
- **Core `ExportDialog`** (core entry): the Design System's Export Data dialog without a backend — File Type, Export Type
  (All / Filtered or Selected (n) / 5 Records / Blank Template, optional counts), field groups with label, key and
  "(Mandatory)", Select All / Select Mandatory / Unselect All, `lockMandatory`, `defaultSelection`, validation (nothing
  selected), loading, error (`renderError`) and success (closes) states; en / ar labels from the message catalogue
  (`export*` keys). `onExport({ fileType, records, fields })` — the host writes the file. Utilities: `buildCsv`,
  `parseCsv`, `saveBlob`, `mandatorySelection`, `orderedSelection`.
- `ExportDialog`: `filtered` (default Export Type = Selected (n) with a selection, else Filtered Records when the list is
  filtered, else All Records; never Blank Template unless `defaultRecords` asks), `ExportField.note` (e.g. a conditional or
  update-only requirement shown after the key).
- Import requirements: `ImportField.requiredOn` (create-only / update-only mandatory), `ImportField.requiredWhen`
  (conditional: `{ test, label, on }`), `validateImport(…, importType)` and `isMandatoryFor`; Update Existing Records checks
  that each row matches an existing record (no duplicate flags then).
- **Core `DataImportDialog`** (core entry): the Data Import tool's steps (Upload → Preview → Import → Result) behind a
  `DataImportAdapter` (`parse`, `fields` with mandatory / per-value checks / aliases, `duplicates`, `run` or
  `runUnavailable: reason`, `template` → the Core ExportDialog). Client-side auto-mapping, per-row validation, duplicate
  detection (existing records and within the file), column mapper, duplicate handling, progress and the run's result —
  never a success the run did not report. Model: `autoMapColumns`, `validateImport`, `importableRows`,
  `importPreviewColumns`. Views: `ImportPreviewTable`, `ImportWarningsPanel`, `ColumnMappingForm`. Labels:
  `DATA_IMPORT_LABELS_EN/AR` (moved to Core, still exported from `/frappe`), `IMPORT_DIALOG_LABELS_EN/AR`.

### Changed (no API change)
- `FrappeExportDialog` renders the Core `ExportDialog` (same props, same `download_template` request); its labels now
  default to the catalogue (Arabic under `language: "ar"`), and an empty selection shows "Select at least one field".
- A host re-render with new-but-equal `groups` / adapter no longer resets the user's picks in `ExportDialog` or the
  unsaved column mapping in `DataImportDialog` (reset only on open or a structural change).
- Phone widths: the Export / Data Import dialogs (Core and `FrappeDataImport`) keep their content inside the dialog
  (`grid-cols-[minmax(0,1fr)]`): a wide preview grid scrolls horizontally instead of widening the dialog past the screen.
- `FrappeImportPreview`, `FrappeImportWarnings`, `FrappeColumnMapping` render the Core views; `FrappeDataImport` keeps its
  server orchestration (every step a server request) on those views.

## [0.5.0] — 2026-11-06

### Added (additive API and an opt-in visual mode = minor per the policy above; tested as dev builds 0.4.1-dev.1 … dev.2)
- **Desk's selection layout for the List View** (Frappe 15.110 `list_view.js:590-598, 1613-1634, 1855-2127`): `ListView` /
  `FrappeListView` `selectionMode="header"` — no bar row; the header shows "{n} items selected" + Clear; the toolbar's new
  `primaryAction` gives way to an **Actions** menu (`ListActionsMenu`) while rows are selected. Default `"bar"`: no change for
  existing consumers. Shift-click range selection (`:1400-1421`).
- **Typed bulk actions**: `BulkAction` gains `tone`, `hidden(ctx)`, `disabled(ctx)` (with a reason), `confirm`, `group`;
  `resolveBulkActions`, `useBulkActionRunner`, `BulkActionContext`, `BulkActionConfirm`.
- **`AssignDialog`** (Core): Desk's Assign To dialog — users, Assign to me (also for single-assignee hosts), current assignees,
  optional Complete By / Priority / Comment.
- **`useFrappeBulkActions`** (`/frappe`): Desk's Actions (order, gates, workflow items asked on every opening, dialogs) as data;
  `FrappeBulkActions` renders the same as bar buttons. `FrappeListView` `selectionMode="header"` uses it (Assign To → `AssignDialog`).

### Fixed
- `ListView.onSelectionChange` fired only when the NUMBER of selected rows changed: unchecking A and checking B in one update
  left a host that mirrors the selection with A — and its bulk action on the wrong record. It now fires on
  every change of the selected set.

## [0.4.0] — 2026-11-04

Frappe-integrated components: the `@solvfast/ui/frappe` entry (client, provider, hooks, `FrappeListView`, `FrappeForm`,
workflow, assignment, timeline, Import / Export, permissions) and the simulator `@solvfast/ui/frappe/testing`; the CRM
handoff is `docs/release/CRM-HANDOFF.md`. **Known limitation:** the Frappe layer is verified against recorded 15.110
responses and the simulator only; no authenticated real-site session or write has been verified yet (docs/LIMITATIONS.md).

### Added
- **Desk Like (the list's favorite heart).** Core `LikeToggle` (a `<button aria-pressed>`, not optimistic, pending /
  error states) and `ListTable` / `ListView` `like`; `FrappeListView` shows it by default for a logged-in user
  (`like={false}` to opt out, `onLikeError`), toggles through `frappe.desk.like.toggle_like`, updates the cached rows
  without a reload, and offers Desk's "Liked by me" filter (`_liked_by like %user%`). Simulator support.
- **Attach / Attach Image upload** in `FrappeField` / `FrappeForm` (`FrappeAttachField`): file picker → `upload_file`,
  attached to the saved document, private unless the field / DocType makes attachments public, `file_url` stored,
  pending and error states, image preview, Clear.


Work towards 0.4.0 (Frappe-integrated components) on branch `feat/0.4.0-frappe`; see docs/CONTRACT-0.4.md.

### Already in the published 0.3.0 tarball but missing from this changelog (published content ≠ tag `v0.3.0`)
- Column manager: PMO's design (`66af191`).
- Date filters like Frappe's — timespans, `between` on dates (`63bbd1b`).

### Added (in progress)
- `@solvfast/ui/frappe`: the 0.4.0 integration contract (`contract.ts`): metadata bundles, documents and docinfo,
  permissions, structured errors, client surface (documents, workflow, assignment, comments), query keys and
  invalidation rules, realtime port, simulated-backend input.
- Real Frappe 15.110 metadata fixtures (`tests/fixtures/real-15.110/`) and the read-only capture script.

## [0.3.0] — 2026-10-19

Additive: every component in PMO's `components/ui` is now in the package, in the package's look, so PMO and new
BildFast projects can import them from `@solvfast/ui`. Two new entries with optional peer dependencies:
**`@solvfast/ui/chart` needs `recharts` 2**, **`@solvfast/ui/form` needs `react-hook-form` 7** (docs/CONSUMING.md §7).
Apps that don't use the new parts see no change: the existing parity suites were rerun (docs/VALIDATION.md).

### Added — Design System v0.3.0 primitives (as in PMO)
- `Alert` (`AlertTitle`, `AlertDescription`), `Progress`, `Toggle` (+ `toggleVariants`), `ToggleGroup` / `ToggleGroupItem`,
  `StatusDot`, `Pill`, `Accordion` (`AccordionItem`, `AccordionTrigger`, `AccordionContent`), `Collapsible`
  (`CollapsibleTrigger`, `CollapsibleContent`), `Breadcrumb` (`BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`,
  `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`), `Pagination` (`PaginationContent`, `PaginationItem`,
  `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`), `Slider`, `AspectRatio`, `HoverCard`
  (`HoverCardTrigger`, `HoverCardContent`), `ContextMenu` (+ 14 parts), `Menubar` (+ 15 parts), `NavigationMenu`
  (+ 7 parts and `navigationMenuTriggerStyle`).
- Their popups render inside the theme scope and carry the package's popper glass, as the dropdown menu does (hover
  card, context menu, menubar; also the navigation menu's panel, which Radix keeps inline).
- Arabic: pagination and breadcrumb strings come from the package messages; their chevrons, and the context-menu and
  menubar sub-menu chevrons, point the reading way; `Progress` fills from the right.

### Added — from PMO
- `SearchCombobox` (+ `ComboOption`, `SearchComboboxProps`): PMO's async combobox (Link fields, repo pickers) without
  React Query. It loads when opened and 200 ms after typing stops, ignores late answers to older searches, and shows
  "Loading…" instead of "empty" while a search runs. Same props; `queryKey` is optional (a reset key).
- `RichText`, `RichTextEditor`, `sanitizeHtml`, `htmlIsEmpty`: PMO's rich-text editor and viewer, with the package's
  field look and toolbar labels in Arabic and English. The rich-text styles ship in theme.css / full.css (`.sf-rich-text`).
- `PageHeader` (back button, title, subtitle, details row, actions; router-free: `onBack`) and `EditableTitle`.
- New message keys: `back`, `loading`, `pagination`, `previous`, `next`, `morePages`, `breadcrumb`, `editTitle`,
  `textFormatting`, `bold`, `italic`, `underline`, `strikethrough`, `bulletedList`, `numberedList`.

### Added — new entries (optional peer dependencies; the core never imports them)
- **`@solvfast/ui/chart`**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
  `ChartStyle`, `ChartConfig` — the Design System's chart helpers. **New optional peer dependency `recharts`
  `^2.15.0`.**
- **`@solvfast/ui/form`**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`,
  `FormMessage`, `useFormField` — the Design System's react-hook-form bindings. **New optional peer dependency
  `react-hook-form` `^7.50.0`.**

### Added — shell
- `PageHeader` inside `AppShell`: a text title becomes the top bar's title (the page's one `<h1>`, as on Sear's pages)
  while the header is mounted. The header then shows only its back button, subtitle, details and actions. AppShell's
  `title` prop still wins; outside a shell the header has its own `<h1>`.
- `MobileNav` `primary` (also `AppShell` `mobile.primary`): the app picks the mobile bar's items, and "More" lists the
  whole navigation tree. Without it nothing changes (an app whose navigation is all groups got only "Home" and "More").

### Changed
- **`ColumnManager` is PMO's column picker (Frappe CRM's), at the owner's request.** It replaces Sear's checkbox list
  with up/down buttons, so `ListView` and `FrappeListView` get it too:
  - the shown columns are rows you drag by their grip (mouse, touch or pen), or move with ↑ / ↓ on the focused grip;
    the new position is announced;
  - × removes a column;
  - **Add column** opens a searchable list of every other field.
  - Locked columns stay listed at the top. Keys the menu doesn't manage (locked, or not loaded yet) keep their place.
  - New messages: `editColumns`, `addColumn`, `moveColumn`, `moveColumnHint`, `removeColumn`, `columnMoved`,
    `lockedColumn`.
- **Date filters work like Frappe's, at the owner's request** (frappe/public/js/frappe/ui/filters/filter.js):
  - Datetime fields (e.g. Created On) offer Is, After, Before, On or After, On or Before, Between, Timespan and Fiscal
    Year. Date fields also offer Equals / Not equals.
  - "Is" takes Set / Not Set. Between takes From / To (either may be empty). Timespan offers Frappe's 24 periods.
    Fiscal Year offers the site's fiscal years.
  - New operators `between`, `timespan` and `fiscal_year`, with values `"YYYY-MM-DD,YYYY-MM-DD"`, a TIMESPANS key and a
    FiscalYear name.
  - New helpers `operatorsFor`, `defaultOperator`, `operatorLabelKey`, `timespanRange`, `splitRange` / `joinRange`.
  - New props `fiscalYears` / `loadFiscalYears` on `ListView` and `FilterBuilder`. A new date condition starts on
    Between.
  - Client-side date filtering compares calendar days, as the Frappe layer already did: After 15 Oct excludes all of
    15 Oct. Timespans match Frappe's server dates, tested against Frappe 15.110's own output for 7 dates × 24 periods.
  - The Frappe entry sends `between`, Frappe's native `timespan`, and Fiscal Year as a `between` over the year. It reads
    the site's Fiscal Year records (ERPNext) only when the filter opens or a query needs them, once per session; none
    means the option isn't offered. `fiscalYears={false}` turns it off.

### Dependencies
- New: `@radix-ui/react-accordion` 1.2.20, `-aspect-ratio` 1.1.15, `-collapsible` 1.1.20, `-context-menu` 2.3.7,
  `-hover-card` 1.1.23, `-menubar` 1.1.24, `-navigation-menu` 1.2.22, `-progress` 1.1.16, `-slider` 1.4.7, `-toggle`
  1.1.18, `-toggle-group` 1.1.19. They are from the same Radix release as the existing pins, so they reuse the installed
  Radix internals (one copy each; no new internal packages).

### Fixed
- `DateField`, `TimeField`, `DateTimeField`: with an `id` and no `aria-label`, the field is named by its
  `<label htmlFor>`. Before, the name was always "Date" / "Time" / "Date and time", which overrode the label. The
  selected value is now the field's description. Without an `id`, nothing changes.
- Relative to PMO, `sanitizeHtml`: content inside any non-allowed element (`<font>`, `<section>`, a custom tag…) was
  not sanitized, so `<img onerror>`, `javascript:` links and `on*` / `style` attributes got through; `htmlIsEmpty`
  parsed the raw value into a live element (an `<img onerror>` would run); the editor wrote the raw value into the
  page. The package rebuilds the HTML from an allowlist, parses inertly, and only writes and emits sanitized HTML.
- Relative to the Design System: `Progress` passes `value` to Radix (it had no `aria-valuenow`); the display names of
  `MenubarShortcut` and `BreadcrumbEllipsis`.

### Not added (docs/LIMITATIONS.md)
- drawer (vaul), carousel (embla), input-otp, resizable (react-resizable-panels): apps keep their own shadcn copies,
  themed by the package tokens under `.sf-theme`.

## [0.2.0] — 2026-10-18

Additive: four components and a new entry. **Apps that import `@solvfast/ui/toast` need `sonner`** (1.7 or 2) —
docs/CONSUMING.md §5.

### Added
- `Table` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) and
  `RadioGroup` / `RadioGroupItem`: the Design System's primitives, as Sear renders them.
- `Stepper` (`StepperStep`, `StepState`): the Design System's stepper pattern, identical to Sear's. Labels and notes
  take a string or `{ en, ar }`.
- New entry **`@solvfast/ui/toast`**: `Toaster` (the Design System's sonner host — theme- and direction-aware) and
  `toast`.
- New dependency `@radix-ui/react-radio-group` 1.4.7, the version Sear runs. It reuses the Radix internals already
  installed.
- **New optional peer dependency `sonner` (`^1.7.0 || ^2.0.0`).** It is needed only for `@solvfast/ui/toast`. The
  app's own sonner is shared, so `toast()` from "sonner" reaches the package's `Toaster`.

## [0.1.0] — 2026-10-18

The first release, for GitHub Packages (`@solvfast` organisation, private; install with a token — docs/CONSUMING.md).
It is 0.1.0-rc.1 plus the changes below. Frappe layer: simulated-request tests passed; real-site validation is
deferred until the first real-project integration (not done).

### Changed
- **Licence: proprietary.** LICENSE: Copyright (c) 2026 Solvfast, all rights reserved; only Solvfast and those it
  authorises may use, copy or modify the package. `package.json` `license` is `UNLICENSED` (0.1.0-rc.1, never
  published, said `MIT`). README and docs say the same.
- `THIRD-PARTY-NOTICES.md`: the MIT notice of shadcn/ui, from which the primitives derive (via the Design System).
  It ships in the tarball.
- `THIRD-PARTY-NOTICES.md`: also the MIT notice of tailwindcss-animate, whose generated keyframes are in
  `dist/styles/full.css`.
- Docs: CONSUMING — integrating into an existing app (a host that already uses `tailwindcss-animate`, or `@tailwind`
  directives; an app that already owns theme and language), from the Sear integration rehearsal.

### Added
- `StatCard`: the Design System's stat card (liquid glass, label, large value, optional up/down trend pill).
- `IconStatCard`: Sear Studio's overview card (pane, tinted icon square, name, total).
- Both are static by default; `href` makes a link and `onClick` a button. Numbers are formatted for the language.
  Pixel parity with the sources is recorded in docs/VALIDATION.md.

### Changed — Sear's look for tabs, dialogs and the calendar
- **Tabs** look like Sear's `SegmentedTabs` (used across Sear, e.g. the Working Hours form): a liquid-glass pill rail
  with pill tabs, the active one in the primary colour. Was the DS underline strip. Same Radix API and keyboard
  behaviour; full-width and compact are classes (see the showcase).
- **Dialog and AlertDialog** are glassy: Sear's `.sear-glass-dialog` treatment (the poppers' liquid glass) instead of
  the DS aurora gradient, with fallbacks for reduced transparency and browsers without backdrop-filter.
- **Calendar** on its own has the date pickers' glass and rounded corners instead of the DS's opaque, square
  gradient panel. Date pickers are unchanged.

### Added (repository only, not in the package)
- `showcase/`: a browsable component site with live examples of the package's real components, in light/dark and
  Arabic/English (`npm run showcase`, `showcase:build`, `showcase:preview`; `e2e/showcase-smoke.mjs`). See
  showcase/README.md.

## [0.1.0-rc.1] — 2026-10-17 — release candidate (not published)

The first release candidate: theme and primitives (5.1), app shell (5.2), List View (5.3) and the optional Frappe
layer (5.4), with the changes from their reviews. Not published; the owner publishes (docs/RELEASING.md).

**Validation status:** core verified (unit tests, pixel parity with Sear's real components, clean installs for both CSS
paths). Frappe layer: simulated-request tests **passed**; **real-site validation deferred** until the package is
integrated into a real project — not done (docs/LIMITATIONS.md).

### Release preparation (5.5)
- `package.json`: version `0.1.0-rc.1`; `repository` (`solvfast/solvfast-ui`); the tarball also carries CHANGELOG,
  VENDORED and the user docs; scripts `check:package` and `prepublishOnly` (refuses to publish without a clean tree, a
  `v<version>` tag on HEAD and a named copyright holder).
- Package audit in the build (`scripts/check-package.mjs`): exports exist and have types, every import in `dist/` is a
  declared dependency, no unused dependency, no absolute local path in the tarball.
- Docs: `docs/LIMITATIONS.md` (one list of what is not done, not verified or intentionally different),
  `docs/RELEASING.md` (checklist), README rewritten, install-from-GitHub-Packages section in CONSUMING.
- `e2e/frappe-site/`: a prepared real-site validation procedure — **never run**.

### Fixed (5.5)
- Frappe types: `useFrappeMeta`'s `refetch` no longer exposes `@tanstack/query-core` types in the published
  declarations (that package isn't a dependency; strict installers couldn't resolve it). It is now
  `() => Promise<void>`.

### Added — increment 5.4 (Frappe layer, `@solvfast/ui/frappe`)
- `FrappeListView` (ListView over a DocType), `useFrappeList`, `useFrappeMeta`, `FrappeProvider`, `createFrappeClient`
  (same-origin session cookie + CSRF; replaceable transport), `FrappeError`, `frappeRetry`, `invalidateFrappeList`,
  and the pure helpers `buildFrappeListMeta`, `columnsFromMeta`, `filterFieldsFromMeta`, `queryToFrappe`,
  `conditionToFrappe`, `buildListRequest`, `frappeLinkSearch`. Stock methods only: `getdoctype`, `client.get_list`,
  `reportview.get_count`, `search.search_link`. Docs: docs/FRAPPE.md.
- Core additions used by it (usable on their own): `ListView` `searchHint`; `useListState` `selectionScope`; rich-text
  cells (Frappe Text Editor HTML) shown as plain text; messages `fieldId`, `fieldCreated`, `fieldModified`,
  `searchTitleOnly`.
- Rule C2 (Frappe's single `or_filters` list): search uses it across the search fields with "Match all" filters, and
  narrows to the title field with a visible note with "Match any" filters.

### Fixed — Frappe (relative to Sear's never-run Frappe path; docs/FEATURES.md)
- Totals honour "Match any" filters (`reportview.get_count`; Sear sent `or_filters` to `frappe.client.get_count`,
  which drops them).
- Requests never name fields the DocType doesn't have (an old saved filter or a render-only column made Frappe
  reject the whole request).
- A date on a Datetime field matches the whole day; Dynamic Link fields filter as text; ID / Created On / Last Updated
  are localized; link filter values use Frappe's link search.

### Changed — after the 5.3 review
- List View: every filter-row control has an accessible name (Field / Condition / Value / Match); they were unnamed
  comboboxes, as in Sear and PMO.
- List View: no pager or total while the list shows an error.
- List View on phones: the toolbar's buttons wrap instead of widening the page (Sear's list page was 506 px wide at
  390 px, with its page action cut off). Desktop unchanged.
- List View, grouped: all groups are sections of one table (a header row per group with collapse, count and the
  group's select-all), so they share the header's column order and widths; the table scrolls horizontally inside its
  card when narrow. The header's select-all covers the rows on screen (expanded groups). Was one table per group (PMO),
  whose columns didn't line up. New message key `selectGroup`.
- Buttons: the glass variants (default, secondary, outline, ghost, destructive) now use the DS Button's documented
  motion — 180 ms hover, 120 ms press (design_system `button.tsx`, v0.3.0) — instead of the glass engine's 0.4 s /
  0.16 s, which they had in Sear. Nothing else changes: an audit of every element's transition on the primitives,
  shell and list pages differs only on buttons; no motion under `prefers-reduced-motion`; the list pager keeps
  Sear's 150 ms.

### Added — increment 5.3 (List View)
- `ListView` — Sear's data grid (toolbar, glass table, pill pager) with PMO's list features as props: selection and
  bulk actions, group-by, sort menu, quick filters of any type with a field picker, row actions with confirm,
  conditional row styles, keyboard rows, loading / empty / error states. Client and server data modes.
- `useListState` (headless) and the parts: `ListTable`, `GroupedListTable`, `DefaultCell`, `FilterBuilder`,
  `FilterValueInput`, `SavedFilters`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`,
  `BulkActionBar`; the filter model (`applyFilterQuery`, 12 operators), `compareValues` / `sortRows`, `groupRows`,
  `mergeColumns`, storage adapters (`createLocalStorageAdapter`, `ListPrefsStorage`, `SavedFiltersStorage`).
- List strings in Arabic and English. Coverage per feature: docs/FEATURES.md.

### Fixed — list (relative to Sear and PMO; details in docs/FEATURES.md)
- Row actions are a fixed last column — no longer offered in the column manager, the filter fields or sorting.
- Non-sortable columns have no sort button; sorted headers carry `aria-sort`; rows open with Enter.
- Load errors are shown with Retry (Sear's grid showed nothing).
- Sorting: empty values last in both directions; text such as "Room 101" no longer sorts as a date; natural order.
- Server mode: search and text filters wait for a typing pause (one request, not one per keystroke).
- Selection is pruned when search or filters change; a group's select-all reflects that group.
- Filter value inputs keep focus while typing; filter condition ids never collide.
- Saved-filter storage failures reach the app (`onSavedFiltersError`) instead of being swallowed.

### Added — increment 5.2 (app shell)
- `AppShell`, `Sidebar`, `Navbar`, `MobileNav`, `AppSwitcher`, `NotificationPanel` — Sear's StudioShell with its
  navigation, routing, switcher sections, notifications, help and search supplied by the app; `NavItem` model with
  any nesting depth; `relativeTime` / `timeGroup`; shell strings in Arabic and English.

### Fixed — shell (relative to Sear)
- Notification panel is glass in dark mode too (Sear's dark override made it opaque).
- Mobile "More" sheet opens on the start edge in Arabic (Sear: the left edge).
- The app switcher highlights the current app (Sear's name comparison never matched).
- The top bar renders without a provider; app-switcher and shell labels are localized (Sear's were English-only).

### Added — increment 5.1 (foundation)
- Core entry `@solvfast/ui`: `ThemeProvider` (`useTheme`, `useLocale`, `usePortalContainer`), `cn`, and 23 primitives
  vendored from the DS v0.3.0 with Sear's effective look (VENDORED.md), plus `DateField` / `TimeField` / `DateTimeField`.
- Styles: `theme.css` + `glass.css` (+ opt-in `base.css`) for Tailwind 3 apps with the `tailwind-preset`;
  `full.css` (+ opt-in `full-base.css`) precompiled for apps without Tailwind.
- `LICENSE`: full MIT terms; the copyright holder is pending the owner's confirmation.
- Tooling: pinned `upstream/` sources, CSS extraction, boundary check, Sear parity harness (`tools/parity`),
  clean-consumer test (`e2e/consumers`).

### Fixed (relative to Sear / the DS)
- Popovers, selects and menus fall back to a solid surface under `prefers-reduced-transparency` and without
  `backdrop-filter` (Sear's popper glass out-ranked the DS fallbacks).
- Button motion durations 180/120 ms now emit CSS (DS D5) — effective on `ai-outline` and Calendar day buttons; glass
  buttons keep the glass engine's timings, as in Sear. No motion under `prefers-reduced-motion` (verified).
- Path B: Tailwind's preflight is also applied to the scope element's own `::before`/`::after`.
- Hooks never throw outside `ThemeProvider` (Sear's Navbar crashed without its provider).

## 0.4.0-dev.26 (2026-11-03, Phase 26 Lead pre-work)
- `canImport(meta, roles, level0)`, `canExport(roles, level0)`, `readableFields(fields, levels)` in `@solvfast/ui/frappe`
  (Desk `model.js:434-450`, server `permissions.py:600-615`): missing roles / meta / rights deny.
- `DocTypeMeta.allow_import`.
- Client file primitives: `api.download(method, args)` (a whitelisted method that streams a file; JSON refusals become
  `FrappeError`) and `api.uploadFile(file, filename, opts)` (`upload_file`, Desk's multipart fields). Stubbable through
  `createFrappeClient({ files })`; a client with a custom JSON `transport` and no `files` refuses file calls.
- `docs/release/COMPONENT-COMPLETION-MATRIX.md`.

## 0.4.0-dev.27 (2026-11-03, Phase 26 D — permissions)
- **Behaviour change (rule 9):** without `session.roles` nothing is granted beyond the server's `docinfo.permissions` of a
  saved doc; a NEW doc is denied (no fields, no Save) and `usePermissions().known` is false (FrappeForm shows "Read only").
  Pass `session.roles` to `FrappeProvider`. The Administrator USER keeps everything; the "Administrator" ROLE on another user
  is just its DocPerm rows.
- `bulkMenu`: Assign To gated on `read` (server: `assign_to.py:67-68`), was `write`.
- `permissionsKnown`, `isAdministrator` exported. `tests/parity/permissions-matrix.test.tsx` (31 tests, SIMULATED).
- `docs/release/PERMISSION-AUDIT.md`.

## 0.4.0-dev.28 (2026-11-03, Phase 26 C — list Import/Export)
- `FrappeListView`: list menu with **Import** (only when `canImport`; `onImport` or navigation to Data Import) and
  **Export** (only when `canExport`) → `FrappeExportDialog` → server `download_template` (Desk's Data Exporter request;
  the file comes from the server, never from client data). Props `onImport`, `menu`, `ioLabels`. Row checkboxes stay
  opt-in (`selectable` / `bulk`), unchanged from dev.27.
- `startDataImport` and friends reproduce Desk's Data Import call sequence (`savedocs` → `upload_file` → `savedocs` →
  `get_preview_from_template` → `form_start_import`), `useImportStatus` polls `get_import_status`. No preview grid / column
  mapper yet (owner decision). **All verified against stubs only; nothing has run on a site.**
- Columns of permlevel fields the user cannot read are dropped (`restrictMetaToReadable`) when the roles are known.
- Bulk Delete outcome wording: "N requested — the server reports failures in its messages" (`delete_items` answers nothing).
- `docs/release/LISTVIEW-FRAPPE-PARITY.md`: verdict **not Frappe-compatible yet** (missing list in §5).

## 0.4.0-dev.29 (2026-11-03, Phase 26 B — showcase; light-mode popups)
- Light mode: popovers, menus, select lists, command palette, hover cards, dialogs and sheets are solid white
  (`--popover`), no backdrop blur. Dark mode unchanged.
- Showcase (repository only, not in the tarball): "Frappe layer" group with 10 sections on an in-browser simulated
  site, every section labelled SIMULATED; smoke test extended (61 sections × light/dark × en/ar, 38 interactive checks).

## 0.4.0-dev.30 (2026-11-03, Phase 27 E — source maps)
- Source maps no longer embed the TypeScript source (`sourcemapExcludeSources`); they keep line mappings and relative
  `src/` paths. `scripts/check-package.mjs` fails the build when a shipped map carries `sourcesContent` or an absolute
  source path. Packed size 846 kB → 524 kB.

## 0.4.0-dev.31 (2026-11-03, Phase 27 B — list query)
- Nested-set filter operators (Desk's labels: Descendants Of / inclusive / Not Descendants Of / Ancestors Of / Not Ancestors Of), offered
  only for Link fields to tree DocTypes, sent to the server unchanged; en/ar labels.
- Width-based column limit (Desk `list_view.js:375-457`), URL filters (read and write-back), report-view export
  (`export_query` through `api.download`; on a real site it writes an Access Log row) — functions and `useFrappeList`
  options; `FrappeListView` wiring follows in the actions merge.
- Generic `useListState`: `initialQuery`; visible columns follow changes in the columns' default visibility until the user
  picks columns (List View Settings arriving after the first render now apply).

## 0.4.0-dev.32 (2026-11-03, Phase 27 A + B + C merged)
- **Permissions (A):** `FrappeFormView` without a `permissions` prop grants nothing (read-only, "Read only" notice);
  Cancel All only when the cancel rights are known to be true; workflow transitions come from the server's
  `get_transitions` (client-side filtering without roles offers none); the Administrator user without a role list behaves
  as Frappe 15.110 (every role: `permissions.py:506-507`); `canImport` / `canExport` accept the session.
- **List actions (B):** Desk's full Actions menu in the selection bar — Print (`download_multi_pdf`, background above 25),
  Clear Assignment, Apply Assignment Rule, Add Tags, workflow bulk approval — plus **Export offered to everyone as Desk
  does** (the server refuses; the dialog shows it) and **Import navigating to the Data Import list**.
- **List query (B):** `FrappeListView` now **caps generated columns by window width by default**, as Desk
  (`list_view.js:432-444`; app-curated `columns` are never capped; `columnLimit={false}` opts out); `urlFilters`,
  `treeDoctypes`, `hideNameColumn` forwarded; "Export as report" (`export_query`) in the list menu when `canExport`.
- **Import (C):** `FrappeDataImport` — upload, the server's preview and warnings, column mapping (`template_options`),
  Start / Retry, server-confirmed result, import log, errored rows.
- All of the above is tested against stubs / the simulator only; nothing has run on a site.

## 0.4.0-dev.33 (2026-11-03, Phase 27 D — simulator permissions)
- `@solvfast/ui/frappe/testing` only: `createFixtureTransport(backend, { permissions })` evaluates permissions server-side
  (roles as `get_roles`, DocPerm rows, `if_owner`, User Permissions, sharing, permlevel stripping and reset, 403s on
  writes, workflow roles, assignment, `download_template` / `export_query` with `can_export`); seven `simScenario.*`
  builders (Administrator, full access, read-only, restricted DocType, restricted fields, User Permissions, unknown roles).
  Without the option the simulator behaves as before. Handlers for the dev.32 methods (Print, tags, assignment, workflow
  bulk, report export, Data Import). Files it returns are labelled SIMULATED and carry labels and the request only — no
  document values, no counts. The production `./frappe` entry never imports it (`check:boundaries`).

## 0.4.0-dev.34 (2026-11-03, Phase 27.5 — handoff fixes and polish)
- **Fix — custom `rowKey`:** bulk actions, the selection-bar Export and the workflow menu sent the list's UI row keys as
  Frappe document names. `FrappeListView` now resolves the selection through a key → `name` map of every row it has
  shown (selection across pages included) — `documentNamesForKeys`; an unresolvable key withholds the actions.
- **Date display:** an editable Frappe Date field shows the site's `date_format`, like its read-only display
  (`DateField` gained an optional display-only `formatDisplay`; the value stays `YYYY-MM-DD`).
- **Assign To dialog:** DS `DateField` ("Complete by", with its purpose), DS `Select` (Priority; "Default (Medium)" sends
  nothing, as before), DS `Checkbox` / `Input` / `Textarea`, visible labels and hints; payload unchanged.
- **Dark mode:** Saved Filters, Columns and the filter builder's popovers use the DS glass (they were near-black);
  light mode unchanged.
- **"Export as report"** is opt-in (`menu={{ reportExport: true }}`): Desk's List View has no such entry.
- **Polish:** CommentComposer uses the DS Textarea and a DS Popover for @mentions; focus rings and `type="button"` on
  plain buttons (sort headers, group toggles, total, indicator pills, section headers, alert dismiss); translated DS
  file picker in `FrappeDataImport`; checkbox labels dim with their checkbox; form section columns stack on phones.
