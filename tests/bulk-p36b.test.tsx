/**
 * P36b workstream B "bulk" — Desk's bulk Submit / Cancel on the checked records of the Frappe TABLE views.
 *
 * Read from Frappe 15.110:
 * - list_view.js:1855-2128 get_actions_menu_items (bulk_submit :2026-2051, bulk_cancel :1999-2024, gates :2108-2120);
 * - views/reports/report_view.js:9 (ReportView extends ListView: the same Actions menu), :360 checkboxColumn, :371-374;
 * - bulk_operations.js:275-308 submit_or_cancel (failed names → frappe.throw "Cannot submit {0}."; `done` only when
 *   `failed.length < docnames.length` — never for a queued job);
 * - desk/doctype/bulk_update/bulk_update.py:51-114 (< 20 now, 20–500 enqueued, > 500 refused; per-document docstatus
 *   eligibility, exceptions → failed).
 * Evidence: jsdom + the in-package SIMULATOR (`createFixtureTransport` with server-side permissions and the
 * `bulkUpdateHandler` of handlers/list.ts). Nothing here ran against a real Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, type ListPrefs } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, FrappeError, type FrappeSession, type FrappeTransport } from "../src/frappe";
import { FrappeReportView, FrappeViews } from "../src/frappe/views";
import { createFixtureTransport, type FixtureTransport } from "../src/frappe/testing";
import { BULK_UPDATE_METHOD, bulkUpdateHandler, submittedBackLink } from "../src/frappe/testing/handlers/list";
import { uniqueNames } from "../src/frappe/list/useFrappeSelectionActions";
import { defaultMessages } from "../src/theme/messages";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];

// ---- fixture: a submittable DocType with a child table, and a DocType that links to it --------------------------------
const PERMS = [
  { role: "Accounts Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 },
  { role: "Submitter", permlevel: 0, read: 1, write: 1, create: 1, submit: 1 },
  { role: "Accounts User", permlevel: 0, read: 1, write: 1, create: 1 },
];
const INVOICE: DocTypeMeta = {
  name: "Bulk Invoice", autoname: "hash", is_submittable: 1, title_field: "customer", sort_field: "name", sort_order: "asc",
  permissions: PERMS,
  fields: [
    { fieldname: "ref", fieldtype: "Data", label: "Ref", in_list_view: 1 },
    { fieldname: "customer", fieldtype: "Data", label: "Customer", reqd: 1, in_list_view: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount", in_list_view: 1 },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
    { fieldname: "items", fieldtype: "Table", label: "Items", options: "Bulk Invoice Item" },
  ],
} as DocTypeMeta;
const INVOICE_ITEM: DocTypeMeta = { name: "Bulk Invoice Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 }] } as DocTypeMeta;
const PAYMENT: DocTypeMeta = {
  name: "Bulk Payment", autoname: "hash", is_submittable: 1, permissions: PERMS,
  fields: [{ fieldname: "invoice", fieldtype: "Link", label: "Invoice", options: "Bulk Invoice", in_list_view: 1 }],
} as DocTypeMeta;
const WF: WorkflowInfo = {
  name: "Invoice Flow", document_type: "Bulk Invoice", workflow_state_field: "workflow_state",
  states: [{ state: "Draft", doc_status: "0", allow_edit: "Accounts Manager" }, { state: "Approved", doc_status: "1", allow_edit: "Accounts Manager" }],
  transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Accounts Manager", allow_self_approval: 1 }],
} as WorkflowInfo;

const inv = (name: string, docstatus: 0 | 1 | 2, extra: Record<string, unknown> = {}) =>
  ({ doctype: "Bulk Invoice", name, ref: `ref:${name}`, customer: `Customer ${name}`, amount: 100, docstatus, modified: "2026-11-01 10:00:00.000000", ...extra }) as unknown as FrappeDoc;
/** INV-1, INV-2 drafts; INV-3 a draft without its mandatory customer; INV-4 submitted; INV-5 submitted and linked from
 *  the submitted PAY-1; INV-6 cancelled. */
const DOCS = () => [
  inv("INV-1", 0, { items: [{ item: "Widget" }, { item: "Gadget" }] }), inv("INV-2", 0), inv("INV-3", 0, { customer: null }),
  inv("INV-4", 1), inv("INV-5", 1), inv("INV-6", 2),
];

interface Site { transport: FixtureTransport; session: FrappeSession; calls: (m: string) => { method: string; args: Record<string, unknown> }[]; doc: (n: string) => FrappeDoc | undefined }
function site(opts: { roles?: string[]; docs?: FrappeDoc[]; workflow?: boolean } = {}): Site {
  // eslint-disable-next-line prefer-const
  let transport: FixtureTransport;
  const backend: FixtureBackend = {
    meta: { "Bulk Invoice": [INVOICE, INVOICE_ITEM], "Bulk Invoice Item": [INVOICE_ITEM], "Bulk Payment": [PAYMENT] },
    docs: {
      "Bulk Invoice": opts.docs ?? DOCS(),
      "Bulk Payment": [{ doctype: "Bulk Payment", name: "PAY-1", invoice: "INV-5", docstatus: 1, modified: "2026-11-01 10:00:00.000000" } as unknown as FrappeDoc],
    },
    ...(opts.workflow ? { workflows: { "Bulk Invoice": WF } } : {}),
  };
  transport = createFixtureTransport(backend, {
    permissions: { user: "acc@x.com", roles: opts.roles ?? ["Accounts Manager"] },
    handlers: { [BULK_UPDATE_METHOD]: bulkUpdateHandler(() => transport) },
  });
  return {
    transport,
    session: transport.store.session!,
    calls: (m) => transport.store.calls.filter((c) => c.method === m) as never,
    doc: (n) => transport.store.docs.get("Bulk Invoice")?.get(n),
  };
}

function mountView(view: "report" | "list" | "views", s: Site, props: Record<string, unknown> = {}, opts: { prefs?: ListPrefs; language?: "en" | "ar"; transport?: FrappeTransport } = {}) {
  const client = createFrappeClient({ transport: opts.transport ?? s.transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const storage = opts.prefs ? { prefs: { load: () => opts.prefs!, save: () => {} }, saved: null } : null;
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.language ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={s.session}>
        {view === "report" ? <FrappeReportView doctype="Bulk Invoice" storage={storage} {...props} />
          : view === "list" ? <FrappeListView doctype="Bulk Invoice" storage={storage} rowMeta={false} like={false} {...props} />
          : <FrappeViews doctype="Bulk Invoice" defaultView="report" {...props} />}
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}

const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const rowOf = (name: string) => bodyRows().find((tr) => tr.textContent?.includes(`ref:${name}`))!;
const checkRow = (name: string) => fireEvent.click(within(rowOf(name)).getAllByRole("checkbox")[0]);
const ready = async (n = 6) => waitFor(() => expect(bodyRows()).toHaveLength(n));
const openActions = async () => fireEvent.keyDown(await screen.findByTestId("sf-list-actions"), { key: "Enter" });
const menuLabels = async () => { await openActions(); return (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim()); };
const closeMenu = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
const runAction = async (name: string) => { await openActions(); fireEvent.click(await screen.findByRole("menuitem", { name })); };
const confirm = async () => fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
const selected = (n: number) => document.querySelector("thead")?.textContent?.includes(en("listItemsSelected").replace("{n}", String(n))) ?? false;
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
const status = () => screen.getAllByRole("status").map((e) => e.textContent ?? "").join(" | ");
const SUBMIT = en("listBulkSubmit");
const CANCEL = en("listBulkCancel");

// =====================================================================================================================
describe("P36B.bulk the gap: Desk's Report view has the list's Actions menu (report_view.js:9) — now FrappeReportView too", () => {
  it("P36B.bulk.1 without `bulk` the Report view is unchanged: no checkboxes, no Actions", async () => {
    mountView("report", site());
    await ready();
    expect(within(rowOf("INV-1")).queryByRole("checkbox")).toBeNull();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
  });

  it("LV.F8 / LV.F9 P36B.bulk.2 Report view, Accounts Manager on a submittable DocType: Actions = Desk's order with Submit and Cancel between Print and Delete", async () => {
    mountView("report", site(), { bulk: {} });
    await ready();
    checkRow("INV-1");
    expect(await menuLabels()).toEqual([en("listBulkEdit"), en("listBulkExport"), en("listBulkAssign"), en("listBulkClearAssignment"), en("listBulkAssignmentRule"), en("listBulkAddTags"), en("listBulkPrint"), SUBMIT, CANCEL, en("listBulkDelete")]);
  });

  it("LV.F12 P36B.bulk.3 permissions: no submit / cancel right → neither offered (Desk: has_perm submit / can_cancel, list_view.js:1877-1879, 2108-2120); submit without cancel → Submit only", async () => {
    mountView("report", site({ roles: ["Accounts User"] }), { bulk: {} });
    await ready();
    checkRow("INV-1");
    let labels = await menuLabels();
    expect(labels).not.toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
    expect(labels).toContain(en("listBulkEdit")); // negative control: the menu is there, only the rights differ
    cleanup();
    mountView("report", site({ roles: ["Submitter"] }), { bulk: {} });
    await ready();
    checkRow("INV-1");
    labels = await menuLabels();
    expect(labels).toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
  });

  it("LV.F12 P36B.bulk.4 an active Workflow hides Submit / Cancel (and Edit / Delete), and adds the workflow's actions (list_view.js:1881-1887, 2108-2125)", async () => {
    mountView("report", site({ workflow: true, docs: DOCS().map((d) => ({ ...d, workflow_state: Number(d.docstatus) === 0 ? "Draft" : "Approved" })) }), { bulk: {} });
    await ready();
    checkRow("INV-1");
    const labels = await menuLabels();
    expect(labels).not.toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
    expect(labels).not.toContain(en("listBulkEdit"));
    expect(labels).not.toContain(en("listBulkDelete"));
    expect(labels).toContain(en("listBulkPrint"));
    // the workflow's own actions, asked from the server when the menu opens
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Approve" })).toBeTruthy());
  });
});

// =====================================================================================================================
describe("P36B.bulk Submit / Cancel outcomes in the Report view (SIMULATED server: bulk_update.py)", () => {
  it("LV.F8 P36B.bulk.5 every document submitted: request shape = Desk's, selection cleared, the list reloaded from the server", async () => {
    const s = site();
    mountView("report", s, { bulk: {} });
    await ready();
    checkRow("INV-1"); checkRow("INV-2");
    const before = s.calls("frappe.desk.reportview.get").length;
    await runAction(SUBMIT);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkSubmitConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    const args = s.calls(BULK_UPDATE_METHOD)[0].args;
    expect(args).toEqual({ doctype: "Bulk Invoice", docnames: JSON.stringify(["INV-1", "INV-2"]), action: "submit" });
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull()); // cleared
    await waitFor(() => expect(s.calls("frappe.desk.reportview.get").length).toBeGreaterThan(before)); // reloaded
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(1);
    expect(status()).toContain(en("listBulkResult").replace("{ok}", "2").replace("{failed}", "0"));
  });

  it("LV.F8 P36B.bulk.6 mixed docstatus: Desk sends every checked name; the server submits the draft and reports the submitted / cancelled ones; the selection STAYS, the list reloads, the message names them", async () => {
    const s = site();
    mountView("report", s, { bulk: {} });
    await ready();
    checkRow("INV-2"); checkRow("INV-4"); checkRow("INV-6");
    const before = s.calls("frappe.desk.reportview.get").length;
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain("Cannot submit INV-4 and INV-6."));
    expect(JSON.parse(String(s.calls(BULK_UPDATE_METHOD)[0].args.docnames))).toEqual(["INV-2", "INV-4", "INV-6"]);
    expect(status()).toContain(en("listBulkResult").replace("{ok}", "1").replace("{failed}", "2"));
    expect(selected(3)).toBe(true); // kept: not every document succeeded
    await waitFor(() => expect(s.calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(1); // untouched
    expect(Number(s.doc("INV-6")!.docstatus)).toBe(2);
  });

  it("LV.F8 P36B.bulk.7 a draft that fails validation (mandatory customer) is reported per document, the others go through", async () => {
    const s = site();
    mountView("report", s, { bulk: {} });
    await ready();
    checkRow("INV-1"); checkRow("INV-3");
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain("Cannot submit INV-3."));
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-3")!.docstatus)).toBe(0);
    expect(selected(2)).toBe(true);
  });

  it("LV.F9 P36B.bulk.8 Cancel: the submitted one linked from a submitted Payment is refused (check_no_back_links_exist), the other is cancelled; selection kept", async () => {
    const s = site();
    mountView("report", s, { bulk: {} });
    await ready();
    checkRow("INV-4"); checkRow("INV-5");
    await runAction(CANCEL);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkCancelConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(status()).toContain("Cannot cancel INV-5."));
    expect(s.calls(BULK_UPDATE_METHOD)[0].args).toEqual({ doctype: "Bulk Invoice", docnames: JSON.stringify(["INV-4", "INV-5"]), action: "cancel" });
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(2);
    expect(Number(s.doc("INV-5")!.docstatus)).toBe(1);
    expect(selected(2)).toBe(true);
  });

  it("LV.F8 P36B.bulk.9 the SERVER refuses (client told it may submit, the role may not): every name reported failed; nothing cleared, nothing reloaded, no document changed", async () => {
    const s = site({ roles: ["Accounts User"] });
    // the client-side gate is overridden on purpose: only the server decides here (negative control of bulk.3)
    mountView("report", s, { bulk: { permissions: { read: true, write: true, submit: true, cancel: true } } });
    await ready();
    checkRow("INV-1"); checkRow("INV-2");
    const before = s.calls("frappe.desk.reportview.get").length;
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain("Cannot submit INV-1 and INV-2."));
    expect(status()).toContain(en("listBulkResult").replace("{ok}", "0").replace("{failed}", "2"));
    await settle();
    expect(selected(2)).toBe(true);
    expect(s.calls("frappe.desk.reportview.get").length).toBe(before); // Desk: no `done` when every name failed
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(0);
  });

  it("LV.F9 P36B.bulk.10 queued (20 names or more, bulk_update.py:58-69): 'queued' is said, the selection STAYS and nothing reloads (Desk skips done)", async () => {
    const docs = Array.from({ length: 22 }, (_, i) => inv(`Q-${String(i + 1).padStart(2, "0")}`, 0));
    const s = site({ docs });
    mountView("report", s, { bulk: {} });
    await ready(20);
    fireEvent.click(within(document.querySelector("thead")!).getAllByRole("checkbox")[0]); // the page: 20 rows
    const before = s.calls("frappe.desk.reportview.get").length;
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(en("listBulkQueued")));
    expect(JSON.parse(String(s.calls(BULK_UPDATE_METHOD)[0].args.docnames))).toHaveLength(20);
    await settle();
    expect(selected(20)).toBe(true);
    expect(s.calls("frappe.desk.reportview.get").length).toBe(before);
  });

  it("P36B.bulk.11 Report rows repeated per child-table row: a document checked on two rows is sent ONCE and counted once", async () => {
    const s = site();
    // a site answers ONE ROW PER CHILD ROW (report_view.js:136, no group_by); the simulator answers the first child row
    // only (SIMULATED), so this wrapper adds INV-1's second child row as a real site would
    const transport: FrappeTransport = async (m, a) => {
      const res = await s.transport(m, a);
      if (m !== "frappe.desk.reportview.get") return res;
      const msg = res.message as { keys: string[]; values: unknown[][] };
      const i = msg.values.findIndex((v) => v.includes("ref:INV-1"));
      // the simulator echoes the SQL aliases with their quotes (the client strips them)
      const k = msg.keys.findIndex((x) => x.includes("Bulk Invoice Item:item"));
      const kn = msg.keys.findIndex((x) => x.includes("Bulk Invoice Item:name"));
      if (i < 0 || k < 0 || kn < 0) return res;
      const twin = [...msg.values[i]]; twin[k] = "Gadget"; twin[kn] = "child-2";
      return { ...res, message: { ...msg, values: [...msg.values.slice(0, i + 1), twin, ...msg.values.slice(i + 1)] } };
    };
    mountView("report", s, { bulk: {} }, { prefs: { visible: ["ref", "Bulk Invoice Item:item"] }, transport });
    await waitFor(() => expect(bodyRows().filter((tr) => tr.textContent?.includes("ref:INV-1"))).toHaveLength(2));
    const rows = bodyRows().filter((tr) => tr.textContent?.includes("ref:INV-1"));
    for (const tr of rows) fireEvent.click(within(tr).getAllByRole("checkbox")[0]);
    expect(selected(2)).toBe(true);
    await runAction(SUBMIT);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkSubmitConfirm").replace("{n}", "1"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(s.calls(BULK_UPDATE_METHOD)[0].args.docnames).toBe(JSON.stringify(["INV-1"]));
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull()); // the only document succeeded → cleared
    expect(uniqueNames(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("P36B.bulk.12 the opt-in bar mode offers the same Submit / Cancel buttons", async () => {
    const s = site();
    mountView("report", s, { bulk: {}, selectionMode: "bar" });
    await ready();
    checkRow("INV-1");
    const bar = await screen.findByRole("region", { name: /selected/ });
    expect(within(bar).getByRole("button", { name: SUBMIT })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: CANCEL })).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: SUBMIT }));
    await confirm();
    await waitFor(() => expect(Number(s.doc("INV-1")!.docstatus)).toBe(1));
    await waitFor(() => expect(screen.queryByRole("region", { name: /selected/ })).toBeNull());
  });

  it("P36B.bulk.13 Arabic: Desk's failure sentence in the ar catalogue", async () => {
    const s = site();
    mountView("report", s, { bulk: {} }, { language: "ar" });
    await ready();
    checkRow("INV-2"); checkRow("INV-4");
    await runAction(defaultMessages.ar.listBulkSubmit);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: defaultMessages.ar.confirm }));
    await waitFor(() => expect(status()).toContain("تعذّر إرسال INV-4."));
  });
});

// =====================================================================================================================
describe("P36B.bulk FrappeListView and FrappeViews on the same simulated server", () => {
  it("LV.F8 P36B.bulk.14 List view (header default): mixed Submit → per-document result, selection kept; then all-success Cancel → cleared", async () => {
    const s = site();
    mountView("list", s, { bulk: {} });
    await ready();
    checkRow("INV-1"); checkRow("INV-4");
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain("Cannot submit INV-4."));
    expect(selected(2)).toBe(true);
    // both are submitted now (INV-1 by the server, INV-4 already): Cancel succeeds for both → cleared
    await runAction(CANCEL);
    await confirm();
    await waitFor(() => expect(Number(s.doc("INV-4")!.docstatus)).toBe(2));
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(2);
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull());
  });

  it("P36B.bulk.15 FrappeViews `bulk` reaches the Report view (and the List view)", async () => {
    const s = site();
    mountView("views", s, { bulk: {} });
    await ready();
    checkRow("INV-1");
    const labels = await menuLabels();
    expect(labels).toContain(SUBMIT);
    expect(labels).toContain(CANCEL);
    closeMenu();
  });
});

// =====================================================================================================================
describe("P36B.bulk simulator fidelity: bulkUpdateHandler vs bulk_update.py:51-114", () => {
  const call = (s: Site, args: Record<string, unknown>) => s.transport(BULK_UPDATE_METHOD, { doctype: "Bulk Invoice", ...args });

  it("P36B.bulk.16 fewer than 20: the answer is the failed names; eligibility by docstatus (submit drafts only, cancel submitted only, update not cancelled)", async () => {
    const s = site();
    expect((await call(s, { docnames: JSON.stringify(["INV-1", "INV-4", "INV-6"]), action: "submit" })).message).toEqual(["INV-4", "INV-6"]);
    expect((await call(s, { docnames: JSON.stringify(["INV-2", "INV-4"]), action: "cancel" })).message).toEqual(["INV-2"]);
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(2);
    expect((await call(s, { docnames: JSON.stringify(["INV-2", "INV-6"]), action: "update", data: JSON.stringify({ amount: 5 }) })).message).toEqual(["INV-6"]);
    expect(s.doc("INV-2")!.amount).toBe(5);
    // the action defaults to "submit" (the Python signature)
    expect((await call(s, { docnames: JSON.stringify(["INV-2"]) })).message).toEqual([]);
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(1);
  });

  it("P36B.bulk.17 per-document permission: a role without submit gets every name back as failed (document.py:880-915), not a 403", async () => {
    const s = site({ roles: ["Accounts User"] });
    expect((await call(s, { docnames: JSON.stringify(["INV-1", "INV-2"]), action: "submit" })).message).toEqual(["INV-1", "INV-2"]);
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(0);
    const sub = site({ roles: ["Submitter"] });
    expect((await call(sub, { docnames: JSON.stringify(["INV-4"]), action: "cancel" })).message).toEqual(["INV-4"]); // no cancel right
    expect((await call(sub, { docnames: JSON.stringify(["INV-1"]), action: "submit" })).message).toEqual([]);
  });

  it("P36B.bulk.18 an unknown name fails the WHOLE request (get_doc outside the try, :82) — earlier documents stay changed (commit per document)", async () => {
    const s = site();
    const err = await call(s, { docnames: JSON.stringify(["INV-1", "NOPE", "INV-2"]), action: "submit" }).catch((e) => e);
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).excType).toBe("DoesNotExistError");
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(0);
  });

  it("P36B.bulk.19 20–500 names: no `message` + the alert 'Bulk operation is enqueued in background.'; more than 500: 'Too Many Documents'", async () => {
    const docs = Array.from({ length: 20 }, (_, i) => inv(`Q-${i}`, 0));
    const s = site({ docs });
    const res = await call(s, { docnames: JSON.stringify(docs.map((d) => d.name)), action: "submit" });
    expect(res.message).toBeUndefined();
    expect(String(res._server_messages)).toContain("Bulk operation is enqueued in background.");
    expect(Number(s.doc("Q-0")!.docstatus)).toBe(1); // SIMULATED: the job ran at once
    const err = await call(s, { docnames: JSON.stringify(Array.from({ length: 501 }, (_, i) => `X-${i}`)), action: "submit" }).catch((e) => e);
    expect((err as FrappeError).excType).toBe("ValidationError");
    expect((err as FrappeError).message).toContain("Bulk operations only support up to 500 documents.");
    // 19 names: still answered now
    const s19 = site({ docs: docs.slice(0, 19) });
    expect((await call(s19, { docnames: JSON.stringify(docs.slice(0, 19).map((d) => d.name)), action: "submit" })).message).toEqual([]);
  });

  it("P36B.bulk.20 back links: a SUBMITTED linking document blocks Cancel; a draft or cancelled one does not (delete_doc.py:314-317)", async () => {
    const s = site();
    expect(submittedBackLink(s.transport.store, "Bulk Invoice", "INV-5")).toEqual({ doctype: "Bulk Payment", name: "PAY-1" });
    s.transport.store.docs.get("Bulk Payment")!.get("PAY-1")!.docstatus = 2;
    expect(submittedBackLink(s.transport.store, "Bulk Invoice", "INV-5")).toBeNull();
    expect((await call(s, { docnames: JSON.stringify(["INV-5"]), action: "cancel" })).message).toEqual([]);
  });
});
