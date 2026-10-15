import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useDataGrid, type UseDataGridOptions } from "@/hooks/useDataGrid";
import { Cell } from "@/lib/data-grid/cell-render";
import { cn } from "@/lib/utils";
import { AdvancedFilter } from "./AdvancedFilter";
import { ColumnCustomizer } from "./ColumnCustomizer";
import { QuickFilters } from "./QuickFilters";
import { SavedFilters } from "./SavedFilters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface DataGridProps extends UseDataGridOptions {
  doctype: string;
  /** Extra toolbar actions on the trailing side (e.g. a "New" button). */
  actions?: React.ReactNode;
  searchable?: boolean;
  onRowClick?: (row: Record<string, any>) => void;
  /** Optional custom cell renderer per fieldname — falls back to the type-aware default. */
  renderCell?: (row: Record<string, any>, fieldname: string) => React.ReactNode;
  className?: string;
}

/**
 * Metadata-driven list view — pass a `doctype` and it fetches the Frappe meta (built-in `getdoctype`) +
 * data (`client.get_list`) and renders advanced filter + quick filters + column picker + saved views + sort +
 * pagination. No per-doctype backend. In the Frontend phase pass `mock={{ rows }}` to render before the
 * doctype exists; drop it in the Backend phase to go live.
 */
export function DataGrid({ doctype, actions, searchable = true, onRowClick, renderCell, className, ...opts }: DataGridProps) {
  const { t, direction } = useApp();
  const g = useDataGrid(doctype, opts);
  const SortIcon = ({ k }: { k: string }) =>
    g.sort.key === k ? (g.sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null;
  const Prev = direction === "rtl" ? ChevronRight : ChevronLeft;
  const Next = direction === "rtl" ? ChevronLeft : ChevronRight;
  const colCount = Math.max(g.visibleColumns.length, 1);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 ps-8" placeholder={t("search")} value={g.search} onChange={(e) => g.setSearch(e.target.value)} />
          </div>
        )}
        <QuickFilters fields={g.quickFilterFields} query={g.query} onChange={g.setQuery} />
        <div className="ms-auto flex items-center gap-2">
          <SavedFilters saved={g.saved} activeCount={g.activeCount} onApply={g.applySaved} onSave={g.saveCurrent} onDelete={g.removeSaved} />
          <AdvancedFilter fields={g.meta?.filterFields ?? []} query={g.query} onChange={g.setQuery} activeCount={g.activeCount} />
          <ColumnCustomizer columns={g.columns} visibleKeys={g.visibleKeys} onChange={g.setVisibleKeys} />
          {actions}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {g.visibleColumns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 text-start font-medium">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
                      onClick={() => g.toggleSort(c.key)}
                    >
                      {c.label} <SortIcon k={c.key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.loading && g.rows.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {g.visibleColumns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                  </tr>
                ))}
              {!g.loading && g.rows.length === 0 && (
                <tr><td colSpan={colCount} className="py-12 text-center text-muted-foreground">{t("no_data")}</td></tr>
              )}
              {g.rows.map((row) => (
                <tr
                  key={row.name}
                  onClick={() => onRowClick?.(row)}
                  className={cn("border-b border-border last:border-0", onRowClick && "cursor-pointer hover:bg-accent/50")}
                >
                  {g.visibleColumns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {renderCell ? renderCell(row, c.key) : <Cell value={row[c.key]} col={c} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("total")}: {g.total}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!g.hasPrev} onClick={() => g.setPage(g.page - 1)}><Prev className="h-4 w-4" /></Button>
          <span className="px-2">{g.page + 1}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!g.hasNext} onClick={() => g.setPage(g.page + 1)}><Next className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
