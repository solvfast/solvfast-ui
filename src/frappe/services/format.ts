/**
 * formatValue — Desk's read-only formatters (`frappe.format`, form/formatters.js; docs 12 §7-9), as plain strings.
 * Re-implemented from the documented behaviour (no Frappe code). Desk returns HTML (right-aligned divs, anchors, a
 * disabled checkbox); here every type returns text and the caller renders it (link target, alignment, checkbox).
 *
 * Rules kept exactly (Frappe 15.110):
 *  - Float: precision = df.precision || float_precision || none; a value without a fractional part shows no decimals
 *    (1.000 → "1"); a Float WITH `options` is formatted as Currency (with the float precision).
 *  - Int: integer, no grouping; `options = "File Size"` → "1.23M" / "4.50K".
 *  - Percent: precision = df.precision || float_precision || 2, then "%".
 *  - Currency: precision = numeric df.precision, else df.precision || currency_precision || 2; above 2 it narrows to the
 *    currency's fraction digits when the stored value has fewer decimals; symbol before (or after, symbol_on_right),
 *    hidden by hide_currency_symbol; number format of the currency only with use_number_format_from_currency.
 *  - Number grouping per number_format (incl. Indian #,##,###.##); rounding per rounding_method (default
 *    "Banker's Rounding (legacy)").
 *  - Date: user date format; Datetime: system zone → user zone, "<date format> <time format>"; Time: user time format,
 *    no zone conversion. Unparseable → "".
 *  - Select: translated value; Link: the link title when known, else the name; Dynamic Link: Link to doc[df.options].
 *  - Check: Desk draws a disabled checkbox — here `ctx.checkLabels` ("Yes" / "No").
 *  - Duration (seconds): "1d 2h 3m 4s", empty / 0 → "0s"; `hide_days` folds days into hours, `hide_seconds` rounds the
 *    seconds into the minutes (utils.js get_formatted_duration / seconds_to_duration).
 *  - Anything else: Data (null → "", IBAN grouped by 4).
 * Deliberate difference: `undefined` (a field the user cannot read is ABSENT from the doc) is "" for every type; Desk's
 * Float/Percent/Currency would print 0 for it.
 */
import type { FrappeDoc, FrappeDocField } from "../contract";

export type RoundingMethod = "Banker's Rounding (legacy)" | "Banker's Rounding" | "Commercial Rounding";

export interface CurrencyInfo {
  symbol?: string | null;
  symbol_on_right?: boolean | 0 | 1;
  number_format?: string | null;
  fraction_units?: number | null;
}

/**
 * Site / user settings the formatters need. Desk reads them from `frappe.boot.sysdefaults`, `frappe.boot.time_zone`
 * and the `:Currency` boot docs; a React app must supply them (there is no whitelisted 15.110 method returning boot
 * for a non-Desk page — docs 10 TODO). Every field is optional; the defaults below are Frappe's own fallbacks.
 */
export interface FormatContext {
  /** sysdefaults.date_format, e.g. "dd-mm-yyyy". Default "yyyy-mm-dd". */
  dateFormat?: string;
  /** sysdefaults.time_format, e.g. "HH:mm" . Default "HH:mm:ss". */
  timeFormat?: string;
  /** sysdefaults.number_format. Default "#,###.##". */
  numberFormat?: string;
  /** sysdefaults.float_precision (Desk falls back to 3 where no precision applies). */
  floatPrecision?: number | null;
  /** sysdefaults.currency_precision. */
  currencyPrecision?: number | null;
  /** sysdefaults.currency — the default currency. Default "USD". */
  currency?: string;
  /** Enabled Currency records by name (symbol, symbol_on_right, number_format, fraction_units). */
  currencies?: Record<string, CurrencyInfo>;
  /** sysdefaults.hide_currency_symbol === "Yes". */
  hideCurrencySymbol?: boolean;
  /** sysdefaults.use_number_format_from_currency. */
  useNumberFormatFromCurrency?: boolean;
  /** sysdefaults.rounding_method. Default "Banker's Rounding (legacy)". */
  roundingMethod?: RoundingMethod;
  /** frappe.boot.time_zone: Datetime values are stored in `system` and shown in `user`. No conversion when either is missing. */
  timeZone?: { system?: string; user?: string };
  /** Link titles by "Doctype::name" (getdoc's `_link_titles`, search results' labels). */
  linkTitles?: Record<string, string>;
  /** Translation of Select values and link labels (Desk's `__`). Default: identity. */
  translate?: (text: string) => string;
  /** Text for Check values. Default { yes: "Yes", no: "No" } — pass the UI language's words. */
  checkLabels?: { yes: string; no: string };
  /** Duration unit suffixes (Desk translates "d" / "h" / "m" / "s" with a Duration context). Default d, h, m, s. */
  durationUnits?: { d: string; h: string; m: string; s: string };
}

export const defaultFormatContext: Required<Omit<FormatContext, "floatPrecision" | "currencyPrecision" | "timeZone" | "linkTitles" | "translate" | "currencies">> = {
  dateFormat: "yyyy-mm-dd",
  timeFormat: "HH:mm:ss",
  numberFormat: "#,###.##",
  currency: "USD",
  hideCurrencySymbol: false,
  useNumberFormatFromCurrency: false,
  roundingMethod: "Banker's Rounding (legacy)",
  checkLabels: { yes: "Yes", no: "No" },
  durationUnits: { d: "d", h: "h", m: "m", s: "s" },
};

// ---- numbers -----------------------------------------------------------------------------------------------------------

const cint = (v: unknown): number => {
  if (typeof v === "boolean") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : 0;
  const n = parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** Decimal and group separators of Frappe's known number formats (unknown → "." and ","). */
const SEPARATORS: Record<string, [decimal: string, group: string]> = {
  "#,###.##": [".", ","], "#.###,##": [",", "."], "# ###.##": [".", " "], "# ###,##": [",", " "], "#'###.##": [".", "'"],
  "#, ###.##": [".", ", "], "#,##,###.##": [".", ","], "#,###.###": [".", ","], "#.###": ["", "."], "#,###": ["", ","],
};
function formatInfo(format: string) {
  const [dec, group] = SEPARATORS[format] ?? [".", ","];
  const precision = dec === "" ? 0 : (format.split(dec)[1] ?? "").length;
  return { dec, group, precision };
}

/** Round like Frappe's `flt` with the given method (number_format.js `_round`, described in docs 12 §8.1). */
export function roundNumber(num: number, precision: number, method: RoundingMethod = "Banker's Rounding (legacy)"): number {
  const negative = num < 0;
  const m = Math.pow(10, precision);
  if (method === "Commercial Rounding") {
    if (num === 0) return 0;
    const scaled = num * m;
    const eps = 2 ** (Math.log2(Math.abs(scaled)) - 52) * (negative ? -1 : 1);
    return Math.round(scaled + eps) / m;
  }
  if (method === "Banker's Rounding") {
    if (num === 0) return 0;
    const scaled = Math.abs(num) * m;
    const floor = Math.floor(scaled);
    const eps = 2 ** (Math.log2(scaled) - 52);
    const r = Math.abs(scaled - floor - 0.5) < eps ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
    return (negative ? -r : r) / m;
  }
  // legacy: half-to-even only at precision 0 for an exact .5; otherwise half away from zero (on the absolute value)
  const n = +(precision ? Math.abs(num) * m : Math.abs(num)).toFixed(8);
  const i = Math.floor(n);
  const r = !precision && n - i === 0.5 ? (i % 2 === 0 ? i : i + 1) : Math.round(n);
  const out = precision ? r / m : r;
  return negative ? -out : out;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** `format_number`: round, fix the decimals, group by 3 (Indian: 3 then 2), apply the format's separators. */
export function formatNumber(value: unknown, format: string = defaultFormatContext.numberFormat, decimals?: number | null, rounding?: RoundingMethod): string {
  const info = formatInfo(format);
  const places = decimals == null ? info.precision : decimals;
  const v = roundNumber(toNumber(value), places, rounding);
  const fixed = Math.abs(v).toFixed(places);
  const [intPart, fracPart] = fixed.split(".");
  let grouped = intPart;
  if (info.group) {
    const groups: string[] = [];
    let rest = intPart;
    let size = 3;
    while (rest.length > size) {
      groups.unshift(rest.slice(-size));
      rest = rest.slice(0, -size);
      if (format === "#,##,###.##") size = 2;
    }
    groups.unshift(rest);
    grouped = groups.join(info.group);
  }
  const frac = fracPart && info.dec ? info.dec + fracPart : "";
  return (v < 0 ? "-" : "") + (grouped || "0") + frac;
}

function numberFormatFor(ctx: FormatContext, currency?: string) {
  const fromCurrency = ctx.useNumberFormatFromCurrency && currency ? ctx.currencies?.[currency]?.number_format : undefined;
  return fromCurrency || ctx.numberFormat || defaultFormatContext.numberFormat;
}

/** `frappe.meta.get_field_currency` (docs 12 §8.2): `options` naming a field of the doc → that field's value; the
 *  "Doctype:link_field:currency_field" form needs the referenced record (e.g. a Company) loaded client-side, which this
 *  package does not do — it falls back to the default currency, as Desk does when the record is not in `locals`. */
export function fieldCurrency(df: FrappeDocField, doc?: FrappeDoc, ctx: FormatContext = {}): string {
  const fallback = ctx.currency || defaultFormatContext.currency;
  const opt = (df.options || "").trim();
  if (!opt) return fallback;
  if (opt.includes(":")) return fallback; // UNVERIFIED parity: needs the referenced record (e.g. Company) loaded
  const v = doc?.[opt];
  return typeof v === "string" && v ? v : fallback;
}

export function formatCurrency(value: unknown, currency: string, decimals: number | null | undefined, ctx: FormatContext = {}): string {
  const format = numberFormatFor(ctx, currency);
  const info = ctx.currencies?.[currency];
  const symbol = ctx.hideCurrencySymbol ? null : info?.symbol || currency;
  const places = decimals === undefined ? ctx.currencyPrecision ?? null : decimals;
  const n = formatNumber(value, format, places, ctx.roundingMethod);
  if (!symbol) return n;
  const sym = ctx.translate ? ctx.translate(symbol) : symbol;
  return info?.symbol_on_right ? `${n} ${sym}` : `${sym} ${n}`;
}

// ---- dates -------------------------------------------------------------------------------------------------------------

interface Parts { y: number; mo: number; d: number; h: number; mi: number; s: number }
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Lenient parse of the server's strings: "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss[.ffffff]", "H:MM:SS" (docs 12 §7.1). */
function parseDate(v: string): Parts | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(v.trim());
  if (!m) return null;
  const p = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31) return null;
  return p;
}
function parseTime(v: string): Parts | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(v.trim());
  return m ? { y: 1970, mo: 1, d: 1, h: +m[1], mi: +m[2], s: +(m[3] ?? 0) } : null;
}

/** Frappe's user formats are moment patterns once upper-cased (date) / as stored (time): YYYY YY MM M DD D HH H hh h mm ss A a. */
function applyPattern(pattern: string, p: Parts): string {
  return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|H|hh|h|mm|ss|A|a/g, (tok) => {
    switch (tok) {
      case "YYYY": return pad(p.y, 4);
      case "YY": return pad(p.y % 100);
      case "MM": return pad(p.mo);
      case "M": return String(p.mo);
      case "DD": return pad(p.d);
      case "D": return String(p.d);
      case "HH": return pad(p.h);
      case "H": return String(p.h);
      case "hh": return pad(p.h % 12 || 12);
      case "h": return String(p.h % 12 || 12);
      case "mm": return pad(p.mi);
      case "ss": return pad(p.s);
      case "A": return p.h < 12 ? "AM" : "PM";
      default: return p.h < 12 ? "am" : "pm";
    }
  });
}

function zoneParts(epochMs: number, timeZone: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const get = (t: string) => Number(f.formatToParts(new Date(epochMs)).find((x) => x.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}
const asUtc = (p: Parts) => Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);

/** Wall time in `from` → wall time in `to` (Intl only, no dependency). */
export function convertZone(p: Parts, from: string, to: string): Parts {
  try {
    const guess = asUtc(p);
    let instant = guess - (asUtc(zoneParts(guess, from)) - guess);
    instant = guess - (asUtc(zoneParts(instant, from)) - instant);
    return zoneParts(instant, to);
  } catch {
    return p; // unknown zone name: no conversion
  }
}

export function formatDate(value: unknown, ctx: FormatContext = {}): string {
  if (!value) return "";
  const p = parseDate(String(value));
  return p ? applyPattern((ctx.dateFormat || defaultFormatContext.dateFormat).toUpperCase(), p) : "";
}

export function formatDatetime(value: unknown, ctx: FormatContext = {}): string {
  if (!value) return "";
  let p = parseDate(String(value));
  if (!p) return "";
  const { system, user } = ctx.timeZone ?? {};
  if (system && user && system !== user) p = convertZone(p, system, user);
  const pattern = `${(ctx.dateFormat || defaultFormatContext.dateFormat).toUpperCase()} ${ctx.timeFormat || defaultFormatContext.timeFormat}`;
  return applyPattern(pattern, p);
}

export function formatTime(value: unknown, ctx: FormatContext = {}): string {
  if (!value) return "";
  const p = parseTime(String(value));
  return p ? applyPattern(ctx.timeFormat || defaultFormatContext.timeFormat, p) : "";
}

// ---- durations ---------------------------------------------------------------------------------------------------------

/** `seconds_to_duration`: floor toward zero (ceil for negatives); `hide_days` puts everything in hours; `hide_seconds`
 *  adds round(seconds / 60) to the minutes (which can reach 60 — native does not carry). */
export function secondsToDuration(seconds: number, opts: { hideDays?: boolean; hideSeconds?: boolean } = {}) {
  const floor = seconds > 0 ? Math.floor : Math.ceil;
  const out = { days: floor(seconds / 86400), hours: floor((seconds % 86400) / 3600), minutes: floor((seconds % 3600) / 60), seconds: floor(seconds % 60) };
  if (opts.hideDays) { out.hours = floor(seconds / 3600); out.days = 0; }
  if (opts.hideSeconds) { out.minutes += Math.round(out.seconds / 60); out.seconds = 0; }
  return out;
}

/** Desk's Duration formatter: "1d 2h 3m 4s"; zero parts omitted; nothing to show → "0s". */
export function formatDuration(value: unknown, df: Record<string, unknown> = {}, ctx: FormatContext = {}): string {
  const u = ctx.durationUnits ?? { d: "d", h: "h", m: "m", s: "s" };
  const n = Number(value);
  if (!value || Number.isNaN(n) || !n) return `0${u.s}`;
  const d = secondsToDuration(n, { hideDays: !!cint(df.hide_days), hideSeconds: !!cint(df.hide_seconds) });
  const parts: string[] = [];
  if (d.days && cint(df.hide_days) !== 1) parts.push(`${d.days}${u.d}`);
  if (d.hours) parts.push(`${d.hours}${u.h}`);
  if (d.minutes) parts.push(`${d.minutes}${u.m}`);
  if (d.seconds && cint(df.hide_seconds) !== 1) parts.push(`${d.seconds}${u.s}`);
  return parts.join(" ") || `0${u.s}`;
}

// ---- formatValue -------------------------------------------------------------------------------------------------------

const str = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const tr = (ctx: FormatContext, s: string) => (s && ctx.translate ? ctx.translate(s) : s);

/** `df.precision` is a string in metadata; Desk also sets numbers on it programmatically (Float → Currency). */
type PrecisionDf = Omit<FrappeDocField, "precision"> & { precision?: string | number };

function currencyPrecision(df: PrecisionDf, value: unknown, currency: string, ctx: FormatContext): number {
  let precision = typeof df.precision === "number" ? df.precision : cint(df.precision || ctx.currencyPrecision || 2);
  if (precision > 2) {
    const decimals = str(value).split(".")[1] ?? "";
    if (decimals.length < 3 || decimals.length < precision) {
      const fraction = String(ctx.currencies?.[currency]?.fraction_units || 100);
      if (decimals.length < fraction.length) precision = fraction.length - 1;
    }
  }
  return precision;
}

/** Desk's read-only display of a value (docs 12 §9), as text. See the module comment for the rules. */
export function formatValue(value: unknown, df: FrappeDocField, doc?: FrappeDoc, ctx: FormatContext = {}): string {
  if (value === undefined) return "";
  const fieldtype = df?.fieldtype || "Data";
  switch (fieldtype) {
    case "Int": {
      if (value === null) return "";
      if (str(df.options).trim() === "File Size") {
        const n = cint(value);
        return n > 1048576 ? (n / 1048576).toFixed(2) + "M" : n > 1024 ? (n / 1024).toFixed(2) + "K" : String(n);
      }
      return String(cint(value));
    }
    case "Float": {
      if (value === null) return "";
      let precision: number | null = cint(df.precision) || cint(ctx.floatPrecision) || null;
      if (str(df.options).trim()) {
        const currency = fieldCurrency(df, doc, ctx);
        // Desk hands the float precision (or none) to the Currency formatter (formatters.js Float → Currency)
        return formatCurrency(value, currency, currencyPrecision({ ...df, precision: precision ?? undefined }, value, currency, ctx), ctx);
      }
      if (value !== "") {
        const frac = str(value).split(".")[1];
        if (frac === undefined || cint(frac) === 0) precision = 0;
      }
      return formatNumber(value === "" ? 0 : value, numberFormatFor(ctx), precision ?? (cint(ctx.floatPrecision) || 3), ctx.roundingMethod);
    }
    case "Percent": {
      if (value === null) return "";
      const precision = cint(df.precision) || cint(ctx.floatPrecision) || 2;
      return formatNumber(value, numberFormatFor(ctx), precision, ctx.roundingMethod) + "%";
    }
    case "Currency": {
      if (value === null) return "";
      const currency = fieldCurrency(df, doc, ctx);
      return formatCurrency(value === "" ? 0 : value, currency, currencyPrecision(df, value, currency, ctx), ctx);
    }
    case "Check": {
      const labels = ctx.checkLabels ?? defaultFormatContext.checkLabels;
      return cint(value) ? labels.yes : labels.no;
    }
    case "Select":
    case "Autocomplete":
      return tr(ctx, str(value));
    case "Date":
      return formatDate(value, ctx);
    case "Datetime":
      return formatDatetime(value, ctx);
    case "Time":
      return formatTime(value, ctx);
    case "Duration":
      return formatDuration(value, df, ctx);
    case "Link":
    case "Dynamic Link": {
      if (!value) return "";
      const target = fieldtype === "Dynamic Link" ? str(doc?.[df.options || ""]) : str(df.options);
      const name = str(value);
      if (/^'.*'$/.test(name)) return name.slice(1, -1);
      const title = target ? ctx.linkTitles?.[`${target}::${name}`] : undefined;
      return tr(ctx, title && title !== name ? title : name);
    }
    default: {
      if (value === null) return "";
      if (fieldtype === "Data" && df.options === "IBAN") {
        const iban = str(value);
        return !iban || ["BI", "SV", "EG", "LY"].some((c) => iban.startsWith(c)) ? iban : iban.replace(/ /g, "").replace(/(.{4})(?=.)/g, "$1 ");
      }
      return str(value);
    }
  }
}
