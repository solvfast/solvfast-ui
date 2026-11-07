/**
 * SIMULATED handlers added by the P35 "views" workstream. Each handler cites the Frappe 15.110 source of its response
 * shape. They see only `(args, store)` — none of the simulator's internal helpers — so they read and write
 * `store.docs` directly and DO NOT evaluate permissions (the opt-in permission engine is not reachable from here): on a
 * site, kanban_board.py:110 / :137 and calendar.py:25-26 check the session's rights; the UI gates on the client-side
 * rights (`usePermissions`) and the server stays the authority. Nothing here is evidence of Frappe behaviour.
 *
 * Also: `KANBAN_BOARD_FIXTURE_META` (Kanban Board + Kanban Board Column, a subset of
 * frappe/desk/doctype/kanban_board/kanban_board.json and kanban_board_column/kanban_board_column.json) — spread it
 * into `backend.meta` so the builtin `frappe.client.get` can load a board (Desk: kanban_view.js:141-147) — and a small
 * demo site for the views (`viewsDemoBackend`).
 */
import type { DocTypeMeta, FixtureBackend, FrappeDoc } from "../../contract";
import { toFrappeError } from "../../client";
import type { FixtureHandler, FixtureStore } from "../fixtureTransport";

type Row = Record<string, unknown>;
const KB = "frappe.desk.doctype.kanban_board.kanban_board";
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const sm = (message: string) => JSON.stringify([JSON.stringify({ message, indicator: "red", raise_exception: 1 })]);
const fail = (status: number, exc_type: string, message: string): never => { throw toFrappeError(status, { exc_type, _server_messages: sm(message) }); };
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}000`; };
const docOf = (store: FixtureStore, doctype: string, name: unknown): FrappeDoc => store.docs.get(doctype)?.get(String(name)) ?? fail(404, "DoesNotExistError", `${doctype} ${String(name)} not found`);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const touch = (store: FixtureStore, doc: FrappeDoc) => { doc.modified = stamp(); doc.modified_by = store.user; };

/** One filter on one row — the operators the views send to get_events (SIMULATED subset). */
function test(v: unknown, op: string, value: unknown): boolean {
  const s = (x: unknown) => String(x ?? "");
  const blank = v === null || v === undefined || v === "";
  const like = (pat: string) => new RegExp(`^${pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "is").test(s(v));
  switch (op.toLowerCase()) {
    case "=": return s(v) === s(value);
    case "!=": return s(v) !== s(value);
    case "like": return like(s(value));
    case "not like": return !like(s(value));
    case "in": return (Array.isArray(value) ? value : s(value).split(",")).map((x) => s(x).trim()).includes(s(v));
    case "not in": return !(Array.isArray(value) ? value : s(value).split(",")).map((x) => s(x).trim()).includes(s(v));
    case ">": return !blank && s(v) > s(value);
    case "<": return !blank && s(v) < s(value);
    case ">=": return !blank && s(v) >= s(value);
    case "<=": return !blank && s(v) <= s(value);
    case "between": { const [a, b] = value as string[]; return !blank && s(v) >= s(a) && s(v) <= (s(b).length === 10 ? `${s(b)} 23:59:59.999999` : s(b)); }
    case "is": return s(value) === "set" ? !blank : blank;
    default: return fail(417, "ValidationError", `SIMULATED: operator "${op}" is not simulated by get_events`);
  }
}

export const viewsHandlers: Record<string, FixtureHandler> = {
  /**
   * kanban_board.py:68-75 `get_kanban_boards(doctype)` → `frappe.get_list("Kanban Board", fields=[name, filters,
   * reference_doctype, private], filters={reference_doctype})`, with the permission query of :48-55 (private boards only
   * for their owner, all for Administrator).
   */
  [`${KB}.get_kanban_boards`]: (a, store) => {
    const boards = [...(store.docs.get("Kanban Board")?.values() ?? [])]
      .filter((b) => b.reference_doctype === a.doctype && (store.user === "Administrator" || !Number(b.private) || b.owner === store.user));
    return { message: boards.map((b) => ({ name: b.name, filters: b.filters ?? null, reference_doctype: b.reference_doctype, private: Number(b.private ?? 0) })) };
  },
  /**
   * kanban_board.py:131-161 `update_order_for_single_card(board_name, docname, from_colname, to_colname, old_index,
   * new_index)`: move the name between the columns' `order` JSON lists (insert at new_index the item popped at old_index
   * of the source column, :147-151), save the board, then `frappe.set_value(doctype, docname, field_name, to_colname)`.
   * Answers the board (`{message: board}`, read by kanban_board.bundle.js:190-200). Write permission (:137) NOT simulated.
   */
  [`${KB}.update_order_for_single_card`]: (a, store) => {
    const board = docOf(store, "Kanban Board", a.board_name);
    const doctype = String(board.reference_doctype);
    const columns = (board.columns as Row[] | undefined) ?? [];
    const col = (name: unknown) => { const i = columns.findIndex((c) => c.column_name === name); return { i, order: i < 0 ? [] : ((parse(columns[i].order) as string[] | null) ?? []) }; };
    const from = col(a.from_colname), to = col(a.to_colname);
    if (from.i < 0 || to.i < 0) fail(417, "ValidationError", `SIMULATED: column ${from.i < 0 ? String(a.from_colname) : String(a.to_colname)} is not on board ${board.name}`); // Python: UnboundLocalError
    const oldIndex = Number(parse(a.old_index)), newIndex = Number(parse(a.new_index));
    const fromOrder = a.from_colname === a.to_colname ? to.order : from.order;
    if (fromOrder.length) {
      if (oldIndex < 0 || oldIndex >= fromOrder.length) fail(500, "IndexError", "pop index out of range"); // list.pop on Python
      to.order.splice(newIndex, 0, fromOrder.splice(oldIndex, 1)[0]);
    }
    columns[from.i].order = JSON.stringify(fromOrder);
    columns[to.i].order = JSON.stringify(to.order);
    touch(store, board);
    const target = docOf(store, doctype, a.docname);
    target[String(board.field_name)] = a.to_colname;
    touch(store, target);
    return { message: clone(board) };
  },
  /**
   * calendar.py:31-57 `get_events(doctype, start, end, field_map, filters=None, fields=None)`: the fields default to
   * start / end / title / name (+ the first Color field, :37-47); the range test is `ifnull(start,'0001-01-01') <= end`
   * and `ifnull(end,'2199-12-31') >= start` (:49-55); answers `frappe.get_list(...)` — a list of dicts. Read permission
   * (:25-26) and User Permissions NOT simulated; filters use a small operator subset.
   */
  "frappe.desk.calendar.get_events": (a, store) => {
    const doctype = String(a.doctype);
    const bundle = Object.values(store.meta).flat();
    const meta = bundle.find((m) => m.name === doctype) ?? fail(404, "DoesNotExistError", `DocType ${doctype} not found`);
    const map = (parse(a.field_map) as Record<string, string>) ?? {};
    const color = meta.fields.find((f) => f.fieldtype === "Color")?.fieldname ?? map.color;
    let fields = (parse(a.fields) as string[] | null) ?? [map.start, map.end, map.title, "name"];
    if (color) fields = [...fields, color];
    fields = [...new Set(fields.filter(Boolean))];
    const filters = ((parse(a.filters) as unknown[][] | null) ?? []).filter(Array.isArray);
    const start = String(a.start), end = String(a.end);
    const rows = [...(store.docs.get(doctype)?.values() ?? [])].filter((d) => {
      const s = String(d[map.start] ?? "") || "0001-01-01 00:00:00";
      const e = String(d[map.end] ?? "") || "2199-12-31 00:00:00";
      if (!(s <= end && e >= start)) return false;
      return filters.every((f) => { const [field, op, value] = f.length === 4 ? f.slice(1) : f; return test(d[String(field)], String(op), value); });
    });
    return { message: rows.map((d) => Object.fromEntries(fields.map((f) => [f, d[f] ?? null]))) };
  },
};

/** Kanban Board + Kanban Board Column (subset of the 15.110 JSONs; System Manager and Desk User rights as shipped). */
export const KANBAN_BOARD_FIXTURE_META: Record<string, DocTypeMeta[]> = {
  "Kanban Board": [
    {
      name: "Kanban Board", autoname: "field:kanban_board_name", module: "Desk",
      permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }, { role: "Desk User", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }],
      fields: [
        { fieldname: "kanban_board_name", fieldtype: "Data", label: "Kanban Board Name", reqd: 1 },
        { fieldname: "reference_doctype", fieldtype: "Link", label: "Reference Document Type", options: "DocType", reqd: 1 },
        { fieldname: "field_name", fieldtype: "Select", label: "Field Name" },
        { fieldname: "columns", fieldtype: "Table", label: "Columns", options: "Kanban Board Column" },
        { fieldname: "filters", fieldtype: "Code", label: "Filters", options: "JSON" },
        { fieldname: "private", fieldtype: "Check", label: "Private" },
        { fieldname: "fields", fieldtype: "Code", label: "Fields", options: "JSON" },
        { fieldname: "show_labels", fieldtype: "Check", label: "Show Labels" },
      ],
    },
    {
      name: "Kanban Board Column", istable: 1, module: "Desk",
      fields: [
        { fieldname: "column_name", fieldtype: "Data", label: "Column Name" },
        { fieldname: "status", fieldtype: "Select", label: "Status", options: "Active\nArchived", default: "Active" },
        { fieldname: "indicator", fieldtype: "Select", label: "Indicator", options: "Blue\nCyan\nGray\nGreen\nLight Blue\nOrange\nPink\nPurple\nRed\nYellow", default: "Gray" },
        { fieldname: "order", fieldtype: "Code", label: "Order" },
      ],
    },
  ],
};

const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, print: 1, share: 1, email: 1 } as const;
const READER = { role: "Reader", permlevel: 0, read: 1, report: 1 } as const;

/** Demo DocTypes for the views (authored, SIMULATED): Product (image view), Project Task (report / kanban / calendar). */
export const VIEWS_DEMO_META: Record<string, DocTypeMeta[]> = {
  Product: [{
    name: "Product", autoname: "hash", title_field: "product_name", image_field: "image", sort_field: "product_name", sort_order: "asc",
    permissions: [SM, READER],
    fields: [
      { fieldname: "product_name", fieldtype: "Data", label: "Product Name", reqd: 1, in_list_view: 1 },
      { fieldname: "category", fieldtype: "Select", label: "Category", options: "\nHardware\nSoftware\nService", in_list_view: 1, in_standard_filter: 1 },
      { fieldname: "price", fieldtype: "Currency", label: "Price", in_list_view: 1 },
      { fieldname: "image", fieldtype: "Attach Image", label: "Image" },
    ],
  }],
  "Project Task": [
    {
      name: "Project Task", autoname: "hash", title_field: "subject", sort_field: "exp_start_date", sort_order: "asc",
      permissions: [SM, READER],
      fields: [
        { fieldname: "subject", fieldtype: "Data", label: "Subject", reqd: 1, in_list_view: 1 },
        { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nWorking\nPending Review\nCompleted\nCancelled", in_list_view: 1, in_standard_filter: 1 },
        { fieldname: "priority", fieldtype: "Select", label: "Priority", options: "Low\nMedium\nHigh", in_list_view: 1 },
        { fieldname: "exp_start_date", fieldtype: "Date", label: "Expected Start Date" },
        { fieldname: "exp_end_date", fieldtype: "Date", label: "Expected End Date" },
        { fieldname: "hours", fieldtype: "Float", label: "Hours", in_list_view: 1 },
        { fieldname: "cost", fieldtype: "Currency", label: "Cost" },
        { fieldname: "progress", fieldtype: "Percent", label: "Progress", read_only: 1 },
        { fieldname: "color", fieldtype: "Color", label: "Color" },
        { fieldname: "items", fieldtype: "Table", label: "Items", options: "Project Task Item" },
      ],
    },
    {
      name: "Project Task Item", istable: 1,
      fields: [
        { fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 },
        { fieldname: "qty", fieldtype: "Int", label: "Qty", in_list_view: 1 },
      ],
    },
  ],
};

const order = (names: string[]) => JSON.stringify(names);
/** A demo site for the views: products with and without images, tasks in November 2026, one Kanban Board on status. */
export function viewsDemoBackend(over: Partial<FixtureBackend> = {}): FixtureBackend {
  const t = (name: string, subject: string, status: string, priority: string, start: string, end: string | null, hours: number, cost: number, extra: Row = {}) =>
    ({ doctype: "Project Task", name, subject, status, priority, exp_start_date: start, exp_end_date: end, hours, cost, progress: status === "Completed" ? 100 : 0, modified: `2026-11-0${(name.charCodeAt(name.length - 1) % 9) + 1} 10:00:00.000000`, ...extra }) as unknown as FrappeDoc;
  return {
    meta: { ...KANBAN_BOARD_FIXTURE_META, ...VIEWS_DEMO_META, ...(over.meta ?? {}) },
    docs: {
      Product: [
        { doctype: "Product", name: "P-1", product_name: "Laptop Pro", category: "Hardware", price: 1200, image: "/files/laptop.png", modified: "2026-11-01 10:00:00.000000" },
        { doctype: "Product", name: "P-2", product_name: "Office Suite", category: "Software", price: 300, image: null, modified: "2026-11-02 10:00:00.000000" },
        { doctype: "Product", name: "P-3", product_name: "Desk Lamp", category: "Hardware", price: 45, image: "/files/lamp.png", modified: "2026-11-03 10:00:00.000000" },
        { doctype: "Product", name: "P-4", product_name: "Setup Service", category: "Service", price: 90, image: null, modified: "2026-11-04 10:00:00.000000" },
      ] as unknown as FrappeDoc[],
      "Project Task": [
        t("T-1", "Write spec", "Open", "High", "2026-11-03", "2026-11-05", 6, 600, { color: "#e24c4c", items: [{ item: "Template", qty: 1 }, { item: "Review", qty: 2 }] }),
        t("T-2", "Build grid", "Working", "Medium", "2026-11-04", "2026-11-12", 20, 2000),
        t("T-3", "Fix bugs", "Working", "Low", "2026-11-10", null, 4.5, 450),
        t("T-4", "Release notes", "Pending Review", "Medium", "2026-11-20", "2026-11-20", 2, 200),
        t("T-5", "Kickoff", "Completed", "Low", "2026-10-28", "2026-10-28", 1, 100),
        t("T-6", "Retro", "Open", "Low", "2026-12-02", "2026-12-02", 1, 100),
      ],
      "Kanban Board": [{
        doctype: "Kanban Board", name: "Task Board", kanban_board_name: "Task Board", reference_doctype: "Project Task", field_name: "status",
        filters: "[]", private: 0, show_labels: 0, fields: "[]", owner: "Administrator",
        columns: [
          { column_name: "Open", status: "Active", indicator: "Blue", order: order(["T-6", "T-1"]) },
          { column_name: "Working", status: "Active", indicator: "Orange", order: order(["T-2", "T-3"]) },
          { column_name: "Pending Review", status: "Active", indicator: "Purple", order: order(["T-4"]) },
          { column_name: "Completed", status: "Active", indicator: "Green", order: order(["T-5"]) },
          { column_name: "Cancelled", status: "Archived", indicator: "Gray", order: order([]) },
        ],
      }] as unknown as FrappeDoc[],
      ...(over.docs ?? {}),
    },
    ...(over.user ? { user: over.user } : {}),
    ...(over.workflows ? { workflows: over.workflows } : {}),
    ...(over.latency ? { latency: over.latency } : {}),
  };
}
