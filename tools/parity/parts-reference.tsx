/** Reference tab strips: Sear's REAL SegmentedTabs with the props Sear's pages pass (the Working Hours "Coverage" toggle
 *  from sear_studio/pages/Calendars/CalendarFormPage.tsx: fullWidth compact max-w-md). Read-only. */
import * as React from "react";
import { Clock, Globe2, History, Layers, ListChecks } from "lucide-react";
import { SegmentedTabs } from "@sear/components/SegmentedTabs";
import { useLocale } from "@ui";

export function SearParts() {
  const { isRTL } = useLocale();
  const L = (en: string, ar: string) => (isRTL ? ar : en);
  const [a, setA] = React.useState("a");
  const [b, setB] = React.useState("b");
  const [c, setC] = React.useState("business");
  return (
    <div className="sear-studio min-h-screen">
      <div className="space-y-6 p-6">
        <div data-testid="tabs-plain">
          <SegmentedTabs isRTL={isRTL} ariaLabel="Plain" value={a} onChange={setA} items={[
            { key: "a", label: L("Overview", "نظرة عامة") }, { key: "b", label: L("Fields", "الحقول") },
            { key: "c", label: L("History", "السجل"), disabled: true },
          ]} />
        </div>
        <div data-testid="tabs-icons">
          <SegmentedTabs isRTL={isRTL} ariaLabel="Icons" value={b} onChange={setB} items={[
            { key: "a", label: L("Overview", "نظرة عامة"), Icon: Layers }, { key: "b", label: L("Fields", "الحقول"), Icon: ListChecks },
            { key: "c", label: L("History", "السجل"), Icon: History },
          ]} />
        </div>
        <div data-testid="tabs-working-hours">
          <SegmentedTabs isRTL={isRTL} fullWidth compact className="max-w-md" ariaLabel={L("Coverage", "نوع التغطية")} value={c} onChange={setC} items={[
            { key: "24_7", label: "24/7", Icon: Globe2 },
            { key: "business", label: L("Business Hours", "ساعات العمل"), Icon: Clock },
          ]} />
        </div>
      </div>
    </div>
  );
}
