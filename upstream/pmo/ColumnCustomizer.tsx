import { useState } from "react";
import { Columns3, GripVertical, X, Plus, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/lib/list-view";

/**
 * Frappe-CRM-style column manager: shown columns as draggable rows (grip + label + remove ×), and an
 * "Add column" picker (searchable list of hidden columns). `visibleKeys` is the ordered shown list.
 */
export function ColumnCustomizer<T>({
  columns,
  visibleKeys,
  onChange,
}: {
  columns: ColumnDef<T>[];
  visibleKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  const { t } = useApp();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");

  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
  const isLocked = (key: string) => columns.find((c) => c.key === key)?.alwaysVisible;
  const hiddenKeys = columns.map((c) => c.key).filter((k) => !visibleKeys.includes(k));
  const hiddenMatches = hiddenKeys.filter((k) => labelOf(k).toLowerCase().includes(q.trim().toLowerCase()));

  const remove = (key: string) => { if (!isLocked(key)) onChange(visibleKeys.filter((k) => k !== key)); };
  const add = (key: string) => { onChange([...visibleKeys, key]); setQ(""); setAdding(false); };

  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    const next = [...visibleKeys];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    onChange(next);
    setDragIndex(null);
  };

  return (
    <Popover onOpenChange={(o) => { if (!o) { setAdding(false); setQ(""); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="h-4 w-4" /> {t("columns")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">{t("edit_columns")}</div>

        <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
          {visibleKeys.map((key, idx) => {
            const locked = isLocked(key);
            return (
              <div
                key={key}
                draggable={!locked}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(idx)}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm",
                  locked ? "opacity-70" : "cursor-grab hover:bg-accent active:cursor-grabbing",
                  dragIndex === idx && "opacity-40",
                )}
              >
                <GripVertical className={cn("h-4 w-4 shrink-0 text-muted-foreground", locked && "invisible")} />
                <span className="flex-1 truncate">{labelOf(key)}</span>
                {!locked && (
                  <button type="button" aria-label={t("remove")} className="text-muted-foreground hover:text-destructive" onClick={() => remove(key)}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t p-2">
          {!adding ? (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-muted-foreground" disabled={hiddenKeys.length === 0} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> {t("add_column")}
            </Button>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_ellipsis")} className="h-8 ps-7 text-sm" />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {hiddenMatches.length === 0 ? (
                  <p className="px-2 py-2 text-center text-xs text-muted-foreground">{t("no_results")}</p>
                ) : (
                  hiddenMatches.map((key) => (
                    <button key={key} type="button" onClick={() => add(key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent">
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{labelOf(key)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
