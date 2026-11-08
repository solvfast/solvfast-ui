/**
 * SIMULATED handlers added by the P36 batch-2 "sidebar" workstream (Form Sidebar: attachments, tags). Each handler cites
 * the Frappe 15.110 source of its response shape (paths relative to `apps/frappe/frappe/`). REQUEST and RESPONSE SHAPES
 * only; permission decisions go through the transport's SIMULATED permission engine (`ctx.permissions`, `ctx.assertDoc`)
 * when `createFixtureTransport(…, { permissions })` is used — without it nothing is refused, as everywhere else.
 *
 * Two gaps of the base simulator are closed by `withSimulatedSidebar(transport)` WITHOUT editing fixtureTransport.ts
 * (out-of-ownership need listed in the P36b sidebar report):
 *  - its docinfo always answers `attachments: []` and `tags: ""`; the wrapper fills both from the store, as
 *    desk/form/load.py:191-196 (`get_attachments`) and :387-395 (`get_tags`) read them;
 *  - its file server refuses every upload but a Data Import's; the wrapper routes the other uploads to the simulated
 *    `upload_file` below (handler.py:175-263) so attachments are stored (no bytes are kept — only the File row).
 */
import { toFrappeError, type FrappeFilesTransport, type FrappeResponse } from "../../client";
import type { DocTypeMeta, FrappeDoc } from "../../contract";
import type { FixtureContext, FixtureContextHandler, FixtureStore, FixtureTransport } from "../fixtureTransport";
import { permissionError, type PermissionEngine } from "../permissions";

type Row = Record<string, unknown>;
const sm = (...messages: Row[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));
function fail(status: number, exc_type: string, message: string, title?: string): never {
  throw toFrappeError(status, { exc_type, _server_messages: sm({ message, indicator: "red", raise_exception: 1, ...(title ? { title } : {}) }) });
}
const hash = () => { let s = ""; while (s.length < 10) s += Math.random().toString(36).slice(2); return s.slice(0, 10); };
const on = (v: unknown) => v === true || v === 1 || v === "1";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const metaOf = (store: FixtureStore, doctype: string): DocTypeMeta | undefined => store.meta[doctype]?.[0];
const table = (store: FixtureStore, doctype: string) => {
  let t = store.docs.get(doctype);
  if (!t) { t = new Map(); store.docs.set(doctype, t); }
  return t;
};
function getDoc(store: FixtureStore, doctype: string, name: unknown): FrappeDoc {
  const doc = store.docs.get(doctype)?.get(String(name ?? ""));
  if (!doc) fail(404, "DoesNotExistError", `${doctype} ${String(name ?? "")} not found`);
  return doc;
}
/** Insertion counter: rows written in one millisecond still sort as the server's `modified desc` would. */
let seq = 0;
const stampOf = (ctx: FixtureContext) => { seq += 1; return { ts: ctx.stamp(), seq }; };

/** `Document.add_comment` (model/document.py) for the File hooks: a Comment row on the reference document. */
function addComment(store: FixtureStore, ctx: FixtureContext, doctype: string, name: string, type: string, content: string) {
  const c: Row = { doctype: "Comment", name: hash(), comment_type: type, reference_doctype: doctype, reference_name: name, content, owner: ctx.user, creation: ctx.stamp(), comment_email: ctx.user };
  store.comments.set(String(c.name), c);
}

/**
 * `File.has_permission` (core/doctype/file/file.py:872-910) — the controller hook that decides File rights (every user
 * holds read / write / create / delete on File through the "All" role, file.json): Administrator; a PUBLIC file for
 * read; the file's owner; else the attached document's `write` (write / create / delete) or `read`. File shares
 * (:884-891) are not simulated.
 */
function fileAllowed(store: FixtureStore, ctx: FixtureContext, file: FrappeDoc, ptype: "read" | "write" | "delete"): boolean {
  const P = ctx.permissions;
  if (!P || ctx.user === "Administrator") return true;
  if (!on(file.is_private) && ptype === "read") return true;
  if (file.owner === ctx.user) return true;
  const dt = String(file.attached_to_doctype ?? ""), dn = String(file.attached_to_name ?? "");
  if (!dt || !dn) return false;
  const ref = store.docs.get(dt)?.get(dn);
  if (!ref) return false;
  return P.hasPermission(dt, ptype === "read" ? "read" : "write", ref);
}

/** Tag Link rows of a document, newest first (`get_tags`, load.py:387-395: `frappe.get_all("Tag Link")` → Tag Link's
 *  sort_field `modified desc`, tag_link.json). */
function tagLinks(store: FixtureStore, doctype: string, name: string): Row[] {
  return [...(store.docs.get("Tag Link")?.values() ?? [])]
    .filter((r) => r.document_type === doctype && r.document_name === name)
    .sort((a, b) => Number((b as Row).__seq ?? 0) - Number((a as Row).__seq ?? 0)) as Row[];
}

/**
 * `DocTags.update` (desk/doctype/tag/tag.py:105-126): `_user_tags` = "," + unique non-empty tags joined (or ""), then
 * `update_tags(doc, tags)` (:147-176), which FIRST checks `doc.check_permission("write")` (:152 — a refusal rolls the
 * whole request back, so the `set_value` before it is undone) and syncs the Tag Link rows.
 */
function updateTags(store: FixtureStore, ctx: FixtureContext, doc: FrappeDoc, list: string[]) {
  ctx.assertDoc(doc, "write");
  const unique = [...new Set(list.filter(Boolean))];
  doc._user_tags = unique.length ? `,${unique.join(",")}` : "";
  const t = table(store, "Tag Link");
  const existing = tagLinks(store, doc.doctype, doc.name);
  for (const tag of unique.filter((x) => !existing.some((r) => r.tag === x))) {
    const { ts, seq: n } = stampOf(ctx);
    const row = { doctype: "Tag Link", name: hash(), document_type: doc.doctype, document_name: doc.name, tag, title: doc.name, owner: ctx.user, creation: ts, modified: ts, modified_by: ctx.user, docstatus: 0, idx: 0, __seq: n } as unknown as FrappeDoc;
    t.set(row.name, row);
  }
  for (const r of existing) if (!unique.includes(String(r.tag))) t.delete(String(r.name));
}
const tagsOf = (doc: FrappeDoc) => String(doc._user_tags ?? "").trim().split(",");

export const sidebarHandlers: Record<string, FixtureContextHandler> = {
  /**
   * handler.py:175-263 `upload_file`, the parts a JSON request can carry (app.py:302-314 builds `form_dict` from a JSON
   * body, so Desk's FileUploader fields work without a multipart body): `library_file_name` → read on that File
   * (:208-218, `frappe.has_permission("File", doc=…, throw=True)`), its `is_private` / `file_url` / `file_name` reused;
   * `file_url` (a web link, FileUploader.vue:547-559); then `check_write_permission(doctype, docname)` (:220-221,
   * :266-282); then a File is inserted (:250-263) — before_insert (file.py:93-104): `is_private` from a `/private` URL
   * (:811-813), `file_name` from the URL when missing, `validate_attachment_limit` (:333-350); after_insert (:126-128,
   * 793-801) adds an "Attachment" Comment to the document. Answer: the File document.
   * The binary path (`file` part) comes here through `withSimulatedSidebar`'s file server with `file_name` + `__size`
   * (no bytes are stored).
   */
  upload_file: (a, store, ctx) => {
    const doctype = a.doctype ? String(a.doctype) : "";
    const docname = a.docname ? String(a.docname) : "";
    let isPrivate = on(a.is_private) || a.is_private === "1";
    let fileUrl = a.file_url ? String(a.file_url) : "";
    let fileName = a.file_name ? String(a.file_name) : "";
    if (a.library_file_name) {
      const lib = getDoc(store, "File", a.library_file_name);
      if (!fileAllowed(store, ctx, lib, "read")) throw toFrappeError(403, { exc_type: "PermissionError", _server_messages: sm({ message: `No permission for File ${String(lib.name)}`, indicator: "red", raise_exception: 1, title: "Not Permitted" }) });
      isPrivate = on(lib.is_private); fileUrl = String(lib.file_url ?? ""); fileName = String(lib.file_name ?? "");
    }
    if (doctype && docname) {
      const target = store.docs.get(doctype)?.get(docname);
      if (target) ctx.assertDoc(target, "write");
      else ctx.assertDoctype(doctype, "write"); // a new document: `frappe.new_doc(doctype).check_permission("write")` (:276-280)
    }
    if (fileUrl) { fileUrl = decodeURI(fileUrl); isPrivate = fileUrl.startsWith("/private"); } // file.py:95, 811-813
    if (!fileName && fileUrl) fileName = decodeURIComponent(fileUrl.split("?")[0].split("/").pop() || fileUrl); // set_file_name
    if (!fileName) fail(417, "ValidationError", "Please select a file or url");
    const limit = doctype ? Number(metaOf(store, doctype)?.max_attachments ?? 0) : 0;
    if (limit && docname) {
      const count = [...(store.docs.get("File")?.values() ?? [])].filter((f) => f.attached_to_doctype === doctype && f.attached_to_name === docname).length;
      if (count >= limit) fail(417, "AttachmentLimitReached", `Maximum Attachment Limit of <strong>${limit}</strong> has been reached for ${doctype} ${docname}.`, "Attachment Limit Reached");
    }
    const { ts, seq: n } = stampOf(ctx);
    const name = hash();
    const url = fileUrl || `${isPrivate ? "/private" : ""}/files/${fileName}`;
    const file = {
      doctype: "File", name, file_name: fileName, file_url: url, is_private: isPrivate ? 1 : 0, folder: String(a.folder ?? "Home"),
      attached_to_doctype: doctype || null, attached_to_name: docname || null, attached_to_field: a.fieldname ? String(a.fieldname) : null,
      file_size: Number(a.__size ?? 0) || null, is_folder: 0, owner: ctx.user, creation: ts, modified: ts, modified_by: ctx.user, docstatus: 0, idx: 0, __seq: n,
    } as unknown as FrappeDoc;
    table(store, "File").set(name, file);
    if (doctype && docname && store.docs.get(doctype)?.get(docname)) addComment(store, ctx, doctype, docname, "Attachment", `<a href='${esc(url)}' target='_blank'>${esc(fileName)}</a>${isPrivate ? ' <i class="fa fa-lock text-warning"></i>' : ""}`);
    const { __seq: _s, ...out } = file as Row; void _s;
    return { message: out } satisfies FrappeResponse;
  },

  /**
   * desk/form/utils.py:19-23 `remove_attach` (whitelisted DELETE / POST; reads only `fid`) → `frappe.delete_doc("File",
   * fid)`: the File `delete` right (file.py:872-910 — Administrator, the file's owner, else `write` on the attached
   * document), then `on_trash` → `validate_protected_file` (:515-540: a submitted document whose DocType has
   * `protect_attached_files` keeps its files; cancelled ones only for users with `delete` on it) → an "Attachment
   * Removed" Comment (:183-190, 803-809). Answer: `{}` (the method returns None).
   */
  "frappe.desk.form.utils.remove_attach": (a, store, ctx) => {
    const file = getDoc(store, "File", a.fid);
    if (!fileAllowed(store, ctx, file, "delete")) {
      throw toFrappeError(403, { exc_type: "PermissionError", _server_messages: sm({ message: `User not allowed to delete File: ${String(file.name)}`, indicator: "red", raise_exception: 1, title: "Not Permitted" }) });
    }
    const dt = String(file.attached_to_doctype ?? ""), dn = String(file.attached_to_name ?? "");
    const ref = dt && dn ? store.docs.get(dt)?.get(dn) : undefined;
    if (ref && Number(ref.docstatus ?? 0) !== 0 && on(metaOf(store, dt)?.protect_attached_files)) {
      const mayDelete = Number(ref.docstatus) === 2 && (!ctx.permissions || ctx.permissions.hasPermission(dt, "delete", ref));
      if (!mayDelete) fail(417, "ValidationError", "This file is attached to a protected document and cannot be deleted.", "Protected File");
    }
    store.docs.get("File")!.delete(String(file.name));
    if (ref) addComment(store, ctx, dt, dn, "Attachment Removed", String(file.file_name ?? ""));
    return {};
  },

  /**
   * desk/doctype/tag/tag.py:34-39 `add_tag(tag, dt, dn)` → `DocTags.add` (:87-94): a tag not yet in `_user_tags`
   * (case-sensitive) is appended and its Tag master created (`insert(ignore_permissions=True)`), then `update` (:105-126
   * → update_tags :147-176, `write` on the document). Answer: the tag.
   */
  "frappe.desk.doctype.tag.tag.add_tag": (a, store, ctx) => {
    const tag = String(a.tag ?? "");
    const doc = getDoc(store, String(a.dt), a.dn);
    const tl = tagsOf(doc);
    if (!tl.includes(tag)) {
      tl.push(tag);
      if (!table(store, "Tag").has(tag)) { const ts = ctx.stamp(); table(store, "Tag").set(tag, { doctype: "Tag", name: tag, owner: ctx.user, creation: ts, modified: ts, modified_by: ctx.user, docstatus: 0, idx: 0 } as FrappeDoc); }
      updateTags(store, ctx, doc, tl);
    }
    return { message: tag };
  },

  /** tag.py:52-55 `remove_tag(tag, dt, dn)` → `DocTags.remove` (:96-99, case-INsensitive) → `update` (write). Answer: none. */
  "frappe.desk.doctype.tag.tag.remove_tag": (a, store, ctx) => {
    const tag = String(a.tag ?? "");
    const doc = getDoc(store, String(a.dt), a.dn);
    updateTags(store, ctx, doc, tagsOf(doc).filter((x) => x.toLowerCase() !== tag.toLowerCase()));
    return {};
  },

  /**
   * tag.py:65-70 `get_tags(doctype, txt)`: the Tag masters whose name contains `txt` (`frappe.get_list("Tag")`, then a
   * casefold filter), sorted — `doctype` is NOT used. Answer: a list of names.
   */
  "frappe.desk.doctype.tag.tag.get_tags": (a, store) => {
    const txt = String(a.txt ?? "").toLocaleLowerCase();
    const names = [...(store.docs.get("Tag")?.keys() ?? [])].filter((t) => t && t.toLocaleLowerCase().includes(txt));
    return { message: [...new Set(names)].sort() };
  },

  /**
   * core/api/file.py:65-82 `get_files_by_search_text(text)` (Desk's FileUploader "Library" search, FileBrowser.vue:120-130):
   * blank text → []; else non-folder Files whose file_name / name contains the text (or whose file_url equals it), as
   * `frappe.get_list` returns them — here the File read rule above — `modified desc`, 20 rows; fields name, file_name,
   * file_url, is_folder, modified.
   */
  "frappe.core.api.file.get_files_by_search_text": (a, store, ctx) => {
    const text = String(a.text ?? "").toLowerCase();
    if (!text) return { message: [] };
    const rows = [...(store.docs.get("File")?.values() ?? [])]
      .filter((f) => !on(f.is_folder) && (String(f.file_name ?? "").toLowerCase().includes(text) || String(f.name).toLowerCase().includes(text) || String(f.file_url ?? "").toLowerCase() === text))
      .filter((f) => fileAllowed(store, ctx, f, "read"))
      .sort((x, y) => Number((y as Row).__seq ?? 0) - Number((x as Row).__seq ?? 0) || String(y.modified ?? "").localeCompare(String(x.modified ?? "")))
      .slice(0, 20)
      .map((f) => ({ name: f.name, file_name: f.file_name, file_url: f.file_url, is_folder: 0, modified: f.modified }));
    return { message: rows };
  },
};

/** docinfo `attachments` (load.py:191-196: File rows attached to the document; fields name, file_name, file_url,
 *  is_private; File's sort_field `modified desc`, file.json) and `tags` (load.py:387-395: Tag Link tags joined by ","). */
function decorateDocinfo(store: FixtureStore, info: Row | undefined): void {
  if (!info || typeof info !== "object") return;
  const doctype = String(info.doctype ?? ""), name = String(info.name ?? "");
  if (!doctype || !name) return;
  info.attachments = [...(store.docs.get("File")?.values() ?? [])]
    .filter((f) => f.attached_to_doctype === doctype && f.attached_to_name === name)
    .sort((x, y) => Number((y as Row).__seq ?? 0) - Number((x as Row).__seq ?? 0) || String(y.modified ?? "").localeCompare(String(x.modified ?? "")))
    .map((f) => ({ name: f.name, file_name: f.file_name, file_url: f.file_url, is_private: on(f.is_private) ? 1 : 0 }));
  const links = tagLinks(store, doctype, name).map((r) => String(r.tag));
  // seeded documents without Tag Link rows: their `_user_tags`, newest (last) first
  const doc = store.docs.get(doctype)?.get(name);
  info.tags = links.length ? links.join(",") : doc ? tagsOf(doc).filter(Boolean).reverse().join(",") : "";
}

/**
 * Wrap a fixture transport so the simulated site also serves the Form Sidebar (SIMULATED): getdoc / get_docinfo answer
 * `attachments` and `tags` from the store, and the returned `files` transport stores attachments (any DocType but
 * Data Import, which keeps the base simulator's own path) through `upload_file` above. Every other call is unchanged
 * and still recorded in `store.calls`.
 *
 * P36c usergroup: a `frappe.desk.reportview.get_list` on a CHILD DocType with `parent_doctype` (Desk's "Assign To User
 * Group" members read) is answered by `childTableList` below — the base simulator keeps child rows inside their parents
 * and resolves a child's parent from `reference_doctype`, so it cannot serve that read. Recorded in `store.calls` too.
 */
export function withSimulatedSidebar(base: FixtureTransport): FixtureTransport {
  const t = (async (method: string, args: Record<string, unknown>) => {
    if (method === "frappe.desk.reportview.get_list" && args.parent_doctype && metaOf(base.store, String(args.doctype))?.istable) {
      base.store.calls.push({ method, args: JSON.parse(JSON.stringify(args)) as Record<string, unknown> });
      return JSON.parse(JSON.stringify(childTableList(base.store, base.permissions ?? null, args))) as FrappeResponse;
    }
    const res = await base(method, args);
    if (method === "frappe.desk.form.load.getdoc" || method === "frappe.desk.form.load.get_docinfo") decorateDocinfo(base.store, res.docinfo as Row | undefined);
    return res;
  }) as FixtureTransport;
  const files: FrappeFilesTransport = {
    download: (method, args) => base.files.download(method, args),
    async upload(file, filename, opts) {
      if (opts.doctype === "Data Import") return base.files.upload(file, filename, opts);
      const res = await base("upload_file", {
        file_name: filename, is_private: opts.isPrivate ? 1 : 0, folder: opts.folder ?? "Home", __size: (file as Blob).size ?? 0,
        ...(opts.doctype ? { doctype: opts.doctype } : {}), ...(opts.docname ? { docname: opts.docname } : {}),
        ...(opts.fieldname ? { fieldname: opts.fieldname } : {}), ...(opts.method ? { method: opts.method } : {}),
      });
      return (res.message ?? {}) as FrappeDoc;
    },
  };
  t.store = base.store;
  t.files = files;
  t.permissions = base.permissions;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------
// P36c usergroup — User Group / User Group Member and the child-table list read (SIMULATED)
// ---------------------------------------------------------------------------------------------------------------------

const parseArg = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const CHILD_STANDARD = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype"];

/**
 * `frappe.desk.reportview.get_list` (desk/reportview.py:38-50) for a child DocType with `parent_doctype` — what
 * `frappe.db.get_list(child, { parent_doctype, … })` sends (public/js/frappe/db.js:5-26):
 *  - permission (P on): `DatabaseQuery.execute` → `check_read_permission(child, parent_doctype)` (model/db_query.py:134-135,
 *    566-584) → `frappe.has_permission(..., throw=True)` → `has_child_permission` (permissions.py:120-121, 763-845): the
 *    parent must be a non-table DocType with a Table field of the child (:792-803), then READ on the parent DocType
 *    (:839-846; no document — row-level User Permissions on the parent are not applied by this check). A refusal is a 403
 *    "No permission for {child}" (__init__.py:1066-1072). Administrator passes (permissions.py:107-109);
 *  - rows: every child row of the parent DocType (the query has no `parenttype` condition; the parent comes from the
 *    `parent` filter), `filters` as a dict or `[field, op, value]` / `[doctype, field, op, value]` lists ("=", "!=", "in",
 *    "not in", "like"), the child's `sort_field` order (`modified desc`, user_group_member.json — equal stamps keep the
 *    stored order), `limit` / `page_length` / `limit_page_length` (db_query.py:149-157; default 20), `start`;
 *  - fields: the requested ones (unknown → 417 "Field not permitted in query", as the base simulator).
 * Not simulated: User Permissions on the child's Link fields (`add_user_permissions`), permlevel of the table field.
 */
export function childTableList(store: FixtureStore, P: PermissionEngine | null, a: Record<string, unknown>): FrappeResponse {
  const doctype = String(a.doctype ?? "");
  const parentDt = String(a.parent_doctype ?? "");
  const meta = metaOf(store, doctype);
  if (!meta) fail(404, "DoesNotExistError", `DocType ${doctype} not found`);
  const parentMeta = metaOf(store, parentDt);
  const tableFields = (parentMeta?.fields ?? []).filter((f) => ["Table", "Table MultiSelect"].includes(f.fieldtype) && f.options === doctype).map((f) => f.fieldname);
  if (P && P.user !== "Administrator") {
    // has_child_permission: an invalid parent answers False → has_permission(throw=True) raises
    if (!parentMeta || parentMeta.istable || !tableFields.length) throw permissionError(`No permission for ${doctype}`, [`${parentDt} is not a valid parent DocType for ${doctype}`]);
    P.assertDoctype(doctype, "read", { parentDoctype: parentDt });
  }
  const known = new Set([...meta.fields.map((f) => f.fieldname), ...CHILD_STANDARD]);
  const fields = (parseArg(a.fields) as string[] | undefined) ?? ["name"];
  for (const f of fields) if (!known.has(String(f).replace(/^`?tab[^`]*`?\./, "").replace(/`/g, ""))) fail(417, "DataError", `Field not permitted in query: ${f}`);
  const raw = parseArg(a.filters);
  const filters: [string, string, unknown][] = Array.isArray(raw)
    ? (raw as unknown[][]).map((f) => (f.length === 4 ? [String(f[1]), String(f[2]), f[3]] : [String(f[0]), String(f[1]), f[2]]))
    : Object.entries((raw as Row | undefined) ?? {}).map(([k, v]) => (Array.isArray(v) ? [k, String(v[0]), v[1]] : [k, "=", v]));
  const test = (row: Row, [f, op, v]: [string, string, unknown]) => {
    if (!known.has(f)) fail(417, "DataError", `Field not permitted in query: ${f}`);
    const x = row[f] == null ? "" : String(row[f]);
    const list = (Array.isArray(v) ? v : String(v ?? "").split(",")).map((y) => String(y).trim());
    switch (op.toLowerCase()) {
      case "=": return x === String(v ?? "");
      case "!=": return x !== String(v ?? "");
      case "in": return list.includes(x);
      case "not in": return !list.includes(x);
      case "like": return new RegExp(`^${String(v ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i").test(x);
      default: return fail(417, "ValidationError", `SIMULATED: operator "${op}" is not simulated on a child-table list`);
    }
  };
  let rows: Row[] = [];
  for (const p of store.docs.get(parentDt)?.values() ?? []) {
    for (const tf of tableFields) {
      ((p[tf] as Row[] | undefined) ?? []).forEach((r, i) => rows.push({
        ...r, doctype, parent: p.name, parenttype: parentDt, parentfield: tf, idx: r.idx ?? i + 1, modified: r.modified ?? p.modified, creation: r.creation ?? p.creation,
      }));
    }
  }
  rows = rows.filter((r) => filters.every((f) => test(r, f)));
  const sortField = meta.sort_field || "modified";
  const desc = String(meta.sort_order || "desc").toLowerCase() === "desc";
  rows = rows.map((r, i) => ({ r, i })).sort((x, y) => {
    const c = String(x.r[sortField] ?? "").localeCompare(String(y.r[sortField] ?? ""));
    return (desc ? -c : c) || x.i - y.i;
  }).map((x) => x.r);
  const start = Number(a.start ?? a.limit_start ?? 0) || 0;
  const limit = Number(a.limit ?? a.page_length ?? a.limit_page_length ?? 20) || 0;
  const page = limit ? rows.slice(start, start + limit) : rows.slice(start);
  return { message: page.map((r) => Object.fromEntries(fields.map((f) => { const k = String(f).replace(/^`?tab[^`]*`?\./, "").replace(/`/g, ""); return [k, r[k] ?? null]; }))) };
}

/**
 * core/doctype/user_group/user_group.json (Frappe 15.110): autoname Prompt, one Table MultiSelect `user_group_members`
 * (reqd) of "User Group Member"; DocPerms System Manager (all) and Desk User (read) — every System User reads groups.
 * `permissions` overrides the rows (e.g. a site that removed Desk User's read with the Role Permission Manager).
 */
export function userGroupMeta(permissions?: DocTypeMeta["permissions"]): DocTypeMeta {
  return {
    name: "User Group", autoname: "Prompt", sort_field: "modified", sort_order: "DESC", track_changes: 1,
    permissions: permissions ?? [
      { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, email: 1, export: 1, print: 1, report: 1, share: 1 },
      { role: "Desk User", permlevel: 0, read: 1 },
    ],
    fields: [{ fieldname: "user_group_members", fieldtype: "Table MultiSelect", label: "User Group Members", options: "User Group Member", reqd: 1 }],
  } as DocTypeMeta;
}
/** core/doctype/user_group_member/user_group_member.json: istable, `user` Link User (reqd), editable grid, modified desc. */
export const USER_GROUP_MEMBER_META: DocTypeMeta = {
  name: "User Group Member", istable: 1, sort_field: "modified", sort_order: "DESC", editable_grid: 1, permissions: [],
  fields: [{ fieldname: "user", fieldtype: "Link", label: "User", options: "User", reqd: 1, in_list_view: 1 }],
} as DocTypeMeta;

/** Metas + documents of a simulated site's User Groups: `{ "Sales Team": ["a@x.com", "b@x.com"] }`. SIMULATED. */
export function userGroupFixture(groups: Record<string, string[]>, o: { stamp?: string; permissions?: DocTypeMeta["permissions"] } = {}) {
  const ts = o.stamp ?? "2026-11-01 09:00:00.000000";
  return {
    meta: { "User Group": [userGroupMeta(o.permissions)], "User Group Member": [USER_GROUP_MEMBER_META] } as Record<string, DocTypeMeta[]>,
    docs: {
      "User Group": Object.entries(groups).map(([name, users]) => ({
        doctype: "User Group", name, owner: "Administrator", creation: ts, modified: ts, modified_by: "Administrator", docstatus: 0, idx: 0,
        user_group_members: users.map((user, i) => ({ doctype: "User Group Member", name: `${name}-${i + 1}`, user, parent: name, parenttype: "User Group", parentfield: "user_group_members", idx: i + 1, docstatus: 0, creation: ts, modified: ts })),
      })) as FrappeDoc[],
    },
  };
}
