/**
 * P36 W1 — Desk's header-actions selection as THE default of `FrappeListView` (no `selectionMode` prop), and what each
 * Actions-menu item does to the selection and the list, read from Frappe 15.110:
 * - list_view.js:590-598 toggle_actions_menu_button, :1613-1634 on_row_checked, :1653-1656 clear_checked_items;
 * - list_view.js:1855-2128 get_actions_menu_items (each action's `done` callback), :1802-1853 workflow items;
 * - bulk_operations.js (delete :196-226, submit_or_cancel :295-322, edit :324-418, add_tags :425-461);
 * - ui/messages.js:29-62 frappe.confirm (reject_action on No / close).
 * SIMULATED: the playground mock + per-method handlers; nothing here is evidence from a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, FrappeError, type FrappeTransport } from "../src/frappe";
import { selectionAfterBulk, type ListActionKind } from "../src/frappe/list/bulk";
import { WORKFLOW_BULK_METHODS } from "../src/frappe/list/workflowBulk";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe, type MockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const PERMS = [
  { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 },
  { role: "Reader", permlevel: 0, read: 1 },
];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
const ok = (message: unknown = null) => Promise.resolve({ message });
type Extra = (m: string, a: Record<string, unknown>) => Promise<Record<string, unknown>> | undefined;

/** FrappeListView WITHOUT `selectionMode` — the default must be Desk's header mode. */
function mountList(roles: string[] | undefined, meta: Record<string, unknown> = META(), extra?: Extra) {
  const mock: MockFrappe = createMockFrappe();
  const transport: FrappeTransport = async (m, a) => {
    const own = extra?.(m, a);
    if (own) { mock.calls.push({ method: m, args: a } as never); return own as never; }
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    if (m === "frappe.desk.search.search_link") return { message: [{ value: "ann@x.com", description: "Ann" }] } as never;
    return mock.transport(m, a);
  };
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={roles ? { user: "u@x.com", fullName: "U Ser", roles } : undefined}>
        <FrappeListView doctype="ToDo" storage={null} bulk={{}} create={{ onCreate: () => {} }} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method: string) => mock.calls.filter((c) => c.method === method);
  const gets = () => calls("frappe.desk.reportview.get").length;
  return { mock, calls, gets };
}
const check = (...idx: number[]) => { for (const i of idx) fireEvent.click(screen.getAllByRole("checkbox")[i]); };
const thead = () => document.querySelector("thead")!;
const selectedText = (n: number) => en("listItemsSelected").replace("{n}", String(n));
const isSelected = (n: number) => thead().textContent!.includes(selectedText(n));
const addButton = () => screen.queryByTestId("sf-list-add");
const openActions = async () => fireEvent.keyDown(await screen.findByTestId("sf-list-actions"), { key: "Enter" });
const menuLabels = async () => { await openActions(); return (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim()); };
const runAction = async (name: string) => { await openActions(); fireEvent.click(await screen.findByRole("menuitem", { name })); };
const settle = () => act(() => new Promise((r) => setTimeout(r, 60)));
const ready = async () => { await waitFor(() => expect(bodyRows()).toHaveLength(20)); await waitFor(() => expect(addButton()).toBeTruthy()); };

describe("LV.F16 FrappeListView: header mode is the default (owner decision P36)", () => {
  it("LV.F16 no selectionMode prop: 'Add ToDo' ↔ Actions in the same header slot; no bar; Clear restores 'Add ToDo'", async () => {
    mountList(["System Manager"]);
    await ready();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    check(1, 2);
    expect(screen.queryByRole("region", { name: /selected/ })).toBeNull();
    expect(isSelected(2)).toBe(true);
    expect(addButton()).toBeNull();
    const trigger = await screen.findByTestId("sf-list-actions");
    expect(trigger.parentElement!.lastElementChild).toBe(trigger); // the primary action's slot
    fireEvent.click(within(thead()).getByRole("button", { name: en("clearSelection") }));
    expect(addButton()).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    check(3); check(3); // unchecking the last row also brings it back
    expect(addButton()).toBeTruthy();
  });
});

describe("LV.F12 permissions filter the Actions menu (list_view.js:2088-2128), default header mode", () => {
  it("LV.F12 System Manager, submittable: Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete", async () => {
    mountList(["System Manager"], META({ is_submittable: 1 }));
    await ready();
    check(1);
    expect(await menuLabels()).toEqual(["Edit", "Export", en("listBulkAssign"), "Clear Assignment", "Apply Assignment Rule", "Add Tags", "Print", en("listBulkSubmit"), en("listBulkCancel"), "Delete"]);
  });
  it("LV.F12 a Reader: Export + the read-level actions; no Edit / Print / Submit / Cancel / Delete", async () => {
    mountList(["Reader"], META({ is_submittable: 1 }));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    expect(await menuLabels()).toEqual(["Export", en("listBulkAssign"), "Clear Assignment", "Apply Assignment Rule", "Add Tags"]);
  });
  it("LV.F12 no session roles: only Export (Desk pushes it unconditionally; every gated action withheld, rule 9)", async () => {
    mountList(undefined);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    expect(await menuLabels()).toEqual(["Export"]);
  });
});

describe("LV.F per action: what happens to the selection and the list (Desk's done callbacks)", () => {
  it("LV.F10 Delete: dismissing the confirmation keeps the selection; confirming clears it and reloads", async () => {
    const del: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.desk.reportview.delete_items" ? (del.push(a), ok()) : undefined));
    await ready();
    check(1, 2);
    await runAction("Delete");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("cancel") }));
    await settle();
    expect(del).toHaveLength(0);
    expect(isSelected(2)).toBe(true); // Desk's delete confirm has no reject action (list_view.js:1986-1993)
    const before = gets();
    await runAction("Delete");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(del).toHaveLength(1));
    await waitFor(() => expect(addButton()).toBeTruthy()); // clear_checked_items → the primary action is back
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });

  it("LV.F10 a refused Delete (403) keeps the selection and does not reload (Desk: frappe.throw, no done)", async () => {
    const { gets } = mountList(["System Manager"], META(), (m) => (m === "frappe.desk.reportview.delete_items" ? Promise.reject(new FrappeError("Not permitted", 403, "PermissionError")) : undefined));
    await ready();
    check(1);
    const before = gets();
    await runAction("Delete");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Not permitted"));
    await settle();
    expect(isSelected(1)).toBe(true);
    expect(gets()).toBe(before);
  });

  it("LV.F4 Clear Assignment: No / Escape on the confirmation CLEARS the selection and reloads (Desk's reject action, list_view.js:1919-1921); Yes clears after the server answered", async () => {
    const seen: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.desk.form.assign_to.remove_multiple" ? (seen.push(a), ok()) : undefined));
    await ready();
    check(1, 2);
    let before = gets();
    await runAction("Clear Assignment");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("cancel") }));
    await waitFor(() => expect(addButton()).toBeTruthy());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
    expect(seen).toHaveLength(0);
    // Escape is a dismissal too (frappe.confirm: d.onhide without primary_action_fulfilled)
    check(1);
    await runAction("Clear Assignment");
    fireEvent.keyDown(await screen.findByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(addButton()).toBeTruthy());
    // Yes: the confirm button's own close is not a dismissal — one request, then cleared
    check(1, 2);
    before = gets();
    await runAction("Clear Assignment");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    await waitFor(() => expect(addButton()).toBeTruthy());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });

  it("LV.F5 Apply Assignment Rule: no confirmation; clears and reloads once the server answered", async () => {
    const seen: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply" ? (seen.push(a), ok()) : undefined));
    await ready();
    check(1, 2);
    const before = gets();
    await runAction("Apply Assignment Rule");
    await waitFor(() => expect(seen).toHaveLength(1));
    await waitFor(() => expect(addButton()).toBeTruthy());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });

  it("LV.F3 Assign To: closing the dialog keeps the selection; assigning clears it and reloads", async () => {
    const sent: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.desk.form.assign_to.add_multiple" ? (sent.push(a), ok()) : undefined));
    await ready();
    check(1, 3);
    await runAction(en("listBulkAssign"));
    fireEvent.keyDown(await screen.findByTestId("sf-assign-dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("sf-assign-dialog")).toBeNull());
    expect(isSelected(2)).toBe(true);
    const before = gets();
    await runAction(en("listBulkAssign"));
    const dlg = await screen.findByTestId("sf-assign-dialog");
    fireEvent.click(within(dlg).getByLabelText(en("recAssignToMe")));
    fireEvent.click(within(dlg).getByRole("button", { name: en("recAssignConfirm") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() => expect(addButton()).toBeTruthy());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });

  it("LV.F6 Add Tags: Cancel in the dialog keeps the selection (no reject action, bulk_operations.js:425-461)", async () => {
    mountList(["System Manager"]);
    await ready();
    check(1, 2);
    await runAction("Add Tags");
    const dialog = await screen.findByRole("dialog", { name: en("listBulkAddTags") });
    fireEvent.click(within(dialog).getByRole("button", { name: en("cancel") }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: en("listBulkAddTags") })).toBeNull());
    expect(isSelected(2)).toBe(true);
    expect(addButton()).toBeNull();
  });

  it("LV.F2 / LV.F7 Export and Print open their dialogs and never touch the selection (Desk passes them no callback)", async () => {
    mountList(["System Manager"]);
    await ready();
    check(1, 2);
    await runAction("Export");
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(isSelected(2)).toBe(true);
    await runAction("Print");
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(isSelected(2)).toBe(true);
  });

  it("LV.F8 Submit: every document submitted → cleared + reloaded; some failed → the selection STAYS (Desk throws before done) and the list reloads", async () => {
    let answer: unknown = ["X-FAILED"]; // first: one of the two names refused
    const sent: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META({ is_submittable: 1 }), (m, a) => (m === "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs" ? (sent.push(a), ok(answer)) : undefined));
    await ready();
    check(1, 2);
    let before = gets();
    await runAction(en("listBulkSubmit"));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
    expect(isSelected(2)).toBe(true);
    expect(addButton()).toBeNull();
    answer = [];
    before = gets();
    await runAction(en("listBulkSubmit"));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(sent).toHaveLength(2));
    await waitFor(() => expect(addButton()).toBeTruthy());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });

  it("LV.F9 Cancel queued by the server (no answer): the selection STAYS and nothing reloads (Desk skips done: undefined < n is false)", async () => {
    const sent: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META({ is_submittable: 1 }), (m, a) => (m === "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs" ? (sent.push(a), ok(null)) : undefined));
    await ready();
    check(1);
    const before = gets();
    await runAction(en("listBulkCancel"));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(en("listBulkQueued")));
    await settle();
    expect(isSelected(1)).toBe(true);
    expect(gets()).toBe(before);
  });

  it("LV.F11 a workflow action keeps the selection (Desk: no done, list_view.js:1802-1826) and the list reloads", async () => {
    const WORKFLOW = {
      doctype: "Workflow", name: "ToDo Approval", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
      states: [{ state: "Pending", doc_status: "0", allow_edit: "Reader" }], transitions: [{ state: "Pending", action: "Approve", next_state: "Pending", allowed: "Reader" }],
    };
    const approved: Record<string, unknown>[] = [];
    const { gets } = mountList(["System Manager"], META({ __workflow_docs: [WORKFLOW] }), (m, a) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) return ok(["Approve"]);
      if (m === WORKFLOW_BULK_METHODS.approve) { approved.push(a); return ok(); }
      return undefined;
    });
    await ready();
    check(1, 2);
    const before = gets();
    await runAction("Approve");
    await waitFor(() => expect(approved).toHaveLength(1));
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
    expect(isSelected(2)).toBe(true);
    expect(addButton()).toBeNull();
  });
});

describe("LV.F selectionAfterBulk — Desk's outcome table as data", () => {
  const out = (failed: string[] = [], queued = false, silent = false) => ({ failed, queued, silent });
  const cases: [ListActionKind, ReturnType<typeof out>, number, { clear: boolean; refresh: boolean }][] = [
    ["assign", out(), 2, { clear: true, refresh: true }],
    ["clear_assignment", out([], false, true), 2, { clear: true, refresh: true }],
    ["assignment_rule", out([], true, true), 6, { clear: true, refresh: true }],
    ["add_tags", out([], false, true), 2, { clear: true, refresh: true }],
    ["delete", out([], true), 11, { clear: true, refresh: true }],
    ["delete", out(["a", "b"]), 2, { clear: false, refresh: false }],
    ["submit", out(), 2, { clear: true, refresh: true }],
    ["submit", out(["a"]), 2, { clear: false, refresh: true }],
    ["submit", out(["a", "b"]), 2, { clear: false, refresh: false }],
    ["cancel", out([], true), 25, { clear: false, refresh: false }],
    ["edit", out(), 2, { clear: false, refresh: true }],
    ["edit", out(["a", "b"]), 2, { clear: false, refresh: false }],
    ["workflow", out([], false, true), 2, { clear: false, refresh: true }],
    ["print", out(), 2, { clear: false, refresh: false }],
    ["export", out(), 2, { clear: false, refresh: false }],
  ];
  it.each(cases)("LV.F %s %j of %i → %j", (kind, outcome, n, expected) => {
    expect(selectionAfterBulk(kind, outcome, n)).toEqual(expected);
  });
});
