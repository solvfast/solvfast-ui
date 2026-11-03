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

// ---- Desk's default column cap (list_view.js:375-457) -------------------------------------------------------------

/**
 * Desk's cap when List View Settings set no `total_fields` (`list_view.js:433-444`, read once in `setup_columns`):
 * `window.innerWidth <= 1366` → 4, `>= 1920` → 10, otherwise 6 (the code comment there says 8; the code says 10).
 * `undefined` (no window: SSR) → 6, Desk's middle value.
 */
export function deskColumnLimit(width: number | undefined): number {
  if (width === undefined || !Number.isFinite(width)) return 6;
  return width <= 1366 ? 4 : width >= 1920 ? 10 : 6;
}

export interface DeskColumnCapOptions {
  /** Slots: List View Settings `total_fields`, else `deskColumnLimit(window width)` (`list_view.js:444`). */
  limit: number;
  /** The Subject column's key (title field, else `name`), always first and always shown. */
  subjectKey: string;
  /** `frappe.has_indicator(doctype)` (`JS/model/indicator.js:3-24`; the package's `hasIndicator`): Desk then counts a Status slot. */
  hasIndicator: boolean;
  /** List View Settings `fields` given: Desk keeps Status only when they list `status_field` (`reorder_listview_fields`, `:460-489`). */
  settingsFields?: string[];
  /** Columns Desk does not draw as columns (assignees, comment count, likes: the row's activity area) — never counted, never changed. */
  uncounted?: string[];
  /** Desk's ID column after the cap (`list_view.js:446-457`): when the DocType's `title_field` is set and is not `name`. */
  nameColumn?: boolean;
}

/** The Tag column's slot: Desk pushes it second (`list_view.js:396-399`) and renders it hidden (`:709`, `:799-809`). */
const TAG_SLOT = "\u0000tag";
const STATUS_PHANTOM = "\u0000status";

/**
 * Cap the DEFAULT columns exactly as Desk counts them (`list_view.js:375-457`). Slots, in order:
 *  1. Subject (title field, else ID) — always kept;
 *  2. Tag — Desk's tag column is in `this.columns` but hidden (`tag-col hide`): it uses a slot and shows nothing, so a
 *     4-slot list shows the Subject + at most 2 more columns;
 *  3. Status — when the DocType has an indicator (and, with List View Settings `fields`, only if they list
 *     `status_field`). The slot goes to the package's indicator column when it is shown; when it is not (`rowMeta`
 *     default / off) the `status` field column — Desk's indicator source, which Desk itself drops when it has an
 *     indicator (`:414-416`) — takes it; otherwise it is an empty slot, as Desk's would be invisible to the package;
 *  4. the other visible columns, in order.
 * `slice(0, limit)` keeps the first `limit` slots (`:444`). The rest are hidden (still offered in the column manager).
 * Afterwards the ID column (`name`) is appended and shown when `nameColumn` (`:446-457`; Desk's JS `hide_name_column`
 * listview setting is not available to a React page — the app turns it off instead). Columns already hidden stay hidden.
 */
export function capDefaultColumns<T>(columns: ColumnDef<T>[], o: DeskColumnCapOptions): ColumnDef<T>[] {
  const uncounted = new Set(o.uncounted ?? []);
  const statusCounted = o.hasIndicator && (!o.settingsFields?.length || o.settingsFields.includes("status_field"));
  const indicator = columns.find((c) => c.key === "__indicator");
  const statusField = columns.find((c) => c.key !== o.subjectKey && fieldOf(c) === "status" && !c.hidden);
  const statusKey = !statusCounted ? undefined : indicator && !indicator.hidden ? indicator.key : statusField ? statusField.key : STATUS_PHANTOM;
  const slots: string[] = [o.subjectKey, TAG_SLOT, ...(statusKey ? [statusKey] : [])];
  for (const c of columns) {
    if (c.hidden || uncounted.has(c.key) || c.key === o.subjectKey || c.key === statusKey) continue;
    if (o.nameColumn && c.key === "name") continue; // the ID column is appended after the cap
    slots.push(c.key);
  }
  const kept = new Set(slots.slice(0, Math.max(1, o.limit)));
  let out = columns.map((c) => {
    if (uncounted.has(c.key) || c.hidden || c.key === o.subjectKey) return c.key === o.subjectKey && c.hidden ? { ...c, hidden: false } : c;
    return kept.has(c.key) ? c : { ...c, hidden: true };
  });
  if (o.nameColumn && o.subjectKey !== "name") {
    const idCol = out.find((c) => c.key === "name");
    if (idCol) {
      // shown, right after the last kept column (Desk pushes it at the end of `this.columns`; the activity area follows)
      out = out.filter((c) => c !== idCol);
      let at = 0;
      out.forEach((c, i) => { if (!c.hidden && !uncounted.has(c.key)) at = i + 1; });
      out.splice(at, 0, { ...idCol, hidden: false });
    }
  }
  return out;
}

/** List View Settings `fields` as fieldnames (`status_field` included), for `capDefaultColumns`. */
export const listedFields = (settings: ListViewSettings | null | undefined): string[] => (settings ? parseFields(settings) : []);
