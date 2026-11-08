/**
 * Desk's Global Search server call and result shaping — `frappe.search.utils.get_global_results` (search_utils.js:447-
 * 489) over `frappe.utils.global_search.search` (frappe/utils/global_search.py:465-526), Frappe v15.110.
 */
import { fuzzySearch } from "./fuzzy";
import type { SearchItem, SearchItemDetail, SearchResultGroup } from "../../shell/search/types";
import type { FrappeTransport } from "../client";
import { deskRouteUrl, type DeskRoute, type DeskSearchTarget } from "./awesomebar";

export const GLOBAL_SEARCH_METHOD = "frappe.utils.global_search.search";

/** A row of `global_search.search` (GS:491-520): exactly these keys (+ `image` for DocTypes with an image field). */
export interface GlobalSearchRow {
  doctype: string;
  name: string;
  content: string;
  rank?: number;
  image?: string | null;
}

/** The request Desk sends (SU:473-480). `doctype` "" = every allowed DocType. */
export interface GlobalSearchArgs { text: string; start: number; limit: number; doctype: string }

/** POST `frappe.utils.global_search.search` and return its rows (a falsy `message` = [] as SU:482-486). */
export async function fetchGlobalSearch(call: FrappeTransport, args: GlobalSearchArgs): Promise<GlobalSearchRow[]> {
  const res = await call(GLOBAL_SEARCH_METHOD, { text: args.text, start: args.start, limit: args.limit, doctype: args.doctype });
  return Array.isArray(res?.message) ? (res.message as GlobalSearchRow[]) : [];
}

/**
 * `make_description(content, doc_name)` (SU:371-445) as structured details: the " ||| " parts that contain the keyword
 * (case-insensitive), "name : value" (or " &&& "), a value over 120 characters cut around the keyword (case-sensitive
 * `indexOf`, as Desk), a value equal to the docname skipped, 300 characters in total (then the field name only, or "…").
 * Marks are the fuzzy-match runs Desk wraps in <mark> (SU:410-411).
 */
export function makeDescription(content: string, docName: string, keywords: string): SearchItemDetail[] {
  const parts = String(content ?? "").split(" ||| ");
  const MAX = 300, FIELD = 120;
  const fields: SearchItemDetail[] = [];
  const seen = new Set<string>();
  let current = 0;
  for (const part of parts) {
    if (part.toLowerCase().indexOf(keywords.toLowerCase()) === -1) continue;
    let colon: number, value: string;
    if (part.indexOf(" &&& ") !== -1) { colon = part.indexOf(" &&& "); value = part.slice(colon + 5); }
    else { colon = part.indexOf(" : "); value = part.slice(colon + 3); }
    if (value.length > FIELD) {
      const idx = value.indexOf(keywords);
      let data = idx < FIELD / 2 ? value.slice(0, idx) : "..." + value.slice(idx - FIELD / 2, idx);
      data += value.slice(idx, idx + FIELD / 2);
      data += idx + FIELD / 2 < value.length ? "..." : "";
      value = data;
    }
    const name = part.slice(0, colon);
    const remaining = MAX - current;
    current += name.length + value.length + 2;
    const n = fuzzySearch(keywords, name), v = fuzzySearch(keywords, value);
    if (current < MAX) {
      const key = `${name}\u0000${value}`;
      if (!seen.has(key) && docName !== value) { seen.add(key); fields.push({ label: name, labelMarks: n.marks, value, valueMarks: v.marks }); }
    } else {
      // Desk computes a trimmed value here but pushes the untrimmed marked one (SU:431-434) — reproduced.
      if (name.length < remaining) fields.push({ label: name, labelMarks: n.marks, value, valueMarks: v.marks });
      else fields.push({ value: "..." });
      break;
    }
  }
  return fields;
}

export interface GlobalResultOptions {
  /** Desk's `__` for group titles (DocType names). */
  translate?: (text: string) => string;
  /** The URL of a document (default `/app/<slug>/<name>`, router.js:423-453). */
  resolveUrl?: (route: DeskRoute) => string | undefined;
}

/** One result row → a Core item (SU:449-457): label = the docname, the description, route ["Form", doctype, name]. */
export function globalRowToItem(d: GlobalSearchRow, keywords: string, opts: GlobalResultOptions = {}): SearchItem {
  const route: DeskRoute = ["Form", d.doctype, d.name];
  const url = opts.resolveUrl?.(route) ?? deskRouteUrl(route);
  const target: DeskSearchTarget = { route, url, kind: "Global", doctype: d.doctype, name: d.name };
  const it: SearchItem = { id: `${d.doctype}::${d.name}`, label: d.name, details: makeDescription(d.content, d.name, keywords), type: "Global", href: url, data: target };
  if (d.image || d.image === null) it.image = d.image; // SU:455-457
  return it;
}

/** `get_results_sets` (SU:447-470): rows grouped by DocType in order of first appearance. */
export function groupGlobalRows(rows: GlobalSearchRow[], keywords: string, opts: GlobalResultOptions = {}): SearchResultGroup[] {
  const sets: SearchResultGroup[] = [];
  const by = new Map<string, SearchResultGroup>();
  for (const d of rows) {
    let set = by.get(d.doctype);
    if (!set) {
      set = { id: d.doctype, title: (opts.translate ?? ((s: string) => s))(d.doctype), items: [], kind: "remote" };
      by.set(d.doctype, set);
      sets.push(set);
    }
    const it = globalRowToItem(d, keywords, opts);
    if (!set.items.some((x) => x.id === it.id)) set.items.push(it); // the server may repeat a row for "a & b" (GS:486-511)
  }
  return sets;
}
