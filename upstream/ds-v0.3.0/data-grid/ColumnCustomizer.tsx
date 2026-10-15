import { Columns3, ChevronUp, ChevronDown } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { ColumnMeta } from "@/lib/data-grid/frappe-meta";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Column picker — toggle visibility + reorder the visible columns. Persisted by useDataGrid (per doctype). */
export function ColumnCustomizer({
  columns,
  visibleKeys,
  onChange,
}: {
  columns: ColumnMeta[];
  visibleKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  const { t } = useApp();
  const visibleSet = new Set(visibleKeys);
  // visible (in order) first, then the rest
  const ordered = [...visibleKeys.map((k) => columns.find((c) => c.key === k)).filter(Boolean) as ColumnMeta[],
    ...columns.filter((c) => !visibleSet.has(c.key))];

  const toggle = (key: string) =>
    onChange(visibleSet.has(key) ? visibleKeys.filter((k) => k !== key) : [...visibleKeys, key]);
  const move = (key: string, dir: -1 | 1) => {
    const i = visibleKeys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visibleKeys.length) return;
    const next = [...visibleKeys];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Columns3 className="h-4 w-4" /> {t("columns")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="end">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("toggle_columns")}</div>
        <ScrollArea className="max-h-72">
          <div className="space-y-0.5">
            {ordered.map((c) => {
              const on = visibleSet.has(c.key);
              const vi = visibleKeys.indexOf(c.key);
              return (
                <div key={c.key} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                  <Checkbox checked={on} onCheckedChange={() => toggle(c.key)} id={`col-${c.key}`} />
                  <label htmlFor={`col-${c.key}`} className="flex-1 cursor-pointer truncate text-sm">{c.label}</label>
                  {on && (
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={vi <= 0} onClick={() => move(c.key, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={vi >= visibleKeys.length - 1} onClick={() => move(c.key, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
