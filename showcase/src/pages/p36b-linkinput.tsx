/** P36b linkinput — LinkInput's opt-in select-like behaviour for pickers over a known list: open on a click even
 *  when filled, a check mark + aria-selected on the current value, a "none" row, Escape restores. In-memory only. */
import * as React from "react";
import { FieldShell, LinkInput, type Suggestion } from "@ui";
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
          ["openOnClickWhenFilled", "boolean (false)", l("Click / tap opens the full list on a filled box; Enter opens a closed box; Home / End while nothing is typed; a chevron.", "النقر / اللمس يفتح القائمة كاملة على حقل ممتلئ؛ و Enter يفتح حقلاً مغلقاً؛ و Home / End حين لا يُكتب شيء؛ وسهم.")],
          ["selectedIndicator · selectedValue", "boolean (false) · string | null (value)", l("Check mark + aria-selected on the current value's row; the highlight moves via aria-activedescendant.", "علامة صح و aria-selected على صف القيمة الحالية؛ والتمييز يتحرك عبر aria-activedescendant.")],
          ["keepValueWhenEmptied", "boolean (false)", l("An emptied box that is left restores the value instead of clearing it.", "الحقل المُفرَّغ عند مغادرته يستعيد القيمة بدل مسحها.")],
          ["emptyText · searchPlaceholder", "ReactNode · string", l("The no-results text; the placeholder while the list is open and the box is empty.", "نص عدم وجود نتائج؛ والنص المؤقت أثناء فتح القائمة والحقل فارغ.")],
        ]} />
      </Section>
    </div>
  );
}
