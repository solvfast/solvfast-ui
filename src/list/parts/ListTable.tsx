/**
 * The table — Sear's DataGrid markup (design_system components/data-grid/DataGrid.tsx at v0.3.0, as Sear renders it)
 * plus PMO's ListTable features (solvfast_pmo components/lists/ListTable.tsx, GroupedListTable.tsx).
 *
 * From PMO: selection column with select-all, keyboard-openable rows (Enter), `rowClassName`, selected-row tint,
 * collapsible groups with counts. Fixes: non-sortable columns no longer render a sort button that does nothing (Sear's
 * `actions` column) — their label keeps the same case as the sortable ones (Tailwind's preflight sets `text-transform: none`
 * on buttons, so Sear's `uppercase` header row never showed uppercase); `aria-sort` on sorted headers; select-all reflects only the rows it acts on (PMO's grouped
 * select-all compared a group's rows with the whole selection).
 */
import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { Checkbox } from "../../primitives/checkbox";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "../../lib/cn";
import { loc } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";
import { fieldOf, type ColumnDef } from "../model/columns";
import type { SortState } from "../model/sort";
import type { RowGroup } from "../model/group";

const fmtDate = (v: unknown, lang: string, withTime = false) => {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { year: "numeric", month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
};
const fmtNumber = (v: unknown, lang: string, currency = false) => {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? "");
  return n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", currency ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});
};

/** Type-aware default cell — Sear's `Cell` (lib/data-grid/cell-render.tsx) by Frappe fieldtype, falling back to the
 *  column `type` (PMO MetaCell). Numbers and dates are `dir="ltr"` so Arabic pages keep digits readable. */
export function DefaultCell<T>({ value, col }: { value: unknown; col: ColumnDef<T> }) {
  const { language, t } = useLocale();
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  const ft = col.fieldtype ?? ({ number: "Float", date: "Date", boolean: "Check", select: "Select", link: "Link" } as Record<string, string>)[col.type ?? ""];
  switch (ft) {
    case "Check": {
      const yes = value === true || value === 1 || value === "1" || value === "true";
      return yes ? <Check className="h-4 w-4 text-success" aria-label={t("yes")} /> : <X className="h-4 w-4 text-muted-foreground" aria-label={t("no")} />;
    }
    case "Date": return <span dir="ltr">{fmtDate(value, language)}</span>;
    case "Datetime": return <span dir="ltr">{fmtDate(value, language, true)}</span>;
    case "Currency": return <span dir="ltr" className="font-medium tabular-nums">{fmtNumber(value, language, true)}</span>;
    case "Int": case "Float": case "Percent":
      return <span dir="ltr" className="tabular-nums">{fmtNumber(value, language)}{ft === "Percent" ? "%" : ""}</span>;
    case "Select": return <Badge variant="secondary" className="font-normal">{String(value)}</Badge>;
    case "Link": case "Dynamic Link": return <span className="font-medium text-foreground">{String(value)}</span>;
    default: return <span className="truncate">{String(value)}</span>;
  }
}

export interface ListTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort: SortState;
  onSortToggle: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Selection (omit to hide the checkbox column). */
  selection?: { isSelected: (row: T) => boolean; toggleRow: (row: T) => void; setRowsSelected: (rows: T[], on: boolean) => void };
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Extra classes for the card. */
  className?: string;
}

export function ListTable<T>({
  columns, rows, rowKey, sort, onSortToggle, onRowClick, rowClassName, selection, loading, error, onRetry, empty, className,
}: ListTableProps<T>) {
  const { language, t } = useLocale();
  const colCount = Math.max(columns.length, 1) + (selection ? 1 : 0);
  const allOn = !!selection && rows.length > 0 && rows.every((r) => selection.isSelected(r));
  const someOn = !!selection && !allOn && rows.some((r) => selection.isSelected(r));

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selection && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={(c) => selection.setRowsSelected(rows, c === true)} aria-label={t("selectAll")} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort.key === c.key;
                const label = loc(c.label, language);
                return (
                  <th key={c.key} className={cn("px-4 py-2.5 font-medium", c.align === "end" ? "text-end" : "text-start")}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortable === false ? <span className="normal-case">{label}</span> : (
                      <button className="inline-flex items-center gap-1 hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground" onClick={() => onSortToggle(c.key)}>
                        {label} {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0" aria-hidden>
                  {selection && <td className="px-3 py-3" />}
                  {columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                </tr>
              ))}
            {!loading && error && (
              <tr><td colSpan={colCount} className="py-12 text-center">
                <div className="flex flex-col items-center gap-3" role="alert">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
                  <p className="text-sm text-muted-foreground">{error === true ? t("loadError") : error}</p>
                  {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
                </div>
              </td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={colCount} className="py-12 text-center text-muted-foreground">{empty ?? t("noData")}</td></tr>
            )}
            {!error && rows.map((row) => {
              const on = !!selection?.isSelected(row);
              return (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => { if (onRowClick && e.key === "Enter" && e.target === e.currentTarget) onRowClick(row); }}
                  aria-selected={selection ? on : undefined}
                  className={cn(
                    "border-b border-border last:border-0",
                    onRowClick && "cursor-pointer outline-none hover:bg-accent/50 focus-visible:bg-accent/60",
                    on && "bg-primary/5",
                    rowClassName?.(row),
                  )}
                >
                  {selection && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={on} onCheckedChange={() => selection.toggleRow(row)} aria-label={t("selectRow")} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", c.align === "end" && "text-end", c.className)}>
                      {c.render ? c.render(row) : <DefaultCell value={(row as Record<string, unknown>)[fieldOf(c)]} col={c} />}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Collapsible groups, one table each, with a count (PMO GroupedListTable). `partial` adds "+" to counts when only
 *  part of the records is loaded (server mode, rule C1). */
export function GroupedListTable<T>({ groups, partial, ...table }: Omit<ListTableProps<T>, "rows"> & { groups: RowGroup<T>[]; partial?: boolean }) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setCollapsed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const open = !collapsed.has(g.key);
        return (
          <div key={g.key} className="space-y-2">
            <button type="button" onClick={() => toggle(g.key)} aria-expanded={open} className="flex w-full items-center gap-2 text-sm font-semibold text-foreground">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
              <span>{g.label}</span>
              <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{g.rows.length}{partial ? "+" : ""}</span>
            </button>
            {open && <ListTable {...table} rows={g.rows} />}
          </div>
        );
      })}
    </div>
  );
}
