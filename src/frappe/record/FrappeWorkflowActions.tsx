import * as React from "react";
import { LifecycleBar, type LifecycleBarProps } from "../../record/LifecycleBar";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeDoc } from "../contract";
import type { RecordClient } from "./data";
import { useWorkflow } from "./useWorkflow";
import { lifecycleActions, lifecycleStates } from "./workflow";

export interface FrappeWorkflowActionsProps extends Pick<LifecycleBarProps, "variant" | "currentMarker" | "actionLabels" | "className"> {
  doc: FrappeDoc;
  user: string;
  roles?: string[];
  client?: RecordClient;
  /** Server labels → translations (`translateLabel(bundle, text)`); default identity. */
  translate?: (text: string) => string;
  /** Ask before applying: `true` for every action, or a predicate (Desk applies immediately). Default: no confirmation. */
  confirm?: boolean | ((action: string) => boolean);
  /** Called with the document the server returned (after the cache was updated). */
  onApplied?: (doc: FrappeDoc, action: string) => void;
  /** Rendered instead of nothing when the DocType has no workflow. */
  fallback?: React.ReactNode;
}

/**
 * Workflow state + the actions the user may apply (Desk’s Actions menu). Renders nothing for new documents or DocTypes without a workflow.
 * For unsaved documents the actions are disabled with the reason (Desk hides them; `apply_workflow` discards unsaved edits).
 */
export function FrappeWorkflowActions({ doc, user, roles, client, translate = (s) => s, confirm, onApplied, fallback = null, variant = "compact", ...rest }: FrappeWorkflowActionsProps) {
  const { t } = useLocale();
  const w = useWorkflow({ doc, user, roles, client });
  if (doc.__islocal) return <>{fallback}</>;
  if (w.isLoading && !w.workflow) return <Skeleton className="h-8 w-40" />;
  if (!w.workflow) return <>{fallback}</>;
  const states = lifecycleStates(w.workflow, translate);
  const actions = lifecycleActions(w.transitions, translate, (tr) => (typeof confirm === "function" ? confirm(tr.action) : confirm));
  return (
    <LifecycleBar
      {...rest} variant={variant} states={states} current={w.state} currentLabel={w.state ? translate(w.state) : undefined}
      actions={actions} busy={w.applying}
      actionsDisabled={w.needsSave} actionsDisabledReason={w.needsSave ? t("recSaveBeforeAction") : undefined}
      onAction={async (a) => { const saved = await w.apply(a.id); onApplied?.(saved, a.id); }}
    />
  );
}
