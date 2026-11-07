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
import { FrappeReportView, isCellEditable, columnTotals } from "../src/frappe/views";
import { createFixtureTransport, type FixtureHandler } from "../src/frappe/testing";
import { toFrappeError } from "../src/frappe/client";
import { viewsDemoBackend } from "../src/frappe/testing/handlers/views";
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

function mount(props: Partial<React.ComponentProps<typeof FrappeReportView>> = {}, opts: { roles?: string[]; user?: string; prefs?: ListPrefs; handlers?: Record<string, FixtureHandler> } = {}) {
  const transport = createFixtureTransport(viewsDemoBackend(), { handlers: opts.handlers });
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

describe("LV.H1 report rules (pure)", () => {
  const W = { 0: { read: 1, write: 1 } } as never;
  it("LV.H1 isCellEditable follows report_view.js:758-771 (docstatus, allow_on_submit, read_only, std fields, permlevel)", () => {
    const df = { fieldname: "hours", fieldtype: "Float" };
    expect(isCellEditable(df, { docstatus: 0 }, W)).toBe(true);
    expect(isCellEditable(df, { docstatus: 1 }, W)).toBe(false);
    expect(isCellEditable({ ...df, allow_on_submit: 1 }, { docstatus: 1 }, W)).toBe(true);
    expect(isCellEditable({ ...df, allow_on_submit: 1 }, { docstatus: 2 }, W)).toBe(false);
    expect(isCellEditable({ ...df, read_only: 1 }, {}, W)).toBe(false);
    expect(isCellEditable({ ...df, read_only_depends_on: "eval:1" }, {}, W)).toBe(false);
    expect(isCellEditable({ ...df, permlevel: 1 }, {}, W)).toBe(false);
    expect(isCellEditable({ fieldname: "owner", fieldtype: "Link" }, {}, W)).toBe(false);
    expect(isCellEditable({ fieldname: "notes", fieldtype: "Text Editor" }, {}, W)).toBe(false);
    expect(isCellEditable(df, {}, { 0: { read: 1 } } as never)).toBe(false);
  });
  it("LV.H1 columnTotals ignores non-numbers", () => {
    expect(columnTotals([{ a: 1, b: "x" }, { a: "2.5", b: null }], ["a", "b"])).toEqual({ a: 3.5, b: 0 });
  });
});
