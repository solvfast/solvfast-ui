import { Check, Minus, X } from "lucide-react";
import { cn } from "../lib/cn";
import type { LifecycleStep } from "./types";

/**
 * Shared visual atoms of the Lifecycle components (LifecycleBar, LifecycleRail, LifecycleStateCard). One mapping, both
 * themes, semantic tokens only:
 *   past / done  → success (check on a solid success dot; solid success connector)
 *   current      → primary (solid dot with a soft primary halo; the row / card is tinted primary)
 *   future       → border + muted-foreground (hollow dot; dashed connector)
 *   skipped      → dashed border, muted;  failed → destructive.
 * Literal class strings only: consumers compile the package's classes from dist (Tailwind path A).
 */
export function LifecycleStepDot({ step, className }: { step: LifecycleStep; className?: string }) {
  return (
    <span
      aria-hidden
      data-dot={step}
      className={cn(
        "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        step === "past" && "bg-success text-success-foreground",
        step === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
        step === "failed" && "bg-destructive text-destructive-foreground",
        step === "skipped" && "border border-dashed border-muted-foreground/50 bg-background text-muted-foreground",
        step === "future" && "border-2 border-muted-foreground/40 bg-background text-muted-foreground",
        className,
      )}
    >
      {step === "past" ? <Check className="h-3 w-3" strokeWidth={3} />
        : step === "failed" ? <X className="h-3 w-3" strokeWidth={3} />
        : step === "skipped" ? <Minus className="h-3 w-3" />
        : step === "current" ? <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />}
    </span>
  );
}

/** Connector colour for the segment that leads INTO a step (solid when that step was reached, dashed otherwise). */
export const lifecycleConnectorClass = (reached: boolean) =>
  reached ? "border-s-2 border-solid border-success" : "border-s-2 border-dashed border-muted-foreground/35";
