/**
 * 0.4.1 — FrappeListView in Desk's own selection layout (`selectionMode="header"`): Frappe 15.110 list_view.js:590-598
 * (primary action ↔ Actions menu), :1613-1634 ("{0} items selected" in the header), :1855-2127 (the Actions menu, Desk's
 * order), :163-168 + :1426-1428 (workflow actions appended, asked on every opening), form/sidebar/assign_to.js (Assign To
 * dialog → assign_to.add_multiple). SIMULATED: stub transports (the playground mock + handlers per method).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
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
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });
const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 }, { role: "Reader", permlevel: 0, read: 1 }];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
const ok = (message: unknown = null) => Promise.resolve({ message });
type Extra = (m: string, a: Record<string, unknown>) => Promise<Record<string, unknown>> | undefined;

function mountList(roles: string[], meta: Record<string, unknown>, extra?: Extra, rowPatch?: (r: Record<string, unknown>, i: number) => void) {
  const mock: MockFrappe = createMockFrappe();
  if (rowPatch) mock.rows.forEach((r, i) => rowPatch(r as Record<string, unknown>, i));
  const transport: FrappeTransport = async (m, a) => {
    const own = extra?.(m, a);
    if (own) { mock.calls.push({ method: m, args: a } as never); return own as never; }
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    if (m === "frappe.desk.search.search_link") return { message: [{ value: "ann@x.com", description: "Ann" }, { value: "bob@x.com", description: "Bob" }] } as never;
    return mock.transport(m, a);
  };
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "u@x.com", fullName: "U Ser", roles }}>
        <FrappeListView doctype="ToDo" storage={null} bulk={{}} selectionMode="header" primaryAction={<button type="button">Add ToDo</button>} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method: string) => mock.calls.filter((c) => c.method === method);
  const firstNames = (n: number) => mock.rows.slice().sort((a, b) => String(b.modified).localeCompare(String(a.modified))).slice(0, n).map((r) => String(r.name));
  return { mock, calls, firstNames };
}
const check = (...idx: number[]) => { for (const i of idx) fireEvent.click(screen.getAllByRole("checkbox")[i]); };

describe("FrappeListView selectionMode='header'", () => {
  it("no bar; '{n} items selected' in the header; Add ToDo → Actions with Desk's items in Desk's order; back on clear", async () => {
    mountList(["System Manager"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(screen.getByRole("button", { name: "Add ToDo" })).toBeTruthy();
    check(1, 2);
    expect(screen.queryByRole("region", { name: /selected/ })).toBeNull();
    expect(document.querySelector("thead")!.textContent).toContain("2 items selected");
    expect(screen.queryByRole("button", { name: "Add ToDo" })).toBeNull();
    openMenu(await screen.findByTestId("sf-list-actions"));
    const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim());
    expect(items).toEqual(["Edit", "Export", "Assign to", "Clear Assignment", "Apply Assignment Rule", "Add Tags", "Print", "Delete"].map((l) => (l === "Assign to" ? en("listBulkAssign") : l)));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(within(document.querySelector("thead")!).getByRole("button", { name: en("clearSelection") }));
    expect(screen.getByRole("button", { name: "Add ToDo" })).toBeTruthy();
  });

  it("Assign To (menu) opens Desk's dialog: Assign to me + users + details → add_multiple for exactly the checked names", async () => {
    const sent: Record<string, unknown>[] = [];
    const { firstNames } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.desk.form.assign_to.add_multiple" ? (sent.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 3);
    openMenu(await screen.findByTestId("sf-list-actions"));
    fireEvent.click(await screen.findByRole("menuitem", { name: en("listBulkAssign") }));
    const dlg = await screen.findByTestId("sf-assign-dialog");
    expect(dlg.textContent).toContain("2 records selected");
    fireEvent.click(within(dlg).getByLabelText(en("recAssignToMe")));
    fireEvent.click(await within(dlg).findByText("ann@x.com"));
    fireEvent.change(within(dlg).getByLabelText(en("recAssignDescription")), { target: { value: "check" } });
    fireEvent.click(within(dlg).getByRole("button", { name: en("recAssignConfirm") }));
    await waitFor(() => expect(sent).toHaveLength(1));
    const names = firstNames(4);
    expect(sent[0]).toMatchObject({ doctype: "ToDo", name: JSON.stringify([names[0], names[2]]), assign_to: JSON.stringify(["u@x.com", "ann@x.com"]), bulk_assign: true, re_assign: true, description: "check" });
  });

  it("Delete confirms (destructive) and sends delete_items for the checked names", async () => {
    const del: Record<string, unknown>[] = [];
    const { firstNames } = mountList(["System Manager"], META(), (m, a) => (m === "frappe.desk.reportview.delete_items" ? (del.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    openMenu(await screen.findByTestId("sf-list-actions"));
    fireEvent.click(await screen.findByRole("menuitem", { name: en("listBulkDelete") }));
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(del).toHaveLength(1));
    expect(del[0]).toEqual({ doctype: "ToDo", items: JSON.stringify(firstNames(1)) });
  });

  it("a Reader: Export + the read-level actions only (no Edit / Print / Delete)", async () => {
    mountList(["Reader"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    openMenu(await screen.findByTestId("sf-list-actions"));
    const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim());
    expect(items).toEqual(["Export", en("listBulkAssign"), "Clear Assignment", "Apply Assignment Rule", "Add Tags"]);
  });

  it("workflow: the actions are appended to the menu and asked from the server on every opening", async () => {
    const WORKFLOW = {
      doctype: "Workflow", name: "ToDo Approval", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
      states: [{ state: "Pending", doc_status: "0", allow_edit: "Reader" }], transitions: [{ state: "Pending", action: "Approve", next_state: "Pending", allowed: "Reader" }],
    };
    const common: unknown[] = []; const approved: Record<string, unknown>[] = [];
    const { firstNames } = mountList(["System Manager"], META({ __workflow_docs: [WORKFLOW] }), (m, a) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) { common.push(a); return ok(["Approve"]); }
      if (m === WORKFLOW_BULK_METHODS.approve) { approved.push(a); return ok(); }
      return undefined;
    }, (r, i) => { r.owner = i % 2 ? "a@x.com" : "b@x.com"; });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    expect(common).toHaveLength(0);
    openMenu(await screen.findByTestId("sf-list-actions"));
    await waitFor(() => expect(common).toHaveLength(1));
    const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim());
    expect(items).not.toContain("Edit"); expect(items).not.toContain("Delete");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(approved).toHaveLength(1));
    expect(approved[0]).toEqual({ docnames: JSON.stringify(firstNames(2)), doctype: "ToDo", action: "Approve" });
  });
});
