/**
 * SIMULATED handlers added by the P36 batch-2 "social" workstream (Share, Like, Comments). Each handler cites the Frappe
 * 15.110 source of its response shape (paths relative to `apps/frappe/frappe/`). They reproduce REQUEST and RESPONSE
 * SHAPES and the server's decisions as far as the simulator can evaluate them:
 *  - rights go through the transport's own SIMULATED permission engine (`ctx.permissions`, ../permissions.ts) when
 *    `createFixtureTransport(…, { permissions })` is used; without it nothing is refused (the historical simulator);
 *  - DocShare rows live in the store's "DocShare" table, the same rows the permission engine reads (`docinfo.shared`,
 *    shared rights) and the transport's own `assign_to` share writes;
 *  - notifications are only RECORDED as "Notification Log" rows (nothing is sent, no e-mail, no realtime); Document
 *    Follow (`follow_shared_documents`, `follow_commented_documents`) is not simulated.
 *
 * `frappe.desk.form.utils.add_comment` overrides the transport's built-in one (it is spread after the built-ins): same
 * store writes (`store.comments`, the parent's `_comments`), plus the @mention Notification Log rows.
 */
import { toFrappeError } from "../../client";
import type { FrappeDoc, PermType } from "../../contract";
import type { FixtureContext, FixtureContextHandler, FixtureStore } from "../fixtureTransport";
import { permissionError } from "../permissions";

type Row = Record<string, unknown>;
const sm = (...messages: Row[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));
function fail(status: number, exc_type: string, message: string): never {
  throw toFrappeError(status, { exc_type, _server_messages: sm({ message, indicator: "red", raise_exception: 1 }) });
}
const cint = (v: unknown): number => { const n = parseInt(String(v ?? 0), 10); return Number.isNaN(n) ? (v === true ? 1 : 0) : n; };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const hash = () => { let s = ""; while (s.length < 10) s += Math.random().toString(36).slice(2); return s.slice(0, 10); };
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
/** `frappe.utils.get_fullname` (utils/__init__.py) from the simulator's User rows. */
const fullName = (store: FixtureStore, u: unknown) => {
  const ud = store.docs.get("User")?.get(String(u ?? ""));
  const composed = [ud?.first_name, ud?.middle_name, ud?.last_name].filter((x) => typeof x === "string" && x.trim()).join(" ");
  return String(ud?.full_name || composed || u || "");
};
/** `get_title` (notification_log.py:63-66): the title field's value, else the name. */
const titleOf = (store: FixtureStore, doctype: string, name: string) => {
  const tf = store.meta[doctype]?.[0]?.title_field;
  const v = tf ? store.docs.get(doctype)?.get(name)?.[tf] : undefined;
  return String(v || name);
};

/** A comment row on the referenced document (`doc.add_comment`, model/document.py), as the transport stores them. */
function addComment(store: FixtureStore, ctx: FixtureContext, doctype: string, name: string, type: string, content: string, extra: Row = {}): Row {
  const c: Row = { doctype: "Comment", name: hash(), comment_type: type, reference_doctype: doctype, reference_name: name, content, owner: ctx.user, creation: ctx.stamp(), comment_email: ctx.user, published: 0, ...extra };
  store.comments.set(String(c.name), c);
  return c;
}

/**
 * `make_notification_logs` (desk/doctype/notification_log/notification_log.py:100-117): one "Notification Log" per
 * enabled user, never to the sender (`for_user != from_user`). SIMULATED: only stored — no e-mail, no realtime.
 */
function notify(store: FixtureStore, ctx: FixtureContext, users: string[], doc: Row) {
  const known = store.docs.get("User");
  for (const u of [...new Set(users)].filter(Boolean)) {
    const ud = known?.get(u);
    if (known?.size && (!ud || Number(ud.enabled ?? 1) === 0)) continue;
    if (u === doc.from_user) continue;
    const ts = ctx.stamp();
    const row = { doctype: "Notification Log", name: hash(), for_user: u, read: 0, owner: ctx.user, creation: ts, modified: ts, modified_by: ctx.user, docstatus: 0, idx: 0, ...doc } as unknown as FrappeDoc;
    table(store, "Notification Log").set(row.name, row);
  }
}

/** `extract_mentions` (desk/notifications.py:425-440): `span.mention[data-id]`; `data-is-group="true"` → the User Group's members. */
export function extractMentions(store: FixtureStore, html: string): string[] {
  const out: string[] = [];
  const re = /<span\b[^>]*class="[^"]*\bmention\b[^"]*"[^>]*>/gi;
  for (const m of html.match(re) ?? []) {
    const id = /data-id="([^"]*)"/i.exec(m)?.[1];
    if (!id) continue;
    if (/data-is-group="true"/i.test(m)) {
      const g = store.docs.get("User Group")?.get(id);
      for (const r of ((g?.user_group_members as Row[] | undefined) ?? [])) if (r.user) out.push(String(r.user));
      continue;
    }
    out.push(id.replace(/&amp;/g, "&"));
  }
  return out;
}

const RIGHTS = ["read", "write", "submit", "share"] as const;
type Right = (typeof RIGHTS)[number];

/** `check_share_permission` (share.py:216-244): the `share` right first, then each of read / write / submit being granted. */
function checkSharePermission(store: FixtureStore, ctx: FixtureContext, doctype: string, name: string, permissions: Partial<Record<Right, unknown>> | null) {
  const doc = getDoc(store, doctype, name);
  const P = ctx.permissions;
  if (P && !P.hasPermission(doctype, "share", doc)) throw permissionError(undefined, [`No permission to share ${doctype} ${name}`], true);
  if (!permissions || !P) return;
  for (const ptype of ["read", "write", "submit"] as const) {
    if (cint(permissions[ptype]) && !P.hasPermission(doctype, ptype as PermType, doc)) {
      throw permissionError(undefined, [`You cannot share \`${ptype}\` on ${doctype} \`${name}\` as you do not have \`${ptype}\` permission on \`${doctype}\``], true);
    }
  }
}

/** `get_share_name` (share.py:203-213): the everyone row, else the user's row. */
const shareRow = (store: FixtureStore, doctype: string, name: string, user: unknown, everyone: unknown) =>
  [...(store.docs.get("DocShare")?.values() ?? [])].find((s) => s.share_doctype === doctype && String(s.share_name) === name && (cint(everyone) ? cint(s.everyone) === 1 : s.user === user));

/** DocShare.validate (core/doctype/docshare/docshare.py:33-69): user mandatory, share right, submittable, cascade. */
function validateShare(store: FixtureStore, ctx: FixtureContext, s: Row, ignoreSharePermission = false) {
  if (cint(s.everyone)) s.user = null;
  else if (!s.user) fail(417, "MandatoryError", "User is mandatory for Share");
  const doc = getDoc(store, String(s.share_doctype), s.share_name);
  if (!ignoreSharePermission && ctx.permissions && !ctx.permissions.hasPermission(String(s.share_doctype), "share", doc)) throw permissionError(undefined, ['You need to have "Share" permission'], true);
  if (cint(s.submit) && !cint(store.meta[String(s.share_doctype)]?.[0]?.is_submittable)) {
    fail(417, "ValidationError", `Cannot share <strong>${String(s.share_name)}</strong> with submit permission as the doctype <strong>${String(s.share_doctype)}</strong> is not submittable`);
  }
  // cascade_permissions_downwards (:40-44)
  if (cint(s.share) || cint(s.write) || cint(s.submit)) s.read = 1;
  if (cint(s.submit)) s.write = 1;
}

/** `add_docshare` (share.py:36-72) + DocShare insert / save (after_insert "Shared" comment, docshare.py:71-80) + notify (:247-268). */
function addDocshare(store: FixtureStore, ctx: FixtureContext, doctype: string, name: string, a: { user?: unknown; write?: unknown; submit?: unknown; share?: unknown; everyone?: unknown; notify?: unknown }, skipCheck = false): Row {
  const user = a.user ? String(a.user) : ctx.user;
  const perms = { read: 1, write: cint(a.write), submit: cint(a.submit), share: cint(a.share) }; // "always add read, since you are adding!"
  if (!skipCheck) checkSharePermission(store, ctx, doctype, name, perms);
  const existing = shareRow(store, doctype, name, user, a.everyone);
  const ts = ctx.stamp();
  const row: Row = existing
    ? { ...existing }
    : { doctype: "DocShare", name: hash(), owner: ctx.user, creation: ts, docstatus: 0, idx: 0, user, share_doctype: doctype, share_name: name, everyone: cint(a.everyone), notify_by_email: 1 };
  Object.assign(row, perms, { modified: ts, modified_by: ctx.user });
  validateShare(store, ctx, row);
  table(store, "DocShare").set(String(row.name), row as unknown as FrappeDoc);
  if (!existing) {
    const by = fullName(store, row.owner);
    addComment(store, ctx, doctype, name, "Shared", cint(row.everyone) ? `${by} shared this document with everyone` : `${by} shared this document with ${fullName(store, row.user)}`);
  }
  // notify_assignment (:247-268): not for everyone, only with notify
  if (!cint(a.everyone) && cint(a.notify)) {
    notify(store, ctx, [user], {
      type: "Share", document_type: doctype, document_name: name, from_user: ctx.user,
      subject: `<strong>${fullName(store, ctx.user)}</strong> shared a document <strong>${doctype}</strong> <b class="subject-title">${titleOf(store, doctype, name)}</b> with you`,
    });
  }
  return row;
}

const publicRow = (r: Row) => clone(r);

export const socialHandlers: Record<string, FixtureContextHandler> = {
  /**
   * share.py:125-152 `get_users(doctype, name)`: `frappe.get_doc` (404 when missing), `[]` WITHOUT read (no error,
   * :135-136), else the DocShare rows of the document: name, user, read, write, submit, share, everyone, owner, creation.
   */
  "frappe.share.get_users": (a, store, ctx) => {
    const doctype = String(a.doctype ?? "");
    const doc = getDoc(store, doctype, a.name);
    const P = ctx.permissions;
    if (P) return { message: P.docShares(doc) };
    const rows = [...(store.docs.get("DocShare")?.values() ?? [])].filter((s) => s.share_doctype === doctype && String(s.share_name) === String(doc.name));
    return { message: rows.map((s) => ({ name: s.name, user: s.user ?? null, read: cint(s.read), write: cint(s.write), submit: cint(s.submit), share: cint(s.share), everyone: cint(s.everyone), owner: s.owner ?? "Administrator", creation: s.creation ?? null })) };
  },

  /**
   * share.py:20-33 `add(doctype, name, user, read, write, submit, share, everyone, notify)` → `add_docshare` (:36-72):
   * read is always 1; `check_share_permission` (:216-244: 403 "No permission to share …" without the share right — the
   * engine also refuses it when sharing is disabled, permissions.py:111-113 —, 403 when granting read / write / submit
   * the sharer lacks); one row per user (or the everyone row) updated in place; DocShare.validate (docshare.py:33-69:
   * MandatoryError, ValidationError "…is not submittable", cascade share/write/submit ⇒ read, submit ⇒ write); a
   * "Shared" comment on insert (:71-80); a Share Notification Log for the user when `notify` (share.py:247-268).
   * Answers the DocShare document (`doc.as_dict()`).
   */
  "frappe.share.add": (a, store, ctx) => {
    const doctype = String(a.doctype ?? "");
    const name = String(a.name ?? "");
    return { message: publicRow(addDocshare(store, ctx, doctype, name, a)) };
  },

  /**
   * share.py:82-122 `set_permission(doctype, name, user, permission_to, value=1, everyone=0)`: `check_share_permission`
   * with `{permission_to: value}` only when value is set (:90-92); no row → `add_docshare(…, permission_to=1)` (value 1)
   * or nothing (value 0); else the right is set, un-setting `read` un-sets every right (:113-114), the row is saved
   * (DocShare.validate: cascade) and DELETED when no right is left (:118-120; DocShare.on_trash: share right, an
   * "Unshared" comment, docshare.py:82-91). Answers the DocShare document, or nothing (`None` → no `message`,
   * handler.py:56-62) when there is no row left.
   */
  "frappe.share.set_permission": (a, store, ctx) => {
    const doctype = String(a.doctype ?? "");
    const name = String(a.name ?? "");
    const right = String(a.permission_to ?? "") as Right;
    if (!RIGHTS.includes(right)) fail(417, "ValidationError", `SIMULATED: unknown share right ${right}`);
    const value = cint(a.value ?? 1);
    checkSharePermission(store, ctx, doctype, name, value ? { [right]: value } : null);
    const existing = shareRow(store, doctype, name, a.user, a.everyone);
    if (!existing) {
      if (!value) return {};
      return { message: publicRow(addDocshare(store, ctx, doctype, name, { user: a.user, everyone: a.everyone, [right]: 1 }, true)) };
    }
    const row: Row = { ...existing, [right]: value, modified: ctx.stamp(), modified_by: ctx.user };
    if (!value && right === "read") Object.assign(row, { read: 0, write: 0, submit: 0, share: 0 });
    validateShare(store, ctx, row, true);
    if (!(cint(row.read) || cint(row.write) || cint(row.submit) || cint(row.share))) {
      // DocShare.on_trash (docshare.py:82-91): the share right again, then the "Unshared" comment
      validateShare(store, ctx, { ...row, read: 0 }, false);
      store.docs.get("DocShare")!.delete(String(row.name));
      addComment(store, ctx, doctype, name, "Unshared", `${fullName(store, row.owner)} un-shared this document with ${fullName(store, row.user)}`);
      return {};
    }
    table(store, "DocShare").set(String(row.name), row as unknown as FrappeDoc);
    return { message: publicRow(row) };
  },

  /**
   * desk/form/utils.py:26-50 `add_comment(reference_doctype, reference_name, content, comment_email, comment_by)`: READ on
   * the reference document (`check_permission`, :31-32), a "Comment" inserted with `ignore_permissions` (:45); then
   * Comment.after_insert (core/doctype/comment/comment.py:58-60) → `notify_mentions` (desk/notifications.py:390-422):
   * one "Mention" Notification Log per mentioned enabled user (group mentions → the User Group's members), never to the
   * author; Comment.on_update keeps the parent's `_comments` (comment.py:112-150, the last 100, truncated at 100 chars).
   * Answers the Comment document. SIMULATED: content is not sanitised (comment.py:62-67), images are not extracted.
   */
  "frappe.desk.form.utils.add_comment": (a, store, ctx) => {
    const doctype = String(a.reference_doctype ?? "");
    const name = String(a.reference_name ?? "");
    const ref = getDoc(store, doctype, name);
    ctx.assertDoc(ref, "read");
    const content = String(a.content ?? "");
    const c = addComment(store, ctx, doctype, name, "Comment", content, { comment_email: a.comment_email || ctx.user, comment_by: a.comment_by || ctx.user });
    const list = ((): Row[] => { try { const v = JSON.parse(String(ref._comments ?? "[]")); return Array.isArray(v) ? v : []; } catch { return []; } })();
    list.push({ comment: content.length > 100 ? `${content.slice(0, 97)}...` : content, by: ctx.user, name: c.name });
    ref._comments = JSON.stringify(list.slice(-100));
    const mentions = extractMentions(store, content);
    if (mentions.length) {
      notify(store, ctx, mentions, {
        type: "Mention", document_type: doctype, document_name: name, from_user: ctx.user, email_content: content,
        subject: `<strong>${fullName(store, ctx.user)}</strong> mentioned you in a comment in <strong>${doctype}</strong> <b class="subject-title">${titleOf(store, doctype, name)}</b>`,
      });
    }
    return { message: clone(c) };
  },

  /**
   * desk/form/utils.py:72-79 `update_comment_publicity(name, publish)`: only the author or a System Manager (else a
   * ValidationError "Comment publicity can only be updated by the original author or a System Manager." — `frappe.throw`
   * without an exception class); `published` set. Answers nothing.
   */
  "frappe.desk.form.utils.update_comment_publicity": (a, store, ctx) => {
    const c = store.comments.get(String(a.name ?? "")) ?? fail(404, "DoesNotExistError", `Comment ${String(a.name ?? "")} not found`);
    // `frappe.get_roles()` (permissions.py:497-528): the engine's evaluated roles; without permissions every role
    const sysManager = ctx.user === "Administrator" || !ctx.permissions || ctx.permissions.rolesOf(ctx.user).includes("System Manager");
    if (ctx.user !== c.owner && !sysManager) fail(417, "ValidationError", "Comment publicity can only be updated by the original author or a System Manager.");
    const publish = a.publish === true || a.publish === 1 || a.publish === "1" || a.publish === "true";
    c.published = publish ? 1 : 0;
    return {};
  },
};
