/**
 * Frappe client — stock whitelisted APIs only, no per-app backend (verified against Frappe 15.110 source):
 *   frappe.desk.form.load.getdoctype   DocType meta (returned in `docs`, not `message`)
 *   frappe.client.get_list             rows: fields, filters, or_filters, order_by, limit_start, limit_page_length
 *   frappe.desk.reportview.get_count   total for the SAME filters + or_filters (frappe.client.get_count has no
 *                                      `or_filters` parameter, and Frappe drops undeclared arguments — Sear's count
 *                                      ignored OR filters)
 *   frappe.desk.search.search_link     link-field options (the Desk's own link search: search fields, permissions)
 * 0.4.0 adds the methods Desk itself uses for documents and records (docs 10, 11, 14 — Frappe 15.110):
 *   frappe.desk.form.load.getdoctype / getdoc / get_docinfo, frappe.desk.form.save.savedocs / cancel,
 *   frappe.client.delete, frappe.rename_doc, frappe.client.validate_link, run_doc_method,
 *   frappe.model.workflow.get_transitions / apply_workflow (the Workflow itself comes in getdoctype `__workflow_docs`),
 *   frappe.desk.form.assign_to.add / remove, frappe.desk.form.utils.add_comment / update_comment.
 *   Objects and lists are sent as JSON strings, as Desk does (request.js prepare; savedocs json.loads its `doc`).
 * v0.1 auth: the page is served by Frappe (same origin), the session cookie authenticates, and every POST carries
 * `X-Frappe-CSRF-Token`. Another auth scheme plugs in as a custom `transport`.
 */
import type {
  AssignmentInfo, CommentInfo, DocInfo, DocTypeMeta, DocumentApi, FrappeDoc, FrappeErrorInfo, FrappeErrorKind, FrappeMessage,
  LoadedDoc, MetaBundle, RecordApi, SearchLinkOptions, SearchResult, ValidateLinkResult, WorkflowInfo, WorkflowState,
  WorkflowTransition,
} from "./contract";
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
  NameError: "validation", // exceptions.py:50 (409); its subclass DuplicateEntryError is listed above
  LinkExpired: "not_found", // exceptions.py:301 (410)
  TooManyRequestsError: "rate_limited", RateLimitExceededError: "rate_limited", // 429 (the latter a ValidationError subclass)
  InReadOnlyMode: "unavailable", QueueOverloaded: "unavailable", SessionStopped: "unavailable", // 503
  // CSRFTokenError and its subclasses (exceptions.py:273-283, bad Authorization headers) — all HTTP 400
  CSRFTokenError: "csrf", InvalidAuthorizationHeader: "csrf", InvalidAuthorizationPrefix: "csrf", InvalidAuthorizationToken: "csrf",
};

/**
 * The contract's classification. Exception class first; then the status: 0 network · 401 session_expired · 403
 * permission · 404 / 410 not_found · 409 validation (NameError family; DuplicateEntryError is matched by class) ·
 * 413 too_large (Werkzeug's HTML page, no exc_type) · 417 validation (every other ValidationError subclass, and
 * FrappeTypeError) · 429 rate_limited · 503 unavailable · anything else (5xx, unparseable) server.
 */
export function frappeErrorKind(status: number, excType?: string, body?: Record<string, unknown>): FrappeErrorKind {
  if (body?.session_expired) return "session_expired";
  const byExc = excType ? KIND_BY_EXC[excType] : undefined;
  if (byExc) return byExc;
  switch (status) {
    case 0: return "network";
    case 401: return "session_expired";
    case 403: return "permission";
    case 404: case 410: return "not_found";
    case 409: return "validation";
    case 413: return "too_large";
    case 417: return "validation";
    case 429: return "rate_limited";
    case 503: return "unavailable";
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
  /**
   * The logged-in user, sent by `addComment` as `comment_email` / `comment_by` (Frappe takes both from the client,
   * docs 14 §A11). Default: `window.frappe.session.user` / `user_fullname` when the page has them; otherwise empty
   * strings are sent and the server's Comment.validate fills `comment_email` from the session (`comment_by` stays empty).
   */
  session?: SessionUser | (() => SessionUser | undefined);
}

export interface SessionUser { user: string; fullName?: string }

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
  /** `frappe.desk.search.search_link`. 0.4.0: also `filters`, `query`, `searchfield`, `ignoreUserPermissions`. */
  searchLink(doctype: string, txt: string, opts?: SearchLinkOptions): Promise<SearchResult[]>;
}

/** Listener for the messages of SUCCESSFUL responses (`_server_messages`: the "Saved" alert, validate_link's "Cannot
 *  Fetch Values", assign_to's "Already in … ToDo list" …). Errors carry theirs in `FrappeError.messages`. */
export type ServerMessagesListener = (messages: FrappeMessage[], method: string) => void;

/** What `createFrappeClient` returns: the 0.3 client + the 0.4.0 DocumentApi and RecordApi (contract.ts). */
export interface FrappeApi extends FrappeClient, DocumentApi, RecordApi {
  /** Cancel; `workflow` sets the state field first, as Desk does for a workflow doctype (save.py cancel). */
  cancelDoc(doctype: string, name: string, opts?: { workflowStateField?: string; workflowState?: string }): Promise<FrappeDoc>;
  subscribeMessages(listener: ServerMessagesListener): () => void;
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
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asJson = (v: unknown) => (typeof v === "string" ? v : json(v));

function defaultSession(): SessionUser | undefined {
  const s = (globalThis as unknown as { frappe?: { session?: { user?: unknown; user_fullname?: unknown } } }).frappe?.session;
  return typeof s?.user === "string" && s.user ? { user: s.user, fullName: typeof s.user_fullname === "string" ? s.user_fullname : undefined } : undefined;
}

/** getdoctype `docs` → MetaBundle: the DocType itself, then its child-table DocTypes (load.py:89-96). A top-level
 *  `__messages` in the response (request.js merges it into Desk's dictionary) is folded into `meta.__messages`. */
export function toMetaBundle(doctype: string, res: FrappeResponse): MetaBundle {
  const docs = arr<DocTypeMeta>(res.docs).filter((d) => d && typeof d.name === "string");
  const meta = docs.find((d) => d.name === doctype);
  if (!meta) throw new FrappeError(`No metadata for DocType "${doctype}"`, 404, "DoesNotExistError");
  const children: Record<string, DocTypeMeta> = {};
  for (const d of docs) if (d !== meta) children[d.name] = d;
  const top = res.__messages && typeof res.__messages === "object" ? (res.__messages as Record<string, string>) : undefined;
  const merged = top || meta.__messages ? { ...(top ?? {}), ...(meta.__messages ?? {}) } : undefined;
  return { doctype, meta: merged ? { ...meta, __messages: merged } : meta, children };
}

/** docinfo with every list the contract types as required present (a key the server left out becomes []). */
export function normalizeDocInfo(raw: unknown): DocInfo {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...d,
    attachments: arr(d.attachments), communications: arr(d.communications), comments: arr(d.comments), versions: arr(d.versions),
    assignments: arr(d.assignments), assignment_logs: arr(d.assignment_logs), shared: arr(d.shared), views: arr(d.views),
    permissions: (d.permissions && typeof d.permissions === "object" ? d.permissions : {}) as DocInfo["permissions"],
    user_info: (d.user_info && typeof d.user_info === "object" ? d.user_info : {}) as DocInfo["user_info"],
  };
}

/**
 * The active Workflow of a DocType from its getdoctype meta: `__workflow_docs` = [Workflow, …its Workflow State docs]
 * (desk/form/meta.py load_workflows; Desk reads it in model/workflow.js `setup`). States get the Workflow State's
 * `style` (indicator colour). Null when the DocType has no active workflow.
 */
export function workflowFromMeta(meta: DocTypeMeta | undefined): WorkflowInfo | null {
  const docs = arr<Record<string, unknown>>(meta?.__workflow_docs);
  const wf = docs.find((d) => d?.doctype === "Workflow");
  if (!wf) return null;
  const styles = new Map(docs.filter((d) => d?.doctype === "Workflow State").map((d) => [String(d.name), d.style as string | undefined]));
  const states = arr<WorkflowState>(wf.states).map((s) => (s.style || !styles.get(s.state) ? s : { ...s, style: styles.get(s.state) }));
  return { ...wf, name: String(wf.name), document_type: String(wf.document_type), workflow_state_field: String(wf.workflow_state_field), states, transitions: arr<WorkflowTransition>(wf.transitions) } as WorkflowInfo;
}

function savedDoc(res: FrappeResponse, fallback: FrappeDoc, method: string): FrappeDoc {
  const doc = arr<FrappeDoc>(res.docs)[0] ?? (res.message && typeof res.message === "object" && !Array.isArray(res.message) ? (res.message as FrappeDoc) : undefined);
  if (doc) return doc;
  // UNVERIFIED (not exercised on a site): Submit of a `queue_in_background` DocType returns nothing (save.py:34-36,
  // workflow.py apply_workflow) — the submission was queued. We return the sent document flagged `__queued: 1`.
  void method;
  return { ...fallback, __queued: 1 };
}

/** The 0.4.0 DocumentApi + RecordApi over any transport. */
export function createDocumentApis(call: FrappeTransport, session: FrappeClientOptions["session"] = defaultSession): DocumentApi & RecordApi & Pick<FrappeApi, "cancelDoc"> {
  const getMetaBundle = async (doctype: string) => toMetaBundle(doctype, await call("frappe.desk.form.load.getdoctype", { doctype }));
  return {
    getMetaBundle,
    async getDoc(doctype, name) {
      const res = await call("frappe.desk.form.load.getdoc", { doctype, name });
      const doc = arr<FrappeDoc>(res.docs)[0];
      // A missing document is NOT an HTTP error in Frappe: getdoc answers 200 `{docs: []}` (load.py:33-38).
      if (!doc) throw new FrappeError(`${doctype} ${name} not found`, 404, "DoesNotExistError", { kind: "not_found" });
      return { doc, docinfo: normalizeDocInfo(res.docinfo) } satisfies LoadedDoc;
    },
    async getDocInfo(doctype, name) {
      const res = await call("frappe.desk.form.load.get_docinfo", { doctype, name });
      return normalizeDocInfo(res.docinfo);
    },
    async saveDoc(doc, action) {
      return savedDoc(await call("frappe.desk.form.save.savedocs", { doc: json(doc), action }), doc, "savedocs");
    },
    async cancelDoc(doctype: string, name: string, opts: { workflowStateField?: string; workflowState?: string } = {}) {
      const res = await call("frappe.desk.form.save.cancel", {
        doctype, name, ...(opts.workflowStateField && opts.workflowState ? { workflow_state_fieldname: opts.workflowStateField, workflow_state: opts.workflowState } : {}),
      });
      return savedDoc(res, { doctype, name }, "cancel");
    },
    async deleteDoc(doctype, name) {
      await call("frappe.client.delete", { doctype, name });
    },
    async renameDoc(doctype, oldName, newName, opts = {}) {
      const res = await call("frappe.rename_doc", { doctype, old: oldName, new: newName, merge: !!opts.merge });
      return typeof res.message === "string" ? res.message : newName;
    },
    async validateLink(doctype, value, fetchFields) {
      const res = await call("frappe.client.validate_link", { doctype, docname: value, ...(fetchFields?.length ? { fields: json(fetchFields) } : {}) });
      const { name, ...values } = (res.message && typeof res.message === "object" ? res.message : {}) as Record<string, unknown>;
      return { name: typeof name === "string" && name ? name : null, values } satisfies ValidateLinkResult;
    },
    async runDocMethod(doc, method, args) {
      const res = await call("run_doc_method", { docs: json(doc), method, ...(args !== undefined ? { args: json(args) } : {}) });
      return { doc: arr<FrappeDoc>(res.docs)[0], message: res.message };
    },

    async getWorkflow(doctype) {
      return workflowFromMeta((await getMetaBundle(doctype)).meta);
    },
    async getWorkflowTransitions(doc) {
      const res = await call("frappe.model.workflow.get_transitions", { doc: json(doc) });
      return arr<WorkflowTransition>(res.message);
    },
    async applyWorkflow(doc, action) {
      return savedDoc(await call("frappe.model.workflow.apply_workflow", { doc: json(doc), action }), doc, "apply_workflow");
    },
    async addAssignment(doctype, name, users, opts = {}) {
      const res = await call("frappe.desk.form.assign_to.add", {
        doctype, name, assign_to: json(users),
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(opts.date ? { date: opts.date } : {}),
        ...(opts.priority ? { priority: opts.priority } : {}),
      });
      // Frappe returns at most 5 open assignments (assign_to.py get, LIMIT 5); docinfo.assignments is uncapped.
      return arr<AssignmentInfo>(res.message);
    },
    async removeAssignment(doctype, name, user) {
      return arr<AssignmentInfo>((await call("frappe.desk.form.assign_to.remove", { doctype, name, assign_to: user })).message);
    },
    async addComment(doctype, name, content) {
      const who = (typeof session === "function" ? session() : session) ?? undefined;
      const res = await call("frappe.desk.form.utils.add_comment", {
        reference_doctype: doctype, reference_name: name, content, comment_email: who?.user ?? "", comment_by: who?.fullName ?? who?.user ?? "",
      });
      const c = (res.message ?? {}) as Record<string, unknown>;
      return { ...c, name: String(c.name ?? ""), content: String(c.content ?? content), owner: String(c.owner ?? who?.user ?? ""), creation: String(c.creation ?? ""), comment_type: (c.comment_type as string | undefined) ?? "Comment" } as CommentInfo;
    },
    async updateComment(commentName, content) {
      await call("frappe.desk.form.utils.update_comment", { name: commentName, content });
    },
    async deleteComment(commentName) {
      await call("frappe.client.delete", { doctype: "Comment", name: commentName });
    },
  };
}

export function createFrappeClient(opts: FrappeClientOptions = {}): FrappeApi {
  const transport = opts.transport ?? fetchTransport(opts);
  const listeners = new Set<ServerMessagesListener>();
  const call: FrappeTransport = async (method, args) => {
    const res = await transport(method, args);
    if (listeners.size && res && res._server_messages) {
      const messages = parseServerMessages(res._server_messages);
      if (messages.length) for (const l of [...listeners]) l(messages, method);
    }
    return res;
  };
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
        ...(o.filters !== undefined ? { filters: asJson(o.filters) } : {}),
        ...(o.query ? { query: o.query } : {}),
        ...(o.searchfield ? { searchfield: o.searchfield } : {}),
        ...(o.ignoreUserPermissions ? { ignore_user_permissions: 1 } : {}),
      });
      return arr<SearchResult>(res.message);
    },
    ...createDocumentApis(call, opts.session ?? defaultSession),
    subscribeMessages(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * Any FrappeClient (e.g. a 0.3-style custom one) → FrappeApi. A client from `createFrappeClient` is returned as is;
 * otherwise its own 0.3 methods are kept and the 0.4.0 methods are built over its `call`.
 */
export function withFrappeApi(client: FrappeClient): FrappeApi {
  const c = client as Partial<FrappeApi>;
  if (typeof c.getMetaBundle === "function" && typeof c.addComment === "function" && typeof c.subscribeMessages === "function") return client as FrappeApi;
  const full = createFrappeClient({ transport: client.call });
  return {
    ...full,
    call: client.call,
    getMeta: client.getMeta.bind(client),
    getList: client.getList.bind(client) as FrappeClient["getList"],
    getCount: client.getCount.bind(client),
    searchLink: client.searchLink.bind(client),
  };
}
