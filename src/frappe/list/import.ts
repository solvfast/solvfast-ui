/**
 * Import — the Data Import tool's client sequence (`core/doctype/data_import/data_import.js`) as functions, against the
 * same server methods. Nothing is imported on the client: a `Data Import` document is created and started, and the
 * server's background job (`data_import.py:107-128, 159-175`) inserts / updates the records.
 *
 * Desk's exact sequence for a new import, reproduced by `startDataImport`:
 *  1. Save the new `Data Import` (reference_doctype, import_type …) — `frappe.desk.form.save.savedocs` (frm.save; the
 *     server validates `allow_import` and the user's `import` right: `data_import.py:59-75`).
 *  2. Attach the file to it — `upload_file` with `doctype: "Data Import"`, `docname`, `fieldname: "import_file"`,
 *     `is_private: 1` (`handler.py:175-260`; write on the Data Import is checked, `:220`).
 *  3. Save AGAIN with `import_file = file_url` (the Attach control: `form/controls/attach.js:137-144`); `validate` now
 *     parses the template (`data_import.py:77-91`): "Invalid template file for import" is a SAVE error.
 *  4. `get_preview_from_template(data_import, import_file)` (`data_import.js:265-281`; server `:143-149`, read).
 *  5. "Start Import" → `form_start_import(data_import)` (`data_import.js:202-212`; server `:152-156`, write) → the job is
 *     enqueued (`True`), or already running (`False`); outside developer mode an inactive scheduler is an error (`:110-112`).
 *  6. Progress by realtime `data_import_progress` (to the user, `importer.py:136-145, 161-170`) and `data_import_refresh`
 *     (site-wide, `data_import.py:175`); then `get_import_status` / `get_import_logs` (`data_import.js:127-176, 412-502`).
 *     Non-info template warnings stop the job BEFORE importing and are stored in `template_warnings` (`importer.py:81-90`).
 *  7. "Export Errored Rows" → `download_errored_template` (`data_import.js:315-322`; server `:205-209`).
 *
 * Phase 27: the steps are also separate (`createDataImport`, `attachImportFile` — re-attach to the SAME document after
 * a refused file), the column mapper's save (`remapImportColumns`, `data_import.js:302-309`) and a stricter
 * `importRunning` rule for the poller (mid-run "Partial Success", Retry). The UI over them: `FrappeDataImport`.
 *
 * Server fact worth knowing: the `Data Import` DocType itself grants `create` to System Manager only (data_import.json
 * permissions), so a user with `import` on the DocType but without that role is refused at step 1 (403) — Desk shows
 * them the Import entry anyway (`list_view.js:1703-1712`), and so does the package (`canImport`).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DownloadedFile, FrappeApi } from "../client";
import type { FrappeDoc } from "../contract";
import { newLocalName } from "../form/model";
import { downloadExportTemplate, type ExportFileType, type ImportType } from "./export";
import { mergeColumnToFieldMap } from "./importMapping";

export type { ImportType } from "./export";

const M = "frappe.core.doctype.data_import.data_import";
export const DATA_IMPORT_METHODS = {
  save: "frappe.desk.form.save.savedocs",
  upload: "upload_file",
  preview: `${M}.get_preview_from_template`,
  start: `${M}.form_start_import`,
  status: `${M}.get_import_status`,
  logs: `${M}.get_import_logs`,
  erroredRows: `${M}.download_errored_template`,
  importLog: `${M}.download_import_log`,
} as const;

export type DataImportStatus = "Pending" | "Success" | "Partial Success" | "Error" | "Timed Out";

/** The `Data Import` document as `getdoc` / `savedocs` return it (fields of data_import.json). */
export interface DataImportDoc extends FrappeDoc {
  reference_doctype: string;
  import_type: ImportType;
  import_file?: string | null;
  status?: DataImportStatus;
  submit_after_import?: 0 | 1;
  mute_emails?: 0 | 1;
  /** JSON (`[{row?, col?, field?, message, type?}]`) written by the job when the template cannot be imported (importer.py:88). */
  template_warnings?: string | null;
  template_options?: string | null;
  payload_count?: number;
}

/**
 * One column of the preview (`Column.as_dict`, importer.py:1061-1075; `df` reduced to these keys at `:485-497`). Column 0
 * is `{header_title: "Sr. No", skip_import: true}` (`:483`); `child_table_df` is the parent's table DocField.
 */
export interface ImportPreviewColumn {
  header_title?: string | null;
  skip_import?: boolean | null;
  map_to_field?: string | null;
  index?: number;
  column_number?: number;
  date_format?: string | null;
  df?: { fieldtype?: string; fieldname: string; label?: string | null; options?: string | null; parent?: string; reqd?: 0 | 1; default?: unknown; read_only?: 0 | 1 } | null;
  is_child_table_field?: boolean | null;
  child_table_df?: { fieldname: string; label?: string | null; options?: string | null; [k: string]: unknown } | null;
  warnings?: ImportWarning[];
  [k: string]: unknown;
}

/**
 * `get_data_for_import_preview` (importer.py:51-62; ImportFile `:480-513`): columns, the first `MAX_ROWS_IN_PREVIEW` (10)
 * rows — each `[row_number, ...cells]` — warnings, the last 10 import-log rows; `max_rows_exceeded` +
 * `max_rows_in_preview` + `total_number_of_rows` when the file has more rows.
 */
export interface ImportPreview {
  columns?: ImportPreviewColumn[];
  data?: unknown[][];
  warnings?: ImportWarning[];
  import_log?: { row_indexes: string; success: 0 | 1 }[];
  max_rows_exceeded?: boolean;
  max_rows_in_preview?: number;
  total_number_of_rows?: number;
  [k: string]: unknown;
}
export interface ImportWarning { row?: number; col?: number | string; field?: { label?: string; parent?: string; fieldname?: string }; message: string; type?: string }

export interface StartDataImportOptions {
  referenceDoctype: string;
  importType: ImportType;
  file: Blob;
  filename: string;
  /** Submittable DocTypes only (data_import.js:227-236). */
  submitAfterImport?: boolean;
  /** Data Import's default is 1 (data_import.json). */
  muteEmails?: boolean;
  /** `false`: stop after the preview (steps 1–4), e.g. to show warnings first; `startImport(api, name)` finishes later. Default true. */
  start?: boolean;
}

export interface StartedDataImport {
  /** The Data Import document's name — poll it with `useImportStatus` / `getImportStatus`. */
  name: string;
  doc: DataImportDoc;
  preview: ImportPreview | null;
  /** `form_start_import`'s answer: true = enqueued now, false = a job for it is already queued; null when `start: false`. */
  started: boolean | null;
}

type Api = Pick<FrappeApi, "call" | "saveDoc" | "uploadFile">;

/** Steps 1–5 above, in Desk's order. Any refusal (403 on save, invalid template on the second save …) throws the FrappeError untouched. */
export async function startDataImport(api: Api, o: StartDataImportOptions): Promise<StartedDataImport> {
  const saved = await createDataImport(api, o);
  const withFile = await attachImportFile(api, saved, o.file, o.filename);
  const preview = await getImportPreview(api, withFile.name, withFile.import_file ?? undefined);
  const started = o.start === false ? null : await startImport(api, withFile.name);
  return { name: withFile.name, doc: withFile, preview, started };
}

/** Step 1: save a new `Data Import` (frm.save → savedocs). A 403 here is the expected refusal for a user without `create` on Data Import. */
export async function createDataImport(api: Pick<FrappeApi, "saveDoc">, o: Pick<StartDataImportOptions, "referenceDoctype" | "importType" | "submitAfterImport" | "muteEmails">): Promise<DataImportDoc> {
  const draft: DataImportDoc = {
    doctype: "Data Import", name: newLocalName("Data Import"), __islocal: 1, __unsaved: 1, docstatus: 0,
    reference_doctype: o.referenceDoctype, import_type: o.importType, status: "Pending",
    submit_after_import: o.submitAfterImport ? 1 : 0, mute_emails: o.muteEmails === false ? 0 : 1,
  };
  return (await api.saveDoc(draft, "Save")) as DataImportDoc;
}

/**
 * Steps 2–3 on a SAVED Data Import: `upload_file` attached to it (private), then save it with `import_file = file_url`
 * (the server parses the file in `validate`: "Invalid template file for import", "Import template should contain a
 * Header and atleast one row." are errors of THIS save). Call it again on the same document with another file after a
 * refusal — Desk's Attach control does the same on the same form; the server clears `template_options` /
 * `template_warnings` when `import_file` changes (`data_import.py:44-52`).
 */
export async function attachImportFile(api: Pick<FrappeApi, "saveDoc" | "uploadFile">, doc: DataImportDoc, file: Blob, filename: string): Promise<DataImportDoc> {
  const fileDoc = await api.uploadFile(file, filename, { doctype: "Data Import", docname: doc.name, fieldname: "import_file", isPrivate: true });
  const fileUrl = String((fileDoc as { file_url?: unknown }).file_url ?? "");
  return (await api.saveDoc({ ...doc, import_file: fileUrl }, "Save")) as DataImportDoc;
}

/**
 * The column mapper's save (`data_import.js:302-309` `remap_column`): `template_options.column_to_field_map` gets the
 * changed entries (`changedColumnMap` — FILE column index → field), the document is SAVED (savedocs; the server
 * re-parses the file with the map in `validate`), then the preview is requested AGAIN from the server
 * (`frm.save().then(() => frm.trigger("import_file"))` → `get_preview_from_template`). The returned document carries the
 * new `modified`: use it for every later save / start. Nothing is re-mapped on the client.
 */
export async function remapImportColumns(api: Pick<FrappeApi, "saveDoc" | "call">, doc: DataImportDoc, changed: Record<string, string>): Promise<{ doc: DataImportDoc; preview: ImportPreview | null }> {
  const saved = (await api.saveDoc({ ...doc, template_options: mergeColumnToFieldMap(doc.template_options, changed) }, "Save")) as DataImportDoc;
  const preview = await getImportPreview(api, saved.name, saved.import_file ?? undefined);
  return { doc: saved, preview };
}

/** Step 4. */
export async function getImportPreview(api: Pick<FrappeApi, "call">, name: string, importFile?: string): Promise<ImportPreview | null> {
  const res = await api.call(DATA_IMPORT_METHODS.preview, { data_import: name, ...(importFile ? { import_file: importFile } : {}) });
  return res.message && typeof res.message === "object" ? (res.message as ImportPreview) : null;
}

/** Step 5: `form_start_import` → true (enqueued) / false (already queued). */
export async function startImport(api: Pick<FrappeApi, "call">, name: string): Promise<boolean> {
  const res = await api.call(DATA_IMPORT_METHODS.start, { data_import: name });
  return res.message === true || res.message === 1;
}

export interface ImportStatus {
  status: DataImportStatus;
  /** Rows imported / failed so far (Data Import Log counts; absent until the job has written any). */
  success: number;
  failed: number;
  /** `payload_count`: records parsed from the file. 0 while the file has not been parsed. */
  total: number;
}

/** `get_import_status` (data_import.py:219-242). */
export async function getImportStatus(api: Pick<FrappeApi, "call">, name: string): Promise<ImportStatus> {
  const res = await api.call(DATA_IMPORT_METHODS.status, { data_import_name: name });
  const m = (res.message ?? {}) as Record<string, unknown>;
  return { status: (m.status as DataImportStatus) ?? "Pending", success: Number(m.success) || 0, failed: Number(m.failed) || 0, total: Number(m.total_records) || 0 };
}

export interface ImportLogRow { success: 0 | 1; docname?: string | null; messages?: string | null; exception?: string | null; row_indexes: string }

/** `get_import_logs` (data_import.py:245-256): one row per imported document or failure, up to 5000. */
export async function getImportLogs(api: Pick<FrappeApi, "call">, name: string): Promise<ImportLogRow[]> {
  const res = await api.call(DATA_IMPORT_METHODS.logs, { data_import: name });
  return Array.isArray(res.message) ? (res.message as ImportLogRow[]) : [];
}

/** The Data Import's "Download Template": `download_template` with `blank_template` (data_import.js:214-221 → DataExporter). */
export function downloadImportTemplate(api: Pick<FrappeApi, "download">, doctype: string, exportFields: Record<string, string[]>, fileType: ExportFileType = "CSV"): Promise<DownloadedFile> {
  return downloadExportTemplate(api, { doctype, fileType, exportRecords: "blank_template", exportFields });
}

/** "Export Errored Rows" (Partial Success): the failed rows as CSV, from the server (importer.py:305-334). */
export function downloadErroredRows(api: Pick<FrappeApi, "download">, name: string): Promise<DownloadedFile> {
  return api.download(DATA_IMPORT_METHODS.erroredRows, { data_import_name: name });
}

/** "Export Import Log" (5000+ log rows; data_import.js:324-331). */
export function downloadImportLog(api: Pick<FrappeApi, "download">, name: string): Promise<DownloadedFile> {
  return api.download(DATA_IMPORT_METHODS.importLog, { data_import_name: name });
}

/** `template_warnings` of a Data Import document, parsed (JSON list; `[]` when none). */
export function parseTemplateWarnings(doc: Pick<DataImportDoc, "template_warnings"> | undefined): ImportWarning[] {
  try { const w = JSON.parse(doc?.template_warnings || "[]") as unknown; return Array.isArray(w) ? (w as ImportWarning[]) : []; } catch { return []; }
}

export interface ImportProgress extends ImportStatus {
  /** The job stopped before importing because the template has warnings (importer.py:81-90): fix the file and retry. */
  warnings: ImportWarning[];
  /** The job is queued or running — see `importRunning`. */
  running: boolean;
  /** `since` was given and the server has not written the document since: the job has not started yet. */
  queued?: boolean;
  doc?: DataImportDoc;
}

/**
 * Is the server's job still to come or still running? From the server's answers only:
 *  - `since` (the document's `modified` when Start / Retry was sent) unchanged → queued: the job writes the document
 *    as soon as it runs (`before_import` `db_set("template_warnings", "")`, every status `db_set`, importer.py:73,
 *    183-184, 240; `db_set` bumps `modified`). Until then a non-Pending status and old `template_warnings` belong to the
 *    PREVIOUS run (Retry after Partial Success / Error, or after warnings stopped a run);
 *  - Pending → running, unless `template_warnings` say the job refused to import (importer.py:81-90);
 *  - Partial Success → running while the logged rows are fewer than `payload_count`: the job sets Partial Success after
 *    its FIRST successful row (importer.py:183-184) and the final status only at the end (`:220-240`);
 *  - Success / Error / Timed Out → finished.
 */
export function importRunning(status: ImportStatus, warnings: ImportWarning[], doc?: Pick<DataImportDoc, "modified">, since?: string): boolean {
  if (since !== undefined && doc && doc.modified === since) return true;
  if (status.status === "Pending") return !warnings.length;
  if (status.status === "Partial Success") return status.total > 0 && status.success + status.failed < status.total;
  return false;
}

/**
 * Poll a Data Import until it finishes: `get_import_status` plus the document (for `template_warnings` and `modified`),
 * every `intervalMs` (default 2000) while `importRunning` says the job is queued or running. Pass `since` (the
 * document's `modified` when Start / Retry was sent) so a Retry is not taken as finished before the job ran. Desk uses
 * realtime (`data_import_refresh`, `data_import_progress`); those are published site-wide / per user, not to the
 * document's room, so a `RealtimePort.subscribeDoc` would not see them — polling is the package's mechanism (documented).
 */
export function useImportStatus(api: Pick<FrappeApi, "call" | "getDoc"> | undefined, name: string | null | undefined, o: { intervalMs?: number; enabled?: boolean; since?: string } = {}) {
  const since = o.since;
  const q = useQuery({
    queryKey: ["sf-frappe", "data-import", name, since ?? null],
    enabled: !!api && !!name && o.enabled !== false,
    queryFn: async (): Promise<ImportProgress> => {
      const [status, loaded] = await Promise.all([getImportStatus(api!, name!), api!.getDoc("Data Import", name!).catch(() => null)]);
      const doc = loaded?.doc as DataImportDoc | undefined;
      const warnings = parseTemplateWarnings(doc);
      const queued = since !== undefined && !!doc && doc.modified === since;
      return { ...status, warnings, running: importRunning(status, warnings, doc, since), ...(since !== undefined ? { queued } : {}), doc };
    },
    refetchInterval: (query) => (query.state.data && !query.state.data.running ? false : o.intervalMs ?? 2000),
    retry: false,
  });
  const refetch = React.useCallback(async (): Promise<void> => { await q.refetch(); }, [q]);
  return { progress: q.data, loading: q.isPending, error: q.error as Error | null, refetch };
}
