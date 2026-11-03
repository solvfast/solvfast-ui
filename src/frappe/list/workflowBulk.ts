/**
 * Workflow bulk approval of the Desk list (`list_view.js:1802-1853`). When the DocType has an active Workflow, Desk adds
 * the workflow's actions to the Actions menu (`get_workflow_action_menu_items`, appended after the standard items by
 * `set_actions_menu_items :163-179`) and, every time the menu opens (`show.bs.dropdown`, `:1426-1428`), asks the server
 * which of them apply to EVERY checked document (`toggle_workflow_actions :1831-1853` →
 * `frappe.model.workflow.get_common_transition_actions`). Choosing one calls `bulk_workflow_approval`.
 *
 * The server decides everything for the session user (`model/workflow.py:332-353`): transitions whose `allowed` role the
 * user has and whose condition holds (`get_transitions :38-72`, which also checks READ on each document), minus
 * self-approval (`has_approval_access :221-222`, owner taken from the doc dict the client sent). No client role check.
 */
import type { FrappeClient } from "../client";
import type { BulkOutcome } from "./bulk";

export const WORKFLOW_BULK_METHODS = {
  commonActions: "frappe.model.workflow.get_common_transition_actions",
  approve: "frappe.model.workflow.bulk_workflow_approval",
} as const;

/** `bulk_workflow_approval` runs fewer than 20 documents in the request, enqueues up to 500, refuses more (`workflow.py:237-253`). */
export const WORKFLOW_BULK_SYNC_BELOW = 20;
export const WORKFLOW_BULK_MAX = 500;

/**
 * `get_common_transition_actions(docs, doctype)`: the actions every document allows. `docs` are the checked ROWS, as Desk
 * sends `get_checked_items()` (row objects, `list_view.js:1838-1842`): the server reloads each from the database
 * (`get_transitions` → `load_from_db`) but reads `owner` from the row for the self-approval rule — rows must carry it.
 * The first document without a workflow state ends the scan with what was common so far (`WorkflowStateError` is
 * swallowed, `:350-351`). An empty answer → offer nothing.
 */
export async function commonTransitionActions(client: FrappeClient, doctype: string, docs: Array<Record<string, unknown>>): Promise<string[]> {
  const res = await client.call(WORKFLOW_BULK_METHODS.commonActions, { docs: JSON.stringify(docs), doctype });
  return Array.isArray(res.message) ? res.message.map(String) : [];
}

/**
 * `bulk_workflow_approval(docnames, doctype, action)` (`list_view.js:1813-1820`). Below 20 the server applies the action
 * in this request, but the per-document result ("Workflow Status" with failed / successful transactions) is sent as a
 * REALTIME msgprint (`print_workflow_log … realtime=True`, `:309-328`), not in the response — `silent`. 20–500: enqueued,
 * with an alert "Bulk {action} is enqueued in background." in `_server_messages` — `queued`. More than 500: the server
 * throws "Bulk approval only support up to 500 documents." (a FrappeError for the caller to show).
 */
export async function bulkWorkflowApproval(client: FrappeClient, doctype: string, names: string[], action: string): Promise<BulkOutcome> {
  await client.call(WORKFLOW_BULK_METHODS.approve, { docnames: JSON.stringify(names), doctype, action });
  return { failed: [], queued: names.length >= WORKFLOW_BULK_SYNC_BELOW, silent: true };
}

/** The checked rows as Desk sends them; a selected name whose row is not loaded is sent as `{ name }`. */
export function workflowDocs<T>(keys: string[], rows: T[], rowKey: (row: T) => string = (r) => String((r as { name?: unknown }).name)): Array<Record<string, unknown>> {
  const byKey = new Map(rows.map((r) => [rowKey(r), r as unknown as Record<string, unknown>]));
  return keys.map((k) => byKey.get(k) ?? { name: k });
}
