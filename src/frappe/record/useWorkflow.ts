import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { frappeKeys, type FrappeDoc, type WorkflowTransition } from "../contract";
import { useDocAction } from "../hooks";
import { useRecordApi, useRecordMeta } from "./data";
import {
  currentState, isReadOnlyState, standardActionsUnderWorkflow, transitionsKnown, visibleTransitions, workflowFromMeta, type RecordWorkflow,
} from "./workflow";

export interface UseWorkflowOptions {
  doc?: FrappeDoc;
  /** Signed-in user id (for the self-approval rule). Empty = unknown: only `allow_self_approval` transitions are offered
   *  and `transitionsKnown` is false. */
  user: string;
  /** The user's roles, when known: adds Desk's `frappe.user_roles.includes(allowed)` check and the read-only state test
   *  (without them a saved doc is read-only — rule 9; the transitions stay the server's `get_transitions` answer). */
  roles?: string[];
  /** Skip the workflow query (the DocType is known not to have one). */
  enabled?: boolean;
}

/** The workflow definition of a DocType: `client.getWorkflow` when the foundation provides it, else `meta.__workflow_docs`. */
export function useWorkflowDefinition(doctype: string | undefined, enabled = true) {
  const c = useRecordApi();
  const hasGet = typeof c.getWorkflow === "function";
  const metaQ = useRecordMeta(hasGet ? undefined : doctype);
  const direct = useQuery<RecordWorkflow | null, Error>({
    queryKey: doctype ? frappeKeys.workflow(doctype) : ["sf-frappe", "workflow", "none"],
    queryFn: async () => (await c.getWorkflow(doctype!)) as RecordWorkflow | null,
    enabled: enabled && !!doctype && hasGet,
    staleTime: 5 * 60_000,
  });
  if (hasGet) return { workflow: direct.data ?? null, isLoading: direct.isLoading, error: direct.error };
  const fromMeta = metaQ.data ? workflowFromMeta(metaQ.data.meta) : null;
  return { workflow: fromMeta, isLoading: metaQ.isLoading, error: metaQ.error };
}

/**
 * Workflow for one document: definition, the transitions the user may apply now, `apply`, read-only state, and how the standard
 * Submit / Save / Cancel buttons change. Transitions are fetched only for saved, clean documents (form/workflow.js:76).
 * The transitions are ALWAYS the server's `get_transitions` answer (read-checked, role- and condition-filtered for the
 * session user, model/workflow.py:52, :64-68) — authoritative even when `roles` are unknown (P2-3); Desk's client filters
 * are applied on top (`visibleTransitions`). No transitions are computed from the definition here. When the answer is not
 * available (`error`) or the user is unknown, `transitionsKnown` is false and the UI says so instead of showing nothing.
 */
export function useWorkflow({ doc, user, roles, enabled = true }: UseWorkflowOptions) {
  const c = useRecordApi();
  const actions = useDocAction();
  const doctype = doc?.doctype;
  const def = useWorkflowDefinition(doctype, enabled);
  const wf = def.workflow;
  const saved = !!doc && !doc.__islocal && !doc.__unsaved;
  const state = wf && doc ? currentState(wf, doc) : undefined;

  const trQ = useQuery<WorkflowTransition[], Error>({
    queryKey: ["sf-frappe", "workflow-transitions", doctype, doc?.name, state, doc?.modified],
    queryFn: () => c.getWorkflowTransitions(doc!),
    enabled: enabled && !!wf && saved,
  });

  const transitions = React.useMemo(
    () => (wf && doc && saved ? visibleTransitions(trQ.data ?? [], { user, doc, roles, fromServer: true }) : []),
    [wf, doc, saved, trQ.data, user, roles],
  );
  return {
    workflow: wf,
    isLoading: def.isLoading || (saved && !!wf && trQ.isLoading),
    error: (def.error ?? trQ.error) as Error | null,
    state,
    transitions,
    /** Unsaved edits: Desk shows no workflow actions until the form is saved (`apply_workflow` reloads the doc from the DB). */
    needsSave: !!doc && !doc.__islocal && !!doc.__unsaved,
    /** Desk's workflow read-only state; without roles a saved doc is read-only (rule 9, P2-3), never for the Administrator. */
    readOnly: wf && doc ? isReadOnlyState(wf, doc, roles, user) : false,
    /** False when the actions could not be established: the server's answer failed (`error`) or the user is unknown. */
    transitionsKnown: transitionsKnown({ user, roles, fromServer: true }) && !trQ.error,
    /** Ask the server for the transitions again (after an error). */
    refetchTransitions: () => void trQ.refetch(),
    standardActions: standardActionsUnderWorkflow(wf, transitions.length > 0),
    // useDocAction().applyWorkflow sets the BARE doc under frappeKeys.doc and invalidates docinfo / list / count (A1, services/cache.ts)
    apply: (action: string) => actions.applyWorkflow.mutateAsync({ doc: doc!, action }),
    applying: actions.applyWorkflow.isPending,
  };
}
