/**
 * Data Import — the pure parts of Desk's preview, column mapper, warnings and result headline, read from Frappe 15.110:
 *  - `public/js/frappe/data_import/import_preview.js` (preview grid `:48-116`, column mapper `:239-325`,
 *    `get_fields_as_options :334-358`, `is_row_imported :326-331`);
 *  - `public/js/frappe/data_import/data_exporter.js:311-357` (`get_columns_for_picker`);
 *  - `core/doctype/data_import/data_import.js` (`remap_column :302-309`, `show_import_warnings :333-406`,
 *    `show_import_status :127-176`, `render_import_log :412-502`);
 *  - `core/doctype/data_import/importer.py` (`Header` / `Column.parse :813-951`, `get_data_for_import_preview :480-513`,
 *    `build_fields_dict_for_column_matching :1078-1218`).
 *
 * Nothing here decides how a column is imported: the SERVER matches headers to fields (`Column.parse`), applies the
 * saved `column_to_field_map` and answers the preview. These helpers only build the request Desk builds (the map) and
 * lay out what the server answered. No React, no network.
 */
import type { MetaBundle, DocTypeMeta, FrappeDocField } from "../contract";
import { NO_VALUE_TYPES, TABLE_TYPES } from "../form/model";
import type { DataImportStatus, ImportLogRow, ImportPreview, ImportPreviewColumn, ImportType, ImportWarning } from "./import";

/** The mapper's "Don't Import" value — the literal the server tests (`importer.py:884, 926`). Core's. */
export { DONT_IMPORT } from "../../list/io/ImportParts";
import { DONT_IMPORT } from "../../list/io/ImportParts";
import type { GroupedImportWarnings as CoreGroupedImportWarnings, ImportFieldOption as CoreImportFieldOption } from "../../list/io/ImportParts";
/** The preview's first column (`importer.py:483`): the file's row number, never imported. */
export const SR_NO = "Sr. No";
/** Desk shows the import log only below this many log rows, else "Export Import Log" (`data_import.js:519-528`). */
export const IMPORT_LOG_TABLE_LIMIT = 5000;

// ---- labels (Core: list/io/importLabels) ------------------------------------------------------------------------------

export { DATA_IMPORT_LABELS_EN, DATA_IMPORT_LABELS_AR, fmt } from "../../list/io/importLabels";
export type { DataImportLabels } from "../../list/io/importLabels";
import { fmt, type DataImportLabels } from "../../list/io/importLabels";

export function statusLabel(status: DataImportStatus | string | undefined, L: DataImportLabels): string {
  switch (status) {
    case "Success": return L.statusSuccess;
    case "Partial Success": return L.statusPartialSuccess;
    case "Error": return L.statusError;
    case "Timed Out": return L.statusTimedOut;
    default: return L.statusPending;
  }
}

/** Desk's Data Import indicator colours (`data_import_list.js:15-31`): Success green, Error red, the rest orange. */
export function statusTone(status: DataImportStatus | string | undefined): "success" | "destructive" | "warning" {
  return status === "Success" ? "success" : status === "Error" ? "destructive" : "warning";
}

// ---- the column picker (data_exporter.js:311-357 + import_preview.js:334-358) --------------------------------------

export type ImportFieldOption = CoreImportFieldOption;

const truthy = (v: unknown) => !!v && v !== "0";
/** `exportable_fields` (data_exporter.js:314-326): not a no-value type (layout / display / Table), not lft / rgt, not virtual. */
const exportable = (df: FrappeDocField) => !NO_VALUE_TYPES.has(df.fieldtype) && !TABLE_TYPES.has(df.fieldtype) && df.fieldname !== "lft" && df.fieldname !== "rgt" && !truthy(df.is_virtual);
/** Each group starts with `{label: "ID", fieldname: "name"}` — ALWAYS, even with a `field:` autoname (that filter belongs
 *  to the exporter's checkboxes, `data_exporter.js:294-298`, not to `get_columns_for_picker`). */
const pickerFields = (meta: DocTypeMeta): { fieldname: string; label: string }[] => [
  { fieldname: "name", label: "ID" },
  ...(meta.fields ?? []).filter(exportable).map((df) => ({ fieldname: df.fieldname, label: df.label || df.fieldname })),
];

/**
 * The mapper's options, in Desk's order: the DocType's ID and fields, then per table field (`get_table_fields`: Table and
 * Table MultiSelect) the child's ID and fields as `<table fieldname>.<fieldname>` / `Label (Table Label)` — exactly the
 * keys `get_df_for_column_header` resolves (`importer.py:1135-1202`). "Don't Import" is NOT included (the picker adds it first).
 * A table whose child DocType is not in the bundle is skipped (Desk would have its meta loaded).
 */
export function importPickerOptions(bundle: MetaBundle): ImportFieldOption[] {
  const doctype = bundle.meta.name;
  const out: ImportFieldOption[] = pickerFields(bundle.meta).map((f) => ({ value: f.fieldname, label: f.label, description: f.fieldname, doctype }));
  for (const table of (bundle.meta.fields ?? []).filter((df) => TABLE_TYPES.has(df.fieldtype) && df.options)) {
    const child = bundle.children[table.options!];
    if (!child) continue;
    const tableLabel = table.label || table.fieldname;
    for (const f of pickerFields(child)) {
      const value = `${table.fieldname}.${f.fieldname}`;
      out.push({ value, label: `${f.label} (${tableLabel})`, description: value, doctype: child.name });
    }
  }
  return out;
}

/** The value the mapper pre-selects for a preview column (`import_preview.js:246-255`). */
export function columnMappingValue(col: ImportPreviewColumn): string {
  if (!col.df) return DONT_IMPORT;
  if (col.map_to_field) return col.map_to_field;
  if (col.is_child_table_field && col.child_table_df?.fieldname) return `${col.child_table_df.fieldname}.${col.df.fieldname}`;
  return col.df.fieldname || DONT_IMPORT;
}

/**
 * The mapper's `changed_map` (`import_preview.js:310-318`): keyed by the FILE column index — the preview index minus 1,
 * because the preview's column 0 is "Sr. No" (`importer.py:483`); the server reads `column_to_field_map.get(str(j))`
 * with `j` the file column (`importer.py:824-827`). Values of `changes` are keyed by PREVIEW index.
 */
export function changedColumnMap(changes: Record<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [i, value] of Object.entries(changes)) if (Number(i) > 0) out[String(Number(i) - 1)] = value;
  return out;
}

/**
 * `remap_column` (data_import.js:302-307): parse `template_options`, `Object.assign` the changed entries over
 * `column_to_field_map` (earlier entries are kept), stringify. A malformed value starts from `{}` (Desk would throw).
 */
export function mergeColumnToFieldMap(templateOptions: string | null | undefined, changed: Record<string, string>): string {
  let options: Record<string, unknown> = {};
  try { const parsed = JSON.parse(templateOptions || "{}") as unknown; if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) options = parsed as Record<string, unknown>; } catch { options = {}; }
  const current = options.column_to_field_map && typeof options.column_to_field_map === "object" ? (options.column_to_field_map as Record<string, string>) : {};
  options.column_to_field_map = Object.assign({}, current, changed);
  return JSON.stringify(options);
}

// ---- preview layout (import_preview.js:48-131) ----------------------------------------------------------------------

/** strftime → Desk's display (`import_preview.js:90-100`). */
export function displayDateFormat(format: string | null | undefined): string | null {
  if (!format) return null;
  return format.replace("%Y", "yyyy").replace("%y", "yy").replace("%m", "mm").replace("%d", "dd").replace("%H", "HH").replace("%M", "mm").replace("%S", "ss").replace("%b", "Mon");
}

export interface PreviewColumnView {
  /** Index in the server's `columns` (0 = Sr. No). */
  index: number;
  srNo: boolean;
  /** The file's header, or the field label, or null for "Untitled Column". */
  title: string | null;
  skipped: boolean;
  /** The field the SERVER matched / mapped the column to (`df`), with the table label for a child-table field. */
  field: string | null;
  dateFormat: string | null;
}

/** One view per server column: Sr. No, skipped (no `df` or `skip_import`), or matched — as `prepare_columns` decides. */
export function previewColumns(preview: ImportPreview | null | undefined): PreviewColumnView[] {
  return (preview?.columns ?? []).map((col, index) => {
    if (col.header_title === SR_NO && index === 0) return { index, srNo: true, title: SR_NO, skipped: true, field: null, dateFormat: null };
    const df = col.df;
    const table = col.is_child_table_field ? col.child_table_df?.label || col.child_table_df?.fieldname || df?.parent : null;
    const field = df ? (table ? `${df.label || df.fieldname} (${table})` : df.label || df.fieldname || null) : null;
    const title = col.header_title || (col.skip_import ? null : df?.label) || null;
    return { index, srNo: false, title, skipped: !!col.skip_import || !df, field: col.skip_import ? null : field, dateFormat: col.skip_import ? null : displayDateFormat(col.date_format) };
  });
}

/** `prepare_data` (import_preview.js:119-131): null / missing cells are "" (a row may be shorter than the header). */
export function previewCell(row: unknown[], index: number): string {
  const v = row[index];
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** `is_row_imported` (import_preview.js:326-331): the row number (cell 0) is in a SUCCESS log's `row_indexes`. */
export function importedRowNumbers(preview: ImportPreview | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const log of preview?.import_log ?? []) {
    if (!log.success) continue;
    for (const n of parseRowIndexes(log.row_indexes)) out.add(n);
  }
  return out;
}

export function parseRowIndexes(raw: unknown): number[] {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];
}

// ---- warnings (data_import.js:333-406) ------------------------------------------------------------------------------

export type GroupedImportWarnings = CoreGroupedImportWarnings;

/**
 * `show_import_warnings`: the document's `template_warnings` (written by a job that refused to run) followed by the
 * preview's warnings, grouped by row; the others headed by column. `warning.col` is the 1-based column number — a
 * STRING from `Column.parse` (`importer.py:881`), a number from `validate_values` (`:984, 1019`) — and indexes the
 * preview's columns directly because column 0 is Sr. No (`data_import.js:384-390`). A field from another DocType
 * (a child table) gets ` (<parent>)` after its label (`:362-366`). Package difference: exact duplicates (same row, col,
 * message) are shown once — Desk lists a template warning again when the re-read preview repeats it.
 */
export function groupImportWarnings(warnings: ImportWarning[], columns: ImportPreview["columns"], referenceDoctype: string): GroupedImportWarnings {
  const seen = new Set<string>();
  const byRow = new Map<number, GroupedImportWarnings["rows"][number]["items"]>();
  const other: GroupedImportWarnings["other"] = [];
  let total = 0;
  for (const w of warnings) {
    if (!w || typeof w.message !== "string") continue;
    const key = JSON.stringify([w.row ?? null, w.col ?? null, w.message]);
    if (seen.has(key)) continue;
    seen.add(key);
    total++;
    const row = Number(w.row);
    if (w.row && Number.isFinite(row)) {
      const field = w.field ? `${w.field.label ?? w.field.fieldname ?? ""}${w.field.parent && w.field.parent !== referenceDoctype ? ` (${w.field.parent})` : ""}` : null;
      const list = byRow.get(row) ?? [];
      list.push({ field, message: w.message, type: w.type });
      byRow.set(row, list);
    } else {
      const col = w.col !== undefined && w.col !== null && w.col !== "" ? Number(w.col) : NaN;
      const header = columns && Number.isFinite(col) && col ? (columns[col]?.header_title ?? null) : null;
      other.push({ col: Number.isFinite(col) && col ? col : null, header, message: w.message, type: w.type });
    }
  }
  return { rows: [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, items]) => ({ row, items })), other, total };
}

// ---- result (data_import.js:127-176, 412-502) -----------------------------------------------------------------------

/**
 * `show_import_status`'s headline, from the SERVER's counts (`get_import_status`: Data Import Log rows by `success`,
 * `payload_count`). `null` when the server reports no total (Desk shows nothing then). "Timed Out" appends its hint.
 */
export function importResultMessage(o: { status: DataImportStatus | string; success: number; failed: number; total: number; importType: ImportType }, L: DataImportLabels): string | null {
  if (!o.total) return null;
  const insert = o.importType === "Insert New Records";
  let message: string;
  if (o.failed === 0) message = o.success === 1 ? (insert ? L.resultInserted1 : L.resultUpdated1) : fmt(insert ? L.resultInserted : L.resultUpdated, o.success);
  else message = fmt(o.success === 1 ? (insert ? L.resultInsertedPartial1 : L.resultUpdatedPartial1) : insert ? L.resultInsertedPartial : L.resultUpdatedPartial, o.success, o.total);
  return o.status === "Timed Out" ? `${message} ${L.timedOut}` : message;
}

/** A failure log's `messages` (`create_import_log`: `json.dumps(frappe.local.message_log)` — msgprint dicts, `importer.py:190, 1284`). */
export function parseLogMessages(log: Pick<ImportLogRow, "messages">): { title?: string; message: string }[] {
  let v: unknown = log.messages;
  for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return typeof v === "string" && v.trim() ? [{ message: v }] : []; } }
  if (!Array.isArray(v)) return [];
  return v.map((m) => {
    let o: unknown = m;
    if (typeof o === "string") { try { o = JSON.parse(o); } catch { return { message: m as string }; } }
    const r = (o && typeof o === "object" ? o : { message: String(o ?? "") }) as Record<string, unknown>;
    return { ...(typeof r.title === "string" && r.title ? { title: r.title } : {}), message: typeof r.message === "string" ? r.message : r.message == null ? "" : String(r.message) };
  }).filter((m) => m.message || m.title);
}
