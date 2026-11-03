/**
 * URL filters — Desk's `/app/<doctype>?field=value` list routes, both ways. Pure TS (no window access here; the hook
 * decides when to read and write, and never on the server).
 *
 * Read (`JS/list/list_view.js:2130-2183` `parse_filters_from_route_options`, called from `before_refresh :559-571`;
 * the router copies the query string into `frappe.route_options`, `JS/router.js:548-565`):
 *  - every `key=value` pair is one filter (a repeated key gives one filter per value, `URLSearchParams.forEach`);
 *  - a value written `["op", value]` (starts with `[`, ends with `]`) is JSON: operator + value; anything else is `=`;
 *  - `Child DocType.fieldname` names a child-table field; a bare fieldname is resolved like
 *    `frappe.meta.get_doctype_for_field` (`JS/model/meta.js:155-185`): standard field → the DocType, the DocType's own
 *    field, else the first child table that has it, else the key is skipped;
 *  - `frappe.route_options` (an object; `Array` values = several `[op, value]` filters) is read when the query string is empty.
 * Desk then validates again when it adds the filter (`JS/ui/filters/filter_list.js:193-208` "Invalid filter", for a
 * field the meta does not have). The package validates against the loaded meta BEFORE anything is built: a key that is
 * not a known field (`meta.known`, the same set the requests use) is ignored and reported, never sent to the server as
 * a fieldname; a value is only ever a value. A JSON value that does not parse, or is not `[string, value]`, is ignored
 * (Desk would throw on `JSON.parse`). Operators the list cannot show are dropped by `tuplesToQuery`.
 *
 * Write (`list_view.js:1664-1696` `update_url_with_filters` → `get_url_with_filters` → `get_search_params`): one
 * pair per filter — key `field`, or `Child.field` for a child-table filter; value as is for `=`, else
 * `JSON.stringify([op, value])` — through `history.replaceState` (no new history entry). Desk replaces the WHOLE query
 * string; the package keeps the parameters that are not filters (an app's own `?tab=…`). An OR query cannot be
 * written (Desk's filters are AND-only): its filter parameters are removed.
 */
import type { FilterQuery } from "../../list/model/filters";
import { STANDARD_FIELDNAMES, ROW_OPTIONAL_FIELDNAMES, type FrappeListMeta } from "../meta";
import { queryToTuples, tuplesToQuery, type StoredFilter } from "./tuples";

type MetaLike = Pick<FrappeListMeta, "doctype" | "known" | "fieldtypes" | "childOf">;

/** A query string (`location.search`, with or without `?`), its `URLSearchParams`, or a `frappe.route_options`-like object. */
export type UrlFilterSource = string | URLSearchParams | Record<string, unknown>;

export interface ParsedUrlFilters {
  /** The filters as the list's query (AND). Empty when nothing usable was found. */
  query: FilterQuery;
  /** The accepted filters as Desk's 4-tuples. */
  tuples: StoredFilter[];
  /** Keys that were skipped: unknown fields, unreadable JSON values, operators the list cannot show. */
  ignored: string[];
}

/** `frappe.model.std_fields_list` (`JS/model/model.js:64-76`): always the DocType's own. */
const STD = new Set([...STANDARD_FIELDNAMES, ...ROW_OPTIONAL_FIELDNAMES]);

/** The filter target of a URL key, or null (`get_doctype_for_field`, restricted to what the meta knows). */
export function resolveUrlKey(key: string, meta: MetaLike): { doctype: string; fieldname: string } | null {
  if (!key) return null;
  if (key.includes(".")) {
    // `Child DocType.fieldname`: only a child table of this DocType whose meta is loaded (Desk trusts the key)
    const ref = meta.childOf.get(key);
    return ref ? { doctype: ref.doctype, fieldname: ref.fieldname } : null;
  }
  if (STD.has(key) || meta.known.has(key)) return { doctype: meta.doctype, fieldname: key };
  for (const ref of meta.childOf.values()) if (ref.fieldname === key) return { doctype: ref.doctype, fieldname: ref.fieldname };
  return null;
}

const isJsonList = (v: string) => v.startsWith("[") && v.endsWith("]");

/** One URL value → `[op, value]`, or null when it is a JSON list that does not read as one. */
function opValue(raw: unknown): [string, unknown] | null {
  if (Array.isArray(raw)) return typeof raw[0] === "string" && raw.length >= 2 ? [raw[0], raw[1]] : null;
  const v = raw === null || raw === undefined ? "" : String(raw);
  if (!isJsonList(v)) return ["=", v];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) && typeof parsed[0] === "string" && parsed.length >= 2 ? [parsed[0], parsed[1]] : null;
  } catch { return null; }
}

function pairsOf(source: UrlFilterSource): [string, unknown][] {
  if (typeof source === "string") return [...new URLSearchParams(source.startsWith("?") ? source.slice(1) : source).entries()];
  if (typeof URLSearchParams !== "undefined" && source instanceof URLSearchParams) return [...source.entries()];
  const out: [string, unknown][] = [];
  for (const [key, value] of Object.entries(source)) {
    // route_options: an Array of JSON strings = several filters on the key; another Array = one `[op, value]` (list_view.js:2142-2149, 2167-2175)
    if (Array.isArray(value) && typeof value[0] === "string" && isJsonList(value[0])) for (const item of value) out.push([key, item]);
    else out.push([key, value]);
  }
  return out;
}

/** The filters a URL carries, validated against the DocType's meta (see the module comment). */
export function parseUrlFilters(source: UrlFilterSource, meta: MetaLike): ParsedUrlFilters {
  const tuples: StoredFilter[] = [];
  const ignored: string[] = [];
  for (const [key, raw] of pairsOf(source)) {
    const target = resolveUrlKey(key, meta);
    const ov = target ? opValue(raw) : null;
    if (!target || !ov) { ignored.push(key); continue; }
    const tuple: StoredFilter = [target.doctype, target.fieldname, ov[0], ov[1]];
    // the operator (and the field, once more) as the list can show it — else skipped, as Desk drops an invalid filter
    if (!tuplesToQuery([tuple], meta).conditions.length) { ignored.push(key); continue; }
    tuples.push(tuple);
  }
  const query = tuplesToQuery(tuples, meta);
  return { query: { conjunction: "and", conditions: query.conditions.map((c, i) => ({ ...c, id: `url${i}` })) }, tuples, ignored };
}

/** Desk's `get_search_params` for a query: `null` when it cannot be written (an OR query). */
export function filtersToSearchParams(query: FilterQuery, meta: MetaLike): URLSearchParams | null {
  let tuples: StoredFilter[];
  try { tuples = queryToTuples(query, meta); } catch { return null; }
  const params = new URLSearchParams();
  for (const [doctype, field, op, value] of tuples) {
    const key = doctype === meta.doctype ? field : `${doctype}.${field}`;
    params.append(key, op === "=" ? String(value ?? "") : JSON.stringify([op, value]));
  }
  return params;
}

/**
 * The query string for the current filters (`"?…"`, or `""`): the parameters of `current` that are not filters are
 * kept, in order; the filter parameters are replaced (removed for an OR query).
 */
export function filtersToUrl(query: FilterQuery, meta: MetaLike, current = ""): string {
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(current.startsWith("?") ? current.slice(1) : current).entries()) if (!resolveUrlKey(k, meta)) kept.append(k, v);
  const filters = filtersToSearchParams(query, meta);
  if (filters) for (const [k, v] of filters.entries()) kept.append(k, v);
  const s = kept.toString();
  return s ? `?${s}` : "";
}
