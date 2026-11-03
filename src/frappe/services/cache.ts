/**
 * The contract's invalidation rules (contract.ts `frappeKeys`), implemented once. Hooks call these; components never
 * invent keys. What lives under each key:
 *   frappeKeys.metaBundle(dt)    MetaBundle
 *   frappeKeys.doc(dt, name)     FrappeDoc (the document as the server last sent it)
 *   frappeKeys.docinfo(dt, name) DocInfo
 *   frappeKeys.workflow(dt)      WorkflowInfo | null
 */
import type { QueryClient } from "@tanstack/react-query";
import { frappeKeys, type DocInfo, type FrappeDoc, type RealtimeEvent } from "../contract";

const listAndCount = (qc: QueryClient, doctype: string) => Promise.all([
  qc.invalidateQueries({ queryKey: frappeKeys.list(doctype) }),
  qc.invalidateQueries({ queryKey: frappeKeys.count(doctype) }),
]);

/**
 * save / submit / update / cancel / amend / workflow action: set `doc`, invalidate `docinfo`, `list`, `count`.
 * `previousName`: the name the doc had before (a new doc's `new-…` name, or the old name of a rename) — its keys are removed.
 * A queued submission (`__queued`) is not a server document: `doc` is invalidated instead of set.
 */
export async function applySavedDoc(qc: QueryClient, saved: FrappeDoc, opts: { previousName?: string } = {}): Promise<void> {
  const { doctype, name } = saved;
  if (opts.previousName && opts.previousName !== name) {
    qc.removeQueries({ queryKey: frappeKeys.doc(doctype, opts.previousName), exact: true });
    qc.removeQueries({ queryKey: frappeKeys.docinfo(doctype, opts.previousName), exact: true });
  }
  if (saved.__queued) await qc.invalidateQueries({ queryKey: frappeKeys.doc(doctype, name), exact: true });
  else qc.setQueryData(frappeKeys.doc(doctype, name), saved);
  await Promise.all([qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doctype, name), exact: true }), listAndCount(qc, doctype)]);
}

/** delete: remove `doc` + `docinfo`, invalidate `list`, `count`. */
export async function applyDeletedDoc(qc: QueryClient, doctype: string, name: string): Promise<void> {
  qc.removeQueries({ queryKey: frappeKeys.doc(doctype, name), exact: true });
  qc.removeQueries({ queryKey: frappeKeys.docinfo(doctype, name), exact: true });
  await listAndCount(qc, doctype);
}

/** rename: the old `doc` / `docinfo` keys are removed; the cached doc moves to the new name and is re-read. */
export async function applyRenamedDoc(qc: QueryClient, doctype: string, oldName: string, newName: string): Promise<void> {
  const old = qc.getQueryData<FrappeDoc>(frappeKeys.doc(doctype, oldName));
  if (old && oldName !== newName) qc.setQueryData(frappeKeys.doc(doctype, newName), { ...old, name: newName });
  if (oldName !== newName) {
    qc.removeQueries({ queryKey: frappeKeys.doc(doctype, oldName), exact: true });
    qc.removeQueries({ queryKey: frappeKeys.docinfo(doctype, oldName), exact: true });
  }
  await Promise.all([
    qc.invalidateQueries({ queryKey: frappeKeys.doc(doctype, newName), exact: true }),
    qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doctype, newName), exact: true }),
    listAndCount(qc, doctype),
  ]);
}

/** comment / assignment / attachment / share / follow: invalidate `docinfo`, and `list` (assignee / comment columns). */
export async function applyDocInfoChange(qc: QueryClient, doctype: string, name: string): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doctype, name), exact: true }),
    qc.invalidateQueries({ queryKey: frappeKeys.list(doctype) }),
  ]);
}

/** Seed `docinfo` (getdoc returns it with the doc). */
export function seedDocInfo(qc: QueryClient, doctype: string, name: string, docinfo: DocInfo): void {
  qc.setQueryData(frappeKeys.docinfo(doctype, name), docinfo);
}

/**
 * Realtime: `doc_update` NEWER than the cached `modified` → invalidate `doc` + `docinfo` (Desk compares `modified` and
 * never clobbers a dirty form — the form decides that before calling this); `docinfo_update` → `docinfo`;
 * `list_update` → `list` + `count` (the list view debounces: docs 13 §2 — not here).
 */
export async function applyRealtimeEvent(qc: QueryClient, e: RealtimeEvent): Promise<void> {
  if (!e.doctype) return;
  if (e.event === "list_update") return void (await listAndCount(qc, e.doctype));
  if (!e.name) return;
  if (e.event === "doc_update") {
    const cached = qc.getQueryData<FrappeDoc>(frappeKeys.doc(e.doctype, e.name));
    const modified = (e.data as { modified?: string } | undefined)?.modified;
    if (cached?.modified && modified && String(cached.modified) >= modified) return; // not newer (same-format strings)
    await Promise.all([
      qc.invalidateQueries({ queryKey: frappeKeys.doc(e.doctype, e.name), exact: true }),
      qc.invalidateQueries({ queryKey: frappeKeys.docinfo(e.doctype, e.name), exact: true }),
    ]);
  } else if (e.event === "docinfo_update") {
    await qc.invalidateQueries({ queryKey: frappeKeys.docinfo(e.doctype, e.name), exact: true });
  }
}
