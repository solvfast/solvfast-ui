/**
 * FrappeListView 0.4.0 (A2) — simulated & tested: rows through `reportview.get` (decoder), indicator, capped count,
 * tie-break, List View Settings, child-table filters. Simulated site only (playground mock + small custom transports);
 * nothing here is evidence of parity with a real Frappe site.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, buildFrappeListMeta, buildListRequest, createFrappeClient, queryToFrappe, type DocMeta, type FrappeTransport } from "../src/frappe";
import { decodeReportview } from "../src/frappe/list/reportview";
import { getIndicator, guessColour, type IndicatorConfig } from "../src/frappe/list/indicator";
import { applyColumnSettings } from "../src/frappe/list/settings";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe, todoRows, type MockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const pause = () => act(() => new Promise((r) => setTimeout(r, 450)));

function mount(transport: FrappeTransport, props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, doctype = "ToDo") {
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client}><FrappeListView doctype={doctype} storage={null} {...props} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}
const calls = (m: MockFrappe, method: string) => m.calls.filter((c) => c.method === method);

describe("decodeReportview", () => {
  it("expands {keys, values, user_info}; an empty list (no rows) decodes to nothing", () => {
    expect(decodeReportview({ message: { keys: ["name", "x"], values: [["a", 1], ["b"]], user_info: { u: { fullname: "U" } } } })).toEqual({
      rows: [{ name: "a", x: 1 }, { name: "b", x: null }], userInfo: { u: { fullname: "U" } },
    });
    expect(decodeReportview({ message: [] })).toEqual({ rows: [], userInfo: {} });
    expect(decodeReportview({})).toEqual({ rows: [], userInfo: {} });
  });
});

describe("rows through reportview.get", () => {
  const withMeta = () => {
    const rows = todoRows().slice(0, 5).map((r, i) => ({
      ...r, _assign: i === 0 ? JSON.stringify(["sara@example.com", "omar@example.com"]) : null,
      _comments: i === 0 ? JSON.stringify([{}, {}]) : null, _liked_by: i === 1 ? JSON.stringify(["sara@example.com"]) : null,
    }));
    return createMockFrappe({ rows });
  };

  it("row metadata columns are offered, hidden by default (0.3.x look), and not requested from get_list", async () => {
    const mock = withMeta();
    mount(mock.transport);
    await waitFor(() => expect(bodyRows()).toHaveLength(5));
    expect(calls(mock, "frappe.client.get_list")).toHaveLength(0);
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim())).toEqual(["Status", "Priority", "Due Date", "Reference Type"]);
  });

  it("rowMeta: assignees (avatars with the response's user_info), comment count from with_comment_count, likes", async () => {
    const mock = withMeta();
    mount(mock.transport, { rowMeta: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(5));
    const heads = [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim());
    expect(heads).toEqual(expect.arrayContaining([en("listAssigned"), en("listComments"), en("listLikes")]));
    const first = bodyRows().find((r) => r.querySelector('[title*="sara, omar"]'))!; // full names from user_info
    expect(first).toBeTruthy();
    expect(first.textContent).toContain("S"); // initials of sara
    expect(first.textContent).toContain("2"); // 2 comments
    expect(bodyRows().some((r) => r.querySelector('[title="sara@example.com"]'))).toBe(true); // liked by
    expect(calls(mock, "frappe.desk.reportview.get").at(-1)!.args).toMatchObject({ with_comment_count: 1 });
  });

  it("List View Settings: disable_comment_count → with_comment_count 0 and no comments column; disable_count → no count call", async () => {
    const mock = createMockFrappe({ listSettings: { disable_comment_count: 1, disable_count: 1 } });
    mount(mock.transport, { rowMeta: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(calls(mock, "frappe.desk.reportview.get").at(-1)!.args).toMatchObject({ with_comment_count: 0 });
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim())).not.toContain(en("listComments"));
    expect(calls(mock, "frappe.desk.reportview.get_count")).toHaveLength(0);
    expect(screen.queryByText(/Total:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" })); // page count unknown: next is offered while pages are full
    await waitFor(() => expect(calls(mock, "frappe.desk.reportview.get").at(-1)!.args.start).toBe(20));
  });

  it("count is capped at 1001 and shown as “1,000+”; clicking it counts exactly (no limit)", async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ ...todoRows()[i % 45], name: `r${i}` }));
    const mock = createMockFrappe({ rows });
    mount(mock.transport);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    await screen.findByText("Total: 1,000+");
    expect(calls(mock, "frappe.desk.reportview.get_count").at(-1)!.args.limit).toBe(1001);
    fireEvent.click(screen.getByTitle(en("listCountExact")));
    await screen.findByText("Total: 1200");
    expect(calls(mock, "frappe.desk.reportview.get_count").at(-1)!.args.limit).toBeUndefined();
  });
});

describe("name tie-break in order_by (Desk SortSelector)", () => {
  const meta = buildFrappeListMeta(TODO_META as DocMeta, en);
  const cols = meta.columns;
  const state = { search: "", query: { conjunction: "and" as const, conditions: [] }, sort: { key: null, dir: "desc" as const }, page: 0, pageSize: 20, groupBy: "none", visible: ["status"] };
  const order = (sort: { key: string | null; dir: "asc" | "desc" }, m = meta) => buildListRequest({ meta: m, columns: cols as never, state: { ...state, sort } }).order_by;
  it("adds `name` after any field except name / creation / modified", () => {
    expect(order({ key: "priority", dir: "asc" })).toBe("priority asc, name asc");
    expect(order({ key: "status", dir: "desc" })).toBe("status desc, name desc");
    expect(order({ key: "creation", dir: "asc" })).toBe("creation asc");
    expect(order({ key: null, dir: "desc" })).toBe("modified desc");
    expect(order({ key: null, dir: "desc" }, { ...meta, defaultOrderBy: "idx asc" })).toBe("idx asc, name asc");
  });
});

describe("indicator (frappe.get_indicator precedence)", () => {
  const cfg = (o: Partial<IndicatorConfig> = {}): IndicatorConfig => ({
    isSubmittable: false, hasField: () => false, words: { draft: "Draft", cancelled: "Cancelled", submitted: "Submitted", enabled: "Enabled", disabled: "Disabled" }, ...o,
  });
  const ind = (row: Record<string, unknown>, o?: Partial<IndicatorConfig>) => getIndicator(row, cfg(o));

  it("workflow state wins, coloured by the Workflow State style; override_status and avoid_status_override hand over", () => {
    const workflow = { stateField: "workflow_state", styles: { Approved: "Success", Rejected: "Danger", Odd: undefined } };
    expect(ind({ workflow_state: "Approved", docstatus: 1 }, { isSubmittable: true, workflow })).toMatchObject({ label: "Approved", color: "green", tone: "success", filter: ["workflow_state", "Approved"] });
    expect(ind({ workflow_state: "Odd" }, { workflow })).toMatchObject({ color: "gray", tone: "muted" });
    expect(ind({ workflow_state: "Approved", docstatus: 1 }, { isSubmittable: true, workflow: { ...workflow, overrideStatus: true } })?.label).toBe("Submitted");
    expect(ind({ workflow_state: "Approved", docstatus: 0 }, { isSubmittable: true, workflow: { ...workflow, avoidStatusOverride: ["Approved"] } })?.label).toBe("Draft");
  });
  it("submittable: Draft and Cancelled are red, Submitted blue; each carries its docstatus filter", () => {
    expect(ind({ docstatus: 0 }, { isSubmittable: true })).toMatchObject({ label: "Draft", color: "red", filter: ["docstatus", 0] });
    expect(ind({ docstatus: 2 }, { isSubmittable: true })).toMatchObject({ label: "Cancelled", color: "red", filter: ["docstatus", 2] });
    expect(ind({ docstatus: 1 }, { isSubmittable: true })).toMatchObject({ label: "Submitted", color: "blue", tone: "info" });
    expect(ind({ docstatus: 0 }, { isSubmittable: true, hasIndicatorForDraft: true })).toBeNull();
  });
  it("meta.states entry, then app hook, then Submitted, then the status value with guess_colour", () => {
    const states = [{ title: "Blocked", color: "Orange" }];
    expect(ind({ status: "Blocked" }, { states })).toMatchObject({ color: "orange", tone: "warning" });
    expect(ind({ status: "x" }, { getIndicator: () => ({ label: "Hook", color: "purple" }) })).toMatchObject({ label: "Hook", tone: "brand" });
    expect(ind({ status: "Completed" })).toMatchObject({ color: "green", filter: ["status", "Completed"] });
    expect(ind({ status: "Open" })?.color).toBe("red");
    expect(ind({ status: "Whatever" })?.color).toBe("gray");
  });
  it("guess_colour is a case-sensitive substring match", () => {
    expect([guessColour("Pending Review"), guessColour("Not Approved"), guessColour("Submitted"), guessColour("open")]).toEqual(["orange", "orange", "blue", "gray"]);
  });
  it("enabled / disabled fields", () => {
    expect(ind({ enabled: 1 }, { hasField: (f) => f === "enabled" })).toMatchObject({ label: "Enabled", color: "blue" });
    expect(ind({ disabled: 1 }, { hasField: (f) => f === "disabled" })).toMatchObject({ label: "Disabled", color: "gray" });
  });
});

describe("indicator column in the list", () => {
  const SALES = {
    name: "Sales Order", title_field: "title", is_submittable: 1,
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", in_list_view: 1 },
      { fieldname: "customer", label: "Customer", fieldtype: "Data", in_list_view: 1 },
    ],
  };
  function site() {
    const calls: { method: string; args: Record<string, unknown> }[] = [];
    const data = [["SO-1", "A", 0], ["SO-2", "B", 1], ["SO-3", "C", 2]];
    const transport: FrappeTransport = async (method, args) => {
      calls.push({ method, args });
      if (method === "frappe.desk.form.load.getdoctype") return { docs: [SALES], user_settings: "{}" };
      if (method === "frappe.desk.listview.get_list_settings") return { message: null };
      if (method === "frappe.desk.reportview.get") {
        const fields = JSON.parse(String(args.fields)) as string[];
        const filters = JSON.parse(String(args.filters)) as unknown[][];
        const ds = filters.find((f) => f[0] === "docstatus");
        const rows = data.filter((d) => !ds || String(d[2]) === String(ds[2]));
        const val = (d: (string | number)[], f: string) => ({ name: d[0], title: d[1], customer: d[1], docstatus: d[2] } as Record<string, unknown>)[f] ?? null;
        return { message: rows.length ? { keys: fields, values: rows.map((d) => fields.map((f) => val(d, f))), user_info: {} } : [] };
      }
      if (method === "frappe.desk.reportview.get_count") return { message: 3 };
      throw new Error(`unexpected ${method}`);
    };
    return { transport, calls };
  }

  it("shows Draft / Submitted / Cancelled pills; clicking one filters by docstatus", async () => {
    const s = site();
    mount(s.transport, { rowMeta: true }, "Sales Order");
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect(bodyRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Draft"), expect.stringContaining("Submitted"), expect.stringContaining("Cancelled")]);
    expect(JSON.parse(String(s.calls.filter((c) => c.method === "frappe.desk.reportview.get").at(-1)!.args.fields))).toContain("docstatus");
    fireEvent.click(screen.getAllByRole("button", { name: "Submitted" })[0]);
    await pause();
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(JSON.parse(String(s.calls.filter((c) => c.method === "frappe.desk.reportview.get").at(-1)!.args.filters))).toEqual([["docstatus", "=", 1]]);
  });
});

describe("List View Settings → columns", () => {
  const cols = ["title", "customer", "status", "total"].map((k) => ({ key: k, label: k, type: "text" as const, hidden: k === "total" }));
  it("`fields` reorders (title first), `total_fields` caps; the rest stays offered, hidden; status_field is the indicator", () => {
    const ind = { key: "__indicator", label: "Status", hidden: true };
    const out = applyColumnSettings([...cols, ind] as never, { fields: JSON.stringify([{ fieldname: "total" }, { fieldname: "status_field" }, { fieldname: "customer" }]), total_fields: 3 }, "title");
    expect(out.filter((c) => !c.hidden).map((c) => c.key)).toEqual(["title", "total", "__indicator"]);
    expect(out.find((c) => c.key === "customer")?.hidden).toBe(true);
  });
  it("no settings, or empty ones, leave the columns as they are", () => {
    expect(applyColumnSettings(cols as never, null, "title")).toBe(cols);
    expect(applyColumnSettings(cols as never, { disable_count: 1 }, "title")).toBe(cols);
  });
});

describe("child-table filters and docstatus / owner / modified_by filter fields", () => {
  const ORDER = {
    name: "Order", title_field: "title", is_submittable: 1,
    fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", in_list_view: 1 }, { fieldname: "items", label: "Items", fieldtype: "Table", options: "Order Item" }],
  } as unknown as DocMeta;
  const ITEM = { name: "Order Item", fields: [{ fieldname: "item_code", label: "Item Code", fieldtype: "Data" }, { fieldname: "qty", label: "Quantity", fieldtype: "Float" }] } as DocMeta;
  const meta = buildFrappeListMeta(ORDER, en, { "Order Item": ITEM });

  it("offers owner, modified_by, docstatus (submittable) and the child table's fields, labelled with the table", () => {
    const names = meta.filterFields.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["owner", "modified_by", "docstatus", "Order Item.item_code", "Order Item.qty"]));
    expect(meta.filterFields.find((f) => f.name === "Order Item.qty")!.label).toBe("Quantity (Items)");
    expect(meta.filterFields.find((f) => f.name === "docstatus")!.options!.map((o) => o.label)).toEqual(["Draft", "Submitted", "Cancelled"]);
    expect(buildFrappeListMeta({ ...ORDER, is_submittable: 0 } as DocMeta, en).filterFields.map((f) => f.name)).not.toContain("docstatus");
  });
  it("a child condition becomes [child doctype, field, op, value]; the request joins: quoted fields, group_by, distinct count", () => {
    const query = { conjunction: "and" as const, conditions: [{ id: "1", field: "Order Item.qty", operator: "gt" as const, value: "5" }, { id: "2", field: "docstatus", operator: "equals" as const, value: "1" }] };
    expect(queryToFrappe(query, meta.known, meta.fieldtypes, { childOf: meta.childOf }).filters).toEqual([["Order Item", "qty", ">", 5], ["docstatus", "=", 1]]);
    const state = { search: "", query, sort: { key: "title", dir: "asc" as const }, page: 0, pageSize: 20, groupBy: "none", visible: ["title"] };
    const r = buildListRequest({ meta, columns: meta.columns as never, state });
    expect(r).toMatchObject({ joinsChild: true, group_by: "`tabOrder`.`name`", fields: ["`tabOrder`.`name`", "`tabOrder`.`title`"], order_by: "`tabOrder`.`title` asc, `tabOrder`.`name` asc" });
    const plain = buildListRequest({ meta, columns: meta.columns as never, state: { ...state, query: { conjunction: "and", conditions: [] } } });
    expect(plain).toMatchObject({ joinsChild: false, fields: ["name", "title"] });
  });
});
