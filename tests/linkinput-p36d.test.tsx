/**
 * P36d "linkinput" — owner decision (P36c item 7): three LinkInput improvements become the DEFAULT (not only picker mode):
 *  1. the highlighted row is kept scrolled into view;
 *  2. keys during an IME composition (isComposing / keyCode 229) belong to the IME — Enter neither picks nor commits;
 *  3. Escape restores the previously shown value (browser path: the popover's document Escape; closed list with typing).
 * Plus regressions: normal typing / Enter / arrows in default mode, Space types in default mode, picker mode unchanged.
 * jsdom, no network.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { LinkInput, type LinkInputProps, type Suggestion } from "../src/fields";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const OPTIONS: Suggestion[] = Array.from({ length: 30 }, (_, i) => ({ value: `CUST-${String(i + 1).padStart(3, "0")}`, label: `Customer ${i + 1}` }));
const search = async (text: string) => {
  const q = text.trim().toLowerCase();
  return OPTIONS.filter((o) => !q || o.value.toLowerCase().includes(q) || (o.label ?? "").toLowerCase().includes(q));
};
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const box = () => screen.getByRole("combobox") as HTMLInputElement;

/** Default-mode LinkInput (no openOnClickWhenFilled / selectedIndicator), controlled, like FrappeLinkField. */
function Link({ initial = null, log, ...rest }: { initial?: string | null; log: Array<string | null> } & Partial<LinkInputProps>) {
  const [v, setV] = React.useState<string | null>(initial);
  return (
    <LinkInput aria-label="Customer" value={v} displayValue={v ? OPTIONS.find((o) => o.value === v)?.label ?? v : null}
      onChange={(next) => { log.push(next); setV(next); }} search={search} debounceMs={0} {...rest} />
  );
}
const wrap = (ui: React.ReactElement, lang: "en" | "ar" = "en") =>
  render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

describe("P36d LinkInput defaults", () => {
  it("P36D.linkinput.1 default mode keeps the highlighted row scrolled into view", async () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    wrap(<Link log={[]} />);
    fireEvent.focus(box());
    await flush();
    expect(box().getAttribute("aria-expanded")).toBe("true");
    spy.mockClear();
    for (let i = 0; i < 12; i++) fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(spy).toHaveBeenCalledWith({ block: "nearest" });
    // the call is on the highlighted row
    const target = spy.mock.contexts.at(-1) as Element;
    expect(target.getAttribute("id")).toBe(box().getAttribute("aria-activedescendant"));
  });

  it("P36D.linkinput.2 an IME composition's Enter / arrows are left to the IME (isComposing and keyCode 229)", async () => {
    const log: Array<string | null> = [];
    wrap(<Link log={log} />);
    fireEvent.change(box(), { target: { value: "Customer 1" } });
    await flush();
    const before = box().getAttribute("aria-activedescendant");
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(box(), { key: "ArrowDown", isComposing: true });
    fireEvent.keyDown(box(), { key: "Escape", isComposing: true }); // bubbles to the popover's document listener too
    expect(log).toEqual([]);
    expect(box().value).toBe("Customer 1");
    expect(box().getAttribute("aria-expanded")).toBe("true");
    expect(box().getAttribute("aria-activedescendant")).toBe(before);
    // composition over: Enter picks the highlighted row as before
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(log).toEqual(["CUST-001"]);
  });

  it("P36D.linkinput.3 Escape restores the previous value — jsdom key path, no onChange, blur commits nothing", async () => {
    const log: Array<string | null> = [];
    wrap(<Link initial="CUST-002" log={log} />);
    expect(box().value).toBe("Customer 2");
    fireEvent.change(box(), { target: { value: "Customer 7" } });
    await flush();
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box().value).toBe("Customer 2");
    expect(box().getAttribute("aria-expanded")).toBe("false");
    fireEvent.blur(box());
    expect(log).toEqual([]);
  });

  it("P36D.linkinput.4 Escape restores in the browser path too (the popover's document-level Escape closes the list first)", async () => {
    const log: Array<string | null> = [];
    wrap(<Link initial="CUST-002" log={log} />);
    fireEvent.change(box(), { target: { value: "zzz" } });
    await flush();
    expect(box().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    await flush();
    expect(box().value).toBe("Customer 2");
    fireEvent.blur(box());
    expect(log).toEqual([]);
  });

  it("P36D.linkinput.5 Escape on a closed list with typed text restores the value", async () => {
    const log: Array<string | null> = [];
    wrap(<Link initial="CUST-002" log={log} search={() => new Promise(() => {})} />);
    fireEvent.change(box(), { target: { value: "Cust" } });
    fireEvent.keyDown(document, { key: "Escape" }); // closes whatever the popover shows
    await flush();
    fireEvent.change(box(), { target: { value: "Custo" } });
    // force the list closed (a pending search), then Escape on the input
    fireEvent.keyDown(box(), { key: "Escape" });
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box().value).toBe("Customer 2");
    fireEvent.blur(box());
    expect(log).toEqual([]);
  });

  it("P36D.linkinput.6 normal typing and navigation are unchanged: type filters, arrows wrap, Enter picks, Space types", async () => {
    const log: Array<string | null> = [];
    wrap(<Link log={log} />);
    fireEvent.change(box(), { target: { value: "Customer 3" } });
    await flush();
    // "Customer 3" and "Customer 30"
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Customer 3")]));
    fireEvent.keyDown(box(), { key: "ArrowUp" }); // wraps to the last row
    const last = screen.getAllByRole("option").length - 1;
    expect(box().getAttribute("aria-activedescendant")).toMatch(new RegExp(`-${last}$`));
    fireEvent.keyDown(box(), { key: "ArrowDown" }); // wraps back to the first
    expect(box().getAttribute("aria-activedescendant")).toMatch(/-0$/);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(log).toEqual(["CUST-003"]);
    // Space in default mode is a character (no list-open shortcut): the keydown is not prevented
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    box().dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("P36D.linkinput.7 hand-typed text still commits on blur (onCommitText), Escape is the only restore", async () => {
    const committed: string[] = [];
    const log: Array<string | null> = [];
    wrap(<Link log={log} onCommitText={(t) => committed.push(t)} />);
    fireEvent.change(box(), { target: { value: "Brand new" } });
    await flush();
    fireEvent.blur(box());
    expect(committed).toEqual(["Brand new"]);
  });

  it("P36D.linkinput.8 opt-in picker mode still works: click opens the full list, Escape restores, picking replaces", async () => {
    const log: Array<string | null> = [];
    wrap(<Link initial="CUST-002" log={log} openOnClickWhenFilled selectedIndicator keepValueWhenEmptied />);
    fireEvent.click(box());
    await flush();
    expect(screen.getAllByRole("option")).toHaveLength(30);
    fireEvent.change(box(), { target: { value: "Customer 9" } });
    await flush();
    fireEvent.keyDown(document, { key: "Escape" });
    await flush();
    expect(box().value).toBe("Customer 2");
    fireEvent.click(box());
    await flush();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(log.length).toBe(1);
  });

  it("P36D.linkinput.9 RTL (ar): the same Escape restore and IME guard", async () => {
    const log: Array<string | null> = [];
    wrap(<Link initial="CUST-002" log={log} />, "ar");
    expect(box().closest("[dir]")!.getAttribute("dir")).toBe("rtl");
    fireEvent.change(box(), { target: { value: "Customer 5" } });
    await flush();
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    expect(log).toEqual([]);
    fireEvent.keyDown(document, { key: "Escape" });
    await flush();
    expect(box().value).toBe("Customer 2");
  });
});
