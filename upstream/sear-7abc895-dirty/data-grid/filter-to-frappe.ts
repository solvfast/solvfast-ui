/**
 * Translate a FilterQuery into Frappe `get_list` filters. Returns `{ filters, or_filters }`:
 * AND conditions go in `filters`; if the query conjunction is OR (and there's >1 condition) they go in
 * `or_filters` instead (Frappe semantics: base AND (a OR b)). Filtering is enforced server-side by get_list.
 */
import type { FilterQuery, FilterCondition, FilterField, Operator } from "./filter-engine";
import { VALUELESS_OPERATORS } from "./filter-engine";

export type FrappeFilter = [string, string, unknown];

const OP_MAP: Partial<Record<Operator, string>> = {
  equals: "=", not_equals: "!=", like: "like", not_like: "not like",
  in: "in", not_in: "not in", gt: ">", lt: "<", gte: ">=", lte: "<=",
};

function toFrappe(c: FilterCondition, field?: FilterField): FrappeFilter | null {
  if (c.operator === "is_set") return [c.field, "is", "set"];
  if (c.operator === "is_not_set") return [c.field, "is", "not set"];
  if (!c.value && !VALUELESS_OPERATORS.includes(c.operator)) return null;

  if (c.operator === "in" || c.operator === "not_in") {
    const arr = c.value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!arr.length) return null;
    return [c.field, OP_MAP[c.operator]!, arr];
  }
  if (c.operator === "like" || c.operator === "not_like") {
    return [c.field, OP_MAP[c.operator]!, `%${c.value}%`];
  }
  if (field?.type === "boolean") {
    return [c.field, "=", c.value === "true" || c.value === "1" ? 1 : 0];
  }
  const op = OP_MAP[c.operator];
  return op ? [c.field, op, c.value] : null;
}

export function queryToFrappe(
  query: FilterQuery | undefined,
  fields: FilterField[],
): { filters: FrappeFilter[]; or_filters: FrappeFilter[] } {
  if (!query || !query.conditions.length) return { filters: [], or_filters: [] };
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: FrappeFilter[] = [];
  for (const c of query.conditions) {
    if (!c.field || !c.operator) continue;
    const f = toFrappe(c, byName.get(c.field));
    if (f) out.push(f);
  }
  if (!out.length) return { filters: [], or_filters: [] };
  if (query.conjunction === "or" && out.length > 1) return { filters: [], or_filters: out };
  return { filters: out, or_filters: [] };
}
