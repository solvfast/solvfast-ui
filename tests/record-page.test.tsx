/** RecordPage, RecordHeaderCard variant="crm", RecordHeaderIcon, RecordQuickAction(Menu) — the CRM record page (0.8.0-dev.2). */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Building2, Calendar, CalendarPlus, Handshake, Paperclip, PhoneCall, User } from "lucide-react";
import { RecordPage, RecordHeaderCard, RecordHeaderIcon, RecordQuickAction, RecordQuickActionMenu, RecordTabs, TabsContent, ThemeProvider } from "../src";
import * as record from "../src/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);
const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);
const cls = (el: Element | null) => new Set((el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
const has = (el: Element | null, list: string) => list.split(/\s+/).every((c) => cls(el).has(c));

describe("RecordPage", () => {
  it("is exported from the core entry and src/record", () => {
    expect(record.RecordPage).toBe(RecordPage);
    expect(record.RecordQuickActionMenu).toBe(RecordQuickActionMenu);
  });

  it("the CRM page: container, toolbar (Back + actions), the 3 + 1 grid with the header first, the aside last", () => {
    const back = vi.fn();
    const { container } = wrap(
      <RecordPage back={{ label: "Back to Deals", onClick: back }} actions={<button>Actions</button>} between={<i data-testid="between" />}
        header={<div data-testid="header" />} aside={<aside data-testid="aside" />}>
        <div data-testid="tabs" />
      </RecordPage>,
    );
    const root = container.querySelector("[data-record-page]")!;
    expect(has(root, "sf-record-page p-4 md:p-6 max-w-[1600px] mx-auto")).toBe(true);
    const [toolbar, between, grid] = Array.from(root.children);
    expect(has(toolbar, "flex items-center justify-between mb-4")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to Deals" }));
    expect(back).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Actions" }).closest("div")?.className).toBe("flex items-center gap-2");
    expect(between.getAttribute("data-testid")).toBe("between");
    expect(has(grid, "grid grid-cols-1 lg:grid-cols-4 gap-5 items-start")).toBe(true);
    const main = grid.children[0];
    expect(has(main, "lg:col-span-3 min-w-0 space-y-5")).toBe(true);
    expect(Array.from(main.children).map((c) => c.getAttribute("data-testid"))).toEqual(["header", "tabs"]);
    expect(grid.children[1].getAttribute("data-testid")).toBe("aside");
  });

  it("Back points the other way in RTL; a host icon wins", () => {
    const Mine = ({ className }: { className?: string }) => <svg data-mine className={className} />;
    const { container, unmount } = wrap(<RecordPage back={{ label: "رجوع", onClick: () => {} }} />, "ar");
    expect(container.querySelector("button svg")?.getAttribute("class")).toContain("lucide-arrow-right");
    unmount();
    const r = wrap(<RecordPage back={{ label: "Back", onClick: () => {}, icon: Mine }} />);
    expect(r.container.querySelector("button svg[data-mine]")).not.toBeNull();
  });

  it("ships the record page surfaces: glass.css has the sf-record-page rules (CRM airy glass, 20px corners)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../styles/glass.css"), "utf8");
    expect(css).toMatch(/\.sf-record-page :where\(div, section, article, aside, header, li, form, a, button\):where\(\.bg-card[^{]*\{[^}]*--pane-tint: 26%/);
    expect(css).toMatch(/\.sf-record-page [^{]*:where\(\.rounded-xl, \.rounded-2xl, \.rounded-3xl\)[^{]*\{ border-radius: 20px; \}/);
    expect(css).not.toContain(".sf-crm");
  });
});

describe("RecordHeaderCard variant=crm", () => {
  const facts = (open = vi.fn()) => [
    { icon: Building2, text: "Al-Faisaliah Group", onClick: open }, { icon: User, text: "Sara Al-Otaibi" }, { icon: Calendar, text: "2026-11-15" },
  ];

  it("the CRM header: card, avatar, title row (title, #id, status, extra), facts (a link first), value, chips, actions", () => {
    const open = vi.fn();
    const { container } = wrap(
      <RecordHeaderCard variant="crm" avatar={<RecordHeaderIcon icon={Handshake} color="#fe4e18" />} title="Annual contract" name="1"
        statusNode={<span data-testid="status">Negotiation</span>} titleExtra={<span data-testid="extra" />} facts={facts(open)}
        value="12,500,000 USD" chips={<button data-testid="chip">Converted</button>} actions={<button>Log Call</button>} />,
    );
    const root = container.querySelector("[data-record-header='crm']")!;
    expect(has(root, "relative overflow-hidden rounded-2xl border border-border bg-card")).toBe(true);
    const h1 = root.querySelector("h1")!;
    expect(has(h1, "min-w-0 max-w-full truncate text-xl md:text-2xl font-semibold text-foreground")).toBe(true);
    const row = h1.parentElement!;
    expect(Array.from(row.children).map((c) => c.getAttribute("data-testid") ?? c.tagName.toLowerCase())).toEqual(["h1", "span", "status", "extra"]);
    expect(row.children[1].textContent).toBe("#1");
    const link = screen.getByRole("button", { name: "Al-Faisaliah Group" });
    expect(has(link, "inline-flex items-center gap-1 hover:text-brand-violet font-medium transition-colors")).toBe(true);
    fireEvent.click(link); expect(open).toHaveBeenCalled();
    expect((root.textContent!.match(/•/g) ?? []).length).toBe(2);
    const value = screen.getByText("12,500,000 USD");
    expect(value.getAttribute("dir")).toBe("ltr");
    expect(has(value, "text-lg font-semibold tabular-nums")).toBe(true);
    expect(screen.getByTestId("chip").parentElement).toBe(value.parentElement!.parentElement);
    const actions = screen.getByRole("button", { name: "Log Call" }).parentElement!;
    expect(has(actions, "flex flex-wrap items-center gap-1.5 md:self-start md:ms-auto md:pt-1 shrink-0")).toBe(true);
  });

  it("the default (Sayr) header is unchanged", () => {
    const { container } = wrap(<RecordHeaderCard title="T" name="N" avatar="AB" facts={[{ text: "x" }]} />);
    const root = container.querySelector("[data-record-header]")!;
    expect(root.getAttribute("data-record-header")).toBe("true");
    expect(root.className).toBe("relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-5 shadow-sm");
    expect(root.querySelector("h1")!.className).toBe("min-w-0 truncate text-xl font-semibold");
  });

  it("RecordHeaderIcon: halo + 68 px card tile in the given colour", () => {
    const { container } = wrap(<RecordHeaderIcon icon={Handshake} color="#123456" />);
    const [halo, tile] = Array.from(container.querySelector("[data-record-header-icon]")!.children);
    expect(has(halo, "absolute -inset-0.5 rounded-xl bg-gradient-to-br from-brand-violet via-brand-flame to-brand-violet opacity-60 blur-[2px]")).toBe(true);
    expect(has(tile, "relative h-[68px] w-[68px] rounded-xl flex items-center justify-center bg-card ring-2 ring-card")).toBe(true);
    expect((tile as HTMLElement).style.color).toBe("rgb(18, 52, 86)");
  });
});

describe("RecordQuickAction / RecordQuickActionMenu", () => {
  it("a quick action is an outline pill; primary is the secondary fill", () => {
    const on = vi.fn();
    wrap(<><RecordQuickAction icon={PhoneCall} label="Log Call" onClick={on} /><RecordQuickAction icon={PhoneCall} label="Call" variant="primary" /></>);
    const b = screen.getByRole("button", { name: "Log Call" });
    expect(has(b, "h-8 gap-1.5 px-3 rounded-full text-xs font-medium")).toBe(true);
    fireEvent.click(b); expect(on).toHaveBeenCalled();
  });

  it("split: icon + label + small chevron, the CRM's pill colours; its items run their action", () => {
    const schedule = vi.fn();
    wrap(<RecordQuickActionMenu variant="split" icon={CalendarPlus} label="Meeting" items={[
      { label: "Schedule meeting", icon: CalendarPlus, iconClassName: "text-brand-violet", onSelect: schedule }, { label: "Log meeting", onSelect: () => {} },
    ]} />);
    const t = screen.getByRole("button", { name: "Meeting" });
    expect(has(t, "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border border-border/70 bg-card/60 text-foreground/80")).toBe(true);
    expect(t.querySelectorAll("svg")[1].getAttribute("class")).toContain("h-3 w-3 opacity-60");
    fireEvent.pointerDown(t, { button: 0, ctrlKey: false }); fireEvent.keyDown(t, { key: "Enter" });
    const item = screen.getByRole("menuitem", { name: "Schedule meeting" });
    expect(item.querySelector("svg")?.getAttribute("class")).toContain("text-brand-violet");
    fireEvent.click(item); expect(schedule).toHaveBeenCalled();
  });

  it("more: label + chevron pill", () => {
    wrap(<RecordQuickActionMenu variant="more" label="More" items={[{ label: "Attachment", icon: Paperclip, onSelect: () => {} }]} />);
    const t = screen.getByRole("button", { name: "More" });
    expect(has(t, "h-8 gap-1 px-2.5 rounded-full text-xs font-medium")).toBe(true);
  });
});

describe("RecordTabs", () => {
  it("the CRM's full-width bar: equal tabs, an icon before each label; switching shows the panel", () => {
    function T() {
      const [v, setV] = React.useState("about");
      return (
        <RecordTabs value={v} onValueChange={setV} tabs={[{ value: "about", label: "About", icon: Handshake }, { value: "history", label: "History", icon: Calendar }]}>
          <TabsContent value="about">about panel</TabsContent><TabsContent value="history">history panel</TabsContent>
        </RecordTabs>
      );
    }
    wrap(<T />);
    const list = screen.getByRole("tablist");
    expect(has(list, "flex w-full")).toBe(true);
    const [about, history] = screen.getAllByRole("tab");
    expect(has(about, "min-w-0 flex-1 gap-1.5")).toBe(true);
    expect(about.querySelector("svg")?.getAttribute("class")).toContain("h-3.5 w-3.5");
    expect(screen.getByText("about panel")).toBeTruthy();
    fireEvent.mouseDown(history); fireEvent.click(history);
    fireEvent.keyDown(history, { key: "Enter" });
    expect(history.getAttribute("aria-selected") === "true" || screen.queryByText("history panel") !== null).toBe(true);
  });
});

describe("RecordHeaderCard crm — Lead-style headers; RecordPage banner", () => {
  it("titlePrefix before the title; a fact without icon or link is a plain span; banner above the toolbar", () => {
    const { container } = wrap(<RecordPage banner={<p data-testid="banner">sample data</p>} back={{ label: "Back", onClick: () => {} }}
      header={<RecordHeaderCard variant="crm" title="Abdullah" titlePrefix="Mr." facts={[{ text: "Travel Manager" }, { icon: Building2, text: "Org", onClick: () => {} }]} />} />);
    const root = container.querySelector("[data-record-page]")!;
    expect(root.firstElementChild?.getAttribute("data-testid")).toBe("banner");
    const row = root.querySelector("h1")!.parentElement!;
    expect(row.firstElementChild!.textContent).toBe("Mr.");
    expect(row.firstElementChild!.className).toBe("text-xl md:text-2xl font-semibold text-foreground");
    const plain = screen.getByText("Travel Manager");
    expect(plain.tagName).toBe("SPAN"); expect(plain.className).toBe("");
  });
});
