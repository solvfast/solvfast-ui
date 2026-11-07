/**
 * P35 list workstream — FrappeListView over the SIMULATED backend (`createFixtureTransport`). The assertions are about
 * request shapes and client gates read from the Frappe 15.110 source (citations inline); they are NOT evidence of
 * behaviour on a real site. Test names start with the List audit row (docs/audit/p35/B-list.md).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { createFrappeClient } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeListView, type FrappeListViewProps } from "../src/frappe/FrappeListView";
import { buildFrappeListMeta } from "../src/frappe/meta";
import { indicatorWorkflowFromMeta } from "../src/frappe/list/indicator";
import { operatorsFor } from "../src/list/model/filters";
import { createFixtureTransport, type FixtureOptions, type FixtureTransport } from "../src/frappe/testing";

// these tests drive whole lists through several server round trips: give them room on a loaded machine
vi.setConfig({ testTimeout: 20_000 });
beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const t = (k: string) => (defaultMessages.en as Record<string, string>)[k] ?? k;
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && !tr.hasAttribute("data-group-header") && tr.querySelectorAll("td").length > 1);
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

/** An authored DocType (title, status, a workflow state) with Desk-like DocPerms: System Manager may create, Reader reads. */
export const MEMO: DocTypeMeta = {
  name: "Memo", autoname: "format:MEMO-{###}", title_field: "title", sort_field: "modified", sort_order: "desc",
  permissions: [
    { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, export: 1, print: 1, report: 1 },
    { role: "Reader", permlevel: 0, read: 1 },
  ],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", in_list_view: 1 },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nClosed", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "due", fieldtype: "Date", label: "Due" },
    { fieldname: "reviewer", fieldtype: "Link", label: "Reviewer", options: "User" },
    { fieldname: "urgent", fieldtype: "Check", label: "Urgent" },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State" },
  ],
} as DocTypeMeta;
/** Workflow with Desk's indicator inputs: Workflow State styles, `override_status`, `avoid_status_override` (workflow.js:13-18). */
export const MEMO_WF = {
  name: "Memo Approval", document_type: "Memo", workflow_state_field: "workflow_state", override_status: 0,
  states: [
    { state: "Pending", doc_status: "0", allow_edit: "System Manager", style: "Warning" },
    { state: "Approved", doc_status: "0", allow_edit: "System Manager", style: "Success" },
    { state: "Parked", doc_status: "0", allow_edit: "System Manager", style: "Danger", avoid_status_override: 1 },
  ],
  transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager" }],
} as unknown as WorkflowInfo;
export const USERS: FrappeDoc[] = [
  { doctype: "User", name: "ann@x.com", email: "ann@x.com", full_name: "Ann Lee", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "bob@x.com", email: "bob@x.com", full_name: "Bob Ray", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "u@x.com", email: "u@x.com", full_name: "U Ser", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "Administrator", email: "admin@x.com", full_name: "Administrator", user_type: "System User", enabled: 1 },
] as FrappeDoc[];
const memo = (i: number, over: Record<string, unknown> = {}) => ({
  doctype: "Memo", name: `MEMO-00${i}`, title: `Memo ${i}`, status: i % 2 ? "Open" : "Closed", amount: i * 10,
  owner: i <= 2 ? "ann@x.com" : "bob@x.com", modified: `2026-11-0${i} 10:00:00.000000`, ...over,
});
export const MEMOS = [
  memo(1, { workflow_state: "Pending", _user_tags: ",urgent,vip" }),
  memo(2, { workflow_state: "Approved", _user_tags: ",urgent" }),
  memo(3, { workflow_state: "Parked", status: "Closed" }),
  memo(4),
];
/** Open ToDos drive `_assign` in the simulator: MEMO-001 → Ann + Bob, MEMO-002 → Ann. */
export const TODOS = [
  { doctype: "ToDo", name: "TD-1", status: "Open", allocated_to: "ann@x.com", reference_type: "Memo", reference_name: "MEMO-001", description: "a" },
  { doctype: "ToDo", name: "TD-2", status: "Open", allocated_to: "bob@x.com", reference_type: "Memo", reference_name: "MEMO-001", description: "b" },
  { doctype: "ToDo", name: "TD-3", status: "Open", allocated_to: "ann@x.com", reference_type: "Memo", reference_name: "MEMO-002", description: "c" },
];
const TODO_META: DocTypeMeta = {
  name: "ToDo", autoname: "hash", permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1 }],
  fields: [
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nClosed\nCancelled" },
    { fieldname: "allocated_to", fieldtype: "Link", label: "Allocated To", options: "User" },
    { fieldname: "description", fieldtype: "Text Editor", label: "Description" },
    { fieldname: "reference_type", fieldtype: "Link", label: "Reference Type", options: "DocType" },
    { fieldname: "reference_name", fieldtype: "Dynamic Link", label: "Reference Name", options: "reference_type" },
  ],
} as DocTypeMeta;

export function simBackend(over: { docs?: Record<string, unknown[]>; workflow?: boolean } = {}, options: FixtureOptions = {}): FixtureTransport {
  return createFixtureTransport({
    meta: { Memo: [MEMO], ToDo: [TODO_META] },
    docs: { Memo: MEMOS, ToDo: TODOS, User: USERS, ...(over.docs ?? {}) },
    ...(over.workflow === false ? {} : { workflows: { Memo: MEMO_WF } }),
    user: "u@x.com",
  } as never, options);
}

type Session = { user: string; fullName?: string; roles?: string[] } | undefined;
export function mountSim(transport: FixtureTransport, props: Partial<FrappeListViewProps<Record<string, unknown>>> = {}, session: Session = { user: "u@x.com", roles: ["System Manager"] }) {
  const downloads: { method: string; args: Record<string, unknown> }[] = [];
  const files = { ...transport.files, download: async (method: string, args: Record<string, unknown>) => { downloads.push({ method, args }); return transport.files.download(method, args); } };
  const client = createFrappeClient({ transport, files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={session}>
        <FrappeListView doctype="Memo" storage={null} like={false} columnLimit={false} {...props} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method: string) => transport.store.calls.filter((c) => c.method === method);
  const lastGet = () => { const c = calls("frappe.desk.reportview.get"); return c[c.length - 1]?.args as Record<string, unknown>; };
  return { view, qc, calls, lastGet, downloads };
}
const parsed = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

describe("LV.E3 workflow state in the row indicator, derived from the DocType", () => {
  it("LV.E3 indicatorWorkflowFromMeta maps getdoctype's __workflow_docs (state field, styles, override_status, avoid_status_override)", async () => {
    const transport = simBackend();
    const res = await transport("frappe.desk.form.load.getdoctype", { doctype: "Memo" });
    const wf = indicatorWorkflowFromMeta((res.docs as DocTypeMeta[])[0]);
    expect(wf).toEqual({ stateField: "workflow_state", styles: { Pending: "Warning", Approved: "Success", Parked: "Danger" }, overrideStatus: false, avoidStatusOverride: ["Parked"] });
    expect(indicatorWorkflowFromMeta(MEMO)).toBeUndefined(); // no __workflow_docs → no workflow
  });

  it("LV.E3 the pill shows the workflow state with its style colour; the state field is requested; avoid_status_override falls back to status (SIMULATED)", async () => {
    const { lastGet } = mountSim(simBackend(), { rowMeta: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(parsed(lastGet().fields)).toContain("workflow_state");
    const pills = bodyRows().map((r) => r.querySelector("[data-indicator]"));
    const byTitle = Object.fromEntries(bodyRows().map((r, i) => [r.textContent!.match(/Memo \d/)![0], pills[i]]));
    expect(byTitle["Memo 1"]!.textContent).toBe("Pending");
    expect(byTitle["Memo 1"]!.getAttribute("data-indicator")).toBe("orange"); // Warning → orange (indicator.js:51-58)
    expect(byTitle["Memo 2"]!.getAttribute("data-indicator")).toBe("green");
    expect(byTitle["Memo 3"]!.textContent).toBe("Closed"); // Parked avoids the override → the status indicator
  });

  it("LV.E3 negative control: workflow={false} drops the workflow state (Memo then has no indicator at all: no states, not submittable — indicator.js:3-24)", async () => {
    const { lastGet } = mountSim(simBackend(), { rowMeta: true, workflow: false });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(document.querySelector("[data-indicator]")).toBeNull();
    expect(parsed(lastGet().fields)).not.toContain("workflow_state");
  });
});

describe("LV.G1 / LV.G2 Add {DocType} and the empty-state create, gated by the create right", () => {
  const Dialog = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange(o: boolean): void; onCreated(doc: Record<string, unknown>): void }) =>
    open ? <div role="dialog" aria-label="New Memo"><button type="button" onClick={() => onCreated({ name: "MEMO-009" })}>Save memo</button><button type="button" onClick={() => onOpenChange(false)}>Close</button></div> : null;

  it("LV.G1 'Add Memo' for a System Manager; render() opens; onCreated reloads the list and closes (SIMULATED)", async () => {
    const { calls } = mountSim(simBackend(), { create: { render: (p) => <Dialog {...p} /> } });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    fireEvent.click(screen.getByRole("button", { name: "Add Memo" }));
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(within(screen.getByRole("dialog", { name: "New Memo" })).getByRole("button", { name: "Save memo" }));
    await waitFor(() => expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
    expect(screen.queryByRole("dialog", { name: "New Memo" })).toBeNull();
  });

  it("LV.G1 label and onCreate; an app primaryAction still wins", async () => {
    const onCreate = vi.fn();
    mountSim(simBackend(), { create: { label: "New memo", onCreate } });
    fireEvent.click(await screen.findByRole("button", { name: "New memo" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    cleanup();
    mountSim(simBackend(), { create: { onCreate }, primaryAction: <button type="button">Mine</button> });
    expect(await screen.findByRole("button", { name: "Mine" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-add")).toBeNull();
  });

  it("LV.G1 negative controls: a read-only role, unknown roles and create={false} see no Add button", async () => {
    for (const [session, props] of [
      [{ user: "r@x.com", roles: ["Reader"] }, { create: { onCreate: () => {} } }],
      [{ user: "r@x.com" }, { create: { onCreate: () => {} } }],
      [{ user: "u@x.com", roles: ["System Manager"] }, { create: false as const, onCreate: () => {} }],
    ] as const) {
      mountSim(simBackend(), props as never, session as Session);
      await waitFor(() => expect(bodyRows()).toHaveLength(4));
      expect(screen.queryByTestId("sf-list-add")).toBeNull();
      cleanup();
    }
  });

  it("LV.G2 the empty-state 'Create your first …' only with the create right", async () => {
    const empty = () => simBackend({ docs: { Memo: [] } });
    const onCreate = vi.fn();
    mountSim(empty(), { onCreate });
    fireEvent.click(await screen.findByRole("button", { name: en("listCreateFirst").replace("{doctype}", "Memo") }));
    expect(onCreate).toHaveBeenCalled();
    cleanup();
    mountSim(empty(), { onCreate }, { user: "r@x.com", roles: ["Reader"] });
    expect(await screen.findByText(en("listEmptyNone").replace("{doctype}", "Memo"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: en("listCreateFirst").replace("{doctype}", "Memo") })).toBeNull();
  });
});

describe("LV.D2 / LV.D3 / LV.D4 / LV.B13 / LV.B14 / LV.E7 Assigned To and Tags as first-class fields", () => {
  const groupBy = async (label: string) => {
    openMenu(screen.getByRole("button", { name: en("groupBy") }));
    fireEvent.click(await screen.findByRole("menuitem", { name: label }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  };
  const groups = () => [...document.querySelectorAll<HTMLElement>("tbody[data-group]")].map((g) => ({
    key: g.getAttribute("data-group"), label: g.querySelector("[data-group-header] button span")?.textContent,
    rows: [...g.querySelectorAll("tr:not([data-group-header])")].map((r) => r.textContent!.match(/Memo \d/)![0]),
  }));

  it("LV.D2 group by Assigned To: one group per user (full name), a row with two assignees in both; unassigned last (SIMULATED)", async () => {
    mountSim(simBackend(), { groupByFields: ["_assign", "_user_tags", "owner"], selectable: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    await groupBy(en("listAssigned"));
    await waitFor(() => expect(groups().map((g) => g.label)).toEqual(["Ann Lee", "Bob Ray", t("listNotSet")]));
    expect(groups()[0].rows.sort()).toEqual(["Memo 1", "Memo 2"]);
    expect(groups()[1].rows).toEqual(["Memo 1"]);
    // selection stays keyed by the row: checking Memo 1 in Ann's group checks it in Bob's too
    const memo1 = [...document.querySelectorAll<HTMLElement>("tbody[data-group] tr:not([data-group-header])")].filter((r) => r.textContent!.includes("Memo 1"));
    expect(memo1).toHaveLength(2);
    fireEvent.click(within(memo1[0]).getByRole("checkbox"));
    expect(memo1.map((r) => r.getAttribute("aria-selected"))).toEqual(["true", "true"]);
  });

  it("LV.D4 group by Tags: one group per tag, untagged rows under 'No Tags' (SIMULATED)", async () => {
    mountSim(simBackend(), { groupByFields: ["_user_tags"] });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    await groupBy(t("listTags"));
    await waitFor(() => expect(groups().map((g) => g.label)).toEqual(["urgent", "vip", t("listNoTags")]));
    expect(groups()[0].rows.sort()).toEqual(["Memo 1", "Memo 2"]);
    expect(groups()[2].rows.sort()).toEqual(["Memo 3", "Memo 4"]);
  });

  it("LV.D3 group by Created By is labelled with the users' full names (SIMULATED)", async () => {
    mountSim(simBackend(), { groupByFields: ["owner"] });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    await groupBy(en("listOwner"));
    await waitFor(() => expect(groups().map((g) => g.label)).toEqual(["Ann Lee", "Bob Ray"]));
  });

  it("LV.B13 / LV.B14 Assigned To and Tags are filter fields offering like / not like / is; a condition is sent as `like %v%` (SIMULATED)", async () => {
    const meta = buildFrappeListMeta(MEMO, (k) => t(k));
    const assign = meta.filterFields.find((f) => f.name === "_assign")!;
    const tags = meta.filterFields.find((f) => f.name === "_user_tags")!;
    expect(assign).toMatchObject({ label: en("listAssigned"), type: "link", link_doctype: "User" });
    expect(tags).toMatchObject({ label: t("listTags"), type: "link", link_doctype: "Tag" });
    expect(operatorsFor(assign)).toEqual(["like", "not_like", "is_set"]);
    expect(meta.columns.some((c) => c.key === "_assign" || c.key === "_user_tags")).toBe(false); // no duplicate generated columns
    const { lastGet } = mountSim(simBackend(), {
      initialQuery: { conjunction: "and", conditions: [{ id: "a", field: "_assign", operator: "like", value: "bob@x.com" }, { id: "b", field: "_user_tags", operator: "like", value: "vip" }] },
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(parsed(lastGet().filters)).toEqual([["_assign", "like", "%bob@x.com%"], ["_user_tags", "like", "%vip%"]]);
  });

  it("LV.E7 the Tags cell shows the row's tags; clicking one filters by it (SIMULATED)", async () => {
    const { lastGet } = mountSim(simBackend(), { rowMeta: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    const row1 = bodyRows().find((r) => r.textContent!.includes("Memo 1"))!;
    const cell = row1.querySelector("[data-tags]")!;
    expect([...cell.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["urgent", "vip"]);
    fireEvent.click(within(cell as HTMLElement).getByRole("button", { name: "vip" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(parsed(lastGet().filters)).toEqual([["_user_tags", "like", "%vip%"]]);
  });
});


describe("LV.D6 / LV.D7 / LV.D11 / LV.J8 group-by sidebar with server counts, tag stats, Toggle Sidebar", () => {
  const nav = () => screen.getByRole("navigation", { name: t("listSidebar") });
  const section = (label: string) => within(nav()).getByRole("heading", { name: label }).closest("section") as HTMLElement;
  const items = (label: string) => within(section(label)).queryAllByRole("button").map((b) => b.textContent);

  it("LV.D6 Assigned To + Created By counts from get_group_by_count (current filters, own field removed); clicking filters, clicking again removes (SIMULATED)", async () => {
    const transport = simBackend();
    const { calls, lastGet } = mountSim(transport, { sidebar: true }, { user: "u@x.com", roles: ["System Manager"] });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    await waitFor(() => expect(items(en("listAssigned"))).toEqual(["Ann Lee2", "Bob Ray1"]));
    expect(items(en("listOwner"))).toEqual(["Ann Lee2", "Bob Ray2"]);
    const gbc = calls("frappe.desk.listview.get_group_by_count").map((c) => c.args);
    expect(gbc).toEqual(expect.arrayContaining([
      { doctype: "Memo", current_filters: "[]", field: "assigned_to" }, { doctype: "Memo", current_filters: "[]", field: "owner" },
    ]));
    fireEvent.click(within(section(en("listAssigned"))).getByRole("button", { name: /Bob Ray/ }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(parsed(lastGet().filters)).toEqual([["_assign", "like", "%bob@x.com%"]]);
    await waitFor(() => expect(within(section(en("listAssigned"))).getByRole("button", { name: /Bob Ray/ }).getAttribute("aria-pressed")).toBe("true"));
    // the owner counts follow the filter; the Assigned To counts keep ignoring their own condition (list_sidebar_group_by.js:163-169)
    await waitFor(() => expect(items(en("listOwner"))).toEqual(["Ann Lee1"]));
    const last = calls("frappe.desk.listview.get_group_by_count").map((c) => c.args);
    expect(last).toContainEqual({ doctype: "Memo", current_filters: JSON.stringify([["_assign", "like", "%bob@x.com%"]]), field: "owner" });
    expect(last.filter((a) => a.field === "assigned_to").every((a) => a.current_filters === "[]")).toBe(true);
    fireEvent.click(within(section(en("listAssigned"))).getByRole("button", { name: /Bob Ray/ }));
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(parsed(lastGet().filters)).toEqual([]);
  });

  it("LV.D6 the session user is listed first as 'Me'; Administrator / Guest are dropped (list_sidebar_group_by.js:177-188) (SIMULATED)", async () => {
    const transport = simBackend({ docs: { Memo: [...MEMOS, memo(5, { owner: "u@x.com" }), memo(6, { owner: "Administrator" })] } });
    mountSim(transport, { sidebar: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(6));
    await waitFor(() => expect(items(en("listOwner"))[0]).toBe(`${t("listMe")}1`));
    expect(items(en("listOwner")).join()).not.toContain("Administrator");
  });

  it("LV.D7 tag stats from get_sidebar_stats; a tag filters `like`, 'No Tags' filters `not like %,%` (list_sidebar.js:236-247) (SIMULATED)", async () => {
    const transport = simBackend();
    const { calls, lastGet } = mountSim(transport, { sidebar: true });
    await waitFor(() => expect(items(t("listTags"))).toEqual(["urgent2", "vip1", `${t("listNoTags")}2`]));
    expect(calls("frappe.desk.reportview.get_sidebar_stats")[0].args).toEqual({ stats: '["_user_tags"]', doctype: "Memo", filters: "[]" });
    fireEvent.click(within(section(t("listTags"))).getByRole("button", { name: new RegExp(t("listNoTags")) }));
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(parsed(lastGet().filters)).toEqual([["_user_tags", "not like", "%,%"]]);
  });

  it("LV.D11 user_settings.group_by_fields add sections (list_sidebar_group_by.js:9-12); disable_sidebar_stats drops the tags (SIMULATED)", async () => {
    const transport = simBackend({}, { listSettings: { Memo: { name: "Memo", disable_sidebar_stats: 1 } } });
    transport.store.userSettings.Memo = JSON.stringify({ group_by_fields: ["status"] });
    const { calls } = mountSim(transport, { sidebar: true });
    await waitFor(() => expect(items("Status")).toEqual(["Closed3", "Open1"]));
    expect(within(nav()).queryByRole("heading", { name: t("listTags") })).toBeNull();
    expect(calls("frappe.desk.reportview.get_sidebar_stats")).toHaveLength(0);
  });

  it("LV.J8 'Toggle Sidebar' in the list menu hides and shows it; negative: no sidebar prop → no sidebar, no counts requested", async () => {
    mountSim(simBackend(), { sidebar: true });
    await waitFor(() => expect(nav()).toBeTruthy());
    openMenu(screen.getByTestId("sf-list-menu"));
    fireEvent.click(await screen.findByRole("menuitem", { name: t("listToggleSidebar") }));
    await waitFor(() => expect(screen.queryByRole("navigation", { name: t("listSidebar") })).toBeNull());
    cleanup();
    const transport = simBackend();
    const { calls } = mountSim(transport, {});
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(screen.queryByRole("navigation", { name: t("listSidebar") })).toBeNull();
    expect(calls("frappe.desk.listview.get_group_by_count")).toHaveLength(0);
  });
});

describe("G5 'Select all matching' on FrappeListView (header mode): only the query-based Export runs", () => {
  it("G5 Export posts by_filter with the list's FILTERS (not names) for all matching records; name-based actions are disabled (SIMULATED)", async () => {
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    const { downloads } = mountSim(simBackend(), {
      selectionMode: "header", bulk: {}, selectAllMatching: true, pageSize: 2, pageSizes: [],
      initialQuery: { conjunction: "and", conditions: [{ id: "s", field: "status", operator: "equals", value: "Closed" }] },
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    fireEvent.click(within(document.querySelector("thead")!).getByRole("checkbox", { name: en("selectAll") }));
    fireEvent.click(await screen.findByRole("button", { name: t("listSelectAllMatching").replace("{n}", "3") }));
    openMenu(await screen.findByTestId("sf-list-actions"));
    const del = await screen.findByRole("menuitem", { name: /Print/ }); // Memo has a workflow: no Edit / Delete (list_view.js:1881-1886)
    expect(del.getAttribute("data-disabled")).not.toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /^\s*Export\s*$/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Select All" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].args.export_records).toBe("by_filter");
    expect(JSON.parse(String(downloads[0].args.export_filters))).toEqual([["status", "=", "Closed"]]);
  });
});

describe("LV.I4 page size on FrappeListView", () => {
  it("LV.I4 Desk's 20 / 100 / 500 / 2500 by default; a choice changes page_length and is saved in user_settings List.sf_ui.pageSize (SIMULATED)", async () => {
    const transport = simBackend();
    const { lastGet, calls } = mountSim(transport, { storage: undefined, serverStorage: { user: "u@x.com" } });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(lastGet().page_length).toBe(20);
    const group = screen.getByRole("group", { name: t("listPageSize") });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["20", "100", "500", "2,500"]);
    fireEvent.click(within(group).getByRole("button", { name: "500" }));
    await waitFor(() => expect(lastGet().page_length).toBe(500));
    await waitFor(() => expect(calls("frappe.model.utils.user_settings.save").length).toBeGreaterThan(0), { timeout: 3000 });
    const saved = JSON.parse(String(calls("frappe.model.utils.user_settings.save").at(-1)!.args.user_settings));
    expect(saved.List.sf_ui.pageSize).toBe(500);
  });
});

describe("LV.C9 saved filters on the server: per-save Is Global (System Manager only)", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: en("saved") }));
  const pop = () => screen.getByRole("dialog");
  const QUERY = { conjunction: "and" as const, conditions: [{ id: "s", field: "status", operator: "equals" as const, value: "Open" }] };

  it("LV.C9 a System Manager's global save inserts List Filter with for_user '' and it is listed as Global; a personal one keeps for_user (SIMULATED)", async () => {
    const transport = simBackend();
    const { calls } = mountSim(transport, { storage: undefined, serverStorage: { user: "u@x.com", userSettings: false }, initialQuery: QUERY });
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    open();
    fireEvent.change(within(pop()).getByPlaceholderText(en("saveCurrentAs")), { target: { value: "Everyone" } });
    fireEvent.click(within(pop()).getByRole("checkbox", { name: t("listSavedIsGlobal") }));
    fireEvent.click(within(pop()).getByRole("button", { name: en("saveCurrentAs") }));
    await waitFor(() => expect(within(pop()).getByRole("button", { name: "Everyone" })).toBeTruthy());
    fireEvent.change(within(pop()).getByPlaceholderText(en("saveCurrentAs")), { target: { value: "Mine" } });
    fireEvent.click(within(pop()).getByRole("button", { name: en("saveCurrentAs") }));
    await waitFor(() => expect(within(pop()).getByRole("button", { name: "Mine" })).toBeTruthy());
    const docs = calls("frappe.client.insert").map((c) => JSON.parse(String(c.args.doc)));
    expect(docs.map((d) => [d.filter_name, d.for_user])).toEqual([["Everyone", ""], ["Mine", "u@x.com"]]);
    expect((JSON.parse(docs[0].filters) as unknown[][])[0].slice(0, 4)).toEqual(["Memo", "status", "=", "Open"]); // Desk's filter tuples
    const globals = [...pop().querySelectorAll("[data-saved-filter]")].filter((r) => r.querySelector("[data-global]")).map((r) => r.textContent);
    expect(globals).toHaveLength(1);
    expect(globals[0]).toContain("Everyone");
  });

  it("LV.C9 negative control: a Reader (no System Manager) is not offered Is Global (list_filter.js:6)", async () => {
    mountSim(simBackend(), { storage: undefined, serverStorage: { user: "r@x.com", userSettings: false }, initialQuery: QUERY }, { user: "r@x.com", roles: ["Reader"] });
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    open();
    fireEvent.change(within(pop()).getByPlaceholderText(en("saveCurrentAs")), { target: { value: "Mine" } });
    expect(within(pop()).queryByRole("checkbox", { name: t("listSavedIsGlobal") })).toBeNull();
  });
});

describe("LV.J4 / LV.J5 / LV.J6 / LV.J7 / LV.J11 list menu: Desk's System-Manager entries and List Settings", () => {
  const menuItems = async () => { openMenu(await screen.findByTestId("sf-list-menu")); return (await screen.findAllByRole("menuitem")).map((m) => m.textContent!.trim()); };

  it("LV.J4 / LV.J5 / LV.J6 / LV.J11 a System Manager gets User Permissions, Role Permissions Manager, Customize, List Settings; each navigates to Desk's route", async () => {
    const onNavigate = vi.fn();
    mountSim(simBackend(), { onNavigate });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    const items = await menuItems();
    expect(items).toEqual(expect.arrayContaining([t("listMenuUserPermissions"), t("listMenuRolePermissions"), t("listMenuCustomize"), t("listMenuListSettings")]));
    for (const [label, url, entry] of [
      [t("listMenuUserPermissions"), "/app/user-permission?allow=Memo", "userPermissions"],
      [t("listMenuRolePermissions"), "/app/permission-manager?doctype=Memo", "rolePermissions"],
      [t("listMenuCustomize"), "/app/customize-form?doc_type=Memo", "customize"],
    ] as const) {
      if (!screen.queryByRole("menu")) openMenu(screen.getByTestId("sf-list-menu"));
      fireEvent.click(await screen.findByRole("menuitem", { name: label }));
      expect(onNavigate).toHaveBeenLastCalledWith(url, entry);
    }
  });

  it("LV.J6 Customize on a custom DocType opens the DocType form (list_view.js:1745-1747); Import goes through onNavigate too", async () => {
    const onNavigate = vi.fn();
    const transport = createFixtureTransport({ meta: { Memo: [{ ...MEMO, custom: 1, allow_import: 1 } as DocTypeMeta] }, docs: { Memo: MEMOS, User: USERS }, user: "u@x.com" } as never);
    mountSim(transport, { onNavigate });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    openMenu(await screen.findByTestId("sf-list-menu"));
    fireEvent.click(await screen.findByRole("menuitem", { name: t("listMenuCustomize") }));
    expect(onNavigate).toHaveBeenLastCalledWith("/app/doctype/Memo", "customize");
    openMenu(screen.getByTestId("sf-list-menu"));
    fireEvent.click(await screen.findByRole("menuitem", { name: en("listMenuImport") }));
    expect(onNavigate).toHaveBeenLastCalledWith("/app/data-import?reference_doctype=Memo", "import");
  });

  it("LV.J4 negative controls: a Reader, unknown roles, and menu={{ userPermissions: false }} do not get those entries", async () => {
    for (const [session, props] of [
      [{ user: "r@x.com", roles: ["Reader"] }, {}],
      [{ user: "r@x.com" }, {}],
      [{ user: "u@x.com", roles: ["System Manager"] }, { menu: { userPermissions: false } }],
    ] as const) {
      mountSim(simBackend(), props as never, session as Session);
      await waitFor(() => expect(bodyRows()).toHaveLength(4));
      const items = await menuItems();
      expect(items).not.toContain(t("listMenuUserPermissions"));
      if (!("menu" in props)) expect(items).not.toContain(t("listMenuListSettings"));
      else expect(items).toContain(t("listMenuRolePermissions"));
      cleanup();
    }
  });

  it("LV.J7 List Settings: remove / add fields and a check → save_listview_settings with Desk's arguments; the list uses the saved row (SIMULATED)", async () => {
    const transport = simBackend();
    const { calls, lastGet } = mountSim(transport, {});
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    openMenu(await screen.findByTestId("sf-list-menu"));
    fireEvent.click(await screen.findByRole("menuitem", { name: t("listMenuListSettings") }));
    const dialog = await screen.findByRole("dialog", { name: t("listSettingsTitle").replace("{doctype}", "Memo") });
    const listed = () => [...dialog.querySelectorAll("[data-list-settings-fields] li")].map((li) => li.getAttribute("data-fieldname"));
    expect(listed()).toEqual(["title", "status_field", "status"]); // subject, Status (workflow → indicator), in_list_view fields
    fireEvent.click(within(dialog).getByRole("button", { name: t("listSettingsRemoveField").replace("{field}", "Status") })); // the DocType's own Status field
    expect(listed()).toEqual(["title", "status_field"]);
    openMenu(within(dialog).getByRole("combobox", { name: t("listSettingsAddField") }));
    fireEvent.click(await screen.findByRole("option", { name: "Amount" }));
    expect(listed()).toEqual(["title", "status_field", "amount"]);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: t("listSettingsDisableCount") }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("listSettingsSave") }));
    await waitFor(() => expect(calls("frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings")).toHaveLength(1));
    const args = calls("frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings")[0].args;
    expect(args.doctype).toBe("Memo");
    expect(JSON.parse(String(args.removed_listview_fields))).toEqual(["status"]);
    const values = JSON.parse(String(args.listview_settings));
    expect(values).toMatchObject({ disable_count: 1, disable_comment_count: 0, total_fields: "4" });
    expect(JSON.parse(values.fields).map((f: { fieldname: string }) => f.fieldname)).toEqual(["title", "status_field", "amount"]);
    // SIMULATED server effect: in_list_view flipped on the stored meta (Property Setters, list_view_settings.py:49-85)
    expect(transport.store.meta.Memo[0].fields.find((f) => f.fieldname === "amount")!.in_list_view).toBe(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(parsed(lastGet().fields)).toContain("amount"));
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent!.trim())).toEqual(["Title", "Status", "Amount"]);
  });
});

describe("LV.F1 Bulk Edit: the chosen field's own value control (bulk_operations.js:381-404)", () => {
  const editDialog = async () => {
    for (const i of [1, 2]) fireEvent.click(screen.getAllByRole("checkbox")[i]);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkEdit") }));
    return screen.findByRole("dialog");
  };
  const pickField = async (dialog: HTMLElement, label: string) => {
    openMenu(within(dialog).getByRole("combobox", { name: en("listBulkField") }));
    fireEvent.click(await screen.findByRole("option", { name: label }));
  };
  const update = (calls: (m: string) => { args: Record<string, unknown> }[]) => calls("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs").at(-1)!.args;

  it("LV.F1 a Link field gets a link search over its target; Apply sends the picked name (SIMULATED)", async () => {
    const { calls } = mountSim(simBackend({ workflow: false }), { bulk: { allowEdit: true } });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    const dialog = await editDialog();
    await pickField(dialog, "Reviewer");
    await new Promise((r) => setTimeout(r, 50)); // the field Select hands the focus back first
    const box = within(dialog).getByRole("combobox", { name: en("listBulkValue") });
    act(() => box.focus());
    fireEvent.change(box, { target: { value: "Bob" } });
    await waitFor(() => expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("Bob Ray")]), { timeout: 3000 });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(calls("frappe.desk.search.search_link").some((c) => c.args.doctype === "User")).toBe(true));
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkApply") }));
    await waitFor(() => expect(update(calls).action).toBe("update"));
    expect(parsed(update(calls).data)).toEqual({ reviewer: "bob@x.com" });
  });

  it("LV.F1 a number field gets a number input and sends a number; an empty value says so and sends null (SIMULATED)", async () => {
    const { calls } = mountSim(simBackend({ workflow: false }), { bulk: { allowEdit: true } });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    let dialog = await editDialog();
    await pickField(dialog, "Amount");
    const amount = within(dialog).getByLabelText(en("listBulkValue"));
    expect(amount.getAttribute("inputmode")).toBe("decimal");
    fireEvent.change(amount, { target: { value: "42" } });
    fireEvent.blur(amount);
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkApply") }));
    await waitFor(() => expect(calls("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs").length).toBe(1));
    expect(parsed(update(calls).data)).toEqual({ amount: 42 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("button", { name: en("listBulkEdit") })).toBeNull()); // the run cleared the selection
    dialog = await editDialog();
    await pickField(dialog, "Title");
    expect(within(dialog).getByText(t("listBulkEditEmpty"))).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkApply") }));
    await waitFor(() => expect(parsed(update(calls).data)).toEqual({ title: null }));
  });
});

// ---- B gap 11: test-only gaps ------------------------------------------------------------------------------------------
const ORDER: DocTypeMeta = {
  name: "Order", is_submittable: 1, autoname: "format:ORD-{###}", title_field: "title",
  permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1, delete: 1 }],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", in_list_view: 1 },
    // a Custom Field as getdoctype merges it into meta.fields (is_custom_field: 1)
    { fieldname: "region", fieldtype: "Select", label: "Region", options: "North\nSouth", in_list_view: 1, in_standard_filter: 1, is_custom_field: 1 },
  ],
} as DocTypeMeta;
const orders = () => createFixtureTransport({
  meta: { Order: [ORDER] },
  docs: { Order: [
    { name: "ORD-001", title: "First", region: "North", docstatus: 0, modified: "2026-11-03 10:00:00.000000" },
    { name: "ORD-002", title: "Second", region: "South", docstatus: 0, modified: "2026-11-02 10:00:00.000000" },
    { name: "ORD-003", title: "Third", region: "North", docstatus: 1, modified: "2026-11-01 10:00:00.000000" },
  ], User: USERS },
  user: "u@x.com",
} as never);

describe("LV.F8 / LV.F9 / LV.A9 test-only gaps (B gap 11)", () => {
  const rowBox = (title: string) => within(bodyRows().find((r) => r.textContent!.includes(title))!).getByRole("checkbox");
  const bulkCalls = (calls: (m: string) => { args: Record<string, unknown> }[]) => calls("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs").map((c) => c.args);

  it("LV.F8 Submit: click → Desk's confirmation → submit_cancel_or_update_docs(action: submit) for exactly the checked drafts (SIMULATED)", async () => {
    const transport = orders();
    const { calls } = mountSim(transport, { doctype: "Order", bulk: {} });
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    fireEvent.click(rowBox("First")); fireEvent.click(rowBox("Second"));
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkSubmit") }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain(en("listBulkSubmitConfirm").replace("{n}", "2"));
    fireEvent.click(within(confirm).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(bulkCalls(calls)).toHaveLength(1));
    expect(bulkCalls(calls)[0]).toMatchObject({ doctype: "Order", action: "submit" });
    expect(parsed(bulkCalls(calls)[0].docnames)).toEqual(["ORD-001", "ORD-002"]);
    expect(transport.store.docs.get("Order")!.get("ORD-001")!.docstatus).toBe(1);
  });

  it("LV.F9 Cancel: click → confirmation → submit_cancel_or_update_docs(action: cancel); Cancel in the dialog sends nothing (SIMULATED)", async () => {
    const transport = orders();
    mountSim(transport, { doctype: "Order", bulk: {} });
    const sent = () => transport.store.calls.filter((c) => c.method === "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs").map((c) => c.args);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    fireEvent.click(rowBox("Third"));
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkCancel") }));
    let confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain(en("listBulkCancelConfirm").replace("{n}", "1"));
    fireEvent.click(within(confirm).getByRole("button", { name: en("cancel") }));
    expect(sent()).toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkCancel") }));
    confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]).toMatchObject({ doctype: "Order", action: "cancel" });
    expect(parsed(sent()[0].docnames)).toEqual(["ORD-003"]);
    expect(transport.store.docs.get("Order")!.get("ORD-003")!.docstatus).toBe(2);
  });

  it("LV.A9 a custom field (is_custom_field: 1) is a column, a quick filter and a filter the request sends (SIMULATED)", async () => {
    const transport = orders();
    mountSim(transport, { doctype: "Order" });
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent!.trim())).toContain("Region");
    const quick = screen.getByRole("combobox", { name: "Region" });
    openMenu(quick);
    fireEvent.click(await screen.findByRole("option", { name: "South" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    const gets = transport.store.calls.filter((c) => c.method === "frappe.desk.reportview.get");
    expect(parsed(gets.at(-1)!.args.filters)).toEqual([["region", "=", "South"]]);
    expect(parsed(gets.at(-1)!.args.fields)).toContain("region");
  });
});
