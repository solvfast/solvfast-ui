/**
 * P36d "fields" — native Frappe 15.110 field behaviour found missing by the CRM Lead Details field audit
 * (docs/audit/p36d/LEAD-FIELDS.md). Unit level (jsdom) + the in-package SIMULATOR (`createFixtureTransport`); nothing
 * here ran against a Frappe site. References are to apps/frappe/frappe/public/js/frappe/… unless stated.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FrappeDocField } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField, dataOptionInvalid } from "../src/frappe/form";
import { splitEmails } from "../src/frappe/form/FrappeField";
import { LinkInput } from "../src/fields/LinkInput";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// A generic "lead-like" form: an Organization target that shows titles in links, a Type target that does not.
const ORG: DocTypeMeta = {
  name: "Test Org", title_field: "company_name", show_title_field_in_link: 1, search_fields: "company_name",
  fields: [{ fieldname: "company_name", fieldtype: "Data", label: "Company Name" }],
} as DocTypeMeta;
const KIND: DocTypeMeta = { name: "Test Kind", title_field: "kind_name", fields: [{ fieldname: "kind_name", fieldtype: "Data", label: "Kind Name" }] } as DocTypeMeta;
const LEAD: DocTypeMeta = {
  name: "Test Lead",
  fields: [
    { fieldname: "email", fieldtype: "Data", options: "Email", label: "Email" },
    { fieldname: "organization", fieldtype: "Link", options: "Test Org", label: "Organization" },
  ],
} as DocTypeMeta;

function setup(node: React.ReactElement, opts: { translations?: Record<string, string>; translatedDoctypes?: string[] } = {}) {
  const transport = createFixtureTransport({
    meta: { "Test Org": [ORG], "Test Kind": [KIND], "Test Lead": [LEAD] },
    docs: {
      "Test Org": [{ doctype: "Test Org", name: "2", company_name: "Aramco Travel Desk" }, { doctype: "Test Org", name: "5", company_name: "Rotana Hotels" }],
      "Test Kind": [{ doctype: "Test Kind", name: "kind_1", kind_name: "Inbound" }],
    },
  });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }} translations={opts.translations} translatedDoctypes={opts.translatedDoctypes}>{node}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method?: string) => transport.store.calls.filter((c) => !method || c.method === method);
  return { transport, calls, ...utils };
}
const df = (d: Partial<FrappeDocField> & { fieldtype: string }) => ({ fieldname: d.fieldname ?? "f", label: d.label ?? "Field", ...d }) as FrappeDocField;
const tick = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("P36D.fields Data options (data.js, utils.js validate_type)", () => {
  it("P36D.fields.1 Data with options Email / Phone / URL / Name is <input type=text autocomplete=off> (data.js:4-5, :15), LTR for Email / Phone / URL, maxlength df.length || 140 (data.js:229-238); the Phone FIELDTYPE keeps type=tel (negative control)", () => {
    for (const [opt, ltr] of [["Email", true], ["Phone", true], ["URL", true], ["Name", false], [undefined, false]] as const) {
      setup(<FrappeField df={df({ fieldtype: "Data", options: opt, label: `L-${opt}` })} value="" onChange={() => {}} />);
      const box = screen.getByRole("textbox", { name: `L-${opt}` }) as HTMLInputElement;
      expect(box.getAttribute("type"), String(opt)).toBe("text");
      expect(box.getAttribute("autocomplete"), String(opt)).toBe("off");
      expect(box.getAttribute("maxlength"), String(opt)).toBe("140");
      expect(box.getAttribute("dir"), String(opt)).toBe(ltr ? "ltr" : null);
      cleanup();
    }
    setup(<FrappeField df={df({ fieldtype: "Data", options: "Email", label: "Short", length: 20 })} value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Short" }).getAttribute("maxlength")).toBe("20");
    cleanup();
    setup(<FrappeField df={df({ fieldtype: "Phone", label: "Phone FT" })} value="" onChange={() => {}} />);
    expect((screen.getByRole("textbox", { name: "Phone FT" }) as HTMLInputElement).type).toBe("tel");
  });

  it("P36D.fields.2 dataOptionInvalid uses Desk's patterns verbatim: Email over split_emails (utils.js:839-853, :470-473), Phone / Name / URL on the raw text (:455-459, :475-477); empty is never flagged", () => {
    // Email — a one-letter TLD and a bare word fail (the 0.7.0-dev.4 pattern accepted a@b.c)
    expect(dataOptionInvalid("Email", "reem@aramcotravel.com")).toBe(false);
    expect(dataOptionInvalid("Email", "a@b.c")).toBe(true);
    expect(dataOptionInvalid("Email", "not-an-email")).toBe(true);
    expect(dataOptionInvalid("Email", "a@b.com, c@d.org\ne@f.net")).toBe(false);
    expect(dataOptionInvalid("Email", "a@b.com, bad")).toBe(true);
    expect(dataOptionInvalid("Email", "a@[10.0.0.1]")).toBe(false);
    expect(splitEmails('"Doe, J" x@y.com, z@w.org')).toEqual(['"Doe, J" x@y.com', "z@w.org"]);
    // Phone — digits and + _ - , . * # ( ) and spaces, 1-20 characters, the raw text (no trim)
    expect(dataOptionInvalid("Phone", "+966 50-123 4567")).toBe(false);
    expect(dataOptionInvalid("Phone", "(011) 222*3#")).toBe(false);
    expect(dataOptionInvalid("Phone", "05x-abc")).toBe(true);
    expect(dataOptionInvalid("Phone", "1".repeat(20))).toBe(false);
    expect(dataOptionInvalid("Phone", "1".repeat(21))).toBe(true);
    expect(dataOptionInvalid("Phone", ` ${"1".repeat(20)}`)).toBe(true);
    // Name — JS \w is ASCII-only in Desk (an Arabic name is flagged on the client; the server's Python \w accepts it)
    expect(dataOptionInvalid("Name", "John O'Neil-Smith")).toBe(false);
    expect(dataOptionInvalid("Name", "John  Doe")).toBe(true);
    expect(dataOptionInvalid("Name", "عبدالله")).toBe(true);
    // URL — a scheme or www. / user@ is needed; a site-relative path is flagged on the client (the server accepts "/…")
    expect(dataOptionInvalid("URL", "https://example.com/a/b?x=1#top")).toBe(false);
    expect(dataOptionInvalid("URL", "www.example.com")).toBe(false);
    expect(dataOptionInvalid("URL", "example")).toBe(true);
    expect(dataOptionInvalid("URL", "/app/todo")).toBe(true);
    // never flagged: empty, other options
    for (const o of ["Email", "Phone", "Name", "URL"]) expect(dataOptionInvalid(o, "")).toBe(false);
    expect(dataOptionInvalid(undefined, "anything @ all")).toBe(false);
    expect(dataOptionInvalid("Barcode", "%%%")).toBe(false);
  });

  it("P36D.fields.3 an invalid Email is FLAGGED, not refused: the value is written, aria-invalid + 'Not a valid Email' status (data.js:293-306, base_input.js:217-226); a valid one is not flagged", async () => {
    const onChange = vi.fn();
    const { rerender } = setup(<FrappeField df={df({ fieldtype: "Data", options: "Email", label: "Email" })} value="" onChange={onChange} />);
    const box = screen.getByRole("textbox", { name: "Email" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "a@b.c" } });
    fireEvent.blur(box);
    expect(onChange).toHaveBeenLastCalledWith("a@b.c");
    const wrap = (v: string) => (
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient()}>
          <FrappeProvider client={createFrappeClient({ transport: createFixtureTransport({ meta: {}, docs: {} }) })} session={{ user: "Administrator" }}>
            <FrappeField df={df({ fieldtype: "Data", options: "Email", label: "Email" })} value={v} onChange={onChange} />
          </FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
    rerender(wrap("a@b.c"));
    expect(screen.getByRole("textbox", { name: "Email" }).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(/Not a valid Email/);
    rerender(wrap("a@b.co"));
    expect(screen.getByRole("textbox", { name: "Email" }).getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("P36D.fields paste, focus, placeholder (data.js, int.js)", () => {
  it("P36D.fields.4 pasting more than maxlength shows Desk's 'Data Clipped' message (data.js:19-62); a paste within the limit does not (negative control)", async () => {
    setup(<FrappeField df={df({ fieldtype: "Data", label: "City", length: 10 })} value="" onChange={() => {}} />);
    const box = screen.getByRole("textbox", { name: "City" });
    fireEvent.paste(box, { clipboardData: { getData: () => "short" } });
    await tick();
    expect(screen.queryByText(/Data Clipped/)).toBeNull();
    fireEvent.paste(box, { clipboardData: { getData: () => "x".repeat(25) } });
    expect(await screen.findByText("Data Clipped")).toBeTruthy();
    expect(screen.getByText("The value you pasted was 25 characters long. Max allowed characters is 10.")).toBeTruthy();
  });

  it("P36D.fields.5 Float / Currency / Percent select their text on focus like Int (int.js:7-12 make_input, inherited by float.js:1 / :29)", async () => {
    for (const ft of ["Int", "Float", "Currency", "Percent"]) {
      setup(<FrappeField df={df({ fieldtype: ft, label: ft })} value={1234} onChange={() => {}} />);
      const box = screen.getByRole("textbox", { name: ft }) as HTMLInputElement;
      const select = vi.spyOn(box, "select");
      fireEvent.focus(box);
      await tick(40);
      expect(select, ft).toHaveBeenCalled();
      cleanup();
    }
  });

  it("P36D.fields.6 the placeholder goes through __() for Data, Small Text, Select and Link (data.js:244, select.js:31); Link and Small Text had none before", () => {
    const tr = { "Type here": "اكتب هنا" };
    setup(
      <div>
        <FrappeField df={df({ fieldname: "a", fieldtype: "Data", label: "A", placeholder: "Type here" })} value="" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "b", fieldtype: "Small Text", label: "B", placeholder: "Type here" })} value="" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "c", fieldtype: "Link", options: "Test Kind", label: "C", placeholder: "Type here" })} value={null} onChange={() => {}} />
      </div>,
      { translations: tr },
    );
    for (const n of ["A", "B", "C"]) expect(screen.getByRole(n === "C" ? "combobox" : "textbox", { name: n }).getAttribute("placeholder"), n).toBe("اكتب هنا");
  });
});

describe("P36D.fields Link (link.js)", () => {
  it("P36D.fields.7 a Link input has maxlength df.length || 140 (data.js:229-238, ControlLink extends ControlData) and the 'Data Clipped' paste warning", async () => {
    setup(<FrappeField df={df({ fieldtype: "Link", options: "Test Kind", label: "Kind" })} value={null} onChange={() => {}} />);
    const box = screen.getByRole("combobox", { name: "Kind" });
    expect(box.getAttribute("maxlength")).toBe("140");
    fireEvent.paste(box, { clipboardData: { getData: () => "k".repeat(141) } });
    expect(await screen.findByText("Data Clipped")).toBeTruthy();
  });

  it("P36D.fields.8 a value of a DocType with show_title_field_in_link shows its TITLE, fetched with get_link_title {doctype, docname} when not cached (link.js:117-132, utils.js:1585-1604) — SIMULATED", async () => {
    const { calls } = setup(<FrappeField df={df({ fieldtype: "Link", options: "Test Org", label: "Organization" })} value="2" onChange={() => {}} />);
    const box = screen.getByRole("combobox", { name: "Organization" }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("Aramco Travel Desk"));
    expect(calls("frappe.desk.search.get_link_title").map((c) => c.args)).toEqual([{ doctype: "Test Org", docname: "2" }]);
  });

  it("P36D.fields.9 negative controls: a DocType without show_title_field_in_link, a missing record and an unknown DocType keep the NAME shown, with no message (fetch_link_title swallows errors, utils.js:1599-1603) — SIMULATED", async () => {
    setup(
      <div>
        <FrappeField df={df({ fieldname: "k", fieldtype: "Link", options: "Test Kind", label: "Kind" })} value="kind_1" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "o", fieldtype: "Link", options: "Test Org", label: "Org" })} value="99" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "u", fieldtype: "Link", options: "Nope", label: "Unknown" })} value="X-1" onChange={() => {}} />
      </div>,
    );
    await tick(30);
    expect((screen.getByRole("combobox", { name: "Kind" }) as HTMLInputElement).value).toBe("kind_1");
    expect((screen.getByRole("combobox", { name: "Org" }) as HTMLInputElement).value).toBe("99");
    expect((screen.getByRole("combobox", { name: "Unknown" }) as HTMLInputElement).value).toBe("X-1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("P36D.fields.10 the simulated get_link_title answers like search.py:327-334: title / docname / null; an unknown DocType is a DoesNotExistError", async () => {
    const t = createFixtureTransport({ meta: { "Test Org": [ORG], "Test Kind": [KIND] }, docs: { "Test Org": [{ doctype: "Test Org", name: "2", company_name: "Aramco" }] } });
    expect((await t("frappe.desk.search.get_link_title", { doctype: "Test Org", docname: "2" })).message).toBe("Aramco");
    expect((await t("frappe.desk.search.get_link_title", { doctype: "Test Org", docname: "404" })).message).toBeNull();
    expect((await t("frappe.desk.search.get_link_title", { doctype: "Test Kind", docname: "kind_9" })).message).toBe("kind_9");
    await expect(t("frappe.desk.search.get_link_title", { doctype: "Nope", docname: "1" })).rejects.toMatchObject({ excType: "DoesNotExistError" });
  });

  it("P36D.fields.12 a Link to a translated DocType (Desk boot.translated_doctypes) shows its value and its search results in the UI language; others keep the name — SIMULATED", async () => {
    setup(
      <div>
        <FrappeField df={df({ fieldname: "k", fieldtype: "Link", options: "Test Kind", label: "Kind" })} value="kind_1" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "o", fieldtype: "Link", options: "Test Org", label: "Org" })} value="99" onChange={() => {}} />
      </div>,
      { translations: { kind_1: "وارد", "99": "تسعة وتسعون" }, translatedDoctypes: ["Test Kind"] },
    );
    await tick(30);
    const kind = screen.getByRole("combobox", { name: "Kind" }) as HTMLInputElement;
    expect(kind.value).toBe("وارد");
    expect((screen.getByRole("combobox", { name: "Org" }) as HTMLInputElement).value).toBe("99");
    fireEvent.focus(kind);
    fireEvent.change(kind, { target: { value: "kind" } });
    await waitFor(() => expect(screen.getAllByRole("option").some((o) => o.textContent?.includes("وارد"))).toBe(true), { timeout: 2000 });
  });

  it("P36D.fields.11 LinkInput (Core) passes maxLength and onPaste to its input; without them nothing changes (negative control)", () => {
    const onPaste = vi.fn();
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <LinkInput aria-label="With" value={null} onChange={() => {}} search={async () => []} maxLength={12} onPaste={onPaste} />
        <LinkInput aria-label="Without" value={null} onChange={() => {}} search={async () => []} />
      </ThemeProvider>,
    );
    const w = screen.getByRole("combobox", { name: "With" });
    expect(w.getAttribute("maxlength")).toBe("12");
    fireEvent.paste(w, { clipboardData: { getData: () => "x" } });
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Without" }).getAttribute("maxlength")).toBeNull();
  });
});
