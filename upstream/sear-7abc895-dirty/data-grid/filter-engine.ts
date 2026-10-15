/**
 * Generic CRM-style filter model shared by every <DataGrid>. A FilterQuery is a conjunction
 * ("and"|"or") over flat conditions `{field, operator, value}`. It serializes cleanly to localStorage
 * AND to Frappe `get_list` filters (see filter-to-frappe.ts). `value` is always a string (comma-separated
 * for in/not_in). `applyFilterQuery` evaluates client-side too — used by the mock/Frontend-phase mode.
 */
export type FieldType = "text" | "select" | "number" | "date" | "boolean" | "link";

export type Operator =
  | "equals" | "not_equals" | "like" | "not_like" | "in" | "not_in"
  | "gt" | "lt" | "gte" | "lte" | "is_set" | "is_not_set";

export interface FilterField {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  link_doctype?: string; // for type:"link" — autocomplete target
  fieldtype?: string; // raw Frappe fieldtype, for cell rendering
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: Operator;
  value: string;
}

export interface FilterQuery {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
}

export const EMPTY_QUERY: FilterQuery = { conjunction: "and", conditions: [] };

export const OPERATOR_LABEL: Record<Operator, string> = {
  equals: "op_equals", not_equals: "op_not_equals", like: "op_like", not_like: "op_not_like",
  in: "op_in", not_in: "op_not_in", gt: "op_gt", lt: "op_lt", gte: "op_gte", lte: "op_lte",
  is_set: "op_is_set", is_not_set: "op_is_not_set",
};

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ["like", "not_like", "equals", "not_equals", "is_set", "is_not_set"],
  select: ["equals", "not_equals", "in", "not_in", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "gt", "lt", "gte", "lte", "is_set", "is_not_set"],
  date: ["equals", "lt", "gt", "gte", "lte", "is_set", "is_not_set"],
  boolean: ["equals"],
  link: ["equals", "not_equals", "in", "not_in", "like", "is_set", "is_not_set"],
};

export const VALUELESS_OPERATORS: Operator[] = ["is_set", "is_not_set"];

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
    return { equals: a === b, not_equals: a !== b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b }[c.operator as string] ?? false;
  }
  if (type === "date") {
    const a = new Date(asString(raw)).getTime(), b = new Date(c.value).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return { equals: a === b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b }[c.operator as string] ?? false;
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

export function applyFilterQuery<T>(rows: T[], query: FilterQuery | undefined, fields: FilterField[]): T[] {
  if (!query || query.conditions.length === 0) return rows;
  const byName = new Map(fields.map((f) => [f.name, f]));
  const active = query.conditions.filter((c) => c.field && (VALUELESS_OPERATORS.includes(c.operator) || c.value !== ""));
  if (active.length === 0) return rows;
  return rows.filter((row) => {
    const r = row as unknown as Record<string, unknown>;
    const res = active.map((c) => evalCondition(r, c, byName.get(c.field)));
    return query.conjunction === "and" ? res.every(Boolean) : res.some(Boolean);
  });
}

export function activeConditionCount(query: FilterQuery | undefined): number {
  if (!query) return 0;
  return query.conditions.filter((c) => c.field && (VALUELESS_OPERATORS.includes(c.operator) || c.value !== "")).length;
}

let _seq = 0;
export const newCondition = (field = "", operator: Operator = "like"): FilterCondition => ({
  id: `c${++_seq}_${Math.round(performance.now())}`,
  field,
  operator,
  value: "",
});
