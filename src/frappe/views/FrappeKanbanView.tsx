/**
 * FrappeKanbanView — Desk's Kanban view (frappe/public/js/frappe/views/kanban/kanban_view.js + kanban_board.bundle.js)
 * on the Core `KanbanBoard`.
 *
 * Board mode (a Kanban Board document exists, or `board` names one): columns are the board's active columns
 * (`Archived` hidden), cards are every row matching the board's filters + the list filters (Desk requests all rows,
 * `page_length = 0`, kanban_view.js:80), ordered by each column's `order`; the card fields are the board's `fields`.
 * Moving a card calls `update_order_for_single_card` (kanban_board.py:131-161) — the server moves the name in the
 * columns' order AND sets the document's `field_name` — then the board and the card are updated from the answer.
 *
 * Group mode (no board, or `groupBy`): a package addition, not in Desk — columns are the options of a Select field and
 * a move is `frappe.client.set_value(doctype, name, {field: column})`.
 *
 * Moves are offered only with the write right on the DocType (Desk: the server's `has_permission(doctype, "write")`,
 * kanban_board.py:137) and for draft documents (or a field with `allow_on_submit`).
 *
 * Not reproduced from Desk: creating a board (`quick_kanban_board` dialog), adding / archiving / renaming / reordering
 * columns, column indicator colour picker, Kanban Settings dialog, "Save filters" on the board, card assignment and
 * like on the card, the per-user `last_kanban_board`. "Add card" is a host callback (`onAddCard`).
 */
import * as React from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { KanbanBoard, type KanbanColumn, type KanbanMove } from "../../list/views/KanbanBoard";
import { ViewToolbar, type ViewToolbarControls } from "../../list/views/ViewToolbar";
import { useListState, type ListQueryState, type UseListStateOptions } from "../../list/useListState";
import type { FilterQuery } from "../../list/model/filters";
import type { SortState } from "../../list/model/sort";
import { useLocale } from "../../theme/ThemeProvider";
import { FrappeProvider, useFrappeClient } from "../FrappeProvider";
import { usePermissions } from "../hooks/usePermissions";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import type { FrappeClient } from "../client";
import type { FrappeDocField } from "../contract";
import type { FrappeFilter } from "../query";
import { useFrappeMeta } from "../useFrappeList";
import { kanbanGroupFields } from "./availableViews";
import { boardLayout, getKanbanBoard, getKanbanBoards, moveKanbanCard, type KanbanBoardDoc } from "./kanban";
import { patchCachedRows, useFrappeViewList } from "./useFrappeViewList";

type Row = Record<string, unknown>;

export interface FrappeKanbanViewProps {
  doctype: string;
  client?: FrappeClient;
  baseFilters?: FrappeFilter[];
  /** The Kanban Board to show. Default: the DocType's first board (`get_kanban_boards`). */
  board?: string;
  /** Group by this Select field instead of a board (also the fallback when the DocType has no board). */
  groupBy?: string;
  /** A board was picked in the board menu. */
  onBoardChange?: (board: string) => void;
  onOpen?: (row: Row) => void;
  /** Shows "Add card" under each column. */
  onAddCard?: (column: string) => void;
  /** Card body. Default: the board's card fields (`fields`), "Label: value". */
  renderCard?: (row: Row) => React.ReactNode;
  /** A card moved on the server (the document's new column). */
  onCardMoved?: (row: Row, column: string) => void;
  controls?: ViewToolbarControls;
  toolbarLeading?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  storage?: UseListStateOptions<Row>["storage"];
  initialQuery?: FilterQuery;
  defaultSort?: SortState;
  /** The applied list state after each change (to carry filters / sort to another view). */
  onQueryStateChange?: (state: ListQueryState) => void;
  className?: string;
}

export function FrappeKanbanView(props: FrappeKanbanViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner(p: FrappeKanbanViewProps) {
  const { t } = useLocale();
  const fallback = useFrappeClient();
  const client = p.client ?? fallback;
  const m = useFrappeMeta(p.doctype, { client });
  const boards = useQuery({ queryKey: ["sf-frappe", "kanban-boards", p.doctype], queryFn: () => getKanbanBoards(client, p.doctype), enabled: !p.groupBy, staleTime: 60_000 });
  const boardName = p.groupBy ? undefined : p.board ?? boards.data?.[0]?.name;
  const board = useQuery({ queryKey: ["sf-frappe", "kanban-board", boardName], queryFn: () => getKanbanBoard(client, boardName!), enabled: !!boardName });
  const groupField = p.groupBy ?? (m.doc ? kanbanGroupFields(m.doc as never)[0]?.fieldname : undefined);
  const decided = !!p.groupBy || (boards.isFetched && (!boardName || board.isFetched));
  const mode: "board" | "group" | null = !decided ? null : board.data ? "board" : groupField ? "group" : null;
  const err = boards.error ?? board.error;
  if (err) return <KanbanBoard columns={[]} rows={[]} rowKey={() => ""} columnOf={() => ""} title={() => ""} error={<FrappeErrorState error={err} onRetry={() => { void boards.refetch(); void board.refetch(); }} />} />;
  if (!decided || !m.doc) return <KanbanBoard columns={[]} rows={[]} rowKey={() => ""} columnOf={() => ""} title={() => ""} loading />;
  if (!mode) return <p className="text-sm text-muted-foreground" role="status">{t("viewReasonNoKanbanSource")}</p>;
  return <Body {...p} client={client} boardDoc={mode === "board" ? board.data : undefined} groupField={mode === "group" ? groupField! : undefined}
    boardNames={(boards.data ?? []).map((b) => b.name)} boardName={boardName} />;
}

function Body(p: FrappeKanbanViewProps & { client: FrappeClient; boardDoc?: KanbanBoardDoc; groupField?: string; boardNames: string[]; boardName?: string }) {
  const { t } = useLocale();
  const layout = React.useMemo(() => (p.boardDoc ? boardLayout(p.boardDoc) : null), [p.boardDoc]);
  const field = p.boardDoc?.field_name ?? p.groupField!;
  const m = useFrappeMeta(p.doctype, { client: p.client });
  const raw = m.doc as { title_field?: string; fields?: FrappeDocField[] } | undefined;
  const df = raw?.fields?.find((f) => f.fieldname === field);
  // Desk's card title (kanban_view.js:234-276): the title field, else the first visible Data / Text field, else name
  const titleField = raw?.title_field || raw?.fields?.find((f) => ["Data", "Text", "Small Text", "Text Editor"].includes(f.fieldtype) && !f.hidden)?.fieldname || "name";
  const cardFields = layout?.cardFields ?? [];
  const baseFilters = React.useMemo(() => [...(p.baseFilters ?? []), ...(layout?.filters ?? [])], [p.baseFilters, layout]);
  const v = useFrappeViewList({ doctype: p.doctype, client: p.client, baseFilters, pageSize: 0, count: false, scope: `kanban:${p.boardDoc?.name ?? `group:${field}`}`, extraFields: [field, titleField, ...cardFields] });
  return v.ready
    ? <Board {...p} v={v} layout={layout} field={field} df={df} titleField={titleField} cardFields={cardFields} t={t} />
    : <KanbanBoard columns={[]} rows={[]} rowKey={() => ""} columnOf={() => ""} title={() => ""} loading />;
}

function Board({ v, layout, field, df, titleField, cardFields, t, ...p }: FrappeKanbanViewProps & {
  client: FrappeClient; boardDoc?: KanbanBoardDoc; boardNames: string[]; boardName?: string;
  v: ReturnType<typeof useFrappeViewList>; layout: ReturnType<typeof boardLayout> | null; field: string; df?: FrappeDocField; titleField: string; cardFields: string[];
  t: ReturnType<typeof useLocale>["t"];
}) {
  const onState = v.listProps.onStateChange;
  const onStateChange = React.useCallback((s: ListQueryState) => { onState(s); p.onQueryStateChange?.(s); }, [onState, p.onQueryStateChange]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useListState<Row>({ ...v.listProps, onStateChange, viewKey: `${p.doctype}:kanban`, storage: p.storage, initialQuery: p.initialQuery, defaultSort: p.defaultSort });
  const perms = usePermissions(v.bundle);
  const canWrite = perms.can("write", df?.permlevel ?? 0);
  const [board, setBoard] = React.useState(p.boardDoc);
  React.useEffect(() => setBoard(p.boardDoc), [p.boardDoc]);
  const order = React.useMemo(() => (board ? boardLayout(board).order : undefined), [board]);
  const labelOf = (f: string) => v.meta?.filterFields.find((x) => x.name === f)?.label ?? f;

  const columns = React.useMemo<KanbanColumn[]>(() => {
    if (layout) return (board ? boardLayout(board).columns : layout.columns).map((c) => ({ key: c.column_name, label: c.column_name, indicator: c.indicator }));
    const opts = (df?.options ?? "").split("\n").map((o) => o.trim()).filter(Boolean);
    const cols: KanbanColumn[] = opts.map((o) => ({ key: o, label: o }));
    if (v.rows.some((r) => r[field] === null || r[field] === undefined || r[field] === "")) cols.push({ key: "", label: t("kanbanNotSet") });
    return cols;
  }, [layout, board, df, v.rows, field, t]);

  const onMove = async (mv: KanbanMove<Row>) => {
    const name = String(mv.row.name);
    if (board) {
      const next = await moveKanbanCard(p.client, { board_name: board.name, docname: name, from_colname: mv.from, to_colname: mv.to, old_index: mv.fromIndex, new_index: mv.toIndex });
      if (next && Array.isArray(next.columns)) { setBoard(next); v.queryClient.setQueryData(["sf-frappe", "kanban-board", board.name], next); }
    } else {
      await p.client.call("frappe.client.set_value", { doctype: p.doctype, name, fieldname: JSON.stringify({ [field]: mv.to }) });
    }
    patchCachedRows(v.queryClient, p.doctype, name, { [field]: mv.to });
    p.onCardMoved?.(mv.row, mv.to);
  };
  const movable = (row: Row) => canWrite && (Number(row.docstatus ?? 0) === 0 || (Number(row.docstatus) === 1 && !!df?.allow_on_submit));
  const renderCard = p.renderCard ?? (cardFields.length ? (row: Row) => (
    <dl className="space-y-0.5">{cardFields.filter((f) => row[f] !== null && row[f] !== undefined && row[f] !== "").map((f) => (
      <div key={f} className="flex gap-1"><dt className="text-muted-foreground">{labelOf(f)}:</dt><dd className="truncate">{String(row[f])}</dd></div>
    ))}</dl>
  ) : undefined);

  return (
    <div className={p.className ? `space-y-3 ${p.className}` : "space-y-3"}>
      <ViewToolbar state={s} controls={{ sort: false, ...p.controls }} loadOptions={v.listProps.loadOptions}
        leading={<>
          {p.toolbarLeading}
          {board && p.boardNames.length > 1 && (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("kanbanBoardPicker")}</span>
              <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={board.name} onChange={(e) => p.onBoardChange?.(e.target.value)}>
                {p.boardNames.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}
          {!board && <span className="text-xs text-muted-foreground" data-testid="sf-kanban-mode">{t("kanbanGroupedBy").replace("{field}", labelOf(field))}</span>}
        </>}
        actions={p.toolbarActions} />
      <KanbanBoard<Row>
        columns={columns} rows={s.rows} rowKey={s.rowKey} columnOf={(r) => String(r[field] ?? "")}
        title={(r) => String(r[titleField] ?? r.name ?? "")} renderCard={renderCard} order={order}
        onMove={canWrite ? onMove : undefined} canMove={movable} onOpen={p.onOpen} onAddCard={p.onAddCard}
        loading={v.listProps.loading} error={v.listProps.error} onRetry={v.refetch}
        readOnlyReason={!canWrite && perms.known ? t("kanbanReadOnly").replace("{doctype}", p.doctype) : undefined} />
    </div>
  );
}
