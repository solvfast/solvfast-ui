// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/skeleton.tsx — see VENDORED.md.
import { cn } from "../lib/cn"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("sf-skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
