import { Check, Minus, X } from "lucide-react";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/relative-time";
import { useLocale } from "../theme/ThemeProvider";
import { ActionBar, type ActionBarLabels } from "./ActionBar";
import { StatusBadge } from "./StatusBadge";
import type { LifecycleActionItem, LifecycleStateItem, LifecycleStep } from "./types";

export interface LifecycleBarProps {
  /** All states in lifecycle order. May be empty (only the badge of `currentLabel` is shown). */
  states: LifecycleStateItem[];
  /** Id of the current state. */
  current?: string;
  /** Fallback label when `current` is not among `states` (e.g. a state the user's workflow no longer lists). */
  currentLabel?: string;
  actions?: LifecycleActionItem[];
  onAction?: (action: LifecycleActionItem) => void | Promise<unknown>;
  /** "steps" shows the stepper (past / current / future, or each state's own `step`: skipped / failed too); "compact" only
   *  the badge and the actions. */
  variant?: "steps" | "compact";
  busy?: boolean;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
  actionLabels?: ActionBarLabels;
  /** Label for the “current” marker (the CRM can say “Current phase”). */
  currentMarker?: string;
  /** Also show actor and time under the current state (default: past states only, like the CRM stepper). */
  showCurrentEntry?: boolean;
  /** Fixed "now" for relative times (tests). */
  now?: number;
  className?: string;
}

/** The record's lifecycle: where it is (badge + steps) and what can be done next (actions). Vocabulary is entirely props. */
export function LifecycleBar({
  states, current, currentLabel, actions = [], onAction, variant = "steps", busy, actionsDisabled, actionsDisabledReason, actionLabels, currentMarker, showCurrentEntry, now, className,
}: LifecycleBarProps) {
  const { t, isRTL } = useLocale();
  const idx = states.findIndex((s) => s.id === current);
  const cur = idx >= 0 ? states[idx] : undefined;
  const marker = currentMarker ?? t("recCurrentState");
  // P35 (G7): a state's own `step` wins over its position (a Lost deal: "Won" is skipped, not ticked).
  const stepOf = (s: LifecycleStateItem, i: number): LifecycleStep => s.step ?? (i === idx ? "current" : idx >= 0 && i < idx ? "past" : "future");
  const srStep: Partial<Record<LifecycleStep, string>> = { skipped: t("coreStepSkipped"), failed: t("coreStepFailed") };
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge label={cur?.label ?? currentLabel ?? current ?? "—"} tone={cur?.tone ?? (cur?.step === "failed" ? "danger" : "neutral")} />
        {onAction && actions.length > 0 ? (
          <ActionBar actions={actions} onAction={onAction} busy={busy} disabled={actionsDisabled} disabledReason={actionsDisabledReason} labels={actionLabels} />
        ) : null}
      </div>
      {variant === "steps" && states.length > 0 ? (
        <ol className="flex flex-col gap-0" aria-label="lifecycle">
          {states.map((s, i) => {
            const step = stepOf(s, i);
            const isCur = i === idx || step === "current";
            const past = step === "past"; const failed = step === "failed"; const skipped = step === "skipped";
            const entry = (past || (failed && !isCur) || (isCur && showCurrentEntry)) && (s.by || s.at);
            return (
              <li key={s.id} aria-current={isCur ? "step" : undefined} data-step={step}
                className="relative flex gap-3 pb-3 last:pb-0">
                {i < states.length - 1 ? <span aria-hidden className={cn("absolute bottom-0 top-5 w-px start-[9px]", past ? "bg-primary/40" : "bg-border")} /> : null}
                <span className={cn("relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  past && "bg-primary text-primary-foreground",
                  failed && "bg-destructive text-destructive-foreground",
                  isCur && (failed ? "ring-4 ring-destructive/20" : "bg-primary text-primary-foreground ring-4 ring-primary/20"),
                  skipped && "border border-dashed border-border bg-background text-muted-foreground",
                  !past && !isCur && !failed && !skipped && "border border-border bg-muted text-muted-foreground")}>
                  {past ? <Check className="h-3 w-3" aria-hidden /> : failed ? <X className="h-3 w-3" aria-hidden />
                    : skipped ? <Minus className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-xs">
                  <p className={cn("leading-tight", failed ? "font-semibold text-destructive" : isCur ? "font-semibold text-foreground" : past ? "font-medium text-foreground"
                    : skipped ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-muted-foreground")}>
                    {s.label}{srStep[step] ? <span className="sr-only"> — {srStep[step]}</span> : null}
                  </p>
                  {entry ? (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground" data-entry>{[s.by, s.at ? relativeTime(s.at, isRTL, now) : ""].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  {isCur ? <p className={cn("mt-0.5 text-[10px] font-medium", failed ? "text-destructive" : "text-primary")}>{marker}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
