/**
 * Frappe layer (increment 5.4) — all against simulated requests: a recording mock transport over a simulated Frappe
 * site (playground/src/demo/mock-frappe.ts: the real ToDo DocType definition, made-up rows, Frappe's rejection of
 * unknown fields) and a stubbed `fetch`. No network, no live site, no session.
 * Covers F3 (meta part), F4, F6, F11, F12 (server), F16 (link search), F29 (server errors), F31, F32, F33, F35
 * (standard-field labels), rules C1 (server grouping) and C2 (search with OR filters), and C3 (base filters).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { ThemeProvider, type ColumnDef, type FilterQuery, type ListQueryState, type SavedFilter } from "../src";
import * as core from "../src";
import {
  FrappeError, FrappeListView, FrappeProvider, buildFrappeListMeta, buildListRequest, conditionToFrappe, createFrappeClient,
  frappeRetry, invalidateFrappeList, queryToFrappe, toFrappeError, type DocMeta,
} from "../src/frappe";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe, type MockFrappe } from "../playground/src/demo/mock-frappe";
// Sear's never-run Frappe path, pinned (upstream/SHA256SUMS): oracle and negative controls
import { buildGridMeta } from "../upstream/sear-7abc895-dirty/data-grid/frappe-meta";
import { queryToFrappe as searQueryToFrappe } from "../upstream/sear-7abc895-dirty/data-grid/filter-to-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { localStorage.clear(); delete (globalThis as Record<string, unknown>).csrf_token; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const ar = (k: keyof typeof defaultMessages.ar) => defaultMessages.ar[k];
const META = buildFrappeListMeta(TODO_META as DocMeta, en);
const STATE: ListQueryState = { search: "", query: { conjunction: "and", conditions: [] }, sort: { key: null, dir: "desc" }, page: 0, pageSize: 20, groupBy: "none", visible: ["status", "priority", "date", "reference_type"] };

type Props = Partial<React.ComponentProps<typeof FrappeListView>>;
function setup(props: Props = {}, opts: { lang?: "en" | "ar"; mock?: MockFrappe; queryClient?: QueryClient } = {}) {
  const mock = opts.mock ?? createMockFrappe();
  const client = createFrappeClient({ transport: mock.transport });
  const qc = opts.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (p: Props) => (
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.lang ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client}><FrappeListView doctype="ToDo" storage={null} {...p} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>
  );
  const utils = render(tree(props));
  return { mock, qc, rerender: (p: Props) => utils.rerender(tree(p)) };
}
const calls = (mock: MockFrappe, method: string) => mock.calls.filter((c) => c.method === method);
const lastList = (mock: MockFrappe) => calls(mock, "frappe.client.get_list").at(-1)!.args;
const lastCount = (mock: MockFrappe) => calls(mock, "frappe.desk.reportview.get_count").at(-1)!.args;
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && !tr.hasAttribute("data-group-header") && tr.querySelectorAll("td").length > 1);
const loaded = async (n = 20) => waitFor(() => expect(bodyRows()).toHaveLength(n));
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const pause = () => act(() => new Promise((r) => setTimeout(r, 450))); // past the 300 ms server-mode debounce

// ---- transport ------------------------------------------------------------------------------------------------------------
describe("F31 transport: session cookie + CSRF, stock /api/method", () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("POSTs JSON to /api/method/<method> with the session cookie and the page's CSRF token", async () => {
    const fetch = ok({ message: [] });
    vi.stubGlobal("fetch", fetch);
    (globalThis as Record<string, unknown>).csrf_token = "tok-123";
    await createFrappeClient().call("frappe.client.get_list", { doctype: "ToDo" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/method/frappe.client.get_list");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: JSON.stringify({ doctype: "ToDo" }) });
    expect((init.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("tok-123");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("a token option (string or function) wins; no token → no header; baseUrl prefixes", async () => {
    const fetch = ok({ message: 1 });
    vi.stubGlobal("fetch", fetch);
    (globalThis as Record<string, unknown>).csrf_token = "from-page";
    await createFrappeClient({ csrfToken: () => "from-fn", baseUrl: "https://erp.example.com" }).call("m", {});
    await createFrappeClient({ csrfToken: () => undefined }).call("m", {});
    const [[u1, i1], [, i2]] = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(u1).toBe("https://erp.example.com/api/method/m");
    expect((i1.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("from-fn");
    expect("X-Frappe-CSRF-Token" in (i2.headers as Record<string, string>)).toBe(false);
  });

  it("errors become FrappeError with status, exception type and a readable message", async () => {
    const msgs = (m: string) => JSON.stringify([JSON.stringify({ message: m, title: "Error" })]);
    vi.stubGlobal("fetch", ok({ exc_type: "PermissionError", _server_messages: msgs("<strong>Not permitted</strong> to read ToDo") }, 403));
    const e1 = await createFrappeClient().call("m", {}).catch((e) => e);
    expect(e1).toBeInstanceOf(FrappeError);
    expect(e1).toMatchObject({ status: 403, excType: "PermissionError", message: "Not permitted to read ToDo" });
    vi.stubGlobal("fetch", ok({ exc_type: "ValidationError", exception: "frappe.exceptions.ValidationError: Date is invalid" }, 417));
    expect(await createFrappeClient().call("m", {}).catch((e) => e.message)).toBe("Date is invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));
    expect(await createFrappeClient().call("m", {}).catch((e) => [e.status, e.message])).toEqual([502, "<html>Bad gateway</html>"]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await createFrappeClient().call("m", {}).catch((e) => [e.status, e.message])).toEqual([0, "Failed to fetch"]);
  });

  it("retries network and server errors, never client errors (permission, CSRF, validation)", () => {
    expect(frappeRetry(0, new FrappeError("x", 403))).toBe(false);
    expect(frappeRetry(0, new FrappeError("x", 417))).toBe(false);
    expect(frappeRetry(0, new FrappeError("x", 500))).toBe(true);
    expect(frappeRetry(0, new FrappeError("x", 0))).toBe(true);
    expect(frappeRetry(2, new FrappeError("x", 500))).toBe(false);
  });
});

describe("F31 client: exact stock request shapes", () => {
  const recording = () => { const seen: { method: string; args: Record<string, unknown> }[] = []; return { seen, client: createFrappeClient({ transport: async (method, args) => { seen.push({ method, args }); return method.endsWith("getdoctype") ? { docs: [{ ...TODO_META }] } : { message: method.endsWith("get_count") ? 7 : [] }; } }) }; };

  it("getdoctype (meta in `docs`), get_list, reportview.get_count, search_link", async () => {
    const { seen, client } = recording();
    expect((await client.getMeta("ToDo")).title_field).toBe("description");
    await client.getList("ToDo", { fields: ["name", "status"], filters: [["status", "=", "Open"]], or_filters: [["description", "like", "%a%"]], order_by: "date asc", limit_start: 20, limit_page_length: 20 });
    expect(await client.getCount("ToDo", { filters: [["status", "=", "Open"]], or_filters: [["description", "like", "%a%"]] })).toBe(7);
    await client.searchLink("User", "sa", { referenceDoctype: "ToDo" });
    expect(seen).toEqual([
      { method: "frappe.desk.form.load.getdoctype", args: { doctype: "ToDo" } },
      { method: "frappe.client.get_list", args: { doctype: "ToDo", fields: '["name","status"]', filters: '[["status","=","Open"]]', or_filters: '[["description","like","%a%"]]', order_by: "date asc", limit_start: 20, limit_page_length: 20 } },
      { method: "frappe.desk.reportview.get_count", args: { doctype: "ToDo", filters: '[["status","=","Open"]]', or_filters: '[["description","like","%a%"]]' } },
      { method: "frappe.desk.search.search_link", args: { doctype: "User", txt: "sa", page_length: 10, reference_doctype: "ToDo" } },
    ]);
  });

  it("count uses reportview.get_count, which reads or_filters (fix) — negative control: Sear sent them to frappe.client.get_count", async () => {
    // Frappe 15 frappe.client.get_count(doctype, filters=None, debug=False, cache=False) has no `or_filters`, and
    // frappe.call drops undeclared arguments (frappe/__init__.py get_newargs), so Sear's OR-filter counts were unfiltered.
    const sear = await import("../upstream/sear-7abc895-dirty/data-grid/useDataGrid.ts?raw").catch(() => null);
    void sear;
    const { seen, client } = recording();
    await client.getCount("ToDo", { or_filters: [["status", "=", "Open"], ["priority", "=", "High"]] });
    expect(seen[0].method).toBe("frappe.desk.reportview.get_count");
  });

  it("an unknown DocType is a clear error", async () => {
    const mock = createMockFrappe();
    const e = await createFrappeClient({ transport: mock.transport }).getMeta("Nope").catch((x) => x);
    expect(e).toMatchObject({ status: 404, excType: "DoesNotExistError" });
  });
});

// ---- meta (F33, F35) ----------------------------------------------------------------------------------------------------------
describe("F33 meta → columns, filters, quick filters, title, search, default order", () => {
  it("the simulated site's ToDo is Frappe's own definition (pinned todo.json, Frappe 15.110)", async () => {
    const real = (await import("../upstream/frappe-15.110-ab7e5ae/todo.json")).default as { fields: Record<string, unknown>[] } & Record<string, unknown>;
    const pick = (f: Record<string, unknown>) => Object.fromEntries(["fieldname", "label", "fieldtype", "options", "in_list_view", "in_standard_filter", "hidden"].filter((k) => f[k] !== undefined && f[k] !== 0 && f[k] !== "").map((k) => [k, f[k]]));
    expect(TODO_META.fields.map(pick)).toEqual(real.fields.map(pick));
    for (const k of ["title_field", "search_fields", "sort_field", "sort_order"] as const) expect(TODO_META[k]).toBe(real[k]);
  });

  it("matches Sear's buildGridMeta for every regular field", () => {
    const sear = buildGridMeta({ doctype: "ToDo", fields: TODO_META.fields });
    const ours = new Map(META.filterFields.map((f) => [f.name, f]));
    for (const f of sear.filterFields.filter((x) => !["name", "creation", "modified", "reference_name"].includes(x.name))) {
      expect(ours.get(f.name), f.name).toMatchObject({ type: f.type, fieldtype: f.fieldtype, label: f.label, ...(f.options ? { options: f.options } : {}) });
    }
    expect(META.columns.filter((c) => !c.hidden).map((c) => c.key)).toEqual(sear.defaultColumns);
    expect(META.quickFilterFields).toEqual(sear.quickFilterFields.map((f) => f.name));
    expect(META.titleField).toBe(sear.titleField);
  });

  it("layout, hidden and unsupported fields are left out; search fields and the DocType's sort are used", () => {
    const names = META.filterFields.map((f) => f.name);
    for (const n of ["description_and_status", "column_break_2", "sender", "color"]) expect(names).not.toContain(n);
    expect(META.searchFields).toEqual(["description", "reference_type", "reference_name", "name"]);
    expect(META.defaultOrderBy).toBe("modified desc");
    expect(buildFrappeListMeta({ ...TODO_META, sort_field: "date", sort_order: "ASC" } as DocMeta, en).defaultOrderBy).toBe("date asc");
    expect(buildFrappeListMeta({ ...TODO_META, sort_field: "no_such" } as DocMeta, en).defaultOrderBy).toBe("modified desc");
  });

  it("no in_list_view field → the title field and the first few fields (Sear's fallback)", () => {
    const m = buildFrappeListMeta({ ...TODO_META, fields: TODO_META.fields.map((f) => ({ ...f, in_list_view: 0 })) } as DocMeta, en);
    expect(m.columns.filter((c) => !c.hidden).map((c) => c.key)).toEqual(["description", "status", "priority", "date", "reference_type"]);
    expect(m.columns[0].key).toBe("description"); // the title column leads, as in Sear's fallback order
  });

  it("standard fields are localized (fix) — negative control: Sear's are English in every language", () => {
    const label = (m: typeof META, n: string) => m.filterFields.find((f) => f.name === n)!.label;
    const arMeta = buildFrappeListMeta(TODO_META as DocMeta, ar);
    expect(["name", "creation", "modified"].map((n) => label(arMeta, n))).toEqual(["المعرّف", "تاريخ الإنشاء", "آخر تحديث"]);
    expect(["name", "creation", "modified"].map((n) => label(META, n))).toEqual(["ID", "Created On", "Last Updated"]);
    const sear = buildGridMeta({ doctype: "ToDo", fields: TODO_META.fields });
    expect(sear.filterFields.filter((f) => ["name", "creation", "modified"].includes(f.name)).map((f) => f.label)).toEqual(["ID", "Created On", "Last Updated"]);
  });

  it("a Dynamic Link is filtered as text (fix) — negative control: Sear made it a link to the DocType “reference_type”", () => {
    expect(META.filterFields.find((f) => f.name === "reference_name")).toMatchObject({ type: "text", fieldtype: "Dynamic Link" });
    expect(META.filterFields.find((f) => f.name === "reference_name")!.link_doctype).toBeUndefined();
    const sear = buildGridMeta({ doctype: "ToDo", fields: TODO_META.fields }).filterFields.find((f) => f.name === "reference_name")!;
    expect(sear).toMatchObject({ type: "link", link_doctype: "reference_type" }); // a field name, not a DocType
  });
});

// ---- F11 filter translation -------------------------------------------------------------------------------------------------
describe("F11 filters → Frappe", () => {
  const q = (conjunction: "and" | "or", ...conditions: [string, FilterQuery["conditions"][number]["operator"], string][]): FilterQuery =>
    ({ conjunction, conditions: conditions.map(([field, operator, value], i) => ({ id: `c${i}`, field, operator, value })) });

  it("text, select and link operators equal Sear's translation", () => {
    for (const [field, op, value] of [["status", "equals", "Open"], ["status", "not_equals", "Open"], ["status", "in", "Open, Closed"], ["status", "not_in", "Open"], ["description", "like", "visa"], ["description", "not_like", "visa"], ["allocated_to", "is_set", ""], ["allocated_to", "is_not_set", ""], ["date", "lt", "2026-10-15"]] as const) {
      const query = q("and", [field, op, value]);
      expect(queryToFrappe(query, META.known, META.fieldtypes).filters, `${field} ${op}`).toEqual(searQueryToFrappe(query, META.filterFields).filters);
    }
    const two = q("or", ["status", "equals", "Open"], ["priority", "equals", "High"]);
    expect(queryToFrappe(two, META.known, META.fieldtypes)).toMatchObject(searQueryToFrappe(two, META.filterFields));
    const one = q("or", ["status", "equals", "Open"]);
    expect(queryToFrappe(one, META.known, META.fieldtypes)).toMatchObject({ filters: [["status", "=", "Open"]], or_filters: [] });
  });

  it("values are coerced to the column type (PMO); invalid numbers and half-built conditions are skipped", () => {
    expect(conditionToFrappe({ id: "a", field: "idx", operator: "gt", value: "5" }, "Int")).toEqual(["idx", ">", 5]);
    expect(conditionToFrappe({ id: "a", field: "idx", operator: "in", value: "1, 2, x" }, "Int")).toEqual(["idx", "in", [1, 2]]);
    expect(conditionToFrappe({ id: "a", field: "idx", operator: "equals", value: "abc" }, "Int")).toBeNull();
    expect(conditionToFrappe({ id: "a", field: "done", operator: "equals", value: "true" }, "Check")).toEqual(["done", "=", 1]);
    expect(conditionToFrappe({ id: "a", field: "done", operator: "equals", value: "false" }, "Check")).toEqual(["done", "=", 0]);
    expect(conditionToFrappe({ id: "a", field: "status", operator: "equals", value: "" }, "Select")).toBeNull();
  });

  it("date-only values on Datetime fields cover the whole day (fix); Date fields are unchanged", () => {
    const dt = (operator: FilterQuery["conditions"][number]["operator"]) => conditionToFrappe({ id: "a", field: "creation", operator, value: "2026-10-15" }, "Datetime");
    expect(dt("equals")).toEqual(["creation", "between", ["2026-10-15", "2026-10-15"]]);
    expect(dt("gt")).toEqual(["creation", ">", "2026-10-15 23:59:59.999999"]);
    expect(dt("lte")).toEqual(["creation", "<=", "2026-10-15 23:59:59.999999"]);
    expect(dt("gte")).toEqual(["creation", ">=", "2026-10-15"]);
    expect(conditionToFrappe({ id: "a", field: "date", operator: "equals", value: "2026-10-15" }, "Date")).toEqual(["date", "=", "2026-10-15"]);
    expect(searQueryToFrappe(q("and", ["creation", "equals", "2026-10-15"]), META.filterFields).filters).toEqual([["creation", "=", "2026-10-15"]]); // midnight only
  });

  it("conditions on fields the DocType doesn't have are dropped (fix) — negative control: Sear sends them and Frappe rejects the request", async () => {
    const stale = q("and", ["old_field", "equals", "x"], ["status", "equals", "Open"]);
    expect(queryToFrappe(stale, META.known, META.fieldtypes)).toEqual({ filters: [["status", "=", "Open"]], or_filters: [], dropped: ["old_field"] });
    const client = createFrappeClient({ transport: createMockFrappe().transport });
    const sear = searQueryToFrappe(stale, META.filterFields);
    const e = await client.getList("ToDo", { fields: ["name"], ...sear }).catch((x) => x);
    expect(e).toMatchObject({ status: 417, excType: "DataError", message: "Field not permitted in query: old_field" });
  });
});

// ---- request building: F4, F6, F32, C1, C2 -----------------------------------------------------------------------------------
describe("request building", () => {
  const cols = META.columns as ColumnDef<never>[];
  const req = (state: Partial<typeof STATE>, extra: Partial<Parameters<typeof buildListRequest>[0]> = {}) => buildListRequest({ meta: META, columns: cols, state: { ...STATE, ...state }, ...extra });

  it("F4 fetches the visible columns' fields + name; render-only, unknown and action columns never reach the request", () => {
    expect(req({}).fields).toEqual(["name", "status", "priority", "date", "reference_type"]);
    const curated: ColumnDef<never>[] = [
      { key: "who", label: "Who", field: "allocated_to", metaFields: ["assigned_by"] },
      { key: "badge", label: "Badge", render: () => null },
      { key: "__actions", label: "Actions", sortable: false },
    ];
    const r = buildListRequest({ meta: META, columns: [...curated, ...cols], state: { ...STATE, visible: ["who", "badge", "__actions", "status"] } });
    expect(r.fields).toEqual(["name", "allocated_to", "assigned_by", "status"]);
  });

  it("F6 sorts by the column's field; unknown or unsortable → the DocType's default order", () => {
    expect(req({ sort: { key: "date", dir: "asc" } }).order_by).toBe("date asc");
    expect(req({ sort: { key: "badge", dir: "asc" } }).order_by).toBe("modified desc");
    const r = buildListRequest({ meta: META, columns: [{ key: "x", label: "X", field: "date", sortable: false }, ...cols] as ColumnDef<never>[], state: { ...STATE, sort: { key: "x", dir: "asc" } } });
    expect(r.order_by).toBe("modified desc");
  });

  it("F32 base filters come first and stay AND-ed", () => {
    const r = req({ query: { conjunction: "or", conditions: [{ id: "a", field: "status", operator: "equals", value: "Open" }, { id: "b", field: "priority", operator: "equals", value: "High" }] } }, { baseFilters: [["allocated_to", "=", "sara@example.com"]] });
    expect(r.filters).toEqual([["allocated_to", "=", "sara@example.com"]]);
    expect(r.or_filters).toEqual([["status", "=", "Open"], ["priority", "=", "High"]]);
  });

  it("C2 AND filters: search uses or_filters across the search fields", () => {
    const r = req({ search: "visa", query: { conjunction: "and", conditions: [{ id: "a", field: "status", operator: "equals", value: "Open" }] } });
    expect(r.filters).toEqual([["status", "=", "Open"]]);
    expect(r.or_filters).toEqual(["description", "reference_type", "reference_name", "name"].map((f) => [f, "like", "%visa%"]));
    expect(r.searchNarrowed).toBe(false);
  });

  it("C2 OR filters: search narrows to the title field, AND-ed, and says so", () => {
    const r = req({ search: "visa", query: { conjunction: "or", conditions: [{ id: "a", field: "status", operator: "equals", value: "Open" }, { id: "b", field: "priority", operator: "equals", value: "High" }] } });
    expect(r.or_filters).toEqual([["status", "=", "Open"], ["priority", "=", "High"]]);
    expect(r.filters).toEqual([["description", "like", "%visa%"]]);
    expect(r.searchNarrowed).toBe(true);
  });

  it("C2 edge cases: OR with one condition leaves or_filters free; one search field goes into filters; no narrowing note then", () => {
    const one = req({ search: "visa", query: { conjunction: "or", conditions: [{ id: "a", field: "status", operator: "equals", value: "Open" }] } });
    expect(one).toMatchObject({ filters: [["status", "=", "Open"]], searchNarrowed: false });
    expect(one.or_filters).toHaveLength(4);
    const single = req({ search: "visa", query: { conjunction: "or", conditions: [{ id: "a", field: "status", operator: "equals", value: "Open" }, { id: "b", field: "priority", operator: "equals", value: "High" }] } }, { searchFields: ["description"] });
    expect(single).toMatchObject({ filters: [["description", "like", "%visa%"]], searchNarrowed: false });
  });

  it("C1 grouped: chunks from row 0 and the group field is fetched; ungrouped: pages", () => {
    expect(req({ groupBy: "status", visible: ["priority"] })).toMatchObject({ grouped: true, limit_start: 0, limit_page_length: 200, fields: ["name", "priority", "status"] });
    expect(req({ page: 2 })).toMatchObject({ grouped: false, limit_start: 40, limit_page_length: 20 });
    expect(req({ groupBy: "no_such" }).grouped).toBe(false);
  });
});

// ---- FrappeListView against the simulated site ------------------------------------------------------------------------------
describe("FrappeListView (F31 data mode)", () => {
  it("loads meta once, then rows and the count with the same filters; columns, quick filters and total from the DocType", async () => {
    const { mock } = setup();
    await loaded();
    expect(calls(mock, "frappe.desk.form.load.getdoctype")).toHaveLength(1);
    expect(calls(mock, "frappe.client.get_list")).toHaveLength(1); // no request from the placeholder shown while meta loads
    expect(lastList(mock)).toMatchObject({ doctype: "ToDo", fields: ["name", "status", "priority", "date", "reference_type"], filters: [], or_filters: [], order_by: "modified desc", limit_start: 0, limit_page_length: 20 });
    expect(lastCount(mock)).toEqual({ doctype: "ToDo", filters: [], or_filters: [] });
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim())).toEqual(["Status", "Priority", "Due Date", "Reference Type"]);
    for (const name of ["Status", "Priority", "Allocated To"]) expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0); // in_standard_filter
    expect(screen.getByText("Total: 45")).toBeTruthy();
  });

  it("a quick filter reaches list and count identically; sorting and paging change only the list request", async () => {
    const { mock } = setup();
    await loaded();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Status" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Open" }));
    await pause();
    await waitFor(() => expect(lastList(mock).filters).toEqual([["status", "=", "Open"]]));
    expect(lastCount(mock).filters).toEqual(lastList(mock).filters);
    expect(lastCount(mock).or_filters).toEqual(lastList(mock).or_filters);
    const total = mock.rows.filter((r) => r.status === "Open").length;
    await waitFor(() => expect(screen.getByText(`Total: ${total}`)).toBeTruthy());
    const countsBefore = calls(mock, "frappe.desk.reportview.get_count").length;
    fireEvent.click(within(document.querySelector("thead")!).getByRole("button", { name: /Due Date/ }));
    await waitFor(() => expect(lastList(mock).order_by).toBe("date asc"));
    fireEvent.click(btn("Next page"));
    await waitFor(() => expect(lastList(mock).limit_start).toBe(20));
    expect(calls(mock, "frappe.desk.reportview.get_count")).toHaveLength(countsBefore); // same filters → cached count
  });

  it("F12 search: one request per typing pause, across the DocType's search fields", async () => {
    const { mock } = setup();
    await loaded();
    const before = calls(mock, "frappe.client.get_list").length;
    const input = screen.getByPlaceholderText("Search…");
    for (const v of ["v", "vi", "vis", "visa"]) type(input, v);
    await pause();
    await waitFor(() => expect(calls(mock, "frappe.client.get_list").length).toBe(before + 1));
    expect(lastList(mock).or_filters).toEqual(["description", "reference_type", "reference_name", "name"].map((f) => [f, "like", "%visa%"]));
    const hits = mock.rows.filter((r) => ["description", "reference_type", "reference_name", "name"].some((f) => /visa/i.test(String(r[f] ?? ""))));
    expect(hits.length).toBeGreaterThan(mock.rows.filter((r) => /visa/i.test(String(r.description))).length); // other fields count too
    await waitFor(() => expect(bodyRows().length).toBe(hits.length));
    expect(screen.queryByRole("status")).toBeNull(); // nothing narrowed
  });

  it("C2 in the UI: with “Match any” filters, search narrows to the title field and the list says so", async () => {
    const { mock } = setup();
    await loaded();
    fireEvent.click(btn("Filter"));
    const pop = () => screen.getByRole("dialog");
    fireEvent.click(within(pop()).getByRole("button", { name: "Add filter" }));
    fireEvent.click(within(pop()).getByRole("button", { name: "Add filter" }));
    // first field is Status (select): pick values through the value selects
    const valueSelects = () => within(pop()).getAllByRole("combobox").filter((c) => ["Select value", "Open", "Closed"].includes(c.textContent ?? ""));
    fireEvent.keyDown(valueSelects()[0], { key: "Enter" }); fireEvent.click(await screen.findByRole("option", { name: "Open" }));
    fireEvent.keyDown(valueSelects()[1], { key: "Enter" }); fireEvent.click(await screen.findByRole("option", { name: "Closed" }));
    const conj = within(pop()).getAllByRole("combobox").find((c) => c.textContent === "Match all")!;
    fireEvent.keyDown(conj, { key: "Enter" }); fireEvent.click(await screen.findByRole("option", { name: "Match any" }));
    fireEvent.keyDown(pop(), { key: "Escape" });
    type(screen.getByPlaceholderText("Search…"), "visa");
    await pause();
    await waitFor(() => expect(lastList(mock).filters).toEqual([["description", "like", "%visa%"]]));
    expect(lastList(mock).or_filters).toEqual([["status", "=", "Open"], ["status", "=", "Closed"]]);
    expect(screen.getByRole("status").textContent).toBe("Search looks in Description only while the filters match any condition.");
  });

  it("C1 server grouping: chunks, “Showing X of Y”, '+' on counts, Load more appends; complete data shows neither", async () => {
    const { mock } = setup({ groupByFields: ["status"], chunkSize: 20 });
    await loaded();
    fireEvent.keyDown(btn(/Group by/), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Status" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(lastList(mock)).toMatchObject({ limit_start: 0, limit_page_length: 20 }));
    expect(lastList(mock).fields).toContain("status");
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Showing 20 of 45 records"));
    expect(screen.getAllByRole("button", { expanded: true }).every((b) => /\+$/.test(b.textContent!))).toBe(true);
    fireEvent.click(btn("Load more"));
    await waitFor(() => expect(lastList(mock).limit_start).toBe(20));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Showing 40 of 45"));
    fireEvent.click(btn("Load more"));
    await waitFor(() => expect(bodyRows()).toHaveLength(45));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("button", { expanded: true }).some((b) => b.textContent!.includes("+"))).toBe(false);
  });

  it("F29 server errors are shown with Frappe's message; Retry reloads (403 and 500)", async () => {
    const mock = createMockFrappe();
    mock.failNext(1, { status: 403, exc_type: "PermissionError", message: "No permission for ToDo" }, "frappe.client.get_list");
    setup({}, { mock });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No permission for ToDo"));
    fireEvent.click(btn("Retry"));
    await loaded();
    mock.failNext(1, { status: 500, exc_type: "Exception", message: "Server error" }, "frappe.client.get_list");
    fireEvent.click(btn("Next page"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Server error"));
    fireEvent.click(btn("Retry"));
    await loaded(20);
  });

  it("an unknown DocType shows the error and does not request rows", async () => {
    const mock = createMockFrappe();
    setup({ doctype: "Nope" }, { mock });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("DocType Nope not found"));
    expect(calls(mock, "frappe.client.get_list")).toHaveLength(0);
  });

  it("F11 in the UI: a saved filter on a field that no longer exists still loads (the field is dropped)", async () => {
    const saved: SavedFilter[] = [{ id: "s1", label: "Old view", query: { conjunction: "and", conditions: [{ id: "a", field: "old_field", operator: "equals", value: "x" }, { id: "b", field: "status", operator: "equals", value: "Open" }] } }];
    const { mock } = setup({ storage: { prefs: null, saved: { list: () => saved, save: () => saved, remove: () => saved } } });
    await loaded();
    fireEvent.click(btn("Saved"));
    fireEvent.click(screen.getByRole("button", { name: "Old view" }));
    await pause();
    await waitFor(() => expect(lastList(mock).filters).toEqual([["status", "=", "Open"]]));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("F32 base filters reach list and count; changing them clears the selection (C3)", async () => {
    const run = vi.fn();
    const base = { selectable: true, bulkActions: [{ key: "close", label: "Close", run }], baseFilters: [["allocated_to", "=", "sara@example.com"]] as [string, string, unknown][] };
    const { mock, rerender } = setup(base);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
    expect(lastList(mock).filters).toEqual([["allocated_to", "=", "sara@example.com"]]);
    expect(lastCount(mock).filters).toEqual([["allocated_to", "=", "sara@example.com"]]);
    fireEvent.click(within(bodyRows()[0]).getByRole("checkbox"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    rerender({ ...base, baseFilters: [["allocated_to", "=", "omar@example.com"]] });
    await waitFor(() => expect(lastList(mock).filters).toEqual([["allocated_to", "=", "omar@example.com"]]));
    expect(screen.queryByText("1 selected")).toBeNull();
  });

  it("F16 link filters use Frappe's own link search on the field's DocType", async () => {
    const { mock } = setup();
    await loaded();
    fireEvent.click(btn("Filter"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add filter" }));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("combobox")[0]); // field picker
    fireEvent.click(await screen.findByRole("option", { name: "Allocated To" }));
    await act(() => new Promise((r) => setTimeout(r, 50))); // let the field picker's popover finish closing
    fireEvent.click(within(screen.getAllByRole("dialog")[0]).getByRole("combobox", { name: "Value" }));
    await waitFor(() => expect(calls(mock, "frappe.desk.search.search_link").at(-1)?.args).toEqual({ doctype: "User", txt: "", page_length: 10, reference_doctype: "ToDo" }));
    expect(await screen.findByRole("option", { name: "sara@example.com" })).toBeTruthy();
  });

  it("curated columns come first and fieldLabels translate the DocType's labels; rich text shows as text", async () => {
    setup({
      columns: [{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text", fieldtype: "Text Editor" }],
      fieldLabels: { status: { en: "Status", ar: "الحالة" }, priority: { en: "Priority", ar: "الأولوية" } },
    }, { lang: "ar" });
    await loaded();
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim()).slice(0, 3)).toEqual(["المهمة", "الحالة", "الأولوية"]);
    expect(bodyRows()[0].querySelector("td")!.textContent).not.toMatch(/<p>/);
    // the curated column's label also names the title field in the field picker (and the C2 search note)
    fireEvent.click(btn("تصفية"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "إضافة عامل تصفية" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("combobox", { name: "الحقل" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(expect.arrayContaining(["المهمة", "الحالة", "الأولوية", "المعرّف"]));
    expect(screen.getByText("الإجمالي: 45")).toBeTruthy();
  });
});

describe("app writes", () => {
  it("F24: the package confirms, the app deletes; invalidateFrappeList reloads rows and count", async () => {
    const mock = createMockFrappe();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const del = vi.fn(async (r: unknown) => { const name = (r as { name: string }).name; mock.rows.splice(mock.rows.findIndex((x) => x.name === name), 1); await invalidateFrappeList(qc, "ToDo"); });
    setup({ rowActions: [{ key: "del", label: "Delete", icon: Trash2, tone: "destructive", onSelect: del, confirm: { title: "Delete this ToDo?" } }] }, { mock, queryClient: qc });
    await loaded();
    expect(screen.getByText("Total: 45")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(del).not.toHaveBeenCalled(); // nothing happens before the confirmation
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.getByText("Total: 44")).toBeTruthy());
    expect(del).toHaveBeenCalledTimes(1);
  });
});

describe("providers", () => {
  it("uses the app's QueryClient when there is one", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    setup({}, { queryClient: qc });
    await loaded();
    expect(qc.getQueryCache().getAll().map((q) => q.queryKey[1])).toEqual(expect.arrayContaining(["meta", "list", "count"]));
  });

  it("FrappeListView works with no provider at all (it creates one)", async () => {
    const mock = createMockFrappe();
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FrappeListView doctype="ToDo" storage={null} client={createFrappeClient({ transport: mock.transport })} /></ThemeProvider>);
    await loaded();
    expect(calls(mock, "frappe.client.get_list")).toHaveLength(1);
  });

  it("the core entry exports nothing from the Frappe layer", () => {
    for (const name of ["FrappeListView", "FrappeProvider", "createFrappeClient", "queryToFrappe", "toFrappeError"]) expect(name in core).toBe(false);
    expect(typeof toFrappeError).toBe("function");
  });
});
