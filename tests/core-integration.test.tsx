/**
 * P35 integration — Core fixes found by the CRM workstream (WS6): TagInput closes its suggestion list after Enter
 * creates a tag (it covered a popover's Apply button), and ListView status columns forward a configured `color` to
 * StatusBadge (G17 / D-crm N1). Unit tests (jsdom).
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListView, TagInput, ThemeProvider, type ColumnDef } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);
const wrap = (ui: React.ReactElement) => render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>{ui}</ThemeProvider>);

function Tags({ log }: { log: string[][] }) {
  const [v, setV] = React.useState<string[]>([]);
  return (
    <>
      <TagInput aria-label="tags" value={v} onChange={(n) => { log.push(n); setV(n); }} search={async () => []} allowCreate debounceMs={0} />
      <button type="button">Apply tags</button>
    </>
  );
}

describe("CORE.M7 TagInput after creating a tag", () => {
  it("CORE.M7 Enter adds the typed tag and closes the 'No results' list (it no longer covers what is below)", async () => {
    const log: string[][] = [];
    wrap(<Tags log={log} />);
    const box = screen.getByRole("combobox", { name: "tags" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "urgent" } });
    await act(async () => {});
    expect(screen.getByText("No results")).toBeTruthy();
    expect(box.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(box, { key: "Enter" });
    await act(async () => {});
    expect(log.at(-1)).toEqual(["urgent"]);
    expect(screen.queryByText("No results")).toBeNull();
    expect(box.getAttribute("aria-expanded")).toBe("false");
    // a comma creates too, and closes the list as well
    fireEvent.change(box, { target: { value: "vip" } });
    await act(async () => {});
    expect(screen.getByText("No results")).toBeTruthy();
    fireEvent.change(box, { target: { value: "vip," } });
    await act(async () => {});
    expect(log.at(-1)).toEqual(["urgent", "vip"]);
    expect(screen.queryByText("No results")).toBeNull();
  });
});

type Row = { id: string; stage: string; colour?: string };
const ROWS: Row[] = [{ id: "1", stage: "Won", colour: "#16a34a" }, { id: "2", stage: "Lost", colour: "flame" }, { id: "3", stage: "New" }, { id: "4", stage: "" }];

describe("CORE.G17 ListView status columns forward a configured colour to StatusBadge", () => {
  it("CORE.G17 status.color per row → StatusBadge data-color (hex / palette token); no colour → tone; empty → '—'", () => {
    const cols: ColumnDef<Row>[] = [{ key: "stage", label: "Stage", type: "select", fieldtype: "Select", status: { color: (_v, r) => r.colour, tone: () => "info" } }];
    wrap(<ListView<Row> rows={ROWS} columns={cols} rowKey={(r) => r.id} storage={null} />);
    const won = screen.getByText("Won").closest("[data-tone]") as HTMLElement;
    expect(won.getAttribute("data-color")).toBe("#16a34a");
    const lost = screen.getByText("Lost").closest("[data-tone]") as HTMLElement;
    expect(lost.getAttribute("data-color")).toMatch(/var\(--/);
    const fresh = screen.getByText("New").closest("[data-tone]") as HTMLElement;
    expect(fresh.getAttribute("data-color")).toBeNull();
    expect(fresh.getAttribute("data-tone")).toBe("info");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
  it("CORE.G17 negative: without `status` the 0.6.0 Select badge is rendered (no StatusBadge)", () => {
    const cols: ColumnDef<Row>[] = [{ key: "stage", label: "Stage", type: "select", fieldtype: "Select" }];
    wrap(<ListView<Row> rows={ROWS} columns={cols} rowKey={(r) => r.id} storage={null} />);
    expect(screen.getByText("Won").closest("[data-tone]")).toBeNull();
  });
});
