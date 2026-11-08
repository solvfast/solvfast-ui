/**
 * P36b "linkinput" — LinkInput's opt-in select-like behaviour for pickers over a known list (CRM configuration
 * pickers P1–P5): open the full list on a click / tap even when the box is filled, a check mark + aria-selected on the
 * current value, Escape restores, Home / End, an emptied box that keeps its value, the "no results" text and a search
 * placeholder. Every default is unchanged (negative controls at the end). jsdom; no network.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { LinkInput, type LinkInputProps, type Suggestion } from "../src/fields";
import { defaultMessages } from "../src/theme/messages";

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
const searchOver = (opts: Suggestion[]) => vi.fn(async (text: string) => {
  const q = text.trim().toLowerCase();
  return opts.filter((o) => !q || (o.label ?? "").toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
});

/** A controlled picker like the CRM's: the "none" row is shown by its label with value null. */
function Picker({ initial, log, opts = OPTIONS, ...rest }: { initial: string | null; log: Array<string | null>; opts?: Suggestion[] } & Partial<LinkInputProps>) {
  const [v, setV] = React.useState<string | null>(initial);
  const search = React.useMemo(() => searchOver(opts), [opts]);
  const isNone = v == null || v === "__none__";
  const shown = isNone ? opts[0].label : opts.find((o) => o.value === v)?.label ?? v;
  return (
    <LinkInput
      aria-label="Linked Lifecycle"
      value={isNone ? null : v}
      displayValue={shown}
      selectedValue={isNone ? "__none__" : v}
      search={search}
      debounceMs={0}
      openOnClickWhenFilled
      selectedIndicator
      onChange={(n) => { log.push(n); setV(n); }}
      {...rest}
    />
  );
}

const box = () => screen.getByRole("combobox", { name: "Linked Lifecycle" }) as HTMLInputElement;
const flush = () => act(async () => {});
const selectedOptions = () => screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");

describe("P36b LinkInput — select-like opt-in", () => {
  it("P36B.linkinput.1 mouse: a click on a filled box opens the FULL list, keeps the value, picking another replaces it", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} />);
    const input = box();
    expect(input.value).toBe("Sales pipeline");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.focus(input);
    expect(input.getAttribute("aria-expanded")).toBe("false"); // focus alone (Tab) does not open a filled box
    fireEvent.click(input);
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "Sales pipeline", "Enterprise deals", "SMB fast track"]);
    expect(input.value).toBe("Sales pipeline"); // the current value is not lost
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Sales pipeline".length]); // typing replaces it
    fireEvent.click(screen.getByRole("option", { name: "Enterprise deals" }));
    expect(log).toEqual(["lc_ent"]);
    expect(input.value).toBe("Enterprise deals");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    // and it reopens again on the next click, now marking the new value
    fireEvent.click(input);
    await flush();
    expect(selectedOptions().map((o) => o.textContent)).toEqual(["Enterprise deals"]);
  });

  it("P36B.linkinput.2 keyboard: ArrowDown / Enter open a filled box, arrows + Home / End move, Enter picks", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} />);
    const input = box();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(input, { key: "Enter" }); // like the button it replaces: Enter opens
    await flush();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const activeId = () => input.getAttribute("aria-activedescendant");
    const opts = () => screen.getAllByRole("option");
    expect(activeId()).toBe(opts()[0].id); // first row highlighted (as cmdk)
    fireEvent.keyDown(input, { key: "End" });
    expect(activeId()).toBe(opts()[3].id);
    fireEvent.keyDown(input, { key: "Home" });
    expect(activeId()).toBe(opts()[0].id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeId()).toBe(opts()[2].id);
    expect(opts()[2].hasAttribute("data-active")).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(log).toEqual(["lc_ent"]);
    expect(input.value).toBe("Enterprise deals");
  });

  it("P36B.linkinput.3 check mark + aria-selected mark the current value only (highlight via aria-activedescendant)", async () => {
    wrap(<Picker initial="lc_smb" log={[]} />);
    fireEvent.click(box());
    await flush();
    const sel = selectedOptions();
    expect(sel.map((o) => o.textContent)).toEqual(["SMB fast track"]);
    expect(sel[0].hasAttribute("data-current")).toBe(true);
    const checks = screen.getAllByRole("option").map((o) => o.querySelector("[data-selected-indicator]")!);
    expect(checks.every(Boolean)).toBe(true); // every row reserves the check column
    expect(checks.map((c) => c.getAttribute("class")!.includes("opacity-100"))).toEqual([false, false, false, true]);
    expect(checks[3].getAttribute("aria-hidden")).toBe("true");
    // moving the highlight does not move aria-selected
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(selectedOptions().map((o) => o.textContent)).toEqual(["SMB fast track"]);
    expect(box().getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[1].id);
  });

  it("P36B.linkinput.4 selectedValue marks a 'none' row while value is null; picking it reports its value", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial={null} log={log} />);
    const input = box();
    expect(input.value).toBe("None");
    expect(screen.queryByRole("button", { name: defaultMessages.en.formClear })).toBeNull(); // value null → no ×
    fireEvent.click(input);
    await flush();
    expect(selectedOptions().map((o) => o.textContent)).toEqual(["None"]);
    fireEvent.click(screen.getByRole("option", { name: "SMB fast track" }));
    expect(log).toEqual(["lc_smb"]);
    fireEvent.click(input);
    await flush();
    fireEvent.click(screen.getByRole("option", { name: "None" }));
    expect(log).toEqual(["lc_smb", "__none__"]);
    expect(input.value).toBe("None");
  });

  it("P36B.linkinput.5 typing filters; Escape restores the shown value without onChange; emptyText / searchPlaceholder", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} placeholder="Select a lifecycle" searchPlaceholder="Search lifecycles…" emptyText="Nothing here" />);
    const input = box();
    expect(input.placeholder).toBe("Select a lifecycle");
    fireEvent.click(input);
    await flush();
    expect(input.placeholder).toBe("Search lifecycles…");
    fireEvent.change(input, { target: { value: "ent" } });
    await flush();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Enterprise deals"]);
    fireEvent.change(input, { target: { value: "zzzqqq" } });
    await flush();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe("Nothing here");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("Sales pipeline");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.placeholder).toBe("Select a lifecycle");
    expect(log).toEqual([]);
  });

  it("P36B.linkinput.6 clearing: × clears; keepValueWhenEmptied restores an emptied box on blur", async () => {
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_ent" log={log} keepValueWhenEmptied />);
    const input = box();
    fireEvent.focus(input);
    fireEvent.click(input);
    await flush();
    fireEvent.change(input, { target: { value: "" } });
    await flush();
    expect(screen.getAllByRole("option")).toHaveLength(4); // emptied box = the full list
    fireEvent.blur(input);
    expect(log).toEqual([]);
    expect(input.value).toBe("Enterprise deals");
    // whitespace only = emptied, too
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "  " } });
    await flush();
    fireEvent.blur(input);
    expect(log).toEqual([]);
    expect(input.value).toBe("Enterprise deals");
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.formClear }));
    expect(log).toEqual([null]);
    expect(input.value).toBe("None");
  });

  it("P36B.linkinput.7 the chevron toggles the list with a pointer; disabled / readOnly never open", async () => {
    const { container, unmount } = wrap(<Picker initial="lc_sales" log={[]} />);
    const chevron = container.querySelector("[data-link-chevron]")!;
    expect(chevron.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(chevron);
    await flush();
    expect(box().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(chevron);
    expect(box().getAttribute("aria-expanded")).toBe("false");
    unmount();
    const search = vi.fn(async () => OPTIONS);
    const { container: c2, unmount: u2 } = wrap(<LinkInput aria-label="Linked Lifecycle" value="lc_sales" displayValue="Sales pipeline" onChange={() => {}} search={search} debounceMs={0} openOnClickWhenFilled selectedIndicator disabled />);
    fireEvent.click(box());
    fireEvent.click(c2.querySelector("[data-link-chevron]")!);
    fireEvent.keyDown(box(), { key: "Enter" });
    await flush();
    expect(search).not.toHaveBeenCalled();
    u2();
    const { container: c3 } = wrap(<LinkInput aria-label="Linked Lifecycle" value="lc_sales" displayValue="Sales pipeline" onChange={() => {}} search={search} debounceMs={0} openOnClickWhenFilled readOnly />);
    expect(c3.querySelector("[data-link-chevron]")).toBeNull();
    fireEvent.click(box());
    await flush();
    expect(search).not.toHaveBeenCalled();
  });

  it("P36B.linkinput.8 keeps the highlighted row scrolled into view; an IME composition's Enter is left alone", async () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    const log: Array<string | null> = [];
    wrap(<Picker initial="lc_sales" log={log} />);
    fireEvent.click(box());
    await flush();
    spy.mockClear();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(spy).toHaveBeenCalledWith({ block: "nearest" });
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    expect(log).toEqual([]);
    expect(box().getAttribute("aria-expanded")).toBe("true");
  });

  it("P36B.linkinput.9 RTL (ar): same behaviour, Arabic labels, default Arabic empty text, dir=rtl", async () => {
    const log: Array<string | null> = [];
    const { container } = wrap(<Picker initial="lc_sales" log={log} opts={AR_OPTIONS} />, "ar");
    const input = box();
    expect(input.closest("[dir]")!.getAttribute("dir")).toBe("rtl");
    expect(input.value).toBe("مسار المبيعات");
    fireEvent.click(input);
    await flush();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["بدون", "مسار المبيعات", "صفقات المؤسسات"]);
    expect(selectedOptions().map((o) => o.textContent)).toEqual(["مسار المبيعات"]);
    // logical spacing only (no left / right): the check column and the chevron mirror in RTL
    const check = screen.getAllByRole("option")[1].querySelector("[data-selected-indicator]")!;
    expect(/\b(ml|mr|pl|pr|left|right)-/.test(check.getAttribute("class")!)).toBe(false);
    expect(container.querySelector("[data-link-chevron]")!.getAttribute("class")).toContain("me-1");
    fireEvent.change(input, { target: { value: "zzz" } });
    await flush();
    expect(screen.getByRole("status").textContent).toBe(defaultMessages.ar.noResults);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("مسار المبيعات");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await flush();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(log).toEqual(["lc_ent"]);
    expect(input.value).toBe("صفقات المؤسسات");
  });
});

describe("P36b LinkInput — defaults unchanged (negative controls)", () => {
  it("P36B.linkinput.10 without the opt-ins a click on a filled box does not open; Enter does not open; no chevron", async () => {
    const search = vi.fn(async () => OPTIONS);
    const { container } = wrap(<LinkInput aria-label="Linked Lifecycle" value="lc_sales" displayValue="Sales pipeline" onChange={() => {}} search={search} debounceMs={0} />);
    const input = box();
    fireEvent.focus(input);
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();
    expect(search).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-link-chevron]")).toBeNull();
    // ArrowDown still opens the full list (unchanged), Home / End are not taken from the caret
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await flush();
    expect(search).toHaveBeenCalledWith("");
    const home = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true });
    input.dispatchEvent(home);
    expect(home.defaultPrevented).toBe(false);
  });

  it("P36B.linkinput.11 without selectedIndicator aria-selected follows the highlight and no check mark is drawn", async () => {
    wrap(<LinkInput aria-label="Linked Lifecycle" value={null} onChange={() => {}} search={async () => OPTIONS} debounceMs={0} openOnClickWhenFilled />);
    fireEvent.focus(box());
    await flush();
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
    expect(document.querySelector("[data-selected-indicator]")).toBeNull();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("aria-selected"))).toEqual(["false", "true", "false", "false"]);
  });

  it("P36B.linkinput.12 without keepValueWhenEmptied an emptied box is cleared on blur (Desk); default empty text", async () => {
    const onChange = vi.fn();
    wrap(<LinkInput aria-label="Linked Lifecycle" value="lc_sales" displayValue="Sales pipeline" onChange={onChange} search={async () => []} debounceMs={0} openOnClickWhenFilled />);
    const input = box();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    await flush();
    expect(screen.getByRole("status").textContent).toBe(defaultMessages.en.noResults);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("P36b LinkInput — Showcase", () => {
  it("P36B.linkinput.13 the picker page is registered under Components and renders in English and Arabic without errors", async () => {
    const page = await import("../showcase/src/pages/p36b-linkinput");
    const routes = await import("../showcase/src/routes");
    const entry = routes.PAGES.find((p) => p.id === "p36b-linkinput");
    expect(entry?.group.id).toBe("components");
    expect(routes.PAGES.map((p) => p.id)).toEqual(routes.GROUPS.flatMap((g) => g.pages.map((p) => p.id)));
    const err = vi.spyOn(console, "error");
    for (const lang of ["en", "ar"] as const) {
      const { unmount } = wrap(<page.LinkInputSelectLikePage />, lang);
      const input = screen.getAllByRole("combobox")[0] as HTMLInputElement;
      fireEvent.click(input);
      await flush();
      expect(screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(1);
      unmount();
    }
    expect(err).not.toHaveBeenCalled();
  });
});
