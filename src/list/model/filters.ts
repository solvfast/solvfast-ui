/**
 * Filter model shared by Sear's DataGrid (sear_product lib/data-grid/filter-engine.ts) and PMO's lists
 * (solvfast_pmo lib/filter-engine.ts) — the two were verified semantically identical. Pure TS.
 */
import type { Messages } from "../../theme/messages";

export type FieldType = "text" | "select" | "number" | "date" | "boolean" | "link";
export type Operator =
  | "equals" | "not_equals" | "like" | "not_like" | "in" | "not_in"
  | "gt" | "lt" | "gte" | "lte" | "is_set" | "is_not_set"
  /** Dates: value "YYYY-MM-DD,YYYY-MM-DD" (either side may be empty). */
  | "between"
  /** Dates: value is one of TIMESPANS ("last 7 days", "this month", …), resolved on the day the filter runs. */
  | "timespan"
  /** Dates: value is a FiscalYear `name`. */
  | "fiscal_year";

/** A fiscal year the date filters can offer (Frappe/ERPNext "Fiscal Year"); `from` / `to` are YYYY-MM-DD. */
export interface FiscalYear { name: string; from: string; to: string; }

export interface FilterField {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /** `type: "link"`: target the value input's `loadOptions` receives. */
  link_doctype?: string;
  /** Raw backend field type (e.g. Frappe "Currency"), for default cell rendering. */
  fieldtype?: string;
}
export interface FilterCondition { id: string; field: string; operator: Operator; value: string; }
export interface FilterQuery { conjunction: "and" | "or"; conditions: FilterCondition[]; }

export const EMPTY_QUERY: FilterQuery = { conjunction: "and", conditions: [] };

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ["like", "not_like", "equals", "not_equals", "is_set", "is_not_set"],
  select: ["equals", "not_equals", "in", "not_in", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "gt", "lt", "gte", "lte", "is_set", "is_not_set"],
  date: ["equals", "not_equals", "is_set", "is_not_set", "gt", "lt", "gte", "lte", "between", "timespan", "fiscal_year"],
  boolean: ["equals"],
  link: ["equals", "not_equals", "in", "not_in", "like", "is_set", "is_not_set"],
};
export const OPERATOR_LABEL: Record<Operator, keyof Messages> = {
  equals: "opEquals", not_equals: "opNotEquals", like: "opLike", not_like: "opNotLike", in: "opIn", not_in: "opNotIn",
  gt: "opGt", lt: "opLt", gte: "opGte", lte: "opLte", is_set: "opIsSet", is_not_set: "opIsNotSet",
  between: "opBetween", timespan: "opTimespan", fiscal_year: "opFiscalYear",
};
export const VALUELESS_OPERATORS: Operator[] = ["is_set", "is_not_set"];

/**
 * The operators the filter offers for a field, in Frappe's order (frappe/public/js/frappe/ui/filters/filter.js):
 * - dates: Equals / Not Equals (Frappe hides both on Datetime fields), Is, After, Before, On or After, On or Before,
 *   Between, Timespan, and Fiscal Year when the app supplies fiscal years (ERPNext adds it to Frappe the same way);
 * - "Is" (Set / Not Set) is one entry standing for is_set / is_not_set, as in Frappe.
 */
export function operatorsFor(field: FilterField | undefined, opts: { fiscalYears?: boolean } = {}): Operator[] {
  const type = field?.type ?? "text";
  if (type === "date") {
    const ops: Operator[] = field?.fieldtype === "Datetime" ? [] : ["equals", "not_equals"];
    ops.push("is_set", "gt", "lt", "gte", "lte", "between", "timespan");
    if (opts.fiscalYears) ops.push("fiscal_year");
    return ops;
  }
  return OPERATORS_BY_TYPE[type].filter((op) => op !== "is_not_set");
}

/** The operator a new condition on this field starts with (dates: Between, as Frappe's date filters are used). */
export const defaultOperator = (field: FilterField | undefined): Operator =>
  field?.type === "date" ? "between" : operatorsFor(field)[0] ?? "like";

/** Frappe's labels: dates say After / Before / On or After / On or Before; is_set and is_not_set are both "Is". */
export function operatorLabelKey(op: Operator, field?: FilterField): keyof Messages {
  if (op === "is_set" || op === "is_not_set") return "opIs";
  if (field?.type === "date") {
    const date: Partial<Record<Operator, keyof Messages>> = { gt: "opAfter", lt: "opBefore", gte: "opOnOrAfter", lte: "opOnOrBefore" };
    if (date[op]) return date[op]!;
  }
  return OPERATOR_LABEL[op];
}

// ---- Frappe's timespans (frappe.utils.data.get_timespan_date_range) -------------------------------------------------
export const TIMESPANS = [
  "last 7 days", "last 14 days", "last 30 days", "last 90 days", "last week", "last month", "last quarter", "last 6 months",
  "last year", "yesterday", "today", "tomorrow", "this week", "this month", "this quarter", "this year", "next 7 days",
  "next 14 days", "next 30 days", "next week", "next month", "next quarter", "next 6 months", "next year",
] as const;
export type Timespan = (typeof TIMESPANS)[number];
export const TIMESPAN_LABEL: Record<Timespan, keyof Messages> = {
  "last 7 days": "tsLast7Days", "last 14 days": "tsLast14Days", "last 30 days": "tsLast30Days", "last 90 days": "tsLast90Days",
  "last week": "tsLastWeek", "last month": "tsLastMonth", "last quarter": "tsLastQuarter", "last 6 months": "tsLast6Months",
  "last year": "tsLastYear", yesterday: "tsYesterday", today: "tsToday", tomorrow: "tsTomorrow", "this week": "tsThisWeek",
  "this month": "tsThisMonth", "this quarter": "tsThisQuarter", "this year": "tsThisYear", "next 7 days": "tsNext7Days",
  "next 14 days": "tsNext14Days", "next 30 days": "tsNext30Days", "next week": "tsNextWeek", "next month": "tsNextMonth",
  "next quarter": "tsNextQuarter", "next 6 months": "tsNext6Months", "next year": "tsNextYear",
};

const pad = (n: number) => String(n).padStart(2, "0");
/** A local date as YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (y: number, m: number, d: number) => new Date(y, m, d);
const addDays = (d: Date, n: number) => day(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthStart = (d: Date, months = 0) => day(d.getFullYear(), d.getMonth() + months, 1);
const monthEnd = (d: Date, months = 0) => day(d.getFullYear(), d.getMonth() + months + 1, 0);
const quarterStart = (d: Date, months = 0) => { const m = monthStart(d, months); return day(m.getFullYear(), m.getMonth() - (m.getMonth() % 3), 1); };
const quarterEnd = (d: Date, months = 0) => { const s = quarterStart(d, months); return day(s.getFullYear(), s.getMonth() + 3, 0); };
const yearStart = (d: Date, years = 0) => day(d.getFullYear() + years, 0, 1);
const yearEnd = (d: Date, years = 0) => day(d.getFullYear() + years, 11, 31);
const weekStart = (d: Date, startsOn: number) => addDays(d, -((d.getDay() - startsOn + 7) % 7));

/**
 * The date range of a timespan, as Frappe computes it on the server (frappe.utils.data.get_timespan_date_range), for
 * client-side filtering. `weekStartsOn` is Frappe's System Settings → First Day of the Week (0 = Sunday, its default).
 */
export function timespanRange(timespan: string, today = new Date(), weekStartsOn = 0): [Date, Date] | null {
  const t = day(today.getFullYear(), today.getMonth(), today.getDate());
  const week = (d: Date): [Date, Date] => { const s = weekStart(d, weekStartsOn); return [s, addDays(s, 6)]; };
  switch (timespan as Timespan) {
    case "last 7 days": return [addDays(t, -7), t];
    case "last 14 days": return [addDays(t, -14), t];
    case "last 30 days": return [addDays(t, -30), t];
    case "last 90 days": return [addDays(t, -90), t];
    case "last week": return week(addDays(t, -7));
    case "last month": return [monthStart(t, -1), monthEnd(t, -1)];
    case "last quarter": return [quarterStart(t, -3), quarterEnd(t, -3)];
    case "last 6 months": return [quarterStart(t, -6), quarterEnd(t, -3)];
    case "last year": return [yearStart(t, -1), yearEnd(t, -1)];
    case "yesterday": return [addDays(t, -1), addDays(t, -1)];
    case "today": return [t, t];
    case "tomorrow": return [addDays(t, 1), addDays(t, 1)];
    case "this week": return week(t);
    case "this month": return [monthStart(t), monthEnd(t)];
    case "this quarter": return [quarterStart(t), quarterEnd(t)];
    case "this year": return [yearStart(t), yearEnd(t)];
    case "next 7 days": return [t, addDays(t, 7)];
    case "next 14 days": return [t, addDays(t, 14)];
    case "next 30 days": return [t, addDays(t, 30)];
    case "next week": return week(addDays(t, 7));
    case "next month": return [monthStart(t, 1), monthEnd(t, 1)];
    case "next quarter": return [quarterStart(t, 3), quarterEnd(t, 3)];
    case "next 6 months": return [quarterStart(t, 3), quarterEnd(t, 6)];
    case "next year": return [yearStart(t, 1), yearEnd(t, 1)];
    default: return null;
  }
}

/** A Between value → [from, to] (either may be ""). */
export const splitRange = (value: string): [string, string] => { const [a = "", b = ""] = value.split(","); return [a.trim(), b.trim()]; };
export const joinRange = (from: string, to: string) => (from || to ? `${from},${to}` : "");

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
/** The calendar day of a stored value: Frappe dates/datetimes are local strings, so their first 10 characters. */
function dayOf(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : ymd(raw);
  const s = raw === undefined || raw === null ? "" : String(raw);
  const m = DATE_PREFIX.exec(s);
  if (m) return m[1];
  const d = new Date(s);
  return s && !Number.isNaN(d.getTime()) ? ymd(d) : null;
}

// Condition ids are unique per page load (PMO restarted its counter per component mount, so ids could collide).
let seq = 0;
const runId = Math.random().toString(36).slice(2, 7);
export const newCondition = (field = "", operator: Operator = "like"): FilterCondition => ({ id: `c${runId}_${++seq}`, field, operator, value: "" });

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const asString = (v: unknown) => (v === undefined || v === null ? "" : String(v));

function evalCondition(row: Record<string, unknown>, c: FilterCondition, field?: FilterField, fiscalYears?: FiscalYear[]): boolean {
  const raw = row[c.field];
  if (c.operator === "is_set") return !isBlank(raw);
  if (c.operator === "is_not_set") return isBlank(raw);
  const type = field?.type ?? "text";
  const list = Array.isArray(raw) ? raw.map(asString) : null;
  if (c.operator === "in" || c.operator === "not_in") {
    const wanted = c.value.split(",").map((s) => s.trim()).filter(Boolean);
    const hit = list ? list.some((x) => wanted.includes(x)) : wanted.includes(asString(raw));
    return c.operator === "in" ? hit : !hit;
  }
  if (type === "number") {
    const a = Number(raw), b = Number(c.value);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return ({ equals: a === b, not_equals: a !== b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b } as Record<string, boolean>)[c.operator] ?? false;
  }
  if (type === "date") {
    // By calendar day, as the Frappe layer sends them (After 15 Oct excludes all of 15 Oct; Equals covers the day).
    const d = dayOf(raw);
    if (!d) return false;
    if (c.operator === "between") { const [a, b] = splitRange(c.value); return (!a || d >= a) && (!b || d <= b); }
    if (c.operator === "timespan") { const r = timespanRange(c.value); return !!r && d >= ymd(r[0]) && d <= ymd(r[1]); }
    if (c.operator === "fiscal_year") { const fy = fiscalYears?.find((f) => f.name === c.value); return !!fy && d >= fy.from && d <= fy.to; }
    const v = dayOf(c.value);
    if (!v) return false;
    return ({ equals: d === v, not_equals: d !== v, gt: d > v, lt: d < v, gte: d >= v, lte: d <= v } as Record<string, boolean>)[c.operator] ?? false;
  }
  if (type === "boolean") return asString(raw) === c.value || (c.value === "true") === Boolean(raw);
  const target = c.value.toLowerCase();
  const hay = list ? list.map((x) => x.toLowerCase()) : [asString(raw).toLowerCase()];
  switch (c.operator) {
    case "equals": return hay.some((h) => h === target);
    case "not_equals": return !hay.some((h) => h === target);
    case "like": return hay.some((h) => h.includes(target));
    case "not_like": return !hay.some((h) => h.includes(target));
    default: return false;
  }
}

const isActiveCondition = (c: FilterCondition) =>
  !!c.field && (VALUELESS_OPERATORS.includes(c.operator) || (c.operator === "between" ? splitRange(c.value).some(Boolean) : c.value !== ""));

/** Apply a query to rows (client mode). Half-built conditions (no value yet) are ignored. */
export function applyFilterQuery<T>(rows: T[], query: FilterQuery | undefined, fields: FilterField[], opts: { fiscalYears?: FiscalYear[] } = {}): T[] {
  if (!query || !query.conditions.length) return rows;
  const byName = new Map(fields.map((f) => [f.name, f]));
  const active = query.conditions.filter(isActiveCondition);
  if (!active.length) return rows;
  return rows.filter((row) => {
    const res = active.map((c) => evalCondition(row as unknown as Record<string, unknown>, c, byName.get(c.field), opts.fiscalYears));
    return query.conjunction === "and" ? res.every(Boolean) : res.some(Boolean);
  });
}

/** Conditions that actually constrain the result (the filter button badge). */
export const activeConditionCount = (query: FilterQuery | undefined) => (query ? query.conditions.filter(isActiveCondition).length : 0);

// ---- quick filters (PMO lib/quick-filters.ts): they write into the same query, with stable `q:<field>` ids ----------
const quickId = (field: string) => `q:${field}`;
export const quickOperator = (field: FilterField): Operator => (field.type === "text" ? "like" : "equals");
export const getQuickValue = (query: FilterQuery, field: string) => query.conditions.find((c) => c.id === quickId(field))?.value ?? "";
export function setQuickValue(query: FilterQuery, field: FilterField, value: string): FilterQuery {
  const conditions = query.conditions.filter((c) => c.id !== quickId(field.name));
  if (value !== "") conditions.push({ id: quickId(field.name), field: field.name, operator: quickOperator(field), value });
  return { ...query, conditions };
}
