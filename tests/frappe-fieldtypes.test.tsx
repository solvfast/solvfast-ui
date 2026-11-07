/**
 * FrappeField dispatch for every fieldtype (Form audit section A), the Autocomplete control and the unsupported-fieldtype
 * rule (P35). Unit level: FrappeField under the providers, no server (none of these controls calls one on render).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { FrappeDoc, FrappeDocField, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField, FrappeFormView, SUPPORTED_FIELDTYPES, analyzeFieldtypes } from "../src/frappe/form";
import { autocompleteOptions } from "../src/frappe/form/FrappeField";
import type { FormatContext } from "../src/frappe/services/format";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mount(node: React.ReactElement, fmt?: FormatContext, translations?: Record<string, string>) {
  const client = createFrappeClient({ transport: createFixtureTransport({ meta: {}, docs: {} }) });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }} formatContext={fmt} translations={translations}>{node}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
const field = (df: Partial<FrappeDocField> & { fieldtype: string }, value: unknown, extra: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const full = { fieldname: df.fieldname ?? "f", label: df.label ?? "Field", ...df } as FrappeDocField;
  mount(<FrappeField df={full} value={value} onChange={onChange} {...extra} />);
  return onChange;
};

describe("A field dispatch (FrappeField, docs 12 §1-§10)", () => {
  it("FV.A12-A14 Small Text / Text / Long Text are textareas; A16-A18, A32 Code / JSON / HTML / Markdown Editor are monospace, LTR", () => {
    for (const ft of ["Small Text", "Text", "Long Text", "Code", "JSON", "HTML Editor", "Markdown Editor"]) {
      field({ fieldtype: ft, label: ft }, "line 1\nline 2");
      const box = screen.getByRole("textbox", { name: ft }) as HTMLTextAreaElement;
      expect(box.tagName, ft).toBe("TEXTAREA");
      expect(box.value).toBe("line 1\nline 2");
      const mono = ["Code", "JSON", "HTML Editor", "Markdown Editor"].includes(ft);
      expect(box.className.includes("font-mono"), ft).toBe(mono);
      expect(box.getAttribute("dir"), ft).toBe(mono ? "ltr" : null);
      cleanup();
    }
  });

  it("FV.A19 Password renders type=password; A33 Phone renders type=tel; A1 Data honours the placeholder (A41)", () => {
    field({ fieldtype: "Password", label: "Secret" }, "*****");
    expect((screen.getByLabelText("Secret") as HTMLInputElement).type).toBe("password");
    cleanup();
    field({ fieldtype: "Phone", label: "Mobile" }, "+1 555");
    expect((screen.getByRole("textbox", { name: "Mobile" }) as HTMLInputElement).type).toBe("tel");
    cleanup();
    field({ fieldtype: "Data", label: "Code", placeholder: "e.g. A-1" }, "");
    expect(screen.getByRole("textbox", { name: "Code" }).getAttribute("placeholder")).toBe("e.g. A-1");
  });

  it("FV.A12 a textarea writes 500 ms after typing stops (and on blur)", () => {
    vi.useFakeTimers();
    try {
      const onChange = field({ fieldtype: "Small Text", label: "Notes" }, "");
      const box = screen.getByRole("textbox", { name: "Notes" });
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "abc" } });
      expect(onChange).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(500); });
      expect(onChange).toHaveBeenCalledWith("abc");
    } finally { vi.useRealTimers(); }
  });

  it("FV.A3 Select: newline options, blank first option, translated labels, an unknown stored value is kept", () => {
    const df = { fieldname: "s", fieldtype: "Select", label: "Status", options: "\nOpen\nClosed" } as FrappeDocField;
    const onChange = vi.fn();
    mount(<FrappeField df={df} value="Legacy" onChange={onChange} />, undefined, { Open: "مفتوح" });
    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger.textContent).toContain("Legacy");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const opts = screen.getAllByRole("option").map((o) => o.textContent?.trim());
    expect(opts).toEqual(["", "مفتوح", "Closed", "Legacy"]);
    fireEvent.click(screen.getByRole("option", { name: "Closed" }));
    expect(onChange).toHaveBeenCalledWith("Closed");
  });

  it("FV.A8 / A9 / A10 / A11 numbers: Int truncates, Float rounds to df.precision, Currency / Percent are number boxes", () => {
    const onInt = field({ fieldtype: "Int", label: "Qty" }, 2);
    const qty = screen.getByRole("textbox", { name: "Qty" });
    fireEvent.focus(qty); fireEvent.change(qty, { target: { value: "7.9" } }); fireEvent.blur(qty);
    expect(onInt).toHaveBeenCalledWith(7);
    cleanup();
    const onFloat = field({ fieldtype: "Float", label: "Rate", precision: "2" }, null);
    const rate = screen.getByRole("textbox", { name: "Rate" });
    fireEvent.focus(rate); fireEvent.change(rate, { target: { value: "1.23456" } }); fireEvent.blur(rate);
    expect(onFloat).toHaveBeenCalledWith(1.23);
    cleanup();
    for (const ft of ["Currency", "Percent"]) {
      field({ fieldtype: ft, label: ft }, 12.5);
      expect((screen.getByRole("textbox", { name: ft }) as HTMLInputElement).value, ft).toMatch(/12\.5/);
      cleanup();
    }
  });

  it("FV.A6 Time is a time box (12 h when the site's time_format has 'a'); A5 Datetime a date-time picker trigger; A4 Date a date trigger", () => {
    mount(<FrappeField df={{ fieldname: "t", fieldtype: "Time", label: "At" }} value="14:30:00" onChange={() => {}} />, { timeFormat: "hh:mm a" });
    expect((screen.getByRole("textbox", { name: "At" }) as HTMLInputElement).value).toMatch(/2:30/);
    cleanup();
    field({ fieldtype: "Datetime", label: "Starts" }, "2026-11-07 09:15:00");
    expect(screen.getByRole("button", { name: /Starts/ })).toBeTruthy();
    cleanup();
    field({ fieldtype: "Date", label: "Due" }, "2026-11-07");
    expect(screen.getByRole("button", { name: /Due/ })).toBeTruthy();
  });

  it("FV.A27 Rating stores a 0…1 fraction: 0.6 of 5 shows 3 stars; picking the 4th writes 0.8", () => {
    const onChange = field({ fieldtype: "Rating", label: "Score", options: "5" }, 0.6);
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("3");
    fireEvent.click(slider.querySelectorAll("button")[3]);
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it("FV.A28 Color is a hex box; A7 Check writes 0/1", () => {
    field({ fieldtype: "Color", label: "Tint" }, "#112233");
    expect((screen.getByRole("textbox", { name: "Tint" }) as HTMLInputElement).value).toBe("#112233");
    cleanup();
    const onChange = field({ fieldtype: "Check", label: "Active" }, 0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("FV.A36 Button runs onButtonClick; A37 HTML is sanitized; A38 Image reads doc[options]; A39 Heading is a heading", () => {
    const click = vi.fn();
    mount(
      <div>
        <FrappeField df={{ fieldname: "go", fieldtype: "Button", label: "Recalculate" }} value={null} onChange={() => {}} onButtonClick={click} />
        <FrappeField df={{ fieldname: "h", fieldtype: "HTML", options: "<b>Bold</b><script>window.x=1</script>" }} value={null} onChange={() => {}} />
        <FrappeField df={{ fieldname: "img", fieldtype: "Image", label: "Photo", options: "photo" }} value={null} onChange={() => {}} doc={{ doctype: "X", name: "1", photo: "/files/p.png" } as FrappeDoc} />
        <FrappeField df={{ fieldname: "hd", fieldtype: "Heading", label: "Totals" }} value={null} onChange={() => {}} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));
    expect(click).toHaveBeenCalledWith("go");
    expect(screen.getByText("Bold").tagName).toBe("B");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("img", { name: "Photo" }).getAttribute("src")).toBe("/files/p.png");
    expect(screen.getByRole("heading", { name: "Totals" })).toBeTruthy();
  });

  it("FV.A22 Read Only shows the formatted value, never an input", () => {
    field({ fieldtype: "Read Only", label: "Full name" }, "Ann Xu");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Ann Xu")).toBeTruthy();
  });
});

describe("A34 Autocomplete (autocomplete.js)", () => {
  it("FV.A34 suggests df.options, filters as you type, writes a picked value", async () => {
    const onChange = field({ fieldtype: "Autocomplete", label: "Channel", options: "Email\nPhone\nWalk-in" }, "");
    const box = screen.getByRole("combobox", { name: "Channel" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ph" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Phone"]);
    fireEvent.click(screen.getByRole("option", { name: "Phone" }));
    expect(onChange).toHaveBeenCalledWith("Phone");
  });
  it("FV.A34 a typed value outside the list is cleared (validate :132-145); ignore_validation keeps it", async () => {
    const onChange = field({ fieldtype: "Autocomplete", label: "Channel", options: "Email\nPhone" }, "");
    const box = screen.getByRole("combobox", { name: "Channel" });
    fireEvent.focus(box); fireEvent.change(box, { target: { value: "Fax" } }); fireEvent.blur(box);
    expect(onChange).toHaveBeenLastCalledWith("");
    cleanup();
    const keep = field({ fieldtype: "Autocomplete", label: "Channel", options: "Email\nPhone", ignore_validation: 1 }, "");
    const box2 = screen.getByRole("combobox", { name: "Channel" });
    fireEvent.focus(box2); fireEvent.change(box2, { target: { value: "Fax" } }); fireEvent.blur(box2);
    expect(keep).toHaveBeenLastCalledWith("Fax");
  });
  it("FV.A34 parse_options: newline text or a JSON list of strings / {label, value}", () => {
    expect(autocompleteOptions("A\n\nB")).toEqual([{ value: "A", label: "A" }, { value: "B", label: "B" }]);
    expect(autocompleteOptions('[{"label":"Yes","value":"y"},"No"]')).toEqual([{ value: "y", label: "Yes" }, { value: "No", label: "No" }]);
    expect(autocompleteOptions(undefined)).toEqual([]);
  });
});

describe("A29-A31, A35, A44 fieldtypes without a control: reported, shown read-only", () => {
  it("FV.A44 Signature / Geolocation / Barcode / Icon show the raw value read-only — no text box", () => {
    for (const [ft, v] of [["Signature", "data:image/png;base64,AAA"], ["Geolocation", { type: "FeatureCollection", features: [] }], ["Barcode", "123"], ["Icon", "home"]] as const) {
      field({ fieldtype: ft, label: ft }, v);
      expect(screen.queryByRole("textbox"), ft).toBeNull();
      const el = document.querySelector(`[data-unsupported-fieldtype="${ft}"]`);
      expect(el?.textContent, ft).toBe(typeof v === "string" ? v : JSON.stringify(v));
      cleanup();
    }
  });
  it("FV.A44 the form's banner lists them (parent and child DocTypes); supported types are not listed", () => {
    const bundle: MetaBundle = {
      doctype: "Sig", children: { "Sig Row": { name: "Sig Row", istable: 1, fields: [{ fieldname: "geo", fieldtype: "Geolocation", label: "Where" }] } },
      meta: { name: "Sig", fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }, { fieldname: "sign", fieldtype: "Signature", label: "Sign" }, { fieldname: "rows", fieldtype: "Table", options: "Sig Row", label: "Rows" }] },
    };
    expect(analyzeFieldtypes(bundle)).toEqual([
      { doctype: "Sig", fieldname: "sign", fieldtype: "Signature", label: "Sign" },
      { doctype: "Sig Row", fieldname: "geo", fieldtype: "Geolocation", label: "Where" },
    ]);
    mount(<FrappeFormView bundle={bundle} doc={{ doctype: "Sig", name: "S-1", title: "x", sign: "data:x", rows: [] }} onSave={async (d) => d} guardUnload={false} />);
    const items = [...document.querySelectorAll("[data-fieldtype-issue]")].map((li) => li.getAttribute("data-fieldtype-issue"));
    expect(items).toEqual(["Signature", "Geolocation"]);
    expect(screen.getByRole("note").textContent).toContain('Sig.sign: the field type "Signature" has no control here');
  });
  it("FV.A45 SUPPORTED_FIELDTYPES covers every type FrappeField dispatches", () => {
    for (const ft of ["Data", "Link", "Dynamic Link", "Select", "Autocomplete", "Table", "Table MultiSelect", "Attach Image", "Duration", "Rating", "Text Editor", "Read Only", "Button", "Fold"]) expect(SUPPORTED_FIELDTYPES.has(ft), ft).toBe(true);
    for (const ft of ["Signature", "Geolocation", "Barcode", "Icon"]) expect(SUPPORTED_FIELDTYPES.has(ft), ft).toBe(false);
  });
});
