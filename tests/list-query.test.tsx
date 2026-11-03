/**
 * Phase 27 (query27) — list query features, ALL SIMULATED (stub transports, jsdom window / history, a stubbed file
 * transport). Nothing here ran against a Frappe site and none of it is evidence of real-Frappe behaviour:
 *  1. nested-set filter operators (filter.js:32-36, 440-446; db_query.py:794-842);
 *  2. the width-based column cap (list_view.js:375-457);
 *  3. URL filters (list_view.js:2130-2183 read, :1664-1696 write-back);
 *  4. the Report view export (`frappe.desk.reportview.export_query`, reportview.py:352-466; report_view.js:1646-1722).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FilterBuilder, ListView, ThemeProvider, applyFilterQuery, operatorsFor, useListState, type ColumnDef, type FilterField, type FilterQuery } from "../src";
import { FrappeListView, FrappeProvider, buildFrappeListMeta, createFrappeClient, queryToFrappe, useFrappeList, type DocMeta, type FrappeTransport } from "../src/frappe";
import type { FrappeListOptions } from "../src/frappe/useFrappeList";
import { capDefaultColumns, deskColumnLimit } from "../src/frappe/list/settings";
import { filtersToUrl, parseUrlFilters } from "../src/frappe/list/urlFilters";
import { NESTED_SET_LABEL, NESTED_SET_OPERATORS, operatorLabel } from "../src/list/model/filters";
import { queryToTuples, tuplesToQuery } from "../src/frappe/list/tuples";
import { createFrappeSavedFilters } from "../src/frappe/list/storage";
import { defaultMessages } from "../src/theme/messages";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const q = (conditions: { field: string; operator: string; value: string }[], conjunction: "and" | "or" = "and") =>
  ({ conjunction, conditions: conditions.map((c, i) => ({ id: `c${i}`, ...c })) }) as FilterQuery;
const plain = (query: FilterQuery) => query.conditions.map(({ field, operator, value }) => ({ field, operator, value }));

/** A Task-like tree DocType: `parent_task` links to itself (lft / rgt present → nested set by boot.py:70-72's rule). */
const TASK = {
  name: "Task", title_field: "subject", search_fields: "subject", sort_field: "modified", sort_order: "DESC",
  fields: [
    { fieldname: "subject", label: "Subject", fieldtype: "Data", in_list_view: 1 },
    { fieldname: "status", label: "Status", fieldtype: "Select", options: "Open\nWorking\nCompleted", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "parent_task", label: "Parent Task", fieldtype: "Link", options: "Task" },
    { fieldname: "project", label: "Project", fieldtype: "Link", options: "Project", in_list_view: 1 },
    { fieldname: "department", label: "Department", fieldtype: "Link", options: "Department" },
    { fieldname: "lft", label: "Left", fieldtype: "Int", hidden: 1, read_only: 1 },
    { fieldname: "rgt", label: "Right", fieldtype: "Int", hidden: 1, read_only: 1 },
    { fieldname: "is_group", label: "Is Group", fieldtype: "Check" },
  ],
} as unknown as DocMeta;

// ---------------------------------------------------------------------------------------------------------------------
describe("nested-set operators (filter.js:32-36, 440-446 → db_query.py:794-842) — SIMULATED", () => {
  const meta = buildFrappeListMeta(TASK, en, {}, { treeDoctypes: ["Department"] });
  const field = (name: string) => meta.filterFields.find((f) => f.name === name)!;

  it("only Link fields whose target is a tree are marked: the DocType itself (lft field), and the app's treeDoctypes (Desk: boot.nested_set_doctypes)", () => {
    expect(field("parent_task").tree).toBe(true); // self link, the meta has `lft`
    expect(field("department").tree).toBe(true); // named by the app
    expect(field("project").tree).toBeUndefined(); // Project: no meta at hand, not named → not a tree
    expect(field("owner").tree).toBeUndefined(); // User
    expect(buildFrappeListMeta(TASK, en).filterFields.find((f) => f.name === "department")!.tree).toBeUndefined();
    // is_tree alone also counts (model.js:424-427)
    const flagged = buildFrappeListMeta({ ...TASK, name: "Account", fields: [{ fieldname: "parent_account", label: "Parent", fieldtype: "Link", options: "Account" }], is_tree: 1 } as unknown as DocMeta, en);
    expect(flagged.filterFields.find((f) => f.name === "parent_account")!.tree).toBe(true);
  });

  it("operatorsFor offers the five, in Frappe's order, after the Link operators — and only for a tree link", () => {
    expect(operatorsFor(field("parent_task")).slice(-5)).toEqual([...NESTED_SET_OPERATORS]);
    expect(NESTED_SET_OPERATORS).toEqual(["descendants_of", "descendants_of_inclusive", "not_descendants_of", "ancestors_of", "not_ancestors_of"]);
    for (const name of ["project", "owner", "status", "subject", "modified"]) expect(operatorsFor(field(name)).some((op) => NESTED_SET_OPERATORS.includes(op as never))).toBe(false);
    // a text field flagged `tree` by mistake gets nothing (Desk: `df.fieldtype === "Link"` is part of the rule)
    expect(operatorsFor({ name: "x", label: "X", type: "text", tree: true } as FilterField)).not.toContain("descendants_of");
  });

  it("they are sent to the server UNCHANGED (database/utils.py:21-27 spelling); a half-built one is dropped", () => {
    const query = q([
      { field: "parent_task", operator: "descendants_of", value: "TASK-1" },
      { field: "parent_task", operator: "descendants_of_inclusive", value: "TASK-1" },
      { field: "department", operator: "not_descendants_of", value: "Sales" },
      { field: "department", operator: "ancestors_of", value: "Sales - East" },
      { field: "department", operator: "not_ancestors_of", value: "Sales - East" },
      { field: "parent_task", operator: "ancestors_of", value: "" },
    ]);
    expect(queryToFrappe(query, meta.known, meta.fieldtypes).filters).toEqual([
      ["parent_task", "descendants of", "TASK-1"],
      ["parent_task", "descendants of (inclusive)", "TASK-1"],
      ["department", "not descendants of", "Sales"],
      ["department", "ancestors of", "Sales - East"],
      ["department", "not ancestors of", "Sales - East"],
    ]);
  });

  it("round-trip through saved filters: List Filter tuples (Desk's 4-tuples) and back", async () => {
    const query = q([{ field: "parent_task", operator: "descendants_of_inclusive", value: "TASK-9" }, { field: "status", operator: "equals", value: "Open" }]);
    const tuples = queryToTuples(query, meta);
    expect(tuples).toEqual([["Task", "parent_task", "descendants of (inclusive)", "TASK-9"], ["Task", "status", "=", "Open"]]);
    expect(plain(tuplesToQuery(tuples, meta))).toEqual(plain(query));
    // Desk stores what its filter sends; upper-case in a hand-written row is read too (tuplesToQuery lower-cases)
    expect(plain(tuplesToQuery([["Task", "parent_task", "Not Ancestors Of", "TASK-2"]], meta))).toEqual([{ field: "parent_task", operator: "not_ancestors_of", value: "TASK-2" }]);
    // a list value is not a node: dropped rather than guessed
    expect(tuplesToQuery([["Task", "parent_task", "descendants of", ["A", "B"]]], meta).conditions).toEqual([]);

    // through the List Filter adapter (frappe.client.insert / get_list), stubbed
    const stored: { name: string; filter_name: string; for_user: string; filters: string }[] = [];
    const transport: FrappeTransport = async (method, args) => {
      if (method === "frappe.client.insert") { const doc = JSON.parse(String(args.doc)); stored.push({ name: `LF-${stored.length + 1}`, ...doc }); return { message: doc }; }
      if (method === "frappe.client.get_list") return { message: stored };
      throw new Error(`unexpected ${method}`);
    };
    const saved = createFrappeSavedFilters(createFrappeClient({ transport }), { user: "u@x.com", meta });
    const list = await saved.save("Task", "Under TASK-9", query);
    expect(JSON.parse(stored[0].filters)).toEqual(tuples);
    expect(plain(list[0].query)).toEqual(plain(query));
  });

  it("client mode cannot evaluate a hierarchy: the condition filters nothing there (documented)", () => {
    const rows = [{ name: "A", parent_task: "X" }, { name: "B", parent_task: "Y" }];
    expect(applyFilterQuery(rows, q([{ field: "parent_task", operator: "descendants_of", value: "X" }]), [field("parent_task")])).toEqual(rows);
  });

  it("labels: Frappe's English and Arabic (locale/ar.po) until the catalogue has the keys; a catalogue entry wins", () => {
    const missing = (k: string) => k; // ThemeProvider's `t` returns the key when the catalogue lacks it
    expect(operatorLabel("descendants_of_inclusive", field("parent_task"), missing as never, "en")).toBe("Descendants Of (inclusive)");
    expect(operatorLabel("ancestors_of", field("parent_task"), missing as never, "ar")).toBe(NESTED_SET_LABEL.ancestors_of.ar);
    expect(operatorLabel("ancestors_of", field("parent_task"), (() => "Ancêtres de") as never, "en")).toBe("Ancêtres de");
    expect(operatorLabel("equals", field("parent_task"), en, "en")).toBe("Equals");
  });

  it("the filter popover lists them for the tree link only, and keeps the Link picker for the value", () => {
    const fields = [field("parent_task"), field("project")];
    const Stateful = () => {
      const [query, setQuery] = React.useState<FilterQuery>(q([{ field: "parent_task", operator: "equals", value: "" }]));
      return <FilterBuilder fields={fields} query={query} onChange={setQuery} activeCount={0} loadOptions={async () => [{ value: "TASK-1", label: "TASK-1" }]} />;
    };
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><Stateful /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    const op = within(screen.getByRole("dialog")).getByRole("combobox", { name: en("operator") });
    fireEvent.keyDown(op, { key: "Enter" });
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(["Descendants Of", "Descendants Of (inclusive)", "Not Descendants Of", "Ancestors Of", "Not Ancestors Of"]));
    fireEvent.click(screen.getByRole("option", { name: "Descendants Of (inclusive)" }));
    // the value is still a Link search (combobox named "Value"), not a free-text box
    expect(within(screen.getByRole("dialog")).getByRole("combobox", { name: en("value") })).toBeTruthy();
    // switch the field to the non-tree link: the hierarchy operator is not kept
    cleanup();
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FilterBuilder fields={fields} query={q([{ field: "project", operator: "equals", value: "" }])} onChange={() => {}} activeCount={0} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.keyDown(within(screen.getByRole("dialog")).getByRole("combobox", { name: en("operator") }), { key: "Enter" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).not.toContain("Descendants Of");
  });
});

// ---- a stub site + the hook wired the way FrappeListView spreads it (the Lead adds the new options to FrappeListView) ----
type Call = { method: string; args: Record<string, unknown> };
function site(doc: DocMeta, o: { settings?: Record<string, unknown> | null; rows?: Record<string, unknown>[]; userSettings?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  const transport: FrappeTransport = async (method, args) => {
    calls.push({ method, args });
    if (method === "frappe.desk.form.load.getdoctype") return { docs: [doc], user_settings: JSON.stringify(o.userSettings ?? {}) };
    if (method === "frappe.desk.listview.get_list_settings") return { message: o.settings ?? null };
    if (method === "frappe.desk.reportview.get") {
      const fields = JSON.parse(String(args.fields)) as string[];
      const rows = o.rows ?? [];
      return { message: rows.length ? { keys: fields, values: rows.map((r) => fields.map((f) => r[f] ?? null)), user_info: {} } : [] };
    }
    if (method === "frappe.desk.reportview.get_count") return { message: (o.rows ?? []).length };
    if (method === "frappe.client.get_list") return { message: [] };
    throw new Error(`unexpected ${method}`);
  };
  const of = (method: string) => calls.filter((c) => c.method === method);
  return { transport, calls, of, last: (method: string) => of(method)[of(method).length - 1] };
}

function HookList<T = Record<string, unknown>>(props: FrappeListOptions<T>) {
  const f = useFrappeList<T>(props);
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  return <ListView<T> key={f.ready ? "ready" : "meta"} viewKey={props.doctype} storage={null} quickFilterFields={quickFilterFields} loadOptions={loadOptions} {...data} />;
}
function mountHook(transport: FrappeTransport, props: Partial<FrappeListOptions<Record<string, unknown>>> & { doctype: string }) {
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client}><HookList {...props} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}
const headers = () => [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim());
const setWidth = (w: number) => act(() => { Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w }); window.dispatchEvent(new Event("resize")); });

// ---------------------------------------------------------------------------------------------------------------------
/** Eight `in_list_view` fields after the title (Desk would show all of them only from 1920 px). */
const DEAL = {
  name: "Deal", title_field: "title", sort_field: "modified", sort_order: "DESC",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data", in_list_view: 1 },
    ...["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => ({ fieldname: `f_${k}`, label: `F${k.toUpperCase()}`, fieldtype: "Data", in_list_view: 1 })),
    { fieldname: "notes", label: "Notes", fieldtype: "Small Text" },
  ],
} as unknown as DocMeta;
const F = ["FA", "FB", "FC", "FD", "FE", "FF", "FG", "FH"];

describe("width-based column limit (list_view.js:375-457) — SIMULATED (jsdom window width)", () => {
  const original = window.innerWidth;
  afterEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: original }); });

  it("deskColumnLimit: ≤1366 → 4, ≥1920 → 10, otherwise 6; no window (SSR) → 6", () => {
    expect([1024, 1366, 1367, 1600, 1919, 1920, 2560].map(deskColumnLimit)).toEqual([4, 4, 6, 6, 6, 10, 10]);
    expect(deskColumnLimit(undefined)).toBe(6);
  });

  it("counting: Subject + Desk's hidden Tag slot + fields; the ID column is appended after the cap and never counts", () => {
    const cols = ["title", "a", "b", "c", "name"].map((k) => ({ key: k, label: k, hidden: k === "name" })) as ColumnDef<unknown>[];
    const shown = (o: Partial<Parameters<typeof capDefaultColumns>[1]>) => capDefaultColumns(cols, { limit: 4, subjectKey: "title", hasIndicator: false, ...o }).filter((c) => !c.hidden).map((c) => c.key);
    expect(shown({})).toEqual(["title", "a", "b"]); // 4 slots = title, (tag), a, b
    expect(shown({ nameColumn: true })).toEqual(["title", "a", "b", "name"]);
    expect(shown({ hasIndicator: true })).toEqual(["title", "a"]); // the Status slot: no indicator / status column shown → an empty slot
    const withStatus = [cols[0], { key: "status", label: "Status" }, ...cols.slice(1)] as ColumnDef<unknown>[];
    expect(capDefaultColumns(withStatus, { limit: 4, subjectKey: "title", hasIndicator: true }).filter((c) => !c.hidden).map((c) => c.key)).toEqual(["title", "status", "a"]);
    // List View Settings `fields` without status_field: Desk drops Status (reorder_listview_fields) — no slot
    expect(shown({ hasIndicator: true, settingsFields: ["a", "b"] })).toEqual(["title", "a", "b"]);
    // activity columns (assignees / comments / likes) are not Desk columns: never counted, never hidden by the cap
    const act2 = [...cols, { key: "_assign", label: "A" }] as ColumnDef<unknown>[];
    expect(capDefaultColumns(act2, { limit: 3, subjectKey: "title", hasIndicator: false, uncounted: ["_assign"] }).filter((c) => !c.hidden).map((c) => c.key)).toEqual(["title", "a", "_assign"]);
  });

  for (const [width, visible] of [[1366, F.slice(0, 2)], [1600, F.slice(0, 4)], [1920, F.slice(0, 8)]] as const) {
    it(`at ${width} px the list shows Title + ${visible.length} fields + ID, and requests only those fields`, async () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
      const s = site(DEAL);
      mountHook(s.transport, { doctype: "Deal", columnLimit: true });
      await waitFor(() => expect(headers()).toEqual(["Title", ...visible, "ID"]));
      await waitFor(() => expect(s.last("frappe.desk.reportview.get")).toBeTruthy());
      const fields = JSON.parse(String(s.last("frappe.desk.reportview.get").args.fields)) as string[];
      expect(fields.filter((f) => f.startsWith("f_")).length).toBe(visible.length);
    });
  }

  it("List View Settings total_fields wins over the width (Subject + Tag + 1 at total_fields 3, even at 1920 px)", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1920 });
    mountHook(site(DEAL, { settings: { name: "Deal", total_fields: 3 } }).transport, { doctype: "Deal", columnLimit: true });
    await waitFor(() => expect(headers()).toEqual(["Title", "FA", "ID"]));
  });

  it("responsive: crossing 1366 / 1920 re-caps the default columns; a user's own column choice is kept", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1920 });
    const s = site(DEAL);
    mountHook(s.transport, { doctype: "Deal", columnLimit: true });
    await waitFor(() => expect(headers()).toEqual(["Title", ...F, "ID"]));
    setWidth(1300);
    await waitFor(() => expect(headers()).toEqual(["Title", "FA", "FB", "ID"]));
    setWidth(1500);
    await waitFor(() => expect(headers()).toEqual(["Title", "FA", "FB", "FC", "FD", "ID"]));
    setWidth(1510); // same band: nothing changes
    expect(headers()).toEqual(["Title", "FA", "FB", "FC", "FD", "ID"]);
  });

  it("the generic list follows a changed default only until the user picks columns (useListState)", () => {
    const mk = (hidden: string[]) => ["a", "b", "c"].map((k) => ({ key: k, label: k, hidden: hidden.includes(k) })) as ColumnDef<{ id: string }>[];
    const { result, rerender } = renderHook(({ columns }) => useListState({ rows: [], columns, rowKey: (r) => r.id, storage: null }), { initialProps: { columns: mk(["c"]) } });
    expect(result.current.visibleKeys).toEqual(["a", "b"]);
    rerender({ columns: mk(["b", "c"]) });
    expect(result.current.visibleKeys).toEqual(["a"]);
    rerender({ columns: mk(["b", "c"]) }); // equal columns rebuilt: no change
    expect(result.current.visibleKeys).toEqual(["a"]);
    act(() => result.current.setVisibleKeys(["c", "a"]));
    rerender({ columns: mk([]) });
    expect(result.current.visibleKeys).toEqual(["c", "a"]);
  });

  it("curated columns are never capped by width; without columnLimit nothing changes (opt-in); hideNameColumn drops the ID", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
    const curated: ColumnDef<Record<string, unknown>>[] = ["title", "f_a", "f_b", "f_c", "f_d", "f_e"].map((k) => ({ key: k, label: k.toUpperCase(), type: "text" }));
    mountHook(site(DEAL).transport, { doctype: "Deal", columnLimit: true, columns: curated });
    await waitFor(() => expect(headers().slice(0, 6)).toEqual(["TITLE", "F_A", "F_B", "F_C", "F_D", "F_E"]));
    cleanup();
    mountHook(site(DEAL).transport, { doctype: "Deal" });
    await waitFor(() => expect(headers()).toEqual(["Title", ...F]));
    cleanup();
    mountHook(site(DEAL).transport, { doctype: "Deal", columnLimit: true, hideNameColumn: true });
    await waitFor(() => expect(headers()).toEqual(["Title", "FA", "FB"]));
  });

  it("a DocType with an indicator spends Desk's Status slot: the status field column takes it (the indicator column is hidden by default)", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1366 });
    const SO = { ...DEAL, name: "Sales Order", is_submittable: 1, fields: [...(DEAL.fields as object[]).slice(0, 1), { fieldname: "status", label: "Status", fieldtype: "Select", options: "Draft\nTo Bill", in_list_view: 1 }, ...(DEAL.fields as object[]).slice(1)] } as unknown as DocMeta;
    mountHook(site(SO).transport, { doctype: "Sales Order", columnLimit: true });
    await waitFor(() => expect(headers()).toEqual(["Title", "Status", "FA", "ID"])); // Desk: Subject, (Tag), Status, FA + ID
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("URL filters (list_view.js:2130-2183 read, :1664-1696 write) — SIMULATED (jsdom location / history)", () => {
  const meta = buildFrappeListMeta(TASK, en);
  const ORDER = { name: "Order", title_field: "title", fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", in_list_view: 1 }, { fieldname: "status", label: "Status", fieldtype: "Select", options: "Open\nClosed" }, { fieldname: "items", label: "Items", fieldtype: "Table", options: "Order Item" }] } as unknown as DocMeta;
  const ITEM = { name: "Order Item", fields: [{ fieldname: "item_code", label: "Item Code", fieldtype: "Data" }, { fieldname: "qty", label: "Qty", fieldtype: "Float" }] } as DocMeta;
  const order = buildFrappeListMeta(ORDER, en, { "Order Item": ITEM });
  afterEach(() => { window.history.replaceState(null, "", "/"); });

  it("plain `field=value` is Equals; `[\"op\", value]` is JSON; a repeated key gives one filter per value", () => {
    const p = parseUrlFilters('?status=Open&modified=[">","2026-01-01"]&status=Working&project=["in",["P1","P2"]]&parent_task=["descendants of (inclusive)","TASK-1"]&subject=["like","%visa%"]', meta);
    expect(p.tuples).toEqual([
      ["Task", "status", "=", "Open"], ["Task", "modified", ">", "2026-01-01"], ["Task", "status", "=", "Working"],
      ["Task", "project", "in", ["P1", "P2"]], ["Task", "parent_task", "descendants of (inclusive)", "TASK-1"], ["Task", "subject", "like", "%visa%"],
    ]);
    expect(plain(p.query)).toEqual([
      { field: "status", operator: "equals", value: "Open" }, { field: "modified", operator: "gt", value: "2026-01-01" }, { field: "status", operator: "equals", value: "Working" },
      { field: "project", operator: "in", value: "P1,P2" }, { field: "parent_task", operator: "descendants_of_inclusive", value: "TASK-1" }, { field: "subject", operator: "like", value: "visa" },
    ]);
    expect(p.ignored).toEqual([]);
  });

  it("unknown fields are ignored and reported — never sent; injection-looking input stays a VALUE, never a fieldname", () => {
    const search = "?" + new URLSearchParams([
      ["bogus", "1"], ["name) or 1=1 --", "x"], ["tabUser.name", "Administrator"], ["__proto__", "x"], ["Other Child.qty", "1"],
      ["subject", "' OR 1=1 --"], ["status", JSON.stringify(["=", 'Open"); DROP TABLE `tabTask`; --'])],
      ["status", "[oops]"], ["status", '["!="]'], ["status", "[1,2]"], ["modified", '["previous","1 week"]'],
    ]).toString();
    const p = parseUrlFilters(search, meta);
    expect(p.ignored).toEqual(["bogus", "name) or 1=1 --", "tabUser.name", "__proto__", "Other Child.qty", "status", "status", "status", "modified"]);
    expect(p.tuples).toEqual([["Task", "subject", "=", "' OR 1=1 --"], ["Task", "status", "=", 'Open"); DROP TABLE `tabTask`; --']]);
    // the request carries them as values of known fields only
    expect(queryToFrappe(p.query, meta.known, meta.fieldtypes).filters).toEqual([["subject", "=", "' OR 1=1 --"], ["status", "=", 'Open"); DROP TABLE `tabTask`; --']]);
  });

  it("child tables: `Child.field`, or a bare child field resolved like get_doctype_for_field (meta.js:155-185)", () => {
    const p = parseUrlFilters({ "Order Item.qty": '[">", 5]', item_code: "X-1", status: ["!=", "Closed"] }, order); // a route_options object
    expect(p.tuples).toEqual([["Order Item", "qty", ">", 5], ["Order Item", "item_code", "=", "X-1"], ["Order", "status", "!=", "Closed"]]);
    expect(queryToFrappe(p.query, order.known, order.fieldtypes, { childOf: order.childOf }).filters).toEqual([["Order Item", "qty", ">", 5], ["Order Item", "item_code", "=", "X-1"], ["status", "!=", "Closed"]]);
    // route_options: an Array of JSON strings = several filters on one key (list_view.js:2142-2149)
    expect(parseUrlFilters({ status: ['["!=","Closed"]', '["!=","Open"]'] }, order).tuples).toEqual([["Order", "status", "!=", "Closed"], ["Order", "status", "!=", "Open"]]);
  });

  it("filtersToUrl writes Desk's format (`=` raw, else JSON [op, value]; `Child.field`), keeps other parameters, and round-trips", () => {
    const query = q([{ field: "status", operator: "equals", value: "Open" }, { field: "Order Item.qty", operator: "gte", value: "2" }, { field: "title", operator: "like", value: "a&b" }]);
    const url = filtersToUrl(query, order, "?tab=items&status=Closed");
    const params = new URLSearchParams(url.slice(1));
    expect([...params.entries()]).toEqual([["tab", "items"], ["status", "Open"], ["Order Item.qty", '[">=",2]'], ["title", '["like","%a&b%"]']]);
    expect(plain(parseUrlFilters(url, order).query)).toEqual(plain(query));
    // OR cannot be written (Desk's URL is AND-only): the filter parameters are removed, the others stay
    expect(filtersToUrl(q([{ field: "status", operator: "equals", value: "Open" }, { field: "title", operator: "equals", value: "x" }], "or"), order, "?tab=items&status=Closed")).toBe("?tab=items");
    expect(filtersToUrl(q([]), order, "?status=Open")).toBe("");
  });

  it("read at mount: the URL's filters reach rows and count; ignored keys are not sent; then the URL follows the list (replaceState)", async () => {
    window.history.replaceState(null, "", "/app/task?status=Open&bogus=1&subject=%27%20OR%201%3D1");
    const before = window.history.length;
    const s = site(TASK);
    mountHook(s.transport, { doctype: "Task", urlFilters: true });
    await waitFor(() => expect(s.last("frappe.desk.reportview.get")).toBeTruthy());
    expect(JSON.parse(String(s.last("frappe.desk.reportview.get").args.filters))).toEqual([["status", "=", "Open"], ["subject", "=", "' OR 1=1"]]);
    await waitFor(() => expect(s.last("frappe.desk.reportview.get_count")).toBeTruthy());
    expect(JSON.parse(String(s.last("frappe.desk.reportview.get_count").args.filters))).toEqual([["status", "=", "Open"], ["subject", "=", "' OR 1=1"]]);
    expect(JSON.stringify(s.calls.map((c) => c.args))).not.toContain("bogus");
    // the filter popover shows them; clearing them rewrites the URL without a new history entry, keeping `bogus`
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: en("clearAll") }));
    await waitFor(() => expect(window.location.search).toBe("?bogus=1"));
    expect(window.location.pathname).toBe("/app/task");
    expect(window.history.length).toBe(before);
    await waitFor(() => expect(JSON.parse(String(s.last("frappe.desk.reportview.get").args.filters))).toEqual([]));
  });

  it("write-back after a change; `{ read: false, write: true }` ignores the URL's filters and replaces them; off by default", async () => {
    window.history.replaceState(null, "", "/app/task?status=Open");
    const s = site(TASK);
    mountHook(s.transport, { doctype: "Task", urlFilters: { read: false, write: true } });
    await waitFor(() => expect(s.last("frappe.desk.reportview.get")).toBeTruthy());
    expect(JSON.parse(String(s.last("frappe.desk.reportview.get").args.filters))).toEqual([]);
    await waitFor(() => expect(window.location.search).toBe(""));
    cleanup();
    window.history.replaceState(null, "", "/app/task?status=Open");
    const s2 = site(TASK);
    mountHook(s2.transport, { doctype: "Task" });
    await waitFor(() => expect(s2.last("frappe.desk.reportview.get")).toBeTruthy());
    expect(JSON.parse(String(s2.last("frappe.desk.reportview.get").args.filters))).toEqual([]);
    await pause();
    expect(window.location.search).toBe("?status=Open"); // untouched
    cleanup();
    // read only: applied, URL never rewritten
    window.history.replaceState(null, "", "/app/task?status=Open&priority=x");
    const s3 = site(TASK);
    mountHook(s3.transport, { doctype: "Task", urlFilters: { read: true, write: false } });
    await waitFor(() => expect(JSON.parse(String(s3.last("frappe.desk.reportview.get")?.args.filters ?? "null"))).toEqual([["status", "=", "Open"]]));
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: en("clearAll") }));
    await waitFor(() => expect(JSON.parse(String(s3.last("frappe.desk.reportview.get").args.filters))).toEqual([]));
    expect(window.location.search).toBe("?status=Open&priority=x");
  });

  it("routeOptions (Desk's frappe.route_options) are read only when the query string is empty", async () => {
    window.history.replaceState(null, "", "/app/task");
    const s = site(TASK);
    mountHook(s.transport, { doctype: "Task", urlFilters: { read: true, write: false, routeOptions: { status: "Working" } } });
    await waitFor(() => expect(JSON.parse(String(s.last("frappe.desk.reportview.get")?.args.filters ?? "null"))).toEqual([["status", "=", "Working"]]));
  });

  it("initialQuery wins over a restored query (Desk: the route's filters replace the saved ones, list_view.js:559-571)", () => {
    const prefs = { persistQuery: true, load: () => ({ query: q([{ field: "status", operator: "equals", value: "Working" }]) }), save: () => {} };
    const cols = [{ key: "status", label: "Status", type: "text" }] as ColumnDef<{ id: string }>[];
    const restored = renderHook(() => useListState({ rows: [], columns: cols, rowKey: (r) => r.id, viewKey: "Task", storage: { prefs, saved: null } }));
    expect(plain(restored.result.current.query)).toEqual([{ field: "status", operator: "equals", value: "Working" }]);
    const fromUrl = renderHook(() => useListState({ rows: [], columns: cols, rowKey: (r) => r.id, viewKey: "Task", storage: { prefs, saved: null }, initialQuery: q([{ field: "status", operator: "equals", value: "Open" }]) }));
    expect(plain(fromUrl.result.current.query)).toEqual([{ field: "status", operator: "equals", value: "Open" }]);
  });
});

// shared helpers for the list-level sections below
const pause = (ms = 450) => act(() => new Promise((r) => setTimeout(r, ms)));
void pause; void FrappeListView;
