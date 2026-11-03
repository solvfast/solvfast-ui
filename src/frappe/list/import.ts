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

/** `get_data_for_import_preview` (importer.py:51-62; ImportFile `:480-513`): columns, first rows, warnings, recent log. */
export interface ImportPreview {
  columns?: { header_title?: string; skip_import?: boolean; map_to_field?: string; [k: string]: unknown }[];
  data?: unknown[][];
  warnings?: ImportWarning[];
  import_log?: { row_indexes: string; success: 0 | 1 }[];
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
  const draft: DataImportDoc = {
    doctype: "Data Import", name: newLocalName("Data Import"), __islocal: 1, __unsaved: 1, docstatus: 0,
    reference_doctype: o.referenceDoctype, import_type: o.importType, status: "Pending",
    submit_after_import: o.submitAfterImport ? 1 : 0, mute_emails: o.muteEmails === false ? 0 : 1,
  };
  const saved = (await api.saveDoc(draft, "Save")) as DataImportDoc;
  const fileDoc = await api.uploadFile(o.file, o.filename, { doctype: "Data Import", docname: saved.name, fieldname: "import_file", isPrivate: true });
  const fileUrl = String((fileDoc as { file_url?: unknown }).file_url ?? "");
  const withFile = (await api.saveDoc({ ...saved, import_file: fileUrl }, "Save")) as DataImportDoc;
  const preview = await getImportPreview(api, withFile.name, fileUrl);
  const started = o.start === false ? null : await startImport(api, withFile.name);
  return { name: withFile.name, doc: withFile, preview, started };
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
  /** Pending with no warnings: the job is queued or running. */
  running: boolean;
  doc?: DataImportDoc;
}

/**
 * Poll a Data Import until it finishes: `get_import_status` plus the document (for `template_warnings`), every
 * `intervalMs` (default 2000) while the status is Pending and no warnings stopped it. Desk uses realtime
 * (`data_import_refresh`, `data_import_progress`); those are published site-wide / per user, not to the document's room,
 * so a `RealtimePort.subscribeDoc` would not see them — polling is the package's mechanism (documented).
 */
export function useImportStatus(api: Pick<FrappeApi, "call" | "getDoc"> | undefined, name: string | null | undefined, o: { intervalMs?: number; enabled?: boolean } = {}) {
  const q = useQuery({
    queryKey: ["sf-frappe", "data-import", name],
    enabled: !!api && !!name && o.enabled !== false,
    queryFn: async (): Promise<ImportProgress> => {
      const [status, loaded] = await Promise.all([getImportStatus(api!, name!), api!.getDoc("Data Import", name!).catch(() => null)]);
      const doc = loaded?.doc as DataImportDoc | undefined;
      const warnings = parseTemplateWarnings(doc);
      return { ...status, warnings, running: status.status === "Pending" && !warnings.length, doc };
    },
    refetchInterval: (query) => (query.state.data && !query.state.data.running ? false : o.intervalMs ?? 2000),
    retry: false,
  });
  const refetch = React.useCallback(async (): Promise<void> => { await q.refetch(); }, [q]);
  return { progress: q.data, loading: q.isPending, error: q.error as Error | null, refetch };
}
