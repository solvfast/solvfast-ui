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
  saved): `designer={(typeDoctype) => <MyDesigner doctype={typeDoctype} />}`.

## 6. Data helpers

`useFamilyTypes(family)` / `fetchFamilyTypes(api, family)` return `FamilyType[]` — `{name, label: {en, ar}, description,
doctype, icon, color, row}` — for a picker of the app's own. `fetchFamilyRecord(api, family, name)` throws
`Error("not-found")` when the row is missing or names no record.

## 7. `FieldDesigner` (Core) — a type's Form section

The fields of a type's form as tabs → sections → columns, **placement only**: a field's own settings (label, required,
options, conditions) stay where its field set is edited (Sayr Studio's Field Library).

| Card | What it can do |
|---|---|
| Standard field (lock) | Stays where it is. |
| Shared field (from the family parent) | Moves (drag, or the up / down buttons); never removed. |
| A field set's field | Moves and is removed. |

- **Add fields** (toolbar, or "Add fields here" on a section): a published field set, then its fields not yet on the
  form (all ticked), added as a new section under that section (default) or into it.
- **Add tab** / remove a tab or section the type added: what it held moves to the one before.
- **Save form** writes the form as arranged. Removing fields that hold values asks first (how many records); removing
  every added field asks before the field set is withdrawn. Values always stay in the database.

It reads and writes through an adapter (`FieldDesignerAdapter`: `load`, `listFieldSets`, `fieldsOf`, `save`, optional
`sectionOf`, `makeTab`, `removalImpact`), so it knows no backend. Keep the adapter stable (`useMemo`).

```tsx
<FieldDesigner adapter={adapter} labels={{ fdTitle: { en: "Ticket form", ar: "نموذج التذكرة" } }} />
```

The layout model is exported for adapters and tests: `designerLayout` / `designerItems` (core names of `toLayout` /
`fromLayout`), `designerPreviousId`, `kindOfFieldtype`; `src/record` also exports `moveItem`, `stepItem`,
`insertSectionAfter`, `appendTab`, `removeSection`, `removeTab`.

## 8. `@solvfast/ui/sayr` — the Field Library adapter

`SayrFieldDesigner doctype` is `FieldDesigner` over `createSayrFieldDesignerAdapter(api, doctype, {language})`. It does
what Sayr Studio's field set editor does, for one DocType:

| Step | Sayr method |
|---|---|
| Load the form (its fields in order, the family's shared ones, the deployed rows) | `sear_product.apis.field_library.deployments.doctype_deployment` |
| Published field sets / one set's fields | `frappe.client.get_list` / `frappe.client.get` on `Sear Field Preset` |
| Save the added fields (saving deploys them; skipped when no row's place changed) | `frappe.client.insert` / `save` on `Sear Field Deployment` |
| Keep a family type's whole order, shared fields included | `…deployments.save_field_order` (after the deployment, so new rows resolve) |
| Every added field removed | `…deployments.withdraw_deployment` |
| Records holding values in removed fields | `…deployments.deployment_removal_impact` |

Ids are Sayr's: a deployed row's column (`fieldname`), else a token — `@<set>::<key>`, `@<set>::__section`,
`@tab::<label>` (`sayrToken`). Needs the Sear Platform Administrator role; without it, and for a DocType Sayr cannot
deploy on, the section shows why instead of the tools. A field set that changed since it was saved shows a note to
redeploy it from the Field Library.

## 9. Wizard mode and a new type's defaults (0.7.0-dev.9)

- **Wizard mode** is a Check on the registry (`wizardField`, default Sayr's `wizard_mode`). `FamilyType.wizard` reads
  it. `FrappeNewFamilyRecord` then walks the type's tabs as ordered steps: a `Stepper`, Back / Next, Create on the last
  step (the form's tab bar is hidden; the mandatory check still covers every step on Create). The steps are the type's
  tabs in its form's order, so moving fields and tabs in the Form section reorders the steps. Off, the fields are one
  list as before.
- `FrappeTypeForm` keeps the Wizard mode field off the type's form and hands it to `designer` as
  `context.wizard = { on, onChange }`; `onChange` saves it on its own (`frappe.client.set_value` on the registry row).
  `FieldDesigner`'s `wizard` prop shows it as a switch and labels the tabs "Step N · …".
- `FrappeTypeForm` `defaults`: the values a **new** type starts with (`newDocDefaults.routeOptions`), e.g. an app's
  default lifecycle, SLA policy and assignment profile. Nothing is applied to a saved type.

```tsx
<FrappeTypeForm family={TICKETS} name={name} defaults={defaults}
  designer={(doctype, { wizard }) => <SayrFieldDesigner doctype={doctype} wizard={wizard} />} />
```

`FrappeFormView` / `FrappeForm` gained what the steps need: `activeTab` (the tab shown, by key), `hideTabBar` and
`onTabsChange(tabs)` (the visible tabs, key + label).
