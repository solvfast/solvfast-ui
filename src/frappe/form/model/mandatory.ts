/**
 * Client mandatory check (`frappe.ui.form.check_mandatory`, save.js:104-282; docs `11` §5.6, `12` §5.6).
 *
 *  - Skipped for cancelled documents (docstatus 2).
 *  - The parent and every child row are checked against their effective DocFields: a field counts when it has
 *    `reqd`, or a `mandatory_depends_on`, which is evaluated now with `{doc, parent}` (`eval:` or fieldname; `fn:` is
 *    not supported by Desk here and counts as not required).
 *  - Empty = null / undefined / blank string; 0 is a value; a table needs at least one row.
 *  - Hidden and read-only fields are checked too (Desk applies no display filter here).
 *  - A new document whose autoname is Prompt and has no `__newname` misses "Name".
 * Messages (one "Missing Fields" dialog): "{Label} is required." per parent field; per table field, rows collapse into
 * ranges: every row; one row; a list of ranges (≤ 10 ranges); otherwise a count. Exact Desk punctuation: UNVERIFIED.
 * Server mirror: static `reqd` only (MandatoryError); `mandatory_depends_on` is never enforced by the server.
 */
import type { FrappeDoc, FrappeDocField, MetaBundle } from "../../contract";
import { evaluateDepends, isEmptyValue, isTruthy, type DependsValue, type EvaluatorOptions, type FieldOverrides } from "./depends";
import { NO_VALUE_TYPES, TABLE_TYPES } from "./fieldtypes";

export interface MissingField {
  doctype: string;
  fieldname: string;
  label: string;
  /** Child rows: the table field, its label and the row's idx. */
  parentfield?: string;
  tableLabel?: string;
  idx?: number;
}

export type MandatoryLine =
  | { kind: "field"; label: string; fieldname: string }
  | { kind: "every"; table: string; label: string; parentfield: string; fieldname: string }
  | { kind: "rows"; table: string; label: string; parentfield: string; fieldname: string; rows: string; single: boolean }
  | { kind: "count"; table: string; label: string; parentfield: string; fieldname: string; count: number };

export interface MandatoryResult {
  ok: boolean;
  missing: MissingField[];
  lines: MandatoryLine[];
  /** The first offending field (to activate its tab / open its section). */
  first?: MissingField;
}

export interface MandatoryOptions extends EvaluatorOptions {
  /** Script overrides per DocType: `{ [doctype]: { [fieldname]: partial df } }` (`setDfProperty`, `toggleReqd`). */
  overrides?: Record<string, FieldOverrides>;
  /** Label translation (meta `__messages`). */
  translate?: (label: string) => string;
}

function isRequired(df: FrappeDocField, doc: FrappeDoc, parent: FrappeDoc, opts: MandatoryOptions): boolean {
  if (df.mandatory_depends_on) {
    const expr = String(df.mandatory_depends_on);
    if (expr.startsWith("fn:")) return false;
    return isTruthy(evaluateDepends(expr as DependsValue, doc, parent, { ...opts, fnHandlers: undefined }, { doctype: doc.doctype, fieldname: df.fieldname, property: "mandatory_depends_on" }));
  }
  return !!df.reqd;
}

/** Collapse sorted row numbers into "1-3, 5" style ranges. */
export function rowRanges(rows: number[]): string[] {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (sorted[i + 1] === end + 1) end = sorted[++i];
    out.push(start === end ? String(start) : `${start}-${end}`);
  }
  return out;
}

export function checkMandatory(bundle: MetaBundle, doc: FrappeDoc, opts: MandatoryOptions = {}): MandatoryResult {
  if (doc.docstatus === 2) return { ok: true, missing: [], lines: [] };
  const tr = opts.translate ?? ((s: string) => s);
  const labelOf = (df: FrappeDocField) => tr(df.label || df.fieldname);
  const withOverrides = (doctype: string, df: FrappeDocField): FrappeDocField => ({ ...df, ...opts.overrides?.[doctype]?.[df.fieldname] });
  const missing: MissingField[] = [];
  const lines: MandatoryLine[] = [];

  if (doc.__islocal && String(bundle.meta.autoname ?? "").toLowerCase() === "prompt" && isEmptyValue(doc.__newname)) {
    missing.push({ doctype: doc.doctype, fieldname: "__newname", label: "Name" });
    lines.push({ kind: "field", label: "Name", fieldname: "__newname" });
  }
  for (const base of bundle.meta.fields ?? []) {
    if (NO_VALUE_TYPES.has(base.fieldtype)) continue;
    const df = withOverrides(bundle.meta.name, base);
    if (isRequired(df, doc, doc, opts) && isEmptyValue(doc[df.fieldname])) {
      missing.push({ doctype: doc.doctype, fieldname: df.fieldname, label: labelOf(df) });
      lines.push({ kind: "field", label: labelOf(df), fieldname: df.fieldname });
    }
  }
  for (const table of bundle.meta.fields ?? []) {
    if (!TABLE_TYPES.has(table.fieldtype) || !table.options) continue;
    const child = bundle.children[table.options];
    const rows = Array.isArray(doc[table.fieldname]) ? (doc[table.fieldname] as FrappeDoc[]) : [];
    if (!child || !rows.length) continue;
    const perField = new Map<string, { df: FrappeDocField; rows: number[] }>();
    rows.forEach((row, i) => {
      for (const base of child.fields ?? []) {
        if (NO_VALUE_TYPES.has(base.fieldtype)) continue;
        const df = withOverrides(child.name, base);
        if (isRequired(df, row, doc, opts) && isEmptyValue(row[df.fieldname])) {
          const idx = Number(row.idx) || i + 1;
          missing.push({ doctype: child.name, fieldname: df.fieldname, label: labelOf(df), parentfield: table.fieldname, tableLabel: labelOf(table), idx });
          const e = perField.get(df.fieldname) ?? { df, rows: [] };
          e.rows.push(idx);
          perField.set(df.fieldname, e);
        }
      }
    });
    for (const { df, rows: bad } of perField.values()) {
      const base = { table: labelOf(table), label: labelOf(df), parentfield: table.fieldname, fieldname: df.fieldname };
      if (bad.length === rows.length && rows.length > 1) lines.push({ kind: "every", ...base });
      else {
        const ranges = rowRanges(bad);
        if (ranges.length > 10) lines.push({ kind: "count", ...base, count: bad.length });
        else lines.push({ kind: "rows", ...base, rows: ranges.join(", "), single: bad.length === 1 });
      }
    }
  }
  return { ok: missing.length === 0, missing, lines, first: missing[0] };
}
