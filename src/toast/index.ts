/**
 * @solvfast/ui/toast — toasts on sonner. Requires `sonner` (^1.7 or ^2, an optional peer dependency): the app and this
 * entry then share one copy, so `toast()` from "sonner" and from here reach the same <Toaster />. The core entry
 * never imports this.
 */
export { Toaster } from "./Toaster";
export type { ToasterProps } from "./Toaster";
export { toast } from "sonner";
