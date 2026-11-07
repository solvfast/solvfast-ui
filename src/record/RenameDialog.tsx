/**
 * RenameDialog — Desk's "Rename {name}" dialog of the form menu (`frappe.model.rename_doc`, model.js:733-779): a required
 * "New Name" (default: the current name) and "Merge with existing (This cannot be undone)". Frappe-free: `onRename`
 * performs the rename; a rejection is shown in the dialog and the dialog stays open. An unchanged name is not sent
 * (Desk's title dialog shows "Unchanged", toolbar.js:110-115).
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The document's current name. */
  name: string;
  /** Label of the name input (Desk: "New {label}" when autoname is `field:x`). Default "New Name". */
  nameLabel?: string;
  /** Offer "Merge with existing". Default true (Desk always offers it). */
  allowMerge?: boolean;
  /** Rename. Resolve when the server answered; reject to show the error and keep the dialog open. */
  onRename: (next: { newName: string; merge: boolean }) => Promise<unknown> | void;
}

export function RenameDialog({ open, onOpenChange, name, nameLabel, allowMerge = true, onRename }: RenameDialogProps) {
  const { t } = useLocale();
  const id = React.useId();
  const [value, setValue] = React.useState(name);
  const [merge, setMerge] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [note, setNote] = React.useState("");
  React.useEffect(() => { if (open) { setValue(name); setMerge(false); setError(""); setNote(""); } }, [open, name]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = value.trim();
    setError(""); setNote("");
    if (!next) { setError(t("r35NameRequired")); return; }
    if (next === name) { setNote(t("r35Unchanged")); return; }
    setBusy(true);
    try { await onRename({ newName: next, merge }); onOpenChange(false); }
    catch (err) { setError(errorText(err) || "Error"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fmt(t("r35RenameTitle"), name)}</DialogTitle>
            <DialogDescription className="sr-only">{fmt(t("r35RenameTitle"), name)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor={`${id}-name`}>{nameLabel ?? t("r35NewName")}</Label>
            <Input id={`${id}-name`} value={value} onChange={(e) => setValue(e.target.value)} aria-required="true" autoFocus aria-invalid={!!error || undefined} />
          </div>
          {allowMerge && (
            <div className="flex items-center gap-2 text-sm">
              <Checkbox id={`${id}-merge`} checked={merge} onCheckedChange={(v) => setMerge(v === true)} />
              <Label htmlFor={`${id}-merge`} className="font-normal">{t("r35Merge")}</Label>
            </div>
          )}
          {note && <p role="status" className="text-sm text-muted-foreground">{note}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("r35Cancel")}</Button>
            <Button type="submit" loading={busy}>{t("r35Rename")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
