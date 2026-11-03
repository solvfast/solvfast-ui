/**
 * Locale number parsing and formatting for the generic number controls. Frappe-free, pure TypeScript.
 *
 * Behaviour reproduced (docs `12` §2, §8, Frappe 15.110):
 *  - number formats are the System Settings patterns (`#,###.##`, `#.###,##`, `# ###.##`, `# ###,##`, `#'###.##`,
 *    `#, ###.##`, `#,##,###.##`, `#,###.###`, `#.###`, `#,###`); an unknown pattern behaves like `#,###.##`.
 *    The separators are read from the pattern itself; the two group-only patterns (`#.###`, `#,###`) have no decimals.
 *  - the precision a pattern implies is the number of digits after its decimal separator;
 *  - Int / Float inputs accept simple arithmetic (`0-9 + - * / . ( )` and spaces). Desk evaluates it with `eval`;
 *    here a small recursive-descent parser does it, so nothing is ever executed;
 *  - the user's group separators are stripped and the decimal separator converted before parsing;
 *  - formatting groups by 3 (Indian `#,##,###.##`: 3, then 2) and prefixes `-` for negatives;
 *  - rounding methods: "Banker's Rounding (legacy)" (the System Settings default), "Banker's Rounding",
 *    "Commercial Rounding". UNVERIFIED: the exact tie-breaking epsilon of the legacy method; here legacy and
 *    banker's both round half to even.
 */

export type RoundingMethod = "Banker's Rounding (legacy)" | "Banker's Rounding" | "Commercial Rounding";

export interface NumberFormatInfo {
  /** Decimal separator ("" for the group-only patterns). */
  decimal: string;
  group: string;
  /** Digits after the decimal separator in the pattern. */
  precision: number;
  /** `#,##,###.##`: groups of 3, then 2. */
  indian: boolean;
}

const KNOWN: Record<string, { decimal: string; group: string }> = {
  "#,###.##": { decimal: ".", group: "," },
  "#.###,##": { decimal: ",", group: "." },
  "# ###.##": { decimal: ".", group: " " },
  "# ###,##": { decimal: ",", group: " " },
  "#'###.##": { decimal: ".", group: "'" },
  "#, ###.##": { decimal: ".", group: ", " },
  "#,##,###.##": { decimal: ".", group: "," },
  "#,###.###": { decimal: ".", group: "," },
  "#.###": { decimal: "", group: "." },
  "#,###": { decimal: "", group: "," },
};

export const DEFAULT_NUMBER_FORMAT = "#,###.##";

export function numberFormatInfo(format?: string | null): NumberFormatInfo {
  const f = format || DEFAULT_NUMBER_FORMAT;
  const known = KNOWN[f] ?? KNOWN[DEFAULT_NUMBER_FORMAT];
  const precision = known.decimal ? (f.split(known.decimal)[1] ?? "").length : 0;
  return { ...known, precision: KNOWN[f] ? precision : 2, indian: f === "#,##,###.##" };
}

/** Eastern Arabic (٠-٩) and Persian (۰-۹) digits → ASCII, so Arabic keyboards type numbers. Arabic decimal and group
 *  separators (٫ ٬) are mapped to the pattern's. */
export function normalizeDigits(text: string, info?: NumberFormatInfo): string {
  let out = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (info) out = out.replace(/٫/g, info.decimal || ".").replace(/٬/g, info.group);
  return out;
}

// ---- safe arithmetic --------------------------------------------------------------------------------------------

/** Evaluate `0-9 + - * / . ( )` and spaces with the usual precedence. Returns NaN for anything else. */
export function evaluateArithmetic(src: string): number {
  if (!/^[0-9+\-*/.()\s]*$/.test(src) || !/[0-9]/.test(src)) return NaN;
  const s = src.replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) throw new Error("number");
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number => {
    const c = peek();
    if (c === "+") { i++; return factor(); }
    if (c === "-") { i++; return -factor(); }
    if (c === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("paren");
      i++;
      return v;
    }
    return num();
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    return i === s.length && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

// ---- parse --------------------------------------------------------------------------------------------------------

export interface ParseNumberOptions {
  format?: string | null;
  /** Evaluate arithmetic (Desk does for Int / Float / Currency / Percent). Default true. */
  allowExpressions?: boolean;
}

/** User text → number, or null when empty / not a number. Group separators stripped, decimal separator converted. */
export function parseLocaleNumber(text: string | null | undefined, opts: ParseNumberOptions = {}): number | null {
  if (text == null) return null;
  const info = numberFormatInfo(opts.format);
  // whitespace is never significant (space group separators; arithmetic ignores it too)
  let s = normalizeDigits(String(text), info).replace(/\s+/g, "");
  if (!s) return null;
  const group = info.group.trim();
  if (group) s = s.split(group).join("");
  if (info.decimal && info.decimal !== ".") s = s.split(info.decimal).join(".");
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  if (opts.allowExpressions === false) return null;
  const v = evaluateArithmetic(s);
  return Number.isNaN(v) ? null : v;
}

// ---- rounding --------------------------------------------------------------------------------------------------

export function roundNumber(value: number, precision: number | null | undefined, method: RoundingMethod = "Banker's Rounding (legacy)"): number {
  if (precision == null || !Number.isFinite(value)) return value;
  const p = Math.max(0, Math.min(15, Math.trunc(precision)));
  const factor = 10 ** p;
  // the scaled value, corrected for binary noise (1.005 * 100 = 100.49999999999999)
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let r: number;
  if (method === "Commercial Rounding") r = diff >= 0.5 ? floor + 1 : floor;
  else if (Math.abs(diff - 0.5) < 1e-9) r = floor % 2 === 0 ? floor : floor + 1;
  else r = Math.round(scaled);
  const out = (Math.sign(value) || 1) * (r / factor);
  return Object.is(out, -0) ? 0 : out;
}

/** Truncate toward zero like Frappe's `cint` (null for NaN). */
export const toInt = (v: number | null): number | null => (v == null || Number.isNaN(v) ? null : Math.trunc(v));

// ---- format ----------------------------------------------------------------------------------------------------

/**
 * number → text in a number format. `precision` null/undefined keeps the value's own decimals (no rounding, no padding).
 */
export function formatLocaleNumber(
  value: number | null | undefined,
  opts: { format?: string | null; precision?: number | null; rounding?: RoundingMethod } = {},
): string {
  if (value == null || Number.isNaN(value)) return "";
  const info = numberFormatInfo(opts.format);
  const precision = opts.precision == null ? null : Math.max(0, Math.trunc(opts.precision));
  const rounded = roundNumber(value, precision, opts.rounding);
  const negative = rounded < 0;
  let fixed = precision == null ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(precision);
  if (/e/i.test(fixed)) fixed = Math.abs(rounded).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  const [intPart, frac = ""] = fixed.split(".");
  const grouped = groupDigits(intPart, info);
  const decimalSep = info.decimal || ".";
  const body = frac && (info.decimal || precision == null) ? `${grouped}${decimalSep}${frac}` : grouped;
  return negative ? `-${body}` : body;
}

function groupDigits(intPart: string, info: NumberFormatInfo): string {
  if (!info.group || intPart.length <= 3) return intPart;
  if (info.indian) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, info.group);
    return `${rest}${info.group}${last3}`;
  }
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, info.group);
}
