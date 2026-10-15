import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ColumnDef, SortState } from "@/lib/list-view";

/**
 * Presentational list table. Sorting + column visibility are owned by `useListView` and passed in, so the
 * page can host all controls in one toolbar. Supports sortable headers, optional selection, row clicks.
 */
export function ListTable<T>({
  columns,
  rows,
  sort,
  onSortToggle,
  rowKey,
  onRowClick,
  selectable = false,
  selected = [],
  onToggle,
  onToggleAll,
  rowClassName,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  sort: SortState;
  onSortToggle: (key: string) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  const { t } = useApp();
  const allChecked = selectable && rows.length > 0 && selected.length === rows.length;
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allChecked} onCheckedChange={(c) => onToggleAll?.(Boolean(c))} aria-label={t("select_all")} />
                </th>
              )}
              {columns.map((col) => {
                const active = sort.key === col.key;
                const SortIcon = !col.sortValue ? null : active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th key={col.key} className={cn("px-4 py-2.5 font-medium", col.align === "end" ? "text-end" : "text-start")}>
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => onSortToggle(col.key)}
                        className={cn("inline-flex items-center gap-1 hover:text-foreground", col.align === "end" && "flex-row-reverse", active && "text-foreground")}
                      >
                        {col.label}
                        {SortIcon && <SortIcon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selected.includes(id);
              return (
                <tr
                  key={id}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "link" : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => { if (onRowClick && e.key === "Enter") onRowClick(row); }}
                  className={cn(
                    "border-b border-border outline-none last:border-0",
                    onRowClick && "cursor-pointer hover:bg-accent/50 focus-visible:bg-accent/60",
                    isSelected && "bg-primary/5",
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => onToggle?.(id)} aria-label={t("select")} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.align === "end" && "text-end", col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">{t("no_data")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
