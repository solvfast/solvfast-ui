/**
 * Time arithmetic for `SchedulingCalendar` (pure TS). Days are local "YYYY-MM-DD" strings, times are minutes from the
 * day's midnight, so no time zone shifts a day.
 */
import { addDays, monthGrid, parseDay, ymd } from "../list/views/calendarModel";

export interface ScheduleGuest { key: string; label: string; color: string }
export interface ScheduleEvent { id: string; guestKey: string; start: Date | string; end: Date | string; title?: string | null }
export interface ScheduleSlot { start: Date; end: Date }
export type ScheduleView = "day" | "week" | "month";

export const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/**
 * A Date from a Date or a string, read as local time: "2026-11-20", "2026-11-20 10:00:00", "2026-11-20T10:00".
 * A string with a "Z" or an offset is an instant and is parsed natively. Null when it is not a date.
 */
export function toLocalDate(v: Date | string | null | undefined): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getTime());
  if (typeof v !== "string" || !v.trim()) return null;
  const m = LOCAL_DATETIME.exec(v.trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
/** The local time `minutes` after the midnight of `day` (1440 is the next midnight). */
export const atMinutes = (day: string, minutes: number) => { const d = parseDay(day); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes); };
export const durationMinutes = (s: ScheduleSlot) => Math.round((s.end.getTime() - s.start.getTime()) / MINUTE_MS);
const snapDown = (min: number, step: number) => Math.floor(min / step) * step;
const snapNearest = (min: number, step: number) => Math.round(min / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The slot a press on `day` gives: pressed and released in the same slot → that slot for `clickDuration` minutes;
 * across slots → from the first slot's start to the last slot's end. Snapped to `step`.
 */
export function slotFromDrag(day: string, fromMin: number, toMin: number, step: number, clickDuration: number): ScheduleSlot {
  const a = clamp(snapDown(fromMin, step), 0, DAY_MINUTES - step);
  const b = clamp(snapDown(toMin, step), 0, DAY_MINUTES - step);
  if (a === b) {
    const start = Math.min(a, DAY_MINUTES - clickDuration);
    return { start: atMinutes(day, start), end: atMinutes(day, start + clickDuration) };
  }
  return { start: atMinutes(day, Math.min(a, b)), end: atMinutes(day, Math.max(a, b) + step) };
}

/** `slot` moved to start at `startMin` on `day` (snapped to the nearest `step`), keeping its duration, within the day. */
export function moveSlot(slot: ScheduleSlot, day: string, startMin: number, step: number): ScheduleSlot {
  const dur = durationMinutes(slot);
  const start = clamp(snapNearest(startMin, step), 0, Math.max(0, DAY_MINUTES - dur));
  return { start: atMinutes(day, start), end: atMinutes(day, start + dur) };
}

/** `slot` with its end at `endMin` of its start day (snapped to the nearest `step`); never shorter than one step. */
export function resizeSlot(slot: ScheduleSlot, endMin: number, step: number): ScheduleSlot {
  const day = ymd(slot.start);
  const startMin = minutesOfDay(slot.start);
  const end = clamp(snapNearest(endMin, step), startMin + step, Math.max(startMin + step, DAY_MINUTES));
  return { start: new Date(slot.start.getTime()), end: atMinutes(day, end) };
}

/** `slot` shifted by `minutes` (keyboard), or null when it would leave its day. */
export function shiftSlot(slot: ScheduleSlot, minutes: number): ScheduleSlot | null {
  const day = ymd(slot.start);
  const s = minutesOfDay(slot.start) + minutes;
  const e = s + durationMinutes(slot);
  if (s < 0 || e > DAY_MINUTES) return null;
  return { start: atMinutes(day, s), end: atMinutes(day, e) };
}

/** The proposal moved to `day`, keeping its times — or `fallbackStart`…+`fallbackDuration` minutes when there is none. */
export function slotOnDay(proposal: ScheduleSlot | null, day: string, fallbackStart = 9 * 60, fallbackDuration = 30): ScheduleSlot {
  if (!proposal) return { start: atMinutes(day, fallbackStart), end: atMinutes(day, fallbackStart + fallbackDuration) };
  const s = minutesOfDay(proposal.start);
  return { start: atMinutes(day, s), end: atMinutes(day, s + durationMinutes(proposal)) };
}

export function weekStart(day: string, weekStartsOn: number): string {
  return addDays(day, -((parseDay(day).getDay() - weekStartsOn + 7) % 7));
}

/** The days a view shows around `day`: one, its week, or its month's whole weeks. */
export function visibleDays(view: ScheduleView, day: string, weekStartsOn: number): string[] {
  if (view === "day") return [day];
  if (view === "week") { const s = weekStart(day, weekStartsOn); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
  return monthGrid(day, weekStartsOn).weeks.flat();
}

/** One event's part on one day, in minutes of that day, with its column among the events it overlaps. */
export interface PlacedEvent { event: ScheduleEvent; start: Date; end: Date; startMin: number; endMin: number; col: number; cols: number }

/** The events on `day`, clipped to it, sorted by start, laid side by side where they overlap. */
export function layoutDay(events: readonly ScheduleEvent[], day: string): PlacedEvent[] {
  const dayStart = atMinutes(day, 0).getTime();
  const dayEnd = atMinutes(day, DAY_MINUTES).getTime();
  const items: PlacedEvent[] = [];
  for (const event of events) {
    const start = toLocalDate(event.start);
    if (!start) continue;
    const parsedEnd = toLocalDate(event.end);
    const end = parsedEnd && parsedEnd > start ? parsedEnd : new Date(start.getTime() + 30 * MINUTE_MS);
    if (end.getTime() <= dayStart || start.getTime() >= dayEnd) continue;
    const startMin = Math.max(0, Math.round((start.getTime() - dayStart) / MINUTE_MS));
    const endMin = Math.min(DAY_MINUTES, Math.round((end.getTime() - dayStart) / MINUTE_MS));
    items.push({ event, start, end, startMin, endMin, col: 0, cols: 1 });
  }
  items.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let cluster: PlacedEvent[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => { for (const it of cluster) it.cols = columnEnds.length; cluster = []; columnEnds = []; };
  for (const it of items) {
    if (it.startMin >= clusterEnd) close();
    let col = columnEnds.findIndex((end) => end <= it.startMin);
    if (col < 0) { col = columnEnds.length; columnEnds.push(it.endMin); } else columnEnds[col] = it.endMin;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  close();
  return items;
}
