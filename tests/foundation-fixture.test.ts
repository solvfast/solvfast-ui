/**
 * Foundation — createFixtureTransport. SIMULATED backend: these tests pin the request/response SHAPES the package and
 * the CRM rely on, over the REAL 15.110 metadata (ToDo, Contact + its child tables). They are not evidence of Frappe
 * behaviour.
 */
import { describe, expect, it } from "vitest";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { reportviewCount, reportviewGet } from "../src/frappe/list/reportview";

const meta = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const DEAL: DocTypeMeta = {
  name: "Deal", is_submittable: 1, autoname: "format:DEAL-.#####", title_field: "title", search_fields: "status",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "status", fieldtype: "Select", options: "Open\nWon\nLost" },
    { fieldname: "amount", fieldtype: "Currency" },
    { fieldname: "workflow_state", fieldtype: "Link", options: "Workflow State" },
  ],
};
const WF: WorkflowInfo = {
  name: "Deal Approval", document_type: "Deal", workflow_state_field: "workflow_state",
  states: [{ state: "Draft", doc_status: "0", allow_edit: "Sales User" }, { state: "Approved", doc_status: "1", allow_edit: "Sales Manager", update_field: "status", update_value: "Won", style: "Success" }],
  transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager" }],
};
function setup(extra: Partial<FixtureBackend> = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: meta(todoEn), Contact: meta(contactEn), Deal: [DEAL] },
    docs: {
      ToDo: [
        { doctype: "ToDo", name: "TD-1", description: "Call Ann", status: "Open", priority: "High", modified: "2026-11-01 10:00:00.000000" },
        { doctype: "ToDo", name: "TD-2", description: "Email Bob", status: "Closed", priority: "Low", modified: "2026-11-02 10:00:00.000000" },
        { doctype: "ToDo", name: "TD-3", description: "Visit Cara", status: "Open", priority: "Medium", modified: "2026-11-03 10:00:00.000000" },
      ],
    },
    workflows: { Deal: WF },
    ...extra,
  });
  return { transport, client: createFrappeClient({ transport, session: { user: "Administrator", fullName: "Administrator" } }) };
}

describe("fixture transport (SIMULATED)", () => {
  it("getdoctype returns the real bundle + user_settings; workflows are served in __workflow_docs", async () => {
    const { transport, client } = setup();
    const res = await transport("frappe.desk.form.load.getdoctype", { doctype: "Contact" });
    expect((res.docs as DocTypeMeta[]).map((d) => d.name)).toEqual(["Contact", "Contact Email", "Contact Phone", "Dynamic Link"]);
    expect(res.user_settings).toBe("{}");
    expect(await client.getWorkflow("Deal")).toMatchObject({ name: "Deal Approval", workflow_state_field: "workflow_state" });
    expect(await client.getWorkflow("ToDo")).toBeNull();
  });

  it("save: new docs get names, child rows are kept and linked, modified is bumped and checked", async () => {
    const { client } = setup();
    const saved = await client.saveDoc({
      doctype: "Contact", name: "new-contact-1", __islocal: 1, first_name: "Ann",
      email_ids: [{ doctype: "Contact Email", name: "new-contact-email-1", __islocal: 1, email_id: "ann@x.com", is_primary: 1 }],
    }, "Save");
    expect(saved.name).not.toMatch(/^new-/);
    expect(saved.localname).toBe("new-contact-1");
    const row = (saved.email_ids as FrappeDoc[])[0];
    expect(row).toMatchObject({ parent: saved.name, parentfield: "email_ids", parenttype: "Contact", idx: 1, email_id: "ann@x.com" });
    expect(row.name).not.toMatch(/^new-/);
    const loaded = await client.getDoc("Contact", saved.name);
    expect(loaded.doc.email_ids).toHaveLength(1);
    const again = await client.saveDoc({ ...loaded.doc, first_name: "Anne" }, "Save");
    expect(again.modified! > loaded.doc.modified!).toBe(true);
    const stale = await client.saveDoc({ ...loaded.doc, first_name: "Old" }, "Save").catch((e) => e);
    expect(stale).toBeInstanceOf(FrappeError);
    expect(stale.kind).toBe("timestamp");
  });

  it("mandatory, naming series, submit and cancel", async () => {
    const { client } = setup();
    const missing = await client.saveDoc({ doctype: "Deal", name: "new-deal-1", __islocal: 1 }, "Save").catch((e) => e);
    expect(missing).toMatchObject({ kind: "mandatory" });
    expect(missing.messages[0].message).toContain("Title");
    const d = await client.saveDoc({ doctype: "Deal", name: "new-deal-1", __islocal: 1, title: "Big" }, "Save");
    expect(d.name).toBe("DEAL-00001");
    const submitted = await client.saveDoc(d, "Submit");
    expect(submitted.docstatus).toBe(1);
    expect(await client.saveDoc(submitted, "Save").catch((e) => e.excType)).toBe("DocstatusTransitionError");
    expect((await client.cancelDoc("Deal", d.name)).docstatus).toBe(2);
    expect(await client.saveDoc({ doctype: "ToDo", name: "TD-1", modified: "2026-11-01 10:00:00.000000", description: "x" }, "Submit").catch((e) => e.kind)).toBe("validation");
  });

  it("workflow: transitions from the backend; apply sets the state, update_field and docstatus, logs a Workflow comment", async () => {
    const { client } = setup();
    const d = await client.saveDoc({ doctype: "Deal", name: "new-deal-1", __islocal: 1, title: "Big", workflow_state: "Draft" }, "Save");
    expect((await client.getWorkflowTransitions(d)).map((t) => t.action)).toEqual(["Approve"]);
    const applied = await client.applyWorkflow(d, "Approve");
    expect(applied).toMatchObject({ workflow_state: "Approved", status: "Won", docstatus: 1 });
    const info = await client.getDocInfo("Deal", d.name);
    expect(info.workflow_logs).toHaveLength(1);
    expect(await client.applyWorkflow(applied, "Approve").catch((e) => e.excType)).toBe("WorkflowTransitionError");
  });

  it("frappe.desk.reportview.get: compressed keys/values, filters, or_filters, order_by, paging, comment count; [] when empty", async () => {
    const { client } = setup();
    const page = await reportviewGet(client, "ToDo", { fields: ["name", "description", "_comments"], filters: [["status", "=", "Open"]], order_by: "modified desc", limit_start: 0, limit_page_length: 20 });
    expect(page.rows.map((r) => r.name)).toEqual(["TD-3", "TD-1"]);
    expect(page.rows[0]).toHaveProperty("_comment_count", 0);
    const raw = await client.call("frappe.desk.reportview.get", { doctype: "ToDo", fields: JSON.stringify(["`tabToDo`.`name`"]), filters: "[]", or_filters: JSON.stringify([["priority", "=", "High"], ["priority", "=", "Low"]]), order_by: "`tabToDo`.`name` asc", start: 1, page_length: 1 });
    expect(raw.message).toEqual({ keys: ["name"], values: [["TD-2"]], user_info: {} });
    expect((await client.call("frappe.desk.reportview.get", { doctype: "ToDo", fields: '["name"]', filters: JSON.stringify([["status", "=", "Nope"]]) })).message).toEqual([]);
    expect(await reportviewCount(client, "ToDo", { filters: [["status", "=", "Open"]] })).toEqual({ count: 2, capped: false });
    expect(await reportviewCount(client, "ToDo", { limit: 2 })).toEqual({ count: 2, capped: true });
    expect(await client.call("frappe.desk.reportview.get", { doctype: "ToDo", fields: '["nope"]' }).catch((e) => e.excType)).toBe("DataError");
  });

  it("get_list / get_count / search_link / validate_link", async () => {
    const { client } = setup();
    expect((await client.getList("ToDo", { fields: ["name"], filters: [["description", "like", "%i%"]], order_by: "name asc" })).map((r) => r.name)).toEqual(["TD-2", "TD-3"]);
    expect(await client.getCount("ToDo", { or_filters: [["priority", "=", "High"], ["priority", "=", "Low"]] })).toBe(2);
    expect((await client.searchLink("ToDo", "td-2")).map((r) => r.value)).toEqual(["TD-2"]);
    expect(await client.validateLink("ToDo", "td-1", ["status"])).toEqual({ name: "TD-1", values: { status: "Open" } });
    expect(await client.validateLink("ToDo", "zz")).toEqual({ name: null, values: {} });
  });

  it("assignments, comments, delete / rename / bulk; list settings null", async () => {
    const { client, transport } = setup();
    expect(await client.addAssignment("ToDo", "TD-1", ["a@x", "b@x"])).toEqual([{ owner: "a@x", name: expect.any(String) }, { owner: "b@x", name: expect.any(String) }]);
    expect(transport.store.docs.get("ToDo")!.get("TD-1")!._assign).toBe('["a@x","b@x"]');
    expect(await client.removeAssignment("ToDo", "TD-1", "a@x")).toHaveLength(1);
    const c = await client.addComment("ToDo", "TD-1", "<p>Hi</p>");
    expect((await client.getDocInfo("ToDo", "TD-1")).comments.map((x) => x.name)).toEqual([c.name]);
    await client.deleteComment(c.name);
    expect((await client.getDocInfo("ToDo", "TD-1")).comments).toEqual([]);
    expect(await client.renameDoc("ToDo", "TD-1", "TD-100")).toBe("TD-100");
    expect((await client.getDocInfo("ToDo", "TD-100")).assignments).toHaveLength(1);
    await client.deleteDoc("ToDo", "TD-100");
    expect(await client.getDoc("ToDo", "TD-100").catch((e) => e.kind)).toBe("not_found");
    await client.call("frappe.desk.reportview.delete_items", { doctype: "ToDo", items: JSON.stringify(["TD-2"]) });
    const res = await client.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "ToDo", docnames: JSON.stringify(["TD-3", "missing"]), action: "update", data: JSON.stringify({ status: "Closed" }) });
    expect(res.message).toEqual(["missing"]);
    await client.call("frappe.desk.form.assign_to.add_multiple", { doctype: "ToDo", name: JSON.stringify(["TD-3"]), assign_to: JSON.stringify(["c@x"]), bulk_assign: true, re_assign: true });
    expect((await client.getDocInfo("ToDo", "TD-3")).assignments.map((a) => a.owner)).toEqual(["c@x"]);
    expect((await client.call("frappe.desk.listview.get_list_settings", { doctype: "ToDo" })).message).toBeNull();
    expect(await client.call("frappe.nope", {}).catch((e) => e.kind)).toBe("not_found");
  });
});
