/**
 * P35 views — Kanban. Core `KanbanBoard` (Testing Library: columns, counts, order, drag and drop, keyboard moves,
 * revert on failure) and `FrappeKanbanView` over the SIMULATED Frappe: a Kanban Board document (get_kanban_boards,
 * frappe.client.get, update_order_for_single_card — handlers in src/frappe/testing/handlers/views.ts citing
 * kanban_board.py) and the group-by-Select mode (frappe.client.set_value). Simulated & tested — never run on a site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { KanbanBoard, type KanbanColumn } from "../src/list/views";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeKanbanView, boardLayout } from "../src/frappe/views";
import { createFixtureTransport } from "../src/frappe/testing";
import { viewsDemoBackend } from "../src/frappe/testing/handlers/views";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const theme = (ui: React.ReactNode, lang: "en" | "ar" = "en") => <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>;
type C = { id: string; t: string; col: string };
const COLS: KanbanColumn[] = [{ key: "todo", label: "To do", indicator: "Blue" }, { key: "doing", label: "Doing" }, { key: "done", label: { en: "Done", ar: "منجز" } }];
const CARDS: C[] = [{ id: "1", t: "One", col: "todo" }, { id: "2", t: "Two", col: "todo" }, { id: "3", t: "Three", col: "doing" }];
const column = (label: string) => screen.getByRole("listitem", { name: label });
const cardsIn = (label: string) => [...column(label).querySelectorAll("[data-card-key]")].map((li) => li.getAttribute("data-card-key"));
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

describe("LV.H2 kanban board (Core)", () => {
  it("LV.H2 columns with counts, cards in each column's order, empty column message", () => {
    render(theme(<KanbanBoard columns={COLS} rows={CARDS} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.t} order={{ todo: ["2", "1"] }} />));
    expect(cardsIn("To do")).toEqual(["2", "1"]);
    expect(within(column("To do")).getByLabelText("2 cards").textContent).toBe("2");
    expect(within(column("Done")).getByText("No cards")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull(); // read-only without onMove
  });
  it("LV.H2 keyboard: Move to… menu and Alt+Arrow (RTL swaps) call onMove with indices; the board shows the move at once", async () => {
    const onMove = vi.fn(() => Promise.resolve());
    render(theme(<KanbanBoard columns={COLS} rows={CARDS} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.t} onMove={onMove} />));
    openMenu(within(column("To do")).getByRole("button", { name: "Move Two" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Done" }));
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: "2", from: "todo", to: "done", fromIndex: 1, toIndex: 0 }));
    expect(cardsIn("Done")).toEqual(["2"]); // optimistic
    await waitFor(() => expect(screen.getByTestId("sf-kanban-status").textContent).toBe("Two moved to Done"));
    fireEvent.keyDown(within(column("To do")).getByRole("button", { name: "One" }), { key: "ArrowRight", altKey: true });
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: "1", from: "todo", to: "doing", toIndex: 1 }));
    cleanup();
    const onMoveAr = vi.fn(() => Promise.resolve());
    render(theme(<KanbanBoard columns={COLS} rows={CARDS} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.t} onMove={onMoveAr} />, "ar"));
    fireEvent.keyDown(within(screen.getByRole("listitem", { name: "To do" })).getByRole("button", { name: "One" }), { key: "ArrowLeft", altKey: true });
    expect(onMoveAr).toHaveBeenLastCalledWith(expect.objectContaining({ to: "doing" }));
  });
  it("LV.H2 drag and drop onto a column / before a card; a rejected move is taken back and announced", async () => {
    let fail = false;
    const onMove = vi.fn(() => (fail ? Promise.reject(new Error("no")) : Promise.resolve()));
    render(theme(<KanbanBoard columns={COLS} rows={CARDS} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.t} onMove={onMove} />));
    const dt = { data: {} as Record<string, string>, setData(k: string, v: string) { this.data[k] = v; }, getData(k: string) { return this.data[k]; } };
    fireEvent.dragStart(column("To do").querySelector('[data-card-key="1"]')!, { dataTransfer: dt });
    fireEvent.dragOver(column("Doing"), { dataTransfer: dt });
    fireEvent.drop(column("Doing").querySelector('[data-card-key="3"]')!, { dataTransfer: dt });
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: "1", to: "doing", toIndex: 0 }));
    await waitFor(() => expect(screen.getByTestId("sf-kanban-status").textContent).toBe("One moved to Doing"));
    fail = true;
    fireEvent.dragStart(column("To do").querySelector('[data-card-key="2"]')!, { dataTransfer: dt });
    fireEvent.drop(column("Done"), { dataTransfer: dt });
    await waitFor(() => expect(screen.getByTestId("sf-kanban-status").textContent).toBe("Could not move Two"));
    expect(cardsIn("To do")).toEqual(["1", "2"]); // back where it was (the host's data never changed)
    expect(cardsIn("Done")).toEqual([]);
  });
  it("LV.H2 add-card slot and canMove per card", () => {
    const onAdd = vi.fn();
    render(theme(<KanbanBoard columns={COLS} rows={CARDS} rowKey={(c) => c.id} columnOf={(c) => c.col} title={(c) => c.t} onMove={() => {}} canMove={(c) => c.id !== "3"} onAddCard={onAdd} />));
    expect(within(column("Doing")).queryByRole("button", { name: "Move Three" })).toBeNull();
    fireEvent.click(within(column("Done")).getByRole("button", { name: "Add card" }));
    expect(onAdd).toHaveBeenCalledWith("done");
  });
});

function mount(props: Partial<React.ComponentProps<typeof FrappeKanbanView>> = {}, session = { user: "Administrator", roles: ["System Manager"] }) {
  const transport = createFixtureTransport(viewsDemoBackend());
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(theme(
    <QueryClientProvider client={qc}><FrappeProvider client={client} session={session}>
      <FrappeKanbanView doctype="Project Task" storage={null} {...props} />
    </FrappeProvider></QueryClientProvider>,
  ));
  const calls = (m: string) => transport.store.calls.filter((c) => c.method === m);
  return { transport, calls };
}

describe("LV.H2 FrappeKanbanView (SIMULATED Kanban Board)", () => {
  it("LV.H2 board mode: boards listed, board loaded, all rows requested with the board field; archived column hidden; order kept", async () => {
    const { calls } = mount();
    await screen.findByRole("button", { name: "Write spec" });
    expect(calls("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards")[0].args).toEqual({ doctype: "Project Task" });
    expect(calls("frappe.client.get")[0].args).toEqual({ doctype: "Kanban Board", name: "Task Board" });
    const get = calls("frappe.desk.reportview.get").at(-1)!.args;
    expect(get).toMatchObject({ start: 0, page_length: 0 });
    expect(JSON.parse(String(get.fields))).toEqual(expect.arrayContaining(["name", "status", "subject"]));
    expect(screen.getAllByRole("listitem").filter((l) => l.tagName === "SECTION").map((s) => s.getAttribute("aria-label"))).toEqual(["Open", "Working", "Pending Review", "Completed"]);
    expect(cardsIn("Open")).toEqual(["T-6", "T-1"]);
    expect(calls("frappe.desk.reportview.get_count")).toHaveLength(0);
  });
  it("LV.H2 moving a card → update_order_for_single_card (kanban_board.py:131-161); the document and the board order change", async () => {
    const moved = vi.fn();
    const { calls, transport } = mount({ onCardMoved: moved });
    await screen.findByRole("button", { name: "Write spec" });
    openMenu(within(column("Open")).getByRole("button", { name: "Move Write spec" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Working" }));
    await waitFor(() => expect(moved).toHaveBeenCalled());
    expect(calls("frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card")[0].args).toEqual({
      board_name: "Task Board", docname: "T-1", from_colname: "Open", to_colname: "Working", old_index: 1, new_index: 2,
    });
    expect(transport.store.docs.get("Project Task")!.get("T-1")!.status).toBe("Working");
    const board = transport.store.docs.get("Kanban Board")!.get("Task Board")!;
    expect(boardLayout(board as never).order).toMatchObject({ Open: ["T-6"], Working: ["T-2", "T-3", "T-1"] });
    expect(cardsIn("Working")).toEqual(["T-2", "T-3", "T-1"]);
    expect(within(column("Working")).getByLabelText("3 cards")).toBeTruthy();
  });
  it("LV.H2 group mode (no board): columns from the Select options; a move is frappe.client.set_value", async () => {
    const { calls, transport } = mount({ groupBy: "priority" });
    await screen.findByRole("button", { name: "Write spec" });
    expect(screen.getByTestId("sf-kanban-mode").textContent).toBe("Grouped by Priority");
    expect(calls("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards")).toHaveLength(0);
    fireEvent.keyDown(within(column("High")).getByRole("button", { name: "Write spec" }), { key: "ArrowLeft", altKey: true });
    await waitFor(() => expect(calls("frappe.client.set_value")).toHaveLength(1));
    expect(calls("frappe.client.set_value")[0].args).toEqual({ doctype: "Project Task", name: "T-1", fieldname: JSON.stringify({ priority: "Medium" }) });
    await waitFor(() => expect(transport.store.docs.get("Project Task")!.get("T-1")!.priority).toBe("Medium"));
  });
  it("LV.H2 filters shared with the list state (initialQuery) reach the request; read-only without write permission", async () => {
    const { calls } = mount({ initialQuery: { conjunction: "and", conditions: [{ id: "x", field: "priority", operator: "equals", value: "Low" }] } }, { user: "reader@x.com", roles: ["Reader"] });
    await screen.findByRole("button", { name: "Fix bugs" });
    expect(JSON.parse(String(calls("frappe.desk.reportview.get").at(-1)!.args.filters))).toEqual([["priority", "=", "Low"]]);
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
    expect(screen.getByRole("note").textContent).toBe("You cannot move cards: no write permission on Project Task");
  });
});
