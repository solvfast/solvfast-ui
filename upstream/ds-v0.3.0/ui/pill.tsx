import * as React from "react";
import { cn } from "@/lib/utils";

/** Rounded-full chip for assignee / status / filter tokens (e.g. "R Rana", "● Lost ⌄"). */
export const Pill = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
);
Pill.displayName = "Pill";
