// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/input.tsx — see VENDORED.md.
import * as React from "react"

import { cn } from "../lib/cn"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "sf-field-fill flex h-9 w-full rounded-md px-3 py-1 text-base outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
