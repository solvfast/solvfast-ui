/**
 * Bulk Print of the Desk list (`list_view.js:1959-1965, 2104-2106`; `bulk_operations.js:7-193`) as functions. THE PDF
 * ALWAYS COMES FROM THE SERVER: `frappe.utils.print_format.download_multi_pdf` renders every document with
 * `frappe.get_print` and streams the merged PDF (`response.type = "pdf"`, `print_format.py:206-225`); nothing here
 * builds a file from client rows.
 *
 * Server fact that makes Desk's client-side filter load-bearing: in the synchronous path `_download_multi_pdf` catches
 * EVERY exception per document and only reports it when a `task_id` exists (`print_format.py:145-147, 182-191`). A document the
 * user may not print (`validate_print_permission`, `www/printview.py:367-378`) or a draft / cancelled submittable
 * document that Print Settings forbid (`printview.py:137-142`, raised inside `frappe.get_print`) is therefore SILENTLY LEFT OUT of the PDF — the server does
 * not refuse. `checkPrintable` reproduces Desk's filter (`bulk_operations.js:16-45`) so such a selection is stopped before
 * the request.
 *
 * Desk opens the sync method as a GET in a new window (`:144-162`); the method is `@frappe.whitelist()` with the default
 * methods (`__init__.py:834-835`: GET, POST, PUT, DELETE), so the package POSTs the same arguments through
 * `api.download` (the default file transport POSTs JSON). Background printing (> 25 documents, or chosen) calls
 * `download_multi_pdf_async`, which answers `{task_id}` (HTTP 201) and later publishes `task_complete:<task_id>` with
 * `{file_url}` to the user (`print_format.py:206-222`).
 */
import type { DownloadedFile, FrappeApi, FrappeClient } from "../client";
import type { Check } from "../contract";

export const PRINT_METHODS = {
  pdf: "frappe.utils.print_format.download_multi_pdf",
  pdfAsync: "frappe.utils.print_format.download_multi_pdf_async",
} as const;

/** `bulk_operations.js:13-14`. MAX_PRINT_LIMIT, NO_LETTERHEAD (`:170, 98`; sent as `letterhead` with `no_letterhead: "1"`,
 *  as Desk does) and PRINT_PAGE_SIZES (`frappe.meta.get_print_sizes()`, `model/meta.js:217-251`) are Core since P36e
 *  (src/record/printDocument.ts — browser printing uses them too); re-exported here unchanged. */
export { MAX_PRINT_LIMIT, NO_LETTERHEAD, PRINT_PAGE_SIZES } from "../../record/printDocument";
import { MAX_PRINT_LIMIT, NO_LETTERHEAD } from "../../record/printDocument";
export const BACKGROUND_PRINT_THRESHOLD = 25;

/**
 * The Print Settings Desk reads from boot (`boot.py:358-362` `load_print`: `frappe.db.get_singles_dict("Print Settings")`).
 * The package cannot read them for most users — Print Settings grants read to System Manager only
 * (`printing/doctype/print_settings/print_settings.json`), and `frappe.client.get_single_value` checks it
 * (`client.py:166-170`) — so the host passes them from its own boot payload.
 */
export interface PrintSettingsInput {
  allow_print_for_draft?: Check | boolean;
  allow_print_for_cancelled?: Check | boolean;
  enable_raw_printing?: Check | boolean;
  pdf_page_size?: string;
  pdf_page_height?: number;
  pdf_page_width?: number;
}
/** The Print Settings DocType's field defaults (`print_settings.json`), used when the host passes none. */
export const PRINT_SETTINGS_DEFAULTS: Required<Pick<PrintSettingsInput, "allow_print_for_draft" | "allow_print_for_cancelled" | "enable_raw_printing" | "pdf_page_size">> = {
  allow_print_for_draft: 1, allow_print_for_cancelled: 0, enable_raw_printing: 0, pdf_page_size: "A4",
};
const on = (v: unknown) => v === true || v === 1 || v === "1";

export type PrintCheck =
  | { ok: true; names: string[]; background: boolean }
  /** `draft_or_cancelled`: "You selected Draft or Cancelled documents"; `none`: "Select atleast 1 record for printing";
   *  `too_many`: "You can only print upto 500 documents at a time" (`bulk_operations.js:30-45`, in that order). */
  | { ok: false; reason: "draft_or_cancelled" | "none" | "too_many" };

/**
 * Desk's filter (`bulk_operations.js:16-45`): for a submittable DocType only submitted documents, plus drafts / cancelled
 * when Print Settings allow them, or anything for the Administrator ROLE (`frappe.user.has_role("Administrator")`).
 * `rows` are the checked rows (they carry `docstatus`); a selected name without a row has no known docstatus and fails
 * the filter as it would in Desk. `background` is forced above 25 documents (the dialog's checkbox is read-only there).
 */
export function checkPrintable(keys: string[], rows: Array<{ name?: unknown; docstatus?: unknown }>, o: { isSubmittable: boolean; settings?: PrintSettingsInput; roles?: readonly string[] }): PrintCheck {
  const s = { ...PRINT_SETTINGS_DEFAULTS, ...o.settings };
  const admin = !!o.roles?.includes("Administrator");
  const byName = new Map(rows.map((r) => [String(r.name), r]));
  const docstatus = (k: string) => { const d = byName.get(k)?.docstatus; return d === undefined || d === null ? undefined : Number(d); };
  const valid = keys.filter((k) => {
    const d = docstatus(k);
    return !o.isSubmittable || d === 1 || (on(s.allow_print_for_cancelled) && d === 2) || (on(s.allow_print_for_draft) && d === 0) || admin;
  });
  if (valid.length < keys.length) return { ok: false, reason: "draft_or_cancelled" };
  if (!valid.length) return { ok: false, reason: "none" };
  if (valid.length > MAX_PRINT_LIMIT) return { ok: false, reason: "too_many" };
  return { ok: true, names: valid, background: valid.length > BACKGROUND_PRINT_THRESHOLD };
}

interface PrintFormatRow { name?: unknown; print_format_type?: unknown; raw_printing?: unknown; disabled?: unknown }

/**
 * `frappe.meta.get_print_formats(doctype)` (`model/meta.js:253-282`) over the formats `getdoctype` already sent
 * (`__print_formats`: enabled, not cancelled — `desk/form/meta.py:223-232`): "Standard" first, no JS formats, raw-printing
 * formats only with `enable_raw_printing`, the DocType's `default_print_format` moved to the front. Desk sorts with a
 * comparator over the row objects (a no-op); the package sorts by name.
 */
export function printFormatOptions(meta: Record<string, unknown> | undefined, settings?: PrintSettingsInput): string[] {
  const raw = on({ ...PRINT_SETTINGS_DEFAULTS, ...settings }.enable_raw_printing);
  const rows = (Array.isArray(meta?.__print_formats) ? meta!.__print_formats : []) as PrintFormatRow[];
  const out = ["Standard"];
  for (const r of [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
    const name = String(r.name ?? "");
    if (!name || out.includes(name) || r.print_format_type === "JS" || (!raw && on(r.raw_printing))) continue;
    out.push(name);
  }
  const def = typeof meta?.default_print_format === "string" ? meta.default_print_format : "";
  if (def && def !== "Standard") {
    // Desk splices indexOf(default) — which removes the LAST entry when the default is not offered (-1); the package does not
    const i = out.indexOf(def);
    if (i >= 0) out.splice(i, 1);
    out.unshift(def);
  }
  return out;
}

/**
 * Desk's letterhead options (`bulk_operations.js:169-193`): `frappe.client.get_list("Letter Head", {fields: [name,
 * is_default], filters: {disabled: 0}, limit_page_length: 0})`; "No Letterhead" first, the default letterhead in front of
 * it. Letter Head grants read to Desk User (`letter_head.json`).
 */
export async function letterheadOptions(client: Pick<FrappeClient, "getList">): Promise<string[]> {
  const rows = await client.getList<{ name: string; is_default?: unknown }>("Letter Head", { fields: ["name", "is_default"], filters: [["disabled", "=", 0]], limit_page_length: 0 });
  const out = [NO_LETTERHEAD];
  for (const r of rows) if (on(r.is_default)) out.unshift(r.name); else out.push(r.name);
  return out;
}

/** `pdf_options` (`bulk_operations.js:103-114`): `{"page-size": X}`, or height / width in mm for "Custom" (both must be > 0). */
export function pdfOptions(pageSize: string, height?: number, width?: number): string {
  if (pageSize === "Custom") {
    // Desk throws only on an explicit 0 ("Page height and width cannot be zero"); the package also refuses an empty value
    if (!(Number(height) > 0) || !(Number(width) > 0)) throw new RangeError("Page height and width cannot be zero");
    return JSON.stringify({ "page-height": Number(height), "page-width": Number(width) });
  }
  return JSON.stringify({ "page-size": pageSize });
}

export interface MultiPdfOptions {
  doctype: string;
  names: string[];
  /** Print Format name (Desk: the chosen one, else the DocType's `default_print_format`). */
  format?: string;
  /** A Letter Head name, or `NO_LETTERHEAD`. */
  letterhead: string;
  /** `pdfOptions(...)`. */
  options: string;
}

/** The arguments Desk sends to both methods (`bulk_operations.js:117-125, 144-158`). */
export function multiPdfArgs(o: MultiPdfOptions): Record<string, unknown> {
  const withLetterhead = o.letterhead !== NO_LETTERHEAD;
  return { doctype: o.doctype, name: JSON.stringify(o.names), format: o.format, no_letterhead: withLetterhead ? "0" : "1", letterhead: o.letterhead, options: o.options };
}

/** Sync print: the server's merged PDF (`download_multi_pdf`). Throws FrappeError when the server answers with an error. */
export function downloadMultiPdf(api: Pick<FrappeApi, "download">, o: MultiPdfOptions): Promise<DownloadedFile> {
  return api.download(PRINT_METHODS.pdf, multiPdfArgs(o));
}

/** Background print: enqueues `_download_multi_pdf` and answers `{task_id}`; the link arrives on realtime `task_complete:<task_id>`. */
export async function downloadMultiPdfAsync(client: Pick<FrappeClient, "call">, o: MultiPdfOptions): Promise<{ taskId: string }> {
  const res = await client.call(PRINT_METHODS.pdfAsync, multiPdfArgs(o));
  const taskId = (res.message as { task_id?: unknown } | undefined)?.task_id;
  if (typeof taskId !== "string" || !taskId) throw new Error("download_multi_pdf_async answered without a task_id");
  return { taskId };
}

/**
 * Waits for the background PDF: Desk subscribes the task (`frappe.realtime.task_subscribe`) and listens for
 * `task_complete:<task_id>` (`bulk_operations.js:126-141`). The contract's `RealtimePort` has no such subscription, so
 * the host may pass one (e.g. over its Socket.IO client: `socket.on("task_complete:" + id, …)`); without it the package
 * reports the job as queued and stops there.
 */
export type PrintTaskSubscriber = (taskId: string, onComplete: (data: { file_url?: string }) => void) => () => void;
