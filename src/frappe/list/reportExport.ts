/**
 * Report-view export — Desk's Report view "Export" (`JS/views/reports/report_view.js:1646-1722`) over
 * `frappe.desk.reportview.export_query` (`desk/reportview.py:352-383`, `_export_query :393-466`). THE FILE ALWAYS COMES
 * FROM THE SERVER: it runs the query itself (`DatabaseQuery.execute`, `limit_page_length = None` unless `page_length`
 * is posted, `db_query.py:152-155`), checks `can_export` (`reportview.py:420-428` → `permissions.py:608-616`: System
 * Manager, else the role's `export`, else `if_owner` export with every row's owner checked) and streams the CSV / XLSX
 * (`provide_binary_file`, `desk/utils.py:60-66`). Nothing here builds a file from rows the client holds.
 *
 * ⚠ SITE WRITE: `_export_query` writes an **Access Log** row (`make_access_log`, `reportview.py:410-415`) BEFORE the
 * `can_export` check — on every call, refused or not. Report-view export is therefore **BLOCKED for site
 * verification**; it is only tested against stubs.
 *
 * Visibility: Desk adds the menu entry only when `frappe.model.can_export(doctype)` (`report_view.js:1646`;
 * `JS/model/model.js:444-450`: System Manager, or the DocType in `boot.user.can_export`) — the package's `canExport`.
 *
 * The request: Desk posts a hidden form to `/` with `cmd` (`open_url_post`, `JS/utils/urllib.js:48-73`; every
 * non-string value `JSON.stringify`-ed). The package POSTs the same fields to the method through `api.download`, values
 * encoded the same way — the server compares `add_totals_row` / `translate_values` with the STRING "1"
 * (`reportview.py:404-405`) and `json.loads` `selected_items` (`:407-408`). The background variant is a `frappe.call`
 * in Desk (`report_view.js:1711-1716`) and an `api.call` here: the server enqueues the job, msgprints "Your report is
 * being generated in the background…" and returns nothing (`reportview.py:362-381`) — no file.
 */
import { parseServerMessages, type DownloadedFile, type FrappeApi } from "../client";
import type { FrappeMessage } from "../contract";
import type { FrappeFilter } from "../query";

export const EXPORT_QUERY_METHOD = "frappe.desk.reportview.export_query";

export type ReportExportFormat = "Excel" | "CSV";
/** `csv.QUOTE_*` (`report_utils.js:204-215`): 0 Minimal, 1 All, 2 Non-numeric (Desk's default), 3 None. */
export type CsvQuoting = 0 | 1 | 2 | 3;

export interface ReportExportOptions {
  doctype: string;
  /** Columns to export (plain fieldnames or `` `tabX`.`f` ``). The server appends `owner` for its per-row check (`reportview.py:397-400`). */
  fields: string[];
  filters?: FrappeFilter[];
  /** Not sent by Desk's report view (its search is a `like` in `filters`); the package's list search lives here. */
  or_filters?: FrappeFilter[];
  order_by?: string;
  /** Desk's `file_format_type` (`report_utils.js:175-181`; default Excel). */
  fileFormat: ReportExportFormat;
  /** Checked rows → `selected_items`; the server then REPLACES the filters with `name in (…)` (`reportview.py:407-408`). */
  selectedItems?: string[];
  /** File name without extension (Desk: the saved report's name, else the DocType). */
  title?: string;
  /** "Export all N rows?" left unchecked: only the rows shown (`start: 0, page_length: n`, `report_view.js:1704-1710`). Omit = every matching row. */
  pageLength?: number;
  /** CSV only (`pop_csv_params`, `desk/utils.py:36-45`): one character, default ",". */
  csvDelimiter?: string;
  /** CSV only; default 2 (Non-numeric). */
  csvQuoting?: CsvQuoting;
  /** Desk offers "Translate values" when the session language is not English (`report_view.js:1672-1679`). */
  translateValues?: boolean;
  /** The report view's totals row (`append_totals_row`, `reportview.py:430-431, 469-486`). */
  addTotalsRow?: boolean;
  /** Enqueue and email the file instead of downloading it (`export_in_background`, `reportview.py:360-381`). */
  background?: boolean;
}

export type ReportExportResult =
  | { kind: "file"; file: DownloadedFile }
  /** Queued: no file; the server's msgprint (it names the e-mail address the link goes to). */
  | { kind: "background"; messages: FrappeMessage[]; message: string };

const enc = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** The exact fields posted (`report_view.js:1684-1712` over `get_args`, `JS/list/base_list.js:460-478`), encoded as `open_url_post` does. */
export function reportExportArgs(o: ReportExportOptions): Record<string, string> {
  const a: Record<string, unknown> = {
    doctype: o.doctype,
    fields: o.fields,
    filters: o.filters ?? [],
    ...(o.or_filters?.length ? { or_filters: o.or_filters } : {}),
    ...(o.order_by ? { order_by: o.order_by } : {}),
    // ReportView.view; the server drops it with `clean_params` (reportview.py:22, 224-227) — sent as Desk sends it
    view: "Report",
    file_format_type: o.fileFormat,
    title: o.title || o.doctype,
  };
  if (o.fileFormat === "CSV") {
    a.csv_delimiter = (o.csvDelimiter ?? ",").slice(0, 1) || ",";
    a.csv_quoting = o.csvQuoting ?? 2;
  }
  if (o.translateValues !== undefined) a.translate_values = o.translateValues ? 1 : 0;
  if (o.addTotalsRow) a.add_totals_row = 1;
  if (o.selectedItems?.length) a.selected_items = o.selectedItems;
  if (o.pageLength !== undefined && o.pageLength > 0) { a.start = 0; a.page_length = o.pageLength; }
  a.export_in_background = o.background ? 1 : 0;
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, enc(v)]));
}

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Export through the server. A file → `{ kind: "file" }` (hand it to the browser with `saveFile`); a background export
 * → `{ kind: "background", message }`. A refusal (403 `PermissionError` from `can_export`, a "Field not permitted in
 * query" `DataError`, …) rejects with the `FrappeError`; no file exists then.
 */
export async function downloadReportExport(api: Pick<FrappeApi, "download" | "call">, o: ReportExportOptions): Promise<ReportExportResult> {
  const args = reportExportArgs(o);
  if (o.background) {
    const res = await api.call(EXPORT_QUERY_METHOD, args);
    const messages = parseServerMessages(res?._server_messages);
    return { kind: "background", messages, message: plain(messages.map((m) => m.message).join(" ")) };
  }
  return { kind: "file", file: await api.download(EXPORT_QUERY_METHOD, args) };
}

/**
 * The columns a report export of the list should carry: the visible columns' real fields (not the row metadata the list
 * also requests — `_assign`, `_comments`, … — nor indicator / currency companions), `name` first as Desk's report view
 * always has it. Child-table columns are not part of the list's columns, so none are exported.
 */
export function reportExportFields(visibleFields: string[], known: { has(f: string): boolean }): string[] {
  const out = ["name"];
  for (const f of visibleFields) if (f && !f.startsWith("_") && !f.includes(".") && known.has(f) && !out.includes(f)) out.push(f);
  return out;
}
