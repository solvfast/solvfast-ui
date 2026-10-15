/**
 * Generic, CRM-style client-side filter engine shared by every list view (projects, tasks, bugs, …).
 *
 * A FilterQuery is a conjunction ("and" | "or") over a flat list of conditions, each
 * `{ field, operator, value }`. `applyFilterQuery` evaluates it against any row array. Operators are
 * grouped by field type; `value` is always stored as a string (comma-separated for in/not_in) so the
 * whole query serializes cleanly to localStorage and, later, to the backend `get_list` filter contract.
 */

export type FieldType = "text" | "select" | "number" | "date" | "boolean" | "link";

export type Operator =
  | "equals"
  | "not_equals"
  | "like"
  | "not_like"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "is_set"
  | "is_not_set";

export interface FilterField {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /** For `type:"link"` — the target doctype to autocomplete against. */
  link_doctype?: string;
  /** Raw Frappe fieldtype (e.g. "Currency", "Data", "Datetime") — used for generic column rendering. */
  fieldtype?: string;
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

/** i18n keys for each operator label (resolved in the UI via `t()`). */
export const OPERATOR_LABEL: Record<Operator, string> = {
  equals: "op_equals",
  not_equals: "op_not_equals",
  like: "op_like",
  not_like: "op_not_like",
  in: "op_in",
  not_in: "op_not_in",
  gt: "op_gt",
  lt: "op_lt",
  gte: "op_gte",
  lte: "op_lte",
  is_set: "op_is_set",
  is_not_set: "op_is_not_set",
};

/** Which operators are offered for each field type. */
export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ["like", "not_like", "equals", "not_equals", "is_set", "is_not_set"],
  select: ["equals", "not_equals", "in", "not_in", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "gt", "lt", "gte", "lte", "is_set", "is_not_set"],
  date: ["equals", "lt", "gt", "gte", "lte", "is_set", "is_not_set"],
  boolean: ["equals"],
  link: ["equals", "not_equals", "in", "not_in", "like", "is_set", "is_not_set"],
};

/** Operators that don't take a value input. */
export const VALUELESS_OPERATORS: Operator[] = ["is_set", "is_not_set"];

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function asString(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function evalCondition(row: Record<string, unknown>, cond: FilterCondition, field?: FilterField): boolean {
  const raw = row[cond.field];

  if (cond.operator === "is_set") return !isBlank(raw);
  if (cond.operator === "is_not_set") return isBlank(raw);

  const type = field?.type ?? "text";
  const list = Array.isArray(raw) ? raw.map(asString) : null;

  // Comma-separated multi-value operators.
  if (cond.operator === "in" || cond.operator === "not_in") {
    const wanted = cond.value.split(",").map((s) => s.trim()).filter(Boolean);
    const hit = list ? list.some((x) => wanted.includes(x)) : wanted.includes(asString(raw));
    return cond.operator === "in" ? hit : !hit;
  }

  if (type === "number") {
    const a = Number(raw);
    const b = Number(cond.value);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (cond.operator) {
      case "equals": return a === b;
      case "not_equals": return a !== b;
      case "gt": return a > b;
      case "lt": return a < b;
      case "gte": return a >= b;
      case "lte": return a <= b;
      default: return false;
    }
  }

  if (type === "date") {
    const a = new Date(asString(raw)).getTime();
    const b = new Date(cond.value).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (cond.operator) {
      case "equals": return a === b;
      case "gt": return a > b;
      case "lt": return a < b;
      case "gte": return a >= b;
      case "lte": return a <= b;
      default: return false;
    }
  }

  if (type === "boolean") {
    return asString(raw) === cond.value || (cond.value === "true") === Boolean(raw);
  }

  // text / select / link (string compare)
  const target = cond.value.toLowerCase();
  const hay = list ? list.map((x) => x.toLowerCase()) : [asString(raw).toLowerCase()];
  switch (cond.operator) {
    case "equals": return hay.some((h) => h === target);
    case "not_equals": return !hay.some((h) => h === target);
    case "like": return hay.some((h) => h.includes(target));
    case "not_like": return !hay.some((h) => h.includes(target));
    default: return false;
  }
}

/** Apply a FilterQuery to a list of rows. An empty query returns the rows unchanged. */
export function applyFilterQuery<T>(
  rows: T[],
  query: FilterQuery | undefined,
  fields: FilterField[],
): T[] {
  if (!query || query.conditions.length === 0) return rows;
  const byName = new Map(fields.map((f) => [f.name, f]));
  // Conditions still missing a value (and not valueless) are ignored, so a half-built row doesn't hide data.
  const active = query.conditions.filter(
    (c) => c.field && (VALUELESS_OPERATORS.includes(c.operator) || c.value !== ""),
  );
  if (active.length === 0) return rows;

  return rows.filter((row) => {
    const r = row as unknown as Record<string, unknown>;
    const results = active.map((c) => evalCondition(r, c, byName.get(c.field)));
    return query.conjunction === "and" ? results.every(Boolean) : results.some(Boolean);
  });
}

/** Count of conditions that actually constrain the result (for the filter button badge). */
export function activeConditionCount(query: FilterQuery | undefined): number {
  if (!query) return 0;
  return query.conditions.filter(
    (c) => c.field && (VALUELESS_OPERATORS.includes(c.operator) || c.value !== ""),
  ).length;
}
