/**
 * FrappeAttachments — the form sidebar's "Attachments" section (Frappe 15.110 `form/sidebar/attachments.js`,
 * `form_sidebar.html:57-81`) over the package client: the files of `docinfo.attachments` (the shared docinfo query,
 * `useDocInfo`), the last 10 until "Show All", one per file name, newest drawn last as Desk does; "+" opens the uploader
 * (local files through `upload_file` — never kept locally —, the Library and a web link); "×" deletes after a
 * confirmation every attachment with that file name (`remove_attach`). After each server answer the docinfo is re-read.
 *
 * Rights (server = authority): the "+" is offered with `write` on the document (upload_file → check_write_permission,
 * handler.py:220-221, 266-282) and hidden once `max_attachments` is reached (attachments.js:54-55); remove follows
 * `can_delete_attachment` (attachments.js:161-174). The server's refusal is shown either way.
 */
import * as React from "react";
import { Paperclip } from "lucide-react";
import { AttachDialog } from "../../record/AttachDialog";
import { AttachmentList } from "../../record/AttachmentList";
import { SidebarSection } from "../../record/SidebarSection";
import { fmt } from "../../record/format";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeDoc, MetaBundle } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { useDoc, useDocInfo, useMetaBundle } from "../hooks";
import { usePermissions } from "../hooks/usePermissions";
import { attachmentLimitReached, attachmentsToRemove, attachmentsToShow, attachmentUrl, canDeleteAttachment } from "./attachments";
import { searchFiles, useFormSidebarActions } from "./useFormSidebarActions";

export interface FrappeAttachmentsProps {
  doctype: string;
  name: string;
  /** Hide every change (add / remove). */
  readOnly?: boolean;
  /** The document / meta when the page has them (else read through the shared queries). */
  doc?: FrappeDoc;
  bundle?: MetaBundle;
  /** Desk's "Attachments" label opens the File list filtered on this document (attachments.js:18-25). */
  onOpenFileList?: (filters: { attached_to_doctype: string; attached_to_name: string }) => void;
  /** Link of each file's lock icon. Default: Desk's `/app/file/{name}`; return undefined for none. */
  fileRecordHref?: (fileName: string) => string | undefined;
  /** The uploader's Library / Link sources (default: both on). */
  library?: boolean;
  webLink?: boolean;
  className?: string;
}

export function FrappeAttachments({ doctype, name, readOnly, doc: givenDoc, bundle: givenBundle, onOpenFileList, fileRecordHref = (n) => `/app/file/${encodeURIComponent(n)}`, library = true, webLink = true, className }: FrappeAttachmentsProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const docQ = useDoc(givenDoc ? undefined : doctype, givenDoc ? undefined : name);
  const metaQ = useMetaBundle(givenBundle ? undefined : doctype);
  const doc = givenDoc ?? docQ.data?.doc;
  const bundle = givenBundle ?? metaQ.data;
  const infoQ = useDocInfo(doc && !doc.__islocal ? doctype : undefined, name);
  const info = infoQ.data;
  const perms = usePermissions(bundle, doc, info);
  const actions = useFormSidebarActions();
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  if (doc?.__islocal) return null; // attachments.js:47-50
  const list = info?.attachments ?? [];
  const meta = (bundle?.meta ?? {}) as Record<string, unknown>;
  const max = Number(meta.max_attachments ?? 0) || 0;
  const reached = attachmentLimitReached(list.length, max);
  const canAdd = !readOnly && perms.can("write") && !reached;
  const canRemove = !readOnly && canDeleteAttachment({ protectAttachedFiles: meta.protect_attached_files as 0 | 1, docstatus: doc?.docstatus, perms: perms.levels });
  const { rows, hasMore } = attachmentsToShow(list, showAll);
  const ref = { doctype, name };

  return (
    <SidebarSection id="attachments" label={t("sbAttachments")} icon={Paperclip} busy={infoQ.isFetching}
      onLabelClick={list.length && onOpenFileList ? () => onOpenFileList({ attached_to_doctype: doctype, attached_to_name: name }) : undefined}
      action={canAdd ? { label: t("sbAttachAdd"), onClick: () => setOpen(true) } : undefined} className={className}>
      {!info && infoQ.isLoading ? <Skeleton className="h-6 w-full" /> : infoQ.error && !info ? (
        <p role="alert" className="text-xs text-destructive">{infoQ.error.message || t("sbLoadFailed")}</p>
      ) : (
        <AttachmentList
          items={rows.map((a) => ({ id: a.name, fileName: a.file_name || a.file_url, fileUrl: attachmentUrl(a), isPrivate: !!Number(a.is_private) }))}
          hasMore={hasMore} onShowAll={() => setShowAll(true)} canRemove={canRemove} fileRecordHref={(i) => fileRecordHref(i.id)}
          onRemove={async (item) => {
            // Desk removes every attachment with this file name (attachments.js:137-146), one request each
            for (const a of attachmentsToRemove(list, item.id)) await actions.removeAttachment.mutateAsync({ ...ref, fid: a.name });
          }}
        />
      )}
      {canAdd || open ? (
        <AttachDialog open={open} onOpenChange={setOpen}
          defaultPrivate={!Number(meta.make_attachments_public ?? 0)}
          maxFiles={max ? Math.max(0, max - list.length) : undefined}
          note={max ? fmt(t("sbAttachRemaining"), Math.max(0, max - list.length)) : undefined}
          onUpload={(file, isPrivate) => actions.upload.mutateAsync({ ...ref, file, filename: file.name, isPrivate })}
          {...(library ? {
            searchLibrary: async (text: string) => (await searchFiles(api, text)).map((f) => ({ id: f.name, fileName: f.file_name || f.file_url, fileUrl: f.file_url })),
            onAttachExisting: (f: { id: string }) => actions.attachExisting.mutateAsync({ ...ref, libraryFileName: f.id }),
          } : {})}
          {...(webLink ? { onAttachLink: (url: string) => actions.attachLink.mutateAsync({ ...ref, fileUrl: url }) } : {})}
        />
      ) : null}
      {reached && !readOnly && perms.can("write") ? <p className="text-[11px] text-muted-foreground">{fmt(t("sbAttachLimit"), max)}</p> : null}
    </SidebarSection>
  );
}
