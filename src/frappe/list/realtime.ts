/**
 * Realtime refresh of a list through the contract's `RealtimePort` (docs 13 §2.7): on `list_update` for the DocType the
 * list reloads after a quiet 2 s (15 s for large tables). Ignored while rows are selected or a bulk operation runs; no
 * prompt and no catch-up afterwards (Desk shows none, 15.110). UNVERIFIED: Desk re-requests only the changed names and
 * leaves the count alone; here the list's query and count are refetched (the contract's `list_update` rule).
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePort } from "../contract";
import { invalidateFrappeList } from "../useFrappeList";

export const REALTIME_DEBOUNCE_MS = 2000;
export const REALTIME_DEBOUNCE_LARGE_MS = 15000;

export function useListRealtime(o: {
  port?: RealtimePort; doctype: string; enabled?: boolean; isLargeTable?: boolean;
  /** Rows are selected, or a bulk operation is running. */
  suppressed: boolean; debounceMs?: number;
}) {
  const qc = useQueryClient();
  const suppressed = React.useRef(o.suppressed);
  suppressed.current = o.suppressed;
  const ms = o.debounceMs ?? (o.isLargeTable ? REALTIME_DEBOUNCE_LARGE_MS : REALTIME_DEBOUNCE_MS);
  React.useEffect(() => {
    if (!o.port || o.enabled === false) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = o.port.subscribeDoctype(o.doctype, (e) => {
      if (e.event !== "list_update" || (e.doctype && e.doctype !== o.doctype)) return;
      if (suppressed.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (!suppressed.current) void invalidateFrappeList(qc, o.doctype); }, ms);
    });
    return () => { clearTimeout(timer); off(); };
  }, [o.port, o.doctype, o.enabled, ms, qc]);
}
