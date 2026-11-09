/**
 * Browser printing of HOST-RENDERED documents (Core, Frappe-free, pure).
 *
 * Frappe prints on the server (wkhtmltopdf / Chrome PDF: `download_multi_pdf`, `/printview`). A host without a print
 * server (a mock / offline app) renders its documents itself and lets the BROWSER print them — the user prints or picks
 * "Save as PDF" in the browser's print dialog. This module composes the ONE HTML document that is both previewed
 * (`PrintPreviewFrame srcDoc`, sandboxed) and printed (`printHtmlDocument`), so the preview and the printout cannot
 * diverge:
 *  - every document on its own sheet: `break-before: page` between documents (Desk's multi-PDF puts each document on its
 *    own pages, `print_format.py:_download_multi_pdf` appends one PDF per document);
 *  - `@page { size: <w>mm <h>mm; margin }` from the page size Desk offers (`frappe.meta.get_print_sizes()`,
 *    `model/meta.js:217-251`) or a Custom height / width in mm (`bulk_operations.js:71-84, 103-114`). Most of those
 *    names are NOT CSS `size` keywords, so every size is emitted in millimetres (Qt / wkhtmltopdf paper sizes);
 *  - `dir` / `lang` on <html>;
 *  - a Content-Security-Policy that forbids every script (inline, event-handler or external) — see TRUST below.
 *
 * TRUST: `documents[]` and `style` are the HOST's own HTML / CSS, rendered from its data with every value escaped
 * (`escapeHtml`). This module adds only its own chrome; it never interpolates other caller data except `title` / `lang`
 * (escaped) and stylesheet URLs (only `https:` URLs, escaped). `</style` in the CSS is neutralised (as `printSrcDoc`).
 * As defence in depth the composed document carries `script-src 'none'`, so even an unescaped value could not run.
 */

/** `frappe.meta.get_print_sizes()` (`model/meta.js:217-251`), in Desk's order. */
export const PRINT_PAGE_SIZES = [
  "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10",
  "C5E", "Comm10E", "DLE", "Executive", "Folio", "Ledger", "Legal", "Letter", "Tabloid", "Custom",
] as const;

/** The paper sizes behind those names, width × height in mm (Qt's QPageSize, which wkhtmltopdf uses for `page-size`). */
export const PRINT_PAGE_SIZE_MM: Readonly<Record<string, readonly [number, number]>> = {
  A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], A7: [74, 105], A8: [52, 74], A9: [37, 52],
  B0: [1000, 1414], B1: [707, 1000], B2: [500, 707], B3: [353, 500], B4: [250, 353], B5: [176, 250], B6: [125, 176], B7: [88, 125], B8: [62, 88], B9: [44, 62], B10: [31, 44],
  C5E: [163, 229], Comm10E: [105, 241], DLE: [110, 220], Executive: [190.5, 254], Folio: [210, 330], Ledger: [431.8, 279.4],
  Legal: [215.9, 355.6], Letter: [215.9, 279.4], Tabloid: [279.4, 431.8],
};

/** The letterhead option meaning "none" (`bulk_operations.js:170`, print.js:705). */
export const NO_LETTERHEAD = "No Letterhead";
/** Desk's cap on one print (`bulk_operations.js:13`); a browser print of more documents is not reasonable either. */
export const MAX_PRINT_LIMIT = 500;

export type PrintOrientation = "portrait" | "landscape";

/** The page of a print: a named size (`PRINT_PAGE_SIZES`) or "Custom" with a height / width in mm. */
export interface PrintPageSpec {
  pageSize: string;
  /** mm; required (> 0) for "Custom". */
  heightMm?: number;
  widthMm?: number;
  /** Default: the paper's own orientation. */
  orientation?: PrintOrientation;
  /** CSS length of the @page margin. Default "14mm". */
  margin?: string;
}

/**
 * The page's width × height in mm. Throws RangeError("Page height and width cannot be zero") for a Custom size whose
 * height or width is not a positive number (Desk throws on 0, `bulk_operations.js:104-106`; an empty value is refused
 * too), and for an unknown size name.
 */
export function pageDimensionsMm(p: PrintPageSpec): { widthMm: number; heightMm: number } {
  let w: number, h: number;
  if (p.pageSize === "Custom") {
    w = Number(p.widthMm); h = Number(p.heightMm);
    if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) throw new RangeError("Page height and width cannot be zero");
  } else {
    const d = PRINT_PAGE_SIZE_MM[p.pageSize];
    if (!d) throw new RangeError(`Unknown page size: ${p.pageSize}`);
    [w, h] = d;
  }
  if (p.orientation === "landscape" && w < h) [w, h] = [h, w];
  if (p.orientation === "portrait" && w > h) [w, h] = [h, w];
  return { widthMm: w, heightMm: h };
}

/** Is this page valid (a known size, or Custom with positive height and width)? */
export function isValidPrintPage(p: PrintPageSpec): boolean {
  try { pageDimensionsMm(p); return true; } catch { return false; }
}

const num = (n: number) => String(Math.round(n * 100) / 100);
const SAFE_MARGIN = /^[0-9.]+(mm|cm|in|pt|px)( [0-9.]+(mm|cm|in|pt|px)){0,3}$/;

/** The `@page` rule of the page (mm). */
export function pageCss(p: PrintPageSpec): string {
  const { widthMm, heightMm } = pageDimensionsMm(p);
  const margin = p.margin && SAFE_MARGIN.test(p.margin) ? p.margin : "14mm";
  return `@page { size: ${num(widthMm)}mm ${num(heightMm)}mm; margin: ${margin}; }`;
}

/** Escape a value for HTML text or a quoted attribute. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CLOSE_STYLE = /<\/style/gi;

export interface ComposePrintOptions {
  /** One HTML fragment per document (trusted: the host's own escaped HTML). Each prints on its own page(s). */
  documents: string[];
  /** Print CSS of the documents. */
  style?: string;
  page: PrintPageSpec;
  dir?: "ltr" | "rtl";
  lang?: string;
  /** The document title (the browser shows it in its print header / PDF name). */
  title?: string;
  /** Stylesheet URLs (e.g. a web font); only `https:` URLs are kept. */
  stylesheets?: string[];
}

export const PRINT_DOC_CLASS = "sf-print-doc";

/**
 * The full HTML document (a string for `srcdoc`): `@page`, the documents separated by page breaks, and — on screen only —
 * each document drawn as a sheet of the chosen paper (so the preview shows the page size). Throws like `pageDimensionsMm`.
 */
export function composePrintDocument(o: ComposePrintOptions): string {
  const page = pageCss(o.page);
  const { widthMm, heightMm } = pageDimensionsMm(o.page);
  const margin = o.page.margin && SAFE_MARGIN.test(o.page.margin) ? o.page.margin : "14mm";
  const dir = o.dir === "rtl" ? "rtl" : "ltr";
  const sheets = (o.stylesheets ?? []).filter((u) => /^https:\/\/[^\s"'<>]+$/.test(u));
  const csp = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'${sheets.length ? " https:" : ""}; font-src https: data:; img-src https: data: blob:`;
  const base = [
    page,
    "html,body{margin:0;padding:0;background:#fff}",
    "*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}",
    `.${PRINT_DOC_CLASS}+.${PRINT_DOC_CLASS}{break-before:page;page-break-before:always}`,
    `@media screen{body{background:#e9e7ee;padding:12px 0}.${PRINT_DOC_CLASS}{background:#fff;width:${num(widthMm)}mm;max-width:calc(100% - 16px);min-height:${num(heightMm)}mm;padding:${margin};margin:0 auto 12px;box-shadow:0 1px 4px rgba(0,0,0,.18)}}`,
  ].join("\n");
  const css = `${base}\n${(o.style ?? "").replace(CLOSE_STYLE, "<\\/style")}`;
  const body = o.documents.map((d, i) => `<div class="${PRINT_DOC_CLASS}" data-doc-index="${i}">${d}</div>`).join("");
  return `<!doctype html><html dir="${dir}"${o.lang ? ` lang="${escapeHtml(o.lang)}"` : ""}><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
    + `<title>${escapeHtml(o.title ?? "")}</title>`
    + sheets.map((u) => `<link rel="stylesheet" href="${escapeHtml(u)}">`).join("")
    + `<style>${css}</style></head><body>${body}</body></html>`;
}
