# Frappe RecordPage adapter — boundary document (Run 1, item I2)

Status: **proposal for the owner's review. No hooks are implemented until this document is approved.**
Package 0.8.0-dev.5 (`feat/0.8.x/record-page`). Reference: `docs/components/record.md` §11 (RecordPage, Core) and §10.6
(`FrappeFormView aside`); §11.6 lists the adapter as "Not yet".

## 1. The question

Core ships the record page as parts (`RecordPage`, `RecordHeaderCard variant="page"`, `RecordTabs`, `RecordEditSession`,
`RecordEditableCard`, `RecordSectionCard`, `RecordRail`, the About cards). An app composes them (§11.5). Frappe ships the
Desk form as one view (`FrappeFormView`, 951 lines) over the foundation hooks (`FrappeForm`). The adapter must let a
Frappe app compose **the CRM-style record page from a Frappe document** without:

- a monolithic `FrappeRecordPage` component that decides the page's content (forbidden: "no monolith");
- a second save pipeline that diverges from Desk's (validate → before_save → mandatory → savedocs → after_save → refresh);
- Core knowing anything about Frappe.

## 2. Ownership

| Concern | Owner | Where |
|---|---|---|
| Page chrome, header, tabs, cards, rail, page-level Save session, unsaved-leave dialog | **Core** (unchanged) | `src/record/RecordPage.tsx`, `RecordEditSession.tsx`, … |
| Loading the document, meta, docinfo, permissions; the save / submit / cancel pipeline; form events; mandatory check; field controls bound to a document; workflow; indicator | **Frappe adapter** | `src/frappe/**` (existing) + the hooks below |
| Which fields go on which card, card titles and icons, tabs, rail sections, quick actions, business rules, routing | **Application** | the app |

## 3. Two designs considered

**A. Headless form controller (recommended).** Extract the document state and the save pipeline that live inside
`FrappeFormView` today into one hook, `useFrappeFormController`, and make `FrappeFormView` a consumer of it. The record
page then uses the same controller through small binding hooks. One pipeline, two renderings (Desk form, record page).

- Cost: a refactor of `FrappeFormView` (state, `docStore`, `save`, `checkMandatory`, events, undo, timestamp conflict,
  amend / cancel). Guarded by the existing form suites (`frappe-form*.test.tsx`, `parity/mandatory`, `FV.*` rows: several
  hundred assertions), which must pass unchanged.
- Risk: medium (largest component in the adapter). Mitigation: extract without behaviour change in one commit, with the
  suites green, before any record-page code.

**B. Wrap `FrappeFormView` (no refactor).** Render `FrappeFormView` inside `RecordPage` with `header`, `toolbarStart`,
`tabBar="record"`, `aside` (all exist today) and `hideToolbar`. Cheap, but the body stays Desk's section / column layout:
the CRM's card-per-region editing (`RecordEditableCard`, page-level Save pill) cannot be expressed, so it does not deliver
the CRM record page — only a Desk form in record-page chrome. It is already possible today (§10.6) and needs no new API.

Recommendation: **A**, with B documented as the zero-cost option that already exists.

## 4. Proposed API (design A) — hooks, no page component

All in `@solvfast/ui/frappe`. Names are proposals.

```ts
// 1. The controller (extracted from FrappeFormView; FrappeFormView uses it too)
const form = useFrappeFormController({ doctype, name, events?, childEvents?, newDocDefaults? });
// form: { status: "loading" | "error" | "ready", error?, bundle, doc, docinfo, permissions, dirty,
//         frm: FormController, setValue, save(action?), cancel(), amend(), reload(), actions: FormAction[],
//         indicator: { label, tone, color? }, workflow }

// 2. Header props for Core's RecordHeaderCard variant="page"
const header = useFrappeRecordHeader(form, { titleField?, facts?: (doc) => Fact[] });
// → { title, name, statusNode props (resolveIndicator), avatar image (meta.image_field), notSaved }
<RecordHeaderCard variant="page" {...header} actions={appQuickActions} />

// 3. A field bound to the controller, for the app's cards (reuses FrappeField: same controls, depends_on, permissions)
<FrappeRecordField form={form} fieldname="deal_value" />

// 4. The page-level Save session bound to the controller's pipeline
const session = useFrappeRecordEditSession(form);
// → props for Core <RecordEditSession pageSave commit={session.commit} onDirtyChange=…>;
//   commit(patches) = form.setValue(patches) then form.save() — the Desk pipeline, Missing Fields dialog included.

// 5. Toolbar pieces (existing components, wired to the controller)
<FrappeWorkflowActions variant="actions" … beforeApply={form.beforeWorkflow} afterApply={form.afterWorkflow} />  // K1: the same checks as FrappeForm
<FrappeRecordMenu … />   // already standalone
<RecordSaveButton />     // Core, driven by the session
```

The app composes the page exactly as in §11.5, replacing its own state and save with these hooks. Rail sections reuse
the existing standalone adapters (`FrappeAssignTo`, `FrappeAttachments`, `FrappeWorkflowActions variant="rail"`,
`FrappeTimeline`).

## 5. Rules the adapter keeps

1. **One pipeline.** Saving from the record page runs exactly FrappeFormView's sequence (events, mandatory, savedocs,
   `after_save`, `refresh`, timestamp conflict → Reload banner). No direct `frappe.client.set_value` from cards.
2. **Fields the app does not place still count.** The mandatory check covers every required field of the DocType; a
   missing field that is not on any card is reported by label in the Missing Fields dialog (Desk's behaviour) — the app
   is told which card should hold it via `onMissing(fieldnames)`.
3. **Permissions deny when unknown** (rule 9), as `FrappeFormView`.
4. **No Desk layout inference.** The adapter never decides which fields go on which card; Tab / Section Breaks are not
   mapped to cards automatically (an optional helper `sectionsOf(bundle)` may list them for an app that wants to).
5. **Core stays Frappe-free**: the boundaries check (`scripts/check-boundaries.mjs`) must keep passing.

## 6. Out of scope for I2

- Desk features not on the CRM page (print-format preview inside the page, Connections tab: available via
  `FrappeConnections` in a tab the app adds).
- Realtime "document changed" (C-79 adds it to the form; the controller inherits it).
- Real-site validation (I5, blocked on E5).

## 7. Decisions requested from the owner

1. **Design A (extract `useFrappeFormController`, refactor `FrappeFormView` to use it) or B (wrap only, no new API)?**
   Recommended: A.
2. **Hook names and the split above** (controller, header, field, session; toolbar pieces reused). Recommended: as listed.
3. **Missing required fields not placed on a card**: Desk's dialog listing them by label (recommended), or refuse to save
   without the dialog.
4. **Sequencing**: implement after Run 1 step 7, in this run, once approved (recommended), or in a later run.

## 8. Acceptance (when implemented)

- The extraction commit changes no assertion in the existing form suites and they all pass.
- Simulator tests: a record page composed with the hooks loads a document, edits two cards, saves once through
  `savedocs` with the events in Desk's order; a missing mandatory field opens Missing Fields; a 417 shows Reload; a
  read-only user gets no edit; workflow transitions from the header menu run the mandatory check and the events.
- A showcase page composes a CRM-style record page on the simulator (package components only, no CRM content).
- Real site: pending (I5).
