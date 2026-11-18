// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/dialog.tsx — see VENDORED.md.
"use client"

import * as React from "react"
import { useReturnFocus, type ReturnFocusTarget } from "./focus-return"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "../lib/cn"
import { useLocale, usePortalContainer } from "../theme/ThemeProvider"
import { StatusDot } from "./status-dot"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = (props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>) => (
  <DialogPrimitive.Portal container={usePortalContainer()} {...props} />
)

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 sf-glass-overlay-blur data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** Run 1 (A-51): width per `size`; "md" adds nothing (the 0.4 max-w-lg). */
const DIALOG_SIZE: Record<"sm" | "md" | "lg" | "xl" | "full", string> = {
  sm: "sm:max-w-sm", md: "", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl", full: "sm:max-w-[calc(100vw-2rem)]",
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Where focus goes when the dialog closes (Run 1 B-42). Default: the element that opened it (a menu item → its menu's
     *  trigger); a `DialogTrigger` as before. */
    returnFocus?: ReturnFocusTarget
    /** Run 1 (A-51, Desk dialog.js `static`): false = Escape and a click outside do not close it and the × is hidden; the
     *  dialog closes only through its own buttons. Default true. */
    dismissible?: boolean
    /** Run 1 (A-51): no × button (the dialog's own buttons close it). Default false. */
    hideClose?: boolean
    /** Run 1 (A-51, Desk dialog.js size small / large / extra-large): the width. Default "md" (max-w-lg, unchanged). */
    size?: "sm" | "md" | "lg" | "xl" | "full"
  }
>(({ className, children, returnFocus, onOpenAutoFocus, onCloseAutoFocus, dismissible = true, hideClose = false, size = "md", onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...props }, ref) => {
  const focus = useReturnFocus({ returnFocus, onOpenAutoFocus, onCloseAutoFocus })
  const { t } = useLocale()
  const keep = (e: Event) => { if (!dismissible) e.preventDefault() }
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      {...focus}
      onEscapeKeyDown={(e) => { onEscapeKeyDown?.(e); keep(e) }}
      onPointerDownOutside={(e) => { onPointerDownOutside?.(e); keep(e) }}
      onInteractOutside={(e) => { onInteractOutside?.(e); keep(e) }}
      data-size={size === "md" ? undefined : size}
      className={cn(
        "fixed start-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] rtl:-translate-x-[-50%] translate-y-[-50%] gap-4 sf-aurora-bar sf-lg-surface sf-glass-dialog p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl",
        DIALOG_SIZE[size],
        className
      )}
      {...props}
    >
      {children}
      {hideClose || !dismissible ? null : <DialogPrimitive.Close className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        {/* Run 1 A-51: the close button's name from the catalogue (was the English "Close" in every language) */}
        <span className="sr-only">{t("close")}</span>
      </DialogPrimitive.Close>}
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-start",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 rtl:sm:space-x-reverse",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    /** Run 1 (A-51, Desk dialog.js `set_indicator`): a coloured dot before the title (a tone, or a palette colour). */
    indicator?: { tone?: "default" | "success" | "warning" | "info" | "destructive"; color?: string; label?: string }
  }
>(({ className, indicator, children, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      indicator && "flex items-center gap-2",
      className
    )}
    {...props}
  >
    {indicator ? <StatusDot tone={indicator.tone} color={indicator.color} label={indicator.label ? <span className="sr-only">{indicator.label}</span> : undefined} /> : null}
    {children}
  </DialogPrimitive.Title>
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
