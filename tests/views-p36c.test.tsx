/**
 * P36c "views" — owner decisions 5 and 3.
 *
 * Decision 5: Desk's Actions on the checked cards of the IMAGE view. Read from Frappe 15.110:
 * - views/image/image_view.js:6 (`ImageView extends ListView`), :17-21 `setup_view` (keeps `setup_check_events`, not
 *   `render_header`), :23-31 `set_fields`, :113-114 the card's `list-row-checkbox`, :161-177 `get_header_html` commented out;
 * - list/list_view.js:157-179 page head (primary action + Actions menu items), :285-296 `set_primary_action`,
 *   :590-598 `toggle_actions_menu_button`, :1375-1429 `setup_check_events`, :1613-1634 `on_row_checked`,
 *   :1643-1655 `get_checked_items` / `clear_checked_items`, :1855-2128 `get_actions_menu_items`.
 * Decision 3: the Report view sends a document shown on several rows ONCE, for every action that takes names, with
 * per-DOCUMENT counts and selection outcome.
 *
 * Evidence: jsdom + the in-package SIMULATOR (`createFixtureTransport` with server-side permissions and the
 * `bulkUpdateHandler` of handlers/list.ts). Nothing here ran against a real Frappe site.
 */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, type ListPrefs } from "../src";
import { ImageView } from "../src/list/views";
import { FrappeProvider, createFrappeClient, type FrappeSession, type FrappeTransport } from "../src/frappe";
import { FrappeImageView, FrappeReportView, FrappeViews } from "../src/frappe/views";
import { createFixtureTransport, type FixtureTransport } from "../src/frappe/testing";
import { BULK_UPDATE_METHOD, bulkUpdateHandler } from "../src/frappe/testing/handlers/list";
import { WORKFLOW_BULK_METHODS } from "../src/frappe/list/workflowBulk";
import { PRINT_METHODS } from "../src/frappe/list/print";
import { DOWNLOAD_TEMPLATE_METHOD } from "../src/frappe/list/export";
import { defaultMessages } from "../src/theme/messages";
import { P36cViewsPage } from "../showcase/src/pages/p36c-views";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];

// ---- fixture: a submittable DocType with an image field and a child table, and a DocType that links to it ------------
const PERMS = [
  { role: "Accounts Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 },
  { role: "Submitter", permlevel: 0, read: 1, write: 1, create: 1, submit: 1 },
  { role: "Accounts User", permlevel: 0, read: 1, write: 1, create: 1 },
];
const fields = [
  { fieldname: "ref", fieldtype: "Data", label: "Ref", in_list_view: 1 },
  { fieldname: "customer", fieldtype: "Data", label: "Customer", reqd: 1, in_list_view: 1 },
  { fieldname: "photo", fieldtype: "Attach Image", label: "Photo" },
  { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
  { fieldname: "items", fieldtype: "Table", label: "Items", options: "Bulk Invoice Item" },
];
const INVOICE: DocTypeMeta = {
  name: "Bulk Invoice", autoname: "hash", is_submittable: 1, title_field: "customer", image_field: "photo", sort_field: "name", sort_order: "asc",
  permissions: PERMS, fields,
} as unknown as DocTypeMeta;
/** The same DocType, not submittable (applicability: Desk offers Submit / Cancel only on a submittable DocType). */
const NOT_SUBMITTABLE: DocTypeMeta = { ...INVOICE, is_submittable: 0, permissions: PERMS.map((p) => ({ ...p, submit: 0, cancel: 0 })) } as unknown as DocTypeMeta;
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

const twoItems = { items: [{ item: "Widget" }, { item: "Gadget" }] };
const inv = (name: string, docstatus: 0 | 1 | 2, extra: Record<string, unknown> = {}) =>
  ({ doctype: "Bulk Invoice", name, ref: `ref:${name}`, customer: `Customer ${name}`, docstatus, modified: "2026-11-01 10:00:00.000000", ...twoItems, ...extra }) as unknown as FrappeDoc;
/** INV-1, INV-2 drafts; INV-3 a draft without its mandatory customer; INV-4 submitted; INV-5 submitted and linked from
 *  the submitted PAY-1; INV-6 cancelled. Every invoice has two child rows. */
const DOCS = () => [
  inv("INV-1", 0, { photo: "/files/inv-1.png" }), inv("INV-2", 0), inv("INV-3", 0, { customer: null }),
  inv("INV-4", 1), inv("INV-5", 1), inv("INV-6", 2),
];

interface Site { transport: FixtureTransport; session: FrappeSession; calls: (m: string) => { method: string; args: Record<string, unknown> }[]; doc: (n: string) => FrappeDoc | undefined }
function site(opts: { roles?: string[]; docs?: FrappeDoc[]; workflow?: boolean; meta?: DocTypeMeta } = {}): Site {
  // eslint-disable-next-line prefer-const
  let transport: FixtureTransport;
  const backend: FixtureBackend = {
    meta: { "Bulk Invoice": [opts.meta ?? INVOICE, INVOICE_ITEM], "Bulk Invoice Item": [INVOICE_ITEM], "Bulk Payment": [PAYMENT] },
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

type View = "image" | "report" | "views";
function mount(view: View, s: Site, props: Record<string, unknown> = {}, opts: { prefs?: ListPrefs; language?: "en" | "ar"; transport?: FrappeTransport } = {}) {
  const client = createFrappeClient({ transport: opts.transport ?? s.transport, files: s.transport.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const storage = opts.prefs ? { prefs: { load: () => opts.prefs!, save: () => {} }, saved: null } : null;
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.language ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={s.session}>
        {view === "image" ? <FrappeImageView doctype="Bulk Invoice" storage={storage} {...props} />
          : view === "report" ? <FrappeReportView doctype="Bulk Invoice" storage={storage} {...props} />
          : <FrappeViews doctype="Bulk Invoice" defaultView="image" {...props} />}
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}

// ---- Image view helpers -----------------------------------------------------------------------------------------------
const cards = () => screen.queryAllByRole("button", { name: /^Open / });
const cardsReady = async (n = 6) => waitFor(() => expect(cards()).toHaveLength(n));
/** The card's checkbox (Desk's `list-row-checkbox`, image_view.js:113): "Select {title}" — title = customer, else name. */
const cardBox = (name: string) => screen.getAllByRole("checkbox").find((c) => new RegExp(`${name}$`).test(c.getAttribute("aria-label") ?? ""))!;
const checkCard = (name: string) => fireEvent.click(cardBox(name));
const strip = () => screen.queryByTestId("sf-image-selection");
const imgSelected = (n: number) => strip()?.textContent?.includes(en("listItemsSelected").replace("{n}", String(n))) ?? false;
const ADD = "Add Bulk Invoice";
const addButton = <button type="button">{ADD}</button>;

// ---- shared helpers ---------------------------------------------------------------------------------------------------
const openActions = async () => fireEvent.keyDown(await screen.findByTestId("sf-list-actions"), { key: "Enter" });
const menuLabels = async () => { await openActions(); return (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim()); };
const runAction = async (name: string) => { await openActions(); fireEvent.click(await screen.findByRole("menuitem", { name })); };
/** The Edit dialog's field picker (a Radix Select). */
const pickField = async (dialog: HTMLElement, label: string) => {
  fireEvent.keyDown(within(dialog).getByRole("combobox", { name: en("listBulkField") }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: label }));
};
const confirm = async () => fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
const status = () => screen.queryAllByRole("status").map((e) => e.textContent ?? "").join(" | ");
const settle = () => act(() => new Promise((r) => setTimeout(r, 80)));
const SUBMIT = en("listBulkSubmit");
const CANCEL = en("listBulkCancel");
const DESK_ORDER = [en("listBulkEdit"), en("listBulkExport"), en("listBulkAssign"), en("listBulkClearAssignment"), en("listBulkAssignmentRule"), en("listBulkAddTags"), en("listBulkPrint"), SUBMIT, CANCEL, en("listBulkDelete")];
const result = (ok: number, failed: number) => en("listBulkResult").replace("{ok}", String(ok)).replace("{failed}", String(failed));
const getCount = (s: Site) => s.calls("frappe.desk.reportview.get").length;

// =====================================================================================================================
describe("P36C.views Image view: selection and the header actions (image_view.js:6, :17-21, :113; list_view.js:590-598, 1613-1634)", () => {
  it("P36C.views.1 without `bulk` the Image view is unchanged: no card checkbox, no Actions, the host's primary action stays", async () => {
    mount("image", site(), { primaryAction: addButton });
    await cardsReady();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
  });

  it("LV.H5 P36C.views.2 a card checkbox swaps Add ↔ Actions; '{n} items selected' + Clear; Clear brings Add back; Space on a focused card selects it (keyboard)", async () => {
    mount("image", site(), { bulk: {}, primaryAction: addButton });
    await cardsReady();
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    expect(strip()).toBeNull();
    checkCard("INV-1");
    expect(await screen.findByTestId("sf-list-actions")).toBeTruthy();
    expect(screen.queryByRole("button", { name: ADD })).toBeNull(); // replaced in the same place (toggle_actions_menu_button)
    expect(imgSelected(1)).toBe(true);
    // keyboard: the card's open button takes Space as "toggle selection" (ImageGrid)
    const card2 = cards().find((c) => c.getAttribute("aria-label")?.includes("INV-2"))!;
    card2.focus();
    fireEvent.keyDown(card2, { key: " " });
    await waitFor(() => expect(imgSelected(2)).toBe(true));
    expect(card2.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(strip()!).getByRole("button", { name: en("clearSelection") }));
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull());
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    expect(strip()).toBeNull();
  });

  it("LV.F12 P36C.views.3 actions per permission, the List view's gates: Accounts Manager = Desk's order; Submitter: Submit not Cancel; Accounts User: neither (Edit still there)", async () => {
    mount("image", site(), { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    expect(await menuLabels()).toEqual(DESK_ORDER);
    cleanup();
    mount("image", site({ roles: ["Submitter"] }), { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    let labels = await menuLabels();
    expect(labels).toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
    expect(labels).not.toContain(en("listBulkDelete")); // no delete right
    cleanup();
    mount("image", site({ roles: ["Accounts User"] }), { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    labels = await menuLabels();
    expect(labels).not.toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
    expect(labels).not.toContain(en("listBulkPrint")); // no print right
    expect(labels).toContain(en("listBulkEdit")); // negative control: the menu is there, only the rights differ
  });

  it("LV.F12 P36C.views.4 applicability: a NOT submittable DocType offers no Submit / Cancel; an active Workflow hides Submit / Cancel / Edit / Delete and adds its actions", async () => {
    mount("image", site({ meta: NOT_SUBMITTABLE }), { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    let labels = await menuLabels();
    expect(labels).not.toContain(SUBMIT);
    expect(labels).not.toContain(CANCEL);
    expect(labels).toContain(en("listBulkDelete"));
    cleanup();
    mount("image", site({ workflow: true, docs: DOCS().map((d) => ({ ...d, workflow_state: Number(d.docstatus) === 0 ? "Draft" : "Approved" })) }), { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    labels = await menuLabels();
    for (const hidden of [SUBMIT, CANCEL, en("listBulkEdit"), en("listBulkDelete")]) expect(labels).not.toContain(hidden);
    expect(labels).toContain(en("listBulkPrint"));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Approve" })).toBeTruthy());
  });

  it("LV.F8 P36C.views.5 every document submitted: Desk's request, selection cleared (Add comes back), the cards reloaded from the server", async () => {
    const s = site();
    mount("image", s, { bulk: {}, primaryAction: addButton });
    await cardsReady();
    checkCard("INV-1"); checkCard("INV-2");
    const before = getCount(s);
    await runAction(SUBMIT);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkSubmitConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(s.calls(BULK_UPDATE_METHOD)[0].args).toEqual({ doctype: "Bulk Invoice", docnames: JSON.stringify(["INV-1", "INV-2"]), action: "submit" });
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull());
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    await waitFor(() => expect(getCount(s)).toBeGreaterThan(before));
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(1);
    expect(status()).toContain(result(2, 0));
  });

  it("LV.F8 P36C.views.6 mixed selection (draft + submitted + cancelled): every name sent, partial failure KEEPS the selection, the cards reload, Desk's sentence names the failures", async () => {
    const s = site();
    mount("image", s, { bulk: {} });
    await cardsReady();
    checkCard("INV-2"); checkCard("INV-4"); checkCard("INV-6");
    const before = getCount(s);
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(result(1, 2)));
    expect(s.calls(BULK_UPDATE_METHOD)[0].args.docnames).toBe(JSON.stringify(["INV-2", "INV-4", "INV-6"]));
    expect(status()).toContain(en("listBulkCannotSubmit").replace("{names}", `INV-4 ${en("recAnd")} INV-6`));
    await waitFor(() => expect(getCount(s)).toBeGreaterThan(before));
    expect(imgSelected(3)).toBe(true); // kept
    expect(screen.getByTestId("sf-list-actions")).toBeTruthy();
    expect(Number(s.doc("INV-2")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(1);
    expect(Number(s.doc("INV-6")!.docstatus)).toBe(2);
  });

  it("LV.F9 P36C.views.7 Cancel: the one linked from a submitted Payment is refused, the other cancelled; selection kept", async () => {
    const s = site();
    mount("image", s, { bulk: {} });
    await cardsReady();
    checkCard("INV-4"); checkCard("INV-5");
    await runAction(CANCEL);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkCancelConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(status()).toContain(result(1, 1)));
    expect(status()).toContain(en("listBulkCannotCancel").replace("{names}", "INV-5"));
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(2);
    expect(Number(s.doc("INV-5")!.docstatus)).toBe(1);
    expect(imgSelected(2)).toBe(true);
  });

  it("LV.F8 P36C.views.8 the SERVER refuses (client told it may submit, the role may not): all failed, nothing cleared, nothing reloaded, no document changed", async () => {
    const s = site({ roles: ["Accounts User"] });
    mount("image", s, { bulk: { permissions: { read: true, write: true, submit: true } } });
    await cardsReady();
    checkCard("INV-1"); checkCard("INV-2");
    const before = getCount(s);
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(result(0, 2)));
    await settle();
    expect(getCount(s)).toBe(before);
    expect(imgSelected(2)).toBe(true);
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(0);
  });

  it("LV.H5 P36C.views.9 select all (this page) from the selection strip, then Submit: every shown document is sent; the drafts go through, the others are named", async () => {
    const s = site();
    mount("image", s, { bulk: {} });
    await cardsReady();
    checkCard("INV-1");
    const all = within(strip()!).getByRole("checkbox", { name: en("selectAll") });
    expect(all.getAttribute("data-state")).toBe("indeterminate");
    fireEvent.click(all);
    await waitFor(() => expect(imgSelected(6)).toBe(true));
    expect(within(strip()!).getByRole("checkbox", { name: en("selectAll") }).getAttribute("data-state")).toBe("checked");
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(JSON.parse(String(s.calls(BULK_UPDATE_METHOD)[0].args.docnames))).toEqual(["INV-1", "INV-2", "INV-3", "INV-4", "INV-5", "INV-6"]);
    await waitFor(() => expect(status()).toContain(result(2, 4))); // INV-3 fails validation; 4, 5, 6 not drafts
    expect(imgSelected(6)).toBe(true);
    // unchecking select-all clears the page
    fireEvent.click(within(strip()!).getByRole("checkbox", { name: en("selectAll") }));
    await waitFor(() => expect(strip()).toBeNull());
  });

  it("P36C.views.10 Delete (confirm → delete_items, cleared + reloaded) and Edit (update; the selection STAYS, Desk's rule)", async () => {
    const s = site();
    mount("image", s, { bulk: {} });
    await cardsReady();
    checkCard("INV-2"); checkCard("INV-3");
    await runAction(en("listBulkEdit"));
    const dlg = await screen.findByRole("dialog", { name: en("listBulkEdit") });
    await pickField(dlg, "Ref");
    fireEvent.change(within(dlg).getByLabelText(en("listBulkValue")), { target: { value: "R-9" } });
    fireEvent.click(within(dlg).getByRole("button", { name: en("listBulkApply") }));
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(s.calls(BULK_UPDATE_METHOD)[0].args).toMatchObject({ docnames: JSON.stringify(["INV-2", "INV-3"]), action: "update", data: JSON.stringify({ ref: "R-9" }) });
    await waitFor(() => expect(s.doc("INV-2")!.ref).toBe("R-9"));
    expect(imgSelected(2)).toBe(true); // Edit keeps the selection
    const before = getCount(s);
    await runAction(en("listBulkDelete"));
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkDeleteConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(s.calls("frappe.desk.reportview.delete_items")).toHaveLength(1));
    expect(s.calls("frappe.desk.reportview.delete_items")[0].args.items).toBe(JSON.stringify(["INV-2", "INV-3"]));
    await waitFor(() => expect(strip()).toBeNull()); // cleared
    await waitFor(() => expect(getCount(s)).toBeGreaterThan(before));
    await cardsReady(4);
  });

  it("P36C.views.11 the opt-in bar mode offers the same actions as buttons on the cards' selection", async () => {
    const s = site();
    mount("image", s, { bulk: {}, selectionMode: "bar", primaryAction: addButton });
    await cardsReady();
    checkCard("INV-1");
    const bar = await screen.findByRole("region", { name: /selected/ });
    expect(within(bar).getByRole("button", { name: SUBMIT })).toBeTruthy();
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy(); // the bar never swaps the primary action
    fireEvent.click(within(bar).getByRole("button", { name: SUBMIT }));
    await confirm();
    await waitFor(() => expect(Number(s.doc("INV-1")!.docstatus)).toBe(1));
  });

  it("P36C.views.12 FrappeViews `bulk` reaches the Image view; Arabic chrome", async () => {
    const s = site();
    mount("views", s, { bulk: {} }, { language: "ar" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^فتح / })).toHaveLength(6));
    const box = screen.getAllByRole("checkbox").find((c) => /INV-1$/.test(c.getAttribute("aria-label") ?? ""))!;
    fireEvent.click(box);
    expect(await screen.findByTestId("sf-list-actions")).toBeTruthy();
    expect(strip()!.textContent).toContain(defaultMessages.ar.listItemsSelected.replace("{n}", "1"));
    await openActions();
    expect(await screen.findByRole("menuitem", { name: defaultMessages.ar.listBulkSubmit })).toBeTruthy();
  });

  it("P36C.views.13 Core ImageView: a plain `selectable` keeps its cards-only selection (no Actions, no strip); with `bulkActions` it gets the List view's header surface", async () => {
    type R = { id: string; name: string };
    const rows: R[] = [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }];
    const run = vi.fn();
    const theme = (ui: React.ReactNode) => <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>{ui}</ThemeProvider>;
    const { rerender } = render(theme(<ImageView<R> rows={rows} columns={[{ key: "name", label: "Name" }]} rowKey={(r) => r.id} image={() => null} title={(r) => r.name} selectable primaryAction={addButton} />));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    expect(strip()).toBeNull();
    expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    rerender(theme(<ImageView<R> rows={rows} columns={[{ key: "name", label: "Name" }]} rowKey={(r) => r.id} image={() => null} title={(r) => r.name} selectable primaryAction={addButton}
      bulkActions={[{ key: "x", label: "Do X", run }]} />));
    expect(await screen.findByTestId("sf-list-actions")).toBeTruthy(); // Alpha is still selected → Actions
    expect(screen.queryByRole("button", { name: ADD })).toBeNull();
    await runAction("Do X");
    await waitFor(() => expect(run).toHaveBeenCalledWith(["a"], [rows[0]]));
  });

  it("P36C.views.14 the Showcase page: Image view of a submittable DocType; checking a draft and a submitted card and submitting reports the submitted one", async () => {
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><P36cViewsPage /></ThemeProvider>);
    await waitFor(() => expect(cards().length).toBeGreaterThan(2));
    const boxes = screen.getAllByRole("checkbox").filter((c) => (c.getAttribute("aria-label") ?? "").startsWith("Select "));
    const draft = boxes.find((c) => /Acme 1$/.test(c.getAttribute("aria-label") ?? ""))!;
    const submitted = boxes.find((c) => /Initech 3$/.test(c.getAttribute("aria-label") ?? ""))!;
    fireEvent.click(draft); fireEvent.click(submitted);
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(result(1, 1)));
    expect(status()).toContain("INV-0003");
  });
});

// =====================================================================================================================
// Decision 3 — the Report view sends a document shown on several rows once (regression tests)
// =====================================================================================================================

/**
 * A site answers ONE ROW PER CHILD ROW (report_view.js:136, no group_by) when a child column is shown; the simulator
 * answers the first child row only (SIMULATED), so this wrapper adds every document's second child row as a real site
 * would. Each document then appears on two rows with distinct row keys (`name::child`).
 */
function twinRows(s: Site): FrappeTransport {
  return async (m, a) => {
    const res = await s.transport(m, a);
    if (m !== "frappe.desk.reportview.get") return res;
    const msg = res.message as { keys: string[]; values: unknown[][] };
    const kn = msg.keys.findIndex((x) => x.includes("Bulk Invoice Item:name"));
    const k = msg.keys.findIndex((x) => x.includes("Bulk Invoice Item:item"));
    if (kn < 0 || k < 0) return res;
    const values = msg.values.flatMap((v) => { const twin = [...v]; twin[k] = "Second"; twin[kn] = `${String(v[kn])}-2`; return [v, twin]; });
    return { ...res, message: { ...msg, values } };
  };
}
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const rowsOf = (name: string) => bodyRows().filter((tr) => tr.textContent?.includes(`ref:${name}`));
/** Check EVERY row of these documents (each is shown twice). */
const checkDocs = (...names: string[]) => { for (const n of names) for (const tr of rowsOf(n)) fireEvent.click(within(tr).getAllByRole("checkbox")[0]); };
const rowsSelected = (n: number) => document.querySelector("thead")?.textContent?.includes(en("listItemsSelected").replace("{n}", String(n))) ?? false;
async function mountTwins(s: Site, props: Record<string, unknown> = {}) {
  mount("report", s, { bulk: {}, ...props }, { prefs: { visible: ["ref", "Bulk Invoice Item:item"] }, transport: twinRows(s) });
  await waitFor(() => expect(bodyRows()).toHaveLength(12));
  expect(rowsOf("INV-1")).toHaveLength(2);
}
const sentNames = (s: Site, method: string, arg: string, i = 0) => JSON.parse(String(s.calls(method)[i].args[arg])) as string[];

describe("P36C.views decision 3: Report view — a document on several rows is sent ONCE, counted per document (documented deviation from Desk, report_view.js:1339-1348)", () => {
  it("P36C.views.20 Submit: one draft + the failing draft, each on two rows → 4 rows checked, 2 names sent, '1 succeeded, 1 failed', selection KEPT, reloaded", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-3");
    expect(rowsSelected(4)).toBe(true);
    const before = getCount(s);
    await runAction(SUBMIT);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkSubmitConfirm").replace("{n}", "2"))).toBeTruthy(); // documents, not rows
    await confirm();
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(sentNames(s, BULK_UPDATE_METHOD, "docnames")).toEqual(["INV-1", "INV-3"]);
    await waitFor(() => expect(status()).toContain(result(1, 1)));
    expect(status()).toContain(en("listBulkCannotSubmit").replace("{names}", "INV-3"));
    expect(status()).not.toContain(result(2, 2)); // never per row
    await waitFor(() => expect(getCount(s)).toBeGreaterThan(before));
    await waitFor(() => expect(bodyRows()).toHaveLength(12));
    expect(rowsSelected(4)).toBe(true); // kept: not every document succeeded
    expect(Number(s.doc("INV-1")!.docstatus)).toBe(1);
  });

  it("P36C.views.21 the ONLY (duplicated) document fails: '0 succeeded, 1 failed' (not 2), selection kept, nothing reloaded", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-3");
    expect(rowsSelected(2)).toBe(true);
    const before = getCount(s);
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(result(0, 1)));
    expect(sentNames(s, BULK_UPDATE_METHOD, "docnames")).toEqual(["INV-3"]);
    await settle();
    expect(getCount(s)).toBe(before);
    expect(rowsSelected(2)).toBe(true);
  });

  it("P36C.views.22 Cancel: two submitted documents on two rows each; the back-linked one fails → names once, '1 succeeded, 1 failed', kept", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-4", "INV-5");
    await runAction(CANCEL);
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkCancelConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(status()).toContain(result(1, 1)));
    expect(sentNames(s, BULK_UPDATE_METHOD, "docnames")).toEqual(["INV-4", "INV-5"]);
    expect(Number(s.doc("INV-4")!.docstatus)).toBe(2);
    await waitFor(() => expect(bodyRows()).toHaveLength(12));
    expect(rowsSelected(4)).toBe(true);
  });

  it("P36C.views.23 every document succeeds (each on two rows) → the selection is cleared", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(SUBMIT);
    await confirm();
    await waitFor(() => expect(status()).toContain(result(2, 0)));
    expect(sentNames(s, BULK_UPDATE_METHOD, "docnames")).toEqual(["INV-1", "INV-2"]);
    await waitFor(() => expect(screen.queryByTestId("sf-list-actions")).toBeNull());
  });

  it("P36C.views.24 Delete: delete_items gets each name once; the confirmation and the 'requested' line count documents", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkDelete"));
    expect(within(await screen.findByRole("alertdialog")).getByText(en("listBulkDeleteConfirm").replace("{n}", "2"))).toBeTruthy();
    await confirm();
    await waitFor(() => expect(s.calls("frappe.desk.reportview.delete_items")).toHaveLength(1));
    expect(sentNames(s, "frappe.desk.reportview.delete_items", "items")).toEqual(["INV-1", "INV-2"]);
    await waitFor(() => expect(status()).toContain(en("listBulkRequested").replace("{action}", en("listBulkDelete")).replace("{n}", "2")));
  });

  it("P36C.views.25 Edit (update): docnames once; selection kept", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkEdit"));
    const dlg = await screen.findByRole("dialog", { name: en("listBulkEdit") });
    await pickField(dlg, "Ref");
    fireEvent.change(within(dlg).getByLabelText(en("listBulkValue")), { target: { value: "R-7" } });
    fireEvent.click(within(dlg).getByRole("button", { name: en("listBulkApply") }));
    await waitFor(() => expect(s.calls(BULK_UPDATE_METHOD)).toHaveLength(1));
    expect(sentNames(s, BULK_UPDATE_METHOD, "docnames")).toEqual(["INV-1", "INV-2"]);
    await waitFor(() => expect(status()).toContain(result(2, 0)));
    await waitFor(() => expect(bodyRows()).toHaveLength(12));
    expect(rowsSelected(4)).toBe(true);
  });

  it("P36C.views.26 Assign To: add_multiple `name` once per document; the dialog counts documents", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkAssign"));
    const dlg = await screen.findByTestId("sf-assign-dialog");
    expect(dlg.textContent).toContain("2 records selected");
    fireEvent.click(within(dlg).getByLabelText(en("recAssignToMe")));
    fireEvent.click(within(dlg).getByRole("button", { name: en("recAssignConfirm") }));
    await waitFor(() => expect(s.calls("frappe.desk.form.assign_to.add_multiple")).toHaveLength(1));
    expect(sentNames(s, "frappe.desk.form.assign_to.add_multiple", "name")).toEqual(["INV-1", "INV-2"]);
  });

  it("P36C.views.27 Clear Assignment (remove_multiple `names`) and Apply Assignment Rule (bulk_apply `docnames`): once per document", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkClearAssignment"));
    await confirm();
    await waitFor(() => expect(s.calls("frappe.desk.form.assign_to.remove_multiple")).toHaveLength(1));
    expect(sentNames(s, "frappe.desk.form.assign_to.remove_multiple", "names")).toEqual(["INV-1", "INV-2"]);
    await waitFor(() => expect(bodyRows()).toHaveLength(12));
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkAssignmentRule"));
    await waitFor(() => expect(s.calls("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply")).toHaveLength(1));
    expect(sentNames(s, "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", "docnames")).toEqual(["INV-1", "INV-2"]);
  });

  it("P36C.views.28 Add Tags: add_tags `docs` once per document", async () => {
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkAddTags"));
    const dialog = await screen.findByRole("dialog", { name: en("listBulkAddTags") });
    const input = within(dialog).getByRole("combobox", { name: en("listBulkTags") });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(within(dialog).getByText("urgent")).toBeTruthy());
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkAdd") }));
    await waitFor(() => expect(s.calls("frappe.desk.doctype.tag.tag.add_tags")).toHaveLength(1));
    expect(sentNames(s, "frappe.desk.doctype.tag.tag.add_tags", "docs")).toEqual(["INV-1", "INV-2"]);
  });

  it("P36C.views.29 Print: download_multi_pdf `name` once per document", async () => {
    Object.assign(globalThis.URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const s = site();
    await mountTwins(s);
    checkDocs("INV-4", "INV-5"); // submitted: printable
    await runAction(en("listBulkPrint"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    await waitFor(() => expect(s.calls(PRINT_METHODS.pdf)).toHaveLength(1));
    expect(sentNames(s, PRINT_METHODS.pdf, "name")).toEqual(["INV-4", "INV-5"]);
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it("P36C.views.30 Export: the exporter's filter carries each name once (selected count = documents)", async () => {
    Object.assign(globalThis.URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const s = site();
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await runAction(en("listBulkExport"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: en("exportSelectAll") }));
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkExport") }));
    await waitFor(() => expect(s.calls(DOWNLOAD_TEMPLATE_METHOD)).toHaveLength(1));
    const filters = JSON.parse(String(s.calls(DOWNLOAD_TEMPLATE_METHOD)[0].args.export_filters)) as unknown[][];
    expect(filters[0][3]).toEqual(["INV-1", "INV-2"]);
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it("P36C.views.31 Workflow: get_common_transition_actions `docs` and bulk_workflow_approval `docnames` once per document", async () => {
    const s = site({ workflow: true, docs: DOCS().map((d) => ({ ...d, workflow_state: Number(d.docstatus) === 0 ? "Draft" : "Approved" })) });
    await mountTwins(s);
    checkDocs("INV-1", "INV-2");
    await openActions();
    await waitFor(() => expect(s.calls(WORKFLOW_BULK_METHODS.commonActions)).toHaveLength(1));
    expect((JSON.parse(String(s.calls(WORKFLOW_BULK_METHODS.commonActions)[0].args.docs)) as { name: string }[]).map((d) => d.name)).toEqual(["INV-1", "INV-2"]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(s.calls(WORKFLOW_BULK_METHODS.approve)).toHaveLength(1));
    expect(sentNames(s, WORKFLOW_BULK_METHODS.approve, "docnames")).toEqual(["INV-1", "INV-2"]);
  });
});
