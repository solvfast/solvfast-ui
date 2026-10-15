import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * SOLV FAST premium Button — enterprise-grade (Linear/Stripe/Vercel quality).
 * Motion: hover 180ms (lift 1px + ~5% brightness + elevation), pressed 120ms (scale 0.98, no shadow),
 * focus 2px offset ring. All colors via semantic tokens; light/dark aware. RTL-safe (logical gap).
 */
const buttonVariants = cva(
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-[180ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:!translate-y-0 active:duration-[120ms] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Colour-cast LIQUID glass — the glass borrows the semantic hue (DS .glass--action/etc).
        // Text is an accent+ink mix (never white on tinted glass — DS contrast rule).
        // Primary — solid brand fill: shade-700 background + shade-50 text (Violet in Light, Flame in Dark)
        // via theme-aware --btn-primary-* tokens. Keeps glass--interactive for the hover-lift / press-compress.
        default:
          "glass glass--interactive !bg-[--btn-primary-bg] !text-[--btn-primary-fg]",
        gradient:
          "bg-brand-gradient-animated text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_24px_-6px_hsl(var(--brand-violet)_/_0.45)] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_14px_32px_-8px_hsl(var(--brand-violet)_/_0.55)] hover:brightness-[1.05] active:translate-y-0 active:scale-[0.98] active:shadow-none",
        // Previous version: static Purple→Cyan (orange-excluded), no animation.
        "gradient-alt":
          "bg-gradient-to-br from-[#512195] to-[#25D0FE] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(37,208,254,0.45)] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_14px_32px_-8px_rgba(37,208,254,0.55)] hover:brightness-[1.05] active:translate-y-0 active:scale-[0.98] active:shadow-none",
        // Tonal/outlined — derives from the active theme primary (Violet in Light, Flame in Dark).
        // Surface stays neutral so it never competes with the filled primary.
        // Surface buttons — liquid Glass DS material (.glass = 8-layer bevel + backdrop).
        // .glass--interactive handles hover-lift + press-compress; text stays readable.
        secondary:
          "glass glass--interactive text-[hsl(var(--primary))]",
        neutral:
          "glass glass--interactive text-foreground",
        outline:
          "glass glass--interactive text-foreground",
        ghost: "glass glass--interactive glass--clear text-foreground",
        // AI-only: animated brand-gradient outline. Reserve for AI actions (generate, assistant, enhance).
        "ai-outline":
          "btn-ai-outline hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        // AI-only: text-only action with the animated brand gradient ON the letters — no fill/border/shadow/shape.
        "ai-text":
          "btn-ai-text border-0 bg-transparent shadow-none hover:bg-transparent active:scale-[0.98] active:translate-y-0",
        text: "text-foreground hover:text-primary active:scale-[0.98]",
        link: "text-[hsl(var(--info))] underline-offset-4 hover:underline",
        // Destructive — solid red-700 fill + white text (one shared variant; matches the Danger swatch).
        destructive:
          "glass glass--interactive !bg-[#b91c1c] !text-white",
        success:
          "glass glass--interactive glass--positive text-[color-mix(in_srgb,var(--c-positive)_42%,var(--c-content))]",
        warning:
          "glass glass--interactive glass--warning text-[color-mix(in_srgb,var(--c-warning)_46%,var(--c-content))]",
      },
      size: {
        xs: "h-7 gap-1.5 px-2.5 text-xs",
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-base [&_svg]:size-5",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
        fab: "size-14 shadow-lg [&_svg]:size-6",
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
