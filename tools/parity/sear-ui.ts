/**
 * "@ui" for the Sear reference harness: the SAME names as @solvfast/ui, resolved to what Sear really renders —
 * Sear's components/ui shims (→ @ds design-system source) and Sear's own DateTimeField, under Sear's AppContext.
 * Read-only: nothing here writes to apps/sear_product or apps/design_system.
 */
export * from "@/components/ui/button";
export * from "@/components/ui/input";
export * from "@/components/ui/textarea";
export * from "@/components/ui/label";
export * from "@/components/ui/badge";
export * from "@/components/ui/card";
export * from "@/components/ui/select";
export * from "@/components/ui/checkbox";
export * from "@/components/ui/switch";
export * from "@/components/ui/tabs";
export * from "@/components/ui/separator";
export * from "@/components/ui/avatar";
export * from "@/components/ui/skeleton";
export * from "@/components/ui/scroll-area";
export * from "@/components/ui/tooltip";
export * from "@/components/ui/popover";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/command";
export * from "@/components/ui/dialog";
export * from "@/components/ui/alert-dialog";
export * from "@/components/ui/sheet";
export * from "@/components/ui/calendar";
// What Sear renders where the DS default differs (named exports shadow the star exports above):
// tab strips are Sear's SegmentedTabs; dialogs carry Sear's glassy `sear-glass-dialog`.
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./sear-tabs";
export { DialogContent, AlertDialogContent } from "./sear-glass-dialogs";
// 0.2.0: Sear's table and radio-group shims (onto the Design System) and Sear's own Stepper.
export * from "@/components/ui/table";
export * from "@/components/ui/radio-group";
export { Stepper } from "@sear/components/Stepper";
export { DateField, TimeField, DateTimeField } from "@sear/components/DateTimeField";
export { AppProvider as ThemeProvider } from "@/contexts/AppContext";
import { useApp } from "@/contexts/AppContext";
export function useLocale() {
  const { direction } = useApp();
  return { isRTL: direction === "rtl" };
}
