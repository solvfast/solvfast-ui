import * as React from "react";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
};

/** Frappe-style status indicator: a small colored dot + label (e.g. ● Lost, ● New Lead). */
export function StatusDot({
  tone = "default",
  label,
  className,
}: {
  tone?: keyof typeof TONE;
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE[tone] ?? TONE.default)} />
      {label}
    </span>
  );
}
