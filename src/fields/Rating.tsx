/**
 * Rating — stars, value in / value out as a number of stars (0…max, half steps when `allowHalf`), null when unset.
 * Desk (docs `12` §10): stars = `options` (default 5), half-star clicks, clicking the current value clears it unless the
 * field is required; Frappe stores a fraction 0…1 — the Frappe wrapper converts. Keyboard: a slider (arrows follow the
 * reading direction, Home / End, Delete clears).
 */
import * as React from "react";
import { Star, StarHalf } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { interpolate } from "./FieldShell";

export interface RatingProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  max?: number;
  allowHalf?: boolean;
  /** A required rating cannot be cleared by clicking its current value. */
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function Rating({ value, onChange, max = 5, allowHalf = true, required, disabled, readOnly, id, className, ...aria }: RatingProps) {
  const { t, isRTL } = useLocale();
  const [hover, setHover] = React.useState<number | null>(null);
  const v = value ?? 0;
  const shown = hover ?? v;
  const step = allowHalf ? 0.5 : 1;
  const interactive = !disabled && !readOnly;
  const set = (n: number) => {
    const next = Math.max(0, Math.min(max, n));
    if (next === v && !required) onChange(null);
    else if (next !== v) onChange(next);
  };
  const pointValue = (i: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!allowHalf) return i + 1;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const firstHalf = isRTL ? x > r.width / 2 : x < r.width / 2;
    return r.width > 0 && firstHalf ? i + 0.5 : i + 1;
  };
  return (
    <div
      id={id}
      role="slider"
      tabIndex={interactive ? 0 : -1}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={v}
      aria-valuetext={interpolate(t("formRatingValue"), { n: v, max })}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      {...aria}
      className={cn("inline-flex items-center gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", disabled && "opacity-50", className)}
      onKeyDown={(e) => {
        if (!interactive) return;
        const fwd = isRTL ? "ArrowLeft" : "ArrowRight";
        const back = isRTL ? "ArrowRight" : "ArrowLeft";
        if (e.key === fwd || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(max, v + step)); }
        else if (e.key === back || e.key === "ArrowDown") { e.preventDefault(); const n = Math.max(0, v - step); onChange(n === 0 && !required ? null : n); }
        else if (e.key === "Home") { e.preventDefault(); onChange(required ? step : null); }
        else if (e.key === "End") { e.preventDefault(); onChange(max); }
        else if ((e.key === "Delete" || e.key === "Backspace") && !required) { e.preventDefault(); onChange(null); }
      }}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const full = shown >= i + 1;
        const half = !full && shown >= i + 0.5;
        return (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-hidden
            disabled={!interactive}
            className={cn("p-0.5 text-muted-foreground disabled:cursor-default", (full || half) && "text-warning")}
            onMouseMove={(e) => interactive && setHover(pointValue(i, e))}
            onClick={(e) => interactive && set(pointValue(i, e))}
          >
            {half ? <StarHalf className={cn("size-5 fill-current", isRTL && "-scale-x-100")} /> : <Star className={cn("size-5", full && "fill-current")} />}
          </button>
        );
      })}
    </div>
  );
}
