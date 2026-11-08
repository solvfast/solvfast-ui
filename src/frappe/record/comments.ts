/**
 * Comments (P36b social) — who may do what with a form comment in Frappe 15.110 Desk, and the method names. Pure.
 *
 * - Add: anyone who can READ the document (desk/form/utils.py:26-50 `add_comment`, `check_permission()` = read); Desk's
 *   comment box is always there on a saved document (footer.js:21-58, 65-72).
 * - Edit: the author or the Administrator only (form_timeline.js:654-663; utils.py:53-69 `update_comment` refuses
 *   anyone else with PermissionError "Comment can only be edited by the owner", then checks read on the document).
 * - Delete: (author OR System Manager) AND `frappe.model.can_delete("Comment")` (form_timeline.js:614-620); the Comment
 *   DocType grants delete to System Manager and Website Manager only (core/doctype/comment/comment.json permissions),
 *   so an author without one of those roles cannot delete their own comment. Request: `frappe.client.delete
 *   {doctype: "Comment", name}` after "Delete comment?" (form_timeline.js:723-733).
 * - Publish / Unpublish: author or System Manager (form_timeline.js:614, 620-625; utils.py:72-79).
 * - Comments are NOT paginated: docinfo carries every Comment of the document (load.py:152-156, `frappe.get_all`
 *   without a limit). Only communications page ("Load more", load.py:108 limit 21 / form_timeline.js:193-223 —
 *   `useCommunications`).
 * - @mentions: `span.mention[data-id]` (and `data-is-group="true"` for a User Group) in the content; the server notifies
 *   the mentioned users after insert (comment.py:58-60 → desk/notifications.py:390-440).
 */
import type { FrappeSession } from "../services/permissions";

export const ADD_COMMENT_METHOD = "frappe.desk.form.utils.add_comment";
export const UPDATE_COMMENT_METHOD = "frappe.desk.form.utils.update_comment";
export const COMMENT_PUBLICITY_METHOD = "frappe.desk.form.utils.update_comment_publicity";
/** Roles with `delete` on Comment in the standard comment.json (a site may customise them — pass `canDeleteComment`). */
export const COMMENT_DELETE_ROLES: readonly string[] = ["System Manager", "Website Manager"];

export interface CommentRights {
  isSystemManager: boolean;
  /** `frappe.model.can_delete("Comment")`. */
  canDeleteComment: boolean;
}

/** The session's comment rights (Desk: `frappe.user.has_role("System Manager")`, boot `can_delete`). Without roles
 *  nothing is granted (rule 9) except to the Administrator user (every role, permissions.py:506-507). */
export function commentRights(session: FrappeSession | undefined, override?: Partial<CommentRights>): CommentRights {
  const admin = session?.user === "Administrator";
  const roles = session?.roles ?? [];
  return {
    isSystemManager: override?.isSystemManager ?? (admin || roles.includes("System Manager")),
    canDeleteComment: override?.canDeleteComment ?? (admin || roles.some((r) => COMMENT_DELETE_ROLES.includes(r))),
  };
}

/** Publish / Unpublish is offered to the author or a System Manager (form_timeline.js:614). */
export const canPublishComment = (owner: string | undefined, user: string | undefined, rights: CommentRights) => !!user && (owner === user || rights.isSystemManager);

/** `frappe.desk.search.get_names_for_mentions` (desk/search.py) → mention options, as Desk's comment box loads them. */
export function mentionSearchWith(api: { call: (method: string, args: Record<string, unknown>) => Promise<{ message?: unknown }> }) {
  return async (term: string): Promise<Array<{ id: string; label: string; isGroup: boolean }>> => {
    const res = await api.call("frappe.desk.search.get_names_for_mentions", { search_term: term });
    return ((res.message as Array<Record<string, unknown>> | undefined) ?? []).map((r) => ({ id: String(r.id), label: String(r.value ?? r.id), isGroup: !!r.is_group }));
  };
}
