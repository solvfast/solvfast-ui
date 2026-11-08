/**
 * DataGrid — an editable table of rows (Frappe-free; FrappeChildTable wraps it). The owner keeps the rows; the grid
 * reports intent (add, insert at, duplicate, delete, move, open) and renders the cells the owner supplies.
 *
 * Desk's grid (docs `12` §5) reproduced where it is UI: one row edited inline at a time (others show formatted
 * text); a "No." column with the 1-based position; row checkboxes with select-all and a Delete button for the
 * selection; "Add Row" (adding jumps to the last page); per-row Insert Above / Insert Below / Duplicate / Move / Delete;
 * hidden when adding / deleting is not allowed or the grid is read-only; pages of 50 rows with the pager shown only
 * above one page; a required empty grid and required empty cells are marked. Keyboard (Desk's shortcuts, focus inside a
 * row): Ctrl/⌘+↑ insert above, Ctrl/⌘+↓ insert below, Ctrl/⌘+Shift+↑ / ↓ insert at the top / end, Shift+Alt+↓
 * duplicate, Escape stops editing. Dragging rows is replaced by Move Up / Move Down (keyboard-reachable).
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { interpolate } from "./FieldShell";

export interface DataGridColumn<R> {
  key: string;
  label: React.ReactNode;
  /** Relative width (Desk: 1–10 on its 12-column scale). Default 2. */
  width?: number;
  align?: "start" | "end" | "center";
  required?: boolean;
  /** The cell as text (not editing). */
  renderCell: (row: R, index: number) => React.ReactNode;
  /** The cell's editor while its row is edited inline. Absent → the cell stays text. */
  renderEditor?: (row: R, index: number) => React.ReactNode;
  isInvalid?: (row: R, index: number) => boolean;
}

export interface DataGridProps<R> {
  rows: R[];
  getRowKey: (row: R, index: number) => string;
  columns: DataGridColumn<R>[];
  /** Accessible name of the table. */
  label?: string;
  /** Rows may change (default true). Read-only grids hide every editing control. */
  editable?: boolean;
  /** Edit cells in place (default true). Otherwise clicking a row opens it (`onOpenRow`). */
  inlineEdit?: boolean;
  canAdd?: boolean;
  canDelete?: boolean;
  onAddRow?: () => void;
  /** Insert a new row at this 0-based position. */
  onInsertRow?: (index: number) => void;
  onDuplicateRow?: (index: number) => void;
  onDeleteRows?: (indexes: number[]) => void;
  onMoveRow?: (from: number, to: number) => void;
  onOpenRow?: (index: number) => void;
  pageSize?: number;
  /** Mark the whole grid (e.g. a required table with no rows). */
  invalid?: boolean;
  emptyText?: React.ReactNode;
  /** Extra buttons in the toolbar. */
  toolbar?: React.ReactNode;
  id?: string;
  className?: string;
}

const inPopper = (el: Element | null) => !!el?.closest("[data-radix-popper-content-wrapper],[role=dialog],[role=alertdialog],[role=listbox]");

export function DataGrid<R>({
  rows, getRowKey, columns, label, editable = true, inlineEdit = true, canAdd = true, canDelete = true,
  onAddRow, onInsertRow, onDuplicateRow, onDeleteRows, onMoveRow, onOpenRow, pageSize = 50, invalid, emptyText,
  toolbar, id, className,
}: DataGridProps<R>) {
  const { t, isRTL } = useLocale();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const jumpToEnd = React.useRef(false);

  const keys = rows.map(getRowKey);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const start = current * pageSize;
  const visible = rows.slice(start, start + pageSize);
  const allowAdd = editable && canAdd;
  const allowDelete = editable && canDelete;

  // keep the selection to existing rows; jump to the last page after Add Row (Desk)
  React.useEffect(() => {
    setSelected((s) => { const next = new Set([...s].filter((k) => keys.includes(k))); return next.size === s.size ? s : next; });
    if (jumpToEnd.current) { jumpToEnd.current = false; setPage(pages - 1); }
    if (editingKey && !keys.includes(editingKey)) setEditingKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  React.useEffect(() => {
    if (!editingKey) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (gridRef.current?.contains(el) || inPopper(el)) return;
      setEditingKey(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [editingKey]);

  const totalWidth = columns.reduce((n, c) => n + (c.width ?? 2), 0) || 1;
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(keys));
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const deleteSelected = () => {
    const idx = keys.map((k, i) => (selected.has(k) ? i : -1)).filter((i) => i >= 0);
    if (idx.length) onDeleteRows?.(idx);
    setSelected(new Set());
  };
  const add = () => { jumpToEnd.current = true; onAddRow?.(); };

  const rowKeys = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Escape" && editingKey) { e.preventDefault(); setEditingKey(null); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (allowAdd && onInsertRow && mod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (e.shiftKey) { if (e.key === "ArrowUp") onInsertRow(0); else { jumpToEnd.current = true; onInsertRow(rows.length); } }
      else onInsertRow(e.key === "ArrowUp" ? i : i + 1);
      return;
    }
    if (allowAdd && onDuplicateRow && e.shiftKey && e.altKey && e.key === "ArrowDown") { e.preventDefault(); onDuplicateRow(i); }
  };

  const showSelect = allowDelete && !!onDeleteRows;
  const showMenu = editable && (allowAdd || allowDelete || !!onMoveRow || !!onOpenRow);
  const align = (a?: "start" | "end" | "center") => (a === "end" ? "text-end" : a === "center" ? "text-center" : "text-start");

  return (
    <div ref={gridRef} id={id} className={cn("min-w-0 space-y-2", className)}>
      <div className={cn("overflow-x-auto rounded-xl border border-border", invalid && "border-destructive")}>
        <table className="w-full min-w-[32rem] table-fixed caption-bottom text-sm" aria-label={label}>
          <colgroup>
            {showSelect && <col className="w-10" />}
            <col className="w-12" />
            {columns.map((c) => <col key={c.key} style={{ width: `${((c.width ?? 2) / totalWidth) * 100}%` }} />)}
            {showMenu && <col className="w-11" />}
          </colgroup>
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              {showSelect && (
                <th scope="col" className="px-2 py-2">
                  <Checkbox checked={allSelected ? true : selected.size ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label={t("formSelectAllRows")} disabled={!rows.length} />
                </th>
              )}
              <th scope="col" className="px-2 py-2 text-start text-xs font-medium text-muted-foreground">{t("formRowNo")}</th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("truncate px-2 py-2 text-xs font-medium text-muted-foreground", align(c.align))}>
                  {c.label}
                  {c.required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>}
                </th>
              ))}
              {showMenu && <th scope="col" className="px-1 py-2"><span className="sr-only">{t("actions")}</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1 + (showSelect ? 1 : 0) + (showMenu ? 1 : 0)} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyText ?? t("formNoRows")}
                </td>
              </tr>
            )}
            {visible.map((row, vi) => {
              const i = start + vi;
              const key = keys[i];
              const editing = editingKey === key && editable && inlineEdit;
              return (
                <tr
                  key={key}
                  data-row-key={key}
                  aria-rowindex={i + 2}
                  className={cn("border-b border-border last:border-0 align-top", editing ? "bg-accent/40" : "hover:bg-muted/30", selected.has(key) && "bg-primary/5")}
                  onKeyDown={(e) => rowKeys(e, i)}
                >
                  {showSelect && (
                    <td className="px-2 py-2">
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={interpolate(t("formSelectRow"), { n: i + 1 })} />
                    </td>
                  )}
                  <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                  {columns.map((c) => {
                    const bad = c.isInvalid?.(row, i);
                    return (
                      <td
                        key={c.key}
                        className={cn("min-w-0 px-2", editing && c.renderEditor ? "py-1" : "py-2", align(c.align), bad && !editing && "bg-destructive/5 ring-1 ring-inset ring-destructive/60")}
                        onClick={() => {
                          if (!editable) return;
                          if (inlineEdit) { if (editingKey !== key) setEditingKey(key); }
                          else onOpenRow?.(i);
                        }}
                      >
                        {editing && c.renderEditor ? c.renderEditor(row, i) : (
                          <div className={cn("min-h-5 truncate", editable && "cursor-text")}>{c.renderCell(row, i)}</div>
                        )}
                      </td>
                    );
                  })}
                  {showMenu && (
                    <td className="px-1 py-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={interpolate(t("formRowActions"), { n: i + 1 })}>
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? "start" : "end"}>
                          {onOpenRow && <DropdownMenuItem onSelect={() => onOpenRow(i)}>{t("formEditRow")}</DropdownMenuItem>}
                          {allowAdd && onInsertRow && <DropdownMenuItem onSelect={() => onInsertRow(i)}>{t("formInsertAbove")}</DropdownMenuItem>}
                          {allowAdd && onInsertRow && <DropdownMenuItem onSelect={() => onInsertRow(i + 1)}>{t("formInsertBelow")}</DropdownMenuItem>}
                          {allowAdd && onDuplicateRow && <DropdownMenuItem onSelect={() => onDuplicateRow(i)}>{t("formDuplicateRow")}</DropdownMenuItem>}
                          {onMoveRow && <DropdownMenuItem disabled={i === 0} onSelect={() => onMoveRow(i, i - 1)}>{t("formMoveUp")}</DropdownMenuItem>}
                          {onMoveRow && <DropdownMenuItem disabled={i === rows.length - 1} onSelect={() => onMoveRow(i, i + 1)}>{t("formMoveDown")}</DropdownMenuItem>}
                          {allowDelete && onDeleteRows && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onSelect={() => onDeleteRows([i])}>{t("formDelete")}</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(allowAdd || (showSelect && selected.size > 0) || pages > 1 || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSelect && selected.size > 0 && (
            <Button type="button" variant="destructive" size="sm" onClick={deleteSelected}>
              <Trash2 className="size-4" aria-hidden />
              {t("formDelete")}
              <span className="sr-only"> ({interpolate(t("formRowsSelected"), { n: selected.size })})</span>
            </Button>
          )}
          {allowAdd && onAddRow && (
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="size-4" aria-hidden />
              {t("formAddRow")}
            </Button>
          )}
          {toolbar}
          {pages > 1 && (
            <div className="ms-auto flex items-center gap-1" role="navigation">
              <Button type="button" variant="ghost" size="icon" className="size-8" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t("formPrevPage")}>
                {isRTL ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{interpolate(t("formPageOf"), { page: current + 1, pages })}</span>
              <Button type="button" variant="ghost" size="icon" className="size-8" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t("formNextPage")}>
                {isRTL ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
