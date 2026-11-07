/**
 * Form-level print, as Desk's print page does it (Frappe 15.110 `printing/page/print/print.js`):
 *  - preview: `frappe.www.printview.get_html_and_style` with the WHOLE document as `doc` (print.js:681-703; the server
 *    accepts `doc` + `name` or a JSON document, printview.py:304-341, and checks READ — `document.check_permission()`;
 *    `get_rendered_template` refuses drafts / cancelled documents Print Settings do not allow, printview.py:137-142).
 *    The answer is `{ html, style }`; `html` is null when the template is missing (TemplateNotFoundError, :337-339).
 *  - PDF: Desk opens `/api/method/frappe.utils.print_format.download_pdf?doctype&name&format&no_letterhead&letterhead
 *    &settings` in a new window (print.js:643-668; print_format.py:236-263: `validate_print_permission`, then
 *    `get_print(as_pdf=True)`).
 *  - Full Page: the same query on `/printview?` (print.js:67, 648); "Print" adds `trigger_print=1` (:560).
 * The server renders and authorises everything; nothing is rendered here.
 */
import type { FrappeDoc } from "../contract";
import { NO_LETTERHEAD } from "../list/print";

export const PRINT_PREVIEW_METHOD = "frappe.www.printview.get_html_and_style";
export const DOWNLOAD_PDF_METHOD = "frappe.utils.print_format.download_pdf";

export interface FormPrintChoice {
  /** Print Format name ("Standard" or a format from `printFormatOptions`). */
  format: string;
  /** Letter Head name, or `NO_LETTERHEAD`. */
  letterhead: string;
}

/** The arguments Desk sends for the preview (print.js:686-694). */
export function printPreviewArgs(doc: FrappeDoc, c: FormPrintChoice, settings: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    doc: JSON.stringify(doc),
    print_format: c.format,
    no_letterhead: c.letterhead === NO_LETTERHEAD ? 1 : 0,
    letterhead: c.letterhead,
    settings: JSON.stringify(settings),
  };
}

function query(doctype: string, name: string, c: FormPrintChoice, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({
    doctype, name, ...extra, format: c.format, no_letterhead: c.letterhead === NO_LETTERHEAD ? "1" : "0", letterhead: c.letterhead, settings: "{}",
  });
  return p.toString();
}

/** `download_pdf` URL (print.js:645-668). `baseUrl` is the site origin ("" = same origin, as Desk). */
export function downloadPdfUrl(doctype: string, name: string, c: FormPrintChoice, baseUrl = ""): string {
  return `${baseUrl}/api/method/${DOWNLOAD_PDF_METHOD}?${query(doctype, name, c)}`;
}

/** `/printview` URL (print.js:648-668); `trigger` opens the browser's print dialog there (`trigger_print=1`). */
export function printViewUrl(doctype: string, name: string, c: FormPrintChoice, baseUrl = "", trigger = false): string {
  return `${baseUrl}/printview?${query(doctype, name, c, trigger ? { trigger_print: "1" } : {})}`;
}

/** `download_pdf` arguments for `api.download` (a POST through the file transport instead of a new window). */
export function downloadPdfArgs(doctype: string, name: string, c: FormPrintChoice): Record<string, unknown> {
  return { doctype, name, format: c.format, no_letterhead: c.letterhead === NO_LETTERHEAD ? 1 : 0, letterhead: c.letterhead };
}

/** The `get_html_and_style` answer (`{ message: { html, style } }`). */
export function parsePrintPreview(res: { message?: unknown }): { html: string | null; style: string } {
  const m = (res.message ?? {}) as { html?: unknown; style?: unknown };
  return { html: typeof m.html === "string" ? m.html : null, style: typeof m.style === "string" ? m.style : "" };
}
