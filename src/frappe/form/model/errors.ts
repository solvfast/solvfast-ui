/**
 * Server save errors → the fields they are about (P35, Form audit A43 / gap 5). Frappe 15.110 sources:
 *  - MandatoryError (model/document.py:950-967): one msgprint per missing field, from base_document.py
 *    `_get_missing_mandatory_fields` (:738-776) — parent: "Error: Value missing for {doctype}: {label}" (:758);
 *    child row: "Error: <b>{child doctype}</b> Row #{idx}: Value missing for: {label}" (:747-756); table:
 *    "Error: Data missing in table: {label}" (:742-744). The exception text is "[{doctype}, {name}]: {fieldname, …}"
 *    (:963-966) — the field NAMES, used first when the response carries it (`exception`, sites with tracebacks).
 *  - LinkValidationError (document.py:970-982): "Could not find {items}" with items "{label}: {value}" for the parent
 *    and "Row #{idx}: {label}: {value}" for child rows (base_document.py:790-795), joined by ", ".
 * Labels arrive translated by the server; both the raw and the translated label are matched. A child-row error is put
 * on its Table field. Anything that cannot be attributed stays in the form's error box only.
 */
import type { DocTypeMeta, FrappeDocField, MetaBundle } from "../../contract";
import { TABLE_TYPES } from "./fieldtypes";

/** What `fieldErrorsFromFrappeError` reads from a FrappeError (structural: no import of the client). */
export interface FieldErrorSource {
  excType?: string;
  message?: string;
  exception?: string;
  messages?: { message: string }[];
}

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** fieldname → message for the fields a MandatoryError / LinkValidationError names. Empty for any other error. */
export function fieldErrorsFromFrappeError(err: unknown, bundle: MetaBundle, translate: (label: string) => string = (l) => l): Record<string, string> {
  const e = (err ?? {}) as FieldErrorSource;
  const out: Record<string, string> = {};
  if (e.excType !== "MandatoryError" && e.excType !== "LinkValidationError") return out;
  const meta = bundle.meta;
  const labelsOf = (df: FrappeDocField) => [...new Set([df.label, df.label ? translate(df.label) : undefined, df.fieldname].filter((x): x is string => !!x))];
  const tableOf = (child: string) => (meta.fields ?? []).find((f) => TABLE_TYPES.has(f.fieldtype) && f.options === child);
  const childMetas = Object.values(bundle.children ?? {});
  const texts = (e.messages ?? []).map((m) => plain(m.message)).filter(Boolean);
  if (!texts.length && e.message) texts.push(plain(e.message));
  const put = (fieldname: string, msg: string) => { if (!out[fieldname]) out[fieldname] = msg.replace(/^Error:\s*/, ""); };

  if (e.excType === "MandatoryError") {
    // 1. field names from the exception text "[DocType, name]: a, b"
    const names = /\]:\s*(.+)$/.exec(e.exception ?? "")?.[1]?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
    for (const n of names) {
      const df = meta.fields?.find((f) => f.fieldname === n);
      if (df) { put(n, texts.find((t) => labelsOf(df).some((l) => t.endsWith(`: ${l}`))) ?? `Value missing for ${meta.name}: ${df.label ?? n}`); continue; }
      const child = childMetas.find((c) => c.fields?.some((f) => f.fieldname === n));
      const table = child && tableOf(child.name);
      if (table) put(table.fieldname, texts.find((t) => /Row #\d+/.test(t)) ?? `Value missing for: ${n}`);
    }
    // 2. the messages: parent "Value missing for {doctype}: {label}", table "Data missing in table: {label}", rows
    for (const t of texts) {
      const row = /^(?:Error:\s*)?(.+?)\s+Row #\d+:\s*Value missing for:\s*(.+)$/.exec(t);
      if (row) {
        const child = childMetas.find((c) => c.name === row[1] || translate(c.name) === row[1]);
        const table = child && tableOf(child.name);
        if (table) put(table.fieldname, t);
        continue;
      }
      const tbl = /Data missing in table:\s*(.+)$/.exec(t);
      if (tbl) { const df = findByLabel(meta, tbl[1], labelsOf, (f) => TABLE_TYPES.has(f.fieldtype)); if (df) put(df.fieldname, t); continue; }
      const parent = /Value missing for\s+(.+?):\s*(.+)$/.exec(t);
      if (parent) { const df = findByLabel(meta, parent[2], labelsOf); if (df) put(df.fieldname, t); }
    }
    return out;
  }

  // LinkValidationError: "Could not find A: x, Row #2: B: y" — match every Link label of the parent and children
  for (const t of texts) {
    const body = /Could not find\s+(.+)$/.exec(t)?.[1];
    if (!body) continue;
    for (const df of meta.fields ?? []) {
      if (df.fieldtype !== "Link" && df.fieldtype !== "Dynamic Link") continue;
      const hit = labelsOf(df).map((l) => new RegExp(`(?:^|, )(${esc(l)}: [^,]+)`).exec(body)).find(Boolean);
      if (hit) put(df.fieldname, `Could not find ${hit[1]}`);
    }
    for (const c of childMetas) {
      const table = tableOf(c.name);
      if (!table) continue;
      for (const df of c.fields ?? []) {
        if (df.fieldtype !== "Link" && df.fieldtype !== "Dynamic Link") continue;
        const hit = labelsOf(df).map((l) => new RegExp(`(Row #\\d+: ${esc(l)}: [^,]+)`).exec(body)).find(Boolean);
        if (hit) put(table.fieldname, `Could not find ${hit[1]}`);
      }
    }
  }
  return out;
}

function findByLabel(meta: DocTypeMeta, label: string, labelsOf: (df: FrappeDocField) => string[], pred: (f: FrappeDocField) => boolean = () => true): FrappeDocField | undefined {
  const l = label.trim();
  return (meta.fields ?? []).find((f) => pred(f) && labelsOf(f).includes(l));
}
