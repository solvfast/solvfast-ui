import * as React from "react";
import { LifecycleDiagramDialog, type LifecyclePhase } from "../record/LifecycleDiagram";
import { LifecycleGraphView, type LifecycleGraphViewState, type LifecycleGraphViewTransition } from "../record/LifecycleGraphView";
import { useLocale } from "../theme/ThemeProvider";
import type { LifecycleGraphData } from "./recordPage";

const PHASES: Record<string, { phase: LifecyclePhase; label: "lcPhaseOpen" | "lcPhaseOnHold" | "lcPhaseClosed" }> = {
  open: { phase: "open", label: "lcPhaseOpen" },
  on_hold: { phase: "on_hold", label: "lcPhaseOnHold" },
  closed: { phase: "closed", label: "lcPhaseClosed" },
};

/** One state the record went through, oldest first (the lifecycle rail's path): its key and who moved it there, when. */
export interface LifecyclePathStep { id: string; meta?: string; metaTitle?: string }

export interface LifecycleGraphDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  lifecycle: LifecycleGraphData;
  /** The record's state (none for a new record's preview). */
  status?: string | null;
  /** The states the record went through, ending at `status`. */
  path?: LifecyclePathStep[];
}

/** View full lifecycle: the whole lifecycle as a diagram in a dialog, with the record's place and path on it. */
export function LifecycleGraphDialog({ open, onOpenChange, title, subtitle, lifecycle, status, path = [], }: LifecycleGraphDialogProps) {
  const { t, isRTL } = useLocale();
  const seen = React.useMemo(() => new Map(path.map((p) => [p.id, p])), [path]);
  const states = React.useMemo<LifecycleGraphViewState[]>(() => lifecycle.states.map((s) => {
    const p = PHASES[(s.phase || "").toLowerCase()] ?? PHASES.open;
    const step = seen.get(s.state_key);
    return {
      key: s.state_key, label: (isRTL && s.name_ar) || s.name_en,
      kind: s.state_key === status ? "current" : step ? "done" : "future",
      phase: p.phase, meta: [t(p.label), step?.meta].filter(Boolean).join(" · "), metaTitle: step?.metaTitle,
    };
  }), [lifecycle.states, seen, status, isRTL, t]);
  const taken = React.useMemo(() => new Set(path.slice(1).map((p, i) => `${path[i].id}\u0001${p.id}`)), [path]);
  const transitions = React.useMemo<LifecycleGraphViewTransition[]>(() => (lifecycle.transitions ?? []).map((tr) => ({
    key: tr.transition_key || `${tr.from_state}-${tr.to_state}`, from: tr.from_state, to: tr.to_state,
    label: (isRTL && tr.action_ar) || tr.action_en, taken: taken.has(`${tr.from_state}\u0001${tr.to_state}`),
  })), [lifecycle.transitions, taken, isRTL]);
  return (
    <LifecycleDiagramDialog open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle} dir={isRTL ? "rtl" : "ltr"}>
      {open ? <LifecycleGraphView states={states} transitions={transitions} initial={lifecycle.initial_state} /> : null}
    </LifecycleDiagramDialog>
  );
}
