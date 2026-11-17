import * as React from "react";
import { LifecycleDiagramDialog } from "../record/LifecycleDiagram";
import { LifecycleGraphView } from "../record/LifecycleGraphView";
import { useLocale } from "../theme/ThemeProvider";
import { sayrLifecycleGraph, type LifecyclePathStep } from "./lifecycleModel";
import type { LifecycleGraphData } from "./recordPage";

export type { LifecyclePathStep } from "./lifecycleModel";

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

/** View full lifecycle: the whole lifecycle as a diagram in a dialog, with the record's place and path on it — core's
 *  `LifecycleDiagramDialog` around `LifecycleGraphView`, on the core model built from Sayr's data. An older Sayr that
 *  sends no transitions still shows every state. */
export function LifecycleGraphDialog({ open, onOpenChange, title, subtitle, lifecycle, status, path }: LifecycleGraphDialogProps) {
  const { isRTL } = useLocale();
  const graph = React.useMemo(() => sayrLifecycleGraph(lifecycle, { arabic: isRTL, status, path }), [lifecycle, isRTL, status, path]);
  return (
    <LifecycleDiagramDialog open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle} dir={isRTL ? "rtl" : "ltr"}>
      {open ? <LifecycleGraphView graph={graph} initial={lifecycle.initial_state} dir={isRTL ? "rtl" : "ltr"} /> : null}
    </LifecycleDiagramDialog>
  );
}
