/**
 * P35 list workstream — FrappeListView over the SIMULATED backend (`createFixtureTransport`). The assertions are about
 * request shapes and client gates read from the Frappe 15.110 source (citations inline); they are NOT evidence of
 * behaviour on a real site. Test names start with the List audit row (docs/audit/p35/B-list.md).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
