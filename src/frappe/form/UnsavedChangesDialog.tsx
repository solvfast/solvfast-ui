/**
 * Leaving a page with unsaved changes: Save and leave / Discard / Keep editing. The host decides when it opens (e.g.
 * react-router's `useBlocker` while the form is dirty) and what each answer does; `saving` keeps it open while the save
 * runs. Escape or closing it is Keep editing.
 */
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { useLocale } from "../../theme/ThemeProvider";

export interface UnsavedChangesDialogProps {
  open: boolean;
  /** Save, then leave (the host leaves only when the save succeeded). */
  onSave: () => void;
  /** Leave and lose the changes. */
  onDiscard: () => void;
  /** Stay on the page. */
  onStay: () => void;
  saving?: boolean;
}

export function UnsavedChangesDialog({ open, onSave, onDiscard, onStay, saving }: UnsavedChangesDialogProps) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onStay(); }}>
      <DialogContent className="max-w-md" data-unsaved-dialog>
        <DialogHeader>
          <DialogTitle>{t("formLeaveTitle")}</DialogTitle>
          <DialogDescription>{t("formLeaveBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={onStay} data-unsaved-stay>{t("formKeepEditing")}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onDiscard} data-unsaved-discard>{t("formDiscard")}</Button>
          <Button type="button" loading={saving} onClick={onSave} data-unsaved-save>{t("formSaveAndLeave")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
