# Form builder — design a type's form

`FormBuilder` designs the form a new record of a type shows: **steps** (wizard mode) → **sections** (side by side,
1–4 field columns) → **fields** (28 types, each with its properties). It is the SOLV FAST Field Library / CRM type-form
builder as a package capability: the CRM's Lead, Deal and Task Type pages use it. Inside a type page it sits in
`TypeFormSection` (docs/components/type-config.md); it also works on its own.

| Layer | What | Entry |
|---|---|---|
| UI (`src/record/form-builder/`) | `FormBuilder`, `FieldTypePicker`, `FormFieldInspector`, `FormFieldPreview`, `WizardToggle`, `SourcePicker` | `@solvfast/ui` |
| Registry | `FORM_FIELD_TYPES`, `FORM_FIELD_GROUPS`, `fieldTypeInfo`, `pickFieldTypes`, `tableColumnTypes` | `@solvfast/ui` |
| Model (pure) | `newFormField`, `normalizeForm`, `setWizard`, `addSection`, `moveField`, `placeAside`, … | `@solvfast/ui` |

**Status:** *Implemented* and *tested* (`tests/form-builder.test.tsx`); in a browser in the showcase (*Type
configuration*, *FormBuilder on its own*) and in the CRM lab build. The builder holds no data and imports nothing of an
app: the app passes the form, its objects, its sources and its own controls.

---

## 1. Use

```tsx
import { FormBuilder, normalizeForm, type FormBuilderValue } from "@solvfast/ui";

const [form, setForm] = useState<FormBuilderValue>(() => normalizeForm(stored));   // { wizard, steps }

<FormBuilder value={form} onChange={setForm}
  lockCore entityLabel={{ en: "Asset", ar: "أصل" }}            // standard fields: placed anywhere, never removed / edited
  linkTargets={objects} sources={sources}                     // the app's data (below)
  renderCondition={(p) => <MyAssistedCondition {...p} />} />  // optional: the app's own controls
```

In a type page:

```tsx
<TypeFormSection issues={{ conflicts }} library={{ groups, onImport }}
  builder={{ value: form, onChange: setForm, lockCore: true, entityLabel, linkTargets, sources }} />
```
The section's wizard switch drives the builder (one switch); `planFieldImport` + `appendImportedSections` copy library
fields into the same value.

## 2. The model

```ts
interface FormBuilderValue { wizard: boolean; steps: FormBuilderStep[] }
interface FormBuilderStep { id; title; titleAr?; description?; icon?; showWhen?; sections: FormBuilderSection[] }
interface FormBuilderSection { id; title?; titleAr?; description?; descriptionAr?; columns: 1|2|3|4; rowId?; collapsible?; startCollapsed?; system?; role?; fields }
interface FormBuilderField { id; type; title; titleAr?; description?; required; options?; placeholder?; defaultValue?; linkTarget?;
  linkFilters?; unique?; maxLength?; minValue?; maxValue?; showWhen?; requiredWhen?; readOnlyWhen?; fetchFromField?; fetchFromSource?;
  fetchOnlyWhenEmpty?; inListView?; hideInPrint?; editableWhenClosed?; standardFilter?; globalSearch?; bold?; hidden?; readOnly?;
  translatable?; column?; fullWidth?; core?; columns? (table); rowsFrom?; sourceId?; optionsFrom?; … }
```
The SOLV FAST Field Library / CRM shape: a stored form loads unchanged, and extra properties an app keeps pass through
(the components are generic over the section type). Wizard off = one implicit step; turning it on makes each section a
step, off joins them — nothing is lost. Sections sharing a `rowId` sit side by side (up to 3; the row caps field columns:
1 alone → 4, 2 → 2, 3 → 1). `normalizeForm` fixes up a stored form (rows, column hints, caps; a legacy flat field list
becomes one section).

Every operation the UI performs is exported as a pure function on `steps` (tests, server-side migrations, an app's own
UI): `addSection`, `deleteSection(mode: "move" | "with-fields")`, `moveSection`, `placeAside`, `setSectionColumns`,
`nudgeSection`, `addField`, `removeField`, `updateField(…, lockCore)`, `moveField`, `nudgeField`, `addStep`,
`updateStep`, `reorderStep`, `removeStep(mode: "move" | "with-sections")`, `setWizard`. Standard (`core`) fields are
never removed — a deleted section or step hands them to a surviving section.

## 3. Interactions

| Element | Pointer | Keyboard |
|---|---|---|
| Field | click: its properties; drag the handle onto a field (before it) or a column's "Add field" slot (end of that column), in any section | handle + Arrow up / down |
| Section | header: its properties; drag the handle onto a section (stacks before it), onto its start / end edge (side by side), or onto a step (moves to it); column buttons; trash → move fields to… / delete with fields / cancel | handle + Arrow up / down |
| Step | pill: its properties (title, description, icon, show-when, delete → move sections to… / delete with sections); drag onto another pill | pill + Alt + Arrow left / right (follows reading direction) |
| Add | "Add field" in a column → **Add a field** panel (search, groups); "Add section" (end) / "Add section here" (between, on hover or focus); "Add step" | — |

### Previews and moving without dragging

- **Interactive previews** (default): each field on the canvas is its real control to try (type, pick, tick, rate,
  format text). Those values are a preview: they live only in the canvas, start from the field's default value, start
  over when its type or default changes, and never reach `value` — the field's configuration is the panel's (which says
  so). `interactivePreviews={false}` draws decorative previews instead.
- **Every drag has a non-drag path**: a field's panel → **Move to** (section, column); a section's panel → **Move to
  step** (wizard), **Place beside** (a section of its step, or its own row); handles → Arrow up / down (fields, sections),
  Alt + Arrow (steps).
- **Browsers**: drag and drop is HTML5 drag; handles are focusable `role="button"` spans (Firefox starts no drag from a
  draggable `<button>`). Verified in Chromium; where a browser's drag fails, the panel controls and the keys do the same.

## 4. Field types and properties

`FORM_FIELD_TYPES` — Text Input, Long Text, Rich Text · Dropdown, Radio Buttons, Multi Select, Checkbox, Rating, Color
· Number, Decimal, Currency, Percent, Duration · Date, Date & Time, Time · Email, Phone · File Upload, Image Upload,
Signature · Record Link, Map Location, Barcode · Heading · (advanced) Table, Display Value. Each entry: `label` and
`description` (en / ar), `icon`, `group`, and `caps` — which property sections the type takes:

| Section | Shown when | Controls |
|---|---|---|
| Basics | always | title (current language), helper text (`description`), placeholder / search hint (`placeholder`), required (`required`), default value (`defaultValue`, a control per type) |
| Value from | Display Value | calculated source |
| Table | Table | rows from the user / a source; columns: name, type (one nested table level), user-entered or derived (bound to a source), options (static or a live list) |
| Choices | `choices` | options (add / rename / remove; Arabic labels and a live source with `advanced`) |
| Link target | `linkTarget` | object (`linkTargets`), "Limit the records shown" inline rules (field · is / is not / contains / greater / less · value) |
| Validation | `unique` / `maxLength` / `minMax` | unique, max length, min / max |
| Conditions | always | show when; required when and read-only when (`conditions: "full"`) |
| Auto-fill | `autofill` and a record link in the section | which record link, which field of it, only when empty |
| Display | always | list view, hide in print, editable when closed, use as filter, global search, bold, hidden, read only, translatable (`display: "hidden"` → hidden only) |

Narrow or reword the registry with your own list (`pickFieldTypes([...])`, or spread and change entries).

## 5. What the app provides

| Prop | What |
|---|---|
| `linkTargets` | `{ value, label, fields?, records? }[]` — objects a Record Link may point at, their fields (filters, auto-fill) and a few records (default value) |
| `sources` | `{ id, label, kind: "scalar" \| "list" \| "options", group?, options?() }[]` — calculated sources |
| `stepIcons` | Lucide icons by name (default: the package's appearance icons) |
| `renderCondition`, `renderTitleInput` | the app's own condition / title controls (e.g. an assistant) |
| `renderFieldProperties`, `renderSectionProperties` | more controls for a field / section (an app's own properties) |
| `lockCore`, `entityLabel` | standard fields locked; the record word in the notes |
| `advancedFieldTypes`, `maxColumns`, `fieldTypes` | structured types and 4 columns; the column cap; the registry |
| `wizardToggle` | the builder's own wizard switch (default on; `TypeFormSection` shows its own) |
| `labels` | reword any `fb*` message |

## 6. Look

Glass surfaces: the builder's root carries `sf-form-builder` (and `TypeConfigPage` `sf-type-config`), which apply the
package's record-page surface rules (glass.css): rounded card fills become the airy glass pane in **both** themes —
the CRM's look — and band strips the top bar's glass. Needs glass.css (as the record page does). Colours are the theme's
`primary` / `muted` / `border` tokens.

## 7. Differences from the Field Library builder it replaces

- Typing in a field's title keeps focus, and a property section stays open after an edit (the Field Library's panel
  was re-created on every change, so its title input lost focus after one keystroke and sections closed).
- Keyboard: sections (Arrow keys) and steps (Alt + Arrow) can also be moved without a mouse; drag handles are buttons.
- A standard field's Required switch is shown disabled (it was a switch that snapped back on).
- Choosing a field or section while the Add a field panel is open shows that element (the panel used to stay open).
