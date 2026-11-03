/**
 * Frappe client — stock whitelisted APIs only, no per-app backend (verified against Frappe 15.110 source):
 *   frappe.desk.form.load.getdoctype   DocType meta (returned in `docs`, not `message`)
 *   frappe.client.get_list             rows: fields, filters, or_filters, order_by, limit_start, limit_page_length
 *   frappe.desk.reportview.get_count   total for the SAME filters + or_filters (frappe.client.get_count has no
 *                                      `or_filters` parameter, and Frappe drops undeclared arguments — Sear's count
 *                                      ignored OR filters)
 *   frappe.desk.search.search_link     link-field options (the Desk's own link search: search fields, permissions)
 * v0.1 auth: the page is served by Frappe (same origin), the session cookie authenticates, and every POST carries
 * `X-Frappe-CSRF-Token`. Another auth scheme plugs in as a custom `transport`.
 */
import type { FrappeErrorInfo, FrappeErrorKind, FrappeMessage } from "./contract";
import type { FrappeFilter } from "./query";

/** One call to a whitelisted method; resolves to Frappe's full JSON response (`{ message }`, `{ docs }`, …). */
export type FrappeTransport = (method: string, args: Record<string, unknown>) => Promise<FrappeResponse>;
export type FrappeResponse = { message?: unknown; docs?: unknown[]; [key: string]: unknown };

/**
 * A failed call. `status` / `excType` as in 0.3; 0.4.0 adds `kind`, `messages` and `exception` (FrappeErrorInfo).
 * The constructor is unchanged (`new FrappeError(message, status, excType)`); the 4th argument is optional and `kind`
 * defaults to the mapping in contract.ts (`frappeErrorKind`).
 */
export class FrappeError extends Error implements FrappeErrorInfo {
  /** HTTP status (0 = network failure). 401 also when the body said `session_expired: 1` (any HTTP status). */
  readonly status: number;
  /** Frappe's exception class, e.g. "PermissionError", "CSRFTokenError", "ValidationError". */
  readonly excType?: string;
  readonly kind: FrappeErrorKind;
  /** `_server_messages`, parsed, in order (may contain HTML — sanitize before rendering). */
  readonly messages: FrappeMessage[];
  /** Last line of the server traceback (only when the site allows tracebacks). */
  readonly exception?: string;
  constructor(message: string, status: number, excType?: string, info: { kind?: FrappeErrorKind; messages?: FrappeMessage[]; exception?: string } = {}) {
    super(message);
    this.name = "FrappeError";
    this.status = status;
    this.excType = excType;
    this.kind = info.kind ?? frappeErrorKind(status, excType);
    this.messages = info.messages ?? [];
    this.exception = info.exception;
  }
}

// contract.ts mapping (frappe/exceptions.py, 15.110). Subclasses listed explicitly: the client only sees the class name.
const KIND_BY_EXC: Record<string, FrappeErrorKind> = {
  PermissionError: "permission",
  DoesNotExistError: "not_found", PageDoesNotExistError: "not_found",
  DuplicateEntryError: "duplicate", UniqueValidationError: "duplicate",
  TimestampMismatchError: "timestamp",
  MandatoryError: "mandatory",
  LinkValidationError: "link", CancelledLinkError: "link", LinkExistsError: "link",
  // CSRFTokenError and its subclasses (exceptions.py:273-283, bad Authorization headers) — all HTTP 400
  CSRFTokenError: "csrf", InvalidAuthorizationHeader: "csrf", InvalidAuthorizationPrefix: "csrf", InvalidAuthorizationToken: "csrf",
};

/**
 * The contract's classification. Exception class first; then the status: 0 network · 401 session_expired · 403
 * permission · 404 not_found · 413 too_large (Werkzeug's HTML page, no exc_type) · 417 validation (every other
 * ValidationError subclass, and FrappeTypeError) · anything else (5xx, 409 NameError, 429, unparseable) server.
 */
export function frappeErrorKind(status: number, excType?: string, body?: Record<string, unknown>): FrappeErrorKind {
  if (body?.session_expired) return "session_expired";
  const byExc = excType ? KIND_BY_EXC[excType] : undefined;
  if (byExc) return byExc;
  switch (status) {
    case 0: return "network";
    case 401: return "session_expired";
    case 403: return "permission";
    case 404: return "not_found";
    case 413: return "too_large";
    case 417: return "validation";
    default: return "server";
  }
}

const asText = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? v.map(asText).join("\n") : v == null ? "" : String(v));

/** One `msgprint` dict (frappe/__init__.py msgprint) → FrappeMessage. A plain string becomes `{ message }`. */
export function toFrappeMessage(item: unknown): FrappeMessage {
  let o: unknown = item;
  if (typeof item === "string") { try { o = JSON.parse(item); } catch { o = item; } }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { message: asText(o) };
  const r = o as Record<string, unknown>;
  const m: FrappeMessage = { message: asText(r.message) };
  if (typeof r.title === "string" && r.title) m.title = r.title;
  if (typeof r.indicator === "string" && r.indicator) m.indicator = r.indicator;
  if (r.raise_exception) m.raiseException = true;
  // Desk routes `alert` and `toast` to show_alert (messages.js:174-176)
  if (r.alert || r.toast) m.alert = true;
  return m;
}

/** `_server_messages` is a JSON list of JSON strings (utils/response.py `_make_logs_v1`). Accepts the string or a list. */
export function parseServerMessages(raw: unknown): FrappeMessage[] {
  let list: unknown = raw;
  if (typeof raw === "string") { try { list = JSON.parse(raw); } catch { return raw.trim() ? [{ message: raw }] : []; } }
  return Array.isArray(list) ? list.map(toFrappeMessage).filter((m) => m.message !== "") : [];
}

/** Desk's msgprint array rule (messages.js:151-172): when any message has `raise_exception`, only those are shown. */
export function visibleMessages(messages: FrappeMessage[]): FrappeMessage[] {
  return messages.some((m) => m.raiseException) ? messages.filter((m) => m.raiseException) : messages;
}

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Error body → FrappeError. Readable message, in the order of docs 10 §C1.10: `_server_messages` (the raise_exception
 * ones when present), `_error_message`, `exception`, `message`, `exc_type`, "HTTP <status>". On 403 Desk shows
 * `_error_message` instead of the server messages (request.js 403 handler), so it comes first there.
 */
export function toFrappeError(status: number, data: Record<string, unknown>): FrappeError {
  const sessionExpired = !!data.session_expired;
  const excType = typeof data.exc_type === "string" ? data.exc_type : undefined;
  const messages = parseServerMessages(data._server_messages);
  const fromMessages = plain(visibleMessages(messages).map((m) => m.message).join(" ")) || undefined;
  const errorMessage = typeof data._error_message === "string" ? plain(data._error_message) || undefined : undefined;
  const exceptionLine = typeof data.exception === "string" ? data.exception.split("\n").filter(Boolean).pop() : undefined;
  const fromException = exceptionLine?.replace(/^[\w.]+:\s*/, "") || undefined;
  const fromMessage = typeof data.message === "string" ? data.message : undefined;
  const message = (status === 403 ? errorMessage ?? fromMessages : fromMessages ?? errorMessage) ?? fromException ?? fromMessage ?? excType ?? `HTTP ${status}`;
  // `session_expired: 1` means "log in again" whatever the HTTP status (request.js cleanup checks it first)
  return new FrappeError(message, sessionExpired ? 401 : status, excType, {
    kind: frappeErrorKind(status, excType, data), messages, exception: exceptionLine,
  });
}

export interface FrappeClientOptions {
  /** Origin of the Frappe site. Default "" (same origin — the page is served by Frappe). */
  baseUrl?: string;
  /** CSRF token or a function returning it. Default: `window.csrf_token`, then `window.frappe.csrf_token`. */
  csrfToken?: string | (() => string | undefined);
  /** Default "same-origin". */
  credentials?: RequestCredentials;
  /** Replace the HTTP transport (tests, another auth scheme). */
  transport?: FrappeTransport;
  /** Custom fetch (default: the global one). */
  fetch?: typeof fetch;
}

export interface DocField {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string;
  in_list_view?: number;
  in_standard_filter?: number;
  hidden?: number;
  reqd?: number;
}
export interface DocMeta {
  name: string;
  fields: DocField[];
  title_field?: string;
  search_fields?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface GetListArgs {
  fields: string[];
  filters?: FrappeFilter[];
  or_filters?: FrappeFilter[];
  order_by?: string;
  limit_start?: number;
  limit_page_length?: number;
}

export interface FrappeClient {
  /** Any whitelisted method; resolves to the full response. */
  call: FrappeTransport;
  getMeta(doctype: string): Promise<DocMeta>;
  getList<T = Record<string, unknown>>(doctype: string, args: GetListArgs): Promise<T[]>;
  getCount(doctype: string, args: { filters?: FrappeFilter[]; or_filters?: FrappeFilter[] }): Promise<number>;
  searchLink(doctype: string, txt: string, opts?: { referenceDoctype?: string; pageLength?: number }): Promise<{ value: string; label?: string; description?: string }[]>;
}

/** `window.csrf_token`, then `window.frappe.csrf_token`. "None" (what a page rendered without a session token prints)
 *  and "" count as missing: no header is sent, which Frappe accepts when the session has no stored token. */
function defaultCsrf(): string | undefined {
  const w = globalThis as unknown as { csrf_token?: unknown; frappe?: { csrf_token?: unknown } };
  const usable = (t: unknown) => (typeof t === "string" && t.trim() && t.trim() !== "None" ? t : undefined);
  return usable(w.csrf_token) ?? usable(w.frappe?.csrf_token);
}

function fetchTransport(opts: FrappeClientOptions): FrappeTransport {
  return async (method, args) => {
    const token = typeof opts.csrfToken === "function" ? opts.csrfToken() : opts.csrfToken ?? defaultCsrf();
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers["X-Frappe-CSRF-Token"] = token;
    let res: Response;
    try {
      res = await (opts.fetch ?? fetch)(`${opts.baseUrl ?? ""}/api/method/${method}`, {
        method: "POST", credentials: opts.credentials ?? "same-origin", headers, body: JSON.stringify(args),
      });
    } catch (e) {
      throw new FrappeError(e instanceof Error ? e.message : "Network error", 0);
    }
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { data = { message: text.slice(0, 200) }; }
    if (!res.ok || typeof data.exc_type === "string" || data.session_expired) throw toFrappeError(res.status, data);
    return data as FrappeResponse;
  };
}

const json = (v: unknown) => JSON.stringify(v);

export function createFrappeClient(opts: FrappeClientOptions = {}): FrappeClient {
  const call = opts.transport ?? fetchTransport(opts);
  return {
    call,
    async getMeta(doctype) {
      const res = await call("frappe.desk.form.load.getdoctype", { doctype });
      const docs = (res.docs ?? []) as DocMeta[];
      const meta = docs.find((d) => d?.name === doctype);
      if (!meta) throw new FrappeError(`No metadata for DocType "${doctype}"`, 404, "DoesNotExistError");
      return meta;
    },
    async getList(doctype, a) {
      const res = await call("frappe.client.get_list", {
        doctype, fields: json(a.fields), filters: json(a.filters ?? []), or_filters: json(a.or_filters ?? []),
        order_by: a.order_by, limit_start: a.limit_start ?? 0, limit_page_length: a.limit_page_length ?? 20,
      });
      return (res.message ?? []) as never[];
    },
    async getCount(doctype, a) {
      const res = await call("frappe.desk.reportview.get_count", { doctype, filters: json(a.filters ?? []), or_filters: json(a.or_filters ?? []) });
      return Number(res.message) || 0;
    },
    async searchLink(doctype, txt, o = {}) {
      const res = await call("frappe.desk.search.search_link", {
        doctype, txt, page_length: o.pageLength ?? 10, ...(o.referenceDoctype ? { reference_doctype: o.referenceDoctype } : {}),
      });
      return (res.message ?? []) as { value: string; label?: string; description?: string }[];
    },
  };
}
