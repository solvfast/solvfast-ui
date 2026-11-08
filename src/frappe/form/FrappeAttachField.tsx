/**
 * Attach / Attach Image — Desk's attach controls (Frappe 15.110 `form/controls/attach.js`, `attach_image.js`) over the
 * package client. UI: Core `AttachInput` (the "Attach" button / the `.attached-file` row) + the Form Sidebar's
 * `AttachDialog` (Desk's `FileUploader` dialog: My Device, Library, Link; private switch).
 *
 * - "Attach" opens the uploader with Desk's options (attach.js:70-93, FileUploader.vue): ONE file; Attach Image accepts
 *   `image/*` only (attach_image.js:171-174); each file private unless the field (`make_attachment_public`) or the
 *   DocType (`make_attachments_public`) says public (FileUploader.vue:443); the site's `max_file_size`
 *   (`frappe.core.api.file.get_max_file_size`, read each time the uploader opens — FileUploader.vue:352-356; a file must
 *   be SMALLER, :491-493).
 * - Requests (FileUploader.vue:656-698, :536-559): `upload_file` with `doctype` + `docname` + `fieldname` whenever the
 *   control has a document — a NEW document too (its `new-…` name: handler.py:276-280 checks `write` on a new doc, and
 *   savedocs relinks the File when the document is inserted, desk/form/save.py:20-22 → file/utils.py:377-419); folder
 *   "Home"; a local file multipart (`is_private`), a Library file as `library_file_name`, a web link as `file_url`.
 * - Success (attach.js:137-144): the value becomes the File's `file_url`, the document's docinfo is re-read (Desk
 *   `update_attachment` + `reload_docinfo`), and — inside a form (`FrappeAttachHost`) — the form is SAVED (`Update` on a
 *   submitted document). "Reload File" re-sends this session's last local file (attach.js:56-60, 146-150).
 * - "Clear" (attach.js:36-55) asks first; in a form: value null → `remove_attach { fid, dt, dn }` for the File of that
 *   URL in docinfo (none → no request, attachments.js:199-215) → save; a refusal is shown and nothing is saved. Outside a
 *   form only the value is cleared.
 * - Attach Image: hovering / focusing the link previews the image (attach_image.js:156-169).
 * Not reproduced (listed in docs/components/forms.md): the uploader's Camera, image crop and "Optimize" switch; Google
 * Drive.
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { AttachInput } from "../../fields/AttachInput";
import { AttachDialog, type LibraryFile } from "../../record/AttachDialog";
import { errorText } from "../../record/format";
import { useLocale } from "../../theme/ThemeProvider";
import { useFrappeApi } from "../FrappeProvider";
import { frappeKeys, type AttachmentInfo, type DocInfo, type FrappeDoc, type FrappeDocField, type MetaBundle } from "../contract";
import { applyDocInfoChange } from "../services/cache";
import { REMOVE_ATTACH_METHOD, UPLOAD_FILE_METHOD } from "../record/attachments";
import { searchFiles } from "../record/useFormSidebarActions";
import { attachSaveAction, useAttachHost } from "./attachHost";

/** core/api/file.py:86-91 — System Settings `max_file_size` (MB) × 1 MiB, else site config, else 25 MiB. */
export const MAX_FILE_SIZE_METHOD = "frappe.core.api.file.get_max_file_size";
/** FileUploader.vue:270-272 — the uploader's default folder (the attach controls pass none). */
export const ATTACH_FIELD_FOLDER = "Home";

export interface FrappeAttachFieldProps {
  id: string;
  df: FrappeDocField;
  value: string | null;
  onChange: (value: string | null) => void;
  /** The form's document (in a grid: the parent) — the File is attached to it (attach.js:80-87), a new one too. */
  doctype?: string;
  docname?: string;
  bundle?: MetaBundle;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

/** What `set_upload_options` (attach.js:70-93) gives the uploader for this control. */
export function attachUploadOptions(df: FrappeDocField, bundle?: MetaBundle, doctype?: string, docname?: string, imageOnly = false) {
  const meta = (bundle?.meta ?? {}) as Record<string, unknown>;
  const isPublic = !!Number(df.make_attachment_public ?? 0) || !!Number(meta.make_attachments_public ?? 0);
  const attached = !!doctype && !!docname;
  return {
    /** FileUploader.vue:680-687: doctype + docname only together; fieldname with them (the control's `frm`). */
    target: attached ? { doctype: doctype!, docname: docname!, fieldname: df.fieldname } : undefined,
    defaultPrivate: !isPublic,
    accept: imageOnly || df.fieldtype === "Attach Image" ? "image/*" : undefined,
  };
}

/** The File of `url` among the document's attachments (`get_file_id_from_file_url`, attachments.js:199-207). */
export function fileIdForUrl(attachments: Pick<AttachmentInfo, "name" | "file_url">[] | undefined, url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return attachments?.find((a) => a.file_url === url)?.name;
}

export interface UseFrappeAttachOptions {
  df: FrappeDocField;
  bundle?: MetaBundle;
  doctype?: string;
  docname?: string;
  /** Restrict the uploader to images (Attach Image; the image_field "Upload", attach.js:65-69). */
  imageOnly?: boolean;
  /** The document's docinfo when the caller holds it (else the docinfo query cache, else the form host's). */
  getDocInfo?: () => DocInfo | undefined;
  /** The upload succeeded: Desk's `on_upload_complete` (attach.js:137-144). */
  onUploaded: (fileUrl: string, file: FrappeDoc) => void;
}

/**
 * The server side of an attach control, shared by `FrappeAttachField` and the form's image_field menu: the uploader
 * dialog (`dialog` — render it), `open()`, `reload` (this session's last local file), `removeByUrl(url)`
 * (`remove_attachment_by_filename`) and the last refusal (`failure`).
 */
export function useFrappeAttach(o: UseFrappeAttachOptions) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const qc = React.useContext(QueryClientContext);
  const host = useAttachHost();
  const [open, setOpen] = React.useState(false);
  const [maxSize, setMaxSize] = React.useState<number | undefined>(undefined);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [last, setLast] = React.useState<{ file: File; isPrivate: boolean } | null>(null);
  const uploaded = React.useRef<FrappeDoc[]>([]);
  const opts = attachUploadOptions(o.df, o.bundle, o.doctype, o.docname, o.imageOnly);
  const target = opts.target;
  const latest = React.useRef(o);
  latest.current = o;

  const refreshDocInfo = () => {
    if (qc && target && !target.docname.startsWith("new-")) void applyDocInfoChange(qc, target.doctype, target.docname);
  };
  const done = (doc: FrappeDoc | undefined): FrappeDoc => {
    const url = typeof doc?.file_url === "string" ? doc.file_url : "";
    if (!url) throw new Error(t("attachFailed"));
    uploaded.current.push(doc!);
    refreshDocInfo();
    setFailure(null);
    latest.current.onUploaded(url, doc!);
    return doc!;
  };
  const fileDoc = (r: { message?: unknown }) => (r.message ?? undefined) as FrappeDoc | undefined;
  const json = target ? { doctype: target.doctype, docname: target.docname, fieldname: target.fieldname } : {};

  const uploadLocal = async (file: File, isPrivate: boolean) => {
    const doc = await api.uploadFile(file, file.name, { ...(target ?? {}), isPrivate });
    setLast({ file, isPrivate });
    return done(doc);
  };
  const attachExisting = async (f: LibraryFile) => done(fileDoc(await api.call(UPLOAD_FILE_METHOD, { library_file_name: f.id, folder: ATTACH_FIELD_FOLDER, ...json })));
  const attachLink = async (url: string) => done(fileDoc(await api.call(UPLOAD_FILE_METHOD, { file_url: url, is_private: 0, folder: ATTACH_FIELD_FOLDER, ...json })));

  const openUploader = () => {
    setFailure(null);
    setOpen(true);
    void api.call(MAX_FILE_SIZE_METHOD, {}).then((r) => { const n = Number(r.message); setMaxSize(n > 0 ? n : undefined); }, () => { /* no limit known: the server decides */ });
  };

  const reload = last ? async () => {
    setFailure(null);
    try { await uploadLocal(last.file, last.isPrivate); } catch (e) { setFailure(errorText(e) || t("attachFailed")); }
  } : undefined;

  /** `remove_attachment_by_filename` (attachments.js:208-236): true when removed or nothing to remove. */
  const removeByUrl = async (url: string | null | undefined): Promise<boolean> => {
    const doc = host?.getDoc();
    const dt = String(doc?.doctype ?? target?.doctype ?? ""), dn = String(doc?.name ?? target?.docname ?? "");
    const cached = dt && dn ? qc?.getQueryData<DocInfo>(frappeKeys.docinfo(dt, dn))?.attachments : undefined;
    const known = [...(cached ?? latest.current.getDocInfo?.()?.attachments ?? host?.getDocInfo?.()?.attachments ?? []), ...uploaded.current.map((d) => ({ name: String(d.name), file_url: String(d.file_url ?? "") }))];
    const fid = fileIdForUrl(known, url);
    if (!fid) return true;
    try {
      await api.call(REMOVE_ATTACH_METHOD, { fid, dt, dn });
      uploaded.current = uploaded.current.filter((d) => d.name !== fid);
      if (qc && dt && dn) void applyDocInfoChange(qc, dt, dn);
      return true;
    } catch (e) {
      setFailure(errorText(e) || t("formAttachErrors"));
      return false;
    }
  };

  const dialog = (
    <AttachDialog open={open} onOpenChange={setOpen} maxFiles={1} accept={opts.accept} maxSize={maxSize != null ? maxSize - 1 : undefined}
      defaultPrivate={opts.defaultPrivate}
      onUpload={(file, isPrivate) => uploadLocal(file, isPrivate)}
      searchLibrary={async (text) => (await searchFiles(api, text)).map((f) => ({ id: f.name, fileName: f.file_name || f.file_url, fileUrl: f.file_url }))}
      onAttachExisting={attachExisting}
      onAttachLink={attachLink} />
  );
  return { open: openUploader, dialog, isOpen: open, reload, removeByUrl, failure, setFailure, host };
}

export function FrappeAttachField({ id, df, value, onChange, doctype, docname, bundle, disabled, invalid, ...aria }: FrappeAttachFieldProps) {
  const host = useAttachHost();
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const a = useFrappeAttach({
    df, bundle, doctype, docname,
    onUploaded: (url) => {
      onChange(url); // attach.js:139 / 143
      if (host) void host.save(attachSaveAction(host.getDoc())); // :141
    },
  });

  const clear = async () => {
    const url = valueRef.current;
    a.setFailure(null);
    onChange(null); // attach.js:40 (with frm) / :50-51 (without)
    if (!host) return;
    if (!(await a.removeByUrl(url))) return; // :42 — a refusal: no save
    await host.save(attachSaveAction(host.getDoc())); // :43-45
  };

  return (
    <>
      <AttachInput id={id} value={value} image={df.fieldtype === "Attach Image"} disabled={disabled} invalid={invalid} error={a.failure}
        onAttach={a.open} onClear={clear} onReload={a.reload}
        aria-describedby={aria["aria-describedby"]} aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-label"] ? undefined : `${id}-label ${id}-attach-text`} />
      {a.dialog}
    </>
  );
}
