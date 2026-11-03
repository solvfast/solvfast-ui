import * as React from "react";
import type { DocInfo } from "../contract";
import { useRecordApi, useRecordDocInfo } from "./data";

const PAGE = 20;

/**
 * Communications paging (form_timeline.js:193-223). The server sends up to 21 in docinfo; Desk shows 20 and, when there were 21, offers
 * "Load more": `get_communications {start: shown count, limit: 21}`, shows 20 of the answer, more when it returned 21 again.
 * Only communications page - comments, versions and logs are never paged (docs 14 A8). Reads docinfo through the shared cache.
 */
export function useCommunications(doctype?: string, name?: string, docinfo?: DocInfo) {
  const api = useRecordApi();
  const info = useRecordDocInfo(doctype, name, docinfo);
  const [extra, setExtra] = React.useState<unknown[]>([]);
  const [more, setMore] = React.useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { setExtra([]); setMore(null); setError(""); }, [doctype, name]);

  const base = (info.data?.communications ?? []) as unknown[];
  const baseMore = base.length > PAGE;
  const shownBase = baseMore ? base.slice(0, PAGE) : base;
  const communications = React.useMemo(() => [...shownBase, ...extra], [shownBase, extra]);
  const loadMore = React.useCallback(async () => {
    if (!doctype || !name) return;
    setLoadingMore(true); setError("");
    try {
      const res = await api.call("frappe.desk.form.load.get_communications", { doctype, name, start: communications.length, limit: PAGE + 1 });
      const got = (res.message as unknown[] | undefined) ?? [];
      setExtra((e) => [...e, ...got.slice(0, PAGE)]);
      setMore(got.length > PAGE);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoadingMore(false); }
  }, [api, doctype, name, communications.length]);
  return { communications, hasMore: more ?? baseMore, loadMore, loadingMore, error, isLoading: info.isLoading };
}
