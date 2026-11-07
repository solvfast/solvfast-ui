/**
 * P35 views — `FrappeViews` (switcher + the chosen view) over the SIMULATED Frappe: only implemented views the DocType
 * allows are offered, the choice renders that view, and filters carry over between views. Simulated & tested.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeViews } from "../src/frappe/views";
import { createFixtureTransport } from "../src/frappe/testing";
import { viewsDemoBackend } from "../src/frappe/testing/handlers/views";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

function mount(props: Partial<React.ComponentProps<typeof FrappeViews>> = {}) {
  const transport = createFixtureTransport(viewsDemoBackend());
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator", roles: ["System Manager"] }}>
        <FrappeViews doctype="Project Task" list={{ storage: null }} report={{ storage: null }} kanban={{ storage: null }} calendarView={{ storage: null, initialMonth: "2026-11-01" }} {...props} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  return { calls: (m: string) => transport.store.calls.filter((c) => c.method === m) };
}
const openSwitcher = async () => fireEvent.keyDown(await screen.findByTestId("sf-view-switcher"), { key: "Enter" });

describe("LV.H0 FrappeViews (SIMULATED)", () => {
  it("LV.H0 offers List, Report, Kanban (a board exists), Calendar (date fields) — not Image (no image_field) nor unimplemented views", async () => {
    mount();
    await screen.findByText("Write spec");
    await waitFor(async () => { await openSwitcher(); expect(screen.getAllByRole("menuitem").map((i) => i.getAttribute("data-view"))).toEqual(["list", "report", "kanban", "calendar"]); });
    fireEvent.click(screen.getByRole("menuitem", { name: /Kanban/ }));
    await screen.findByRole("listitem", { name: "Working" });
    expect(screen.getByTestId("sf-view-switcher").textContent).toContain("Kanban view");
  });
  it("LV.H0 showUnavailable lists the rest disabled; filters carry from the Report view into the Kanban view", async () => {
    const { calls } = mount({ showUnavailable: true, defaultView: "report", report: { storage: null, initialQuery: { conjunction: "and", conditions: [{ id: "p", field: "priority", operator: "equals", value: "Low" }] } } });
    await screen.findByText("Fix bugs");
    await openSwitcher();
    const image = screen.getAllByRole("menuitem").find((i) => i.getAttribute("data-view") === "image")!;
    expect(image.getAttribute("aria-disabled")).toBe("true");
    expect(image.textContent).toContain("The DocType has no image field");
    fireEvent.click(screen.getByRole("menuitem", { name: /Kanban/ }));
    await screen.findByRole("listitem", { name: "Working" });
    await waitFor(() => expect(JSON.parse(String(calls("frappe.desk.reportview.get").at(-1)!.args.filters))).toEqual([["priority", "=", "Low"]]));
  });
});
