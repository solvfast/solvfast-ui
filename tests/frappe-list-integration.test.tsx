/**
 * P35 integration — FrappeListView `create` defaults to Quick Entry (eligible DocType) or the host's full-form route,
 * and `onQueryStateChange` carries the List view's filters into the other views of `FrappeViews`. SIMULATED backend
 * (`createFixtureTransport`); nothing here ran against a real Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeListView, type FrappeListViewProps } from "../src/frappe/FrappeListView";
import { FrappeViews } from "../src/frappe/views";
import { createFixtureTransport, viewsDemoBackend, type FixtureTransport } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, print: 1, email: 1, share: 1 };
const READER = { role: "Reader", permlevel: 0, read: 1, report: 1 };
const NOTE: DocTypeMeta = {
  name: "Note", autoname: "hash", quick_entry: 1, title_field: "title",
  permissions: [SM, READER],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1, in_list_view: 1 },
    { fieldname: "content", fieldtype: "Text Editor", label: "Content" },
  ],
} as DocTypeMeta;
const ORDER: DocTypeMeta = {
  name: "Order", autoname: "hash", quick_entry: 0, title_field: "customer",
  permissions: [SM],
  fields: [{ fieldname: "customer", fieldtype: "Data", label: "Customer", reqd: 1, in_list_view: 1 }],
} as DocTypeMeta;
const T = "2026-11-02 09:00:00.000000";

function site() {
  return createFixtureTransport({
    meta: { Note: [NOTE], Order: [ORDER] },
    docs: {
      Note: [{ doctype: "Note", name: "n1", title: "First", owner: "Administrator", modified: T, creation: T, docstatus: 0 }] as FrappeDoc[],
      Order: [{ doctype: "Order", name: "o1", customer: "Acme", owner: "Administrator", modified: T, creation: T, docstatus: 0 }] as FrappeDoc[],
    },
  });
}
type Session = { user: string; roles?: string[] };
function mount(t: FixtureTransport, props: Partial<FrappeListViewProps<Record<string, unknown>>> & { doctype?: string }, session: Session = { user: "u@x.com", roles: ["System Manager"] }) {
  const client = createFrappeClient({ transport: t, files: t.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} queryClient={qc} session={session} serverMessages={false}>
        <FrappeListView doctype="Note" storage={null} {...props} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  return { calls: (m: string) => t.store.calls.filter((c) => c.method === m) };
}

describe("P35 integration — FrappeListView create → Quick Entry / full form (SIMULATED)", () => {
  it("LV.G1 LV.G8 FV.F6 create={{}} on a Quick Entry DocType opens FrappeQuickEntry; saving inserts the Note and reloads the list", async () => {
    const t = site();
    const { calls } = mount(t, { create: {} });
    await screen.findByText("First");
    fireEvent.click(await screen.findByTestId("sf-list-add"));
    const dlg = await screen.findByRole("dialog");
    const title = await within(dlg).findByLabelText(/Title/);
    fireEvent.change(title, { target: { value: "Second" } });
    fireEvent.blur(title);
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect([...t.store.docs.get("Note")!.values()].map((d) => d.title)).toContain("Second"));
    await waitFor(() => expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Second")).toBeTruthy();
  });

  it("LV.G1 a DocType that is not Quick Entry eligible goes to the host's full form with an unsaved new document (no dialog)", async () => {
    const t = site();
    const onOpenFullForm = vi.fn();
    mount(t, { doctype: "Order", create: { onOpenFullForm } });
    await screen.findByText("Acme");
    fireEvent.click(await screen.findByTestId("sf-list-add"));
    expect(onOpenFullForm).toHaveBeenCalledWith(expect.objectContaining({ doctype: "Order", __islocal: 1 }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("LV.G1 'Edit Full Form' in the default Quick Entry hands the typed document to onOpenFullForm and closes", async () => {
    const t = site();
    const onOpenFullForm = vi.fn();
    mount(t, { create: { onOpenFullForm } });
    await screen.findByText("First");
    fireEvent.click(await screen.findByTestId("sf-list-add"));
    const dlg = await screen.findByRole("dialog");
    const title = await within(dlg).findByLabelText(/Title/);
    fireEvent.change(title, { target: { value: "Draft" } });
    fireEvent.blur(title);
    fireEvent.click(within(dlg).getByRole("button", { name: "Edit Full Form" }));
    expect(onOpenFullForm).toHaveBeenCalledWith(expect.objectContaining({ doctype: "Note", title: "Draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("LV.G1 negative: an app render / onCreate still wins, and a Reader (no create right) gets no Add button", async () => {
    const t = site();
    const onCreate = vi.fn();
    mount(t, { create: {}, onCreate });
    fireEvent.click(await screen.findByTestId("sf-list-add"));
    expect(onCreate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    mount(site(), { create: {} }, { user: "r@x.com", roles: ["Reader"] });
    await screen.findByText("First");
    expect(screen.queryByTestId("sf-list-add")).toBeNull();
  });

  it("LV.H0 onQueryStateChange reports the applied filters and sort", async () => {
    const t = site();
    const seen = vi.fn();
    mount(t, { onQueryStateChange: seen, initialQuery: { conjunction: "and", conditions: [{ id: "a", field: "title", operator: "equals", value: "First" }] } });
    await screen.findByText("First");
    await waitFor(() => expect(seen).toHaveBeenCalled());
    expect(seen.mock.calls.at(-1)![0].query.conditions).toEqual([expect.objectContaining({ field: "title", value: "First" })]);
    expect(seen.mock.calls.at(-1)![0].sort).toBeDefined();
  });
});

describe("P35 integration — FrappeViews carries the List view's filters (SIMULATED)", () => {
  it("LV.H0 filters applied in the List view reach the Report view after switching", async () => {
    const transport = createFixtureTransport(viewsDemoBackend());
    const client = createFrappeClient({ transport });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator", roles: ["System Manager"] }}>
          <FrappeViews doctype="Project Task" list={{ storage: null, initialQuery: { conjunction: "and", conditions: [{ id: "p", field: "priority", operator: "equals", value: "Low" }] } }} report={{ storage: null }} />
        </FrappeProvider></QueryClientProvider>
      </ThemeProvider>,
    );
    const gets = () => transport.store.calls.filter((c) => c.method === "frappe.desk.reportview.get");
    await waitFor(() => expect(gets().length).toBeGreaterThan(0));
    fireEvent.keyDown(await screen.findByTestId("sf-view-switcher"), { key: "Enter" });
    const n = gets().length;
    fireEvent.click(await screen.findByRole("menuitem", { name: /Report/ }));
    await waitFor(() => expect(gets().length).toBeGreaterThan(n));
    await waitFor(() => expect(JSON.parse(String(gets().at(-1)!.args.filters))).toEqual([["priority", "=", "Low"]]));
  });
});
