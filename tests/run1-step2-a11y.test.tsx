/**
 * Run 1 step 2 (P1 accessibility): A-09 notification panel focus / Escape / counted name / per-row mark read / loading;
 * A-27 phone navigation reaches every child of a group, named landmark; D-01 / D-07 the avatars variant names every
 * assignee and opens a keyboard-reachable list with Remove / Done; FrappeAssignTo derives the write right and shows a
 * docinfo failure. jsdom; Frappe parts over a stub client (request shapes only).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssigneeGroup, MobileNav, NotificationPanel, ThemeProvider, type NavItem, type NotificationItem } from "../src";
import { FrappeProvider } from "../src/frappe";
import { FrappeAssignTo } from "../src/frappe/record";
import type { DocInfo, FrappeDoc } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

describe("A-09 NotificationPanel", () => {
  const now = Date.now();
  const items: NotificationItem[] = [
    { id: "a", body: "Deal D-1 assigned to you", at: now - 60_000, read: false },
    { id: "b", body: "Lead L-2 commented", at: now - 120_000, read: false },
    { id: "c", body: "Old", at: now - 3 * 86400_000, read: true },
  ];

  it("the bell is named with the unread count (en / ar); without unread it is just Notifications", () => {
    const { unmount } = wrap(<NotificationPanel items={items} />);
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();
    unmount();
    const r = wrap(<NotificationPanel items={items} />, "ar");
    expect(screen.getByRole("button", { name: "الإشعارات، 2 غير مقروءة" })).toBeTruthy();
    r.unmount();
    wrap(<NotificationPanel items={[items[2]!]} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it("opening moves focus into the panel; Escape closes it and returns focus to the bell", async () => {
    wrap(<NotificationPanel items={items} />);
    const bell = screen.getByRole("button", { name: /Notifications/ });
    bell.focus(); fireEvent.click(bell);
    const panel = screen.getByRole("complementary", { name: "Notifications" });
    expect(bell.getAttribute("aria-controls")).toBe(panel.id);
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); });
    expect(screen.queryByRole("complementary", { name: "Notifications" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(bell));
  });

  it("closing with × or by opening a row also returns focus to the bell", async () => {
    const opened: string[] = [];
    wrap(<NotificationPanel items={items} onItemClick={(n) => opened.push(n.id)} />);
    const bell = screen.getByRole("button", { name: /Notifications/ });
    fireEvent.click(bell);
    fireEvent.click(within(screen.getByRole("complementary")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(bell));
    fireEvent.click(bell);
    fireEvent.click(within(screen.getByRole("complementary")).getByText("Deal D-1 assigned to you"));
    expect(opened).toEqual(["a"]);
    await waitFor(() => expect(document.activeElement).toBe(bell));
  });

  it("onMarkRead: a per-row Mark as read on unread rows; it does not open the row; none on read rows", () => {
    const opened: string[] = []; const marked: string[] = [];
    wrap(<NotificationPanel items={items} onItemClick={(n) => opened.push(n.id)} onMarkRead={(n) => marked.push(n.id)} />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    const panel = screen.getByRole("complementary");
    const marks = within(panel).getAllByRole("button", { name: /^Mark as read:/ });
    expect(marks).toHaveLength(2);
    fireEvent.click(within(panel).getByRole("button", { name: "Mark as read: Deal D-1 assigned to you" }));
    expect(marked).toEqual(["a"]);
    expect(opened).toEqual([]);
    expect(screen.getByRole("complementary")).toBeTruthy(); // still open
  });

  it("NEGATIVE: without onMarkRead there is no per-row button (0.7 markup); loading shows a status, not the empty state", () => {
    const { rerender } = wrap(<NotificationPanel items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.queryByRole("button", { name: /Mark as read:/ })).toBeNull();
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><NotificationPanel items={[]} loading /></ThemeProvider>);
    expect(screen.getByRole("status").textContent).toBe("Loading notifications…");
    expect(screen.queryByText("No notifications yet.")).toBeNull();
  });
});

describe("A-27 MobileNav", () => {
  const Dot = () => <span />;
  const items: NavItem[] = [
    { id: "home", href: "/home", label: "Home", icon: Dot },
    { id: "sales", label: "Sales", href: "/sales", icon: Dot, children: [
      { id: "deals", href: "/sales/deals", label: "Deals" }, { id: "leads", href: "/sales/leads", label: "Leads" }, { id: "quotes", href: "/sales/quotes", label: "Quotes" },
    ] },
  ];

  it("default mode: every child of a group is reachable from More (indented), not just the first", async () => {
    const nav = vi.fn();
    wrap(<MobileNav items={items} currentPath="/sales/leads" onNavigate={nav} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /More/ })); });
    const sheet = await screen.findByRole("dialog");
    for (const label of ["Sales", "Deals", "Leads", "Quotes"]) expect(within(sheet).getByRole("link", { name: label })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Leads" }).getAttribute("aria-current")).toBe("page");
    expect(within(sheet).getByRole("link", { name: "Sales" }).getAttribute("aria-current")).toBeNull(); // only the deepest is current
    expect((within(sheet).getByRole("link", { name: "Quotes" }) as HTMLElement).style.paddingInlineStart).not.toBe("");
    fireEvent.click(within(sheet).getByRole("link", { name: "Quotes" }));
    expect(nav).toHaveBeenCalledWith("/sales/quotes", expect.objectContaining({ id: "quotes" }));
  });

  it("the bar is a named landmark (en / ar); More says it opens a dialog and controls it", async () => {
    const { unmount } = wrap(<MobileNav items={items} currentPath="/home" onNavigate={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    const more = screen.getByRole("button", { name: /More/ });
    expect(more.getAttribute("aria-haspopup")).toBe("dialog");
    await act(async () => { fireEvent.click(more); });
    expect(more.getAttribute("aria-controls")).toBe((await screen.findByRole("dialog")).id);
    unmount();
    wrap(<MobileNav items={items} currentPath="/home" onNavigate={() => {}} />, "ar");
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeTruthy();
  });
});

describe("D-01 / D-07 AssigneeGroup avatars variant", () => {
  const people = Array.from({ length: 6 }, (_, i) => ({ id: `u${i}`, name: `User ${i}` }));

  it("the stack is one button named with EVERY assignee (overflow included); it opens the full named list", async () => {
    wrap(<AssigneeGroup assignees={people} maxVisible={3} searchUsers={async () => []} />);
    const stack = screen.getByRole("button", { name: "Assigned to: User 0, User 1, User 2, User 3, User 4, User 5" });
    expect(within(stack).getByText("+3")).toBeTruthy();
    fireEvent.click(stack);
    const list = await screen.findByRole("list", { name: "Assigned to" });
    expect(within(list).getAllByRole("listitem").map((l) => l.textContent)).toEqual(people.map((p) => expect.stringContaining(p.name)));
  });

  it("Remove is reachable by keyboard in the list (Tab), and runs onRemove; Done for the assignee", async () => {
    const removed: string[] = []; const done: string[] = [];
    wrap(<AssigneeGroup assignees={people.slice(0, 2)} canRemove={() => true} onRemove={(a) => { removed.push(a.id); }}
      onComplete={(a) => { done.push(a.id); }} canComplete={(a) => a.id === "u1"} searchUsers={async () => []} />);
    const stack = screen.getByRole("button", { name: /Assigned to:/ });
    stack.focus(); fireEvent.keyDown(stack, { key: "Enter" }); fireEvent.click(stack);
    const rm = await screen.findByRole("button", { name: "Remove User 0" });
    expect(rm.className).not.toContain("hidden"); // before: display:none until hover / focus-within
    rm.focus(); expect(document.activeElement).toBe(rm);
    fireEvent.click(rm);
    await waitFor(() => expect(removed).toEqual(["u0"]));
    fireEvent.click(screen.getByRole("button", { name: "Done: User 1" }));
    await waitFor(() => expect(done).toEqual(["u1"]));
  });

  it("Arabic: the stack's name uses the Arabic heading and separator", () => {
    wrap(<AssigneeGroup assignees={people.slice(0, 2)} searchUsers={async () => []} />, "ar");
    const stack = document.querySelector("[data-assignee-stack]")!;
    expect(stack.getAttribute("aria-label")).toMatch(/User 0، User 1$/);
  });
});

describe("D-01 / D-07 FrappeAssignTo (group layout, stub client)", () => {
  const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "creator@x", docstatus: 0, modified: "2026-11-01 10:00:00" };
  const info = (perms: Record<string, number>): DocInfo => ({
    attachments: [], communications: [], comments: [], versions: [], assignments: [{ name: "T1", owner: "bob@x", description: "d", status: "Open" }],
    assignment_logs: [], shared: [], views: [], permissions: perms, user_info: { "bob@x": { fullname: "Bob Ray" } },
  } as never);
  function mount(getDocInfo: () => Promise<DocInfo>, ui: React.ReactElement) {
    const c = {
      call: vi.fn(async () => ({ message: [] })), subscribeMessages: () => () => {}, addComment: vi.fn(), getMetaBundle: vi.fn(async () => ({ doctype: "Deal", meta: { name: "Deal", fields: [], permissions: [{ role: "Sales User", permlevel: 0, read: 1, write: 1 }] }, children: {} })),
      getDocInfo: vi.fn(getDocInfo), searchLink: vi.fn(async () => []), addAssignment: vi.fn(async () => []), removeAssignment: vi.fn(async () => []),
    };
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FrappeProvider client={c as never} session={{ user: "me@x", roles: ["Sales User"] }}><ThemeProvider storageKeys={null}>{ui}</ThemeProvider></FrappeProvider>
    </QueryClientProvider>);
    return c;
  }

  it("canWrite omitted: a writer (role write + docinfo.permissions.write) may remove someone else's assignment", async () => {
    mount(async () => info({ read: 1, write: 1 }), <FrappeAssignTo doc={doc} user="me@x" variant="list" />);
    expect(await screen.findByRole("button", { name: "Remove Bob Ray" })).toBeTruthy();
  });

  it("NEGATIVE: a reader cannot remove someone else's; canWrite={false} still overrides a writer", async () => {
    mount(async () => info({ read: 1, write: 0 }), <FrappeAssignTo doc={doc} user="me@x" variant="list" />); // Desk sends every right, 0 / 1
    await screen.findByText("Bob Ray");
    expect(screen.queryByRole("button", { name: "Remove Bob Ray" })).toBeNull();
    cleanup();
    mount(async () => info({ read: 1, write: 1 }), <FrappeAssignTo doc={doc} user="me@x" variant="list" canWrite={false} />);
    await screen.findByText("Bob Ray");
    expect(screen.queryByRole("button", { name: "Remove Bob Ray" })).toBeNull();
  });

  it("a failed get_docinfo is shown as an error, not as 'nobody assigned'", async () => {
    mount(async () => { throw new Error("Not permitted"); }, <FrappeAssignTo doc={doc} user="me@x" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Not permitted");
    expect(screen.queryByText(/Not assigned|No one/i)).toBeNull();
  });
});
