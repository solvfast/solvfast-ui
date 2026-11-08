/**
 * P36c header — owner decision 2: at phone widths the header keeps more room for the page title while the Global Search
 * trigger stays one tap, named and on Ctrl/⌘+G. jsdom has no layout, so these tests assert the responsive classes and
 * the behaviour; the pixel numbers (title width per CRM route, 390 / 360 px, en / ar, light / dark) come from Playwright
 * on a local CRM build (scratchpad/p36b/crm-qa/header-p36c.mjs, ws/p36c-header.md).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { Navbar } from "../src/shell/Navbar";
import { GlobalSearchBar, type GlobalSearchSource } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const source: GlobalSearchSource = { suggest: () => [], search: async () => [] };

function renderHeader(language: "en" | "ar" = "en") {
  return render(
    <ThemeProvider storageKeys={null} language={language}>
      <Navbar title="Commission & Referral" search={{ slot: <GlobalSearchBar source={source} onSelect={() => {}} /> }} notifications={false} />
    </ThemeProvider>,
  );
}
const pane = () => screen.getByRole("heading", { level: 1 }).closest(".sf-glass-pane") as HTMLElement;
const tokens = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

describe("P36c header — more title room on phones, search kept", () => {
  it("P36C.header.1 phones: 12px pane padding and 2px between icon buttons; desktop keeps 24px / 4px", () => {
    renderHeader();
    const p = pane();
    expect(tokens(p)).toEqual(expect.arrayContaining(["px-3", "md:px-6"]));
    expect(tokens(p)).not.toContain("px-4"); // the pre-P36c phone padding
    const right = p.children[1];
    expect(tokens(right)).toEqual(expect.arrayContaining(["gap-0.5", "md:gap-1"]));
    expect(tokens(right)).not.toContain("gap-1");
    // the title still truncates (never wraps or pushes the buttons out) and its group can shrink
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(tokens(h1)).toContain("truncate");
    expect(tokens(h1.parentElement!)).toContain("min-w-0");
    // the search trigger sits in the same icon group as the toggles (it shares their spacing)
    expect(right.contains(screen.getByTestId("global-search-mobile"))).toBe(true);
    expect(right.contains(screen.getByRole("button", { name: "Toggle theme" }))).toBe(true);
  });

  it("P36C.header.2 the search trigger keeps the DS header button size, its accessible name (en / ar), one tap and Ctrl+G", async () => {
    renderHeader();
    const trigger = screen.getByTestId("global-search-mobile");
    expect(trigger.getAttribute("aria-label")).toBe("Search");
    expect(tokens(trigger)).toContain("md:hidden");
    // the same icon-sm (32×32) as the language / theme toggles — no smaller hit target
    const theme = screen.getByRole("button", { name: "Toggle theme" });
    expect(tokens(trigger)).toContain("size-8");
    expect(tokens(theme)).toContain("size-8");
    fireEvent.click(trigger); // one tap → the full-screen dialog
    const dialog = await screen.findByTestId("global-search-dialog");
    expect(within(dialog).getByTestId("search-idle")).toBeTruthy();
    cleanup();

    renderHeader("ar");
    expect(screen.getByTestId("global-search-mobile").getAttribute("aria-label")).toBe("بحث");
    // Ctrl+G is kept (keyboard.js:198-206): it focuses the bar's input
    fireEvent.keyDown(document.body, { key: "g", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("P36C.header.3 negative control: the default Navbar search, title and toggles are otherwise unchanged", () => {
    render(<ThemeProvider storageKeys={null}><Navbar title="T" /></ThemeProvider>);
    // default (behaviour-less) input stays desktop-only, inside the same right group
    const box = screen.getByRole("searchbox");
    expect(box.parentElement?.className).toMatch(/hidden md:block/);
    expect(tokens(pane().children[1])).toEqual(expect.arrayContaining(["gap-0.5", "md:gap-1"]));
    for (const name of ["Toggle language", "Toggle theme"]) expect(tokens(screen.getByRole("button", { name }))).toContain("size-8");
    expect(tokens(pane())).toEqual(expect.arrayContaining(["h-14", "sticky", "justify-between"]));
  });
});
