# Type configuration — a type's settings page

Apps that sort records into **types** (Lead Type, Deal Type, Task Type, Asset Type, Ticket Type…) need one page per type
where an admin names it, gives it an icon and colour, links its settings (lifecycle, SLA, assignment…), designs the form
a new record of that type shows, and saves. These parts are that page. They hold **no data and no business rules**: the
app passes the values, its own controls, its labels, its permissions and its save; the package gives the layout, the
field-library picker, the import rules, the label checks and the save gate.

| Layer | What | Entry |
|---|---|---|
| Core UI (`src/record/TypeConfig.tsx`) | `TypeConfigPage`, `TypeConfigSection`, `TypeAppearanceSection`, `TypeSettingsGrid`, `TypeSettingField`, `TypeFormSection`, `TypeWizardToggle`, `TypeFormIssues`, `TypeFieldPicker`, `TypeConfigFooter`, `useFieldImportSummary` | `@solvfast/ui` |
| Core rules (`src/record/typeConfig.ts`) | `planFieldImport`, `appendImportedSections`, `fieldImportStatus`, `typeFormConflicts`, `typeFormReservedWarnings`, `typeFormFields`, `typeSaveBlock`, `normLabel` | `@solvfast/ui` |

**Status:** *Implemented* and *tested* (`tests/type-config.test.tsx`, including a whole non-CRM "Asset Type" page built from
the parts). First consumer: the CRM's Lead Type, Deal Type and Task Type pages. Showcase: **Type configuration**.

**Frappe apps:** a type whose registry is a DocType is edited with `FrappeTypeForm` (`@solvfast/ui/frappe`, the
registry's own form from its metadata) and `FieldDesigner` (docs/components/family.md). Use the parts here when the
app keeps its types itself (client state, its own API) or designs its own form model.

---

## 1. The page

```tsx
import {
  TypeConfigPage, TypeConfigSection, TypeAppearanceSection, TypeSettingsGrid, TypeSettingField, TypeFormSection,
  TypeConfigFooter, typeFormConflicts, typeFormFields, typeSaveBlock,
} from "@solvfast/ui";

const conflicts = typeFormConflicts(typeFormFields(form), standardLabels);
const block = typeSaveBlock({ name, dirty, requireChange: true, conflicts: conflicts.length });

<TypeConfigPage
  title={isEdit ? "Edit Asset Type" : "Create Asset Type"}
  onBack={() => guardLeave(() => navigate("/assets/types"))}
  footer={<TypeConfigFooter mode={isEdit ? "edit" : "create"} onCancel={back} onSave={save} saveDisabled={block !== null} />}
>
  <TypeAppearanceSection icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
  <TypeConfigSection title="General Information">
    <TypeSettingField label="Asset Type Name" htmlFor="name" required>
      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
    </TypeSettingField>
  </TypeConfigSection>
  <TypeConfigSection title="Configuration">
    <TypeSettingsGrid>
      <TypeSettingField label="Lifecycle" manageLink={{ href: "/lifecycles", label: "Manage lifecycles" }}
        hints={[lifecycle ? null : "Records of this type have no lifecycle."]}>
        <LinkInput … />
      </TypeSettingField>
    </TypeSettingsGrid>
  </TypeConfigSection>
  <TypeFormSection wizard={…} issues={{ conflicts }} library={{ groups, onImport }}>
    {/* the app's form designer */}
  </TypeFormSection>
  {/* the app's own sections (statuses per stage, availability…) as TypeConfigSection */}
</TypeConfigPage>
```

| Part | Props that matter |
|---|---|
| `TypeConfigPage` | `title` (the app words it), `subtitle` (**none by default**), `onBack`, `backLabel`, `notice`, `children` (sections), `footer` |
| `TypeConfigSection` | `title`, `description` (**none by default**), `actions` (beside the heading), `children` |
| `TypeAppearanceSection` | the `IconColorPicker` props, or the app's picker as `children`; `title` default "Appearance" |
| `TypeSettingField` | `label`, `htmlFor`, `required` (adds " *"), `manageLink` `{ href, label }` (new tab), `hints` (lines under the control; falsy skipped), `children` (the control) |
| `TypeSettingsGrid` | two columns from `md` |
| `TypeConfigFooter` | `mode` ("create" → Create), `onCancel`, `onSave`, `saveDisabled`, `saveLabel`, `cancelLabel` |

**One header.** The page has one header: the app's title, and a subtitle only when the app's design has one. No part
adds a description, an introductory box or a banner of its own; `notice` shows what the app passes there and nothing else.

## 2. The Form section and the field library

`TypeFormSection` = heading, the **library button** (opens `TypeFieldPicker` inline), the **wizard switch**
(`TypeWizardToggle`), the **label problems** (`TypeFormIssues`), then the **form builder**: `builder={{ value, onChange, … }}`
renders the package `FormBuilder` (docs/components/form-builder.md) and the section's wizard switch drives it; or another
designer as `children` (`FieldDesigner` for a Frappe registry). The designer stays the app's: its form model (steps → sections → columns →
fields) is the app's data; the rules below work on any model with these properties:

```ts
interface TypeFormFieldLike { id: string; title?: string; titleAr?: string; core?: boolean }   // core = a standard field
interface TypeFormSectionLike<F> { id: string; rowId?: string; fields: F[] }                  // same rowId = side by side
interface TypeFormLike<S> { wizard: boolean; steps: { id: string; sections: S[] }[] }
```

### Field selection — all fields or selected fields

`TypeFieldPicker` takes `groups` (a library's field groups — presets, field sets) and offers two ways (`modes`, default
both; one entry hides the switch; `defaultMode`):

| Mode | The user | `onImport` receives |
|---|---|---|
| **All fields** | clicks a group: every field it has | `{ mode: "all", groupId }` |
| **Selected fields** | searches (both languages), ticks fields (or a group's box: its available fields) across groups, then **Add N selected** | `{ mode: "selected", picks: [{ groupId, fieldIds }] }` |

A field that cannot be added is listed with the reason and cannot be ticked — give each option its
`status` from `fieldImportStatus(currentFields, groupFields, standardLabels)`: `present` (a field with that label is on
the form), `reserved` (a standard field has it), `core` (it is a standard field).

Then copy with **`planFieldImport`** (one rule set for both modes):

```ts
const plan = planFieldImport({
  current: allSections(form.steps), source: groupSections, reserved: standardLabels,
  mode: choice.mode, selected: pick.fieldIds,              // "selected": only these
  newFieldId: () => formBuilderId("fld"), newRowId,
  // a NEW section (its own id; side by side only when the library's sections were): never spread `from` over the new id
  makeSection: (from, fields, rowId) => newSection({ title: from.title, titleAr: from.titleAr, columns: from.columns, rowId, fields }),
});
setForm(appendImportedSections(form, plan.sections));     // wizard: the last step; otherwise the single step
toast(summary(plan).text);                                 // useFieldImportSummary(): "Added 2 fields — skipped: 1 already a standard field"
```

- Standard (`core`) fields are never copied and not counted.
- A field whose label a standard field has → `skippedReserved`; a label already on the form (or taken earlier in the same
  import) → `skippedExisting`. Labels compare trimmed and case-insensitive, English and Arabic.
- An import is a one-time copy: every field gets a new id; library sections that sat side by side stay side by side (a
  new shared `rowId`); sections left empty are dropped.

### Label checks and the save gate

- `typeFormConflicts(fields, standardLabels, { exempt })` — blocking: a field added on the form whose label a standard
  field or another field has (one entry per reason and label; standard fields never; `exempt` for fields the app accepts
  as they are, e.g. migrated ones). Show with `TypeFormIssues conflicts` (an alert) and block saving.
- `typeFormReservedWarnings(fields, standardLabels)` — non-blocking: fields carried over with a standard label.
- `typeSaveBlock({ name, dirty, requireChange, conflicts, busy })` → `"busy" | "name" | "conflicts" | "unchanged" | null`.
  With the form builder in wizard mode, also block while `emptySteps(form).length > 0` (a step needs a section; the
  builder shows that warning).
  `requireChange` (default false) makes an unchanged page unsavable (pair it with the app's unsaved-changes guard).

## 3. Words

Every chrome string is a `tc*` message (en + ar) and every part takes `labels` to word it for the app. Default words are
generic ("Add fields from library", "Field library", "All fields", "Selected fields"); the CRM passes its own ("Import from
Field Library"). There is **no default subtitle or section description** — pass them only when the design has them.

## 4. What the app keeps

Entity data and stores, permissions, which settings a type has and their options, defaults (e.g. an app-level default
lifecycle), the form designer and its field properties, extra sections (e.g. statuses per lifecycle stage, availability),
navigation, the unsaved-changes guard, toasts.
