/**
 * Type configuration — a whole type page for a non-CRM domain (a facilities team's Asset Type) built only from the
 * package: appearance, general information, settings, the Form section with the package FormBuilder (wizard steps,
 * sections side by side, 1–3 field columns, the field types, every field property) and the field library in both modes
 * ("All fields", "Selected fields"), the label checks and the save gate. Then the builder alone (structured types,
 * record links, sources), the picker alone, and the props worth knowing.
 */
import * as React from "react";
import {
  Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, TypeAppearanceSection,
  TypeConfigFooter, TypeConfigPage, TypeConfigSection, TypeFieldPicker, TypeFormSection, TypeSettingField, TypeSettingsGrid,
  FormBuilder, appendImportedSections, fieldImportStatus, planFieldImport, typeFormConflicts, typeFormFields, typeSaveBlock,
  useFieldImportSummary, newSection, formBuilderId,
  type TypeFieldGroup, type TypeFieldImport, type FormBuilderField, type FormBuilderSection, type FormBuilderValue,
  type FormBuilderLinkTarget, type FormBuilderSource,
} from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const f = (id: string, type: FormBuilderField["type"], title: string, titleAr: string, extra: Partial<FormBuilderField> = {}): FormBuilderField =>
  ({ id, type, title, titleAr, required: false, column: 1, ...extra });
const STANDARD: FormBuilderField[] = [
  f("asset_name", "text", "Asset name", "اسم الأصل", { core: true, required: true }),
  f("location", "record_link", "Location", "الموقع", { core: true, required: true, linkTarget: "site" }),
];
const RESERVED = STANDARD.map((x) => ({ en: x.title, ar: x.titleAr }));
const LINK_TARGETS: FormBuilderLinkTarget[] = [
  { value: "site", label: { en: "Site", ar: "موقع" }, fields: [{ value: "city", label: { en: "City", ar: "المدينة" } }, { value: "zone", label: { en: "Zone", ar: "المنطقة" } }], records: [{ id: "S-01", label: "Riyadh HQ" }, { id: "S-02", label: "Jeddah Plant" }] },
  { value: "vendor", label: { en: "Vendor", ar: "مورّد" }, fields: [{ value: "phone", label: { en: "Phone", ar: "الهاتف" } }, { value: "email", label: { en: "Email", ar: "البريد" } }], records: [{ id: "V-7", label: "CoolAir Services" }] },
];
const SOURCES: FormBuilderSource[] = [
  { id: "asset.age", label: { en: "Asset age (years)", ar: "عمر الأصل (سنوات)" }, kind: "scalar", group: { en: "Asset", ar: "الأصل" } },
  { id: "asset.parts", label: { en: "Spare parts list", ar: "قائمة قطع الغيار" }, kind: "list", group: { en: "Inventory", ar: "المخزون" } },
  { id: "list.criticality", label: { en: "Criticality levels", ar: "مستويات الأهمية" }, kind: "options", options: () => [{ value: "low", label: { en: "Low", ar: "منخفض" } }, { value: "high", label: { en: "High", ar: "مرتفع" } }] },
];
/** The field library: groups of sections, as an app keeps them. */
const LIBRARY: Record<string, { label: { en: string; ar: string }; description: { en: string; ar: string }; sections: FormBuilderSection[] }> = {
  warranty: { label: { en: "Warranty", ar: "الضمان" }, description: { en: "Provider, dates and terms", ar: "المزوّد والتواريخ والشروط" }, sections: [
    { id: "w", title: "Warranty", titleAr: "الضمان", columns: 2, fields: [
      f("w_provider", "text", "Provider", "المزوّد"), f("w_start", "date", "Starts on", "يبدأ في", { column: 2 }),
      f("w_end", "date", "Ends on", "ينتهي في", { column: 2 }), f("w_location", "record_link", "Location", "الموقع"),
    ] },
  ] },
  maintenance: { label: { en: "Maintenance", ar: "الصيانة" }, description: { en: "Two side-by-side sections", ar: "قسمان متجاوران" }, sections: [
    { id: "m1", rowId: "r", title: "Schedule", titleAr: "الجدول", columns: 1, fields: [f("m_interval", "number", "Interval (days)", "الفترة (أيام)"), f("m_next", "date", "Next service", "الخدمة التالية")] },
    { id: "m2", rowId: "r", title: "Contractor", titleAr: "المقاول", columns: 1, fields: [f("m_vendor", "text", "Provider", "المزوّد"), f("m_phone", "phone", "Phone", "الهاتف")] },
  ] },
};

/** A realistic starting form: identity (2 columns), details beside condition (one row), notes. */
const initialForm = (): FormBuilderValue => ({ wizard: false, steps: [{ id: "main", title: "", sections: [
  { id: "s_id", rowId: "r_id", title: "Identity", titleAr: "الهوية", columns: 2, fields: [STANDARD[0], { ...STANDARD[1], column: 2 }, f("serial", "text", "Serial number", "الرقم التسلسلي", { unique: true, placeholder: "SN-0000" }), f("model", "text", "Model", "الطراز", { column: 2 })] },
  { id: "s_det", rowId: "r_two", title: "Details", titleAr: "التفاصيل", columns: 1, fields: [f("installed", "date", "Installed on", "تاريخ التركيب"), f("capacity", "decimal", "Capacity (kW)", "السعة (ك.و)", { minValue: 0 })] },
  { id: "s_cond", rowId: "r_two", title: "Condition", titleAr: "الحالة", columns: 1, fields: [f("condition", "dropdown", "Condition", "الحالة", { required: true, options: [{ id: "o1", label: "Good" }, { id: "o2", label: "Needs service" }, { id: "o3", label: "Out of order" }] }), f("critical", "checkbox", "Critical asset", "أصل حرج")] },
  { id: "s_notes", rowId: "r_notes", title: "Notes", titleAr: "ملاحظات", columns: 1, fields: [f("notes", "long_text", "Notes", "ملاحظات", { fullWidth: true })] },
] }] });
const snapshot = (v: unknown) => JSON.stringify(v);

function AssetTypePage() {
  const tr = useTr();
  const summary = useFieldImportSummary();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState<string | null>("Wrench");
  const [color, setColor] = React.useState<string | null>("#1F3A5F");
  const [plan, setPlan] = React.useState("none");
  const [enabled, setEnabled] = React.useState(true);
  const [form, setForm] = React.useState<FormBuilderValue>(initialForm);
  const [baseline, setBaseline] = React.useState(() => snapshot({ name: "", description: "", icon: "Wrench", color: "#1F3A5F", plan: "none", enabled: true, form: initialForm() }));
  const [note, setNote] = React.useState("");

  const fields = typeFormFields(form);
  const conflicts = typeFormConflicts(fields, RESERVED);
  const dirty = snapshot({ name, description, icon, color, plan, enabled, form }) !== baseline;
  const block = typeSaveBlock({ name, dirty, requireChange: true, conflicts: conflicts.length });

  const groups: TypeFieldGroup[] = Object.entries(LIBRARY).map(([id, g]) => {
    const all = g.sections.flatMap((s) => s.fields);
    const status = fieldImportStatus(fields, all, RESERVED);
    return { id, label: g.label, description: g.description, fields: all.map((x) => ({ id: x.id, label: { en: x.title, ar: x.titleAr ?? x.title }, type: x.type, status: status.get(x.id) })) };
  });
  const onImport = (choice: TypeFieldImport) => {
    const picks = choice.mode === "all" ? [{ groupId: choice.groupId, fieldIds: undefined as string[] | undefined }] : choice.picks;
    let next = form;
    const total = { added: 0, skippedReserved: 0, skippedExisting: 0 };
    for (const p of picks) {
      const result = planFieldImport<FormBuilderField, FormBuilderSection>({
        current: next.steps.flatMap((s) => s.sections), source: LIBRARY[p.groupId].sections, reserved: RESERVED,
        mode: choice.mode, selected: p.fieldIds, newFieldId: () => formBuilderId("fld"), newRowId: () => formBuilderId("row"),
        makeSection: (from, fs, rowId) => newSection({ title: from.title, titleAr: from.titleAr, columns: from.columns, rowId, fields: fs }),
      });
      next = appendImportedSections(next, result.sections);
      total.added += result.added; total.skippedReserved += result.skippedReserved; total.skippedExisting += result.skippedExisting;
    }
    setForm(next);
    setNote(summary(total).text);
  };
  const save = () => {
    setBaseline(snapshot({ name, description, icon, color, plan, enabled, form }));
    setNote(tr({ en: `Saved “${name}”.`, ar: `تم حفظ «${name}».` }));
  };

  return (
    <TypeConfigPage
      title={tr({ en: "Create Asset Type", ar: "إنشاء نوع أصل" })}
      onBack={() => setNote(tr({ en: "Back pressed (the app navigates and guards unsaved changes).", ar: "تم الضغط على رجوع (يتنقّل التطبيق ويحمي التغييرات غير المحفوظة)." }))}
      footer={<TypeConfigFooter mode="create" onCancel={() => { setForm(initialForm()); setName(""); }} onSave={save} saveDisabled={block !== null} />}
    >
      <TypeAppearanceSection icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
      <TypeConfigSection title={tr({ en: "General Information", ar: "المعلومات العامة" })}>
        <TypeSettingField label={tr({ en: "Asset Type Name", ar: "اسم نوع الأصل" })} htmlFor="tc-demo-name" required>
          <Input id="tc-demo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr({ en: "e.g. HVAC unit", ar: "مثال: وحدة تكييف" })} />
        </TypeSettingField>
        <TypeSettingField label={tr({ en: "Description", ar: "الوصف" })} htmlFor="tc-demo-desc">
          <Textarea id="tc-demo-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </TypeSettingField>
      </TypeConfigSection>
      <TypeConfigSection title={tr({ en: "Configuration", ar: "الإعداد" })}>
        <TypeSettingsGrid>
          <TypeSettingField label={tr({ en: "Maintenance plan", ar: "خطة الصيانة" })} htmlFor="tc-demo-plan"
            manageLink={{ href: "#type-config", label: tr({ en: "Manage plans", ar: "إدارة الخطط" }) }}
            hints={[plan === "none" ? tr({ en: "No plan — assets of this type are serviced on request.", ar: "بدون خطة — تُصان أصول هذا النوع عند الطلب." }) : null]}>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger id="tc-demo-plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tr({ en: "None", ar: "بدون" })}</SelectItem>
                <SelectItem value="quarterly">{tr({ en: "Quarterly", ar: "ربع سنوي" })}</SelectItem>
                <SelectItem value="yearly">{tr({ en: "Yearly", ar: "سنوي" })}</SelectItem>
              </SelectContent>
            </Select>
          </TypeSettingField>
        </TypeSettingsGrid>
      </TypeConfigSection>
      <TypeFormSection
        issues={{ conflicts }}
        library={{ groups, onImport }}
        builder={{ value: form, onChange: setForm, lockCore: true, entityLabel: { en: "Asset", ar: "أصل" }, linkTargets: LINK_TARGETS, sources: SOURCES }}
      />
      <TypeConfigSection title={tr({ en: "Availability", ar: "الإتاحة" })}>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          {tr({ en: "Offer this type for new assets", ar: "إتاحة هذا النوع للأصول الجديدة" })}
        </label>
      </TypeConfigSection>
      <p role="status" className="text-xs text-muted-foreground">{note}</p>
    </TypeConfigPage>
  );
}

/** The builder alone (no type page): structured types, a wizard, record links and sources. */
function StandaloneBuilder() {
  const [value, setValue] = React.useState<FormBuilderValue>(() => ({ wizard: true, steps: [
    { id: "st1", title: "Inspection", titleAr: "الفحص", icon: "Search", sections: [
      { id: "i1", rowId: "ri", title: "Checklist", titleAr: "قائمة الفحص", columns: 3, fields: [
        f("ok_power", "checkbox", "Power OK", "الطاقة سليمة"), f("ok_noise", "checkbox", "No noise", "لا يوجد ضجيج", { column: 2 }), f("ok_leak", "checkbox", "No leaks", "لا تسرب", { column: 3 }),
        f("rating", "rating", "Overall condition", "الحالة العامة", { fullWidth: true }),
      ] },
    ] },
    { id: "st2", title: "Parts", titleAr: "القطع", icon: "Package", sections: [
      { id: "p1", rowId: "rp", title: "Parts used", titleAr: "القطع المستخدمة", columns: 1, fields: [
        { ...f("parts", "table", "Parts", "القطع", { fullWidth: true }), rowsFrom: { source: "asset.parts" }, columns: [{ id: "c1", title: "Part", type: "text", kind: "derived", sourceId: "asset.age" }, { id: "c2", title: "Qty", type: "number", kind: "entered" }] },
        { ...f("age", "display_value", "Asset age", "عمر الأصل"), sourceId: "asset.age" },
      ] },
    ] },
  ] }));
  return <FormBuilder value={value} onChange={setValue} advancedFieldTypes linkTargets={LINK_TARGETS} sources={SOURCES} />;
}

const PICKER_GROUPS: TypeFieldGroup[] = [
  { id: "warranty", label: { en: "Warranty", ar: "الضمان" }, description: { en: "Provider, dates and terms", ar: "المزوّد والتواريخ والشروط" }, fields: [
    { id: "p", label: { en: "Provider", ar: "المزوّد" }, type: "Text" },
    { id: "s", label: { en: "Starts on", ar: "يبدأ في" }, type: "Date" },
    { id: "loc", label: { en: "Location", ar: "الموقع" }, type: "Link", status: "reserved" },
  ] },
  { id: "contacts", label: { en: "Contacts", ar: "جهات الاتصال" }, fields: [
    { id: "c1", label: { en: "Site manager", ar: "مدير الموقع" }, type: "Link" },
    { id: "c2", label: { en: "Phone", ar: "الهاتف" }, type: "Phone", status: "present" },
  ] },
];

export function TypeConfigDemoPage() {
  const tr = useTr();
  const [last, setLast] = React.useState("");
  return (
    <div className="space-y-10">
      <Section id="type-config" title={l("A type page (Asset Type)", "صفحة نوع (نوع الأصل)")}
        description={l(
          "Every part is the package's, the form builder included; the data, the settings and the save are the app's. Try: name it (Create enables); in the builder add a field (Add field → pick a type), select it to edit its properties, drag fields and sections (or use the handles with the arrow keys), drop a section on another's edge to sit side by side, change a section's columns, turn Wizard mode on and add steps; add the Warranty group with “All fields”, then “Selected fields” from Maintenance; rename a field to “Asset name” (saving is blocked).",
          "كل الأجزاء من الحزمة بما فيها مصمّم النموذج؛ البيانات والإعدادات والحفظ من التطبيق. جرّب: سمِّه (يتفعّل «إنشاء»)؛ في المصمّم أضف حقلًا (إضافة حقل ← اختر نوعًا)، وحدّده لتعديل خصائصه، واسحب الحقول والأقسام (أو استخدم المقابض مع الأسهم)، وأفلت قسمًا على حافة قسم آخر ليصبحا متجاورين، وغيّر أعمدة القسم، وفعّل وضع المعالج وأضف خطوات؛ أضف مجموعة الضمان بـ«كل الحقول» ثم «حقول محددة» من الصيانة؛ سمِّ حقلًا «اسم الأصل» (يُمنع الحفظ).",
        )}>
        <Example title={l("TypeConfigPage + TypeFormSection builder", "TypeConfigPage مع TypeFormSection builder")} code={`<TypeConfigPage title="Create Asset Type" onBack={back}
  footer={<TypeConfigFooter mode="create" onCancel={back} onSave={save} saveDisabled={block !== null} />}>
  <TypeAppearanceSection icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
  <TypeConfigSection title="General Information">…</TypeConfigSection>
  <TypeFormSection
    issues={{ conflicts: typeFormConflicts(typeFormFields(form), standardLabels) }}
    library={{ groups, onImport }}
    builder={{ value: form, onChange: setForm, lockCore: true, entityLabel: "Asset", linkTargets, sources }} />
</TypeConfigPage>`}>
          <AssetTypePage />
        </Example>
      </Section>

      <Section id="form-builder" title={l("FormBuilder on its own", "FormBuilder وحده")}
        description={l("The same builder outside a type page, with the structured types (Table, Display Value), 4 field columns, record links (targets, filters, auto-fill) and calculated sources the app provides.", "المصمّم نفسه خارج صفحة النوع، مع الأنواع المركّبة (جدول، قيمة معروضة) وأربعة أعمدة للحقول وروابط السجلات (الأهداف والقيود والتعبئة التلقائية) والمصادر المحسوبة التي يوفّرها التطبيق.")}>
        <Example title={l("Wizard form with a table", "نموذج معالج مع جدول")} code={`<FormBuilder value={value} onChange={setValue} advancedFieldTypes linkTargets={linkTargets} sources={sources} />`}>
          <StandaloneBuilder />
        </Example>
      </Section>

      <Section id="type-field-picker" title={l("TypeFieldPicker — all fields or selected fields", "TypeFieldPicker — كل الحقول أو حقول محددة")}
        description={l("“All fields” takes a whole group in one click; “Selected fields” picks fields one by one across groups, with search. Fields that cannot be added are shown with the reason.", "«كل الحقول» تأخذ مجموعة كاملة بنقرة؛ «حقول محددة» تختار الحقول واحدًا واحدًا عبر المجموعات مع البحث. الحقول التي لا يمكن إضافتها تظهر مع السبب.")}>
        <Example title={l("Both modes", "الوضعان")} code={`<TypeFieldPicker groups={groups} onImport={(choice) => {
  // { mode: "all", groupId } | { mode: "selected", picks: [{ groupId, fieldIds }] }
}} />`}>
          <div className="space-y-3">
            <TypeFieldPicker groups={PICKER_GROUPS} onImport={(c) => setLast(JSON.stringify(c))} />
            <p role="status" dir="ltr" className="font-mono text-xs text-muted-foreground">{last || tr({ en: "onImport has not been called yet.", ar: "لم يُستدعَ onImport بعد." })}</p>
          </div>
        </Example>
      </Section>

      <Section id="type-config-props" title={l("Props worth knowing", "خصائص مهمة")}>
        <Props rows={[
          ["TypeConfigPage.title", "ReactNode", l("The page title, worded by the app. The page has one header.", "عنوان الصفحة بصياغة التطبيق. للصفحة رأس واحد.")],
          ["TypeConfigPage.subtitle", "ReactNode", l("Only when the app's design has one — there is no default.", "فقط عندما يتضمّنه تصميم التطبيق — لا يوجد افتراضي.")],
          ["TypeFormSection.builder", "FormBuilderProps", l("Renders the package form builder; the section's wizard switch drives it.", "يعرض مصمّم النموذج من الحزمة؛ ومفتاح المعالج في القسم يتحكّم به.")],
          ["FormBuilder.value / onChange", "{ wizard, steps }", l("The form: steps → sections → fields (controlled).", "النموذج: خطوات ← أقسام ← حقول (متحكَّم به).")],
          ["FormBuilder.fieldTypes", "FormFieldTypeInfo[]", l("The field types offered (default: all 28 Field Library types).", "أنواع الحقول المتاحة (الافتراضي: كل أنواع مكتبة الحقول الـ28).")],
          ["FormBuilder.lockCore", "boolean", l("Standard fields move but are never removed, re-typed, retitled or made optional.", "الحقول الأساسية تُنقل لكن لا تُحذف ولا يتغيّر نوعها أو عنوانها ولا تصبح اختيارية.")],
          ["FormBuilder.linkTargets / sources", "app data", l("Record-link objects (fields, sample records) and calculated sources — the app's.", "كائنات روابط السجلات (الحقول، سجلات نموذجية) والمصادر المحسوبة — من التطبيق.")],
          ["FormBuilder.renderCondition / renderTitleInput", "render props", l("The app's own condition and title controls (e.g. an assistant).", "عناصر التطبيق الخاصة للشروط والعنوان (مثل مساعد).")],
          ["TypeFieldPicker.modes", "(\"all\" | \"selected\")[]", l("The ways offered (default both).", "الطرق المتاحة (الافتراضي كلاهما).")],
          ["planFieldImport", "fn", l("Copies library fields: never standard ones; skips reserved and present labels (counted); new ids; rows kept.", "ينسخ حقول المكتبة: لا ينسخ الأساسية؛ يتخطّى التسميات المحجوزة والموجودة (مع العدّ)؛ معرّفات جديدة؛ الصفوف محفوظة.")],
          ["typeSaveBlock", "fn", l("Why saving is blocked: busy, name, conflicts, unchanged — or null.", "سبب منع الحفظ: مشغول، الاسم، تعارضات، بلا تغيير — أو null.")],
        ]} />
      </Section>
    </div>
  );
}
