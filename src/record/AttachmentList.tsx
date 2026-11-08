/**
 * AttachmentList — the files attached to a record, as Desk's form sidebar lists them (Frappe 15.110
 * `form/sidebar/attachments.js:86-159`): one row per file — a lock / unlock icon (private / public; Desk links it to the
 * File record) and the file name linking to the file in a new tab — with a remove "×" when the host allows it, which asks
 * "Are you sure you want to delete the attachment?" first (:137-149). "Show All" when the host has more rows than it
 * shows (:63-80). Frappe-free: the host decides the rows, the rights, and performs the removal; a rejected removal is
 * shown under the list and the row stays.
 */
import * as React from "react";
import { Lock, LockOpen, X } from "lucide-react";
import { cn } from "../lib/cn";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export interface AttachmentItem {
  /** The File's name (id). */
  id: string;
  fileName: string;
  /** Where the file opens (already URL-encoded by the host). */
  fileUrl: string;
  isPrivate: boolean;
}

export interface AttachmentListLabels { none?: string; showAll?: string; remove?: string; confirm?: string; confirmAction?: string; cancel?: string; openFile?: string; private?: string; public?: string }

export interface AttachmentListProps {
  items: AttachmentItem[];
  /** More rows exist than `items` (Desk: more than 10) → a "Show All" button calling `onShowAll`. */
  hasMore?: boolean;
  onShowAll?: () => void;
  /** Remove a file (after the confirmation). Omit, or `canRemove` false, for no remove buttons. */
  onRemove?: (item: AttachmentItem) => void | Promise<unknown>;
  canRemove?: boolean;
  /** Link of the lock icon (Desk: `/app/file/{name}`). Undefined → a plain icon. */
  fileRecordHref?: (item: AttachmentItem) => string | undefined;
  /** Text when there are no rows (Desk shows nothing). Null hides it. */
  empty?: React.ReactNode;
  labels?: AttachmentListLabels;
  className?: string;
}

export function AttachmentList({ items, hasMore, onShowAll, onRemove, canRemove, fileRecordHref, empty, labels, className }: AttachmentListProps) {
  const { t } = useLocale();
  const L = {
    none: labels?.none ?? t("sbAttachNone"), showAll: labels?.showAll ?? t("sbAttachShowAll"), remove: labels?.remove ?? t("sbAttachRemove"),
    confirm: labels?.confirm ?? t("sbAttachRemoveConfirm"), confirmAction: labels?.confirmAction ?? t("sbAttachDelete"), cancel: labels?.cancel ?? t("recCancel"),
    openFile: labels?.openFile ?? t("sbAttachOpenFile"), private: labels?.private ?? t("sbAttachPrivate"), public: labels?.public ?? t("sbAttachPublic"),
  };
  const [pending, setPending] = React.useState<AttachmentItem | null>(null);
  const [removing, setRemoving] = React.useState("");
  const [error, setError] = React.useState("");
  const removable = !!onRemove && !!canRemove;

  const remove = async (item: AttachmentItem) => {
    setRemoving(item.id); setError("");
    try { await onRemove?.(item); } catch (e) { setError(errorText(e) || t("attachFailed")); } finally { setRemoving(""); }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {items.length === 0 ? (empty === null ? null : <p className="text-xs text-muted-foreground">{empty ?? L.none}</p>) : (
        <ul className="space-y-1" aria-label={t("sbAttachments")}>
          {items.map((item) => {
            const href = fileRecordHref?.(item);
            const Icon = item.isPrivate ? Lock : LockOpen;
            const state = item.isPrivate ? L.private : L.public;
            const icon = <Icon className="h-3.5 w-3.5" aria-hidden />;
            return (
              <li key={item.id} data-attachment={item.id} className="group flex min-w-0 items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs">
                {href ? (
                  <a href={href} title={`${state} · ${fmt(L.openFile, item.fileName)}`} aria-label={`${state} · ${fmt(L.openFile, item.fileName)}`}
                    className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{icon}</a>
                ) : <span className="shrink-0 text-muted-foreground" title={state} role="img" aria-label={state}>{icon}</span>}
                <a href={item.fileUrl} target="_blank" rel="noreferrer noopener" title={item.fileName} dir="auto"
                  className="min-w-0 flex-1 truncate text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  {item.fileName}
                </a>
                {removable ? (
                  <button type="button" disabled={removing === item.id} onClick={() => setPending(item)} aria-label={fmt(L.remove, item.fileName)} title={fmt(L.remove, item.fileName)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && onShowAll ? (
        <button type="button" onClick={onShowAll} className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{L.showAll}</button>
      ) : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirm}</AlertDialogTitle>
            <AlertDialogDescription dir="auto">{pending?.fileName}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const p = pending; setPending(null); if (p) void remove(p); }}>{L.confirmAction}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
