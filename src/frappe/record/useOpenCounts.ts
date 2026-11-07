/**
 * useOpenCounts — `frappe.desk.notifications.get_open_count` for a saved document (see connections.ts). Desk sends
 * `{ doctype, name, items }` (dashboard.js:429-441; `items` serialised as JSON like every frappe.call list). The query
 * lives under the package's key prefix, so a broad `frappeKeys.all` invalidation refreshes it.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FrappeError } from "../client";
import { frappeKeys } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { OPEN_COUNT_METHOD, parseOpenCount, type LinkCount } from "./connections";

export const openCountKey = (doctype: string, name: string) => [...frappeKeys.all, "open-count", doctype, name] as const;

export function useOpenCounts(doctype: string | undefined, name: string | undefined, items: string[], opts: { enabled?: boolean; method?: string } = {}): UseQueryResult<Map<string, LinkCount>, FrappeError> {
  const api = useFrappeApi();
  return useQuery<Map<string, LinkCount>, FrappeError>({
    queryKey: [...openCountKey(doctype ?? "", name ?? ""), items.join("\u0001")],
    queryFn: async () => parseOpenCount((await api.call(opts.method ?? OPEN_COUNT_METHOD, { doctype, name, items: JSON.stringify(items) })).message),
    enabled: (opts.enabled ?? true) && !!doctype && !!name && items.length > 0,
    retry: false,
  });
}
