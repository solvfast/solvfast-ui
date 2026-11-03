/**
 * Apply realtime events to the cache (contract rules, services/cache.ts) while mounted. `port` is optional: without
 * one (no Socket.IO, docs 10 §C7) nothing happens — the app may refetch on focus instead.
 * - with `name`: subscribes to the document (doc_update newer than the cached `modified` → doc + docinfo;
 *   docinfo_update → docinfo);
 * - without `name`: subscribes to the DocType (list_update → list + count; the list view debounces itself).
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePort } from "../contract";
import { applyRealtimeEvent } from "../services/cache";

export function useRealtimeInvalidation(port: RealtimePort | undefined, doctype?: string, name?: string): void {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!port || !doctype) return;
    const apply = (e: Parameters<typeof applyRealtimeEvent>[1]) => void applyRealtimeEvent(qc, e);
    return name ? port.subscribeDoc(doctype, name, apply) : port.subscribeDoctype(doctype, apply);
  }, [port, doctype, name, qc]);
}
