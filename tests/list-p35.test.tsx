/**
 * P35 list workstream — Core `src/list` (no Frappe, no server): multi-bucket grouping, the page-size picker, the
 * group-by sidebar slot, "Select all {n} matching" in header selection mode, the phone card layout, saved-filter
 * confirmation / "Is Global". jsdom only. Test names start with the List audit row (docs/audit/p35/B-list.md) or the
 * CRM gap id (docs/audit/p35/D-crm.md).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ListView, ThemeProvider, type BulkAction, type ColumnDef, type ListViewProps } from "../src";
import { groupRows } from "../src/list/model/group";
import { createLocalStorageAdapter, type ListPrefs } from "../src/list/model/storage";
import { GroupBySidebar } from "../src/list/parts/GroupBySidebar";
import { defaultMessages } from "../src/theme/messages";

// these tests drive whole lists through several server round trips: give them room on a loaded machine
vi.setConfig({ testTimeout: 20_000 });
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const t = (k: string) => (defaultMessages.en as Record<string, string>)[k] ?? k;
type Row = { id: string; title: string; status: string; tags: string[] };
const ROWS: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: `r${i + 1}`, title: `Task ${i + 1}`, status: i % 3 ? "Open" : "Done", tags: i === 0 ? ["a", "b"] : i === 1 ? ["a"] : [] }));
const COLUMNS: ColumnDef<Row>[] = [
  { key: "title", label: { en: "Title", ar: "العنوان" }, type: "text" },
  { key: "status", label: { en: "Status", ar: "الحالة" }, type: "select", options: [{ value: "Open", label: "Open" }, { value: "Done", label: "Done" }] },
];
function renderList(p: Partial<ListViewProps<Row>> = {}) {
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <ListView<Row> rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} storage={null} {...p} />
    </ThemeProvider>,
  );
}
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("data-group-header") && tr.querySelectorAll("td").length > 1);
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

describe("LV.D2 multi-bucket grouping (Core)", () => {
  it("LV.D2 groupRows: an array puts the row in every bucket (once each), an empty array in __none__ (last)", () => {
    const g = groupRows(ROWS.slice(0, 3), (r) => r.tags.map((x) => ({ key: x, label: x.toUpperCase() })));
    expect(g.map((x) => [x.key, x.label, x.rows.map((r) => r.id)])).toEqual([["a", "A", ["r1", "r2"]], ["b", "B", ["r1"]], ["__none__", "—", ["r3"]]]);
    expect(groupRows([ROWS[0]], () => [{ key: "x", label: "X" }, { key: "x", label: "X" }])[0].rows).toHaveLength(1);
  });

  it("LV.D2 ListView shows a row in each of its groups without duplicate-key warnings; selection is per row", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    renderList({ rows: ROWS.slice(0, 3), selectable: true, groupByOptions: [{ key: "tags", label: "Tags", groupOf: (r) => r.tags.map((x) => ({ key: x, label: x })) }] });
    openMenu(screen.getByRole("button", { name: t("groupBy") }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Tags" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    const task1 = bodyRows().filter((r) => r.textContent!.includes("Task 1"));
    expect(task1).toHaveLength(2);
    fireEvent.click(within(task1[0]).getByRole("checkbox"));
    expect(bodyRows().filter((r) => r.textContent!.includes("Task 1")).map((r) => r.getAttribute("aria-selected"))).toEqual(["true", "true"]);
    expect(err.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
  });
});

describe("LV.I4 page-size picker (Desk 20 / 100 / 500 / 2500)", () => {
  it("LV.I4 choosing a page length shows that many rows, goes back to page 1 and is remembered with the prefs", () => {
    const storage = createLocalStorageAdapter();
    const { unmount } = renderList({ pageSizes: [20, 100], viewKey: "tasks", storage: { prefs: storage.prefs, saved: null } });
    expect(bodyRows()).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: t("nextPage") }));
    expect(screen.getByText("2")).toBeTruthy();
    const group = screen.getByRole("group", { name: t("listPageSize") });
    expect(within(group).getByRole("button", { name: "20" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: "100" }));
    expect(bodyRows()).toHaveLength(45);
    expect(document.querySelector("[aria-current='page']")!.textContent).toBe("1");
    expect((storage.prefs.load("tasks") as ListPrefs).pageSize).toBe(100);
    unmount();
    renderList({ pageSizes: [20, 100], viewKey: "tasks", storage: { prefs: storage.prefs, saved: null } });
    expect(bodyRows()).toHaveLength(45);
  });

  it("LV.I4 negative control: without pageSizes there is no picker (0.6.0 markup); the page buttons stay the pager's last child", () => {
    renderList();
    expect(screen.queryByRole("group", { name: t("listPageSize") })).toBeNull();
    cleanup();
    renderList({ pageSizes: [20, 100] });
    const pager = document.querySelector(".sf-datagrid")!.lastElementChild!;
    expect(within(pager.lastElementChild as HTMLElement).getByRole("button", { name: t("nextPage") })).toBeTruthy();
  });
});

describe("LV.D6 GroupBySidebar (Core, presentational) and the ListView aside", () => {
  const sections = [
    { field: "assigned_to", label: "Assigned To", items: [{ value: "ann", label: "Ann", count: 3 }, { value: "bob", label: "Bob", count: 1 }] },
    { field: "status", label: "Status", items: Array.from({ length: 10 }, (_, i) => ({ value: `s${i}`, label: `State ${i}`, count: 10 - i })) },
    { field: "owner", label: "Created By", items: [], loading: true },
  ];
  it("LV.D6 lists values with counts; the applied one is pressed and clicking it again removes it; a long section gets a search box", () => {
    const onSelect = vi.fn();
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><GroupBySidebar sections={sections} active={{ assigned_to: "bob" }} onSelect={onSelect} /></ThemeProvider>);
    const nav = screen.getByRole("navigation", { name: t("listSidebar") });
    const ann = within(nav).getByRole("button", { name: /Ann/ });
    expect(ann.textContent).toBe("Ann3");
    fireEvent.click(ann);
    expect(onSelect).toHaveBeenLastCalledWith("assigned_to", "ann");
    const bob = within(nav).getByRole("button", { name: /Bob/ });
    expect(bob.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(bob);
    expect(onSelect).toHaveBeenLastCalledWith("assigned_to", null);
    fireEvent.change(within(nav).getByRole("textbox", { name: /Status/ }), { target: { value: "State 9" } });
    expect(within(nav).getAllByRole("button", { name: /State/ })).toHaveLength(1);
    expect(nav.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  it("LV.D6 ListView aside renders next to the list (pager still last in .sf-datagrid); asideOpen={false} hides it", () => {
    renderList({ aside: <div data-testid="side">side</div> });
    expect(screen.getByTestId("side")).toBeTruthy();
    expect(document.querySelector(".sf-datagrid")!.lastElementChild!.textContent).toContain(t("total"));
    cleanup();
    renderList({ aside: <div data-testid="side">side</div>, asideOpen: false });
    expect(screen.queryByTestId("side")).toBeNull();
  });
});

describe("G5 'Select all {n} matching' in header selection mode (D-crm G5)", () => {
  const actions = (runQuery = vi.fn(), runKeys = vi.fn()): BulkAction<Row>[] => [
    { key: "byquery", label: "Export all", allMatching: true, run: runQuery },
    { key: "bykeys", label: "Archive", run: runKeys },
  ];
  it("G5 offered once the page is fully checked; then only allMatching actions run (with ctx.allMatching), the others are disabled", async () => {
    const runQuery = vi.fn(); const runKeys = vi.fn();
    renderList({ selectable: true, selectionMode: "header", selectAllMatching: true, bulkActions: actions(runQuery, runKeys) });
    expect(document.querySelector("[data-select-all-matching]")).toBeNull();
    fireEvent.click(within(document.querySelector("thead")!).getByRole("checkbox", { name: t("selectAll") }));
    fireEvent.click(screen.getByRole("button", { name: t("listSelectAllMatching").replace("{n}", "45") }));
    expect(document.querySelector("thead")!.textContent).toContain(t("listAllMatchingSelected").replace("{n}", "45"));
    openMenu(screen.getByTestId("sf-list-actions"));
    const archive = await screen.findByRole("menuitem", { name: /Archive/ });
    expect(archive.getAttribute("data-disabled")).not.toBeNull();
    expect(archive.textContent).toContain(t("listAllMatchingUnsupported"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export all" }));
    await waitFor(() => expect(runQuery).toHaveBeenCalled());
    const [keys, , ctx] = runQuery.mock.calls[0];
    expect(keys).toHaveLength(20);
    expect(ctx.allMatching).toEqual({ total: 45 });
    expect(runKeys).not.toHaveBeenCalled();
  });

  it("G5 unchecking a row or changing the query ends 'all matching'; negative control: off by default", () => {
    renderList({ selectable: true, selectionMode: "header", selectAllMatching: true, bulkActions: actions() });
    fireEvent.click(within(document.querySelector("thead")!).getByRole("checkbox", { name: t("selectAll") }));
    fireEvent.click(screen.getByRole("button", { name: t("listSelectAllMatching").replace("{n}", "45") }));
    fireEvent.click(within(bodyRows()[0]).getByRole("checkbox"));
    expect(document.querySelector("thead")!.textContent).toContain(t("listItemsSelected").replace("{n}", "19"));
    fireEvent.click(within(bodyRows()[0]).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: t("listSelectAllMatching").replace("{n}", "45") }));
    fireEvent.change(screen.getByPlaceholderText(t("listSearch")), { target: { value: "Task 1" } });
    expect(document.querySelector("thead")!.textContent).not.toContain(t("listAllMatchingSelected").replace("{n}", "45"));
    cleanup();
    renderList({ selectable: true, selectionMode: "header", bulkActions: actions() });
    fireEvent.click(within(document.querySelector("thead")!).getByRole("checkbox", { name: t("selectAll") }));
    expect(document.querySelector("[data-select-all-matching]")).toBeNull();
  });
});

describe("G1 phone card layout (D-crm G1)", () => {
  it("G1 layout='cards': one card per row, the primary column as title, the others as label / value; mobile:false hides; row click and selection work", () => {
    const onRowClick = vi.fn();
    const cols: ColumnDef<Row>[] = [...COLUMNS, { key: "id", label: "ID", mobile: false }];
    renderList({ columns: cols, layout: "cards", selectable: true, selectionMode: "header", onRowClick, rows: ROWS.slice(0, 3) });
    expect(document.querySelector("table")).toBeNull();
    const cards = [...document.querySelectorAll<HTMLElement>("[data-card]")];
    expect(cards).toHaveLength(3);
    expect(cards[0].querySelector(".font-medium")!.textContent).toBe("Task 1");
    expect([...cards[0].querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Status"]);
    fireEvent.click(cards[1]);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    fireEvent.click(within(cards[0]).getByRole("checkbox"));
    expect(cards[0].getAttribute("data-selected")).toBe("true");
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-selection-header]")!.textContent).toContain(t("listItemsSelected").replace("{n}", "1"));
  });

  it("G1 negative control: the default layout is the table; 'auto' stays a table where no phone media query matches", () => {
    renderList({ rows: ROWS.slice(0, 3) });
    expect(document.querySelector("table")).toBeTruthy();
    cleanup();
    renderList({ rows: ROWS.slice(0, 3), layout: "auto" });
    expect(document.querySelector("table")).toBeTruthy();
    expect(document.querySelector("[data-card]")).toBeNull();
  });
});

describe("LV.C9 / LV.C11 / LV.C12 saved filters: Is Global, delete confirmation, duplicate names", () => {
  const withFilter = (p: Partial<ListViewProps<Row>> = {}) => {
    const store = createLocalStorageAdapter({ prefix: "p35:" });
    renderList({ viewKey: "tasks", storage: { saved: store.saved, prefs: null }, initialQuery: { conjunction: "and", conditions: [{ id: "c", field: "status", operator: "equals", value: "Done" }] }, ...p });
    fireEvent.click(screen.getByRole("button", { name: t("saved") }));
    return store;
  };
  const pop = () => screen.getByRole("dialog");
  const typeName = (v: string) => fireEvent.change(within(pop()).getByPlaceholderText(t("saveCurrentAs")), { target: { value: v } });

  it("LV.C11 removing asks first (list_filter.js:104-117): Cancel keeps the filter, Remove deletes it", async () => {
    const store = withFilter();
    typeName("Done ones");
    fireEvent.click(within(pop()).getByRole("button", { name: t("saveCurrentAs") }));
    await waitFor(() => expect(within(pop()).getByRole("button", { name: "Done ones" })).toBeTruthy());
    fireEvent.click(within(pop()).getByRole("button", { name: `${t("remove")} Done ones` }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm.textContent).toContain(t("listSavedDeleteConfirm").replace("{name}", "Done ones"));
    fireEvent.click(within(confirm).getByRole("button", { name: t("cancel") }));
    expect(store.saved.list("tasks")).toHaveLength(1);
    fireEvent.click(within(pop()).getByRole("button", { name: `${t("remove")} Done ones` }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: t("remove") }));
    await waitFor(() => expect(store.saved.list("tasks")).toHaveLength(0));
  });

  it("LV.C12 a duplicate name says 'Duplicate Filter Name' and cannot be saved; the local adapter rejects it too", async () => {
    const store = withFilter();
    typeName("Mine");
    fireEvent.click(within(pop()).getByRole("button", { name: t("saveCurrentAs") }));
    await waitFor(() => expect(within(pop()).getByRole("button", { name: "Mine" })).toBeTruthy());
    typeName("Mine");
    expect(within(pop()).getByText(t("listSavedDuplicate"))).toBeTruthy();
    expect((within(pop()).getByRole("button", { name: t("saveCurrentAs") }) as HTMLButtonElement).disabled).toBe(true);
    expect(() => store.saved.save("tasks", "Mine", { conjunction: "and", conditions: [] })).toThrow(/already exists/);
  });

  it("LV.C9 'Is Global' only with savedFiltersGlobal; a global save is stored and marked as such", async () => {
    const store = withFilter({ savedFiltersGlobal: true });
    expect(within(pop()).queryByRole("checkbox", { name: t("listSavedIsGlobal") })).toBeNull(); // Desk shows it once a name is typed
    typeName("Team");
    fireEvent.click(within(pop()).getByRole("checkbox", { name: t("listSavedIsGlobal") }));
    fireEvent.click(within(pop()).getByRole("button", { name: t("saveCurrentAs") }));
    await waitFor(() => expect(within(pop()).getByRole("button", { name: "Team" })).toBeTruthy());
    expect((store.saved.list("tasks") as { global?: boolean }[])[0].global).toBe(true);
    expect(pop().querySelector("[data-global]")!.textContent).toBe(t("listSavedGlobal"));
    cleanup();
    withFilter();
    typeName("Mine");
    expect(within(pop()).queryByRole("checkbox", { name: t("listSavedIsGlobal") })).toBeNull();
  });
});
