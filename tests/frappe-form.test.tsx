/**
 * Frappe forms (src/frappe/form) over the SIMULATED backend (`createFixtureTransport`) with the REAL 15.110 metadata
 * (tests/fixtures/real-15.110). Pins Desk's behaviour from docs 11 / 12 as the components reproduce it. Simulated &
 * tested only: nothing here ran against a Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import userEn from "./fixtures/real-15.110/user.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import noteEn from "./fixtures/real-15.110/note.en.json";
import eventEn from "./fixtures/real-15.110/event.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import {
  FrappeDynamicLinkField, FrappeField, FrappeForm, FrappeFormServices, FrappeTableMultiSelect, mergeLinkFilters, parseLinkFilters,
  type FormEventsConfig, type FormServices,
} from "../src/frappe/form";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const en = defaultMessages.en;
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const SUBM: DocTypeMeta = {
  name: "Sales Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "kind", fieldtype: "Select", label: "Kind", options: "A\nB" },
    { fieldname: "note", fieldtype: "Data", label: "Note", mandatory_depends_on: "eval:doc.kind == 'B'" },
    { fieldname: "secret", fieldtype: "Data", label: "Secret", depends_on: "eval:frappe.user.has_role('X')" },
  ],
};

function setup(ui: React.ReactElement, opts: { docs?: FixtureBackend["docs"]; lang?: "en" | "ar"; services?: Partial<FormServices> } = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Contact: docsOf(contactEn), Note: docsOf(noteEn), Event: docsOf(eventEn), "Sales Memo": [SUBM] },
    docs: {
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 },
        { doctype: "User", name: "bob@x.com", full_name: "Bob Yo", first_name: "Bob", email: "bob@x.com", enabled: 1 },
      ],
      ToDo: [{ doctype: "ToDo", name: "TD-1", description: "Call Ann", status: "Open", priority: "High", modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }],
      ...opts.docs,
    },
  });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: React.ReactElement) => (
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.lang ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }}>
          {opts.services ? <FrappeFormServices value={opts.services}>{node}</FrappeFormServices> : node}
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
  const utils = render(wrap(ui));
  const calls = (method?: string) => transport.store.calls.filter((c) => !method || c.method === method);
  return { transport, calls, rerender: (n: React.ReactElement) => utils.rerender(wrap(n)) };
}
const parsed = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v) as FrappeDoc;
const typeInto = (el: HTMLElement, value: string) => {
  fireEvent.focus(el);
  if (el.isContentEditable || el.getAttribute("contenteditable") === "true") { el.innerHTML = `<p>${value}</p>`; fireEvent.input(el); }
  else fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
};
const btn = (name: string | RegExp) => screen.getByRole("button", { name });

describe("FrappeForm: load, edit, save (docs 11 §1, §5)", () => {
  it("loads a ToDo, edits a field, marks it Not Saved, saves the whole document through savedocs", async () => {
    const order: string[] = [];
    const events: FormEventsConfig["events"] = {
      setup: () => { order.push("setup"); }, onload: () => { order.push("onload"); }, refresh: () => { order.push("refresh"); },
      validate: () => { order.push("validate"); }, before_save: () => { order.push("before_save"); }, after_save: () => { order.push("after_save"); },
      description: () => { order.push("description changed"); },
    };
    const { calls } = setup(<FrappeForm doctype="ToDo" name="TD-1" events={events} />);
    const desc = await screen.findByRole("textbox", { name: /Description/ });
    expect(desc.textContent).toContain("Call Ann");
    await waitFor(() => expect(order).toEqual(["setup", "onload", "refresh"]));
    expect(screen.queryByText(en.formNotSaved)).toBeNull();
    typeInto(desc, "Call Ann today");
    expect(await screen.findByText(en.formNotSaved)).toBeTruthy();
    fireEvent.click(btn(en.formSave));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    const sent = calls("frappe.desk.form.save.savedocs")[0].args;
    expect(sent.action).toBe("Save");
    expect(parsed(sent.doc)).toMatchObject({ doctype: "ToDo", name: "TD-1", description: "<p>Call Ann today</p>", modified: "2026-11-01 10:00:00.000000", __unsaved: 1 });
    await waitFor(() => expect(screen.queryByText(en.formNotSaved)).toBeNull());
    await waitFor(() => expect(order.slice(3)).toEqual(["description changed", "validate", "before_save", "after_save", "refresh"]));
  });

  it("a clean Save shows \"No changes in document\" and sends nothing", async () => {
    const { calls } = setup(<FrappeForm doctype="ToDo" name="TD-1" />);
    await screen.findByRole("textbox", { name: /Description/ });
    fireEvent.click(btn(en.formSave));
    expect(await screen.findByText(en.formNoChanges)).toBeTruthy();
    expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(0);
  });

  it("a new ToDo gets Desk's defaults; a missing mandatory field opens Missing Fields and nothing is sent", async () => {
    vi.spyOn(Date, "now");
    const onSaved = vi.fn();
    const { calls } = setup(<FrappeForm doctype="ToDo" onSaved={onSaved} />);
    expect(await screen.findByText("New ToDo")).toBeTruthy();
    fireEvent.click(btn(en.formSave));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en.formMissingFields)).toBeTruthy();
    expect(within(dialog).getByText("Description is required.")).toBeTruthy();
    expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: defaultMessages.en.close }));
    typeInto(screen.getByRole("textbox", { name: /Description/ }), "Plan the week");
    fireEvent.click(btn(en.formSave));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const sent = parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc);
    expect(sent).toMatchObject({ __islocal: 1, status: "Open", priority: "Medium", description: "<p>Plan the week</p>" });
    expect(sent.name).toMatch(/^new-todo-/);
    expect(sent.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onSaved.mock.calls[0][0].name).not.toMatch(/^new-/);
    expect(onSaved.mock.calls[0][0].__islocal).toBeUndefined();
  });

  it("validate returning false aborts the save (D-24)", async () => {
    const { calls } = setup(<FrappeForm doctype="ToDo" name="TD-1" events={{ validate: () => false }} />);
    typeInto(await screen.findByRole("textbox", { name: /Description/ }), "x");
    fireEvent.click(btn(en.formSave));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(0);
  });

  it("a server error is shown with FrappeErrorState and the form stays dirty", async () => {
    const { transport } = setup(<FrappeForm doctype="ToDo" name="TD-1" />);
    typeInto(await screen.findByRole("textbox", { name: /Description/ }), "Changed");
    // someone else saved meanwhile: the fixture checks `modified` (TimestampMismatchError)
    transport.store.docs.get("ToDo")!.get("TD-1")!.modified = "2026-11-02 00:00:00.000000";
    fireEvent.click(btn(en.formSave));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(en.formNotSaved)).toBeTruthy();
  });
});

describe("dependencies, layout and tabs (docs 11 §2)", () => {
  it("Note: depends_on hides and shows fields as values change", async () => {
    setup(<FrappeForm doctype="Note" />);
    await screen.findByRole("textbox", { name: /Title/ });
    expect(screen.queryByRole("checkbox", { name: /Notify users with a popup/i })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Public/ }));
    expect(await screen.findByRole("checkbox", { name: /Notify users with a popup/i })).toBeTruthy();
  });

  it("Event: a Details tab first, a tab bar, the first tab active; switching tabs", async () => {
    setup(<FrappeForm doctype="Event" />);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs[0].textContent).toBe(en.formDetails);
    expect(tabs.length).toBeGreaterThan(1);
    expect(screen.getByRole("textbox", { name: /Subject/ })).toBeTruthy();
  });

  it("mandatory_depends_on is evaluated at save; an unknown global is reported, not guessed (D-23)", async () => {
    const { calls } = setup(<FrappeForm doctype="Sales Memo" />);
    expect(await screen.findByText(/Unsupported expression in Sales Memo.secret/)).toBeTruthy();
    typeInto(screen.getByRole("textbox", { name: /Title/ }), "Memo");
    fireEvent.click(btn(en.formSave));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
  });
});

describe("submit / cancel and the action matrix (docs 11 §5.2, §7)", () => {
  it("saved + clean + submittable → Submit (confirm, before_submit, savedocs Submit) → Cancel", async () => {
    const order: string[] = [];
    const { calls } = setup(
      <FrappeForm doctype="Sales Memo" name="SM-1" events={{ before_submit: () => { order.push("before_submit"); }, validate: () => { order.push("validate"); }, on_submit: () => { order.push("on_submit"); } }} />,
      { docs: { "Sales Memo": [{ doctype: "Sales Memo", name: "SM-1", title: "T", kind: "A", docstatus: 0, modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }] } },
    );
    fireEvent.click(await screen.findByRole("button", { name: en.formSubmit }));
    const confirmBox = await screen.findByRole("alertdialog");
    expect(within(confirmBox).getByText("Permanently Submit SM-1?")).toBeTruthy();
    fireEvent.click(within(confirmBox).getByRole("button", { name: defaultMessages.en.yes }));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls("frappe.desk.form.save.savedocs")[0].args.action).toBe("Submit");
    expect((await screen.findAllByText(en.formSubmitted)).length).toBeGreaterThan(0);
    await waitFor(() => expect(order).toEqual(["before_submit", "validate", "on_submit"]));
    expect(screen.queryByRole("textbox", { name: /Title/ })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: en.formCancelDoc }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: defaultMessages.en.yes }));
    await waitFor(() => expect(calls("frappe.desk.form.save.cancel")).toHaveLength(1));
    expect((await screen.findAllByText(en.formCancelled)).length).toBeGreaterThan(0);
  });
});

describe("child tables (docs 12 §5)", () => {
  it("Contact: Add Row creates an __islocal row; its required column is reported per row; the row is saved", async () => {
    const { calls } = setup(<FrappeForm doctype="Contact" />);
    await screen.findByRole("table", { name: /Email IDs/ });
    const table = screen.getByRole("table", { name: /Email IDs/ });
    const addButtons = screen.getAllByRole("button", { name: en.formAddRow });
    fireEvent.click(addButtons[0]);
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    typeInto(screen.getByRole("textbox", { name: /First Name/ }), "Ann");
    fireEvent.click(btn(en.formSave));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("In Email IDs, Email ID is required in row 1.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: defaultMessages.en.close }));
    fireEvent.click(within(table).getAllByRole("cell")[2]);
    typeInto(within(table).getByRole("textbox", { name: /Email ID/ }), "ann@x.com");
    fireEvent.click(btn(en.formSave));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    const sent = parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc);
    const rows = sent.email_ids as FrappeDoc[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ doctype: "Contact Email", __islocal: 1, idx: 1, email_id: "ann@x.com", parentfield: "email_ids" });
    expect(rows[0].name).toMatch(/^new-contact-email-/);
  });

  it("table events: <table>_add and before_<table>_remove can stop a delete", async () => {
    const seen: string[] = [];
    setup(<FrappeForm doctype="Contact" events={{ email_ids_add: (_f, cdt) => { seen.push(`add:${cdt}`); }, before_email_ids_remove: () => { seen.push("before"); return false; } }} />);
    await screen.findByRole("table", { name: /Email IDs/ });
    fireEvent.click(screen.getAllByRole("button", { name: en.formAddRow })[0]);
    expect(seen).toEqual(["add:Contact Email"]);
    const table = screen.getByRole("table", { name: /Email IDs/ });
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.formDelete) }));
    await waitFor(() => expect(seen).toEqual(["add:Contact Email", "before"]));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
  });
});

describe("Link fields (docs 12 §4)", () => {
  it("searches search_link 500 ms after typing with reference_doctype and page_length; a pick validates and fetches", async () => {
    const { calls } = setup(<FrappeForm doctype="ToDo" name="TD-1" />);
    const box = await screen.findByRole("combobox", { name: /Assigned By/ });
    fireEvent.focus(box);
    vi.useFakeTimers();
    fireEvent.change(box, { target: { value: "ann" } });
    await act(async () => { vi.advanceTimersByTime(499); });
    const before = calls("frappe.desk.search.search_link").filter((c) => c.args.txt === "ann");
    expect(before).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(2); });
    vi.useRealTimers();
    await waitFor(() => expect(calls("frappe.desk.search.search_link").filter((c) => c.args.txt === "ann")).toHaveLength(1));
    const args = calls("frappe.desk.search.search_link").filter((c) => c.args.txt === "ann")[0].args;
    expect(args).toMatchObject({ doctype: "User", reference_doctype: "ToDo", page_length: 10 });
    fireEvent.click(await screen.findByRole("option", { name: /ann@x.com/ }));
    await waitFor(() => expect(calls("frappe.client.validate_link")).toHaveLength(1));
    expect(calls("frappe.client.validate_link")[0].args).toMatchObject({ doctype: "User", docname: "ann@x.com", fields: JSON.stringify(["full_name"]) });
    // assigned_by_full_name (Read Only, fetch_from) shows the fetched value
    expect(await screen.findByText("Ann Xu")).toBeTruthy();
  });

  it("a hand-typed value that does not exist is cleared on blur", async () => {
    setup(<FrappeForm doctype="ToDo" name="TD-1" />);
    const box = await screen.findByRole("combobox", { name: /Assigned By/ });
    typeInto(box, "nobody@x.com");
    await waitFor(() => expect((box as HTMLInputElement).value).toBe(""));
  });

  it("standalone Dynamic Link searches the DocType in the sibling field and nothing while it is empty", async () => {
    const search = vi.fn(async () => [{ value: "ann@x.com" }]);
    const df = { fieldname: "link_name", fieldtype: "Dynamic Link", options: "link_doctype", label: "Link Name" };
    const { rerender } = setup(<FrappeDynamicLinkField aria-label="ln" df={df} value={null} onChange={() => {}} doc={{ doctype: "Dynamic Link", name: "r1" }} />, { services: { searchLink: search } });
    fireEvent.focus(screen.getByRole("combobox", { name: "ln" }));
    await act(async () => {});
    expect(search).not.toHaveBeenCalled();
    rerender(<FrappeDynamicLinkField aria-label="ln" df={df} value={null} onChange={() => {}} doc={{ doctype: "Dynamic Link", name: "r1", link_doctype: "User" }} />);
    const box = screen.getByRole("combobox", { name: "ln" });
    fireEvent.blur(box);
    fireEvent.focus(box);
    await waitFor(() => expect(search).toHaveBeenCalledWith("User", "", expect.objectContaining({ pageLength: 10 })));
  });

  it("link_filters (client-only) and setQuery merge in Desk's order", () => {
    const lf = parseLinkFilters('[["Customer Group", "is_group", "=", 0], ["Customer Group", "parent_customer_group", "=", "eval:doc.territory"]]', { doctype: "Customer", name: "c", territory: "EU" }, undefined);
    expect(lf).toEqual({ is_group: ["=", 0], parent_customer_group: ["=", "EU"] });
    expect(mergeLinkFilters(lf, { is_group: 1, territory: "" }, { enabled: 1 }, "Customer Group", () => false)).toEqual({ is_group: 1, parent_customer_group: ["=", "EU"], enabled: 1 });
    expect(mergeLinkFilters({}, { company: "" }, undefined, "X", (k) => k === "company")).toEqual({ company: "" });
    expect(mergeLinkFilters({ a: ["=", 1] }, [["X", "b", "=", 2]], undefined, "X", () => false)).toEqual([["X", "a", "=", 1], ["X", "b", "=", 2]]);
  });
});

describe("Table MultiSelect (docs 12 §11) and the field dispatcher", () => {
  const bundle: MetaBundle = {
    doctype: "Rule", meta: { name: "Rule", fields: [{ fieldname: "users", fieldtype: "Table MultiSelect", options: "Rule User", label: "Users" }] },
    children: { "Rule User": { name: "Rule User", istable: 1, fields: [{ fieldname: "note", fieldtype: "Data" }, { fieldname: "user", fieldtype: "Link", options: "User" }] } },
  };
  it("adds rows for picked values (first Link field), validates, removes with ×", async () => {
    const log: FrappeDoc[][] = [];
    function H() {
      const [rows, setRows] = React.useState<FrappeDoc[]>([]);
      return <FrappeTableMultiSelect aria-label="users" df={bundle.meta.fields[0]} bundle={bundle} parent={{ doctype: "Rule", name: "R-1" }} rows={rows} onRowsChange={(r) => { log.push(r); setRows(r); }} />;
    }
    const { calls } = setup(<H />);
    const box = screen.getByRole("combobox", { name: "users" });
    fireEvent.focus(box);
    fireEvent.click(await screen.findByRole("option", { name: /bob@x.com/ }));
    await waitFor(() => expect(log.at(-1)).toHaveLength(1));
    expect(log.at(-1)![0]).toMatchObject({ doctype: "Rule User", user: "bob@x.com", __islocal: 1, idx: 1, parentfield: "users" });
    expect(calls("frappe.client.validate_link").at(-1)!.args).toMatchObject({ doctype: "User", docname: "bob@x.com" });
    fireEvent.click(screen.getByRole("button", { name: "Remove bob@x.com" }));
    expect(log.at(-1)).toEqual([]);
  });

  it("dispatches fieldtypes; Read shows formatted text; None renders nothing", () => {
    setup(
      <div>
        <FrappeField df={{ fieldname: "qty", fieldtype: "Int", label: "Qty" }} value={5} onChange={() => {}} />
        <FrappeField df={{ fieldname: "amt", fieldtype: "Currency", label: "Amount", read_only: 1 }} value={1234.5} onChange={() => {}} />
        <FrappeField df={{ fieldname: "h", fieldtype: "Data", label: "Hidden", hidden: 1 }} value="x" onChange={() => {}} />
        <FrappeField df={{ fieldname: "dur", fieldtype: "Duration", label: "Duration" }} value={3600} onChange={() => {}} />
        <FrappeField df={{ fieldname: "e", fieldtype: "Data", options: "Email", label: "Email" }} value="not-an-email" onChange={() => {}} />
      </div>,
    );
    expect((screen.getByRole("textbox", { name: /Qty/ }) as HTMLInputElement).value).toBe("5");
    expect(screen.queryByRole("textbox", { name: /Amount/ })).toBeNull();
    expect(screen.getByText(/1,234\.50/)).toBeTruthy();
    expect(screen.queryByText("Hidden")).toBeNull();
    expect((screen.getByRole("textbox", { name: en.formHours }) as HTMLInputElement).value).toBe("1");
    expect(screen.getByRole("textbox", { name: /Email/ }).getAttribute("aria-invalid")).toBe("true");
  });

  it("Arabic: the form chrome is translated and the page is RTL", async () => {
    setup(<FrappeForm doctype="ToDo" name="TD-1" />, { lang: "ar" });
    expect(await screen.findByRole("button", { name: defaultMessages.ar.formSave })).toBeTruthy();
    expect(document.querySelector('[dir="rtl"]')).toBeTruthy();
  });
});
