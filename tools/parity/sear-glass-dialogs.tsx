/** Reference dialogs: the DS DialogContent / AlertDialogContent with Sear's `sear-glass-dialog` marker
 *  (sear-studio.css:296-318) — the glassy dialog Sear uses (ConnectorDetailsDialog, NodeEditorDialog). Read-only. */
import * as React from "react";
import { DialogContent as DsDialogContent } from "@/components/ui/dialog";
import { AlertDialogContent as DsAlertDialogContent } from "@/components/ui/alert-dialog";

export const DialogContent = React.forwardRef<React.ElementRef<typeof DsDialogContent>, React.ComponentPropsWithoutRef<typeof DsDialogContent>>(
  ({ className, ...p }, ref) => <DsDialogContent ref={ref} className={["sear-glass-dialog", className].filter(Boolean).join(" ")} {...p} />,
);
export const AlertDialogContent = React.forwardRef<React.ElementRef<typeof DsAlertDialogContent>, React.ComponentPropsWithoutRef<typeof DsAlertDialogContent>>(
  ({ className, ...p }, ref) => <DsAlertDialogContent ref={ref} className={["sear-glass-dialog", className].filter(Boolean).join(" ")} {...p} />,
);
