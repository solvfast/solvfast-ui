/**
 * The seam to the foundation (A1): the provider's API, its translated meta, docinfo, and `useDocAction` for every write (it applies the
 * contract's invalidation rules in one place - this layer never touches the query cache itself).
 */
import type { UseQueryResult } from "@tanstack/react-query";
import type { FrappeError } from "../client";
import type { DocInfo, MetaBundle } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { useDocInfo, useMetaBundle } from "../hooks";

export type RecordApiClient = ReturnType<typeof useFrappeApi>;
/** Back-compat alias used by the public prop types. */
export type RecordClient = RecordApiClient;

export function useRecordApi(): RecordApiClient { return useFrappeApi(); }

/** `docinfo` from the page when it has it, else `useDocInfo`. */
export function useRecordDocInfo(doctype?: string, name?: string, provided?: DocInfo): { data?: DocInfo; isLoading: boolean; error: FrappeError | null } {
  const q: UseQueryResult<DocInfo, FrappeError> = useDocInfo(provided ? undefined : doctype, provided ? undefined : name);
  return provided ? { data: provided, isLoading: false, error: null } : { data: q.data, isLoading: q.isLoading, error: q.error };
}

export function useRecordMeta(doctype?: string, provided?: MetaBundle): { data?: MetaBundle; isLoading: boolean; error: FrappeError | null } {
  const q = useMetaBundle(provided ? undefined : doctype);
  return provided ? { data: provided, isLoading: false, error: null } : { data: q.data, isLoading: q.isLoading, error: q.error };
}
