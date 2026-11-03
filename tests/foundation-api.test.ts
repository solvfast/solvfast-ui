/**
 * Foundation — DocumentApi / RecordApi request and response shapes (docs 10 §C3/C5, 11 §5-8, 14 §A2/A11; Frappe
 * 15.110 source for argument names). A recording transport answers with the response shapes Frappe sends; the meta
 * payloads are the REAL getdoctype captures in tests/fixtures/real-15.110/.
 */
import { describe, expect, it } from "vitest";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import { FrappeError, createFrappeClient, withFrappeApi, workflowFromMeta, type FrappeResponse } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";

type Answer = FrappeResponse | ((args: Record<string, unknown>) => FrappeResponse);
function recording(answers: Record<string, Answer> = {}, opts: Parameters<typeof createFrappeClient>[0] = {}) {
  const seen: { method: string; args: Record<string, unknown> }[] = [];
  const client = createFrappeClient({
    ...opts,
    transport: async (method, args) => {
      seen.push({ method, args });
      const a = answers[method];
      return typeof a === "function" ? a(args) : a ?? { message: null };
    },
  });
  return { seen, client };
}

const WORKFLOW_META: DocTypeMeta = {
  name: "Deal Note", fields: [{ fieldname: "workflow_state", fieldtype: "Link", options: "Workflow State" }],
  __workflow_docs: [
    {
      doctype: "Workflow", name: "Deal Approval", document_type: "Deal Note", workflow_state_field: "workflow_state", is_active: 1, override_status: 0,
      states: [{ state: "Draft", doc_status: "0", allow_edit: "Sales User" }, { state: "Approved", doc_status: "1", allow_edit: "Sales Manager", style: "" }],
      transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 1 }],
    },
    { doctype: "Workflow State", name: "Draft", style: "" },
    { doctype: "Workflow State", name: "Approved", style: "Success" },
  ],
};

describe("DocumentApi", () => {
  it("getMetaBundle: real ToDo / Contact getdoctype payloads → parent + child-table DocTypes", async () => {
    const { seen, client } = recording({ "frappe.desk.form.load.getdoctype": (a) => (a.doctype === "Contact" ? contactEn : todoEn) as FrappeResponse });
    const todo = await client.getMetaBundle("ToDo");
    expect(seen[0]).toEqual({ method: "frappe.desk.form.load.getdoctype", args: { doctype: "ToDo" } });
    expect(todo.meta.name).toBe("ToDo");
    expect(todo.children).toEqual({});
    expect(todo.meta.fields.find((f) => f.fieldname === "status")?.options).toContain("Open");
    const contact = await client.getMetaBundle("Contact");
    expect(Object.keys(contact.children).sort()).toEqual(["Contact Email", "Contact Phone", "Dynamic Link"]);
    expect(contact.children["Contact Email"].istable).toBe(1);
    expect(await client.getMetaBundle("ToDo").then(() => "ok")).toBe("ok");
    expect(await recording({ "frappe.desk.form.load.getdoctype": { docs: [] } }).client.getMetaBundle("Nope").catch((e) => e.kind)).toBe("not_found");
  });

  it("getMetaBundle folds a response-level `__messages` into meta.__messages (15.110 sends none in getdoctype)", async () => {
    const { client } = recording({ "frappe.desk.form.load.getdoctype": { docs: [{ name: "ToDo", fields: [] }], __messages: { Status: "الحالة" } } });
    expect((await client.getMetaBundle("ToDo")).meta.__messages).toEqual({ Status: "الحالة" });
  });

  it("getDoc: docs[0] + docinfo (normalized); a missing name (200 with docs: []) is a not_found FrappeError", async () => {
    const doc = { doctype: "ToDo", name: "TD-1", status: "Open", modified: "2026-11-03 10:00:00.000001" };
    const { seen, client } = recording({
      "frappe.desk.form.load.getdoc": (a) => (a.name === "TD-1" ? { docs: [doc], docinfo: { comments: [{ name: "C1", content: "<p>x</p>", owner: "a@x", creation: "2026" }], permissions: { read: 1, write: 1 }, user_info: {} }, _link_titles: {} } : { docs: [] }),
    });
    const loaded = await client.getDoc("ToDo", "TD-1");
    expect(seen[0]).toEqual({ method: "frappe.desk.form.load.getdoc", args: { doctype: "ToDo", name: "TD-1" } });
    expect(loaded.doc).toEqual(doc);
    expect(loaded.docinfo).toMatchObject({ comments: [{ name: "C1" }], attachments: [], versions: [], assignments: [], shared: [], permissions: { read: 1, write: 1 } });
    const e = await client.getDoc("ToDo", "missing").catch((x) => x);
    expect(e).toBeInstanceOf(FrappeError);
    expect(e).toMatchObject({ kind: "not_found", status: 404, excType: "DoesNotExistError" });
  });

  it("getDocInfo → get_docinfo (docinfo is top-level, not in message)", async () => {
    const { seen, client } = recording({ "frappe.desk.form.load.get_docinfo": { docinfo: { assignments: [{ name: "TD-9", owner: "u@x", status: "Open" }] } } });
    expect((await client.getDocInfo("ToDo", "TD-1")).assignments).toEqual([{ name: "TD-9", owner: "u@x", status: "Open" }]);
    expect(seen[0]).toEqual({ method: "frappe.desk.form.load.get_docinfo", args: { doctype: "ToDo", name: "TD-1" } });
  });

  it("saveDoc → savedocs with `doc` as a JSON string (children included) and `action`; returns docs[0] incl. localname", async () => {
    const local: FrappeDoc = { doctype: "Contact", name: "new-contact-abc", __islocal: 1, first_name: "A", email_ids: [{ doctype: "Contact Email", name: "new-contact-email-1", __islocal: 1, email_id: "a@x" }] };
    const { seen, client } = recording({ "frappe.desk.form.save.savedocs": (a) => ({ docs: [{ ...JSON.parse(a.doc as string), name: "A", localname: "new-contact-abc", __islocal: undefined }], docinfo: {}, _server_messages: JSON.stringify([JSON.stringify({ message: "Saved", indicator: "green", alert: 1 })]) }) });
    const saved = await client.saveDoc(local, "Save");
    expect(seen[0].method).toBe("frappe.desk.form.save.savedocs");
    expect(seen[0].args.action).toBe("Save");
    expect(typeof seen[0].args.doc).toBe("string");
    expect(JSON.parse(seen[0].args.doc as string)).toEqual(local);
    expect(saved).toMatchObject({ name: "A", localname: "new-contact-abc" });
  });

  it("saveDoc of a queued submission (no docs in the response) returns the sent doc flagged __queued (UNVERIFIED shape)", async () => {
    const { client } = recording({ "frappe.desk.form.save.savedocs": {} });
    expect(await client.saveDoc({ doctype: "X", name: "X-1" }, "Submit")).toEqual({ doctype: "X", name: "X-1", __queued: 1 });
  });

  it("cancel → desk.form.save.cancel (optionally setting the workflow state first); delete → frappe.client.delete; rename → frappe.rename_doc (old/new/merge)", async () => {
    const { seen, client } = recording({
      "frappe.desk.form.save.cancel": { docs: [{ doctype: "X", name: "X-1", docstatus: 2 }] },
      "frappe.rename_doc": { message: "X-NEW" },
    });
    expect(await client.cancelDoc("X", "X-1")).toMatchObject({ docstatus: 2 });
    await client.cancelDoc("X", "X-1", { workflowStateField: "workflow_state", workflowState: "Cancelled" });
    await client.deleteDoc("X", "X-1");
    expect(await client.renameDoc("X", "X-1", "X-NEW", { merge: true })).toBe("X-NEW");
    expect(seen).toEqual([
      { method: "frappe.desk.form.save.cancel", args: { doctype: "X", name: "X-1" } },
      { method: "frappe.desk.form.save.cancel", args: { doctype: "X", name: "X-1", workflow_state_fieldname: "workflow_state", workflow_state: "Cancelled" } },
      { method: "frappe.client.delete", args: { doctype: "X", name: "X-1" } },
      { method: "frappe.rename_doc", args: { doctype: "X", old: "X-1", new: "X-NEW", merge: true } },
    ]);
  });

  it("validateLink → frappe.client.validate_link with fetch fields; canonical name or null", async () => {
    const { seen, client } = recording({ "frappe.client.validate_link": (a) => ({ message: a.docname === "acme" ? { name: "ACME", customer_group: "Retail" } : { name: null } }) });
    expect(await client.validateLink("Customer", "acme", ["customer_group"])).toEqual({ name: "ACME", values: { customer_group: "Retail" } });
    expect(await client.validateLink("Customer", "nope")).toEqual({ name: null, values: {} });
    expect(seen.map((s) => s.args)).toEqual([{ doctype: "Customer", docname: "acme", fields: '["customer_group"]' }, { doctype: "Customer", docname: "nope" }]);
  });

  it("runDocMethod → run_doc_method with the LOCAL doc as `docs` (JSON), method and args; returns docs[0] + message", async () => {
    const { seen, client } = recording({ run_doc_method: { docs: [{ doctype: "X", name: "X-1", total: 3 }], message: { ok: true } } });
    expect(await client.runDocMethod({ doctype: "X", name: "X-1", modified: "m" }, "recalc", { force: 1 })).toEqual({ doc: { doctype: "X", name: "X-1", total: 3 }, message: { ok: true } });
    expect(seen[0]).toEqual({ method: "run_doc_method", args: { docs: '{"doctype":"X","name":"X-1","modified":"m"}', method: "recalc", args: '{"force":1}' } });
  });

  it("searchLink: 0.3 args unchanged; filters (JSON), query, searchfield, ignore_user_permissions only when given", async () => {
    const { seen, client } = recording({ "frappe.desk.search.search_link": { message: [{ value: "a@x", description: "A" }] } });
    await client.searchLink("User", "a", { referenceDoctype: "ToDo" });
    await client.searchLink("User", "a", { filters: { enabled: 1 }, query: "app.queries.users", searchfield: "full_name", ignoreUserPermissions: true, pageLength: 5 });
    await client.searchLink("User", "a", { filters: [["User", "enabled", "=", 1]] });
    await client.searchLink("Item", "x", { query: "app.queries.items", args: { company: "SF", item_group: ["A", "B"], doctype: "Hacked", skipped: undefined } });
    expect(seen.map((s) => s.args)).toEqual([
      { doctype: "User", txt: "a", page_length: 10, reference_doctype: "ToDo" },
      { doctype: "User", txt: "a", page_length: 5, filters: '{"enabled":1}', query: "app.queries.users", searchfield: "full_name", ignore_user_permissions: 1 },
      { doctype: "User", txt: "a", page_length: 10, filters: '[["User","enabled","=",1]]' },
      // R1-F13: extra get_query keys at top level (objects as JSON); they cannot replace doctype / txt / query …
      { company: "SF", item_group: '["A","B"]', doctype: "Item", txt: "x", page_length: 10, query: "app.queries.items" },
    ]);
  });
});

describe("RecordApi", () => {
  it("getWorkflow reads getdoctype `__workflow_docs` (how Desk obtains it); state style from Workflow State docs; null without one", async () => {
    const { seen, client } = recording({ "frappe.desk.form.load.getdoctype": (a) => (a.doctype === "Deal Note" ? { docs: [WORKFLOW_META] } : (todoEn as FrappeResponse)) });
    const wf = await client.getWorkflow("Deal Note");
    expect(seen[0]).toEqual({ method: "frappe.desk.form.load.getdoctype", args: { doctype: "Deal Note" } });
    expect(wf).toMatchObject({ name: "Deal Approval", document_type: "Deal Note", workflow_state_field: "workflow_state", override_status: 0 });
    expect(wf!.states.map((s) => [s.state, s.style])).toEqual([["Draft", undefined], ["Approved", "Success"]]);
    expect(wf!.transitions).toHaveLength(1);
    expect(await client.getWorkflow("ToDo")).toBeNull(); // real ToDo meta: `__workflow_docs: []`
    expect(workflowFromMeta(undefined)).toBeNull();
  });

  it("get_transitions / apply_workflow send the doc as JSON; apply returns the server's doc", async () => {
    const doc: FrappeDoc = { doctype: "Deal Note", name: "DN-1", workflow_state: "Draft", modified: "m" };
    const { seen, client } = recording({
      "frappe.model.workflow.get_transitions": { message: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager" }] },
      "frappe.model.workflow.apply_workflow": { message: { ...doc, workflow_state: "Approved", docstatus: 1 } },
    });
    expect((await client.getWorkflowTransitions(doc)).map((t) => t.action)).toEqual(["Approve"]);
    expect(await client.applyWorkflow(doc, "Approve")).toMatchObject({ workflow_state: "Approved", docstatus: 1 });
    expect(seen).toEqual([
      { method: "frappe.model.workflow.get_transitions", args: { doc: JSON.stringify(doc) } },
      { method: "frappe.model.workflow.apply_workflow", args: { doc: JSON.stringify(doc), action: "Approve" } },
    ]);
  });

  it("assign_to.add (assign_to as a JSON list, flat args) and remove (one user)", async () => {
    const { seen, client } = recording({ "frappe.desk.form.assign_to.add": { message: [{ owner: "a@x", name: "TD-1" }] }, "frappe.desk.form.assign_to.remove": { message: [] } });
    expect(await client.addAssignment("Lead", "L-1", ["a@x", "b@x"], { description: "Call", date: "2026-11-10", priority: "High" })).toEqual([{ owner: "a@x", name: "TD-1" }]);
    expect(await client.removeAssignment("Lead", "L-1", "a@x")).toEqual([]);
    expect(seen).toEqual([
      { method: "frappe.desk.form.assign_to.add", args: { doctype: "Lead", name: "L-1", assign_to: '["a@x","b@x"]', description: "Call", date: "2026-11-10", priority: "High" } },
      { method: "frappe.desk.form.assign_to.remove", args: { doctype: "Lead", name: "L-1", assign_to: "a@x" } },
    ]);
  });

  it("comments: add_comment (comment_email / comment_by from the session option), update_comment, delete via frappe.client.delete", async () => {
    const { seen, client } = recording(
      { "frappe.desk.form.utils.add_comment": { message: { doctype: "Comment", name: "CM-1", content: "<p>Hi</p>", owner: "a@x", creation: "2026-11-03 10:00:00", comment_type: "Comment" } } },
      { session: { user: "a@x", fullName: "Ann" } },
    );
    expect(await client.addComment("Lead", "L-1", "<p>Hi</p>")).toMatchObject({ name: "CM-1", owner: "a@x", comment_type: "Comment" });
    await client.updateComment("CM-1", "<p>Hello</p>");
    await client.deleteComment("CM-1");
    expect(seen).toEqual([
      { method: "frappe.desk.form.utils.add_comment", args: { reference_doctype: "Lead", reference_name: "L-1", content: "<p>Hi</p>", comment_email: "a@x", comment_by: "Ann" } },
      { method: "frappe.desk.form.utils.update_comment", args: { name: "CM-1", content: "<p>Hello</p>" } },
      { method: "frappe.client.delete", args: { doctype: "Comment", name: "CM-1" } },
    ]);
  });

  it("without a session user, add_comment sends empty comment_email / comment_by (the server fills comment_email)", async () => {
    const { seen, client } = recording({}, { session: () => undefined });
    await client.addComment("Lead", "L-1", "x");
    expect(seen[0].args).toMatchObject({ comment_email: "", comment_by: "" });
  });
});

describe("client plumbing", () => {
  it("subscribeMessages receives the parsed messages of successful responses; unsubscribe stops it", async () => {
    const { client } = recording({ "frappe.desk.form.save.savedocs": { docs: [{ doctype: "X", name: "X-1" }], _server_messages: JSON.stringify([JSON.stringify({ message: "Saved", indicator: "green", alert: 1 })]) } });
    const got: unknown[] = [];
    const off = client.subscribeMessages((m, method) => got.push([method, m]));
    await client.saveDoc({ doctype: "X", name: "X-1" }, "Save");
    off();
    await client.saveDoc({ doctype: "X", name: "X-1" }, "Save");
    expect(got).toEqual([["frappe.desk.form.save.savedocs", [{ message: "Saved", indicator: "green", alert: true }]]]);
  });

  it("withFrappeApi upgrades a 0.3-style client over its call, keeping its own 0.3 methods", async () => {
    const calls: string[] = [];
    const legacy = {
      call: async (method: string) => { calls.push(method); return { docs: [{ name: "ToDo", fields: [] }] }; },
      getMeta: async () => ({ name: "custom", fields: [] }),
      getList: async () => [],
      getCount: async () => 42,
      searchLink: async () => [],
    };
    const api = withFrappeApi(legacy);
    expect(await api.getCount("ToDo", {})).toBe(42);
    expect((await api.getMetaBundle("ToDo")).meta.name).toBe("ToDo");
    expect(calls).toEqual(["frappe.desk.form.load.getdoctype"]);
    const full = createFrappeClient({ transport: async () => ({}) });
    expect(withFrappeApi(full)).toBe(full);
  });
});
