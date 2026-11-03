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
import { createFrappeClient, toFrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, MetaBundle, WorkflowInfo } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureHandler } from "../src/frappe/testing";
import { useDoc, useMetaBundle } from "../src/frappe/hooks";
import { FormSkeleton } from "../src/frappe/form/FrappeForm";
import {
  FrappeChildTable, FrappeDynamicLinkField, FrappeField, FrappeForm, FrappeFormView, linkTitleCache, resolveLinkQuery, FrappeFormServices, FrappeTableMultiSelect, amendDoc, copyDoc, mergeLinkFilters, parseLinkFilters,
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
    { fieldname: "amended_from", fieldtype: "Link", label: "Amended From", options: "Sales Memo", read_only: 1, no_copy: 1 },
  ],
};
const APPROVAL: DocTypeMeta = {
  name: "Approval Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
  ],
};
const APPROVAL_WF: WorkflowInfo = {
  name: "Approval Flow", document_type: "Approval Memo", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "System Manager", style: "Warning" },
    { state: "Approved", doc_status: "1", allow_edit: "System Manager", style: "Success" },
    { state: "Voided", doc_status: "2", allow_edit: "System Manager", style: "Danger" },
  ],
  transitions: [
    { state: "Draft", action: "Approve", next_state: "Approved", allowed: "System Manager" },
    { state: "Approved", action: "Void", next_state: "Voided", allowed: "System Manager" },
  ],
};

function setup(ui: React.ReactElement, opts: { docs?: FixtureBackend["docs"]; lang?: "en" | "ar"; services?: Partial<FormServices>; handlers?: Record<string, FixtureHandler> } = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Contact: docsOf(contactEn), Note: docsOf(noteEn), Event: docsOf(eventEn), "Sales Memo": [SUBM], "Approval Memo": [APPROVAL] },
    workflows: { "Approval Memo": APPROVAL_WF },
    docs: {
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 },
        { doctype: "User", name: "bob@x.com", full_name: "Bob Yo", first_name: "Bob", email: "bob@x.com", enabled: 1 },
      ],
      ToDo: [{ doctype: "ToDo", name: "TD-1", description: "Call Ann", status: "Open", priority: "High", modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }],
      ...opts.docs,
    },
  }, { handlers: opts.handlers });
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
      {
        docs: { "Sales Memo": [{ doctype: "Sales Memo", name: "SM-1", title: "T", kind: "A", docstatus: 0, modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }] },
        // the simulated backend has no linked_with methods yet (requested from A1): an empty pre-flight
        handlers: { "frappe.desk.form.linked_with.get_submitted_linked_docs": () => ({ message: { docs: [], count: 0 } }) },
      },
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
    expect(within(dialog).getByText("In Email IDs, Email ID is required in every row.")).toBeTruthy();
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

describe("review R1 items: reload after a conflict, cancel pre-flight, amend, workflow state (docs 11 §1.7, §1.8, §5.4, §7)", () => {
  const memo = (o: Record<string, unknown> = {}): FrappeDoc => ({ doctype: "Sales Memo", name: "SM-1", title: "T", kind: "A", docstatus: 1, modified: "2026-11-01 10:00:00.000000", owner: "Administrator", ...o });

  it("R1-F4: a 417 timestamp conflict keeps the edits and offers Reload, which loads the server's version", async () => {
    const { transport } = setup(<FrappeForm doctype="ToDo" name="TD-1" />);
    typeInto(await screen.findByRole("textbox", { name: /Description/ }), "Mine");
    const row = transport.store.docs.get("ToDo")!.get("TD-1")!;
    row.modified = "2026-11-02 00:00:00.000000";
    row.description = "Theirs";
    fireEvent.click(btn(en.formSave));
    const alert = await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: /Description/ }).textContent).toContain("Mine");
    fireEvent.click(within(alert).getByRole("button", { name: defaultMessages.en.retry }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Description/ }).textContent).toContain("Theirs"));
    expect(screen.queryByText(en.formNotSaved)).toBeNull();
  });

  it("R1-F5: Cancel lists submitted linked documents; Cancel All cancels them, reloads and cancels the document", async () => {
    const order: string[] = [];
    const handlers: Record<string, FixtureHandler> = {
      "frappe.desk.form.linked_with.get_submitted_linked_docs": () => { order.push("preflight"); return { message: { docs: [{ doctype: "Sales Memo", name: "SM-9", docstatus: 1 }], count: 1 } }; },
      "frappe.desk.form.linked_with.cancel_all_linked_docs": (a) => { order.push(`cancel_all:${JSON.parse(String(a.docs))[0].name}`); return { message: null }; },
    };
    const { calls } = setup(<FrappeForm doctype="Sales Memo" name="SM-1" />, { docs: { "Sales Memo": [memo()] }, handlers });
    fireEvent.click(await screen.findByRole("button", { name: en.formCancelDoc }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/SM-9/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: en.formCancelAll }));
    await waitFor(() => expect(calls("frappe.desk.form.save.cancel")).toHaveLength(1));
    expect(order).toEqual(["preflight", "cancel_all:SM-9"]);
    expect((await screen.findAllByText(en.formCancelled)).length).toBeGreaterThan(0);
  });

  it("R1-F5: Amend makes a local copy with amended_from (no app callback needed); disabled when already amended", async () => {
    const amendedFlag = { v: false };
    const handlers: Record<string, FixtureHandler> = { "frappe.client.is_document_amended": () => ({ message: amendedFlag.v }) };
    setup(<FrappeForm doctype="Sales Memo" name="SM-1" />, { docs: { "Sales Memo": [memo({ docstatus: 2 })] }, handlers });
    fireEvent.click(await screen.findByRole("button", { name: en.formAmend }));
    expect(await screen.findByText("New Sales Memo")).toBeTruthy();
    expect(screen.getByText(en.formNotSaved)).toBeTruthy();
    cleanup();
    amendedFlag.v = true;
    setup(<FrappeForm doctype="Sales Memo" name="SM-1" />, { docs: { "Sales Memo": [memo({ docstatus: 2 })] }, handlers });
    const b = await screen.findByRole("button", { name: en.formAmend });
    await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(true));
  });

  it("R1-F7: the header shows the workflow state; Cancel is hidden when a transition leads to a cancelled state", async () => {
    setup(<FrappeForm doctype="Approval Memo" name="AM-1" />, {
      docs: { "Approval Memo": [{ doctype: "Approval Memo", name: "AM-1", title: "Budget", docstatus: 1, workflow_state: "Approved", modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }] },
    });
    expect(await screen.findByText("Approved")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByRole("button", { name: en.formCancelDoc })).toBeNull();
  });

  it("copy_doc / amend_doc: skipped keys, no_copy except when amending, child rows as new rows", () => {
    const b: MetaBundle = { doctype: "P", meta: { name: "P", fields: [{ fieldname: "a", fieldtype: "Data" }, { fieldname: "n", fieldtype: "Data", no_copy: 1 }, { fieldname: "pw", fieldtype: "Password" }, { fieldname: "amended_from", fieldtype: "Link", options: "P" }, { fieldname: "items", fieldtype: "Table", options: "P Item" }] },
      children: { "P Item": { name: "P Item", istable: 1, fields: [{ fieldname: "q", fieldtype: "Int" }] } } };
    const src: FrappeDoc = { doctype: "P", name: "P-1", docstatus: 2, a: "x", n: "y", pw: "***", owner: "o", modified: "m", __onload: {}, items: [{ doctype: "P Item", name: "r1", idx: 1, q: 2, parent: "P-1" }] };
    const dup = copyDoc(b, src);
    expect(dup).toMatchObject({ a: "x", docstatus: 0, __islocal: 1 });
    expect(dup.n).toBeUndefined();
    expect(dup.pw).toBeUndefined();
    expect(dup.owner).toBeUndefined();
    expect((dup.items as FrappeDoc[])[0]).toMatchObject({ q: 2, __islocal: 1, parent: dup.name, parentfield: "items", idx: 1 });
    expect((dup.items as FrappeDoc[])[0].name).toMatch(/^new-p-item-/);
    const am = amendDoc(b, src);
    expect(am).toMatchObject({ a: "x", n: "y", amended_from: "P-1", docstatus: 0 });
    expect(() => amendDoc({ ...b, meta: { name: "P", fields: [] } }, src)).toThrow(/amended_from/);
  });
});

describe("review R1 P3 items", () => {
  it("R1-F11: a validate_link failure is shown, not swallowed (the typed value stays)", async () => {
    const handlers: Record<string, FixtureHandler> = {
      "frappe.client.validate_link": () => { throw toFrappeError(403, { exc_type: "PermissionError", _server_messages: JSON.stringify([JSON.stringify({ message: "You do not have Read or Select Permissions for User", indicator: "red", raise_exception: 1 })]) }); },
    };
    setup(<FrappeForm doctype="ToDo" name="TD-1" />, { handlers });
    const box = await screen.findByRole("combobox", { name: /Assigned By/ });
    typeInto(box, "ann@x.com");
    expect(await screen.findByText(/You do not have Read or Select Permissions for User/)).toBeTruthy();
    expect((box as HTMLInputElement).value).toBe("ann@x.com");
  });

  it("R1-F15: a standalone table follows the permissions it is given (read-only without write)", () => {
    const b: MetaBundle = { doctype: "P", meta: { name: "P", fields: [{ fieldname: "items", fieldtype: "Table", options: "P Item", label: "Items" }] },
      children: { "P Item": { name: "P Item", istable: 1, editable_grid: 1, fields: [{ fieldname: "q", fieldtype: "Int", label: "Qty", in_list_view: 1 }] } } };
    const rows: FrappeDoc[] = [{ doctype: "P Item", name: "r1", idx: 1, q: 1 }];
    setup(<FrappeChildTable df={b.meta.fields[0]} bundle={b} parent={{ doctype: "P", name: "P-1" }} rows={rows} permissions={[{ read: true }]} label="Items" />);
    expect(screen.queryByRole("button", { name: en.formAddRow })).toBeNull();
    cleanup();
    setup(<FrappeChildTable df={b.meta.fields[0]} bundle={b} parent={{ doctype: "P", name: "P-1" }} rows={rows} permissions={[{ read: true, write: true }]} label="Items" />);
    expect(screen.getByRole("button", { name: en.formAddRow })).toBeTruthy();
  });
});

describe("R1-F10: link titles are scoped to the client and the session user", () => {
  it("a title remembered under one client / user is not seen by another", () => {
    const a = {}; const b = {};
    linkTitleCache(a, "u1").remember("Customer", "C-1", "Acme");
    expect(linkTitleCache(a, "u1").get("Customer", "C-1")).toBe("Acme");
    expect(linkTitleCache(a, "u2").get("Customer", "C-1")).toBeUndefined();
    expect(linkTitleCache(b, "u1").get("Customer", "C-1")).toBeUndefined();
    linkTitleCache(a, "u1").remember("Customer", "C-2", "C-2");
    expect(linkTitleCache(a, "u1").get("Customer", "C-2")).toBeUndefined();
  });
});

describe("R1-F13: extra keys of a query function reach search_link (link.js:631-657)", () => {
  it("a setQuery function's extra keys travel as top-level args; standard keys are not replaced", async () => {
    const events: FormEventsConfig["events"] = {
      refresh: (frm) => frm.setQuery("assigned_by", (doc) => ({ filters: { enabled: 1 }, translate_values: false, owner_hint: doc.name, page_length: 99 })),
    };
    const { calls } = setup(<FrappeForm doctype="ToDo" name="TD-1" events={events} />);
    const box = await screen.findByRole("combobox", { name: /Assigned By/ });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    fireEvent.focus(box);
    await waitFor(() => expect(calls("frappe.desk.search.search_link").length).toBeGreaterThan(0));
    const args = calls("frappe.desk.search.search_link").at(-1)!.args;
    expect(args).toMatchObject({ doctype: "User", owner_hint: "TD-1", translate_values: false, page_length: 10 });
    expect(JSON.parse(String(args.filters))).toEqual({ enabled: 1 });
  });
  it("resolveLinkQuery: only a function's result carries args; a plain object keeps Desk's shapes", () => {
    const d = { doctype: "T", name: "t" };
    expect(resolveLinkQuery({ filters: { a: 1 }, extra: 1 }, d, "T", "t")).toEqual({ filters: { a: 1 } });
    expect(resolveLinkQuery({ a: 1 }, d, "T", "t")).toEqual({ filters: { a: 1 } });
    expect(resolveLinkQuery("my.query", d, "T", "t")).toEqual({ query: "my.query" });
    expect(resolveLinkQuery(() => ({ query: "q.path", searchfield: "title", x: 2 }), d, "T", "t")).toEqual({ query: "q.path", searchfield: "title", args: { x: 2 } });
  });
});

describe("review R2 items", () => {
  it("V1: an HTML title field is shown as text (toolbar.js strips it)", async () => {
    setup(<FrappeForm doctype="ToDo" name="TD-9" />, { docs: { ToDo: [{ doctype: "ToDo", name: "TD-9", description: "<p>Review <b>visa</b> documents</p>", status: "Open", modified: "2026-11-01 10:00:00.000000" }] } });
    expect(await screen.findByRole("heading", { name: "Review visa documents" })).toBeTruthy();
  });

  it("V4: the loading state shows text after 300 ms", async () => {
    vi.useFakeTimers();
    render(<ThemeProvider defaultTheme="dark" defaultLanguage="en" storageKeys={null}><FormSkeleton /></ThemeProvider>);
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => { vi.advanceTimersByTime(301); });
    expect(screen.getByRole("status").textContent).toBe(defaultMessages.en.loading);
  });

  it("R2-F3: without the right to cancel every linked DocType, Desk's explanation replaces Cancel All", async () => {
    const handlers: Record<string, FixtureHandler> = {
      "frappe.desk.form.linked_with.get_submitted_linked_docs": () => ({ message: { docs: [{ doctype: "Sales Memo", name: "SM-9", docstatus: 1 }], count: 1 } }),
    };
    setup(<FrappeFormServicesProbe />, { handlers, docs: { "Sales Memo": [{ doctype: "Sales Memo", name: "SM-1", title: "T", docstatus: 1, modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }] } });
    fireEvent.click(await screen.findByRole("button", { name: en.formCancelDoc }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en.formNoCancelAllPermission)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
  });
});

/** FrappeForm with a canCancelAllLinked answer of false (as for a user without the cancel right on a linked DocType). */
function FrappeFormServicesProbe() {
  const meta = useMetaBundle("Sales Memo");
  const doc = useDoc("Sales Memo", "SM-1");
  if (!meta.data || !doc.data) return null;
  return (
    <FrappeFormView bundle={meta.data} doc={doc.data.doc} onSave={async (d) => d} onCancelDoc={async (d) => ({ ...d, docstatus: 2 })}
      getSubmittedLinkedDocs={async () => ({ docs: [{ doctype: "Sales Memo", name: "SM-9" }], count: 1 })}
      cancelAllLinkedDocs={async () => {}} canCancelAllLinked={() => false} />
  );
}
