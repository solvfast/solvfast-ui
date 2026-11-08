// P36 datagrid — DataGrid's responsive layout: a commission-split-like child table (generic data) as a table, as cards,
// and "auto" (cards while the grid's own container is narrow — try the narrow column on a desktop).
import * as React from "react";
import { Button, DataGrid, Input, NumberInput, useLocale, type DataGridColumn } from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

interface Split { id: string; code: string; name: string; share: number | null }
const SPLITS: Split[] = [
  { id: "s1", code: "ST-01", name: "Sourcing", share: 30 },
  { id: "s2", code: "ST-02", name: "Qualifying", share: 25 },
  { id: "s3", code: "ST-03", name: "Proposal and negotiation", share: 25 },
  { id: "s4", code: "ST-04", name: "Closing", share: 20 },
];
const SPLITS_AR: Split[] = [
  { id: "s1", code: "ST-01", name: "الاستقطاب", share: 30 },
  { id: "s2", code: "ST-02", name: "التأهيل", share: 25 },
  { id: "s3", code: "ST-03", name: "العرض والتفاوض", share: 25 },
  { id: "s4", code: "ST-04", name: "الإغلاق", share: 20 },
];

let seq = 100;
/** One editable split table (caller-owned rows, as DataGrid expects). */
function useSplitGrid(initial: Split[]) {
  const tr = useTr();
  const [rows, setRows] = React.useState(initial);
  const patch = (id: string, p: Partial<Split>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const fresh = (): Split => ({ id: `s${++seq}`, code: `ST-${seq}`, name: "", share: null });
  const columns: DataGridColumn<Split>[] = [
    { key: "code", label: tr(l("Code", "الرمز")), width: 2, mobile: false, renderCell: (r) => <span dir="ltr">{r.code}</span> },
    {
      key: "name", label: tr(l("Name", "الاسم")), width: 6, required: true, mobile: "primary", isInvalid: (r) => !r.name.trim(),
      renderCell: (r) => (r.name ? <bdi>{r.name}</bdi> : <span className="text-muted-foreground">—</span>),
      renderEditor: (r, i) => <Input value={r.name} dir="auto" onChange={(e) => patch(r.id, { name: e.target.value })} aria-label={`${tr(l("Name", "الاسم"))} ${i + 1}`} />,
    },
    {
      key: "share", label: tr(l("Share %", "النسبة ٪")), width: 3, align: "end",
      renderCell: (r) => <span className="tabular-nums" dir="ltr">{r.share == null ? "—" : `${r.share}%`}</span>,
      renderEditor: (r, i) => <NumberInput kind="float" precision={2} min={0} max={100} suffix="%" value={r.share} onChange={(v) => patch(r.id, { share: v })} aria-label={`${tr(l("Share %", "النسبة ٪"))} ${i + 1}`} />,
    },
  ];
  const ops = {
    onAddRow: () => setRows((rs) => [...rs, fresh()]),
    onInsertRow: (i: number) => setRows((rs) => [...rs.slice(0, i), fresh(), ...rs.slice(i)]),
    onDuplicateRow: (i: number) => setRows((rs) => [...rs.slice(0, i + 1), { ...rs[i], id: `s${++seq}` }, ...rs.slice(i + 1)]),
    onDeleteRows: (ix: number[]) => setRows((rs) => rs.filter((_, i) => !ix.includes(i))),
    onMoveRow: (from: number, to: number) => setRows((rs) => { const c = [...rs]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; }),
  };
  return { rows, columns, ops };
}

/** A running total under a split that must make 100 % (the host renders it — DataGrid has no footer). */
function Total({ rows }: { rows: Split[] }) {
  const tr = useTr();
  const total = Math.round(rows.reduce((n, r) => n + (r.share ?? 0), 0) * 100) / 100;
  const ok = total === 100;
  return (
    <p className={ok ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"} aria-live="polite" data-total="">
      {tr(l("Total", "المجموع"))} <span dir="ltr" className="tabular-nums">{total}%</span>
      {!ok && tr(l(" — must total 100%.", " — يجب أن يساوي ١٠٠٪."))}
    </p>
  );
}

function SplitGrid({ testId, layout, narrow, cardsBelow }: { testId: string; layout?: "table" | "cards" | "auto"; narrow?: boolean; cardsBelow?: number }) {
  const tr = useTr();
  const { language } = useLocale();
  const { rows, columns, ops } = useSplitGrid(language === "ar" ? SPLITS_AR : SPLITS);
  return (
    <div data-testid={testId} className={narrow ? "w-full max-w-[22rem] space-y-1.5" : "space-y-1.5"}>
      <DataGrid<Split> label={tr(l("Stage split", "توزيع المراحل"))} rows={rows} getRowKey={(r) => r.id} columns={columns}
        layout={layout} cardsBelow={cardsBelow} emptyText={tr(l("No stages yet.", "لا مراحل بعد."))} {...ops} />
      <Total rows={rows} />
    </div>
  );
}

export function DataGridResponsivePage() {
  const tr = useTr();
  const [narrow, setNarrow] = React.useState(false);
  return (
    <div className="space-y-12">
      <Section title={l("Responsive layout: auto", "التخطيط المتجاوب: تلقائي")} description={l("layout=\"auto\" shows one card per row while the grid's own container is narrower than cardsBelow (640 px by default; a ResizeObserver, not the window), and the table otherwise. Cards keep the grid's editing: tap a card (or its pencil) to edit that row inline, Escape or a tap outside stops; the ⋯ menu, selection, Add Row and paging stay. Nothing scrolls sideways.", "يعرض layout=\"auto\" بطاقة لكل صف ما دامت حاوية الشبكة نفسها أضيق من cardsBelow ‏(640 بكسل افتراضياً؛ عبر ResizeObserver لا عرض النافذة)، والجدول فيما عدا ذلك. تحافظ البطاقات على تحرير الشبكة: انقر البطاقة (أو القلم) لتحرير الصف في مكانه، و Escape أو النقر خارجها يُنهي التحرير؛ وتبقى قائمة ⋯ والتحديد وإضافة صف والتصفّح. لا تمرير أفقي.")}>
        <Example code={`<DataGrid layout="auto" rows={rows} getRowKey={(r) => r.id} columns={[
  { key: "code", label: "Code", mobile: false, renderCell: (r) => r.code },
  { key: "name", label: "Name", mobile: "primary", required: true, renderCell, renderEditor },
  { key: "share", label: "Share %", align: "end", renderCell, renderEditor },
]} onAddRow={add} onDeleteRows={remove} onInsertRow={insert} onMoveRow={move} />`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={narrow ? "outline" : "default"} aria-pressed={!narrow} onClick={() => setNarrow(false)}>{tr(l("Full width", "العرض الكامل"))}</Button>
            <Button type="button" size="sm" variant={narrow ? "default" : "outline"} aria-pressed={narrow} onClick={() => setNarrow(true)}>{tr(l("Narrow column (352 px)", "عمود ضيّق (352 بكسل)"))}</Button>
          </div>
          <SplitGrid testId="dg-auto" layout="auto" narrow={narrow} />
        </Example>
      </Section>
      <Section title={l("Cards", "البطاقات")} description={l("layout=\"cards\" at any width. The primary column (mobile: \"primary\") is the card's title; the others are label / value lines in column order; mobile: false leaves a column (here Code) off the card.", "‏layout=\"cards\" بأي عرض. العمود الأساسي (mobile: \"primary\") عنوان البطاقة؛ والبقية أسطر تسمية / قيمة بترتيب الأعمدة؛ و mobile: false يُخرج العمود (هنا الرمز) من البطاقة.")}>
        <Example code={`<DataGrid layout="cards" … />`}>
          <SplitGrid testId="dg-cards" layout="cards" />
        </Example>
      </Section>
      <Section title={l("Table (default)", "الجدول (الافتراضي)")} description={l("layout=\"table\" — unchanged for existing grids: a 32rem minimum width that scrolls sideways inside the grid frame on a phone. That scroll is the host's explicit choice (minTableWidth sets or removes it).", "‏layout=\"table\" — بلا تغيير للشبكات الحالية: حدّ أدنى للعرض 32rem يُمرَّر أفقياً داخل إطار الشبكة على الهاتف. هذا التمرير اختيار صريح من المضيف (minTableWidth يضبطه أو يزيله).")}>
        <Example code={`<DataGrid rows={rows} … />   // layout="table", minTableWidth="32rem"`}>
          <SplitGrid testId="dg-table" layout="table" />
        </Example>
        <Props rows={[
          ["layout", "\"table\" | \"cards\" | \"auto\"", l("Default \"table\". \"auto\" switches on the grid's container width.", "الافتراضي \"table\". ‏\"auto\" يبدّل حسب عرض حاوية الشبكة.")],
          ["cardsBelow", "number", l("\"auto\": cards below this container width in px (default 640).", "‏\"auto\": بطاقات تحت هذا العرض للحاوية بالبكسل (افتراضياً 640).")],
          ["minTableWidth", "string | number | false", l("\"table\" only: the minimum width that scrolls sideways (default \"32rem\"; false = none).", "‏\"table\" فقط: الحد الأدنى للعرض الذي يُمرَّر أفقياً (افتراضياً \"32rem\"؛ false = بلا).")],
          ["column.mobile", "\"primary\" | false", l("Card title / left off the card (as ListView's ColumnDef.mobile).", "عنوان البطاقة / خارج البطاقة (كما في ColumnDef.mobile في ListView).")],
        ]} />
      </Section>
    </div>
  );
}
