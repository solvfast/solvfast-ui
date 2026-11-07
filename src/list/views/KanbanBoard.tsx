/**
 * KanbanBoard — Desk's Kanban (frappe/public/js/frappe/views/kanban/kanban_board.bundle.js) as a presentational board:
 * columns with a card count, cards in each column's order, drag and drop between columns, a keyboard alternative, and
 * an "Add card" slot. Frappe-free: the host owns the data and performs a move (`onMove`); the board shows the move at
 * once and takes it back if `onMove` rejects (Desk reverts the same way, bundle.js:203-209).
 *
 * Keyboard: each card's "Move to…" menu lists the other columns; Alt+Left / Alt+Right on a focused card moves it to the
 * neighbouring column (in reading direction, so they swap in RTL). Every move is announced in a live region.
 */
import * as React from "react";
import { AlertTriangle, ArrowRightLeft, GripVertical, Plus } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "../../lib/cn";
import { loc, type Localized } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";

/** Kanban Board Column `indicator` options (kanban_board_column.json) → a dot colour. */
export const KANBAN_INDICATOR_COLORS: Record<string, string> = {
  Blue: "#2490ef", Cyan: "#06b6d4", Gray: "#98a1a9", Green: "#28a745", "Light Blue": "#7cd6fd", Orange: "#f39c12",
  Pink: "#f683ae", Purple: "#8e44ad", Red: "#e24c4c", Yellow: "#facc15",
};

export interface KanbanColumn { key: string; label: Localized; /** Kanban Board Column `indicator` name or a CSS colour. */ indicator?: string }

export interface KanbanMove<T> { row: T; key: string; from: string; to: string; fromIndex: number; toIndex: number }

export interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The column key a row belongs to. Rows of unknown columns are not shown. */
  columnOf: (row: T) => string;
  title: (row: T) => string;
  /** Card body under the title. */
  renderCard?: (row: T) => React.ReactNode;
  /** Card order per column (row keys); cards not listed follow in `rows` order. */
  order?: Record<string, string[]>;
  /** Perform a move. Omit for a read-only board. A rejection takes the move back. */
  onMove?: (move: KanbanMove<T>) => void | Promise<unknown>;
  /** Per card (e.g. a submitted document cannot move). Default: every card when `onMove` is given. */
  canMove?: (row: T) => boolean;
  onOpen?: (row: T) => void;
  /** Shows an "Add card" button under each column. */
  onAddCard?: (columnKey: string) => void;
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  /** Shown above the board when moving is not allowed (e.g. no write permission). */
  readOnlyReason?: React.ReactNode;
  className?: string;
}

export function KanbanBoard<T>(p: KanbanBoardProps<T>) {
  const { columns, rows, rowKey, columnOf, title, renderCard, order, onMove, onOpen, onAddCard, loading, error, onRetry, readOnlyReason, className } = p;
  const { t, language, direction } = useLocale();
  const [pending, setPending] = React.useState<Record<string, { to: string; index: number }>>({});
  const [announce, setAnnounce] = React.useState("");
  const [over, setOver] = React.useState<string | null>(null);
  const dragKey = React.useRef<string | null>(null);
  const canMove = (row: T) => !!onMove && (p.canMove ? p.canMove(row) : true);
  const colLabel = (key: string) => { const c = columns.find((x) => x.key === key); return c ? loc(c.label, language) : key; };

  // cards per column, in the column's order, with the pending (optimistic) moves applied
  const byColumn = React.useMemo(() => {
    const m = new Map<string, T[]>(columns.map((c) => [c.key, []]));
    const rank = (col: string, k: string) => { const i = order?.[col]?.indexOf(k) ?? -1; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
    const moved: [T, { to: string; index: number }][] = [];
    for (const r of rows) {
      const k = rowKey(r);
      if (pending[k]) { moved.push([r, pending[k]]); continue; }
      m.get(columnOf(r))?.push(r);
    }
    for (const [col, list] of m) list.sort((a, b) => rank(col, rowKey(a)) - rank(col, rowKey(b)));
    for (const [r, mv] of moved) m.get(mv.to)?.splice(mv.index, 0, r);
    return m;
  }, [columns, rows, rowKey, columnOf, order, pending]);

  const move = (row: T, to: string, toIndex?: number) => {
    if (!onMove || !canMove(row)) return;
    const key = rowKey(row);
    const from = columnOf(row);
    const fromIndex = (byColumn.get(from) ?? []).findIndex((r) => rowKey(r) === key);
    const target = (byColumn.get(to) ?? []).filter((r) => rowKey(r) !== key);
    const index = toIndex === undefined ? target.length : Math.max(0, Math.min(target.length, toIndex));
    if (from === to && index === fromIndex) return;
    const name = title(row) || key;
    setPending((pnd) => ({ ...pnd, [key]: { to, index } }));
    const done = (ok: boolean) => {
      setPending((pnd) => { const n = { ...pnd }; delete n[key]; return n; });
      setAnnounce((ok ? t("kanbanMoved") : t("kanbanMoveFailed")).replace("{title}", name).replace("{column}", colLabel(to)));
    };
    Promise.resolve().then(() => onMove({ row, key, from, to, fromIndex: Math.max(0, fromIndex), toIndex: index })).then(() => done(true), () => done(false));
  };

  const onCardKey = (e: React.KeyboardEvent, row: T) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const forward = (e.key === "ArrowRight") !== (direction === "rtl");
    const i = columns.findIndex((c) => c.key === columnOf(row));
    const next = columns[i + (forward ? 1 : -1)];
    if (next) move(row, next.key);
  };

  if (error) {
    return (
      <Card className={cn("flex flex-col items-center gap-3 p-8 text-center text-sm", className)} role="alert">
        {typeof error === "boolean" ? <><AlertTriangle className="h-5 w-5 text-destructive" /><span>{t("loadError")}</span></> : error}
        {onRetry && typeof error === "boolean" && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
      </Card>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {readOnlyReason && <p className="text-xs text-muted-foreground" role="note">{readOnlyReason}</p>}
      {onMove && <p className="sr-only">{t("kanbanKeyboardHint")}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label={t("kanbanBoardLabel")} aria-busy={loading || undefined} data-testid="sf-kanban">
        {columns.map((col) => {
          const cards = byColumn.get(col.key) ?? [];
          const label = loc(col.label, language);
          const dot = col.indicator ? KANBAN_INDICATOR_COLORS[col.indicator] ?? col.indicator : undefined;
          return (
            <section key={col.key} role="listitem" aria-label={label} data-column={col.key}
              className={cn("flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/40 p-2", over === col.key && "ring-2 ring-primary")}
              onDragOver={(e) => { if (dragKey.current) { e.preventDefault(); setOver(col.key); } }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault(); setOver(null);
                const k = dragKey.current ?? e.dataTransfer?.getData("text/plain");
                dragKey.current = null;
                const row = rows.find((r) => rowKey(r) === k);
                if (!row) return;
                const onCard = (e.target as HTMLElement).closest?.("[data-card-key]")?.getAttribute("data-card-key");
                const idx = onCard ? cards.filter((r) => rowKey(r) !== k).findIndex((r) => rowKey(r) === onCard) : -1;
                move(row, col.key, idx >= 0 ? idx : undefined);
              }}>
              <header className="flex items-center gap-2 px-1 pb-2">
                {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />}
                <h3 className="truncate text-sm font-semibold">{label}</h3>
                <Badge variant="secondary" className="ms-auto font-normal" aria-label={t("kanbanCardCount").replace("{n}", String(cards.length))}>{cards.length}</Badge>
              </header>
              <ul className="flex min-h-[3rem] flex-col gap-2" aria-label={label}>
                {loading && !rows.length
                  ? [0, 1].map((i) => <li key={i}><Skeleton className="h-16 w-full rounded-xl" /></li>)
                  : cards.length === 0
                    ? <li className="px-1 py-3 text-center text-xs text-muted-foreground">{t("kanbanEmptyColumn")}</li>
                    : cards.map((row) => {
                      const key = rowKey(row);
                      const name = title(row) || key;
                      const movable = canMove(row);
                      return (
                        <li key={key} data-card-key={key} draggable={movable} aria-busy={pending[key] ? true : undefined}
                          onDragStart={(e) => { dragKey.current = key; try { e.dataTransfer?.setData("text/plain", key); } catch { /* jsdom */ } }}
                          onDragEnd={() => { dragKey.current = null; setOver(null); }}>
                          <Card className={cn("flex items-start gap-1.5 p-2.5", pending[key] && "opacity-60")}>
                            {movable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />}
                            <button type="button" className="min-w-0 flex-1 rounded-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => onOpen?.(row)} onKeyDown={(e) => onCardKey(e, row)} aria-keyshortcuts={movable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}>
                              <div className="truncate text-sm font-medium" title={name}>{name}</div>
                              {renderCard && <div className="mt-1 text-xs text-muted-foreground">{renderCard(row)}</div>}
                            </button>
                            {movable && columns.length > 1 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={t("kanbanMoveCard").replace("{title}", name)}><ArrowRightLeft className="h-3.5 w-3.5" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>{t("kanbanMoveTo")}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {columns.filter((c) => c.key !== columnOf(row)).map((c) => (
                                    <DropdownMenuItem key={c.key} data-move-to={c.key} onSelect={() => move(row, c.key)}>{loc(c.label, language)}</DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </Card>
                        </li>
                      );
                    })}
              </ul>
              {onAddCard && (
                <Button variant="ghost" size="sm" className="mt-2 justify-start gap-1.5 text-muted-foreground" onClick={() => onAddCard(col.key)}>
                  <Plus className="h-4 w-4" /> {t("kanbanAddCard")}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="sf-kanban-status">{announce}</p>
    </div>
  );
}
