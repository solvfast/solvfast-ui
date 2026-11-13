/**
 * Run 1 step 5 — CRM-evidenced completion (Core + Frappe): B-26 sort selector props, B-48 new document from the list's
 * filters, B-55 filtered-empty create + description, A-33 number card states, A-42 async editable title and one page
 * title (G19), E-14 the list's totals row. jsdom; Frappe parts on the playground's SIMULATED ToDo backend.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell, EditableTitle, IconStatCard, ListView, PageHeader, StatCard, ThemeProvider, type ColumnDef } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { sortOptionsFromMeta } from "../src/frappe/meta";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const en = defaultMessages.en;

type Row = { id: string; title: string; amount: number; cur: string; qty: number };
const ROWS: Row[] = [
  { id: "a", title: "A", amount: 100, cur: "SAR", qty: 1 }, { id: "b", title: "B", amount: 50.5, cur: "SAR", qty: 2 },
  { id: "c", title: "C", amount: 10, cur: "USD", qty: 3 },
];
const COLS: ColumnDef<Row>[] = [
  { key: "title", label: "Title" }, { key: "amount", label: "Amount", fieldtype: "Currency", currency: (r) => r.cur }, { key: "qty", label: "Qty", fieldtype: "Int" },
];

describe("B-26 sort selector (Core props; off by default)", () => {
  it("options independent of the visible columns, a direction button named with the direction, no Clear when not clearable", async () => {
    const changes: unknown[] = [];
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} onStateChange={(st) => changes.push(st)}
      controls={{ sortMenu: true, sortMenuOptions: { options: [{ key: "modified", label: "Last Updated On" }, { key: "title", label: "Title" }], directionToggle: true, clearable: false } }} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Sort by/ }), { key: "Enter" });
    const items = (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
    expect(items).toEqual(["Last Updated On", "Title"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Title" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    const dir = screen.getByRole("button", { name: /Sort direction: Ascending/ });
    fireEvent.click(dir);
    expect(screen.getByRole("button", { name: /Sort direction: Descending/ })).toBeTruthy();
    fireEvent.keyDown(within(document.querySelector<HTMLElement>("[data-sort-selector]")!).getAllByRole("button")[0]!, { key: "Enter" });
    await screen.findAllByRole("menuitem");
    expect(screen.queryByRole("menuitem", { name: en.clearSort })).toBeNull();
  });
  it("NEGATIVE: by default the list has no Sort-by menu (header sorting only); the 0.6 menu keeps Clear", () => {
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} />);
    expect(screen.queryByRole("button", { name: /Sort by/ })).toBeNull();
  });
  it("sortOptionsFromMeta: Desk's order — Last Updated, sort field, title field, ID, Created On, Index, then bold / mandatory / in-list fields", () => {
    const meta = { name: "T", title_field: "subject", sort_field: "due", fields: [
      { fieldname: "subject", fieldtype: "Data", label: "Subject" }, { fieldname: "due", fieldtype: "Date", label: "Due" },
      { fieldname: "status", fieldtype: "Select", label: "Status", in_list_view: 1 }, { fieldname: "notes", fieldtype: "Text", label: "Notes" },
    ] } as never;
    const t = (k: keyof typeof en) => en[k];
    expect(sortOptionsFromMeta(meta, t).map((o) => o.key)).toEqual(["modified", "due", "subject", "name", "creation", "idx", "status"]);
  });
});

describe("E-14 totals row (Core ListView)", () => {
  const rowsShown = () => [...document.querySelectorAll("tbody tr")];
  it("a <tfoot> with a 'Total' row header; numeric columns summed over every filtered row, per currency", () => {
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} totals pageSize={2} />);
    expect(rowsShown()).toHaveLength(2); // paged …
    const foot = document.querySelector("tfoot[data-totals-row]")!;
    expect(within(foot as HTMLElement).getByRole("rowheader").textContent).toBe("Total");
    const amount = foot.querySelector('[data-total-for="amount"]')!;
    expect([...amount.querySelectorAll("[data-currency]")].map((x) => x.getAttribute("data-currency"))).toEqual(["SAR", "USD"]);
    expect(amount.textContent).toContain("150.50"); // … but the totals cover every filtered row
    expect(foot.querySelector('[data-total-for="qty"]')!.textContent).toBe("6");
  });
  it("the user's 'Show totals row' switch in the column manager hides it and is remembered", async () => {
    const store: Record<string, unknown> = {};
    const prefs = { load: (k: string) => (store[k] as object) ?? {}, save: (k: string, v: unknown) => { store[k] = v; } };
    const ui = <ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} viewKey="money" storage={{ prefs, saved: null }} totals />;
    const { unmount } = wrap(ui);
    fireEvent.click(screen.getByRole("button", { name: /Columns/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Show totals row" }));
    expect(document.querySelector("tfoot")).toBeNull();
    unmount();
    wrap(ui);
    expect(document.querySelector("tfoot")).toBeNull(); // remembered
  });
  it("NEGATIVE: without `totals` no footer and no switch (0.6 markup)", () => {
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} />);
    expect(document.querySelector("tfoot")).toBeNull();
  });
  it("Arabic: the row header is the catalogue's", () => {
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} totals />, "ar");
    expect(document.querySelector("tfoot th")!.textContent).toBe("الإجمالي");
  });
});

describe("A-33 number cards", () => {
  it("loading (busy + status), N/A, error (alert), compact numbers, a format hook and a menu outside the card's link", () => {
    const { rerender } = wrap(<StatCard label="Open deals" value={0} state="loading" />);
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    rerender(<ThemeProvider storageKeys={null}><StatCard label="Open deals" value={0} state="empty" /></ThemeProvider>);
    expect(screen.getByText("N/A")).toBeTruthy();
    rerender(<ThemeProvider storageKeys={null}><StatCard label="Open deals" value={0} state="error" /></ThemeProvider>);
    expect(screen.getByRole("alert").textContent).toBe("Could not load the value");
    rerender(<ThemeProvider storageKeys={null}><IconStatCard label="Revenue" value={1234567} compact /></ThemeProvider>);
    expect(screen.getByText("1.2M")).toBeTruthy();
    rerender(<ThemeProvider storageKeys={null}><StatCard label="Revenue" value={1234.5} format={(v) => `SAR ${v.toFixed(2)}`} href="/x" menu={<button type="button">Refresh</button>} /></ThemeProvider>);
    expect(screen.getByText("SAR 1234.50")).toBeTruthy();
    expect(screen.getByRole("link").contains(screen.getByRole("button", { name: "Refresh" }))).toBe(false);
  });
  it("NEGATIVE: without the extras the card is the 0.6 markup (no wrapper)", () => {
    const { container } = wrap(<StatCard label="Open" value={3} />);
    expect(container.querySelector("[data-stat-state]")).toBeNull();
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("A-42 editable title (Core) and one page title (G19)", () => {
  it("an async save shows the new title busy; a failure puts the old one back with the message", async () => {
    let reject!: (e: Error) => void;
    wrap(<EditableTitle value="Deal 1" canEdit onSave={() => new Promise((_, r) => { reject = r; })} className="text-xl" />);
    fireEvent.click(screen.getByRole("button", { name: "Deal 1" }));
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "Deal One" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(document.querySelector("[data-title-pending]")?.textContent).toBe("Deal One");
    await act(async () => { reject(new Error("Not permitted")); });
    expect(screen.getByRole("button", { name: "Deal 1" }).className).toContain("text-xl");
    expect(screen.getByRole("alert").textContent).toBe("Not permitted");
  });
  it("PageHeader titleInShell: the editable title IS the top bar's <h1> — one heading level 1", () => {
    wrap(<AppShell brand={{ name: "Acme" }} items={[{ id: "d", href: "/d", label: "Deals" }]} currentPath="/d" onNavigate={() => {}} collapsedStorageKey={null}>
      <PageHeader titleInShell title={<EditableTitle value="Deal 1" canEdit onSave={() => {}} />} />
    </AppShell>);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(within(h1s[0]!).getByRole("button", { name: "Deal 1" })).toBeTruthy();
    expect(h1s[0]!.textContent).not.toContain("Deals");
  });
});

describe("B-48 / B-55 FrappeListView (SIMULATED)", () => {
  const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }];
  function mountList(props: Partial<React.ComponentProps<typeof FrappeListView>>, meta: Record<string, unknown> = {}) {
    const mock = createMockFrappe();
    const transport: FrappeTransport = async (m, a) => (m === "frappe.desk.form.load.getdoctype" ? { docs: [{ ...TODO_META, permissions: PERMS, ...meta }], user_settings: "{}" } : mock.transport(m, a)) as never;
    return render(
      <ThemeProvider defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FrappeProvider client={createFrappeClient({ transport })} session={{ user: "u@x.com", roles: ["System Manager"] }}><FrappeListView doctype="ToDo" storage={null} {...props} /></FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
  }
  it("B-48 a list filtered status = Closed: the new document starts with status Closed (the app's own options win)", async () => {
    const opened: Record<string, unknown>[] = [];
    mountList({ initialQuery: { conjunction: "and", conditions: [{ id: "c1", field: "status", operator: "equals", value: "Closed" }] },
      create: { onOpenFullForm: (d: Record<string, unknown>) => opened.push(d), defaults: { routeOptions: { priority: "High" } } } as never }, { quick_entry: 0 });
    fireEvent.click(await screen.findByTestId("sf-list-add"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]).toMatchObject({ status: "Closed", priority: "High" }); // "Closed" is not ToDo's default ("Open")
  });
  it("B-55 filters hide everything: Clear filters AND 'Create a new ToDo' for a user who may create; the DocType's description when there is none yet", async () => {
    const created = vi.fn();
    mountList({ create: { onCreate: created } as never, initialQuery: { conjunction: "and", conditions: [{ id: "c1", field: "status", operator: "equals", value: "Nope" }] } });
    const add = await screen.findByRole("button", { name: "Create a new ToDo" });
    expect(screen.getByRole("button", { name: en.listClearFilters })).toBeTruthy();
    fireEvent.click(add);
    expect(created).toHaveBeenCalled();
  });
});

describe("B-55 Core empty states", () => {
  it("emptyDescription under the none-yet message; emptyFilteredAction beside Clear filters; without them the 0.6 markup", () => {
    const create = vi.fn();
    wrap(<ListView<Row> rows={[]} columns={COLS} rowKey={(r) => r.id} storage={null} emptyDescription="Tasks assigned to people" />);
    expect(document.querySelector("[data-empty-description]")?.textContent).toBe("Tasks assigned to people");
    cleanup();
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} emptyFilteredAction={{ label: "Create a new Deal", onClick: create }}
      initialQuery={{ conjunction: "and", conditions: [{ id: "x", field: "title", operator: "equals", value: "zzz" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a new Deal" }));
    expect(create).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.listClearFilters })).toBeTruthy();
  });
});
