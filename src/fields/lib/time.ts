/**
 * Time and duration helpers for the generic controls. Frappe-free, pure TypeScript.
 *
 * Time (docs `12` §7.1, §7.4): stored `HH:mm:ss`; the server may send an unpadded hour (`9:30:00`, a timedelta) or
 * microseconds; parse leniently, emit exactly `HH:mm:ss` (or `HH:mm` when seconds are off). No time-zone conversion.
 * Duration (docs `12` §7.6): a number of seconds; parts d/h/m/s; `hideDays` folds days into hours; `hideSeconds` drops
 * the seconds part. Empty formats as `0s`. UNVERIFIED: whether Desk rounds or truncates seconds into minutes when
 * seconds are hidden — this truncates.
 */
import { normalizeDigits } from "./number";

export interface TimeParts { h: number; m: number; s: number }

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Lenient time parse: `9`, `930`, `9:5`, `09:30`, `9:30:00`, `09:30:00.123456`, `9:30 pm`, `9.30`, Arabic digits and
 * `ص` / `م` (AM / PM). Returns null when the text is not a time.
 */
export function parseTimeText(text: string | null | undefined): TimeParts | null {
  if (text == null) return null;
  let s = normalizeDigits(String(text)).trim().toLowerCase();
  if (!s) return null;
  let meridiem: "am" | "pm" | null = null;
  const mer = /\s*(a\.?m\.?|p\.?m\.?|ص|م)$/.exec(s);
  if (mer) {
    meridiem = mer[1].startsWith("a") || mer[1] === "ص" ? "am" : "pm";
    s = s.slice(0, mer.index).trim();
  }
  let h: number; let m = 0; let sec = 0;
  const colon = /^(\d{1,2})(?:[:.](\d{1,2}))?(?:[:.](\d{1,2})(?:\.\d+)?)?$/.exec(s);
  const compact = /^(\d{3,4})$/.exec(s);
  if (colon) {
    h = Number(colon[1]); m = colon[2] != null ? Number(colon[2]) : 0; sec = colon[3] != null ? Number(colon[3]) : 0;
  } else if (compact) {
    const d = compact[1].padStart(4, "0");
    h = Number(d.slice(0, 2)); m = Number(d.slice(2));
  } else return null;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "am" && h === 12) h = 0;
    if (meridiem === "pm" && h !== 12) h += 12;
  }
  if (h > 23 || m > 59 || sec > 59) return null;
  return { h, m, s: sec };
}

/** Parts → stored value: `HH:mm:ss` (or `HH:mm`). */
export const toTimeString = (p: TimeParts, withSeconds = true) => (withSeconds ? `${pad(p.h)}:${pad(p.m)}:${pad(p.s)}` : `${pad(p.h)}:${pad(p.m)}`);

/** Display text for a stored time: 24-hour `HH:mm[:ss]`, or 12-hour with a localized AM/PM. */
export function formatTimeText(value: string | null | undefined, opts: { withSeconds?: boolean; hour12?: boolean; language?: "en" | "ar" } = {}): string {
  const p = parseTimeText(value);
  if (!p) return "";
  const withSeconds = opts.withSeconds ?? true;
  if (!opts.hour12) return toTimeString(p, withSeconds);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const mer = opts.language === "ar" ? (p.h < 12 ? "ص" : "م") : p.h < 12 ? "AM" : "PM";
  return `${h12}:${pad(p.m)}${withSeconds ? `:${pad(p.s)}` : ""} ${mer}`;
}

export const nowTimeParts = (d = new Date()): TimeParts => ({ h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() });

// ---- duration --------------------------------------------------------------------------------------------------

export interface DurationParts { days: number; hours: number; minutes: number; seconds: number }
export interface DurationOptions { hideDays?: boolean; hideSeconds?: boolean }

export function secondsToDuration(total: number | null | undefined, opts: DurationOptions = {}): DurationParts {
  const v = Math.max(0, Math.trunc(Number(total) || 0));
  const days = opts.hideDays ? 0 : Math.floor(v / 86400);
  const hours = opts.hideDays ? Math.floor(v / 3600) : Math.floor((v % 86400) / 3600);
  const minutes = Math.floor((v % 3600) / 60);
  const seconds = opts.hideSeconds ? 0 : v % 60;
  return { days, hours, minutes, seconds };
}

export const durationToSeconds = (p: Partial<DurationParts>) =>
  Math.max(0, Math.trunc((p.days ?? 0) * 86400 + (p.hours ?? 0) * 3600 + (p.minutes ?? 0) * 60 + (p.seconds ?? 0)));

export interface DurationUnits { d: string; h: string; m: string; s: string }
export const EN_UNITS: DurationUnits = { d: "d", h: "h", m: "m", s: "s" };

/** `1d 2h 3m 4s` (zero parts omitted); `0s` for empty / zero. */
export function formatDuration(total: number | null | undefined, opts: DurationOptions & { units?: DurationUnits } = {}): string {
  const u = opts.units ?? EN_UNITS;
  const p = secondsToDuration(total, opts);
  const parts: string[] = [];
  if (p.days) parts.push(`${p.days}${u.d}`);
  if (p.hours) parts.push(`${p.hours}${u.h}`);
  if (p.minutes) parts.push(`${p.minutes}${u.m}`);
  if (p.seconds) parts.push(`${p.seconds}${u.s}`);
  return parts.length ? parts.join(" ") : `0${u.s}`;
}
