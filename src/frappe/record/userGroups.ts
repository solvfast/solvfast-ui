/**
 * P36c usergroup — Desk's "Assign To User Group" (Frappe 15.110, paths under `apps/frappe/frappe/`):
 *  - the field: `{ label: "Assign To User Group", fieldtype: "Link", options: "User Group", onchange: user_group_list }`
 *    (public/js/frappe/form/sidebar/assign_to.js:191-197) — its search is the Link control's `search_link` on "User Group";
 *  - the expansion: `frappe.db.get_list("User Group Member", { parent_doctype: "User Group", filters: { parent: group },
 *    fields: ["user"] })` (assign_to.js:148-158) → `frappe.desk.reportview.get_list` with `limit: 20` added by
 *    `frappe.db.get_list` (public/js/frappe/db.js:5-26), which `DatabaseQuery.execute` maps to `limit_page_length`
 *    (model/db_query.py:153-157): a group's FIRST 20 members, as Desk reads them;
 *  - the server's check: `check_read_permission("User Group Member", parent_doctype="User Group")` (db_query.py:134-135,
 *    566-584) → `has_child_permission` → read on User Group (permissions.py:120-121, 763-845); User Group grants read to
 *    "System Manager" and "Desk User" (core/doctype/user_group/user_group.json), the role every System User holds
 *    (permissions.py:32, 516-523). A refusal is a 403 "No permission for User Group Member" (__init__.py:1066-1072).
 * The members are NOT filtered (disabled users and users already assigned are kept): the server answers duplicates with
 * "Already in the following Users ToDo list" (desk/form/assign_to.py:58-66, 135-137).
 */
import type { AssignGroupSource } from "../../record/AssignDialog";
import type { UserOption } from "../../record/types";
import type { FrappeClient } from "../client";

export const USER_GROUP_DOCTYPE = "User Group";
export const USER_GROUP_MEMBER_DOCTYPE = "User Group Member";
/** core/doctype/user_group/user_group.json: the Table MultiSelect of "User Group Member" rows. */
export const USER_GROUP_MEMBERS_FIELD = "user_group_members";
/** What `frappe.db.get_list` calls (db.js:18). */
export const USER_GROUP_MEMBERS_METHOD = "frappe.desk.reportview.get_list";
/** `frappe.db.get_list`'s default `limit` (db.js:13-15). */
export const USER_GROUP_MEMBERS_LIMIT = 20;

const json = (v: unknown) => JSON.stringify(v);

/** The request Desk sends for a group's members (assign_to.js:149-154 + db.js:9-15). */
export function userGroupMembersArgs(group: string): Record<string, unknown> {
  return {
    doctype: USER_GROUP_MEMBER_DOCTYPE, parent_doctype: USER_GROUP_DOCTYPE,
    filters: json({ parent: group }), fields: json(["user"]), limit: USER_GROUP_MEMBERS_LIMIT,
  };
}

/** A group's member user ids, in the server's order (`response.map((m) => m.user)`, assign_to.js:156). */
export async function getUserGroupMembers(client: Pick<FrappeClient, "call">, group: string): Promise<string[]> {
  const res = await client.call(USER_GROUP_MEMBERS_METHOD, userGroupMembersArgs(group));
  const rows = Array.isArray(res.message) ? (res.message as Array<{ user?: unknown }>) : [];
  return rows.map((r) => (r && r.user != null ? String(r.user) : "")).filter(Boolean);
}

/** The groups the Link field lists (`search_link` on "User Group", the Link control's default query). */
export async function searchUserGroups(client: Pick<FrappeClient, "searchLink">, txt: string) {
  return (await client.searchLink(USER_GROUP_DOCTYPE, txt, { pageLength: 10 })).map((r) => ({ value: r.value, label: r.label || r.value, description: r.description || undefined }));
}

/**
 * The `AssignDialog` `groups` source over a Frappe client. Members come back as user ids (Desk's pills show the id unless the
 * user is among the search results, multiselect_pills.js:89-103); `userLabel` may name them from data the host already has.
 */
export function userGroupSource(client: Pick<FrappeClient, "call" | "searchLink">, o: { label?: string; userLabel?: (user: string) => string | undefined } = {}): AssignGroupSource {
  return {
    ...(o.label ? { label: o.label } : {}),
    search: (txt) => searchUserGroups(client, txt),
    members: async (group): Promise<UserOption[]> => (await getUserGroupMembers(client, group)).map((id) => ({ id, label: o.userLabel?.(id) || id })),
  };
}
