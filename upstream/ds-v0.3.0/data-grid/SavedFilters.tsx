import { useState } from "react";
import { Bookmark, Trash2, Save } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { SavedFilter } from "@/lib/data-grid/storage";
import type { FilterQuery } from "@/lib/data-grid/filter-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Saved views — store/apply/delete named filter presets (client-side, per doctype). */
export function SavedFilters({
  saved,
  activeCount,
  onApply,
  onSave,
  onDelete,
}: {
  saved: SavedFilter[];
  activeCount: number;
  onApply: (q: FilterQuery) => void;
  onSave: (label: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useApp();
  const [label, setLabel] = useState("");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Bookmark className="h-4 w-4" /> {t("saved")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {saved.length > 0 ? (
          <div className="mb-2 space-y-0.5">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent">
                <button className="flex-1 truncate text-start text-sm" onClick={() => onApply(s.query)}>{s.label}</button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-2 px-2 py-1 text-xs text-muted-foreground">{t("no_saved_filters")}</p>
        )}
        <div className="flex items-center gap-1.5 border-t border-border pt-2">
          <Input className="h-8" placeholder={t("save_current_as")} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button size="icon" className="h-8 w-8 shrink-0" disabled={!label.trim() || activeCount === 0} onClick={() => { onSave(label.trim()); setLabel(""); }}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
