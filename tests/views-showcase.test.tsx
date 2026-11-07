/** P35 views — the showcase page renders on the simulator (smoke): switcher, a Frappe view, the Core board. SIMULATED. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { ViewsPage } from "../showcase/src/pages/views";
import { PAGES } from "../showcase/src/routes";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

describe("LV.H0 showcase page (SIMULATED)", () => {
  it("LV.H0 the views page is routed under the Frappe group and renders labelled SIMULATED", async () => {
    expect(PAGES.find((p) => p.id === "frappe-views")?.group.id).toBe("frappe");
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><ViewsPage /></ThemeProvider>);
    expect(screen.getAllByText(/SIMULATED/).length).toBeGreaterThan(0);
    expect((await screen.findAllByTestId("sf-view-switcher")).length).toBe(2);
    expect(await screen.findByText("Write spec")).toBeTruthy();
    expect(await screen.findByRole("img", { name: "Laptop Pro" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "To do" })).toBeTruthy();
  });
});
