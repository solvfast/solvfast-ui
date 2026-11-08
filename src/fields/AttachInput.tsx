/**
 * AttachInput — the Core UI of an attach control, as Desk draws it (Frappe 15.110 `form/controls/attach.js:2-35`,
 * `attach_image.js:153-170`), without any uploading of its own:
 * - empty: an "Attach" button (`btn-attach`); the host opens its uploader from `onAttach` (Desk: `FileUploader`);
 * - with a value: the `.attached-file` row — a link icon, the file link (text = the value, attach.js:107-113; a
 *   `FILENAME,DATA_URL` value shows the file name and links the data URL, attach.js:99-106), "Reload File" when the host
 *   can re-send the last upload (attach.js:22, 56-60, 146-150) and "Clear";
 * - `image`: hovering or focusing the link shows the image, 150px wide, `object-fit: contain` (attach_image.js:156-169);
 * - "Clear" asks "Are you sure you want to delete the attachment?" first (attach.js:36-38) unless `confirmClear` is false.
 * `busy` disables the buttons and says "Uploading…"; `error` is shown under the control (role="alert").
 */
import * as React from "react";
import { Link2, Paperclip } from "lucide-react";
import { Button } from "../primitives/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../primitives/hover-card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

export interface AttachInputLabels {
  attach?: string;
  uploading?: string;
  clear?: string;
  reload?: string;
  /** The Clear confirmation. */
  confirmClear?: string;
  /** Accessible name of the preview image; `{0}` = the file name. */
  preview?: string;
}

export interface AttachInputProps {
  id?: string;
  /** The stored value: a file URL, or Desk's `FILENAME,DATA_URL` form. */
  value: string | null | undefined;
  /** Opens the host's uploader. */
  onAttach: () => void;
  /** Clears the value (after the confirmation). Omit to offer no Clear. A promise keeps the control busy until it settles. */
  onClear?: () => void | Promise<unknown>;
  /** Ask before clearing (Desk does). Default true. */
  confirmClear?: boolean;
  /** "Reload File": re-send the last upload. Omit to hide the button. */
  onReload?: () => void | Promise<unknown>;
  /** Attach Image: a preview of the image on hover / focus of the link. */
  image?: boolean;
  /** Milliseconds before the preview opens (default 200). */
  previewDelay?: number;
  busy?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** A message under the control (an upload or removal refusal). */
  error?: React.ReactNode;
  labels?: AttachInputLabels;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/** attach.js:99-106 — `FILENAME,DATA_URL` (a file name may itself contain ","). Otherwise the text and link are the value. */
export function parseAttachValue(value: string): { text: string; href: string; fileName: string } {
  const m = value.match(/^([^:]+),(.+):(.+)$/);
  if (m) return { text: m[1]!, href: `${m[2]}:${m[3]}`, fileName: m[1]! };
  let fileName = value.split("?")[0]!.split("/").pop() || value;
  try { fileName = decodeURIComponent(fileName); } catch { /* keep it encoded */ }
  return { text: value, href: value, fileName };
}

export function AttachInput({
  id, value, onAttach, onClear, confirmClear = true, onReload, image, previewDelay = 200, busy, disabled, invalid, error, labels, className, ...aria
}: AttachInputProps) {
  const { t } = useLocale();
  const L = {
    attach: labels?.attach ?? t("attach"),
    uploading: labels?.uploading ?? t("attachUploading"),
    clear: labels?.clear ?? t("attachClear"),
    reload: labels?.reload ?? t("formAttachReload"),
    confirmClear: labels?.confirmClear ?? t("sbAttachRemoveConfirm"),
    preview: labels?.preview ?? t("formAttachPreview"),
  };
  const [asking, setAsking] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const isBusy = !!busy || working;
  const errId = id ? `${id}-attach-msg` : undefined;
  const describedBy = [aria["aria-describedby"], error && errId ? errId : undefined].filter(Boolean).join(" ") || undefined;

  const run = async (fn?: () => void | Promise<unknown>) => {
    if (!fn) return;
    const r = fn();
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setWorking(true);
      try { await r; } catch { /* the host shows its error */ } finally { setWorking(false); }
    }
  };
  const clear = () => (confirmClear ? setAsking(true) : void run(onClear));

  const parsed = value ? parseAttachValue(value) : null;
  const link = parsed ? (
    <a href={parsed.href} target="_blank" rel="noreferrer" dir="ltr" data-attached-file-link=""
      className="min-w-0 truncate text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {parsed.text}
    </a>
  ) : null;

  return (
    <div className={cn("space-y-2", className)} data-attach-field="" data-busy={isBusy || undefined}>
      {parsed ? (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5" data-attached-file="">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {image ? (
              <HoverCard openDelay={previewDelay} closeDelay={100}>
                <HoverCardTrigger asChild>{link}</HoverCardTrigger>
                <HoverCardContent side="top" className="w-auto p-2" data-attach-preview="">
                  <img src={parsed.href} alt={L.preview.replace("{0}", parsed.fileName)} width={150} style={{ objectFit: "contain" }} className="block max-w-[150px]" />
                </HoverCardContent>
              </HoverCard>
            ) : link}
          </div>
          {!disabled && (onReload || onClear) ? (
            <div className="flex shrink-0 items-center gap-1">
              {onReload ? (
                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={isBusy} onClick={() => void run(onReload)}>{L.reload}</Button>
              ) : null}
              {onClear ? (
                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={isBusy} aria-describedby={describedBy} onClick={clear}>{L.clear}</Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" id={id} className={cn("gap-1.5", invalid && "border-destructive")} disabled={disabled || isBusy}
          aria-busy={isBusy || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          {...(aria["aria-label"] ? { "aria-label": `${aria["aria-label"]} ${isBusy ? L.uploading : L.attach}` } : {})}
          {...(!aria["aria-label"] && aria["aria-labelledby"] ? { "aria-labelledby": aria["aria-labelledby"] } : {})}
          onClick={onAttach}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          <span id={id ? `${id}-attach-text` : undefined}>{isBusy ? L.uploading : L.attach}</span>
        </Button>
      )}
      {error ? <p id={errId} role="alert" className="whitespace-pre-line text-xs text-destructive">{error}</p> : null}
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirmClear}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">{parsed?.fileName ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("no")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setAsking(false); void run(onClear); }}>{t("yes")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
