// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/sonner.tsx — see VENDORED.md.
// Same toast host (theme, direction, bottom end, card toasts); theme and direction come from the package's
// ThemeProvider. Any sonner Toaster prop (position, richColors, …) can be passed to override the defaults.
import * as React from "react";
import { Toaster as Sonner } from "sonner";
import { useLocale, useTheme } from "../theme/ThemeProvider";

export type ToasterProps = React.ComponentProps<typeof Sonner>;

/** App-themed toast host (light/dark + RTL aware). Render once inside ThemeProvider; call `toast()` to show toasts. */
export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  const { direction } = useLocale();
  return (
    <Sonner
      theme={theme}
      dir={direction}
      position={direction === "rtl" ? "bottom-left" : "bottom-right"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group rounded-md border border-border bg-card text-card-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
