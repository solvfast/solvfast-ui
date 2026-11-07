/**
 * P35 integration — the SIMULATED transport's handler context (`FixtureContext`, third handler argument): workstream
 * handlers use the transport's own permission engine, row filter (child-table conditions included), Print Settings and
 * clock; docinfo lists stored Communications. Everything here is the in-browser simulator — never evidence of Frappe.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport, viewsDemoBackend, KANBAN_BOARD_FIXTURE_META, VIEWS_DEMO_META, type FixtureContext, type SimulatedPermissions } from "../src/frappe/testing";
import { FrappeEmailComposer, FrappeTimeline } from "../src/frappe/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const T = "2026-11-02 09:00:00.000000";
const ORDER: DocTypeMeta = {
  name: "Order", autoname: "hash", is_submittable: 1,
  permissions: [
    { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, email: 1, print: 1, submit: 1, cancel: 1 },
    // Sales User reads / e-mails only its own orders (if_owner)
    { role: "Sales User", permlevel: 0, read: 1, write: 1, email: 1, if_owner: 1 },
  ],
  fields: [
    { fieldname: "customer", fieldtype: "Data", label: "Customer" },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nClosed" },
    { fieldname: "items", fieldtype: "Table", label: "Items", options: "Order Item" },
  ],
} as DocTypeMeta;
const ORDER_ITEM: DocTypeMeta = { name: "Order Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item" }] } as DocTypeMeta;
const row = (name: string, owner: string, status: string, items: string[]) =>
  ({ doctype: "Order", name, owner, status, customer: "C", docstatus: 0, modified: T, creation: T, items: items.map((item, i) => ({ doctype: "Order Item", name: `${name}-${i}`, item, parentfield: "items", parenttype: "Order", idx: i + 1 })) });

function site(permissions?: SimulatedPermissions, options: Parameters<typeof createFixtureTransport>[1] = {}) {
  return createFixtureTransport({
    meta: { Order: [ORDER, ORDER_ITEM] },
    docs: { Order: [row("O-1", "sam@x.org", "Open", ["Pen"]), row("O-2", "kim@x.org", "Open", ["Pen", "Ink"]), row("O-3", "sam@x.org", "Closed", ["Ink"])] as unknown as FrappeDoc[] },
  }, { ...(permissions ? { permissions } : {}), ...options });
}

describe("FixtureContext — the third handler argument (SIMULATED)", () => {
  it("SIM.ctx a custom handler receives the context (engine, rows, options, clock); a two-argument handler still works", async () => {
    let seen: FixtureContext | undefined;
    const now = () => new Date(2026, 10, 7, 12, 0, 0);
    const t = site({ user: "sam@x.org", roles: ["Sales User"] }, {
      now,
      printSettings: { allow_print_for_draft: 0 },
      handlers: {
        "my.app.mine": (_a, _s, ctx) => { seen = ctx; return { message: ctx!.rows("Order", { filters: { status: "Open" } }).map((d) => d.name) }; },
        "my.app.old": (a) => ({ message: a.x }),
      },
    });
    expect((await t("my.app.mine", {})).message).toEqual(["O-1"]); // only the session's own Open order (if_owner)
    expect(seen!.permissions).toBe(t.permissions);
    expect(seen!.user).toBe("sam@x.org");
    expect(seen!.printSettings()).toEqual({ allow_print_for_draft: false, allow_print_for_cancelled: false });
    expect(seen!.now()).toEqual(now());
    expect(seen!.stamp()).toMatch(/^2026-11-07 12:00:00/);
    expect((await t("my.app.old", { x: 1 })).message).toBe(1);
  });

  it("LV.D6 SIM.ctx get_group_by_count uses the transport's filter: child-table conditions and the session's row permissions", async () => {
    const admin = site();
    const byItem = await admin("frappe.desk.listview.get_group_by_count", { doctype: "Order", field: "status", current_filters: JSON.stringify([["Order Item", "item", "=", "Ink"]]) });
    expect(byItem.message).toEqual([{ name: "Closed", count: 1 }, { name: "Open", count: 1 }]);
    const sam = site({ user: "sam@x.org", roles: ["Sales User"] });
    const own = await sam("frappe.desk.listview.get_group_by_count", { doctype: "Order", field: "owner", current_filters: "[]" });
    expect(own.message).toEqual([{ name: "sam@x.org", count: 2 }]); // kim's order is not readable (if_owner)
    const outsider = site({ user: "out@x.org", roles: ["Guest Role"] });
    await expect(outsider("frappe.desk.reportview.get_sidebar_stats", { doctype: "Order", stats: JSON.stringify(["status"]), filters: "[]" })).rejects.toBeInstanceOf(FrappeError);
  });

  it("LV.D7 SIM.ctx get_sidebar_stats counts only readable rows, with child-table filters", async () => {
    const sam = site({ user: "sam@x.org", roles: ["Sales User"] });
    const r = await sam("frappe.desk.reportview.get_sidebar_stats", { doctype: "Order", stats: JSON.stringify(["status"]), filters: JSON.stringify([["Order Item", "item", "=", "Pen"]]) });
    expect(r.message).toEqual({ stats: { status: [["Open", 1]] } }); // O-1 (sam, Pen); O-2 has Pen but is kim's
  });

  it("FV.O8 SIM.ctx email.make checks the e-mail right with the engine (if_owner); docinfo and get_communications list the Communication", async () => {
    const sam = site({ user: "sam@x.org", roles: ["Sales User"] });
    await expect(sam("frappe.core.doctype.communication.email.make", { doctype: "Order", name: "O-2", recipients: "a@b.co", subject: "Hi", content: "x" })).rejects.toMatchObject({ status: 403 });
    const ok = await sam("frappe.core.doctype.communication.email.make", { doctype: "Order", name: "O-1", recipients: "a@b.co", subject: "Your order", content: "<p>Hello</p>" });
    expect((ok.message as { name: string }).name).toBeTruthy();
    const info = (await sam("frappe.desk.form.load.get_docinfo", { doctype: "Order", name: "O-1" })) as unknown as { docinfo: { communications: Record<string, unknown>[]; user_info: Record<string, unknown> } };
    expect(info.docinfo.communications).toEqual([expect.objectContaining({ subject: "Your order", sender: "sam@x.org", communication_type: "Communication", communication_medium: "Email", reference_name: "O-1", attachments: "[]" })]);
    expect(info.docinfo.user_info["sam@x.org"]).toBeTruthy();
    const page = await sam("frappe.desk.form.load.get_communications", { doctype: "Order", name: "O-1", start: 0, limit: 21 });
    expect((page.message as unknown[]).length).toBe(1);
    await expect(sam("frappe.desk.form.load.get_communications", { doctype: "Order", name: "O-2" })).rejects.toMatchObject({ status: 403 });
  });

  it("FV.L5 SIM.ctx get_html_and_style follows the transport's printSettings option (no stored single needed)", async () => {
    const t = site(undefined, { printSettings: { allow_print_for_draft: 0 } });
    await expect(t("frappe.www.printview.get_html_and_style", { doc: "Order", name: "O-1" })).rejects.toMatchObject({ status: 403 });
    const ok = site();
    expect(((await ok("frappe.www.printview.get_html_and_style", { doc: "Order", name: "O-1" })).message as { html: string }).html).toContain("SIMULATED preview");
  });

  it("LV.H2 SIM.ctx update_order_for_single_card needs write on the DocType (kanban_board.py:137); get_events needs read", async () => {
    const backend = viewsDemoBackend();
    const reader: SimulatedPermissions = { user: "rita@x.org", roles: ["Reader"] };
    const t = createFixtureTransport(backend, { permissions: reader });
    const board = [...t.store.docs.get("Kanban Board")!.values()][0];
    const col = (board.columns as { column_name: string; order?: string }[])[0];
    const first = (JSON.parse(String(col.order ?? "[]")) as string[])[0];
    await expect(t("frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card", {
      board_name: board.name, docname: first, from_colname: col.column_name, to_colname: col.column_name, old_index: 0, new_index: 0,
    })).rejects.toMatchObject({ status: 403 });
    const outsider = createFixtureTransport(viewsDemoBackend(), { permissions: { user: "o@x.org", roles: ["Nobody"] } });
    await expect(outsider("frappe.desk.calendar.get_events", { doctype: "Project Task", start: "2026-11-01", end: "2026-11-30", field_map: JSON.stringify({ start: "exp_start_date", end: "exp_end_date", title: "subject" }) })).rejects.toMatchObject({ status: 403 });
    expect(KANBAN_BOARD_FIXTURE_META["Kanban Board"]).toBeTruthy();
    expect(VIEWS_DEMO_META["Project Task"]).toBeTruthy();
  });
});

describe("FV.O8 a sent e-mail shows in the timeline (SIMULATED)", () => {
  it("FV.O8 FrappeEmailComposer → email.make → docinfo re-read → FrappeTimeline lists the Communication", async () => {
    const t = site({ user: "sam@x.org", roles: ["Sales User"] });
    const client = createFrappeClient({ transport: t, files: t.files });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const doc = t.store.docs.get("Order")!.get("O-1")!;
    const onSent = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} queryClient={qc} session={t.store.session} serverMessages={false}>
          <ThemeProvider>
            <FrappeEmailComposer doc={doc} open onOpenChange={() => {}} templates={[]} initial={{ to: ["a@b.co"], subject: "Shipped today" }} onSent={onSent} />
            <FrappeTimeline doc={doc} user="sam@x.org" />
          </ThemeProvider>
        </FrappeProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(t.store.calls.some((c) => c.method === "frappe.desk.form.load.get_docinfo")).toBe(true));
    expect(screen.queryByText(/Shipped today/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(await screen.findByText(/Shipped today/)).toBeTruthy();
  });
});
