/**
 * Document mutations with the contract's invalidation rules (services/cache.ts). The server stays the authority:
 * these only send Desk's own requests and update the cache from what the server answers.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { FrappeError } from "../client";
import type { AssignmentInfo, CommentInfo, FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { applyDeletedDoc, applyDocInfoChange, applyRenamedDoc, applySavedDoc } from "../services/cache";

export type SaveDocVars = { doc: FrappeDoc; action: "Save" | "Submit" | "Update" };

/**
 * savedocs (Save / Submit / Update). On success: `doc` set (under the server's name — a new doc's `new-…` keys are
 * dropped), `docinfo`, `list`, `count` invalidated. The response doc carries `localname` for a new doc (Desk relinks
 * with it). A queued submission (`__queued`) invalidates `doc` instead.
 */
export function useSaveDoc(): UseMutationResult<FrappeDoc, FrappeError, SaveDocVars> {
  const api = useFrappeApi();
  const qc = useQueryClient();
  return useMutation<FrappeDoc, FrappeError, SaveDocVars>({
    mutationFn: ({ doc, action }) => api.saveDoc(doc, action),
    onSuccess: (saved, { doc }) => void applySavedDoc(qc, saved, { previousName: doc.name }),
  });
}

export type CancelVars = { doctype: string; name: string; workflowStateField?: string; workflowState?: string };
export type RemoveVars = { doctype: string; name: string };
export type RenameVars = { doctype: string; name: string; newName: string; merge?: boolean };
export type RunMethodVars = { doc: FrappeDoc; method: string; args?: Record<string, unknown> };
export type WorkflowVars = { doc: FrappeDoc; action: string };
export type AssignVars = { doctype: string; name: string; users: string[]; description?: string; date?: string; priority?: "Low" | "Medium" | "High" };
export type UnassignVars = { doctype: string; name: string; user: string };
export type AddCommentVars = { doctype: string; name: string; content: string };
export type CommentVars = { doctype: string; name: string; commentName: string; content?: string };

export interface DocActions {
  /** desk.form.save.cancel → `doc` set; `docinfo`, `list`, `count` invalidated. */
  cancel: UseMutationResult<FrappeDoc, FrappeError, CancelVars>;
  /** frappe.client.delete → `doc` + `docinfo` removed; `list`, `count` invalidated. */
  remove: UseMutationResult<void, FrappeError, RemoveVars>;
  /** frappe.rename_doc → resolves to the new name; old keys removed, the doc re-read under the new name. */
  rename: UseMutationResult<string, FrappeError, RenameVars>;
  /** run_doc_method → `{ doc, message }`. The cache is NOT changed (the method may or may not have saved; Desk syncs
   *  the returned doc into the open form — the caller decides); invalidate with `applySavedDoc` if it saved. */
  runMethod: UseMutationResult<{ doc?: FrappeDoc; message?: unknown }, FrappeError, RunMethodVars>;
  /** apply_workflow (the server re-reads the doc from the DB: save first) → `doc` set; `docinfo`, `list`, `count`. */
  applyWorkflow: UseMutationResult<FrappeDoc, FrappeError, WorkflowVars>;
  /** assign_to.add → `docinfo` + `list` invalidated. Resolves to ≤ 5 open assignments (Frappe's cap). */
  assign: UseMutationResult<AssignmentInfo[], FrappeError, AssignVars>;
  /** assign_to.remove → `docinfo` + `list` invalidated. */
  unassign: UseMutationResult<AssignmentInfo[], FrappeError, UnassignVars>;
  /** add_comment → `docinfo` + `list` invalidated. */
  addComment: UseMutationResult<CommentInfo, FrappeError, AddCommentVars>;
  /** update_comment → `docinfo` invalidated. */
  updateComment: UseMutationResult<void, FrappeError, CommentVars>;
  /** Comment delete (frappe.client.delete; needs delete on Comment — System / Website Manager) → `docinfo` invalidated. */
  deleteComment: UseMutationResult<void, FrappeError, CommentVars>;
}

/** Contract: `{ cancel, remove, rename, runMethod }`; the record actions (workflow, assignment, comments) are here too
 *  so that every cache rule lives in one place. */
export function useDocAction(): DocActions {
  const api = useFrappeApi();
  const qc = useQueryClient();
  const cancel = useMutation<FrappeDoc, FrappeError, CancelVars>({
    mutationFn: ({ doctype, name, workflowStateField, workflowState }) => api.cancelDoc(doctype, name, { workflowStateField, workflowState }),
    onSuccess: (doc, v) => void applySavedDoc(qc, { ...doc, doctype: doc.doctype || v.doctype, name: doc.name || v.name }),
  });
  const remove = useMutation<void, FrappeError, RemoveVars>({
    mutationFn: ({ doctype, name }) => api.deleteDoc(doctype, name),
    onSuccess: (_r, v) => void applyDeletedDoc(qc, v.doctype, v.name),
  });
  const rename = useMutation<string, FrappeError, RenameVars>({
    mutationFn: ({ doctype, name, newName, merge }) => api.renameDoc(doctype, name, newName, { merge }),
    onSuccess: (newName, v) => void applyRenamedDoc(qc, v.doctype, v.name, newName),
  });
  const runMethod = useMutation<{ doc?: FrappeDoc; message?: unknown }, FrappeError, RunMethodVars>({
    mutationFn: ({ doc, method, args }) => api.runDocMethod(doc, method, args),
  });
  const applyWorkflow = useMutation<FrappeDoc, FrappeError, WorkflowVars>({
    mutationFn: ({ doc, action }) => api.applyWorkflow(doc, action),
    onSuccess: (saved) => void applySavedDoc(qc, saved),
  });
  const assign = useMutation<AssignmentInfo[], FrappeError, AssignVars>({
    mutationFn: ({ doctype, name, users, ...opts }) => api.addAssignment(doctype, name, users, opts),
    onSuccess: (_r, v) => void applyDocInfoChange(qc, v.doctype, v.name),
  });
  const unassign = useMutation<AssignmentInfo[], FrappeError, UnassignVars>({
    mutationFn: ({ doctype, name, user }) => api.removeAssignment(doctype, name, user),
    onSuccess: (_r, v) => void applyDocInfoChange(qc, v.doctype, v.name),
  });
  const addComment = useMutation<CommentInfo, FrappeError, AddCommentVars>({
    mutationFn: ({ doctype, name, content }) => api.addComment(doctype, name, content),
    onSuccess: (_r, v) => void applyDocInfoChange(qc, v.doctype, v.name),
  });
  const updateComment = useMutation<void, FrappeError, CommentVars>({
    mutationFn: ({ commentName, content }) => api.updateComment(commentName, content ?? ""),
    onSuccess: (_r, v) => void applyDocInfoChange(qc, v.doctype, v.name),
  });
  const deleteComment = useMutation<void, FrappeError, CommentVars>({
    mutationFn: ({ commentName }) => api.deleteComment(commentName),
    onSuccess: (_r, v) => void applyDocInfoChange(qc, v.doctype, v.name),
  });
  return { cancel, remove, rename, runMethod, applyWorkflow, assign, unassign, addComment, updateComment, deleteComment };
}
