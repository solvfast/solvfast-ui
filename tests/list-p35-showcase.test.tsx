/** P35 list — smoke test of the SIMULATED Showcase page (showcase/src/pages/p35-list.tsx): it renders on the simulator. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, configure, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { P35ListPage } from "../showcase/src/pages/p35-list";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

describe("LV showcase (SIMULATED)", () => {
  it("LV showcase: the P35 page renders the Memo list with its sidebar, Add Memo and the card demo", async () => {
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><P35ListPage /></ThemeProvider>);
    await waitFor(() => expect(screen.getAllByText(/Memo \d+/).length).toBeGreaterThan(5));
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Memo" })).toBeTruthy();
    expect(document.querySelectorAll("[data-card]").length).toBe(8);
  });
});
