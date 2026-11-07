/**
 * Connections (Desk: the form dashboard's "Connections", `public/js/frappe/form/dashboard.js`) from the DocType meta.
 *
 * Source: getdoctype sends `meta.__dashboard` (frappe/desk/form/meta.py:257-258 `load_dashboard` →
 * `Meta.get_dashboard_data`, model/meta.py:652-720): `{ fieldname?, transactions: [{ label, items: [DocType] }],
 * non_standard_fieldnames: { DocType: field }, internal_links: { DocType: field | [table, field] },
 * dynamic_links?: { field: [value, doctype_field] }, internal_and_external_links?, method? }` — the `<doctype>_dashboard.py`
 * data plus the DocType's "Links" rows plus `override_doctype_dashboards` hooks. Recorded real 15.110 metas carry it
 * (tests/fixtures/real-15.110/user.en.json, customer.en.json; empty transactions on ToDo / Contact / Note …).
 *
 * Counts: `frappe.desk.notifications.get_open_count(doctype, name, items)` (notifications.py:244-314):
 * `{ count: { external_links_found: [{ doctype, count, open_count }], internal_links_found: [{ doctype, count,
 * open_count, names }] } }` (`timeline_data` too when the module defines `get_timeline_data`); each count is capped at
 * 100 (`get_doc_count` limit=100) and may be "?" on a statement timeout (:357-367). The server checks READ on the
 * document (`doc.check_permission()`, :268-269) but counts the linked DocTypes with `frappe.get_all` — WITHOUT their
 * permissions; Desk hides the DocTypes the user cannot read on the client (`filter_permissions`, dashboard.js:286-307,
 * boot `can_read`). Hence `canRead` on FrappeConnections.
 */
import type { DocTypeMeta, FrappeDoc } from "../contract";

export const OPEN_COUNT_METHOD = "frappe.desk.notifications.get_open_count";

export interface DashboardData {
  fieldname?: string;
  transactions: { label: string; items: string[] }[];
  non_standard_fieldnames: Record<string, string>;
  internal_links: Record<string, string | [string, string]>;
  internal_and_external_links: Record<string, string | [string, string]>;
  dynamic_links: Record<string, [string, string]>;
  /** A custom count method (`data.method`, dashboard.js:429). */
  method?: string;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** `meta.__dashboard`, normalised as Desk's `init_data` does (dashboard.js:249-255). Null when there is nothing to show. */
export function connectionsFromMeta(meta: DocTypeMeta | undefined): DashboardData | null {
  const d = obj(meta?.__dashboard);
  const transactions = (Array.isArray(d.transactions) ? d.transactions : [])
    .map((g) => obj(g))
    .map((g) => ({ label: String(g.label ?? ""), items: (Array.isArray(g.items) ? g.items : []).map(String).filter(Boolean) }))
    .filter((g) => g.items.length);
  if (!transactions.length) return null;
  return {
    fieldname: typeof d.fieldname === "string" && d.fieldname ? d.fieldname : undefined,
    transactions,
    non_standard_fieldnames: obj(d.non_standard_fieldnames) as Record<string, string>,
    internal_links: obj(d.internal_links) as DashboardData["internal_links"],
    internal_and_external_links: obj(d.internal_and_external_links) as DashboardData["internal_and_external_links"],
    dynamic_links: obj(d.dynamic_links) as DashboardData["dynamic_links"],
    method: typeof d.method === "string" && d.method ? d.method : undefined,
  };
}

/** Every DocType of the groups, in order (the `items` Desk sends, dashboard.js:422-427). */
export const connectionItems = (data: DashboardData): string[] => data.transactions.flatMap((g) => g.items);

/** Counts are requested only with a `fieldname` and for a saved document (dashboard.js:413-421). */
export const canCountConnections = (data: DashboardData | null, doc: FrappeDoc): boolean => !!data?.fieldname && !doc.__islocal;

/** Desk's `get_document_filter` (dashboard.js:391-407): `{ [fieldname]: name }` plus the dynamic-link DocType field. */
export function connectionFilters(data: DashboardData, doctype: string, docname: string): Record<string, string> {
  const fieldname = data.non_standard_fieldnames[doctype] || data.fieldname || "";
  const filter: Record<string, string> = {};
  const dyn = data.dynamic_links[fieldname];
  if (dyn) filter[dyn[1]] = dyn[0];
  if (fieldname) filter[fieldname] = docname;
  return filter;
}

export interface LinkCount { doctype: string; count: number | "?"; openCount: number; internal: boolean; names?: string[] }

/** The `get_open_count` answer → counts by DocType. */
export function parseOpenCount(message: unknown): Map<string, LinkCount> {
  const count = obj(obj(message).count);
  const out = new Map<string, LinkCount>();
  const read = (rows: unknown, internal: boolean) => {
    for (const r of Array.isArray(rows) ? rows : []) {
      const o = obj(r);
      const doctype = String(o.doctype ?? "");
      if (!doctype) continue;
      const c = o.count === "?" ? "?" : Number(o.count ?? 0) || 0;
      out.set(doctype, { doctype, count: c, openCount: Number(o.open_count ?? 0) || 0, internal, ...(internal ? { names: (Array.isArray(o.names) ? o.names : []).map(String) } : {}) });
    }
  };
  read(count.external_links_found, false);
  read(count.internal_links_found, true);
  return out;
}

/**
 * Where a connection leads (dashboard.js:367-389): an internal link with names → `{ name: ["in", names] }`; an internal
 * link without names → nowhere (null); otherwise `connectionFilters`.
 */
export function connectionTarget(data: DashboardData, counts: Map<string, LinkCount> | undefined, doctype: string, docname: string): Record<string, unknown> | null {
  const c = counts?.get(doctype);
  if (c?.internal) return c.names?.length ? { name: ["in", c.names] } : null;
  return data.fieldname ? connectionFilters(data, doctype, docname) : null;
}
