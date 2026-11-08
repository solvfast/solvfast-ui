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
 *
 * P36 — responsive layout (`layout`): `"table"` (default, unchanged), `"cards"` (one card per row: the primary column
 * as its title, the other columns as label / value lines, `DataGridColumn.mobile` as in ListView's `ColumnDef.mobile`)
 * or `"auto"` (cards while the grid's own container is narrower than `cardsBelow`, measured with a ResizeObserver —
 * not the window). Cards keep the grid's semantics: one row edited inline at a time (tap the card or its Edit toggle;
 * Escape or a tap outside stops), the same row menu, selection, Add Row, pager and shortcuts. Cards and `"auto"` never
 * force a minimum width; only `"table"` keeps its `minTableWidth` (the explicit opt-in to sideways scrolling).
 */
import * as React from "react";
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { interpolate } from "./FieldShell";
import { useContainerWidth } from "./useContainerWidth";

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
  /**
   * Card layout (`layout="cards"`, or `"auto"` in a narrow container) — as ListView's `ColumnDef.mobile`: `"primary"` =
   * the card's title (default: the first column not set to `false`), `false` = left out of the card (also of its
   * editor; keep required / editable columns on the card, or offer `onOpenRow`). Other columns are label / value lines
   * in column order. Ignored by the table.
   */
  mobile?: "primary" | false;
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
  /**
   * `"table"` (default): the table, as before. `"cards"`: one card per row (phones). `"auto"`: cards while the grid's
   * container is narrower than `cardsBelow`, the table (without a forced minimum width) otherwise.
   */
  layout?: "table" | "cards" | "auto";
  /** `layout="auto"`: container width (px) below which rows show as cards. Default 640. */
  cardsBelow?: number;
  /**
   * `layout="table"` only: the table's minimum width; a narrower container scrolls it sideways inside the grid frame
   * (the explicit opt-in to horizontal scrolling). Default `"32rem"`; `false` = none. Cards and `"auto"` never set one.
   */
  minTableWidth?: string | number | false;
}

const inPopper = (el: Element | null) => !!el?.closest("[data-radix-popper-content-wrapper],[role=dialog],[role=alertdialog],[role=listbox]");

export function DataGrid<R>({
  rows, getRowKey, columns, label, editable = true, inlineEdit = true, canAdd = true, canDelete = true,
  onAddRow, onInsertRow, onDuplicateRow, onDeleteRows, onMoveRow, onOpenRow, pageSize = 50, invalid, emptyText,
  toolbar, id, className, layout = "table", cardsBelow = 640, minTableWidth = "32rem",
}: DataGridProps<R>) {
  const { t, isRTL } = useLocale();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const jumpToEnd = React.useRef(false);
  const focusEditor = React.useRef<{ key: string; col?: string } | null>(null);
  const uid = React.useId();
  const width = useContainerWidth(gridRef, layout === "auto");
  const cards = layout === "cards" || (layout === "auto" && width !== null && width < cardsBelow);

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
  // cards: starting to edit moves focus into the row's editor — the tapped column's, else the first
  const cardOf = (k: string) => [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-card]") ?? [])].find((el) => el.dataset.rowKey === k);
  React.useEffect(() => {
    const want = focusEditor.current;
    if (!editingKey || want?.key !== editingKey) return;
    focusEditor.current = null;
    const editors = [...(cardOf(editingKey)?.querySelectorAll<HTMLElement>("[data-dg-editor]") ?? [])];
    const box = editors.find((el) => el.dataset.col === want.col) ?? editors[0];
    box?.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]:not([tabindex='-1']), [contenteditable='true']")?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (e.key === "Escape" && editingKey) {
      e.preventDefault();
      const was = editingKey;
      setEditingKey(null);
      // cards: back to the row's Edit toggle (it stays mounted), not to <body>
      if (cards) cardOf(was)?.querySelector<HTMLElement>("[data-dg-edit]")?.focus();
      return;
    }
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
  const startEditing = (key: string, i: number) => {
    if (!editable) return;
    if (inlineEdit) { if (editingKey !== key) setEditingKey(key); }
    else onOpenRow?.(i);
  };
  const rowMenu = (i: number, size: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={size} aria-label={interpolate(t("formRowActions"), { n: i + 1 })}>
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
  );

  // ---- cards (phones): a card per row — the primary column as the title, the others as label / value lines ----------
  const renderCards = () => {
    const primary = columns.find((c) => c.mobile === "primary") ?? columns.find((c) => c.mobile !== false) ?? columns[0];
    const details = columns.filter((c) => c !== primary && c.mobile !== false);
    const onCard = primary ? [primary, ...details] : details;
    const inlineEditable = editable && inlineEdit && onCard.some((c) => !!c.renderEditor);
    const opens = editable && !inlineEdit && !!onOpenRow;
    const star = (c: DataGridColumn<R>) => c.required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>;
    return (
      <div className={cn("rounded-xl border border-border", invalid && "border-destructive")}>
        {showSelect && rows.length > 0 && (
          <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Checkbox checked={allSelected ? true : selected.size ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label={t("formSelectAllRows")} />
            <span aria-hidden>{t("formSelectAllRows")}</span>
          </div>
        )}
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText ?? t("formNoRows")}</p>
        ) : (
          <ul role="list" aria-label={label}>
            {visible.map((row, vi) => {
              const i = start + vi;
              const key = keys[i];
              const editing = editingKey === key && editable && inlineEdit;
              const badPrimary = !!primary && !editing && !!primary.isInvalid?.(row, i);
              return (
                <li
                  key={key}
                  data-card=""
                  data-row-key={key}
                  data-editing={editing ? "" : undefined}
                  className={cn("border-b border-border px-3 py-3 last:border-0", editing ? "bg-accent/40" : selected.has(key) && "bg-primary/5")}
                  onKeyDown={(e) => rowKeys(e, i)}
                >
                  <div className="flex items-start gap-3">
                    {showSelect && (
                      <div className="pt-0.5">
                        <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={interpolate(t("formSelectRow"), { n: i + 1 })} />
                      </div>
                    )}
                    <span className="min-w-4 pt-0.5 text-xs tabular-nums text-muted-foreground">
                      <span className="sr-only">{t("formRowNo")} </span>{i + 1}
                    </span>
                    <div className={cn("min-w-0 flex-1 space-y-1.5", inlineEditable && !editing && "cursor-text", opens && "cursor-pointer")}
                      onClick={(e) => {
                        if (!inlineEditable && !opens) return;
                        if (inlineEditable && !editing) focusEditor.current = { key, col: (e.target as Element).closest<HTMLElement>("[data-col]")?.dataset.col };
                        startEditing(key, i);
                      }}>
                      {primary && (
                        <div data-col={editing ? undefined : primary.key} className={cn("min-h-5 min-w-0 break-words text-sm font-medium text-foreground", badPrimary && "rounded-sm bg-destructive/5 ring-1 ring-inset ring-destructive/60")}>
                          {primary.renderCell(row, i)}
                        </div>
                      )}
                      {!editing && details.length > 0 && (
                        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                          {details.map((c) => {
                            const bad = c.isInvalid?.(row, i);
                            return (
                              <React.Fragment key={c.key}>
                                <dt className="truncate text-muted-foreground">{c.label}{star(c)}</dt>
                                <dd data-col={c.key} className={cn("min-h-4 min-w-0 break-words text-foreground", bad && "rounded-sm bg-destructive/5 ring-1 ring-inset ring-destructive/60")}>{c.renderCell(row, i)}</dd>
                              </React.Fragment>
                            );
                          })}
                        </dl>
                      )}
                    </div>
                    {(inlineEditable || opens || showMenu) && (
                      <div className="-my-1 flex shrink-0 items-center">
                        {inlineEditable && (
                          <Button type="button" variant="ghost" size="icon" className="size-9" data-dg-edit="" aria-pressed={editing}
                            aria-label={interpolate(t("coreGridEditRow"), { n: i + 1 })}
                            onClick={() => { if (editing) setEditingKey(null); else { focusEditor.current = { key }; setEditingKey(key); } }}>
                            {editing ? <Check className="size-4" aria-hidden /> : <Pencil className="size-4" aria-hidden />}
                          </Button>
                        )}
                        {opens && (
                          <Button type="button" variant="ghost" size="icon" className="size-9" data-dg-edit=""
                            aria-label={interpolate(t("coreGridEditRow"), { n: i + 1 })} onClick={() => onOpenRow?.(i)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        )}
                        {showMenu && rowMenu(i, "size-9")}
                      </div>
                    )}
                  </div>
                  {editing && (
                    // the row's editors, full card width (phones need the room), one labelled group per column
                    <div className="mt-3 space-y-3">
                      {onCard.map((c, ci) => {
                        const lid = `${uid}-${i}-${ci}`;
                        return (
                          <div key={c.key} role="group" aria-labelledby={lid} className="space-y-1">
                            <div id={lid} className="text-xs font-medium text-muted-foreground">{c.label}{star(c)}</div>
                            {c.renderEditor ? (
                              <div data-dg-editor="" data-col={c.key} className="min-w-0">{c.renderEditor(row, i)}</div>
                            ) : (
                              <div className="min-w-0 break-words text-sm">{c.renderCell(row, i)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const tableMin = layout === "table" ? minTableWidth : false;
  return (
    <div ref={gridRef} id={id} className={cn("min-w-0 space-y-2", className)} data-layout={cards ? "cards" : "table"}>
      {cards ? renderCards() : (
        <div className={cn("overflow-x-auto rounded-xl border border-border", invalid && "border-destructive")}>
          <table
            className={tableMin === "32rem" ? "w-full min-w-[32rem] table-fixed caption-bottom text-sm" : "w-full table-fixed caption-bottom text-sm"}
            style={tableMin !== false && tableMin !== "32rem" ? { minWidth: tableMin } : undefined}
            aria-label={label}
          >
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
                          onClick={() => startEditing(key, i)}
                        >
                          {editing && c.renderEditor ? c.renderEditor(row, i) : (
                            <div className={cn("min-h-5 truncate", editable && "cursor-text")}>{c.renderCell(row, i)}</div>
                          )}
                        </td>
                      );
                    })}
                    {showMenu && (
                      <td className="px-1 py-1">{rowMenu(i, "size-8")}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
