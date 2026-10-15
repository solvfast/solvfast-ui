/**
 * A simulated Frappe site for tests and the playground — NO network, no real site. It answers the four stock methods
 * the Frappe layer uses, with the ToDo DocType's real definition (frappe/desk/doctype/todo/todo.json, Frappe 15.110,
 * read from the local source) and made-up rows. Like Frappe it rejects unknown fields (417 DataError "Field not
 * permitted in query"), so a request with a bad field fails here as it would on a site. Playground/tests only.
 */
import { toFrappeError, type FrappeResponse, type FrappeTransport } from "@ui/frappe";

export const TODO_META = {
  name: "ToDo", title_field: "description", search_fields: "description, reference_type, reference_name",
  sort_field: "modified", sort_order: "DESC",
  fields: [
    { fieldname: "description_and_status", fieldtype: "Section Break" },
    { fieldname: "status", label: "Status", fieldtype: "Select", options: "Open\nClosed\nCancelled", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "priority", label: "Priority", fieldtype: "Select", options: "High\nMedium\nLow", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "column_break_2", fieldtype: "Column Break" },
    { fieldname: "color", label: "Color", fieldtype: "Color" },
    { fieldname: "date", label: "Due Date", fieldtype: "Date", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "description_section", fieldtype: "Section Break" },
    { fieldname: "description", label: "Description", fieldtype: "Text Editor" },
    { fieldname: "section_break_6", label: "Reference", fieldtype: "Section Break" },
    { fieldname: "reference_type", label: "Reference Type", fieldtype: "Link", options: "DocType", in_list_view: 1 },
    { fieldname: "reference_name", label: "Reference Name", fieldtype: "Dynamic Link", options: "reference_type" },
    { fieldname: "column_break_10", fieldtype: "Column Break" },
    { fieldname: "role", label: "Role", fieldtype: "Link", options: "Role" },
    { fieldname: "assigned_by", label: "Assigned By", fieldtype: "Link", options: "User" },
    { fieldname: "assigned_by_full_name", label: "Assigned By Full Name", fieldtype: "Read Only" },
    { fieldname: "sender", label: "Sender", fieldtype: "Data", options: "Email", hidden: 1 },
    { fieldname: "assignment_rule", label: "Assignment Rule", fieldtype: "Link", options: "Assignment Rule" },
    { fieldname: "allocated_to", label: "Allocated To", fieldtype: "Link", options: "User", in_standard_filter: 1 },
  ],
};

const USERS = ["sara@example.com", "khaled@example.com", "omar@example.com", "lina@example.com"];
const TASKS = [
  "Confirm hotel block for the Riyadh offsite", "Review visa documents for the Jeddah team", "Call the airline about group fares",
  "Update the corporate travel policy", "Approve expense report", "Prepare the quarterly booking summary",
  "Renew the travel insurance contract", "Collect passport copies", "Send the itinerary to the client",
  "Check the KYC documents", "Follow up on the refund", "Book meeting rooms for the workshop",
];
const REFS = [["Field Preset", "fp_corporate_booking"], ["Field Preset", "fp_visa_wizard"], ["Project", "PROJ-0007"], ["", ""]];

/** 45 ToDos; `name` is a hash like Frappe's, dates relative to 15 Oct 2026. */
export function todoRows() {
  const day = (offset: number) => new Date(Date.UTC(2026, 9, 15 + offset)).toISOString().slice(0, 10);
  return Array.from({ length: 45 }, (_, i) => {
    const [reference_type, reference_name] = REFS[i % REFS.length];
    return {
      name: `${(0x5f3a9 * (i + 7)).toString(36).slice(-6)}${i.toString(36)}`,
      status: i % 7 === 0 ? "Cancelled" : i % 3 === 0 ? "Closed" : "Open",
      priority: ["High", "Medium", "Low"][i % 3],
      date: i % 5 === 4 ? null : day((i % 11) - 4),
      description: `<p>${TASKS[i % TASKS.length]}${i >= TASKS.length ? ` (${Math.floor(i / TASKS.length) + 1})` : ""}</p>`,
      reference_type, reference_name,
      allocated_to: USERS[i % USERS.length],
      assigned_by: USERS[(i + 1) % USERS.length],
      creation: `${day(-20 + (i % 15))} 0${i % 10}:15:00.000000`,
      modified: `${day(-6 + (i % 6))} 1${i % 10}:${String(i % 60).padStart(2, "0")}:00.000000`,
    };
  });
}

type Row = Record<string, unknown>;
type Filter = [string, string, unknown] | [string, string, string, unknown];
const STANDARD = new Set(["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx"]);

class MockError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) { super(String(body.exc_type)); }
}
const dataError = (field: string) => new MockError(417, {
  exc_type: "DataError", _server_messages: JSON.stringify([JSON.stringify({ message: `Field not permitted in query: ${field}` })]),
});

function like(value: unknown, pattern: string) {
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "is");
  return re.test(String(value ?? ""));
}
const cmp = (a: unknown, b: unknown) => {
  const na = Number(a), nb = Number(b);
  if (typeof b === "number" && !Number.isNaN(na)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
};
function test(row: Row, f: Filter): boolean {
  const [field, op, value] = f.length === 4 ? [f[1], f[2], f[3]] : f;
  const v = row[field as string];
  const blank = v === null || v === undefined || v === "";
  switch (op) {
    case "=": return String(v ?? "") === String(value);
    case "!=": return String(v ?? "") !== String(value);
    case "like": return like(v, String(value));
    case "not like": return !like(v, String(value));
    case "in": return (value as unknown[]).map(String).includes(String(v ?? ""));
    case "not in": return !(value as unknown[]).map(String).includes(String(v ?? ""));
    case ">": return !blank && cmp(v, value) > 0;
    case "<": return !blank && cmp(v, value) < 0;
    case ">=": return !blank && cmp(v, value) >= 0;
    case "<=": return !blank && cmp(v, value) <= 0;
    case "between": { const [a, b] = value as string[]; return !blank && String(v) >= a && String(v) <= `${b} 23:59:59.999999`; }
    case "is": return value === "set" ? !blank : blank;
    default: throw new MockError(417, { exc_type: "ValidationError", _server_messages: JSON.stringify([JSON.stringify({ message: `Unsupported operator ${String(op)}` })]) });
  }
}

export interface MockFrappe {
  transport: FrappeTransport;
  /** Every call, in order: method + parsed args (JSON strings decoded). */
  calls: { method: string; args: Record<string, unknown> }[];
  rows: Row[];
  /** Fail the next `n` calls of `method` (or any method) with this status / body. */
  failNext: (n: number, error: { status: number; exc_type: string; message: string }, method?: string) => void;
}

export function createMockFrappe(opts: { latencyMs?: number; rows?: Row[] } = {}): MockFrappe {
  const rows: Row[] = opts.rows ?? todoRows();
  const known = new Set([...TODO_META.fields.map((f) => f.fieldname), ...STANDARD]);
  const calls: MockFrappe["calls"] = [];
  let failures: { n: number; method?: string; error: { status: number; exc_type: string; message: string } } | null = null;
  const parse = (v: unknown) => (typeof v === "string" ? (JSON.parse(v) as unknown) : v);
  const check = (fields: string[]) => { for (const f of fields) if (!known.has(f)) throw dataError(f); };
  const fieldOfFilter = (f: Filter) => String(f.length === 4 ? f[1] : f[0]);
  const select = (args: Record<string, unknown>) => {
    const filters = (parse(args.filters) ?? []) as Filter[];
    const or = (parse(args.or_filters) ?? []) as Filter[];
    check([...filters, ...or].map(fieldOfFilter));
    return rows.filter((r) => filters.every((f) => test(r, f)) && (!or.length || or.some((f) => test(r, f))));
  };

  const handle = (method: string, args: Record<string, unknown>): FrappeResponse => {
    switch (method) {
      case "frappe.desk.form.load.getdoctype":
        if (args.doctype !== "ToDo") throw new MockError(404, { exc_type: "DoesNotExistError", _server_messages: JSON.stringify([JSON.stringify({ message: `DocType ${String(args.doctype)} not found` })]) });
        return { docs: [TODO_META], user_settings: "{}" };
      case "frappe.client.get_list": {
        const fields = parse(args.fields) as string[];
        check(fields);
        const [ofield, odir = "desc"] = String(args.order_by ?? "modified desc").split(/\s+/);
        check([ofield]);
        const sorted = [...select(args)].sort((a, b) => cmp(a[ofield], b[ofield]) * (odir.toLowerCase() === "asc" ? 1 : -1));
        const start = Number(args.limit_start ?? 0), len = Number(args.limit_page_length ?? 20);
        return { message: sorted.slice(start, start + len).map((r) => Object.fromEntries(fields.map((f) => [f, r[f] ?? null]))) };
      }
      case "frappe.desk.reportview.get_count":
        return { message: select(args).length };
      case "frappe.desk.search.search_link": {
        const txt = String(args.txt ?? "").toLowerCase();
        const pool: Record<string, string[]> = { User: USERS, DocType: ["Field Preset", "Project", "Task", "ToDo"], Role: ["System Manager", "Travel Agent"] };
        return { message: (pool[String(args.doctype)] ?? []).filter((v) => v.toLowerCase().includes(txt)).slice(0, Number(args.page_length ?? 10)).map((value) => ({ value, description: "" })) };
      }
      default:
        throw new MockError(404, { exc_type: "DoesNotExistError", _server_messages: JSON.stringify([JSON.stringify({ message: `Method ${method} not found` })]) });
    }
  };

  // Behaves like the package's HTTP transport: resolves the response, throws what toFrappeError would build.
  const transport: FrappeTransport = async (method: string, args: Record<string, unknown>) => {
    calls.push({ method, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === "string" && /^[[{]/.test(v) ? JSON.parse(v) : v])) });
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
    if (failures && failures.n > 0 && (!failures.method || failures.method === method)) {
      failures.n--;
      const e = failures.error;
      throw toFrappeError(e.status, { exc_type: e.exc_type, _server_messages: JSON.stringify([JSON.stringify({ message: e.message })]) });
    }
    try { return handle(method, args); } catch (e) {
      if (e instanceof MockError) throw toFrappeError(e.status, e.body);
      throw e;
    }
  };
  return { transport, calls, rows, failNext: (n, error, method) => { failures = { n, error, method }; } };
}
