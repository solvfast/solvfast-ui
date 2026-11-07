/**
 * P35 integration — FrappeForm with its default "⋯" menu (FrappeRecordMenu in FrappeFormView's `menu` slot) and its
 * Connections tab (FrappeConnections in `extraTabs`), on the SIMULATED backend (`createFixtureTransport`). Every server
 * answer comes from the in-memory simulator; permission decisions are its approximation. Nothing here ran against a
 * real Frappe site. Test names carry the Form audit row ids (docs/audit/p35/A-form.md).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import { FrappeForm, type FrappeFormProps } from "../src/frappe/form";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const ALL = { read: 1, write: 1, create: 1, delete: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 } as const;
const SM: DocPerm = { role: "System Manager", permlevel: 0, ...ALL };
const DEAL: DocTypeMeta = {
  name: "Deal", autoname: "hash", title_field: "title", allow_rename: 1,
  permissions: [SM, { role: "Viewer", permlevel: 0, read: 1, select: 1 }],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "email_id", fieldtype: "Data", options: "Email", label: "Email" },
  ],
  __dashboard: { fieldname: "deal", transactions: [{ label: "Activity", items: ["Deal Note"] }], non_standard_fieldnames: {}, internal_links: {} },
} as DocTypeMeta;
const DEAL_NOTE: DocTypeMeta = { name: "Deal Note", autoname: "hash", permissions: [SM], fields: [{ fieldname: "deal", fieldtype: "Link", options: "Deal", label: "Deal" }] };
const MEMO: DocTypeMeta = { name: "Memo", autoname: "hash", permissions: [SM], fields: [{ fieldname: "subject", fieldtype: "Data", label: "Subject" }] };
const T = "2026-11-02 09:00:00.000000";

function site(permissions: SimulatedPermissions = { user: "sara@x.org", roles: ["System Manager"] }) {
  return createFixtureTransport({
    meta: { Deal: [DEAL], "Deal Note": [DEAL_NOTE], Memo: [MEMO] },
    docs: {
      Deal: [{ doctype: "Deal", name: "D-1", title: "Big order", email_id: "client@x.org", docstatus: 0, owner: "sara@x.org", modified: T, creation: T }] as FrappeDoc[],
      "Deal Note": [{ doctype: "Deal Note", name: "N-1", deal: "D-1" }, { doctype: "Deal Note", name: "N-2", deal: "D-1" }] as FrappeDoc[],
      Memo: [{ doctype: "Memo", name: "M-1", subject: "Hello", docstatus: 0, owner: "sara@x.org", modified: T, creation: T }] as FrappeDoc[],
    },
  }, { permissions });
}
const calls = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);

function mount(t: FixtureTransport, props: Partial<FrappeFormProps> & { doctype?: string; name?: string } = {}) {
  const client = createFrappeClient({ transport: t, files: t.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={t.store.session} serverMessages={false}>
        <ThemeProvider><FrappeForm doctype="Deal" name="D-1" {...props} /></ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}
const menuButton = () => screen.findByRole("button", { name: "Menu" });
async function openMenu() {
  fireEvent.keyDown(await menuButton(), { key: "Enter" });
  return screen.findByRole("menu");
}
const pick = async (name: RegExp | string) => fireEvent.click(within(await openMenu()).getByRole("menuitem", { name }));
const labels = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((m) => m.querySelector("span")!.textContent);
const titleInput = () => screen.findByLabelText("Title") as Promise<HTMLInputElement>;

describe("P35 integration — FrappeForm menu + connections (SIMULATED)", () => {
  it("FV.K3 FV.M1 the ⋯ menu and the Connections tab are on by default; menu={false} / connections={false} remove them; no dashboard → no tab", async () => {
    const t = site();
    const a = mount(t);
    await titleInput();
    expect(await menuButton()).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Connections" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    a.unmount();
    const b = mount(t, { menu: false, connections: false });
    await titleInput();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    b.unmount();
    mount(t, { doctype: "Memo", name: "M-1" });
    await screen.findByLabelText("Subject");
    expect(await menuButton()).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Connections" })).toBeNull();
  });

  it("FV.K3 FV.K16 a System Manager gets Desk's menu in the form, with no extra request for docinfo", async () => {
    const t = site();
    mount(t);
    await titleInput();
    const before = calls(t, "frappe.desk.form.load.getdoc").length + calls(t, "frappe.desk.form.load.get_docinfo").length;
    const menu = await openMenu();
    expect(labels(menu)).toEqual(["Print", "Email", "Links", "Duplicate", "Copy to Clipboard", "Rename", "Reload", "Delete", "Remind Me", "Undo", "Redo", "Customize", "New Deal"]);
    expect(calls(t, "frappe.desk.form.load.getdoc").length + calls(t, "frappe.desk.form.load.get_docinfo").length).toBe(before);
  });

  it("FV.K6 Duplicate opens the copy in the form (no request); saving it inserts a new Deal and keeps D-1", async () => {
    const t = site();
    const onOpened = vi.fn();
    mount(t, { menu: { onOpened } });
    await titleInput();
    const before = t.store.calls.length;
    await pick(/Duplicate/);
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("New Deal"));
    expect((await titleInput()).value).toBe("Big order");
    expect(onOpened).toHaveBeenCalledWith(expect.objectContaining({ doctype: "Deal", __islocal: 1, title: "Big order" }), "duplicate");
    expect(t.store.calls.slice(before).filter((c) => c.method !== "frappe.desk.form.load.getdoctype")).toEqual([]);
    // the copy's Connections tab asks to save first
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Connections" }), { button: 0 });
    expect(await screen.findByText("Save the document to see its connections.")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Details" }), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(t.store.docs.get("Deal")!.size).toBe(2));
    const created = [...t.store.docs.get("Deal")!.values()].find((d) => d.name !== "D-1")!;
    expect(created).toMatchObject({ title: "Big order", email_id: "client@x.org" });
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Big order"));
    expect(t.store.docs.get("Deal")!.get("D-1")).toBeDefined();
  });

  it("FV.K10 Reload re-reads the document from the server (getdoc) and shows the server's value", async () => {
    const t = site();
    mount(t);
    await titleInput();
    t.store.docs.get("Deal")!.get("D-1")!.title = "Changed on the server";
    t.store.docs.get("Deal")!.get("D-1")!.modified = "2026-11-03 10:00:00.000000";
    const n = calls(t, "frappe.desk.form.load.getdoc").length;
    await pick("Reload");
    await waitFor(() => expect(calls(t, "frappe.desk.form.load.getdoc").length).toBe(n + 1));
    await waitFor(async () => expect((await titleInput()).value).toBe("Changed on the server"));
  });

  it("FV.K14 Undo / Redo in the menu follow the form's history (controller undo / redo)", async () => {
    const t = site();
    mount(t);
    const input = await titleInput();
    let menu = await openMenu();
    expect(within(menu).getByRole("menuitem", { name: /Undo/ }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(menu, { key: "Escape" });
    fireEvent.change(input, { target: { value: "Bigger order" } });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByText("Not Saved")).toBeTruthy());
    menu = await openMenu();
    expect(within(menu).getByRole("menuitem", { name: /Undo/ }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Undo/ }));
    await waitFor(async () => expect((await titleInput()).value).toBe("Big order"));
    menu = await openMenu();
    expect(within(menu).getByRole("menuitem", { name: /Redo/ }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Redo/ }));
    await waitFor(async () => expect((await titleInput()).value).toBe("Bigger order"));
  });

  it("FV.K4 Print opens FrappeFormPrint for the form's document (get_html_and_style preview)", async () => {
    const t = site();
    mount(t);
    await titleInput();
    await pick("Print");
    const dlg = await screen.findByRole("dialog");
    await waitFor(() => expect(calls(t, "frappe.www.printview.get_html_and_style").length).toBeGreaterThan(0));
    expect(JSON.parse(String(calls(t, "frappe.www.printview.get_html_and_style")[0].args.doc))).toMatchObject({ doctype: "Deal", name: "D-1", title: "Big order" });
    expect(dlg.querySelector("iframe")).toBeTruthy();
  });

  it("FV.K5 Email opens FrappeEmailComposer prefilled from the document; sending records a Communication", async () => {
    const t = site();
    mount(t);
    await titleInput();
    await pick(/Email/);
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("client@x.org")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls(t, "frappe.core.doctype.communication.email.make").length).toBe(1));
    expect([...(t.store.docs.get("Communication")?.values() ?? [])][0]).toMatchObject({ reference_doctype: "Deal", reference_name: "D-1" });
  });

  it("FV.K12 FV.M3 Links switches to the Connections tab, which counts the linked Deal Notes (get_open_count)", async () => {
    const t = site();
    const onOpenList = vi.fn();
    mount(t, { connections: { onOpenList } });
    await titleInput();
    await pick("Links");
    const panel = await waitFor(() => { const p = document.querySelector("[data-extra-tab-panel='connections']"); expect(p).toBeTruthy(); return p as HTMLElement; });
    await waitFor(() => expect(calls(t, "frappe.desk.notifications.get_open_count").length).toBe(1));
    fireEvent.click(await within(panel).findByRole("button", { name: /Deal Note/ }));
    expect(onOpenList).toHaveBeenCalledWith("Deal Note", { deal: "D-1" });
  });

  it("FV.K15 New opens a new Deal in the form; a host onNew replaces it", async () => {
    const t = site();
    const a = mount(t);
    await titleInput();
    await pick(/New Deal/);
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("New Deal"));
    expect((await titleInput()).value).toBe("");
    a.unmount();
    const onNew = vi.fn();
    mount(t, { menu: { onNew } });
    await titleInput();
    await pick(/New Deal/);
    expect(onNew).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Big order");
  });

  it("FV.K16 options pass through: exclude drops entries, extra adds the host's own; a node replaces the menu", async () => {
    const t = site();
    const run = vi.fn();
    const a = mount(t, { menu: { exclude: ["print", "email", "customize"], extra: [{ id: "x", label: "Send to ERP", onSelect: run }] } });
    await titleInput();
    const menu = await openMenu();
    expect(labels(menu)).not.toContain("Print");
    expect(labels(menu)).not.toContain("Customize");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Send to ERP" }));
    expect(run).toHaveBeenCalled();
    a.unmount();
    mount(t, { menu: <button type="button">Own menu</button> });
    await titleInput();
    expect(screen.getByRole("button", { name: "Own menu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  it("FV.K16 permission negative: a Viewer (read only) gets no Duplicate, Rename, Delete, Print, Email, Customize or New", async () => {
    const t = site({ user: "viv@x.org", roles: ["Viewer"] });
    mount(t);
    await titleInput();
    const menu = await openMenu();
    const l = labels(menu);
    for (const x of ["Duplicate", "Rename", "Delete", "Print", "Email", "Customize", "New Deal"]) expect(l).not.toContain(x);
    expect(l).toEqual(expect.arrayContaining(["Links", "Copy to Clipboard", "Reload"]));
  });
});
