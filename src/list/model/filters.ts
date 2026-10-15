/**
 * Filter model shared by Sear's DataGrid (sear_product lib/data-grid/filter-engine.ts) and PMO's lists
 * (solvfast_pmo lib/filter-engine.ts) — the two were verified semantically identical. Pure TS.
 */
import type { Messages } from "../../theme/messages";

export type FieldType = "text" | "select" | "number" | "date" | "boolean" | "link";
export type Operator =
  | "equals" | "not_equals" | "like" | "not_like" | "in" | "not_in"
  | "gt" | "lt" | "gte" | "lte" | "is_set" | "is_not_set";

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
  date: ["equals", "lt", "gt", "gte", "lte", "is_set", "is_not_set"],
  boolean: ["equals"],
  link: ["equals", "not_equals", "in", "not_in", "like", "is_set", "is_not_set"],
};
export const OPERATOR_LABEL: Record<Operator, keyof Messages> = {
  equals: "opEquals", not_equals: "opNotEquals", like: "opLike", not_like: "opNotLike", in: "opIn", not_in: "opNotIn",
  gt: "opGt", lt: "opLt", gte: "opGte", lte: "opLte", is_set: "opIsSet", is_not_set: "opIsNotSet",
};
export const VALUELESS_OPERATORS: Operator[] = ["is_set", "is_not_set"];

// Condition ids are unique per page load (PMO restarted its counter per component mount, so ids could collide).
let seq = 0;
const runId = Math.random().toString(36).slice(2, 7);
export const newCondition = (field = "", operator: Operator = "like"): FilterCondition => ({ id: `c${runId}_${++seq}`, field, operator, value: "" });

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const asString = (v: unknown) => (v === undefined || v === null ? "" : String(v));

function evalCondition(row: Record<string, unknown>, c: FilterCondition, field?: FilterField): boolean {
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
    const a = new Date(asString(raw)).getTime(), b = new Date(c.value).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return ({ equals: a === b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b } as Record<string, boolean>)[c.operator] ?? false;
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

const isActiveCondition = (c: FilterCondition) => !!c.field && (VALUELESS_OPERATORS.includes(c.operator) || c.value !== "");

/** Apply a query to rows (client mode). Half-built conditions (no value yet) are ignored. */
export function applyFilterQuery<T>(rows: T[], query: FilterQuery | undefined, fields: FilterField[]): T[] {
  if (!query || !query.conditions.length) return rows;
  const byName = new Map(fields.map((f) => [f.name, f]));
  const active = query.conditions.filter(isActiveCondition);
  if (!active.length) return rows;
  return rows.filter((row) => {
    const res = active.map((c) => evalCondition(row as unknown as Record<string, unknown>, c, byName.get(c.field)));
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
