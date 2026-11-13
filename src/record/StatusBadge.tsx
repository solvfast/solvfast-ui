import * as React from "react";
import { cn } from "../lib/cn";
import { resolveStatusColor, statusColorStyles } from "../primitives/status-dot";

const DOT: Record<string, string> = {
  neutral: "bg-muted-foreground", success: "bg-success", warning: "bg-warning", danger: "bg-destructive", info: "bg-info", brand: "bg-primary",
};
/** Run 1 (D-64): the tinted pills' text is the tone mixed with the foreground (as a configured colour's), so it reads at
 *  ≥ 4.5:1 on its tint in light and dark (was 1.7–3.4:1 for success / warning / info / danger in light). */
const PILL: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-[color-mix(in_oklab,hsl(var(--success))_55%,hsl(var(--foreground)))]",
  warning: "bg-warning/15 text-[color-mix(in_oklab,hsl(var(--warning))_55%,hsl(var(--foreground)))]",
  danger: "bg-destructive/15 text-[color-mix(in_oklab,hsl(var(--destructive))_55%,hsl(var(--foreground)))]",
  info: "bg-info/15 text-[color-mix(in_oklab,hsl(var(--info))_55%,hsl(var(--foreground)))]",
  brand: "bg-primary/12 text-[color-mix(in_oklab,hsl(var(--primary))_55%,hsl(var(--foreground)))]",
};

export interface StatusBadgeProps {
  label: React.ReactNode;
  tone?: import("./types").Tone;
  /**
   * P35 (G17): a configured colour that overrides `tone` — any CSS colour (`#3b82f6`, `rgb(…)`, `var(--x)`) or a
   * palette token (`STATUS_PALETTE`: `violet`, `teal`, `sky`, `success`, …). The pill text is the colour mixed with the
   * theme's foreground, so it stays readable in light and dark. `tone` still sets `data-tone`.
   */
  color?: string | null;
  /** "pill" (default) = tinted chip with a dot; "dot" = dot + plain label. */
  variant?: "pill" | "dot";
  className?: string;
  title?: string;
}

/** Status chip. The colour is a semantic tone or a configured colour (never the only carrier: the label is always shown). */
export function StatusBadge({ label, tone = "neutral", color, variant = "pill", className, title }: StatusBadgeProps) {
  const custom = statusColorStyles(color);
  return (
    <span
      title={title}
      data-tone={tone}
      data-color={custom ? resolveStatusColor(color) : undefined}
      style={custom && variant === "pill" ? custom.pill : undefined}
      className={cn("inline-flex max-w-full items-center gap-1.5 text-xs font-medium",
        variant === "pill" ? cn("rounded-full px-2.5 py-0.5", !custom && PILL[tone]) : "text-foreground", className)}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", !custom && DOT[tone])} style={custom?.dot} />
      <span className="truncate">{label}</span>
    </span>
  );
}
