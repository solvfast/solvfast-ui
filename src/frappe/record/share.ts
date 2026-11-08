/**
 * Document sharing (P36b social) — the request shapes of Frappe 15.110 `frappe/share.py` as Desk sends them
 * (`public/js/frappe/form/sidebar/share.js`) and the pure rules around them. No React, no network.
 *
 * Server methods (whitelisted): `get_users(doctype, name)` (share.py:125-152), `add(doctype, name, user, read, write,
 * submit, share, everyone, notify)` (:20-33), `set_permission(doctype, name, user, permission_to, value, everyone)`
 * (:82-85). `share.remove` is NOT whitelisted (:75): Desk removes a share by un-ticking "Can Read" (set_permission
 * read 0 → every right cleared and the row deleted, :111-120).
 */
import type { ShareEntry, ShareRight, ShareRights } from "../../record/ShareDialog";
import type { UserInfo } from "../contract";

export const SHARE_GET_USERS_METHOD = "frappe.share.get_users";
export const SHARE_ADD_METHOD = "frappe.share.add";
export const SHARE_SET_PERMISSION_METHOD = "frappe.share.set_permission";

/** A DocShare row as `get_users` / `docinfo.shared` list it (share.py:138-152) or `add` / `set_permission` answer it. */
export interface DocShareRow {
  name: string;
  user: string | null;
  read?: number | boolean;
  write?: number | boolean;
  submit?: number | boolean;
  share?: number | boolean;
  everyone?: number | boolean;
  owner?: string;
  creation?: string;
  [key: string]: unknown;
}

const on = (v: unknown) => v === true || v === 1 || v === "1";

/** `frappe.model.can_share(null, frm)` (model.js:462-473): `frm.perm[0].share`, and never when the site disables
 *  document sharing (System Settings `disable_document_sharing`) unless the user is the Administrator. */
export function canShareDocument(opts: { share: boolean; user?: string; sharingDisabled?: boolean }): boolean {
  if (opts.sharingDisabled && opts.user !== "Administrator") return false;
  return opts.share;
}

/** `share.add` arguments exactly as share.js:129-141 sends them (`notify: 1` always). */
export function shareAddArgs(doctype: string, name: string, user: string, rights: ShareRights): Record<string, unknown> {
  return { doctype, name, user, read: rights.read ? 1 : 0, write: rights.write ? 1 : 0, submit: rights.submit ? 1 : 0, share: rights.share ? 1 : 0, notify: 1 };
}

/** `share.set_permission` arguments as share.js:168-177 sends them (the everyone row: `user` "" and `everyone` 1). */
export function setPermissionArgs(doctype: string, name: string, entry: Pick<ShareEntry, "user" | "everyone">, right: ShareRight, value: boolean): Record<string, unknown> {
  return { doctype, name, user: entry.user ?? "", permission_to: right, value: value ? 1 : 0, everyone: entry.everyone ? 1 : 0 };
}

/** Normalise the server rows (drops empties, as `shared.filter(Boolean)` in share.js:14). */
export function shareRows(raw: unknown): DocShareRow[] {
  return (Array.isArray(raw) ? raw : []).filter((r): r is DocShareRow => !!r && typeof r === "object" && "name" in (r as object));
}

/**
 * The dialog's list after an answer, as share.js does it: `add` (:142-153) drops the user's old row and appends the
 * answer; `set_permission` (:178-200) replaces the matching row (the user's, or the everyone row), removes it when the
 * server answered nothing (the row was deleted), or appends the answer when there was no row.
 */
export function mergeShareAnswer(rows: DocShareRow[], target: { user: string | null; everyone?: boolean }, answer: DocShareRow | null | undefined, mode: "add" | "set"): DocShareRow[] {
  const match = (s: DocShareRow) => (target.everyone ? on(s.everyone) : !on(s.everyone) && s.user === target.user);
  if (mode === "add") {
    if (!answer) return rows;
    return [...rows.filter((s) => !(!on(s.everyone) && s.user === answer.user)), answer];
  }
  const i = rows.findIndex(match);
  if (i < 0) return answer ? [...rows, answer] : rows;
  if (!answer) return rows.filter((_, n) => n !== i);
  return rows.map((s, n) => (n === i ? { ...s, ...answer } : s));
}

/** DocShare rows → the dialog's entries (names / images from `docinfo.user_info` when known). */
export function shareEntries(rows: DocShareRow[], userInfo?: Record<string, UserInfo>): ShareEntry[] {
  return rows.map((s) => {
    const user = s.user ?? null;
    const info = user ? userInfo?.[user] : undefined;
    return {
      id: String(s.name), user, everyone: on(s.everyone), read: on(s.read), write: on(s.write), submit: on(s.submit), share: on(s.share),
      label: user ? info?.fullname || user : undefined, image: info?.image ?? null,
    };
  });
}
