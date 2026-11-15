/** SchedulingCalendar (src/calendar): the slot arithmetic and the component (Testing Library, en / ar). jsdom only. */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  ThemeProvider, SchedulingCalendar, toLocalDate, slotFromDrag, moveSlot, resizeSlot, shiftSlot, slotOnDay,
  type ScheduleEvent, type ScheduleGuest, type ScheduleSlot, type SchedulingCalendarProps,
} from "../src";
import { layoutDay } from "../src/calendar";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
  // jsdom has no PointerEvent; without one testing-library builds a plain Event with no clientY / button
  const w = window as unknown as { PointerEvent?: unknown };
  w.PointerEvent ??= class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "mouse"; }
  };
});
afterEach(() => cleanup());

const at = (d: string, h: number, m = 0) => { const [y, mo, da] = d.split("-").map(Number); return new Date(y, mo - 1, da, h, m); };
const slot = (d: string, h1: number, m1: number, h2: number, m2: number): ScheduleSlot => ({ start: at(d, h1, m1), end: at(d, h2, m2) });
const hm = (s: ScheduleSlot) => [s.start, s.end].map((x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`).join(" → ");

const DAY = "2026-11-20";
const GUESTS: ScheduleGuest[] = [{ key: "a", label: "Amal", color: "#2563eb" }, { key: "b", label: "Badr", color: "#16a34a" }];
const EVENTS: ScheduleEvent[] = [
  { id: "e1", guestKey: "a", start: "2026-11-20 09:00:00", end: "2026-11-20 10:00:00", title: "Standup" },
  { id: "e2", guestKey: "b", start: "2026-11-20T09:30:00", end: "2026-11-20T11:00:00" },
];
// jsdom lays nothing out: a column's top is 0, so clientY is pixels from the first shown hour (48 px an hour)
const yOf = (hour: number, minute = 0, firstHour = 8) => (hour - firstHour) * 48 + minute * 0.8;

function Harness(props: Partial<SchedulingCalendarProps> & { lang?: "en" | "ar"; spy?: (s: ScheduleSlot) => void }) {
  const { lang = "en", spy, ...rest } = props;
  const [proposal, setProposal] = React.useState<ScheduleSlot | null>(rest.proposal === undefined ? slot(DAY, 10, 0, 11, 0) : rest.proposal);
  return (
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <SchedulingCalendar guests={GUESTS} events={EVENTS} defaultView="day"
        {...rest} proposal={proposal} onProposalChange={(s) => { spy?.(s); setProposal(s); }} />
    </ThemeProvider>
  );
}
const column = (d = DAY) => document.querySelector(`[data-sched-day="${d}"]`) as HTMLElement;
const proposalEl = () => document.querySelector("[data-sched-proposal]") as HTMLElement;

describe("SchedulingCalendar — model", () => {
  it("parses local date strings and Dates", () => {
    expect(toLocalDate("2026-11-20 10:00:00")?.getTime()).toBe(at(DAY, 10).getTime());
    expect(toLocalDate("2026-11-20T10:30")?.getTime()).toBe(at(DAY, 10, 30).getTime());
    expect(toLocalDate("2026-11-20")?.getTime()).toBe(at(DAY, 0).getTime());
    expect(toLocalDate(at(DAY, 7))?.getTime()).toBe(at(DAY, 7).getTime());
    expect(toLocalDate("nope")).toBeNull();
  });
  it("a click snaps to its slot and keeps the given duration; a drag covers every slot it crosses", () => {
    expect(hm(slotFromDrag(DAY, 10 * 60 + 17, 10 * 60 + 29, 30, 60))).toBe("2026-11-20 10:00 → 2026-11-20 11:00");
    expect(hm(slotFromDrag(DAY, 10 * 60 + 10, 11 * 60 + 40, 30, 60))).toBe("2026-11-20 10:00 → 2026-11-20 12:00");
    expect(hm(slotFromDrag(DAY, 11 * 60 + 40, 10 * 60 + 10, 15, 60))).toBe("2026-11-20 10:00 → 2026-11-20 11:45");
  });
  it("a move keeps the duration; a resize never goes under one slot; a shift stays in its day", () => {
    const s = slot(DAY, 10, 0, 11, 30);
    expect(hm(moveSlot(s, "2026-11-21", 14 * 60 + 8, 30))).toBe("2026-11-21 14:00 → 2026-11-21 15:30");
    expect(hm(moveSlot(s, DAY, 23 * 60, 30))).toBe("2026-11-20 22:30 → 2026-11-21 00:00");
    expect(hm(resizeSlot(s, 9 * 60, 30))).toBe("2026-11-20 10:00 → 2026-11-20 10:30");
    expect(hm(resizeSlot(s, 12 * 60 + 20, 30))).toBe("2026-11-20 10:00 → 2026-11-20 12:30");
    expect(shiftSlot(slot(DAY, 0, 0, 1, 0), -30)).toBeNull();
    expect(hm(slotOnDay(s, "2026-11-24"))).toBe("2026-11-24 10:00 → 2026-11-24 11:30");
    expect(hm(slotOnDay(null, "2026-11-24"))).toBe("2026-11-24 09:00 → 2026-11-24 09:30");
  });
  it("overlapping events sit side by side", () => {
    const placed = layoutDay([...EVENTS, { id: "e3", guestKey: "a", start: "2026-11-20 13:00", end: "2026-11-20 14:00" }], DAY);
    expect(placed.map((p) => [p.event.id, p.col, p.cols])).toEqual([["e1", 0, 2], ["e2", 1, 2], ["e3", 0, 1]]);
  });
});

describe("SchedulingCalendar — component", () => {
  it("draws each guest's events in its colour, Busy without a title, and the legend", () => {
    render(<Harness date={at(DAY, 0)} />);
    const e1 = document.querySelector('[data-event-id="e1"]') as HTMLElement;
    const e2 = document.querySelector('[data-event-id="e2"]') as HTMLElement;
    expect(e1.textContent).toBe("Standup");
    expect(e2.textContent).toBe("Busy");
    expect(e2.getAttribute("title")).toContain("Badr: Busy");
    const legend = screen.getByRole("list", { name: "Guests" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Amal", "Badr"]);
    expect(proposalEl().getAttribute("aria-label")).toBe("New meeting, 10:00 AM – 11:00 AM");
  });

  it("working hours only shows those rows; off shows the whole day", () => {
    const onWh = vi.fn();
    render(<Harness date={at(DAY, 0)} workingHours={{ start: 8, end: 18 }} onWorkingHoursOnlyChange={onWh} />);
    const hours = () => [...document.querySelectorAll("[data-sched-hour]")].map((h) => Number(h.getAttribute("data-sched-hour")));
    expect(hours()).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    fireEvent.click(screen.getByRole("switch"));
    expect(onWh).toHaveBeenCalledWith(false);
    expect(hours()).toHaveLength(24);
    expect(hours()[0]).toBe(0);
  });

  it("a click proposes that slot with the current duration; a drag proposes the range", () => {
    const spy = vi.fn();
    render(<Harness date={at(DAY, 0)} spy={spy} />);
    fireEvent.pointerDown(column(), { pointerId: 1, button: 0, clientY: yOf(14, 10) });
    fireEvent.pointerUp(column(), { pointerId: 1, button: 0, clientY: yOf(14, 12) });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 14:00 → 2026-11-20 15:00");
    fireEvent.pointerDown(column(), { pointerId: 2, button: 0, clientY: yOf(15, 40) });
    fireEvent.pointerMove(column(), { pointerId: 2, clientY: yOf(16, 50) });
    expect(proposalEl().className).toContain("border-solid");
    fireEvent.pointerUp(column(), { pointerId: 2, clientY: yOf(16, 50) });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 15:30 → 2026-11-20 17:00");
  });

  it("dragging the proposal moves it with its duration; its bottom edge resizes it, never under one slot", () => {
    const spy = vi.fn();
    render(<Harness date={at(DAY, 0)} spy={spy} />);
    fireEvent.pointerDown(proposalEl(), { pointerId: 1, button: 0, clientY: yOf(10, 10) });
    fireEvent.pointerMove(proposalEl(), { pointerId: 1, clientY: yOf(13, 5) });
    fireEvent.pointerUp(proposalEl(), { pointerId: 1, clientY: yOf(13, 5) });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 13:00 → 2026-11-20 14:00");
    const grip = proposalEl().querySelector("[data-sched-resize]") as HTMLElement;
    fireEvent.pointerDown(grip, { pointerId: 2, button: 0, clientY: yOf(14) });
    fireEvent.pointerMove(grip, { pointerId: 2, clientY: yOf(11) });
    fireEvent.pointerUp(grip, { pointerId: 2, clientY: yOf(11) });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 13:00 → 2026-11-20 13:30");
  });

  it("the proposal is focusable: arrows move it one slot, Shift+arrows resize it", () => {
    const spy = vi.fn();
    render(<Harness date={at(DAY, 0)} spy={spy} />);
    proposalEl().focus();
    fireEvent.keyDown(proposalEl(), { key: "ArrowDown" });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 10:30 → 2026-11-20 11:30");
    expect(document.activeElement).toBe(proposalEl());
    fireEvent.keyDown(proposalEl(), { key: "ArrowUp", shiftKey: true });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 10:30 → 2026-11-20 11:00");
    fireEvent.keyDown(proposalEl(), { key: "ArrowUp", shiftKey: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("with working hours only, the proposal stays within the shown hours", () => {
    const spy = vi.fn();
    render(<Harness date={at(DAY, 0)} proposal={slot(DAY, 8, 0, 8, 30)} spy={spy} />);
    fireEvent.keyDown(proposalEl(), { key: "ArrowUp" });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.pointerDown(proposalEl(), { pointerId: 1, button: 0, clientY: yOf(8, 20) });
    fireEvent.pointerMove(proposalEl(), { pointerId: 1, clientY: yOf(17, 55) });
    fireEvent.pointerUp(proposalEl(), { pointerId: 1, clientY: yOf(17, 55) });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-20 17:30 → 2026-11-20 18:00");
    expect(proposalEl()).toBeTruthy();
  });

  it("month view: chips with +N more; a day click keeps the times and opens Day view", () => {
    const spy = vi.fn();
    const many: ScheduleEvent[] = [1, 2, 3, 4, 5].map((i) => ({ id: `m${i}`, guestKey: "a", start: `2026-11-24 0${i}:00`, end: `2026-11-24 0${i}:30` }));
    render(<Harness defaultView="month" events={many} spy={spy} />);
    const cell = document.querySelector('[data-sched-month-day="2026-11-24"]') as HTMLElement;
    expect(cell.querySelectorAll("[data-event-id]")).toHaveLength(3);
    expect(cell.textContent).toContain("+2 more");
    expect(cell.textContent).toContain("Busy");
    fireEvent.click(cell);
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-24 10:00 → 2026-11-24 11:00");
    expect(document.querySelector("[data-sched-view]")?.getAttribute("data-sched-view")).toBe("day");
    expect(column("2026-11-24")).toBeTruthy();
  });

  it("month click without a proposal gives 09:00–09:30", () => {
    const spy = vi.fn();
    render(<Harness defaultView="month" proposal={null} date={at(DAY, 0)} spy={spy} />);
    fireEvent.click(document.querySelector('[data-sched-month-day="2026-11-02"]') as HTMLElement);
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-02 09:00 → 2026-11-02 09:30");
  });

  it("toolbar: week range, previous / next / today, view switch; an outside proposal brings its week into view", () => {
    const onDate = vi.fn();
    const { rerender } = render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <SchedulingCalendar guests={GUESTS} events={EVENTS} proposal={slot(DAY, 10, 0, 11, 0)} onProposalChange={() => {}} onDateChange={onDate} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("sf-sched-range").textContent).toBe("15 Nov – 21 Nov 2026");
    expect(document.querySelectorAll("[data-sched-day]")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("sf-sched-range").textContent).toBe("22 Nov – 28 Nov 2026");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByTestId("sf-sched-range").textContent).toBe("8 Nov – 14 Nov 2026");
    rerender(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <SchedulingCalendar guests={GUESTS} events={EVENTS} proposal={slot("2026-12-03", 10, 0, 11, 0)} onProposalChange={() => {}} onDateChange={onDate} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("sf-sched-range").textContent).toBe("29 Nov – 5 Dec 2026");
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(document.querySelectorAll("[data-sched-day]")).toHaveLength(1);
  });

  it("the bottom handle resizes the panel by pointer and by keyboard, within minHeight…maxHeight", () => {
    const onHeight = vi.fn();
    render(<Harness date={at(DAY, 0)} onHeightChange={onHeight} minHeight={300} />);
    const handle = screen.getByRole("separator", { name: "Resize the calendar" });
    expect(handle.getAttribute("aria-valuenow")).toBe("420");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle.getAttribute("aria-valuenow")).toBe("440");
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: -400 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: -400 });
    expect(onHeight).toHaveBeenLastCalledWith(300);
  });

  it("Arabic / RTL: localized text, mirrored arrows, ص/م times", () => {
    render(<Harness lang="ar" date={at(DAY, 0)} />);
    expect(document.documentElement.getAttribute("dir") ?? document.querySelector("[dir]")?.getAttribute("dir")).toBe("rtl");
    expect((document.querySelector('[data-event-id="e2"]') as HTMLElement).textContent).toBe("مشغول");
    expect(screen.getByRole("list", { name: "الضيوف" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "السابق" }).querySelector(".lucide-chevron-right")).toBeTruthy();
    expect(screen.getByRole("button", { name: "التالي" }).querySelector(".lucide-chevron-left")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeTruthy();
    expect(screen.getByText("ساعات العمل فقط")).toBeTruthy();
    expect(proposalEl().getAttribute("aria-label")).toBe("اجتماع جديد, 10:00 ص – 11:00 ص");
    const spy = vi.fn();
    cleanup();
    render(<Harness lang="ar" date={at(DAY, 0)} spy={spy} />);
    proposalEl().focus();
    fireEvent.keyDown(proposalEl(), { key: "ArrowLeft" });
    expect(hm(spy.mock.lastCall![0])).toBe("2026-11-21 10:00 → 2026-11-21 11:00");
  });
});
