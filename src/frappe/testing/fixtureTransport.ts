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
import { toFrappeError, type FrappeResponse, type FrappeTransport } from "../client";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, FrappeDocField, WorkflowInfo } from "../contract";

type Row = Record<string, unknown>;
type Filter = [string, string, unknown] | [string, string, string, unknown];
export type FixtureHandler = (args: Record<string, unknown>, backend: FixtureStore) => FrappeResponse | Promise<FrappeResponse>;

export interface FixtureOptions {
  /** Extra or overriding methods (custom whitelisted methods, controller methods via "run_doc_method:<method>"). */
  handlers?: Record<string, FixtureHandler>;
  /** The simulated user's roles (workflow transitions are filtered by them). Default: every role is allowed. */
  roles?: string[];
  /** Fixed clock for `modified` / `creation` (tests). Default: the real clock. */
  now?: () => Date;
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
  todos: Map<string, Row>;
  userSettings: Record<string, string>;
  user: string;
  calls: FixtureCall[];
}

export type FixtureTransport = FrappeTransport & { store: FixtureStore };

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
 * filters: get_list / insert / delete). A backend that provides its own meta for them wins.
 */
export const BUILTIN_FIXTURE_META: Record<string, DocTypeMeta[]> = {
  User: [{
    name: "User", autoname: "field:email", title_field: "full_name", search_fields: "full_name", show_title_field_in_link: 0,
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
    fields: [
      { fieldname: "filter_name", fieldtype: "Data", label: "Filter Name" },
      { fieldname: "reference_doctype", fieldtype: "Link", label: "Reference Document Type", options: "DocType" },
      { fieldname: "for_user", fieldtype: "Link", label: "For User", options: "User" },
      { fieldname: "filters", fieldtype: "Long Text", label: "Filters" },
    ],
  }],
};

export function createFixtureTransport(backend: FixtureBackend, options: FixtureOptions = {}): FixtureTransport {
  const now = options.now ?? (() => new Date());
  const user = backend.user ?? "Administrator";
  const store: FixtureStore = {
    docs: new Map(), meta: { ...clone(BUILTIN_FIXTURE_META), ...clone(backend.meta) }, workflows: clone(backend.workflows ?? {}), comments: new Map(), todos: new Map(),
    userSettings: {}, user, calls: [],
  };
  const versions: Row[] = [];
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
  const permissions = (meta: DocTypeMeta) => ({
    select: 1, read: 1, write: 1, create: 1, delete: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1,
    submit: meta.is_submittable ? 1 : 0, cancel: meta.is_submittable ? 1 : 0, amend: meta.is_submittable ? 1 : 0,
  });

  function makeName(meta: DocTypeMeta, doc: FrappeDoc): string {
    const auto = String(meta.autoname ?? "").trim();
    if (typeof doc.__newname === "string" && doc.__newname) return doc.__newname;
    if (auto.startsWith("field:")) { const v = doc[auto.slice(6)]; if (v) return String(v); }
    const series = auto.startsWith("naming_series:") ? String(doc.naming_series ?? "") : auto.startsWith("format:") ? auto.slice(7) : auto.includes("#") ? auto : "";
    if (series) {
      const d = now();
      const prefix = series.replace(/\.YYYY\./g, String(d.getFullYear())).replace(/\.YY\./g, String(d.getFullYear()).slice(2)).replace(/\.MM\./g, String(d.getMonth() + 1).padStart(2, "0")).replace(/\{|\}/g, "");
      const hashes = /#+/.exec(prefix);
      const key = `${meta.name}:${prefix.replace(/#+/, "")}`;
      counters[key] = (counters[key] ?? 0) + 1;
      return hashes ? prefix.replace(/\.?#+/, String(counters[key]).padStart(hashes[0].length, "0")).replace(/\.$/, "") : `${prefix}${counters[key]}`;
    }
    let name = hash();
    while (table(meta.name).has(name)) name = hash();
    return name;
  }

  /** Normalise a doc for storage: name, standard fields, child rows (names, parent links, idx, docstatus). */
  function prepare(meta: DocTypeMeta, doc: FrappeDoc, isNew: boolean, previous?: FrappeDoc): FrappeDoc {
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
      out[tf.fieldname] = rows.map((r, i) => {
        const row: FrappeDoc = { ...r };
        for (const k of Object.keys(row)) if (k.startsWith("__")) delete row[k];
        if (r.__islocal || !r.name || String(r.name).startsWith("new-")) row.name = hash();
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

  function docinfo(doctype: string, name: string) {
    const meta = requireMeta(doctype);
    const comments = [...store.comments.values()].filter((c) => c.reference_doctype === doctype && c.reference_name === name);
    const byType = (...types: string[]) => comments.filter((c) => types.includes(String(c.comment_type))).map(clone);
    const assignments = [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && t.status === "Open")
      .map((t) => ({ name: t.name, owner: t.allocated_to, description: t.description, status: t.status }));
    const users = new Set<string>([user, ...comments.map((c) => String(c.owner)), ...assignments.map((a) => String(a.owner))]);
    const doc = table(doctype).get(name);
    if (doc?.owner) users.add(String(doc.owner));
    if (doc?.modified_by) users.add(String(doc.modified_by));
    return {
      doctype, name, attachments: [], communications: [], automated_messages: [], views: [], shared: [], milestones: [],
      versions: meta.track_changes ? versions.filter((v) => v.ref_doctype === doctype && v.docname === name).slice(-10).reverse().map(clone) : [],
      energy_point_logs: [], additional_timeline_content: [], tags: "", document_email: null, is_document_followed: 0,
      comments: byType("Comment").map((c) => ({ name: c.name, content: c.content, owner: c.owner, creation: c.creation, comment_type: "Comment", comment_email: c.comment_email, comment_by: c.comment_by })),
      assignment_logs: byType("Assigned", "Assignment Completed"), attachment_logs: byType("Attachment", "Attachment Removed"),
      info_logs: byType("Info", "Edit", "Label"), like_logs: byType("Like"), workflow_logs: byType("Workflow"),
      assignments, permissions: permissions(meta),
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

  function syncAssign(doctype: string, name: string) {
    const doc = table(doctype).get(name);
    if (!doc) return;
    const users = [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && t.status === "Open").map((t) => String(t.allocated_to));
    doc._assign = JSON.stringify(users);
  }
  const openAssignments = (doctype: string, name: string) =>
    [...store.todos.values()].filter((t) => t.reference_type === doctype && t.reference_name === name && !["Cancelled", "Closed"].includes(String(t.status))).slice(0, 5).map((t) => ({ owner: t.allocated_to, name: t.name }));
  function assign(doctype: string, name: string, users: string[], a: Row) {
    get(doctype, name);
    const dup: string[] = [];
    for (const u of users) {
      if ([...store.todos.values()].some((t) => t.reference_type === doctype && t.reference_name === name && t.allocated_to === u && t.status === "Open")) { dup.push(u); continue; }
      const todo: Row = { doctype: "ToDo", name: hash(), allocated_to: u, reference_type: doctype, reference_name: name, description: a.description || `Assignment for ${doctype} ${name}`, priority: a.priority || "Medium", status: "Open", date: a.date || ymd(now()), assigned_by: user };
      store.todos.set(String(todo.name), todo);
      addComment(doctype, name, "Assigned", `${user} assigned ${u}`);
    }
    syncAssign(doctype, name);
    return dup;
  }

  // ---- rows (get_list / reportview) -------------------------------------------------------------------------------
  function rowsFor(doctype: string, a: Record<string, unknown>): Row[] {
    const meta = requireMeta(doctype);
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
    let rows = [...table(doctype).values()].filter((d) => filters.every((f) => test(d, f)) && (!orFilters.length || orFilters.some((f) => test(d, f))));
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
    const cols = list.flatMap((spec): { key: string; dt?: string; f: string }[] => {
      const s = String(spec).trim();
      if (s === "*" || unquote(s) === `tab${doctype}.*`) return [...known].filter((k) => !k.startsWith("parent")).map((k) => ({ key: k, f: k }));
      const alias = /\s+as\s+(.+)$/i.exec(s);
      const [dt, f] = splitField(alias ? s.slice(0, alias.index) : s);
      if ((dt ?? doctype) === doctype && !known.has(f)) fail(417, "DataError", `Field not permitted in query: ${f}`);
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
  function save(raw: FrappeDoc, action: string): FrappeDoc {
    const meta = requireMeta(raw.doctype);
    const isNew = !!raw.__islocal || !raw.name || !table(meta.name).has(String(raw.name));
    const previous = isNew ? undefined : table(meta.name).get(String(raw.name));
    const target = action === "Save" ? 0 : action === "Cancel" ? 2 : 1;
    if (previous) {
      if (raw.modified && previous.modified !== raw.modified) {
        fail(417, "TimestampMismatchError", `Error: Document has been modified after you have opened it (${String(previous.modified)}, ${String(raw.modified)}). Please refresh to get the latest document.`);
      }
      const from = Number(previous.docstatus ?? 0);
      if (from === 2) fail(417, "ValidationError", "Cannot edit cancelled document");
      if (from === 1 && target === 0) fail(417, "DocstatusTransitionError", "Cannot change docstatus from 1 (Submitted) to 0 (Draft)");
      if (from === 0 && target === 2) fail(417, "DocstatusTransitionError", "Cannot change docstatus from 0 (Draft) to 2 (Cancelled)");
    }
    if (target === 1 && !meta.is_submittable) fail(417, "ValidationError", `${meta.name} is not submittable`);
    const before = { ...counters }; // a failed insert rolls back, so a naming series number is not consumed
    const doc = prepare(meta, { ...raw, docstatus: target as 0 | 1 | 2 }, isNew, previous);
    if (target !== 2) {
      const missing = missingMandatory(meta, doc);
      if (missing.length) {
        for (const k of Object.keys(counters)) if (!(k in before)) delete counters[k]; else counters[k] = before[k];
        throw toFrappeError(417, { exc_type: "MandatoryError", _server_messages: sm(...missing.map((message) => ({ message }))) });
      }
    }
    if (isNew && table(meta.name).has(doc.name)) fail(409, "DuplicateEntryError", `${meta.name} ${doc.name} already exists`);
    for (const k of ["_assign", "_comments", "_liked_by", "_user_tags"]) if (previous && previous[k] !== undefined && doc[k] === undefined) doc[k] = previous[k];
    if (previous && meta.track_changes) recordVersion(meta, previous, doc);
    table(meta.name).set(doc.name, doc);
    return doc;
  }

  /** A `Version` row like Frappe's (`data` = JSON {changed, added, removed, row_changed}) — simplified diff (SIMULATED). */
  function recordVersion(meta: DocTypeMeta, before: FrappeDoc, after: FrappeDoc) {
    const skip = new Set(["modified", "modified_by", "creation", "owner", "idx", "docstatus", "_assign", "_comments", "_liked_by", "_user_tags", "_seen"]);
    const scalar = meta.fields.filter((f) => !LAYOUT.has(f.fieldtype) && !TABLES.has(f.fieldtype) && !skip.has(f.fieldname));
    const same = (a: unknown, b: unknown) => (a ?? "") === (b ?? "") || String(a ?? "") === String(b ?? "");
    const changed = scalar.filter((f) => !same(before[f.fieldname], after[f.fieldname])).map((f) => [f.fieldname, before[f.fieldname] ?? null, after[f.fieldname] ?? null]);
    const added: unknown[] = [], removed: unknown[] = [], rowChanged: unknown[] = [];
    for (const tf of tableFields(meta)) {
      const old = ((before[tf.fieldname] as FrappeDoc[] | undefined) ?? []);
      const now_ = ((after[tf.fieldname] as FrappeDoc[] | undefined) ?? []);
      const cm = metaOf(tf.options!);
      for (const r of now_) {
        const o = old.find((x) => x.name === r.name);
        if (!o) { added.push([tf.fieldname, r]); continue; }
        const diff = (cm?.fields ?? []).filter((f) => !LAYOUT.has(f.fieldtype) && !same(o[f.fieldname], r[f.fieldname])).map((f) => [f.fieldname, o[f.fieldname] ?? null, r[f.fieldname] ?? null]);
        if (diff.length) rowChanged.push([tf.fieldname, r.idx, r.name, diff]);
      }
      for (const o of old) if (!now_.some((r) => r.name === o.name)) removed.push([tf.fieldname, o]);
    }
    if (!changed.length && !added.length && !removed.length && !rowChanged.length) return;
    versions.push({
      doctype: "Version", name: hash(), ref_doctype: meta.name, docname: after.name, owner: user, creation: after.modified,
      data: JSON.stringify({ changed, added, removed, row_changed: rowChanged, data_import: null, updater_reference: null }),
    });
  }

  const userInfoFn = (u: string) => {
    const ud = store.docs.get("User")?.get(u);
    return { fullname: String(ud?.full_name || u), image: (ud?.user_image as string | undefined) ?? null, name: u };
  };

  function workflowOf(doctype: string): WorkflowInfo | undefined {
    return store.workflows[doctype] ?? Object.values(store.workflows).find((w) => w.document_type === doctype);
  }
  function transitionsFor(doc: FrappeDoc): WorkflowInfo["transitions"] {
    const wf = workflowOf(doc.doctype);
    if (!wf) fail(417, "ValidationError", `No active workflow for ${doc.doctype}`);
    const state = doc[wf.workflow_state_field];
    if (!state) fail(417, "WorkflowStateError", "Workflow State not set");
    // SIMULATED: `condition` is not evaluated; roles filter only when `options.roles` is given
    return wf.transitions.filter((t) => t.state === state && (!options.roles || options.roles.includes(t.allowed)));
  }

  const docResponse = (doc: FrappeDoc, message: string, extra: Row = {}): FrappeResponse => ({
    docs: [clone(doc)], docinfo: docinfo(doc.doctype, doc.name), _server_messages: sm({ message, indicator: message === "Cancelled" ? "red" : "green", alert: 1 }), ...extra,
  });

  const handlers: Record<string, FixtureHandler> = {
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
    "frappe.desk.form.load.getdoc": (a) => {
      requireMeta(a.doctype);
      const doc = table(String(a.doctype)).get(String(a.name));
      return doc ? { docs: [clone(doc)], docinfo: docinfo(doc.doctype, doc.name), _link_titles: {} } : { docs: [] };
    },
    "frappe.desk.form.load.get_docinfo": (a) => { get(String(a.doctype), a.name); return { docinfo: docinfo(String(a.doctype), String(a.name)) }; },
    "frappe.desk.form.load.get_communications": () => ({ message: [] }),
    "frappe.client.get": (a) => ({ message: clone(get(String(a.doctype), a.name)) }),
    "frappe.client.get_value": (a) => {
      const rows = rowsFor(String(a.doctype), { filters: a.filters ?? (a.name ? { name: a.name } : undefined) });
      const fields = parse(a.fieldname);
      const list = Array.isArray(fields) ? (fields as string[]) : [String(fields ?? "name")];
      return { message: rows[0] ? Object.fromEntries(list.map((f) => [f, rows[0][f] ?? null])) : {} };
    },
    "frappe.desk.form.save.savedocs": (a) => {
      const raw = parse(a.doc) as FrappeDoc;
      const localname = raw.__islocal ? raw.name : undefined;
      const doc = save(raw, String(a.action));
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
      if (a.doctype === "Comment") { if (!store.comments.delete(String(a.name))) notFound(`Comment ${String(a.name)}`); return {}; }
      get(String(a.doctype), a.name);
      if (Number(table(String(a.doctype)).get(String(a.name))!.docstatus) === 1) fail(417, "ValidationError", "Submitted Record cannot be deleted. You must Cancel it first.");
      table(String(a.doctype)).delete(String(a.name));
      return {};
    },
    "frappe.desk.reportview.delete_items": (a) => {
      for (const n of (parse(a.items) as string[]) ?? []) handlers["frappe.client.delete"]({ doctype: a.doctype, name: n }, store);
      return {};
    },
    "frappe.rename_doc": (a) => {
      const doctype = String(a.doctype), old = String(a.old), next = String(a.new);
      const cur = get(doctype, old);
      if (old === next) return { message: next };
      if (table(doctype).has(next) && !a.merge) fail(417, "ValidationError", `Another ${doctype} with name ${next} exists, select another name`);
      table(doctype).delete(old);
      const renamed: FrappeDoc = { ...cur, name: next, modified: stamp() };
      for (const tf of tableFields(requireMeta(doctype))) renamed[tf.fieldname] = ((renamed[tf.fieldname] as Row[]) ?? []).map((r) => ({ ...r, parent: next }));
      if (!(a.merge && table(doctype).has(next))) table(doctype).set(next, renamed as FrappeDoc);
      for (const c of store.comments.values()) if (c.reference_doctype === doctype && c.reference_name === old) c.reference_name = next;
      for (const t of store.todos.values()) if (t.reference_type === doctype && t.reference_name === old) t.reference_name = next;
      return { message: next };
    },
    "frappe.client.validate_link": (a) => {
      requireMeta(a.doctype);
      const doc = [...table(String(a.doctype)).values()].find((d) => String(d.name).toLowerCase() === String(a.docname).toLowerCase());
      if (!doc) return { message: { name: null } };
      const fields = (parse(a.fields) as string[] | undefined) ?? [];
      return { message: { name: doc.name, ...Object.fromEntries(fields.map((f) => [f, doc[f] ?? null])) } };
    },
    run_doc_method: (a) => {
      const doc = parse(a.docs) as FrappeDoc;
      const custom = options.handlers?.[`run_doc_method:${String(a.method)}`];
      if (custom) return custom(a, store);
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
      let rows = rowsFor(doctype, { filters: a.filters, order_by: "idx desc, modified desc" });
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
      return { message: doc ? clone(transitionsFor(doc)) : [] };
    },
    "frappe.model.workflow.apply_workflow": (a) => {
      const posted = parse(a.doc) as FrappeDoc;
      const cur = get(posted.doctype, posted.name); // like Frappe: the posted edits are discarded (load_from_db)
      const wf = workflowOf(cur.doctype)!;
      const t = transitionsFor(cur).find((x) => x.action === a.action) ?? fail(417, "WorkflowTransitionError", "Not a valid Workflow Action");
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
      const dup = assign(String(a.doctype), String(a.name), (parse(a.assign_to) as string[]) ?? [], a);
      return { message: openAssignments(String(a.doctype), String(a.name)), ...(dup.length ? { _server_messages: sm({ message: `Already in the following Users ToDo list:${dup.join(", ")}` }) } : {}) };
    },
    "frappe.desk.form.assign_to.add_multiple": (a) => {
      for (const n of (parse(a.name) as string[]) ?? []) assign(String(a.doctype), n, (parse(a.assign_to) as string[]) ?? [], a);
      return {};
    },
    "frappe.desk.form.assign_to.remove": (a) => {
      for (const t of store.todos.values()) if (t.reference_type === a.doctype && t.reference_name === a.name && t.allocated_to === a.assign_to && t.status === "Open") t.status = "Cancelled";
      addComment(String(a.doctype), String(a.name), "Assignment Completed", `${user} removed their assignment.`);
      syncAssign(String(a.doctype), String(a.name));
      return { message: openAssignments(String(a.doctype), String(a.name)) };
    },
    "frappe.desk.form.assign_to.close": (a) => {
      for (const t of store.todos.values()) if (t.reference_type === a.doctype && t.reference_name === a.name && t.allocated_to === a.assign_to && t.status === "Open") t.status = "Closed";
      syncAssign(String(a.doctype), String(a.name));
      return { message: openAssignments(String(a.doctype), String(a.name)) };
    },
    "frappe.desk.form.utils.add_comment": (a) => {
      get(String(a.reference_doctype), a.reference_name);
      const c = addComment(String(a.reference_doctype), String(a.reference_name), "Comment", String(a.content ?? ""), { comment_email: a.comment_email || user, comment_by: a.comment_by || user });
      return { message: clone(c) };
    },
    "frappe.desk.form.utils.update_comment": (a) => {
      const c = store.comments.get(String(a.name)) ?? notFound(`Comment ${String(a.name)}`);
      if (c.owner !== user && user !== "Administrator") fail(403, "PermissionError", "Comment can only be edited by the owner");
      c.content = a.content;
      return {};
    },
    "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs": (a) => {
      const failed: string[] = [];
      const data = (parse(a.data) as Row | undefined) ?? {};
      for (const n of (parse(a.docnames) as string[]) ?? []) {
        try {
          const cur = get(String(a.doctype), n);
          if (a.action === "submit") save({ ...cur }, "Submit");
          else if (a.action === "cancel") handlers["frappe.desk.form.save.cancel"]({ doctype: a.doctype, name: n }, store);
          else save({ ...cur, ...data }, Number(cur.docstatus) === 1 ? "Update" : "Save");
        } catch { failed.push(n); }
      }
      return { message: failed };
    },
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
  // the session user exists as a User (assign picker, user_info) unless the backend authored its own users
  if (!store.docs.get("User")?.size) {
    const ts = stamp();
    table("User").set(user, { doctype: "User", name: user, email: user, first_name: user, full_name: user, user_type: "System User", enabled: 1, docstatus: 0, owner: "Administrator", creation: ts, modified: ts, modified_by: "Administrator" });
  }

  const transport = (async (method: string, args: Record<string, unknown>) => {
    store.calls.push({ method, args: clone(args) });
    if (backend.latency) await new Promise((r) => setTimeout(r, backend.latency));
    const h = handlers[method];
    if (!h) fail(404, "DoesNotExistError", `Method ${method} is not simulated`);
    return clone(await h(args, store));
  }) as FixtureTransport;
  transport.store = store;
  return transport;
}

/** Helper for authored metas: a Link / Table field list → `FrappeDocField[]` with sane defaults. */
export function fixtureFields(fields: Array<Partial<FrappeDocField> & { fieldname: string }>): FrappeDocField[] {
  return fields.map((f, i) => ({ fieldtype: "Data", label: f.fieldname, idx: i + 1, ...f }));
}
