/** P36b linkinput — LinkInput's opt-in select-like behaviour for pickers over a known list: open on a click even
 *  when filled, a check mark + aria-selected on the current value, a "none" row, Escape restores. In-memory only. */
import * as React from "react";
import { DateField, FieldShell, Input, LinkInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type Suggestion } from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const Out = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">{children}</p>
);

const NONE = "__none__";
const LIFECYCLES = [
  { value: "lc_sales", en: "Sales pipeline", ar: "مسار المبيعات" },
  { value: "lc_ent", en: "Enterprise deals", ar: "صفقات المؤسسات" },
  { value: "lc_smb", en: "SMB fast track", ar: "المسار السريع للمنشآت الصغيرة" },
  { value: "lc_partner", en: "Partner referrals", ar: "إحالات الشركاء" },
  { value: "lc_renew", en: "Renewals", ar: "التجديدات" },
];

export function LinkInputSelectLikePage() {
  const tr = useTr();
  const [lc, setLc] = React.useState<string>("lc_sales");
  const [plain, setPlain] = React.useState<string | null>("lc_sales");
  const options: Suggestion[] = React.useMemo(() => [
    { value: NONE, label: tr(l("None", "بدون")) },
    ...LIFECYCLES.map((o) => ({ value: o.value, label: tr(l(o.en, o.ar)) })),
  ], [tr]);
  const search = React.useCallback(async (q: string) => {
    const t = q.trim().toLowerCase();
    return options.filter((o) => !t || `${o.label} ${o.value}`.toLowerCase().includes(t));
  }, [options]);
  const label = (v: string | null) => options.find((o) => o.value === v)?.label ?? v ?? "";
  const isNone = lc === NONE;
  return (
    <div className="space-y-12">
      <Section
        title={l("LinkInput as a picker (select-like, opt-in)", "LinkInput كمنتقٍ (شبيه بالقائمة المنسدلة، اختياري)")}
        description={l(
          "`openOnClickWhenFilled`: a click or tap opens the full list even when the box shows a value; typing filters, Escape restores, picking replaces. `selectedIndicator`: the current value's row has a check mark and aria-selected. A \"None\" row is marked through `selectedValue`; `keepValueWhenEmptied` keeps the value when the box is emptied and left (× clears).",
          "‏`openOnClickWhenFilled`: النقر أو اللمس يفتح القائمة كاملة حتى لو كان الحقل يعرض قيمة؛ الكتابة تُصفّي، و Escape يستعيد، والاختيار يستبدل. و `selectedIndicator`: صف القيمة الحالية عليه علامة صح و aria-selected. صف «بدون» يُعلَّم عبر `selectedValue`؛ و `keepValueWhenEmptied` يُبقي القيمة عند تفريغ الحقل ومغادرته (× يمسح).",
        )}
      >
        <Example code={`<LinkInput value={isNone ? null : v} displayValue={label(v)} selectedValue={v}
  search={search} debounceMs={0} onChange={(n) => setV(n ?? NONE)}
  openOnClickWhenFilled selectedIndicator keepValueWhenEmptied
  placeholder="Select a lifecycle" searchPlaceholder="Search lifecycles…" emptyText="No results" />`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label={tr(l("Linked Lifecycle (select-like)", "دورة الحياة المرتبطة (شبيه بالقائمة)"))} htmlFor="p36b-li-select">
              <LinkInput
                id="p36b-li-select"
                value={isNone ? null : lc}
                displayValue={label(lc)}
                selectedValue={lc}
                search={search}
                debounceMs={0}
                onChange={(n) => setLc(n ?? NONE)}
                openOnClickWhenFilled
                selectedIndicator
                keepValueWhenEmptied
                placeholder={tr(l("Select a lifecycle", "اختر دورة حياة"))}
                searchPlaceholder={tr(l("Search lifecycles…", "ابحث في دورات الحياة…"))}
                emptyText={tr(l("No results", "لا توجد نتائج"))}
              />
            </FieldShell>
            <FieldShell label={tr(l("Default LinkInput (Desk behaviour)", "LinkInput الافتراضي (سلوك ديسك)"))} htmlFor="p36b-li-plain">
              <LinkInput id="p36b-li-plain" value={plain} displayValue={plain ? label(plain) : null} search={search} debounceMs={0} onChange={setPlain} />
            </FieldShell>
          </div>
          <Out>{JSON.stringify({ selectLike: lc, default: plain })}</Out>
        </Example>
        <Props rows={[
          ["openOnClickWhenFilled", "boolean (false)", l("Click / tap opens the full list on a filled box; Enter, or Space on a filled box with nothing typed, opens a closed box; Home / End while nothing is typed; a chevron.", "النقر / اللمس يفتح القائمة كاملة على حقل ممتلئ؛ و Enter، أو المسافة على حقل ممتلئ لم يُكتب فيه شيء، يفتح حقلاً مغلقاً؛ و Home / End حين لا يُكتب شيء؛ وسهم.")],
          ["selectedIndicator · selectedValue", "boolean (false) · string | null (value)", l("Check mark + aria-selected on the current value's row; the highlight moves via aria-activedescendant.", "علامة صح و aria-selected على صف القيمة الحالية؛ والتمييز يتحرك عبر aria-activedescendant.")],
          ["keepValueWhenEmptied", "boolean (false)", l("An emptied box that is left restores the value instead of clearing it.", "الحقل المُفرَّغ عند مغادرته يستعيد القيمة بدل مسحها.")],
          ["emptyText · searchPlaceholder", "ReactNode · string", l("The no-results text; the placeholder while the list is open and the box is empty.", "نص عدم وجود نتائج؛ والنص المؤقت أثناء فتح القائمة والحقل فارغ.")],
        ]} />
      </Section>
      {/* P36c linkinput — keyboard reviewed against Desk, and the field height next to the other DS fields */}
      <Section
        title={l("Keyboard, compared with Desk", "لوحة المفاتيح مقارنةً بديسك")}
        description={l(
          "Picker mode keeps Desk's keys and adds only what a select needs. Space types in the search except on a filled, closed box with nothing typed, where it opens the full list (like Desk's Select). The arrows wrap at both ends, as Desk's Link (Awesomplete). There are no Ctrl+N / Ctrl+P bindings: they are not Desk keys (Ctrl+P prints in Desk).",
          "وضع المنتقي يحافظ على مفاتيح ديسك ويضيف ما تحتاجه القائمة المنسدلة فقط. المسافة تُكتب في البحث إلا على حقل ممتلئ ومغلق لم يُكتب فيه شيء، فتفتح القائمة كاملة (مثل حقل Select في ديسك). الأسهم تلتف عند الطرفين كما في حقل Link في ديسك (Awesomplete). لا توجد اختصارات Ctrl+N / Ctrl+P: ليست مفاتيح ديسك (Ctrl+P يطبع في ديسك).",
        )}
      >
        <Props rows={[
          ["Space (filled, closed)", "picker mode", l("On a filled, closed box with nothing typed: opens the full list and selects the shown text (as Enter / ↓ / a click do), so typing replaces it; no space is inserted. Desk Select (<select>) opens; Desk Link inserts the space, then lists the results for it.", "على حقل ممتلئ ومغلق بلا كتابة: يفتح القائمة كاملة ويحدّد النص المعروض (كما يفعل Enter / ↓ / النقر)، فتستبدله الكتابة؛ دون إدراج مسافة. Select في ديسك يفتح؛ و Link في ديسك يُدرج المسافة ثم يعرض نتائجها.")],
          ["Space (open / typing)", "both modes", l("List open, or typing (and always in the default mode): types a space (multi-word search), as Desk's Link.", "القائمة مفتوحة أو أثناء الكتابة (ودائمًا في الوضع الافتراضي): يكتب مسافة (بحث بعدة كلمات)، كما في Link في ديسك.")],
          ["↑ / ↓", "both modes", l("List open: move the highlight and wrap at both ends (Awesomplete next() / previous()).", "القائمة مفتوحة: تحرّك التمييز وتلتف عند الطرفين (next() / previous() في Awesomplete).")],
          ["Ctrl+N / Ctrl+P", "—", l("Not bound (cmdk's vim bindings, not Desk's): the browser keeps them.", "غير مربوطة (اختصارات cmdk وليست من ديسك): تبقى للمتصفح.")],
        ]} />
        <Example title={l("Same height as the other fields", "الارتفاع نفسه كبقية الحقول")}>
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" data-p36c-heights="">
            <FieldShell label={tr(l("LinkInput (picker)", "LinkInput (منتقٍ)"))} htmlFor="p36c-li-h">
              <LinkInput id="p36c-li-h" value={isNone ? null : lc} displayValue={label(lc)} selectedValue={lc} search={search} debounceMs={0}
                onChange={(n) => setLc(n ?? NONE)} openOnClickWhenFilled selectedIndicator keepValueWhenEmptied />
            </FieldShell>
            <FieldShell label={tr(l("Input", "Input"))} htmlFor="p36c-in-h">
              <Input id="p36c-in-h" defaultValue={tr(l("Sales pipeline", "مسار المبيعات"))} />
            </FieldShell>
            <FieldShell label={tr(l("Select", "Select"))} htmlFor="p36c-sel-h">
              <Select defaultValue="a">
                <SelectTrigger id="p36c-sel-h"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="a">{tr(l("Sales pipeline", "مسار المبيعات"))}</SelectItem></SelectContent>
              </Select>
            </FieldShell>
            <FieldShell label={tr(l("DateField", "DateField"))}>
              <DateField value="2026-11-08" onChange={() => {}} />
            </FieldShell>
          </div>
        </Example>
      </Section>
    </div>
  );
}
