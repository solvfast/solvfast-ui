/**
 * P36c "linkinput" — owner decision 1: review LinkInput picker mode's remaining differences against native Frappe.
 *  - Space: a plain Space on a FILLED, closed picker with nothing typed opens the full list (Desk Select is a native
 *    <select>, select.js:2; Desk's Link opens its list on Space too, after inserting the space — awesomplete.js:70 →
 *    link.js:265 → awesomplete.js:166 / 333). Everywhere else Space types (list open, typing, empty box, modifiers,
 *    IME, default mode).
 *  - Arrows wrap at both ends, as Awesomplete's next() / previous() (awesomplete.js:234-245) — Desk's Link.
 *  - Ctrl+N / Ctrl+P / Ctrl+J / Ctrl+K are not taken (cmdk `vimBindings`, not Desk; Desk's Ctrl+P is Print, form.js:167).
 *  - Height: the box carries the DS field-height token (`sf-field-fill` + `h-9`) like Input / Select / DateField.
 * jsdom (no layout): real heights are measured with Playwright (see the workstream report). No network.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ThemeProvider } from "../src";
import { LinkInput, type LinkInputProps, type Suggestion } from "../src/fields";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const wrap = (ui: React.ReactElement, lang: "en" | "ar" = "en") =>
  render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

const OPTIONS: Suggestion[] = [
  { value: "__none__", label: "None" },
  { value: "lc_sales", label: "Sales pipeline" },
  { value: "lc_ent", label: "Enterprise deals" },
  { value: "lc_smb", label: "SMB fast track" },
];
const AR_OPTIONS: Suggestion[] = [
  { value: "__none__", label: "بدون" },
  { value: "lc_sales", label: "مسار المبيعات" },
  { value: "lc_ent", label: "صفقات المؤسسات" },
];
const searchOver = (opts: Suggestion[], spy?: (t: string) => void) => async (text: string) => {
  spy?.(text);
  const q = text.trim().toLowerCase();
  return opts.filter((o) => !q || (o.label ?? "").toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
};

/** A controlled picker like the CRM's CrmOptionLinkInput: the "none" row is shown by its label with value null. */
function Picker({ initial, log, opts = OPTIONS, spy, picker = true, ...rest }: {
  initial: string | null; log: Array<string | null>; opts?: Suggestion[]; spy?: (t: string) => void; picker?: boolean;
} & Partial<LinkInputProps>) {
  const [v, setV] = React.useState<string | null>(initial);
  const search = React.useMemo(() => searchOver(opts, spy), [opts, spy]);
  const isNone = v == null || v === "__none__";
  const shown = isNone ? opts[0].label : opts.find((o) => o.value === v)?.label ?? v;
  const pickerProps: Partial<LinkInputProps> = picker
    ? { displayValue: shown, selectedValue: isNone ? "__none__" : v, openOnClickWhenFilled: true, selectedIndicator: true, keepValueWhenEmptied: true }
    : { displayValue: isNone ? null : shown };
  return (
    <LinkInput
      aria-label="Linked Lifecycle"
      value={isNone ? null : v}
      search={search}
      debounceMs={0}
      onChange={(n) => { log.push(n); setV(n); }}
      {...pickerProps}
      {...rest}
    />
  );
}

const box = () => screen.getByRole("combobox", { name: "Linked Lifecycle" }) as HTMLInputElement;
const flush = () => act(async () => {});
const optionIds = () => screen.getAllByRole("option").map((o) => o.id);
const optionTexts = () => screen.getAllByRole("option").map((o) => o.textContent);
/** fireEvent returns false when a handler called preventDefault (the key was taken). */
const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(box(), { key, ...init });

describe("P36c LinkInput — Space / arrows / Ctrl+N/P / height reviewed against Desk", () => {
  it("P36C.linkinput.1 Space on a filled, closed picker opens the FULL list without inserting a space or changing the value", async () => {
    const log: Array<string | null> = [];
    const spy = vi.fn();
    wrap(<Picker initial="lc_ent" log={log} spy={spy} />);
    const input = box();
    fireEvent.focus(input);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    const notTaken = press(" ");
    await flush();
    expect(notTaken).toBe(false); // the Space was taken: no " " appended to "Enterprise deals"
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.value).toBe("Enterprise deals");
    expect(spy).toHaveBeenLastCalledWith(""); // the full list, not a search for "Enterprise deals "
    expect(optionTexts()).toEqual(["None", "Sales pipeline", "Enterprise deals", "SMB fast track"]);
    expect(log).toEqual([]);
    // the current value is marked; the highlight starts on the first row (autoFirst, link.js:215)
    expect(screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true").map((o) => o.textContent)).toEqual(["Enterprise deals"]);
    expect(input.getAttribute("aria-activedescendant")).toBe(optionIds()[0]);
    // the shown text is selected (like a click), so typing replaces it
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Enterprise deals".length]);
    // keyboard completes the pick: ArrowDown ×3 → "SMB fast track", Enter
    press("ArrowDown"); press("ArrowDown"); press("ArrowDown");
    press("Enter");
    await flush();
    expect(log).toEqual(["lc_smb"]);
    expect(input.value).toBe("SMB fast track");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    // Space again reopens; Escape closes and restores (nothing changed)
    press(" ");
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    press("Escape");
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toBe("SMB fast track");
    expect(log).toEqual(["lc_smb"]);
  });

  it("P36C.linkinput.2 once the list is open, or while typing, Space types into the search (multi-word search works)", async () => {
    const log: Array<string | null> = [];
    const spy = vi.fn();
    wrap(<Picker initial="lc_sales" log={log} spy={spy} />);
    const input = box();
    fireEvent.click(input); // open (text selected)
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(press(" ")).toBe(true); // open list: Space is not taken
    // typing "Enterprise" then Space then "d" — every key reaches the box
    fireEvent.change(input, { target: { value: "Enterprise" } });
    await flush();
    expect(press(" ")).toBe(true); // typing in progress: not taken
    fireEvent.change(input, { target: { value: "Enterprise d" } });
    await flush();
    expect(spy).toHaveBeenLastCalledWith("Enterprise d");
    expect(optionTexts()).toEqual(["Enterprise deals"]);
    expect(input.value).toBe("Enterprise d");
    press("Enter");
    await flush();
    expect(log).toEqual(["lc_ent"]);
  });

  it("P36C.linkinput.3 Space is left alone with a modifier, during IME composition, on an empty box, and when disabled / read-only", async () => {
    const log: Array<string | null> = [];
    const { unmount } = wrap(<Picker initial="lc_sales" log={log} />);
    let input = box();
    for (const init of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
      expect(press(" ", init)).toBe(true);
      await flush();
      expect(input.getAttribute("aria-expanded")).toBe("false");
    }
    unmount();
    // an empty box (no value, nothing shown): Space types as in any text box (focus already lists the rows, link.js:35-41)
    const empty = wrap(<LinkInput aria-label="Linked Lifecycle" value={null} search={searchOver(OPTIONS)} debounceMs={0} onChange={() => {}} openOnClickWhenFilled selectedIndicator />);
    input = box();
    expect(press(" ")).toBe(true);
    empty.unmount();
    for (const flag of [{ disabled: true }, { readOnly: true }]) {
      const spy = vi.fn();
      const r = wrap(<Picker initial="lc_sales" log={log} spy={spy} {...flag} />);
      press(" ");
      await flush();
      expect(box().getAttribute("aria-expanded")).toBe("false");
      expect(spy).not.toHaveBeenCalled();
      r.unmount();
    }
    expect(log).toEqual([]);
  });

  it("P36C.linkinput.4 NEGATIVE: the default LinkInput (Desk Link) never takes Space — it types, like Awesomplete", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} picker={false} />);
    const input = box();
    fireEvent.focus(input);
    expect(press(" ")).toBe(true);
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("false"); // keydown alone opens nothing (the input event searches)
    // the browser then inserts the space: Desk searches for "<label> " (link.js:265)
    fireEvent.change(input, { target: { value: "Sales pipeline " } });
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(optionTexts()).toEqual(["Sales pipeline"]);
    expect(log).toEqual([]);
  });

  it("P36C.linkinput.5 arrows wrap at both ends like Desk's Link (Awesomplete next() / previous()) — picker and default", async () => {
    for (const picker of [true, false]) {
      const log: Array<string | null> = [];
      const r = wrap(<Picker initial="lc_sales" log={log} picker={picker} />);
      const input = box();
      fireEvent.focus(input);
      press("ArrowDown"); // opens the full list
      await flush();
      const ids = optionIds();
      expect(ids).toHaveLength(4);
      expect(input.getAttribute("aria-activedescendant")).toBe(ids[0]);
      press("ArrowUp"); // first → last (awesomplete.js:239-245)
      expect(input.getAttribute("aria-activedescendant")).toBe(ids[3]);
      press("ArrowDown"); // last → first (awesomplete.js:234-237)
      expect(input.getAttribute("aria-activedescendant")).toBe(ids[0]);
      press("ArrowDown");
      expect(input.getAttribute("aria-activedescendant")).toBe(ids[1]);
      press("Enter");
      await flush();
      expect(log).toEqual(["lc_sales"]); // Desk re-reports a re-pick of the same value
      r.unmount();
    }
  });

  it("P36C.linkinput.6 Ctrl+N / Ctrl+P / Ctrl+J / Ctrl+K are not taken (cmdk vimBindings, not Desk): the browser / Desk keep them", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} />);
    const input = box();
    fireEvent.click(input);
    await flush();
    const ids = optionIds();
    press("ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(ids[1]);
    for (const key of ["n", "p", "j", "k"]) {
      expect(press(key, { ctrlKey: true })).toBe(true); // not prevented
      expect(input.getAttribute("aria-activedescendant")).toBe(ids[1]); // highlight unchanged
      expect(input.getAttribute("aria-expanded")).toBe("true");
    }
    expect(log).toEqual([]);
  });

  it("P36C.linkinput.7 height: the box carries the DS field-height token (sf-field-fill + h-9) like Input, Select and DateField", async () => {
    wrap(
      <div>
        <Picker initial="lc_sales" log={[]} />
        <LinkInput aria-label="Plain link" value="x" search={searchOver(OPTIONS)} onChange={() => {}} />
        <Input aria-label="DS input" />
        <Select><SelectTrigger aria-label="DS select"><SelectValue placeholder="Pick" /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>
        <DateField value="" onChange={() => {}} aria-label="DS date" />
      </div>,
    );
    const heightTokens = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter((c) => /^(min-|max-)?h-\d|^sf-field-fill$/.test(c)).sort();
    const linkBox = box().parentElement!;
    const plainBox = (screen.getByRole("combobox", { name: "Plain link" }) as HTMLElement).parentElement!;
    const standard = heightTokens(screen.getByLabelText("DS input"));
    expect(standard).toEqual(["h-9", "sf-field-fill"]);
    expect(heightTokens(linkBox)).toEqual(standard);
    expect(heightTokens(plainBox)).toEqual(standard);
    expect(heightTokens(screen.getByRole("combobox", { name: "DS select" }))).toEqual(standard);
    const date = document.querySelector("button.sf-field-fill")!;
    expect(heightTokens(date)).toEqual(standard);
    // the × and the chevron are smaller than the box (size-7 = 28 px < h-9 = 36 px): they never grow it
    for (const el of [linkBox.querySelector("button"), linkBox.querySelector("[data-link-chevron]")]) {
      expect(el?.getAttribute("class")).toMatch(/\bsize-7\b/);
    }
  });

  it("P36C.linkinput.8 RTL (ar): Space opens the Arabic picker the same way; Space while typing types", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_ent" log={log} opts={AR_OPTIONS} />, "ar");
    const input = box();
    expect(press(" ")).toBe(false);
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.value).toBe("صفقات المؤسسات");
    expect(optionTexts()).toEqual(["بدون", "مسار المبيعات", "صفقات المؤسسات"]);
    fireEvent.change(input, { target: { value: "مسار" } });
    await flush();
    expect(press(" ")).toBe(true);
    fireEvent.change(input, { target: { value: "مسار ال" } });
    await flush();
    expect(optionTexts()).toEqual(["مسار المبيعات"]);
    expect(log).toEqual([]);
  });

  it("P36C.linkinput.9 every keyboard open (Space / Enter / ArrowDown) after a keyboard pick selects the shown text, so typing searches afresh", async () => {
    for (const key of [" ", "Enter", "ArrowDown"]) {
      const log: Array<string | null> = [];
      const spy = vi.fn();
      const r = wrap(<Picker initial="lc_sales" log={log} spy={spy} />);
      const input = box();
      fireEvent.focus(input);
      press(key);
      await flush();
      press("ArrowDown"); press("ArrowDown"); press("Enter"); // keyboard pick → "Enterprise deals", list closed
      await flush();
      expect(input.value).toBe("Enterprise deals");
      input.setSelectionRange(input.value.length, input.value.length); // the caret after the label (a real browser after a pick)
      expect(press(key)).toBe(false);
      await flush();
      expect(input.getAttribute("aria-expanded")).toBe("true");
      expect(spy).toHaveBeenLastCalledWith("");
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Enterprise deals".length]);
      fireEvent.change(input, { target: { value: "SMB" } }); // typing replaces the selection
      await flush();
      expect(optionTexts()).toEqual(["SMB fast track"]);
      press("Escape");
      await flush();
      expect(input.value).toBe("Enterprise deals");
      expect(log).toEqual(["lc_ent"]);
      r.unmount();
    }
  });

  it("P36C.linkinput.10 NEGATIVE: the default LinkInput's keyboard opens do not select the text (Desk Link: the caret stays)", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} picker={false} />);
    const input = box();
    fireEvent.focus(input);
    input.setSelectionRange(input.value.length, input.value.length);
    press("ArrowDown");
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect([input.selectionStart, input.selectionEnd]).toEqual([input.value.length, input.value.length]);
    press("Escape");
    press("Enter"); // a closed default box: Enter is not an "open" key (it commits the text, Desk)
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
});
