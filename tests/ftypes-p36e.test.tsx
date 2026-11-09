/**
 * P36e ftypes — Signature, Icon, Barcode (partial) and Geolocation (partial) through FrappeField from a DocField:
 * stored-value round-trip in Desk's format, read-only, reqd, empty state, RTL, permlevel / depends_on through the
 * existing FrappeFormView paths, and negatives (unsafe SVG markup is sanitized; invalid GeoJSON does not crash).
 * jsdom unit level. jsdom has no canvas and no PointerEvent: the canvas 2D context and `toDataURL` are stubbed (the
 * stub records the drawing calls) and PointerEvent is a MouseEvent subclass — evidence of the control's logic, not of a
 * browser's rendering. No Frappe site is involved.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField, FrappeFormView, SUPPORTED_FIELDTYPES, PARTIAL_FIELDTYPES, analyzeFieldtypes, FRAPPE_ICON_NAMES, deskIconNames } from "../src/frappe/form";
import { sanitizeSvg, parseBarcodeValue, parseGeolocation, isSignatureDataUrl } from "../src/fields";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DRAWN = "data:image/png;base64,RFJBV04=";
const BARCODE_SVG = '<svg width="100%" height="142px" x="0px" y="0px" viewBox="0 0 314 142" xmlns="http://www.w3.org/2000/svg" version="1.1" style="transform: translate(0,0)" data-barcode-value="6281000000001"><rect x="0" y="0" width="314" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="3" height="100"></rect><text style="font: 16px monospace" text-anchor="middle" x="147" y="122">6281000000001</text></g></svg>';
const GEO = JSON.stringify({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [46.67, 24.71] } },
    { type: "Feature", properties: { point_type: "circle", radius: 120.5 }, geometry: { type: "Point", coordinates: [39.2, 21.5] } },
    { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
  ],
});

type Ctx = { calls: [string, ...unknown[]][] } & Record<string, unknown>;
let ctx: Ctx;
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
  const w = window as unknown as Record<string, unknown>;
  w.PointerEvent ??= class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "mouse"; }
  };
});
beforeEach(() => {
  const calls: [string, ...unknown[]][] = [];
  const rec = (name: string) => (...a: unknown[]) => { calls.push([name, ...a]); };
  ctx = { calls, clearRect: rec("clearRect"), drawImage: rec("drawImage"), beginPath: rec("beginPath"), moveTo: rec("moveTo"), lineTo: rec("lineTo"), stroke: rec("stroke") };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => DRAWN);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById("all-symbols")?.remove(); });

function Providers({ lang = "en", children }: { lang?: "en" | "ar"; children: React.ReactNode }) {
  const transport = React.useMemo(() => createFixtureTransport({ meta: {} }), []);
  const client = React.useMemo(() => createFrappeClient({ transport }), [transport]);
  const qc = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
  return (
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }}>{children}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** A FrappeField that keeps its value (as a form would) and logs every onChange. */
function Live({ df, initial, log, status }: { df: FrappeDocField; initial: unknown; log: unknown[]; status?: FieldDisplayStatus }) {
  const [value, setValue] = React.useState<unknown>(initial);
  return <FrappeField df={df} value={value} onChange={(v) => { log.push(v); setValue(v); }} status={status} />;
}
const field = (df: Partial<FrappeDocField> & { fieldtype: string }, initial: unknown, opts: { status?: FieldDisplayStatus; lang?: "en" | "ar" } = {}) => {
  const log: unknown[] = [];
  const full = { fieldname: df.fieldname ?? "f", label: df.label ?? "Field", ...df } as FrappeDocField;
  const utils = render(<Providers lang={opts.lang}><Live df={full} initial={initial} log={log} status={opts.status} /></Providers>);
  return { log, ...utils };
};
const en = defaultMessages.en;
const ar = defaultMessages.ar;
const pad = () => document.querySelector("canvas[data-signature-pad]") as HTMLCanvasElement;
function drawStroke(c: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(c, { clientX: from[0], clientY: from[1], pointerId: 1, button: 0, pointerType: "pen" });
  fireEvent.pointerMove(c, { clientX: to[0], clientY: to[1], pointerId: 1, pointerType: "pen" });
  fireEvent.pointerUp(c, { clientX: to[0], clientY: to[1], pointerId: 1, pointerType: "pen" });
}

describe("P36e ftypes — the four types are dispatched (no raw-value fallback)", () => {
  it("P36E.ftypes.1 SUPPORTED_FIELDTYPES has Signature / Icon / Barcode / Geolocation; Barcode and Geolocation are PARTIAL; a custom type still falls back and is reported", () => {
    for (const ft of ["Signature", "Icon", "Barcode", "Geolocation"]) expect(SUPPORTED_FIELDTYPES.has(ft), ft).toBe(true);
    expect([...PARTIAL_FIELDTYPES].sort()).toEqual(["Barcode", "Geolocation"]);
    const bundle: MetaBundle = { doctype: "X", children: {}, meta: { name: "X", fields: [
      { fieldname: "s", fieldtype: "Signature" }, { fieldname: "i", fieldtype: "Icon" }, { fieldname: "b", fieldtype: "Barcode" },
      { fieldname: "g", fieldtype: "Geolocation" }, { fieldname: "c", fieldtype: "My Custom" },
    ] } };
    expect(analyzeFieldtypes(bundle).map((i) => i.fieldtype)).toEqual(["My Custom"]);
    for (const [ft, v] of [["Signature", PNG], ["Icon", "lock"], ["Barcode", BARCODE_SVG], ["Geolocation", GEO]] as const) {
      field({ fieldtype: ft }, v, { status: "Write" });
      expect(document.querySelector("[data-unsupported-fieldtype]"), ft).toBeNull();
      cleanup();
    }
  });
});

describe("P36e ftypes — Signature (signature.js)", () => {
  it("P36E.ftypes.2 drawing a stroke stores the canvas PNG data URL; Undo of the only stroke and Clear store \"\" (signature.js:125-135)", () => {
    const { log } = field({ fieldtype: "Signature", label: "Sign" }, "", { status: "Write" });
    const c = pad();
    expect(c.getAttribute("aria-label")).toBe(en.ftSignaturePad);
    expect(screen.getByText(en.ftSignatureHint)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(en.ftSignatureEmpty);
    drawStroke(c, [10, 20], [60, 40]);
    expect(log).toEqual([DRAWN]);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith("image/png");
    expect(screen.getByRole("status").textContent).toBe(en.ftSignatureSigned);
    fireEvent.click(screen.getByRole("button", { name: en.ftSignatureUndo }));
    expect(log).toEqual([DRAWN, ""]);
    drawStroke(c, [5, 5], [6, 6]);
    fireEvent.click(screen.getByRole("button", { name: en.ftSignatureClear }));
    expect(log).toEqual([DRAWN, "", DRAWN, ""]);
    expect((screen.getByRole("button", { name: en.ftSignatureUndo }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("P36E.ftypes.3 a stored signature is drawn back onto the pad as the base image; a new stroke adds to it (jSignature setData)", () => {
    const imgs: { src: string; onload: (() => void) | null }[] = [];
    vi.spyOn(window, "Image").mockImplementation(function (this: unknown) {
      const o = { src: "", onload: null as (() => void) | null, complete: true, naturalWidth: 300, naturalHeight: 100 };
      imgs.push(o);
      return o as unknown as HTMLImageElement;
    } as unknown as () => HTMLImageElement);
    const { log } = field({ fieldtype: "Signature" }, PNG, { status: "Write" });
    expect(imgs.map((i) => i.src)).toEqual([PNG]);
    act(() => imgs[0].onload?.());
    expect(ctx.calls.some(([n]) => n === "drawImage")).toBe(true);
    // Undo has nothing to undo (the stored image is not a stroke); Clear empties the value
    expect((screen.getByRole("button", { name: en.ftSignatureUndo }) as HTMLButtonElement).disabled).toBe(true);
    drawStroke(pad(), [1, 1], [2, 2]);
    expect(log).toEqual([DRAWN]);
    // undoing the new stroke keeps the stored image: the PNG is exported again (not "")
    fireEvent.click(screen.getByRole("button", { name: en.ftSignatureUndo }));
    expect(log).toEqual([DRAWN, DRAWN]);
  });

  it("P36E.ftypes.4 read-only shows the stored image (no pad, no buttons); empty shows the empty state; a non-image value is not put in an <img>", () => {
    field({ fieldtype: "Signature", label: "Sign" }, PNG, { status: "Read" });
    expect(pad()).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect((screen.getByRole("img", { name: en.ftSignatureImage }) as HTMLImageElement).getAttribute("src")).toBe(PNG);
    expect(screen.getByRole("group", { name: "Sign" })).toBeTruthy();
    cleanup();
    field({ fieldtype: "Signature" }, "", { status: "Read" });
    expect(screen.getByText(en.ftSignatureEmpty)).toBeTruthy();
    cleanup();
    field({ fieldtype: "Signature" }, "javascript:alert(1)", { status: "Read" });
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(en.ftSignatureInvalid)).toBeTruthy();
    expect(isSignatureDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isSignatureDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
  });

  it("P36E.ftypes.5 a read_only DocField is Read through the status ladder; an EMPTY read-only Signature is hidden as in Desk (not SHOW_WHEN_EMPTY)", () => {
    field({ fieldtype: "Signature", label: "Sign", read_only: 1 }, PNG);
    expect(pad()).toBeNull();
    expect(screen.getByRole("img", { name: en.ftSignatureImage })).toBeTruthy();
    cleanup();
    const { container } = field({ fieldtype: "Signature", label: "Sign", read_only: 1 }, "");
    expect(container.textContent).toBe("");
  });

  it("P36E.ftypes.6 reqd: the label carries the required mark and an empty pad is flagged; drawing clears the flag", () => {
    field({ fieldtype: "Signature", label: "Sign", reqd: 1 }, "", { status: "Write" });
    expect(screen.getByText("*")).toBeTruthy();
    const frame = pad().parentElement!;
    expect(frame.className).toContain("ring-destructive");
    drawStroke(pad(), [3, 3], [9, 9]);
    expect(pad().parentElement!.className).not.toContain("ring-destructive");
  });

  it("P36E.ftypes.7 RTL (Arabic): Arabic chrome; the drawing is NOT mirrored (pointer x maps to the same canvas x)", () => {
    const { log } = field({ fieldtype: "Signature", label: "Sign" }, "", { status: "Write", lang: "ar" });
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(pad().getAttribute("aria-label")).toBe(ar.ftSignaturePad);
    expect(screen.getByRole("button", { name: ar.ftSignatureClear })).toBeTruthy();
    vi.spyOn(pad(), "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: pad().width, height: pad().height, right: 0, bottom: 0, x: 100, y: 50, toJSON: () => ({}) } as DOMRect);
    drawStroke(pad(), [110, 60], [150, 90]);
    const moves = ctx.calls.filter(([n]) => n === "moveTo");
    expect(moves.at(-1)).toEqual(["moveTo", 10, 10]);
    expect(ctx.calls.filter(([n]) => n === "lineTo").at(-1)).toEqual(["lineTo", 50, 40]);
    expect(log).toEqual([DRAWN]);
  });

  it("P36E.ftypes.8 without canvas support the pad says drawing is unavailable and nothing is written", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { log } = field({ fieldtype: "Signature" }, "", { status: "Write" });
    expect(screen.getAllByText(en.ftSignatureNoCanvas).length).toBeGreaterThan(0);
    drawStroke(pad(), [1, 1], [5, 5]);
    expect(log).toEqual([]);
  });
});

describe("P36e ftypes — Icon (icon.js, icon_picker.js)", () => {
  const sprite = (names: string[]) => {
    const d = document.createElement("div");
    d.id = "all-symbols";
    d.innerHTML = `<svg>${names.map((n) => `<symbol id="${n}"></symbol>`).join("")}</svg>`;
    document.body.appendChild(d);
  };

  it("P36E.ftypes.9 the picker searches the names and stores the chosen NAME; typing a name stores it on blur; an empty value never stores folder-normal", async () => {
    const { log } = field({ fieldtype: "Icon", label: "Icon" }, "", { status: "Write" });
    const input = screen.getByRole("textbox", { name: "Icon" }) as HTMLInputElement;
    expect(input.placeholder).toBe(en.ftIconChoose); // icon.js:4
    fireEvent.click(screen.getByRole("button", { name: en.ftIconOpenPicker }));
    const search = await screen.findByRole("searchbox", { name: en.ftIconSearch });
    expect(document.querySelectorAll("[data-icon-option]").length).toBe(FRAPPE_ICON_NAMES.length);
    fireEvent.change(search, { target: { value: "LOCK" } });
    expect([...document.querySelectorAll("[data-icon-option]")].map((b) => b.getAttribute("data-icon-option"))).toEqual(["lock", "unlock"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(en.ftIconNone)).toBeTruthy();
    fireEvent.change(search, { target: { value: "unlo" } });
    fireEvent.click(document.querySelector('[data-icon-option="unlock"]')!);
    expect(log).toEqual(["unlock"]);
    expect(input.value).toBe("unlock");
    fireEvent.focus(input); fireEvent.change(input, { target: { value: " crm " } }); fireEvent.blur(input);
    expect(log).toEqual(["unlock", "crm"]);
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "" } }); fireEvent.blur(input);
    expect(log).toEqual(["unlock", "crm", ""]);
  });

  it("P36E.ftypes.10 with Desk's sprite in the page the names come from it (icon- symbols only) and glyphs are drawn with <use href=#icon-…>; without it, no glyph is invented", () => {
    sprite(["icon-lock", "icon-crm", "es-line-filter"]);
    expect(deskIconNames()).toEqual(["lock", "crm"]);
    field({ fieldtype: "Icon", label: "Icon" }, "lock", { status: "Read" });
    expect(document.querySelector('[data-frappe-icon="lock"] use')?.getAttribute("href")).toBe("#icon-lock");
    expect(screen.getByText("lock")).toBeTruthy();
    cleanup();
    document.getElementById("all-symbols")?.remove();
    field({ fieldtype: "Icon", label: "Icon" }, "lock", { status: "Read" });
    expect(document.querySelector("[data-frappe-icon]")).toBeNull();
    expect(screen.getByText("lock")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("P36E.ftypes.11 Icon reqd is flagged when empty; read-only empty is hidden by the ladder; Arabic chrome in RTL", async () => {
    field({ fieldtype: "Icon", label: "Icon", reqd: 1 }, "", { status: "Write" });
    expect(screen.getByRole("textbox", { name: /Icon/ }).getAttribute("aria-invalid")).toBe("true");
    cleanup();
    const { container } = field({ fieldtype: "Icon", label: "Icon", read_only: 1 }, "");
    expect(container.textContent).toBe("");
    cleanup();
    field({ fieldtype: "Icon", label: "Icon" }, "", { status: "Write", lang: "ar" });
    expect((screen.getByRole("textbox") as HTMLInputElement).placeholder).toBe(ar.ftIconChoose);
    fireEvent.click(screen.getByRole("button", { name: ar.ftIconOpenPicker }));
    expect(await screen.findByRole("searchbox", { name: ar.ftIconSearch })).toBeTruthy();
  });
});

describe("P36e ftypes — Barcode (barcode.js), PARTIAL", () => {
  it("P36E.ftypes.12 a stored JsBarcode SVG is shown (sanitized) with its data-barcode-value text; Write has no text box, says a generator is needed, and only Clear writes (\"\")", () => {
    const { log } = field({ fieldtype: "Barcode", label: "Barcode" }, BARCODE_SVG, { status: "Write" });
    expect(screen.queryByRole("textbox")).toBeNull();
    const img = screen.getByRole("img", { name: "Barcode 6281000000001" });
    expect(img.querySelector("svg rect")).toBeTruthy();
    expect(img.querySelector("svg")?.getAttribute("data-barcode-value")).toBe("6281000000001");
    expect(document.querySelector("[data-barcode-text]")?.textContent).toBe("6281000000001");
    expect(screen.getByText(en.ftBarcodeNoGenerator)).toBeTruthy();
    expect(log).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: en.ftBarcodeClear }));
    expect(log).toEqual([""]);
    expect(screen.getByText(en.ftBarcodeEmpty)).toBeTruthy();
  });

  it("P36E.ftypes.13 NEGATIVE unsafe SVG markup is sanitized: script, foreignObject, event handlers, external hrefs and url() styles never reach the page", () => {
    const evil = '<svg data-barcode-value="X1" onload="alert(1)"><script>alert(2)</script><foreignObject><img src=x onerror="alert(3)"></foreignObject>'
      + '<a href="javascript:alert(4)"><rect width="5" height="5"></rect></a><rect x="1" onclick="alert(5)" style="fill:url(https://evil.example/x)" fill="url(https://evil.example/y)" width="2" height="9"></rect>'
      + '<use href="https://evil.example/s.svg#a"></use><use href="#local"></use><image href="https://evil.example/p.png"></image><style>@import url(x)</style></svg>';
    const clean = sanitizeSvg(evil)!;
    expect(clean).not.toMatch(/script|foreignObject|onload|onclick|onerror|javascript|evil\.example|<image|<style|<a\b|url\(/i);
    expect(clean).toContain('data-barcode-value="X1"');
    expect(clean).toContain('<use href="#local">');
    expect(sanitizeSvg("<div>no svg</div>")).toBeNull();
    expect(sanitizeSvg("")).toBeNull();
    field({ fieldtype: "Barcode", label: "Barcode" }, evil, { status: "Read" });
    expect(document.querySelector("script, foreignObject, image, style")).toBeNull();
    expect(document.querySelector("[onload], [onclick], [onerror]")).toBeNull();
    expect(document.querySelector("[data-barcode-text]")?.textContent).toBe("X1");
    expect(screen.queryByRole("button")).toBeNull(); // Read: no Clear
  });

  it("P36E.ftypes.14 plain text (not yet converted by Desk, barcode.js:35-38) shows the text and says it is not drawn; empty / reqd / read-only empty; RTL text stays LTR", () => {
    field({ fieldtype: "Barcode" }, "6281000000001", { status: "Read" });
    expect(document.querySelector("[data-barcode-text]")?.textContent).toBe("6281000000001");
    expect(screen.getByText(en.ftBarcodeNotRendered)).toBeTruthy();
    expect(parseBarcodeValue("12")).toEqual({ svg: null, text: "12", isSvg: false });
    cleanup();
    field({ fieldtype: "Barcode", label: "Barcode", reqd: 1 }, "", { status: "Write" });
    expect(screen.getByText("*")).toBeTruthy();
    expect(screen.getByText(en.ftBarcodeEmpty).closest("[data-barcode]")!.firstElementChild!.className).toContain("ring-destructive");
    cleanup();
    const { container } = field({ fieldtype: "Barcode", read_only: 1 }, "");
    expect(container.textContent).toBe("");
    cleanup();
    field({ fieldtype: "Barcode" }, BARCODE_SVG, { status: "Write", lang: "ar" });
    expect(document.querySelector("[data-barcode-text]")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText(ar.ftBarcodeNoGenerator)).toBeTruthy();
  });
});

describe("P36e ftypes — Geolocation (geolocation.js), PARTIAL", () => {
  it("P36E.ftypes.15 a stored FeatureCollection lists its features: point lat/lng from [lng, lat], circle radius (point_type), polygon points; Write never writes", () => {
    const { log } = field({ fieldtype: "Geolocation", label: "Where" }, GEO, { status: "Write" });
    const items = [...document.querySelectorAll("[data-geo-feature]")];
    expect(items.map((i) => i.getAttribute("data-geo-feature"))).toEqual(["point", "circle", "polygon"]);
    expect(items[0].textContent).toContain("Lat ⁦24.71⁩, Lng ⁦46.67⁩");
    expect(items[1].textContent).toContain("radius 120.5 m");
    expect(items[2].textContent).toContain("4 point(s)");
    expect(screen.getByText(en.ftGeoNoMap)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(log).toEqual([]);
    expect(screen.getByRole("group", { name: "Where" })).toBeTruthy();
  });

  it("P36E.ftypes.16 NEGATIVE invalid GeoJSON does not crash: bad JSON, wrong shapes and bad coordinates are reported, the raw text is shown escaped", () => {
    for (const bad of ["{not json", "[1,2]", '{"type":"FeatureCollection"}', "<img src=x onerror=alert(1)>"]) {
      expect(parseGeolocation(bad).status, bad).toBe("invalid");
    }
    expect(parseGeolocation('{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":["a",1]}}]}'))
      .toEqual({ status: "ok", features: [{ kind: "unknown" }] });
    expect(parseGeolocation({ type: "FeatureCollection", features: [] })).toEqual({ status: "empty" });
    expect(parseGeolocation(null)).toEqual({ status: "empty" });
    field({ fieldtype: "Geolocation" }, "<img src=x onerror=alert(1)>", { status: "Read" });
    expect(screen.getByText(en.ftGeoInvalid)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[data-geolocation-raw]")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("P36E.ftypes.17 empty: shown with 'No location' even when read-only (SHOW_WHEN_EMPTY, base_control.js:127); an object value works; Arabic chrome", () => {
    field({ fieldtype: "Geolocation", label: "Where", read_only: 1 }, "");
    expect(screen.getByText(en.ftGeoEmpty)).toBeTruthy();
    expect(screen.queryByText(en.ftGeoNoMap)).toBeNull();
    cleanup();
    field({ fieldtype: "Geolocation" }, JSON.parse(GEO), { status: "Read" });
    expect(document.querySelectorAll("[data-geo-feature]").length).toBe(3);
    cleanup();
    field({ fieldtype: "Geolocation", reqd: 1, label: "Where" }, GEO, { status: "Write", lang: "ar" });
    expect(screen.getByText(ar.ftGeoNoMap)).toBeTruthy();
    expect(document.querySelector('[data-geo-feature="point"]')?.textContent).toContain(ar.ftGeoPoint);
  });
});

describe("P36e ftypes — permlevel and depends_on through FrappeFormView", () => {
  it("P36E.ftypes.18 a permlevel-1 field with read-only rights at level 1 is Read; depends_on false hides the field; Write at level 0 edits", () => {
    const bundle: MetaBundle = { doctype: "FT Demo", children: {}, meta: { name: "FT Demo", fields: [
      { fieldname: "title", fieldtype: "Data", label: "Title" },
      { fieldname: "sign", fieldtype: "Signature", label: "Sign" },
      { fieldname: "approver_sign", fieldtype: "Signature", label: "Approver sign", permlevel: 1 },
      { fieldname: "icon", fieldtype: "Icon", label: "Icon", depends_on: "eval:doc.title=='show'" },
    ] } };
    const perms = { levels: [{ read: true, write: true, create: true }, { read: true, write: false }], can: () => true, known: true };
    render(<Providers><FrappeFormView bundle={bundle} doc={{ doctype: "FT Demo", name: "FT-1", title: "x", sign: "", approver_sign: PNG, icon: "lock" } as FrappeDoc}
      onSave={async (d) => d} guardUnload={false} permissions={perms} /></Providers>);
    expect(document.querySelectorAll("canvas[data-signature-pad]").length).toBe(1); // only "sign" is editable
    const approver = screen.getByRole("group", { name: "Approver sign" });
    expect(within(approver).getByRole("img", { name: en.ftSignatureImage })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Icon" })).toBeNull(); // depends_on false
  });
});
