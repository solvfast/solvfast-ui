/**
 * SIMULATED handlers added by the P35 "list" workstream. Each handler cites the Frappe 15.110 source of its response shape.
 * They are request/response-shape stand-ins for tests and the Showcase, never evidence of server behaviour.
 *
 * Limitation (out of this module's reach): workstream handlers receive only the store, not the transport's own row
 * filter, so the filters below go through a small local matcher (=, !=, like, not like, in, not in, is set / not set,
 * >, <, >=, <=, between) over the parent DocType's columns. Child-table (4-tuple) conditions and the simulator's
 * opt-in permission evaluation are NOT applied here.
 */
import type { FixtureHandler, FixtureStore } from "../fixtureTransport";
import { toFrappeError } from "../../client";

type Row = Record<string, unknown>;
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const likeRe = (pattern: string) => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "is");
const blank = (v: unknown) => v === null || v === undefined || v === "";

function matches(v: unknown, op: string, value: unknown): boolean {
  const list = () => (Array.isArray(value) ? value : String(value).split(",")).map((x) => String(x).trim());
  switch (op.toLowerCase()) {
    case "=": return String(v ?? "") === String(value ?? "");
    case "!=": return String(v ?? "") !== String(value ?? "");
    case "like": return likeRe(String(value)).test(String(v ?? ""));
    case "not like": return !likeRe(String(value)).test(String(v ?? ""));
    case "in": return list().includes(String(v ?? ""));
    case "not in": return !list().includes(String(v ?? ""));
    case ">": return !blank(v) && String(v) > String(value);
    case "<": return !blank(v) && String(v) < String(value);
    case ">=": return !blank(v) && String(v) >= String(value);
    case "<=": return !blank(v) && String(v) <= String(value);
    case "between": { const [a, b] = value as string[]; return !blank(v) && String(v) >= String(a) && String(v) <= (String(b).length === 10 ? `${b} 23:59:59.999999` : String(b)); }
    case "is": return String(value) === "set" ? !blank(v) : blank(v);
    default: return true; // operators the list never sends to these methods
  }
}

/** The DocType's documents that pass AND-ed `[field, op, value]` filters (3-tuples, or 4-tuples naming the DocType itself). */
function filtered(store: FixtureStore, doctype: string, raw: unknown): Row[] {
  const f = parse(raw);
  const filters = (Array.isArray(f) ? f : f && typeof f === "object" ? Object.entries(f as Row).map(([k, v]) => (Array.isArray(v) ? [k, v[0], v[1]] : [k, "=", v])) : [])
    .filter(Array.isArray)
    .map((x) => (x.length === 4 ? (x[0] === doctype ? [x[1], x[2], x[3]] : null) : x))
    .filter((x): x is [string, string, unknown] => !!x);
  return [...(store.docs.get(doctype)?.values() ?? [])].filter((d) => filters.every(([field, op, value]) => matches((d as Row)[String(field).replace(/`/g, "").split(".").pop()!], String(op), value)));
}

export const listHandlers: Record<string, FixtureHandler> = {
  /**
   * `frappe.desk.listview.get_group_by_count(doctype, current_filters, field)` — frappe/desk/listview.py:33-89:
   * - `assigned_to`: open (status != Cancelled) ToDos of System Users whose `reference_name` is one of the filtered
   *   records (the server's sub-query does not check `reference_type`; reproduced as is), grouped by `allocated_to`,
   *   `[{name, count}]` ordered by count desc, at most 50 (:36-60);
   * - any other field of the DocType (or a default field): `count(*) as count, <field> as name` grouped by the field,
   *   count desc (:62-71); for `owner` the session user moves to the top (:73-84); at most 50.
   * Unknown field → ValueError("Field does not belong to doctype") (:62-63).
   */
  "frappe.desk.listview.get_group_by_count": (a, store) => {
    const doctype = String(a.doctype);
    const field = String(a.field);
    const rows = filtered(store, doctype, a.current_filters);
    const byCount = (m: Map<string | null, number>) => [...m.entries()].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count);
    if (field === "assigned_to") {
      const names = new Set(rows.map((r) => String(r.name)));
      const users = store.docs.get("User");
      const counts = new Map<string | null, number>();
      for (const t of store.todos.values()) {
        if (t.status === "Cancelled" || !names.has(String(t.reference_name ?? ""))) continue;
        const u = String(t.allocated_to ?? "");
        const user = users?.get(u) as Row | undefined;
        if (!u || (users?.size && (!user || (user.user_type ?? "System User") !== "System User"))) continue;
        counts.set(u, (counts.get(u) ?? 0) + 1);
      }
      return { message: byCount(counts).slice(0, 50) };
    }
    const meta = store.meta[doctype]?.[0];
    const DEFAULT = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype"];
    if (!(meta?.fields ?? []).some((df) => df.fieldname === field) && !DEFAULT.includes(field)) {
      throw toFrappeError(417, { exc_type: "ValueError", _server_messages: JSON.stringify([JSON.stringify({ message: "Field does not belong to doctype", indicator: "red" })]) });
    }
    const counts = new Map<string | null, number>();
    for (const r of rows) { const v = blank(r[field]) ? null : String(r[field]); counts.set(v, (counts.get(v) ?? 0) + 1); }
    let data = byCount(counts);
    if (field === "owner") {
      const i = data.findIndex((d) => d.name === store.user);
      data = i > 0 ? [data[i], ...data.filter((_, j) => j !== i).slice(0, 49)] : data.slice(0, 50);
    } else data = data.slice(0, 50);
    return { message: data };
  },

  /**
   * `frappe.desk.reportview.get_sidebar_stats(stats, doctype, filters)` → `{stats: {<column>: [[value, count], …]}}`
   * (reportview.py:623-636 → get_stats :639-696). For `_user_tags`: the `",a,b"` strings are split and counted per tag
   * (`scrub_user_tags`, :750-765), then `["No Tags", n]` is appended (:672-683); other columns: `[value, count]` rows of
   * non-empty values.
   */
  "frappe.desk.reportview.get_sidebar_stats": (a, store) => {
    const doctype = String(a.doctype);
    const columns = (parse(a.stats) as string[] | undefined) ?? [];
    const rows = filtered(store, doctype, a.filters);
    const stats: Record<string, [string, number][]> = {};
    for (const column of columns) {
      if (column === "_user_tags") {
        const tags = new Map<string, number>();
        let none = 0;
        for (const r of rows) {
          const parts = String(r._user_tags ?? "").split(",").filter(Boolean);
          if (!parts.length) none += 1;
          for (const tag of parts) tags.set(tag, (tags.get(tag) ?? 0) + 1);
        }
        stats[column] = [...tags.entries(), ["No Tags", none]];
      } else {
        const counts = new Map<string, number>();
        for (const r of rows) if (!blank(r[column])) counts.set(String(r[column]), (counts.get(String(r[column])) ?? 0) + 1);
        stats[column] = [...counts.entries()];
      }
    }
    return { message: { stats } };
  },

  /**
   * `frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings(doctype, listview_settings,
   * removed_listview_fields)` — list_view_settings.py:29-46: inserts or updates the `List View Settings` row named after
   * the DocType, then flips `in_list_view` (Property Setters, :49-85) on for the listed fields and off for the removed
   * ones (never for `status_field`), and answers `{meta, listview_settings}`. SIMULATED: the row is kept as a
   * `List View Settings` document in the store and `in_list_view` is changed on the stored meta (what a re-read of
   * `getdoctype` then returns). `get_list_settings` keeps answering from the transport's `listSettings` option — the
   * client takes the saved row from this response, as Desk does (list_settings.js:51-53 `refresh_columns`).
   */
  "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings": (a, store) => {
    const doctype = String(a.doctype);
    const values = (parse(a.listview_settings) as Row | undefined) ?? {};
    const removed = (parse(a.removed_listview_fields) as string[] | undefined) ?? [];
    let table = store.docs.get("List View Settings");
    if (!table) { table = new Map(); store.docs.set("List View Settings", table); }
    const prev = (table.get(doctype) as Row | undefined) ?? { doctype: "List View Settings", name: doctype };
    const doc = { ...prev, ...values, doctype: "List View Settings", name: doctype };
    table.set(doctype, doc as never);
    const listed = ((parse(values.fields) as { fieldname?: string }[] | undefined) ?? []).map((f) => f.fieldname).filter((f): f is string => !!f);
    const meta = store.meta[doctype]?.[0];
    if (meta) {
      for (const df of meta.fields ?? []) {
        if (df.fieldname === "status_field") continue;
        if (removed.includes(df.fieldname)) (df as Row).in_list_view = 0;
        if (listed.includes(df.fieldname)) (df as Row).in_list_view = 1;
      }
    }
    return { message: { meta: meta ?? null, listview_settings: doc } };
  },
};
