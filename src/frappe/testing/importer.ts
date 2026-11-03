/**
 * The Data Import tool's server side, SIMULATED for the fixture transport: CSV parsing, the column → field matching of
 * `build_fields_dict_for_column_matching` (core/doctype/data_import/importer.py:1078-1218), the preview of
 * `ImportFile.get_data_for_import_preview` (:480-513) with `template_options.column_to_field_map` (Header :814-830,
 * Column.parse :879-948), and the rows the job would import. Only CSV is parsed (no XLSX reader in the browser
 * simulator: such a file is refused with a message labelled SIMULATED). Nothing here writes documents — the transport
 * decides (dry run by default).
 */
import type { DocTypeMeta, FrappeDocField } from "../contract";

type Row = Record<string, unknown>;
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Table", "Table MultiSelect", "Button", "Image", "Fold", "Heading"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
/** `INVALID_VALUES` (importer.py): an empty row is skipped. */
const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
export const MAX_ROWS_IN_PREVIEW = 10; // importer.py:23

/** RFC 4180 CSV (quotes, doubled quotes, CR/LF), as `read_csv_content` reads the template. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export interface MatchedField { df: FrappeDocField & { parent: string }; childTable?: FrappeDocField }

/** `build_fields_dict_for_column_matching` (importer.py:1078-1218): header text → field (labels, fieldnames, "ID", child "Label (Table)" / "table.field"). */
export function columnMatcher(doctype: string, metaOf: (dt: string) => DocTypeMeta | undefined): Map<string, MatchedField> {
  const parent = metaOf(doctype);
  const out = new Map<string, MatchedField>();
  if (!parent) return out;
  const tables = parent.fields.filter((f) => TABLES.has(f.fieldtype) && f.options);
  const groups: [DocTypeMeta | undefined, FrappeDocField | undefined][] = [[parent, undefined], ...tables.map((t) => [metaOf(t.options!), t] as [DocTypeMeta | undefined, FrappeDocField])];
  for (const [meta, table] of groups) {
    if (!meta) continue;
    const ref = table ? table.label || table.fieldname : undefined;
    const nameDf = { fieldtype: "Data", fieldname: "name", label: "ID", reqd: 1, parent: meta.name } as FrappeDocField & { parent: string };
    for (const h of table ? [`${table.fieldname}.name`, `ID (${ref})`] : ["name", "ID"]) out.set(h, { df: nameDf, childTable: table });
    const standard: FrappeDocField[] = table ? [] : [{ fieldname: "owner", label: "Owner", fieldtype: "Data" }, { fieldname: "docstatus", label: "Document Status", fieldtype: "Int" }];
    for (const f of [...standard, ...meta.fields]) {
      if (NO_VALUE.has(f.fieldtype || "Data")) continue;
      const label = String(f.label ?? "").trim();
      const df = { ...f, parent: meta.name };
      if (!table) {
        if (label && !out.has(label)) out.set(label, { df });
        out.set(f.fieldname, { df });
        out.set(`${label} (${f.fieldname})`, { df });
      } else {
        for (const h of [`${table.fieldname}.${f.fieldname}`, `${label} (${ref})`]) out.set(h, { df, childTable: table });
      }
    }
  }
  const auto = String(parent.autoname ?? "");
  if (auto.startsWith("field:")) {
    const af = parent.fields.find((f) => f.fieldname === auto.slice(6).trim());
    if (af) for (const h of [`ID (${af.label})`, "ID", "name"]) out.set(h, { df: { ...af, parent: parent.name } });
  }
  return out;
}

export interface PreviewColumn {
  header_title: string | null;
  skip_import: boolean;
  map_to_field?: string | null;
  index?: number;
  column_number?: number;
  df?: Row | null;
  is_child_table_field?: boolean;
  child_table_df?: Row | null;
  warnings?: Row[];
}
export interface ParsedTemplate { columns: PreviewColumn[]; data: string[][]; rowNumbers: number[]; warnings: Row[] }

/** Header + rows (`parse_data_from_template` :455-478) with the column map; throws the template error messages. */
export function parseTemplate(doctype: string, rawRows: string[][], columnToFieldMap: Record<string, string>, metaOf: (dt: string) => DocTypeMeta | undefined): ParsedTemplate {
  const match = columnMatcher(doctype, metaOf);
  let header: string[] | undefined;
  const data: string[][] = [];
  const rowNumbers: number[] = [];
  rawRows.forEach((r, i) => {
    if (r.every(blank)) return;
    if (!header) header = r;
    else { data.push(r); rowNumbers.push(i + 1); }
  });
  if (!header || !data.length) throw new Error("Import template should contain a Header and atleast one row.");
  const seen: string[] = [];
  const warnings: Row[] = [];
  const bold = (s: string) => `<strong>${s.replace(/[<>&]/g, "")}</strong>`;
  const columns: PreviewColumn[] = header.map((title, j) => {
    const mapTo = columnToFieldMap[String(j)];
    const w: Row[] = [];
    let m: MatchedField | undefined;
    if (mapTo && mapTo !== "Don't Import") {
      m = match.get(mapTo);
      w.push(m ? { message: `Mapping column ${bold(title || "<i>Untitled Column</i>")} to field ${bold(String(m.df.label ?? m.df.fieldname))}`, type: "info" } : { message: `Could not map column ${j + 1} to field ${mapTo}`, type: "info" });
    } else m = match.get(title);
    let skip = !m;
    if (seen.includes(title)) { w.push({ col: j + 1, message: `Skipping Duplicate Column ${bold(title)}`, type: "info" }); m = undefined; skip = true; }
    else if (mapTo === "Don't Import") { skip = true; w.push({ col: j + 1, message: `Skipping column ${bold(title)}`, type: "info" }); }
    else if (title && !m) w.push({ col: j + 1, message: `Cannot match column ${bold(title)} with any field`, type: "info" });
    else if (!title && !m) w.push({ col: j + 1, message: "Skipping Untitled Column", type: "info" });
    seen.push(title);
    warnings.push(...w);
    const df = m ? { fieldtype: m.df.fieldtype, fieldname: m.df.fieldname, label: m.df.label ?? null, options: m.df.options ?? null, parent: m.df.parent, reqd: m.df.reqd ? 1 : 0, default: m.df.default ?? null, read_only: m.df.read_only ? 1 : 0 } : null;
    return { header_title: title, skip_import: skip, map_to_field: mapTo ?? null, index: j, column_number: j + 1, df, is_child_table_field: !!m?.childTable, child_table_df: m?.childTable ? { fieldname: m.childTable.fieldname, label: m.childTable.label ?? null, options: m.childTable.options ?? null } : null, warnings: w };
  });
  return { columns, data, rowNumbers, warnings };
}

/** The preview answer (`get_data_for_import_preview` :480-513): "Sr. No" first, rows `[row_number, ...cells]`, first 10. */
export function previewOf(t: ParsedTemplate, importLog: Row[]): Row {
  const data = t.data.map((r, i) => [t.rowNumbers[i], ...r]);
  const out: Row = { columns: [{ header_title: "Sr. No", skip_import: true }, ...t.columns], data: data.slice(0, MAX_ROWS_IN_PREVIEW), warnings: t.warnings, import_log: importLog };
  if (data.length > MAX_ROWS_IN_PREVIEW) Object.assign(out, { max_rows_exceeded: true, max_rows_in_preview: MAX_ROWS_IN_PREVIEW, total_number_of_rows: data.length });
  return out;
}

/** The parent-level values of each data row (child-table columns are not simulated as rows). */
export function payloadsOf(t: ParsedTemplate, doctype: string): { rowNumber: number; values: Row }[] {
  return t.data.map((r, i) => {
    const values: Row = {};
    t.columns.forEach((c, j) => {
      const df = c.df as { fieldname?: string; parent?: string; fieldtype?: string } | null;
      if (c.skip_import || !df?.fieldname || df.parent !== doctype || c.is_child_table_field) return;
      const v = r[j];
      if (blank(v)) return;
      values[df.fieldname] = df.fieldtype === "Check" ? (/^(1|true|yes)$/i.test(String(v).trim()) ? 1 : 0) : ["Int", "Float", "Currency", "Percent"].includes(String(df.fieldtype)) ? Number(String(v).replace(/,/g, "")) : String(v);
    });
    return { rowNumber: t.rowNumbers[i], values };
  });
}
