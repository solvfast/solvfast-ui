/**
 * P36e mock — FrappeField WITHOUT a Frappe server: a local services adapter.
 *
 * Why it exists. FrappeField / FrappeLinkField take their services from `useFormServices()`, whose defaults come from the
 * nearest FrappeProvider. Without one:
 *  - `useFrappeClient()` falls back to a SAME-ORIGIN client, so Link search, `validate_link` and `get_link_title` are
 *    POSTed to `/api/method/…` of whatever site serves the page (on an app served by Frappe: the real site);
 *  - `useMetaBundle` (called by every FrappeLinkField) throws "No QueryClient set" when no React Query client is above.
 * A page that has no Frappe documents (an app's in-browser "mock" data) must therefore not render FrappeField bare.
 *
 * What this adapter does. `<FrappeLocalForm source={…}>` renders a FrappeProvider whose client has NO network: every
 * whitelisted method is refused with a `LocalModeError` (a tripwire — nothing silently reaches a server), and overrides
 * the form services with LOCAL implementations of the three Link methods over host-supplied rows:
 *  - search  = `frappe.desk.search.search_link` (desk/search.py:37-57 search_link → search_widget :62-232 →
 *    build_for_autosuggest :253-275): `filters` (dict or tuples), the `enabled = 1` / `disabled != 1` rule for DocTypes
 *    with such Check fields (:154-157), `txt` as `like %txt%` over name + title_field + search_fields (:131-152),
 *    relevance (`name` starting with txt first, then the name, :286-288), `page_length`; the label is the title when the
 *    target shows titles in links, the description lists the other search columns.
 *  - validate = `frappe.client.validate_link` (client.py:436-483): the canonical name of an existing row (MariaDB
 *    compares names case-insensitively) or `null` (FrappeLinkField then CLEARS the field, link.js:713-760), plus the
 *    requested fetch columns (fetch_from works unchanged).
 *  - title  = `frappe.desk.search.get_link_title` (search.py:327-334): the title_field value when the target shows
 *    titles in links, else the name.
 * An unknown target DocType is refused like the server's `frappe.get_meta` (DoesNotExistError "DocType X not found").
 *
 * What it does NOT do (reported by `useFormCapabilities()`): permissions (the host decides which rows it hands over;
 * the server checks select/read and User Permissions), custom link queries (`query` → refused), "Create a new X" and
 * Quick Entry, uploads (Attach), and every server-side validation on save. Saving stays with the host.
 */
import * as React from "react";
import { createFrappeClient, FrappeError, type FrappeClient } from "../client";
import type { DocTypeMeta, FrappeDocField, SearchLinkOptions, SearchResult, ValidateLinkResult } from "../contract";
import { FrappeProvider } from "../FrappeProvider";
import type { FormatContext } from "../services/format";
import type { FrappeSession } from "../services/permissions";
import type { TranslationDictionary } from "../services/translate";
import { FrappeFormServices, type FormServices } from "./services";

/** One record of a Link target: its `name` plus any column search, titles or fetch_from read. */
export type LocalRow = { name: string; [field: string]: unknown };

/** What the local search reads from the target DocType's meta (search_widget). */
export type LocalTargetMeta = Pick<DocTypeMeta, "title_field" | "show_title_field_in_link" | "search_fields"> & {
  fields?: Array<Pick<FrappeDocField, "fieldname" | "fieldtype">>;
};

export interface LocalLinkTarget {
  /** title_field, show_title_field_in_link, search_fields and the fields (for the enabled / disabled rule). */
  meta?: LocalTargetMeta;
  /** The records the page may offer (the host's own data; no permission is applied here). Read on every call. */
  rows(): ReadonlyArray<LocalRow>;
}

/** The Link targets a page can resolve without a server; `undefined` = unknown DocType. */
export type LocalLinkSource = (doctype: string) => LocalLinkTarget | undefined;

/** Which server-backed behaviours the form services can perform. */
export interface FormCapabilities {
  /** A Frappe server answers the form's requests. */
  server: boolean;
  linkSearch: boolean;
  validateLink: boolean;
  linkTitle: boolean;
  /** fetch_from values on a Link pick (validate_link `fields`). */
  fetchFrom: boolean;
  /** Custom link queries (`query` / `get_query` methods): server code. */
  customQuery: boolean;
  /** "Create a new X" and Quick Entry. */
  createNew: boolean;
  /** Attach / Attach Image uploads (`upload_file`). */
  upload: boolean;
  /** DocPerm / User Permission checks on search and validate_link. */
  permissions: boolean;
  /** Save-time server validation (_validate_mandatory, _validate_data_fields, non_negative, length, links …). */
  serverValidation: boolean;
}

export const SERVER_CAPABILITIES: Readonly<FormCapabilities> = Object.freeze({
  server: true, linkSearch: true, validateLink: true, linkTitle: true, fetchFrom: true, customQuery: true, createNew: true,
  upload: true, permissions: true, serverValidation: true,
});
export const LOCAL_CAPABILITIES: Readonly<FormCapabilities> = Object.freeze({
  server: false, linkSearch: true, validateLink: true, linkTitle: true, fetchFrom: true, customQuery: false, createNew: false,
  upload: false, permissions: false, serverValidation: false,
});

const CapabilitiesContext = React.createContext<FormCapabilities>(SERVER_CAPABILITIES);
/** The capabilities of the form services below: SERVER_CAPABILITIES unless inside `<FrappeLocalForm>`. */
export function useFormCapabilities(): FormCapabilities {
  return React.useContext(CapabilitiesContext);
}

/** The refusal of anything that needs a server, in local mode. */
export function localModeError(method: string): FrappeError {
  // a 4xx status: React Query's frappeRetry never retries it (the refusal is final, not a transient outage)
  return new FrappeError(`Not available without a Frappe server: ${method}`, 400, "LocalModeError", { kind: "unavailable" });
}
const notFound = (doctype: string) => new FrappeError(`DocType ${doctype} not found`, 404, "DoesNotExistError");

/** A client that never touches the network: every method is refused with a LocalModeError. */
export function createNoServerClient(): FrappeClient {
  return createFrappeClient({
    transport: async (method) => { throw localModeError(method); },
    files: {
      download: async (method) => { throw localModeError(method); },
      upload: async () => { throw localModeError("upload_file"); },
    },
    session: { user: "" },
  });
}
let shared: FrappeClient | undefined;
/** One no-server client per page (the link-title cache is scoped to the client object). */
export const noServerClient = (): FrappeClient => (shared ??= createNoServerClient());

// ---- search_widget over rows -------------------------------------------------------------------------------------

const s = (v: unknown) => (v == null ? "" : String(v));
const casefold = (v: unknown) => s(v).toLowerCase();
/** SQL `like` with % and _ (case-insensitive, as MariaDB's default collation). */
function like(v: unknown, pattern: string): boolean {
  const re = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${re}$`, "is").test(s(v));
}
const list = (value: unknown) => (Array.isArray(value) ? value : s(value).split(",")).map((x) => s(x).trim());
const num = (v: unknown) => (v === "" || v == null ? NaN : Number(v));

/** One filter condition (the operators `link_filters` / `get_query` filters use). Unknown operators are refused. */
function matches(v: unknown, op: string, value: unknown): boolean {
  const blank = v == null || v === "";
  const cmp = () => { const a = num(v), b = num(value); return !Number.isNaN(a) && !Number.isNaN(b) ? a - b : s(v).localeCompare(s(value)); };
  switch (op.toLowerCase()) {
    case "=": return casefold(v) === casefold(value);
    case "!=": return casefold(v) !== casefold(value);
    case "like": return like(v, s(value));
    case "not like": return !like(v, s(value));
    case "in": return list(value).map(casefold).includes(casefold(v));
    case "not in": return !list(value).map(casefold).includes(casefold(v));
    case "is": return s(value) === "set" ? !blank : blank;
    case ">": return !blank && cmp() > 0;
    case "<": return !blank && cmp() < 0;
    case ">=": return !blank && cmp() >= 0;
    case "<=": return !blank && cmp() <= 0;
    default: throw new FrappeError(`Unsupported operator ${op}`, 417, "ValidationError");
  }
}

type Cond = [string, string, unknown];
/** search_link `filters`: `{ field: value | [op, value] }` or `[[doctype, field, op, value] | [field, op, value]]`. */
function conditions(filters: SearchLinkOptions["filters"]): Cond[] {
  if (!filters) return [];
  if (Array.isArray(filters)) {
    return (filters as unknown[]).filter(Array.isArray).map((f) => {
      const t = f as unknown[];
      return (t.length >= 4 ? [s(t[1]), s(t[2]), t[3]] : [s(t[0]), s(t[1]), t[2]]) as Cond;
    });
  }
  return Object.entries(filters).map(([k, v]) => (Array.isArray(v) ? [k, s(v[0]), v[1]] : [k, "=", v]) as Cond);
}

const hasCheck = (meta: LocalTargetMeta | undefined, fieldname: string) =>
  !!meta?.fields?.some((f) => f.fieldname === fieldname && f.fieldtype === "Check");
const searchColumns = (meta: LocalTargetMeta | undefined) =>
  [...new Set(["name", meta?.title_field, ...s(meta?.search_fields).split(",").map((x) => x.trim())].filter((f): f is string => !!f))];

/** `frappe.desk.search.search_link` over local rows (see the file header for the rules and citations). */
export function localSearchLink(target: LocalLinkTarget, txt: string, opts: SearchLinkOptions = {}): SearchResult[] {
  if (opts.query) throw localModeError(opts.query); // a custom query is server code
  const meta = target.meta;
  const text = (txt ?? "").trim();
  const conds = conditions(opts.filters);
  if (hasCheck(meta, "enabled")) conds.push(["enabled", "=", 1]);
  if (hasCheck(meta, "disabled")) conds.push(["disabled", "!=", 1]);
  const cols = searchColumns(meta);
  let rows = target.rows().filter((r) => conds.every(([f, op, v]) => matches(r[f], op, v)));
  if (text) rows = rows.filter((r) => cols.some((c) => like(r[c], `%${text.replace(/%/g, "")}%`)));
  // relevance_sorter (search.py:286-288): names starting with txt first, then by name
  rows = [...rows].sort((a, b) => Number(!casefold(a.name).startsWith(casefold(text))) - Number(!casefold(b.name).startsWith(casefold(text))) || s(a.name).localeCompare(s(b.name)));
  const pageLength = Math.max(1, Math.trunc(opts.pageLength ?? 10) || 10);
  const titled = !!meta?.show_title_field_in_link && !!meta.title_field;
  const others = cols.filter((c) => c !== "name" && !(titled && c === meta?.title_field));
  return rows.slice(0, pageLength).map((r) => {
    const parts = [...new Set(others.map((c) => s(r[c])).filter(Boolean))];
    if (titled) {
      const label = s(r[meta!.title_field!]) || s(r.name);
      // build_for_autosuggest: the name moves into the description, a repeated title is dropped
      return { value: s(r.name), label, description: [s(r.name), ...parts.filter((p) => p !== label)].join(", ") };
    }
    return { value: s(r.name), description: parts.join(", ") };
  });
}

/** The row whose name equals `value` (exactly, else case-insensitively, as MariaDB compares). */
function findRow(target: LocalLinkTarget, value: string): LocalRow | undefined {
  const rows = target.rows();
  return rows.find((r) => s(r.name) === value) ?? rows.find((r) => casefold(r.name) === casefold(value));
}

/** `frappe.client.validate_link` over local rows: `{ name: null }` for an unknown value, else the canonical name + fetch columns. */
export function localValidateLink(target: LocalLinkTarget, value: string, fetchFields?: string[]): ValidateLinkResult {
  const row = value ? findRow(target, value) : undefined;
  if (!row) return { name: null, values: {} };
  return { name: s(row.name), values: Object.fromEntries((fetchFields ?? []).map((f) => [f, row[f] ?? null])) };
}

/** `frappe.desk.search.get_link_title` over local rows. */
export function localLinkTitle(target: LocalLinkTarget, name: string): string | null {
  if (!target.meta?.show_title_field_in_link || !target.meta.title_field) return name;
  const row = findRow(target, name);
  if (!row) return null;
  const t = row[target.meta.title_field];
  return t == null || t === "" ? null : s(t);
}

export interface LocalFormServicesOptions {
  /** Open-record URL of a linked value (no URL → no open button). Default: none (the app's routes are its own). */
  linkHref?: (doctype: string, name: string) => string | undefined;
  onOpenLink?: FormServices["onOpenLink"];
}

/** The FormServices overrides of local mode: Link search / validate / title over `source`, no create, the host's links. */
export function createLocalFormServices(source: LocalLinkSource, opts: LocalFormServicesOptions = {}): Partial<FormServices> {
  const target = (doctype: string) => { const t = source(doctype); if (!t) throw notFound(doctype); return t; };
  return {
    searchLink: async (doctype, txt, o) => localSearchLink(target(doctype), txt, o),
    validateLink: async (doctype, value, fetch) => localValidateLink(target(doctype), value, fetch),
    getLinkTitle: async (doctype, name) => { const t = source(doctype); return t ? localLinkTitle(t, name) : null; },
    canCreate: () => false,
    linkHref: opts.linkHref ?? (() => undefined),
    ...(opts.onOpenLink ? { onOpenLink: opts.onOpenLink } : {}),
  };
}

export interface FrappeLocalFormProps extends LocalFormServicesOptions {
  /** The Link targets (host data: an in-memory store, fixtures …). */
  source: LocalLinkSource;
  /** Labels and Select options through `__()` (Desk's boot dictionary). */
  translations?: TranslationDictionary;
  /** Number / date / currency settings for the controls and `formatValue`. */
  formatContext?: FormatContext;
  /** Optional session (labels only: no permission is evaluated in local mode). */
  session?: FrappeSession;
  children: React.ReactNode;
}

/**
 * Run FrappeField / FrappeLinkField / FrappeDynamicLinkField without a Frappe server: a FrappeProvider over the no-server
 * client (React Query + the message host FrappeField's dialogs need) and the local Link services. Do not nest it inside
 * a real FrappeProvider whose client should serve the same fields: it replaces that client for everything below.
 */
export function FrappeLocalForm({ source, linkHref, onOpenLink, translations, formatContext, session, children }: FrappeLocalFormProps) {
  const sourceRef = React.useRef(source);
  sourceRef.current = source;
  const hrefRef = React.useRef(linkHref);
  hrefRef.current = linkHref;
  const services = React.useMemo(
    () => createLocalFormServices((dt) => sourceRef.current(dt), {
      linkHref: (dt, name) => hrefRef.current?.(dt, name),
      ...(onOpenLink ? { onOpenLink } : {}),
    }),
    [onOpenLink],
  );
  return (
    <FrappeProvider client={noServerClient()} serverMessages="host" translations={translations} formatContext={formatContext} session={session} userDefaults={false}>
      <CapabilitiesContext.Provider value={LOCAL_CAPABILITIES}>
        <FrappeFormServices value={services}>{children}</FrappeFormServices>
      </CapabilitiesContext.Provider>
    </FrappeProvider>
  );
}
