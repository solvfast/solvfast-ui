/**
 * Bulk-action contracts of the Desk list (docs 13 §3). Server methods, not UI: delete (`reportview.delete_items`),
 * submit / cancel / edit (`bulk_update.submit_cancel_or_update_docs`), assign (`assign_to.add_multiple`), clear
 * assignment (`assign_to.remove_multiple`), apply assignment rule (`assignment_rule.bulk_apply`), add tags
 * (`tag.add_tags`). Print lives in `print.ts`, workflow approval in `workflowBulk.ts`. The server enforces permissions
 * per document where it checks them at all; the guards here only reproduce Desk's menu (client-side) and never replace them.
 */
import type { FrappeClient } from "../client";
import type { PermType } from "../contract";

/** The 0.4.0-dev.26 actions (kept as is: apps key records by it). */
export type BulkKind = "edit" | "submit" | "cancel" | "assign" | "delete";
/**
 * Every item of Desk's Actions menu (`list_view.js:1855-2128`), named after `BulkOperations` (`bulk_operations.js`), plus
 * `"workflow"`: the workflow's transition actions (`:1802-1853`), which the SERVER picks when the menu opens.
 */
export type ListActionKind = BulkKind | "export" | "clear_assignment" | "assignment_rule" | "add_tags" | "print" | "workflow";
const BULK_KINDS: readonly string[] = ["edit", "submit", "cancel", "assign", "delete"];
export const isBulkKind = (k: ListActionKind): k is BulkKind => BULK_KINDS.includes(k);
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
  /** The host renders Export (it owns the dialog). Desk pushes Export unconditionally (`list_view.js:2092`). */
  exportable?: boolean;
}

/**
 * Which actions the Actions menu offers, IN DESK'S ORDER (`list_view.js:2088-2128`): Edit, Export, Assign To, Clear
 * Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete, then the workflow's actions (`"workflow"`,
 * `:163-168`, see `workflowBulk.ts`). Everything except Export is denied without permissions.
 */
export function listActionsMenu(i: BulkMenuInput): ListActionKind[] {
  const editAllowed = i.hasEditableFields && (!i.hasWorkflow || i.allowEdit);
  const out: ListActionKind[] = [];
  if (editAllowed && can(i.permissions, "write")) out.push("edit");
  // Export: no client check in Desk (list_view.js:2092) — owner decision Phase 27 #1; the server refuses (exporter.py:116-126)
  if (i.exportable) out.push("export");
  // Desk offers "Assign To" unconditionally (list_view.js:2095); the server requires READ on each document
  // (assign_to.add → doc.check_permission(), default ptype "read": assign_to.py:67-68, document.py:225). The package
  // asks for read (Phase 26 rule D.1: hide what the server would refuse; nothing is offered without permissions).
  if (can(i.permissions, "read")) out.push("assign");
  // Clear Assignment / Apply Assignment Rule / Add Tags: Desk offers them unconditionally (list_view.js:2097-2101) and the
  // server checks no permission on these paths (remove_multiple with Desk's ignore_permissions: assign_to.py:182-192,
  // 206-207; bulk_apply: assignment_rule.py:231-245; add_tags: tag.py:42-49). The package applies the Assign To
  // precedent: offered with READ on the DocType, so nothing is offered while the rights are unknown (rule 9).
  if (can(i.permissions, "read")) out.push("clear_assignment", "assignment_rule", "add_tags");
  // Print: `frappe.model.can_print(doctype)` = the level-0 `print` right (model.js:452-455; list_view.js:2104-2106)
  if (can(i.permissions, "print")) out.push("print");
  if (i.isSubmittable && !i.hasWorkflow && can(i.permissions, "submit")) out.push("submit");
  if (i.isSubmittable && !i.hasWorkflow && can(i.permissions, "cancel")) out.push("cancel");
  if ((!i.hasWorkflow || i.allowEdit) && can(i.permissions, "delete")) out.push("delete");
  // Workflow items come last (set_actions_menu_items concatenates them, list_view.js:163-168). Desk adds them for every
  // user; the server computes the actions for the session user and checks READ on each document (workflow.py:38-72,
  // 332-353). The package asks for read like the other read-level actions (rule 9).
  if (i.hasWorkflow && can(i.permissions, "read")) out.push("workflow");
  return out;
}

/** `listActionsMenu` restricted to the five `BulkKind`s (Edit, Assign To, Submit, Cancel, Delete), in Desk's order. */
export function bulkMenu(i: BulkMenuInput): BulkKind[] {
  return listActionsMenu(i).filter(isBulkKind);
}

export interface BulkOutcome {
  /** Documents the server reported as failed. */
  failed: string[];
  /** The server queued the job (no result list): the outcome arrives by realtime, not in this response. */
  queued: boolean;
  /**
   * The server's answer carries no per-document result (remove_multiple, bulk_apply, add_tags, bulk_workflow_approval;
   * delete_items too, though `bulkDelete` keeps its dev.26 shape): `failed: []` then means "not reported", never "none
   * failed" — say "N requested", not a count.
   */
  silent?: boolean;
}

const json = (v: unknown) => JSON.stringify(v);

/** `delete_items`: more than 10 are enqueued by the server; it answers nothing either way — failures arrive as a REALTIME
 *  msgprint ("Failed to delete {0} documents: {1}", reportview.py:608-616), so `failed: []` here means "not reported in the
 *  response", never "none failed". `FrappeBulkActions` says so instead of counting successes. */
export async function bulkDelete(client: FrappeClient, doctype: string, names: string[]): Promise<BulkOutcome> {
  await client.call("frappe.desk.reportview.delete_items", { doctype, items: json(names) });
  // unchanged shape since dev.26 (no `silent`): the UI treats "delete" as silent by kind
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

/**
 * Clear Assignment, exactly as Desk sends it (`bulk_operations.js:243-262`): `assign_to.remove_multiple` with
 * `ignore_permissions: true`. Server facts (`assign_to.py:182-192`): for each name it cancels the open ToDos returned by
 * `get` — at most 5 per document (`get … limit=5`, `:25-38`) — and, because Desk passes `ignore_permissions`, `set_status`
 * skips `check_permission` (`:206-207`): the server performs NO permission check on this path. An exception rolls the
 * whole request back. The answer is empty (`silent`).
 */
export async function bulkClearAssignment(client: FrappeClient, doctype: string, names: string[]): Promise<BulkOutcome> {
  await client.call("frappe.desk.form.assign_to.remove_multiple", { doctype, names: json(names), ignore_permissions: true });
  return { failed: [], queued: false, silent: true };
}

/**
 * Apply Assignment Rule (`bulk_operations.js:264-273`): `assignment_rule.bulk_apply(doctype, docnames)`. More than 5
 * names are enqueued one job per document (`assignment_rule.py:231-245`, `background = len(docnames) > 5`); the answer is
 * empty either way, and a DocType without an enabled rule is a silent no-op (`apply :283-296`). No permission check.
 */
export async function bulkApplyAssignmentRule(client: FrappeClient, doctype: string, names: string[]): Promise<BulkOutcome> {
  await client.call("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", { doctype, docnames: json(names) });
  return { failed: [], queued: names.length > 5, silent: true };
}

/**
 * Add Tags (`bulk_operations.js:425-461`): `tag.add_tags(tags, dt, docs)` — every tag on every document; a Tag master
 * that does not exist yet is created (`tag.py:87-94`). No permission check on the server (`DocTags.update` →
 * `db.set_value`, `:105-116`). The answer is empty (`silent`).
 */
export async function bulkAddTags(client: FrappeClient, doctype: string, names: string[], tags: string[]): Promise<BulkOutcome> {
  await client.call("frappe.desk.doctype.tag.tag.add_tags", { tags: json(tags), dt: doctype, docs: json(names) });
  return { failed: [], queued: false, silent: true };
}
