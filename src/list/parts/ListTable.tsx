/**
 * The table — Sear's DataGrid markup (design_system components/data-grid/DataGrid.tsx at v0.3.0, as Sear renders it)
 * plus PMO's ListTable features (solvfast_pmo components/lists/ListTable.tsx, GroupedListTable.tsx).
 *
 * From PMO: selection column with select-all, keyboard-openable rows (Enter), `rowClassName`, selected-row tint,
 * collapsible groups with counts — in one shared table (PMO drew a table per group, so columns didn't line up).
 * Fixes: non-sortable columns no longer render a sort button that does nothing (Sear's `actions` column) — their
 * label keeps the same case as the sortable ones (Tailwind's preflight sets `text-transform: none` on buttons, so
 * Sear's `uppercase` header row never showed uppercase); `aria-sort` on sorted headers; select-all reflects only the
 * rows it acts on (PMO's grouped select-all compared a group's rows with the whole selection).
 */
import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Heart, X } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { StatusBadge } from "../../record/StatusBadge";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { Checkbox } from "../../primitives/checkbox";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "../../lib/cn";
import { loc } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";
import { LikeToggle } from "../../record/LikeToggle";
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

/** Rich-text field values (Frappe "Text Editor" stores HTML) as plain text. An inert parsed document: nothing runs. */
const htmlToText = (html: string) =>
  (typeof DOMParser === "undefined" ? html.replace(/<[^>]*>/g, " ") : new DOMParser().parseFromString(html, "text/html").body.textContent ?? "")
    .replace(/\s+/g, " ").trim();

/** Type-aware default cell — Sear's `Cell` (lib/data-grid/cell-render.tsx) by Frappe fieldtype, falling back to the
 *  column `type` (PMO MetaCell). Numbers and dates are `dir="ltr"` so Arabic pages keep digits readable. */
export function DefaultCell<T>({ value, col, row }: { value: unknown; col: ColumnDef<T>; row?: T }) {
  const { language, t } = useLocale();
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  // P35 (G17): status columns render a StatusBadge with the row's configured colour / tone
  if (col.status && row !== undefined) {
    return <StatusBadge label={String(value)} color={col.status.color?.(value, row)} tone={col.status.tone?.(value, row)} variant={col.status.variant} />;
  }
  const ft = col.fieldtype ?? ({ number: "Float", date: "Date", boolean: "Check", select: "Select", link: "Link" } as Record<string, string>)[col.type ?? ""];
  switch (ft) {
    case "Check": {
      const yes = value === true || value === 1 || value === "1" || value === "true";
      return yes ? <Check className="h-4 w-4 text-success" aria-label={t("yes")} /> : <X className="h-4 w-4 text-muted-foreground" aria-label={t("no")} />;
    }
    case "Date": return <span dir="ltr" className="whitespace-nowrap tabular-nums">{fmtDate(value, language)}</span>;
    case "Datetime": return <span dir="ltr" className="whitespace-nowrap tabular-nums">{fmtDate(value, language, true)}</span>;
    case "Currency": return <span dir="ltr" className="whitespace-nowrap font-medium tabular-nums">{fmtNumber(value, language, true)}</span>;
    case "Int": case "Float": case "Percent":
      return <span dir="ltr" className="whitespace-nowrap tabular-nums">{fmtNumber(value, language)}{ft === "Percent" ? "%" : ""}</span>;
    case "Select": return <Badge variant="secondary" className="font-normal">{String(value)}</Badge>;
    case "Link": case "Dynamic Link": return <span className="font-medium text-foreground">{String(value)}</span>;
    case "Text Editor": case "Markdown Editor": case "HTML Editor": return <span className="line-clamp-2">{htmlToText(String(value))}</span>;
    default: return <span className="truncate">{String(value)}</span>;
  }
}

/**
 * Desk's Like heart per row (list_view.js:985-991): the last cell of the row, hidden below 768 px like Desk's `hidden-xs`.
 * Frappe-free: the host says what is liked and performs the toggle (`FrappeListView` wires `frappe.desk.like.toggle_like`).
 */
export interface ListLikeConfig<T> {
  isLiked: (row: T) => boolean;
  /** Tooltip: the names of the users who liked the row. */
  likedByTitle?: (row: T) => string | undefined;
  /** Requested state; a returned promise keeps the heart pending, the state changes only after it resolves. */
  onToggle: (row: T, next: boolean) => void | Promise<unknown>;
  onError?: (error: unknown, row: T) => void;
  disabled?: (row: T) => boolean;
  /** Desk's "Liked by me" header toggle (list_view.js:729-735, 1440-1455). */
  filter?: { active: boolean; onChange: (active: boolean) => void };
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
  /** Grouped display: one table, one header, a collapsible section per group (`rows` is then ignored). */
  groups?: RowGroup<T>[];
  /** Only part of the records is loaded (server mode, rule C1): group counts end in "+". */
  partial?: boolean;
  /** Desk's Like heart and "Liked by me" toggle (omit: no extra column, markup unchanged). */
  like?: ListLikeConfig<T>;
  /**
   * Desk's header in selection mode (list_view.js:1613-1634, 740-760): with `count > 0` the column titles give way to
   * "{n} items selected" and a Clear button, in the same header row (no extra row). Omit: the header never changes.
   */
  selectionHeader?: { count: number; onClear: () => void; matching?: SelectionMatching };
  /**
   * `"table"` (default): the table. `"cards"`: one card per row (phones — D-crm G1): the primary column as the card's
   * title, the other columns as label / value lines (`ColumnDef.mobile`: `"primary"` picks the title column, `false`
   * leaves a column out of the card). `"auto"`: cards below 768 px (`matchMedia`), the table otherwise. Selection, row
   * click, groups, likes and the selection header work in both.
   */
  layout?: "table" | "cards" | "auto";
}

/** "Select all {n} matching" in the selection header (D-crm G5). */
export interface SelectionMatching {
  /** Records matching the query (all pages). */
  total: number;
  /** How to show `total` (e.g. "1,000+"). */
  label?: string;
  /** All matching records are selected. */
  active: boolean;
  onSelect: () => void;
}

/** "{n} items selected" / "All {n} matching records selected", the "Select all {n} matching" offer, and Clear. */
function SelectionHeaderContent({ count, onClear, matching, allShownSelected }: { count: number; onClear: () => void; matching?: SelectionMatching; allShownSelected: boolean }) {
  const { t } = useLocale();
  const n = matching?.label ?? String(matching?.total ?? "");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-foreground" aria-live="polite">
        {matching?.active ? t("listAllMatchingSelected").replace("{n}", n) : t("listItemsSelected").replace("{n}", String(count))}
      </span>
      {matching && !matching.active && allShownSelected && matching.total > count && (
        <Button type="button" variant="text" size="sm" className="h-7 px-1 text-xs" onClick={matching.onSelect} data-select-all-matching="">
          {t("listSelectAllMatching").replace("{n}", n)}
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onClear}>
        <X className="h-3.5 w-3.5" aria-hidden /> {t("clearSelection")}
      </Button>
    </span>
  );
}

const PHONE_QUERY = "(max-width: 767px)";
function usePhone(enabled: boolean): boolean {
  const subscribe = React.useCallback((notify: () => void) => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return () => {};
    const mq = window.matchMedia(PHONE_QUERY);
    mq.addEventListener?.("change", notify);
    return () => mq.removeEventListener?.("change", notify);
  }, [enabled]);
  return React.useSyncExternalStore(subscribe, () => enabled && typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches, () => false);
}

/**
 * Grouping keeps ONE table: every group is a `<tbody>` led by a header row (collapse toggle, label, count, and the
 * group's select-all), so all groups share the header's column order and widths. PMO drew a separate table per group,
 * so columns didn't line up from group to group. The header's select-all covers the rows on screen (expanded groups).
 */
export function ListTable<T>({
  columns, rows, rowKey, sort, onSortToggle, onRowClick, rowClassName, selection, loading, error, onRetry, empty, className,
  groups, partial, like, selectionHeader, layout = "table",
}: ListTableProps<T>) {
  const { language, t } = useLocale();
  const phone = usePhone(layout === "auto");
  const cards = layout === "cards" || (layout === "auto" && phone);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const toggleGroup = (key: string) => setCollapsed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const shown = groups ? groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.rows)) : rows;
  const any = groups ? groups.some((g) => g.rows.length > 0) : rows.length > 0;
  const colCount = Math.max(columns.length, 1) + (selection ? 1 : 0) + (like ? 1 : 0);
  const likeCell = "hidden w-10 px-2 md:table-cell";
  const allOn = !!selection && shown.length > 0 && shown.every((r) => selection.isSelected(r));
  const someOn = !!selection && !allOn && shown.some((r) => selection.isSelected(r));

  // Desk's shift-click (list_view.js:1400-1421): checks every row between the last clicked checkbox and this one
  const cursor = React.useRef<string | null>(null);
  const onCheckClick = (row: T, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selection) return;
    const k = rowKey(row);
    if (e.shiftKey && cursor.current && cursor.current !== k) {
      const i1 = shown.findIndex((r) => rowKey(r) === cursor.current), i2 = shown.findIndex((r) => rowKey(r) === k);
      if (i1 >= 0 && i2 >= 0) {
        const [a, b] = i1 < i2 ? [i1, i2] : [i2, i1];
        const between = shown.slice(a + 1, b);
        if (between.length) selection.setRowsSelected(between, true);
      }
    }
    cursor.current = k;
  };
  const selecting = !!selection && !!selectionHeader && selectionHeader.count > 0;
  // Desk's Ctrl/⌘-click on a row (list_view.js:1296-1306): ticks / unticks the row instead of opening it; a link inside
  // the row keeps its own Ctrl/⌘-click (new tab)
  const onRowActivate = (row: T, e: React.MouseEvent) => {
    if (selection && (e.ctrlKey || e.metaKey) && !(e.target as HTMLElement).closest?.("a")) {
      e.preventDefault();
      selection.toggleRow(row);
      return;
    }
    onRowClick?.(row);
  };

  // a row can sit in several groups (multi-bucket `groupOf`): its React key carries the group
  const renderRow = (row: T, group?: string) => {
    const on = !!selection?.isSelected(row);
    return (
      <tr
        key={group === undefined ? rowKey(row) : `${group}\u0000${rowKey(row)}`}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={(e) => onRowActivate(row, e)}
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
          <td className="px-3 py-3" onClick={(e) => onCheckClick(row, e)}>
            <Checkbox checked={on} onCheckedChange={() => selection.toggleRow(row)} aria-label={t("selectRow")} />
          </td>
        )}
        {columns.map((c) => (
          <td key={c.key} className={cn("px-4 py-3", c.align === "end" && "text-end", c.className)}>
            {c.render ? c.render(row) : <DefaultCell value={(row as Record<string, unknown>)[fieldOf(c)]} col={c} row={row} />}
          </td>
        ))}
        {like && (
          <td className={cn(likeCell, "py-2")} onClick={(e) => e.stopPropagation()} data-like-cell="">
            <LikeToggle liked={like.isLiked(row)} title={like.likedByTitle?.(row)} disabled={like.disabled?.(row)}
              onToggle={(next) => like.onToggle(row, next)} onError={(err) => like.onError?.(err, row)} />
          </td>
        )}
      </tr>
    );
  };

  const renderGroup = (g: RowGroup<T>) => {
    const open = !collapsed.has(g.key);
    const gAll = !!selection && g.rows.length > 0 && g.rows.every((r) => selection.isSelected(r));
    const gSome = !!selection && !gAll && g.rows.some((r) => selection.isSelected(r));
    return (
      <tbody key={g.key} data-group={g.key}>
        <tr data-group-header="" className="border-y border-border bg-muted/20">
          {selection && (
            <td className="w-10 px-3 py-2">
              <Checkbox checked={gAll ? true : gSome ? "indeterminate" : false} onCheckedChange={(c) => selection.setRowsSelected(g.rows, c === true)}
                aria-label={t("selectGroup").replace("{group}", g.label)} />
            </td>
          )}
          <td colSpan={Math.max(columns.length, 1) + (like ? 1 : 0)} className="px-4 py-2">
            <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open} className="flex items-center gap-2 rounded-md text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
              <span>{g.label}</span>
              <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{g.rows.length}{partial ? "+" : ""}</span>
            </button>
          </td>
        </tr>
        {open && g.rows.map((r) => renderRow(r, g.key))}
      </tbody>
    );
  };

  if (cards) {
    // phones (D-crm G1): a card per row — the primary column as the title, the others as label / value lines
    const primary = columns.find((c) => c.mobile === "primary") ?? columns.find((c) => c.mobile !== false && c.key !== "__actions") ?? columns[0];
    const details = columns.filter((c) => c !== primary && c.mobile !== false);
    const cell = (c: ColumnDef<T>, row: T) => (c.render ? c.render(row) : <DefaultCell value={(row as Record<string, unknown>)[fieldOf(c)]} col={c} row={row} />);
    const renderCard = (row: T, group?: string) => {
      const on = !!selection?.isSelected(row);
      return (
        <li key={group === undefined ? rowKey(row) : `${group}\u0000${rowKey(row)}`} data-card="" data-selected={selection ? String(on) : undefined}
          tabIndex={onRowClick ? 0 : undefined} onClick={(e) => onRowActivate(row, e)}
          onKeyDown={(e) => { if (onRowClick && e.key === "Enter" && e.target === e.currentTarget) onRowClick(row); }}
          className={cn("flex items-start gap-3 border-b border-border px-3 py-3 last:border-0", onRowClick && "cursor-pointer outline-none hover:bg-accent/50 focus-visible:bg-accent/60", on && "bg-primary/5", rowClassName?.(row))}>
          {selection && (
            <div className="pt-0.5" onClick={(e) => onCheckClick(row, e)}>
              <Checkbox checked={on} onCheckedChange={() => selection.toggleRow(row)} aria-label={t("selectRow")} />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            {primary && <div className="text-sm font-medium text-foreground">{cell(primary, row)}</div>}
            {details.length > 0 && (
              <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                {details.map((c) => (
                  <React.Fragment key={c.key}>
                    <dt className="truncate text-muted-foreground">{loc(c.label, language)}</dt>
                    <dd className="min-w-0 truncate" onClick={c.key === "__actions" ? (e) => e.stopPropagation() : undefined}>{cell(c, row)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
          </div>
          {like && (
            <div onClick={(e) => e.stopPropagation()} data-like-cell="">
              <LikeToggle liked={like.isLiked(row)} title={like.likedByTitle?.(row)} disabled={like.disabled?.(row)}
                onToggle={(next) => like.onToggle(row, next)} onError={(err) => like.onError?.(err, row)} />
            </div>
          )}
        </li>
      );
    };
    const state = (loading && !any) ? (
      <ul aria-hidden className="divide-y divide-border">{Array.from({ length: 4 }).map((_, i) => <li key={i} className="space-y-2 p-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></li>)}</ul>
    ) : !loading && React.isValidElement(error) ? (
      <div className="p-6">{error}</div>
    ) : !loading && error ? (
      <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
        <p className="text-sm text-muted-foreground">{error === true ? t("loadError") : error}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
      </div>
    ) : !any ? (
      <div className="p-8 text-center text-sm text-muted-foreground">{empty ?? t("noData")}</div>
    ) : null;
    return (
      <Card className={cn("overflow-hidden", className)} data-layout="cards">
        {selection && any && (
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-selection-header={selecting ? "" : undefined}>
            <Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={(c) => selection.setRowsSelected(shown, c === true)} aria-label={t("selectAll")} />
            {selecting && <SelectionHeaderContent count={selectionHeader!.count} onClear={selectionHeader!.onClear} matching={selectionHeader!.matching} allShownSelected={allOn} />}
          </div>
        )}
        {state ?? (groups ? groups.map((g) => {
          const open = !collapsed.has(g.key);
          const gAll = !!selection && g.rows.length > 0 && g.rows.every((r) => selection.isSelected(r));
          const gSome = !!selection && !gAll && g.rows.some((r) => selection.isSelected(r));
          return (
            <section key={g.key} data-group={g.key}>
              <div data-group-header="" className="flex items-center gap-3 border-y border-border bg-muted/20 px-3 py-2">
                {selection && <Checkbox checked={gAll ? true : gSome ? "indeterminate" : false} onCheckedChange={(c) => selection.setRowsSelected(g.rows, c === true)} aria-label={t("selectGroup").replace("{group}", g.label)} />}
                <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open} className="flex items-center gap-2 rounded-md text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
                  <span>{g.label}</span>
                  <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{g.rows.length}{partial ? "+" : ""}</span>
                </button>
              </div>
              {open && <ul>{g.rows.map((r) => renderCard(r, g.key))}</ul>}
            </section>
          );
        }) : <ul>{rows.map((r) => renderCard(r))}</ul>)}
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selection && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={(c) => selection.setRowsSelected(shown, c === true)} aria-label={t("selectAll")} />
                </th>
              )}
              {selecting && (
                <th colSpan={Math.max(columns.length, 1) + (like ? 1 : 0)} className="px-4 py-1.5 text-start font-medium normal-case tracking-normal" data-selection-header="">
                  <SelectionHeaderContent count={selectionHeader!.count} onClear={selectionHeader!.onClear} matching={selectionHeader!.matching} allShownSelected={allOn} />
                </th>
              )}
              {!selecting && columns.map((c) => {
                const active = sort.key === c.key;
                const label = loc(c.label, language);
                return (
                  <th key={c.key} className={cn("px-4 py-2.5 font-medium", c.align === "end" ? "text-end" : "text-start")}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortable === false ? <span className="normal-case">{label}</span> : (
                      <button type="button" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSortToggle(c.key)}>
                        {label} {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
                      </button>
                    )}
                  </th>
                );
              })}
              {like && !selecting && (
                <th className={cn(likeCell, "py-1.5")}>
                  {like.filter ? (
                    <button type="button" aria-pressed={like.filter.active} aria-label={t("likedByMe")} title={t("likedByMe")}
                      onClick={() => like.filter!.onChange(!like.filter!.active)}
                      className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        like.filter.active ? "text-destructive" : "text-muted-foreground hover:text-foreground")}>
                      <Heart className={cn("h-4 w-4", like.filter.active && "fill-current")} aria-hidden />
                    </button>
                  ) : <span className="sr-only">{t("like")}</span>}
                </th>
              )}
            </tr>
          </thead>
          {(loading && !any) || error || !any ? (
            <tbody>
              {loading && !any &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0" aria-hidden>
                    {selection && <td className="px-3 py-3" />}
                    {columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    {like && <td className={likeCell} />}
                  </tr>
                ))}
              {!loading && React.isValidElement(error) && (
                // an element is the caller's own error state (e.g. FrappeErrorState with its per-kind actions): rendered as is
                <tr><td colSpan={colCount} className="py-12"><div className="mx-auto max-w-lg">{error}</div></td></tr>
              )}
              {!loading && error && !React.isValidElement(error) && (
                <tr><td colSpan={colCount} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3" role="alert">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
                    <p className="text-sm text-muted-foreground">{error === true ? t("loadError") : error}</p>
                    {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
                  </div>
                </td></tr>
              )}
              {!loading && !error && !any && (
                <tr><td colSpan={colCount} className="py-12 text-center text-muted-foreground">{empty ?? t("noData")}</td></tr>
              )}
            </tbody>
          ) : groups ? groups.map(renderGroup) : <tbody>{rows.map((r) => renderRow(r))}</tbody>}
        </table>
      </div>
    </Card>
  );
}

/** Grouped display (PMO GroupedListTable): the same single table as `ListTable` with `groups`. */
export function GroupedListTable<T>({ groups, partial, ...table }: Omit<ListTableProps<T>, "rows" | "groups"> & { groups: RowGroup<T>[]; partial?: boolean }) {
  return <ListTable {...table} rows={[]} groups={groups} partial={partial} />;
}
