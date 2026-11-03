import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { ActionBar, type ActionBarLabels } from "./ActionBar";
import { StatusBadge } from "./StatusBadge";
import type { LifecycleActionItem, LifecycleStateItem } from "./types";

export interface LifecycleBarProps {
  /** All states in lifecycle order. May be empty (only the badge of `currentLabel` is shown). */
  states: LifecycleStateItem[];
  /** Id of the current state. */
  current?: string;
  /** Fallback label when `current` is not among `states` (e.g. a state the user's workflow no longer lists). */
  currentLabel?: string;
  actions?: LifecycleActionItem[];
  onAction?: (action: LifecycleActionItem) => void | Promise<unknown>;
  /** "steps" shows the stepper (past / current / future); "compact" only the badge and the actions. */
  variant?: "steps" | "compact";
  busy?: boolean;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
  actionLabels?: ActionBarLabels;
  /** Label for the “current” marker (the CRM can say “Current phase”). */
  currentMarker?: string;
  className?: string;
}

/** The record's lifecycle: where it is (badge + steps) and what can be done next (actions). Vocabulary is entirely props. */
export function LifecycleBar({
  states, current, currentLabel, actions = [], onAction, variant = "steps", busy, actionsDisabled, actionsDisabledReason, actionLabels, currentMarker, className,
}: LifecycleBarProps) {
  const { t } = useLocale();
  const idx = states.findIndex((s) => s.id === current);
  const cur = idx >= 0 ? states[idx] : undefined;
  const marker = currentMarker ?? t("recCurrentState");
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge label={cur?.label ?? currentLabel ?? current ?? "—"} tone={cur?.tone ?? "neutral"} />
        {onAction && actions.length > 0 ? (
          <ActionBar actions={actions} onAction={onAction} busy={busy} disabled={actionsDisabled} disabledReason={actionsDisabledReason} labels={actionLabels} />
        ) : null}
      </div>
      {variant === "steps" && states.length > 0 ? (
        <ol className="flex flex-col gap-0" aria-label="lifecycle">
          {states.map((s, i) => {
            const isCur = i === idx; const past = idx >= 0 && i < idx;
            return (
              <li key={s.id} aria-current={isCur ? "step" : undefined} data-step={isCur ? "current" : past ? "past" : "future"}
                className="relative flex gap-3 pb-3 last:pb-0">
                {i < states.length - 1 ? <span aria-hidden className={cn("absolute bottom-0 top-5 w-px start-[9px]", past ? "bg-primary/40" : "bg-border")} /> : null}
                <span className={cn("relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  past && "bg-primary text-primary-foreground", isCur && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !past && !isCur && "border border-border bg-muted text-muted-foreground")}>
                  {past ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-xs">
                  <p className={cn("leading-tight", isCur ? "font-semibold text-foreground" : past ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</p>
                  {isCur ? <p className="mt-0.5 text-[10px] font-medium text-primary">{marker}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
