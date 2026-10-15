/**
 * Canonical date/time formatting for Sear Studio.
 *
 * Ports the Design System's formatter (design_system StyleGuide `DateTimeInput.fmt`) so every
 * surface reads the same. Before this, 13 call sites used six different locale/option
 * combinations — `ar-EG` (Arabic-Indic digits), `ar-SA`, `ar`, `en-US`, `en-GB`, `undefined` —
 * so the same date rendered differently screen to screen. The DS Don't-list for the date field
 * names that explicitly: "hardcode one global date format".
 *
 * DS rule: month NAME is localized; digits stay Latin (assembled manually, never via a
 * locale that switches numeral systems). Meridiem is ص/م in Arabic.
 */

/** DS canonical: `18 Aug 2026` / `18 أغسطس 2026`. */
export function formatDate(d: Date, isAr: boolean): string {
  const month = d.toLocaleString(isAr ? "ar" : "en-US", { month: "short" });
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

/**
 * `Sat, 18 Aug 2026` / `السبت، 18 أغسطس 2026`.
 * Not a DS formatter — the DS has no weekday form — but built to the same rules
 * (localized names, Latin digits) for the one surface that shows a weekday.
 */
export function formatDateWithWeekday(d: Date, isAr: boolean): string {
  const weekday = d.toLocaleString(isAr ? "ar" : "en-US", { weekday: "short" });
  return `${weekday}${isAr ? "، " : ", "}${formatDate(d, isAr)}`;
}

/** DS canonical: `10:30 AM` / `10:30 ص`. */
export function formatTime(d: Date, isAr: boolean): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? (isAr ? "م" : "PM") : (isAr ? "ص" : "AM");
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

/** DS canonical: `18 Aug 2026, 10:30 AM` / `18 أغسطس 2026، 10:30 ص`. */
export function formatDateTime(d: Date, isAr: boolean): string {
  return `${formatDate(d, isAr)}${isAr ? "، " : ", "}${formatTime(d, isAr)}`;
}

/* ---- string <-> Date helpers -------------------------------------------------------------
 * The studio stores dates as the native-input strings ("YYYY-MM-DD", "HH:mm",
 * "YYYY-MM-DDTHH:mm"). These keep that wire format unchanged so business logic is untouched.
 */

export function parseDateValue(v: string | undefined | null): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "HH:mm" (24h) -> {h, m}; invalid input yields undefined. */
export function parseTimeValue(v: string | undefined | null): { h: number; m: number } | undefined {
  if (!v) return undefined;
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  return { h, m };
}

export function toTimeValue(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseDateTimeValue(v: string | undefined | null): Date | undefined {
  if (!v) return undefined;
  const [datePart, timePart] = v.split("T");
  const d = parseDateValue(datePart);
  if (!d) return undefined;
  const t = parseTimeValue(timePart);
  if (t) d.setHours(t.h, t.m, 0, 0);
  return d;
}

export function toDateTimeValue(d: Date): string {
  return `${toDateValue(d)}T${toTimeValue(d.getHours(), d.getMinutes())}`;
}

/** Display a stored value without constructing a Date at the call site. */
export function displayDate(v: string | undefined | null, isAr: boolean): string {
  const d = parseDateValue(v);
  return d ? formatDate(d, isAr) : "";
}

export function displayTime(v: string | undefined | null, isAr: boolean): string {
  const t = parseTimeValue(v);
  if (!t) return "";
  const d = new Date(2000, 0, 1, t.h, t.m);
  return formatTime(d, isAr);
}
