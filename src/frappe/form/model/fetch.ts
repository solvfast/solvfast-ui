/**
 * fetch_from / fetch_if_empty (docs `11` §3, §4.2–4.3; `12` §1.3, §4.6).
 *
 * Client (Desk):
 *  - fetch entries are registered for fields whose `fetch_from` is `link_field.source_field` and whose type is one of
 *    Data, Read Only, Text, Small Text, Currency, Check, Text Editor, Attach Image, Code, Link, Float, Int, Date,
 *    Datetime, Select, Duration, Time — or that are read_only / virtual (script_manager.js:194-235);
 *  - when the link changes, `frappe.client.validate_link(doctype, value, fields=[sources])` answers `{name, …values}`;
 *    a null `name` CLEARS the link; otherwise every target is written UNCONDITIONALLY (the client does not consult
 *    `fetch_if_empty`); clearing the link writes "" into every target; no request for the untouched default with no
 *    fetch;
 *  - a `fetch_from` field renders read-only while its link has a value, unless `fetch_if_empty` (base_input.js:56-62).
 * Server: re-fetches on save (fetch_if_empty targets only when empty), so client-typed values of other fetch targets
 * are never authoritative.
 */
import type { DocTypeMeta, FrappeDoc, FrappeDocField, ValidateLinkResult } from "../../contract";

const FETCHABLE = new Set([
  "Data", "Read Only", "Text", "Small Text", "Currency", "Check", "Text Editor", "Attach Image", "Code", "Link", "Float",
  "Int", "Date", "Datetime", "Select", "Duration", "Time",
]);

export interface FetchEntry {
  /** The Link / Dynamic Link field. */
  link: string;
  /** Column on the linked record. */
  source: string;
  /** Field written on this document. */
  target: string;
  fetchIfEmpty: boolean;
}

/** fetch entries of a DocType, grouped by link fieldname. */
export function buildFetchMap(meta: DocTypeMeta): Map<string, FetchEntry[]> {
  const map = new Map<string, FetchEntry[]>();
  for (const df of meta.fields ?? []) {
    const ff = typeof df.fetch_from === "string" ? df.fetch_from.trim() : "";
    const dot = ff.indexOf(".");
    if (dot <= 0) continue;
    if (!(FETCHABLE.has(df.fieldtype) || df.read_only || df.is_virtual)) continue;
    const link = ff.slice(0, dot);
    const entry: FetchEntry = { link, source: ff.slice(dot + 1), target: df.fieldname, fetchIfEmpty: !!df.fetch_if_empty };
    map.set(link, [...(map.get(link) ?? []), entry]);
  }
  return map;
}

/** The values to write after `validate_link` (or after clearing the link). Null result name → clear the link too. */
export function fetchUpdates(entries: FetchEntry[], linkField: string, result: ValidateLinkResult | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!result) { for (const e of entries) out[e.target] = ""; return out; }
  if (result.name == null) { out[linkField] = null; return out; }
  for (const e of entries) out[e.target] = result.values[e.source] ?? "";
  return out;
}

/** True when a fetch_from field must render read-only (its link has a value and it is not fetch_if_empty). */
export function isReadOnlyByFetch(df: FrappeDocField, doc: FrappeDoc): boolean {
  const ff = typeof df.fetch_from === "string" ? df.fetch_from : "";
  const dot = ff.indexOf(".");
  if (dot <= 0 || df.fetch_if_empty) return false;
  const v = doc[ff.slice(0, dot)];
  return v != null && v !== "";
}
