/**
 * Workflow logic, Frappe 15.110 (docs 11 §8.5): pure functions over the Workflow definition. Nothing here calls the server.
 * Source of the definition in Desk: `getdoctype` ships `__workflow_docs` = [Workflow doc, ...Workflow State docs]
 * (desk/form/meta.py load_workflows) and `frappe.workflow.setup` reads them (model/workflow.js). There is no separate call.
 */
import type { Check, DocTypeMeta, FrappeDoc, WorkflowInfo, WorkflowState, WorkflowTransition } from "../contract";
import type { LifecycleActionItem, LifecycleStateItem, Tone } from "../../record/types";
import { styleTone } from "../services/indicator";
import { isWorkflowReadOnly } from "../services/permissions";

/** `WorkflowInfo` plus what the status indicator needs (see the report: the Lead may fold these into the contract). */
export interface RecordWorkflow extends Omit<WorkflowInfo, "states"> {
  /** Workflow.override_status: when 1 the workflow state does NOT replace the document status in the indicator. */
  override_status?: Check;
  /** Workflow.allow_self_approval is not a field in 15.110 (it is per transition); kept absent. */
  states: RecordWorkflowState[];
}
export interface RecordWorkflowState extends WorkflowState {
  /** Workflow Document State.avoid_status_override */
  avoid_status_override?: Check;
  /** Workflow State.icon */
  icon?: string;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const chk = (v: unknown): Check | undefined => (v === 1 || v === "1" || v === true ? 1 : v === 0 || v === "0" || v === false ? 0 : undefined);

/** Build the definition from `meta.__workflow_docs`; `null` when the DocType has no active workflow. */
export function workflowFromMeta(meta: Pick<DocTypeMeta, "name"> & { __workflow_docs?: unknown }): RecordWorkflow | null {
  const docs = Array.isArray(meta.__workflow_docs) ? (meta.__workflow_docs as Row[]) : [];
  const wf = docs.find((d) => d.doctype === "Workflow");
  if (!wf) return null;
  const stateDocs = new Map<string, Row>();
  for (const d of docs) if (d.doctype === "Workflow State") stateDocs.set(String(d.name ?? d.workflow_state_name), d);
  const states: RecordWorkflowState[] = ((wf.states as Row[]) ?? []).map((r) => {
    const sd = stateDocs.get(String(r.state));
    return {
      state: String(r.state), doc_status: String(r.doc_status ?? "0"), allow_edit: str(r.allow_edit), update_field: str(r.update_field),
      update_value: str(r.update_value), avoid_status_override: chk(r.avoid_status_override), style: str(sd?.style), icon: str(sd?.icon),
    };
  });
  const transitions: WorkflowTransition[] = ((wf.transitions as Row[]) ?? []).map((r) => ({
    state: String(r.state), action: String(r.action), next_state: String(r.next_state), allowed: String(r.allowed),
    allow_self_approval: chk(r.allow_self_approval), condition: str(r.condition),
  }));
  return {
    name: String(wf.name), document_type: String(wf.document_type ?? meta.name), workflow_state_field: String(wf.workflow_state_field),
    override_status: chk(wf.override_status), states, transitions,
  };
}

/** Desk `frappe.workflow.get_default_state`: the first state whose doc_status equals the docstatus. */
export function defaultState(wf: RecordWorkflow, docstatus: number | undefined): string | undefined {
  return wf.states.find((s) => Number(s.doc_status) === Number(docstatus ?? 0))?.state;
}
/** Desk `frappe.workflow.get_state`: the state field, else the default for the docstatus. */
export function currentState(wf: RecordWorkflow, doc: FrappeDoc): string | undefined {
  return str(doc[wf.workflow_state_field]) ?? defaultState(wf, doc.docstatus);
}

/** Desk `has_approval_access` (also repeated on the server in apply_workflow): Administrator, allow_self_approval, or not the owner. */
export function hasApprovalAccess(user: string, doc: Pick<FrappeDoc, "owner">, t: Pick<WorkflowTransition, "allow_self_approval">): boolean {
  return user === "Administrator" || !!t.allow_self_approval || user !== doc.owner;
}

export interface VisibleTransitionsOptions {
  /** The signed-in user (self-approval rule). Empty = unknown. */
  user: string;
  doc: FrappeDoc;
  /** The user's roles, when known (Desk's `frappe.user_roles`). */
  roles?: string[];
  /** The list IS the server's `get_transitions` answer for the session user (already filtered by state, by
   *  `frappe.get_roles()` and by condition — model/workflow.py:64-68). `useWorkflow` always passes true. */
  fromServer?: boolean;
}

/**
 * The transitions to offer as authorized actions (Desk: form/workflow.js:99-103).
 *  - Role: Desk keeps `frappe.user_roles.includes(allowed)` — applied when `roles` are known. The Administrator USER
 *    skips it: its roles are every Role (permissions.py:506-507) and `allowed` is a required Link to Role, so the server
 *    already lists every transition of the state for it (model/workflow.py:64-67) — with or without a role list (P2-4).
 *  - Approval: `has_approval_access` (model/workflow.py:221-222, re-checked by `apply_workflow` :116) — needs `user`.
 * Rule 9 (missing information denies, P2-3):
 *  - roles unknown and the list is NOT the server's answer (e.g. the definition's transitions, computed client-side):
 *    nothing — the role filter cannot be applied. With `fromServer` the server's list is authoritative: the server
 *    computed the roles itself (it is exactly the list Desk filters again with the same roles).
 *  - user unknown: only transitions with `allow_self_approval` (approval holds for anyone); the others cannot be checked.
 * `transitionsKnown` tells a UI when something was withheld for lack of information.
 */
export function visibleTransitions(transitions: WorkflowTransition[], opts: VisibleTransitionsOptions): WorkflowTransition[] {
  const admin = opts.user === "Administrator";
  if (!opts.roles && !admin && !opts.fromServer) return [];
  return transitions.filter((t) =>
    (admin || !opts.roles || opts.roles.includes(t.allowed)) && (opts.user ? hasApprovalAccess(opts.user, opts.doc, t) : !!t.allow_self_approval));
}

/** False when `visibleTransitions` had to withhold transitions for MISSING information (rule 9): no user (approval
 *  access), or no roles for a list that is not the server's answer (the Administrator needs none). Show "permissions
 *  unknown", not "no actions". */
export function transitionsKnown(opts: Pick<VisibleTransitionsOptions, "user" | "roles" | "fromServer">): boolean {
  return !!opts.user && (!!opts.roles || opts.user === "Administrator" || !!opts.fromServer);
}

/**
 * Desk `frappe.workflow.is_read_only` (model/workflow.js:53-70): the form is read-only when the user holds none of the
 * state's `allow_edit` roles. New docs are never read-only. Same rule as `isWorkflowReadOnly` (services): roles unknown →
 * read-only (rule 9, P2-3 — before dev.31 `useWorkflow` answered false); the Administrator USER never (its roles are every
 * Role, permissions.py:506-507, so it holds every `allow_edit` role — with or without a role list).
 */
export function isReadOnlyState(wf: RecordWorkflow, doc: FrappeDoc, roles: string[] | undefined, user?: string): boolean {
  return isWorkflowReadOnly(wf, doc, roles, user);
}

/** Fields that stay read-only under a workflow: the state field and every `update_field` (display-status step 6). */
export function workflowLockedFields(wf: RecordWorkflow): string[] {
  return [wf.workflow_state_field, ...wf.states.map((s) => s.update_field).filter((f): f is string => !!f)];
}

/** `can_cancel_document` (model/workflow.py:154): false when any transition leads to a docstatus-2 state. */
export function canCancelDocument(wf: RecordWorkflow): boolean {
  const cancelling = wf.states.filter((s) => String(s.doc_status) === "2").map((s) => s.state);
  if (!cancelling.length) return true;
  return !wf.transitions.some((t) => cancelling.includes(t.next_state));
}

/**
 * How an active workflow changes the toolbar (toolbar.js 593, form/workflow.js 134): Submit is never offered; Save only when dirty;
 * Cancel only if `canCancelDocument`; and when the user has workflow actions the primary/secondary buttons are replaced by the actions.
 */
export function standardActionsUnderWorkflow(wf: RecordWorkflow | null, actionsAvailable: boolean) {
  if (!wf) return { showSubmit: true, saveOnlyWhenDirty: false, showCancel: true, hidePrimaryAndSecondary: false };
  return { showSubmit: false, saveOnlyWhenDirty: true, showCancel: canCancelDocument(wf), hidePrimaryAndSecondary: actionsAvailable };
}

/** Workflow State.style → tone (indicator.js). No style → gray; Inverse (black) → neutral. */
export function toneForStyle(style: string | undefined): Tone { return styleTone(style); }

/** The ordered states for `LifecycleBar` (workflow row order, duplicates removed). */
export function lifecycleStates(wf: RecordWorkflow, translate: (s: string) => string = (s) => s): LifecycleStateItem[] {
  const seen = new Set<string>();
  const out: LifecycleStateItem[] = [];
  for (const s of wf.states) if (!seen.has(s.state)) { seen.add(s.state); out.push({ id: s.state, label: translate(s.state), tone: toneForStyle(s.style) }); }
  return out;
}
export function lifecycleActions(transitions: WorkflowTransition[], translate: (s: string) => string = (s) => s, confirm?: (t: WorkflowTransition) => boolean | string | undefined): LifecycleActionItem[] {
  const seen = new Set<string>();
  const out: LifecycleActionItem[] = [];
  for (const t of transitions) {
    if (seen.has(t.action)) continue; // two transitions with the same action from one state: the server applies the last match
    seen.add(t.action);
    out.push({ id: t.action, label: translate(t.action), confirm: confirm?.(t) });
  }
  return out;
}
