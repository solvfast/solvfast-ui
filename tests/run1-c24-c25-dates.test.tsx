/**
 * Run 1 · C-24 (P1) Date and C-25 (P1, data loss) Datetime.
 *  - Date: a set value can be cleared (Clear, or the selected day again) → null; typed in the site's format; Today; a
 *    required empty Date is aria-invalid. The DS DateField keeps its markup unless the aids are asked for.
 *  - Datetime: 10:37:45 survives open → Apply (no 15-minute rounding, seconds kept); Clear → null; Now; the time zone
 *    conversion (system ↔ user) round-trips. SIMULATED: jsdom + format context; real site: pending (I5).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeField } from "../src/frappe/form";
import { DateField, DateTimeField } from "../src/primitives/date-time-field";
import { datetimeFromUserInput, datetimeToUserInput, parseUserDate, type FormatContext } from "../src/frappe/services/format";
import type { FrappeDocField } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function Live({ df, initial, log }: { df: FrappeDocField; initial: unknown; log: unknown[] }) {
  const [v, setV] = React.useState<unknown>(initial);
  return <FrappeField df={df} value={v} onChange={(x) => { log.push(x); setV(x); }} />;
}
function mount(df: Partial<FrappeDocField> & { fieldtype: string }, initial: unknown, ctx: FormatContext = {}, lang: "en" | "ar" = "en") {
  const client = createFrappeClient({ transport: async () => ({}) });
  const log: unknown[] = [];
  const full = { fieldname: "f", label: "When", ...df } as FrappeDocField;
  const utils = render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}><FrappeProvider client={client} formatContext={ctx}><Live df={full} initial={initial} log={log} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...utils, log };
}
const open = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));

describe("C-24 Date", () => {
  it("a set Date is cleared with Clear → null (and the field shows the placeholder)", () => {
    const { log } = mount({ fieldtype: "Date" }, "2026-11-20", { dateFormat: "dd-mm-yyyy" });
    open(/When/);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(log).toEqual([null]);
    expect(screen.queryByText("20-11-2026")).toBeNull();
  });

  it("clicking the selected day again also clears it", () => {
    const { log } = mount({ fieldtype: "Date" }, "2026-11-20", { dateFormat: "dd-mm-yyyy" });
    open(/When/);
    const day = screen.getAllByRole("button").find((b) => b.getAttribute("aria-selected") === "true" || b.closest("[aria-selected=true]"));
    fireEvent.click(day ?? screen.getByRole("button", { name: /20/ }));
    expect(log).toEqual([null]);
  });

  it("typed in the site's format: 04-11-2026 under dd-mm-yyyy → 2026-11-04; an impossible date is refused with a message", () => {
    const { log } = mount({ fieldtype: "Date" }, null, { dateFormat: "dd-mm-yyyy" });
    open(/When/);
    const box = screen.getByRole("textbox", { name: "Type a date" });
    expect(box.getAttribute("placeholder")).toBe("dd-mm-yyyy");
    fireEvent.change(box, { target: { value: "31-02-2026" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe("Not a valid date");
    expect(log).toEqual([]);
    fireEvent.change(box, { target: { value: "04-11-2026" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(log).toEqual(["2026-11-04"]);
  });

  it("Today sets today's date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 13, 9, 0, 0));
    const { log } = mount({ fieldtype: "Date" }, null);
    open(/When/);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(log).toEqual(["2026-11-13"]);
  });

  it("a required empty Date is aria-invalid; a filled one is not", () => {
    mount({ fieldtype: "Date", reqd: 1 }, null);
    expect(screen.getByRole("button", { name: /When/ }).getAttribute("aria-invalid")).toBe("true");
    cleanup();
    mount({ fieldtype: "Date", reqd: 1 }, "2026-11-20");
    expect(screen.getByRole("button", { name: /When/ }).getAttribute("aria-invalid")).toBeNull();
  });

  it("Arabic: Clear, Today and the typed box are labelled from the catalogue", () => {
    mount({ fieldtype: "Date" }, "2026-11-20", { dateFormat: "dd-mm-yyyy" }, "ar");
    open(/When/);
    expect(screen.getByRole("button", { name: "مسح" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "اليوم" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "اكتب التاريخ" })).toBeTruthy();
  });

  it("parseUserDate follows the site format (dd-mm-yyyy, mm/dd/yyyy, yyyy-mm-dd, dd.mm.yy) and refuses non-dates", () => {
    expect(parseUserDate("04-11-2026", { dateFormat: "dd-mm-yyyy" })).toBe("2026-11-04");
    expect(parseUserDate("11/04/2026", { dateFormat: "mm/dd/yyyy" })).toBe("2026-11-04");
    expect(parseUserDate("2026-11-04", { dateFormat: "yyyy-mm-dd" })).toBe("2026-11-04");
    expect(parseUserDate("4.11.26", { dateFormat: "dd.mm.yy" })).toBe("2026-11-04");
    expect(parseUserDate("2026-11", { dateFormat: "yyyy-mm-dd" })).toBeNull();
    expect(parseUserDate("30-02-2026", { dateFormat: "dd-mm-yyyy" })).toBeNull();
    expect(parseUserDate("26-11-04", { dateFormat: "yyyy-mm-dd" })).toBeNull(); // a 2-digit year under YYYY
  });

  it("NEGATIVE: the DS DateField without the aids has no Clear / Today / typed box (CRM markup unchanged)", () => {
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><DateField value="2026-11-20" onChange={() => {}} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Date/ }));
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("C-25 Datetime", () => {
  it("10:37:45 survives open → Apply unchanged (no 15-minute rounding, seconds kept)", () => {
    const { log } = mount({ fieldtype: "Datetime" }, "2026-11-20 10:37:45");
    open(/When/);
    const dialog = screen.getByText("Select date & time").parentElement!;
    expect(within(dialog).getByText("37")).toBeTruthy(); // the minute select shows the stored minute
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(log).toEqual(["2026-11-20 10:37:45"]);
  });

  it("untouched: the field never emits on mount", () => {
    const { log } = mount({ fieldtype: "Datetime" }, "2026-11-20 10:37:45");
    expect(log).toEqual([]);
  });

  it("Clear → null; Now → the current time with seconds", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 13, 14, 5, 9));
    const { log } = mount({ fieldtype: "Datetime" }, "2026-11-20 10:37:45");
    open(/When/);
    fireEvent.click(screen.getByRole("button", { name: "Now" }));
    expect(log).toEqual(["2026-11-13 14:05:09"]);
    open(/When/);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(log).toEqual(["2026-11-13 14:05:09", null]);
  });

  it("time zones: edited in the user's zone, stored in the system's — Apply unchanged round-trips exactly (SIMULATED)", () => {
    const ctx: FormatContext = { timeZone: { system: "Asia/Riyadh", user: "Asia/Kolkata" } };
    expect(datetimeToUserInput("2026-11-20 10:37:45", ctx)).toBe("2026-11-20T13:07:45");
    expect(datetimeFromUserInput("2026-11-20T13:07:45", ctx)).toBe("2026-11-20 10:37:45");
    const { log } = mount({ fieldtype: "Datetime" }, "2026-11-20 10:37:45", ctx);
    open(/When/);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(log).toEqual(["2026-11-20 10:37:45"]);
  });

  it("the DS DateTimeField keeps an off-interval minute (CRM call forms: 10:37 no longer becomes 10:30)", () => {
    const seen: string[] = [];
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><DateTimeField value="2026-11-20T10:37" onChange={(v) => seen.push(v)} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Date and time/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(seen).toEqual(["2026-11-20T10:37"]); // same value contract ("YYYY-MM-DDTHH:mm") without withSeconds
    expect(screen.queryByRole("button", { name: "Now" })).toBeNull(); // aids are opt-in
  });
});
