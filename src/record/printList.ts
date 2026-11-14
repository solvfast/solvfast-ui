/**
 * printListDocument — a clean printout of a list (0.8.0-dev.9, L-05): a heading, an optional subtitle, the "{n} records"
 * line and ONE table with exactly the given columns and every given row — no app chrome (toolbar, checkboxes, row
 * actions, pager). The host passes the rows it wants printed (e.g. every row of the current filter, from
 * `ListView onResultChange`), already formatted as text.
 *
 * The result is a complete HTML document (`composePrintDocument`: `@page`, `script-src 'none'`), every value escaped.
 * `printList` prints it through the browser's dialog (`printHtmlDocument`, a hidden frame — only the document prints).
 */
import { composePrintDocument, escapeHtml, type PrintPageSpec } from "./printDocument";
import { printHtmlDocument, type PrintHtmlOptions } from "./browserPrint";

export interface PrintListColumn {
  /** The row key of the column. */
  key: string;
  /** The header text. */
  label: string;
  /** "end" for numbers (right in LTR, left in RTL). Default "start". */
  align?: "start" | "end";
}

export interface PrintListOptions {
  title: string;
  subtitle?: string;
  columns: PrintListColumn[];
  /** The rows, values as display text by column key (a missing key prints empty). */
  rows: Record<string, string>[];
  dir?: "ltr" | "rtl";
  lang?: string;
  /** The count line; `{n}` is the row count. Default "{n} records" ("1 record"; Arabic: "عدد السجلات: {n}"). */
  countLabel?: string;
  /** Shown instead of the table when there are no rows. Default "No records" (Arabic "لا توجد سجلات"). */
  emptyLabel?: string;
  /** Default A4, landscape when there are more than 6 columns, 12 mm margins. */
  page?: PrintPageSpec;
}

const isArabic = (lang: string | undefined) => !!lang && lang.toLowerCase().startsWith("ar");

/** The list's print document (a complete HTML string). Throws like `composePrintDocument` for an invalid `page`. */
export function printListDocument(o: PrintListOptions): string {
  const ar = isArabic(o.lang);
  const n = o.rows.length;
  const count = (o.countLabel ?? (ar ? "عدد السجلات: {n}" : n === 1 ? "{n} record" : "{n} records")).replace(/\{n\}/g, String(n));
  const empty = o.emptyLabel ?? (ar ? "لا توجد سجلات" : "No records");
  const align = (c: PrintListColumn) => (c.align === "end" ? ' class="end"' : "");
  const head = `<tr>${o.columns.map((c) => `<th scope="col"${align(c)}>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = o.rows.map((r) => `<tr>${o.columns.map((c) => `<td${align(c)}>${escapeHtml(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("");
  const doc = `<header class="sf-print-list-head"><h1>${escapeHtml(o.title)}</h1>`
    + (o.subtitle ? `<p class="sf-print-list-sub">${escapeHtml(o.subtitle)}</p>` : "")
    + `<p class="sf-print-list-count">${escapeHtml(count)}</p></header>`
    + (n ? `<table class="sf-print-list" data-rows="${n}"><thead>${head}</thead><tbody>${body}</tbody></table>` : `<p class="sf-print-list-empty">${escapeHtml(empty)}</p>`);
  const style = [
    "body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Arabic',Arial,sans-serif;color:#1c1626;font-size:11px}",
    ".sf-print-list-head h1{font-size:18px;font-weight:700;margin:0}",
    ".sf-print-list-sub{font-size:12px;color:#5f5870;margin:2px 0 0}",
    ".sf-print-list-count{font-size:12px;color:#5f5870;margin:2px 0 12px}",
    "table.sf-print-list{width:100%;border-collapse:collapse}",
    "table.sf-print-list th,table.sf-print-list td{text-align:start;vertical-align:top;padding:5px 6px;border-bottom:1px solid #e4e0ea}",
    "table.sf-print-list th{font-weight:600;color:#4a4358;border-bottom:1.5px solid #c9c2d4;background:#f6f4f9}",
    "table.sf-print-list .end{text-align:end;font-variant-numeric:tabular-nums}",
    "table.sf-print-list thead{display:table-header-group}",
    "table.sf-print-list tr{break-inside:avoid;page-break-inside:avoid}",
    ".sf-print-list-empty{font-size:12px;color:#8a8397}",
  ].join("\n");
  const page = o.page ?? { pageSize: "A4", orientation: o.columns.length > 6 ? "landscape" : "portrait", margin: "12mm" };
  return composePrintDocument({ documents: [doc], style, page, dir: o.dir, lang: o.lang, title: o.title });
}

/** Print the list (`printListDocument`) with the browser's print dialog. Resolves once `print()` was called. */
export function printList(o: PrintListOptions, printOptions?: PrintHtmlOptions): Promise<void> {
  return printHtmlDocument(printListDocument(o), printOptions);
}
