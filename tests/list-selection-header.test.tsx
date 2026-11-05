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

  it("default 'bar' is unchanged: the bar row appears, the header keeps its titles, the primary action stays", () => {
    renderList({ selectable: true, primaryAction: <button type="button">New</button>, bulkActions: [{ key: "x", label: "Export", run: () => {} }] });
    fireEvent.click(rowBox("Task 1"));
    expect(screen.getByRole("region").textContent).toContain("1 selected");
    expect(headerTexts()).toEqual(["Title", "Status"]);
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
