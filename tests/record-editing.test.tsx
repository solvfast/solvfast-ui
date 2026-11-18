/**
 * FrappeFormView `sectionEdit` (a record's read-first editing, 0.10.0): `editScope` "section" | "record" on one mechanism,
 * dirty only after a real change (decision A-3), a newer server copy while nothing changed, and the read view (Desk's
 * column order, description-list semantics, theme tokens, no capitals / letter-spacing on Arabic labels).
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeFormView, type FrappeFormViewProps } from "../src/frappe/form";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); });

const ALL = { read: true, write: true, create: true, submit: false, cancel: false, amend: false };
const rights = { levels: [ALL], can: (p: string) => !!(ALL as Record<string, boolean>)[p], known: true };
// Section 1 has two Desk columns (Title, Code | City, Country); section 2 a Select, a Date, a Link with a fetched field.
const META: DocTypeMeta = {
  name: "Memo", autoname: "hash", title_field: "title", permissions: [],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "code", fieldtype: "Data", label: "Code" },
    { fieldname: "col_b", fieldtype: "Column Break" },
    { fieldname: "city", fieldtype: "Data", label: "City" },
    { fieldname: "country", fieldtype: "Data", label: "Country" },
    { fieldname: "more_section", fieldtype: "Section Break", label: "More" },
    { fieldname: "kind", fieldtype: "Select", label: "Kind", options: "\nSmall\nLarge" },
    { fieldname: "due", fieldtype: "Date", label: "Due" },
    { fieldname: "customer", fieldtype: "Link", label: "Customer", options: "Customer" },
    { fieldname: "customer_name", fieldtype: "Data", label: "Customer Name", fetch_from: "customer.customer_name" },
  ],
};
const D1: FrappeDoc = {
  doctype: "Memo", name: "M1", docstatus: 0, modified: "2026-11-01 10:00:00",
  title: "Budget", code: "B-1", city: "Cairo", country: "Egypt", kind: "Small", due: "2026-12-01", customer: "CUST-1", customer_name: "Acme",
};

function view(doc: FrappeDoc, props: Partial<FrappeFormViewProps> = {}, lang: "en" | "ar" = "en") {
  return (
    <ThemeProvider defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}>
        <FrappeProvider client={createFrappeClient({ transport: async () => ({ message: [] }) })}>
          <FrappeFormView guardUnload={false} permissions={rights} bundle={{ doctype: "Memo", meta: META, children: {} }} doc={doc}
            onSave={async (d) => ({ ...d, __unsaved: undefined, modified: "2026-11-01 11:00:00" })} sectionEdit {...props} />
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
const saveButton = () => screen.queryByRole("button", { name: "Save" }) as HTMLButtonElement | null;
const box = (name: string) => screen.queryByRole("textbox", { name }) as HTMLInputElement | null;
const section = (label: string) => document.querySelector(`[data-section][aria-label="${label}"]`) as HTMLElement;

describe("RE.title — an unlabelled section's card title", () => {
  // Like a Sayr family record: the form's first section (no Section Break), a labelled one, then the family's own block
  // after an unlabelled Section Break.
  const META2: DocTypeMeta = {
    name: "Memo", autoname: "hash", title_field: "title", permissions: [],
    fields: [
      { fieldname: "title", fieldtype: "Data", label: "Title" },
      { fieldname: "content_section", fieldtype: "Section Break", label: "Content" },
      { fieldname: "body", fieldtype: "Small Text", label: "Body" },
      { fieldname: "own_block", fieldtype: "Section Break" },
      { fieldname: "flow", fieldtype: "Data", label: "Lifecycle", read_only: 1 },
      { fieldname: "since", fieldtype: "Data", label: "Status Since", read_only: 1 },
      { fieldname: "hidden_one", fieldtype: "Data", label: "Hidden", hidden: 1 },
    ],
  };
  const D2: FrappeDoc = { doctype: "Memo", name: "M2", docstatus: 0, modified: "2026-11-01 10:00:00", title: "T", body: "B", flow: "LC-1", since: "2026-11-01" };
  const titles = () => Array.from(document.querySelectorAll("section[data-section]")).map((x) => x.getAttribute("aria-label"));
  const mount = (lang: "en" | "ar", translations: Record<string, string> = {}) => render(
    <ThemeProvider defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}>
        <FrappeProvider client={createFrappeClient({ transport: async () => ({ message: [] }) })} translations={translations}>
          <FrappeFormView guardUnload={false} permissions={rights} bundle={{ doctype: "Memo", meta: META2, children: {} }} doc={D2}
            onSave={async (d) => d} sectionEdit />
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

  it("RE.title.1 the first unlabelled section is Details; a later one is named after its visible fields (never two Details)", () => {
    mount("en");
    expect(titles()).toEqual(["Details", "Content", "Lifecycle · Status Since"]);
    // read-only fields only: no Edit there; an editable section's Edit is named with its title
    expect(document.querySelector('[data-section-edit="own_block"]')).toBeNull();
    expect(document.querySelector('[data-section-edit="content_section"]')?.getAttribute("aria-label")).toBe("Edit · Content");
  });

  it("RE.title.2 in Arabic the derived title uses the translated field labels", () => {
    mount("ar", { Lifecycle: "دورة الحياة", "Status Since": "الحالة منذ", Content: "المحتوى" });
    const t = titles();
    expect(t[1]).toBe("المحتوى");
    expect(t[2]).toBe("دورة الحياة · الحالة منذ");
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("RE.dirty — opening a section is not a change (A-3)", () => {
  it("RE.dirty.1 an opened section shows Save held (clickable), no Not Saved, no onDirtyChange(true); a change turns them on", () => {
    const dirty: boolean[] = [];
    render(view(D1, { onDirtyChange: (d) => dirty.push(d) }));
    expect(saveButton()).toBeNull();
    fireEvent.click(document.querySelector("[data-section-edit]") as HTMLElement);
    expect(box("Title")).not.toBeNull();
    expect(saveButton()?.disabled).toBe(false); expect(saveButton()?.hasAttribute("data-primary-held")).toBe(true); // held: shown, clickable, not yet a change
    expect(screen.queryByText("Not Saved")).toBeNull();
    expect(dirty.includes(true)).toBe(false);
    fireEvent.change(box("Title")!, { target: { value: "Budget 2" } }); fireEvent.blur(box("Title")!);
    expect(saveButton()?.disabled).toBe(false);
    expect(screen.getByText("Not Saved")).toBeTruthy();
    expect(dirty.at(-1)).toBe(true);
  });

  it("RE.dirty.2 a Select, a Date and a Link with a fetched field opened untouched write nothing (never dirty)", async () => {
    const dirty: boolean[] = [];
    render(view(D1, { onDirtyChange: (d) => dirty.push(d) }));
    fireEvent.click(within(section("More")).getByRole("button", { name: /Edit/ }));
    await new Promise((r) => setTimeout(r, 30));
    expect(section("More").getAttribute("data-section-open")).toBe("1");
    expect(dirty.includes(true)).toBe(false);
    expect(screen.queryByText("Not Saved")).toBeNull();
  });

  it("RE.dirty.3 an untouched open section cancels cleanly; a changed one cancelled while another stays open untouched leaves the form clean", () => {
    const dirty: boolean[] = [];
    render(view(D1, { onDirtyChange: (d) => dirty.push(d) }));
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    fireEvent.click(document.querySelector("[data-section-cancel]") as HTMLElement);
    expect(box("Title")).toBeNull();
    expect(saveButton()).toBeNull();
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    fireEvent.change(box("Title")!, { target: { value: "Changed" } }); fireEvent.blur(box("Title")!);
    fireEvent.click(within(section("More")).getByRole("button", { name: /Edit/ }));
    expect(screen.getByText("Not Saved")).toBeTruthy();
    fireEvent.click(within(section("Details")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Not Saved")).toBeNull();
    expect(dirty.at(-1)).toBe(false);
    expect(within(section("Details")).getByText("Budget")).toBeTruthy();
    expect(saveButton()?.disabled).toBe(false); expect(saveButton()?.hasAttribute("data-primary-held")).toBe(true); // held: shown, clickable, not yet a change
  });

  it("RE.dirty.4 a newer server copy while an open section is untouched just refreshes (no banner, the section stays open); after a change it warns", () => {
    const { rerender } = render(view(D1));
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    rerender(view({ ...D1, title: "Budget (server)", modified: "2026-11-01 10:05:00" }));
    expect(document.querySelector("[data-newer-on-server]")).toBeNull();
    expect(box("Title")?.value).toBe("Budget (server)");
    expect(section("Details").getAttribute("data-section-open")).toBe("1");
    fireEvent.change(box("Title")!, { target: { value: "mine" } }); fireEvent.blur(box("Title")!);
    rerender(view({ ...D1, title: "Budget (server 2)", modified: "2026-11-01 10:09:00" }));
    expect(document.querySelector("[data-newer-on-server]")).not.toBeNull();
    expect(box("Title")?.value).toBe("mine");
  });

  it("RE.dirty.5 a workflow's clean form (no Save of its own) shows Save, held, once a section is open", () => {
    render(view(D1, { workflowActionsShown: true }));
    expect(saveButton()).toBeNull();
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    expect(saveButton()?.disabled).toBe(false); expect(saveButton()?.hasAttribute("data-primary-held")).toBe(true); // held: shown, clickable, not yet a change
    fireEvent.change(box("Code")!, { target: { value: "B-2" } }); fireEvent.blur(box("Code")!);
    expect(saveButton()?.disabled).toBe(false);
  });
});

describe("RE.dirty (more) — the keyboard and a right taken away", () => {
  it("RE.dirty.6 Ctrl+S with a section open and nothing changed does nothing (a submittable draft's Submit gives way to the held Save)", () => {
    const SUBMIT = { ...ALL, submit: true };
    const subRights = { levels: [SUBMIT], can: (p: string) => !!(SUBMIT as Record<string, boolean>)[p], known: true };
    const subMeta = { ...META, is_submittable: 1 } as DocTypeMeta;
    render(
      <ThemeProvider defaultLanguage="en" storageKeys={null}><QueryClientProvider client={new QueryClient()}><FrappeProvider client={createFrappeClient({ transport: async () => ({ message: [] }) })}>
        <FrappeFormView guardUnload={false} permissions={subRights} bundle={{ doctype: "Memo", meta: subMeta, children: {} }} doc={D1} onSave={async (d) => d} sectionEdit />
      </FrappeProvider></QueryClientProvider></ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(saveButton()?.disabled).toBe(false); expect(saveButton()?.hasAttribute("data-primary-held")).toBe(true); // held: shown, clickable, not yet a change
    fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("RE.dirty.7 a section (or the record) that can no longer be edited after a refresh (a read-only workflow state) reads again — no Save left behind", () => {
    // A workflow state the user may not edit: the fields read (levels), the document right itself stays.
    const readOnly = { levels: [{ read: true }], can: rights.can, known: true, workflowReadOnly: true };
    const { rerender } = render(view(D1));
    fireEvent.click(within(section("Details")).getByRole("button", { name: /Edit/ }));
    expect(box("Title")).not.toBeNull();
    rerender(view({ ...D1, modified: "2026-11-01 10:05:00" }, { permissions: readOnly }));
    expect(box("Title")).toBeNull();
    expect(saveButton()).toBeNull();
    cleanup();
    const r = render(view(D1, { editScope: "record" }));
    fireEvent.click(document.querySelector("[data-record-edit]") as HTMLElement);
    r.rerender(view({ ...D1, modified: "2026-11-01 10:05:00" }, { editScope: "record", permissions: readOnly }));
    expect(box("Title")).toBeNull();
    expect(saveButton()).toBeNull();
    expect(document.querySelector("[data-record-cancel-edit]")).toBeNull();
  });
});

describe("RE.record — editScope=\"record\": one Edit, one Cancel, on the same open sections", () => {
  it("RE.record.1 one Edit (in the toolbar without a header) opens every editable section; no section buttons; Cancel puts the saved copy back", () => {
    const dirty: boolean[] = [];
    render(view(D1, { editScope: "record", onDirtyChange: (d) => dirty.push(d) }));
    expect(document.querySelectorAll("[data-record-edit]").length).toBe(1);
    expect(document.querySelector("[data-section-edit]")).toBeNull();
    expect(box("Title")).toBeNull();
    fireEvent.click(document.querySelector("[data-record-edit]") as HTMLElement);
    expect(box("Title")).not.toBeNull();
    expect(box("City")).not.toBeNull();
    expect(box("Code")).not.toBeNull();
    expect(document.querySelector("[data-section-edit]")).toBeNull();
    expect(document.querySelector("[data-section-cancel]")).toBeNull();
    expect(document.querySelector("[data-record-edit]")).toBeNull();
    expect(saveButton()?.disabled).toBe(false); expect(saveButton()?.hasAttribute("data-primary-held")).toBe(true); // held: shown, clickable, not yet a change
    expect(dirty.includes(true)).toBe(false);
    fireEvent.change(box("City")!, { target: { value: "Giza" } }); fireEvent.blur(box("City")!);
    expect(screen.getByText("Not Saved")).toBeTruthy();
    fireEvent.click(document.querySelector("[data-record-cancel-edit]") as HTMLElement);
    expect(box("City")).toBeNull();
    expect(screen.getByText("Cairo")).toBeTruthy();
    expect(screen.queryByText("Not Saved")).toBeNull();
    expect(dirty.at(-1)).toBe(false);
    expect(document.querySelector("[data-record-cancel-edit]")).toBeNull();
    expect(document.querySelectorAll("[data-record-edit]").length).toBe(1);
  });

  it("RE.record.2 Save saves and goes back to reading", async () => {
    render(view(D1, { editScope: "record" }));
    fireEvent.click(document.querySelector("[data-record-edit]") as HTMLElement);
    fireEvent.change(box("Country")!, { target: { value: "Egypt (EG)" } }); fireEvent.blur(box("Country")!);
    fireEvent.click(saveButton()!);
    await screen.findByText("Egypt (EG)");
    expect(box("Country")).toBeNull();
    expect(document.querySelector("[data-record-cancel-edit]")).toBeNull();
    expect(document.querySelector("[data-record-edit]")).not.toBeNull();
  });

  it("RE.record.5 typing then pressing Save at once saves on that first press (the press commits the field)", async () => {
    const saved: FrappeDoc[] = [];
    render(view(D1, { editScope: "record", onSave: async (d) => { saved.push(d); return { ...d, __unsaved: undefined, modified: "2026-11-01 11:00:00" }; } }));
    fireEvent.click(document.querySelector("[data-record-edit]") as HTMLElement);
    const input = box("Country")!;
    input.focus();
    fireEvent.change(input, { target: { value: "Egypt (EG)" } }); // typed, not yet committed (no blur)
    const save = saveButton()!;
    expect(save.disabled).toBe(false); // a disabled button would swallow this first press
    // A real press: mousedown moves the focus (the field blurs and commits its value), then the click.
    fireEvent.mouseDown(save); input.blur(); fireEvent.click(save);
    await screen.findByText("Egypt (EG)");
    expect(saved.length).toBe(1);
    expect(box("Country")).toBeNull();
  });

  it("RE.record.6 Save with nothing changed just closes the open sections (no save request, never Not Saved)", () => {
    const saved: FrappeDoc[] = [];
    render(view(D1, { editScope: "record", onSave: async (d) => { saved.push(d); return d; } }));
    fireEvent.click(document.querySelector("[data-record-edit]") as HTMLElement);
    expect(box("Country")).not.toBeNull();
    fireEvent.click(saveButton()!);
    expect(box("Country")).toBeNull();
    expect(saved.length).toBe(0);
    expect(screen.queryByText("Not Saved")).toBeNull();
  });

  it("RE.record.3 a header render function places the Edit (and the toolbar then has none)", () => {
    render(view(D1, { editScope: "record", header: ({ editAction, editing }) => <div data-test-header={editing ? "editing" : "reading"}>{editAction}</div> }));
    const header = document.querySelector("[data-test-header]") as HTMLElement;
    expect(header.getAttribute("data-test-header")).toBe("reading");
    expect(document.querySelectorAll("[data-record-edit]").length).toBe(1);
    expect(header.querySelector("[data-record-edit]")).not.toBeNull();
    fireEvent.click(header.querySelector("[data-record-edit]") as HTMLElement);
    expect(document.querySelector("[data-test-header]")?.getAttribute("data-test-header")).toBe("editing");
    expect(document.querySelector("[data-record-edit]")).toBeNull();
    expect(document.querySelector("[data-record-cancel-edit]")).not.toBeNull();
  });

  it("RE.record.4 the default scope is per section", () => {
    render(view(D1));
    expect(document.querySelector("[data-record-edit]")).toBeNull();
    expect(document.querySelectorAll("[data-section-edit]").length).toBe(2);
  });
});

describe("RE.read — the read view", () => {
  it("RE.read.1 Desk's columns stay columns: column 1's fields, then column 2's", () => {
    render(view(D1));
    const cols = section("Details").querySelectorAll("[data-read-column]");
    expect(cols.length).toBe(2);
    expect([...cols[0]!.querySelectorAll("[data-read-row]")].map((r) => r.getAttribute("data-read-row"))).toEqual(["title", "code"]);
    expect([...cols[1]!.querySelectorAll("[data-read-row]")].map((r) => r.getAttribute("data-read-row"))).toEqual(["city", "country"]);
    expect([...section("Details").querySelectorAll("[data-read-row]")].map((r) => r.getAttribute("data-read-row"))).toEqual(["title", "code", "city", "country"]);
  });

  it("RE.read.2 label and value are a description list (dl > div > dt + dd); blank reads — Not provided", () => {
    render(view({ ...D1, code: "" }));
    const rows = [...document.querySelectorAll("[data-read-row]")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tagName).toBe("DIV");
      expect(row.parentElement?.tagName).toBe("DL");
      expect([...row.children].map((c) => c.tagName)).toEqual(["DT", "DD"]);
    }
    const code = document.querySelector('[data-read-row="code"]') as HTMLElement;
    expect(code.querySelector("dt")?.textContent).toBe("Code");
    expect(code.querySelector("dd [data-not-provided]")?.textContent).toBe("— Not provided");
  });

  it("RE.read.2b in an open section a read-only field still reads as a dl row (dt + dd), never a bare dt / dd", () => {
    render(view(D1));
    fireEvent.click(within(section("More")).getByRole("button", { name: /Edit/ }));
    const row = document.querySelector('[data-read-row="customer_name"]') as HTMLElement;
    expect(row.parentElement?.tagName).toBe("DL");
    for (const el of document.querySelectorAll("dt, dd")) expect(el.parentElement?.parentElement?.tagName).toBe("DL");
  });

  it("RE.read.3 the icon tiles use theme tokens, not palette colours", () => {
    render(view(D1));
    for (const tile of document.querySelectorAll("[data-read-tone]")) {
      expect(tile.className).not.toMatch(/(emerald|sky|amber|orange)-\d{3}/);
      expect(tile.getAttribute("aria-hidden")).toBe("true");
    }
    expect(document.querySelector('[data-read-row="due"] [data-read-tone]')?.className).toContain("text-warning");
  });

  it("RE.read.4 Latin labels are small capitals with letter-spacing; Arabic labels are not", () => {
    render(view(D1));
    const en = document.querySelector('[data-read-row="title"] dt') as HTMLElement;
    expect(en.className).toContain("uppercase");
    expect(en.className).toContain("tracking-wide");
    cleanup();
    render(view(D1, {}, "ar"));
    const ar = document.querySelector('[data-read-row="title"] dt') as HTMLElement;
    expect(ar.className).not.toContain("uppercase");
    expect(ar.className).not.toContain("tracking");
  });
});

void React;
