import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappeKeys, type FrappeDoc, type LoadedDoc, type WorkflowTransition } from "../contract";
import { requireClientMethod, useRecordClient, useRecordMeta, type RecordClient } from "./data";
import {
  currentState, isReadOnlyState, standardActionsUnderWorkflow, visibleTransitions, workflowFromMeta, type RecordWorkflow,
} from "./workflow";

export interface UseWorkflowOptions {
  doc?: FrappeDoc;
  /** Signed-in user id (for the self-approval rule). */
  user: string;
  /** The user's roles, when known: adds Desk's `frappe.user_roles.includes(allowed)` check and the read-only state test. */
  roles?: string[];
  client?: RecordClient;
  /** Skip the workflow query (the DocType is known not to have one). */
  enabled?: boolean;
}

/** The workflow definition of a DocType: `client.getWorkflow` when the foundation provides it, else `meta.__workflow_docs`. */
export function useWorkflowDefinition(doctype: string | undefined, client?: RecordClient, enabled = true) {
  const c = useRecordClient(client);
  const hasGet = typeof c.getWorkflow === "function";
  const metaQ = useRecordMeta(c, hasGet ? undefined : doctype);
  const direct = useQuery<RecordWorkflow | null, Error>({
    queryKey: doctype ? frappeKeys.workflow(doctype) : ["sf-frappe", "workflow", "none"],
    queryFn: async () => (await c.getWorkflow!(doctype!)) as RecordWorkflow | null,
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
 */
export function useWorkflow({ doc, user, roles, client, enabled = true }: UseWorkflowOptions) {
  const c = useRecordClient(client);
  const qc = useQueryClient();
  const doctype = doc?.doctype;
  const def = useWorkflowDefinition(doctype, c, enabled);
  const wf = def.workflow;
  const saved = !!doc && !doc.__islocal && !doc.__unsaved;
  const state = wf && doc ? currentState(wf, doc) : undefined;

  const trQ = useQuery<WorkflowTransition[], Error>({
    queryKey: ["sf-frappe", "workflow-transitions", doctype, doc?.name, state, doc?.modified],
    queryFn: () => requireClientMethod(c, "getWorkflowTransitions")(doc!),
    enabled: enabled && !!wf && saved,
  });

  const mutation = useMutation<FrappeDoc, Error, string>({
    mutationFn: (action) => requireClientMethod(c, "applyWorkflow")(doc!, action),
    onSuccess: (saved_) => {
      // contract rule: workflow action → set `doc`, invalidate docinfo, list, count
      qc.setQueryData<LoadedDoc | undefined>(frappeKeys.doc(saved_.doctype, saved_.name), (old) => (old ? { ...old, doc: saved_ } : old));
      void qc.invalidateQueries({ queryKey: frappeKeys.docinfo(saved_.doctype, saved_.name) });
      void qc.invalidateQueries({ queryKey: frappeKeys.list(saved_.doctype) });
      void qc.invalidateQueries({ queryKey: frappeKeys.count(saved_.doctype) });
      void qc.invalidateQueries({ queryKey: ["sf-frappe", "workflow-transitions", saved_.doctype, saved_.name] });
    },
  });

  const transitions = React.useMemo(
    () => (wf && doc && saved ? visibleTransitions(trQ.data ?? [], { user, doc, roles }) : []),
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
    readOnly: wf && doc && roles ? isReadOnlyState(wf, doc, roles) : false,
    standardActions: standardActionsUnderWorkflow(wf, transitions.length > 0),
    apply: mutation.mutateAsync,
    applying: mutation.isPending,
  };
}
