import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "../primitives/tabs";
import { useLocale } from "../theme/ThemeProvider";
import { loc, type Localized } from "../lib/localized";
import { cn } from "../lib/cn";

export type FamilyTab = "records" | "types";

export interface FamilyTabProps {
  /** Default "Records" / "Types" (translated). */
  label?: Localized;
  icon?: React.ReactNode;
}

export interface FamilyTabsProps {
  active: FamilyTab;
  /** The package has no router: the app routes (e.g. `navigate(tab === "types" ? "/tickets/types" : "/tickets")`). */
  onChange: (tab: FamilyTab) => void;
  /** `false` hides the records tab, for a family whose records are listed elsewhere (task types). Default shown. */
  records?: false | FamilyTabProps;
  types?: FamilyTabProps;
  className?: string;
}

/** A family's two tabs, Records | Types, centred above the page. With `records={false}` only Types is shown. */
export function FamilyTabs({ active, onChange, records, types, className }: FamilyTabsProps) {
  const { t, language } = useLocale();
  const tabs: { id: FamilyTab; label: string; icon?: React.ReactNode }[] = [
    ...(records === false ? [] : [{ id: "records" as const, label: loc(records?.label, language) || t("famRecords"), icon: records?.icon }]),
    { id: "types", label: loc(types?.label, language) || t("famTypes"), icon: types?.icon },
  ];
  return (
    <div className={cn("flex justify-center", className)}>
      <Tabs value={active} onValueChange={(id) => onChange(id as FamilyTab)}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
