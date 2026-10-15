// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/textarea.tsx — see VENDORED.md.
import * as React from "react"

import { cn } from "../lib/cn"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "sf-field-fill flex min-h-[60px] w-full rounded-md px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
