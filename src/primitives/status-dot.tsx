// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/status-dot.tsx — see VENDORED.md.
// P35 (G17): optional `color` (any CSS colour or a palette token) — additive; without it the markup is unchanged.
import * as React from "react";
import { cn } from "../lib/cn";

const TONE: Record<string, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
};

/**
 * Palette tokens accepted by `color` on StatusDot / StatusBadge: the theme's own colours, so they follow light / dark.
 * Anything else is used as a CSS colour as given (`#3b82f6`, `rgb(…)`, `hsl(…)`, `var(--x)`, a named colour).
 */
export const STATUS_PALETTE: Readonly<Record<string, string>> = {
  brand: "hsl(var(--primary))",
  primary: "hsl(var(--primary))",
  neutral: "hsl(var(--muted-foreground))",
  gray: "hsl(var(--muted-foreground))",
  grey: "hsl(var(--muted-foreground))",
  success: "hsl(var(--success))",
  green: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  amber: "hsl(var(--warning))",
  info: "hsl(var(--info))",
  danger: "hsl(var(--destructive))",
  destructive: "hsl(var(--destructive))",
  red: "hsl(var(--destructive))",
  violet: "hsl(var(--brand-violet))",
  purple: "hsl(var(--brand-violet))",
  teal: "hsl(var(--brand-teal))",
  sky: "hsl(var(--brand-sky))",
  cyan: "hsl(var(--brand-cyan))",
  flame: "hsl(var(--brand-flame))",
  orange: "hsl(var(--brand-orange))",
  midnight: "hsl(var(--brand-midnight))",
  forest: "hsl(var(--brand-forest))",
};

/** A palette token → its themed colour; any other non-empty string is returned trimmed (a CSS colour); empty → undefined. */
export function resolveStatusColor(color?: string | null): string | undefined {
  const c = color?.trim();
  if (!c) return undefined;
  return STATUS_PALETTE[c.toLowerCase()] ?? c;
}

/**
 * Inline styles for a custom status colour. The dot is the colour itself; text is the colour mixed 55 % with the theme's
 * foreground (darker on light themes, lighter on dark ones, so a configured yellow or navy stays readable — ≥ 4.5:1 for
 * typical status colours); a pill's fill is the colour at 15 %. Pure CSS (`color-mix`): no build step, follows the
 * nearest `.dark` scope.
 */
export function statusColorStyles(color?: string | null): { dot: React.CSSProperties; text: React.CSSProperties; pill: React.CSSProperties } | undefined {
  const c = resolveStatusColor(color);
  if (!c) return undefined;
  const text = `color-mix(in oklab, ${c} 55%, hsl(var(--foreground)))`;
  return {
    dot: { backgroundColor: c },
    text: { color: text },
    pill: { backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`, color: text },
  };
}

/** Frappe-style status indicator: a small colored dot + label (e.g. ● Lost, ● New Lead). */
export function StatusDot({
  tone = "default",
  label,
  className,
  color,
}: {
  tone?: keyof typeof TONE;
  label?: React.ReactNode;
  className?: string;
  /** P35: a configured colour (CSS colour or a `STATUS_PALETTE` token) for the dot; overrides `tone`. The label keeps
   *  the text colour, so meaning never rests on the colour alone. */
  color?: string | null;
}) {
  const custom = statusColorStyles(color);
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", !custom && (TONE[tone] ?? TONE.default))}
        style={custom?.dot}
        data-color={custom ? resolveStatusColor(color) : undefined}
      />
      {label}
    </span>
  );
}
