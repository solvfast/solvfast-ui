/**
 * Run 1 · I3 — `ListView onResultChange` (docs/specs/LISTVIEW-API.md §4): client mode reports every matching row
 * (filtered, searched, sorted, all pages), the visible column keys and whether a filter or search is active; it fires on
 * query / search / sort / column changes, not on paging; server mode never calls it. jsdom.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListView, ThemeProvider, applyFilterQuery, sortRows, type ColumnDef, type FilterQuery } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

type Row = { id: string; name: string; stage: string; amount: number };
const ROWS: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: `r${i}`, name: `Deal ${i}`, stage: i % 3 === 0 ? "Won" : i % 3 === 1 ? "Open" : "Lost", amount: (i * 37) % 100 }));
const COLS: ColumnDef<Row>[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "stage", label: "Stage", type: "select", options: ["Won", "Open", "Lost"].map((v) => ({ value: v, label: v })) },
  { key: "amount", label: "Amount", type: "number" },
];
type Result = { rows: Row[]; visibleColumns: string[]; filtered: boolean };
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as Result;

function mount(props: Partial<React.ComponentProps<typeof ListView<Row>>> = {}) {
  const onResultChange = vi.fn();
  render(<ThemeProvider storageKeys={null}><ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} onResultChange={onResultChange} {...props} /></ThemeProvider>);
  return onResultChange;
}

describe("I3 onResultChange", () => {
  it("first report: every row (all pages, not just the 20 shown), the visible columns, not filtered", () => {
    const cb = mount();
    const r = last(cb);
    expect(r.rows).toHaveLength(45);
    expect(r.visibleColumns).toEqual(["name", "stage", "amount"]);
    expect(r.filtered).toBe(false);
  });

  it("the rows equal applyFilterQuery + sortRows over the input for a query, and the result is marked filtered", () => {
    const q: FilterQuery = { conjunction: "and", conditions: [{ id: "c", field: "stage", operator: "equals", value: "Won" }] };
    const cb = mount({ initialQuery: q, defaultSort: { key: "amount", dir: "desc" } });
    const fields = COLS.map((c) => ({ name: c.key, label: String(c.label), type: c.type!, options: c.options }));
    const expected = sortRows(applyFilterQuery(ROWS, q, fields as never), { key: "amount", dir: "desc" }, COLS);
    const r = last(cb);
    expect(r.rows.map((x) => x.id)).toEqual(expected.map((x) => x.id));
    expect(r.filtered).toBe(true);
  });

  it("fires on search and sort; not on paging", async () => {
    vi.useFakeTimers();
    const cb = mount();
    const n0 = cb.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /next|التالي/i }));
    expect(cb.mock.calls.length).toBe(n0); // paging: no report
    fireEvent.click(screen.getByRole("button", { name: /Amount/ })); // header sort
    expect(cb.mock.calls.length).toBeGreaterThan(n0);
    expect(last(cb).rows[0]!.amount).toBeLessThanOrEqual(last(cb).rows[1]!.amount);
    const n1 = cb.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "Deal 4" } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(cb.mock.calls.length).toBeGreaterThan(n1);
    expect(last(cb).rows.every((x) => x.name.includes("Deal 4"))).toBe(true);
    expect(last(cb).filtered).toBe(true);
    vi.useRealTimers();
  });

  it("NEGATIVE: server mode never calls it", () => {
    const cb = mount({ mode: "server", total: 45 });
    expect(cb).not.toHaveBeenCalled();
  });
});
