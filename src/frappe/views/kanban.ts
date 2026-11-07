/**
 * Kanban Board server calls (frappe/desk/doctype/kanban_board/kanban_board.py) and the board → columns mapping. The
 * request shapes are Desk's (kanban_view.js, kanban_board.bundle.js).
 */
import type { FrappeClient } from "../client";
import type { FrappeFilter } from "../query";

export const KANBAN_METHODS = {
  getBoards: "frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards",
  moveCard: "frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card",
} as const;

export interface KanbanBoardSummary { name: string; filters?: string | null; reference_doctype: string; private?: number }
export interface KanbanBoardColumnDoc { column_name: string; status?: "Active" | "Archived" | string; indicator?: string; order?: string | null }
export interface KanbanBoardDoc {
  name: string;
  kanban_board_name?: string;
  reference_doctype: string;
  /** The Select (or Link) field whose value is the column. */
  field_name: string;
  columns: KanbanBoardColumnDoc[];
  /** JSON list of filters (Desk's filter area, saved with "Save filters"). */
  filters?: string | null;
  /** JSON list of fieldnames shown on the cards (Kanban Settings). */
  fields?: string | null;
  show_labels?: number;
  private?: number;
}

/** `get_kanban_boards(doctype)` (kanban_board.py:68-75; Desk: kanban_view.js:306-310). */
export async function getKanbanBoards(client: FrappeClient, doctype: string): Promise<KanbanBoardSummary[]> {
  const res = await client.call(KANBAN_METHODS.getBoards, { doctype });
  return Array.isArray(res.message) ? (res.message as KanbanBoardSummary[]) : [];
}

/** The board document: `frappe.client.get` (Desk: `frappe.db.get_doc("Kanban Board", name)`, kanban_view.js:141-147). */
export async function getKanbanBoard(client: FrappeClient, name: string): Promise<KanbanBoardDoc> {
  const res = await client.call("frappe.client.get", { doctype: "Kanban Board", name });
  return res.message as KanbanBoardDoc;
}

export interface KanbanCardMove { board_name: string; docname: string; from_colname: string; to_colname: string; old_index: number; new_index: number }

/** `update_order_for_single_card` (kanban_board.py:131-161; args as kanban_board.bundle.js:175-184). Answers the board. */
export async function moveKanbanCard(client: FrappeClient, move: KanbanCardMove): Promise<KanbanBoardDoc> {
  const res = await client.call(KANBAN_METHODS.moveCard, { ...move });
  return res.message as KanbanBoardDoc;
}

const parse = <T,>(v: unknown, fallback: T): T => { if (typeof v !== "string" || !v.trim()) return fallback; try { return (JSON.parse(v) as T) ?? fallback; } catch { return fallback; } };

/** The board's active columns (Archived ones hidden, as Desk's `prepare_columns`), their card order, filters and card fields. */
export function boardLayout(board: KanbanBoardDoc): { columns: KanbanBoardColumnDoc[]; order: Record<string, string[]>; filters: FrappeFilter[]; cardFields: string[] } {
  const columns = (board.columns ?? []).filter((c) => c.status !== "Archived");
  const order = Object.fromEntries(columns.map((c) => [c.column_name, parse<string[]>(c.order, [])]));
  const filters = parse<unknown[]>(board.filters, []).filter((f): f is FrappeFilter => Array.isArray(f) && (f.length === 3 || f.length === 4));
  const cardFields = parse<unknown[]>(board.fields, []).filter((f): f is string => typeof f === "string");
  return { columns, order, filters, cardFields };
}
