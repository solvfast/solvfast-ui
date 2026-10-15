// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/button.tsx — see VENDORED.md.
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "../lib/cn"

/**
 * SOLV FAST premium Button — enterprise-grade (Linear/Stripe/Vercel quality).
 * Package subset: only the variants and sizes Sear uses (VENDORED.md).
 * Motion: hover 180ms (lift 1px + ~5% brightness + elevation), pressed 120ms (scale 0.98, no shadow),
 * focus 2px offset ring. All colors via semantic tokens; light/dark aware. RTL-safe (logical gap).
 */
const buttonVariants = cva(
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-180 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:!translate-y-0 active:duration-120 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Colour-cast LIQUID glass — the glass borrows the semantic hue (DS .glass--action/etc).
        // Text is an accent+ink mix (never white on tinted glass — DS contrast rule).
        // Primary — solid brand fill: shade-700 background + shade-50 text (Violet in Light, Flame in Dark)
        // via theme-aware --btn-primary-* tokens. Keeps glass--interactive for the hover-lift / press-compress.
        default:
          "sf-glass sf-glass--interactive !bg-[--btn-primary-bg] !text-[--btn-primary-fg]",
        // Tonal/outlined — derives from the active theme primary (Violet in Light, Flame in Dark).
        // Surface stays neutral so it never competes with the filled primary.
        // Surface buttons — liquid Glass DS material (.glass = 8-layer bevel + backdrop).
        // .glass--interactive handles hover-lift + press-compress; text stays readable.
        secondary:
          "sf-glass sf-glass--interactive text-[hsl(var(--primary))]",
        outline:
          "sf-glass sf-glass--interactive text-foreground",
        ghost: "sf-glass sf-glass--interactive sf-glass--clear text-foreground",
        // AI-only: animated brand-gradient outline. Reserve for AI actions (generate, assistant, enhance).
        "ai-outline":
          "sf-btn-ai-outline hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        // Text-only action — used internally by Calendar's day buttons (calendar.tsx), so it stays.
        text: "text-foreground hover:text-primary active:scale-[0.98]",
        // Destructive — solid red-700 fill + white text (one shared variant; matches the Danger swatch).
        destructive:
          "sf-glass sf-glass--interactive !bg-[#b91c1c] !text-white",
      },
      size: {
        xs: "h-7 gap-1.5 px-2.5 text-xs",
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-sm",
        icon: "size-10",
        "icon-sm": "size-8",
      },
      shape: {
        square: "rounded-full",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "square",
      fullWidth: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, fullWidth, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && variant !== "ai-outline" && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
