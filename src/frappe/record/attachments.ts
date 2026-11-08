/**
 * Form-sidebar attachments, as Desk computes them (Frappe 15.110 `form/sidebar/attachments.js`) — pure helpers + the
 * server methods. Requests go through the package client (`uploadFile` for a local file; the JSON `call` for a library
 * file or a web link, which `upload_file` reads from `form_dict` — app.py:302-314).
 */
import type { AttachmentInfo, Check, DocPermissions } from "../contract";

/** handler.py:175-263 (multipart for a local file; JSON for `library_file_name` / `file_url`). */
export const UPLOAD_FILE_METHOD = "upload_file";
/** desk/form/utils.py:19-23 — whitelisted for DELETE / POST; reads `fid`. Desk sends `{ fid, dt, dn }` (attachments.js:218-225). */
export const REMOVE_ATTACH_METHOD = "frappe.desk.form.utils.remove_attach";
/** core/api/file.py:65-82 — the uploader's "Library" search (FileBrowser.vue:120-130). */
export const FILE_SEARCH_METHOD = "frappe.core.api.file.get_files_by_search_text";
/** Desk's folder for form attachments (attachments.js:253). */
export const ATTACHMENTS_FOLDER = "Home/Attachments";
/** Desk shows the last 10 attachments until "Show All" (attachments.js:7, 86-95). */
export const ATTACHMENTS_PAGE_LENGTH = 10;

const on = (v: Check | boolean | undefined | null) => v === true || v === 1 || (v as unknown) === "1";

/**
 * The rows Desk draws: without "Show All" only the LAST `pageLength` of the docinfo list (attachments.js:90-95), one per
 * `file_name` (the first of each, :98-103), and — each row inserted right after the header — in REVERSE order (:156-158).
 */
export function attachmentsToShow(list: AttachmentInfo[], showAll: boolean, pageLength = ATTACHMENTS_PAGE_LENGTH): { rows: AttachmentInfo[]; hasMore: boolean } {
  const hasMore = !showAll && list.length > pageLength;
  const slice = hasMore ? list.slice(list.length - pageLength) : list;
  const seen = new Set<string>();
  const unique = slice.filter((a) => (seen.has(a.file_name) ? false : (seen.add(a.file_name), true)));
  return { rows: unique.reverse(), hasMore };
}

/** `get_file_url` (attachments.js:176-197): `file_url`, else `/files/<file_name>`; URI-encoded, `#` too for local paths. */
export function attachmentUrl(a: Pick<AttachmentInfo, "file_url" | "file_name">): string {
  let url = a.file_url;
  if (!url) url = a.file_name.indexOf("files/") === 0 ? `/${a.file_name}` : `/files/${a.file_name}`;
  const web = /^(https?:)?\/\//i.test(url);
  url = encodeURI(url);
  return web ? url : url.replace(/#/g, "%23");
}

/**
 * `can_delete_attachment` (attachments.js:161-174): `write`, except on a DocType with `protect_attached_files` — draft:
 * write; cancelled: write AND delete; submitted: never. (The server decides with file.py:872-910 + 515-540.)
 */
export function canDeleteAttachment(opts: { protectAttachedFiles?: Check | boolean; docstatus?: number; perms: DocPermissions }): boolean {
  const write = !!opts.perms[0]?.write;
  if (!on(opts.protectAttachedFiles)) return write;
  if ((opts.docstatus ?? 0) === 0) return write;
  if (opts.docstatus === 2) return write && !!opts.perms[0]?.delete;
  return false;
}

/** `max_reached` (attachments.js:30-45): a limit is set and the count reached it. */
export function attachmentLimitReached(count: number, maxAttachments?: number | null): boolean {
  return !!maxAttachments && count >= maxAttachments;
}

/** Every attachment with the same `file_name` as the one removed — Desk deletes them all (attachments.js:137-146). */
export function attachmentsToRemove(list: AttachmentInfo[], id: string): AttachmentInfo[] {
  const target = list.find((a) => a.name === id);
  return target ? list.filter((a) => a.file_name === target.file_name) : [];
}
