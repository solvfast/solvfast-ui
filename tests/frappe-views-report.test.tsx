/**
 * P35 views — Report view (`FrappeReportView`) over the SIMULATED Frappe (`createFixtureTransport` + views demo backend):
 * the column picker with child-table fields (request shape of report_view.js:869-884), inline edit through
 * `frappe.client.set_value` (permission-aware), the totals row, group-by and shared filters. Simulated & tested — never
 * run against a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeReportView, isCellEditable, columnTotals, deskCanWrite, evaluateReportReadOnlyDependsOn, rowFromSavedDoc } from "../src/frappe/views";
import { createFixtureTransport, type FixtureHandler, type FixtureTransport } from "../src/frappe/testing";
import { toFrappeError } from "../src/frappe/client";
import { reportSetValueHandler, viewsDemoBackend } from "../src/frappe/testing/handlers/views";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, FrappeDocField } from "../src/frappe/contract";
import type { ListPrefs } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const headers = () => [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim()).filter(Boolean);
const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

function mount(props: Partial<React.ComponentProps<typeof FrappeReportView>> = {}, opts: { roles?: string[]; user?: string; prefs?: ListPrefs; handlers?: Record<string, FixtureHandler>; backend?: Partial<FixtureBackend>; childSetValue?: boolean } = {}) {
  // eslint-disable-next-line prefer-const
  let transport: FixtureTransport;
  const handlers = { ...(opts.childSetValue ? { "frappe.client.set_value": reportSetValueHandler(() => transport) } : {}), ...opts.handlers };
  transport = createFixtureTransport(viewsDemoBackend(opts.backend), { handlers });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const storage = opts.prefs ? { prefs: { load: () => opts.prefs!, save: () => {} }, saved: null } : null;
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: opts.user ?? "Administrator", roles: opts.roles ?? ["System Manager"] }}>
        <FrappeReportView doctype="Project Task" storage={storage} {...props} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (m: string) => transport.store.calls.filter((c) => c.method === m);
  return { transport, calls, gets: () => calls("frappe.desk.reportview.get") };
}

describe("LV.H1 report view (SIMULATED)", () => {
  it("LV.H1 column picker lists every field incl. child-table fields; adding one shows it", async () => {
    mount();
    await screen.findByText("Write spec");
    expect(headers()).toEqual(expect.arrayContaining(["Subject", "Status", "Priority", "Hours"]));
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add column" }));
    const offered = within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(offered).toEqual(expect.arrayContaining(["Cost", "Expected Start Date", "Item (Items)", "Qty (Items)"]));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cost" }));
    await waitFor(() => expect(headers()).toContain("Cost"));
  });
  it("LV.H1 child columns are requested as Desk's report view does (qualified parents, 'Child:field' aliases, no group_by)", async () => {
    const { gets } = mount({}, { prefs: { visible: ["subject", "Project Task Item:item", "Project Task Item:qty"] } });
    await screen.findByText("Write spec");
    const a = gets().at(-1)!.args;
    const fields = JSON.parse(String(a.fields));
    expect(fields).toEqual(expect.arrayContaining([
      "`tabProject Task`.`name`", "`tabProject Task`.`subject`", "`tabProject Task`.`docstatus`",
      "`tabProject Task Item`.`item` as 'Project Task Item:item'", "`tabProject Task Item`.`qty` as 'Project Task Item:qty'",
      "`tabProject Task Item`.`name` as 'Project Task Item:name'",
    ]));
    expect(a.group_by).toBeUndefined();
    expect(String(a.order_by)).toBe("`tabProject Task`.`exp_start_date` asc, `tabProject Task`.`name` asc");
    // SIMULATED: one row per parent with its first child row (a site answers one row per child row)
    expect(within(rowOf("Write spec")).getByText("Template")).toBeTruthy();
  });
  it("LV.H1 inline edit → frappe.client.set_value({fieldname: {hours}}), cell + store updated; read-only fields have no editor", async () => {
    const { calls, transport } = mount();
    await screen.findByText("Write spec");
    const row = rowOf("Write spec");
    expect(within(row).queryByRole("button", { name: "Edit Progress" })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Edit Hours" }));
    const input = within(row).getByRole("spinbutton", { name: "Hours" });
    fireEvent.change(input, { target: { value: "7.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(calls("frappe.client.set_value")).toHaveLength(1));
    expect(calls("frappe.client.set_value")[0].args).toEqual({ doctype: "Project Task", name: "T-1", fieldname: JSON.stringify({ hours: 7.5 }) });
    await waitFor(() => expect(within(rowOf("Write spec")).getByText("7.5")).toBeTruthy());
    expect(transport.store.docs.get("Project Task")!.get("T-1")!.hours).toBe(7.5);
  });
  it("LV.H1 a refused save keeps the editor open with the server's message (no fake success)", async () => {
    const refuse: FixtureHandler = () => { throw toFrappeError(417, { exc_type: "ValidationError", _server_messages: JSON.stringify([JSON.stringify({ message: "Hours cannot exceed 24", indicator: "red" })]) }); };
    const { calls, transport } = mount({}, { handlers: { "frappe.client.set_value": refuse } });
    await screen.findByText("Build grid");
    const row = rowOf("Build grid");
    fireEvent.click(within(row).getByRole("button", { name: "Edit Hours" }));
    fireEvent.change(within(row).getByRole("spinbutton", { name: "Hours" }), { target: { value: "99" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(within(row).getByRole("alert").textContent).toContain("Hours cannot exceed 24"));
    expect(calls("frappe.client.set_value")).toHaveLength(1);
    expect(within(row).getByRole("spinbutton", { name: "Hours" })).toBeTruthy();
    expect(transport.store.docs.get("Project Task")!.get("T-2")!.hours).toBe(20);
  });
  it("LV.H1 without write permission (Reader) no cell is editable", async () => {
    mount({}, { roles: ["Reader"], user: "reader@x.com" });
    await screen.findByText("Write spec");
    expect(screen.queryAllByRole("button", { name: /^Edit / })).toHaveLength(0);
  });
  it("LV.H1 totals row: numeric visible columns summed over the loaded rows", async () => {
    mount({ totals: true });
    await screen.findByText("Write spec");
    const totals = await screen.findByTestId("sf-report-totals");
    expect(totals.querySelector('[data-total="hours"]')?.textContent).toBe("Hours34.5");
    fireEvent.click(screen.getByRole("button", { name: "Show totals" }));
    expect(screen.queryByTestId("sf-report-totals")).toBeNull();
  });
  it("LV.H1 group by (loaded rows) and shared filters (initialQuery → request filters)", async () => {
    const onQ = vi.fn();
    const { gets } = mount({ groupByFields: ["status"], onQueryStateChange: onQ, initialQuery: { conjunction: "and", conditions: [{ id: "p", field: "priority", operator: "not_equals", value: "High" }] } });
    await screen.findByText("Build grid");
    expect(JSON.parse(String(gets().at(-1)!.args.filters))).toEqual([["priority", "!=", "High"]]);
    expect(screen.queryByText("Write spec")).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: "Group by" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Status" }));
    await waitFor(() => expect(gets().at(-1)!.args.page_length).toBe(200));
    expect(onQ).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: "status" }));
    expect(screen.getAllByText("Working").length).toBeGreaterThan(0);
  });
});

// ---- P36: Desk 15.110's editability, verified from report_view.js / frappe-datatable / the server (views.md §3) ----------
const W = [{ read: true, write: true }];
const NO_TABLE = [{ fieldtype: "Data" }, { fieldtype: "Check" }];
const WITH_TABLE = [{ fieldtype: "Data" }, { fieldtype: "Table" }];
const ed = (df: Partial<FrappeDocField> & { is_virtual?: number }, row: Record<string, unknown>, o: Partial<Parameters<typeof isCellEditable>[2]> = {}) =>
  isCellEditable({ fieldname: "title", fieldtype: "Data", ...df } as FrappeDocField, row, { fields: NO_TABLE, levels: W, ...o });

describe("LV.H1 report rules (pure, Desk default)", () => {
  it("LV.H1 DocType WITHOUT a Table field: a plain field IS editable (is_editable returns the falsy read_only_depends_on, the datatable blocks only on === false)", () => {
    expect(ed({}, { docstatus: 0 })).toBe(true);
    expect(ed({ read_only_depends_on: null as never }, { docstatus: 0 })).toBe(true);
    expect(ed({ read_only_depends_on: "" }, { docstatus: 0 })).toBe(true);
  });
  it("LV.H1 DocType WITHOUT a Table field: read_only_depends_on evaluating false → editable, true → not editable (eval:, fieldname, array, boolean, fn:)", () => {
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { docstatus: 0, locked: 0 })).toBe(true);
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { docstatus: 0, locked: 1 })).toBe(false);
    expect(ed({ read_only_depends_on: "eval:doc.status=='Closed'" }, { status: "Open" })).toBe(true);
    expect(ed({ read_only_depends_on: "eval:doc.status=='Closed'" }, { status: "Closed" })).toBe(false);
    expect(ed({ read_only_depends_on: "locked" }, { locked: 1 })).toBe(false);
    expect(ed({ read_only_depends_on: "locked" }, { locked: 0 })).toBe(true);
    expect(ed({ read_only_depends_on: "tags" }, { tags: [] })).toBe(true);
    expect(ed({ read_only_depends_on: "tags" }, { tags: ["x"] })).toBe(false);
    expect(ed({ read_only_depends_on: true as never }, {})).toBe(false);
    expect(ed({ read_only_depends_on: false as never }, {})).toBe(true);
    // no this.frm in the report view → fieldname form: data["fn:lock"] is undefined → false → editable
    expect(ed({ read_only_depends_on: "fn:lock" }, {})).toBe(true);
  });
  it("LV.H1 read_only_depends_on is evaluated on the LOADED row only: a field that is not a loaded column is undefined → editable", () => {
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { name: "X", docstatus: 0 })).toBe(true);
    expect(evaluateReportReadOnlyDependsOn("eval:doc.locked", { name: "X" })).toEqual({ value: false });
  });
  it("LV.H1 an expression that fails (Desk: frappe.throw, the row is not built) → not editable here, reported", () => {
    const issues: unknown[] = [];
    expect(ed({ read_only_depends_on: "eval:parent.locked" }, { locked: 0 }, { onIssue: (i) => issues.push(i) })).toBe(false);
    expect(issues).toHaveLength(1);
  });
  it("LV.H1 DocType WITH a Table field: a plain field is editable and read_only_depends_on is NOT evaluated; Table MultiSelect does not count", () => {
    expect(ed({}, { docstatus: 0 }, { fields: WITH_TABLE })).toBe(true);
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { locked: 1 }, { fields: WITH_TABLE })).toBe(true);
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { locked: 1 }, { fields: [{ fieldtype: "Table MultiSelect" }] })).toBe(false);
  });
  it("LV.H1 docstatus 1: only allow_on_submit fields; docstatus 2: nothing (even allow_on_submit)", () => {
    for (const fields of [NO_TABLE, WITH_TABLE]) {
      expect(ed({}, { docstatus: 1 }, { fields })).toBe(false);
      expect(ed({ allow_on_submit: 1 }, { docstatus: 1 }, { fields })).toBe(true);
      expect(ed({}, { docstatus: 2 }, { fields })).toBe(false);
      expect(ed({ allow_on_submit: 1 }, { docstatus: 2 }, { fields })).toBe(false);
    }
  });
  it("LV.H1 read_only / hidden / is_virtual / standard fields are never editable; the fieldtype is not part of the rule", () => {
    for (const fields of [NO_TABLE, WITH_TABLE]) {
      expect(ed({ read_only: 1 }, {}, { fields })).toBe(false);
      expect(ed({ hidden: 1 }, {}, { fields })).toBe(false);
      expect(ed({ is_virtual: 1 }, {}, { fields })).toBe(false);
      for (const f of ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype", "_assign", "_user_tags", "_comments", "_liked_by"]) expect(ed({ fieldname: f }, {}, { fields })).toBe(false);
      expect(ed({ fieldname: "notes", fieldtype: "Text Editor" }, {}, { fields })).toBe(true);
    }
    expect(isCellEditable(undefined, {}, { fields: NO_TABLE, levels: W })).toBe(false);
  });
  it("LV.H1 write right = Desk's can_write: level-0 write OR create (not on a Single); the field's permlevel is not checked; no write → nothing", () => {
    expect(ed({}, {}, { levels: [{ read: true }] })).toBe(false);
    expect(ed({}, {}, { levels: [{ read: true, create: true }] })).toBe(true);
    expect(ed({}, {}, { levels: [{ read: true, create: true }], issingle: 1 })).toBe(false);
    expect(ed({ permlevel: 1 }, {}, { levels: [{ read: true, write: true }] })).toBe(true);
    expect(deskCanWrite(undefined)).toBe(false);
  });
  it("LV.H1 child-table cells: Boolean(name && is_editable) — editable with the child row, never without it, and the falsy pass-through becomes false", () => {
    expect(ed({}, { docstatus: 0 }, { fields: WITH_TABLE, child: { name: "row-1" } })).toBe(true);
    expect(ed({}, { docstatus: 0 }, { fields: WITH_TABLE, child: { name: null } })).toBe(false);
    expect(ed({ read_only: 1 }, {}, { fields: WITH_TABLE, child: { name: "row-1" } })).toBe(false);
    expect(ed({ allow_on_submit: 1 }, { docstatus: 1 }, { fields: WITH_TABLE, child: { name: "row-1" } })).toBe(true);
    expect(ed({}, { docstatus: 1 }, { fields: WITH_TABLE, child: { name: "row-1" } })).toBe(false);
    // only a Table MultiSelect: no "Table" → the pass-through (undefined) → Boolean → false
    expect(ed({}, {}, { fields: [{ fieldtype: "Table MultiSelect" }], child: { name: "row-1" } })).toBe(false);
    expect(ed({ read_only_depends_on: "eval:0" }, {}, { fields: [{ fieldtype: "Table MultiSelect" }], child: { name: "row-1" } })).toBe(true);
  });
});

describe("LV.H1 report rules (pure, opt-in strict)", () => {
  it("LV.H1 strict adds the server's checks: field permlevel write, write (not create), submit right when submitted, read_only_depends_on evaluated with a Table field", () => {
    const strict = { mode: "strict" as const };
    expect(ed({}, {}, strict)).toBe(true);
    expect(ed({ permlevel: 1 }, {}, { ...strict, levels: [{ write: true }] })).toBe(false);
    expect(ed({ permlevel: 1 }, {}, { ...strict, levels: [{ write: true }, { write: true }] })).toBe(true);
    expect(ed({}, {}, { ...strict, levels: [{ create: true }] })).toBe(false);
    expect(ed({ allow_on_submit: 1 }, { docstatus: 1 }, { ...strict, levels: [{ write: true }] })).toBe(false);
    expect(ed({ allow_on_submit: 1 }, { docstatus: 1 }, { ...strict, levels: [{ write: true, submit: true }] })).toBe(true);
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { locked: 1 }, { ...strict, fields: WITH_TABLE })).toBe(false);
    expect(ed({ read_only_depends_on: "eval:doc.locked" }, { locked: 0 }, { ...strict, fields: WITH_TABLE })).toBe(true);
  });
  it("LV.H1 rowFromSavedDoc refreshes every loaded key from the saved document, Child:field keys from its child row", () => {
    const row = { name: "T-1", hours: 6, status: "Open", _comment_count: 2, "Item:qty": 1, "Item:name": "c2" };
    const doc = { name: "T-1", hours: 7, status: "Working", items: [{ doctype: "Item", name: "c1", qty: 9 }, { doctype: "Item", name: "c2", qty: 5 }] };
    expect(rowFromSavedDoc(row, doc)).toEqual({ ...row, hours: 7, status: "Working", "Item:qty": 5 });
    expect(rowFromSavedDoc({ name: "T-2", hours: 1 }, doc)).toEqual({ name: "T-2", hours: 1 });
  });
  it("LV.H1 columnTotals ignores non-numbers", () => {
    expect(columnTotals([{ a: 1, b: "x" }, { a: "2.5", b: null }], ["a", "b"])).toEqual({ a: 3.5, b: 0 });
  });
});

// ---- component over the simulator --------------------------------------------------------------------------------
const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1, report: 1 };
/** No Table field: Ticket (draft rows), with a read_only_depends_on on a loaded column and a permlevel-1 field the
 *  role can read but not write. */
const TICKET: DocTypeMeta = {
  name: "Ticket", autoname: "hash", title_field: "subject", permissions: [SM, { role: "System Manager", permlevel: 1, read: 1 }] as never,
  fields: [
    { fieldname: "subject", fieldtype: "Data", label: "Subject", in_list_view: 1 },
    { fieldname: "locked", fieldtype: "Check", label: "Locked", in_list_view: 1 },
    { fieldname: "note", fieldtype: "Data", label: "Note", in_list_view: 1, read_only_depends_on: "eval:doc.locked" },
    { fieldname: "score", fieldtype: "Int", label: "Score", in_list_view: 1, permlevel: 1 },
  ],
} as DocTypeMeta;
/** No Table field, submittable: the Cypress fixture of report_view.js's own test (custom_submittable_doctype.js). */
const SUBMITTABLE: DocTypeMeta = {
  name: "Custom Submittable DocType", autoname: "hash", is_submittable: 1, title_field: "title", permissions: [SM] as never,
  fields: [
    { fieldname: "enabled", fieldtype: "Check", label: "Enabled", allow_on_submit: 1, in_list_view: 1 },
    { fieldname: "title", fieldtype: "Data", label: "title", in_list_view: 1 },
  ],
} as DocTypeMeta;
const doc = (doctype: string, name: string, extra: Record<string, unknown>) => ({ doctype, name, modified: "2026-11-01 10:00:00.000000", ...extra }) as unknown as FrappeDoc;
const extraSite: Partial<FixtureBackend> = {
  meta: { Ticket: [TICKET], "Custom Submittable DocType": [SUBMITTABLE] },
  docs: {
    Ticket: [doc("Ticket", "TK-1", { subject: "Open one", locked: 0, note: "a", score: 1 }), doc("Ticket", "TK-2", { subject: "Locked one", locked: 1, note: "b", score: 2 })],
    "Custom Submittable DocType": [
      doc("Custom Submittable DocType", "D-0", { title: "Doc 0", enabled: 0, docstatus: 0 }),
      doc("Custom Submittable DocType", "D-1", { title: "Doc 1", enabled: 0, docstatus: 1 }),
      doc("Custom Submittable DocType", "D-2", { title: "Doc 2", enabled: 0, docstatus: 2 }),
    ],
  },
};
const editBtn = (row: HTMLElement, label: string) => within(row).queryByRole("button", { name: `Edit ${label}` });

describe("LV.H1 report view editability = Desk 15.110 (SIMULATED)", () => {
  it("LV.H1 DocType without a Table field: plain fields are editable; the read_only_depends_on field only where it evaluates false on the row", async () => {
    mount({ doctype: "Ticket" }, { backend: extraSite, user: "sm@x.com", roles: ["System Manager"] });
    await screen.findByText("Open one");
    const open = rowOf("Open one"), locked = rowOf("Locked one");
    expect(editBtn(open, "Subject")).toBeTruthy();
    expect(editBtn(locked, "Subject")).toBeTruthy();
    expect(editBtn(open, "Note")).toBeTruthy();
    expect(editBtn(locked, "Note")).toBeNull();
    // Desk does not look at the field's permlevel (can_write is level 0): the permlevel-1 field (read, not write) gets an
    // editor — the server would reset the value silently (validate_higher_perm_levels)
    expect(editBtn(open, "Score")).toBeTruthy();
  });
  it("LV.H1 opt-in editable=\"strict\": the permlevel-1 field the role cannot write has no editor", async () => {
    mount({ doctype: "Ticket", editable: "strict" }, { backend: extraSite, user: "sm@x.com", roles: ["System Manager"] });
    await screen.findByText("Open one");
    expect(editBtn(rowOf("Open one"), "Score")).toBeNull();
    expect(editBtn(rowOf("Open one"), "Subject")).toBeTruthy();
    expect(editBtn(rowOf("Locked one"), "Note")).toBeNull();
  });
  it("LV.H1 submittable DocType without a Table field (report_view.js's Cypress case): docstatus 1 → only allow_on_submit; docstatus 2 → nothing; the set_value request", async () => {
    const { calls, transport } = mount({ doctype: "Custom Submittable DocType" }, { backend: extraSite, user: "sm@x.com", roles: ["System Manager"] });
    await screen.findByText("Doc 1");
    expect(editBtn(rowOf("Doc 0"), "title")).toBeTruthy();
    expect(editBtn(rowOf("Doc 0"), "Enabled")).toBeTruthy();
    expect(editBtn(rowOf("Doc 1"), "title")).toBeNull();
    expect(editBtn(rowOf("Doc 1"), "Enabled")).toBeTruthy();
    expect(editBtn(rowOf("Doc 2"), "title")).toBeNull();
    expect(editBtn(rowOf("Doc 2"), "Enabled")).toBeNull();
    const row = rowOf("Doc 1");
    fireEvent.click(editBtn(row, "Enabled")!);
    fireEvent.click(within(row).getByRole("checkbox", { name: "Enabled" }));
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls("frappe.client.set_value")).toHaveLength(1));
    expect(calls("frappe.client.set_value")[0].args).toEqual({ doctype: "Custom Submittable DocType", name: "D-1", fieldname: JSON.stringify({ enabled: 1 }) });
    await waitFor(() => expect(transport.store.docs.get("Custom Submittable DocType")!.get("D-1")!.enabled).toBe(1));
  });
  it("LV.H1 no write permission (Reader on a DocType without a Table field): nothing is editable", async () => {
    const meta = { ...TICKET, permissions: [{ role: "Reader", permlevel: 0, read: 1, report: 1 }] } as DocTypeMeta;
    mount({ doctype: "Ticket" }, { backend: { ...extraSite, meta: { Ticket: [meta] } }, user: "r@x.com", roles: ["Reader"] });
    await screen.findByText("Open one");
    expect(screen.queryAllByRole("button", { name: /^Edit / })).toHaveLength(0);
  });
  it("LV.H1 opt-in editable={fn}: the consumer decides (info.desk = Desk's verdict); the simulated server still refuses a non-allow_on_submit change after submit", async () => {
    const seen: Array<[string, boolean]> = [];
    const { calls, transport } = mount({ doctype: "Custom Submittable DocType", editable: (df, row, info) => { seen.push([`${String(row.name)}.${df.fieldname}`, info.desk]); return row.name === "D-1"; } },
      { backend: extraSite, user: "sm@x.com", roles: ["System Manager"], childSetValue: true });
    await screen.findByText("Doc 1");
    expect(editBtn(rowOf("Doc 0"), "title")).toBeNull();
    expect(seen).toEqual(expect.arrayContaining([["D-0.title", true], ["D-1.title", false], ["D-1.enabled", true], ["D-2.enabled", false]]));
    const row = rowOf("Doc 1");
    fireEvent.click(editBtn(row, "title")!);
    fireEvent.change(within(row).getByRole("textbox", { name: "title" }), { target: { value: "Renamed" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(within(row).getByRole("alert").textContent).toContain("Not allowed to change"));
    expect(calls("frappe.client.set_value")[0].args).toEqual({ doctype: "Custom Submittable DocType", name: "D-1", fieldname: JSON.stringify({ title: "Renamed" }) });
    expect(transport.store.docs.get("Custom Submittable DocType")!.get("D-1")!.title).toBe("Doc 1");
  });
  it("LV.H1 DocType with a Table field: a child cell is edited through set_value on the CHILD row (client.py:195-203); the row is refreshed from the parent document", async () => {
    const { calls, transport } = mount({}, { prefs: { visible: ["subject", "hours", "Project Task Item:item", "Project Task Item:qty"] }, childSetValue: true });
    await screen.findByText("Write spec");
    const childName = (transport.store.docs.get("Project Task")!.get("T-1")!.items as Array<{ name: string }>)[0].name;
    const row = rowOf("Write spec");
    expect(editBtn(rowOf("Build grid"), "Qty (Items)")).toBeNull(); // T-2 has no child row → no Child:name
    fireEvent.click(editBtn(row, "Qty (Items)")!);
    const input = within(row).getByRole("spinbutton", { name: "Qty (Items)" });
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(calls("frappe.client.set_value")).toHaveLength(1));
    expect(calls("frappe.client.set_value")[0].args).toEqual({ doctype: "Project Task Item", name: childName, fieldname: JSON.stringify({ qty: 5 }) });
    await waitFor(() => expect(within(rowOf("Write spec")).getByText("5")).toBeTruthy());
    expect((transport.store.docs.get("Project Task")!.get("T-1")!.items as Array<{ qty: number }>)[0].qty).toBe(5);
  });
  it("LV.H1 an unchanged value sends no request (datatable submitEditing)", async () => {
    const { calls } = mount();
    await screen.findByText("Write spec");
    const row = rowOf("Write spec");
    fireEvent.click(editBtn(row, "Hours")!);
    fireEvent.keyDown(within(row).getByRole("spinbutton", { name: "Hours" }), { key: "Enter" });
    await waitFor(() => expect(within(row).queryByRole("spinbutton", { name: "Hours" })).toBeNull());
    expect(calls("frappe.client.set_value")).toHaveLength(0);
  });
});
