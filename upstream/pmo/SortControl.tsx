import { ArrowDownUp, ArrowUp, ArrowDown, Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ColumnDef, SortState } from "@/lib/list-view";

/** "Sort by" control: pick a sortable field, toggle ascending / descending. */
export function SortControl<T>({
  columns,
  sort,
  onChange,
}: {
  columns: ColumnDef<T>[];
  sort: SortState;
  onChange: (s: SortState) => void;
}) {
  const { t } = useApp();
  const sortable = columns.filter((c) => c.sortValue);
  const activeLabel = columns.find((c) => c.key === sort.key)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowDownUp className="h-4 w-4" />
          {activeLabel ? <span className="max-w-[10rem] truncate">{activeLabel}</span> : t("sort_by")}
          {sort.key && (sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("sort_by")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortable.map((col) => (
          <DropdownMenuItem
            key={col.key}
            onSelect={(e) => {
              e.preventDefault();
              onChange(sort.key === col.key ? { key: col.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" });
            }}
            className="justify-between"
          >
            <span className="truncate">{col.label}</span>
            {sort.key === col.key && (sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
          </DropdownMenuItem>
        ))}
        {sort.key && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange({ key: null, dir: "asc" }); }}>
              <Check className={cn("h-4 w-4", "opacity-0")} /> {t("clear_sort")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
