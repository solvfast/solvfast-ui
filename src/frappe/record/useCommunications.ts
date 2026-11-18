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
  const [extra, setExtra] = React.useState<Row[]>([]);
  const [more, setMore] = React.useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { setExtra([]); setMore(null); setError(""); }, [doctype, name]);

  // Run 1 D-43 (load.py:108-113, form_timeline.js:193-223): the server's 21 are communications AND automated messages
  // together; Desk shows 20 of them (the last one dropped) and pages from the number shown of BOTH kinds
  const baseComms = (info.data?.communications ?? []) as Row[];
  const baseAutos = ((info.data as { automated_messages?: unknown[] } | undefined)?.automated_messages ?? []) as Row[];
  const baseAll = [...baseComms, ...baseAutos];
  const baseMore = baseAll.length > PAGE;
  const shownBase = baseMore ? baseAll.slice(0, PAGE) : baseAll;
  const all = React.useMemo(() => {
    const seen = new Set<string>();
    return [...shownBase, ...extra].filter((c) => { const k = String(c.name ?? ""); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [shownBase, extra]);
  const isAuto = (c: Row) => c.communication_type === "Automated Message";
  const communications = React.useMemo(() => all.filter((c) => !isAuto(c) && !baseAutos.includes(c)), [all, baseAutos]);
  const automatedMessages = React.useMemo(() => all.filter((c) => isAuto(c) || baseAutos.includes(c)), [all, baseAutos]);
  const loadMore = React.useCallback(async () => {
    if (!doctype || !name) return;
    setLoadingMore(true); setError("");
    try {
      const res = await api.call("frappe.desk.form.load.get_communications", { doctype, name, start: all.length, limit: PAGE + 1 });
      const got = ((res.message as unknown[] | undefined) ?? []) as Row[];
      setExtra((e) => [...e, ...got.slice(0, PAGE)]);
      setMore(got.length > PAGE);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoadingMore(false); }
  }, [api, doctype, name, all.length]);
  return { communications: communications as unknown[], automatedMessages: automatedMessages as unknown[], hasMore: more ?? baseMore, loadMore, loadingMore, error, isLoading: info.isLoading };
}

type Row = Record<string, unknown>;
