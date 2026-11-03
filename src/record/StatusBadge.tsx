import * as React from "react";
import { cn } from "../lib/cn";

const DOT: Record<string, string> = {
  neutral: "bg-muted-foreground", success: "bg-success", warning: "bg-warning", danger: "bg-destructive", info: "bg-info", brand: "bg-primary",
};
const PILL: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive", info: "bg-info/15 text-info", brand: "bg-primary/12 text-primary",
};

export interface StatusBadgeProps {
  label: React.ReactNode;
  tone?: import("./types").Tone;
  /** "pill" (default) = tinted chip with a dot; "dot" = dot + plain label. */
  variant?: "pill" | "dot";
  className?: string;
  title?: string;
}

/** Status chip. The colour is a semantic tone (never the only carrier: the label is always shown). */
export function StatusBadge({ label, tone = "neutral", variant = "pill", className, title }: StatusBadgeProps) {
  return (
    <span
      title={title}
      data-tone={tone}
      className={cn("inline-flex max-w-full items-center gap-1.5 text-xs font-medium",
        variant === "pill" ? cn("rounded-full px-2.5 py-0.5", PILL[tone]) : "text-foreground", className)}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} />
      <span className="truncate">{label}</span>
    </span>
  );
}
