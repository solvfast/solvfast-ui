/**
 * P36e print (Core, Frappe-free): the print composer (`composePrintDocument`: @page in mm, page breaks, dir / lang,
 * escaping, CSP), the browser-print helper (`printHtmlDocument`), the Print Documents dialog (`PrintDocumentsDialog`:
 * Desk's field order, props in / callbacks out, Custom size validation, RTL) and the print page (`PrintView` /
 * `PrintViewDialog`). The Frappe components rendered on them keep their own tests (tests/list-actions.test.tsx,
 * tests/frappe-record-actions.test.tsx, tests/frappe-form-integration.test.tsx); P36E.print.9-10 add the page variant.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src";
import {
  NO_LETTERHEAD, PRINT_FRAME_ATTR, PRINT_PAGE_SIZES, PRINT_PAGE_SIZE_MM, PrintDocumentsDialog, PrintPreviewFrame, PrintView, PrintViewDialog,
  composePrintDocument, escapeHtml, isValidPrintPage, pageCss, pageDimensionsMm, printHtmlDocument, printPageOf, type PrintDocumentsValue,
} from "../src/record";
import { PRINT_PAGE_SIZES as FRAPPE_SIZES, NO_LETTERHEAD as FRAPPE_NO_LH, pdfOptions } from "../src/frappe/list/print";
import { defaultMessages } from "../src/theme/messages";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeFormPrint } from "../src/frappe/record/FrappeFormPrint";
const { en: enMsgs, ar: arMsgs } = defaultMessages;

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const en = (k: keyof typeof enMsgs) => enMsgs[k];
const mount = (ui: React.ReactElement, lang: "en" | "ar" = "en") =>
  render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

describe("composePrintDocument / page sizes (Core)", () => {
  it("P36E.print.1 every Desk page size (meta.js:217-251) has mm dimensions; the Frappe layer re-exports the same list", () => {
    expect(FRAPPE_SIZES).toBe(PRINT_PAGE_SIZES);
    expect(FRAPPE_NO_LH).toBe(NO_LETTERHEAD);
    for (const s of PRINT_PAGE_SIZES) if (s !== "Custom") expect(PRINT_PAGE_SIZE_MM[s], s).toBeDefined();
    expect(pageDimensionsMm({ pageSize: "A4" })).toEqual({ widthMm: 210, heightMm: 297 });
    expect(pageDimensionsMm({ pageSize: "A4", orientation: "landscape" })).toEqual({ widthMm: 297, heightMm: 210 });
    expect(pageDimensionsMm({ pageSize: "Ledger", orientation: "portrait" })).toEqual({ widthMm: 279.4, heightMm: 431.8 });
    expect(pageCss({ pageSize: "Letter" })).toBe("@page { size: 215.9mm 279.4mm; margin: 14mm; }");
    expect(pageCss({ pageSize: "Custom", heightMm: 100, widthMm: 80, margin: "5mm" })).toBe("@page { size: 80mm 100mm; margin: 5mm; }");
    expect(pageCss({ pageSize: "A5", margin: "1mm;}body{display:none" })).toBe("@page { size: 148mm 210mm; margin: 14mm; }"); // unsafe margin ignored
  });

  it("P36E.print.2 Custom size: height and width must be > 0 (bulk_operations.js:104-106; empty refused too), as pdfOptions", () => {
    for (const [h, w] of [[0, 100], [100, 0], [NaN, 100], [-5, 10], [undefined, 10]] as const) {
      expect(isValidPrintPage({ pageSize: "Custom", heightMm: h, widthMm: w })).toBe(false);
      expect(() => pageDimensionsMm({ pageSize: "Custom", heightMm: h, widthMm: w })).toThrow("Page height and width cannot be zero");
      expect(() => pdfOptions("Custom", h, w)).toThrow();
    }
    expect(isValidPrintPage({ pageSize: "Custom", heightMm: 120.5, widthMm: 90 })).toBe(true);
    expect(isValidPrintPage({ pageSize: "Nope" })).toBe(false);
    expect(printPageOf({ pageSize: "Custom", pageHeight: "120", pageWidth: "90" })).toEqual({ pageSize: "Custom", heightMm: 120, widthMm: 90 });
    expect(printPageOf({ pageSize: "B5", pageHeight: "", pageWidth: "" })).toEqual({ pageSize: "B5" });
  });

  it("P36E.print.3 one document per sheet (page break between documents), @page, dir / lang, escaped title, no-script CSP, </style neutralised", () => {
    const html = composePrintDocument({
      documents: ["<h1>One</h1>", "<h1>Two</h1>", "<h1>Three</h1>"], style: "h1{color:red}</style><script>alert(1)</script>",
      page: { pageSize: "A5" }, dir: "rtl", lang: "ar", title: `Leads "<b>"`, stylesheets: ["https://fonts.example/x.css", "javascript:alert(1)", "http://x/y.css"],
    });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.documentElement.getAttribute("dir")).toBe("rtl");
    expect(doc.documentElement.getAttribute("lang")).toBe("ar");
    expect(doc.title).toBe(`Leads "<b>"`);
    expect(html).toContain("<title>Leads &quot;&lt;b&gt;&quot;</title>");
    expect(doc.querySelectorAll(".sf-print-doc")).toHaveLength(3);
    expect([...doc.querySelectorAll(".sf-print-doc")].map((d) => d.textContent)).toEqual(["One", "Two", "Three"]);
    const css = doc.querySelector("style")!.textContent!;
    expect(css).toContain("@page { size: 148mm 210mm; margin: 14mm; }");
    expect(css).toContain(".sf-print-doc+.sf-print-doc{break-before:page;page-break-before:always}");
    expect(html).not.toMatch(/<\/style><script>/);
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute("content")!;
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect([...doc.querySelectorAll("link")].map((l) => l.getAttribute("href"))).toEqual(["https://fonts.example/x.css"]); // only https: URLs
    expect(composePrintDocument({ documents: ["x"], page: { pageSize: "A4" } })).toContain('<html dir="ltr">');
    expect(() => composePrintDocument({ documents: ["x"], page: { pageSize: "Custom" } })).toThrow();
    expect(escapeHtml(`<img src=x onerror="a('1')">&`)).toBe("&lt;img src=x onerror=&quot;a(&#39;1&#39;)&quot;&gt;&amp;");
  });

  it("P36E.print.4 PrintPreviewFrame shows the composed document as-is, still sandboxed", () => {
    const doc = composePrintDocument({ documents: ["<p>Hello</p>"], page: { pageSize: "A4" } });
    mount(<PrintPreviewFrame title="Preview" srcDoc={doc} />);
    const frame = screen.getByTitle("Preview");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe(doc);
  });
});

describe("printHtmlDocument (Core browser print)", () => {
  it("P36E.print.5 prints the document from a hidden same-origin frame (not the app window), replaces a previous frame, removes it after printing", async () => {
    const appPrint = vi.spyOn(window, "print").mockImplementation(() => {});
    const doc = composePrintDocument({ documents: ["<p>A</p>", "<p>B</p>"], page: { pageSize: "A4" } });
    const stale = document.createElement("iframe"); stale.setAttribute(PRINT_FRAME_ATTR, ""); document.body.appendChild(stale);
    const done = printHtmlDocument(doc, { fontTimeoutMs: 0 });
    const frames = document.querySelectorAll(`iframe[${PRINT_FRAME_ATTR}]`);
    expect(frames).toHaveLength(1);
    const frame = frames[0] as HTMLIFrameElement;
    expect(frame).not.toBe(stale);
    expect(frame.getAttribute("srcdoc")).toBe(doc);
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    const framePrint = vi.fn();
    (frame.contentWindow as Window).print = framePrint;
    (frame.contentWindow as Window).focus = () => {};
    frame.dispatchEvent(new Event("load"));
    await done;
    expect(framePrint).toHaveBeenCalledTimes(1);
    expect(appPrint).not.toHaveBeenCalled();
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    await waitFor(() => expect(document.querySelector(`iframe[${PRINT_FRAME_ATTR}]`)).toBeNull());
    appPrint.mockRestore();
  });
});

function DocsHarness(p: { initial?: Partial<PrintDocumentsValue>; onPrint?: (v: PrintDocumentsValue) => void; background?: { forced?: boolean }; languages?: boolean; preview?: boolean; onChange?: (v: PrintDocumentsValue) => void }) {
  const [v, setV] = React.useState<PrintDocumentsValue>({ letterhead: "Brand", format: "Standard", pageSize: "A4", pageHeight: "", pageWidth: "", language: "en", ...p.initial });
  return (
    <PrintDocumentsDialog open onOpenChange={() => {}} description="Lead · 3" letterheads={["Brand", NO_LETTERHEAD]} formats={["Standard", "Summary"]}
      value={v} onValueChange={(n) => { setV(n); p.onChange?.(n); }} onPrint={(x) => p.onPrint?.(x)} background={p.background}
      languages={p.languages ? [{ value: "en", label: "English" }, { value: "ar", label: "العربية" }] : undefined}
      preview={p.preview ? <div data-testid="preview">{v.format} · {v.pageSize}</div> : undefined} />
  );
}

describe("PrintDocumentsDialog (Core)", () => {
  it("P36E.print.6 Desk's fields in order (Letter Head, Print Format, Page Size, then Language); no Background row unless given; the preview follows the value; Print → onPrint(value)", async () => {
    const onPrint = vi.fn();
    mount(<DocsHarness onPrint={onPrint} languages preview />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en("listPrintTitle"))).toBeTruthy();
    expect(within(dialog).getByText("Lead · 3")).toBeTruthy();
    expect(within(dialog).getAllByRole("combobox").map((c) => c.getAttribute("aria-label"))).toEqual([en("listPrintLetterhead"), en("listPrintFormat"), en("listPrintPageSize"), "Language"]);
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    expect(within(dialog).getByTestId("preview").textContent).toBe("Standard · A4");
    fireEvent.click(within(dialog).getByRole("combobox", { name: en("listPrintFormat") }));
    fireEvent.click(await screen.findByRole("option", { name: "Summary" }));
    fireEvent.click(within(dialog).getByRole("combobox", { name: en("listPrintPageSize") }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([...PRINT_PAGE_SIZES]);
    fireEvent.click(screen.getByRole("option", { name: "A5" }));
    await waitFor(() => expect(within(dialog).getByTestId("preview").textContent).toBe("Summary · A5"));
    fireEvent.click(within(dialog).getByRole("combobox", { name: en("listPrintLetterhead") }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Brand", "No Letterhead"]);
    fireEvent.click(screen.getByRole("option", { name: "No Letterhead" }));
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ letterhead: NO_LETTERHEAD, format: "Summary", pageSize: "A5", language: "en" }));
  });

  it("P36E.print.7 Custom asks height / width in mm; a zero or empty value is refused with Desk's message and onPrint is not called; valid values print", async () => {
    const onPrint = vi.fn();
    mount(<DocsHarness onPrint={onPrint} initial={{ pageSize: "Custom" }} />);
    const dialog = await screen.findByRole("dialog");
    const h = within(dialog).getByLabelText(en("listPrintPageHeight"));
    const w = within(dialog).getByLabelText(en("listPrintPageWidth"));
    fireEvent.change(h, { target: { value: "0" } });
    fireEvent.change(w, { target: { value: "90" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(en("listPrintSizeZero"));
    expect(h.getAttribute("aria-invalid")).toBe("true");
    expect(onPrint).not.toHaveBeenCalled();
    fireEvent.change(h, { target: { value: "120" } });
    expect(within(dialog).queryByRole("alert")).toBeNull(); // editing clears the error
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ pageSize: "Custom", pageHeight: "120", pageWidth: "90" }));
  });

  it("P36E.print.8 Arabic / RTL: translated labels and Background Print row (forced = checked + read-only) when the host passes it", async () => {
    mount(<DocsHarness background={{ forced: true }} initial={{ background: true }} />, "ar");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
    expect(within(dialog).getByText(arMsgs.listPrintTitle)).toBeTruthy();
    expect(within(dialog).getByRole("combobox", { name: arMsgs.listPrintPageSize })).toBeTruthy();
    const bg = within(dialog).getByRole("checkbox", { name: arMsgs.listPrintBackground });
    expect(bg.getAttribute("data-state")).toBe("checked");
    expect((bg as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByRole("button", { name: arMsgs.listBulkPrint })).toBeTruthy();
  });
});

describe("PrintView / PrintViewDialog (Core)", () => {
  const base = { title: "Lead L-1", formats: ["Standard", "Summary"], format: "Standard", letterheads: ["Brand", NO_LETTERHEAD], letterhead: "Brand" };
  it("P36E.print.9 page variant: Desk's sidebar order (Print Format, Language, Letter Head), the Form button, a Print button; changes come out as callbacks", async () => {
    const onPrint = vi.fn(); const onBack = vi.fn(); const onFormat = vi.fn(); const onLang = vi.fn(); const onLh = vi.fn();
    mount(<PrintView {...base} onFormatChange={onFormat} onLetterheadChange={onLh} languages={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} language="en"
      onLanguageChange={onLang} onPrint={onPrint} onBack={onBack} backLabel="Back to L-1" preview={<div data-testid="pv" />} hint="browser" />);
    expect(screen.getByRole("heading", { name: "Lead L-1" })).toBeTruthy();
    expect(screen.getAllByRole("combobox").map((c) => c.getAttribute("aria-label"))).toEqual(["Print Format", "Language", "Letter Head"]);
    fireEvent.click(screen.getByRole("button", { name: "Back to L-1" }));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Print$/ }));
    expect(onPrint).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(await screen.findByRole("option", { name: "العربية" }));
    expect(onLang).toHaveBeenCalledWith("ar");
    fireEvent.click(screen.getByRole("combobox", { name: "Letter Head" }));
    fireEvent.click(await screen.findByRole("option", { name: "No Letterhead" }));
    expect(onLh).toHaveBeenCalledWith(NO_LETTERHEAD);
    expect(screen.getByTestId("pv")).toBeTruthy();
    expect(screen.getByText("browser")).toBeTruthy();
  });

  it("P36E.print.10 blocked: the reason replaces the selectors, the preview and Print; the dialog variant with a link Print (Frappe's /printview)", async () => {
    const { unmount } = mount(<PrintView {...base} onFormatChange={() => {}} onLetterheadChange={() => {}} onPrint={() => {}} blocked="Save the document before printing." preview={<div data-testid="pv" />} />);
    expect(screen.getByRole("alert").textContent).toBe("Save the document before printing.");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByTestId("pv")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Print$/ })).toBeNull();
    unmount();
    mount(<PrintViewDialog open onOpenChange={() => {}} {...base} onFormatChange={() => {}} onLetterheadChange={() => {}} printHref="/printview?x=1&trigger_print=1" />);
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByRole("link", { name: /^Print$/ }).getAttribute("href")).toBe("/printview?x=1&trigger_print=1");
  });
});

describe("FrappeFormPrint on the Core PrintView (SIMULATED backend)", () => {
  const META = { name: "Deal", module: "CRM", fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }], __print_formats: [{ name: "Deal Fancy" }],
    permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, print: 1 }] } as unknown as DocTypeMeta;
  it("P36E.print.11 variant=\"page\": Desk's print page in place — the Form button, Print as /printview link, server preview (get_html_and_style)", async () => {
    const t = createFixtureTransport({ meta: { Deal: [META] }, docs: {
      Deal: [{ doctype: "Deal", name: "D-1", title: "Big", docstatus: 0, owner: "Administrator", modified: "2026-01-01 00:00:00", creation: "2026-01-01 00:00:00" }] as FrappeDoc[],
      "Letter Head": [{ doctype: "Letter Head", name: "Acme", letter_head_name: "Acme", is_default: 1, disabled: 0 }] as FrappeDoc[],
    } });
    const client = createFrappeClient({ transport: t, files: t.files });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onBack = vi.fn();
    render(<QueryClientProvider client={qc}><FrappeProvider client={client} queryClient={qc} session={{ user: "Administrator", roles: ["System Manager"] }} serverMessages={false}>
      <ThemeProvider><FrappeFormPrint variant="page" doc={t.store.docs.get("Deal")!.get("D-1")!} meta={META} open onOpenChange={() => {}} canPrint onBack={onBack} backLabel="Form" /></ThemeProvider>
    </FrappeProvider></QueryClientProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Print Deal D-1" })).toBeTruthy();
    expect(await screen.findByTitle("Print preview of Deal D-1")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Letter Head" }).textContent).toBe("Acme"));
    expect(screen.getByRole("link", { name: /^Print$/ }).getAttribute("href")).toContain("trigger_print=1");
    expect(t.store.calls.some((c) => c.method === "frappe.www.printview.get_html_and_style")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    expect(onBack).toHaveBeenCalled();
  });
});
