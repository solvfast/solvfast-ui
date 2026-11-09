/**
 * P36d fieldtypes — every field type FrappeField covers renders from a DocField and round-trips a value in Frappe's
 * stored format; negatives for read-only, required and the types without a control. Plus the inventory data behind the
 * "Frappe Field Types" showcase group, checked against the Frappe 15.110 lists it mirrors (docs/audit/p36d/FIELD-TYPES.md).
 * jsdom unit level; Link / Dynamic Link / Table MultiSelect talk to the in-package SIMULATOR (createFixtureTransport) —
 * request shapes only, never evidence of real-site behaviour.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEn from "./fixtures/real-15.110/user.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FrappeDoc, FrappeDocField, MetaBundle } from "../src/frappe/contract";
import type { FormatContext } from "../src/frappe/services/format";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField, FrappeFormView, SUPPORTED_FIELDTYPES, LAYOUT_TYPES, DISPLAY_TYPES, TABLE_TYPES } from "../src/frappe/form";
import { DATA_FIELD_OPTIONS, DOCFIELD_FIELDTYPE_OPTIONS, FIELD_TYPES, SAMPLES } from "../showcase/src/pages/p36d-fieldtypes-data";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const en = defaultMessages.en;
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;

function mount(node: React.ReactElement, opts: { fmt?: FormatContext; lang?: "en" | "ar" } = {}) {
  const transport = createFixtureTransport({
    meta: { User: docsOf(userEn) },
    docs: {
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 },
        { doctype: "User", name: "bob@x.com", full_name: "Bob Yo", first_name: "Bob", email: "bob@x.com", enabled: 1 },
      ],
    },
  });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.lang ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }} formatContext={opts.fmt}>{node}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method: string) => transport.store.calls.filter((c) => c.method === method);
  return { ...utils, calls };
}

/** A FrappeField that keeps its value (as a form would) and logs every onChange. */
function Live({ df, initial, log, doc, bundle, status }: { df: FrappeDocField; initial: unknown; log: unknown[]; doc?: FrappeDoc; bundle?: MetaBundle; status?: "Write" | "Read" }) {
  const [value, setValue] = React.useState<unknown>(initial);
  return <FrappeField df={df} value={value} onChange={(v) => { log.push(v); setValue(v); }} doc={doc ? { ...doc, [df.fieldname]: value } : undefined} bundle={bundle} status={status} />;
}
const field = (df: Partial<FrappeDocField> & { fieldtype: string }, initial: unknown, opts: { fmt?: FormatContext; doc?: FrappeDoc; bundle?: MetaBundle; status?: "Write" | "Read" } = {}) => {
  const log: unknown[] = [];
  const full = { fieldname: df.fieldname ?? "f", label: df.label ?? "Field", ...df } as FrappeDocField;
  const m = mount(<Live df={full} initial={initial} log={log} doc={opts.doc} bundle={opts.bundle} status={opts.status} />, { fmt: opts.fmt });
  return { log, ...m };
};
const typeAndBlur = (el: HTMLElement, value: string) => { fireEvent.focus(el); fireEvent.change(el, { target: { value } }); fireEvent.blur(el); };

describe("P36D fieldtypes — the inventory mirrors Frappe 15.110", () => {
  it("P36D.fieldtypes.1 every DocField.fieldtype option, Long Int, Page Break and the six Data options are listed once; Not implemented ⇔ no FrappeField control", () => {
    expect(DOCFIELD_FIELDTYPE_OPTIONS).toHaveLength(43); // docfield.json:108
    const types = FIELD_TYPES.filter((r) => !r.dataOption).map((r) => r.fieldtype);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual([...DOCFIELD_FIELDTYPE_OPTIONS, "Long Int", "Page Break"].sort());
    expect(FIELD_TYPES.filter((r) => r.dataOption).map((r) => r.dataOption)).toEqual(DATA_FIELD_OPTIONS); // model/__init__.py:80
    expect(FIELD_TYPES.filter((r) => r.docfieldOption).map((r) => r.fieldtype).sort()).toEqual([...DOCFIELD_FIELDTYPE_OPTIONS].sort());
    for (const r of FIELD_TYPES) {
      if (r.fieldtype === "Page Break") { expect(r.status).toBe("n/a"); continue; }
      expect(r.status === "MISSING", `${r.id} ${r.fieldtype}`).toBe(!SUPPORTED_FIELDTYPES.has(r.fieldtype));
    }
    // layout / display / table classes agree with the package's frappe.model lists
    for (const r of FIELD_TYPES.filter((x) => x.cls === "layout" && x.fieldtype !== "Page Break")) expect(LAYOUT_TYPES.has(r.fieldtype), r.fieldtype).toBe(true);
    for (const r of FIELD_TYPES.filter((x) => x.cls === "display")) expect(DISPLAY_TYPES.has(r.fieldtype), r.fieldtype).toBe(true);
    for (const r of FIELD_TYPES.filter((x) => x.cls === "composite")) expect(TABLE_TYPES.has(r.fieldtype), r.fieldtype).toBe(true);
    // every value / display type has a showcase sample, built on the row's own fieldtype
    for (const r of FIELD_TYPES.filter((x) => x.cls !== "layout" && x.cls !== "composite")) {
      expect(SAMPLES[r.id]?.df.fieldtype, r.id).toBe(r.fieldtype);
      if (r.dataOption) expect(SAMPLES[r.id].df.options).toBe(r.dataOption);
    }
  });
});

/** Every right at permlevel 0 (FrappeFormView without permissions is read-only, rule 9). */
const WRITE_ALL = { levels: [{ read: true, write: true, create: true }], can: () => true, known: true };

describe("P36D fieldtypes — render from a DocField and round-trip the stored value", () => {
  it("P36D.fieldtypes.2 text-like types and the Data options write what was typed (on blur), as the server stores it", () => {
    const cases: [Partial<FrappeDocField> & { fieldtype: string }, string][] = [
      [{ fieldtype: "Data" }, "Acme Travel"],
      ...DATA_FIELD_OPTIONS.map((o) => [{ fieldtype: "Data", options: o }, o === "Email" ? "sara@example.com" : o === "URL" ? "https://example.com" : o === "Phone" ? "+966 50 123 4567" : o === "IBAN" ? "SA0380000000608010167519" : "Sara Al-Otaibi"] as [Partial<FrappeDocField> & { fieldtype: string }, string]),
      [{ fieldtype: "Small Text" }, "a\nb"], [{ fieldtype: "Text" }, "a\nb"], [{ fieldtype: "Long Text" }, "a\nb"],
      [{ fieldtype: "Code", options: "Python" }, "x = 1"], [{ fieldtype: "JSON" }, '{"a":1}'], [{ fieldtype: "HTML Editor" }, "<p>x</p>"], [{ fieldtype: "Markdown Editor" }, "# t"],
      [{ fieldtype: "Phone" }, "+966-512345678"],
    ];
    for (const [df, value] of cases) {
      const label = `${df.fieldtype} ${df.options ?? ""}`.trim();
      const { log } = field({ ...df, label }, "");
      const box = screen.getByRole("textbox", { name: label });
      typeAndBlur(box, value);
      expect(log.at(-1), label).toBe(value);
      expect((box as HTMLInputElement).value, label).toBe(value);
      cleanup();
    }
    const { log } = field({ fieldtype: "Password", label: "Secret" }, "");
    const pw = screen.getByLabelText("Secret") as HTMLInputElement;
    expect(pw.type).toBe("password");
    typeAndBlur(pw, "s3cret!");
    expect(log.at(-1)).toBe("s3cret!");
  });

  it("P36D.fieldtypes.3 numbers: Int evaluates arithmetic and truncates; Long Int too; Float rounds to df.precision; Currency / Percent keep the number", () => {
    const run = (df: Partial<FrappeDocField> & { fieldtype: string }, typed: string, expected: number) => {
      const { log } = field({ ...df, label: df.fieldtype }, null);
      typeAndBlur(screen.getByRole("textbox", { name: df.fieldtype }), typed);
      expect(log.at(-1), df.fieldtype).toBe(expected);
      cleanup();
    };
    run({ fieldtype: "Int" }, "2+3", 5);           // int.js:17-39
    run({ fieldtype: "Long Int" }, "7.9", 7);      // int.js:45 (cint)
    run({ fieldtype: "Float", precision: "2" }, "1.239", 1.24);
    run({ fieldtype: "Currency" }, "1234.5", 1234.5);
    run({ fieldtype: "Percent" }, "62.5", 62.5);
  });

  it("P36D.fieldtypes.4 Check writes 0/1; Select writes the picked option; Autocomplete writes a listed value", async () => {
    const chk = field({ fieldtype: "Check", label: "Active" }, 0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(chk.log).toEqual([1]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(chk.log).toEqual([1, 0]);
    cleanup();
    const sel = field({ fieldtype: "Select", label: "Status", options: "\nOpen\nClosed" }, "Open");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Status" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Closed" }));
    expect(sel.log).toEqual(["Closed"]);
    cleanup();
    const ac = field({ fieldtype: "Autocomplete", label: "Source", options: "Email\nReferral" }, "");
    const box = screen.getByRole("combobox", { name: "Source" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ref" } });
    fireEvent.click(await screen.findByRole("option", { name: "Referral" }));
    expect(ac.log.at(-1)).toBe("Referral");
  });

  it("P36D.fieldtypes.5 Time writes HH:mm:ss; Duration writes seconds; Date and Datetime show the stored value in the site's format", () => {
    const t = field({ fieldtype: "Time", label: "At" }, null);
    typeAndBlur(screen.getByRole("textbox", { name: "At" }), "9:05");
    expect(t.log.at(-1)).toBe("09:05:00");
    cleanup();
    const d = field({ fieldtype: "Duration", label: "Length" }, 5430);
    expect((screen.getByRole("textbox", { name: en.formHours }) as HTMLInputElement).value).toBe("1");
    expect((screen.getByRole("textbox", { name: en.formMinutes }) as HTMLInputElement).value).toBe("30");
    fireEvent.change(screen.getByRole("textbox", { name: en.formMinutes }), { target: { value: "45" } });
    expect(d.log.at(-1)).toBe(3600 + 45 * 60 + 30);
    cleanup();
    field({ fieldtype: "Date", label: "Due" }, "2026-11-20", { fmt: { dateFormat: "dd-mm-yyyy" } });
    expect(screen.getByText("20-11-2026")).toBeTruthy();
    cleanup();
    field({ fieldtype: "Datetime", label: "Starts" }, "2026-11-20 10:30:00");
    expect(screen.getByRole("button", { name: /Starts/ })).toBeTruthy();
  });

  it("P36D.fieldtypes.6 Rating stores a 0…1 fraction of options stars; Color writes #RRGGBB", () => {
    const r = field({ fieldtype: "Rating", label: "Score", options: "5" }, 0.4);
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuenow")).toBe("2");
    fireEvent.click(slider.querySelectorAll("button")[4]);
    expect(r.log.at(-1)).toBe(1);
    cleanup();
    const c = field({ fieldtype: "Color", label: "Tint" }, "");
    typeAndBlur(screen.getByRole("textbox", { name: "Tint" }), "#1e88e5");
    expect(String(c.log.at(-1)).toLowerCase()).toBe("#1e88e5");
  });

  it("P36D.fieldtypes.7 Text Editor shows the stored HTML in its editor and as sanitized read-only HTML", () => {
    field({ fieldtype: "Text Editor", label: "Proposal" }, "<p><strong>Scope</strong> three trips</p>");
    expect(screen.getByText("Scope").tagName).toBe("STRONG");
    cleanup();
    field({ fieldtype: "Text Editor", label: "Proposal", read_only: 1 }, "<p>Safe<script>window.__x=1</script></p>");
    expect(screen.getByText("Safe")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("P36D.fieldtypes.8 Link (SIMULATED): search_link with the typed text, a pick goes through validate_link, the name is written", async () => {
    const { log, calls } = field({ fieldtype: "Link", label: "Owner", options: "User" }, null, { doc: { doctype: "FT Demo", name: "FT-1" } as FrappeDoc });
    const box = screen.getByRole("combobox", { name: "Owner" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "bob" } });
    await waitFor(() => expect(calls("frappe.desk.search.search_link").some((c) => c.args.txt === "bob")).toBe(true), { timeout: 2000 });
    expect(calls("frappe.desk.search.search_link").find((c) => c.args.txt === "bob")!.args).toMatchObject({ doctype: "User", page_length: 10 });
    fireEvent.click(await screen.findByRole("option", { name: /bob@x\.com/ }));
    await waitFor(() => expect(calls("frappe.client.validate_link").some((c) => c.args.docname === "bob@x.com")).toBe(true));
    await waitFor(() => expect(log.at(-1)).toBe("bob@x.com"));
  });

  it("P36D.fieldtypes.9 Dynamic Link (SIMULATED) searches the DocType named by its sibling field", async () => {
    const { calls } = field({ fieldtype: "Dynamic Link", label: "Reference", options: "reference_doctype", fieldname: "reference_name" }, null,
      { doc: { doctype: "FT Demo", name: "FT-1", reference_doctype: "User" } as FrappeDoc });
    const box = screen.getByRole("combobox", { name: "Reference" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ann" } });
    await waitFor(() => expect(calls("frappe.desk.search.search_link").some((c) => c.args.txt === "ann" && c.args.doctype === "User")).toBe(true), { timeout: 2000 });
  });

  it("P36D.fieldtypes.10 Attach / Attach Image: empty offers Attach; a value is a link to the file; read-only keeps the link, no upload", () => {
    for (const ft of ["Attach", "Attach Image"]) {
      field({ fieldtype: ft, label: ft }, null, { doc: { doctype: "ToDo", name: "TD-1" } as FrappeDoc });
      expect(screen.getAllByRole("button").some((b) => /Attach/.test(b.textContent ?? "")), ft).toBe(true);
      cleanup();
      field({ fieldtype: ft, label: ft }, "/files/a.png", { doc: { doctype: "ToDo", name: "TD-1" } as FrappeDoc });
      expect(screen.getByRole("link", { name: /\/files\/a\.png/ }), ft).toBeTruthy();
      cleanup();
      field({ fieldtype: ft, label: ft, read_only: 1 }, "/files/a.png", { doc: { doctype: "ToDo", name: "TD-1" } as FrappeDoc });
      expect(screen.getByRole("link", { name: /\/files\/a\.png/ }), ft).toBeTruthy();
      expect(screen.queryAllByRole("button").some((b) => /Attach/.test(b.textContent ?? "")), ft).toBe(false);
      cleanup();
    }
  });

  it("P36D.fieldtypes.11 Table and Table MultiSelect render their child rows from the DocField and its child meta", async () => {
    const bundle: MetaBundle = {
      doctype: "FT Demo", meta: { name: "FT Demo", fields: [] },
      children: {
        "FT Item": { name: "FT Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 }, { fieldname: "qty", fieldtype: "Int", label: "Qty", in_list_view: 1 }] },
        "FT Participant": { name: "FT Participant", istable: 1, fields: [{ fieldname: "user", fieldtype: "Link", options: "User", label: "User" }] },
      },
    };
    field({ fieldtype: "Table", label: "Items", options: "FT Item", fieldname: "items" },
      [{ doctype: "FT Item", name: "r1", idx: 1, parentfield: "items", item: "Flight RUH-DXB", qty: 2 }], { bundle, doc: { doctype: "FT Demo", name: "FT-1" } as FrappeDoc });
    expect(screen.getByText("Flight RUH-DXB")).toBeTruthy();
    cleanup();
    const tms = field({ fieldtype: "Table MultiSelect", label: "Participants", options: "FT Participant", fieldname: "participants" },
      [{ doctype: "FT Participant", name: "p1", idx: 1, parentfield: "participants", user: "ann@x.com" }], { bundle, doc: { doctype: "FT Demo", name: "FT-1" } as FrappeDoc });
    expect(screen.getByText("ann@x.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /ann@x\.com/ }));
    expect(tms.log.at(-1)).toEqual([]);
  });

  it("P36D.fieldtypes.12 layout and display types in a FrappeFormView: Tab / Section / Column Break, Fold, Heading, HTML (sanitized), Button, Image", () => {
    const bundle: MetaBundle = {
      doctype: "FT Demo", children: {},
      meta: { name: "FT Demo", fields: [
        { fieldname: "details_tab", fieldtype: "Tab Break", label: "Details" },
        { fieldname: "title", fieldtype: "Data", label: "Title" },
        { fieldname: "cb", fieldtype: "Column Break" },
        { fieldname: "hd", fieldtype: "Heading", label: "Billing details" },
        { fieldname: "note", fieldtype: "HTML", options: "<b>VAT</b><script>window.__y=1</script>" },
        { fieldname: "go", fieldtype: "Button", label: "Recalculate" },
        { fieldname: "sec", fieldtype: "Section Break", label: "More" },
        { fieldname: "photo", fieldtype: "Image", label: "Photo", options: "logo" },
        { fieldname: "fold", fieldtype: "Fold" },
        { fieldname: "after", fieldtype: "Section Break", label: "After fold" },
        { fieldname: "notes", fieldtype: "Small Text", label: "Notes" },
        { fieldname: "other_tab", fieldtype: "Tab Break", label: "Other" },
        { fieldname: "extra", fieldtype: "Data", label: "Extra" },
      ] as FrappeDocField[] },
    };
    mount(<FrappeFormView bundle={bundle} doc={{ doctype: "FT Demo", name: "FT-1", title: "x", logo: "/files/l.png", notes: "n" } as FrappeDoc} onSave={async (d) => d} guardUnload={false} permissions={WRITE_ALL} />);
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Other" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Billing details" })).toBeTruthy();
    expect(screen.getByText("VAT").tagName).toBe("B");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Photo" }).getAttribute("src")).toBe("/files/l.png");
    expect(screen.getByText("After fold")).toBeTruthy(); // Fold = a section today (PARTIAL: no "Show more details")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeTruthy();
  });
});

describe("P36D fieldtypes — negatives", () => {
  const INPUTS: [Partial<FrappeDocField> & { fieldtype: string }, unknown, string | RegExp][] = [
    [{ fieldtype: "Data" }, "Acme", "Acme"], [{ fieldtype: "Data", options: "Email" }, "a@b.co", "a@b.co"], [{ fieldtype: "Small Text" }, "Note", "Note"],
    [{ fieldtype: "Code" }, "x = 1", "x = 1"], [{ fieldtype: "Password" }, "*****", "*****"], [{ fieldtype: "Int" }, 42, "42"], [{ fieldtype: "Float" }, 1.5, /^1\.50*$/],
    [{ fieldtype: "Select", options: "\nOpen" }, "Open", "Open"], [{ fieldtype: "Autocomplete", options: "A\nB" }, "B", "B"], [{ fieldtype: "Time" }, "16:45:00", "16:45:00"],
    [{ fieldtype: "Color" }, "#112233", "#112233"], [{ fieldtype: "Phone" }, "+966-5", "+966-5"],
  ];

  it("P36D.fieldtypes.13 read_only: 1 and status Read render the formatted value — no textbox, combobox or editable checkbox", () => {
    for (const [df, value, shown] of INPUTS) {
      for (const how of ["read_only", "status"] as const) {
        const label = `${df.fieldtype} ${how}`;
        field({ ...df, label, ...(how === "read_only" ? { read_only: 1 } : {}) }, value, { status: how === "status" ? "Read" : undefined });
        expect(screen.queryByRole("textbox"), label).toBeNull();
        expect(screen.queryByRole("combobox"), label).toBeNull();
        expect(screen.getByText(shown), label).toBeTruthy();
        cleanup();
      }
    }
    field({ fieldtype: "Check", label: "Active", read_only: 1 }, 1);
    expect((screen.getByRole("checkbox", { name: "Active" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    field({ fieldtype: "Rating", label: "Score", read_only: 1, options: "5" }, 0.6);
    const before = screen.getByRole("slider").getAttribute("aria-valuenow");
    fireEvent.click(screen.getByRole("slider").querySelectorAll("button")[4] ?? screen.getByRole("slider"));
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe(before);
  });

  it("P36D.fieldtypes.14 reqd: an empty value is marked (*, aria-invalid); a filled one is not; Read never shows the mark", () => {
    for (const ft of ["Data", "Small Text", "Int", "Currency", "Time", "Color"]) {
      field({ fieldtype: ft, label: ft, reqd: 1 }, ft === "Int" || ft === "Currency" ? null : "");
      const box = screen.getByRole("textbox", { name: ft });
      expect(box.getAttribute("aria-invalid"), ft).toBe("true");
      expect(within(document.querySelector("label")!).getByText("*"), ft).toBeTruthy();
      cleanup();
    }
    field({ fieldtype: "Data", label: "Name", reqd: 1 }, "Acme");
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBeNull();
    cleanup();
    field({ fieldtype: "Data", label: "Name", reqd: 1, read_only: 1 }, "Acme");
    expect(document.querySelector("label")?.textContent).toBe("Name");
    cleanup();
    // an `error` (the server's message) is announced and marks the control
    mount(<FrappeField df={{ fieldname: "e", fieldtype: "Data", options: "Email", label: "Email" }} value="sara@" onChange={() => {}} error="sara@ is not a valid Email Address" />);
    expect(screen.getByRole("alert").textContent).toContain("not a valid Email Address");
    expect(screen.getByRole("textbox", { name: "Email" }).getAttribute("aria-invalid")).toBe("true");
  });

  it("P36D.fieldtypes.15 Signature / Barcode / Geolocation / Icon (Not implemented yet) stay read-only with write permission and never write", () => {
    // P36e ftypes: only MISSING types that still have no control take the read-only fallback
    for (const r of FIELD_TYPES.filter((x) => x.status === "MISSING" && !SUPPORTED_FIELDTYPES.has(x.fieldtype))) {
      const s = SAMPLES[r.id];
      const { log } = field({ ...(s.df as { fieldtype: string }), label: r.fieldtype }, s.filled, { status: "Write" });
      expect(screen.queryByRole("textbox"), r.fieldtype).toBeNull();
      const el = document.querySelector(`[data-unsupported-fieldtype="${r.fieldtype}"]`);
      expect(el?.textContent, r.fieldtype).toBe(String(s.filled));
      expect(log, r.fieldtype).toEqual([]);
      cleanup();
    }
  });
});

describe("P36D fieldtypes — showcase group", () => {
  it("P36D.fieldtypes.16 the Frappe Field Types group has its four pages; inventory and inspector render in English and Arabic", async () => {
    const { GROUPS, PAGES } = await import("../showcase/src/routes");
    const group = GROUPS.find((g) => g.id === "frappe-field-types");
    expect(group?.pages.map((p) => p.id)).toEqual(["fieldtypes-inventory", "fieldtypes-inspector", "fieldtypes-links", "fieldtypes-layout"]);
    for (const id of ["fieldtypes-inventory", "fieldtypes-inspector", "fieldtypes-links", "fieldtypes-layout"]) expect(PAGES.find((p) => p.id === id)?.group.id).toBe("frappe-field-types");
    const pages = await import("../showcase/src/pages/p36d-fieldtypes");
    for (const lang of ["en", "ar"] as const) {
      render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}><pages.FieldTypesInventoryPage /></ThemeProvider>);
      const table = screen.getByTestId("ft-inventory");
      expect(table.querySelectorAll("[data-ft-row]")).toHaveLength(FIELD_TYPES.length);
      // P36e ftypes: Signature / Icon / Barcode / Geolocation have controls now; the fallback is only for types without one
      expect(screen.getByTestId("ft-missing").querySelectorAll("[data-unsupported-fieldtype]")).toHaveLength(FIELD_TYPES.filter((r) => r.status === "MISSING" && !SUPPORTED_FIELDTYPES.has(r.fieldtype)).length);
      cleanup();
      render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}><pages.FieldTypesInspectorPage /></ThemeProvider>);
      expect(screen.getAllByText(/SIMULATED|محاكاة/).length).toBeGreaterThan(0);
      expect(within(screen.getByTestId("ft-states")).getAllByRole("textbox").length).toBeGreaterThan(3);
      cleanup();
    }
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><pages.FieldTypesLayoutPage /></ThemeProvider>);
    expect(await screen.findByRole("tab", { name: "Items" })).toBeTruthy();
    cleanup();
    render(<ThemeProvider defaultTheme="light" defaultLanguage="ar" storageKeys={null}><pages.FieldTypesLinksPage /></ThemeProvider>);
    expect(screen.getByTestId("ft-link-empty")).toBeTruthy();
  });
});
