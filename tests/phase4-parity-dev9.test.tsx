/**
 * 0.8.0-dev.9 — Phase 4 (CRM parity proposals, owner-approved): the Core components and behaviours of gaps L-01
 * (BulkEditDialog), L-03 (BulkTagsDialog), L-02 (BulkAction.preflight), L-07 (import file hint from `accept`), M-07
 * (RecordMenu bindShortcuts), AS-06 (RecordRailAssignment team change). SIMULATED: jsdom, no server.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  BulkEditDialog, BulkTagsDialog, DataImportDialog, ListActionsMenu, RecordMenu, RecordRailAssignment, ThemeProvider, bulkEditTypedValue, countTags,
  type BulkAction, type BulkEditField, type DataImportAdapter, type RecordMenuItem,
} from "../src";
import { defaultMessages } from "../src/theme/messages";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = defaultMessages.en;
const ar = defaultMessages.ar;
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const pick = async (combobox: HTMLElement, option: string | RegExp) => {
  fireEvent.keyDown(combobox, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
  await act(() => Promise.resolve());
};

/* ── L-01 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

const FIELDS: BulkEditField[] = [
  { key: "priority", label: { en: "Priority", ar: "الأولوية" }, type: "select", options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }] },
  { key: "amount", label: "Amount", type: "currency" },
  { key: "done", label: "Done", type: "check" },
  { key: "note", label: "Note", type: "long-text" },
];
function editHarness(p: Partial<React.ComponentProps<typeof BulkEditDialog>> = {}, lang: "en" | "ar" = "en") {
  const onApply = vi.fn<(v: Record<string, unknown>) => void | Promise<void>>();
  const onOpenChange = vi.fn();
  wrap(<BulkEditDialog open count={2} fields={FIELDS} onApply={onApply} onOpenChange={onOpenChange} {...p} />, lang);
  return { onApply: (p.onApply as typeof onApply | undefined) ?? onApply, onOpenChange };
}
const applyBtn = (n = 2) => screen.getByRole("button", { name: en.bkeApply.replace("{n}", String(n)) });

describe("L-01 BulkEditDialog (Core)", () => {
  it("L-01.1 typed values: int / float / currency → number, check → boolean, empty → null, text as typed", () => {
    expect(bulkEditTypedValue("777", "currency")).toBe(777);
    expect(bulkEditTypedValue("2.5", "float")).toBe(2.5);
    expect(bulkEditTypedValue("3.9", "int")).toBe(3);
    expect(bulkEditTypedValue("1", "check")).toBe(true);
    expect(bulkEditTypedValue("0", "check")).toBe(false);
    expect(bulkEditTypedValue("", "text")).toBeNull();
    expect(bulkEditTypedValue("", "check")).toBeNull();
    expect(bulkEditTypedValue("2026-11-14", "date")).toBe("2026-11-14");
    expect(bulkEditTypedValue("abc", "int")).toBe("abc");
  });

  it("L-01.2 Apply is disabled until a row has a field; a Select value is applied by key; the dialog closes", async () => {
    const { onApply, onOpenChange } = editHarness();
    expect(screen.getByRole("heading", { name: en.bkeTitle.replace("{n}", "2") })).toBeTruthy();
    expect(applyBtn().hasAttribute("disabled")).toBe(true);
    await pick(screen.getByRole("combobox", { name: en.bkeField }), "Priority");
    expect(applyBtn().hasAttribute("disabled")).toBe(false);
    await pick(screen.getByRole("combobox", { name: en.bkeValue }), "Low");
    fireEvent.click(applyBtn());
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ priority: "low" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("L-01.3 several rows: each field can be chosen once; Add field stops at the number of fields; numbers, checks and empty values are typed", async () => {
    const { onApply } = editHarness();
    await pick(screen.getByRole("combobox", { name: en.bkeField }), "Amount");
    fireEvent.change(screen.getByRole("textbox", { name: en.bkeValue }), { target: { value: "777" } });
    fireEvent.blur(screen.getByRole("textbox", { name: en.bkeValue }));
    fireEvent.click(screen.getByRole("button", { name: en.bkeAddRow }));
    // row 2's field list leaves out Amount
    fireEvent.keyDown(screen.getByRole("combobox", { name: `${en.bkeField} 2` }), { key: "Enter" });
    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toEqual(["Priority", "Done", "Note"]);
    fireEvent.click(screen.getByRole("option", { name: "Done" }));
    await act(() => Promise.resolve());
    await pick(screen.getByRole("combobox", { name: `${en.bkeValue} 2` }), en.yes);
    fireEvent.click(screen.getByRole("button", { name: en.bkeAddRow }));
    await pick(screen.getByRole("combobox", { name: `${en.bkeField} 3` }), "Note"); // left empty → null
    fireEvent.click(screen.getByRole("button", { name: en.bkeAddRow }));
    expect(screen.getByRole("button", { name: en.bkeAddRow }).hasAttribute("disabled")).toBe(true); // 4 rows = 4 fields
    expect(screen.getAllByText(en.bkeEmptyClears).length).toBeGreaterThan(0);
    fireEvent.click(applyBtn());
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0]![0]).toEqual({ amount: 777, done: true, note: null }); // the 4th row has no field: left out
  });

  it("L-01.4 multiple={false}: Desk's single Field + Value (no Add field, no remove)", async () => {
    const { onApply } = editHarness({ multiple: false });
    expect(screen.queryByRole("button", { name: en.bkeAddRow })).toBeNull();
    expect(screen.queryByRole("button", { name: en.bkeRemoveRow })).toBeNull();
    await pick(screen.getByRole("combobox", { name: en.bkeField }), "Done");
    await pick(screen.getByRole("combobox", { name: en.bkeValue }), en.no);
    fireEvent.click(applyBtn());
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ done: false }));
  });

  it("L-01.5 a rejected onApply is shown and the dialog stays open; labels override (Localized, {n})", async () => {
    const onApply = vi.fn(async () => { throw new Error("Server said no"); });
    const onOpenChange = vi.fn();
    wrap(<BulkEditDialog open count={3} fields={FIELDS} onApply={onApply} onOpenChange={onOpenChange}
      labels={{ title: { en: "Edit {n} items", ar: "x" }, apply: "Set on {n}" }} />);
    expect(screen.getByRole("heading", { name: "Edit 3 items" })).toBeTruthy();
    await pick(screen.getByRole("combobox", { name: en.bkeField }), "Priority");
    fireEvent.click(screen.getByRole("button", { name: "Set on 3" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Server said no");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("L-01.6 Arabic: the catalogue's strings, Localized field labels", async () => {
    wrap(<BulkEditDialog open count={2} fields={FIELDS} onApply={() => {}} onOpenChange={() => {}} />, "ar");
    expect(screen.getByRole("heading", { name: ar.bkeTitle.replace("{n}", "2") })).toBeTruthy();
    await pick(screen.getByRole("combobox", { name: ar.bkeField }), "الأولوية");
    expect(screen.getByRole("button", { name: ar.bkeApply.replace("{n}", "2") }).hasAttribute("disabled")).toBe(false);
  });

  it("L-01.7 a link field's value searches through the field's `search` (LinkInput)", async () => {
    const search = vi.fn(async (q: string) => [{ value: "S-1", label: `Site ${q}` }]);
    wrap(<BulkEditDialog open count={2} fields={[{ key: "site", label: "Site", type: "link", search }]} onApply={() => {}} onOpenChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: en.bkeField }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Site" }));
    await act(() => Promise.resolve());
    const box = screen.getByRole("combobox", { name: en.bkeValue });
    fireEvent.focus(box);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    fireEvent.change(box, { target: { value: "no" } });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(search).toHaveBeenCalledWith("no");
  });
});

/* ── L-03 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("L-03 BulkTagsDialog (Core)", () => {
  it("L-03.1 countTags: tags of the selection with record counts, sorted, one count per record", () => {
    expect(countTags([["b", "a", "a"], ["a"], null, []])).toEqual([{ tag: "a", count: 2 }, { tag: "b", count: 1 }]);
  });

  it("L-03.2 add: the package TagInput (typed tag + Enter, suggestions); Apply is disabled until a tag is chosen", async () => {
    const onApply = vi.fn();
    wrap(<BulkTagsDialog open mode="add" count={2} suggestions={["warranty", "urgent"]} onApply={onApply} onOpenChange={() => {}} />);
    expect(screen.getByRole("heading", { name: en.btgAddTitle })).toBeTruthy();
    expect(screen.getByText(en.btgDescription.replace("{n}", "2"))).toBeTruthy();
    const apply = () => screen.getByRole("button", { name: en.btgApply });
    expect(apply().hasAttribute("disabled")).toBe(true);
    const box = screen.getByRole("combobox", { name: en.btgAddLabel });
    fireEvent.change(box, { target: { value: "war" } });
    fireEvent.click(await screen.findByRole("option", { name: /warranty/ }));
    fireEvent.change(box, { target: { value: "audit-tag" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(apply().hasAttribute("disabled")).toBe(false));
    fireEvent.click(apply());
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(["warranty", "audit-tag"]));
  });

  it("L-03.3 remove: the selection's tags as 'tag · n' checkboxes; the checked ones are applied", async () => {
    const onApply = vi.fn();
    wrap(<BulkTagsDialog open mode="remove" count={3} existing={[{ tag: "audit-tag", count: 1 }, { tag: "warranty", count: 3 }]} onApply={onApply} onOpenChange={() => {}} />);
    expect(screen.getByRole("heading", { name: en.btgRemoveTitle })).toBeTruthy();
    const chip = document.querySelector('[data-tag="audit-tag"]') as HTMLElement;
    expect(chip.textContent).toBe("audit-tag· 1");
    expect(document.querySelector('[data-tag="warranty"]')!.textContent).toBe("warranty· 3");
    expect(screen.getByRole("button", { name: en.btgApply }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(chip).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: en.btgApply }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(["audit-tag"]));
  });

  it("L-03.4 remove with no tags in the selection: says so, Apply disabled with that reason", () => {
    wrap(<BulkTagsDialog open mode="remove" count={2} existing={[]} onApply={() => {}} onOpenChange={() => {}} />, "ar");
    expect(screen.getByText(ar.btgNone)).toBeTruthy();
    const apply = screen.getByRole("button", { name: ar.btgApply });
    expect(apply.hasAttribute("disabled")).toBe(true);
    expect(apply.getAttribute("title")).toBe(ar.btgNone);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

/* ── L-02 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

type Row = { id: string; status: string };
const ROWS: Row[] = [{ id: "A", status: "Open" }, { id: "B", status: "Completed" }, { id: "C", status: "Open" }];
function menu(action: BulkAction<Row>, keys = ["A", "B", "C"]) {
  const rows = ROWS.filter((r) => keys.includes(r.id));
  wrap(<ListActionsMenu<Row> actions={[action]} ctx={{ keys, rows, clear: () => {} }} />);
  fireEvent.keyDown(screen.getByTestId("sf-list-actions"), { key: "Enter" });
}
const closed = (ctx: { rows: Row[] }) => ({ blocked: ctx.rows.filter((r) => r.status === "Completed").map((r) => ({ key: r.id, reason: { en: "Closed records are read-only", ar: "مغلق" } })) });

describe("L-02 BulkAction.preflight (Core runner)", () => {
  it("L-02.1 lists the blocked records with reasons, the button counts what will run, run gets only the allowed keys / rows, onSkipped the blocked", async () => {
    const run = vi.fn(); const onSkipped = vi.fn();
    menu({ key: "delete", label: "Delete", tone: "destructive", run, preflight: closed, onSkipped, rowKey: (r) => r.id, confirm: { title: "Delete records?" } });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText(en.bpfWillRun.replace("{k}", "2").replace("{n}", "3"))).toBeTruthy();
    expect(dlg.querySelector('[data-bulk-blocked] li[data-key="B"]')!.textContent).toBe("B — Closed records are read-only");
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete 2" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0]).toEqual([["A", "C"], [ROWS[0], ROWS[2]]]);
    await waitFor(() => expect(onSkipped).toHaveBeenCalledWith(["B"]));
  });

  it("L-02.2 nothing allowed: only Close is offered and nothing runs", async () => {
    const run = vi.fn(); const onSkipped = vi.fn();
    menu({ key: "delete", label: "Delete", run, preflight: closed, onSkipped }, ["B"]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText(en.bpfNoneAllowed)).toBeTruthy();
    expect(within(dlg).getAllByRole("button").map((b) => b.textContent)).toEqual([en.bpfClose]);
    fireEvent.click(within(dlg).getByRole("button", { name: en.bpfClose }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(run).not.toHaveBeenCalled();
    expect(onSkipped).not.toHaveBeenCalled();
  });

  it("L-02.3 nothing blocked → the action runs as before (no dialog without confirm); a {k} confirm label is filled", async () => {
    const run = vi.fn();
    menu({ key: "delete", label: "Delete", run, preflight: () => ({ blocked: [] }) }, ["A", "C"]);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(["A", "C"], [ROWS[0], ROWS[2]]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    cleanup();
    const run2 = vi.fn();
    menu({ key: "close", label: "Close out", run: run2, preflight: closed, confirm: { title: "Close?", confirmLabel: "Close {k} now" } });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Close out/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Close 2 now" }));
    await waitFor(() => expect(run2).toHaveBeenCalledWith(["A", "C"], ROWS)); // no rowKey: rows as loaded
  });

  it("L-02.4 without preflight the runner is unchanged: confirm, then run(keys, rows) with exactly the selection", async () => {
    const run = vi.fn();
    menu({ key: "delete", label: "Delete", run, confirm: { title: "Sure?", confirmLabel: "Yes" } });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg.querySelector("[data-bulk-preflight]")).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(["A", "B", "C"], ROWS));
    expect(run.mock.calls[0]).toHaveLength(2);
  });
});

/* ── L-07 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

const adapter = (accept?: string): DataImportAdapter => ({ fields: [{ key: "name", label: "Name", mandatory: true }], parse: async () => ({ headers: [], rows: [] }), ...(accept ? { accept } : {}) });
const hint = () => document.querySelector("[data-import-file-hint]")!.textContent;

describe("L-07 DataImportDialog file hint from accept", () => {
  it("L-07.1 accept '.csv' → 'CSV' (no XLS / XLSX promised); '.csv,.xlsx' → 'CSV or XLSX'; the picker accepts the same", () => {
    wrap(<DataImportDialog adapter={adapter(".csv")} />);
    expect(hint()).toBe("CSV");
    expect(hint()).not.toMatch(/XLS/);
    expect(document.querySelector("input[type=file]")!.getAttribute("accept")).toBe(".csv");
    cleanup();
    wrap(<DataImportDialog adapter={adapter(".csv,.xlsx")} />);
    expect(hint()).toBe("CSV or XLSX");
  });

  it("L-07.2 the default accept keeps today's hint (en / ar); Arabic joins with أو; an explicit labels.fileHint wins", () => {
    wrap(<DataImportDialog adapter={adapter()} />);
    expect(hint()).toBe("CSV, XLS or XLSX");
    cleanup();
    wrap(<DataImportDialog adapter={adapter()} />, "ar");
    expect(hint()).toBe("CSV أو XLS أو XLSX");
    cleanup();
    wrap(<DataImportDialog adapter={adapter(".csv,.xlsx")} />, "ar");
    expect(hint()).toBe("CSV أو XLSX");
    cleanup();
    wrap(<DataImportDialog adapter={adapter(".csv,.xlsx")} labels={{ fileHint: "Spreadsheet" }} />);
    expect(hint()).toBe("Spreadsheet");
  });
});

/* ── M-07 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

function menuItems(spy: Record<string, ReturnType<typeof vi.fn>>, extra: Partial<Record<string, Partial<RecordMenuItem>>> = {}): RecordMenuItem[] {
  const it = (id: string, shortcut: string, more: Partial<RecordMenuItem> = {}): RecordMenuItem => ({ id, label: id, shortcut, onSelect: spy[id] = vi.fn(), ...more, ...extra[id] });
  return [
    it("duplicate", "Shift+D"), it("delete", "Shift+Ctrl+D", { confirm: { title: "Delete?", confirmLabel: "Delete it" } }), it("bold", "Ctrl+B"),
    it("reload", "Shift+R"), it("undo", "Ctrl+Z"),
  ];
}
const key = (init: KeyboardEventInit, target: EventTarget = document.body) => act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); });

describe("M-07 RecordMenu bindShortcuts", () => {
  it("M-07.1 each declared shortcut runs its item; modifiers must match exactly; Ctrl also matches ⌘; a non-Latin layout matches by physical key", async () => {
    const spy: Record<string, ReturnType<typeof vi.fn>> = {};
    wrap(<RecordMenu bindShortcuts items={menuItems(spy)} />);
    await key({ key: "D", code: "KeyD", shiftKey: true });
    expect(spy.duplicate).toHaveBeenCalledTimes(1);
    await key({ key: "b", code: "KeyB", ctrlKey: true });
    await key({ key: "b", code: "KeyB", metaKey: true });
    expect(spy.bold).toHaveBeenCalledTimes(2);
    await key({ key: "R", code: "KeyR", shiftKey: true });
    await key({ key: "z", code: "KeyZ", ctrlKey: true });
    expect(spy.reload).toHaveBeenCalledTimes(1);
    expect(spy.undo).toHaveBeenCalledTimes(1);
    await key({ key: "b", code: "KeyB" }); // no modifier
    await key({ key: "B", code: "KeyB", ctrlKey: true, shiftKey: true }); // extra Shift
    expect(spy.bold).toHaveBeenCalledTimes(2);
    await key({ key: "ي", code: "KeyD", shiftKey: true }); // Arabic layout, same physical key
    expect(spy.duplicate).toHaveBeenCalledTimes(2);
  });

  it("M-07.2 the key goes through the same confirm as a click: Shift+Ctrl+D asks, runs only on confirm; Shift+D does not fire on Shift+Ctrl+D", async () => {
    const spy: Record<string, ReturnType<typeof vi.fn>> = {};
    wrap(<RecordMenu bindShortcuts items={menuItems(spy)} />);
    await key({ key: "D", code: "KeyD", shiftKey: true, ctrlKey: true });
    expect(spy.duplicate).not.toHaveBeenCalled();
    expect(spy.delete).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Delete it" }));
    await waitFor(() => expect(spy.delete).toHaveBeenCalledTimes(1));
  });

  it("M-07.3 nothing runs while typing in an input, a textarea or a contenteditable", async () => {
    const spy: Record<string, ReturnType<typeof vi.fn>> = {};
    wrap(<><RecordMenu bindShortcuts items={menuItems(spy)} /><input aria-label="i" /><textarea aria-label="t" /><div contentEditable suppressContentEditableWarning data-testid="ce"><p data-testid="cep">x</p></div></>);
    for (const el of [screen.getByLabelText("i"), screen.getByLabelText("t"), screen.getByTestId("ce"), screen.getByTestId("cep")]) {
      await key({ key: "D", code: "KeyD", shiftKey: true }, el);
      await key({ key: "b", code: "KeyB", ctrlKey: true }, el);
    }
    expect(spy.duplicate).not.toHaveBeenCalled();
    expect(spy.bold).not.toHaveBeenCalled();
  });

  it("M-07.4 hidden and disabled items do not run; a disabled or busy menu binds nothing", async () => {
    const spy: Record<string, ReturnType<typeof vi.fn>> = {};
    const { rerender } = wrap(<RecordMenu bindShortcuts items={menuItems(spy, { duplicate: { hidden: true }, bold: { disabled: true, disabledReason: "no" } })} />);
    await key({ key: "D", code: "KeyD", shiftKey: true });
    await key({ key: "b", code: "KeyB", ctrlKey: true });
    expect(spy.duplicate).not.toHaveBeenCalled();
    expect(spy.bold).not.toHaveBeenCalled();
    const spy2: Record<string, ReturnType<typeof vi.fn>> = {};
    rerender(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><RecordMenu bindShortcuts disabled items={menuItems(spy2)} /></ThemeProvider>);
    await key({ key: "R", code: "KeyR", shiftKey: true });
    expect(spy2.reload).not.toHaveBeenCalled();
  });

  it("M-07.5 off by default (hints only); the listener is removed on unmount", async () => {
    const spy: Record<string, ReturnType<typeof vi.fn>> = {};
    const a = wrap(<RecordMenu items={menuItems(spy)} />);
    await key({ key: "D", code: "KeyD", shiftKey: true });
    expect(spy.duplicate).not.toHaveBeenCalled();
    a.unmount();
    const spy2: Record<string, ReturnType<typeof vi.fn>> = {};
    const add = vi.spyOn(document, "addEventListener"); const remove = vi.spyOn(document, "removeEventListener");
    const b = wrap(<RecordMenu bindShortcuts items={menuItems(spy2)} />);
    const handler = add.mock.calls.find((c) => c[0] === "keydown")![1];
    b.unmount();
    expect(remove.mock.calls.some((c) => c[0] === "keydown" && c[1] === handler)).toBe(true);
    await key({ key: "D", code: "KeyD", shiftKey: true });
    expect(spy2.duplicate).not.toHaveBeenCalled();
  });
});

/* ── AS-06 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

const TEAMS = [{ value: "hvac", label: "HVAC" }, { value: "electrical", label: "Electrical" }];
describe("AS-06 RecordRailAssignment team change", () => {
  it("AS-06.1 without onChange the team row is the static row, markup unchanged (no control)", () => {
    const { container, rerender } = wrap(<RecordRailAssignment team={{ label: "Team", value: "HVAC" }}><p>a</p></RecordRailAssignment>);
    const html = container.querySelector("[data-record-rail-assignment]")!.innerHTML;
    expect(html).toContain('<span class="text-foreground font-medium truncate max-w-[55%] text-end">HVAC</span></div>');
    expect(container.querySelector("[data-record-rail-team-change]")).toBeNull();
    rerender(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><RecordRailAssignment team={{ label: "Team", value: "HVAC", options: TEAMS }}><p>a</p></RecordRailAssignment></ThemeProvider>);
    expect(container.querySelector("[data-record-rail-assignment]")!.innerHTML).toBe(html);
  });

  it("AS-06.2 with onChange + options: a focusable 'Change team' button opens the options (current checked); picking one calls onChange", async () => {
    const onChange = vi.fn();
    wrap(<RecordRailAssignment team={{ label: "Team", value: "HVAC", options: TEAMS, onChange }}><p>a</p></RecordRailAssignment>);
    const btn = screen.getByRole("button", { name: en.rrChangeTeam });
    expect(btn.tabIndex).not.toBe(-1);
    fireEvent.keyDown(btn, { key: "Enter" });
    const current = await screen.findByRole("menuitemradio", { name: "HVAC" });
    expect(current.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Electrical" }));
    expect(onChange).toHaveBeenCalledWith("electrical");
  });

  it("AS-06.3 the control's name: changeLabel (Localized) or the catalogue (Arabic)", () => {
    wrap(<RecordRailAssignment team={{ label: "الفريق", value: "HVAC", options: TEAMS, onChange: () => {} }}><p>a</p></RecordRailAssignment>, "ar");
    expect(screen.getByRole("button", { name: ar.rrChangeTeam })).toBeTruthy();
    cleanup();
    wrap(<RecordRailAssignment team={{ label: "Team", value: "HVAC", options: TEAMS, onChange: () => {}, changeLabel: { en: "Reassign team", ar: "x" } }}><p>a</p></RecordRailAssignment>);
    expect(screen.getByRole("button", { name: "Reassign team" })).toBeTruthy();
  });
});
