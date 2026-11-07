/**
 * Month-grid arithmetic for `CalendarMonth` (pure TS, local dates as "YYYY-MM-DD" strings so no time zone shifts a day).
 * Desk's calendar is FullCalendar (frappe/public/js/frappe/views/calendar/calendar.js); this is the month view only.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  /** "YYYY-MM-DD" or a datetime "YYYY-MM-DD HH:mm[:ss]" (Frappe) / ISO. */
  start: string;
  /** Inclusive last day / end time. Default: `start`. */
  end?: string | null;
  allDay?: boolean;
  /** A CSS colour (Desk: the DocType's Color field). */
  color?: string | null;
  /** Anything the host wants back on click. */
  data?: unknown;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** The date part of a Frappe date / datetime / ISO string, or "" when it is not one. */
export const dayOf = (v: string | null | undefined) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");
export const parseDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
/** First day of the month of `day`. */
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
export const addMonths = (month: string, n: number) => { const d = parseDay(monthStart(month)); d.setMonth(d.getMonth() + n); return ymd(d); };

/**
 * The days a month grid shows: whole weeks from the week containing the 1st to the week containing the last day.
 * `weekStartsOn`: 0 = Sunday … 6 = Saturday (Desk: the site's first day of the week; default Monday here).
 */
export function monthGrid(month: string, weekStartsOn = 1): { start: string; end: string; weeks: string[][] } {
  const first = parseDay(monthStart(month));
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const trail = (weekStartsOn + 6 - last.getDay() + 7) % 7;
  const start = addDays(ymd(first), -lead);
  const end = addDays(ymd(last), trail);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return { start, end, weeks };
}

/** Events on `day`: those whose [start day, end day] covers it (an event without a valid end lasts its start day). */
export function eventsOn(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((e) => {
    const s = dayOf(e.start) || dayOf(e.end ?? "");
    if (!s) return false;
    const en = dayOf(e.end ?? "") || s;
    return s <= day && day <= (en < s ? s : en);
  });
}
