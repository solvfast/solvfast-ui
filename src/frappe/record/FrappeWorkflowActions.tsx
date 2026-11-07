import * as React from "react";
import { LifecycleBar, type LifecycleBarProps } from "../../record/LifecycleBar";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, FrappeDoc } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { useRecordDocInfo } from "./data";
import { stateEntries } from "./stateHistory";
import { useWorkflow } from "./useWorkflow";
import { lifecycleActions, lifecycleStates } from "./workflow";

export interface FrappeWorkflowActionsProps extends Pick<LifecycleBarProps, "variant" | "currentMarker" | "actionLabels" | "className" | "showCurrentEntry"> {
  doc: FrappeDoc;
  user: string;
  roles?: string[];
  /** Server labels → translations (`translateLabel(bundle, text)`); default identity. */
  translate?: (text: string) => string;
  /** Ask before applying: `true` for every action, or a predicate (Desk applies immediately). Default: no confirmation. */
  confirm?: boolean | ((action: string) => boolean);
  /** Called with the document the server returned (after the cache was updated). */
  onApplied?: (doc: FrappeDoc, action: string) => void;
  /** Page-held docinfo; otherwise fetched (steps variant only: it supplies actor and time per state). */
  docinfo?: DocInfo;
  /** Rendered instead of nothing when the DocType has no workflow. */
  fallback?: React.ReactNode;
  /** Runs before `apply_workflow` (Desk form/workflow.js:96-108: `check_mandatory`, then `before_workflow_action`);
   *  false (or a throw) stops the action — nothing is sent. FrappeForm supplies it. */
  beforeApply?: (action: string) => boolean | Promise<boolean>;
  /** Runs after the server applied the action and `onApplied` ran (Desk: `after_workflow_action`). */
  afterApply?: (action: string, doc: FrappeDoc) => void | Promise<void>;
}

/**
 * Workflow state + the actions the user may apply (Desk’s Actions menu). Renders nothing for new documents or DocTypes without a workflow.
 * For unsaved documents the actions are disabled with the reason (Desk hides them; `apply_workflow` discards unsaved edits).
 * The actions are the server's `get_transitions` answer (authoritative, `useWorkflow`). When it cannot be had, the state
 * stays visible and the reason is shown instead of an empty Actions slot (rule 9, P2-3): the error (`FrappeErrorState`,
 * Retry for transient kinds) when the call failed; the "Read only" notice marked `data-permissions="unknown"` when the
 * user is unknown (only `allow_self_approval` transitions can then be offered). A refused `apply_workflow` (403
 * `PermissionError`, `WorkflowTransitionError`, self-approval) is shown by the action bar; nothing is applied locally.
 */
export function FrappeWorkflowActions({ doc, user, roles, translate = (s) => s, confirm, onApplied, beforeApply, afterApply, fallback = null, variant = "compact", docinfo, ...rest }: FrappeWorkflowActionsProps) {
  const { t } = useLocale();
  const w = useWorkflow({ doc, user, roles });
  const info = useRecordDocInfo(variant === "steps" && !doc.__islocal ? doc.doctype : undefined, doc.name, docinfo);
  if (doc.__islocal) return <>{fallback}</>;
  if (w.isLoading && !w.workflow) return <Skeleton className="h-8 w-40" />;
  if (!w.workflow) return <>{fallback}</>;
  const base = lifecycleStates(w.workflow, translate);
  const entries = variant === "steps" ? stateEntries({ doc, docinfo: info.data, stateField: w.workflow.workflow_state_field, states: base.map((b) => b.id), translate }) : undefined;
  const states = entries ? base.map((b) => ({ ...b, by: entries.get(b.id)?.by, at: entries.get(b.id)?.at })) : base;
  const actions = lifecycleActions(w.transitions, translate, (tr) => (typeof confirm === "function" ? confirm(tr.action) : confirm));
  const bar = (
    <LifecycleBar
      {...rest} variant={variant} states={states} current={w.state} currentLabel={w.state ? translate(w.state) : undefined}
      actions={actions} busy={w.applying}
      actionsDisabled={w.needsSave} actionsDisabledReason={w.needsSave ? t("recSaveBeforeAction") : undefined}
      onAction={async (a) => {
        if (beforeApply) {
          let go = false;
          try { go = await beforeApply(a.id); } catch { go = false; }
          if (!go) return;
        }
        const saved = await w.apply(a.id);
        onApplied?.(saved, a.id);
        await afterApply?.(a.id, saved);
      }}
    />
  );
  if (w.error) {
    return (
      <div className="flex flex-col gap-2" data-workflow-actions="unavailable">
        {bar}
        <FrappeErrorState error={w.error} compact onRetry={w.refetchTransitions} />
      </div>
    );
  }
  if (!w.transitionsKnown && !w.isLoading && !w.needsSave) {
    return (
      <div className="flex flex-col gap-2" data-workflow-actions="unknown">
        {bar}
        <p role="status" data-permissions="unknown" className="text-xs text-muted-foreground">{t("formReadOnly")}</p>
      </div>
    );
  }
  return bar;
}
