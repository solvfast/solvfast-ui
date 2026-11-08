/**
 * 0.4.1 — Desk's selection mode for the List View (Frappe 15.110 list_view.js:590-598 toggle_actions_menu_button,
 * :1613-1634 on_row_checked, :740-760 header skeleton, :1400-1421 shift range, :1855-2127 the Actions menu) and the Core
 * Assign To dialog (form/sidebar/assign_to.js:87-240). SIMULATED: jsdom, no server.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { AssignDialog, ListView, ThemeProvider, type BulkAction, type ColumnDef, type ListViewProps, type UserOption } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

type Row = { id: string; title: string; status: string };
const ROWS: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `r${i + 1}`, title: `Task ${i + 1}`, status: i % 2 ? "Open" : "Done" }));
const COLUMNS: ColumnDef<Row>[] = [
  { key: "title", label: { en: "Title", ar: "العنوان" } },
  { key: "status", label: { en: "Status", ar: "الحالة" } },
];

function renderList(p: Partial<ListViewProps<Row>> = {}, lang: "en" | "ar" = "en") {
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <ListView<Row> rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} {...p} />
    </ThemeProvider>,
  );
}
const rowBox = (title: string) => within(screen.getByText(title).closest("tr")!).getByRole("checkbox");
const headerTexts = () => [...document.querySelectorAll("thead th")].map((th) => th.textContent?.trim()).filter(Boolean);

describe("selectionMode='header' (Desk)", () => {
  it("no extra row: the header swaps its column titles for '{n} items selected' + Clear, and back", () => {
    renderList({ selectable: true, selectionMode: "header", bulkActions: [{ key: "x", label: "Export", run: () => {} }] });
    expect(headerTexts()).toEqual(["Title", "Status"]);
    fireEvent.click(rowBox("Task 2"));
    fireEvent.click(rowBox("Task 4"));
    expect(screen.queryByRole("region")).toBeNull(); // the bar (role=region) is not rendered
    expect(headerTexts().join(" ")).toContain("2 items selected");
    expect(screen.queryByRole("button", { name: "Title" })).toBeNull();
    fireEvent.click(within(document.querySelector("thead")!).getByRole("button", { name: /Clear selection/ }));
    expect(headerTexts()).toEqual(["Title", "Status"]);
    expect(rowBox("Task 2").getAttribute("data-state")).toBe("unchecked");
  });

  it("the primary action gives way to the Actions menu while rows are selected, then returns", () => {
    renderList({ selectable: true, selectionMode: "header", primaryAction: <button type="button">New</button>, bulkActions: [{ key: "x", label: "Export", run: () => {} }] });
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    fireEvent.click(rowBox("Task 1"));
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.getByTestId("sf-list-actions").textContent).toContain("Actions");
    fireEvent.click(rowBox("Task 1"));
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
  });

  it("menu items run on exactly the selected keys; hidden / disabled (with reason) / groups / destructive confirm", async () => {
    const run = vi.fn(); const del = vi.fn();
    const actions: BulkAction<Row>[] = [
      { key: "export", label: "Export", run, group: "a" },
      { key: "assign", label: "Assign To", run: () => {}, group: "a", hidden: (c) => c.keys.length > 2 },
      { key: "edit", label: "Edit", run: () => {}, group: "a", disabled: (c) => (c.rows.some((r) => r.status === "Done") ? "Done rows can't be edited" : false) },
      { key: "delete", label: "Delete", icon: Trash2, tone: "destructive", group: "z", run: del, confirm: (c) => ({ title: `Delete ${c.keys.length}?` }) },
    ];
    renderList({ selectable: true, selectionMode: "header", bulkActions: actions });
    fireEvent.click(rowBox("Task 1")); // Done
    fireEvent.click(rowBox("Task 2")); // Open
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.replace(/ — .*/, ""))).toEqual(["Export", "Assign To", "Edit", "Delete"]);
    expect(within(menu).getByText("Edit").closest("[role=menuitem]")!.hasAttribute("data-disabled")).toBe(true);
    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    fireEvent.click(within(menu).getByText("Export"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toEqual(["r1", "r2"]);
    expect(run.mock.calls[0][1].map((r: Row) => r.id)).toEqual(["r1", "r2"]);
    // a third row hides Assign To
    fireEvent.click(rowBox("Task 3"));
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    const menu2 = await screen.findByRole("menu");
    expect(within(menu2).queryByText("Assign To")).toBeNull();
    fireEvent.click(within(menu2).getByText("Delete"));
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg.textContent).toContain("Delete 3?");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    expect(del.mock.calls[0][0]).toEqual(["r1", "r2", "r3"]);
  });

  it("select-all checks the rows on screen; shift-click checks the range (list_view.js:1400-1421)", () => {
    renderList({ selectable: true, selectionMode: "header", bulkActions: [{ key: "x", label: "X", run: () => {} }] });
    fireEvent.click(rowBox("Task 2"));
    fireEvent.click(rowBox("Task 5").closest("td")!, { shiftKey: true });
    // the td handler adds the rows between; the checkbox click itself toggles Task 5
    fireEvent.click(rowBox("Task 5"));
    expect(["Task 2", "Task 3", "Task 4", "Task 5"].every((t) => (rowBox(t) as HTMLButtonElement).getAttribute("data-state") === "checked")).toBe(true);
    expect(rowBox("Task 1").getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(within(document.querySelector("thead")!).getByRole("checkbox"));
    expect(headerTexts().join(" ")).toContain("6 items selected");
  });

  it("Arabic: '{n} عنصر محدد' and 'الإجراءات'", () => {
    renderList({ selectable: true, selectionMode: "header", bulkActions: [{ key: "x", label: { en: "Export", ar: "تصدير" }, run: () => {} }] }, "ar");
    fireEvent.click(rowBox("Task 1"));
    expect(headerTexts().join(" ")).toContain("1 عنصر محدد");
    expect(screen.getByTestId("sf-list-actions").textContent).toContain("الإجراءات");
  });

  it("selectionMode='bar' (explicit opt-in, not Desk): the bar row appears, the header keeps its titles, the primary action stays", () => {
    renderList({ selectable: true, selectionMode: "bar", primaryAction: <button type="button">New</button>, bulkActions: [{ key: "x", label: "Export", run: () => {} }] });
    fireEvent.click(rowBox("Task 1"));
    expect(screen.getByRole("region").textContent).toContain("1 selected");
    expect(headerTexts()).toEqual(["Title", "Status"]);
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
  });
});

/**
 * P36 owner decision: Desk's header-actions selection is THE default (no `selectionMode` prop). Frappe 15.110
 * list_view.js:1613-1634 on_row_checked → :590-598 toggle_actions_menu_button; :1653-1656 clear_checked_items;
 * :1296-1306 Ctrl/⌘-click; :354-363 update_checkbox.
 */
describe("LV.F16 / LV.F17 Desk's header selection is the default", () => {
  const actions: BulkAction<Row>[] = [{ key: "x", label: "Export", run: () => {} }];
  const primary = <button type="button">New</button>;
  const thead = () => document.querySelector("thead")!;

  it("LV.F16 default (no selectionMode): no bar; '{n} items selected' in the header; the primary action ↔ Actions in the same place", () => {
    renderList({ selectable: true, primaryAction: primary, bulkActions: actions });
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    fireEvent.click(rowBox("Task 3"));
    expect(screen.queryByRole("region")).toBeNull();
    expect(thead().textContent).toContain("1 items selected");
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    // the Actions trigger takes the primary action's slot: the last control of the toolbar group
    const trigger = screen.getByTestId("sf-list-actions");
    expect(trigger.parentElement!.lastElementChild).toBe(trigger);
  });

  it("LV.F16 clearing the selection restores the primary action — Clear in the header, unchecking the last row, or select-all off", () => {
    renderList({ selectable: true, primaryAction: primary, bulkActions: actions });
    fireEvent.click(rowBox("Task 1")); fireEvent.click(rowBox("Task 2"));
    fireEvent.click(within(thead()).getByRole("button", { name: /Clear selection/ }));
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    expect(headerTexts()).toEqual(["Title", "Status"]);
    fireEvent.click(rowBox("Task 1"));
    fireEvent.click(rowBox("Task 1"));
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    fireEvent.click(within(thead()).getByRole("checkbox", { name: "Select all" }));
    expect(thead().textContent).toContain("6 items selected");
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    fireEvent.click(within(thead()).getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
  });

  it("LV.F17 empty selection: the primary action, never an Actions trigger; with rows selected and nothing to offer, Actions still replaces it and says so", async () => {
    renderList({ selectable: true, primaryAction: primary, bulkActions: [{ key: "x", label: "Export", run: () => {}, hidden: () => true }] });
    expect(screen.queryByTestId("sf-list-actions")).toBeNull();
    fireEvent.click(rowBox("Task 1"));
    // Desk swaps on the selection alone (toggle_actions_menu_button(checked > 0)), not on the menu's contents
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    const item = await screen.findByRole("menuitem");
    expect(item.textContent).toBe("No actions available for the selection");
    expect(item.hasAttribute("data-disabled")).toBe(true);
  });

  it("LV.F17 the select-all box: checked only when every row is; a partial selection is 'mixed' and a click selects every row (Desk: check-all checks all)", () => {
    renderList({ selectable: true, bulkActions: actions });
    const all = () => within(thead()).getByRole("checkbox", { name: "Select all" });
    expect(all().getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(rowBox("Task 2"));
    expect(all().getAttribute("data-state")).toBe("indeterminate");
    fireEvent.click(all());
    expect(all().getAttribute("data-state")).toBe("checked");
    expect(thead().textContent).toContain("6 items selected");
    fireEvent.click(rowBox("Task 2"));
    expect(all().getAttribute("data-state")).toBe("indeterminate");
  });

  it("LV.F16 Ctrl/⌘-click on a row ticks it instead of opening it (list_view.js:1296-1306); a plain click opens", () => {
    const onRowClick = vi.fn();
    renderList({ selectable: true, onRowClick, primaryAction: primary, bulkActions: actions });
    const row = screen.getByText("Task 4").closest("tr")!;
    fireEvent.click(row, { ctrlKey: true });
    expect(onRowClick).not.toHaveBeenCalled();
    expect(rowBox("Task 4").getAttribute("data-state")).toBe("checked");
    expect(screen.getByTestId("sf-list-actions")).toBeTruthy();
    fireEvent.click(row, { metaKey: true });
    expect(rowBox("Task 4").getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("LV.F16 Escape closes the Actions menu and keeps the selection; a dismissed confirmation keeps it; a custom action keeps it unless it clears", async () => {
    const run = vi.fn();
    const del = vi.fn();
    const custom: BulkAction<Row>[] = [
      { key: "x", label: "Export", run },
      { key: "delete", label: "Delete", tone: "destructive", run: del, confirm: { title: "Delete?" } },
    ];
    renderList({ selectable: true, primaryAction: primary, bulkActions: custom });
    fireEvent.click(rowBox("Task 1")); fireEvent.click(rowBox("Task 2"));
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(thead().textContent).toContain("2 items selected");
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(del).not.toHaveBeenCalled();
    expect(thead().textContent).toContain("2 items selected");
    fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    // Desk leaves the checks to the action (a custom action calls listview.clear_checked_items() itself)
    expect(thead().textContent).toContain("2 items selected");
  });

  it("LV.F16 renderBulkActions content sits in the toolbar next to Actions (header mode), and gets `clear`", () => {
    renderList({ selectable: true, primaryAction: primary, bulkActions: actions, renderBulkActions: ({ keys, clear }) => <button type="button" onClick={clear}>Done with {keys.length}</button> });
    expect(screen.queryByRole("button", { name: /Done with/ })).toBeNull();
    fireEvent.click(rowBox("Task 5"));
    fireEvent.click(screen.getByRole("button", { name: "Done with 1" }));
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
  });
});

describe("onSelectionChange reports every change of the selected set", () => {
  it("uncheck A, check B (same size) → the host learns [B] (0.4.0 reported nothing: it acted on A)", () => {
    const seen: string[][] = [];
    renderList({ selectable: true, onSelectionChange: (k) => seen.push(k) });
    fireEvent.click(rowBox("Task 1"));
    act(() => { fireEvent.click(rowBox("Task 1")); fireEvent.click(rowBox("Task 2")); });
    expect(seen.at(-1)).toEqual(["r2"]);
  });
});

describe("AssignDialog (Core)", () => {
  const USERS: UserOption[] = [{ id: "ann", label: "Ann Xu" }, { id: "bob", label: "Bob Yo" }];
  function mount(p: Partial<React.ComponentProps<typeof AssignDialog>> = {}, lang: "en" | "ar" = "en") {
    const onAssign = vi.fn(async () => {});
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
        <AssignDialog open onOpenChange={() => {}} searchUsers={async () => USERS} onAssign={onAssign} {...p} />
      </ThemeProvider>,
    );
    return onAssign;
  }
  it("several users + details (Desk's fields) → onAssign(users, {description, priority})", async () => {
    const onAssign = mount({ details: true, count: 3, me: { id: "me", label: "Me" } });
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("Assign To");
    expect(dlg.textContent).toContain("3 records selected");
    expect((within(dlg).getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await within(dlg).findByText("Ann Xu"));
    fireEvent.click(within(dlg).getByText("Bob Yo"));
    fireEvent.click(within(dlg).getByLabelText("Assign to me"));
    fireEvent.change(within(dlg).getByLabelText("Comment"), { target: { value: "please" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect((onAssign.mock.calls[0] as unknown[])[0]).toEqual([...USERS, { id: "me", label: "Me" }]);
    expect((onAssign.mock.calls[0] as unknown[])[1]).toEqual({ description: "please" });
  });
  it("single: one user (a second pick replaces the first), 'Assign to me' offered, the hint says it replaces; no detail fields unless asked; current assignees listed", async () => {
    const onAssign = mount({ single: true, me: { id: "me", label: "Me" }, existing: [{ id: "x", name: "Old Owner" }] });
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("replaces the current one");
    expect(within(dlg).queryByLabelText("Comment")).toBeNull();
    expect(within(dlg).queryByLabelText("Priority")).toBeNull();
    expect(within(dlg).getByTestId("sf-assign-existing").textContent).toContain("Old Owner");
    fireEvent.click(await within(dlg).findByText("Ann Xu"));
    fireEvent.click(within(dlg).getByLabelText("Assign to me"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect((onAssign.mock.calls[0] as unknown[])[0]).toEqual([{ id: "me", label: "Me" }]);
  });
  it("a rejected assignment keeps the dialog open with the error", async () => {
    const onOpenChange = vi.fn();
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <AssignDialog open onOpenChange={onOpenChange} searchUsers={async () => USERS} onAssign={async () => { throw new Error("Not permitted"); }} />
      </ThemeProvider>,
    );
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByText("Ann Xu"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    expect((await within(dlg).findByRole("alert")).textContent).toContain("Not permitted");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
