import * as React from "react";
import { arSA } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar, DateField, DateTimeField, Label, TimeField, useLocale } from "@ui";
import { Cell, Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const iso = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "—");

export function CalendarPage() {
  const { isRTL } = useLocale();
  const [day, setDay] = React.useState<Date | undefined>(new Date());
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = new Date(); const to = new Date(); to.setDate(from.getDate() + 4);
    return { from, to };
  });
  const loc = { locale: isRTL ? arSA : undefined, dir: isRTL ? "rtl" : "ltr" } as const;
  return (
    <div className="space-y-12">
      <Section title={l("Single date", "تاريخ واحد")} description={l("Pass the locale and direction for Arabic; the navigation arrows mirror.", "مرّر اللغة والاتجاه للعربية؛ أسهم التنقّل تنعكس.")}>
        <Example center code={`import { arSA } from "date-fns/locale";
const { isRTL } = useLocale();
<Calendar mode="single" selected={day} onSelect={setDay}
  locale={isRTL ? arSA : undefined} dir={isRTL ? "rtl" : "ltr"} />`}>
          <div className="rounded-2xl border border-border">
            <Calendar mode="single" selected={day} onSelect={setDay} {...loc} />
          </div>
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{iso(day)}</span>
        </Example>
      </Section>
      <Section title={l("Range, two months", "نطاق، شهران")}>
        <Example center code={`<Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} />`}>
          <div className="rounded-2xl border border-border">
            <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} {...loc} />
          </div>
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{iso(range?.from)} → {iso(range?.to)}</span>
        </Example>
      </Section>
      <Section title={l("Month and year dropdowns", "قوائم الشهر والسنة")}>
        <Example center code={`<Calendar mode="single" captionLayout="dropdown"
  startMonth={new Date(2020, 0)} endMonth={new Date(2030, 11)} />`}>
          <div className="rounded-2xl border border-border">
            <Calendar mode="single" captionLayout="dropdown" startMonth={new Date(2020, 0)} endMonth={new Date(2030, 11)} selected={day} onSelect={setDay} {...loc} />
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function DateTimePage() {
  const tr = useTr();
  const [date, setDate] = React.useState("2026-10-17");
  const [time, setTime] = React.useState("09:30");
  const [dt, setDt] = React.useState("");
  const [due, setDue] = React.useState("");
  return (
    <div className="space-y-12">
      <Section title={l("Fields", "الحقول")} description={l("Controlled string values, in the same formats as the native inputs they replace.", "قيم نصية متحكَّم بها، بنفس صيغ الحقول الأصلية التي تحلّ محلّها.")}>
        <Example code={`const [date, setDate] = useState("2026-10-17");  // "YYYY-MM-DD"
const [time, setTime] = useState("09:30");       // "HH:mm"
const [at, setAt] = useState("");                // "YYYY-MM-DDTHH:mm"

<DateField value={date} onChange={setDate} />
<TimeField value={time} onChange={setTime} interval={15} />
<DateTimeField value={at} onChange={setAt} />`}>
          <div className="grid gap-6 sm:grid-cols-3">
            <Cell label="DateField"><div className="grid gap-1.5"><Label htmlFor="sc-date">{tr(l("Check-in", "تاريخ الوصول"))}</Label><DateField id="sc-date" value={date} onChange={setDate} /></div></Cell>
            <Cell label="TimeField"><div className="grid gap-1.5"><Label htmlFor="sc-time">{tr(l("Arrival time", "وقت الوصول"))}</Label><TimeField id="sc-time" value={time} onChange={setTime} interval={15} /></div></Cell>
            <Cell label="DateTimeField"><div className="grid gap-1.5"><Label htmlFor="sc-dt">{tr(l("Reminder", "التذكير"))}</Label><DateTimeField id="sc-dt" value={dt} onChange={setDt} /></div></Cell>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground" dir="ltr">date: "{date}" · time: "{time}" · datetime: "{dt}"</p>
        </Example>
      </Section>
      <Section title={l("Error, disabled and dropdown caption", "الخطأ والتعطيل وقوائم العنوان")}>
        <Example code={`<DateField value={due} onChange={setDue} error={due ? undefined : "Required"} />
<DateField value="2026-10-17" onChange={() => {}} disabled />
<DateField value={date} onChange={setDate} captionLayout="dropdown" />`}>
          <div className="grid gap-6 sm:grid-cols-3">
            <Cell label="error"><DateField aria-label={tr(l("Due date", "تاريخ الاستحقاق"))} value={due} onChange={setDue} error={due ? undefined : tr(l("Required", "مطلوب"))} /></Cell>
            <Cell label="disabled"><DateField aria-label={tr(l("Created", "تاريخ الإنشاء"))} value="2026-10-17" onChange={() => {}} disabled /></Cell>
            <Cell label={'captionLayout="dropdown"'}><DateField aria-label={tr(l("Birth date", "تاريخ الميلاد"))} value={date} onChange={setDate} captionLayout="dropdown" /></Cell>
          </div>
        </Example>
        <Props rows={[
          ["value / onChange", "string", l("Controlled value; an empty string means no value.", "قيمة متحكَّم بها؛ النص الفارغ يعني لا قيمة.")],
          ["error", "string", l("Message under the field; also marks it aria-invalid.", "رسالة تحت الحقل؛ وتضع aria-invalid أيضاً.")],
          ["interval", "number", l("TimeField / DateTimeField: minute step (default 5 / 15).", "‏TimeField و DateTimeField: خطوة الدقائق (افتراضياً 5 / 15).")],
          ["captionLayout · startMonth · endMonth", "DateField", l("Month and year selects in the calendar caption, and their bounds.", "قوائم الشهر والسنة في عنوان التقويم وحدودها.")],
          ["disabled · id · aria-label · className", "", l("As on any field.", "كما في أي حقل.")],
        ]} />
      </Section>
    </div>
  );
}
