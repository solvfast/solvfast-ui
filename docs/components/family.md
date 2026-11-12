# Families — records that live in their type's DocType

A **family** is Sayr's inheritance: a **parent** DocType with one row per record whatever its type (`SRF Ticket`), a
**registry** with one row per type (`SRF Ticket Type`), and one **type DocType** per type (`SRF Ticket Refund Request`)
where that type's records are created and edited. The server does all of the family's work: creating a type's DocType,
copying the parent's fields onto it, writing the parent row, and deploying a type's Configuration (lifecycle, SLA
policy, assignment profile) when the type is saved. These components are the screens every family needs.

| Layer | What | Entry |
|---|---|---|
| Core (`src/record/`) | `FamilyTabs`, `FieldDesigner` (+ its layout helpers) | `@solvfast/ui` |
| Frappe (`src/frappe/family/`) | `FrappeNewFamilyRecord`, `FrappeFamilyRecord`, `FrappeTypeForm`, `useFamilyTypes`, `useFamilyRecord`, `fetchFamilyTypes`, `fetchFamilyRecord` | `@solvfast/ui/frappe` |
| Sayr (`src/sayr/`) | `SayrFieldDesigner`, `createSayrFieldDesignerAdapter` | `@solvfast/ui/sayr` |

**Status:** *Implemented* and *Simulated & tested* (`tests/family.test.tsx`, `tests/designer.test.tsx`). Not yet verified
in a browser against a real site; the Sayr adapter's reads were checked against Sayr's `doctype_deployment` answer on a
real site (shape only). Core and `./frappe` use stock Frappe methods only (`frappe.desk.form.load.getdoctype`,
`frappe.client.get_list` and what `FrappeForm` calls); Sayr's own methods are called only from `./sayr`.

---

## 1. Describing a family

Field names differ from family to family, so the app states them once. The defaults are Sayr's own (a registry Sayr
creates, the Record section Sayr adds to a parent).

```ts
import type { FamilyDescriptor } from "@solvfast/ui/frappe";

export const TICKETS: FamilyDescriptor = {
  parent: "SRF Ticket",
  registry: "SRF Ticket Type",
  typeDoctypeField: "ticket_doctype",   // registry: Link to DocType (default "type_doctype")
  labelField: "ticket_type_name",       // registry: English name (default: the row name)
  labelArField: "ticket_type_name_ar",  // registry: Arabic name, shown in Arabic when filled
  recordDoctypeField: "ticket_doctype", // parent: Link to DocType (default "inheritance_doctype")
  recordField: "ticket_record",         // parent: Dynamic Link (default "inheritance_record")
  typeField: "ticket_type",             // parent: Link to the registry (default "inheritance_type")
};
```

Optional: `descriptionField`, `iconField`, `colorField` (defaults `description`, `icon`, `color`, read only when the
registry has them), `enabledField` (default `enabled`; `null` offers every type) and `configurationFields` (default
`SAYR_CONFIGURATION_FIELDS`).

## 2. `FamilyTabs` (Core)

The two tabs above a family's pages. The package has no router: the app routes.

```tsx
<FamilyTabs
  active="types"
  onChange={(tab) => navigate(tab === "types" ? "/tickets/types" : "/tickets")}
  records={{ label: { en: "Tickets", ar: "التذاكر" }, icon: <Ticket className="h-4 w-4" /> }}
  types={{ label: { en: "Ticket Types", ar: "أنواع التذاكر" }, icon: <LibraryBig className="h-4 w-4" /> }}
/>
```

`records={false}` shows Types alone, for a family whose records are listed elsewhere (task types). Default labels
"Records" / "Types" (`famRecords`, `famTypes`).

## 3. `FrappeNewFamilyRecord`

A new record: the type first (enabled types that have a DocType, in both languages), then that type's form, then Cancel
and Create. The type's own fields are shown in one list (its Tab Breaks are left out). Changing the type after filling
fields asks first. The record is created in the type's DocType; Sayr writes the parent row.

```tsx
<FrappeNewFamilyRecord
  family={TICKETS}
  onCreated={(doc) => navigate(`/tickets/${encodeURIComponent(String(doc.name))}`, { replace: true })}
  onCancel={() => navigate("/tickets")}
  renderTypeIcon={(type) => <TypeIcon type={type} />}
  createClassName="bg-brand-orange text-white"
  labels={{ type: { en: "Ticket Type", ar: "نوع التذكرة" }, create: { en: "Create Ticket", ar: "إنشاء التذكرة" } }}
/>
```

`defaultType` preselects a type (a "Create ticket" button on a type). Every string can be replaced through `labels`
(`type`, `chooseType`, `chooseTypeFirst`, `noTypes`, `switchWarn`, `switchConfirm`, `switchKeep`, `cancel`, `create`).

## 4. `FrappeFamilyRecord`

A record opened from its parent row: the parent row names the type DocType and the record, and the record's form opens
there, where it is edited. Every other `FrappeForm` prop passes through (`menu`, `onSaved` …).

```tsx
<FrappeFamilyRecord family={TICKETS} name="TKT-00042" menu={{ onDeleted: () => navigate("/tickets") }} />
```

A missing row shows "This record was not found." (`notFound` replaces it). `useFamilyRecord(family, name)` gives the
same lookup (`{doctype, name, type}`) for a page title.

## 5. `FrappeTypeForm`

A type: the registry's own form, so every field the registry has is shown (an app's Category included).

```tsx
<FrappeTypeForm family={TICKETS} name={name} onSaved={(doc) => navigate(`/tickets/types/${doc.name}`)} />
<FrappeTypeForm family={TASKS} name={name} configuration={false} />
```

- **Configuration** (Linked Lifecycle, SLA Policy, Assignment Profile) is shown by default; the server deploys what they
  name onto the type's DocType when the type is saved. `configuration={false}` hides it.
- **`designer`** renders under the form once the type has its DocType (a saved type; a new type has none until it is
  saved, so a new type has no Form section until its first Save): `designer={(typeDoctype, ctx) => <MyDesigner …/>}`.
- **One Save.** `ctx.onPendingChange` hands the designer's unsaved changes to the type's form (`FrappeForm` `alsoSave`):
  the type shows "Not Saved" while they are pending, and its Save saves the type first, then the designer. With only
  designer changes, the type's own validate / before_save events and mandatory check still run, but nothing is sent
  for the type. A failed designer save shows as the form's error after the type itself has saved; the designer keeps
  its state (a saved type is not remounted).

## 6. Data helpers

`useFamilyTypes(family)` / `fetchFamilyTypes(api, family)` return `FamilyType[]` — `{name, label: {en, ar}, description,
doctype, icon, color, row}` — for a picker of the app's own. `fetchFamilyRecord(api, family, name)` throws
`Error("not-found")` when the row is missing or names no record.

## 7. `FieldDesigner` (Core) — a type's Form section

The fields of a type's form as tabs → sections → columns, with a properties panel beside it (the reference's layout):
click a field, section or tab to see it in the panel.

| Card | What it can do |
|---|---|
| Standard field (lock) | Placed anywhere; never removed or edited. |
| Locked field (shared from the family parent; a lock on its card) | Moves to any position, section or step (drag, the grip's arrow keys, or the up / down buttons); never removed, renamed or given another field type. |
| A field set's field | Moves and is removed; its settings stay in the Field Library (the set's own deploy, linked to the set). |
| A field added on the form | Moves, is removed, and is edited in the panel with every property a field set's field has. |

- **Add field** (each column): the field types the adapter's registry offers (`fieldTypes`), then the inspector
  (`FieldInspector`): type, title (in the current language), description, placeholder, required, default, choices,
  link target and its filters, the field deciding a dynamic link / image, data kind, rating scale, decimals, unique,
  max length, min / max, refuse negatives, conditions (show / required / read-only when — they may name any field of
  the form), auto-fill from a record link on the form, and display (list view, filter, global search, bold, hidden,
  read only, translatable). Only what the type takes is shown (the registry's `props` per type); changing the type
  keeps the title, help text, conditions and display and drops the rest. Its name in conditions (`key`) comes from
  the English title until the field is saved, then stays.
- **Deploy a field set** (toolbar): in the panel, a searchable link field over the published field sets (each with
  its description and field count), then its fields not yet on the form (all ticked), added as a new section at the end
  of the tab (default) or into the last section.
- **Add section** / **Add tab** (Add step in wizard mode): named in the panel. Removing one the type added moves what
  it held to the one before.
- **Saving.** Standalone, the designer has a Save form button. With `onPendingChange` (a host such as `FrappeTypeForm`)
  it has none: the host's Save calls the designer's `save()`. Unfinished fields (no title, no choices, no target)
  select the first one and refuse; removing fields that hold values asks first (how many records); removing every
  added field asks before everything added is withdrawn. Values always stay in the database.

It reads and writes through an adapter (`FieldDesignerAdapter`: `load`, `listFieldSets`, `fieldsOf`, `save`; optional
`sectionOf`, `makeTab`, `makeSection`, `fieldTypes`, `linkTargets`, `linkTargetFields`, `removalImpact`), so it knows
no backend. Keep the adapter stable (`useMemo`). An item the form defined carries `own: true` and, for a field, its
`definition` (`FieldDefinition`).

```tsx
<FieldDesigner adapter={adapter} labels={{ fdTitle: { en: "Ticket form", ar: "نموذج التذكرة" } }} />
<FieldDesigner adapter={adapter} onPendingChange={ctx.onPendingChange} wizard={ctx.wizard} />
```

The layout model is exported for adapters and tests: `designerLayout` / `designerItems` (core names of `toLayout` /
`fromLayout`), `designerPreviousId`, `designerKeys` (`ownKeys`: every added field's key, as the adapter will save it),
`kindOfFieldtype`; `src/record` also exports `moveItem`, `stepItem`, `insertSectionAfter`, `appendTab`,
`removeSection`, `removeTab`, `FieldInspector`, `INSPECTED_PROPERTIES` (the registry properties the inspector has a
control for: all but `collapsible`, a Section Break's).

## 8. `@solvfast/ui/sayr` — the Field Library adapter

`SayrFieldDesigner doctype` is `FieldDesigner` over `createSayrFieldDesignerAdapter(api, doctype, {language})`. A type's
form is the `Sear Field Deployment` named after its DocType: its rows place a field set's fields (linked to the set)
and the form's own fields, whose definitions it keeps in `own_fields` (a field set's field schema; no field set is
created). Saving it deploys it.

| Step | Sayr method |
|---|---|
| Load the form (its fields in order, the family's shared ones, the deployed rows, the own definitions) | `sear_product.apis.field_library.deployments.doctype_deployment` |
| Field types for added fields | `sear_product.apis.field_library.field_sets.field_type_registry` |
| Link targets / a target's fields | `…field_sets.link_target_doctypes` / `…field_sets.link_target_fields` |
| Published field sets / one set's fields | `frappe.client.get_list` / `frappe.client.get` on `Sear Field Preset` |
| Save the form (skipped when no row and no definition changed) | `frappe.client.insert` / `save` on `Sear Field Deployment` (`fields` + `own_fields`) |
| Keep a family type's whole order, shared fields included | `…deployments.save_field_order` (after the deployment, so new rows resolve) |
| Everything added removed | `…deployments.withdraw_deployment` |
| Records holding values in removed fields | `…deployments.deployment_removal_impact` |

Every added row is anchored by Sayr's tokens, which the server resolves: `@<set>::<key>`, `@<set>::__section`,
`@own::<key>`, `@section::<label>`, `@tab::<label>` (`sayrToken`). `definitionOfRow` / `rowOfDefinition` map Sayr's row
to `FieldDefinition` and back (only the properties the type takes are sent). Needs the Sear Platform Administrator
role; without it, and for a DocType Sayr cannot deploy on, the section shows why instead of the tools. A field set
that changed since it was saved shows a note to redeploy it from the Field Library.

## 9. Wizard mode and a new type's defaults (0.7.0-dev.9)

- **Wizard mode** is a Check on the registry (`wizardField`, default Sayr's `wizard_mode`). `FamilyType.wizard` reads
  it. `FrappeNewFamilyRecord` then walks the type's tabs as ordered steps: a `Stepper`, Back / Next, Create on the last
  step (the form's tab bar is hidden; the mandatory check still covers every step on Create). The steps are the type's
  tabs in its form's order, so moving fields and tabs in the Form section reorders the steps. Off, the fields are one
  list as before.
- `FrappeTypeForm` keeps the Wizard mode field off the type's form and hands it to `designer` as
  `context.wizard = { on, onChange }`; `onChange` sets it on the type, saved with the type's Save.
  `FieldDesigner`'s `wizard` prop shows it as a switch and labels the tabs "Step N · …".
- `FrappeTypeForm` `defaults`: the values a **new** type starts with (`newDocDefaults.routeOptions`), e.g. an app's
  default lifecycle, SLA policy and assignment profile. Nothing is applied to a saved type.

```tsx
<FrappeTypeForm family={TICKETS} name={name} defaults={defaults}
  designer={(doctype, { wizard, onPendingChange }) => <SayrFieldDesigner doctype={doctype} wizard={wizard} onPendingChange={onPendingChange} />} />
```

`FrappeFormView` / `FrappeForm` gained what the steps need: `activeTab` (the tab shown, by key), `hideTabBar` and
`onTabsChange(tabs)` (the visible tabs, key + label).

## 10. The Appearance section (0.7.0-dev.10)

`FrappeTypeForm` draws the registry's icon field as **`IconColorPicker`** (Core): a preview, the icon grid (Lucide names,
stored as text, "No icon" first) and the colour swatches, the same picker Sayr Studio uses for teams, units and skills.
The colour field and Sayr's `appearance_column` leave the form; picking an icon with no colour yet also picks the first
colour. `appearancePicker={false}` keeps the plain fields. `APPEARANCE_ICONS` / `APPEARANCE_ICON_NAMES` /
`APPEARANCE_COLORS` are the choices; each icon is imported by name, so an app bundles only these.

`FrappeFormView` / `FrappeForm` `renderField(df, {value, doc, setValue})` lets a host draw any field its own way
(return `undefined` for the form's own control).

## 11. Fields added on a type's form (0.7.0-dev.11)

The Form section works like Customize Form: fields are added on the type itself with every property of a field
set's field (§7), field sets are deployed onto it as in Sayr Studio (§8), and the type's one Save saves everything
(§5). `FrappeFormView` / `FrappeForm` gained `alsoSave: { dirty, save }` for this: changes kept outside the document
that count as unsaved and are saved after it.

## 12. `SayrRecordPage` — a record opened as a page (0.7.0-dev.13)

`@solvfast/ui/sayr` · `src/sayr/SayrRecordPage.tsx`. A Sayr record (a family record in its type's DocType, or any
DocType Sayr governs) as a page: a header card, the record's form, and a side rail.

```tsx
import { SayrRecordPage } from "@solvfast/ui/sayr";

<SayrRecordPage doctype={record.doctype} name={record.name} typeLabel={record.type}
  onBack={() => navigate("/tickets/tickets")} backLabel="Tickets"
  menu={{ onDeleted: () => navigate("/tickets/tickets", { replace: true }) }} />
```

Every other prop is `FrappeForm`'s and goes to the form.

- **Header card**: the title (title field, else the name), `#name`, the status (the lifecycle state, coloured by its
  phase), the creator's full name (never the user id) and when it was created, and `typeLabel` as a chip. Save, the
  workflow buttons and the "⋯" menu stay in the form's toolbar, with the Back button (`onBack`, `backLabel`) at its start.
- **Tabs**: the type DocType's own Tab Breaks, as a full-width bar (`tabBar="record"`); whatever tabs the DocType has.
  `oneForm` (0.7.0-dev.15) shows every field in one form instead, for a type without wizard mode.
- **Rail**, in this order:
  1. **Lifecycle** (always shown): the states the record went through (Frappe's workflow log and versions), the current
     one, and every next action of `record_state`. A next action runs `execute_transition`; it is disabled while the
     form has unsaved changes, and the form is read again afterwards (the result or the refusal shows under the rail). "View full lifecycle" opens `lifecycleHref(key)`
     in a new tab (default: Sayr Studio's builder, `/sayr-framework/workspace/build/sear_studio/life_cycles/<key>`).
     No lifecycle: "No lifecycle on this type", or, when the type has one but the record predates it, says so.
  2. **Assignment**: `FrappeAssignTo` (Frappe's ToDo assignment). The dialog's Comment starts as the assignment
     deployment's ToDo description when it has one (else the title field), and Priority offers Low / Medium / High.
  3. **SLA** (read only): the policy, its level, the clock's status (Running, Paused, Fulfilled, or Breached when a
     target was missed), the first response and resolution due (or met) times, the priority and the working hours.
     "No SLA deployed", or "No SLA clock on this record" when the record has no priority or predates the deployment.
  4. **Playbook**: the checklist of the current status (`open_checklist`; it is created on first open), ticked with
     `tick_step`. "No playbook for this status" otherwise.
  5. **Tasks**: the record's ToDos (assignee, status, priority, date); more than five scroll.
  6. **Pinned Notes**: the record's comments (`FrappeComments`).
  7. **Attachments**: `FrappeAttachments`.
  
  Then Created by / Last edited by. **Customize sections** hides or shows cards 2–7, per DocType, in this browser
  (`localStorage`, key `sf-record-rail:<doctype>`, or `railStorageKey`).
- `formProps(type)` (0.7.0-dev.22, also on `FrappeNewFamilyRecord`): the chosen type's form gets `events`,
  `childEvents` and `renderField`. With `FamilyDescriptor.extraFields` (registry columns read into `FamilyType.row`) a
  new record can start from its type's values, e.g. a price.
- `extraCards` (0.7.0-dev.21): the app's own cards, `{ id, label, icon, render(doc) }`, placed after Playbook, listed in
  Customize sections and hidden like the others (`railOrder(extraCards)` gives the order). ServeFast passes the
  record's CRM Contact and Organization. `SayrNewRecordPage` takes the same prop and shows them as "Available after the
  record is created".
- **Data**: one call to Sayr's `sear_product.apis.tickets.tickets.record_page` (header, lifecycle, SLA, the assign
  comment, ToDos); assignment, comments and attachments read Frappe's docinfo.

What it added elsewhere (additive, defaults unchanged): `FrappeFormView` / `FrappeForm` `header`, `toolbarStart` and
`tabBar: "record"`; `LifecycleRail` `onSelectNext`; `useRefreshDoc` (Frappe layer); `AssignDialog` `threePriorities`; `FrappeAssignTo` `comment` and
`threePriorities`. Messages: the `rp…` block (`theme/messages-ws/recordPage.ts`).

## 13. `SayrNewRecordPage` — a new record laid out like the record page (0.7.0-dev.14)

`@solvfast/ui/sayr` · `src/sayr/SayrNewRecordPage.tsx`. `FrappeNewFamilyRecord` with `layout="record"` and a rail:

```tsx
<SayrNewRecordPage family={TICKETS} onCreated={(doc) => navigate(`/tickets/tickets/${doc.name}`)} onCancel={back}
  backLabel="Tickets" labels={{ title: { en: "New Ticket", ar: "تذكرة جديدة" }, create: { en: "Create Ticket", ar: "إنشاء التذكرة" } }} />
```

- **Top row**: Back (`onCancel`, `backLabel`) and Create / Next / Back (a wizard type's steps).
- **Header card** (`RecordHeaderCard`): `labels.title`, "Not Saved", the signed-in user and today, and the type picker.
  Changing the type after filling fields still asks first.
- **Form** (0.7.0-dev.15): a type without wizard mode is one form; a wizard type walks its steps with Back / Next.
- **Rail** (`aside(type)`), after a type is chosen, from Sayr's `type_preview(doctype)`: Lifecycle (its title, the status a
  record starts in, how many statuses, "View full lifecycle"), Assignment (the deployed profiles and their strategy),
  SLA (the policy, its level, first response and resolution per priority, the working hours). Playbook, Tasks, Pinned
  Notes and Attachments say "Available after the record is created". Before a type is chosen every card asks for one.
  "Customize sections" uses the record page's storage key, so a hidden card stays hidden on both pages.

## 14. Wizard mode decides the form's shape (0.7.0-dev.15)

| Wizard mode | Type's Form section (`FieldDesigner` with `wizard`) | New record | Record page |
|---|---|---|---|
| Off | One list: every section in order, no tabs, no Add tab | One form | `SayrRecordPage oneForm`: one form |
| On | Steps: "Step N · name", Add step, rename / remove a step the type added; drop a field on a step to move it there | Steps with Back / Next | The steps as the full-width tab bar |

Turning wizard mode off removes the steps added on the type (the type's Save saves it): their fields join the step
before, in the same order. Steps that belong to the DocType itself (Sayr's own tab, marked `native`) stay, and are just
not shown as tabs. A host passes `oneForm` from the type's `wizard_mode`.

## 15. Field cards show their control (0.7.0-dev.16)

In the Form section (`FieldDesigner`), every field's card draws its control as it will look on the form, from its
Frappe fieldtype or its Field Library type (`FieldPreview`, also exported on its own): a text box, a checkbox beside the
label, an editor, a dropdown, a link search, a drop zone, a map, a table grid, rating stars, a date or number box. The
preview is decorative: select and drag the card as before.

## 16. "Not sure? Find the right type" (0.7.0-dev.18)

`SayrNewRecordPage decisionTree="SEAR-DT-00001"` shows the link under the type picker (none: hidden). It opens
`SayrTypeFinder`, which walks the tree (Sayr Studio › Routing) through `decision_tree_walk`: a question with its answers,
Back and Start over. The walk ends on an outcome (a registry and a type): when that is this family's registry and one of
the offered types, "Use this type" picks it (asking first if fields were filled, as the picker does); otherwise a warning
says the answers lead to a type that is not here, and the type stays empty. The host decides which tree applies (e.g. a
Configuration default). `FrappeNewFamilyRecord`'s `typeHelp` is the slot it uses.

