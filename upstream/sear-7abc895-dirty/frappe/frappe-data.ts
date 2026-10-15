/**
 * Thin wrappers over Frappe's BUILT-IN whitelisted APIs — no per-app backend needed. <DataGrid> talks to
 * these directly: `getdoctype` for meta, `client.get_list`/`get_count` for data, and a `get_list` on the
 * link target for link autocomplete. Permissions/RBAC are enforced by Frappe.
 */
import { frappeCall, frappeCallRaw } from "@/lib/api";
import type { DocMeta, DocField } from "@/lib/data-grid/frappe-meta";
import type { FrappeFilter } from "@/lib/data-grid/filter-to-frappe";

/** Fetch a doctype's meta via the same API the Frappe Desk uses. Returns its fields + title_field. */
export async function getDocMeta(doctype: string): Promise<DocMeta> {
  const res = await frappeCallRaw("frappe.desk.form.load.getdoctype", { doctype, with_parent: 1 });
  const docs: any[] = res?.docs || [];
  const meta = docs.find((d) => d?.name === doctype) || docs[0] || { fields: [] };
  return { doctype, fields: (meta.fields || []) as DocField[], title_field: meta.title_field || undefined };
}

export interface ListParams {
  fields?: string[];
  filters?: FrappeFilter[];
  or_filters?: FrappeFilter[];
  order_by?: string;
  limit_start?: number;
  limit_page_length?: number;
}

/** List rows via the built-in `frappe.client.get_list`. */
export async function getList<T = Record<string, any>>(doctype: string, params: ListParams = {}): Promise<T[]> {
  return frappeCall<T[]>("frappe.client.get_list", {
    doctype,
    fields: JSON.stringify(params.fields || ["name"]),
    filters: JSON.stringify(params.filters || []),
    or_filters: JSON.stringify(params.or_filters || []),
    order_by: params.order_by || "modified desc",
    limit_start: params.limit_start ?? 0,
    limit_page_length: params.limit_page_length ?? 20,
  });
}

/** Total matching rows via the built-in `frappe.client.get_count`. */
export async function getCount(doctype: string, filters: FrappeFilter[] = [], or_filters: FrappeFilter[] = []): Promise<number> {
  const n = await frappeCall<number>("frappe.client.get_count", {
    doctype,
    filters: JSON.stringify(filters),
    or_filters: JSON.stringify(or_filters),
  });
  return Number(n) || 0;
}

/** Autocomplete a Link field — search the target doctype by name (built-in get_list, permission-safe). */
export async function searchLink(doctype: string, txt: string): Promise<{ value: string; label: string }[]> {
  const rows = await getList<{ name: string }>(doctype, {
    fields: ["name"],
    or_filters: txt ? [["name", "like", `%${txt}%`]] : [],
    limit_page_length: 10,
    order_by: "modified desc",
  });
  return rows.map((r) => ({ value: r.name, label: r.name }));
}
