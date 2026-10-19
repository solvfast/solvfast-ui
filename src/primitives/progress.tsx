// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/progress.tsx — see VENDORED.md.
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../lib/cn"
import { useLocale } from "../theme/ThemeProvider"

// Package: `value` reaches the Radix root (the DS kept it back, so the bar had no aria-valuenow and was always
// "indeterminate"), and the fill starts at the reading start — the right edge in Arabic (the DS always filled from the left).
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const { isRTL } = useLocale()
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(${isRTL ? "" : "-"}${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
