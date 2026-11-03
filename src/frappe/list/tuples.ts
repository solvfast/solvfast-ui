/**
 * FilterQuery ↔ Desk's stored filter tuples `[doctype, fieldname, operator, value]` (List Filter.filters and
 * `user_settings.List.filters`, docs 13 §5.1). AND only: Desk cannot store the package's OR conjunction (UNVERIFIED:
 * how Desk would load a 3-tuple), so a saved OR query is refused rather than silently changed. Pure TS.
 */
import type { FilterCondition, FilterQuery, Operator } from "../../list/model/filters";
import type { FrappeListMeta } from "../meta";
import { NESTED_SET_FRAPPE_OP, queryToFrappe, type FrappeFilter } from "../query";

/** Frappe's operator string → the package's nested-set operator (saved List Filters, user_settings, URL filters). */
const NESTED_SET_BY_FRAPPE_OP = new Map(Object.entries(NESTED_SET_FRAPPE_OP).map(([k, v]) => [v, k as Operator]));

export type StoredFilter = [string, string, string, unknown];

export class UnstorableQueryError extends Error {
  constructor() { super("An OR filter cannot be stored as a Frappe filter."); this.name = "UnstorableQueryError"; }
}

type MetaLike = Pick<FrappeListMeta, "doctype" | "known" | "fieldtypes" | "childOf">;

export function queryToTuples(query: FilterQuery, meta: MetaLike): StoredFilter[] {
  const real = query.conditions.filter((c) => c.field);
  if (query.conjunction === "or" && real.length > 1) throw new UnstorableQueryError();
  return queryToFrappe(query, meta.known, meta.fieldtypes, { childOf: meta.childOf }).filters.map((f): StoredFilter =>
    (f.length === 4 ? f : [meta.doctype, f[0], f[1], f[2]]) as StoredFilter);
}

const stripWild = (v: unknown) => String(v ?? "").replace(/^%/, "").replace(/%$/, "");

/** Tuples → conditions; tuples that name unknown fields, or use an operator the list cannot show, are dropped (as Desk drops invalid saved filters). */
export function tuplesToQuery(tuples: unknown, meta: MetaLike): FilterQuery {
  const conditions: FilterCondition[] = [];
  if (Array.isArray(tuples)) tuples.forEach((raw, i) => {
    if (!Array.isArray(raw) || raw.length < 3) return;
    const t = (raw.length === 3 ? [meta.doctype, ...raw] : raw) as unknown[];
    const [dt, fieldname, op, value] = [String(t[0]), String(t[1]), String(t[2]).toLowerCase(), t[3]];
    const field = dt === meta.doctype ? fieldname : `${dt}.${fieldname}`;
    if (!meta.known.has(field)) return;
    const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map(String).join(",");
    let operator: Operator | undefined; let v = String(value ?? "");
    switch (op) {
      case "=": operator = "equals"; break;
      case "!=": operator = "not_equals"; break;
      case ">": operator = "gt"; break;
      case "<": operator = "lt"; break;
      case ">=": operator = "gte"; break;
      case "<=": operator = "lte"; break;
      case "like": operator = "like"; v = stripWild(value); break;
      case "not like": operator = "not_like"; v = stripWild(value); break;
      case "in": operator = "in"; v = list(value); break;
      case "not in": operator = "not_in"; v = list(value); break;
      case "between": operator = "between"; v = list(value); break;
      case "timespan": operator = "timespan"; v = String(value).toLowerCase(); break;
      case "is": operator = String(value).toLowerCase() === "set" ? "is_set" : "is_not_set"; v = ""; break;
      default:
        // descendants of / descendants of (inclusive) / not descendants of / ancestors of / not ancestors of (one node)
        if (NESTED_SET_BY_FRAPPE_OP.has(op) && !Array.isArray(value) && value !== null && typeof value !== "object") { operator = NESTED_SET_BY_FRAPPE_OP.get(op); v = String(value); }
    }
    if (operator) conditions.push({ id: `s${i}`, field, operator, value: v });
  });
  return { conjunction: "and", conditions };
}

export type { FrappeFilter };
