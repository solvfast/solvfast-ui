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
import type { FrappeFilter } from "./query";

/** One call to a whitelisted method; resolves to Frappe's full JSON response (`{ message }`, `{ docs }`, …). */
export type FrappeTransport = (method: string, args: Record<string, unknown>) => Promise<FrappeResponse>;
export type FrappeResponse = { message?: unknown; docs?: unknown[]; [key: string]: unknown };

export class FrappeError extends Error {
  /** HTTP status (0 = network failure). */
  readonly status: number;
  /** Frappe's exception class, e.g. "PermissionError", "CSRFTokenError", "ValidationError". */
  readonly excType?: string;
  constructor(message: string, status: number, excType?: string) {
    super(message);
    this.name = "FrappeError";
    this.status = status;
    this.excType = excType;
  }
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

/** Frappe's `_server_messages` is a JSON list of JSON strings, each `{ message, title, … }`; messages may hold HTML. */
function serverMessage(data: Record<string, unknown>): string | undefined {
  const raw = data._server_messages;
  if (typeof raw !== "string") return undefined;
  try {
    const parts = (JSON.parse(raw) as string[]).map((m) => {
      try { const o = JSON.parse(m) as { message?: string }; return o.message ?? m; } catch { return m; }
    });
    const text = parts.join(" ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return text || undefined;
  } catch { return undefined; }
}

export function toFrappeError(status: number, data: Record<string, unknown>): FrappeError {
  const excType = typeof data.exc_type === "string" ? data.exc_type : undefined;
  const exception = typeof data.exception === "string" ? data.exception.split("\n").pop()?.replace(/^[\w.]+:\s*/, "") : undefined;
  const message = serverMessage(data) || exception || (typeof data.message === "string" ? data.message : undefined) || excType || `HTTP ${status}`;
  return new FrappeError(message, status, excType);
}

function defaultCsrf(): string | undefined {
  const w = globalThis as unknown as { csrf_token?: string; frappe?: { csrf_token?: string } };
  return w.csrf_token || w.frappe?.csrf_token || undefined;
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
    if (!res.ok || typeof data.exc_type === "string") throw toFrappeError(res.status, data);
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
