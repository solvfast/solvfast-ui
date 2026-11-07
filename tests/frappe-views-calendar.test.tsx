/**
 * P35 views — Calendar. Core `CalendarMonth` + month arithmetic (Testing Library, en / ar) and `FrappeCalendarView` over
 * the SIMULATED Frappe: reportview with a date-range filter, and Desk's get_events (handler citing calendar.py:31-57).
 * Simulated & tested — never run against a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { CalendarMonth, eventsOn, monthGrid, type CalendarEvent } from "../src/list/views";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeCalendarView, rowToEvent } from "../src/frappe/views";
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
const day = (d: string) => document.querySelector(`td[data-day="${d}"]`) as HTMLElement;
const titlesOn = (d: string) => [...day(d).querySelectorAll("[data-event-id]")].map((b) => b.textContent);

describe("LV.H3 calendar month (Core)", () => {
  const EV: CalendarEvent[] = [
    { id: "a", title: "Spec", start: "2026-11-03", end: "2026-11-05" },
    { id: "b", title: "Call", start: "2026-11-04 10:00:00" },
    { id: "c", title: "C1", start: "2026-11-04" }, { id: "d", title: "C2", start: "2026-11-04" },
  ];
  it("LV.H3 monthGrid: whole weeks Monday-first (or Sunday-first); eventsOn covers multi-day events", () => {
    const g = monthGrid("2026-11-17");
    expect([g.start, g.end, g.weeks.length]).toEqual(["2026-10-26", "2026-12-06", 6]);
    expect(monthGrid("2026-11-01", 0).start).toBe("2026-11-01");
    expect(eventsOn(EV, "2026-11-05").map((e) => e.id)).toEqual(["a"]);
    expect(eventsOn(EV, "2026-11-06")).toEqual([]);
  });
  it("LV.H3 events on each day they cover, +n more, today marked, navigation, click", () => {
    const onMonth = vi.fn(); const onClick = vi.fn();
    render(theme(<CalendarMonth month="2026-11-10" onMonthChange={onMonth} events={EV} onEventClick={onClick} today="2026-11-04" maxPerDay={2} />));
    expect(screen.getByTestId("sf-calendar-title").textContent).toBe("November 2026");
    expect(titlesOn("2026-11-03")).toEqual(["Spec"]);
    expect(titlesOn("2026-11-05")).toEqual(["Spec"]);
    expect(titlesOn("2026-11-04")).toEqual(["Spec", "Call"]);
    fireEvent.click(within(day("2026-11-04")).getByRole("button", { name: "+2 more" }));
    expect(titlesOn("2026-11-04")).toEqual(["Spec", "Call", "C1", "C2"]);
    expect(day("2026-11-04").getAttribute("aria-current")).toBe("date");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonth).toHaveBeenLastCalledWith("2026-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonth).toHaveBeenLastCalledWith("2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onMonth).toHaveBeenLastCalledWith("2026-11-01");
    fireEvent.click(within(day("2026-11-03")).getByText("Spec"));
    expect(onClick).toHaveBeenCalledWith(EV[0]);
  });
  it("LV.H3 Arabic / RTL: localized labels, the grid follows the page direction", () => {
    render(theme(<div dir="rtl"><CalendarMonth month="2026-11-10" onMonthChange={() => {}} events={EV} today="2026-11-04" /></div>, "ar"));
    expect(screen.getByRole("button", { name: "الشهر التالي" })).toBeTruthy();
    expect(screen.getByRole("grid").getAttribute("aria-label")).toContain("تقويم");
  });
});

function mount(props: Partial<React.ComponentProps<typeof FrappeCalendarView>> = {}) {
  const transport = createFixtureTransport(viewsDemoBackend());
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(theme(
    <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator", roles: ["System Manager"] }}>
      <FrappeCalendarView doctype="Project Task" storage={null} initialMonth="2026-11-01" today="2026-11-04" {...props} />
    </FrappeProvider></QueryClientProvider>,
  ));
  const calls = (m: string) => transport.store.calls.filter((c) => c.method === m);
  return { transport, calls };
}

describe("LV.H3 FrappeCalendarView (SIMULATED)", () => {
  it("LV.H3 reportview with the visible range (field map guessed from the meta); next month re-reads", async () => {
    const { calls } = mount();
    await waitFor(() => expect(titlesOn("2026-11-03")).toEqual(["Write spec"]));
    const a = calls("frappe.desk.reportview.get").at(-1)!.args;
    expect(JSON.parse(String(a.filters))).toEqual([["exp_start_date", "<=", "2026-12-06"], ["exp_end_date", ">=", "2026-10-26"]]);
    expect(a).toMatchObject({ page_length: 0 });
    expect(JSON.parse(String(a.fields))).toEqual(expect.arrayContaining(["name", "exp_start_date", "exp_end_date", "subject", "color"]));
    expect(titlesOn("2026-11-12")).toEqual(["Build grid"]); // multi-day
    expect(titlesOn("2026-10-28")).toEqual(["Kickoff"]);
    expect(titlesOn("2026-11-10")).toEqual(["Build grid"]); // "Fix bugs" has no end date: not in a reportview range (documented)
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(JSON.parse(String(calls("frappe.desk.reportview.get").at(-1)!.args.filters))).toEqual([["exp_start_date", "<=", "2027-01-03"], ["exp_end_date", ">=", "2026-11-30"]]));
    await waitFor(() => expect(titlesOn("2026-12-02")).toEqual(["Retro"]));
  });
  it("LV.H3 get_events source: Desk's args (calendar.js:358-367); open-ended rows kept as calendar.py does; list filters passed", async () => {
    const click = vi.fn();
    const { calls } = mount({ source: { method: "frappe.desk.calendar.get_events" }, onEventClick: click, initialQuery: { conjunction: "and", conditions: [{ id: "x", field: "priority", operator: "equals", value: "Low" }] } });
    await waitFor(() => expect(titlesOn("2026-11-10")).toEqual(["Fix bugs"]));
    const a = calls("frappe.desk.calendar.get_events").at(-1)!.args;
    expect(a).toMatchObject({ doctype: "Project Task", start: "2026-10-26", end: "2026-12-06" });
    expect(JSON.parse(String(a.field_map))).toEqual({ id: "name", start: "exp_start_date", end: "exp_end_date", title: "subject", color: "color", allDay: 1 });
    expect(JSON.parse(String(a.filters))).toEqual([["priority", "=", "Low"]]);
    expect(calls("frappe.desk.reportview.get")).toHaveLength(0);
    expect(titlesOn("2026-11-03")).toEqual([]); // High priority: filtered out
    fireEvent.click(within(day("2026-10-28")).getByText("Kickoff"));
    expect(click.mock.calls[0][0]).toMatchObject({ name: "T-5" });
  });
  it("LV.H3 an explicit field map; rowToEvent fills a missing start / end like prepare_events", async () => {
    mount({ fieldMap: { start: "exp_end_date", title: "subject" } });
    await waitFor(() => expect(titlesOn("2026-11-05")).toEqual(["Write spec"]));
    expect(rowToEvent({ name: "n", s: null, e: "2026-01-02" }, { start: "s", end: "e" })).toMatchObject({ start: "2026-01-02", end: "2026-01-02" });
    expect(rowToEvent({ name: "n", s: null, e: null }, { start: "s", end: "e" })).toBeNull();
  });
});
