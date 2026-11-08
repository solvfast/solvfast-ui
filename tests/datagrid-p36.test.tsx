/**
 * P36 W3 — DataGrid responsive layout: `layout="table" | "cards" | "auto"` (auto = the grid's container width via a
 * ResizeObserver, not the window), `DataGridColumn.mobile` ("primary" | false, as ListView's `ColumnDef.mobile`),
 * inline editing in cards (one row at a time, keyboard + screen reader), row menu / add / delete / selection in cards,
 * Arabic + RTL. The table stays the default with its markup unchanged.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { DataGrid, type DataGridColumn, type DataGridProps } from "../src/fields";
import { defaultMessages } from "../src/theme/messages";

// ---- a controllable ResizeObserver + clientWidth ----------------------------------------------------------------------
let width = 0;
const observers = new Set<{ cb: ResizeObserverCallback; self: ResizeObserver }>();
const resizeTo = (w: number) => act(() => {
  width = w;
  for (const o of observers) o.cb([], o.self);
});
beforeAll(() => {
  globalThis.ResizeObserver = class {
    private entry: { cb: ResizeObserverCallback; self: ResizeObserver };
    constructor(cb: ResizeObserverCallback) { this.entry = { cb, self: this as unknown as ResizeObserver }; }
    observe() { observers.add(this.entry); }
    unobserve() { observers.delete(this.entry); }
    disconnect() { observers.delete(this.entry); }
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return (this as HTMLElement).dataset.layout ? width : 0; } });
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); width = 0; observers.clear(); });

const ok = (cond: boolean, msg: string) => expect(cond, msg).toBe(true);
const wrap = (ui: React.ReactElement, lang: "en" | "ar" = "en") =>
  render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" }); // Radix menus open from the keyboard in jsdom

// ---- a commission-split-like grid -------------------------------------------------------------------------------------
type Row = { id: string; name: string; pct: string; note: string };
const ROWS: Row[] = [
  { id: "a", name: "Sourcing", pct: "33", note: "first touch" },
  { id: "b", name: "Qualifying", pct: "33", note: "" },
  { id: "c", name: "Closing", pct: "34", note: "signed" },
];
function Harness({ initial = ROWS, extra, ...props }: { initial?: Row[]; extra?: Partial<DataGridColumn<Row>>[] } & Partial<DataGridProps<Row>>) {
  const [rows, setRows] = React.useState(initial);
  const n = React.useRef(initial.length);
  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const base: DataGridColumn<Row>[] = [
    { key: "note", label: "Note", width: 3, mobile: false, renderCell: (r) => r.note, renderEditor: (r) => <input aria-label="Note" value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} /> },
    { key: "name", label: "Name", width: 5, required: true, mobile: "primary", isInvalid: (r) => !r.name, renderCell: (r) => r.name,
      renderEditor: (r, i) => <input aria-label={`Name ${i + 1}`} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} /> },
    { key: "pct", label: "Share %", width: 2, align: "end", renderCell: (r) => (r.pct ? `${r.pct}%` : "—"),
      renderEditor: (r, i) => <input aria-label={`Share % ${i + 1}`} value={r.pct} onChange={(e) => set(r.id, { pct: e.target.value })} /> },
    { key: "total", label: "Total", width: 2, renderCell: () => "fixed" },
  ];
  const columns = base.map((c, i) => ({ ...c, ...(extra?.[i] ?? {}) }));
  const fresh = (): Row => ({ id: `n${++n.current}`, name: "", pct: "", note: "" });
  return (
    <>
      <DataGrid<Row>
        label="Stage split" rows={rows} getRowKey={(r) => r.id} columns={columns}
        onAddRow={() => setRows((r) => [...r, fresh()])}
        onInsertRow={(i) => setRows((r) => [...r.slice(0, i), fresh(), ...r.slice(i)])}
        onDuplicateRow={(i) => setRows((r) => [...r.slice(0, i + 1), { ...r[i], id: `d${++n.current}` }, ...r.slice(i + 1)])}
        onDeleteRows={(idx) => setRows((r) => r.filter((_, i) => !idx.includes(i)))}
        onMoveRow={(f, t) => setRows((r) => { const c = [...r]; const [x] = c.splice(f, 1); c.splice(t, 0, x); return c; })}
        {...props}
      />
      <button type="button">outside</button>
    </>
  );
}
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-card]")];
const card = (key: string) => cards().find((c) => c.dataset.rowKey === key)!;
const titles = () => cards().map((c) => c.querySelector("[data-col]")?.textContent);
const root = () => document.querySelector<HTMLElement>("[data-layout]")!;

describe("CORE.DG — DataGrid responsive layout (P36)", () => {
  it("CORE.DG1 default layout is the table, unchanged: min-w-[32rem] + sideways scroll frame, no cards", () => {
    wrap(<Harness />);
    expect(root().dataset.layout).toBe("table");
    const table = screen.getByRole("table", { name: "Stage split" });
    expect(table.className).toBe("w-full min-w-[32rem] table-fixed caption-bottom text-sm");
    expect(table.parentElement!.className).toMatch(/overflow-x-auto/);
    expect(cards()).toHaveLength(0);
    expect(observers.size).toBe(0); // "table" never measures
  });

  it("CORE.DG2 minTableWidth: false drops the minimum width, a value sets it (table only)", () => {
    wrap(<Harness minTableWidth={false} />);
    expect(screen.getByRole("table").className).not.toMatch(/min-w/);
    cleanup();
    wrap(<Harness minTableWidth="40rem" />);
    expect(screen.getByRole("table").style.minWidth).toBe("40rem");
  });

  it("CORE.DG3 cards: one card per row in a labelled list; primary = title; label/value lines in column order; mobile:false left out", () => {
    wrap(<Harness layout="cards" />);
    expect(root().dataset.layout).toBe("cards");
    expect(screen.queryByRole("table")).toBeNull();
    const list = screen.getByRole("list", { name: "Stage split" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(titles()).toEqual(["Sourcing", "Qualifying", "Closing"]);
    const first = card("a");
    expect([...first.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Share %", "Total"]);
    expect([...first.querySelectorAll("dd")].map((d) => d.textContent)).toEqual(["33%", "fixed"]);
    expect(first.textContent).not.toContain("first touch"); // Note: mobile false
    expect(first.textContent).not.toContain("Note");
    // the row number with its screen-reader label
    expect(first.textContent).toContain(`${defaultMessages.en.formRowNo} 1`);
    // no forced width / sideways scroll anywhere in cards
    ok(![...root().querySelectorAll("*")].some((el) => /min-w-\[|overflow-x-auto/.test(el.getAttribute("class") ?? "")), "no min-w / overflow-x in cards");
  });

  it("CORE.DG4 primary defaults to the first column not set to false", () => {
    wrap(<Harness layout="cards" extra={[{}, { mobile: undefined }]} />);
    expect(titles()).toEqual(["Sourcing", "Qualifying", "Closing"]); // note is false → name is first
    cleanup();
    wrap(<Harness layout="cards" extra={[{}, { mobile: undefined }, { mobile: "primary" }]} />);
    expect(titles()).toEqual(["33%", "33%", "34%"]);
    expect([...card("a").querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Name*", "Total"]);
  });

  it("CORE.DG5 auto: cards below cardsBelow of the CONTAINER width, the table (no min-w) above; unknown width = table", () => {
    wrap(<Harness layout="auto" />);
    expect(root().dataset.layout).toBe("table"); // jsdom: width 0 = unknown
    resizeTo(390);
    expect(root().dataset.layout).toBe("cards");
    expect(cards()).toHaveLength(3);
    resizeTo(800);
    expect(root().dataset.layout).toBe("table");
    expect(screen.getByRole("table").className).not.toMatch(/min-w/);
    resizeTo(639);
    expect(root().dataset.layout).toBe("cards");
    cleanup();
    wrap(<Harness layout="auto" cardsBelow={400} />);
    resizeTo(420);
    expect(root().dataset.layout).toBe("table");
    resizeTo(360);
    expect(root().dataset.layout).toBe("cards");
  });

  it("CORE.DG6 auto keeps the row being edited across a layout switch", () => {
    wrap(<Harness layout="auto" />);
    resizeTo(390);
    fireEvent.click(card("b").querySelector("[data-col='name']")!);
    expect(screen.getByRole("textbox", { name: "Name 2" })).toBeTruthy();
    resizeTo(900);
    expect(screen.getByRole("textbox", { name: "Name 2" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Name 1" })).toBeNull();
  });

  it("CORE.DG7 editing in cards: tapping a value edits that row only (focus on the tapped column), one row at a time; Escape / outside stop", () => {
    wrap(<Harness layout="cards" />);
    fireEvent.click(card("a").querySelector("dd[data-col='pct']")!);
    const pct = screen.getByRole("textbox", { name: "Share % 1" });
    expect(document.activeElement).toBe(pct);
    expect(card("a").dataset.editing).toBe("");
    // labelled groups around every editor; mobile:false column has no editor on the card
    expect(within(card("a")).getByRole("group", { name: "Name" })).toBeTruthy();
    expect(within(card("a")).getByRole("group", { name: "Share %" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    fireEvent.change(pct, { target: { value: "40" } });
    expect((screen.getByRole("textbox", { name: "Share % 1" }) as HTMLInputElement).value).toBe("40");
    // another card → the first stops
    fireEvent.click(card("c").querySelector("[data-col='name']")!);
    expect(screen.queryByRole("textbox", { name: "Share % 1" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name 3" }));
    // Escape → back to the row's Edit toggle
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name 3" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Name 3" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit row 3" }));
    expect(within(card("a")).getByText("40%")).toBeTruthy();
    // outside pointerdown stops
    fireEvent.click(card("b").querySelector("[data-col='name']")!);
    expect(screen.getByRole("textbox", { name: "Name 2" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("textbox", { name: "Name 2" })).toBeNull();
  });

  it("CORE.DG8 keyboard: the Edit toggle (aria-pressed) enters / leaves editing and focuses the first editor", () => {
    wrap(<Harness layout="cards" />);
    const toggle = screen.getByRole("button", { name: "Edit row 2" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name 2" }));
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("textbox", { name: "Name 2" })).toBeNull();
  });

  it("CORE.DG9 add / remove on phones: Add Row, the row menu (insert, duplicate, move, delete), selection + Delete", () => {
    wrap(<Harness layout="cards" />);
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formAddRow }));
    expect(cards()).toHaveLength(4);
    const fresh = cards()[3];
    // required empty primary is marked on the card
    expect(fresh.querySelector("[data-col='name']")!.className).toMatch(/ring-destructive/);
    openMenu(screen.getByRole("button", { name: "Row 1 actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: defaultMessages.en.formDuplicateRow }));
    expect(titles()).toEqual(["Sourcing", "Sourcing", "Qualifying", "Closing", ""]);
    openMenu(screen.getByRole("button", { name: "Row 3 actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: defaultMessages.en.formMoveUp }));
    expect(titles()).toEqual(["Sourcing", "Qualifying", "Sourcing", "Closing", ""]);
    openMenu(screen.getByRole("button", { name: "Row 5 actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: defaultMessages.en.formDelete }));
    expect(cards()).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(titles()).toEqual(["Qualifying", "Closing"]);
    fireEvent.click(screen.getByRole("checkbox", { name: defaultMessages.en.formSelectAllRows }));
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(cards()).toHaveLength(0);
    expect(screen.getByText(defaultMessages.en.formNoRows)).toBeTruthy();
  });

  it("CORE.DG10 Desk's shortcuts work inside a card", () => {
    wrap(<Harness layout="cards" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit row 1" }), { key: "ArrowDown", ctrlKey: true });
    expect(titles()).toEqual(["Sourcing", "", "Qualifying", "Closing"]);
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit row 1" }), { key: "ArrowDown", shiftKey: true, altKey: true });
    expect(titles()).toEqual(["Sourcing", "Sourcing", "", "Qualifying", "Closing"]);
  });

  it("CORE.DG11 read-only / no add / no delete / inlineEdit=false in cards", () => {
    wrap(<Harness layout="cards" editable={false} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit row/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /actions/ })).toBeNull();
    expect(screen.queryByRole("button", { name: defaultMessages.en.formAddRow })).toBeNull();
    fireEvent.click(card("a").querySelector("[data-col='name']")!);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(titles()).toEqual(["Sourcing", "Qualifying", "Closing"]);
    cleanup();
    wrap(<Harness layout="cards" canAdd={false} canDelete={false} />);
    expect(screen.queryByRole("button", { name: defaultMessages.en.formAddRow })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();
    const opened: number[] = [];
    wrap(<Harness layout="cards" inlineEdit={false} onOpenRow={(i) => opened.push(i)} />);
    fireEvent.click(card("b").querySelector("[data-col='name']")!);
    fireEvent.click(screen.getByRole("button", { name: "Edit row 3" }));
    expect(opened).toEqual([1, 2]);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("CORE.DG12 paging in cards: 50 per page, Add Row jumps to the last page", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ id: `r${i}`, name: `Stage ${i + 1}`, pct: "1", note: "" }));
    wrap(<Harness layout="cards" initial={many} />);
    expect(cards()).toHaveLength(50);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formAddRow }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(titles()).toEqual(["Stage 51", ""]);
  });

  it("CORE.DG13 Arabic / RTL: chrome translated, the grid inherits dir=rtl, logical classes only", () => {
    wrap(<Harness layout="cards" />, "ar");
    const ar = defaultMessages.ar as Record<string, string>;
    expect(root().closest("[dir]")!.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("button", { name: ar.coreGridEditRow.replace("{n}", "1") })).toBeTruthy();
    expect(screen.getByRole("button", { name: ar.formRowActions.replace("{n}", "1") })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: ar.formSelectRow.replace("{n}", "2") })).toBeTruthy();
    expect(screen.getByRole("button", { name: ar.formAddRow })).toBeTruthy();
    expect(card("a").textContent).toContain(`${ar.formRowNo} 1`);
    ok(![...root().querySelectorAll("*")].some((el) => /(^|\s)(ml|mr|pl|pr|left|right)-|text-(left|right)/.test(el.getAttribute("class") ?? "")), "no physical left/right classes");
    fireEvent.click(screen.getByRole("button", { name: ar.coreGridEditRow.replace("{n}", "1") }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name 1" }));
  });

  it("CORE.DG14 messages: the new key exists in en and ar", () => {
    const en = defaultMessages.en as Record<string, string>;
    const ar = defaultMessages.ar as Record<string, string>;
    expect(en.coreGridEditRow).toBe("Edit row {n}");
    expect(ar.coreGridEditRow).toContain("{n}");
  });
});
