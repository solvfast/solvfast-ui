import { Check, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { loc, type Localized } from '../lib/localized';
import { useLocale } from '../theme/ThemeProvider';

/**
 * Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/patterns/Stepper.tsx — see VENDORED.md.
 * Same markup and classes (`glass` → `sf-glass`); labels may also be `{ en, ar }`.
 *
 * Stepper — the canonical SOLV FAST stepper (public DS pattern, CONSUMING.md §D).
 *
 * Adopted in 0.2.0 from sear_product's port (sear_studio/components/Stepper.tsx), which unified the two
 * hand-written variants that lived inside the StyleGuide (default + failed step). Code below is that port,
 * verbatim, except `cn` is imported relatively so the pattern needs no `@/…` host module.
 *
 * Rules it encodes (from the StyleGuide "Glass navigation & controls" section):
 *  - container is a `.glass` panel (`!rounded-2xl p-3`); semantics are <ol>/<li> + aria-label, and the
 *    current step carries aria-current="step"
 *  - the CURRENT step is a tint + ring, never a solid fill; a DONE step is a solid success circle + check
 *  - an ERROR step is carried by an X icon + supporting text (`note`) + `srNote`, never by colour alone
 *  - steps are buttons, clickable only when `clickable` is set and `onJump` is provided
 *  - tints use `/10` because `/12` is not on Tailwind 3's opacity scale and emits no CSS (CONSUMING.md B7)
 */

export type StepState = 'done' | 'current' | 'error' | 'upcoming';

export interface StepperStep {
  /** The label: a string, or one per language. */
  label: Localized;
  state: StepState;
  /** Allow jumping to this step. */
  clickable?: boolean;
  /** Supporting text shown under the label — the DS failed-step pattern. */
  note?: Localized;
  /** Screen-reader-only clarification appended to the label (e.g. "this step has errors"). */
  srNote?: Localized;
}

export function Stepper({
  steps,
  ariaLabel,
  onJump,
  className,
}: {
  steps: StepperStep[];
  ariaLabel: Localized;
  onJump?: (index: number) => void;
  className?: string;
}) {
  const { language } = useLocale();
  return (
    <ol
      aria-label={loc(ariaLabel, language)}
      className={cn('sf-glass flex items-center gap-1 overflow-x-auto !rounded-2xl p-3', className)}
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
                  {loc(s.label, language)}
                  {s.srNote && <span className="sr-only"> — {loc(s.srNote, language)}</span>}
                </span>
                {s.note && (
                  <span className="block text-[10px] leading-tight text-destructive/80">{loc(s.note, language)}</span>
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

