/**
 * The Form Sidebar's server requests (Frappe 15.110), each followed by the contract's docinfo rule
 * (`applyDocInfoChange`: `docinfo` + `list` invalidated) — Desk re-reads docinfo after attachments change
 * (`frm.sidebar.reload_docinfo`, attachments.js:232, 271) and re-renders assignments / tags from the server's answer.
 * Assign / unassign stay in `useDocAction` (hooks/useDocMutations.ts).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { FrappeError } from "../client";
import type { AssignmentInfo, FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { applyDocInfoChange } from "../services/cache";
import { ATTACHMENTS_FOLDER, FILE_SEARCH_METHOD, REMOVE_ATTACH_METHOD, UPLOAD_FILE_METHOD } from "./attachments";
import { ADD_TAG_METHOD, GET_TAGS_METHOD, REMOVE_TAG_METHOD } from "./tags";

type Ref = { doctype: string; name: string };
export type UploadAttachmentVars = Ref & { file: Blob; filename: string; isPrivate: boolean };
export type AttachExistingVars = Ref & { libraryFileName: string };
export type AttachLinkVars = Ref & { fileUrl: string };
export type RemoveAttachmentVars = Ref & { fid: string };
export type TagVars = Ref & { tag: string };
export type CloseAssignmentVars = Ref & { user: string };

export interface FormSidebarActions {
  /** `upload_file` multipart (FileUploader.vue:656-698): file, is_private, folder "Home/Attachments", doctype, docname. */
  upload: UseMutationResult<FrappeDoc, FrappeError, UploadAttachmentVars>;
  /** `upload_file` with `library_file_name` (FileUploader.vue:536-546; handler.py:208-218). */
  attachExisting: UseMutationResult<FrappeDoc, FrappeError, AttachExistingVars>;
  /** `upload_file` with `file_url` (FileUploader.vue:547-559). */
  attachLink: UseMutationResult<FrappeDoc, FrappeError, AttachLinkVars>;
  /** `remove_attach` { fid, dt, dn } (attachments.js:211-236). */
  removeAttachment: UseMutationResult<void, FrappeError, RemoveAttachmentVars>;
  /** `add_tag` { tag, dt, dn } (tag_editor.js:35-48). */
  addTag: UseMutationResult<string, FrappeError, TagVars>;
  /** `remove_tag` { tag, dt, dn } (tag_editor.js:50-63). */
  removeTag: UseMutationResult<void, FrappeError, TagVars>;
  /** `assign_to.close` { doctype, name, assign_to } — the assignee's "Done" (assign_to.js:317-323, 344-356). */
  closeAssignment: UseMutationResult<AssignmentInfo[], FrappeError, CloseAssignmentVars>;
}

export function useFormSidebarActions(): FormSidebarActions {
  const api = useFrappeApi();
  const qc = useQueryClient();
  const after = (_r: unknown, v: Ref) => void applyDocInfoChange(qc, v.doctype, v.name);
  const fileDoc = (r: { message?: unknown }) => (r.message ?? {}) as FrappeDoc;
  return {
    upload: useMutation<FrappeDoc, FrappeError, UploadAttachmentVars>({
      mutationFn: ({ doctype, name, file, filename, isPrivate }) => api.uploadFile(file, filename, { doctype, docname: name, isPrivate, folder: ATTACHMENTS_FOLDER }),
      onSuccess: after,
    }),
    attachExisting: useMutation<FrappeDoc, FrappeError, AttachExistingVars>({
      mutationFn: async ({ doctype, name, libraryFileName }) => fileDoc(await api.call(UPLOAD_FILE_METHOD, { library_file_name: libraryFileName, folder: ATTACHMENTS_FOLDER, doctype, docname: name })),
      onSuccess: after,
    }),
    attachLink: useMutation<FrappeDoc, FrappeError, AttachLinkVars>({
      mutationFn: async ({ doctype, name, fileUrl }) => fileDoc(await api.call(UPLOAD_FILE_METHOD, { file_url: fileUrl, is_private: 0, folder: ATTACHMENTS_FOLDER, doctype, docname: name })),
      onSuccess: after,
    }),
    removeAttachment: useMutation<void, FrappeError, RemoveAttachmentVars>({
      mutationFn: async ({ doctype, name, fid }) => { await api.call(REMOVE_ATTACH_METHOD, { fid, dt: doctype, dn: name }); },
      onSuccess: after,
    }),
    addTag: useMutation<string, FrappeError, TagVars>({
      mutationFn: async ({ doctype, name, tag }) => { const r = await api.call(ADD_TAG_METHOD, { tag, dt: doctype, dn: name }); return typeof r.message === "string" ? r.message : tag; },
      onSuccess: after,
    }),
    removeTag: useMutation<void, FrappeError, TagVars>({
      mutationFn: async ({ doctype, name, tag }) => { await api.call(REMOVE_TAG_METHOD, { tag, dt: doctype, dn: name }); },
      onSuccess: after,
    }),
    closeAssignment: useMutation<AssignmentInfo[], FrappeError, CloseAssignmentVars>({
      mutationFn: async ({ doctype, name, user }) => {
        const r = await api.call("frappe.desk.form.assign_to.close", { doctype, name, assign_to: user });
        return Array.isArray(r.message) ? (r.message as AssignmentInfo[]) : [];
      },
      onSuccess: after,
    }),
  };
}

/** Existing Tag names for the typed text (tag_editor.js:84-96: `get_tags({ doctype, txt: value.toLowerCase() })`). */
export async function searchTags(api: ReturnType<typeof useFrappeApi>, doctype: string, txt: string): Promise<string[]> {
  const r = await api.call(GET_TAGS_METHOD, { doctype, txt: txt.toLowerCase() });
  return Array.isArray(r.message) ? r.message.map(String) : [];
}

/** The uploader's "Library" search (FileBrowser.vue:120-130). Blank text answers nothing (file.py:67-68). */
export async function searchFiles(api: ReturnType<typeof useFrappeApi>, text: string): Promise<{ name: string; file_name: string; file_url: string }[]> {
  if (!text.trim()) return [];
  const r = await api.call(FILE_SEARCH_METHOD, { text });
  return Array.isArray(r.message) ? (r.message as { name: string; file_name: string; file_url: string }[]) : [];
}
