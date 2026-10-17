/** Tab strips on @solvfast/ui's Tabs, compared with Sear's real SegmentedTabs (tools/parity ?view=parts), plus a
 *  standalone Calendar and a DateField for the calendar-surface check. Playground only. */
import * as React from "react";
import { Clock, Globe2, History, Layers, ListChecks } from "lucide-react";
import { Calendar, DateField, Tabs, TabsList, TabsTrigger, useLocale } from "@ui";

export function PartsPage() {
  const { isRTL } = useLocale();
  const L = (en: string, ar: string) => (isRTL ? ar : en);
  const [date, setDate] = React.useState("2026-10-17");
  return (
    <div className="space-y-6 p-6">
      <div data-testid="tabs-plain">
        <Tabs defaultValue="a">
          <TabsList aria-label="Plain">
            <TabsTrigger value="a">{L("Overview", "نظرة عامة")}</TabsTrigger>
            <TabsTrigger value="b">{L("Fields", "الحقول")}</TabsTrigger>
            <TabsTrigger value="c" disabled>{L("History", "السجل")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div data-testid="tabs-icons">
        <Tabs defaultValue="b">
          <TabsList aria-label="Icons">
            <TabsTrigger value="a"><Layers />{L("Overview", "نظرة عامة")}</TabsTrigger>
            <TabsTrigger value="b"><ListChecks />{L("Fields", "الحقول")}</TabsTrigger>
            <TabsTrigger value="c"><History />{L("History", "السجل")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {/* sear_studio/pages/Calendars/CalendarFormPage.tsx — the Working Hours "Coverage" toggle (fullWidth compact) */}
      <div data-testid="tabs-working-hours">
        <Tabs defaultValue="business">
          <TabsList aria-label={L("Coverage", "نوع التغطية")} className="flex w-full max-w-md">
            <TabsTrigger value="24_7" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Globe2 />24/7</TabsTrigger>
            <TabsTrigger value="business" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Clock />{L("Business Hours", "ساعات العمل")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div data-testid="calendar-inline" className="inline-block"><Calendar mode="single" selected={new Date(2026, 9, 17)} defaultMonth={new Date(2026, 9, 1)} /></div>
      <div data-testid="date-field" className="w-64"><DateField value={date} onChange={setDate} /></div>
    </div>
  );
}
