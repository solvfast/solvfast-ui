/**
 * List View (increment 5.3) — one or more tests per non-X row of the feature matrix (docs/FEATURES.md, F#), the behaviour
 * rules C1 / C3 / C4 and the fixed bugs, each fix with a negative control that shows the old behaviour fails the check.
 * Server-only rows (F4, F6, F11, F31–F33, C2) belong to the Frappe entry and are tested in 5.4.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { Archive, Trash2 } from "lucide-react";
import {
  ColumnManager, DefaultCell, FilterBuilder, FilterValueInput, ListView, ThemeProvider, applyFilterQuery, compareValues,
  createLocalStorageAdapter, filterFieldsFromColumns, getQuickValue, groupRows, mergeColumns, newCondition, OPERATORS_BY_TYPE,
  setQuickValue, sortRows, useListState,
  type ColumnDef, type FilterField, type FilterQuery, type ListViewProps, type SavedFilter, type SavedFiltersStorage,
} from "../src";
import { defaultMessages } from "../src/theme/messages";
// The two upstream engines (pinned copies, upstream/SHA256SUMS) serve as oracles for the consolidated one.
import * as searEngine from "../upstream/sear-7abc895-dirty/data-grid/filter-engine";
import * as pmoEngine from "../upstream/pmo/filter-engine";

beforeAll(() => {
  // jsdom lacks what Radix / cmdk poppers call
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { localStorage.clear(); document.documentElement.className = ""; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

// ---- fixtures ------------------------------------------------------------------------------------------------------------
type Row = { id: string; title: string; titleAr: string; status: string; points: number | null; due: string; done: boolean; owner: string };
const STATUSES = ["Open", "Working", "Done"];
const ROWS: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: `r${i + 1}`, title: `Task ${i + 1}`, titleAr: `مهمة ${i + 1}`, status: STATUSES[i % 3],
  points: i % 5 === 0 ? null : i, due: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, done: i % 2 === 0, owner: i % 4 === 0 ? "" : `user${i % 3}`,
}));
const COLUMNS: ColumnDef<Row>[] = [
  { key: "title", label: { en: "Title", ar: "العنوان" }, type: "text" },
  { key: "status", label: { en: "Status", ar: "الحالة" }, type: "select", fieldtype: "Select", options: STATUSES.map((s) => ({ value: s, label: s })) },
  { key: "points", label: { en: "Points", ar: "النقاط" }, type: "number", fieldtype: "Int" },
  { key: "due", label: { en: "Due", ar: "الاستحقاق" }, type: "date", fieldtype: "Date" },
  { key: "done", label: { en: "Done", ar: "منجز" }, type: "boolean", fieldtype: "Check" },
  { key: "owner", label: { en: "Owner", ar: "المسؤول" }, type: "text", hidden: true },
];
const FIELDS: FilterField[] = filterFieldsFromColumns(COLUMNS, (l) => (typeof l === "string" ? l : l.en));
const BY_STATUS = { key: "status", label: "Status", groupOf: (r: Row) => (r.status ? { key: r.status, label: r.status } : { key: "__none__", label: "None" }) };

const Wrap = ({ lang = "en", children }: { lang?: "en" | "ar"; children: React.ReactNode }) => (
  <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{children}</ThemeProvider>
);
function renderList(props: Partial<ListViewProps<Row>> = {}, lang: "en" | "ar" = "en") {
  const all = { rows: ROWS, columns: COLUMNS, rowKey: (r: Row) => r.id, storage: null, ...props } as ListViewProps<Row>;
  const utils = render(<Wrap lang={lang}><ListView<Row> {...all} /></Wrap>);
  return { ...utils, rerenderList: (p: Partial<ListViewProps<Row>>) => utils.rerender(<Wrap lang={lang}><ListView<Row> {...all} {...p} /></Wrap>) };
}
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const titles = () => bodyRows().map((tr) => tr.querySelector("td:not(:has([role=checkbox]))")?.textContent);
const th = (name: string) => [...document.querySelectorAll("thead th")].find((h) => h.textContent?.trim() === name) as HTMLElement;
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const openMenu = (name: string | RegExp) => fireEvent.keyDown(btn(name), { key: "Enter" }); // Radix menus open from the keyboard in jsdom
/** Pick a menu item and close the menu — while open, a Radix menu hides the rest of the page from role queries. */
const pickMenu = (trigger: string | RegExp, item: string) => {
  openMenu(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
};
const popover = () => screen.getByRole("dialog");
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

// ---- F1 · F2 · F3 columns and cells ---------------------------------------------------------------------------------------
describe("columns and cells", () => {
  it("F1 a column's render is used; otherwise the type-aware default cell", () => {
    renderList({ rows: [ROWS[1]], columns: [{ ...COLUMNS[0], render: (r) => <b data-testid="custom">{r.title}!</b> }, COLUMNS[2]] });
    expect(screen.getByTestId("custom").textContent).toBe("Task 2!");
    const points = bodyRows()[0].querySelectorAll("td")[1].querySelector("span")!;
    expect(points.textContent).toBe("1");
    expect(points.className).toContain("tabular-nums");
  });

  it("F2 default cell per type, in English and Arabic; numbers and dates stay left-to-right", () => {
    const cell = (value: unknown, col: Partial<ColumnDef<Row>>, lang: "en" | "ar" = "en") => {
      const { container, unmount } = render(<Wrap lang={lang}><DefaultCell value={value} col={{ key: "x", label: "X", ...col }} /></Wrap>);
      const el = container.firstElementChild as HTMLElement; const out = { text: el.textContent, dir: el.getAttribute("dir"), cls: el.getAttribute("class") ?? "", label: el.getAttribute("aria-label") };
      unmount(); return out;
    };
    expect(cell("2026-10-05", { fieldtype: "Date" })).toMatchObject({ text: "5 Oct 2026", dir: "ltr" });
    const arDate = cell("2026-10-05", { fieldtype: "Date" }, "ar");
    expect(arDate.dir).toBe("ltr"); expect(arDate.text).toMatch(/[٠-٩]/); expect(arDate.text).toMatch(/أكتوبر/);
    expect(cell(1234.5, { fieldtype: "Currency" })).toMatchObject({ text: "1,234.50", dir: "ltr" });
    expect(cell(1234.5, { fieldtype: "Currency" }, "ar").text).toMatch(/^[٠-٩٬٫]+$/);
    expect(cell(1234, { type: "number" }).text).toBe("1,234"); // `type` drives the cell when there is no fieldtype
    expect(cell(12, { fieldtype: "Percent" }).text).toBe("12%");
    expect(cell(1, { fieldtype: "Check" }).label).toBe("Yes");
    expect(cell(0, { fieldtype: "Check" }, "ar").label).toBe("لا");
    expect(cell("Open", { fieldtype: "Select" }).cls).toMatch(/font-normal/); // badge
    expect(cell("ACME", { fieldtype: "Link" }).cls).toContain("font-medium");
    expect(cell("", { fieldtype: "Data" }).text).toBe("—");
    expect(cell(null, { type: "number" }).text).toBe("—");
  });

  it("F3 curated columns win; generated ones they already cover are dropped (key, field or metaFields)", () => {
    type R = Record<string, unknown>;
    const curated: ColumnDef<R>[] = [{ key: "customer_name", field: "customer", label: "Customer", metaFields: ["customer_label"] }, { key: "status", label: "Status" }];
    const generated: ColumnDef<R>[] = ["customer", "customer_label", "status", "priority"].map((k) => ({ key: k, label: k }));
    expect(mergeColumns(curated, generated).map((c) => c.key)).toEqual(["customer_name", "status", "priority"]);
  });
});

// ---- F5 · F7 sorting -------------------------------------------------------------------------------------------------------
describe("sorting", () => {
  it("F5 numbers numerically, dates chronologically, strings naturally", () => {
    expect(["10", "9", "100"].sort(compareValues)).toEqual(["9", "10", "100"]);
    expect(["2026-01-05", "2025-12-31", "2026-01-01"].sort(compareValues)).toEqual(["2025-12-31", "2026-01-01", "2026-01-05"]);
    expect(["Task 10", "Task 2", "Task 1"].sort(compareValues)).toEqual(["Task 1", "Task 2", "Task 10"]);
    expect(["2026-10-15 09:30:00", "2026-10-15 08:00:00", "2026-10-14T23:00"].sort(compareValues)).toEqual(["2026-10-14T23:00", "2026-10-15 08:00:00", "2026-10-15 09:30:00"]);
    expect([new Date(2026, 1, 1), new Date(2025, 0, 1)].sort(compareValues)[0].getFullYear()).toBe(2025);
  });

  it("F5 text with a number is not read as a date (fix) — negative control: Sear's `Date.parse`", () => {
    expect(["Room 101", "Room 5", "Room 13", "Room 2"].sort(compareValues)).toEqual(["Room 2", "Room 5", "Room 13", "Room 101"]);
    expect(Date.parse("Room 101")).toBeLessThan(Date.parse("Room 5")); // what Sear compared: year 101 vs May 2001
    expect(Number.isNaN(Date.parse("Room 13"))).toBe(true); // …and "Room 13" isn't a date at all, so the order was inconsistent
  });

  it("F5 empty values stay last in both directions (fix) — negative control: Sear's `compareValues * dir`", () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }, { v: "" }, { v: 3 }];
    const col: ColumnDef<{ v: unknown }>[] = [{ key: "v", label: "V" }];
    expect(sortRows(rows, { key: "v", dir: "asc" }, col).map((r) => r.v)).toEqual([1, 2, 3, null, ""]);
    expect(sortRows(rows, { key: "v", dir: "desc" }, col).map((r) => r.v).slice(0, 3)).toEqual([3, 2, 1]);
    const searDesc = [...rows].sort((a, b) => compareValues(a.v, b.v) * -1); // sear_product hooks/useDataGrid.ts:107
    expect(searDesc[0].v === null || searDesc[0].v === "").toBe(true); // what the fix removes
  });

  it("F5 a column's sortValue overrides the comparison; non-sortable columns don't sort", () => {
    const cols: ColumnDef<Row>[] = [{ key: "title", label: "T", sortValue: (r) => -Number(r.id.slice(1)) }, { key: "status", label: "S", sortable: false }];
    expect(ids(sortRows(ROWS.slice(0, 3), { key: "title", dir: "asc" }, cols))).toEqual(["r3", "r2", "r1"]);
    expect(ids(sortRows(ROWS.slice(0, 3), { key: "status", dir: "asc" }, cols))).toEqual(["r1", "r2", "r3"]);
  });

  it("F7 header click toggles asc/desc with aria-sort; columns with sortable:false have no sort button", () => {
    renderList({ columns: [COLUMNS[0], { ...COLUMNS[1], sortable: false }, COLUMNS[2]] });
    const pts = within(th("Points")).getByRole("button");
    fireEvent.click(pts);
    expect(th("Points").getAttribute("aria-sort")).toBe("ascending");
    expect(titles().slice(0, 2)).toEqual(["Task 2", "Task 3"]); // points 1, 2
    fireEvent.click(pts);
    expect(th("Points").getAttribute("aria-sort")).toBe("descending");
    expect(titles()[0]).toBe("Task 25"); // 24
    expect(within(th("Status")).queryByRole("button")).toBeNull();
    expect(th("Status").querySelector("span")!.className).toContain("normal-case"); // same case as the button labels
  });

  it("F7 sort menu (opt-in) sorts and clears", () => {
    renderList({ controls: { sortMenu: true } });
    openMenu("Sort by");
    fireEvent.click(screen.getByRole("menuitem", { name: "Points" }));
    expect(th("Points").getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear sort" }));
    expect(document.querySelector("th[aria-sort]")).toBeNull();
    expect(titles()[0]).toBe("Task 1");
  });
});

// ---- F8 preferences --------------------------------------------------------------------------------------------------------
describe("F8 view preferences", () => {
  const hook = (viewKey: string) => renderHook(() => useListState<Row>({ rows: ROWS, columns: COLUMNS, rowKey: (r) => r.id, viewKey, groupByOptions: [BY_STATUS] }), { wrapper: Wrap });

  it("columns, sort, group-by and quick filters survive a remount (localStorage, sf:list:<viewKey>)", () => {
    const a = hook("tasks");
    act(() => { a.result.current.setVisibleKeys(["points", "title"]); a.result.current.toggleSort("points"); a.result.current.setGroupBy("status"); a.result.current.setQuickFields(["status"]); });
    a.unmount();
    expect(localStorage.getItem("sf:list:tasks:prefs")).toBeTruthy();
    const b = hook("tasks").result.current;
    expect(b.visibleKeys).toEqual(["points", "title"]);
    expect(b.sort).toEqual({ key: "points", dir: "asc" });
    expect(b.groupBy).toBe("status");
    expect(b.quickFields).toEqual(["status"]);
    const other = hook("bugs").result.current; // negative control: another view starts from its defaults
    expect(other.visibleKeys).toEqual(["title", "status", "points", "due", "done"]);
    expect(other.groupBy).toBe("none");
  });

  it("storage: null keeps everything in memory", () => {
    const { result } = renderHook(() => useListState<Row>({ rows: ROWS, columns: COLUMNS, rowKey: (r) => r.id, viewKey: "t", storage: null }), { wrapper: Wrap });
    act(() => result.current.toggleSort("title"));
    expect(localStorage.length).toBe(0);
  });
});

// ---- F9 · F10 filter model ---------------------------------------------------------------------------------------------------
describe("filter model", () => {
  it("F9 the operator table is the one Sear and PMO share", () => {
    expect(OPERATORS_BY_TYPE).toEqual(searEngine.OPERATORS_BY_TYPE);
    expect(OPERATORS_BY_TYPE).toEqual(pmoEngine.OPERATORS_BY_TYPE);
  });

  it("F10 every operator of every type gives Sear's and PMO's result (AND and OR)", () => {
    const VALUES: Record<string, string[]> = {
      title: ["task 1", "Task 12", "zzz", "Task 3,Task 4"], status: ["Open", "Open,Done", "Nope"], points: ["5", "0", "21"],
      due: ["2026-10-10", "2026-10-01"], done: ["true", "false"], owner: ["user1", "user1,user2", "ser"],
    };
    let checked = 0;
    for (const f of FIELDS) {
      for (const op of OPERATORS_BY_TYPE[f.type]) {
        for (const value of VALUES[f.name] ?? [""]) {
          for (const conjunction of ["and", "or"] as const) {
            const q: FilterQuery = { conjunction, conditions: [{ id: "a", field: f.name, operator: op, value }, { id: "b", field: "status", operator: "equals", value: "Done" }] };
            const ours = ids(applyFilterQuery(ROWS, q, FIELDS));
            expect(ours, `${f.name} ${op} ${value} ${conjunction}`).toEqual(ids(searEngine.applyFilterQuery(ROWS, q, FIELDS)));
            expect(ours).toEqual(ids(pmoEngine.applyFilterQuery(ROWS, q, FIELDS as pmoEngine.FilterField[])));
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it("F10 spot checks (the oracles could share a bug)", () => {
    const one = (field: string, operator: FilterQuery["conditions"][number]["operator"], value = "") =>
      ids(applyFilterQuery(ROWS, { conjunction: "and", conditions: [{ id: "x", field, operator, value }] }, FIELDS));
    expect(one("points", "gt", "21")).toEqual(["r23", "r24", "r25"]);
    expect(one("points", "is_not_set")).toEqual(["r1", "r6", "r11", "r16", "r21"]);
    expect(one("due", "lt", "2026-10-03")).toEqual(["r1", "r2"]);
    expect(one("done", "equals", "false")).toHaveLength(12);
    expect(one("title", "like", "TASK 2")).toEqual(["r2", "r20", "r21", "r22", "r23", "r24", "r25"]);
    expect(one("status", "not_in", "Open, Done")).toHaveLength(8);
    expect(one("title", "like", "")).toHaveLength(25); // half-built condition is ignored
  });
});

// ---- F12 search --------------------------------------------------------------------------------------------------------------
describe("F12 search", () => {
  it("searches several fields, Arabic included; default is the first text column", () => {
    renderList({ searchFields: ["title", "titleAr"] }, "ar");
    type(screen.getByPlaceholderText("بحث…"), "مهمة 7");
    expect(titles()).toEqual(["Task 7"]);
    cleanup();
    renderList();
    type(screen.getByPlaceholderText("Search…"), "مهمة 7"); // titleAr isn't searched by default
    expect(bodyRows()).toHaveLength(0);
  });

  it("server mode: one request per typing pause — search and text filters (fix) — negative control: no debounce", () => {
    vi.useFakeTimers();
    const typeSlowly = (el: HTMLElement) => { for (const v of ["T", "Ta", "Tas", "Task"]) { type(el, v); act(() => { vi.advanceTimersByTime(50); }); } act(() => { vi.advanceTimersByTime(300); }); };
    const run = (searchDebounceMs?: number) => {
      const onStateChange = vi.fn();
      renderList({ mode: "server", total: 25, onStateChange, searchDebounceMs, quickFilterFields: ["owner"] });
      onStateChange.mockClear();
      typeSlowly(screen.getByPlaceholderText("Search…"));
      const afterSearch = onStateChange.mock.calls.length;
      typeSlowly(screen.getByLabelText("Owner")); // quick text filter → query
      const last = onStateChange.mock.calls.at(-1)?.[0];
      cleanup();
      return { afterSearch, afterQuick: onStateChange.mock.calls.length - afterSearch, last };
    };
    const debounced = run();
    expect(debounced.afterSearch).toBe(1);
    expect(debounced.afterQuick).toBe(1);
    expect(debounced.last.search).toBe("Task");
    expect(debounced.last.query.conditions[0]).toMatchObject({ id: "q:owner", operator: "like", value: "Task" });
    const raw = run(0);
    expect(raw.afterSearch).toBe(4);
    expect(raw.afterQuick).toBe(4);
  });
});

// ---- F13 pagination ----------------------------------------------------------------------------------------------------------
describe("F13 pagination", () => {
  it("pages of 20 with the total; chevrons mirror in Arabic", () => {
    renderList();
    expect(screen.getByText("Total: 25")).toBeTruthy();
    expect(bodyRows()).toHaveLength(20);
    expect((btn("Previous page") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("Next page"));
    expect(bodyRows()).toHaveLength(5);
    expect(document.querySelector("[aria-current=page]")!.textContent).toBe("2");
    expect((btn("Next page") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    renderList({}, "ar");
    expect(btn("الصفحة السابقة").querySelector("svg")!.getAttribute("class")).toContain("chevron-right");
    expect(btn("الصفحة التالية").querySelector("svg")!.getAttribute("class")).toContain("chevron-left");
  });

  it("changing the query returns to page 1", () => {
    renderList();
    fireEvent.click(btn("Next page"));
    type(screen.getByPlaceholderText("Search…"), "Task");
    expect(document.querySelector("[aria-current=page]")!.textContent).toBe("1");
  });
});

// ---- F14 quick filters -------------------------------------------------------------------------------------------------------
describe("F14 quick filters", () => {
  it("each type writes a `q:<field>` condition into the same query (text → like, others → equals)", () => {
    let q: FilterQuery = { conjunction: "and", conditions: [] };
    for (const [name, value] of [["title", "task"], ["status", "Open"], ["points", "5"], ["due", "2026-10-05"], ["done", "true"]] as const) {
      q = setQuickValue(q, FIELDS.find((f) => f.name === name)!, value);
    }
    expect(q.conditions.map((c) => `${c.id} ${c.operator} ${c.value}`)).toEqual([
      "q:title like task", "q:status equals Open", "q:points equals 5", "q:due equals 2026-10-05", "q:done equals true",
    ]);
    expect(getQuickValue(q, "status")).toBe("Open");
    q = setQuickValue(q, FIELDS[1], "");
    expect(getQuickValue(q, "status")).toBe("");
    expect(q.conditions).toHaveLength(4);
  });

  it("inline controls filter the rows; the advanced filter badge counts them", () => {
    renderList({ quickFilterFields: ["title", "points"] });
    type(screen.getByLabelText("Title"), "Task 1");
    expect(bodyRows()).toHaveLength(11); // 1, 10–19
    type(screen.getByLabelText("Points"), "12");
    expect(titles()).toEqual(["Task 13"]);
    expect(btn(/Filter/).textContent).toContain("2");
  });

  it("the field picker is opt-in, and the chosen fields survive a remount", () => {
    renderList({ viewKey: "tasks", storage: undefined });
    expect(screen.queryByRole("button", { name: "Customize filters" })).toBeNull(); // C4: off by default
    cleanup();
    renderList({ viewKey: "tasks", storage: undefined, controls: { quickFiltersCustomizable: true } });
    fireEvent.click(btn("Customize filters"));
    fireEvent.click(within(popover()).getByText("Points").closest("label")!.querySelector("button")!);
    expect(screen.getByRole("spinbutton", { name: "Points" })).toBeTruthy(); // the number input appeared
    cleanup();
    renderList({ viewKey: "tasks", storage: undefined, controls: { quickFiltersCustomizable: true } });
    expect(screen.getByRole("spinbutton", { name: "Points" })).toBeTruthy();
  });
});

// ---- F15 · F16 advanced filter ------------------------------------------------------------------------------------------------
function StatefulBuilder({ initial = { conjunction: "and", conditions: [] }, loadOptions }: { initial?: FilterQuery; loadOptions?: Parameters<typeof FilterBuilder>[0]["loadOptions"] }) {
  const [q, setQ] = React.useState<FilterQuery>(initial);
  return <Wrap><FilterBuilder fields={FIELDS} query={q} onChange={setQ} activeCount={q.conditions.filter((c) => c.value).length} loadOptions={loadOptions} /><output data-testid="q">{JSON.stringify(q)}</output></Wrap>;
}
const currentQuery = () => JSON.parse(screen.getByTestId("q").textContent!) as FilterQuery;

describe("F15 advanced filter", () => {
  it("add, edit, AND/OR, remove, clear — and the count badge", () => {
    renderList();
    fireEvent.click(btn("Filter"));
    expect(within(popover()).getByText("No filters")).toBeTruthy();
    fireEvent.click(within(popover()).getByRole("button", { name: "Add filter" }));
    expect(within(popover()).getAllByRole("combobox")[0].textContent).toBe("Title"); // first field
    type(within(popover()).getByPlaceholderText("Value"), "Task 2");
    expect(bodyRows()).toHaveLength(7);
    expect(btn(/^Filter/).textContent!.trim()).toBe("Filter1");
    fireEvent.click(within(popover()).getByRole("button", { name: "Add filter" }));
    type(within(popover()).getAllByPlaceholderText("Value")[1], "Task 3");
    expect(bodyRows()).toHaveLength(0); // AND
    const conj = within(popover()).getAllByRole("combobox").find((c) => c.textContent === "Match all")!;
    fireEvent.keyDown(conj, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Match any" }));
    expect(bodyRows()).toHaveLength(8); // OR: 2, 20–25, 3
    fireEvent.click(within(popover()).getAllByRole("button", { name: "Remove" })[0]);
    expect(bodyRows()).toHaveLength(1);
    fireEvent.click(within(popover()).getByRole("button", { name: "Clear all" }));
    expect(bodyRows()).toHaveLength(20);
    expect(btn(/^Filter/).textContent!.trim()).toBe("Filter");
  });

  it("the field picker is searchable and resets the operator and value for the new type", () => {
    render(<StatefulBuilder initial={{ conjunction: "and", conditions: [{ id: "c1", field: "title", operator: "not_like", value: "x" }] }} />);
    fireEvent.click(btn("Filter 1")); // name includes the count badge
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    type(screen.getByPlaceholderText("Search…"), "poi");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Points"]);
    fireEvent.click(screen.getByRole("option", { name: "Points" }));
    expect(currentQuery().conditions[0]).toMatchObject({ field: "points", operator: "equals", value: "" });
  });

  it("condition ids never collide across remounts (fix) — negative control: PMO's per-mount counter", () => {
    const first = render(<StatefulBuilder />);
    fireEvent.click(btn("Filter"));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const saved = currentQuery();
    first.unmount();
    render(<StatefulBuilder initial={saved} />); // e.g. a saved filter applied after navigating back
    fireEvent.click(btn("Filter")); // two conditions, no values yet: no badge
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const all = currentQuery().conditions.map((c) => c.id);
    expect(new Set(all).size).toBe(3);
    // PMO AdvancedFilter.tsx:52 — `useRef(0)` per mount, ids `c${idRef.current++}`
    const pmoMount = () => { let idRef = 0; return () => `c${idRef++}`; };
    const m1 = pmoMount(); const before = [m1(), m1()]; const m2 = pmoMount();
    expect(before).toContain(m2());
    expect(new Set([newCondition().id, newCondition().id]).size).toBe(2);
  });

  it("the value input keeps its DOM node and focus while typing (fix) — negative control: a component declared in render", () => {
    render(<StatefulBuilder initial={{ conjunction: "and", conditions: [{ id: "c1", field: "title", operator: "like", value: "" }] }} />);
    fireEvent.click(btn("Filter"));
    const input = screen.getByPlaceholderText("Value");
    input.focus();
    type(input, "a"); type(input, "ab");
    expect(screen.getByPlaceholderText("Value")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(currentQuery().conditions[0].value).toBe("ab");
    // PMO AdvancedFilter.tsx:110 declared `ValueInput` inside the component: a new type each render → remount
    function PmoStyle() {
      const [v, setV] = React.useState("");
      const ValueInput = () => <input aria-label="pmo" value={v} onChange={(e) => setV(e.target.value)} />;
      return <ValueInput />;
    }
    render(<PmoStyle />);
    const pmo = screen.getByLabelText("pmo");
    type(pmo, "a");
    expect(screen.getByLabelText("pmo")).not.toBe(pmo);
  });
});

describe("F16 value inputs", () => {
  const field = (name: string) => FIELDS.find((f) => f.name === name)!;

  it("date: the glass date picker round-trips YYYY-MM-DD", () => {
    const onChange = vi.fn();
    render(<Wrap><FilterValueInput field={field("due")} operator="equals" value="2026-10-05" onChange={onChange} /></Wrap>);
    const trigger = screen.getByRole("button", { name: /5 Oct 2026|Oct 5, 2026|October 5/ });
    fireEvent.click(trigger);
    const day = screen.getAllByRole("gridcell").find((c) => c.textContent === "12")!;
    fireEvent.click(day.querySelector("button")!);
    expect(onChange).toHaveBeenCalledWith("2026-10-12");
  });

  it("link: options come from loadOptions, one request per typing pause (300 ms)", async () => {
    vi.useFakeTimers();
    const loadOptions = vi.fn(async (_f: FilterField, text: string) => [{ value: "u1", label: `Alice ${text}` }, { value: "u2", label: "Bob" }]);
    const onChange = vi.fn();
    const link: FilterField = { name: "owner", label: "Owner", type: "link", link_doctype: "User" };
    render(<Wrap><FilterValueInput field={link} operator="equals" value="" onChange={onChange} loadOptions={loadOptions} /></Wrap>);
    fireEvent.click(screen.getByRole("combobox"));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(loadOptions).toHaveBeenCalledTimes(1);
    expect(loadOptions).toHaveBeenLastCalledWith(link, "");
    const input = screen.getByPlaceholderText("Search…");
    for (const v of ["a", "al", "ali"]) { type(input, v); await act(async () => { vi.advanceTimersByTime(100); }); }
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(loadOptions).toHaveBeenLastCalledWith(link, "ali");
    fireEvent.click(screen.getByRole("option", { name: "Alice ali" }));
    expect(onChange).toHaveBeenCalledWith("u1");
  });

  it("valueless operators hide the input; `in` takes a comma-separated list", () => {
    render(<StatefulBuilder initial={{ conjunction: "and", conditions: [{ id: "a", field: "title", operator: "is_set", value: "" }, { id: "b", field: "status", operator: "in", value: "" }] }} />);
    fireEvent.click(btn("Filter"));
    expect(screen.getAllByPlaceholderText(/./).map((i) => i.getAttribute("placeholder"))).toEqual(["Comma-separated"]);
  });
});

// ---- F17 · F36 saved filters -------------------------------------------------------------------------------------------------
describe("F17 saved filters", () => {
  const memoryAdapter = (fail = false): SavedFiltersStorage & { items: SavedFilter[] } => {
    const a = {
      items: [] as SavedFilter[],
      list: async () => a.items,
      save: async (_v: string, label: string, query: FilterQuery) => { if (fail) throw new Error("offline"); a.items = [...a.items, { id: `s${a.items.length + 1}`, label, query }]; return a.items; },
      remove: async (_v: string, id: string) => { a.items = a.items.filter((f) => f.id !== id); return a.items; },
    };
    return a;
  };
  const saveAs = async (label: string) => {
    fireEvent.click(btn("Saved"));
    type(within(popover()).getByPlaceholderText("Save current as…"), label);
    await act(async () => { fireEvent.click(within(popover()).getByRole("button", { name: "Save current as…" })); });
  };

  it("save, apply and delete through an async adapter; onFilterSaved fires (F36)", async () => {
    const adapter = memoryAdapter(); const onFilterSaved = vi.fn();
    renderList({ viewKey: "tasks", storage: { saved: adapter, prefs: null }, quickFilterFields: ["title"], onFilterSaved });
    type(screen.getByLabelText("Title"), "Task 2");
    await saveAs("Twos");
    expect(adapter.items.map((f) => f.label)).toEqual(["Twos"]);
    expect(onFilterSaved).toHaveBeenCalledWith(expect.objectContaining({ label: "Twos" }));
    type(screen.getByLabelText("Title"), "");
    expect(bodyRows()).toHaveLength(20);
    fireEvent.click(within(popover()).getByRole("button", { name: "Twos" }));
    expect(bodyRows()).toHaveLength(7);
    await act(async () => { fireEvent.click(within(popover()).getByRole("button", { name: "Remove" })); });
    expect(adapter.items).toHaveLength(0);
    expect(within(popover()).getByText("No saved filters")).toBeTruthy();
  });

  it("saving needs an active filter and a name", () => {
    renderList({ viewKey: "tasks", storage: { saved: memoryAdapter(), prefs: null } });
    fireEvent.click(btn("Saved"));
    type(within(popover()).getByPlaceholderText("Save current as…"), "All");
    expect((within(popover()).getByRole("button", { name: "Save current as…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("an adapter failure reaches onSavedFiltersError (F36) instead of being swallowed", async () => {
    const onSavedFiltersError = vi.fn();
    renderList({ viewKey: "tasks", storage: { saved: memoryAdapter(true), prefs: null }, quickFilterFields: ["title"], onSavedFiltersError });
    type(screen.getByLabelText("Title"), "Task 2");
    await saveAs("Twos");
    expect(onSavedFiltersError).toHaveBeenCalledWith(expect.objectContaining({ message: "offline" }), "save");
  });

  it("the localStorage adapter keeps lists per view and per user", () => {
    const alice = createLocalStorageAdapter({ userKey: "alice" }).saved;
    const bob = createLocalStorageAdapter({ userKey: "bob" }).saved;
    alice.save("tasks", "Mine", { conjunction: "and", conditions: [] });
    alice.save("tasks", "Mine", { conjunction: "or", conditions: [] }); // same name replaces
    expect(alice.list("tasks")).toHaveLength(1);
    expect((alice.list("tasks") as SavedFilter[])[0].query.conjunction).toBe("or");
    expect(alice.list("bugs")).toHaveLength(0);
    expect(bob.list("tasks")).toHaveLength(0);
  });
});

// ---- F18 column manager ------------------------------------------------------------------------------------------------------
describe("F18 column manager", () => {
  const headers = () => [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim()).filter(Boolean);

  it("show/hide; reorder with the keyboard buttons and by dragging", () => {
    renderList();
    fireEvent.click(btn("Columns"));
    const row = (name: string) => within(popover()).getByText(name).closest("div")!;
    fireEvent.click(within(row("Owner")).getByRole("checkbox"));
    expect(headers()).toEqual(["Title", "Status", "Points", "Due", "Done", "Owner"]);
    fireEvent.click(within(row("Title")).getByRole("button", { name: "Move down" }));
    expect(headers()).toEqual(["Status", "Title", "Points", "Due", "Done", "Owner"]);
    expect((within(row("Status")).getByRole("button", { name: "Move up" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.dragStart(row("Owner")); fireEvent.dragOver(row("Status")); fireEvent.drop(row("Status")); fireEvent.dragEnd(row("Owner"));
    expect(headers()).toEqual(["Owner", "Status", "Title", "Points", "Due", "Done"]);
    fireEvent.click(within(row("Points")).getByRole("checkbox"));
    expect(headers()).not.toContain("Points");
  });

  it("locked columns can't be hidden; non-hideable ones aren't offered; search appears past 10 columns", () => {
    const many: ColumnDef<Row>[] = [{ ...COLUMNS[0], alwaysVisible: true }, { ...COLUMNS[1], hideable: false }, ...Array.from({ length: 11 }, (_, i) => ({ key: `c${i}`, label: `Extra ${i}` }))];
    const Harness = () => { const [keys, setKeys] = React.useState(many.map((c) => c.key)); return <ColumnManager columns={many} visibleKeys={keys} onChange={setKeys} />; };
    render(<Wrap><Harness /></Wrap>);
    fireEvent.click(btn("Columns"));
    expect((within(popover()).getByText("Title").closest("div")!.querySelector("[role=checkbox]") as HTMLButtonElement).disabled).toBe(true);
    expect(within(popover()).queryByText("Status")).toBeNull();
    type(within(popover()).getByPlaceholderText("Search…"), "extra 7");
    expect(within(popover()).getAllByRole("checkbox").length).toBe(2); // locked Title + Extra 7 (not Extra 10…)
    cleanup();
    renderList(); // 6 columns: no search box (negative control)
    fireEvent.click(btn("Columns"));
    expect(within(popover()).queryByPlaceholderText("Search…")).toBeNull();
  });

  it("row actions are not a column users can manage, filter or sort (fix: Sear's `actions` field)", () => {
    renderList({ rowActions: [{ key: "del", label: "Delete", icon: Trash2, onSelect: () => {} }] });
    expect(th("Actions")).toBeTruthy();
    expect(within(th("Actions")).queryByRole("button")).toBeNull();
    fireEvent.click(btn("Columns"));
    expect(within(popover()).queryByText("Actions")).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(btn("Filter"));
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(within(popover()).getAllByRole("combobox")[0]);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Title", "Status", "Points", "Due", "Done", "Owner"]);
    const headerOrder = [...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim());
    expect(headerOrder.at(-1)).toBe("Actions");
  });
});

// ---- F19 · C1 grouping ------------------------------------------------------------------------------------------------------
describe("F19 group-by and rule C1", () => {
  it("groups with counts, rows without a value last, collapsible", () => {
    const rows = [...ROWS.slice(0, 4), { ...ROWS[4], status: "" }];
    expect(groupRows(rows, BY_STATUS.groupOf).map((g) => `${g.key}:${g.rows.length}`)).toEqual(["Done:1", "Open:2", "Working:1", "__none__:1"]);
    renderList({ rows, groupByOptions: [BY_STATUS] });
    pickMenu("Group by", "Status");
    const groupButtons = () => screen.getAllByRole("button", { expanded: true });
    expect(groupButtons().map((b) => b.textContent)).toEqual(["Done1", "Open2", "Working1", "None1"]);
    fireEvent.click(screen.getByRole("button", { name: "Open 2" }));
    expect(screen.getByRole("button", { name: "Open 2" }).getAttribute("aria-expanded")).toBe("false");
    expect(bodyRows()).toHaveLength(3);
  });

  it("C1 client mode: grouping covers every row and turns paging off — negative control: ungrouped pages", () => {
    renderList({ groupByOptions: [BY_STATUS] });
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText("Total: 25")).toBeTruthy();
    pickMenu("Group by", "Status");
    expect(bodyRows()).toHaveLength(25);
    expect(screen.queryByText("Total: 25")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull(); // nothing partial in client mode
  });

  it("C1 server mode: partial data is announced, counts carry '+', Load more fetches; complete data shows neither", () => {
    const onLoadMore = vi.fn();
    const props = { mode: "server" as const, rows: ROWS.slice(0, 12), total: 25, groupByOptions: [BY_STATUS], onLoadMore, viewKey: "srv", storage: undefined };
    localStorage.setItem("sf:list:srv:prefs", JSON.stringify({ groupBy: "status" }));
    const { rerenderList } = renderList(props);
    expect(screen.getByRole("status").textContent).toContain("Showing 12 of 25 records");
    expect(screen.getAllByRole("button", { expanded: true }).every((b) => /\d\+$/.test(b.textContent!))).toBe(true);
    fireEvent.click(btn("Load more"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerenderList({ ...props, rows: ROWS });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("button", { expanded: true }).some((b) => b.textContent!.includes("+"))).toBe(false);
  });
});

// ---- F20 · C3 · F21 selection and bulk actions ------------------------------------------------------------------------------
describe("F20 selection (rule C3) and F21 bulk actions", () => {
  const rowBox = (title: string) => within(bodyRows().find((tr) => tr.textContent!.includes(title))!).getByRole("checkbox");
  const count = () => screen.queryByRole("region")?.querySelector("[aria-live]")?.textContent ?? "none";

  it("survives sort and paging (negative control), is pruned to matching rows when search or filters change", () => {
    const run = vi.fn();
    renderList({ selectable: true, bulkActions: [{ key: "archive", label: "Archive", icon: Archive, run }] });
    fireEvent.click(rowBox("Task 2")); fireEvent.click(rowBox("Task 3"));
    expect(count()).toBe("2 selected");
    fireEvent.click(within(th("Title")).getByRole("button"));
    fireEvent.click(btn("Next page")); fireEvent.click(btn("Previous page"));
    expect(count()).toBe("2 selected");
    type(screen.getByPlaceholderText("Search…"), "Task 2");
    expect(count()).toBe("1 selected");
    fireEvent.click(btn("Archive"));
    expect(run).toHaveBeenCalledWith(["r2"], [ROWS[1]]);
  });

  it("server mode: a new query clears the selection", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useListState<Row>({ rows: ROWS.slice(0, 20), total: 25, mode: "server", columns: COLUMNS, rowKey: (r) => r.id }), { wrapper: Wrap });
    act(() => result.current.setRowsSelected(ROWS.slice(0, 3), true));
    act(() => result.current.setPage(1));
    expect(result.current.selected.size).toBe(3);
    act(() => result.current.setSearch("x"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.selected.size).toBe(0);
  });

  it("select-all acts on the visible page; in groups it reflects only that group (fix) — negative control: PMO's check", () => {
    renderList({ selectable: true, bulkActions: [{ key: "a", label: "A", run: () => {} }], groupByOptions: [BY_STATUS] });
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select all" })[0]);
    expect(count()).toBe("20 selected");
    fireEvent.click(btn("Clear selection"));
    pickMenu("Group by", "Status");
    const groupBox = (i: number) => screen.getAllByRole("checkbox", { name: "Select all" })[i];
    fireEvent.click(groupBox(1)); // Open: 9 rows
    expect(count()).toBe("9 selected");
    expect(groupBox(1).getAttribute("data-state")).toBe("checked");
    expect(groupBox(0).getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(groupBox(0)); // Done: 8
    expect(groupBox(1).getAttribute("data-state")).toBe("checked");
    // PMO ListTable.tsx:38: `selected.length === rows.length` with a group's rows and the whole selection
    const pmoAllChecked = (groupRowsCount: number, selectedTotal: number) => groupRowsCount > 0 && selectedTotal === groupRowsCount;
    expect(pmoAllChecked(9, 17)).toBe(false); // Open fully selected, but PMO shows it unchecked
  });
});

// ---- F22 · F23 · F24 rows --------------------------------------------------------------------------------------------------
describe("rows", () => {
  it("F22 rows are focusable and Enter opens them; Enter inside a cell control doesn't", () => {
    const onRowClick = vi.fn();
    renderList({ onRowClick, selectable: true });
    const tr = bodyRows()[1];
    expect(tr.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(tr, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    fireEvent.keyDown(within(tr).getByRole("checkbox"), { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("F23 rowClassName styles rows", () => {
    renderList({ rowClassName: (r) => (r.done ? "opacity-60" : undefined) });
    expect(bodyRows()[0].className).toContain("opacity-60");
    expect(bodyRows()[1].className).not.toContain("opacity-60");
  });

  it("F24 row actions run, ask first when they have a confirm, and can be hidden per row", () => {
    const del = vi.fn(); const open = vi.fn(); const onRowClick = vi.fn();
    renderList({
      onRowClick, rows: ROWS.slice(0, 2),
      rowActions: [
        { key: "open", label: "Open", icon: Archive, onSelect: open, hidden: (r) => r.id === "r2" },
        { key: "del", label: { en: "Delete", ar: "حذف" }, icon: Trash2, tone: "destructive", onSelect: del, confirm: { title: "Delete it?" } },
      ],
    });
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(open).toHaveBeenCalledWith(ROWS[0]);
    expect(onRowClick).not.toHaveBeenCalled(); // the cell doesn't open the row
    const delBtn = screen.getAllByRole("button", { name: "Delete" })[0];
    expect(delBtn.className).toContain("text-destructive");
    fireEvent.click(delBtn);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(delBtn);
    const confirmBtn = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" });
    expect(confirmBtn.className).toContain("!bg-[#b91c1c]"); // the DS destructive button (red-700), as Sear/PMO delete dialogs
    fireEvent.click(confirmBtn);
    expect(del).toHaveBeenCalledWith(ROWS[0]);
  });
});

// ---- F25 · F27 · F28 · F29 · F30 states and slots ------------------------------------------------------------------------
describe("toolbar, states and data mode", () => {
  it("F25 toolbar slot renders; control flags hide controls", () => {
    renderList({ toolbarActions: <button>New task</button>, viewKey: "t", storage: undefined });
    expect(btn("New task")).toBeTruthy();
    for (const name of ["Saved", "Filter", "Columns"]) expect(btn(name)).toBeTruthy();
    cleanup();
    renderList({ viewKey: "t", storage: undefined, controls: { search: false, savedFilters: false, filter: false, columns: false } });
    expect(screen.queryByPlaceholderText("Search…")).toBeNull();
    for (const name of ["Saved", "Filter", "Columns"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("F27 loading shows skeleton rows, not the empty message", () => {
    renderList({ rows: [], loading: true });
    expect(document.querySelectorAll("tbody tr[aria-hidden]")).toHaveLength(6);
    expect(screen.queryByText("No data yet")).toBeNull();
  });

  it("F28 two empty messages: the app's when nothing exists, the generic one when filters hide everything", () => {
    const { rerenderList } = renderList({ rows: [], emptyMessage: <span>No tasks yet <button>New task</button></span> });
    expect(screen.getByText(/No tasks yet/)).toBeTruthy();
    rerenderList({ rows: ROWS, emptyMessage: "No tasks yet" });
    type(screen.getByPlaceholderText("Search…"), "zzz");
    expect(screen.getByText("No data yet")).toBeTruthy();
    expect(screen.queryByText("No tasks yet")).toBeNull();
  });

  it("F29 errors are shown with a retry (Sear's grid never showed them)", () => {
    const onRetry = vi.fn();
    renderList({ error: true, onRetry });
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load data");
    expect(bodyRows()).toHaveLength(0);
    fireEvent.click(btn("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("F30 client mode never touches the network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    renderList({ groupByOptions: [BY_STATUS], quickFilterFields: ["title"], viewKey: "t", storage: undefined });
    type(screen.getByPlaceholderText("Search…"), "Task");
    type(screen.getByLabelText("Title"), "1");
    fireEvent.click(within(th("Points")).getByRole("button"));
    fireEvent.click(btn("Next page"));
    pickMenu("Group by", "Status");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
  });
});

// ---- F35 · C4 ------------------------------------------------------------------------------------------------------------------
describe("F35 localisation and C4 opt-in controls", () => {
  it("every message exists in both languages and the list chrome renders in Arabic", () => {
    const en = defaultMessages.en, ar = defaultMessages.ar;
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ar[k], k).toBeTruthy();
    renderList({ viewKey: "t", storage: undefined }, "ar");
    expect(screen.getByPlaceholderText("بحث…")).toBeTruthy();
    for (const name of ["المحفوظة", "تصفية", "الأعمدة"]) expect(btn(name)).toBeTruthy();
    expect(screen.getByText("الإجمالي: 25")).toBeTruthy();
    const chrome = [...document.querySelectorAll("button, [placeholder], [aria-label]")].map((e) => `${e.textContent} ${e.getAttribute("placeholder") ?? ""} ${e.getAttribute("aria-label") ?? ""}`).join(" ");
    for (const v of ["Search", "Filter", "Columns", "Saved", "Total", "Next page", "Previous page"]) expect(chrome).not.toContain(v);
  });

  it("C4 controls Sear never had appear only when asked for", () => {
    renderList();
    for (const name of [/Sort by/, /Group by/, "Customize filters", "Select all"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    cleanup();
    renderList({ controls: { sortMenu: true, quickFiltersCustomizable: true }, groupByOptions: [BY_STATUS], selectable: true });
    for (const name of [/Sort by/, /Group by/, "Customize filters"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(1);
  });
});
