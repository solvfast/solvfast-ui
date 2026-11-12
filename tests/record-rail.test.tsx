/** RecordRail (src/record/RecordRail.tsx): the CRM record page's right rail, ported 1:1 from the CRM. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Building2, GitBranch, ShieldCheck, User } from "lucide-react";
import {
  RecordRail, RecordRailCard, RecordRailSection, RecordRailRow, RecordRailCustomize, RecordRailFooter, RecordRailAssignment,
  RecordRailLinkedRecord, RecordRailTasks, RecordRailArticles, RecordRailArticleReader, recordRailCardClass, ThemeProvider,
} from "../src";
import * as core from "../src";
import * as record from "../src/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => { cleanup(); try { window.localStorage.clear(); } catch { /* none */ } });

const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);
const classes = (el: Element | null) => new Set((el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
const hasAll = (el: Element | null, list: string) => list.split(/\s+/).every((c) => classes(el).has(c));

describe("RecordRail — exports", () => {
  it("is exported from the core entry and src/record", () => {
    expect(core.RecordRail).toBe(record.RecordRail);
    expect(core.RecordRailSection).toBe(record.RecordRailSection);
    expect(core.RecordRailArticles).toBe(record.RecordRailArticles);
  });
});

describe("RecordRailCard — the CRM SidebarCard", () => {
  it("draws the CRM card: surface classes, uppercase header, hover grip, icon, title, action", () => {
    const { container } = wrap(<RecordRailCard title="Contacts (3)" icon={User} accent="border-cyan-500/20 hover:border-cyan-500/40" action={<button>+</button>}><p>rows</p></RecordRailCard>);
    const card = container.querySelector("[data-record-rail-card]");
    // the CRM's SidebarCard string + the accent (the CRM's DS look turns `.bg-card.rounded-xl` into the glass pane)
    expect(hasAll(card, "group rounded-xl border bg-card p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow border-cyan-500/20 hover:border-cyan-500/40")).toBe(true);
    const h4 = card!.querySelector("h4")!;
    expect(hasAll(h4, "min-w-0 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 text-foreground")).toBe(true);
    expect(h4.textContent).toBe("Contacts (3)");
    const grip = h4.querySelector("span[title]")!;
    expect(grip.getAttribute("title")).toBe("Drag to reorder");
    expect(hasAll(grip, "opacity-0 group-hover:opacity-100")).toBe(true);
    expect(screen.getByText("rows")).toBeTruthy();
    expect(screen.getByRole("button", { name: "+" })).toBeTruthy();
  });

  it("defaults the accent to primary; recordRailCardClass can drop the stack spacing (FrappeAttachments' card)", () => {
    const { container } = wrap(<RecordRailCard title="X" icon={User} />);
    expect(hasAll(container.querySelector("[data-record-rail-card]"), "border-primary/20 hover:border-primary/40")).toBe(true);
    expect(recordRailCardClass("border-teal-500/20", false)).toBe("group rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow border-teal-500/20");
  });

  it("spreads drag-handle props on the grip", () => {
    const { container } = wrap(<RecordRailCard title="X" icon={User} dragHandle={{ "data-handle": "yes", className: "cursor-grab" }} />);
    const grip = container.querySelector("[data-handle='yes']")!;
    expect(classes(grip).has("cursor-grab")).toBe(true);
  });
});

describe("RecordRailSection — kind-driven header controls", () => {
  it("process: no controls", () => {
    wrap(<RecordRailSection title="Lifecycle" icon={GitBranch} spec={{ kind: "process" }}>x</RecordRailSection>);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it("multi: count in the title and a Link button", () => {
    const onAdd = vi.fn();
    wrap(<RecordRailSection title="Contacts" icon={User} spec={{ kind: "multi", count: 3, onAdd }}>x</RecordRailSection>);
    expect(screen.getByRole("heading").textContent).toBe("Contacts (3)");
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(onAdd).toHaveBeenCalled();
  });
  it("multi with no records: no count", () => {
    wrap(<RecordRailSection title="Contacts" icon={User} spec={{ kind: "multi", count: 0 }}>x</RecordRailSection>);
    expect(screen.getByRole("heading").textContent).toBe("Contacts");
  });
  it("single: Change and Clear (Arabic labels from the provider)", () => {
    const onChange = vi.fn(); const onClear = vi.fn();
    wrap(<RecordRailSection title="المؤسسة" icon={Building2} spec={{ kind: "single", onChange, onClear }}>x</RecordRailSection>, "ar");
    fireEvent.click(screen.getByRole("button", { name: "تغيير" }));
    fireEvent.click(screen.getByRole("button", { name: "مسح" }));
    expect(onChange).toHaveBeenCalled(); expect(onClear).toHaveBeenCalled();
  });
  it("content: optional Add; explicit labels win; notice renders above the body", () => {
    wrap(<RecordRailSection title="Notes" icon={User} spec={{ kind: "content", onAdd: () => {} }} labels={{ add: "New note" }} notice={<p>sample data</p>}>body</RecordRailSection>);
    expect(screen.getByRole("button", { name: "New note" })).toBeTruthy();
    const card = document.querySelector("[data-record-rail-card]")!;
    expect(card.textContent!.indexOf("sample data")).toBeLessThan(card.textContent!.indexOf("body"));
  });
});

describe("RecordRailRow — the CRM RelatedRecordRow", () => {
  it("renders #id, name (Arabic when asked), subline, chips; a clickable row is a keyboard-operable div[role=button]", () => {
    const onClick = vi.fn();
    wrap(<RecordRailRow icon={Building2} recordId="REQ-208" name="Al-Faisaliah Group" nameAr="مجموعة الفيصلية" isAr subline="Corporate" chips={<span>chip</span>} onClick={onClick} />);
    const row = screen.getByRole("button");
    expect(row.tagName).toBe("DIV");
    expect(row.textContent).toContain("#REQ-208");
    expect(row.textContent).toContain("مجموعة الفيصلية");
    expect(row.textContent).toContain("chip");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("is not interactive without onClick", () => {
    wrap(<RecordRailRow icon={Building2} name="Org" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("RecordRailCustomize", () => {
  it("lists the options with their checked state and toggles", () => {
    const onToggle = vi.fn();
    wrap(<RecordRailCustomize options={[{ id: "a", label: "Assignment" }, { id: "b", label: "Tasks" }]} visible={new Set(["a"])} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    const group = screen.getByRole("group", { name: "Visible sections" });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("data-state"))).toEqual(["checked", "unchecked"]);
    fireEvent.click(boxes[1]);
    expect(onToggle).toHaveBeenCalledWith("b");
  });
});

describe("RecordRail — the container", () => {
  const sections = [
    { id: "workflow", label: "Lifecycle", pinned: true, render: () => <p>LC</p> },
    { id: "assignment", label: "Assignment", render: () => <p>AS</p> },
    { id: "tasks", label: "Tasks", render: () => <p>TK</p> },
    { id: "playbook", label: "Playbook", render: () => null },
  ];
  const order = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-record-rail] p")).map((p) => p.textContent).filter((t) => t && t.length === 2);

  it("pinned first, then the visible sections in order, footer, then `after`; pinned is not in Customize", () => {
    const { container } = wrap(<RecordRail sections={sections} footer={<p>FT</p>} after={<p>AR</p>} />);
    expect(order(container)).toEqual(["LC", "AS", "TK", "FT", "AR"]);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    expect(within(screen.getByRole("group")).queryByText("Lifecycle")).toBeNull();
    expect(within(screen.getByRole("group")).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("hides a section from Customize (uncontrolled, not persisted by default)", () => {
    const { container } = wrap(<RecordRail sections={sections} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    fireEvent.click(within(screen.getByRole("group")).getAllByRole("checkbox")[0]);
    expect(order(container)).toEqual(["LC", "TK"]);
    expect(window.localStorage.length).toBe(0);
  });

  it("controlled: `visible` decides; onVisibleChange reports the next set", () => {
    const onVisibleChange = vi.fn();
    const { container } = wrap(<RecordRail sections={sections} visible={new Set(["tasks"])} onVisibleChange={onVisibleChange} />);
    expect(order(container)).toEqual(["LC", "TK"]);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    fireEvent.click(within(screen.getByRole("group")).getAllByRole("checkbox")[0]);
    expect([...onVisibleChange.mock.calls[0][0]]).toEqual(["tasks", "assignment"]);
  });

  it("storageKey persists the hidden ids and restores them", () => {
    const first = wrap(<RecordRail sections={sections} storageKey="deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    fireEvent.click(within(screen.getByRole("group")).getAllByRole("checkbox")[1]);
    expect(JSON.parse(window.localStorage.getItem("sf-record-rail:deal")!)).toEqual(["tasks"]);
    first.unmount();
    const { container } = wrap(<RecordRail sections={sections} storageKey="deal" />);
    expect(order(container)).toEqual(["LC", "AS"]);
  });

  it("customize={false} hides the button", () => {
    wrap(<RecordRail sections={sections} customize={false} />);
    expect(screen.queryByRole("button", { name: "Customize sections" })).toBeNull();
  });
});

describe("RecordRail modules", () => {
  it("footer: lines with who / when (exact time as tooltip), Seen by avatars; a line without who is skipped", () => {
    const { container } = wrap(<RecordRailFooter lines={[{ label: "Created by", who: "Sara", when: "3d ago", whenTitle: "9 Nov 2026" }, { label: "Last edited by" }]}
      seenBy={{ label: "Seen by", people: [{ name: "Sara Al-Otaibi", title: "Sara · 1h ago" }] }} />);
    expect(container.textContent).toContain("Created bySara· 3d ago");
    expect(container.textContent).not.toContain("Last edited by");
    expect(screen.getByTitle("9 Nov 2026")).toBeTruthy();
    expect(screen.getByTitle("Sara · 1h ago").textContent).toBe("SA");
  });

  it("assignment: assignee slot, Team row, Auto-assign, footer", () => {
    const auto = vi.fn();
    wrap(<RecordRailSection title="Assignment" icon={ShieldCheck} spec={{ kind: "single" }}>
      <RecordRailAssignment team={{ label: "Team", value: "Reservations" }} autoAssign={{ label: "Auto-assign", onClick: auto }} footer={<p>todos</p>}>
        <p>assignees</p>
      </RecordRailAssignment>
    </RecordRailSection>);
    expect(screen.getByText("Reservations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Auto-assign" }));
    expect(auto).toHaveBeenCalled();
    expect(screen.getByText("todos")).toBeTruthy();
  });

  it("linked record: the row or the empty line; Clear only while linked; picker slot", () => {
    const onClear = vi.fn();
    const { rerender } = wrap(<RecordRailLinkedRecord title="Organization" icon={Building2} emptyLabel="No linked organization" onChange={() => {}} onClear={onClear}
      record={{ name: "Al-Faisaliah Group", subline: "Corporate", onClick: () => {} }} picker={<input aria-label="Search organizations" />} />);
    expect(screen.getByText("Al-Faisaliah Group")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search organizations" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
    rerender(<ThemeProvider><RecordRailLinkedRecord title="Organization" icon={Building2} emptyLabel="No linked organization" onChange={() => {}} onClear={onClear} /></ThemeProvider>);
    expect(screen.getByText("No linked organization")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
  });

  it("tasks: count in the title, state badge, Open link only where allowed, at most `max` rows, no + by default", () => {
    const open = vi.fn();
    wrap(<RecordRailTasks title="Tasks" emptyLabel="No linked tasks" openLabel="Open in My Work" max={2} tasks={[
      { id: "1", title: "Prep talking points", subline: "Assignee: Layla", status: "To Do", onOpen: open },
      { id: "2", title: "Send proposal", status: "Evaluation" },
      { id: "3", title: "Third" },
    ]} />);
    expect(screen.getByRole("heading").textContent).toBe("Tasks (3)");
    expect(screen.getByText("To Do")).toBeTruthy();
    expect(screen.queryByText("Third")).toBeNull();
    const links = screen.getAllByRole("button", { name: "Open in My Work" });
    expect(links).toHaveLength(1);
    fireEvent.click(links[0]);
    expect(open).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
  });

  it("tasks: empty line", () => {
    wrap(<RecordRailTasks title="Tasks" emptyLabel="No linked tasks" openLabel="Open" tasks={[]} />);
    expect(screen.getByRole("heading").textContent).toBe("Tasks");
    expect(screen.getByText("No linked tasks")).toBeTruthy();
  });

  it("articles: header + count + rows that open; nothing when empty; Arabic title", () => {
    const onOpen = vi.fn();
    const { container, rerender } = wrap(<RecordRailArticles articles={[{ id: "a1", title: "When will my refund reach my card", meta: "FAQ · from Senaiy-Pedia" }]} onOpen={onOpen} />, "ar");
    expect(screen.getByRole("heading").textContent).toBe("المقالات");
    expect(container.querySelector("[data-record-rail-articles]")!.textContent).toContain("1");
    fireEvent.click(screen.getByRole("button", { name: /refund/ }));
    expect(onOpen).toHaveBeenCalledWith("a1");
    rerender(<ThemeProvider><RecordRailArticles articles={[]} onOpen={onOpen} /></ThemeProvider>);
    expect(container.querySelector("[data-record-rail-articles]")).toBeNull();
  });

  it("article reader: kicker, title, body, Open-in link; closes through the sheet", () => {
    const onClose = vi.fn();
    wrap(<RecordRailArticleReader open onClose={onClose} kicker="FAQ · from Senaiy-Pedia" title="Refunds" link={{ href: "/kb/a1", label: "Open in Senaiy-Pedia" }}><p>Body text</p></RecordRailArticleReader>);
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByRole("heading", { name: "Refunds" })).toBeTruthy();
    expect(within(dlg).getByText("Body text")).toBeTruthy();
    expect(within(dlg).getByRole("link", { name: /Open in Senaiy-Pedia/ }).getAttribute("href")).toBe("/kb/a1");
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("uses logical (RTL-safe) placement only and no hard-coded colours", () => {
    const { container } = wrap(<RecordRail sections={[
      { id: "o", label: "Organization", render: () => <RecordRailLinkedRecord title="Organization" icon={Building2} emptyLabel="none" onChange={() => {}} record={{ name: "Org", action: <button>x</button> }} /> },
      { id: "t", label: "Tasks", render: () => <RecordRailTasks title="Tasks" emptyLabel="none" openLabel="Open" tasks={[{ id: "1", title: "T", status: "S", onOpen: () => {} }]} /> },
    ]} footer={<RecordRailFooter lines={[{ label: "Created by", who: "A" }]} seenBy={{ label: "Seen by", people: [{ name: "A B" }] }} />}
      after={<RecordRailArticles articles={[{ id: "a", title: "A" }]} onOpen={() => {}} />} />, "ar");
    const html = container.innerHTML;
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});
