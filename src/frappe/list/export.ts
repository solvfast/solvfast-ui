/**
 * Export — Desk's Data Exporter (`public/js/frappe/data_import/data_exporter.js`) as functions. The FILE ALWAYS COMES
 * FROM THE SERVER: `download_template` (`core/doctype/data_import/data_import.py:178-202`) builds the CSV / XLSX from the
 * exportable fields, checks `read` and — when data is exported — `can_export` per row owner (`exporter.py:116-126`),
 * and streams it (`build_csv_response` / `build_xlsx_response`). Nothing here produces a file from client-side rows.
 *
 * Desk sends the request as a hidden POST form (`utils/urllib.js:48-73` `open_url_post`: every non-string value is
 * `JSON.stringify`-ed); the package POSTs the same fields through `api.download`, objects JSON-encoded the same way
 * (`frappe.parse_json` on the server accepts both, data_import.py:190-191).
 */
import type { DownloadedFile, FrappeApi } from "../client";
import type { DocPermissions, DocTypeMeta, FrappeDocField, MetaBundle } from "../contract";
import { NO_VALUE_TYPES, TABLE_TYPES } from "../form/model";
import type { FrappeFilter } from "../query";
import { readableFields } from "../services/permissions";

export const DOWNLOAD_TEMPLATE_METHOD = "frappe.core.doctype.data_import.data_import.download_template";

export type ExportFileType = "CSV" | "Excel";
/** `export_records` (data_exporter.js:27-44; data_import.py:192, 200). */
export type ExportRecords = "all" | "by_filter" | "5_records" | "blank_template";
/** Data Import's `import_type`; the Exporter's defaults depend on it (data_exporter.js:45-46, 145-148, 279-290). */
export type ImportType = "Insert New Records" | "Update Existing Records";

export interface ExportTemplateOptions {
  doctype: string;
  fileType: ExportFileType;
  exportRecords: ExportRecords;
  /**
   * Fields per key: the DocType's own fields under its NAME, a child table's fields under the parent's TABLE FIELDNAME
   * (not the child DocType — `exporter.py:58-67`, `data_exporter.js:84, 346`). `"name"` asks for the ID column.
   */
  exportFields: Record<string, string[]>;
  /** Only sent for `by_filter` (data_exporter.js:120-123); Desk sends 4-tuples `[doctype, field, op, value]`. */
  exportFilters?: FrappeFilter[] | null;
}

/** `download_template`, with exactly the fields Desk's dialog posts (data_exporter.js:125-131). Throws FrappeError on refusal. */
export function downloadExportTemplate(api: Pick<FrappeApi, "download">, o: ExportTemplateOptions): Promise<DownloadedFile> {
  return api.download(DOWNLOAD_TEMPLATE_METHOD, {
    doctype: o.doctype,
    file_type: o.fileType,
    export_records: o.exportRecords,
    export_fields: JSON.stringify(o.exportFields),
    export_filters: o.exportRecords === "by_filter" && o.exportFilters ? JSON.stringify(o.exportFilters) : null,
  });
}

/** The filter the list's Actions → Export adds for the checked rows (`bulk_operations.js:463-474`), sliced to 4 as `get_filters` does. */
export const selectedNamesFilter = (doctype: string, names: string[]): FrappeFilter[] => [[doctype, "name", "in", names]];

// ---- The field picker (data_exporter.js:265-357 `get_multicheck_options` / `get_columns_for_picker`) ----------------

export interface ExportPickerField {
  fieldname: string;
  label: string;
  fieldtype: string;
  /** DocField `reqd`. */
  reqd: boolean;
  /** Desk's `danger`: pre-selected by "Select Mandatory" — `reqd` when inserting, the `autoname: field:` field, the ID. */
  mandatory: boolean;
}
export interface ExportPickerGroup {
  /** The key to send in `exportFields`: the DocType name, or the table fieldname for a child table. */
  key: string;
  doctype: string;
  label: string;
  /** Child table marked `reqd` ("1 row mandatory"). */
  reqd: boolean;
  fields: ExportPickerField[];
}

/** `frappe.model.no_value_type` (model.js:49-60): what the picker and the server's `is_exportable` (exporter.py:90-91) skip. */
const NOT_EXPORTABLE = new Set([...NO_VALUE_TYPES, ...TABLE_TYPES]);
const truthy = (v: unknown) => !!v && v !== "0";

function pickerFields(meta: DocTypeMeta, importType: ImportType, levels: DocPermissions | undefined): ExportPickerField[] {
  const autoname = typeof meta.autoname === "string" && meta.autoname.startsWith("field:") ? meta.autoname.slice("field:".length) : null;
  // the DocType's fields: not layout / display / table, not lft / rgt, not virtual (data_exporter.js:314-326); and, the
  // package's addition, only fields at a permlevel the user may read (the server strips the others — `readableFields`)
  let fields: FrappeDocField[] = (meta.fields ?? []).filter((df) => !NOT_EXPORTABLE.has(df.fieldtype) && df.fieldname !== "lft" && df.fieldname !== "rgt" && !truthy(df.is_virtual));
  if (levels?.[0]?.read) fields = readableFields(fields, levels); // same guard as `restrictMetaToReadable`: rights known and level 0 readable
  const mandatory = (df: Pick<FrappeDocField, "fieldname" | "reqd">) =>
    (truthy(df.reqd) && importType === "Insert New Records") || df.fieldname === autoname || df.fieldname === "name";
  const id: ExportPickerField[] = autoname ? [] : [{ fieldname: "name", label: "ID", fieldtype: "Data", reqd: true, mandatory: true }];
  return [...id, ...fields.map((df) => ({ fieldname: df.fieldname, label: df.label || df.fieldname, fieldtype: df.fieldtype, reqd: truthy(df.reqd), mandatory: mandatory(df) }))];
}

/**
 * The groups of the Export dialog: the DocType, then one per table field (`frappe.meta.get_table_fields`) that has a
 * child meta in the bundle. `levels` (the user's rights per permlevel) restricts every group to readable fields; without
 * them (roles unknown) every exportable field is offered, as Desk does — the server still strips unreadable ones.
 */
export function exportPickerGroups(bundle: MetaBundle, o: { importType?: ImportType; levels?: DocPermissions } = {}): ExportPickerGroup[] {
  const importType = o.importType ?? "Insert New Records";
  const parent: ExportPickerGroup = { key: bundle.meta.name, doctype: bundle.meta.name, label: bundle.meta.name, reqd: true, fields: pickerFields(bundle.meta, importType, o.levels) };
  const children = (bundle.meta.fields ?? []).filter((df) => TABLE_TYPES.has(df.fieldtype) && df.options && bundle.children[df.options]).map((df) => {
    const child = bundle.children[df.options!];
    return { key: df.fieldname, doctype: child.name, label: `${df.label || df.fieldname} (${child.name})`, reqd: truthy(df.reqd), fields: pickerFields(child, importType, o.levels) };
  });
  return [parent, ...children];
}

/** Desk's "Select Mandatory" (data_exporter.js:175-198): the `danger` fields of the DocType and of its `reqd` child tables. */
export function mandatorySelection(groups: ExportPickerGroup[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of groups) if (g.reqd) out[g.key] = g.fields.filter((f) => f.mandatory).map((f) => f.fieldname);
  return out;
}

/**
 * Hand a downloaded file to the browser (object URL + a click). Returns false where that is impossible (jsdom, no
 * `URL.createObjectURL`); the caller then keeps the blob. Never builds a file: only saves what the server sent.
 */
export function saveFile(file: DownloadedFile, doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  const u = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void } }).URL;
  if (!doc || !u?.createObjectURL) return false;
  const url = u.createObjectURL(file.blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  setTimeout(() => u.revokeObjectURL?.(url), 0);
  return true;
}
