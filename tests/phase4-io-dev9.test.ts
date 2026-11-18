/**
 * 0.8.0-dev.9 — Phase 4 (CRM parity proposals): the Frappe-free helpers of gaps L-05 (`printListDocument` / `printList`),
 * L-06 / L-07 (`buildXlsx` writer, `parseXlsx` reader, `importFileHint`) and S-07 (`fuzzySearch` / `fillTemplate` /
 * `createRouteHistory` from the Core entry). Every import below is from the Core entry `../src` (= `@solvfast/ui`), except
 * the Frappe entry used to prove it still exports the same functions.
 *
 * XLSX: the writer's ZIP is parsed HERE by an independent reader (local headers walked by hand, CRC-32 checked with Node's
 * zlib), not by the package's own `readZipEntries`. The reader is tested on files written by other producers: LibreOffice
 * Calc's XLSX export (deflated entries + shared strings) and openpyxl (deflated, inline strings, booleans) — see
 * tests/fixtures/xlsx/make-fixture.py.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  DATA_IMPORT_LABELS_AR, DATA_IMPORT_LABELS_EN, PRINT_FRAME_ATTR, buildXlsx, buildXlsxBytes, createRouteHistory, fillTemplate, fuzzyMatch, fuzzySearch,
  importFileHint, parseCsv, parseXlsx, printList, printListDocument, xlsxColumnName, xlsxSheetName,
} from "../src";
import * as frappeEntry from "../src/frappe";

afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll(`iframe[${PRINT_FRAME_ATTR}]`).forEach((f) => f.remove()); });

const FIX = path.join(__dirname, "fixtures/xlsx");

/** An independent stored-ZIP walker: local file headers in order (name, method, CRC, sizes, data). */
function walkZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: { name: string; method: number; crc: number; csize: number; usize: number; flags: number; data: Uint8Array }[] = [];
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    const flags = v.getUint16(p + 6, true), method = v.getUint16(p + 8, true), crc = v.getUint32(p + 14, true);
    const csize = v.getUint32(p + 18, true), usize = v.getUint32(p + 22, true), n = v.getUint16(p + 26, true), x = v.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + n));
    const data = bytes.subarray(p + 30 + n + x, p + 30 + n + x + csize);
    out.push({ name, method, crc, csize, usize, flags, data });
    p += 30 + n + x + csize;
  }
  const rest = v.getUint32(p, true);
  return { entries: out, centralSig: rest };
}
const text = (b: Uint8Array) => new TextDecoder().decode(b);
/** Entry name → compression method, from the central directory (independent of the package's reader). */
function centralMethods(bytes: Uint8Array): Map<string, number> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  while (e > 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  const m = new Map<string, number>();
  let p = v.getUint32(e + 16, true);
  for (let i = 0; i < v.getUint16(e + 10, true); i++) {
    const n = v.getUint16(p + 28, true);
    m.set(new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + n)), v.getUint16(p + 10, true));
    p += 46 + n + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return m;
}

/* ── L-06 writer ────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("L-06 buildXlsx (dependency-free XLSX writer)", () => {
  const headers = ["ID", "Title", "Cost (SAR)"];
  const rows = [["R-1", "Pump <check> & \"seal\"", 12.5], ["R-2", "فحص المضخة", null], ["R-3", "bell\u0007 char", -3]];

  it("L-06.1 a stored ZIP with the five OOXML parts; each entry's CRC-32 (checked with zlib) and sizes are right; UTF-8 names", () => {
    const bytes = buildXlsxBytes(headers, rows);
    const { entries, centralSig } = walkZip(bytes);
    expect(entries.map((e) => e.name)).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]);
    for (const e of entries) {
      expect(e.method).toBe(0);
      expect(e.csize).toBe(e.usize);
      expect(e.crc).toBe(zlib.crc32(e.data));
      expect(e.flags & 0x0800).toBe(0x0800);
    }
    expect(centralSig).toBe(0x02014b50); // the central directory follows the entries
    // deterministic
    expect(Buffer.from(buildXlsxBytes(headers, rows)).equals(Buffer.from(bytes))).toBe(true);
  });

  it("L-06.2 the sheet: inline strings (escaped, control characters dropped), numeric cells, empty cells left out; workbook names the sheet", () => {
    const { entries } = walkZip(buildXlsxBytes(headers, rows, { sheetName: "Records: 2026/11?" }));
    const sheet = text(entries.find((e) => e.name === "xl/worksheets/sheet1.xml")!.data);
    expect(sheet).toContain('<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">ID</t></is></c>');
    expect(sheet).toContain('<c r="C1" t="inlineStr"><is><t xml:space="preserve">Cost (SAR)</t></is></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Pump &lt;check&gt; &amp; &quot;seal&quot;</t></is></c><c r="C2"><v>12.5</v></c>');
    expect(sheet).toContain('<row r="3"><c r="A3" t="inlineStr"><is><t xml:space="preserve">R-2</t></is></c><c r="B3" t="inlineStr"><is><t xml:space="preserve">فحص المضخة</t></is></c></row>');
    expect(sheet).toContain('<t xml:space="preserve">bell char</t>');
    expect(sheet).toContain('<c r="C4"><v>-3</v></c>');
    expect(sheet).not.toContain("rightToLeft");
    const wb = text(entries.find((e) => e.name === "xl/workbook.xml")!.data);
    expect(wb).toContain('<sheet name="Records  2026 11" sheetId="1" r:id="rId1"/>');
    const ct = text(entries.find((e) => e.name === "[Content_Types].xml")!.data);
    expect(ct).toContain('PartName="/xl/worksheets/sheet1.xml"');
  });

  it("L-06.3 rtl → the sheet view reads right to left; the Blob has the XLSX type and the same bytes", async () => {
    const { entries } = walkZip(buildXlsxBytes(["a"], [], { rtl: true }));
    expect(text(entries.find((e) => e.name === "xl/worksheets/sheet1.xml")!.data)).toContain('<sheetView workbookViewId="0" rightToLeft="1"/>');
    const blob = buildXlsx(headers, rows);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBe(buildXlsxBytes(headers, rows).length);
  });

  it("L-06.4 column names and sheet-name rules", () => {
    expect([0, 25, 26, 27, 701, 702].map(xlsxColumnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
    expect(xlsxSheetName("")).toBe("Sheet1");
    expect(xlsxSheetName("x".repeat(40))).toHaveLength(31);
    expect(xlsxSheetName("'a[b]'")).toBe("a b");
  });
});

/* ── L-06 / L-07 reader ─────────────────────────────────────────────────────────────────────────────────────────── */

describe("L-06 / L-07 parseXlsx (dependency-free XLSX reader)", () => {
  it("L-06.5 reads the writer's own (stored) file back: text, numbers, empty cells", async () => {
    const got = await parseXlsx(buildXlsxBytes(["ID", "Title", "Cost"], [["R-1", "Pump", 12.5], ["R-2", null, 7], ["", "", null]]));
    expect(got).toEqual([["ID", "Title", "Cost"], ["R-1", "Pump", "12.5"], ["R-2", "", "7"]]);
  });

  it("L-07.1 reads LibreOffice Calc's XLSX (DEFLATED entries, shared strings) exactly as the CSV it came from", async () => {
    const xlsx = new Uint8Array(fs.readFileSync(path.join(FIX, "libreoffice-shared-strings.xlsx")));
    const csv = parseCsv(fs.readFileSync(path.join(FIX, "libreoffice-shared-strings.csv"), "utf8"));
    expect(centralMethods(xlsx).get("xl/sharedStrings.xml")).toBe(8); // really deflated (LibreOffice also uses data descriptors)
    expect(centralMethods(xlsx).get("xl/worksheets/sheet1.xml")).toBe(8);
    const got = await parseXlsx(xlsx);
    // the CSV's empty trailing cell is not a cell in the sheet
    expect(got).toEqual(csv.map((r) => { const c = [...r]; while (c.length && c[c.length - 1] === "") c.pop(); return c; }));
    expect(got[2]).toEqual(["R-2", "فحص المضخة", "7"]);
  });

  it("L-07.2 reads openpyxl's XLSX (deflated, inline strings): booleans TRUE / FALSE, a missing cell as '', an empty row skipped", async () => {
    const got = await parseXlsx(new Uint8Array(fs.readFileSync(path.join(FIX, "openpyxl-inline.xlsx"))));
    expect(got).toEqual([
      ["ID", "Title", "Amount", "Done", "Note"],
      ["R-1", "Pump check", "12.5", "TRUE", "first"],
      ["R-2", "فحص المضخة", "7", "FALSE"],
      ["R-3", "Repeat", "12.5", "", "first"],
      ["", "after a blank row"],
    ]);
  });

  it("L-07.3 a File / Blob is read (FileReader where Blob#arrayBuffer is missing); a legacy .xls or a non-ZIP is refused with a readable error", async () => {
    const file = new File([fs.readFileSync(path.join(FIX, "libreoffice-shared-strings.xlsx"))], "x.xlsx");
    expect((await parseXlsx(file))[0]).toEqual(["ID", "Title", "Amount", "Note"]);
    const ole = new Uint8Array(512); ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(parseXlsx(ole)).rejects.toThrow(/Legacy \.xls/);
    await expect(parseXlsx(new TextEncoder().encode("a,b\n1,2\n"))).rejects.toThrow(/Not an XLSX file/);
  });
});

/* ── L-07 hint ──────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("L-07 importFileHint", () => {
  it("L-07.4 names what `accept` lists; the default accept gives today's catalogue hint; unnamed types → null", () => {
    expect(importFileHint(".csv")).toBe("CSV");
    expect(importFileHint(".csv,.xlsx")).toBe("CSV or XLSX");
    expect(importFileHint(" .CSV , text/csv, .xlsx ")).toBe("CSV or XLSX");
    expect(importFileHint(".csv,.xls,.xlsx")).toBe(DATA_IMPORT_LABELS_EN.fileHint);
    expect(importFileHint(".csv,.xlsx,.xls")).toBe(DATA_IMPORT_LABELS_EN.fileHint); // known types in a fixed order
    expect(importFileHint(".xlsx,.csv")).toBe("CSV or XLSX");
    expect(importFileHint(".json,.csv,.xml")).toBe("CSV, JSON or XML"); // others after the known ones, in accept order
    expect(importFileHint(".csv,.xls,.xlsx", "ar")).toBe(DATA_IMPORT_LABELS_AR.fileHint);
    expect(importFileHint(".csv,.xlsx", "ar")).toBe("CSV أو XLSX");
    expect(importFileHint("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("XLSX");
    expect(importFileHint("image/*")).toBeNull();
    expect(importFileHint("")).toBeNull();
  });
});

/* ── L-05 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("L-05 printListDocument / printList", () => {
  const columns = [{ key: "id", label: "ID" }, { key: "title", label: "Title" }, { key: "cost", label: "Cost", align: "end" as const }];
  const rows = Array.from({ length: 46 }, (_, i) => ({ id: `R-${1000 + i}`, title: i === 3 ? "<script>alert(1)</script>" : `Item ${i}`, cost: String(i * 10) }));

  it("L-05.1 a complete document: the heading, '{n} records', one table with exactly the given columns and ALL rows, values escaped, no app chrome", () => {
    const html = printListDocument({ title: "Records · filtered", subtitle: "Search: pump", columns, rows });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(doc.querySelector("h1")!.textContent).toBe("Records · filtered");
    expect(doc.querySelector(".sf-print-list-sub")!.textContent).toBe("Search: pump");
    expect(doc.querySelector(".sf-print-list-count")!.textContent).toBe("46 records");
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect([...doc.querySelectorAll("thead th")].map((t) => t.textContent)).toEqual(["ID", "Title", "Cost"]);
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(46);
    expect(doc.querySelector("tbody tr:nth-child(4) td:nth-child(2)")!.textContent).toBe("<script>alert(1)</script>");
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelectorAll("input, button, nav, [role=checkbox]")).toHaveLength(0);
    expect(doc.querySelector("tbody tr td:nth-child(3)")!.className).toBe("end");
    expect(html).toContain("script-src 'none'");
    expect(doc.documentElement.getAttribute("dir")).toBe("ltr");
  });

  it("L-05.2 RTL / Arabic: dir and lang on the document, the Arabic count line; one row → '1 record'; no rows → the empty line", () => {
    const ar = new DOMParser().parseFromString(printListDocument({ title: "السجلات", columns, rows: rows.slice(0, 8), dir: "rtl", lang: "ar" }), "text/html");
    expect(ar.documentElement.getAttribute("dir")).toBe("rtl");
    expect(ar.documentElement.getAttribute("lang")).toBe("ar");
    expect(ar.querySelector(".sf-print-list-count")!.textContent).toBe("عدد السجلات: 8");
    const one = new DOMParser().parseFromString(printListDocument({ title: "T", columns, rows: rows.slice(0, 1) }), "text/html");
    expect(one.querySelector(".sf-print-list-count")!.textContent).toBe("1 record");
    const none = new DOMParser().parseFromString(printListDocument({ title: "T", columns, rows: [], countLabel: "{n} items" }), "text/html");
    expect(none.querySelector(".sf-print-list-count")!.textContent).toBe("0 items");
    expect(none.querySelector("table")).toBeNull();
    expect(none.querySelector(".sf-print-list-empty")!.textContent).toBe("No records");
  });

  it("L-05.3 printList prints that document from the hidden print frame (printHtmlDocument), never the app window", async () => {
    const appPrint = vi.spyOn(window, "print").mockImplementation(() => {});
    const o = { title: "T", columns, rows: rows.slice(0, 2) };
    const done = printList(o, { fontTimeoutMs: 0 });
    const frame = document.querySelector(`iframe[${PRINT_FRAME_ATTR}]`) as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toBe(printListDocument(o));
    const framePrint = vi.fn();
    (frame.contentWindow as Window).print = framePrint;
    (frame.contentWindow as Window).focus = () => {};
    frame.dispatchEvent(new Event("load"));
    await done;
    expect(framePrint).toHaveBeenCalledTimes(1);
    expect(appPrint).not.toHaveBeenCalled();
  });
});

/* ── S-07 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("S-07 Core search helpers (fuzzySearch, fillTemplate, createRouteHistory)", () => {
  it("S-07.1 the Core entry exports Desk's ranking; the Frappe entry still exports the SAME functions", () => {
    expect(fuzzySearch).toBe(frappeEntry.fuzzySearch);
    expect(fillTemplate).toBe(frappeEntry.fillTemplate);
    expect(fuzzyMatch).toBe(frappeEntry.fuzzyMatch);
    const hit = fuzzySearch("pmp", "Pump check");
    expect(hit.score).toBeGreaterThan(0);
    expect(hit.marks).toEqual([0, 2, 3]);
    expect(fuzzySearch("zz", "Pump").score).toBe(0);
    expect(fillTemplate("New {0}", "Pump", [0, 1])).toEqual({ text: "New Pump", marks: [4, 5] });
  });

  it("S-07.2 createRouteHistory: record / list (oldest first) / recent (newest first), capped at max, optional de-duplication", () => {
    const h = createRouteHistory<string>({ max: 3 });
    for (const r of ["/a", "/b", "/a", "/c"]) h.record(r);
    expect(h.list()).toEqual(["/b", "/a", "/c"]);
    expect(h.recent(2)).toEqual(["/c", "/a"]);
    const d = createRouteHistory<{ path: string }>({ equals: (x, y) => x.path === y.path });
    d.record({ path: "/a" }); d.record({ path: "/b" }); d.record({ path: "/a" });
    expect(d.list().map((x) => x.path)).toEqual(["/b", "/a"]);
    d.clear();
    expect(d.list()).toEqual([]);
  });

  it("S-07.3 with storage the history survives a new instance; a throwing storage leaves it working in memory", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    const a = createRouteHistory<string>({ storage, key: "k" });
    a.record("/x"); a.record("/y");
    expect(createRouteHistory<string>({ storage, key: "k" }).list()).toEqual(["/x", "/y"]);
    const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    const b = createRouteHistory<string>({ storage: bad });
    b.record("/z");
    expect(b.list()).toEqual(["/z"]);
  });
});
