/** Lifecycle components (src/record): LifecycleRail, the diagram pieces, and LifecycleBar's shared dot atoms. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  LifecycleBar, LifecycleDiagramDialog, LifecycleDiagramLegend, LifecycleEdgeLabel, LifecycleRail, LifecycleStateCard, LIFECYCLE_DIAGRAM_COLORS,
} from "../src/record";
import { ThemeProvider } from "../src";
import * as core from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => cleanup());

const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);
const path = [
  { id: "new", label: "New", meta: "System · Apr 10", metaTitle: "Created by System" },
  { id: "asg", label: "Assigned", meta: "Khaled · Apr 11" },
  { id: "wip", label: "In Progress", meta: "Khaled · Apr 12" },
];

describe("LifecycleRail", () => {
  it("is exported from the core entry", () => {
    expect(core.LifecycleRail).toBe(LifecycleRail);
    expect(core.LifecycleDiagramDialog).toBe(LifecycleDiagramDialog);
  });

  it("renders nothing for an empty path", () => {
    const { container } = wrap(<LifecycleRail path={[]} />);
    expect(container.querySelector("[data-lifecycle-rail]")).toBeNull();
  });

  it("marks past rows and the current (last) row; past dots are success, current is primary", () => {
    const { container } = wrap(<LifecycleRail path={path} />);
    const rows = Array.from(container.querySelectorAll("li[data-step]"));
    expect(rows.map((r) => r.getAttribute("data-step"))).toEqual(["past", "past", "current"]);
    expect(rows[2].getAttribute("aria-current")).toBe("step");
    expect(rows[2].className).toContain("bg-primary/10");
    expect(container.querySelector("[data-dot='past']")?.className).toContain("bg-success");
    expect(container.querySelector("[data-dot='current']")?.className).toContain("bg-primary");
    // meta + its tooltip
    const meta = container.querySelector("[data-meta]");
    expect(meta?.textContent).toBe("System · Apr 10");
    expect(meta?.getAttribute("title")).toBe("Created by System");
    // the current row announces itself
    expect(rows[2].textContent).toContain("Current");
  });

  it("one way forward → a dashed future row; a back-move gets the back tag", () => {
    const { container, rerender } = wrap(<LifecycleRail path={path} next={[{ id: "done", label: "Resolved" }]} />);
    const row = container.querySelector("[data-next='row']")!;
    expect(row.textContent).toContain("Resolved");
    expect(row.querySelector("[data-dot='future']")).not.toBeNull();
    expect(row.textContent).not.toContain("back");
    rerender(<ThemeProvider><LifecycleRail path={path} next={[{ id: "asg", label: "Assigned", back: true }]} /></ThemeProvider>);
    expect(container.querySelector("[data-next='row']")!.textContent).toContain("back");
  });

  it("two or more ways forward → one box listing all of them (back-moves tagged), no end marker", () => {
    const { container } = wrap(<LifecycleRail path={path} ended next={[
      { id: "res", label: "Resolved" }, { id: "hold", label: "On Hold" }, { id: "asg", label: "Assigned", back: true },
    ]} />);
    const box = container.querySelector("[data-next='box']")!;
    const items = within(box as HTMLElement).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Resolved", "On Hold", "Assignedback"]);
    expect(container.querySelector("[data-next='end']")).toBeNull();
  });

  it("no way forward + ended → End of lifecycle; not ended → nothing after the current row", () => {
    const { container, rerender } = wrap(<LifecycleRail path={path} ended />);
    expect(container.querySelector("[data-next='end']")?.textContent).toBe("End of lifecycle");
    rerender(<ThemeProvider><LifecycleRail path={path} /></ThemeProvider>);
    expect(container.querySelector("[data-next]")).toBeNull();
  });

  it("disabled next options are marked aria-disabled with the reason as tooltip", () => {
    const { container } = wrap(<LifecycleRail path={path} next={[{ id: "a", label: "Approve", disabled: true, disabledReason: "Manager only" }, { id: "b", label: "Reject" }]} />);
    const [a, b] = Array.from(container.querySelectorAll("[data-next='box'] li"));
    expect(a.getAttribute("aria-disabled")).toBe("true");
    expect(a.getAttribute("title")).toBe("Manager only");
    expect(b.getAttribute("aria-disabled")).toBeNull();
  });

  it("View full lifecycle calls onViewAll; hidden without it", () => {
    const onViewAll = vi.fn();
    const { rerender } = wrap(<LifecycleRail path={path} onViewAll={onViewAll} />);
    fireEvent.click(screen.getByRole("button", { name: "View full lifecycle" }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
    rerender(<ThemeProvider><LifecycleRail path={path} /></ThemeProvider>);
    expect(screen.queryByRole("button", { name: "View full lifecycle" })).toBeNull();
  });

  it("Arabic chrome from the provider; explicit labels win (outside a provider too)", () => {
    const { container, unmount } = wrap(<LifecycleRail path={path} ended onViewAll={() => {}} />, "ar");
    expect(container.querySelector("[data-next='end']")?.textContent).toBe("نهاية دورة الحياة");
    expect(screen.getByRole("button", { name: "عرض دورة الحياة كاملة" })).toBeTruthy();
    unmount();
    const r = render(<LifecycleRail path={path} next={[{ id: "x", label: "س", back: true }]} labels={{ back: "رجوع", viewAll: "الكل" }} onViewAll={() => {}} />);
    expect(r.container.querySelector("[data-next='row']")?.textContent).toContain("رجوع");
    expect(screen.getByRole("button", { name: "الكل" })).toBeTruthy();
  });

  it("uses logical (RTL-safe) placement only", () => {
    const { container } = wrap(<LifecycleRail path={path} next={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} onViewAll={() => {}} />, "ar");
    const html = container.innerHTML;
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
    expect(html).not.toMatch(/style="/);
  });
});

describe("Lifecycle diagram pieces", () => {
  it("state cards: done / current / future styling and the Current badge", () => {
    const { container } = wrap(<>
      <LifecycleStateCard label="New" meta="Open · System" kind="done" phase="open" />
      <LifecycleStateCard label="Assigned" kind="current" phase="on_hold" />
      <LifecycleStateCard label="Closed" kind="future" phase="closed" />
    </>);
    const [d, c, f] = Array.from(container.querySelectorAll("[data-kind]"));
    expect(d.className).toContain("border-success/70");
    expect(c.className).toContain("border-primary");
    expect(f.className).toContain("border-border");
    expect(c.textContent).toContain("Current");
    expect(d.textContent).toContain("Open · System");
    // never a hard-coded colour
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });

  it("edge label and legend use tokens; edge colours are token-based CSS colours", () => {
    const { container } = wrap(<><LifecycleEdgeLabel label="Assign" taken /><LifecycleEdgeLabel label="Hold" /><LifecycleDiagramLegend /></>);
    expect(container.querySelector("[data-taken]")?.className).toContain("text-success");
    expect(container.textContent).toContain("Done");
    expect(container.textContent).toContain("Not reached");
    expect(container.textContent).toContain("Path taken");
    expect(LIFECYCLE_DIAGRAM_COLORS.taken).toBe("hsl(var(--success))");
  });

  it("dialog: title, subtitle, canvas slot, legend, localized close; closes via the button", () => {
    const onOpenChange = vi.fn();
    wrap(<LifecycleDiagramDialog open onOpenChange={onOpenChange} title="Ticket lifecycle · Support" subtitle="TKT-1 · currently Assigned">
      <div data-testid="canvas" />
    </LifecycleDiagramDialog>, "ar");
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("dir")).toBe("rtl");
    expect(within(dlg).getByText("Ticket lifecycle · Support")).toBeTruthy();
    expect(within(dlg).getByTestId("canvas")).toBeTruthy();
    expect(dlg.textContent).toContain("المسار المتّبع");
    fireEvent.click(within(dlg).getByRole("button", { name: "إغلاق" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("LifecycleBar shares the rail's atoms", () => {
  it("past = success dot + solid success connector, current = primary, future = hollow", () => {
    const { container } = wrap(<LifecycleBar states={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} current="b" />);
    expect(Array.from(container.querySelectorAll("[data-dot]")).map((d) => d.getAttribute("data-dot"))).toEqual(["past", "current", "future"]);
    expect(container.querySelector("[data-dot='past']")?.className).toContain("bg-success");
    expect(container.querySelector("li[data-step='past'] > span[aria-hidden]")?.className).toContain("border-success");
  });
  it("a failed current state keeps the destructive halo", () => {
    const { container } = wrap(<LifecycleBar states={[{ id: "a", label: "A" }, { id: "l", label: "Lost", step: "failed" }]} current="l" />);
    const dot = container.querySelector("[data-dot='failed']")!;
    expect(dot.className).toContain("bg-destructive");
    expect(dot.className).toContain("ring-destructive/20");
  });
});
