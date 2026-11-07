/**
 * GroupBySidebar — Desk's list sidebar "group by" counts (list_sidebar_group_by.js) as a presentational, backend-free
 * component: sections of values with their counts; clicking a value applies it, clicking the applied value removes it
 * (list_sidebar_group_by.js:240-256). The host loads the counts (e.g. the Frappe entry's `useGroupByCounts`) and turns a
 * selection into a filter. Goes into `ListView`'s `aside`.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { Input } from "../../primitives/input";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";

export interface GroupBySidebarItem {
  /** The value a selection applies ("" = not set). */
  value: string;
  label: string;
  count: number;
}
export interface GroupBySidebarSection {
  field: string;
  label: string;
  items: GroupBySidebarItem[];
  loading?: boolean;
  /** The counts could not be loaded (the section says so; the list still works). */
  error?: boolean;
}
export interface GroupBySidebarProps {
  sections: GroupBySidebarSection[];
  /** The applied value per field (its item shows as selected). */
  active?: Record<string, string | undefined>;
  /** `value` null = remove the field's filter (the applied item was clicked again). */
  onSelect: (field: string, value: string | null) => void;
  /** Accessible name of the sidebar (default "Sidebar"). */
  label?: string;
  /** Show a search box in a section with more items than this (Desk's dropdown search). Default 8. */
  searchFrom?: number;
  className?: string;
  /** Extra content after the sections (e.g. an "Edit" link). */
  children?: React.ReactNode;
}

export function GroupBySidebar({ sections, active = {}, onSelect, label, searchFrom = 8, className, children }: GroupBySidebarProps) {
  const { t, language } = useLocale();
  return (
    <nav aria-label={label ?? t("listSidebar")} className={cn("space-y-4 text-sm", className)} data-sf-list-sidebar="">
      {sections.map((s) => <Section key={s.field} section={s} active={active[s.field]} onSelect={onSelect} searchFrom={searchFrom} language={language} />)}
      {children}
    </nav>
  );
}

function Section({ section: s, active, onSelect, searchFrom, language }: { section: GroupBySidebarSection; active?: string; onSelect: GroupBySidebarProps["onSelect"]; searchFrom: number; language: string }) {
  const { t } = useLocale();
  const [q, setQ] = React.useState("");
  const id = React.useId();
  const shown = q.trim() ? s.items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())) : s.items;
  return (
    <section aria-labelledby={id} data-sidebar-field={s.field}>
      <h3 id={id} className="mb-1.5 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</h3>
      {s.loading ? (
        <div className="space-y-1.5 px-2" aria-busy="true"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
      ) : s.error ? (
        <p className="px-2 text-xs text-muted-foreground" role="status">{t("loadError")}</p>
      ) : !s.items.length ? (
        <p className="px-2 text-xs text-muted-foreground">{t("noData")}</p>
      ) : (
        <>
          {s.items.length > searchFrom && (
            <Input className="mb-1 h-7 text-xs" placeholder={t("listSearch")} aria-label={`${t("listSearch")} ${s.label}`} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {shown.map((i) => {
              const on = active !== undefined && active === i.value;
              return (
                <li key={`${i.value}\u0000${i.label}`}>
                  <button type="button" aria-pressed={on} onClick={() => onSelect(s.field, on ? null : i.value)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on && "bg-accent font-medium text-foreground")}>
                    <Check className={cn("h-3.5 w-3.5 shrink-0", on ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{i.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">{i.count.toLocaleString(language === "ar" ? "ar-EG" : "en-US")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
