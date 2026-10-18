import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Stepper — Sear's port of the Design System's Stepper.
 *
 * The DS does not export it (it lives inside pages/style-guide/StyleGuide.tsx), so this is a
 * faithful copy of that markup. Nothing is added to the Design System and no new visual
 * language is introduced.
 *
 * DS source: design_system/frontend/src/pages/style-guide/StyleGuide.tsx :2487
 *
 * What the DS specifies, and what three hand-rolled copies in Sear each got wrong:
 *  - the container is a `.glass` panel (`!rounded-2xl p-3`) — the copies had no container
 *  - semantics are <ol>/<li> with aria-label + aria-current="step" — the copies used <div>s
 *  - the ACTIVE step is a TINT + RING, never a solid fill ("active = tint" is the same DS rule
 *    the Coverage tabs broke)
 *  - a FAILED step is carried by an X icon + supporting text, never by colour alone
 *  - the circle is size-7 (28px) with no border; the connector is a 1px `bg-border` rule
 *
 * Deliberate deviation: the DS writes the active tint as `bg-primary/12`, but `/12` is not on
 * Tailwind's opacity scale and emits NO css — verified on the live DS, where that circle
 * computes `background: rgba(0,0,0,0)` and is visible only by its ring. We use `bg-primary/10`,
 * the nearest generated step (the DS itself uses /10 for the GlassTabs indicator).
 */

export type StepState = 'done' | 'current' | 'error' | 'upcoming';

export interface StepperStep {
  /** Already-localised label. */
  label: string;
  state: StepState;
  /** Allow jumping to this step. */
  clickable?: boolean;
  /** Supporting text shown under the label — the DS failed-step pattern. */
  note?: string;
  /** Screen-reader-only clarification appended to the label (e.g. "this step has errors"). */
  srNote?: string;
}

export function Stepper({
  steps,
  ariaLabel,
  onJump,
  className,
}: {
  steps: StepperStep[];
  ariaLabel: string;
  onJump?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol
      aria-label={ariaLabel}
      className={cn('glass flex items-center gap-1 overflow-x-auto !rounded-2xl p-3', className)}
    >
      {steps.map((s, i) => {
        const interactive = Boolean(s.clickable && onJump);
        return (
          <li
            key={i}
            className="flex flex-1 items-center last:flex-none"
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            <button
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onJump?.(i)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                interactive ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  s.state === 'done' && 'bg-success text-white',
                  s.state === 'error' && 'bg-destructive/10 text-destructive ring-1 ring-destructive/35',
                  s.state === 'current' && 'bg-primary/10 text-primary ring-1 ring-primary/30',
                  s.state === 'upcoming' && 'bg-foreground/5 text-muted-foreground',
                )}
              >
                {s.state === 'done' ? (
                  <Check className="size-4" aria-hidden />
                ) : s.state === 'error' ? (
                  <X className="size-4" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span className="min-w-0 text-start">
                <span
                  className={cn(
                    'block text-sm leading-tight',
                    s.state === 'error' && 'font-medium text-destructive',
                    s.state === 'current' && 'font-medium text-foreground',
                    (s.state === 'upcoming' || s.state === 'done') && 'text-muted-foreground',
                  )}
                >
                  {s.label}
                  {s.srNote && <span className="sr-only"> — {s.srNote}</span>}
                </span>
                {s.note && (
                  <span className="block text-[10px] leading-tight text-destructive/80">{s.note}</span>
                )}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn('mx-2 h-px flex-1', s.state === 'done' ? 'bg-success/40' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
