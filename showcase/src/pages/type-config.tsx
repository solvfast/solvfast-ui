/**
 * Type configuration — a whole type page for a non-CRM domain (a facilities team's Asset Type) built from the package
 * parts: appearance, general information, settings, the Form section with the field library in both modes ("All fields",
 * "Selected fields"), the label checks and the save gate. Then the picker alone, and the props worth knowing.
 */
import * as React from "react";
import { Trash2 } from "lucide-react";
import {
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, TypeAppearanceSection,
  TypeConfigFooter, TypeConfigPage, TypeConfigSection, TypeFieldPicker, TypeFormSection, TypeSettingField, TypeSettingsGrid,
  appendImportedSections, fieldImportStatus, planFieldImport, typeFormConflicts, typeFormFields, typeSaveBlock, useFieldImportSummary,
  type TypeFieldGroup, type TypeFieldImport, type TypeFormLike,
} from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

interface Field { id: string; title: string; titleAr?: string; type: string; core?: boolean }
interface Sec { id: string; rowId?: string; title: string; titleAr?: string; fields: Field[] }

let seq = 0;
const nid = (p: string) => `${p}_${++seq}`;
const STANDARD: Field[] = [
  { id: "asset_name", title: "Asset name", titleAr: "اسم الأصل", type: "Text", core: true },
  { id: "location", title: "Location", titleAr: "الموقع", type: "Link", core: true },
];
const RESERVED = STANDARD.map((f) => ({ en: f.title, ar: f.titleAr }));
/** The field library: groups of fields, as an app keeps them. */
const LIBRARY: Record<string, { label: { en: string; ar: string }; description: { en: string; ar: string }; sections: Sec[] }> = {
  warranty: { label: { en: "Warranty", ar: "الضمان" }, description: { en: "Provider, dates and terms", ar: "المزوّد والتواريخ والشروط" }, sections: [
    { id: "w", title: "Warranty", titleAr: "الضمان", fields: [
      { id: "w_provider", title: "Provider", titleAr: "المزوّد", type: "Text" },
      { id: "w_start", title: "Starts on", titleAr: "يبدأ في", type: "Date" },
      { id: "w_end", title: "Ends on", titleAr: "ينتهي في", type: "Date" },
      { id: "w_location", title: "Location", titleAr: "الموقع", type: "Link" },
    ] },
  ] },
  maintenance: { label: { en: "Maintenance", ar: "الصيانة" }, description: { en: "Two side-by-side sections", ar: "قسمان متجاوران" }, sections: [
    { id: "m1", rowId: "r", title: "Schedule", titleAr: "الجدول", fields: [
      { id: "m_interval", title: "Interval (days)", titleAr: "الفترة (أيام)", type: "Number" },
      { id: "m_next", title: "Next service", titleAr: "الخدمة التالية", type: "Date" },
    ] },
    { id: "m2", rowId: "r", title: "Contractor", titleAr: "المقاول", fields: [
      { id: "m_vendor", title: "Provider", titleAr: "المزوّد", type: "Text" },
      { id: "m_phone", title: "Phone", titleAr: "الهاتف", type: "Phone" },
    ] },
  ] },
};

const initialForm = (): TypeFormLike<Sec> => ({ wizard: false, steps: [{ id: "main", sections: [{ id: "std", title: "Asset", titleAr: "الأصل", fields: STANDARD }] }] });
const snapshot = (v: unknown) => JSON.stringify(v);

function AssetTypePage() {
  const tr = useTr();
  const ar = tr({ en: "en", ar: "ar" }) === "ar";
  const summary = useFieldImportSummary();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState<string | null>("Wrench");
  const [color, setColor] = React.useState<string | null>("#1F3A5F");
  const [plan, setPlan] = React.useState("none");
  const [enabled, setEnabled] = React.useState(true);
  const [form, setForm] = React.useState<TypeFormLike<Sec>>(initialForm);
  const [baseline, setBaseline] = React.useState(() => snapshot({ name: "", description: "", icon: "Wrench", color: "#1F3A5F", plan: "none", enabled: true, form: initialForm() }));
  const [note, setNote] = React.useState("");

  const fields = typeFormFields<Field, Sec>(form);
  const conflicts = typeFormConflicts(fields, RESERVED);
  const dirty = snapshot({ name, description, icon, color, plan, enabled, form }) !== baseline;
  const block = typeSaveBlock({ name, dirty, requireChange: true, conflicts: conflicts.length });

  const groups: TypeFieldGroup[] = Object.entries(LIBRARY).map(([id, g]) => {
    const all = g.sections.flatMap((s) => s.fields);
    const status = fieldImportStatus(fields, all, RESERVED);
    return { id, label: g.label, description: g.description, fields: all.map((f) => ({ id: f.id, label: { en: f.title, ar: f.titleAr ?? f.title }, type: f.type, status: status.get(f.id) })) };
  });
  const onImport = (choice: TypeFieldImport) => {
    const picks = choice.mode === "all" ? [{ groupId: choice.groupId, fieldIds: undefined as string[] | undefined }] : choice.picks;
    let next = form;
    const total = { added: 0, skippedReserved: 0, skippedExisting: 0 };
    for (const p of picks) {
      const result = planFieldImport<Field, Sec>({
        current: next.steps.flatMap((s) => s.sections), source: LIBRARY[p.groupId].sections, reserved: RESERVED,
        mode: choice.mode, selected: p.fieldIds, newFieldId: () => nid("f"), newRowId: () => nid("row"),
        makeSection: (from, fs, rowId) => ({ id: nid("sec"), title: from.title, titleAr: from.titleAr, rowId, fields: fs }),
      });
      next = appendImportedSections(next, result.sections);
      total.added += result.added; total.skippedReserved += result.skippedReserved; total.skippedExisting += result.skippedExisting;
    }
    setForm(next);
    setNote(summary(total).text);
  };
  const editField = (id: string, patch: Partial<Field>) =>
    setForm({ ...form, steps: form.steps.map((st) => ({ ...st, sections: st.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })) })) });
  const removeSection = (id: string) =>
    setForm({ ...form, steps: form.steps.map((st) => ({ ...st, sections: st.sections.filter((s) => s.id !== id) })) });
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
        wizard={{ checked: form.wizard, onCheckedChange: (on) => setForm({ ...form, wizard: on }) }}
        issues={{ conflicts }}
        library={{ groups, onImport }}
      >
        <div className="space-y-3">
          {form.steps.flatMap((st) => st.sections).map((sec) => (
            <div key={sec.id} className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{ar ? sec.titleAr || sec.title : sec.title}{sec.rowId ? <span className="ms-2 text-[11px] font-normal text-muted-foreground">{tr({ en: "side by side", ar: "متجاور" })}</span> : null}</p>
                {sec.fields.some((f) => f.core) ? null : (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={tr({ en: "Remove section", ar: "إزالة القسم" })} onClick={() => removeSection(sec.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {sec.fields.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                    {f.core
                      ? <span className="flex-1 text-sm">{ar ? f.titleAr : f.title}</span>
                      : <Input aria-label={tr({ en: "Field label", ar: "تسمية الحقل" })} className="h-7 flex-1" value={f.title} onChange={(e) => editField(f.id, { title: e.target.value })} />}
                    <span className="text-[11px] text-muted-foreground">{f.core ? tr({ en: "standard", ar: "أساسي" }) : f.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </TypeFormSection>
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
          "Every part is the package's; the data, the settings, the form designer and the save are the app's. Try: name it (Create enables), add the Warranty group with “All fields” (Location is a standard field and is skipped), then “Selected fields” from Maintenance (Provider is already on the form), rename a field to “Asset name” (saving is blocked).",
          "كل الأجزاء من الحزمة؛ البيانات والإعدادات ومصمّم النموذج والحفظ من التطبيق. جرّب: سمِّه (يتفعّل «إنشاء»)، أضف مجموعة الضمان بـ«كل الحقول» (الموقع حقل أساسي فيُتخطّى)، ثم «حقول محددة» من الصيانة (المزوّد موجود)، ثم سمِّ حقلًا «اسم الأصل» (يُمنع الحفظ).",
        )}>
        <Example title={l("TypeConfigPage + parts + rules", "TypeConfigPage مع الأجزاء والقواعد")} code={`const conflicts = typeFormConflicts(typeFormFields(form), standardLabels);
const block = typeSaveBlock({ name, dirty, requireChange: true, conflicts: conflicts.length });

<TypeConfigPage title="Create Asset Type" onBack={back}
  footer={<TypeConfigFooter mode="create" onCancel={back} onSave={save} saveDisabled={block !== null} />}>
  <TypeAppearanceSection icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
  <TypeConfigSection title="General Information">
    <TypeSettingField label="Asset Type Name" htmlFor="name" required><Input id="name" … /></TypeSettingField>
  </TypeConfigSection>
  <TypeFormSection wizard={…} issues={{ conflicts }} library={{ groups, onImport }}>
    {/* the app's form designer */}
  </TypeFormSection>
</TypeConfigPage>`}>
          <AssetTypePage />
        </Example>
      </Section>

      <Section id="type-field-picker" title={l("TypeFieldPicker — all fields or selected fields", "TypeFieldPicker — كل الحقول أو حقول محددة")}
        description={l("“All fields” takes a whole group in one click; “Selected fields” picks fields one by one across groups, with search. Fields that cannot be added are shown with the reason.", "«كل الحقول» تأخذ مجموعة كاملة بنقرة؛ «حقول محددة» تختار الحقول واحدًا واحدًا عبر المجموعات مع البحث. الحقول التي لا يمكن إضافتها تظهر مع السبب.")}>
        <Example title={l("Both modes", "الوضعان")} code={`<TypeFieldPicker groups={groups} onImport={(choice) => {
  // { mode: "all", groupId } | { mode: "selected", picks: [{ groupId, fieldIds }] }
  const plan = planFieldImport({ current, source, reserved, mode: choice.mode, selected, newFieldId, newRowId, makeSection });
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
          ["TypeConfigSection.description", "ReactNode", l("Only when the design has one — there is no default.", "فقط عندما يتضمّنه التصميم — لا يوجد افتراضي.")],
          ["TypeSettingField.manageLink", "{ href, label }", l("Where the setting's options are managed (new tab).", "مكان إدارة خيارات الإعداد (تبويب جديد).")],
          ["TypeFieldPicker.modes", "(\"all\" | \"selected\")[]", l("The ways offered (default both).", "الطرق المتاحة (الافتراضي كلاهما).")],
          ["planFieldImport", "fn", l("Copies library fields: never standard ones; skips reserved and present labels (counted); new ids; rows kept.", "ينسخ حقول المكتبة: لا ينسخ الأساسية؛ يتخطّى التسميات المحجوزة والموجودة (مع العدّ)؛ معرّفات جديدة؛ الصفوف محفوظة.")],
          ["typeFormConflicts", "fn", l("Blocking label clashes (standard or duplicate).", "تعارضات التسميات المانعة (أساسية أو مكرّرة).")],
          ["typeSaveBlock", "fn", l("Why saving is blocked: busy, name, conflicts, unchanged — or null.", "سبب منع الحفظ: مشغول، الاسم، تعارضات، بلا تغيير — أو null.")],
        ]} />
      </Section>
    </div>
  );
}
