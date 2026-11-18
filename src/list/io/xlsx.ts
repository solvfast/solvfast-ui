/**
 * A minimal, dependency-free XLSX writer and reader (0.8.0-dev.9, L-06 / L-07) — enough for the Export dialog's "Excel"
 * file type and for reading a simple spreadsheet into the Data Import dialog. Not a spreadsheet library: one sheet, text
 * and numbers, no styles, formulas, dates or merged cells.
 *
 * Writer (`buildXlsx`): an Office Open XML workbook in a STORED (uncompressed) ZIP with CRC-32 — `[Content_Types].xml`,
 * `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml`. Strings are inline
 * (`t="inlineStr"`), finite numbers are numeric cells, `null` / `undefined` leave the cell empty. Characters XML 1.0
 * cannot carry (control characters, lone surrogates) are dropped. Deterministic: the same input gives the same bytes.
 *
 * Reader (`parseXlsx`): the first sheet of an XLSX file as rows of strings (like `parseCsv`): shared strings, inline
 * strings, numbers (as written in the file, e.g. "12.5"), booleans ("TRUE" / "FALSE"), a formula's cached value; empty
 * rows are skipped and missing cells are "". Stored and deflated entries are read; deflate needs the platform's
 * `DecompressionStream("deflate-raw")` (current browsers, Node 18+) — without it a deflated file is refused with a
 * readable error. The XML is read with the browser's `DOMParser` (browser / jsdom; plain Node has none). Dates come
 * back as Excel's serial numbers (the reader does not read styles). Legacy `.xls` (BIFF) is refused.
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ── CRC-32 (IEEE 802.3, the ZIP checksum) ─────────────────────────────────────────────────────────────────────── */

let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (CRC_TABLE = t);
}
/** CRC-32 of the bytes (the ZIP / PNG checksum). */
export function crc32(bytes: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ── Stored ZIP ────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface ZipEntryInput { name: string; data: Uint8Array }

// 1980-01-01 00:00 in DOS time / date: a fixed stamp keeps the output deterministic
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** A ZIP archive of the entries, every one STORED (method 0), names in UTF-8 (flag bit 11). */
export function zipStored(entries: ZipEntryInput[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, e.data.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    parts.push(local, e.data);
    central.push(cd);
    offset += local.length + e.data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

/* ── Writer ────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type XlsxCell = string | number | null | undefined;

export interface BuildXlsxOptions {
  /** The sheet's tab name (Excel's rules: at most 31 characters, none of `[]:*?/\`). Default "Sheet1". */
  sheetName?: string;
  /** Right-to-left sheet (Arabic): column A on the right. */
  rtl?: boolean;
}

// XML 1.0 characters only: tab, LF, CR, U+0020–U+D7FF, U+E000–U+FFFD and paired surrogates (no regex look-behind:
// older Safari cannot parse it, and this module is in the core bundle)
function xmlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { out += s[i]! + s[i + 1]!; i++; }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff) continue;
    out += s[i]!;
  }
  return out;
}
const xmlText = (s: string): string => xmlChars(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "A", "B", … "Z", "AA", … for a 0-based column index. */
export function xlsxColumnName(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** A sheet name Excel accepts: the forbidden characters removed, at most 31 characters, never empty. */
export function xlsxSheetName(name: string | undefined): string {
  const s = xmlChars(name ?? "").replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31).trim();
  return s || "Sheet1";
}

function cellXml(v: XlsxCell, ref: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    if (Number.isFinite(v)) return `<c r="${ref}"><v>${String(v)}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(String(v))}</t></is></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(String(v))}</t></is></c>`;
}

/** The workbook's parts (file name → XML), before zipping. Exported for tests and custom packagers. */
export function xlsxParts(headers: string[], rows: XlsxCell[][], o: BuildXlsxOptions = {}): Record<string, string> {
  const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const lines = [headers as XlsxCell[], ...rows];
  const sheetRows = lines.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => cellXml(v, `${xlsxColumnName(j)}${i + 1}`)).join("")}</row>`).join("");
  const view = `<sheetViews><sheetView workbookViewId="0"${o.rtl ? ' rightToLeft="1"' : ""}/></sheetViews>`;
  return {
    "[Content_Types].xml": `${decl}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + "</Types>",
    "_rels/.rels": `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + "</Relationships>",
    "xl/workbook.xml": `${decl}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheets><sheet name="${xmlText(xlsxSheetName(o.sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + "</Relationships>",
    "xl/worksheets/sheet1.xml": `${decl}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}<sheetData>${sheetRows}</sheetData></worksheet>`,
  };
}

/** The XLSX file's bytes (see `buildXlsx`). */
export function buildXlsxBytes(headers: string[], rows: XlsxCell[][], o: BuildXlsxOptions = {}): Uint8Array {
  const enc = new TextEncoder();
  return zipStored(Object.entries(xlsxParts(headers, rows, o)).map(([name, xml]) => ({ name, data: enc.encode(xml) })));
}

/**
 * An XLSX file (one sheet: the header row, then the rows) as a Blob for `saveBlob(blob, "name.xlsx")` — what a host
 * writes when the Export dialog's file type is "Excel". Strings are text cells, finite numbers numeric cells, `null` an
 * empty cell.
 */
export function buildXlsx(headers: string[], rows: XlsxCell[][], o: BuildXlsxOptions = {}): Blob {
  return new Blob([buildXlsxBytes(headers, rows, o) as BlobPart], { type: XLSX_MIME });
}

/* ── Reader ────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface ZipEntry { name: string; method: number; data: Uint8Array }

/** The entries of a ZIP archive (central directory; stored or deflated, not yet inflated). Throws on a non-ZIP. */
export function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not an XLSX file (no ZIP directory).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Not an XLSX file (damaged ZIP directory).");
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    if (v.getUint32(lho, true) !== 0x04034b50) throw new Error("Not an XLSX file (damaged ZIP entry).");
    const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
    out.push({ name, method, data: bytes.subarray(start, start + csize) });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  const RS = (globalThis as { ReadableStream?: typeof ReadableStream }).ReadableStream;
  if (!DS || !RS) throw new Error("This browser cannot read compressed XLSX files (no DecompressionStream). Save the sheet as CSV and import that.");
  const src = new RS<Uint8Array>({ start(c) { c.enqueue(data); c.close(); } });
  const reader = src.pipeThrough(new DS("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

async function bytesOf(file: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  // realm-safe checks (a typed array from another frame or from Node's TextEncoder is not `instanceof` this Uint8Array)
  if (ArrayBuffer.isView(file)) return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  if (Object.prototype.toString.call(file) === "[object ArrayBuffer]") return new Uint8Array(file as ArrayBuffer);
  const b = file as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof b.arrayBuffer === "function") return new Uint8Array(await b.arrayBuffer());
  // older engines (and jsdom) have no Blob#arrayBuffer: FileReader
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error ?? new Error("The file could not be read."));
    r.readAsArrayBuffer(file as Blob);
  });
}

const childrenNamed = (el: Element, local: string): Element[] => [...el.childNodes].filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === local);
const descendantsNamed = (el: Element | Document, local: string): Element[] => [...el.getElementsByTagNameNS("*", local)];
/** The text of an `<si>` / `<is>`: every `<t>` run, phonetic runs (`<rPh>`) left out. */
function richText(el: Element): string {
  return descendantsNamed(el, "t").filter((t) => !t.parentElement || t.parentElement.localName !== "rPh").map((t) => t.textContent ?? "").join("");
}
/** "AB12" → 27 (0-based column). */
function columnIndex(ref: string): number {
  const m = /^([A-Za-z]+)/.exec(ref);
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]!.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
const parseXml = (text: string): Document => {
  if (typeof DOMParser === "undefined") throw new Error("parseXlsx needs the browser's DOMParser (it runs in the browser, not in plain Node).");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Not an XLSX file (unreadable XML).");
  return doc;
};
const resolvePath = (base: string, target: string): string => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); }
  return parts.join("/");
};

/**
 * The first sheet of an XLSX file as rows of strings (see the module notes). Rejects with a readable error for a file
 * that is not an XLSX workbook (e.g. a legacy `.xls`) or, without `DecompressionStream`, for a compressed one.
 */
export async function parseXlsx(file: Blob | ArrayBuffer | Uint8Array): Promise<string[][]> {
  const bytes = await bytesOf(file);
  if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error("Legacy .xls files are not supported. Save the sheet as .xlsx or CSV and import that.");
  }
  const entries = new Map(readZipEntries(bytes).map((e) => [e.name.replace(/^\/+/, ""), e]));
  const dec = new TextDecoder();
  const text = async (name: string): Promise<string | null> => {
    const e = entries.get(name);
    if (!e) return null;
    if (e.method === 0) return dec.decode(e.data);
    if (e.method === 8) return dec.decode(await inflateRaw(e.data));
    throw new Error(`Not supported: ${name} uses ZIP method ${e.method}.`);
  };
  // the first sheet: workbook.xml's first <sheet> → its relationship's target
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await text("xl/workbook.xml");
  if (!wb) throw new Error("Not an XLSX file (no workbook).");
  const first = descendantsNamed(parseXml(wb), "sheet")[0];
  const rid = first ? (first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? first.getAttribute("r:id")) : null;
  const rels = await text("xl/_rels/workbook.xml.rels");
  if (rid && rels) {
    const rel = descendantsNamed(parseXml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = resolvePath("xl/workbook.xml", target);
  }
  const sstXml = await text("xl/sharedStrings.xml");
  const shared = sstXml ? childrenNamed(parseXml(sstXml).documentElement, "si").map(richText) : [];
  const sheetXml = await text(sheetPath);
  if (sheetXml == null) throw new Error("Not an XLSX file (the first sheet is missing).");
  const out: string[][] = [];
  for (const row of descendantsNamed(parseXml(sheetXml), "row")) {
    const cells: string[] = [];
    let next = 0;
    for (const c of childrenNamed(row, "c")) {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref) : next;
      const at = col >= 0 ? col : next;
      const type = c.getAttribute("t") ?? "n";
      const v = childrenNamed(c, "v")[0]?.textContent ?? "";
      let value: string;
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") { const is = childrenNamed(c, "is")[0]; value = is ? richText(is) : ""; }
      else if (type === "b") value = v === "1" ? "TRUE" : v === "0" ? "FALSE" : v;
      else value = v; // n, str (formula text result), e (error code), d (ISO date)
      while (cells.length < at) cells.push("");
      cells[at] = value;
      next = at + 1;
    }
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length) out.push(cells);
  }
  return out;
}
