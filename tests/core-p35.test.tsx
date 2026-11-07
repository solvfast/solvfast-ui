/**
 * P35 "core" workstream — generic capabilities the CRM audit (docs/audit/p35/D-crm.md §3c) found missing.
 * Test names carry the gap id (CORE.G<n>; CORE.P34 = the AssigneeGroup role line lost in P34, D-crm row A18).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  AssigneeGroup, LifecycleBar, StatusBadge, StatusDot, ThemeProvider, resolveStatusColor, statusColorStyles,
  type LifecycleStateItem,
} from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);

describe("CORE.P34 AssigneeGroup list shows each assignee's description", () => {
  const people = [
    { id: "a", name: "Ann Lee", description: "Account Executive" },
    { id: "b", name: "Bob", description: "2026-11-09 · High · Call back" },
    { id: "c", name: "Cy" },
  ];
  it("CORE.P34 renders the description line under the name (list variant only)", () => {
    const { container } = wrap(<AssigneeGroup variant="list" assignees={people} searchUsers={async () => []} />);
    const rows = container.querySelectorAll("li");
    expect(within(rows[0] as HTMLElement).getByText("Account Executive")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("2026-11-09 · High · Call back")).toBeTruthy();
    // no description → no second line, the row is the 0.6.0 markup
    expect(rows[2].querySelector("[data-assignee-description]")).toBeNull();
    expect(rows[2].textContent).toBe("CY" + "Cy"); // initials fallback + the name, nothing else
  });
  it("CORE.P34 avatars variant is unchanged (description stays out of the stack)", () => {
    wrap(<AssigneeGroup assignees={people} searchUsers={async () => []} />);
    expect(screen.queryByText("Account Executive")).toBeNull();
  });
  it("CORE.P34 Arabic / RTL: the description renders under the name, remove stays keyboard reachable", () => {
    const rm = vi.fn();
    const { container } = wrap(<AssigneeGroup variant="list" assignees={people.slice(0, 1)} canRemove={() => true} onRemove={rm} searchUsers={async () => []} />, "ar");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(container.textContent).toContain("Account Executive");
    expect(screen.getByText("Account Executive")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Ann Lee/ });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(rm).toHaveBeenCalledWith(people[0]);
  });
});

describe("CORE.G17 StatusBadge / StatusDot custom colour", () => {
  it("CORE.G17 without color the markup is the 0.6.0 one (tone classes, no inline style)", () => {
    const { container } = render(<StatusBadge label="Won" tone="success" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toBeNull();
    expect(el.className).toContain("bg-success/15");
    expect(el.hasAttribute("data-color")).toBe(false);
  });
  it("CORE.G17 a hex colour paints the dot and tints the pill; text mixes with the foreground token (light & dark)", () => {
    const { container } = render(<StatusBadge label="Negotiation" tone="info" color="#f59e0b" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("data-color")).toBe("#f59e0b");
    expect(el.getAttribute("data-tone")).toBe("info");
    expect(el.className).not.toContain("bg-info/15");
    expect(el.style.backgroundColor).toContain("color-mix");
    expect(el.style.color).toBe("color-mix(in oklab, #f59e0b 55%, hsl(var(--foreground)))");
    const dot = el.querySelector("[aria-hidden]") as HTMLElement;
    expect(dot.className).not.toContain("bg-info");
    expect(dot.style.backgroundColor).toBe("rgb(245, 158, 11)");
    expect(screen.getByText("Negotiation")).toBeTruthy(); // the label always carries the meaning
  });
  it("CORE.G17 palette tokens resolve to theme variables; other strings pass through; empty is ignored", () => {
    expect(resolveStatusColor("violet")).toBe("hsl(var(--brand-violet))");
    expect(resolveStatusColor(" Teal ")).toBe("hsl(var(--brand-teal))");
    expect(resolveStatusColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(resolveStatusColor("")).toBeUndefined();
    expect(statusColorStyles(null)).toBeUndefined();
    const { container } = render(<StatusBadge label="x" color="" tone="danger" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("bg-destructive/15");
  });
  it("CORE.G17 dot variant keeps the label in the foreground colour, only the dot is coloured", () => {
    const { container } = render(<StatusBadge label="Open" variant="dot" color="teal" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toBeNull();
    expect(el.className).toContain("text-foreground");
    expect((el.querySelector("[aria-hidden]") as HTMLElement).style.backgroundColor).toBe("hsl(var(--brand-teal))");
  });
  it("CORE.G17 StatusDot accepts color; without it the tone class is used", () => {
    const { container } = render(<StatusDot label="Lost" color="#ef4444" tone="success" />);
    const dot = container.querySelector("span > span") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(239, 68, 68)");
    expect(dot.className).not.toContain("bg-success");
    cleanup();
    const plain = render(<StatusDot label="Lost" tone="success" />).container.querySelector("span > span") as HTMLElement;
    expect(plain.className).toContain("bg-success");
    expect(plain.getAttribute("style")).toBeNull();
  });
});

describe("CORE.G7 LifecycleBar per-step state", () => {
  const deal: LifecycleStateItem[] = [
    { id: "lead", label: "Lead", step: "past" },
    { id: "qual", label: "Qualified", step: "past" },
    { id: "won", label: "Won", step: "skipped" },
    { id: "lost", label: "Lost", step: "failed", by: "Ann", at: Date.UTC(2026, 10, 3, 11) },
  ];
  it("CORE.G7 a Lost deal does not show Won ticked: skipped and failed states", () => {
    const { container } = wrap(<LifecycleBar states={deal} current="lost" now={Date.UTC(2026, 10, 3, 12)} />);
    const items = Array.from(container.querySelectorAll("li[data-step]"));
    expect(items.map((e) => e.getAttribute("data-step"))).toEqual(["past", "past", "skipped", "failed"]);
    const won = items[2];
    expect(won.querySelector(".lucide-check")).toBeNull();
    expect(won.textContent).toContain("Skipped");
    const lost = items[3];
    expect(lost.getAttribute("aria-current")).toBe("step");
    expect(lost.querySelector(".lucide-x")).toBeTruthy();
    expect(lost.textContent).toContain("Failed");
    // the badge falls back to the danger tone for a failed current state without a tone
    expect(container.querySelector("[data-tone='danger']")?.textContent).toBe("Lost");
  });
  it("CORE.G7 without `step` the position decides (0.6.0 behaviour)", () => {
    const st = deal.map(({ step: _s, ...rest }) => rest);
    const { container } = wrap(<LifecycleBar states={st} current="won" />);
    expect(Array.from(container.querySelectorAll("li[data-step]")).map((e) => e.getAttribute("data-step"))).toEqual(["past", "past", "current", "future"]);
  });
  it("CORE.G7 explicit `step` mixes with positional ones (only some states set)", () => {
    const st: LifecycleStateItem[] = [{ id: "a", label: "A" }, { id: "b", label: "B", step: "skipped" }, { id: "c", label: "C" }, { id: "d", label: "D" }];
    const { container } = wrap(<LifecycleBar states={st} current="c" />);
    expect(Array.from(container.querySelectorAll("li[data-step]")).map((e) => e.getAttribute("data-step"))).toEqual(["past", "skipped", "current", "future"]);
  });
  it("CORE.G7 Arabic screen-reader text for skipped / failed", () => {
    const { container } = wrap(<LifecycleBar states={deal} current="lost" />, "ar");
    const items = container.querySelectorAll("li[data-step]");
    expect(items[2].textContent).toContain("تم تخطّيها");
    expect(items[3].textContent).toContain("فشلت");
  });
});
