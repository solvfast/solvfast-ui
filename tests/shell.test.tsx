import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Folder, Home, Settings } from "lucide-react";
import {
  AppShell, MobileNav, Navbar, NotificationPanel, Sidebar, ThemeProvider, defaultIsActive, deepestActive,
  type NavItem, type NotificationItem,
} from "../src";

const html = document.documentElement;
beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

// 3 levels deep, plus an `exclude` rule
const ITEMS: NavItem[] = [
  { id: "home", href: "/app/home", icon: Home, label: { en: "Home", ar: "الرئيسية" } },
  {
    id: "lib", href: "/app/lib", icon: Folder, label: "Library", exclude: ["/app/lib/config"],
    children: [
      { id: "lib-a", href: "/app/lib/a", label: "Shelf A", children: [{ id: "lib-a-1", href: "/app/lib/a/one", label: "Box 1" }] },
      { id: "lib-b", href: "/app/lib/b", label: "Shelf B" },
    ],
  },
  { id: "config", href: "/app/lib/config", icon: Settings, label: "Configuration" },
];

describe("navigation model", () => {
  it("active = own href or any descendant, unless excluded", () => {
    expect(defaultIsActive(ITEMS[1], "/app/lib/a/one")).toBe(true);
    expect(defaultIsActive(ITEMS[1], "/app/lib/config/x")).toBe(false); // excluded: a sibling owns it
    expect(defaultIsActive(ITEMS[2], "/app/lib/config/x")).toBe(true);
    expect(defaultIsActive(ITEMS[0], "/app/homepage")).toBe(false); // prefix of a segment is not a match
  });
  it("title = deepest active item", () => {
    expect(deepestActive(ITEMS, "/app/lib/a/one")?.id).toBe("lib-a-1");
  });
});

describe("Sidebar", () => {
  const renderSidebar = (path: string, extra: Partial<Parameters<typeof Sidebar>[0]> = {}) => {
    const nav = vi.fn(); const collapse = vi.fn();
    render(
      <ThemeProvider defaultLanguage="en">
        <Sidebar brand={{ name: "Acme", href: "/app" }} items={ITEMS} currentPath={path} onNavigate={nav} collapsed={false} onCollapsedChange={collapse} {...extra} />
      </ThemeProvider>,
    );
    return { nav, collapse };
  };

  it("opens the active group down to the third level and marks the leaf current", () => {
    renderSidebar("/app/lib/a/one");
    const leaf = screen.getByRole("button", { name: "Box 1" });
    expect(leaf.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Library/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("navigates through the adapter (no router) and toggles groups", () => {
    const { nav } = renderSidebar("/app/home");
    expect(screen.queryByRole("button", { name: "Shelf A" })).toBeNull(); // group closed when inactive
    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: "Shelf B" }));
    expect(nav).toHaveBeenCalledWith("/app/lib/b", expect.objectContaining({ id: "lib-b" }));
    fireEvent.click(screen.getByRole("button", { name: "Acme" }));
    expect(nav).toHaveBeenLastCalledWith("/app");
  });

  it("exclude keeps the parent inactive under a sibling's sub-tree", () => {
    renderSidebar("/app/lib/config");
    expect(screen.getByRole("button", { name: /Library/ }).className).not.toContain("bg-primary/10");
    expect(screen.getByRole("button", { name: "Configuration" }).getAttribute("aria-current")).toBe("page");
  });

  it("collapsed rail: groups degrade to leaves that navigate to the parent", () => {
    const { nav } = renderSidebar("/app/home", { collapsed: true });
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(nav).toHaveBeenCalledWith("/app/lib", expect.anything());
  });
});

describe("AppShell", () => {
  it("persists the rail under the configured key and derives the title", () => {
    localStorage.setItem("studio_sidebar_collapsed", "1");
    const onChange = vi.fn();
    render(
      <ThemeProvider defaultLanguage="en">
        <AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/lib/b" onNavigate={() => {}} collapsedStorageKey="studio_sidebar_collapsed" onCollapsedChange={onChange}>
          <p>body</p>
        </AppShell>
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Shelf B");
    const toggle = screen.getByRole("button", { name: "Expand sidebar" }); // started collapsed from storage
    fireEvent.click(toggle);
    expect(localStorage.getItem("studio_sidebar_collapsed")).toBe("0");
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("Navbar", () => {
  it("renders without any provider (Sear's TopBar crashed)", () => {
    expect(() => render(<Navbar title="Overview" />)).not.toThrow();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
  });

  it("toggles language and theme through ThemeProvider; search is controlled and submits", () => {
    const changes: string[] = []; const submits: string[] = [];
    render(
      <ThemeProvider defaultLanguage="en" defaultTheme="light">
        <Navbar title="T" search={{ value: "abc", onChange: (v) => changes.push(v), onSubmit: (v) => submits.push(v) }} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(html.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Toggle language" }));
    expect(html.getAttribute("dir")).toBe("rtl");
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "abcd" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(changes).toEqual(["abcd"]);
    expect(submits).toEqual(["abc"]);
  });

  it("search={false} hides it; a node replaces it", () => {
    const { rerender } = render(<Navbar title="T" search={false} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    rerender(<Navbar title="T" search={<span>custom search</span>} />);
    expect(screen.getByText("custom search")).toBeTruthy();
  });
});

describe("NotificationPanel", () => {
  const now = Date.now();
  const items: NotificationItem[] = Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, body: `Item ${i}`, at: now - i * 60_000, read: i >= 10 }));

  it("badge caps at 9+, filters, marks all, opens rows and closes", () => {
    const opened: string[] = []; const markAll = vi.fn();
    render(<ThemeProvider defaultLanguage="en"><NotificationPanel items={items} onItemClick={(n) => opened.push(n.id)} onMarkAllRead={markAll} /></ThemeProvider>);
    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(within(bell).getByText("9+")).toBeTruthy();
    fireEvent.click(bell);
    const panel = screen.getByRole("complementary", { name: "Notifications" });
    expect(within(panel).getByText("Today")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Unread" }));
    expect(within(panel).queryByText("Item 10")).toBeNull(); // read item hidden
    fireEvent.click(within(panel).getByRole("button", { name: "Mark all as read" }));
    expect(markAll).toHaveBeenCalled();
    fireEvent.click(within(panel).getByText("Item 3"));
    expect(opened).toEqual(["n3"]);
    expect(screen.queryByRole("complementary", { name: "Notifications" })).toBeNull(); // closed on open
  });

  it("empty states", () => {
    render(<ThemeProvider defaultLanguage="ar"><NotificationPanel items={[]} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "الإشعارات" }));
    expect(screen.getByText("لا توجد إشعارات بعد.")).toBeTruthy();
  });
});

describe("MobileNav", () => {
  it("first leaves in the bar, the rest in More; the sheet opens on the start edge", async () => {
    const nav = vi.fn();
    const many: NavItem[] = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, href: `/x/${i}`, label: `Item ${i}` }));
    render(<ThemeProvider defaultLanguage="ar"><MobileNav items={many} currentPath="/x/5" onNavigate={nav} exit={{ href: "/home" }} /></ThemeProvider>);
    expect(screen.getByText("Item 3")).toBeTruthy();
    expect(screen.queryByText("Item 4")).toBeNull();
    const more = screen.getByRole("button", { name: /المزيد/ });
    expect(more.className).toContain("text-brand-flame"); // overflow item is active
    await act(async () => { fireEvent.click(more); });
    const sheet = await screen.findByRole("dialog");
    expect(sheet.className).toContain("start-0"); // logical start: right edge in RTL (Sear: left)
    fireEvent.click(within(sheet).getByText("Item 4"));
    expect(nav).toHaveBeenCalledWith("/x/4", expect.objectContaining({ id: "i4" }));
  });
});
