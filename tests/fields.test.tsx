/**
 * Generic field controls (src/fields) — Frappe-free, value in / value out. Behaviour pinned to docs `12` (Frappe
 * 15.110) where the control reproduces Desk; generic UX elsewhere. No network.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src";
import {
  ColorInput, DataGrid, DurationInput, LinkInput, NumberInput, Rating, ReadOnlyValue, TagInput, TimeInput,
  evaluateArithmetic, formatDuration, formatLocaleNumber, formatTimeText, numberFormatInfo, parseLocaleNumber, parseTimeText,
  roundNumber, secondsToDuration, type DataGridColumn, type Suggestion,
} from "../src/fields";
import { defaultMessages } from "../src/theme/messages";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

// Minimal DOM matchers (the package has no jest-dom).
expect.extend({
  toBeInTheDocument(el: Element | null) {
    const pass = !!el && el.ownerDocument.contains(el);
    return { pass, message: () => `expected element ${pass ? "not " : ""}to be in the document` };
  },
  toHaveValue(el: HTMLInputElement, v: unknown) {
    return { pass: el.value === v, message: () => `expected value ${JSON.stringify(v)}, got ${JSON.stringify(el.value)}` };
  },
  toHaveAttribute(el: Element, name: string, v?: string) {
    const has = el.hasAttribute(name);
    const pass = v === undefined ? has : el.getAttribute(name) === v;
    return { pass, message: () => `expected ${name}=${JSON.stringify(v)}, got ${JSON.stringify(el.getAttribute(name))}` };
  },
  toHaveTextContent(el: Element, text: string) {
    return { pass: (el.textContent ?? "").includes(text), message: () => `expected text ${JSON.stringify(text)} in ${JSON.stringify(el.textContent)}` };
  },
});
declare module "vitest" {
  interface Assertion<T = any> { toBeInTheDocument(): T; toHaveValue(v: unknown): T; toHaveAttribute(name: string, v?: string): T; toHaveTextContent(t: string): T }
}


const wrap = (ui: React.ReactElement, lang: "en" | "ar" = "en") =>
  render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

/** A controlled harness: keeps the value, records every onChange. */
function Controlled<V>({ initial, render: r, log }: { initial: V; log?: V[]; render: (v: V, set: (v: V) => void) => React.ReactNode }) {
  const [v, setV] = React.useState(initial);
  return <>{r(v, (n) => { log?.push(n); setV(n); })}</>;
}

describe("number utilities (docs 12 §8)", () => {
  it("reads separators and precision from the System Settings patterns", () => {
    expect(numberFormatInfo("#,###.##")).toMatchObject({ decimal: ".", group: ",", precision: 2 });
    expect(numberFormatInfo("#.###,##")).toMatchObject({ decimal: ",", group: ".", precision: 2 });
    expect(numberFormatInfo("#,###.###").precision).toBe(3);
    expect(numberFormatInfo("#,###")).toMatchObject({ decimal: "", precision: 0 });
    expect(numberFormatInfo("#,##,###.##").indian).toBe(true);
    expect(numberFormatInfo("weird")).toMatchObject({ decimal: ".", group: "," });
  });
  it("parses locale text: group separators stripped, decimal converted, Arabic digits", () => {
    expect(parseLocaleNumber("1,234.5")).toBe(1234.5);
    expect(parseLocaleNumber("1.234,5", { format: "#.###,##" })).toBe(1234.5);
    expect(parseLocaleNumber("1 234,5", { format: "# ###,##" })).toBe(1234.5);
    expect(parseLocaleNumber("1'234.5", { format: "#'###.##" })).toBe(1234.5);
    expect(parseLocaleNumber("1.234", { format: "#.###" })).toBe(1234);
    expect(parseLocaleNumber("١٢٣٫٥")).toBe(123.5);
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
  });
  it("evaluates simple arithmetic without eval (Desk evaluates Int/Float expressions)", () => {
    expect(parseLocaleNumber("2*3+1")).toBe(7);
    expect(parseLocaleNumber("(1+2)*3")).toBe(9);
    expect(parseLocaleNumber("10/4")).toBe(2.5);
    expect(parseLocaleNumber("-3")).toBe(-3);
    expect(evaluateArithmetic("alert(1)")).toBeNaN();
    expect(evaluateArithmetic("1+")).toBeNaN();
    expect(parseLocaleNumber("2*3", { allowExpressions: false })).toBeNull();
  });
  it("rounds with the three System Settings methods", () => {
    expect(roundNumber(2.5, 0, "Banker's Rounding")).toBe(2);
    expect(roundNumber(3.5, 0, "Banker's Rounding")).toBe(4);
    expect(roundNumber(2.5, 0, "Commercial Rounding")).toBe(3);
    expect(roundNumber(-2.5, 0, "Commercial Rounding")).toBe(-3);
    expect(roundNumber(1.005, 2, "Commercial Rounding")).toBe(1.01);
    expect(roundNumber(1.2345, null)).toBe(1.2345);
  });
  it("formats with grouping (Indian 3 then 2) and precision", () => {
    expect(formatLocaleNumber(1234567.891, { precision: 2 })).toBe("1,234,567.89");
    expect(formatLocaleNumber(1234567.5, { format: "#.###,##", precision: 2 })).toBe("1.234.567,50");
    expect(formatLocaleNumber(12345678, { format: "#,##,###.##", precision: 0 })).toBe("1,23,45,678");
    expect(formatLocaleNumber(-1500, { precision: 0 })).toBe("-1,500");
    expect(formatLocaleNumber(1.5)).toBe("1.5");
    expect(formatLocaleNumber(null)).toBe("");
  });
});

describe("NumberInput", () => {
  it("writes on blur, not per keystroke; Int truncates; Float rounds to precision", () => {
    const log: (number | null)[] = [];
    wrap(<Controlled<number | null> initial={null} log={log} render={(v, set) => <NumberInput aria-label="qty" kind="int" value={v} onChange={set} />} />);
    const box = screen.getByRole("textbox", { name: "qty" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "12.9" } });
    expect(log).toEqual([]);
    fireEvent.blur(box);
    expect(log).toEqual([12]);
    expect(box).toHaveValue("12");
    cleanup();
    const log2: (number | null)[] = [];
    wrap(<Controlled<number | null> initial={1} log={log2} render={(v, set) => <NumberInput aria-label="amt" precision={2} value={v} onChange={set} />} />);
    const amt = screen.getByRole("textbox", { name: "amt" });
    expect(amt).toHaveValue("1.00");
    fireEvent.focus(amt);
    fireEvent.change(amt, { target: { value: "1,234.567" } });
    fireEvent.keyDown(amt, { key: "Enter" });
    expect(log2).toEqual([1234.57]);
    fireEvent.blur(amt);
    expect(amt).toHaveValue("1,234.57");
  });
  it("evaluates arithmetic and uses the number format", () => {
    const log: (number | null)[] = [];
    wrap(<Controlled<number | null> initial={null} log={log} render={(v, set) => <NumberInput aria-label="n" numberFormat="#.###,##" precision={2} value={v} onChange={set} />} />);
    const box = screen.getByRole("textbox", { name: "n" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "1.000,5*2" } });
    fireEvent.blur(box);
    expect(log).toEqual([2001]);
    expect(box).toHaveValue("2.001,00");
  });
  it("keeps unparsable text flagged by default; clears it in Desk mode", () => {
    const onChange = vi.fn();
    wrap(<NumberInput aria-label="n" value={5} onChange={onChange} id="n1" />);
    const box = screen.getByRole("textbox", { name: "n" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "abc" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(defaultMessages.en.formInvalidNumber)).toBeInTheDocument();
    cleanup();
    const onChange2 = vi.fn();
    wrap(<NumberInput aria-label="n" value={5} onChange={onChange2} onUnparsable="clear" />);
    const b2 = screen.getByRole("textbox", { name: "n" });
    fireEvent.focus(b2);
    fireEvent.change(b2, { target: { value: "abc" } });
    fireEvent.blur(b2);
    expect(onChange2).toHaveBeenCalledWith(null);
  });
  it("empty text writes null; Escape reverts; out-of-range is flagged, never clamped", () => {
    const onChange = vi.fn();
    wrap(<NumberInput aria-label="n" value={5} onChange={onChange} min={10} />);
    const box = screen.getByRole("textbox", { name: "n" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "99" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).toHaveValue("5");
    fireEvent.change(box, { target: { value: "" } });
    fireEvent.blur(box);
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it("shows prefix / suffix adornments outside the text (Desk never puts the symbol in the input)", () => {
    wrap(<NumberInput aria-label="price" value={10} precision={2} onChange={() => {}} prefix="SAR" suffix="%" />);
    expect(screen.getByRole("textbox", { name: "price" })).toHaveValue("10.00");
    expect(screen.getByText("SAR")).toBeInTheDocument();
  });
});

describe("TimeInput and time helpers (docs 12 §7.4)", () => {
  it("parses leniently and emits HH:mm:ss", () => {
    expect(parseTimeText("9:30:00")).toEqual({ h: 9, m: 30, s: 0 });
    expect(parseTimeText("09:30:00.123456")).toEqual({ h: 9, m: 30, s: 0 });
    expect(parseTimeText("930")).toEqual({ h: 9, m: 30, s: 0 });
    expect(parseTimeText("9:30 pm")).toEqual({ h: 21, m: 30, s: 0 });
    expect(parseTimeText("12:00 am")).toEqual({ h: 0, m: 0, s: 0 });
    expect(parseTimeText("٩:٣٠ م")).toEqual({ h: 21, m: 30, s: 0 });
    expect(parseTimeText("25:00")).toBeNull();
    expect(parseTimeText("x")).toBeNull();
    expect(formatTimeText("21:05:09", { hour12: true })).toBe("9:05:09 PM");
    expect(formatTimeText("21:05:09", { hour12: true, language: "ar", withSeconds: false })).toBe("9:05 م");
  });
  it("commits a normalized value on blur and flags bad text", () => {
    const log: (string | null)[] = [];
    wrap(<Controlled<string | null> initial={null} log={log} render={(v, set) => <TimeInput aria-label="t" id="t" value={v} onChange={set} />} />);
    const box = screen.getByRole("textbox", { name: "t" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "9:5" } });
    fireEvent.blur(box);
    expect(log).toEqual(["09:05:00"]);
    expect(box).toHaveValue("09:05:00");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "nope" } });
    fireEvent.blur(box);
    expect(log).toEqual(["09:05:00"]);
    expect(box).toHaveAttribute("aria-invalid", "true");
  });
  it("Now sets the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 14, 7, 9));
    const onChange = vi.fn();
    wrap(<TimeInput aria-label="t" value={null} onChange={onChange} withSeconds={false} />);
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formNow }));
    expect(onChange).toHaveBeenCalledWith("14:07");
  });
});

describe("DurationInput and helpers (docs 12 §7.6)", () => {
  it("splits and formats seconds; hideDays folds days into hours", () => {
    expect(secondsToDuration(93784)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4 });
    expect(secondsToDuration(93784, { hideDays: true })).toEqual({ days: 0, hours: 26, minutes: 3, seconds: 4 });
    expect(formatDuration(93784)).toBe("1d 2h 3m 4s");
    expect(formatDuration(null)).toBe("0s");
    expect(formatDuration(3600, { units: { d: "ي", h: "س", m: "د", s: "ث" } })).toBe("1س");
  });
  it("edits through d/h/m/s boxes and writes seconds", () => {
    const log: (number | null)[] = [];
    wrap(<Controlled<number | null> initial={null} log={log} render={(v, set) => <DurationInput aria-label="d" value={v} onChange={set} hideSeconds />} />);
    expect(screen.queryByRole("textbox", { name: "Seconds" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Hours" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Minutes" }), { target: { value: "30" } });
    expect(log.at(-1)).toBe(9000);
    fireEvent.change(screen.getByRole("textbox", { name: "Minutes" }), { target: { value: "x" } });
    expect(log.at(-1)).toBe(9000);
  });
  it("labels the boxes in Arabic", () => {
    wrap(<DurationInput value={60} onChange={() => {}} />, "ar");
    expect(screen.getByRole("textbox", { name: defaultMessages.ar.formMinutes })).toHaveValue("1");
  });
});

describe("ReadOnlyValue, Rating, ColorInput", () => {
  it("ReadOnlyValue shows text, links and the empty text", () => {
    wrap(<><ReadOnlyValue value="Hello" /><ReadOnlyValue value="" emptyText="—" /><ReadOnlyValue value="T-1" href="/app/todo/T-1" /></>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "T-1" })).toHaveAttribute("href", "/app/todo/T-1");
  });
  it("Rating: click sets, clicking the current value clears unless required, keys follow RTL", () => {
    const onChange = vi.fn();
    const { rerender } = wrap(<Rating aria-label="r" value={3} onChange={onChange} allowHalf={false} />);
    const slider = screen.getByRole("slider", { name: "r" });
    expect(slider).toHaveAttribute("aria-valuenow", "3");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(4);
    const stars = slider.querySelectorAll("button");
    fireEvent.click(stars[2]);
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><Rating aria-label="r" value={3} required onChange={onChange} allowHalf={false} /></ThemeProvider>);
    onChange.mockClear();
    fireEvent.click(screen.getByRole("slider").querySelectorAll("button")[2]);
    expect(onChange).not.toHaveBeenCalled();
    cleanup();
    const onAr = vi.fn();
    wrap(<Rating aria-label="r" value={2} onChange={onAr} allowHalf={false} />, "ar");
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(onAr).toHaveBeenLastCalledWith(3);
  });
  it("ColorInput accepts #RRGGBB only (Desk), adds the missing #", () => {
    const onChange = vi.fn();
    wrap(<ColorInput aria-label="c" value={null} onChange={onChange} />);
    const box = screen.getByRole("textbox", { name: "c" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "ff0000" } });
    fireEvent.blur(box);
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "red" } });
    fireEvent.blur(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(box).toHaveAttribute("aria-invalid", "true");
  });
});

describe("LinkInput (docs 12 §4.2)", () => {
  const results: Suggestion[] = [
    { value: "CUST-0001", label: "Acme", description: "CUST-0001" },
    { value: "CUST-0002", description: "Beta Ltd" },
    { value: "CUST-0002", description: "Riyadh" },
  ];
  it("searches 500 ms after typing stops, merges duplicates, picks with Enter", async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => results);
    const onChange = vi.fn();
    wrap(<LinkInput aria-label="customer" value={null} onChange={onChange} search={search} />);
    const box = screen.getByRole("combobox", { name: "customer" });
    fireEvent.focus(box); // empty box: results at once
    await act(async () => {});
    expect(search).toHaveBeenCalledWith("");
    search.mockClear();
    fireEvent.change(box, { target: { value: "ac" } });
    act(() => { vi.advanceTimersByTime(499); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(search).toHaveBeenCalledWith("ac");
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(2);
    expect(opts[1]).toHaveTextContent("Beta Ltd, Riyadh");
    expect(opts[0]).toHaveAttribute("aria-selected", "true"); // first result highlighted
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("CUST-0001", results[0]);
  });
  it("hands hand-typed text to onCommitText on blur; clears with the × button", () => {
    const onCommitText = vi.fn();
    const onChange = vi.fn();
    wrap(<LinkInput aria-label="l" value="X" onChange={onChange} search={async () => []} onCommitText={onCommitText} debounceMs={0} />);
    const box = screen.getByRole("combobox", { name: "l" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "typed" } });
    fireEvent.blur(box);
    expect(onCommitText).toHaveBeenCalledWith("typed");
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formClear }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it("shows the title, an open link and action rows (create new)", async () => {
    const onCreate = vi.fn();
    wrap(<LinkInput aria-label="l" value="CUST-1" displayValue="Acme" href="/app/customer/CUST-1" onChange={() => {}} search={async () => []} debounceMs={0}
      actions={(typed) => [{ key: "new", label: `Create ${typed}`, onSelect: onCreate }]} />);
    const box = screen.getByRole("combobox", { name: "l" });
    expect(box).toHaveValue("Acme");
    expect(screen.getByRole("link", { name: "Open Acme" })).toHaveAttribute("href", "/app/customer/CUST-1");
    fireEvent.change(box, { target: { value: "Zed" } });
    await act(async () => {});
    fireEvent.click(await screen.findByRole("option", { name: "Create Zed" }));
    expect(onCreate).toHaveBeenCalledWith("Zed");
  });
});

describe("TagInput (docs 12 §11)", () => {
  it("adds from results, hides chosen values, removes with × and Backspace", async () => {
    const log: string[][] = [];
    const search = vi.fn(async () => [{ value: "a@x.com" }, { value: "b@x.com" }]);
    wrap(<Controlled<string[]> initial={["a@x.com"]} log={log} render={(v, set) => <TagInput aria-label="users" value={v} onChange={set} search={search} debounceMs={0} />} />);
    const box = screen.getByRole("combobox", { name: "users" });
    fireEvent.focus(box);
    await act(async () => {});
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["b@x.com"]);
    fireEvent.click(opts[0]);
    await act(async () => {});
    expect(log.at(-1)).toEqual(["a@x.com", "b@x.com"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove a@x.com" }));
    expect(log.at(-1)).toEqual(["b@x.com"]);
    fireEvent.keyDown(box, { key: "Backspace" });
    expect(log.at(-1)).toEqual([]);
  });
  it("free text: Enter / comma add, duplicates and failed validation dropped silently", async () => {
    const log: string[][] = [];
    const validate = vi.fn(async (v: string) => (v === "bad" ? null : v.toUpperCase()));
    wrap(<Controlled<string[]> initial={["A"]} log={log} render={(v, set) => <TagInput aria-label="tags" value={v} onChange={set} validate={validate} />} />);
    const box = screen.getByRole("combobox", { name: "tags" });
    fireEvent.change(box, { target: { value: "bad" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await act(async () => {});
    fireEvent.change(box, { target: { value: "a" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await act(async () => {});
    fireEvent.change(box, { target: { value: "c," } });
    await act(async () => {});
    expect(log).toEqual([["A", "C"]]);
  });
});

describe("DataGrid (docs 12 §5)", () => {
  type Row = { id: string; item: string; qty: number };
  const rowsOf = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, item: `Item ${i + 1}`, qty: i }));
  const columns: DataGridColumn<Row>[] = [
    { key: "item", label: "Item", width: 3, required: true, renderCell: (r) => r.item, renderEditor: (r) => <input aria-label={`edit ${r.id}`} defaultValue={r.item} />, isInvalid: (r) => !r.item },
    { key: "qty", label: "Qty", align: "end", renderCell: (r) => r.qty },
  ];
  function Harness({ initial, ...props }: { initial: Row[] } & Partial<React.ComponentProps<typeof DataGrid<Row>>>) {
    const [rows, setRows] = React.useState(initial);
    const n = React.useRef(initial.length);
    const fresh = (): Row => ({ id: `n${++n.current}`, item: "", qty: 0 });
    return (
      <DataGrid<Row>
        label="Items" rows={rows} getRowKey={(r) => r.id} columns={columns}
        onAddRow={() => setRows((r) => [...r, fresh()])}
        onInsertRow={(i) => setRows((r) => [...r.slice(0, i), fresh(), ...r.slice(i)])}
        onDuplicateRow={(i) => setRows((r) => [...r.slice(0, i + 1), { ...r[i], id: `d${++n.current}` }, ...r.slice(i + 1)])}
        onDeleteRows={(idx) => setRows((r) => r.filter((_, i) => !idx.includes(i)))}
        onMoveRow={(f, t) => setRows((r) => { const c = [...r]; const [x] = c.splice(f, 1); c.splice(t, 0, x); return c; })}
        {...props}
      />
    );
  }
  const items = () => [...document.querySelectorAll("tbody tr[data-row-key]")].map((tr) => tr.querySelectorAll("td")[2]?.textContent);
  it("adds, deletes the selection, numbers rows, marks required empty cells", () => {
    wrap(<Harness initial={rowsOf(2)} />);
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formAddRow }));
    expect(items()).toEqual(["Item 1", "Item 2", ""]);
    const third = document.querySelector('tr[data-row-key="n3"]')!;
    expect(third.querySelectorAll("td")[1]).toHaveTextContent("3");
    expect(third.querySelectorAll("td")[2].className).toMatch(/ring-destructive/);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(items()).toEqual(["Item 2"]);
  });
  it("edits one row inline at a time; Escape stops", () => {
    wrap(<Harness initial={rowsOf(2)} />);
    fireEvent.click(screen.getByText("Item 1"));
    expect(screen.getByRole("textbox", { name: "edit r1" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Item 2"));
    expect(screen.queryByRole("textbox", { name: "edit r1" })).toBeNull();
    const ed = screen.getByRole("textbox", { name: "edit r2" });
    fireEvent.keyDown(ed, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "edit r2" })).toBeNull();
  });
  it("Desk's keyboard shortcuts insert above / below and duplicate", () => {
    wrap(<Harness initial={rowsOf(2)} />);
    const row1 = document.querySelector('tr[data-row-key="r1"]')!;
    fireEvent.keyDown(row1, { key: "ArrowDown", ctrlKey: true });
    expect(items()).toEqual(["Item 1", "", "Item 2"]);
    fireEvent.keyDown(document.querySelector('tr[data-row-key="r2"]')!, { key: "ArrowUp", ctrlKey: true });
    expect(items()).toEqual(["Item 1", "", "", "Item 2"]);
    fireEvent.keyDown(document.querySelector('tr[data-row-key="r1"]')!, { key: "ArrowDown", shiftKey: true, altKey: true });
    expect(items()).toEqual(["Item 1", "Item 1", "", "", "Item 2"]);
  });
  it("pages above 50 rows and jumps to the last page after Add Row", () => {
    wrap(<Harness initial={rowsOf(51)} />);
    expect(document.querySelectorAll("tbody tr[data-row-key]")).toHaveLength(50);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formAddRow }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(items()).toEqual(["Item 51", ""]);
  });
  it("read-only / cannot add / cannot delete hide their controls", () => {
    wrap(<Harness initial={rowsOf(1)} editable={false} />);
    expect(screen.queryByRole("button", { name: defaultMessages.en.formAddRow })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Row 1 actions" })).toBeNull();
    cleanup();
    wrap(<Harness initial={rowsOf(1)} canAdd={false} canDelete={false} />);
    expect(screen.queryByRole("button", { name: defaultMessages.en.formAddRow })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Select row 1" })).toBeNull();
  });
  it("shows the empty text and Arabic chrome", () => {
    wrap(<Harness initial={[]} />, "ar");
    expect(screen.getByText(defaultMessages.ar.formNoRows)).toBeInTheDocument();
    expect(within(document.querySelector("thead")!).getByText(defaultMessages.ar.formRowNo)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: defaultMessages.ar.formAddRow })).toBeInTheDocument();
  });
});
