/**
 * The only file in src/frappe/record that talks to the foundation. When A1's hooks (`useDocInfo`) land in feat/0.4.0-frappe,
 * `useRecordDocInfo` becomes a thin call to them; the components do not change.
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useFrappeClient } from "../FrappeProvider";
import type { FrappeClient } from "../client";
import { frappeKeys, type DocInfo, type DocumentApi, type MetaBundle, type RecordApi } from "../contract";

/** What the record components need from the client: `RecordApi` + `DocumentApi` (0.4.0) and the 0.3.x `call` / `searchLink`. */
export type RecordClient = Partial<RecordApi> & Partial<DocumentApi> & Pick<FrappeClient, "call" | "searchLink">;

/** The client from the provider, or an explicit one (fixture client in the CRM "simulated" mode, stubs in tests). */
export function useRecordClient(override?: RecordClient): RecordClient {
  const c = useFrappeClient() as unknown as RecordClient;
  return override ?? c;
}

function need<K extends keyof RecordClient>(client: RecordClient, k: K): NonNullable<RecordClient[K]> {
  const fn = client[k];
  if (!fn) throw new Error(`The Frappe client has no ${String(k)} (needs @solvfast/ui 0.4.0 foundation)`);
  return fn as NonNullable<RecordClient[K]>;
}
export { need as requireClientMethod };

export function useRecordDocInfo(client: RecordClient, doctype?: string, name?: string, provided?: DocInfo) {
  return useQuery<DocInfo, Error>({
    queryKey: doctype && name ? frappeKeys.docinfo(doctype, name) : ["sf-frappe", "docinfo", "none"],
    queryFn: () => need(client, "getDocInfo")(doctype!, name!),
    enabled: !!doctype && !!name && !provided,
    initialData: provided,
  });
}

export function useRecordMeta(client: RecordClient, doctype?: string, provided?: MetaBundle) {
  return useQuery<MetaBundle, Error>({
    queryKey: doctype ? frappeKeys.metaBundle(doctype) : ["sf-frappe", "meta-bundle", "none"],
    queryFn: () => need(client, "getMetaBundle")(doctype!),
    enabled: !!doctype && !provided,
    initialData: provided,
    staleTime: 5 * 60_000,
  });
}

/** Contract rule: comment / assignment / attachment → invalidate `docinfo` and `list`. */
export function invalidateDocInfo(qc: QueryClient, doctype: string, name: string) {
  void qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doctype, name) });
  void qc.invalidateQueries({ queryKey: frappeKeys.list(doctype) });
}

