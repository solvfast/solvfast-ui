import * as React from "react";
import { LifecycleBar, type LifecycleBarProps } from "../../record/LifecycleBar";
import { LifecycleRail, type LifecycleRailLabels, type LifecycleRailNext, type LifecycleRailStep } from "../../record/LifecycleRail";
import type { LifecycleActionItem, LifecycleStep } from "../../record/types";
import type { ActionBarLabels } from "../../record/ActionBar";
import { errorText, fmt } from "../../record/format";
import { Skeleton } from "../../primitives/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../primitives/alert-dialog";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, FrappeDoc } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { useRecordDocInfo } from "./data";
import { stateEntries } from "./stateHistory";
import { useWorkflow } from "./useWorkflow";
import { lifecycleActions, lifecycleStates, workflowLifecycle } from "./workflow";
import { LifecycleActions } from "../../record/LifecycleActions";
import { lifecycleNext } from "../../record/lifecycle";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { useMetaBundle } from "../hooks/useDoc";
import { useFrappeApi } from "../FrappeProvider";
import { useFrappeTranslate } from "../services/useTranslate";
import { useFormServices } from "../form/services";
import { checkMandatory, type MandatoryLine } from "../form/model/mandatory";
import { missingLineText } from "../form/missingLines";
import type { FormController } from "../form/events";

export interface FrappeWorkflowActionsProps extends Pick<LifecycleBarProps, "currentMarker" | "actionLabels" | "className" | "showCurrentEntry"> {
  /** `compact` = state badge + Actions menu (Desk's form toolbar); `actions` = the Actions menu alone (LifecycleActions:
   *  a record page header's menu; blocked with a reason while the document is unsaved or `blockedReason` is set);
   *  `rail` = the record's Lifecycle card (LifecycleRail: the states it went through with who · when, where it can go
   *  next, End of lifecycle) — read-only unless `applyFromRail`; `steps` = **deprecated** (0.8.0-dev.5): LifecycleBar's
   *  stepper with the menu inside it — use `actions` in the header with `rail` (kept for existing code). */
  variant?: LifecycleBarProps["variant"] | "rail" | "actions";
  /** `rail`: its ways forward are buttons that apply the transition (the 0.8.0-dev.1–dev.4 rail). Default false: a
   *  read-only rail showing every state the workflow leads to from here (whoever may perform it), the transitions
   *  being run from the Actions menu (`variant="actions"`). */
  applyFromRail?: boolean;
  /** `actions`: the menu is unavailable for a reason the page knows (e.g. unsaved changes on the page). */
  blockedReason?: string;
  /** `actions`: the blocked button's leading icon. */
  blockedIcon?: React.ComponentType<{ className?: string }>;
  /** `rail`: shows "View full lifecycle" (e.g. to open a LifecycleDiagramDialog). */
  onViewAll?: () => void;
  /** `rail`: the rail's chrome strings (default from the ThemeProvider's language). */
  railLabels?: LifecycleRailLabels;
  doc: FrappeDoc;
  user: string;
  roles?: string[];
  /** Server labels → translations. Default (Run 1 D-54): the provider's translations (Desk `__(action)` /
   *  `__(state)`, form/workflow.js:77-104); before, identity — Arabic users saw English workflow actions. */
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
  /** Run 1 (D-55 / K1): the form whose document this is (`FrappeFormView controllerRef`). The action then runs Desk's
   *  sequence on it (form/workflow.js:96-121): `frm.selectedWorkflowAction` → `check_mandatory` (Missing Fields) →
   *  `before_workflow_action` (false stops it) → `apply_workflow` → `after_workflow_action`. Ignored when `beforeApply`
   *  is given (FrappeForm wires its own). A ref is read when the action runs. */
  frm?: FormController | null | React.RefObject<FormController | null>;
  /** Run 1 (D-55 / K1): without `frm` and `beforeApply`, the DocType's meta is loaded and its mandatory fields
   *  (`reqd`, `mandatory_depends_on`; child rows too) are checked on `doc` before `apply_workflow` — a missing one opens
   *  Desk's Missing Fields dialog and nothing is sent (the server does not check `mandatory_depends_on`). Default true;
   *  false skips the check (the host checks itself). When the meta cannot be loaded the action proceeds (the server
   *  still checks `reqd`). */
  checkMandatory?: boolean;
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
let warnedSteps = false;

export function FrappeWorkflowActions({ doc, user, roles, translate: translateProp, confirm, onApplied, beforeApply, afterApply, fallback = null, variant = "compact", docinfo, onViewAll, railLabels, applyFromRail = false, blockedReason, blockedIcon, frm, checkMandatory: mandatoryCheck = true, ...rest }: FrappeWorkflowActionsProps) {
  const { t, language } = useLocale();
  const trProvider = useFrappeTranslate();
  const translate = translateProp ?? ((x: string) => trProvider(x, null));
  if (variant === "steps" && !warnedSteps) {
    warnedSteps = true;
    console.warn('[@solvfast/ui/frappe] FrappeWorkflowActions variant="steps" is deprecated (0.8.0-dev.5): use variant="actions" in the header and variant="rail" for the Lifecycle card.');
  }
  const w = useWorkflow({ doc, user, roles });
  const withHistory = variant === "steps" || variant === "rail";
  const info = useRecordDocInfo(withHistory && !doc.__islocal ? doc.doctype : undefined, doc.name, docinfo);
  const formOf = (): FormController | null => (frm && "current" in frm ? frm.current : (frm as FormController | null | undefined) ?? null);
  const ownCheck = !beforeApply && !frm && mandatoryCheck && !doc.__islocal;
  const bundle = useMetaBundle(ownCheck ? doc.doctype : undefined);
  const services = useFormServices();
  const api = useFrappeApi();
  const [missing, setMissing] = React.useState<MandatoryLine[] | null>(null);
  if (doc.__islocal) return <>{fallback}</>;
  if (w.isLoading && !w.workflow) return <Skeleton className="h-8 w-40" />;
  if (!w.workflow) return <>{fallback}</>;
  const base = lifecycleStates(w.workflow, translate);
  const entries = withHistory ? stateEntries({ doc, docinfo: info.data, stateField: w.workflow.workflow_state_field, states: base.map((b) => b.id), translate }) : undefined;
  // Run 1 D-62: the (deprecated) stepper ticks only the states the record actually entered (workflow logs / versions);
  // a state before the current one that it never entered is "skipped" (a branching workflow: Rejected does not tick
  // Approved). Without any history the order decides, as before.
  const curIdx = base.findIndex((b) => b.id === w.state);
  const stepFor = (id: string, i: number): LifecycleStep | undefined => {
    if (variant !== "steps" || !entries || entries.size === 0 || id === w.state) return undefined;
    if (entries.has(id)) return "past";
    return curIdx >= 0 && i < curIdx ? "skipped" : "future";
  };
  const states = entries ? base.map((b, i) => ({ ...b, by: entries.get(b.id)?.by, at: entries.get(b.id)?.at, step: stepFor(b.id, i) ?? b.step })) : base;
  const actions = lifecycleActions(w.transitions, translate, (tr) => (typeof confirm === "function" ? confirm(tr.action) : confirm));
  const runAction = async (actionId: string) => {
    const form = beforeApply ? null : formOf();
    if (beforeApply) {
      let go = false;
      try { go = await beforeApply(actionId); } catch { go = false; }
      if (!go) return;
    } else if (form) {
      // Desk form/workflow.js:96-108 on the host's form
      form.selectedWorkflowAction = actionId;
      let go = false;
      try { go = form.checkMandatory() && (await form.trigger("before_workflow_action")); } catch { go = false; }
      if (!go) { form.selectedWorkflowAction = null; return; }
    } else if (ownCheck) {
      // the meta may still be loading when the user acts: read it now (the server still checks `reqd` if it fails)
      const b = bundle.data ?? (await api.getMetaBundle(doc.doctype).catch(() => undefined));
      if (b) {
        const check = checkMandatory(b, doc, { ...services.evaluator, translate: (l) => services.translate(b, l) });
        if (!check.ok) { setMissing(check.lines); return; }
      }
    }
    const saved = await w.apply(actionId);
    onApplied?.(saved, actionId);
    await afterApply?.(actionId, saved);
    if (form) { form.selectedWorkflowAction = null; await form.trigger("after_workflow_action"); }
  };
  if (variant === "actions") {
    const blocked = blockedReason ?? (w.needsSave ? t("recSaveBeforeAction") : undefined);
    return wrapStatus(
      <LifecycleActions actions={actions.map((a) => ({ id: a.id, label: a.label, confirm: a.confirm }))} onAction={runAction}
        blockedReason={blocked} blockedIcon={blockedIcon} busy={w.applying} labels={rest.actionLabels} className={rest.className} />,
    );
  }
  if (variant === "rail") {
    // The record's path: the states it entered, oldest first (workflow logs / versions), ending with the current state.
    const visited = [...(entries ?? new Map()).entries()].sort((a, b) => a[1].at - b[1].at).map(([id]) => id).filter((id) => id !== w.state);
    const pathIds = [...visited, ...(w.state ? [w.state] : [])];
    const day = new Intl.DateTimeFormat(language, { month: "short", day: "numeric" });
    const full = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
    const path: LifecycleRailStep[] = pathIds.map((id) => {
      const e = entries?.get(id);
      return { id, label: base.find((b) => b.id === id)?.label ?? translate(id), meta: e ? `${e.by} · ${day.format(e.at)}` : undefined, metaTitle: e ? `${e.by} · ${full.format(e.at)}` : undefined };
    });
    if (!applyFromRail) {
      // Read-only (default): where the workflow goes from here — every transition out of the state, whoever may run it
      // (lifecycleNext), once per target state; a target already on the path is a move back. End of lifecycle: none.
      const next = lifecycleNext(workflowLifecycle(w.workflow, translate), w.state, pathIds)
        .map((n): LifecycleRailNext => ({ id: n.id, label: n.label, back: n.back }));
      return (
        <div className={rest.className} data-workflow-actions="rail">
          <LifecycleRail path={path} next={next} ended={next.length === 0} onViewAll={onViewAll} labels={railLabels} />
        </div>
      );
    }
    // Ways forward: the server's transitions for this user (one per action), named by the state they lead to.
    const byAction = new Map(w.transitions.map((tr) => [tr.action, tr]));
    const targets = [...byAction.values()].map((tr) => tr.next_state);
    const next: LifecycleRailNext[] = [...byAction.values()].map((tr) => ({
      id: tr.action,
      label: targets.filter((x) => x === tr.next_state).length > 1 ? `${translate(tr.action)} → ${translate(tr.next_state)}` : translate(tr.next_state),
      back: pathIds.slice(0, -1).includes(tr.next_state),
      disabled: w.needsSave || w.applying,
      disabledReason: w.needsSave ? t("recSaveBeforeAction") : undefined,
    }));
    // End of lifecycle: no transition leaves this state for anyone (not just "none for this user").
    const ended = !w.workflow.transitions.some((tr) => tr.state === w.state);
    const railEl = (
      <RailActions path={path} next={next} ended={ended && !w.needsSave} actions={actions} onRun={runAction}
        note={w.needsSave ? t("recSaveBeforeAction") : undefined} viewAll={onViewAll} labels={railLabels} actionLabels={rest.actionLabels} className={rest.className} />
    );
    return wrapStatus(railEl);
  }
  const bar = (
    <LifecycleBar
      {...rest} variant={variant} states={states} current={w.state} currentLabel={w.state ? translate(w.state) : undefined}
      actions={actions} busy={w.applying}
      actionsDisabled={w.needsSave} actionsDisabledReason={w.needsSave ? t("recSaveBeforeAction") : undefined}
      onAction={(a) => runAction(a.id)}
    />
  );
  return wrapStatus(bar);

  function wrapStatus(inner: React.ReactElement) {
    const el = !ownCheck ? inner : (
      <>
        {inner}
        <Dialog open={!!missing} onOpenChange={(o) => { if (!o) setMissing(null); }}>
          <DialogContent data-workflow-missing="">
            <DialogHeader>
              <DialogTitle>{t("formMissingFields")}</DialogTitle>
              <DialogDescription>{t("formMissingIntro")}</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 ps-5 text-sm">{missing?.map((l, i) => <li key={i}>{missingLineText(l, t as (key: string) => string)}</li>)}</ul>
          </DialogContent>
        </Dialog>
      </>
    );
    if (w.error) {
      return (
        <div className="flex flex-col gap-2" data-workflow-actions="unavailable">
          {el}
          <FrappeErrorState error={w.error} compact onRetry={w.refetchTransitions} />
        </div>
      );
    }
    if (!w.transitionsKnown && !w.isLoading && !w.needsSave) {
      return (
        <div className="flex flex-col gap-2" data-workflow-actions="unknown">
          {el}
          <p role="status" data-permissions="unknown" className="text-xs text-muted-foreground">{t("formReadOnly")}</p>
        </div>
      );
    }
    return el;
  }
}

/** The `rail` variant: LifecycleRail whose ways forward apply the transition (asking first where `confirm` says so). */
function RailActions({ path, next, ended, actions, onRun, note, viewAll, labels, actionLabels, className }: {
  path: LifecycleRailStep[]; next: LifecycleRailNext[]; ended: boolean; actions: LifecycleActionItem[]; onRun: (actionId: string) => Promise<void>;
  /** Why no way forward is offered right now (e.g. unsaved changes: Desk hides the actions, apply_workflow would drop them). */
  note?: string;
  viewAll?: () => void; labels?: LifecycleRailLabels; actionLabels?: ActionBarLabels; className?: string;
}) {
  const { t } = useLocale();
  const L = {
    confirmTitle: actionLabels?.confirmTitle ?? t("recConfirmTitle"), confirmBody: actionLabels?.confirmBody ?? t("recConfirmBody"),
    confirm: actionLabels?.confirm ?? t("recConfirm"), cancel: actionLabels?.cancel ?? t("recCancel"), working: actionLabels?.working ?? t("recWorking"),
  };
  const [pending, setPending] = React.useState<LifecycleActionItem | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const run = async (a: LifecycleActionItem) => {
    setError(""); setRunning(true);
    try { await onRun(a.id); } catch (e) { if (mounted.current) setError(errorText(e) || "Error"); }
    finally { if (mounted.current) setRunning(false); }
  };
  const choose = (n: LifecycleRailNext) => {
    const a = actions.find((x) => x.id === n.id);
    if (!a) return;
    if (a.confirm) setPending(a); else void run(a);
  };
  const shown = running ? next.map((n) => ({ ...n, disabled: true, disabledReason: L.working })) : next;
  return (
    <div className={className} data-workflow-actions="rail" data-busy={running || undefined}>
      <LifecycleRail path={path} next={shown} ended={ended} onViewAll={viewAll} onSelectNext={choose} labels={labels} />
      {note ? <p role="status" data-workflow-note="" className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fmt(L.confirmTitle, pending?.label ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{typeof pending?.confirm === "string" ? pending.confirm : L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const a = pending; setPending(null); if (a) void run(a); }}>{L.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
