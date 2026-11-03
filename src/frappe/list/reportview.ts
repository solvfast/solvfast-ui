/**
 * `frappe.desk.reportview.get` — the Desk list's own row source (docs 13 §1.3). Unlike `frappe.client.get_list` it
 * supports `with_comment_count` and returns assignee profiles (`user_info`). The response is compressed
 * (`{ keys, values, user_info }`, or an empty list when there are no rows); `decodeReportview` expands it.
 * The generic client `getList` stays on `frappe.client.get_list`.
 */
import type { FrappeClient } from "../client";
import type { FrappeFilter } from "../query";

export interface ReportviewUser { fullname?: string; image?: string | null; name?: string; [k: string]: unknown }
export interface DecodedReportview<T = Record<string, unknown>> { rows: T[]; userInfo: Record<string, ReportviewUser> }

/** Standard columns Desk always requests for list rows (docs 13 §1.2 step 8; `JS/model/model.js:64-76`). */
export const ROW_STANDARD_FIELDS = ["_comments", "_assign", "_liked_by", "_user_tags"] as const;

export function decodeReportview<T = Record<string, unknown>>(res: { message?: unknown }): DecodedReportview<T> {
  const m = res.message as { keys?: string[]; values?: unknown[][]; user_info?: Record<string, ReportviewUser> } | unknown[] | null | undefined;
  if (!m || Array.isArray(m) || !Array.isArray(m.keys) || !Array.isArray(m.values)) return { rows: [], userInfo: {} };
  const keys = m.keys;
  const rows = m.values.map((v) => { const o: Record<string, unknown> = {}; keys.forEach((k, i) => { o[k] = v[i] ?? null; }); return o as T; });
  return { rows, userInfo: m.user_info ?? {} };
}

export interface ReportviewArgs {
  fields: string[];
  filters?: FrappeFilter[];
  or_filters?: FrappeFilter[];
  order_by?: string;
  limit_start?: number;
  limit_page_length?: number;
  /** `with_comment_count` (default true; false when List View Settings `disable_comment_count`). */
  withCommentCount?: boolean;
  /** Set when a filter targets a child table (rows are joined; native groups by the parent name). */
  group_by?: string;
}

const json = (v: unknown) => JSON.stringify(v);

export async function reportviewGet<T = Record<string, unknown>>(client: FrappeClient, doctype: string, a: ReportviewArgs): Promise<DecodedReportview<T>> {
  const res = await client.call("frappe.desk.reportview.get", {
    doctype, fields: json(a.fields), filters: json(a.filters ?? []), or_filters: json(a.or_filters ?? []),
    order_by: a.order_by, start: a.limit_start ?? 0, page_length: a.limit_page_length ?? 20,
    view: "List", with_comment_count: a.withCommentCount === false ? 0 : 1,
    ...(a.group_by ? { group_by: a.group_by } : {}),
  });
  return decodeReportview<T>(res);
}

/** Upper bound Desk counts to (`count_upper_bound`, list_view.js:34). */
export const COUNT_UPPER_BOUND = 1001;

/** `reportview.get_count` with a limit; `capped` = the server stopped at the bound. */
export async function reportviewCount(client: FrappeClient, doctype: string, a: { filters?: FrappeFilter[]; or_filters?: FrappeFilter[]; distinct?: boolean; limit?: number }): Promise<{ count: number; capped: boolean }> {
  const res = await client.call("frappe.desk.reportview.get_count", {
    doctype, filters: json(a.filters ?? []), or_filters: json(a.or_filters ?? []), fields: json([]),
    ...(a.distinct ? { distinct: true } : {}), ...(a.limit ? { limit: a.limit } : {}),
  });
  const count = Number(res.message) || 0;
  return { count, capped: !!a.limit && count >= a.limit };
}

/** A row's `_comment_count`, else the length of its `_comments` JSON (UNVERIFIED: the server adds it only when `_comments` is selected). */
export function commentCount(row: Record<string, unknown>): number {
  if (typeof row._comment_count === "number") return row._comment_count;
  try { return (JSON.parse(String(row._comments || "[]")) as unknown[]).length; } catch { return 0; }
}
