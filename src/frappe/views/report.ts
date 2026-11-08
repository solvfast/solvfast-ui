/**
 * Report view rules (pure TS): which cells can be edited inline and the totals row — Desk's report view
 * (frappe/public/js/frappe/views/reports/report_view.js, Frappe 15.110).
 *
 * P36 (owner decision): the DEFAULT is what Desk actually does, read from the code paths, not from comments. The
 * verified truth table and its citations are in docs/components/views.md §3.
 */
import type { DocPermissions, DocTypeMeta, FrappeDocField } from "../contract";
import { evaluateDepends, isTruthy, type DependsIssue } from "../form/model/depends";

type Row = Record<string, unknown>;

/**
 * Fieldtypes this package has an inline editor for. NOT part of the editability rule: Desk edits any fieldtype through
 * the field's own control (`render_editing_input`, report_view.js:698-729; Text Editor in a dialog). A cell Desk would
 * edit whose fieldtype is not listed here is shown read-only (no editor available in this package yet).
 */
export const INLINE_EDIT_TYPES = new Set(["Data", "Small Text", "Text", "Long Text", "Int", "Float", "Currency", "Percent", "Select", "Check", "Date", "Link", "Phone"]);
/** `frappe.model.std_fields_list` + `child_table_field_list` (model/model.js:64-78) — `is_non_std_field` is false for them. */
const STD = new Set(["name", "owner", "creation", "modified", "modified_by", "_user_tags", "_comments", "_assign", "_liked_by", "docstatus", "idx", "parent", "parenttype", "parentfield"]);
export const NUMERIC_TYPES = new Set(["Int", "Float", "Currency", "Percent"]);

/** `frappe.model.is_non_std_field(fieldname)` (model/model.js:191-195). */
export const isNonStdField = (fieldname: string) => !STD.has(fieldname);

/**
 * `frappe.model.can_write(doctype)` (model/model.js:382-384) = `frappe.boot.user.can_write`, built by
 * `UserPermissions.build_permissions` (frappe/utils/user.py:108-173) from the PERMLEVEL-0 rows only
 * (`get_perms_for`, permissions.py:540-543): a non-child DocType with `create` (not Single) or `write` at level 0.
 * The field's own permlevel is NOT looked at (the server resets such values silently, document.py:783-806).
 */
export function deskCanWrite(levels: DocPermissions | undefined, meta?: Pick<DocTypeMeta, "issingle"> | null): boolean {
  const l0 = levels?.[0];
  return !!(l0?.write || (l0?.create && !meta?.issingle));
}

/**
 * `evaluate_read_only_depends_on(expression, data)` (report_view.js:731-756) on the LOADED ROW (`data` = the report
 * row: `name`, `docstatus`, the visible columns and `Child:field` keys — not the full document):
 * - a boolean is returned as is;
 * - `eval:<js>` runs with `doc` = the row only (no `parent`); an error is `frappe.throw` in Desk (the row is not built) —
 *   here `error` is set and the caller treats the cell as not editable;
 * - `fn:` needs `this.frm`, which the report view never has, so it falls through to the fieldname form (`data["fn:…"]`);
 * - otherwise a fieldname: `data[expression]`, an array by its length, else its truthiness.
 */
export function evaluateReportReadOnlyDependsOn(expression: unknown, row: Row, onIssue?: (issue: DependsIssue) => void): { value: boolean; error?: string } {
  if (typeof expression === "boolean") return { value: expression };
  let error: string | undefined;
  const raw = evaluateDepends(expression as string, row as never, undefined as never, {
    hasForm: false,
    onIssue: (i) => { error = i.reason; onIssue?.(i); },
  }, { doctype: String(row.doctype ?? ""), fieldname: "", property: "read_only_depends_on" });
  return error ? { value: true, error } : { value: isTruthy(raw) };
}

/**
 * - `"desk"` (default): Desk 15.110 exactly (truth table in docs/components/views.md §3).
 * - `"strict"` (opt-in): Desk's conditions, plus what the SERVER enforces or silently undoes — the write right on the
 *   field's permlevel (else `validate_higher_perm_levels` resets the value without an error, document.py:783-806), the
 *   `write` right itself (Desk's `can_write` also counts `create`), the `submit` right on a submitted document
 *   (`update_after_submit`, document.py:903-906), and `read_only_depends_on` evaluated on every DocType (Desk skips it
 *   when the DocType has a Table field).
 */
export type ReportEditMode = "desk" | "strict";

export interface ReportEditOptions {
  /** The report DocType's fields (Desk `this.meta.fields`): only whether one has fieldtype exactly `"Table"` matters. */
  fields: readonly { fieldtype: string }[];
  /** Rights per permlevel (`usePermissions(bundle).levels`). Desk reads level 0 only (`deskCanWrite`). */
  levels: DocPermissions | undefined;
  /** The report DocType's `issingle` (a Single's `create` does not count as write, user.py:131-137). */
  issingle?: unknown;
  /** A child-table column (`Child:field`): the child row's name from the `Child:name` key. Desk builds such a cell as
   *  `editable: Boolean(name && this.is_editable(df, d))` (report_view.js:1287-1295). */
  child?: { name: unknown };
  /** Default "desk". */
  mode?: ReportEditMode;
  /** A `read_only_depends_on` expression that could not be evaluated (the cell is then not editable). */
  onIssue?: (issue: DependsIssue) => void;
}

/**
 * Desk's `is_editable(df, data)` (report_view.js:758-780) AS DESK APPLIES IT (`build_row`, :1285-1337, read by
 * frappe-datatable 1.20.4 cellmanager.js:442-449, which blocks only on a strict `=== false`):
 *
 * 1. `df`, `frappe.model.can_write(this.doctype)` (level 0), not submitted unless `allow_on_submit`, not cancelled, not
 *    `read_only` / `is_virtual` / `hidden`, `is_non_std_field` — otherwise `false` → not editable.
 * 2. Then it returns `hasTable || (df.read_only_depends_on && !evaluate(...))`:
 *    - the DocType has a `Table` field → `true` (read_only_depends_on is NOT evaluated);
 *    - no Table field, no read_only_depends_on → the falsy `df.read_only_depends_on` itself (`undefined` / `null` /
 *      `""`), which is NOT `=== false`, so the datatable lets the cell be edited (normalised to `true` here);
 *    - no Table field, read_only_depends_on → editable exactly when it evaluates falsy on the row.
 * 3. Child-table cells: `Boolean(name && is_editable(...))` — the falsy pass-through of 2 becomes `false`, and a row
 *    without a child row (no `Child:name`) is never editable.
 *
 * `fieldtype` is not part of the rule (see `INLINE_EDIT_TYPES`).
 */
export function isCellEditable(df: FrappeDocField | undefined, row: Row, opts: ReportEditOptions): boolean {
  if (!df) return false;
  const strict = opts.mode === "strict";
  const f = df as FrappeDocField & { is_virtual?: unknown };
  const ds = Number(row.docstatus ?? 0);
  const base = deskCanWrite(opts.levels, { issingle: opts.issingle as never })
    && (ds !== 1 || !!f.allow_on_submit)
    && ds !== 2
    && !f.read_only && !f.is_virtual && !f.hidden
    && isNonStdField(f.fieldname);
  if (!base) return false;
  if (strict) {
    if (!opts.levels?.[0]?.write || !opts.levels?.[f.permlevel ?? 0]?.write) return false;
    if (ds === 1 && !opts.levels?.[0]?.submit) return false;
  }
  const hasTable = opts.fields.some((x) => x.fieldtype === "Table");
  const rodo = f.read_only_depends_on;
  let verdict: boolean;
  if (rodo && (strict || !hasTable)) {
    const r = evaluateReportReadOnlyDependsOn(rodo, row, opts.onIssue);
    verdict = !r.error && !r.value;
  } else if (hasTable) {
    verdict = true;
  } else {
    // no Table field, no read_only_depends_on: Desk returns the falsy expression value — editable for a parent cell
    // (datatable's `=== false`), not for a child cell (`Boolean(...)`)
    verdict = !opts.child;
  }
  if (opts.child) return verdict && !!opts.child.name;
  return verdict;
}

/** Desk's totals row (`get_columns_totals`, report_view.js:1523-1549): numeric columns summed over the LOADED rows. */
export function columnTotals(rows: readonly Record<string, unknown>[], fields: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fields) out[f] = rows.reduce((s, r) => { const n = Number(r[f]); return Number.isFinite(n) ? s + n : s; }, 0);
  return out;
}

/**
 * The loaded row refreshed from the document `frappe.client.set_value` answered (Desk `get_editing_object` → `setValue`,
 * report_view.js:633-671): every plain key the document carries; every `Child:field` key from the child row whose
 * name is the row's `Child:name`. Desk refreshes only the first row of that document; here every loaded row of it.
 */
export function rowFromSavedDoc(row: Row, doc: Row): Row {
  if (String(row.name) !== String(doc.name)) return row;
  const next: Row = { ...row };
  for (const key of Object.keys(row)) {
    if (key.includes(":")) {
      const [cdt, field] = key.split(":");
      if (field === "name") continue;
      const childName = row[`${cdt}:name`];
      for (const v of Object.values(doc)) {
        if (!Array.isArray(v)) continue;
        const hit = (v as Row[]).find((c) => c && c.doctype === cdt && c.name === childName);
        if (hit) { next[key] = hit[field]; break; }
      }
    } else if (key in doc) next[key] = doc[key];
  }
  return next;
}
