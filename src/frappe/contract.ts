/**
 * @solvfast/ui/frappe — the 0.4.0 integration contract.
 *
 * Owned by the Lead. Agents implement against it and request changes; they never edit it.
 * Types and key factories only — implementations live in services/ and hooks/ (foundation), form/ (forms),
 * record/ (workflow · assignment · timeline) and the list modules. Native behaviour each type encodes is traced in
 * apps/serve_fast/docs/frappe-components/10–14 (Frappe 15.110.0, ab7e5ae); `tests/fixtures/real-15.110/` holds real
 * `getdoctype` payloads captured read-only from the CRM site.
 */
import type { FrappeTransport } from "./client";
import type { FrappeFilter } from "./query";

/** Formatting settings the app supplies (boot sysdefaults equivalents) — defined with `formatValue`. */
export type { FormatContext } from "./services/format";

export type Check = 0 | 1;

// ---- Metadata (getdoctype → `docs`: the DocType first, then its child-table DocTypes) --------------------------------

/** Every DocField property the components read. Unknown properties are preserved. */
export interface FrappeDocField {
  fieldname: string;
  fieldtype: string;
  label?: string;
  options?: string;
  description?: string;
  default?: string;
  idx?: number;
  reqd?: Check;
  hidden?: Check;
  read_only?: Check;
  bold?: Check;
  /** `eval:<js>` (context: `doc`, `parent`), a fieldname (truthiness), or `fn:<event>` — client-only in Frappe. */
  depends_on?: string;
  mandatory_depends_on?: string;
  read_only_depends_on?: string;
  collapsible?: Check;
  collapsible_depends_on?: string;
  fetch_from?: string;
  fetch_if_empty?: Check;
  permlevel?: number;
  precision?: string;
  length?: number;
  non_negative?: Check;
  unique?: Check;
  set_only_once?: Check;
  allow_on_submit?: Check;
  ignore_user_permissions?: Check;
  /** JSON list of filters; in 15.110 applied by the client only (narrows the search, not enforced on save). */
  link_filters?: string;
  in_list_view?: Check;
  in_standard_filter?: Check;
  in_global_search?: Check;
  columns?: number;
  print_hide?: Check;
  translatable?: Check;
  is_virtual?: Check;
  [key: string]: unknown;
}

export interface DocPerm {
  role: string;
  permlevel: number;
  if_owner?: Check;
  read?: Check; write?: Check; create?: Check; delete?: Check; submit?: Check; cancel?: Check; amend?: Check;
  report?: Check; export?: Check; import?: Check; print?: Check; email?: Check; share?: Check; select?: Check;
}

export interface DocTypeMeta {
  name: string;
  module?: string;
  istable?: Check;
  issingle?: Check;
  is_submittable?: Check;
  /** DocType "Allow Import": required for the Import right (permissions.py:142, 221). */
  allow_import?: Check;
  is_tree?: Check;
  is_virtual?: Check;
  editable_grid?: Check;
  quick_entry?: Check;
  track_changes?: Check;
  track_seen?: Check;
  track_views?: Check;
  allow_rename?: Check;
  title_field?: string;
  image_field?: string;
  search_fields?: string;
  sort_field?: string;
  sort_order?: string;
  show_title_field_in_link?: Check;
  autoname?: string;
  max_attachments?: number;
  fields: FrappeDocField[];
  permissions?: DocPerm[];
  /**
   * Translations (source → translated). NOT returned by `getdoctype` in 15.110 (always absent there); Desk gets them
   * from boot. `translateLabel` uses this when present, else an app-supplied dictionary.
   */
  __messages?: Record<string, string> | null;
  [key: string]: unknown;
}

/** One DocType with everything `getdoctype` returned for it. */
export interface MetaBundle {
  doctype: string;
  meta: DocTypeMeta;
  /** Child-table DocTypes (Table / Table MultiSelect options), by name. */
  children: Record<string, DocTypeMeta>;
}

// ---- Documents (getdoc → `docs[0]` + `docinfo`; fields the user cannot read are ABSENT, not null) ---------------------

export interface FrappeDoc {
  doctype: string;
  name: string;
  docstatus?: 0 | 1 | 2;
  owner?: string;
  creation?: string;
  modified?: string;
  modified_by?: string;
  idx?: number;
  parent?: string;
  parentfield?: string;
  parenttype?: string;
  /** New, unsaved. New child rows MUST carry this (or omit `name`): otherwise the server UPDATEs nothing and drops them. */
  __islocal?: Check;
  __unsaved?: Check;
  /** `__onload` set by the controller's `onload` (server). */
  __onload?: Record<string, unknown>;
  [field: string]: unknown;
}

export interface UserInfo { fullname: string; image?: string | null; name?: string }
export interface AttachmentInfo { name: string; file_name: string; file_url: string; is_private: Check }
export interface CommentInfo { name: string; content: string; owner: string; creation: string; comment_type?: string }
export interface VersionInfo { name: string; owner: string; creation: string; /** JSON: { changed, added, removed, row_changed } */ data: string }
export interface AssignmentInfo { name?: string; owner: string; description?: string; status?: string }

/** `get_docinfo` (desk/form/load.py:100). Keys not listed here are preserved as `unknown`. */
export interface DocInfo {
  attachments: AttachmentInfo[];
  communications: unknown[];
  comments: CommentInfo[];
  versions: VersionInfo[];
  assignments: AssignmentInfo[];
  assignment_logs: unknown[];
  attachment_logs?: unknown[];
  info_logs?: unknown[];
  like_logs?: unknown[];
  workflow_logs?: unknown[];
  shared: unknown[];
  views: unknown[];
  milestones?: unknown[];
  tags?: string;
  is_document_followed?: boolean | Check;
  /** `get_doc_permissions` for the document (permlevel 0), incl. `if_owner` / `has_if_owner_enabled`. */
  permissions: Partial<Record<PermType, Check>> & { if_owner?: Record<string, Check>; has_if_owner_enabled?: boolean };
  user_info: Record<string, UserInfo>;
  [key: string]: unknown;
}

export interface LoadedDoc { doc: FrappeDoc; docinfo: DocInfo }

export type SaveAction = "Save" | "Submit" | "Update" | "Cancel";

// ---- Permissions -----------------------------------------------------------------------------------------------------

export type PermType =
  | "read" | "write" | "create" | "delete" | "submit" | "cancel" | "amend"
  | "report" | "export" | "import" | "print" | "email" | "share" | "select";

/** Rights per permlevel, like Desk's `frm.perm` (index = permlevel; level 0 carries the document-level rights). */
export type DocPermissions = Array<Partial<Record<PermType, boolean>>>;

/** `frappe.perm.get_field_display_status` (model/perm.js:191) — see docs `11` §2.5 for the exact ladder. */
export type FieldDisplayStatus = "Write" | "Read" | "None";

// ---- Errors and server messages --------------------------------------------------------------------------------------

/**
 * Classification of a failed call. Mapping (frappe/exceptions.py, 15.110):
 *  permission ← PermissionError (403) · not_found ← DoesNotExistError (404), LinkExpired (410), and getdoc's 200 with
 *  no docs · duplicate ← DuplicateEntryError (409), UniqueValidationError (417) · timestamp ← TimestampMismatchError
 *  (417) · mandatory ← MandatoryError (417) · link ← LinkValidationError / LinkExistsError (417) · validation ← any
 *  other ValidationError subclass (417) and a plain NameError (409) · csrf ← CSRFTokenError (400) · session_expired ←
 *  body `session_expired: 1` or 401 · too_large ← 413 (non-JSON) · rate_limited ← TooManyRequestsError /
 *  RateLimitExceededError (429) · unavailable ← 503 (InReadOnlyMode, QueueOverloaded, SessionStopped, maintenance) ·
 *  network ← status 0 · server ← anything else (5xx, unparseable).
 */
export type FrappeErrorKind =
  | "permission" | "not_found" | "duplicate" | "timestamp" | "mandatory" | "link" | "validation"
  | "csrf" | "session_expired" | "too_large" | "rate_limited" | "unavailable" | "network" | "server";

/** One entry of `_server_messages` (a JSON list of JSON strings). `message` may contain HTML (sanitize before rendering). */
export interface FrappeMessage {
  message: string;
  title?: string;
  /** "red" | "orange" | "green" | "blue" | "yellow" | "gray" … — a semantic, mapped to DS tones. */
  indicator?: string;
  raiseException?: boolean;
  alert?: boolean;
}

/** What `FrappeError` (client.ts) exposes in 0.4.0, in addition to `status` and `excType`. */
export interface FrappeErrorInfo {
  status: number;
  excType?: string;
  kind: FrappeErrorKind;
  messages: FrappeMessage[];
  /** Last line of the server traceback, when the site allows tracebacks. */
  exception?: string;
}

// ---- Client surface (0.4.0). `createFrappeClient` returns an object implementing all of these. -----------------------

export interface SearchLinkOptions {
  referenceDoctype?: string;
  pageLength?: number;
  filters?: FrappeFilter[] | Record<string, unknown>;
  /** Dotted path of a whitelisted custom query (DocField `get_query` equivalent). */
  query?: string;
  searchfield?: string;
  ignoreUserPermissions?: boolean;
  /**
   * Extra keys a custom link query returned (Desk's `get_query` result object: link.js merges them into the
   * search_link request). Sent as top-level request args (objects / lists as JSON); `search_link` itself drops them,
   * a custom query reads them from `frappe.form_dict`. They never replace the keys above.
   */
  args?: Record<string, unknown>;
}
export interface SearchResult { value: string; label?: string; description?: string }

export interface ValidateLinkResult {
  /** The canonical name, or null when the value does not exist / is not permitted. */
  name: string | null;
  /** Values of the requested fetch fields. */
  values: Record<string, unknown>;
}

export interface WorkflowState { state: string; doc_status: string; allow_edit?: string; update_field?: string; update_value?: string; style?: string }
export interface WorkflowTransition { state: string; action: string; next_state: string; allowed: string; allow_self_approval?: Check; condition?: string }
export interface WorkflowInfo {
  name: string;
  document_type: string;
  workflow_state_field: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface DocumentApi {
  getMetaBundle(doctype: string): Promise<MetaBundle>;
  getDoc(doctype: string, name: string): Promise<LoadedDoc>;
  getDocInfo(doctype: string, name: string): Promise<DocInfo>;
  /** `frappe.desk.form.save.savedocs`; returns the saved document as the server sent it back. */
  saveDoc(doc: FrappeDoc, action: Exclude<SaveAction, "Cancel">): Promise<FrappeDoc>;
  cancelDoc(doctype: string, name: string): Promise<FrappeDoc>;
  deleteDoc(doctype: string, name: string): Promise<void>;
  /** `frappe.rename_doc` (what Desk uses), not `frappe.client.rename_doc`. */
  renameDoc(doctype: string, oldName: string, newName: string, opts?: { merge?: boolean }): Promise<string>;
  validateLink(doctype: string, value: string, fetchFields?: string[]): Promise<ValidateLinkResult>;
  runDocMethod(doc: FrappeDoc, method: string, args?: Record<string, unknown>): Promise<{ doc?: FrappeDoc; message?: unknown }>;
}

export interface RecordApi {
  getWorkflow(doctype: string): Promise<WorkflowInfo | null>;
  getWorkflowTransitions(doc: FrappeDoc): Promise<WorkflowTransition[]>;
  applyWorkflow(doc: FrappeDoc, action: string): Promise<FrappeDoc>;
  addAssignment(doctype: string, name: string, users: string[], opts?: { description?: string; date?: string; priority?: "Low" | "Medium" | "High" }): Promise<AssignmentInfo[]>;
  removeAssignment(doctype: string, name: string, user: string): Promise<AssignmentInfo[]>;
  addComment(doctype: string, name: string, content: string): Promise<CommentInfo>;
  updateComment(commentName: string, content: string): Promise<void>;
  deleteComment(commentName: string): Promise<void>;
}

// ---- React Query keys and invalidation -------------------------------------------------------------------------------

/**
 * Query keys. The "sf-frappe" prefix is the one 0.3.x already uses (`invalidateFrappeList`).
 * Invalidation rules (implemented once, in hooks/; components never invent keys):
 *  - save / submit / update / cancel / amend / rename / workflow action → set `doc`, invalidate `docinfo`, `list`, `count`
 *    of that doctype (rename: also remove the old `doc` key);
 *  - delete → remove `doc` + `docinfo`, invalidate `list`, `count`;
 *  - comment / assignment / attachment / share / follow → invalidate `docinfo`, and `list` (assignee / comment columns);
 *  - realtime `doc_update` newer than the cached `modified` → invalidate `doc` + `docinfo`;
 *    `list_update` → invalidate `list` + `count` (the list view debounces: 2 s, 15 s for large tables, never while rows
 *    are selected — docs `13` §2).
 */
export const frappeKeys = {
  all: ["sf-frappe"] as const,
  meta: (doctype: string) => ["sf-frappe", "meta", doctype] as const,
  metaBundle: (doctype: string) => ["sf-frappe", "meta-bundle", doctype] as const,
  doc: (doctype: string, name: string) => ["sf-frappe", "doc", doctype, name] as const,
  docinfo: (doctype: string, name: string) => ["sf-frappe", "docinfo", doctype, name] as const,
  list: (doctype: string) => ["sf-frappe", "list", doctype] as const,
  count: (doctype: string) => ["sf-frappe", "count", doctype] as const,
  search: (doctype: string, txt: string, opts?: SearchLinkOptions) => ["sf-frappe", "search", doctype, txt, opts ?? null] as const,
  workflow: (doctype: string) => ["sf-frappe", "workflow", doctype] as const,
};

// ---- Realtime (optional; the app injects a Socket.IO-backed port) ----------------------------------------------------

export interface RealtimeEvent {
  event: "doc_update" | "list_update" | "docinfo_update" | "progress" | "msgprint";
  doctype?: string;
  name?: string;
  data?: unknown;
}
export interface RealtimePort {
  subscribeDoc(doctype: string, name: string, onEvent: (e: RealtimeEvent) => void): () => void;
  subscribeDoctype(doctype: string, onEvent: (e: RealtimeEvent) => void): () => void;
}

// ---- Simulated backend (development fixtures; NEVER evidence of Frappe parity) ---------------------------------------

/**
 * Input of `createFixtureTransport` (testing/, foundation agent). It answers the client's methods from memory so that
 * apps (the CRM in "simulated" mode) and tests can run without a site. It implements request/response SHAPES only;
 * validation, permissions and naming are simplified and must never be reported as Frappe behaviour.
 */
export interface FixtureBackend {
  /** getdoctype payloads by DocType name (as captured in tests/fixtures/real-15.110/, or authored). */
  meta: Record<string, DocTypeMeta[]>;
  /** Initial records by DocType (child rows inline, as in getdoc). */
  docs?: Record<string, FrappeDoc[]>;
  /** The simulated session user (default "Administrator"). */
  user?: string;
  workflows?: Record<string, WorkflowInfo>;
  /** Artificial latency in ms (default 0). */
  latency?: number;
}
export type CreateFixtureTransport = (backend: FixtureBackend) => FrappeTransport;
