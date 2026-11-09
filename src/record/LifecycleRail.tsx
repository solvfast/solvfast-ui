import { CornerDownRight, Flag, Maximize2, Undo2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { LifecycleStepDot, lifecycleConnectorClass } from "./lifecycle-parts";

/** A state the record has been in (past) or is in now (the last entry). */
export interface LifecycleRailStep {
  id: string;
  label: string;
  /** Short who · when line shown at the row's end (e.g. "Omar · Apr 12"). */
  meta?: string;
  /** Tooltip for the meta (e.g. "Created by Omar Ali · 12 Apr 2026, 10:04"). */
  metaTitle?: string;
}

/** A state the record can move to from the current one. */
export interface LifecycleRailNext {
  id: string;
  label: string;
  /** A move back to a state already on the record's path (undo icon + "back" tag). */
  back?: boolean;
  /** Shown but not available to this user / right now (muted, `aria-disabled`, reason as tooltip). */
  disabled?: boolean;
  disabledReason?: string;
}

export interface LifecycleRailLabels {
  back?: string;
  end?: string;
  viewAll?: string;
  /** Screen-reader suffix of the current row. */
  current?: string;
  /** Screen-reader name of the "what can happen next" group. */
  next?: string;
}

export interface LifecycleRailProps {
  /** The record's path, oldest first; the LAST entry is the current state. Empty → nothing is rendered. */
  path: LifecycleRailStep[];
  /** Ways forward from the current state. One → a dashed row on the line; two or more → a box under the current row. */
  next?: LifecycleRailNext[];
  /** No way forward: shows "End of lifecycle" (only when `next` is empty). */
  ended?: boolean;
  /** Shows the "View full lifecycle" link (e.g. to open a LifecycleDiagramDialog). */
  onViewAll?: () => void;
  /** Chrome strings; default from the ThemeProvider's language. Pass them when rendering outside a ThemeProvider. */
  labels?: LifecycleRailLabels;
  className?: string;
}

/**
 * LifecycleRail — the record's lifecycle as a vertical rail: every state it went through (success), where it is now
 * (primary, tinted row), what can happen next (dashed / a box, back-moves tagged) or the end of the lifecycle, and a
 * link to the full diagram. Purely presentational: the consumer walks its own lifecycle graph and passes the view model.
 */
export function LifecycleRail({ path, next = [], ended, onViewAll, labels, className }: LifecycleRailProps) {
  const { t } = useLocale();
  if (path.length === 0) return null;
  const L = {
    back: labels?.back ?? t("lcBack"),
    end: labels?.end ?? t("lcEnd"),
    viewAll: labels?.viewAll ?? t("lcViewAll"),
    current: labels?.current ?? t("lcCurrent"),
    next: labels?.next ?? t("lcNext"),
  };
  const cur = path.length - 1;

  const BackTag = () => (
    <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
      {L.back}
    </span>
  );

  return (
    <div className={cn("relative", className)} data-lifecycle-rail>
      <ol className="flex flex-col">
        {path.map((s, i) => {
          const isCur = i === cur;
          return (
            <li key={`${s.id}-${i}`} data-step={isCur ? "current" : "past"} aria-current={isCur ? "step" : undefined}
              className={cn("relative flex h-9 items-center rounded-[10px]", isCur && "bg-primary/10")}>
              {i > 0 ? <span aria-hidden className={cn("absolute -top-1/2 h-full w-0 start-[17px]", lifecycleConnectorClass(true))} /> : null}
              <span className="flex w-9 shrink-0 justify-center"><LifecycleStepDot step={isCur ? "current" : "past"} /></span>
              <span title={s.label}
                className={cn("min-w-0 flex-1 truncate text-sm", isCur ? "font-semibold text-primary" : "font-medium text-foreground")}>
                {s.label}{isCur ? <span className="sr-only"> — {L.current}</span> : null}
              </span>
              {s.meta ? (
                <span data-meta title={s.metaTitle} className="shrink-0 whitespace-nowrap pe-2.5 ps-2 text-xs text-muted-foreground">{s.meta}</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {next.length === 1 ? (
        <div role="group" aria-label={L.next} data-next="row"
          className="relative flex h-9 items-center gap-2 pe-2" aria-disabled={next[0].disabled || undefined} title={next[0].disabled ? next[0].disabledReason : undefined}>
          <span aria-hidden className={cn("absolute -top-1/2 h-full w-0 start-[17px]", lifecycleConnectorClass(false))} />
          <span className="flex w-9 shrink-0 justify-center"><LifecycleStepDot step="future" /></span>
          {next[0].back ? <Undo2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
          <span title={next[0].label} className={cn("min-w-0 flex-1 truncate text-sm text-muted-foreground", next[0].disabled && "opacity-60")}>{next[0].label}</span>
          {next[0].back ? <BackTag /> : null}
        </div>
      ) : null}

      {next.length >= 2 ? (
        <div className="relative pb-0.5 ps-9 pt-2.5" data-next="box">
          <span aria-hidden className="absolute -top-1.5 h-6 w-5 rounded-es-[10px] border-b-2 border-s-2 border-dashed border-border start-[17px]" />
          <ul aria-label={L.next} className="rounded-xl border border-border bg-muted/40 px-1.5 py-1">
            {next.map((o) => (
              <li key={o.id} aria-disabled={o.disabled || undefined} title={o.disabled ? o.disabledReason : undefined}
                className={cn("flex h-8 items-center gap-2 px-1", o.disabled && "opacity-60")}>
                {o.back ? <Undo2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />}
                <span title={o.label} className="min-w-0 flex-1 truncate text-[13px] text-foreground">{o.label}</span>
                {o.back ? <BackTag /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {next.length === 0 && ended ? (
        <div className="relative flex h-9 items-center" data-next="end">
          <span aria-hidden className={cn("absolute -top-1/2 h-full w-0 start-[17px]", lifecycleConnectorClass(false))} />
          <span className="flex w-9 shrink-0 justify-center"><Flag aria-hidden className="h-4 w-4 text-muted-foreground" /></span>
          <span className="text-sm text-muted-foreground">{L.end}</span>
        </div>
      ) : null}

      {onViewAll ? (
        <button type="button" onClick={onViewAll}
          className="ms-9 mt-2 inline-flex items-center gap-1.5 rounded-sm text-start text-[13px] font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Maximize2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span>{L.viewAll}</span>
        </button>
      ) : null}
    </div>
  );
}
