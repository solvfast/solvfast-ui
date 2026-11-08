/**
 * createFixtureTransport — a SIMULATED Frappe backend held in memory.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ SIMULATED. It reproduces the REQUEST and RESPONSE SHAPES of the whitelisted methods the package calls (docs 10, │
 * │ 11, 13, 14; Frappe 15.110 argument names), so apps ("simulated mode") and tests run without a site. Validation, │
 * │ permissions (the session user may do everything), naming, filtering, search, workflow conditions and messages  │
 * │ are SIMPLIFIED. Nothing observed here is evidence of how Frappe behaves; report results on it as "Simulated".  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * What it keeps: documents by DocType with child rows inline; new documents get names (field:, naming series with
 * `.YYYY.` / `#`, `__newname`, else a 10-character hash); child rows get names, parent / parentfield / parenttype / idx;
 * `modified` is bumped on every write and checked on save (TimestampMismatchError); static `reqd` is checked
 * (MandatoryError); docstatus moves 0 → 1 (submit, submittable DocTypes only) → 2 (cancel); workflows come from
 * `backend.workflows` (served in getdoctype `__workflow_docs`, used by get_transitions / apply_workflow); assignments,
 * comments, `_assign`, `_comments`, list user settings. Errors are built as Frappe's error bodies and passed through
 * the client's own parser (`toFrappeError`), exactly like the HTTP transport.
 */
import { toFrappeError, type DownloadedFile, type FrappeFilesTransport, type FrappeResponse, type FrappeTransport } from "../client";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, FrappeDocField, PermType, WorkflowInfo } from "../contract";
import type { FrappeSession } from "../services/permissions";
import { createPermissionEngine, permissionError, type PermissionEngine, type SimulatedPermissions } from "./permissions";
import { workstreamHandlers } from "./handlers";
import { USER_GROUP_MEMBER_META, userGroupMeta } from "./handlers/sidebar";
import { parseCsv, parseTemplate, payloadsOf, previewOf, type ParsedTemplate } from "./importer";
import { fieldCurrency, formatDate, formatDatetime, formatDuration, formatNumber, formatTime, numberFormatPrecision, type FormatContext } from "../services/format";

type Row = Record<string, unknown>;
type Filter = [string, string, unknown] | [string, string, string, unknown];
/** A simulated method. The transport always passes the third argument (P35): the context below — older two-argument
 *  handlers keep working unchanged. */
export type FixtureHandler = (args: Record<string, unknown>, backend: FixtureStore, ctx?: FixtureContext) => FrappeResponse | Promise<FrappeResponse>;
/** A handler written against the context (the package's own workstream handlers). */
export type FixtureContextHandler = (args: Record<string, unknown>, backend: FixtureStore, ctx: FixtureContext) => FrappeResponse | Promise<FrappeResponse>;

/**
 * What a handler can use besides the store (P35) — the transport's OWN machinery, so handlers do not approximate it:
 * the opt-in permission engine, the row filter of `get_list` / `reportview.get` and the transport's options. SIMULATED.
 */
export interface FixtureContext {
  /** The permission engine when `options.permissions` is given; null = the historical "every right" simulator. */
  permissions: PermissionEngine | null;
  /** `permissions?.assertDoc(doc, ptype)`: 403 without the right (P on); nothing is refused when permissions are off. */
  assertDoc(doc: FrappeDoc, ptype?: PermType): void;
  /** `permissions?.assertDoctype(doctype, ptype)` (`frappe.has_permission(doctype, ptype, throw=True)`). */
  assertDoctype(doctype: string, ptype?: PermType): void;
  /** The rows of a list query as `frappe.get_list` returns them here: `filters` / `or_filters` (dict or lists, child-table
   *  4-tuples included, every simulated operator), `order_by`, and — P on — only the rows the session may read (403
   *  without read; `ignorePermissions` skips that as `ignore_permissions=True`). Unknown fields → DataError (417). */
  rows(doctype: string, args: Record<string, unknown>, opts?: { ignorePermissions?: boolean }): FrappeDoc[];
  /** Print Settings as the server reads them: a stored "Print Settings" single wins over `options.printSettings`;
   *  default drafts allowed, cancelled not. */
  printSettings(): { allow_print_for_draft: boolean; allow_print_for_cancelled: boolean };
  /** The transport's clock (`options.now`) and a Frappe timestamp from it. */
  now(): Date;
  stamp(): string;
  /** The session user. */
  user: string;
  options: Readonly<FixtureOptions>;
}

export interface FixtureOptions {
  /** Extra or overriding methods (custom whitelisted methods, controller methods via "run_doc_method:<method>"). */
  handlers?: Record<string, FixtureHandler>;
  /** The simulated user's roles (workflow transitions are filtered by them). Default: every role is allowed. Ignored
   *  when `permissions` is given (the evaluated roles are used). */
  roles?: string[];
  /**
   * Opt-in SERVER-SIDE permission evaluation (SIMULATED approximation of frappe/permissions.py; see ./permissions.ts and
   * docs/qa/simulator-caveats.md §4): the session user, its roles, User Permissions, DocShare rows, controller hooks.
   * Every call is then evaluated from DocPerm rows × roles: getdoc / lists / saves / deletes / workflow / assignment /
   * download_template answer 403 without the right, permlevel > 0 values the roles cannot read are stripped, and
   * `docinfo.permissions` / `docinfo.shared` are computed. Without it the simulator behaves as before (every right).
   */
  permissions?: SimulatedPermissions;
  /** Fixed clock for `modified` / `creation` (tests). Default: the real clock. */
  now?: () => Date;
  /**
   * Opt-in extra validation on save (off by default): Link / Dynamic Link values must exist in the simulator (targets
   * the simulator has no meta for are skipped), Select values must be one of the options — parent and child rows, in
   * Frappe's order (links before mandatory, selects after). Still SIMULATED: no formats, lengths, permissions.
   */
  strict?: boolean;
  /** The site's system defaults as the SERVER formats with them (Version values). Default: Frappe's defaults. */
  formatContext?: FormatContext;
  /** Print Settings the simulated `get_print` honours for submittable DocTypes (printview.py:137-142). Default: the
   *  DocType defaults (drafts allowed, cancelled not). */
  printSettings?: { allow_print_for_draft?: 0 | 1 | boolean; allow_print_for_cancelled?: 0 | 1 | boolean };
  /**
   * What the simulated Data Import job does with the uploaded rows (`form_start_import`). "dry-run" (default): every row
   * is checked (create / write right, mandatory, Link values) and logged — NOTHING is written to the store, and every
   * log row says so. "insert": the simulator plays the server and inserts / updates the rows through its save path
   * (labelled in the log). CSV files only.
   */
  dataImport?: "dry-run" | "insert";
  /** `frappe.desk.listview.get_list_settings` answers by DocType (List View Settings rows). Default: null. */
  listSettings?: Record<string, Record<string, unknown> | null>;
}

export interface FixtureCall { method: string; args: Record<string, unknown> }

/** The in-memory state (exposed on the transport as `.store` for tests and app tooling). */
export interface FixtureStore {
  docs: Map<string, Map<string, FrappeDoc>>;
  meta: Record<string, DocTypeMeta[]>;
  workflows: Record<string, WorkflowInfo>;
  comments: Map<string, Row>;
  /** The `ToDo` documents (the same Map as `docs.get("ToDo")`): open ToDos drive assignments and `_assign`. */
  todos: Map<string, Row>;
  userSettings: Record<string, string>;
  user: string;
  calls: FixtureCall[];
  /** With `options.permissions`: the session the CLIENT should be given (`FrappeProvider session`) — the evaluated
   *  roles, or none when the scenario says the client does not know them. Undefined otherwise. */
  session?: FrappeSession;
  /** Messages the server would push over realtime instead of answering them (`msgprint(..., realtime=True)`), e.g.
   *  delete_items' "Failed to delete …" (reportview.py:608-616). The simulator has no socket; they are kept here. */
  published: { event: string; message: string; title?: string }[];
}

export type FixtureTransport = FrappeTransport & {
  store: FixtureStore;
  /** The SIMULATED file server for `createFrappeClient({ files })`: `download_template` answers a small text file that
   *  says it is simulated (labels and the request echo — never data); uploads are refused (417). With
   *  `options.permissions` the download is permission-checked first (data_import.py:188, exporter.py:116-126). */
  files: FrappeFilesTransport;
  /** The permission evaluator when `options.permissions` is given (tests / tooling), else null. */
  permissions: PermissionEngine | null;
};

const DOWNLOAD_TEMPLATE = "frappe.core.doctype.data_import.data_import.download_template";
const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button", "Image", "Page Break"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
const STANDARD = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype", "_assign", "_comments", "_liked_by", "_user_tags", "_seen"];
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const sm = (...messages: Row[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));

function fail(status: number, exc_type: string, message: string, extra: Row = {}): never {
  throw toFrappeError(status, { exc_type, _server_messages: sm({ message, indicator: "red", raise_exception: 1 }), ...extra });
}
const notFound = (what: string) => fail(404, "DoesNotExistError", `${what} not found`);

function like(value: unknown, pattern: string) {
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "is");
  return re.test(String(value ?? ""));
}
function cmp(a: unknown, b: unknown): number {
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && a != null && b != null && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function timespan(span: string, now: Date): [string, string] {
  const d = (y: number, m: number, day: number) => new Date(y, m, day);
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate(), q = Math.floor(m / 3) * 3;
  const dow = (now.getDay() + 6) % 7; // Monday first (UNVERIFIED: Frappe uses the site's first day of the week)
  const r = (a: Date, b: Date): [string, string] => [ymd(a), ymd(b)];
  const n = /^(last|next) (\d+) (days|months)$/.exec(span);
  if (n) {
    const k = Number(n[2]) * (n[1] === "last" ? -1 : 1);
    const other = n[3] === "days" ? d(y, m, day + k) : d(y, m + k, day);
    return k < 0 ? r(other, now) : r(now, other);
  }
  switch (span) {
    case "today": return r(now, now);
    case "yesterday": return r(d(y, m, day - 1), d(y, m, day - 1));
    case "tomorrow": return r(d(y, m, day + 1), d(y, m, day + 1));
    case "this week": return r(d(y, m, day - dow), d(y, m, day - dow + 6));
    case "last week": return r(d(y, m, day - dow - 7), d(y, m, day - dow - 1));
    case "next week": return r(d(y, m, day - dow + 7), d(y, m, day - dow + 13));
    case "this month": return r(d(y, m, 1), d(y, m + 1, 0));
    case "last month": return r(d(y, m - 1, 1), d(y, m, 0));
    case "next month": return r(d(y, m + 1, 1), d(y, m + 2, 0));
    case "this quarter": return r(d(y, q, 1), d(y, q + 3, 0));
    case "last quarter": return r(d(y, q - 3, 1), d(y, q, 0));
    case "next quarter": return r(d(y, q + 3, 1), d(y, q + 6, 0));
    case "this year": return r(d(y, 0, 1), d(y, 11, 31));
    case "last year": return r(d(y - 1, 0, 1), d(y - 1, 11, 31));
    case "next year": return r(d(y + 1, 0, 1), d(y + 1, 11, 31));
    default: return fail(417, "ValidationError", `Unsupported timespan ${span}`);
  }
}

/** One condition on one row (the operators the package's list sends). */
function matches(v: unknown, op: string, value: unknown, now: Date): boolean {
  const blank = v === null || v === undefined || v === "";
  switch (op.toLowerCase()) {
    case "=": return String(v ?? "") === String(value ?? "");
    case "!=": return String(v ?? "") !== String(value ?? "");
    case "like": return like(v, String(value));
    case "not like": return !like(v, String(value));
    case "in": return (Array.isArray(value) ? value : String(value).split(",")).map((x) => String(x).trim()).includes(String(v ?? ""));
    case "not in": return !(Array.isArray(value) ? value : String(value).split(",")).map((x) => String(x).trim()).includes(String(v ?? ""));
    case ">": return !blank && cmp(v, value) > 0;
    case "<": return !blank && cmp(v, value) < 0;
    case ">=": return !blank && cmp(v, value) >= 0;
    case "<=": return !blank && cmp(v, value) <= 0;
    case "between": { const [a, b] = value as string[]; return !blank && String(v) >= String(a) && String(v) <= (String(b).length === 10 ? `${b} 23:59:59.999999` : String(b)); }
    case "timespan": { const [a, b] = timespan(String(value), now); return !blank && String(v) >= a && String(v) <= `${b} 23:59:59.999999`; }
    case "is": return String(value) === "set" ? !blank : blank;
    default: return fail(417, "ValidationError", `Unsupported operator ${op}`);
  }
}

function toFilters(raw: unknown, doctype: string): Filter[] {
  const f = parse(raw);
  if (!f) return [];
  if (Array.isArray(f)) return f.filter(Array.isArray) as Filter[];
  if (typeof f === "object") {
    return Object.entries(f as Row).map(([k, v]) => (Array.isArray(v) ? [doctype, k, String(v[0]), v[1]] : [doctype, k, "=", v]) as Filter);
  }
  return [];
}

const unquote = (field: string) => field.replace(/`/g, "").trim();
/** "`tabX`.`f`" / "tabX.f" / "f" → [doctype | undefined, fieldname]. */
function splitField(field: string): [string | undefined, string] {
  const u = unquote(field);
  const m = /^tab(.+)\.([^.]+)$/.exec(u);
  return m ? [m[1], m[2]] : [undefined, u];
}

/**
 * Minimal metas the package's own components need even when an app's fixture does not ship them (SIMULATED, a subset of
 * the real DocTypes' fields): `User` (assign picker: search_link with user_type / enabled) and `List Filter` (saved
 * filters: get_list / insert / delete). A backend that provides its own meta for them wins. Their DocPerm rows are the
 * native ones (core/doctype/user/user.json, desk/doctype/list_filter/list_filter.json), so the opt-in permission model
 * lets every Desk User search users (select) and keep saved filters.
 */
export const BUILTIN_FIXTURE_META: Record<string, DocTypeMeta[]> = {
  // core/doctype/user_group + user_group_member (Frappe 15.110 ships them on every site; P36c "Assign To User Group")
  "User Group": [userGroupMeta()],
  "User Group Member": [USER_GROUP_MEMBER_META],
  User: [{
    name: "User", autoname: "field:email", title_field: "full_name", search_fields: "full_name", show_title_field_in_link: 0,
    permissions: [
      { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, email: 1, export: 1, import: 1, print: 1, report: 1, share: 1 },
      { role: "System Manager", permlevel: 1, read: 1, write: 1 },
      { role: "Desk User", permlevel: 0, select: 1 },
    ],
    fields: [
      { fieldname: "email", fieldtype: "Data", label: "Email", options: "Email", reqd: 1 },
      { fieldname: "first_name", fieldtype: "Data", label: "First Name" },
      { fieldname: "full_name", fieldtype: "Data", label: "Full Name", read_only: 1 },
      { fieldname: "user_image", fieldtype: "Attach Image", label: "User Image" },
      { fieldname: "user_type", fieldtype: "Select", label: "User Type", options: "System User\nWebsite User" },
      { fieldname: "enabled", fieldtype: "Check", label: "Enabled", default: "1" },
    ],
  }],
  "List Filter": [{
    name: "List Filter", autoname: "hash",
    permissions: [{ role: "Desk User", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, email: 1, export: 1, print: 1, report: 1, share: 1 }],
    fields: [
      { fieldname: "filter_name", fieldtype: "Data", label: "Filter Name" },
      { fieldname: "reference_doctype", fieldtype: "Link", label: "Reference Document Type", options: "DocType" },
      { fieldname: "for_user", fieldtype: "Link", label: "For User", options: "User" },
      { fieldname: "filters", fieldtype: "Long Text", label: "Filters" },
    ],
  }],
  /** printing/doctype/letter_head/letter_head.json (the Print dialog lists them; Desk User reads). No records by default. */
  "Letter Head": [{
    name: "Letter Head", autoname: "field:letter_head_name",
    permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }, { role: "Desk User", permlevel: 0, read: 1 }],
    fields: [
      { fieldname: "letter_head_name", fieldtype: "Data", label: "Letter Head Name", reqd: 1 },
      { fieldname: "disabled", fieldtype: "Check", label: "Disabled", default: "0" },
      { fieldname: "is_default", fieldtype: "Check", label: "Is Default", default: "0" },
    ],
  }],
  /** desk/doctype/tag/tag.json (Add Tags creates the master; search_link on Tag). */
  Tag: [{
    name: "Tag", autoname: "Prompt",
    permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }, { role: "All", permlevel: 0, read: 1, write: 1, create: 1 }],
    fields: [{ fieldname: "description", fieldtype: "Small Text", label: "Description" }],
  }],
  /** core/doctype/data_import/data_import.json (a subset; System Manager only). Named by hash here (natively
   *  "format:{reference_doctype} Import on {creation}"). */
  "Data Import": [{
    name: "Data Import", autoname: "hash", title_field: "reference_doctype", track_changes: 0,
    permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }],
    fields: [
      { fieldname: "reference_doctype", fieldtype: "Link", label: "Document Type", options: "DocType", reqd: 1 },
      { fieldname: "import_type", fieldtype: "Select", label: "Import Type", options: "\nInsert New Records\nUpdate Existing Records", reqd: 1 },
      { fieldname: "import_file", fieldtype: "Attach", label: "Import File" },
      { fieldname: "template_options", fieldtype: "Code", label: "Template Options", options: "JSON", hidden: 1 },
      { fieldname: "status", fieldtype: "Select", label: "Status", options: "Pending\nSuccess\nPartial Success\nError\nTimed Out", default: "Pending", read_only: 1 },
      { fieldname: "template_warnings", fieldtype: "Code", label: "Template Warnings", options: "JSON", hidden: 1 },
      { fieldname: "submit_after_import", fieldtype: "Check", label: "Submit After Import", default: "0" },
      { fieldname: "mute_emails", fieldtype: "Check", label: "Don't Send Emails", default: "1" },
      { fieldname: "show_failed_logs", fieldtype: "Check", label: "Show Failed Logs", default: "0" },
      { fieldname: "google_sheets_url", fieldtype: "Data", label: "Import from Google Sheets" },
      { fieldname: "payload_count", fieldtype: "Int", label: "Payload Count", read_only: 1, hidden: 1 },
    ],
  }],
};
/** `BLOCKED_DOCTYPES` (data_import.py:19): core DocTypes except User, Role, Print Format. */
const IMPORT_BLOCKED = new Set(["DefaultValue", "DocType", "DocField", "DocPerm", "DocType Action", "DocType Link", "Has Role", "Page", "Module Def", "Report", "Customize Form", "Customize Form Field", "Property Setter", "Custom Field", "Client Script"]);
const DI = "frappe.core.doctype.data_import.data_import";
const PRINT_PDF = "frappe.utils.print_format.download_multi_pdf";
const EXPORT_QUERY = "frappe.desk.reportview.export_query";

export function createFixtureTransport(backend: FixtureBackend, options: FixtureOptions = {}): FixtureTransport {
  const now = options.now ?? (() => new Date());
  const user = options.permissions?.user ?? backend.user ?? "Administrator";
  const store: FixtureStore = {
    docs: new Map(), meta: { ...clone(BUILTIN_FIXTURE_META), ...clone(backend.meta) }, workflows: clone(backend.workflows ?? {}), comments: new Map(), todos: new Map(),
    userSettings: {}, user, calls: [], published: [],
  };
  store.docs.set("ToDo", store.todos as Map<string, FrappeDoc>);
  let lastTs = 0;
  let seq = 0;
  const counters: Record<string, number> = {};

  const metaOf = (doctype: string): DocTypeMeta | undefined => {
    for (const bundle of Object.values(store.meta)) { const m = bundle.find((d) => d.name === doctype); if (m) return m; }
    return undefined;
  };
  const requireMeta = (doctype: unknown): DocTypeMeta => metaOf(String(doctype)) ?? notFound(`DocType ${String(doctype)}`);
  const table = (doctype: string) => { let t = store.docs.get(doctype); if (!t) store.docs.set(doctype, (t = new Map())); return t; };
  const stamp = () => {
    const ms = Math.max(now().getTime(), lastTs + 1);
    lastTs = ms;
    const d = new Date(ms);
    return `${ymd(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}000`;
  };
  const hash = () => { let s = ""; while (s.length < 10) s += Math.random().toString(36).slice(2); return s.slice(0, 10); };
  const tableFields = (meta: DocTypeMeta | undefined) => (meta?.fields ?? []).filter((f) => TABLES.has(f.fieldtype) && f.options);

  /** The permission model (opt-in `options.permissions`); null = the historical "every right" simulator. */
  const P: PermissionEngine | null = options.permissions ? createPermissionEngine({
    config: options.permissions,
    metaOf,
    allMetas: () => Object.values(store.meta).flat(),
    knownRoles: () => Object.values(store.workflows).flatMap((w) => [...w.transitions.map((t) => t.allowed), ...w.states.map((st) => st.allow_edit)]).filter((r): r is string => !!r),
    userDoc: (u) => store.docs.get("User")?.get(u),
    shares: () => [...(store.docs.get("DocShare")?.values() ?? [])],
    stored: (doctype, name) => store.docs.get(doctype)?.get(name),
  }) : null;
  /** The doc as the session may see it (P on): unreadable permlevel values removed (`absent`) or nulled (`null`). */
  const visible = (doc: FrappeDoc, mode: "absent" | "null" = "absent"): FrappeDoc => (P ? P.stripDoc(doc, mode) : doc);
  const permissions = (meta: DocTypeMeta) => ({
    select: 1, read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1,
    submit: meta.is_submittable ? 1 : 0, cancel: meta.is_submittable ? 1 : 0, amend: meta.is_submittable ? 1 : 0,
  });

  /** `getseries`: one counter per prefix, shared by every DocType (tabSeries is keyed by the prefix only). */
  const nextNumber = (prefix: string, digits: number) => { counters[prefix] = (counters[prefix] ?? 0) + 1; return String(counters[prefix]).padStart(digits, "0"); };
  /** `parse_naming_series` (model/naming.py): dot-separated parts; the first `#…` part is the counter for the text so far;
   *  YY / MM / DD / YYYY / WW / timestamp are dates; `{field}` or a fieldname of the doc is its value; else literal. */
  function parseSeries(parts: string[], doc: FrappeDoc): string {
    let name = "";
    let seriesSet = false;
    const d = now();
    for (const e of parts) {
      if (!e) continue;
      let part = "";
      if (e.startsWith("#")) { if (!seriesSet) { part = nextNumber(name, e.length); seriesSet = true; } }
      else if (e === "YY") part = String(d.getFullYear()).slice(2);
      else if (e === "MM") part = String(d.getMonth() + 1).padStart(2, "0");
      else if (e === "DD") part = String(d.getDate()).padStart(2, "0");
      else if (e === "YYYY") part = String(d.getFullYear());
      else if (e === "WW") { const jan1 = new Date(d.getFullYear(), 0, 1); part = String(Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)).padStart(2, "0"); } // UNVERIFIED week rule
      else if (e === "timestamp") part = stamp();
      else if (e.startsWith("{") || Object.prototype.hasOwnProperty.call(doc, e)) part = String(doc[e.replace(/[{}]/g, "")] ?? "");
      else part = e;
      name += part;
    }
    return name;
  }
  /** Naming as `set_new_name` / `make_autoname` do for the common rules (SIMULATED subset): `__newname` (Prompt),
   *  `field:x`, `naming_series:` (the doc's series), `format:` (each `{…}` parsed on its own — so `{#####}` counts on the
   *  empty prefix, as `_format_autoname` does), a dotted series with `#`, `autoincrement`, else a 10-character hash. */
  function makeName(meta: DocTypeMeta, doc: FrappeDoc): string {
    const auto = String(meta.autoname ?? "").trim();
    const series = (key: string) => parseSeries((key.includes("#") ? key : `${key}.#####`).split("."), doc);
    if (typeof doc.amended_from === "string" && doc.amended_from) {
      // _set_amended_name with the "Amend Counter" rule (UNVERIFIED: the site's Document Naming Settings may say
      // "Default Naming"): X → X-1; an amendment of X-1 (itself amended) → X-2
      const src = String(doc.amended_from);
      const srcDoc = table(meta.name).get(src);
      return srcDoc?.amended_from ? `${src.split("-").slice(0, -1).join("-")}-${(parseInt(src.split("-").pop() ?? "0", 10) || 0) + 1}` : `${src}-1`;
    }
    if (typeof doc.__newname === "string" && doc.__newname.trim()) return doc.__newname.trim();
    if (auto.toLowerCase() === "prompt") return fail(417, "ValidationError", "Please set the document name"); // UNVERIFIED wording
    if (auto.startsWith("field:")) { const v = doc[auto.slice(6).trim()]; if (v) return String(v).trim(); return fail(417, "ValidationError", `${auto.slice(6)} is required`); }
    if (auto.startsWith("naming_series:")) {
      const ns = String(doc.naming_series ?? "");
      if (!ns) return fail(417, "ValidationError", "Naming Series mandatory");
      return series(ns);
    }
    if (auto.startsWith("format:")) return auto.slice(auto.indexOf(":") + 1).replace(/\{[\w | #]+\}/g, (m) => parseSeries([m.slice(1, -1)], doc));
    if (auto === "autoincrement") {
      // the table's AUTO_INCREMENT: after the highest numeric name stored (seeded docs included) and after every value
      // already issued (a deleted row's number is not reused)
      const key = `__autoincrement__${meta.name}`;
      let max = counters[key] ?? 0;
      for (const n of table(meta.name).keys()) if (/^\d+$/.test(n)) max = Math.max(max, Number(n));
      counters[key] = max + 1;
      return String(max + 1);
    }
    if (auto.includes("#")) return series(auto);
    let name = hash();
    while (table(meta.name).has(name)) name = hash();
    return name;
  }

  /**
   * Normalise a doc for storage: name, standard fields, child rows (names, parent links, idx, docstatus).
   * Child rows as `savedocs` + `update_child_table` treat them: on a NEW parent every row is inserted (set_local_name
   * clears row names); on an existing parent a row is inserted when it has `__islocal` or no name, updated when its name
   * is stored, and otherwise — a client-invented name without `__islocal` — UPDATEd against nothing, i.e. silently not
   * saved (base_document.py db_update). Such rows are returned in `dropped` (the response still echoes them, as native).
   */
  function prepare(meta: DocTypeMeta, doc: FrappeDoc, isNew: boolean, previous?: FrappeDoc, dropped: FrappeDoc[] = []): FrappeDoc {
    const ts = stamp();
    const out: FrappeDoc = { ...doc, doctype: meta.name };
    for (const k of Object.keys(out)) if (k.startsWith("__")) delete out[k];
    if (isNew) { out.name = makeName(meta, doc); out.owner = user; out.creation = ts; }
    else { out.owner = previous?.owner ?? out.owner; out.creation = previous?.creation ?? out.creation; }
    out.modified = ts;
    out.modified_by = user;
    out.docstatus = (out.docstatus ?? 0) as 0 | 1 | 2;
    out.idx = Number(out.idx ?? 0);
    for (const tf of tableFields(meta)) {
      const childMeta = metaOf(tf.options!);
      const rows = Array.isArray(out[tf.fieldname]) ? (out[tf.fieldname] as FrappeDoc[]) : [];
      const stored = new Set(((previous?.[tf.fieldname] as FrappeDoc[] | undefined) ?? []).map((r) => String(r.name)));
      out[tf.fieldname] = rows.map((r, i) => {
        const row: FrappeDoc = { ...r };
        for (const k of Object.keys(row)) if (k.startsWith("__")) delete row[k];
        if (isNew || r.__islocal || !r.name) row.name = hash();
        else if (previous && !stored.has(String(r.name))) dropped.push(row);
        Object.assign(row, { doctype: childMeta?.name ?? tf.options, parent: out.name, parentfield: tf.fieldname, parenttype: meta.name, idx: i + 1, docstatus: out.docstatus, modified: ts, modified_by: user });
        row.owner ??= user;
        row.creation ??= ts;
        return row;
      });
    }
    return out;
  }

  function missingMandatory(meta: DocTypeMeta, doc: FrappeDoc): string[] {
    const empty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.replace(/<[^>]*>/g, "").trim()) || (Array.isArray(v) && !v.length);
    const out: string[] = [];
    for (const f of meta.fields) if (f.reqd && !LAYOUT.has(f.fieldtype) && empty(doc[f.fieldname])) out.push(`Error: Value missing for ${meta.name}: ${f.label || f.fieldname}`);
    for (const tf of tableFields(meta)) {
      const cm = metaOf(tf.options!);
      for (const row of (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []) {
        for (const f of cm?.fields ?? []) if (f.reqd && !LAYOUT.has(f.fieldtype) && empty(row[f.fieldname])) out.push(`Error: ${cm!.name} Row #${row.idx}: Value missing for: ${f.label || f.fieldname}`);
      }
    }
    return out;
  }

  function get(doctype: string, name: unknown): FrappeDoc {
    requireMeta(doctype);
    return table(doctype).get(String(name)) ?? notFound(`${doctype} ${String(name)}`);
  }

  /** `_get_communications` (load.py:264-276, get_communication_data :279-345): the stored Communications of type
   *  Communication / Feedback / Automated Message referencing the document (Communication Links are not simulated),
   *  newest `communication_date` first, Desk's columns, `attachments` = the Files attached to each (JSON). P35. */
  function communicationsOf(doctype: string, name: string, start = 0, limit = 20): Row[] {
    const files = [...(store.docs.get("File")?.values() ?? [])];
    return [...(store.docs.get("Communication")?.values() ?? [])]
      .filter((c) => c.reference_doctype === doctype && c.reference_name === name && ["Communication", "Feedback", "Automated Message"].includes(String(c.communication_type ?? "Communication")))
      .sort((x, y) => cmp(y.communication_date ?? y.creation, x.communication_date ?? x.creation))
      .slice(start, start + limit)
      .map((c) => {
        const row: Row = Object.fromEntries(["name", "communication_type", "communication_medium", "comment_type", "communication_date", "content", "sender", "sender_full_name", "cc", "bcc", "creation", "subject", "delivery_status", "_liked_by", "reference_doctype", "reference_name", "read_by_recipient", "rating", "recipients"].map((k) => [k, (c as Row)[k] ?? null]));
        if (["Communication", "Automated Message"].includes(String(row.communication_type))) {
          row.attachments = JSON.stringify(files.filter((f) => f.attached_to_doctype === "Communication" && f.attached_to_name === c.name).map((f) => ({ file_url: f.file_url, is_private: f.is_private })));
        }
        return row;
      });
  }

  function docinfo(doctype: string, name: string) {
    const meta = requireMeta(doctype);
    const all = communicationsOf(doctype, name, 0, 21);
    const communications = all.filter((c) => c.communication_type !== "Automated Message");
    const automated_messages = all.filter((c) => c.communication_type === "Automated Message");
    const comments = [...store.comments.values()].filter((c) => c.reference_doctype === doctype && c.reference_name === name);
    const byType = (...types: string[]) => comments.filter((c) => types.includes(String(c.comment_type))).map(clone);
    const assignments = [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && t.status === "Open")
      .map((t) => ({ name: t.name, owner: t.allocated_to, description: t.description, status: t.status }));
    const users = new Set<string>([user, ...comments.map((c) => String(c.owner)), ...assignments.map((a) => String(a.owner)), ...communications.map((c) => String(c.sender ?? ""))]);
    const doc = table(doctype).get(name);
    if (doc?.owner) users.add(String(doc.owner));
    if (doc?.modified_by) users.add(String(doc.modified_by));
    // P on: `shared` = the doc's DocShare rows (share.py:132-152), `permissions` = get_doc_permissions (load.py:129-130)
    const shared = doc && P ? P.docShares(doc) : [];
    for (const s of shared) if (s.user) users.add(String(s.user)); // load.py:492
    return {
      doctype, name, attachments: [], communications, automated_messages, views: [], shared, milestones: [],
      versions: meta.track_changes ? [...table("Version").values()].filter((v) => v.ref_doctype === doctype && v.docname === name).slice(-10).reverse().map((v) => ({ name: v.name, owner: v.owner, creation: v.creation, data: v.data })) : [],
      energy_point_logs: [], additional_timeline_content: [], tags: "", document_email: null, is_document_followed: 0,
      comments: byType("Comment").map((c) => ({ name: c.name, content: c.content, owner: c.owner, creation: c.creation, comment_type: "Comment", comment_email: c.comment_email, comment_by: c.comment_by, published: c.published ?? 0 })),
      assignment_logs: byType("Assigned", "Assignment Completed"), attachment_logs: byType("Attachment", "Attachment Removed"),
      info_logs: byType("Info", "Edit", "Label"), like_logs: byType("Like"), workflow_logs: byType("Workflow"),
      assignments, permissions: doc && P ? P.docPermissions(doc) : permissions(meta),
      user_info: Object.fromEntries([...users].filter(Boolean).map((u) => [u, userInfoFn(u)])),
    };
  }

  function addComment(doctype: string, name: string, type: string, content: string, extra: Row = {}): Row {
    const c: Row = { doctype: "Comment", name: hash(), comment_type: type, reference_doctype: doctype, reference_name: name, content, owner: user, creation: stamp(), comment_email: user, ...extra };
    store.comments.set(String(c.name), c);
    if (type === "Comment") {
      const doc = table(doctype).get(name);
      if (doc) {
        const list = (parse(doc._comments) as Row[] | null) ?? [];
        list.push({ comment: content, by: user, name: c.name });
        doc._comments = JSON.stringify(list.slice(-100));
      }
    }
    return c;
  }

  /** `_assign` of the referenced doc = the users of its Open ToDos (ToDo.update_in_reference). */
  function syncAssign(doctype: string, name: string) {
    if (!doctype || !name) return;
    const doc = store.docs.get(doctype)?.get(name);
    if (!doc) return;
    const users = [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && t.status === "Open").map((t) => String(t.allocated_to));
    doc._assign = JSON.stringify(users);
  }
  const openAssignments = (doctype: string, name: string) =>
    [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && !["Cancelled", "Closed"].includes(String(t.status))).slice(0, 5).map((t) => ({ owner: t.allocated_to, name: t.name }));
  /**
   * The comment ToDo.validate / on_update write on the referenced doc (desk/doctype/todo/todo.py:39-69), with full names
   * (get_fullname): new → "Assigned": "{by} assigned {to}: {description}" or "{by} self assigned this task: {description}";
   * status changed → "Assignment Completed": "{me} removed their assignment." (assignee = session user) or
   * "Assignment of {to} removed by {me}".
   */
  function todoComment(todo: Row, previousStatus?: string) {
    const dt = String(todo.reference_type ?? ""), dn = String(todo.reference_name ?? "");
    if (!dt || !dn) return;
    const full = (u: unknown) => userInfoFn(String(u ?? "")).fullname;
    if (previousStatus === undefined) {
      const text = todo.assigned_by === todo.allocated_to
        ? `${full(todo.assigned_by)} self assigned this task: ${String(todo.description ?? "")}`
        : `${full(todo.assigned_by)} assigned ${full(todo.allocated_to)}: ${String(todo.description ?? "")}`;
      addComment(dt, dn, "Assigned", text);
    } else if (previousStatus !== todo.status) {
      const text = todo.allocated_to === user ? `${full(user)} removed their assignment.` : `Assignment of ${full(todo.allocated_to)} removed by ${full(user)}`;
      addComment(dt, dn, "Assignment Completed", text);
    }
  }

  function assign(doctype: string, name: string, users: string[], a: Row, sharedWith: string[] = []) {
    const target = get(doctype, name);
    if (P) P.assertDoc(target, "read"); // assign_to.py:67-68 (check_permission, "read")
    const dup: string[] = [];
    for (const u of users) {
      if ([...store.todos.values()].some((t) => t.reference_type === doctype && t.reference_name === name && t.allocated_to === u && t.status === "Open")) { dup.push(u); continue; }
      const ts = stamp();
      const todo: Row = { doctype: "ToDo", name: hash(), allocated_to: u, reference_type: doctype, reference_name: name, description: a.description || `Assignment for ${doctype} ${name}`, priority: a.priority || "Medium", status: "Open", date: a.date || ymd(now()), assigned_by: user, owner: user, creation: ts, modified: ts, modified_by: user, docstatus: 0, idx: 0 };
      // P on: an assignee without read is given a read share (assign_to.py:101-114 → share.add, which first checks that
      // the ASSIGNER may share, share.py:216-244); sharing disabled → "Missing Permission". Checked before the ToDo is
      // written: Frappe rolls the whole request back on these errors.
      const needsShare = !!P && !P.hasPermission(doctype, "read", target, { user: u });
      if (P && needsShare) {
        if (P.config.disableSharing) fail(417, "ValidationError", `User <strong>${u}</strong> is not permitted to access this document.<br>As document sharing is disabled, please give them the required permissions before assigning.`);
        if (!P.hasPermission(doctype, "share", target)) throw permissionError(undefined, [`No permission to share ${doctype} ${name}`], true);
      }
      store.todos.set(String(todo.name), todo);
      todoComment(todo);
      if (needsShare) { addShare({ share_doctype: doctype, share_name: name, user: u, read: 1 }); sharedWith.push(u); }
    }
    syncAssign(doctype, name);
    return dup;
  }
  /** A DocShare row (share.py add_docshare :36-72: one row per user and document, updated in place). */
  function addShare(s: { share_doctype: string; share_name: string; user?: string; everyone?: 0 | 1; read?: 0 | 1; write?: 0 | 1; submit?: 0 | 1; share?: 0 | 1; owner?: string; creation?: string; name?: string }) {
    const t = table("DocShare");
    const existing = [...t.values()].find((x) => x.share_doctype === s.share_doctype && x.share_name === s.share_name && (s.everyone ? Number(x.everyone) === 1 : x.user === s.user));
    const ts = stamp();
    const row = { doctype: "DocShare", name: existing?.name ?? s.name ?? hash(), owner: s.owner ?? user, creation: s.creation ?? ts, modified: ts, modified_by: user, docstatus: 0, idx: 0, everyone: 0, read: 1, write: 0, submit: 0, share: 0, ...(existing ?? {}), ...s } as unknown as FrappeDoc;
    t.set(row.name, row);
    return row;
  }
  /** `frappe.has_permission(doctype, doc=name, throw=True)` (__init__.py:1028-1073) for a named doc. */
  function assertDocNamed(doctype: string, name: string, ptype: PermType) {
    const doc = get(doctype, name);
    const logs: string[] = [];
    if (!P || P.hasPermission(doctype, ptype, doc, { logs })) return;
    P.assertDoctype(doctype, ptype, { ignoreShare: true });
    throw permissionError(`No permission for ${doctype} ${name}`, [logs.join("<br>")]);
  }

  // ---- rows (get_list / reportview) -------------------------------------------------------------------------------
  /** Rows of a list query. P on: only the rows the session may read (`P.listFilter`, db_query.py:135, 993-1057; 403
   *  without read). `reference_doctype` scopes User Permissions' `applicable_for` like Desk's link searches. */
  function rowsFor(doctype: string, a: Record<string, unknown>, ignorePermissions = false): Row[] {
    const meta = requireMeta(doctype);
    const allowed = P ? P.listFilter(doctype, { referenceDoctype: a.reference_doctype ? String(a.reference_doctype) : undefined, ignorePermissions }) : undefined;
    const known = new Set([...meta.fields.filter((f) => !LAYOUT.has(f.fieldtype)).map((f) => f.fieldname), ...STANDARD]);
    const t = now();
    const test = (doc: FrappeDoc, f: Filter) => {
      const [dt, field, op, value] = f.length === 4 ? f : [doctype, ...f] as [string, string, string, unknown];
      const [qdt, fname] = splitField(String(field));
      const target = qdt ?? dt;
      if (target === doctype) {
        if (!known.has(fname)) fail(417, "DataError", `Field not permitted in query: ${fname}`);
        return matches(doc[fname], String(op), value, t);
      }
      const rows = tableFields(meta).filter((tf) => tf.options === target).flatMap((tf) => (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []);
      return rows.some((r) => matches(r[fname], String(op), value, t));
    };
    const filters = toFilters(a.filters, doctype);
    const orFilters = toFilters(a.or_filters, doctype);
    let rows = [...table(doctype).values()].filter((d) => filters.every((f) => test(d, f)) && (!orFilters.length || orFilters.some((f) => test(d, f))) && (!allowed || allowed(d)));
    const order = String(a.order_by ?? `${meta.sort_field || "modified"} ${meta.sort_order || "desc"}`);
    // "f desc", "`tabCRM Lead`.`modified` desc, `tabCRM Lead`.`name` desc" (DocType names may contain spaces)
    const parts = order.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const m = /^(.*?)(?:\s+(asc|desc))?$/i.exec(p)!;
      return { f: splitField(m[1])[1], desc: (m[2] ?? "asc").toLowerCase() === "desc" };
    });
    rows = rows.sort((x, y) => { for (const { f, desc } of parts) { const c = cmp(x[f], y[f]); if (c) return desc ? -c : c; } return 0; });
    return rows;
  }
  function project(doctype: string, rows: Row[], fieldsRaw: unknown): { keys: string[]; rows: Row[] } {
    const meta = requireMeta(doctype);
    const known = new Set([...meta.fields.filter((f) => !LAYOUT.has(f.fieldtype)).map((f) => f.fieldname), ...STANDARD]);
    const fields = (parse(fieldsRaw) as string[] | undefined) ?? ["name"];
    const list = fields.length ? fields : ["name"];
    // P on: `apply_fieldlevel_read_permissions` (db_query.py:668-760) — columns of permlevels the roles cannot read are
    // dropped from the select (so they are absent from the keys), `*` expands to the permitted ones only
    const permitted = P ? P.permittedFields(doctype) : null;
    const childPermitted = (dt: string) => (P ? P.permittedFields(dt, doctype) : null);
    const cols = list.flatMap((spec): { key: string; dt?: string; f: string }[] => {
      const s = String(spec).trim();
      if (s === "*" || unquote(s) === `tab${doctype}.*`) return [...known].filter((k) => !k.startsWith("parent") && (!permitted || permitted.has(k))).map((k) => ({ key: k, f: k }));
      const alias = /\s+as\s+(.+)$/i.exec(s);
      const [dt, f] = splitField(alias ? s.slice(0, alias.index) : s);
      if ((dt ?? doctype) === doctype && !known.has(f)) fail(417, "DataError", `Field not permitted in query: ${f}`);
      if ((dt ?? doctype) === doctype && permitted && !permitted.has(f)) return [];
      if (dt && dt !== doctype) { const cp = childPermitted(dt); if (cp && !cp.has(f)) return []; }
      return [{ key: alias ? unquote(alias[1]) : f, dt, f }];
    });
    const out = rows.map((r) => {
      const o: Row = {};
      for (const c of cols) {
        if (!c.dt || c.dt === doctype) o[c.key] = r[c.f] ?? null;
        else {
          const child = tableFields(meta).filter((tf) => tf.options === c.dt).flatMap((tf) => (r[tf.fieldname] as Row[] | undefined) ?? [])[0];
          o[c.key] = child?.[c.f] ?? null;
        }
      }
      return o;
    });
    return { keys: cols.map((c) => c.key), rows: out };
  }
  const page = <T,>(rows: T[], start: unknown, length: unknown) => {
    const s = Number(start) || 0, n = Number(length);
    return n > 0 ? rows.slice(s, s + n) : rows.slice(s);
  };

  // ---- save path ----------------------------------------------------------------------------------------------------
  /**
   * `relink_files` (core/doctype/file/utils.py:377-406), for every Attach / Attach Image field of the DocType with a
   * value (:414-417): the File with that `file_url`, `attached_to_doctype` = the DocType, `attached_to_name` = the
   * temporary name and `attached_to_field` = the field, created in the last 60 minutes, gets `attached_to_name` = the
   * new name (`frappe.db.set_value`, no hooks).
   */
  function relinkMismatchedFiles(doc: FrappeDoc, tempName: string): void {
    const files = store.docs.get("File");
    if (!files) return;
    const nowMs = now().getTime();
    const created = (v: unknown) => { const t = new Date(String(v ?? "").replace(" ", "T").slice(0, 23)).getTime(); return Number.isNaN(t) ? NaN : t; };
    for (const df of requireMeta(doc.doctype).fields ?? []) {
      if (df.fieldtype !== "Attach" && df.fieldtype !== "Attach Image") continue;
      const url = doc[df.fieldname];
      if (!url) continue;
      const hit = [...files.values()].find((f) => f.file_url === url && f.attached_to_doctype === doc.doctype && f.attached_to_name === tempName
        && f.attached_to_field === df.fieldname && created(f.creation) >= nowMs - 60 * 60 * 1000 && created(f.creation) <= nowMs + 1000);
      if (hit) hit.attached_to_name = doc.name;
    }
  }

  function save(raw: FrappeDoc, action: string): FrappeDoc {
    const meta = requireMeta(raw.doctype);
    const isNew = !!raw.__islocal || !raw.name;
    // Document.save: not new → load_doc_before_save raises DoesNotExistError for a name that is not stored
    const previous = isNew ? undefined : table(meta.name).get(String(raw.name)) ?? notFound(`${meta.name} ${String(raw.name)}`);
    const target = action === "Save" ? 0 : action === "Cancel" ? 2 : 1;
    // P on: the POSTED doc is checked (frappe.get_doc(json), save.py:18) — `create` in insert (document.py:300; a new doc
    // has no name yet, set_local_name save.py:75-84), `write` in _save (:404), both before the timestamp check
    const posted = { ...raw, doctype: meta.name, name: isNew ? "" : raw.name, owner: isNew ? user : raw.owner ?? previous?.owner } as FrappeDoc;
    if (P) P.assertDoc(posted, isNew ? "create" : "write");
    if (previous) {
      // check_if_latest compares always: a doc posted without `modified` is a mismatch too
      if (String(previous.modified ?? "") !== String(raw.modified ?? "")) {
        fail(417, "TimestampMismatchError", `Error: Document has been modified after you have opened it (${String(previous.modified)}, ${String(raw.modified ?? "")}). Please refresh to get the latest document.`);
      }
      const from = Number(previous.docstatus ?? 0);
      if (from === 2) fail(417, "ValidationError", "Cannot edit cancelled document");
      if (from === 1 && target === 0) fail(417, "DocstatusTransitionError", "Cannot change docstatus from 1 (Submitted) to 0 (Draft)");
      if (from === 0 && target === 2) fail(417, "DocstatusTransitionError", "Cannot change docstatus from 0 (Draft) to 2 (Cancelled)");
    }
    if (target === 1 && !meta.is_submittable) fail(417, "ValidationError", `${meta.name} is not submittable`);
    // P on: check_docstatus_transition (document.py:880-915) — 0→1 and 1→1 (update after submit) need submit, 1→2 cancel
    if (P) {
      const from = previous ? Number(previous.docstatus ?? 0) : 0;
      const need: PermType | null = target === 1 ? "submit" : target === 2 && from === 1 ? "cancel" : null;
      if (need) P.assertDoc(posted, need);
    }
    if (isNew && raw.amended_from && Number(table(meta.name).get(String(raw.amended_from))?.docstatus) !== 2) {
      // Document.validate_amended_from
      fail(417, "ValidationError", `${meta.name} ${String(raw.amended_from)} cannot be amended because it is not cancelled. Please cancel the document before creating an amendment.`, {});
    }
    const before = { ...counters }; // a failed insert rolls back, so a naming series number is not consumed
    const rollback = () => { for (const k of Object.keys(counters)) if (!(k in before)) delete counters[k]; else counters[k] = before[k]; };
    const dropped: FrappeDoc[] = [];
    let doc: FrappeDoc;
    try {
      doc = prepare(meta, { ...raw, docstatus: target as 0 | 1 | 2 }, isNew, previous, dropped);
      if (P) P.resetUnwritable(meta, doc, previous); // validate_higher_perm_levels (document.py:306, 412)
      if (meta.name === "Data Import" && target !== 2) validateDataImport(doc, previous);
      if (options.strict && target !== 2) validateLinks(meta, doc);
      if (target !== 2) {
        const missing = missingMandatory(meta, doc);
        if (missing.length) throw toFrappeError(417, { exc_type: "MandatoryError", _server_messages: sm(...missing.map((message) => ({ message }))) });
      }
      if (options.strict && target !== 2) validateSelects(meta, doc);
      if (isNew && table(meta.name).has(doc.name)) fail(409, "DuplicateEntryError", `${meta.name} ${doc.name} already exists`);
    } catch (e) { rollback(); throw e; }
    for (const k of ["_assign", "_comments", "_liked_by", "_user_tags"]) if (previous && previous[k] !== undefined && doc[k] === undefined) doc[k] = previous[k];
    const stored: FrappeDoc = dropped.length ? { ...doc } : doc;
    if (dropped.length) for (const tf of tableFields(meta)) stored[tf.fieldname] = ((doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []).filter((r) => !dropped.includes(r)).map((r, i) => ({ ...r, idx: i + 1 }));
    if (previous && meta.track_changes) recordVersion(meta, previous, stored);
    table(meta.name).set(stored.name, stored);
    if (meta.name === "ToDo") { todoComment(stored, previous ? String(previous.status ?? "") : undefined); syncAssign(String(previous?.reference_type ?? ""), String(previous?.reference_name ?? "")); syncAssign(String(stored.reference_type ?? ""), String(stored.reference_name ?? "")); }
    return doc; // the response echoes the posted rows, dropped ones included (send_updated_docs returns the in-memory doc)
  }

  const STRICT_SKIP = new Set(["DocType", "Workflow State"]);
  /** strict: `_validate_links` — Link / Dynamic Link values must exist (case-insensitive; the stored value is canonicalised). */
  function validateLinks(meta: DocTypeMeta, doc: FrappeDoc) {
    const bad: string[] = [];
    const check = (m: DocTypeMeta, d: FrappeDoc, prefix: string) => {
      for (const f of m.fields) {
        if (f.fieldtype !== "Link" && f.fieldtype !== "Dynamic Link") continue;
        const v = d[f.fieldname];
        if (v === null || v === undefined || v === "") continue;
        const target = f.fieldtype === "Link" ? String(f.options ?? "") : String(d[String(f.options ?? "")] ?? "");
        if (!target || STRICT_SKIP.has(target) || !metaOf(target)) continue; // unknown to the simulator: skipped
        const hit = [...table(target).keys()].find((n) => n.toLowerCase() === String(v).toLowerCase());
        if (hit) d[f.fieldname] = hit;
        else bad.push(`${prefix}${f.label || f.fieldname}: ${String(v)}`);
      }
    };
    check(meta, doc, "");
    for (const tf of tableFields(meta)) { const cm = metaOf(tf.options!); if (cm) for (const r of (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []) check(cm, r, `Row #${r.idx}: `); }
    if (bad.length) fail(417, "LinkValidationError", `Could not find ${bad.join(", ")}`);
  }
  /** strict: `_validate_selects` — a non-empty Select value must be one of its options (naming_series exempt). */
  function validateSelects(meta: DocTypeMeta, doc: FrappeDoc) {
    const check = (m: DocTypeMeta, d: FrappeDoc, prefix: string) => {
      for (const f of m.fields) {
        if (f.fieldtype !== "Select" || f.fieldname === "naming_series") continue;
        const v = d[f.fieldname];
        if (v === null || v === undefined || v === "") continue;
        const opts = String(f.options ?? "").split("\n").map((o) => o.trim());
        if (!opts.includes(String(v))) fail(417, "ValidationError", `${prefix}${f.label || f.fieldname} cannot be "${String(v)}". It should be one of "${opts.filter(Boolean).join('", "')}"`);
      }
    };
    check(meta, doc, "");
    for (const tf of tableFields(meta)) { const cm = metaOf(tf.options!); if (cm) for (const r of (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []) check(cm, r, `Row #${r.idx}: `); }
  }

  /**
   * A `Version` document like `save_version` / `get_diff` (core/doctype/version/version.py) for `track_changes`
   * DocTypes: data = JSON {changed: [[field, old, new]], added: [[table, row]], removed: [[table, row]],
   * row_changed: [[table, rowIndex (0-based), rowName, [[field, old, new]]]], data_import, updater_reference}; name and
   * docstatus changes are listed in `changed` (raw). Changed values are formatted like the server's get_formatted
   * (`versionValue`, an approximation); no Version on insert (Frappe writes one only for data imports).
   */
  function recordVersion(meta: DocTypeMeta, before: FrappeDoc, after: FrappeDoc) {
    const valueFields = (m: DocTypeMeta | undefined) => (m?.fields ?? []).filter((f) => !LAYOUT.has(f.fieldtype) && !TABLES.has(f.fieldtype) && !f.is_virtual);
    const norm = (f: FrappeDocField, v: unknown) => (f.fieldtype === "Link" || f.fieldtype === "Dynamic Link" ? (v == null ? "" : String(v)) : v ?? null);
    // version.py get_diff:179-186 — a changed value is stored through get_formatted() when truthy, except the
    // blacklisted fieldtypes (:120), and the pair is kept only if the formatted values still differ
    const diff = (m: DocTypeMeta | undefined, o: FrappeDoc, n: FrappeDoc) =>
      valueFields(m).filter((f) => JSON.stringify(norm(f, o[f.fieldname])) !== JSON.stringify(norm(f, n[f.fieldname])))
        .map((f) => [f.fieldname, versionValue(f, o[f.fieldname], o), versionValue(f, n[f.fieldname], n)])
        .filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b));
    const changed: unknown[] = diff(meta, before, after);
    const added: unknown[] = [], removed: unknown[] = [], rowChanged: unknown[] = [];
    for (const tf of tableFields(meta)) {
      const old = ((before[tf.fieldname] as FrappeDoc[] | undefined) ?? []);
      const rows = ((after[tf.fieldname] as FrappeDoc[] | undefined) ?? []);
      const cm = metaOf(tf.options!);
      rows.forEach((r, i) => {
        const o = old.find((x) => x.name === r.name);
        if (!o) { added.push([tf.fieldname, clone(r)]); return; }
        const d = diff(cm, o, r);
        if (d.length) rowChanged.push([tf.fieldname, i, r.name, d]);
      });
      for (const o of old) if (!rows.some((r) => r.name === o.name)) removed.push([tf.fieldname, clone(o)]);
    }
    for (const k of ["name", "docstatus"] as const) if (before[k] !== after[k]) changed.push([k, before[k] ?? null, after[k] ?? null]);
    if (!changed.length && !added.length && !removed.length && !rowChanged.length) return;
    const v: FrappeDoc = {
      doctype: "Version", name: hash(), ref_doctype: meta.name, docname: after.name, owner: user, creation: String(after.modified), modified: String(after.modified), modified_by: user, docstatus: 0,
      data: JSON.stringify({ changed, added, removed, row_changed: rowChanged, data_import: null, updater_reference: null }),
    };
    table("Version").set(v.name, v);
  }

  const fmt: FormatContext = options.formatContext ?? {};
  /** version.py:120 — values of these fieldtypes stay raw in a Version. */
  const VERSION_RAW = new Set(["Markdown Editor", "Text Editor", "Code", "HTML Editor"]);
  /**
   * A value as Version stores it: `doc.get_formatted(field)` when truthy (version.py:181-183), i.e. the SERVER's
   * format_value (frappe/utils/formatters.py), which differs from Desk's client formatters: Date / Datetime (no zone
   * conversion) / Time in the system formats; Currency and Float via fmt_money (utils/data.py:1223, incl. its narrowing
   * of precisions above 2); Percent as Python's `f"{flt(v, 2)}%"`; Duration as format_duration; Text / Small Text with
   * newlines as <br>; Select translated; every other type (Data, Int, Check, Link …) unchanged. Falsy values stay raw.
   */
  function versionValue(df: FrappeDocField, v: unknown, doc: FrappeDoc): unknown {
    if (v === null || v === undefined || v === "" || v === 0 || v === false || VERSION_RAW.has(df.fieldtype)) return v ?? null;
    const server = { ...fmt, timeZone: undefined };
    switch (df.fieldtype) {
      case "Date": return formatDate(v, server) || v;
      case "Datetime": return formatDatetime(v, server) || v;
      case "Time": return formatTime(v, server) || v;
      case "Duration": { const n = Math.trunc(Number(v)) || 0; const d = formatDuration(Math.abs(n), { hide_days: df.hide_days }, server); return n < 0 && d !== "0s" ? `-${d}` : d === "0s" ? "" : d; }
      case "Percent": { const r = Math.round(Number(v) * 100) / 100; return `${Number.isInteger(r) ? r.toFixed(1) : String(r)}%`; }
      case "Currency": return fmtMoney(Number(v), cintOrNull(df.precision) ?? (cintOrNull(fmt.currencyPrecision) || null), fieldCurrency(df, doc, fmt));
      case "Float": {
        let p = cintOrNull(df.precision) ?? (cintOrNull(fmt.floatPrecision) || 3);
        if (!df.options) { const frac = String(v).split(".")[1]; if (frac === undefined || !Number(frac)) p = 0; }
        return fmtMoney(Number(v), p, df.options ? fieldCurrency(df, doc, fmt) : undefined);
      }
      case "Text": case "Small Text": return /(<br|<div|<p)/.test(String(v)) ? v : String(v).replace(/\n/g, "<br>");
      case "Select": return fmt.translate ? fmt.translate(String(v)) : v;
      default: return v;
    }
  }
  const cintOrNull = (v: unknown) => { if (v === null || v === undefined || v === "") return null; const n = parseInt(String(v), 10); return Number.isNaN(n) ? null : n; };
  /** fmt_money (utils/data.py:1223-): precision default currency_precision else the number format's; above 2 it narrows
   *  to the currency's fraction digits (or the format's) when the value has fewer than 3 decimals; symbol per currency. */
  function fmtMoney(amount: number, precision: number | null, currency: string | undefined): string {
    const format = fmt.numberFormat || "#,###.##";
    const nfPrecision = numberFormatPrecision(format);
    let p = precision ?? (cintOrNull(fmt.currencyPrecision) || null) ?? nfPrecision;
    if (nfPrecision > 0 && p > 2) {
      const frac = Math.round((((amount % 1) + 1) % 1) * 10 ** p) / 10 ** p;
      const decimals = String(frac).split(".")[1] ?? String(frac);
      if (decimals.length < 3) p = currency ? String(fmt.currencies?.[currency]?.fraction_units || 100).length - 1 : nfPrecision;
      else if (decimals.length < p) p = decimals.length;
    }
    const n = formatNumber(amount, format, p, fmt.roundingMethod);
    if (!currency || fmt.hideCurrencySymbol) return n;
    const info = fmt.currencies?.[currency];
    const symbol = info?.symbol || currency;
    return info?.symbol_on_right ? `${n} ${symbol}` : `${symbol} ${n}`;
  }

  const userInfoFn = (u: string) => {
    const ud = store.docs.get("User")?.get(u);
    const composed = [ud?.first_name, ud?.middle_name, ud?.last_name].filter((x) => typeof x === "string" && x.trim()).join(" ");
    return { fullname: String(ud?.full_name || composed || u), image: (ud?.user_image as string | undefined) ?? null, name: u };
  };

  /**
   * `get_submitted_linked_docs` (desk/form/linked_with.py SubmittableDocumentTree), SIMULATED: submitted documents of
   * submittable DocTypes whose Link fields (parent or child rows) point at the document, followed recursively through
   * submitted documents only. Dynamic Links and the auto_cancel_exempted_doctypes hook are not considered.
   */
  function submittedLinkedDocs(doctype: string, name: string, ignore: string[]): { doctype: string; name: string; docstatus: 1 }[] {
    const out: { doctype: string; name: string; docstatus: 1 }[] = [];
    const seen = new Set([`${doctype}\u0000${name}`]);
    const queue: [string, string][] = [[doctype, name]];
    const metas = Object.values(store.meta).flat().filter((m) => m.is_submittable && !ignore.includes(m.name));
    while (queue.length) {
      const [dt, nm] = queue.shift()!;
      for (const m of metas) {
        const own = m.fields.filter((f) => f.fieldtype === "Link" && f.options === dt).map((f) => f.fieldname);
        const rows = tableFields(m).map((tf) => [tf.fieldname, (metaOf(tf.options!)?.fields ?? []).filter((f) => f.fieldtype === "Link" && f.options === dt).map((f) => f.fieldname)] as const).filter(([, fs]) => fs.length);
        if (!own.length && !rows.length) continue;
        for (const d of store.docs.get(m.name)?.values() ?? []) {
          if (Number(d.docstatus) !== 1) continue;
          const links = own.some((f) => d[f] === nm) || rows.some(([tf, fs]) => ((d[tf] as FrappeDoc[] | undefined) ?? []).some((r) => fs.some((f) => r[f] === nm)));
          const key = `${m.name}\u0000${d.name}`;
          if (links && !seen.has(key)) { seen.add(key); out.push({ doctype: m.name, name: d.name, docstatus: 1 }); queue.push([m.name, d.name]); }
        }
      }
    }
    return out;
  }

  function workflowOf(doctype: string): WorkflowInfo | undefined {
    return store.workflows[doctype] ?? Object.values(store.workflows).find((w) => w.document_type === doctype);
  }
  function transitionsFor(doc: FrappeDoc): WorkflowInfo["transitions"] {
    const wf = workflowOf(doc.doctype);
    if (!wf) fail(417, "ValidationError", `No active workflow for ${doc.doctype}`);
    const state = doc[wf.workflow_state_field];
    if (!state) fail(417, "WorkflowStateError", "Workflow State not set");
    // SIMULATED: `condition` is not evaluated; roles filter only when `options.roles` is given — or, P on, by the
    // evaluated roles (workflow.py:63-68; Administrator holds every role)
    const roles = P ? P.rolesOf() : options.roles;
    return wf.transitions.filter((t) => t.state === state && (!roles || roles.includes(t.allowed)));
  }

  // send_updated_docs (save.py:62-70): apply_fieldlevel_read_permissions, then as_dict() — stripped keys come back null
  const docResponse = (doc: FrappeDoc, message: string, extra: Row = {}): FrappeResponse => ({
    docs: [clone(visible(doc, "null"))], docinfo: docinfo(doc.doctype, doc.name), _server_messages: sm({ message, indicator: message === "Cancelled" ? "red" : "green", alert: 1 }), ...extra,
  });

  // ---- Data Import (core/doctype/data_import), SIMULATED -------------------------------------------------------------
  /** Uploaded files by file_url (in memory; the Data Import preview / job read them). */
  const uploads = new Map<string, { content: string; filename: string; csv: boolean }>();
  /** Data Import Log rows by Data Import name. */
  const importLogs = new Map<string, Row[]>();
  /** The uploaded template parsed with the doc's `template_options.column_to_field_map` (ImportFile, importer.py:404-478). */
  function templateOf(doc: FrappeDoc): ParsedTemplate {
    const up = uploads.get(String(doc.import_file ?? ""));
    if (!up) return fail(417, "ValidationError", "Invalid template file for import");
    if (!up.csv) return fail(417, "ValidationError", "SIMULATED: the in-browser simulator reads CSV files only (a site also reads .xlsx / .xls).");
    const opts = parse(doc.template_options) as { column_to_field_map?: Record<string, string> } | null;
    try { return parseTemplate(String(doc.reference_doctype), parseCsv(up.content), opts?.column_to_field_map ?? {}, metaOf); }
    catch (e) { return fail(417, "ValidationError", (e as Error).message); }
  }
  /** `DataImport.validate` (data_import.py:44-91): template state reset on a new file, blocked / non-importable DocTypes,
   *  the import right on the target (403), the template parsed (its errors are SAVE errors), payload_count. */
  function validateDataImport(doc: FrappeDoc, previous: FrappeDoc | undefined) {
    if (!doc.import_file || (previous && previous.import_file !== doc.import_file)) { doc.template_options = ""; doc.template_warnings = ""; }
    const ref = String(doc.reference_doctype ?? "");
    if (IMPORT_BLOCKED.has(ref)) fail(417, "ValidationError", `Importing ${ref} is not allowed.`);
    const rm = metaOf(ref) ?? notFound(`DocType ${ref}`);
    if (!Number(rm.allow_import)) fail(417, "ValidationError", `Data Import is not allowed for ${ref}. Enable 'Allow Import' in DocType settings.`);
    if (P && !P.hasPermission(ref, "import")) throw permissionError(undefined, [`You do not have import permission for ${ref}`], true);
    doc.status ??= "Pending";
    if (doc.import_file) doc.payload_count = payloadsOf(templateOf(doc), ref).length;
  }
  const msgList = (message: string, title = "Message") => JSON.stringify([JSON.stringify({ message, title, indicator: "red" })]);
  /**
   * The import job (`start_import` → `Importer.import_data`, importer.py:64-240), run at once (no scheduler). Rows already
   * imported successfully by an earlier run are skipped (Retry). "dry-run": the checks only; "insert": the save path.
   */
  function runImport(di: FrappeDoc) {
    const ref = String(di.reference_doctype);
    const rm = requireMeta(ref);
    const tpl = templateOf(di);
    const old = importLogs.get(di.name) ?? [];
    const done = new Set(old.filter((l) => Number(l.success) === 1).map((l) => String(l.row_indexes)));
    const logs: Row[] = old.filter((l) => Number(l.success) === 1);
    const insert = options.dataImport === "insert";
    const update = di.import_type === "Update Existing Records";
    for (const pl of payloadsOf(tpl, ref)) {
      const rowIndexes = JSON.stringify([pl.rowNumber]);
      if (done.has(rowIndexes)) continue;
      try {
        let docname: string | null = null;
        if (update) {
          const cur = table(ref).get(String(pl.values.name ?? "")) ?? notFound(`${ref} ${String(pl.values.name ?? "")}`);
          if (insert) { validateLinks(rm, { ...cur, ...pl.values }); docname = save({ ...cur, ...pl.values }, "Save").name; }
          else if (P) P.assertDoc({ ...cur, ...pl.values } as FrappeDoc, "write");
        } else if (insert) {
          validateLinks(rm, { ...pl.values, doctype: ref } as FrappeDoc); // the import always validates links (document.py:302)
          docname = save({ ...pl.values, doctype: ref, __islocal: 1 } as FrappeDoc, Number(di.submit_after_import) && rm.is_submittable ? "Submit" : "Save").name;
        } else {
          const posted = { ...pl.values, doctype: ref, name: "", owner: user } as FrappeDoc;
          if (P) P.assertDoc(posted, "create");
          const missing = missingMandatory(rm, posted);
          if (missing.length) fail(417, "MandatoryError", missing.join(", "));
          validateLinks(rm, posted);
        }
        logs.push({ success: 1, docname, row_indexes: rowIndexes, exception: null, log_index: logs.length,
          messages: insert ? JSON.stringify([JSON.stringify({ message: `SIMULATED: the in-browser simulator ${update ? "updated" : "inserted"} ${String(docname)} in its own memory (dataImport: "insert").` })]) : JSON.stringify([JSON.stringify({ message: "SIMULATED dry run: this row passed the simulated checks; nothing was written (no document exists)." })]) });
      } catch (e) {
        const err = e as { excType?: string; message?: string; messages?: { message: string }[] };
        const text = err.messages?.map((m) => m.message).join(", ") || err.message || String(e);
        logs.push({ success: 0, docname: null, row_indexes: rowIndexes, messages: msgList(text), exception: `frappe.exceptions.${err.excType ?? "ValidationError"}: ${text}`, log_index: logs.length });
      }
    }
    importLogs.set(di.name, logs);
    const ok = logs.filter((l) => Number(l.success) === 1).length;
    const status = ok === logs.length && logs.length ? "Success" : ok ? "Partial Success" : "Error";
    const stored = table("Data Import").get(di.name)!;
    Object.assign(stored, { status, template_warnings: "", modified: stamp(), modified_by: user }); // db_set bumps modified
    store.published.push({ event: "data_import_refresh", message: JSON.stringify({ data_import: di.name }) });
  }
  /** `has_approval_access` (workflow.py:221-222) with the owner of the dict the client sent. */
  const approvalAccess = (doc: Row, t: { allow_self_approval?: unknown }) => user === "Administrator" || Number(t.allow_self_approval) === 1 || user !== doc.owner;
  /** `validate_print_permission` (www/printview.py:123, 367-378: read OR print) and Print Settings' draft / cancelled
   *  rule (:137-142) — the reasons `get_print` raises, which `_download_multi_pdf` swallows per document. */
  function printRefusal(doctype: string, name: string): string | null {
    const doc = store.docs.get(doctype)?.get(name);
    if (!doc) return "not found";
    if (P && !P.hasPermission(doctype, "read", doc) && !P.hasPermission(doctype, "print", doc)) return "no read / print permission";
    const meta = metaOf(doctype);
    if (meta?.is_submittable) {
      if (Number(doc.docstatus ?? 0) === 0 && !ctx.printSettings().allow_print_for_draft) return "Not allowed to print draft documents";
      if (Number(doc.docstatus ?? 0) === 2 && !ctx.printSettings().allow_print_for_cancelled) return "Not allowed to print cancelled documents";
    }
    return null;
  }
  const simulatedFile = (filename: string, lines: string[]): DownloadedFile => {
    const text = ["SIMULATED — in-browser Frappe simulator (@solvfast/ui/frappe/testing).", ...lines, ""].join("\n");
    return { blob: new Blob([text], { type: "text/plain" }), filename, contentType: "text/plain" };
  };
  const slugName = (s: string) => s.replace(/[^\w-]+/g, "-");

  const ctx: FixtureContext = {
    permissions: P,
    assertDoc: (doc, ptype = "read") => { P?.assertDoc(doc, ptype); },
    assertDoctype: (doctype, ptype = "read") => { P?.assertDoctype(doctype, ptype); },
    rows: (doctype, args, opts = {}) => rowsFor(doctype, args, !!opts.ignorePermissions) as FrappeDoc[],
    printSettings: () => {
      const single = store.docs.get("Print Settings")?.get("Print Settings") as Row | undefined;
      const pick = (k: "allow_print_for_draft" | "allow_print_for_cancelled", dflt: number) => { const v = single?.[k] ?? options.printSettings?.[k] ?? dflt; return v === true || Number(v) === 1; };
      return { allow_print_for_draft: pick("allow_print_for_draft", 1), allow_print_for_cancelled: pick("allow_print_for_cancelled", 0) };
    },
    now,
    stamp,
    user,
    options,
  };

  const handlers: Record<string, FixtureContextHandler> = {
    "frappe.desk.form.load.getdoctype": (a) => {
      const doctype = String(a.doctype);
      const bundle = store.meta[doctype] ?? (metaOf(doctype) ? [metaOf(doctype)!] : notFound(`DocType ${doctype}`));
      const docs = clone(bundle);
      const wf = workflowOf(doctype);
      if (wf && docs[0]) {
        docs[0].__workflow_docs = [
          { doctype: "Workflow", is_active: 1, ...clone(wf) },
          ...[...new Set(wf.states.map((s) => s.state))].map((s) => ({ doctype: "Workflow State", name: s, workflow_state_name: s, style: wf.states.find((x) => x.state === s)?.style ?? "" })),
        ];
      }
      return { docs, user_settings: store.userSettings[doctype] ?? "{}" };
    },
    // getdoctype (load.py:62-79) has no permission check: any logged-in user loads the meta, P on or off
    "frappe.desk.form.load.getdoc": (a) => {
      requireMeta(a.doctype);
      const doctype = String(a.doctype);
      const doc = table(doctype).get(String(a.name));
      if (P) {
        // load.py:33-45: a missing doc answers [] after check_doctype_permission; an unreadable one 403 "Insufficient
        // Permission for …" (check_doctype_permission first: "No permission for X" when the DocType itself is denied)
        if (!doc) { P.assertDoctype(doctype, "read", { ignoreShare: true }); return { docs: [] }; }
        const logs: string[] = [];
        if (!P.hasPermission(doctype, "read", doc, { logs })) {
          P.assertDoctype(doctype, "read", { ignoreShare: true });
          throw permissionError(`Insufficient Permission for <strong>${doctype} ${doc.name}</strong>`, [logs.join("<br>")]);
        }
      }
      return doc ? { docs: [clone(visible(doc))], docinfo: docinfo(doc.doctype, doc.name), _link_titles: {} } : { docs: [] };
    },
    "frappe.desk.form.load.get_docinfo": (a) => {
      const doc = get(String(a.doctype), a.name);
      if (P && !P.hasPermission(doc.doctype, "read", doc)) throw permissionError(undefined); // load.py:103-105: a bare PermissionError
      return { docinfo: docinfo(String(a.doctype), String(a.name)) };
    },
    // load.py:212-219: read on the document, then _get_communications(start, limit)
    "frappe.desk.form.load.get_communications": (a) => {
      const doc = get(String(a.doctype), a.name);
      if (P) P.assertDoc(doc, "read");
      return { message: communicationsOf(doc.doctype, doc.name, Number(a.start) || 0, a.limit === undefined ? 20 : Number(a.limit) || 0) };
    },
    // client.py:93-111: check_permission("read"), then apply_fieldlevel_read_permissions + as_dict()
    "frappe.client.get": (a) => { const doc = get(String(a.doctype), a.name); if (P) P.assertDoc(doc, "read"); return { message: clone(visible(doc, "null")) }; },
    "frappe.client.get_value": (a) => {
      const doctype = String(a.doctype);
      // client.py:125-126: DocType-level read (shares count), then get_list with the row filter and field stripping
      if (P && !P.hasPermission(doctype, "read")) throw permissionError(undefined, [`No permission for ${doctype}`], true);
      const rows = rowsFor(doctype, { filters: a.filters ?? (a.name ? { name: a.name } : undefined) });
      const fields = parse(a.fieldname);
      const permitted = P ? P.permittedFields(doctype) : null;
      const list = (Array.isArray(fields) ? (fields as string[]) : [String(fields ?? "name")]).filter((f) => !permitted || permitted.has(f));
      return { message: rows[0] ? Object.fromEntries(list.map((f) => [f, rows[0][f] ?? null])) : {} };
    },
    "frappe.desk.form.save.savedocs": (a) => {
      const raw = parse(a.doc) as FrappeDoc;
      const localname = raw.__islocal ? raw.name : undefined;
      const doc = save(raw, String(a.action));
      // P36b attachimage: savedocs keeps the `new-<doctype>` name as `__temporary_name` (desk/form/save.py:20-22) and the
      // insert relinks the Attach / Attach Image Files uploaded against it (model/document.py:333 →
      // core/doctype/file/utils.py:411-419 relink_mismatched_files → :377-406 relink_files)
      if (localname && localname.startsWith(`new-${String(raw.doctype).toLowerCase().split(" ").join("-")}`)) relinkMismatchedFiles(doc, localname);
      return docResponse(localname ? { ...doc, localname } as FrappeDoc : doc, String(a.action) === "Save" ? "Saved" : "Submitted");
    },
    "frappe.desk.form.save.cancel": (a) => {
      const cur = get(String(a.doctype), a.name);
      if (Number(cur.docstatus) !== 1) fail(417, "DocstatusTransitionError", `Cannot change docstatus from ${String(cur.docstatus ?? 0)} to 2 (Cancelled)`);
      const next = { ...cur, ...(a.workflow_state_fieldname && a.workflow_state ? { [String(a.workflow_state_fieldname)]: a.workflow_state } : {}) };
      return docResponse(save(next, "Cancel"), "Cancelled");
    },
    "frappe.client.insert": (a) => { const raw = parse(a.doc) as FrappeDoc; return { message: clone(save({ ...raw, __islocal: 1 }, "Save")) }; },
    "frappe.client.save": (a) => ({ message: clone(save(parse(a.doc) as FrappeDoc, "Save")) }),
    "frappe.client.set_value": (a) => {
      const cur = get(String(a.doctype), a.name);
      const f = parse(a.fieldname);
      const patch = f && typeof f === "object" ? (f as Row) : { [String(f)]: a.value };
      return { message: clone(save({ ...cur, ...patch }, Number(cur.docstatus) === 1 ? "Update" : "Save")) };
    },
    "frappe.client.delete": (a) => {
      if (a.doctype === "Comment") {
        const c = store.comments.get(String(a.name)) ?? notFound(`Comment ${String(a.name)}`);
        // P on: the Comment DocType's rows (comment.json: System Manager / Website Manager delete), delete_doc.py:240-250
        if (P && user !== "Administrator" && !P.hasPermission("Comment", "delete", { ...c, doctype: "Comment" } as FrappeDoc)) throw permissionError(undefined, [`User not allowed to delete Comment: ${String(a.name)}`], true);
        store.comments.delete(String(a.name));
        return {};
      }
      get(String(a.doctype), a.name);
      const gone = table(String(a.doctype)).get(String(a.name))!;
      // P on: check_permission_and_not_submitted (delete_doc.py:240-256) — the delete right first, then "submitted"
      const logs: string[] = [];
      if (P && user !== "Administrator" && !P.hasPermission(gone.doctype, "delete", gone, { logs })) throw permissionError(undefined, [logs.join("<br>"), `User not allowed to delete ${gone.doctype}: ${gone.name}`], true);
      if (Number(gone.docstatus) === 1) fail(417, "ValidationError", "Submitted Record cannot be deleted. You must Cancel it first.");
      table(String(a.doctype)).delete(String(a.name));
      if (a.doctype === "ToDo") syncAssign(String(gone.reference_type ?? ""), String(gone.reference_name ?? ""));
      return {};
    },
    "frappe.desk.reportview.delete_items": (a) => {
      const items = (parse(a.items) as string[]) ?? [];
      if (!P) { for (const n of items) handlers["frappe.client.delete"]({ doctype: a.doctype, name: n }, store, ctx); return {}; }
      // P on: delete_bulk (reportview.py:588-616) — each item on its own, failures retried once, then reported by a
      // REALTIME msgprint (kept in store.published); the HTTP answer is empty either way
      const attempt = (names: string[]) => names.filter((n) => { try { handlers["frappe.client.delete"]({ doctype: a.doctype, name: n }, store, ctx); return false; } catch { return true; } });
      let failed = attempt([...items].sort().reverse());
      if (failed.length && failed.length !== items.length) failed = attempt(failed);
      store.published.push(failed.length
        ? { event: "msgprint", title: "Bulk Operation Failed", message: `Failed to delete ${failed.length} documents: ${failed.join(", ")}` }
        : { event: "msgprint", title: "Bulk Operation Successful", message: "Deleted all documents successfully" });
      return {};
    },
    "frappe.rename_doc": (a) => {
      const doctype = String(a.doctype), old = String(a.old), next = String(a.new);
      const cur = get(doctype, old);
      if (old === next) return { message: next };
      if (table(doctype).has(next) && !a.merge) fail(417, "ValidationError", `Another ${doctype} with name ${next} exists, select another name`);
      // P on: rename_doc.py:378-388 — write on the old doc (and on the merge target)
      if (P && !P.hasPermission(doctype, "write", cur)) fail(417, "ValidationError", `You need write permission on ${doctype} ${old} to rename`);
      if (P && a.merge && table(doctype).has(next) && !P.hasPermission(doctype, "write", table(doctype).get(next))) fail(417, "ValidationError", `You need write permission on ${doctype} ${next} to merge`);
      table(doctype).delete(old);
      const renamed: FrappeDoc = { ...cur, name: next, modified: stamp() };
      for (const tf of tableFields(requireMeta(doctype))) renamed[tf.fieldname] = ((renamed[tf.fieldname] as Row[]) ?? []).map((r) => ({ ...r, parent: next }));
      if (!(a.merge && table(doctype).has(next))) table(doctype).set(next, renamed as FrappeDoc);
      for (const c of store.comments.values()) if (c.reference_doctype === doctype && c.reference_name === old) c.reference_name = next;
      for (const t of store.todos.values()) if (t.reference_type === doctype && t.reference_name === old) t.reference_name = next;
      return { message: next };
    },
    "frappe.client.validate_link": (a) => {
      const doctype = String(a.doctype);
      const meta = requireMeta(doctype);
      // P on: client.py:443-454 — select or read on the DocType, else 403
      if (P && doctype !== "DocType") {
        const parentDoctype = meta.istable ? String([...table(doctype).values()].find((d) => d.name === a.docname)?.parenttype ?? "") || undefined : undefined;
        if (!(P.hasPermission(doctype, "select", undefined, { parentDoctype }) || P.hasPermission(doctype, "read", undefined, { parentDoctype }))) {
          throw permissionError(undefined, [`You do not have Read or Select Permissions for <strong>${doctype}</strong>`], true);
        }
      }
      const doc = [...table(doctype).values()].find((d) => String(d.name).toLowerCase() === String(a.docname).toLowerCase());
      if (!doc) return { message: { name: null } };
      const fields = (parse(a.fields) as string[] | undefined) ?? [];
      if (P && fields.length) {
        // client.py:470-483: the values come from get_value (DocType read, the row filter, field stripping); a
        // PermissionError there becomes the "Cannot Fetch Values" message and only the name is answered
        if (!P.hasPermission(doctype, "read")) return { message: { name: doc.name }, _server_messages: sm({ message: `You need <strong>Read</strong> permission to fetch values from <strong>${doctype}</strong> <strong>${doc.name}</strong>`, title: "Cannot Fetch Values", indicator: "orange" }) };
        const row = rowsFor(doctype, { filters: { name: doc.name } })[0];
        const permitted = P.permittedFields(doctype);
        return { message: { name: doc.name, ...(row ? Object.fromEntries(fields.filter((f) => !permitted || permitted.has(f)).map((f) => [f, row[f] ?? null])) : {}) } };
      }
      return { message: { name: doc.name, ...Object.fromEntries(fields.map((f) => [f, doc[f] ?? null])) } };
    },
    run_doc_method: (a) => {
      const doc = parse(a.docs) as FrappeDoc;
      const custom = options.handlers?.[`run_doc_method:${String(a.method)}`];
      if (custom) return custom(a, store, ctx);
      return fail(417, "ValidationError", `run_doc_method "${String(a.method)}" is not simulated (pass options.handlers["run_doc_method:${String(a.method)}"]) for ${doc?.doctype}`);
    },
    "frappe.client.get_list": (a) => {
      const doctype = String(a.doctype);
      const rows = page(rowsFor(doctype, a), a.limit_start, a.limit_page_length ?? 20);
      return { message: project(doctype, rows, a.fields).rows };
    },
    "frappe.client.get_count": (a) => ({ message: rowsFor(String(a.doctype), a).length }),
    "frappe.desk.reportview.get_list": (a) => {
      const doctype = String(a.doctype);
      return { message: project(doctype, page(rowsFor(doctype, a), a.start, a.page_length ?? 20), a.fields).rows };
    },
    "frappe.desk.reportview.get": (a) => {
      const doctype = String(a.doctype);
      const all = page(rowsFor(doctype, a), a.start, a.page_length ?? 20);
      if (!all.length) return { message: [] };
      const { keys, rows } = project(doctype, all, a.fields);
      const withCount = Number(a.with_comment_count) === 1 || a.with_comment_count === true;
      if (withCount && !keys.includes("_comment_count")) { keys.push("_comment_count"); rows.forEach((r, i) => { r._comment_count = ((parse(all[i]._comments) as unknown[] | null) ?? []).length; }); }
      const userInfo: Row = {};
      for (const r of all) for (const u of (parse(r._assign) as string[] | null) ?? []) userInfo[u] = userInfoFn(u);
      return { message: { keys, values: rows.map((r) => keys.map((k) => r[k] ?? null)), user_info: userInfo } };
    },
    "frappe.desk.reportview.get_count": (a) => {
      const n = rowsFor(String(a.doctype), a).length;
      const limit = Number(a.limit) || 0;
      return { message: limit ? Math.min(n, limit) : n };
    },
    // ---- cancel pre-flight and amend (form toolbar, docs 11 §5.4, §1.8) ----
    "frappe.desk.form.linked_with.get_submitted_linked_docs": (a) => {
      if (P) assertDocNamed(String(a.doctype), String(a.name), "read"); // linked_with.py:45
      const docs = submittedLinkedDocs(String(a.doctype), String(a.name), (parse(a.ignore_doctypes_on_cancel_all) as string[] | undefined) ?? []);
      return { message: { docs, count: docs.length } };
    },
    "frappe.desk.form.linked_with.cancel_all_linked_docs": (a) => {
      const ignore = (parse(a.ignore_doctypes_on_cancel_all) as string[] | undefined) ?? [];
      const targets = (parse(a.docs) as { doctype: string; name: string }[] | undefined) ?? [];
      // P on: each doc.cancel() checks write + cancel (document.py:404, 909) and one failure aborts the request — the
      // simulator checks them all first so nothing is half-cancelled
      if (P) for (const d of targets) { const cur = store.docs.get(d.doctype)?.get(d.name); if (cur && Number(cur.docstatus) === 1 && !ignore.includes(d.doctype)) { P.assertDoc(cur, "write"); P.assertDoc(cur, "cancel"); } }
      for (const d of targets) {
        const cur = store.docs.get(d.doctype)?.get(d.name);
        // validate_linked_doc: only submitted documents of DocTypes not exempted
        if (cur && Number(cur.docstatus) === 1 && !ignore.includes(d.doctype)) save({ ...cur }, "Cancel");
      }
      return {};
    },
    "frappe.client.is_document_amended": (a) => {
      requireMeta(a.doctype);
      if (P && !P.hasPermission(String(a.doctype), "read")) return { message: false }; // client.py:425-432
      const hit = [...table(String(a.doctype)).values()].find((d) => d.amended_from === a.docname);
      // frappe.db.exists → the amending doc's name, or None (a None return leaves no `message` key)
      return hit ? { message: hit.name } : {};
    },
    "frappe.desk.listview.get_list_settings": (a) => ({ message: clone(options.listSettings?.[String(a.doctype)] ?? null) }),
    "frappe.model.utils.user_settings.save": (a) => {
      const prev = parse(store.userSettings[String(a.doctype)] ?? "{}") as Row;
      const next = { ...prev, ...((parse(a.user_settings) as Row) ?? {}) };
      store.userSettings[String(a.doctype)] = JSON.stringify(next);
      return { message: next };
    },
    "frappe.desk.search.search_link": (a) => {
      const doctype = String(a.doctype);
      const meta = requireMeta(doctype);
      const txt = String(a.txt ?? "").trim().toLowerCase();
      const searchFields = [meta.title_field, ...String(meta.search_fields ?? "").split(",").map((s) => s.trim())].filter((f): f is string => !!f && f !== "name");
      // P on: search.py:185-204 — get_list with the row filter (User Permissions scoped by reference_doctype) unless
      // ignore_user_permissions is set AND the user may read/select the DocType
      const ignorePermissions = !!P && (doctype === "DocType" || (Number(a.ignore_user_permissions) === 1 && P.hasPermission(doctype, "read", undefined, { parentDoctype: a.reference_doctype ? String(a.reference_doctype) : undefined })));
      let rows = rowsFor(doctype, { filters: a.filters, order_by: "idx desc, modified desc", reference_doctype: a.reference_doctype }, ignorePermissions);
      if (meta.fields.some((f) => f.fieldname === "enabled" && f.fieldtype === "Check")) rows = rows.filter((r) => Number(r.enabled) === 1);
      if (meta.fields.some((f) => f.fieldname === "disabled" && f.fieldtype === "Check")) rows = rows.filter((r) => Number(r.disabled) !== 1);
      if (txt) rows = rows.filter((r) => ["name", ...searchFields].some((f) => String(r[f] ?? "").toLowerCase().includes(txt)));
      rows.sort((x, y) => Number(!String(x.name).toLowerCase().startsWith(txt)) - Number(!String(y.name).toLowerCase().startsWith(txt)));
      const titled = !!meta.show_title_field_in_link && !!meta.title_field;
      return {
        message: rows.slice(0, Number(a.page_length) || 10).map((r) => {
          const desc = searchFields.map((f) => r[f]).filter((v) => v != null && v !== "" && v !== r.name && !(titled && v === r[meta.title_field!])).map(String).join(", ");
          return titled ? { value: r.name, label: r[meta.title_field!], description: [r.name, desc].filter(Boolean).join(", ") } : { value: r.name, description: desc };
        }),
      };
    },
    "frappe.desk.search.get_names_for_mentions": (a) => {
      const term = String(a.search_term ?? "").toLowerCase();
      const users = [...(store.docs.get("User")?.values() ?? [])].filter((u) => u.name !== "Administrator" && u.name !== "Guest");
      return { message: users.filter((u) => `${u.name} ${u.full_name ?? ""}`.toLowerCase().includes(term)).map((u) => ({ id: u.name, value: u.full_name || u.name, link: `/app/user/${u.name}` })) };
    },
    "frappe.model.workflow.get_transitions": (a) => {
      const posted = parse(a.doc) as FrappeDoc;
      const doc = table(posted.doctype).get(posted.name);
      if (doc && P) P.assertDoc(doc, "read"); // workflow.py:52
      return { message: doc ? clone(transitionsFor(doc)) : [] };
    },
    "frappe.model.workflow.apply_workflow": (a) => {
      const posted = parse(a.doc) as FrappeDoc;
      const cur = get(posted.doctype, posted.name); // like Frappe: the posted edits are discarded (load_from_db)
      const wf = workflowOf(cur.doctype)!;
      if (P) P.assertDoc(cur, "read");
      const t = transitionsFor(cur).find((x) => x.action === a.action) ?? fail(417, "WorkflowTransitionError", "Not a valid Workflow Action");
      // P on: has_approval_access (workflow.py:116-117, 221-222)
      if (P && !(user === "Administrator" || Number(t.allow_self_approval) === 1 || user !== cur.owner)) fail(417, "ValidationError", "Self approval is not allowed");
      const next = wf.states.find((s) => s.state === t.next_state) ?? fail(417, "ValidationError", `Unknown state ${t.next_state}`);
      const doc: FrappeDoc = { ...cur, [wf.workflow_state_field]: t.next_state, ...(next.update_field ? { [next.update_field]: next.update_value } : {}) };
      const from = Number(cur.docstatus ?? 0), to = Number(next.doc_status ?? 0);
      const action = from === 0 && to === 0 ? "Save" : from === 0 && to === 1 ? "Submit" : from === 1 && to === 1 ? "Update" : from === 1 && to === 2 ? "Cancel" : fail(417, "ValidationError", `Illegal Document Status for ${next.state}`);
      const saved = save(doc, action);
      addComment(saved.doctype, saved.name, "Workflow", t.next_state);
      return { message: clone(saved) };
    },
    "frappe.model.workflow.can_cancel_document": (a) => {
      const wf = workflowOf(String(a.doctype));
      return { message: !wf || !wf.transitions.some((t) => Number(wf.states.find((s) => s.state === t.next_state)?.doc_status) === 2) };
    },
    "frappe.desk.form.assign_to.add": (a) => {
      const shared: string[] = [];
      const dup = assign(String(a.doctype), String(a.name), (parse(a.assign_to) as string[]) ?? [], a, shared);
      const msgs: Row[] = [];
      if (shared.length) msgs.push({ message: `Shared with the following Users with Read access:<br><br>${shared.join("<br>")}` }); // assign_to.py:129-133
      if (dup.length) msgs.push({ message: `Already in the following Users ToDo list:${dup.join(", ")}` });
      return { message: openAssignments(String(a.doctype), String(a.name)), ...(msgs.length ? { _server_messages: sm(...msgs) } : {}) };
    },
    "frappe.desk.form.assign_to.add_multiple": (a) => {
      const names = (parse(a.name) as string[]) ?? [];
      // P on: add() checks each document (assign_to.py:67-68); one refusal fails the whole request — checked first
      if (P) for (const n of names) P.assertDoc(get(String(a.doctype), n), "read");
      for (const n of names) assign(String(a.doctype), n, (parse(a.assign_to) as string[]) ?? [], a, []);
      return {};
    },
    "frappe.desk.form.assign_to.remove": (a) => {
      if (P) P.assertDoc(get(String(a.doctype), a.name), "read"); // set_status, assign_to.py:206-207
      for (const t of store.todos.values()) if (t.reference_type === a.doctype && t.reference_name === a.name && t.allocated_to === a.assign_to && t.status === "Open") { t.status = "Cancelled"; todoComment(t, "Open"); }
      syncAssign(String(a.doctype), String(a.name));
      return { message: openAssignments(String(a.doctype), String(a.name)) };
    },
    "frappe.desk.form.assign_to.close": (a) => {
      if (P && a.assign_to !== user) fail(417, "ValidationError", "Only the assignee can complete this to-do."); // assign_to.py:197-198
      if (P) P.assertDoc(get(String(a.doctype), a.name), "read");
      for (const t of store.todos.values()) if (t.reference_type === a.doctype && t.reference_name === a.name && t.allocated_to === a.assign_to && t.status === "Open") { t.status = "Closed"; todoComment(t, "Open"); }
      syncAssign(String(a.doctype), String(a.name));
      return { message: openAssignments(String(a.doctype), String(a.name)) };
    },
    // desk/like.py: logged-in users only (Guest → 403, __init__.py:868-876); no document permission check; `_liked_by`
    // updated without touching `modified`; a like adds a "Like" comment ("Liked"), an unlike deletes the user's Like comments
    "frappe.desk.like.toggle_like": (a) => {
      if (!user || user === "Guest") fail(403, "PermissionError", "Not permitted");
      const doc = store.docs.get(String(a.doctype))?.get(String(a.name)) ?? notFound(`${String(a.doctype)} ${String(a.name)}`);
      let liked: string[] = [];
      try { const v = JSON.parse(String(doc._liked_by ?? "[]")); if (Array.isArray(v)) liked = v.map(String); } catch { /* not a list */ }
      if (a.add === "Yes") {
        if (!liked.includes(user)) { liked.push(user); addComment(String(a.doctype), String(a.name), "Like", "Liked"); }
      } else if (liked.includes(user)) {
        liked = liked.filter((u) => u !== user);
        for (const c of [...store.comments.values()]) if (c.comment_type === "Like" && c.reference_doctype === a.doctype && c.reference_name === a.name && c.owner === user) store.comments.delete(String(c.name));
      }
      doc._liked_by = JSON.stringify(liked);
      return {};
    },
    "frappe.desk.form.utils.add_comment": (a) => {
      const ref = get(String(a.reference_doctype), a.reference_name);
      if (P) P.assertDoc(ref, "read"); // desk/form/utils.py:31-32
      const c = addComment(String(a.reference_doctype), String(a.reference_name), "Comment", String(a.content ?? ""), { comment_email: a.comment_email || user, comment_by: a.comment_by || user });
      return { message: clone(c) };
    },
    "frappe.desk.form.utils.update_comment": (a) => {
      const c = store.comments.get(String(a.name)) ?? notFound(`Comment ${String(a.name)}`);
      if (c.owner !== user && user !== "Administrator") fail(403, "PermissionError", "Comment can only be edited by the owner");
      if (P && c.reference_doctype && c.reference_name) P.assertDoc(get(String(c.reference_doctype), c.reference_name), "read"); // utils.py:59-63
      c.content = a.content;
      return {};
    },
    // bulk_update.py:51-114 (P36b): < 20 names run now and answer the failed names; 20–500 are enqueued (SIMULATED as run at
    // once; only an alert, no `message`); > 500 refused. Per name: `frappe.get_doc` OUTSIDE the try (:82 — an unknown name
    // fails the whole request), submit only a draft (:85), cancel only a submitted one (:92), update anything not
    // cancelled (:95); any other docstatus or an exception → failed (:99-112).
    "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs": (a) => {
      const doctype = String(a.doctype);
      const names = ((parse(a.docnames) as unknown[] | undefined) ?? []).map(String);
      const data = (parse(a.data) as Row | undefined) ?? {};
      if (names.length > 500) fail(417, "ValidationError", "Bulk operations only support up to 500 documents.", { title: "Too Many Documents" });
      const run = () => {
        const failed: string[] = [];
        for (const n of names) {
          const cur = get(doctype, n);
          try {
            const ds = Number(cur.docstatus ?? 0);
            if (a.action === "submit" && ds === 0) save({ ...cur }, "Submit");
            else if (a.action === "cancel" && ds === 1) handlers["frappe.desk.form.save.cancel"]({ doctype, name: n }, store, ctx);
            else if (a.action === "update" && ds !== 2) save({ ...cur, ...data }, ds === 1 ? "Update" : "Save");
            else failed.push(n);
          } catch { failed.push(n); }
        }
        return failed;
      };
      if (names.length < 20) return { message: run() };
      try { run(); } catch { /* the background job only logs (frappe.log_error) */ }
      return { _server_messages: JSON.stringify([JSON.stringify({ message: "Bulk operation is enqueued in background.", alert: 1 })]) } as FrappeResponse;
    },
    // ---- Phase 27 list actions (bulk) -------------------------------------------------------------------------------
    // assign_to.py:181-192 → remove → set_status (:195-213): Desk sends ignore_permissions, so NO check then (mirrored)
    "frappe.desk.form.assign_to.remove_multiple": (a) => {
      const ignore = a.ignore_permissions === true || Number(a.ignore_permissions) === 1 || a.ignore_permissions === "true";
      const names = (parse(a.names) as string[]) ?? [];
      if (P && !ignore) for (const n of names) P.assertDoc(get(String(a.doctype), n), "read");
      for (const n of names) {
        for (const as of openAssignments(String(a.doctype), n)) {
          for (const t of store.todos.values()) if (t.reference_type === a.doctype && t.reference_name === n && t.allocated_to === as.owner && !["Cancelled", "Closed"].includes(String(t.status))) { const prev = String(t.status); t.status = "Cancelled"; todoComment(t, prev); }
        }
        syncAssign(String(a.doctype), n);
      }
      return {};
    },
    // assignment_rule.py:231-245, apply :267-296: no permission check; the simulator has no Assignment Rule records, so
    // every document is the "no enabled rule" no-op (a missing name still fails in the synchronous path, <= 5 names)
    "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply": (a) => {
      const names = (parse(a.docnames) as string[]) ?? [];
      if (names.length <= 5) for (const n of names) get(String(a.doctype), n);
      return {};
    },
    // tag.py:42-49, DocTags.add / update :87-116: no permission check; the Tag master is created; `_user_tags` = ",a,b"
    "frappe.desk.doctype.tag.tag.add_tags": (a) => {
      const tags = ((parse(a.tags) as string[]) ?? []).map(String);
      const dt = String(a.dt);
      for (const n of (parse(a.docs) as string[]) ?? []) {
        const doc = get(dt, n);
        if (P) P.assertDoc(doc, "write"); // tag.py update_tags → frappe.has_permission(write, throw) (P36b)
        const tl = String(doc._user_tags ?? "").split(",").filter(Boolean);
        for (const tag of tags) {
          if (tl.includes(tag)) continue;
          tl.push(tag);
          if (!table("Tag").has(tag)) { const ts = stamp(); table("Tag").set(tag, { doctype: "Tag", name: tag, owner: user, creation: ts, modified: ts, modified_by: user, docstatus: 0, idx: 0 } as FrappeDoc); }
        }
        doc._user_tags = tl.length ? `,${[...new Set(tl)].join(",")}` : "";
      }
      return {};
    },
    // workflow.py:332-353: per row get_transitions (read on the stored doc; the first unset state ends the scan) minus
    // self-approval with the owner the CLIENT sent; the intersection
    "frappe.model.workflow.get_common_transition_actions": (a) => {
      const docs = (parse(a.docs) as Row[]) ?? [];
      let common: string[] = [];
      for (const [i, d] of docs.entries()) {
        const row = { doctype: a.doctype, ...d } as Row;
        const cur = get(String(row.doctype), row.name);
        if (P) P.assertDoc(cur, "read");
        const wf = workflowOf(cur.doctype);
        if (wf && !cur[wf.workflow_state_field]) break; // WorkflowStateError swallowed
        const actions = transitionsFor(cur).filter((t) => approvalAccess(row, t)).map((t) => t.action);
        if (!actions.length) return { message: [] };
        common = i === 0 ? [...new Set(actions)] : common.filter((x) => actions.includes(x));
        if (!common.length) return { message: [] };
      }
      return { message: common };
    },
    // workflow.py:237-253, 256-329: < 20 now, <= 500 "enqueued" (run at once here, with the alert), > 500 refused; the
    // per-document result is a REALTIME msgprint (kept in store.published), not in the answer
    "frappe.model.workflow.bulk_workflow_approval": (a) => {
      const names = (parse(a.docnames) as string[]) ?? [];
      if (names.length > 500) return fail(417, "ValidationError", "Bulk approval only support up to 500 documents.", { _server_messages: sm({ message: "Bulk approval only support up to 500 documents.", title: "Too Many Documents", indicator: "red", raise_exception: 1 }) });
      const failed: string[] = [], ok: string[] = [];
      for (const n of names) {
        try { handlers["frappe.model.workflow.apply_workflow"]({ doc: JSON.stringify({ doctype: a.doctype, name: n }), action: a.action }, store, ctx); ok.push(n); }
        catch (e) { failed.push(`${n}: ${(e as Error).message}`); }
      }
      const indicator = failed.length && ok.length ? "orange" : failed.length ? "red" : "green";
      if (failed.length) store.published.push({ event: "msgprint", title: "Workflow Status", message: `<h4>Failed Transactions</h4>${failed.map((f) => `<div>${f}</div>`).join("")} (${indicator})` });
      if (ok.length) store.published.push({ event: "msgprint", title: "Workflow Status", message: `<h4>Successful Transactions</h4>${ok.map((f) => `<div>${f}</div>`).join("")} (${indicator})` });
      return names.length >= 20 ? { _server_messages: sm({ message: `Bulk ${String(a.action)} is enqueued in background.`, alert: 1 }) } : {};
    },
    // print_format.py:40-70: a task id (HTTP 201); the job publishes task_complete:<id> — the simulator renders no PDF
    "frappe.utils.print_format.download_multi_pdf_async": (a) => {
      const taskId = `sim-${hash()}`;
      const names = (parse(a.name) as string[]) ?? [];
      const left = names.filter((n) => printRefusal(String(a.doctype), n));
      store.published.push({ event: `task_complete:${taskId}`, message: JSON.stringify({ simulated: true, file_url: null, note: `SIMULATED: no PDF is rendered in the browser simulator (${names.length - left.length} of ${names.length} document(s) printable)` }) });
      return { message: { task_id: taskId } };
    },
    // reportview.py:352-383: the background variant answers nothing but a msgprint (the e-mail goes nowhere here)
    [EXPORT_QUERY]: (a) => {
      if (!Number(a.export_in_background)) return fail(417, "ValidationError", "SIMULATED: a foreground export_query is a file download — use the files transport");
      const email = String(store.docs.get("User")?.get(user)?.email ?? user);
      return { _server_messages: sm({ message: `Your report is being generated in the background. You will receive an email on ${email} with a download link once it is ready. (SIMULATED: no e-mail is sent.)` }) };
    },
    // ---- Data Import (data_import.py:143-256) ----
    [`${DI}.get_preview_from_template`]: (a) => {
      const di = get("Data Import", a.data_import);
      if (P) P.assertDoc(di, "read");
      const file = a.import_file ? String(a.import_file) : String(di.import_file ?? "");
      if (!file) return {};
      const logs = (importLogs.get(di.name) ?? []).slice(0, 10).map((l) => ({ row_indexes: l.row_indexes, success: l.success }));
      return { message: previewOf(templateOf({ ...di, import_file: file }), logs) };
    },
    [`${DI}.form_start_import`]: (a) => {
      const di = get("Data Import", a.data_import);
      if (P) P.assertDoc(di, "write");
      runImport(di);
      return { message: true };
    },
    [`${DI}.get_import_status`]: (a) => {
      const di = get("Data Import", a.data_import_name);
      if (P) P.assertDoc(di, "read");
      const logs = importLogs.get(di.name) ?? [];
      const ok = logs.filter((l) => Number(l.success) === 1).length, bad = logs.length - ok;
      return { message: { status: di.status ?? "Pending", ...(ok ? { success: ok } : {}), ...(bad ? { failed: bad } : {}), total_records: di.payload_count ?? 0 } };
    },
    [`${DI}.get_import_logs`]: (a) => {
      const di = get("Data Import", a.data_import);
      if (P) P.assertDoc(di, "read");
      return { message: (importLogs.get(di.name) ?? []).slice(0, 5000).map((l) => ({ success: l.success, docname: l.docname, messages: l.messages, exception: l.exception, row_indexes: l.row_indexes })) };
    },
    ...workstreamHandlers,
    ...options.handlers,
  };

  // seed
  for (const [doctype, docs] of Object.entries(backend.docs ?? {})) {
    const meta = metaOf(doctype);
    for (const d of docs) {
      const doc = meta ? prepare(meta, { ...d, doctype }, false) : ({ ...d, doctype } as FrappeDoc);
      // keep authored standard values when given
      for (const k of ["owner", "creation", "modified", "modified_by", "docstatus"] as const) if (d[k] !== undefined) (doc as Row)[k] = d[k];
      doc.owner ??= user;
      doc.creation ??= d.modified ?? doc.modified;
      if (!d.name) doc.name = meta ? makeName(meta, d) : `${doctype}-${++seq}`;
      if (meta) for (const tf of tableFields(meta)) for (const r of (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []) r.parent = doc.name;
      table(doctype).set(doc.name, doc);
    }
  }
  // seeded ToDos drive assignments: `_assign` of every referenced doc from its Open ToDos
  for (const t of [...store.todos.values()]) syncAssign(String(t.reference_type ?? ""), String(t.reference_name ?? ""));
  // the session user exists as a User (assign picker, user_info) unless the backend authored its own users
  if (!store.docs.get("User")?.size) {
    const ts = stamp();
    table("User").set(user, { doctype: "User", name: user, email: user, first_name: user, full_name: user, user_type: "System User", enabled: 1, docstatus: 0, owner: "Administrator", creation: ts, modified: ts, modified_by: "Administrator" });
  }
  // P on: the seeded DocShare rows, and the session the client should be given
  for (const sh of options.permissions?.shares ?? []) addShare({ ...sh, everyone: sh.everyone ? 1 : 0, read: sh.read === undefined || sh.read ? 1 : 0, write: sh.write ? 1 : 0, submit: sh.submit ? 1 : 0, share: sh.share ? 1 : 0 });
  if (P) store.session = P.clientSession();

  /**
   * The SIMULATED file server. `download_template` (data_import.py:178-202): P on → read on the DocType (:188, 403
   * "No permission for X"), then — unless a blank template — `can_export` (exporter.py:116-126, permissions.py:608-616:
   * System Manager or the export right; with export only through if_owner every exported row must be the user's).
   * The answer is a small text file that says it is simulated: the request echo and the column LABELS, never document
   * values. Every other download and every upload is refused (no file storage is simulated).
   */
  /** `download_multi_pdf` (print_format.py:27-39, 72-225): documents `get_print` refuses are LEFT OUT silently (the
   *  sync path swallows every exception). The answer is a text file labelled SIMULATED — never a PDF, never values. */
  function printPdf(args: Record<string, unknown>): DownloadedFile {
    const doctype = String(args.doctype ?? "");
    requireMeta(doctype);
    const names = (parse(args.name) as string[]) ?? [];
    const refused = names.map((n) => [n, printRefusal(doctype, n)] as const).filter(([, r]) => r);
    return simulatedFile(`SIMULATED-${slugName(doctype)}-not-a-pdf.txt`, [
      "NOT A PDF: the simulator renders nothing; on a site the merged PDF of the printable documents is streamed.",
      `Printable (simulated decision): ${names.length - refused.length} of ${names.length}`,
      `Left out silently by the server (simulated reasons): ${refused.map(([n, r]) => `${n} (${r})`).join(", ") || "—"}`,
      `Request: ${PRINT_PDF} ${JSON.stringify(args)}`,
    ]);
  }
  /** `export_query` → `_export_query` (reportview.py:393-466): an Access Log row FIRST (:410-415, a site write — kept in
   *  the store as "Access Log"), the query with the row filter (403 without read), `can_export` (403), then a text file
   *  labelled SIMULATED: the column labels and the request — never values or counts (owner decision 6, Phase 27). */
  function exportQuery(args: Record<string, unknown>): DownloadedFile {
    const doctype = String(args.doctype ?? "");
    const meta = requireMeta(doctype);
    const ts = stamp();
    const log = { doctype: "Access Log", name: hash(), export_from: doctype, file_type: args.file_format_type ?? null, filters: args.filters ?? null, user, owner: user, creation: ts, modified: ts, docstatus: 0, idx: 0, method: "SIMULATED Access Log (reportview.py:410-415)" } as unknown as FrappeDoc;
    table("Access Log").set(log.name, log);
    const selected = parse(args.selected_items) as string[] | null;
    const q: Record<string, unknown> = { ...args, filters: selected?.length ? { name: ["in", selected] } : args.filters };
    const rows = rowsFor(doctype, q);
    const { keys } = project(doctype, rows.slice(0, 1), args.fields);
    if (P && !P.canExport(doctype)) {
      const denied = toFrappeError(403, { exc_type: "PermissionError", exception: `frappe.exceptions.PermissionError: You are not allowed to export ${doctype} doctype` });
      if (!P.canExport(doctype, true) || rows.some((r) => String(r.owner ?? "") !== user)) throw denied;
    }
    const labelOf = (f: string) => (f === "name" ? "ID" : meta.fields.find((x) => x.fieldname === f)?.label || f);
    const ext = String(args.file_format_type) === "CSV" ? "csv" : "xlsx";
    return simulatedFile(`SIMULATED-${slugName(String(args.title ?? doctype))}-not-a-${ext}.txt`, [
      "NOT AN EXPORT: no document values and no counts are included — only the column labels and the request.",
      `Columns (labels only): Sr | ${keys.map(labelOf).join(" | ")}`,
      `Request: ${EXPORT_QUERY} ${JSON.stringify(args)}`,
    ]);
  }

  const files: FrappeFilesTransport = {
    async download(method, args) {
      store.calls.push({ method, args: clone(args) });
      if (backend.latency) await new Promise((r) => setTimeout(r, backend.latency));
      if (method === PRINT_PDF) return printPdf(args);
      if (method === EXPORT_QUERY) return exportQuery(args);
      if (method === `${DI}.download_errored_template` || method === `${DI}.download_import_log`) {
        const di = get("Data Import", args.data_import_name);
        if (P) P.assertDoc(di, "read");
        const logs = importLogs.get(di.name) ?? [];
        const rows = (method.endsWith("errored_template") ? logs.filter((l) => !Number(l.success)) : logs).map((l) => String(l.row_indexes));
        return simulatedFile(`SIMULATED-${slugName(di.name)}-${method.endsWith("errored_template") ? "errored-rows" : "import-log"}.txt`, [
          "NOT A FILE FROM A SITE: no row values are included, only the row numbers the simulated job logged.",
          `Request: ${method} ${JSON.stringify(args)}`, `Rows: ${rows.join(" ") || "—"}`,
        ]);
      }
      if (method !== DOWNLOAD_TEMPLATE) fail(404, "DoesNotExistError", `SIMULATED: the file server does not simulate ${method}`);
      const doctype = String(args.doctype ?? "");
      const meta = requireMeta(doctype);
      if (P) {
        P.assertDoctype(doctype, "read");
        if (String(args.export_records ?? "") !== "blank_template" && !P.canExport(doctype)) {
          const denied = toFrappeError(403, { exc_type: "PermissionError", exception: `frappe.exceptions.PermissionError: You are not allowed to export ${doctype} doctype` });
          if (!P.canExport(doctype, true)) throw denied;
          const rows = rowsFor(doctype, { filters: parse(args.export_filters) ?? undefined });
          if (rows.some((r) => String(r.owner ?? "") !== user)) throw denied;
        }
      }
      const exportFields = (parse(args.export_fields) as Record<string, string[]> | null) ?? {};
      const labelOf = (dt: string, f: string) => (f === "name" ? "ID" : metaOf(dt)?.fields.find((x) => x.fieldname === f)?.label || f);
      const columns = Object.entries(exportFields).flatMap(([dt, fs]) => (Array.isArray(fs) ? fs : []).map((f) => (dt === meta.name ? labelOf(dt, f) : `${labelOf(dt, f)} (${dt})`)));
      const text = [
        "SIMULATED — in-browser Frappe simulator (@solvfast/ui/frappe/testing).",
        "NOT AN EXPORT: this file contains no document values, only the column labels and the request.",
        `On a real site ${method} streams the ${String(args.file_type ?? "CSV")} built server-side (frappe/core/doctype/data_import/exporter.py).`,
        `Session: ${user}${P ? " (permission decisions simulated)" : " (permissions not simulated)"}`,
        `Columns (labels only): ${columns.join(" | ") || "—"}`,
        `Request: ${JSON.stringify(args)}`,
        "",
      ].join("\n");
      const file: DownloadedFile = { blob: new Blob([text], { type: "text/plain" }), filename: `SIMULATED-${meta.name.replace(/\s+/g, "-")}-not-an-export.txt`, contentType: "text/plain" };
      return file;
    },
    /**
     * `upload_file` (handler.py:175-263), for the Data Import only: write on the target doc (`check_write_permission`
     * :266-282, P on), the content kept in memory for the simulated preview / job, a File doc answered. Any other
     * upload is refused (no file storage is simulated).
     */
    async upload(file, filename, opts) {
      // the multipart fields Desk sends (FileUploader.vue:660-700), `optimize` / `max_width` / `max_height` included
      store.calls.push({ method: "upload_file", args: clone({ filename, ...opts, ...(opts.optimize ? { optimize: true } : {}) }) });
      if (backend.latency) await new Promise((r) => setTimeout(r, backend.latency));
      if (opts.doctype !== "Data Import") throw toFrappeError(417, { exc_type: "ValidationError", _server_messages: sm({ message: "SIMULATED: uploads are not simulated (no file storage) except a Data Import's file.", indicator: "red", raise_exception: 1 }) });
      if (P) {
        const target = opts.docname ? store.docs.get("Data Import")?.get(String(opts.docname)) : undefined;
        if (target) P.assertDoc(target, "write");
        else P.assertDoctype("Data Import", "write");
      }
      const content = await blobText(file);
      const name = hash();
      const fileUrl = `${opts.isPrivate ? "/private" : ""}/files/${name}-${filename}`;
      uploads.set(fileUrl, { content, filename, csv: /\.csv$/i.test(filename) || /^text\/csv/.test((file as Blob).type ?? "") });
      const ts = stamp();
      return { doctype: "File", name, file_name: filename, file_url: fileUrl, is_private: opts.isPrivate ? 1 : 0, attached_to_doctype: opts.doctype ?? null, attached_to_name: opts.docname ?? null, attached_to_field: opts.fieldname ?? null, owner: user, creation: ts, modified: ts, docstatus: 0 } as FrappeDoc;
    },
  };

  const transport = (async (method: string, args: Record<string, unknown>) => {
    store.calls.push({ method, args: clone(args) });
    if (backend.latency) await new Promise((r) => setTimeout(r, backend.latency));
    const h = handlers[method];
    if (!h) fail(404, "DoesNotExistError", `Method ${method} is not simulated`);
    return clone(await h(args, store, ctx));
  }) as FixtureTransport;
  transport.store = store;
  transport.files = files;
  transport.permissions = P;
  return transport;
}

/** Helper for authored metas: a Link / Table field list → `FrappeDocField[]` with sane defaults. */
export function fixtureFields(fields: Array<Partial<FrappeDocField> & { fieldname: string }>): FrappeDocField[] {
  return fields.map((f, i) => ({ fieldtype: "Data", label: f.fieldname, idx: i + 1, ...f }));
}

/** A Blob's text in browsers (Blob.text), jsdom (FileReader) and Node (Response). */
async function blobText(b: Blob): Promise<string> {
  if (typeof (b as Blob & { text?: unknown }).text === "function") return b.text();
  if (typeof FileReader !== "undefined") return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result ?? "")); r.onerror = () => reject(r.error); r.readAsText(b); });
  return new Response(b).text();
}
