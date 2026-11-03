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
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FilterBuilder, ThemeProvider, applyFilterQuery, operatorsFor, type FilterField, type FilterQuery } from "../src";
import { FrappeListView, FrappeProvider, buildFrappeListMeta, createFrappeClient, queryToFrappe, type DocMeta, type FrappeTransport } from "../src/frappe";
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

// shared helpers for the list-level sections below
export function mountList(transport: FrappeTransport, props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, doctype = "Task") {
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client}><FrappeListView doctype={doctype} storage={null} {...props} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}
export const pause = (ms = 450) => act(() => new Promise((r) => setTimeout(r, ms)));
void waitFor;
