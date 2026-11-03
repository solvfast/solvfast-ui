/**
 * Foundation — simulator hardening (docs/qa/simulator-caveats.md, A6). SIMULATED backend: these pin that the simulator
 * now reproduces the native rules listed below (cited from Frappe 15.110 source), so it stops masking those bug classes.
 * Still not evidence of Frappe behaviour.
 */
import { describe, expect, it } from "vitest";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import { createFrappeClient, type FrappeResponse } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureOptions } from "../src/frappe/testing";
import { reportviewGet } from "../src/frappe/list/reportview";

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const NOW = () => new Date(2026, 10, 3, 9, 30, 0);
const INVOICE: DocTypeMeta = {
  name: "Sales Invoice", is_submittable: 1, track_changes: 1, autoname: "format:INV-{YYYY}-{MM}-{DD}-{customer}-{####}",
  fields: [
    { fieldname: "customer", fieldtype: "Link", label: "Customer", options: "Customer" },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "\nDraft\nPaid" },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "items", fieldtype: "Table", label: "Items", options: "Sales Invoice Item" },
  ],
};
const ITEM: DocTypeMeta = { name: "Sales Invoice Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item" }, { fieldname: "qty", fieldtype: "Float", label: "Qty" }, { fieldname: "customer", fieldtype: "Link", label: "Customer", options: "Customer" }] };
const CUSTOMER: DocTypeMeta = { name: "Customer", autoname: "field:customer_name", fields: [{ fieldname: "customer_name", fieldtype: "Data", label: "Customer Name" }] };
const LEAD: DocTypeMeta = { name: "CRM Lead", autoname: "naming_series:", track_changes: 1, fields: [{ fieldname: "naming_series", fieldtype: "Select", options: "CRM-LEAD-.YYYY.-" }, { fieldname: "lead_name", fieldtype: "Data" }, { fieldname: "workflow_state", fieldtype: "Data" }] };
const WF: WorkflowInfo = { name: "Lead Flow", document_type: "CRM Lead", workflow_state_field: "workflow_state", states: [{ state: "New", doc_status: "0" }, { state: "Qualified", doc_status: "0" }], transitions: [{ state: "New", action: "Qualify", next_state: "Qualified", allowed: "Sales User" }] };

function setup(opts: FixtureOptions = {}) {
  const transport = createFixtureTransport({
    meta: { "Sales Invoice": [INVOICE, ITEM], Customer: [CUSTOMER], "CRM Lead": [LEAD], ToDo: docsOf(todoEn), Contact: docsOf(contactEn) },
    docs: {
      Customer: [{ doctype: "Customer", name: "ACME", customer_name: "ACME" }],
      "Sales Invoice": [{ doctype: "Sales Invoice", name: "SI-1", customer: "ACME", status: "Draft", amount: 10, modified: "2026-11-01 10:00:00.000000", items: [{ doctype: "Sales Invoice Item", name: "row-1", item: "Pen", qty: 1 }] }],
      "CRM Lead": [{ doctype: "CRM Lead", name: "L-1", lead_name: "Ann", workflow_state: "New", modified: "2026-11-01 10:00:00.000000" }],
      ToDo: [
        { doctype: "ToDo", name: "TD-A", allocated_to: "ann@x.com", reference_type: "CRM Lead", reference_name: "L-1", status: "Open", description: "Call" },
        { doctype: "ToDo", name: "TD-B", allocated_to: "bob@x.com", reference_type: "CRM Lead", reference_name: "L-1", status: "Closed", description: "Old" },
      ],
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Smith", enabled: 1, user_type: "System User" },
        { doctype: "User", name: "bob@x.com", first_name: "Bob", last_name: "Jones", enabled: 1, user_type: "System User" },
      ],
    },
    workflows: { "CRM Lead": WF },
  }, { now: NOW, ...opts });
  return { transport, client: createFrappeClient({ transport, session: { user: "Administrator" } }) };
}

describe("(a) new vs existing documents and child rows (savedocs + update_child_table)", () => {
  it("on an existing parent a row with a client-invented name and no __islocal is not saved; __islocal and nameless rows are", async () => {
    const { client } = setup();
    const { doc } = await client.getDoc("Sales Invoice", "SI-1");
    const rows = [
      ...(doc.items as FrappeDoc[]),
      { doctype: "Sales Invoice Item", name: "client-made-1", item: "Lost" },
      { doctype: "Sales Invoice Item", name: "new-sales-invoice-item-1", __islocal: 1, item: "Kept (local)" },
      { doctype: "Sales Invoice Item", item: "Kept (no name)" } as unknown as FrappeDoc,
    ];
    const echoed = await client.saveDoc({ ...doc, items: rows }, "Save");
    expect((echoed.items as FrappeDoc[]).map((r) => r.item)).toEqual(["Pen", "Lost", "Kept (local)", "Kept (no name)"]); // the response echoes the in-memory doc
    const reloaded = (await client.getDoc("Sales Invoice", "SI-1")).doc;
    expect((reloaded.items as FrappeDoc[]).map((r) => r.item)).toEqual(["Pen", "Kept (local)", "Kept (no name)"]);
    expect((reloaded.items as FrappeDoc[]).map((r) => r.idx)).toEqual([1, 2, 3]);
  });

  it("a NEW parent inserts every row (set_local_name clears row names)", async () => {
    const { client } = setup();
    const saved = await client.saveDoc({ doctype: "Sales Invoice", name: "new-sales-invoice-1", __islocal: 1, customer: "ACME", items: [{ doctype: "Sales Invoice Item", name: "client-made", item: "A" }] }, "Save");
    expect((await client.getDoc("Sales Invoice", saved.name)).doc.items).toEqual([expect.objectContaining({ item: "A", parent: saved.name })]);
  });

  it("a name that is not stored, without __islocal, is DoesNotExistError; a doc posted without `modified` is a timestamp mismatch", async () => {
    const { client } = setup();
    expect(await client.saveDoc({ doctype: "Sales Invoice", name: "SI-404", customer: "ACME" }, "Save").catch((e) => e.kind)).toBe("not_found");
    const { doc } = await client.getDoc("Sales Invoice", "SI-1");
    const { modified: _m, ...noModified } = doc;
    void _m;
    expect(await client.saveDoc(noModified as FrappeDoc, "Save").catch((e) => e.kind)).toBe("timestamp");
  });
});

describe("(b) naming", () => {
  it("format: expands {YYYY} {MM} {DD} {field} {#…}; each braced counter runs on the empty prefix, shared across DocTypes", async () => {
    const { client, transport } = setup();
    const a = await client.saveDoc({ doctype: "Sales Invoice", name: "new-1", __islocal: 1, customer: "ACME" }, "Save");
    const b = await client.saveDoc({ doctype: "Sales Invoice", name: "new-2", __islocal: 1, customer: "ACME" }, "Save");
    expect([a.name, b.name]).toEqual(["INV-2026-11-03-ACME-0001", "INV-2026-11-03-ACME-0002"]);
    void transport;
  });

  it("naming_series: the doc's series, with ##### appended when it has none (NamingSeries)", async () => {
    const { client } = setup();
    const lead = await client.saveDoc({ doctype: "CRM Lead", name: "new-crm-lead-1", __islocal: 1, naming_series: "CRM-LEAD-.YYYY.-", lead_name: "Cy" }, "Save");
    expect(lead.name).toBe("CRM-LEAD-2026-00001");
    expect(await client.saveDoc({ doctype: "CRM Lead", name: "new-crm-lead-2", __islocal: 1, lead_name: "Dee" }, "Save").catch((e) => e.kind)).toBe("validation");
  });
});

describe("(c) user_info", () => {
  it("real full names (full_name, else first + last), else the user id", async () => {
    const { client } = setup();
    await client.addAssignment("CRM Lead", "L-1", ["bob@x.com", "zed@x.com"]);
    const info = await client.getDocInfo("CRM Lead", "L-1");
    expect(info.user_info["ann@x.com"].fullname).toBe("Ann Smith");
    expect(info.user_info["bob@x.com"].fullname).toBe("Bob Jones");
    expect(info.user_info["zed@x.com"].fullname).toBe("zed@x.com");
    const rows = await reportviewGet(client, "CRM Lead", { fields: ["name", "_assign"] });
    expect(rows.userInfo["ann@x.com"]).toMatchObject({ fullname: "Ann Smith" });
  });
});

describe("(d) strict mode (opt-in)", () => {
  it("off: unknown links and selects pass (shapes only)", async () => {
    const { client } = setup();
    expect((await client.saveDoc({ doctype: "Sales Invoice", name: "n", __islocal: 1, customer: "Nobody", status: "Weird" }, "Save")).customer).toBe("Nobody");
  });
  it("on: Link existence (parent and rows, canonical case) before mandatory, Select options after", async () => {
    const { client } = setup({ strict: true });
    const bad = await client.saveDoc({ doctype: "Sales Invoice", name: "n", __islocal: 1, customer: "Nobody" }, "Save").catch((e) => e);
    expect(bad).toMatchObject({ kind: "link", excType: "LinkValidationError" });
    expect(bad.message).toContain("Customer: Nobody");
    const row = await client.saveDoc({ doctype: "Sales Invoice", name: "n", __islocal: 1, customer: "acme", items: [{ doctype: "Sales Invoice Item", item: "x", customer: "Ghost" }] }, "Save").catch((e) => e.message);
    expect(row).toContain("Row #1: Customer: Ghost");
    const sel = await client.saveDoc({ doctype: "Sales Invoice", name: "n", __islocal: 1, customer: "acme", status: "Weird" }, "Save").catch((e) => e);
    expect(sel).toMatchObject({ kind: "validation" });
    expect(sel.message).toContain('Status cannot be "Weird"');
    const ok = await client.saveDoc({ doctype: "Sales Invoice", name: "n", __islocal: 1, customer: "acme", status: "Paid" }, "Save");
    expect(ok.customer).toBe("ACME");
  });
});

describe("item 2: seeded ToDos drive assignees; Version docs on save", () => {
  it("docinfo.assignments and _assign come from Open ToDos; closing a ToDo by save updates _assign", async () => {
    const { client } = setup();
    const info = await client.getDocInfo("CRM Lead", "L-1");
    expect(info.assignments).toEqual([expect.objectContaining({ name: "TD-A", owner: "ann@x.com", status: "Open" })]);
    expect((await client.getDoc("CRM Lead", "L-1")).doc._assign).toBe('["ann@x.com"]');
    const todo = (await client.getDoc("ToDo", "TD-A")).doc;
    await client.saveDoc({ ...todo, status: "Closed" }, "Save");
    expect((await client.getDoc("CRM Lead", "L-1")).doc._assign).toBe("[]");
    expect((await client.getDocInfo("CRM Lead", "L-1")).assignments).toEqual([]);
  });

  it("Version on save (changed / added / removed / row_changed with 0-based index), docstatus change on submit, none on insert", async () => {
    const { client, transport } = setup();
    const { doc } = await client.getDoc("Sales Invoice", "SI-1");
    const rows = doc.items as FrappeDoc[];
    const saved = await client.saveDoc({ ...doc, amount: 20, items: [{ ...rows[0], qty: 3 }, { doctype: "Sales Invoice Item", __islocal: 1, name: "new-row", item: "Ink" }] }, "Save");
    const v1 = JSON.parse((await client.getDocInfo("Sales Invoice", "SI-1")).versions[0].data);
    expect(v1.changed).toEqual([["amount", "USD 10.00", "USD 20.00"]]); // get_formatted (fmt_money), version.py:181-183
    expect(v1.row_changed).toEqual([["items", 0, "row-1", [["qty", "1", "3"]]]]); // Float without decimals → precision 0
    expect(v1.added).toEqual([["items", expect.objectContaining({ item: "Ink" })]]);
    expect(v1.removed).toEqual([]);
    await client.saveDoc({ ...saved, items: [(saved.items as FrappeDoc[])[1]] }, "Submit");
    const v2 = JSON.parse((await client.getDocInfo("Sales Invoice", "SI-1")).versions[0].data);
    expect(v2.changed).toEqual([["docstatus", 0, 1]]);
    expect(v2.removed).toEqual([["items", expect.objectContaining({ name: "row-1" })]]);
    expect([...transport.store.docs.get("Version")!.values()].every((v) => v.ref_doctype === "Sales Invoice")).toBe(true);
    await client.saveDoc({ doctype: "Sales Invoice", name: "new-x", __islocal: 1, customer: "ACME" }, "Save");
    expect(transport.store.docs.get("Version")!.size).toBe(2);
  });

  it("a workflow transition leaves a Version (state change) and a Workflow comment", async () => {
    const { client } = setup();
    const { doc } = await client.getDoc("CRM Lead", "L-1");
    await client.applyWorkflow(doc, "Qualify");
    const info = await client.getDocInfo("CRM Lead", "L-1");
    expect(JSON.parse(info.versions[0].data).changed).toEqual([["workflow_state", "New", "Qualified"]]);
    // model/workflow.py: doc.add_comment("Workflow", next state) → docinfo.workflow_logs (owner = session user, creation = now)
    expect(info.workflow_logs).toEqual([expect.objectContaining({ comment_type: "Workflow", content: "Qualified", owner: "Administrator", reference_doctype: "CRM Lead", reference_name: "L-1" })]);
    const log = info.workflow_logs![0] as { creation: string };
    expect(log.creation.startsWith("2026-11-03 09:30:")).toBe(true);
    expect(log.creation > String(doc.modified)).toBe(true);
  });
});

describe("fixture still answers raw transport calls", () => {
  it("getdoctype carries user_settings", async () => {
    const { transport } = setup();
    expect(((await transport("frappe.desk.form.load.getdoctype", { doctype: "Sales Invoice" })) as FrappeResponse).user_settings).toBe("{}");
  });
});

describe("cancel pre-flight and amend (A3 R1-F5 call sites)", () => {
  const PAYMENT: DocTypeMeta = { name: "Payment", is_submittable: 1, fields: [{ fieldname: "invoice", fieldtype: "Link", options: "Sales Invoice" }] };
  const RECEIPT: DocTypeMeta = { name: "Receipt", is_submittable: 1, fields: [{ fieldname: "payment", fieldtype: "Link", options: "Payment" }] };
  const NOTE: DocTypeMeta = { name: "Note Draft", fields: [{ fieldname: "invoice", fieldtype: "Link", options: "Sales Invoice" }] };
  function linked() {
    const transport = createFixtureTransport({
      meta: { "Sales Invoice": [INVOICE, ITEM], Customer: [CUSTOMER], Payment: [PAYMENT], Receipt: [RECEIPT], "Note Draft": [NOTE] },
      docs: {
        Customer: [{ doctype: "Customer", name: "ACME", customer_name: "ACME" }],
        "Sales Invoice": [{ doctype: "Sales Invoice", name: "SI-1", customer: "ACME", docstatus: 1, modified: "2026-11-01 10:00:00.000000" }],
        Payment: [
          { doctype: "Payment", name: "PAY-1", invoice: "SI-1", docstatus: 1 },
          { doctype: "Payment", name: "PAY-2", invoice: "SI-1", docstatus: 0 },
        ],
        Receipt: [{ doctype: "Receipt", name: "REC-1", payment: "PAY-1", docstatus: 1 }],
        "Note Draft": [{ doctype: "Note Draft", name: "N-1", invoice: "SI-1" }],
      },
    }, { now: NOW });
    return { transport, client: createFrappeClient({ transport }) };
  }

  it("get_submitted_linked_docs: submitted docs of submittable DocTypes, followed recursively → {docs, count}", async () => {
    const { client } = linked();
    const r = await client.call("frappe.desk.form.linked_with.get_submitted_linked_docs", { doctype: "Sales Invoice", name: "SI-1" });
    expect(r.message).toEqual({ docs: [{ doctype: "Payment", name: "PAY-1", docstatus: 1 }, { doctype: "Receipt", name: "REC-1", docstatus: 1 }], count: 2 });
    const none = await client.call("frappe.desk.form.linked_with.get_submitted_linked_docs", { doctype: "Receipt", name: "REC-1" });
    expect(none.message).toEqual({ docs: [], count: 0 });
  });

  it("cancel_all_linked_docs cancels them; then the doc itself cancels", async () => {
    const { client } = linked();
    const { message } = await client.call("frappe.desk.form.linked_with.get_submitted_linked_docs", { doctype: "Sales Invoice", name: "SI-1" }) as { message: { docs: unknown[] } };
    await client.call("frappe.desk.form.linked_with.cancel_all_linked_docs", { docs: JSON.stringify(message.docs) });
    expect((await client.getDoc("Payment", "PAY-1")).doc.docstatus).toBe(2);
    expect((await client.getDoc("Receipt", "REC-1")).doc.docstatus).toBe(2);
    expect((await client.cancelDoc("Sales Invoice", "SI-1")).docstatus).toBe(2);
  });

  it("is_document_amended: no message until an amendment exists; amend names X-1 then X-2 and needs a cancelled source", async () => {
    const { client } = linked();
    const ask = () => client.call("frappe.client.is_document_amended", { doctype: "Sales Invoice", docname: "SI-1" }).then((r) => r.message);
    expect(await ask()).toBeUndefined();
    expect(await client.saveDoc({ doctype: "Sales Invoice", name: "new-si", __islocal: 1, customer: "ACME", amended_from: "SI-1" }, "Save").catch((e) => e.kind)).toBe("validation");
    await client.cancelDoc("Sales Invoice", "SI-1");
    const amended = await client.saveDoc({ doctype: "Sales Invoice", name: "new-si", __islocal: 1, customer: "ACME", amended_from: "SI-1" }, "Save");
    expect(amended.name).toBe("SI-1-1");
    expect(await ask()).toBe("SI-1-1");
    await client.saveDoc(amended, "Submit");
    await client.cancelDoc("Sales Invoice", "SI-1-1");
    expect((await client.saveDoc({ doctype: "Sales Invoice", name: "new-si-2", __islocal: 1, customer: "ACME", amended_from: "SI-1-1" }, "Save")).name).toBe("SI-1-2");
  });
});

describe("autoincrement naming (A2 browser finding)", () => {
  it("continues after the highest numeric name among seeded and stored docs (AUTO_INCREMENT)", async () => {
    const DEAL: DocTypeMeta = { name: "Serve Fast Deal", autoname: "autoincrement", fields: [{ fieldname: "title", fieldtype: "Data" }] };
    const transport = createFixtureTransport({
      meta: { "Serve Fast Deal": [DEAL] },
      docs: { "Serve Fast Deal": [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ doctype: "Serve Fast Deal", name: String(i), title: `D${i}` })) },
    }, { now: NOW });
    const client = createFrappeClient({ transport });
    const a = await client.saveDoc({ doctype: "Serve Fast Deal", name: "new-serve-fast-deal-1", __islocal: 1, title: "New" }, "Save");
    expect(a.name).toBe("9");
    const b = await client.saveDoc({ doctype: "Serve Fast Deal", name: "new-serve-fast-deal-2", __islocal: 1, title: "Next" }, "Save");
    expect(b.name).toBe("10");
    await client.deleteDoc("Serve Fast Deal", "10");
    expect((await client.saveDoc({ doctype: "Serve Fast Deal", name: "new-3", __islocal: 1, title: "x" }, "Save")).name).toBe("11"); // a deleted number is not reused
  });
});

describe("server-side text in the timeline (A4 trace): assignment comments and Version values", () => {
  const NOTE: DocTypeMeta = {
    name: "Deal Note", track_changes: 1,
    fields: [
      { fieldname: "closing", fieldtype: "Date", label: "Closing" },
      { fieldname: "met_at", fieldtype: "Datetime", label: "Met at" },
      { fieldname: "share", fieldtype: "Percent", label: "Share" },
      { fieldname: "weight", fieldtype: "Float", label: "Weight", precision: "3" },
      { fieldname: "done", fieldtype: "Check", label: "Done" },
      { fieldname: "count", fieldtype: "Int", label: "Count" },
      { fieldname: "body", fieldtype: "Text Editor", label: "Body" },
      { fieldname: "notes", fieldtype: "Small Text", label: "Notes" },
      { fieldname: "stage", fieldtype: "Select", label: "Stage", options: "Open\nWon" },
    ],
  };
  function setupNote() {
    const transport = createFixtureTransport({
      meta: { "Deal Note": [NOTE], ToDo: docsOf(todoEn) },
      docs: {
        "Deal Note": [{ doctype: "Deal Note", name: "DN-1", closing: "2026-11-01", met_at: "2026-11-01 09:00:00", share: 12, weight: 1, done: 0, count: 1, body: "<p>a</p>", notes: "x", stage: "Open", modified: "2026-11-01 10:00:00.000000" }],
        User: [{ doctype: "User", name: "ann@x.com", full_name: "Ann Smith" }, { doctype: "User", name: "Administrator", full_name: "Administrator" }],
      },
    }, { now: NOW, formatContext: { dateFormat: "dd-mm-yyyy", timeFormat: "HH:mm", timeZone: { system: "UTC", user: "Asia/Riyadh" }, translate: (t) => (t === "Won" ? "ربح" : t) } });
    return { transport, client: createFrappeClient({ transport }) };
  }

  it("Version values go through the server's formatting; blacklisted (Text Editor) and falsy values stay raw", async () => {
    const { client } = setupNote();
    const { doc } = await client.getDoc("Deal Note", "DN-1");
    await client.saveDoc({ ...doc, closing: "2026-11-05", met_at: "2026-11-05 18:30:00", share: 12.5, weight: 1234.5, done: 1, count: 2, body: "<p>b</p>", notes: "line1\nline2", stage: "Won" }, "Save");
    const changed = JSON.parse((await client.getDocInfo("Deal Note", "DN-1")).versions[0].data).changed as unknown[][];
    expect(Object.fromEntries(changed.map(([f, a, b]) => [f as string, [a, b]]))).toEqual({
      closing: ["01-11-2026", "05-11-2026"],
      met_at: ["01-11-2026 09:00", "05-11-2026 18:30"], // server format_datetime: no time-zone conversion
      share: ["12.0%", "12.5%"], // f"{flt(v, 2)}%"
      weight: ["1", "1,234.50"], // fmt_money: integral → 0 decimals; precision 3 narrowed to the format's 2
      done: [0, 1], // falsy stays raw; Check is not formatted by format_value
      count: [1, 2], // Int unchanged
      body: ["<p>a</p>", "<p>b</p>"], // Text Editor is blacklisted (version.py:120)
      notes: ["x", "line1<br>line2"],
      stage: ["Open", "ربح"], // Select translated
    });
  });

  it("assignment comments carry full names, as todo.py validate writes them", async () => {
    const { client } = setupNote();
    await client.addAssignment("Deal Note", "DN-1", ["ann@x.com", "Administrator"], { description: "Call back" });
    await client.removeAssignment("Deal Note", "DN-1", "ann@x.com");
    await client.removeAssignment("Deal Note", "DN-1", "Administrator");
    const logs = (await client.getDocInfo("Deal Note", "DN-1")).assignment_logs as { comment_type: string; content: string }[];
    expect(logs.map((l) => [l.comment_type, l.content])).toEqual([
      ["Assigned", "Administrator assigned Ann Smith: Call back"],
      ["Assigned", "Administrator self assigned this task: Call back"],
      ["Assignment Completed", "Assignment of Ann Smith removed by Administrator"],
      ["Assignment Completed", "Administrator removed their assignment."],
    ]);
  });
});
