/**
 * Metadata and document queries (contract §2). Keys come from `frappeKeys` only; what each key holds is listed in
 * services/cache.ts. getdoc's docinfo seeds the `docinfo` key, so a form's sidebar does not fetch it twice.
 */
import * as React from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { FrappeError } from "../client";
import { frappeKeys, type DocInfo, type FrappeDoc, type LoadedDoc, type MetaBundle } from "../contract";
import { useFrappeApi, useFrappeSettings } from "../FrappeProvider";
import { seedDocInfo } from "../services/cache";
import { withTranslations } from "../services/translate";

/** Metadata changes rarely (Desk caches it by `modified` in localStorage). */
export const META_STALE_MS = 5 * 60_000;
/** A document / docinfo read within this window is not re-read on mount (Desk: "fresh" < 5 s, stale reload > 120 s);
 *  saves, actions and realtime events invalidate them explicitly. */
export const DOC_STALE_MS = 30_000;

/** getdoctype → MetaBundle (parent + child-table DocTypes). The provider's `translations` are folded into
 *  `meta.__messages` when the server sent none (15.110 never does) — `translateLabel(bundle, …)` then just works. */
export function useMetaBundle(doctype?: string): UseQueryResult<MetaBundle, FrappeError> {
  const api = useFrappeApi();
  const { translations } = useFrappeSettings();
  const select = React.useCallback((b: MetaBundle) => withTranslations(b, translations), [translations]);
  return useQuery<MetaBundle, FrappeError, MetaBundle>({
    queryKey: frappeKeys.metaBundle(doctype ?? ""),
    queryFn: () => api.getMetaBundle(doctype!),
    enabled: !!doctype,
    staleTime: META_STALE_MS,
    select,
  });
}

/** docinfo of a saved document (get_docinfo). Seeded by `useDoc`; re-read when invalidated (comment, assignment, save…). */
export function useDocInfo(doctype?: string, name?: string): UseQueryResult<DocInfo, FrappeError> {
  const api = useFrappeApi();
  return useQuery<DocInfo, FrappeError>({
    queryKey: frappeKeys.docinfo(doctype ?? "", name ?? ""),
    queryFn: () => api.getDocInfo(doctype!, name!),
    enabled: !!doctype && !!name,
    staleTime: DOC_STALE_MS,
  });
}

/**
 * getdoc → `{ doc, docinfo }`. `doc` lives under `frappeKeys.doc`, `docinfo` under `frappeKeys.docinfo` (seeded from
 * the same response) — the result combines both, so a docinfo invalidation refreshes `data.docinfo` without re-reading
 * the document. A missing document is a FrappeError of kind `not_found` (Frappe answers 200 with no docs).
 */
export function useDoc(doctype?: string, name?: string): UseQueryResult<LoadedDoc, FrappeError> {
  const api = useFrappeApi();
  const qc = useQueryClient();
  const enabled = !!doctype && !!name;
  const doc = useQuery<FrappeDoc, FrappeError>({
    queryKey: frappeKeys.doc(doctype ?? "", name ?? ""),
    queryFn: async () => {
      const loaded = await api.getDoc(doctype!, name!);
      seedDocInfo(qc, doctype!, name!, loaded.docinfo);
      return loaded.doc;
    },
    enabled,
    staleTime: DOC_STALE_MS,
  });
  const info = useQuery<DocInfo, FrappeError>({
    queryKey: frappeKeys.docinfo(doctype ?? "", name ?? ""),
    queryFn: () => api.getDocInfo(doctype!, name!),
    // only after the doc query has seeded it (or when it was invalidated later): never a second request on first load
    enabled: enabled && doc.isSuccess,
    staleTime: DOC_STALE_MS,
  });
  const data = React.useMemo<LoadedDoc | undefined>(
    () => (doc.data && info.data ? { doc: doc.data, docinfo: info.data } : undefined),
    [doc.data, info.data],
  );
  if (doc.isSuccess && !info.data) {
    // docinfo failed (or not seeded yet): report its state; the doc alone is not a LoadedDoc
    return { ...info, data: undefined } as unknown as UseQueryResult<LoadedDoc, FrappeError>;
  }
  return { ...doc, data, refetch: doc.refetch } as unknown as UseQueryResult<LoadedDoc, FrappeError>;
}

/** Read a document and its docinfo again (after something outside the form changed it, e.g. an app's own method). */
export function useRefreshDoc(): (doctype: string, name: string) => Promise<void> {
  const qc = useQueryClient();
  return React.useCallback(async (doctype: string, name: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: frappeKeys.doc(doctype, name) }),
      qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doctype, name) }),
    ]);
  }, [qc]);
}
