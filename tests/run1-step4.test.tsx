/**
 * Run 1 step 4 — accessibility and navigation: A-28 skip link, A-29 tab title, A-23 sidebar landmark / sections / scroll,
 * A-25 navigation links, B-02 subject link, B-56 list keyboard, C-08 field chrome, C-57 grid keyboard, A-22 RTL languages
 * and boot.lang, A-61 session expiry, C-79 newer copy on the server, D-43 communications paging, D-64 palette and pill
 * contrast. jsdom; Frappe parts over stub clients / the in-package simulator (real site: pending).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AppShell, DataGrid, ListView, Sidebar, StatusBadge, ThemeProvider, isRtlLanguage, resolveStatusColor, useLocale, type ColumnDef, type DataGridColumn, type NavItem } from "../src";
import { FrappeError, FrappeProvider, createFrappeClient, loginRedirectUrl } from "../src/frappe";
import { resetBootLanguageForTests } from "../src/frappe/FrappeProvider";
import { FrappeField, FrappeFormView } from "../src/frappe/form";
import { useCommunications } from "../src/frappe/record/useCommunications";
import type { DocTypeMeta, FrappeDoc, FrappeDocField } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.title = ""; });
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

const ITEMS: NavItem[] = [
  { id: "home", href: "/app/home", label: "Home" },
  { id: "sales", label: "Sales", section: true, children: [{ id: "deals", href: "/app/deals", label: "Deals" }, { id: "leads", href: "/app/leads", label: "Leads" }] },
];

describe("A-28 skip link / A-29 tab title (AppShell)", () => {
  it("the first Tab stop is 'Skip to main content'; activating it focuses <main> without touching the URL", () => {
    wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null}><p>page</p></AppShell>);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    const focusables = [...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex='0']")];
    expect(focusables[0]).toBe(link);
    const before = location.href;
    fireEvent.click(link);
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(location.href).toBe(before);
  });
  it("Arabic: the skip link is in Arabic", () => {
    wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null}><p>page</p></AppShell>, "ar");
    expect(screen.getByRole("link", { name: "انتقل إلى المحتوى الرئيسي" })).toBeTruthy();
  });
  it("document.title follows the page ('{title} · {brand}'), is restored on unmount; false leaves it; a function builds it", () => {
    document.title = "Before";
    const { unmount } = wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null}><p>x</p></AppShell>);
    expect(document.title).toBe("Deals · Acme");
    unmount();
    expect(document.title).toBe("Before");
    const r = wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null} documentTitle={false}><p>x</p></AppShell>);
    expect(document.title).toBe("Before");
    r.unmount();
    wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null} documentTitle={(t, b) => `${b} | ${t}`}><p>x</p></AppShell>);
    expect(document.title).toBe("Acme | Deals");
  });
});

describe("A-23 / A-25 Sidebar", () => {
  it("the navigation is a named landmark (en / ar); a section heading collapses its items (aria-expanded)", () => {
    const { unmount } = wrap(<Sidebar brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsed={false} onCollapsedChange={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    const heading = screen.getByRole("button", { name: "Sales" });
    expect(heading.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Leads" })).toBeTruthy();
    fireEvent.click(heading);
    expect(heading.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Leads" })).toBeNull();
    unmount();
    wrap(<Sidebar brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsed={false} onCollapsedChange={() => {}} />, "ar");
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeTruthy();
  });
  it("the current item is scrolled into view on mount", () => {
    const spy = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = spy;
    wrap(<Sidebar brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/leads" onNavigate={() => {}} collapsed={false} onCollapsedChange={() => {}} />);
    expect(spy).toHaveBeenCalled();
    expect((spy.mock.contexts[0] as HTMLElement).textContent).toBe("Leads");
  });
  it("items are links: a plain click goes through onNavigate (default prevented); Ctrl / ⌘ / middle click are left to the browser", () => {
    const nav = vi.fn();
    wrap(<Sidebar brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/home" onNavigate={nav} collapsed={false} onCollapsedChange={() => {}} />);
    const deals = screen.getByRole("link", { name: "Deals" });
    expect(deals.getAttribute("href")).toBe("/app/deals");
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    deals.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(nav).toHaveBeenCalledWith("/app/deals", expect.objectContaining({ id: "deals" }));
    nav.mockClear();
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }] as MouseEventInit[]) {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
      deals.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(nav).not.toHaveBeenCalled();
  });
});

type Row = { id: string; title: string; status: string };
const ROWS: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: `R${i}`, title: `Row ${i}`, status: "Open" }));
const COLS: ColumnDef<Row>[] = [{ key: "title", label: "Title", href: (r) => `/app/thing/${r.id}`, title: (r) => r.title }, { key: "status", label: "Status" }];
const rows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => tr.querySelectorAll("td").length > 1);

describe("B-02 / B-56 ListView", () => {
  it("B-02 a column with href is a link: plain click opens the row in the app (no browser navigation); Ctrl/⌘-click does not open the row", () => {
    const open = vi.fn();
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} onRowClick={open} />);
    const link = within(rows()[1]!).getByRole("link", { name: "Row 1" });
    expect(link.getAttribute("href")).toBe("/app/thing/R1");
    expect(link.closest("td")?.getAttribute("title")).toBe("Row 1");
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith(ROWS[1]);
    open.mockClear();
    const ctrl = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    link.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("B-56 one Tab stop; ↓ / ↑ move focus between rows, Space ticks, Shift+↓ extends, Enter opens; keys inside a control are ignored", () => {
    const open = vi.fn();
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} onRowClick={open} selectable />);
    expect(rows().map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    rows()[0]!.focus();
    fireEvent.keyDown(rows()[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows()[1]!.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(rows()[1]!, { key: " " });
    expect(rows()[1]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(rows()[1]!, { key: "ArrowDown", shiftKey: true });
    expect(document.activeElement).toBe(rows()[2]);
    expect(rows()[2]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(rows()[2]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows()[1]);
    fireEvent.keyDown(rows()[1]!, { key: "Enter" });
    expect(open).toHaveBeenCalledWith(ROWS[1]);
    const box = within(rows()[3]!).getByRole("checkbox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(rows()[4]);
  });
});

describe("C-08 field chrome (FrappeField)", () => {
  const client = createFrappeClient({ transport: async () => ({}) });
  const mount = (df: Partial<FrappeDocField> & { fieldtype: string }, value: unknown) => render(
    <ThemeProvider defaultLanguage="en" storageKeys={null}><QueryClientProvider client={new QueryClient()}><FrappeProvider client={client}>
      <FrappeField df={{ fieldname: "f", label: "Field", ...df } as FrappeDocField} value={value} onChange={() => {}} />
    </FrappeProvider></QueryClientProvider></ThemeProvider>,
  );
  it("a required Data field is aria-required and described by its description", () => {
    mount({ fieldtype: "Data", reqd: 1, description: "Your legal name" }, "x");
    const box = screen.getByRole("textbox", { name: "Field" });
    expect(box.getAttribute("aria-required")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Field", description: "Your legal name" })).toBe(box);
  });
  it("a required empty Check, Rating and Text Editor carry aria-invalid / aria-required", () => {
    const { unmount } = mount({ fieldtype: "Text Editor", reqd: 1 }, "");
    const ed = screen.getByRole("textbox", { name: "Field" });
    expect(ed.getAttribute("aria-invalid")).toBe("true");
    expect(ed.getAttribute("aria-required")).toBe("true");
    unmount();
    mount({ fieldtype: "Rating", reqd: 1 }, null);
    const rating = document.querySelector("[aria-invalid=true]");
    expect(rating).not.toBeNull();
  });
  it("NEGATIVE: an optional field is neither aria-required nor invalid", () => {
    mount({ fieldtype: "Data" }, "");
    const box = screen.getByRole("textbox", { name: "Field" });
    expect(box.getAttribute("aria-required")).toBeNull();
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });
});

describe("C-57 DataGrid keyboard", () => {
  type G = { id: string; item: string; qty: number };
  const columns: DataGridColumn<G>[] = [
    { key: "item", label: "Item", renderCell: (r) => r.item, renderEditor: (r) => <input aria-label={`item ${r.id}`} defaultValue={r.item} /> },
    { key: "qty", label: "Qty", renderCell: (r) => r.qty, renderEditor: (r) => <input aria-label={`qty ${r.id}`} defaultValue={String(r.qty)} /> },
  ];
  function Grid({ initial }: { initial: G[] }) {
    const [rows, setRows] = React.useState(initial);
    return <DataGrid<G> label="Items" rows={rows} getRowKey={(r) => r.id} columns={columns} onAddRow={() => setRows((r) => [...r, { id: `n${r.length + 1}`, item: "", qty: 0 }])} />;
  }
  it("Enter on a row's first cell opens it with the editor focused; ↓ moves to the same column of the next row", async () => {
    wrap(<Grid initial={[{ id: "a", item: "A", qty: 1 }, { id: "b", item: "B", qty: 2 }]} />);
    const cell = document.querySelector<HTMLElement>('tr[data-row-key="a"] td[data-col="item"]')!;
    expect(cell.getAttribute("tabindex")).toBe("0");
    expect(document.querySelector('tr[data-row-key="a"] td[data-col="qty"]')!.getAttribute("tabindex")).toBeNull(); // one stop per row
    cell.focus(); fireEvent.keyDown(cell, { key: "Enter" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "item a" })));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "item b" })));
  });
  it("Tab past the last editor of the last row adds a row and focuses its first editor", async () => {
    wrap(<Grid initial={[{ id: "a", item: "A", qty: 1 }]} />);
    const cell = document.querySelector<HTMLElement>('tr[data-row-key="a"] td[data-col="item"]')!;
    cell.focus(); fireEvent.keyDown(cell, { key: "Enter" });
    const qty = await screen.findByRole("textbox", { name: "qty a" });
    qty.focus(); fireEvent.keyDown(qty, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "item n2" })));
  });
});

describe("A-22 reading direction and boot.lang", () => {
  it("Frappe's RTL list: ar, he, fa, ps (any region) — not en / de", () => {
    expect(["ar", "he", "fa-IR", "ps", "AR_SA"].map(isRtlLanguage)).toEqual([true, true, true, true, true]);
    expect(["en", "de", "", undefined].map((x) => isRtlLanguage(x as string))).toEqual([false, false, false, false]);
  });
  it("locale='he': <html dir=rtl lang=he>, English chrome", () => {
    render(<ThemeProvider locale="he" storageKeys={null}><span /></ThemeProvider>);
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.getAttribute("lang")).toBe("he");
  });
  it("FrappeProvider applies boot.lang to the ThemeProvider (fa → rtl; ar → Arabic chrome); applyBootLanguage={false} does not", async () => {
    resetBootLanguageForTests();
    const Probe = () => { const l = useLocale(); return <span data-testid="p">{`${l.language}|${l.direction}|${l.locale}`}</span>; };
    const boot = (lang: string) => ({ session: { user: "u@x" }, csrfToken: "t", lang } as never);
    const client = createFrappeClient({ transport: async () => ({}) });
    const { unmount } = render(<ThemeProvider storageKeys={null}><FrappeProvider client={client} boot={boot("ar")}><Probe /></FrappeProvider></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("ar|rtl|ar"));
    unmount();
    const r2 = render(<ThemeProvider storageKeys={null}><FrappeProvider client={client} boot={boot("fa")}><Probe /></FrappeProvider></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("en|rtl|fa"));
    r2.unmount();
    render(<ThemeProvider storageKeys={null}><FrappeProvider client={client} boot={boot("ar")} applyBootLanguage={false}><Probe /></FrappeProvider></ThemeProvider>);
    expect(screen.getByTestId("p").textContent).toBe("en|ltr|en");
  });
  it("the boot language is applied once per page load: a provider mounted again does not undo the user's switch (review fix)", async () => {
    resetBootLanguageForTests();
    const client = createFrappeClient({ transport: async () => ({}) });
    const boot = { session: { user: "u@x" }, csrfToken: "t", lang: "ar" } as never;
    const Probe = () => { const l = useLocale(); return <button type="button" data-testid="p" onClick={() => l.setLanguage("en")}>{l.language}</button>; };
    function Page({ k }: { k: number }) { return <FrappeProvider key={k} client={client} boot={boot}><Probe /></FrappeProvider>; }
    const { rerender } = render(<ThemeProvider storageKeys={null}><Page k={1} /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("ar"));
    fireEvent.click(screen.getByTestId("p")); // the user switches to English
    rerender(<ThemeProvider storageKeys={null}><Page k={2} /></ThemeProvider>); // the next page mounts a provider again
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("p").textContent).toBe("en");
  });
});

describe("A-61 session expiry", () => {
  it("a background query answering session_expired calls the handler once per burst", async () => {
    const seen: FrappeError[] = [];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const expired = () => Promise.reject(new FrappeError("Session expired", 401, undefined, { kind: "session_expired" }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport: async () => ({}) })} onSessionExpired={(e) => seen.push(e)}>{children}</FrappeProvider></QueryClientProvider>
    );
    renderHook(() => { useQuery({ queryKey: ["a"], queryFn: expired }); useQuery({ queryKey: ["b"], queryFn: expired }); }, { wrapper });
    await waitFor(() => expect(seen.length).toBe(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(seen.length).toBe(1);
    expect(seen[0]!.kind).toBe("session_expired");
  });
  it("NEGATIVE: other errors do not call it; the redirect URL keeps the path and query", async () => {
    const seen: unknown[] = [];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport: async () => ({}) })} onSessionExpired={(e) => seen.push(e)}>{children}</FrappeProvider></QueryClientProvider>
    );
    const { result } = renderHook(() => useQuery({ queryKey: ["c"], queryFn: () => Promise.reject(new FrappeError("No", 403, "PermissionError", { kind: "permission" })) }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(seen).toEqual([]);
    expect(loginRedirectUrl({ pathname: "/app/deal/D-1", search: "?tab=x" })).toBe("/login?redirect-to=%2Fapp%2Fdeal%2FD-1%3Ftab%3Dx");
  });
});

describe("C-79 a newer copy on the server while the form is dirty", () => {
  const ALL = { read: true, write: true, create: true };
  const rights = { levels: [ALL], can: (p: string) => !!(ALL as Record<string, boolean>)[p], known: true };
  const META: DocTypeMeta = { name: "Memo", autoname: "hash", fields: [{ fieldname: "note", fieldtype: "Data", label: "Note" }], permissions: [] };
  const D1: FrappeDoc = { doctype: "Memo", name: "M1", note: "a", docstatus: 0, modified: "2026-11-01 10:00:00" };
  const D2: FrappeDoc = { ...D1, note: "someone else", modified: "2026-11-01 10:05:00" };
  const view = (doc: FrappeDoc) => (
    <ThemeProvider defaultLanguage="en" storageKeys={null}><QueryClientProvider client={new QueryClient()}><FrappeProvider client={createFrappeClient({ transport: async () => ({}) })}>
      <FrappeFormView guardUnload={false} permissions={rights} bundle={{ doctype: "Memo", meta: META, children: {} }} doc={doc} onSave={async (d) => d} />
    </FrappeProvider></QueryClientProvider></ThemeProvider>
  );
  it("dirty: the edits stay, the banner offers Reload, Reload takes the server's copy", () => {
    const { rerender } = render(view(D1));
    const box = screen.getByRole("textbox", { name: "Note" });
    fireEvent.change(box, { target: { value: "mine" } }); fireEvent.blur(box);
    rerender(view(D2));
    expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("mine");
    const banner = document.querySelector("[data-newer-on-server]")!;
    expect(banner.textContent).toContain("modified after you opened it");
    fireEvent.click(within(banner as HTMLElement).getByRole("button", { name: "Reload" }));
    expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("someone else");
    expect(document.querySelector("[data-newer-on-server]")).toBeNull();
  });
  it("NEGATIVE: clean → the newer copy is shown at once, no banner", () => {
    const { rerender } = render(view(D1));
    rerender(view(D2));
    expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("someone else");
    expect(document.querySelector("[data-newer-on-server]")).toBeNull();
  });
});

describe("D-43 communications paging counts automated messages", () => {
  it("10 communications + 11 automated messages: Load more is offered, the next page starts at 20 and repeats nothing", async () => {
    const comms = Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, communication_type: "Communication" }));
    const autos = Array.from({ length: 11 }, (_, i) => ({ name: `A${i}`, communication_type: "Automated Message" }));
    const calls: Record<string, unknown>[] = [];
    const api = {
      call: vi.fn(async (_m: string, a: Record<string, unknown>) => { calls.push(a); return { message: [{ name: "A10", communication_type: "Automated Message" }, { name: "C99", communication_type: "Communication" }] }; }),
      getDocInfo: vi.fn(), subscribeMessages: () => () => {}, addComment: vi.fn(), getMetaBundle: vi.fn(),
    };
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}><FrappeProvider client={api as never}>{children}</FrappeProvider></QueryClientProvider>;
    const docinfo = { communications: comms, automated_messages: autos, comments: [], versions: [] } as never;
    const { result } = renderHook(() => useCommunications("Lead", "L1", docinfo), { wrapper });
    expect(result.current.hasMore).toBe(true);
    expect(result.current.communications.length + result.current.automatedMessages.length).toBe(20);
    await act(async () => { await result.current.loadMore(); });
    expect(calls[0]).toMatchObject({ start: 20, limit: 21 });
    const names = [...result.current.communications, ...result.current.automatedMessages].map((c) => (c as { name: string }).name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("C99");
  });
});

describe("D-64 Desk's indicator colours and pill contrast", () => {
  it("every Desk colour name resolves to a theme token (no raw / invalid CSS)", () => {
    for (const c of ["green", "cyan", "blue", "light-blue", "orange", "yellow", "red", "pink", "purple", "gray", "grey", "darkgrey"]) {
      expect(resolveStatusColor(c), c).toMatch(/^hsl\(var\(--/);
    }
    expect(resolveStatusColor("light-blue")).not.toBe(resolveStatusColor("blue"));
  });
  it("tone pills mix their text with the foreground (≥ 4.5:1 by the palette calculation in the ledger)", () => {
    wrap(<StatusBadge label="Won" tone="success" />);
    expect(screen.getByText("Won").parentElement!.className).toContain("text-[color-mix(in_oklab,hsl(var(--success))_55%,hsl(var(--foreground)))]");
  });
});

// Run 1 review fixes (advisor): nav items without href stay buttons; Select cells keep their pill.
describe("Run 1 review fixes", () => {
  it("a nav item without href is a button (an <a> without href is neither focusable nor a link)", () => {
    const nav = vi.fn();
    wrap(<Sidebar brand={{ name: "Acme" }} items={[{ id: "x", label: "No route" }, { id: "y", href: "/y", label: "Routed" }]} currentPath="/y" onNavigate={nav} collapsed={false} onCollapsedChange={() => {}} />);
    expect(screen.getByRole("button", { name: "No route" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Routed" }).getAttribute("href")).toBe("/y");
  });
});
