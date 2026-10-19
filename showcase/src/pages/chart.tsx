/** 0.3.0 — @solvfast/ui/chart (on the app's recharts). A module of its own, so recharts loads only with this section. */
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { useLocale } from "@ui";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@ui/chart";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const MONTHS = [["Jan", "يناير"], ["Feb", "فبراير"], ["Mar", "مارس"], ["Apr", "أبريل"], ["May", "مايو"], ["Jun", "يونيو"]];
const DATA = [[186, 80], [305, 200], [237, 120], [73, 190], [209, 130], [214, 140]];

export function ChartPage() {
  const tr = useTr();
  const { isRTL } = useLocale();
  const config = {
    opened: { label: tr(l("Opened", "مفتوحة")), color: "hsl(var(--primary))" },
    closed: { label: tr(l("Closed", "مغلقة")), theme: { light: "#0ea5e9", dark: "#38bdf8" } },
  } satisfies ChartConfig;
  const data = MONTHS.map(([en, ar], i) => ({ month: isRTL ? ar : en, opened: DATA[i][0], closed: DATA[i][1] }));
  return (
    <div className="space-y-12">
      <Section title={l("Chart", "الرسم البياني")} description={l("@solvfast/ui/chart: the Design System's container, tooltip and legend around recharts 2 (installed by the app). Series colours come from the config, per theme.", "‏@solvfast/ui/chart: حاوية نظام التصميم وتلميحه ومفتاحه حول recharts 2 (يثبّته التطبيق). ألوان السلاسل من الإعداد، لكل سمة.")}>
        <Example code={`import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@solvfast/ui/chart";

const config = {
  opened: { label: "Opened", color: "hsl(var(--primary))" },
  closed: { label: "Closed", theme: { light: "#0ea5e9", dark: "#38bdf8" } },
} satisfies ChartConfig;

<ChartContainer config={config} className="h-64 w-full">
  <BarChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="opened" fill="var(--color-opened)" radius={4} />
    <Bar dataKey="closed" fill="var(--color-closed)" radius={4} />
  </BarChart>
</ChartContainer>`}>
          <div data-testid="chart-bar" className="grid gap-8 md:grid-cols-2">
            <ChartContainer config={config} className="h-64 w-full">
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} reversed={isRTL} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="opened" fill="var(--color-opened)" radius={4} />
                <Bar dataKey="closed" fill="var(--color-closed)" radius={4} />
              </BarChart>
            </ChartContainer>
            <ChartContainer config={config} className="h-64 w-full">
              <LineChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} reversed={isRTL} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line dataKey="opened" stroke="var(--color-opened)" strokeWidth={2} dot={false} />
                <Line dataKey="closed" stroke="var(--color-closed)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </Example>
        <Props rows={[
          ["config", "ChartConfig", l("Per series: label, and colour (or a { light, dark } pair) exposed as --color-<key>.", "لكل سلسلة: التسمية واللون (أو زوج { light, dark }) متاحاً كـ ‎--color-<key>‎.")],
          ["<ChartTooltipContent>", "indicator · hideLabel · nameKey", l("Tooltip in the package look; labels from the config.", "تلميح بمظهر الحزمة؛ التسميات من الإعداد.")],
          ["RTL", "", l("recharts draws left-to-right; reverse the category axis yourself in Arabic (reversed={isRTL}), as here.", "يرسم recharts من اليسار إلى اليمين؛ اعكس محور الفئات بنفسك في العربية (reversed={isRTL}) كما هنا.")],
        ]} />
      </Section>
    </div>
  );
}
