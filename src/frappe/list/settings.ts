/**
 * List View Settings (`frappe.desk.listview.get_list_settings`, docs 13 §5.4): READ and honoured here; writing them is a
 * Desk admin concern (it flips `in_list_view` through Property Setters) and is not reproduced.
 */
import type { FrappeClient } from "../client";
import type { ColumnDef } from "../../list/model/columns";
import { fieldOf } from "../../list/model/columns";

export interface ListViewSettings {
  disable_count?: number;
  disable_comment_count?: number;
  disable_sidebar_stats?: number;
  disable_auto_refresh?: number;
  disable_automatic_recency_filters?: number;
  allow_edit?: number;
  total_fields?: number | string;
  /** JSON list of `{ fieldname, label, type }`. */
  fields?: string;
}

/** The settings doc, or `null` (none defined, or the call failed — the list must work without them). */
export async function fetchListSettings(client: FrappeClient, doctype: string): Promise<ListViewSettings | null> {
  try {
    const res = await client.call("frappe.desk.listview.get_list_settings", { doctype });
    const m = res.message;
    return m && typeof m === "object" ? (m as ListViewSettings) : null;
  } catch { return null; }
}

function parseFields(settings: ListViewSettings): string[] {
  try {
    const list = JSON.parse(settings.fields || "[]") as { fieldname?: string }[];
    return Array.isArray(list) ? list.map((f) => f.fieldname ?? "").filter(Boolean) : [];
  } catch { return []; }
}

/**
 * Re-order and cap the DEFAULT columns as Desk does (`list_view.js:436-486`): the title column stays first, then the
 * configured `fields` in their order (the status column is the pseudo field `status_field`), at most `total_fields`
 * visible. Columns outside the list stay offered, hidden. The user's own column choice (prefs) still wins.
 * UNVERIFIED: Desk also caps by window width (4/6/10) when `total_fields` is unset; not reproduced.
 */
export function applyColumnSettings<T>(columns: ColumnDef<T>[], settings: ListViewSettings | null | undefined, titleField: string): ColumnDef<T>[] {
  if (!settings) return columns;
  const wanted = parseFields(settings);
  const total = Number(settings.total_fields) || 0;
  if (!wanted.length && !total) return columns;
  const pseudo = (name: string) => (name === "status_field" ? "__indicator" : name);
  const byField = (name: string) => columns.find((c) => c.key === pseudo(name) || fieldOf(c) === name);
  let visible: ColumnDef<T>[];
  if (wanted.length) {
    const title = columns.find((c) => fieldOf(c) === titleField || c.key === titleField);
    const listed = wanted.map(byField).filter((c): c is ColumnDef<T> => !!c && c !== title);
    visible = [...(title ? [title] : []), ...listed];
  } else visible = columns.filter((c) => !c.hidden);
  if (total) visible = visible.slice(0, total);
  const shown = new Set(visible.map((c) => c.key));
  const rest = columns.filter((c) => !shown.has(c.key));
  return [...visible.map((c) => ({ ...c, hidden: false })), ...rest.map((c) => ({ ...c, hidden: true }))];
}
