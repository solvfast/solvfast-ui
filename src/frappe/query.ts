/**
 * List View state → Frappe `get_list` / `get_count` arguments. Pure TS.
 * - Filters: Sear lib/data-grid/filter-to-frappe.ts + PMO api/_utils.py value coercion (Check → 1/0, numbers →
 *   numbers). Conditions on fields the DocType doesn't have are dropped: Frappe rejects the whole request on an
 *   unknown field, so one stale saved filter would otherwise break the list.
 * - Date-only values on Datetime fields cover the whole day (Created On = 15 Oct matches all of 15 Oct; Sear compared
 *   with midnight).
 * - Rule C2 (Frappe takes ONE `or_filters` list): search uses `or_filters` across the search fields unless the filter
 *   conjunction already needs it; then search narrows to the title field, AND-ed, and `searchNarrowed` is set so the
 *   UI can say so.
 * - Fields / order_by only ever name real fields: column keys are mapped through `field`, unknown ones dropped.
 */
import { fieldOf, type ColumnDef } from "../list/model/columns";
import { TIMESPANS, VALUELESS_OPERATORS, splitRange, type FilterCondition, type FilterQuery, type FiscalYear, type Operator } from "../list/model/filters";
import type { SortState } from "../list/model/sort";

/** `[fieldname, operator, value]` (or `[doctype, fieldname, operator, value]`, passed through). */
export type FrappeFilter = [string, string, unknown] | [string, string, string, unknown];

const OP: Partial<Record<Operator, string>> = { equals: "=", not_equals: "!=", gt: ">", lt: "<", gte: ">=", lte: "<=" };
const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY = " 23:59:59.999999";

/** A string value in the column's stored type (PMO `_coerce`); `undefined` = not a valid value → skip. */
function coerce(value: string, fieldtype?: string): unknown {
  if (fieldtype === "Check") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()) ? 1 : 0;
  if (fieldtype && NUMERIC.has(fieldtype)) { const n = Number(value); return value.trim() === "" || Number.isNaN(n) ? undefined : n; }
  return value;
}

export function conditionToFrappe(c: FilterCondition, fieldtype?: string, opts: { fiscalYears?: FiscalYear[] } = {}): FrappeFilter | null {
  if (c.operator === "is_set") return [c.field, "is", "set"];
  if (c.operator === "between") {
    const [from, to] = splitRange(c.value);
    if (from && to) return [c.field, "between", [from, to]]; // Frappe: on a Datetime the end day runs to 23:59:59
    if (from) return conditionToFrappe({ ...c, operator: "gte", value: from }, fieldtype);
    if (to) return conditionToFrappe({ ...c, operator: "lte", value: to }, fieldtype);
    return null;
  }
  // Frappe resolves the timespan on the server, on the day the request runs (frappe.utils.get_timespan_date_range).
  if (c.operator === "timespan") return (TIMESPANS as readonly string[]).includes(c.value) ? [c.field, "timespan", c.value] : null;
  if (c.operator === "fiscal_year") {
    // As ERPNext's "fiscal year" filter does: a Between over the year's dates (no dependency on ERPNext's hook).
    const fy = opts.fiscalYears?.find((f) => f.name === c.value);
    return fy ? [c.field, "between", [fy.from, fy.to]] : null;
  }
  if (c.operator === "is_not_set") return [c.field, "is", "not set"];
  if (c.operator === "in" || c.operator === "not_in") {
    const items = c.value.split(",").map((s) => s.trim()).filter(Boolean).map((v) => coerce(v, fieldtype)).filter((v) => v !== undefined);
    return items.length ? [c.field, c.operator === "in" ? "in" : "not in", items] : null;
  }
  if (!c.value && !VALUELESS_OPERATORS.includes(c.operator)) return null; // half-built condition
  if (c.operator === "like") return [c.field, "like", `%${c.value}%`];
  if (c.operator === "not_like") return [c.field, "not like", `%${c.value}%`];
  const op = OP[c.operator];
  if (!op) return null;
  if (fieldtype === "Datetime" && DATE_ONLY.test(c.value)) {
    const d = c.value;
    if (c.operator === "equals") return [c.field, "between", [d, d]]; // Frappe's between spans the whole day
    if (c.operator === "gt") return [c.field, ">", d + END_OF_DAY];
    if (c.operator === "lte") return [c.field, "<=", d + END_OF_DAY];
    return [c.field, op, d]; // lt, gte: from midnight
  }
  const v = coerce(c.value, fieldtype);
  return v === undefined ? null : [c.field, op, v];
}

export interface TranslatedQuery { filters: FrappeFilter[]; or_filters: FrappeFilter[]; /** Fields dropped as unknown. */ dropped: string[]; }

/** A FilterQuery as Frappe filters: AND → `filters`; OR with 2+ conditions → `or_filters`. */
export function queryToFrappe(query: FilterQuery | undefined, known: Set<string>, fieldtypes: Map<string, string>, opts: { fiscalYears?: FiscalYear[] } = {}): TranslatedQuery {
  const out: FrappeFilter[] = []; const dropped: string[] = [];
  for (const c of query?.conditions ?? []) {
    if (!c.field) continue;
    if (!known.has(c.field)) { dropped.push(c.field); continue; }
    const f = conditionToFrappe(c, fieldtypes.get(c.field), opts);
    if (f) out.push(f);
  }
  if (query?.conjunction === "or" && out.length > 1) return { filters: [], or_filters: out, dropped };
  return { filters: out, or_filters: [], dropped };
}

export interface ListRequestInput {
  meta: { titleField: string; searchFields: string[]; defaultOrderBy: string; known: Set<string>; fieldtypes: Map<string, string> };
  columns: ColumnDef<never>[] | ColumnDef<Record<string, unknown>>[];
  state: { search: string; query: FilterQuery; sort: SortState; page: number; pageSize: number; groupBy: string; visible: string[] };
  baseFilters?: FrappeFilter[];
  /** Override the meta's search fields. */
  searchFields?: string[];
  /** Grouped (rule C1): rows load in chunks of this size. Default 200. */
  chunkSize?: number;
  /** For "Fiscal Year" conditions. */
  fiscalYears?: FiscalYear[];
}

export interface ListRequest {
  fields: string[];
  filters: FrappeFilter[];
  or_filters: FrappeFilter[];
  order_by: string;
  /** First row and page length of the first request (grouped: chunk 0). */
  limit_start: number;
  limit_page_length: number;
  grouped: boolean;
  /** Search was narrowed to the title field because the filters use `or_filters` (rule C2). */
  searchNarrowed: boolean;
  dropped: string[];
}

export function buildListRequest({ meta, columns, state, baseFilters = [], searchFields, chunkSize = 200, fiscalYears }: ListRequestInput): ListRequest {
  const cols = columns as ColumnDef<unknown>[];
  const byKey = new Map(cols.map((c) => [c.key, c]));
  const real = (f: string | undefined) => (f && meta.known.has(f) ? f : undefined);

  // F4: the visible columns' fields (+ fields they render from), the row key, and the group-by field
  const fields = new Set<string>(["name"]);
  for (const key of state.visible) {
    const c = byKey.get(key);
    if (!c) continue;
    const f = real(fieldOf(c)); if (f) fields.add(f);
    for (const m of c.metaFields ?? []) { const mf = real(m); if (mf) fields.add(mf); }
  }
  const grouped = state.groupBy !== "none" && !!real(state.groupBy);
  if (grouped) fields.add(state.groupBy);

  // F6: sort by the column's field when it is real and sortable; otherwise the DocType's default order
  const sc = state.sort.key ? byKey.get(state.sort.key) : undefined;
  const sortField = sc && sc.sortable !== false ? real(fieldOf(sc)) : undefined;
  const order_by = sortField ? `${sortField} ${state.sort.dir}` : meta.defaultOrderBy;

  // F11 + F32
  const q = queryToFrappe(state.query, meta.known, meta.fieldtypes, { fiscalYears });
  const filters: FrappeFilter[] = [...baseFilters, ...q.filters];
  let or_filters = q.or_filters;

  // C2: search
  let searchNarrowed = false;
  const s = state.search.trim();
  if (s) {
    const sf = (searchFields ?? meta.searchFields).filter((f) => meta.known.has(f));
    const like = (f: string): FrappeFilter => [f, "like", `%${s}%`];
    if (!sf.length) { /* nothing searchable */ }
    else if (or_filters.length) { filters.push(like(meta.titleField)); searchNarrowed = sf.length > 1; }
    else if (sf.length === 1) filters.push(like(sf[0]));
    else or_filters = sf.map(like);
  }

  return {
    fields: [...fields], filters, or_filters, order_by,
    limit_start: grouped ? 0 : state.page * state.pageSize,
    limit_page_length: grouped ? chunkSize : state.pageSize,
    grouped, searchNarrowed, dropped: q.dropped,
  };
}
