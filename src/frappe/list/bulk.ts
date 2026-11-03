/**
 * Bulk-action contracts of the Desk list (docs 13 §3). Server methods, not UI: delete (`reportview.delete_items`),
 * submit / cancel / edit (`bulk_update.submit_cancel_or_update_docs`), assign (`assign_to.add_multiple`). The server
 * enforces permissions per document; the guards here only reproduce Desk's menu (client-side) and never replace them.
 */
import type { FrappeClient } from "../client";
import type { PermType } from "../contract";

export type BulkKind = "delete" | "submit" | "cancel" | "edit" | "assign";
/** Rights of the user on the DocType: a map (`DocPermissions[0]`) or A1's `can()`. */
export type BulkPermissions = Partial<Record<PermType, boolean>> | ((ptype: PermType) => boolean);
const can = (p: BulkPermissions | undefined, t: PermType) => !!p && (typeof p === "function" ? p(t) : !!p[t]);

export interface BulkMenuInput {
  permissions: BulkPermissions | undefined;
  isSubmittable: boolean;
  /** The DocType has a Workflow: Desk then hides Edit / Delete / Submit / Cancel (docs 13 §12, C06) … */
  hasWorkflow: boolean;
  /** … unless List View Settings `allow_edit` is set (Edit and Delete only). */
  allowEdit: boolean;
  hasEditableFields: boolean;
}

/** Which actions the Actions menu offers (`list_view.js:1855-2128`). Everything is denied without permissions. */
export function bulkMenu(i: BulkMenuInput): BulkKind[] {
  const editAllowed = i.hasEditableFields && (!i.hasWorkflow || i.allowEdit);
  const out: BulkKind[] = [];
  if (editAllowed && can(i.permissions, "write")) out.push("edit");
  if (i.isSubmittable && !i.hasWorkflow && can(i.permissions, "submit")) out.push("submit");
  if (i.isSubmittable && !i.hasWorkflow && can(i.permissions, "cancel")) out.push("cancel");
  if (can(i.permissions, "write")) out.push("assign"); // UNVERIFIED: Desk offers "Assign To" to every user; the server checks each document
  if ((!i.hasWorkflow || i.allowEdit) && can(i.permissions, "delete")) out.push("delete");
  return out;
}

export interface BulkOutcome {
  /** Documents the server reported as failed. */
  failed: string[];
  /** The server queued the job (no result list): the outcome arrives by realtime, not in this response. */
  queued: boolean;
}

const json = (v: unknown) => JSON.stringify(v);

/** `delete_items`: more than 10 are enqueued by the server; it answers nothing either way (results come as a msgprint). */
export async function bulkDelete(client: FrappeClient, doctype: string, names: string[]): Promise<BulkOutcome> {
  await client.call("frappe.desk.reportview.delete_items", { doctype, items: json(names) });
  return { failed: [], queued: names.length > 10 };
}

/**
 * `submit_cancel_or_update_docs`: the response is the list of failed names; for 20–500 submit/cancel documents the server
 * enqueues and returns nothing (`queued`). UNVERIFIED at runtime (read from bulk_update.py).
 */
export async function bulkSubmitCancelOrUpdate(client: FrappeClient, doctype: string, names: string[], action: "submit" | "cancel" | "update", data?: Record<string, unknown>): Promise<BulkOutcome> {
  const res = await client.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", {
    doctype, docnames: json(names), action, ...(data ? { data: json(data) } : {}),
  });
  return Array.isArray(res.message) ? { failed: res.message.map(String), queued: false } : { failed: [], queued: res.message === undefined || res.message === null };
}

export interface BulkAssignOptions { description?: string; priority?: "Low" | "Medium" | "High"; date?: string }

/** `assign_to.add_multiple`, as the list's Assign To dialog calls it (`bulk_assign` and `re_assign` set). */
export async function bulkAssign(client: FrappeClient, doctype: string, names: string[], users: string[], o: BulkAssignOptions = {}): Promise<BulkOutcome> {
  await client.call("frappe.desk.form.assign_to.add_multiple", {
    doctype, name: json(names), assign_to: json(users), bulk_assign: true, re_assign: true,
    ...(o.description ? { description: o.description } : {}), ...(o.priority ? { priority: o.priority } : {}), ...(o.date ? { date: o.date } : {}),
  });
  return { failed: [], queued: false };
}
