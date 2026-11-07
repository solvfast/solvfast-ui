/**
 * Report view rules (pure TS): which cells can be edited inline and the totals row — Desk's report view
 * (frappe/public/js/frappe/views/reports/report_view.js).
 */
import type { DocPermissions, FrappeDocField } from "../contract";

/** Fieldtypes the inline editor handles (Desk edits through the field's own control; this package a plain input). */
export const INLINE_EDIT_TYPES = new Set(["Data", "Small Text", "Text", "Long Text", "Int", "Float", "Currency", "Percent", "Select", "Check", "Date", "Link", "Phone"]);
/** `frappe.model.std_fields_list` + `child_table_fields` (JS/model/model.js) — never edited inline. */
const STD = new Set(["name", "owner", "creation", "modified", "modified_by", "_user_tags", "_comments", "_assign", "_liked_by", "docstatus", "idx", "parent", "parentfield", "parenttype"]);
export const NUMERIC_TYPES = new Set(["Int", "Float", "Currency", "Percent"]);

/**
 * Desk's `is_editable(df, data)` (report_view.js:758-779), first part: write right (`frappe.model.can_write`; here per
 * the field's permlevel), not a submitted document unless `allow_on_submit`, not cancelled, not read-only / virtual /
 * hidden, not a standard field. DIFFERS on purpose from 15.110's trailing clause (:772-777), which makes every field of a
 * DocType WITHOUT a Table field read-only unless it has a `read_only_depends_on` evaluating false — read as a defect, not
 * reproduced: such fields are editable here. A field WITH `read_only_depends_on` is never edited inline here (the
 * expression is not evaluated in the report). Child-table cells are read-only here (the simulator cannot save them).
 */
export function isCellEditable(df: FrappeDocField | undefined, row: { docstatus?: unknown }, levels: DocPermissions | undefined): boolean {
  if (!df || !INLINE_EDIT_TYPES.has(df.fieldtype) || STD.has(df.fieldname)) return false;
  if (!levels?.[df.permlevel ?? 0]?.write) return false;
  const ds = Number(row.docstatus ?? 0);
  if (ds === 2 || (ds === 1 && !df.allow_on_submit)) return false;
  const f = df as FrappeDocField & { is_virtual?: unknown };
  if (f.read_only || f.is_virtual || f.hidden || f.read_only_depends_on) return false;
  return true;
}

/** Desk's totals row (`get_columns_totals`, report_view.js:1523-1549): numeric columns summed over the LOADED rows. */
export function columnTotals(rows: readonly Record<string, unknown>[], fields: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fields) out[f] = rows.reduce((s, r) => { const n = Number(r[f]); return Number.isFinite(n) ? s + n : s; }, 0);
  return out;
}
