/**
 * Foundation — createFixtureTransport against the REAL call sites of the merged list (src/frappe/list/**, A2) and record
 * (src/frappe/record/**, A4) layers. SIMULATED backend: this pins that every request those layers send gets an answer
 * in Frappe's response shape — it is not evidence of Frappe behaviour. Metas: real 15.110 captures (ToDo, Contact,
 * User) plus authored ones (a submittable "CRM Deal" with a space in its name, a workflow, change tracking).
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import userEn from "./fixtures/real-15.110/user.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { createFrappeClient } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeListView } from "../src/frappe/FrappeListView";
import { buildFrappeListMeta } from "../src/frappe/meta";
import { createFixtureTransport } from "../src/frappe/testing";
import { reportviewCount, reportviewGet } from "../src/frappe/list/reportview";
import { fetchListSettings } from "../src/frappe/list/settings";
import { bulkAssign, bulkDelete, bulkSubmitCancelOrUpdate } from "../src/frappe/list/bulk";
import { createFrappeSavedFilters, createFrappeUserSettings } from "../src/frappe/list/storage";
import { loadDocTypeBundle } from "../src/frappe/useFrappeList";
import { buildTimelineItems } from "../src/frappe/record/timeline";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const DEAL: DocTypeMeta = {
  name: "CRM Deal", is_submittable: 1, track_changes: 1, autoname: "format:CRM-DEAL-{#####}", title_field: "title", sort_field: "modified", sort_order: "desc",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1, in_list_view: 1 },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nWon\nLost", in_list_view: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "approved_by", fieldtype: "Data", label: "Approved By" },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State" },
  ],
};
const WF: WorkflowInfo = {
  name: "Deal Approval", document_type: "CRM Deal", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "Sales User" },
    { state: "Approved", doc_status: "0", allow_edit: "Sales Manager", update_field: "approved_by", update_value: "Manager" },
  ],
  transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 1 }],
};
const USERS: FrappeDoc[] = [
  { doctype: "User", name: "ann@x.com", email: "ann@x.com", full_name: "Ann", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "bob@x.com", email: "bob@x.com", full_name: "Bob", user_type: "System User", enabled: 0 },
  { doctype: "User", name: "web@x.com", email: "web@x.com", full_name: "Web", user_type: "Website User", enabled: 1 },
];

function setup(withUsers = true) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), Contact: docsOf(contactEn), "CRM Deal": [DEAL], ...(withUsers ? { User: docsOf(userEn) } : {}) },
    docs: {
      ToDo: [1, 2, 3, 4, 5].map((i) => ({ doctype: "ToDo", name: `TD-${i}`, description: `Task ${i}`, status: i % 2 ? "Open" : "Closed", priority: "Medium", modified: `2026-11-0${i} 10:00:00.000000` })),
      Contact: [
        { doctype: "Contact", name: "C-1", first_name: "Ann", email_ids: [{ doctype: "Contact Email", name: "CE-1", email_id: "ann@x.com", is_primary: 1 }], modified: "2026-11-01 10:00:00.000000" },
        { doctype: "Contact", name: "C-2", first_name: "Bob", email_ids: [{ doctype: "Contact Email", name: "CE-2", email_id: "bob@x.com", is_primary: 1 }], modified: "2026-11-02 10:00:00.000000" },
      ],
      "CRM Deal": [
        { doctype: "CRM Deal", name: "D-1", title: "Alpha", status: "Open", workflow_state: "Draft", modified: "2026-11-01 10:00:00.000000" },
        { doctype: "CRM Deal", name: "D-2", title: "Beta", status: "Open", workflow_state: "Draft", modified: "2026-11-01 10:00:00.000000" },
      ],
      ...(withUsers ? { User: USERS } : {}),
    },
    workflows: { "CRM Deal": WF },
    user: "Administrator",
  }, { roles: ["Sales Manager", "Sales User"], listSettings: { "CRM Deal": { name: "CRM Deal", total_fields: 4, fields: '[{"fieldname":"status"}]' } } });
  return { transport, client: createFrappeClient({ transport, session: { user: "Administrator", fullName: "Administrator" } }) };
}

describe("list call sites (A2)", () => {
  it("getdoctype + user_settings round trip (loadDocTypeBundle, createFrappeUserSettings)", async () => {
    const { client } = setup();
    const first = await loadDocTypeBundle(client, "Contact");
    expect(Object.keys(first.children)).toContain("Contact Email");
    expect(first.userSettings).toEqual({});
    const prefs = createFrappeUserSettings(client, { doctype: "Contact", initial: first.userSettings, meta: undefined, delayMs: 0 });
    prefs.save?.("Contact", { visible: ["first_name"] } as never);
    await prefs.flush();
    expect((await loadDocTypeBundle(client, "Contact")).userSettings).toHaveProperty("List");
  });

  it("reportview.get: tie-break order on a DocType with a space, paging, comment count; get_count limit", async () => {
    const { client } = setup();
    await client.addComment("CRM Deal", "D-1", "<p>first</p>");
    // equal `modified` (comments do not bump it): the `name desc` tie-break decides; DocType name with a space
    const page = await reportviewGet(client, "CRM Deal", { fields: ["name", "title", "_comments"], order_by: "`tabCRM Deal`.`modified` desc, `tabCRM Deal`.`name` desc", limit_start: 0, limit_page_length: 20 });
    expect(page.rows.map((r) => r.name)).toEqual(["D-2", "D-1"]);
    const tie = await reportviewGet(client, "ToDo", { fields: ["name"], order_by: "priority asc, name desc", limit_start: 1, limit_page_length: 2 });
    expect(tie.rows.map((r) => r.name)).toEqual(["TD-4", "TD-3"]);
    expect(page.rows.map((r) => r._comment_count)).toEqual([0, 1]);
    expect(await reportviewCount(client, "ToDo", { limit: 3 })).toEqual({ count: 3, capped: true });
  });

  it("child-table join: quoted fields, group_by parent name, distinct count", async () => {
    const { client } = setup();
    const res = await reportviewGet(client, "Contact", {
      fields: ["`tabContact`.`name`", "`tabContact`.`first_name`"], filters: [["Contact Email", "email_id", "like", "%ann%"]],
      order_by: "`tabContact`.`modified` desc, `tabContact`.`name` desc", group_by: "`tabContact`.`name`", limit_start: 0, limit_page_length: 20,
    });
    expect(res.rows).toEqual([expect.objectContaining({ name: "C-1", first_name: "Ann" })]);
    expect(await reportviewCount(client, "Contact", { filters: [["Contact Email", "email_id", "like", "%x.com%"]], distinct: true })).toEqual({ count: 2, capped: false });
  });

  it("get_list_settings (configured or null), saved filters (List Filter get_list / insert / delete)", async () => {
    const { client } = setup();
    expect(await fetchListSettings(client, "CRM Deal")).toMatchObject({ total_fields: 4 });
    expect(await fetchListSettings(client, "ToDo")).toBeNull();
    const meta = buildFrappeListMeta(docsOf(todoEn)[0], (k) => defaultMessages.en[k]);
    const storage = createFrappeSavedFilters(client, { user: "Administrator", meta });
    const saved = await storage.save("ToDo", "Open ones", { conjunction: "and", conditions: [{ field: "status", operator: "equals", value: "Open" }] } as never);
    expect(saved.map((f) => f.label)).toEqual(["Open ones"]);
    expect(await storage.remove("ToDo", saved[0].id)).toEqual([]);
  });

  it("bulk: delete_items, submit_cancel_or_update_docs (submit / update), add_multiple", async () => {
    const { client } = setup();
    expect(await bulkDelete(client, "ToDo", ["TD-5"])).toEqual({ failed: [], queued: false });
    expect(await client.getDoc("ToDo", "TD-5").catch((e) => e.kind)).toBe("not_found");
    expect(await bulkSubmitCancelOrUpdate(client, "CRM Deal", ["D-1", "D-2"], "submit")).toEqual({ failed: [], queued: false });
    expect((await client.getDoc("CRM Deal", "D-1")).doc.docstatus).toBe(1);
    // bulk_update.py:82: an unknown name fails the whole request (P36b simulator fidelity); a cancelled-only failure is per name
    await expect(bulkSubmitCancelOrUpdate(client, "ToDo", ["TD-1", "nope"], "update", { priority: "High" })).rejects.toMatchObject({ excType: "DoesNotExistError" });
    expect(await bulkSubmitCancelOrUpdate(client, "ToDo", ["TD-1"], "update", { priority: "High" })).toEqual({ failed: [], queued: false });
    await bulkAssign(client, "ToDo", ["TD-1", "TD-3"], ["ann@x.com"]);
    const rows = await reportviewGet(client, "ToDo", { fields: ["name", "_assign"], filters: [["_assign", "like", "%ann@x.com%"]], order_by: "name asc" });
    expect(rows.rows.map((r) => r.name)).toEqual(["TD-1", "TD-3"]);
    expect(rows.userInfo["ann@x.com"]).toMatchObject({ fullname: "Ann" });
  });

  it("search_link on User as both pickers call it; the built-in User meta serves a backend without one", async () => {
    const { client } = setup();
    const assignTo = await client.searchLink("User", "", { pageLength: 10, filters: { user_type: "System User", enabled: 1 } } as never);
    expect(assignTo.map((u) => u.value)).toEqual(["ann@x.com"]);
    expect((await client.searchLink("User", "a", { referenceDoctype: "ToDo" })).map((u) => u.value)).toContain("ann@x.com");
    const bare = setup(false).client;
    expect((await bare.searchLink("User", "", { filters: { user_type: "System User", enabled: 1 } })).map((u) => u.value)).toEqual(["Administrator"]);
  });

  it("FrappeListView renders rows from the fixture (simulated mode end to end)", async () => {
    const { transport } = setup();
    const client = createFrappeClient({ transport });
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FrappeProvider client={client}><FrappeListView doctype="ToDo" storage={null} /></FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
    await waitFor(() => expect(bodyRows()).toHaveLength(5));
    expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(3);
    expect(transport.store.calls.map((c) => c.method)).toEqual(expect.arrayContaining(["frappe.desk.form.load.getdoctype", "frappe.desk.reportview.get", "frappe.desk.reportview.get_count"]));
  });
});

describe("record call sites (A4)", () => {
  it("workflow: transitions by role, apply with update_field / update_value, Workflow log in docinfo", async () => {
    const { client } = setup();
    const { doc } = await client.getDoc("CRM Deal", "D-1");
    expect((await client.getWorkflowTransitions(doc)).map((t) => t.action)).toEqual(["Approve"]);
    const applied = await client.applyWorkflow(doc, "Approve");
    expect(applied).toMatchObject({ workflow_state: "Approved", approved_by: "Manager", docstatus: 0 });
    expect((await client.getDocInfo("CRM Deal", "D-1")).workflow_logs).toEqual([expect.objectContaining({ comment_type: "Workflow", content: "Approved" })]);
  });

  it("assignments, comments and versions feed the timeline builder", async () => {
    const { client } = setup();
    await client.addAssignment("CRM Deal", "D-2", ["ann@x.com"]);
    await client.removeAssignment("CRM Deal", "D-2", "ann@x.com");
    const c = await client.addComment("CRM Deal", "D-2", "<p>Hello</p>");
    await client.updateComment(c.name, "<p>Hello again</p>");
    const { doc } = await client.getDoc("CRM Deal", "D-2");
    await client.saveDoc({ ...doc, status: "Won" }, "Save");
    const loaded = await client.getDoc("CRM Deal", "D-2");
    expect(loaded.docinfo.assignment_logs).toHaveLength(2);
    expect(loaded.docinfo.versions).toHaveLength(1);
    expect(JSON.parse(loaded.docinfo.versions[0].data).changed).toEqual([["status", "Open", "Won"]]);
    const items = buildTimelineItems(loaded.doc, loaded.docinfo, { user: "Administrator", t: (k) => defaultMessages.en[k], fieldLabel: (f) => f });
    expect(items.map((i) => i.kind)).toEqual(expect.arrayContaining(["created", "modified", "comment", "assignment", "change"]));
    expect(items.find((i) => i.kind === "comment")?.body).toBe("<p>Hello again</p>");
    await client.deleteComment(c.name);
    expect((await client.getDocInfo("CRM Deal", "D-2")).comments).toEqual([]);
  });
});
