/**
 * FrappeConnections — the "Connections" tab of a Frappe form: the groups of `meta.__dashboard` (connectionsFromMeta),
 * the counts from `get_open_count` (useOpenCounts), "+" to create a linked document, a click to open the linked list
 * filtered by this document — all rendered by the Core `ConnectionsPanel`.
 *  - Permissions: the server checks READ on this document; it counts linked DocTypes WITHOUT their permissions
 *    (`frappe.get_all`). Desk hides the DocTypes the user cannot read from boot `can_read`; pass `canRead` to do the
 *    same (without it every DocType the server listed is shown). `+` appears when `onNew` is given and `canCreate`
 *    (default: true) allows it (Desk: `frm.can_create`, dashboard.js:224-231); the server checks create on insert.
 *  - A new document shows "Save the document to see its connections"; no `fieldname` → the groups without counts.
 */
import * as React from "react";
import { ConnectionsPanel, type ConnectionItem } from "../../record/ConnectionsPanel";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocTypeMeta, FrappeDoc } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { canCountConnections, connectionFilters, connectionTarget, connectionsFromMeta } from "./connections";
import { useOpenCounts } from "./useOpenCounts";

export interface FrappeConnectionsProps {
  meta: DocTypeMeta;
  doc: FrappeDoc;
  /** Desk's `frappe.model.can_read(doctype)` (boot). Default: every DocType the meta lists. */
  canRead?: (doctype: string) => boolean;
  /** Desk's `frm.can_create(doctype)`. Default: true when `onNew` is given. */
  canCreate?: (doctype: string) => boolean;
  /** Open the linked list with these filters (`{ field: name }`, or `{ name: ["in", names] }` for an internal link). */
  onOpenList?: (doctype: string, filters: Record<string, unknown>) => void;
  /** A link per item instead of `onOpenList`. */
  listHref?: (doctype: string, filters: Record<string, unknown>) => string | undefined;
  /** Create a linked document; `defaults` = the link field (and dynamic-link DocType field) set to this document. */
  onNew?: (doctype: string, defaults: Record<string, unknown>) => void;
  /** Display label of a DocType (e.g. translated). */
  labelFor?: (doctype: string) => string;
  className?: string;
}

export function FrappeConnections({ meta, doc, canRead, canCreate, onOpenList, listHref, onNew, labelFor, className }: FrappeConnectionsProps) {
  const { t } = useLocale();
  const data = React.useMemo(() => connectionsFromMeta(meta), [meta]);
  const groupsAll = React.useMemo(
    () => (data?.transactions ?? []).map((g) => ({ label: g.label, items: g.items.filter((d) => !canRead || canRead(d)) })).filter((g) => g.items.length),
    [data, canRead],
  );
  const items = React.useMemo(() => groupsAll.flatMap((g) => g.items), [groupsAll]);
  const countable = canCountConnections(data, doc);
  const q = useOpenCounts(doc.doctype, doc.name, data ? items : [], { enabled: countable, method: data?.method });

  if (doc.__islocal) return <ConnectionsPanel groups={[]} notice={t("r35ConnectionsSaveFirst")} className={className} />;
  const groups = groupsAll.map((g) => ({
    label: g.label,
    items: g.items.map((d): ConnectionItem => {
      const c = q.data?.get(d);
      const target = data ? connectionTarget(data, q.data, d, doc.name) : null;
      return {
        id: d, label: labelFor?.(d) ?? d,
        count: c ? c.count : undefined, openCount: c?.openCount,
        canCreate: !!onNew && (canCreate ? canCreate(d) : true),
        href: target && listHref ? listHref(d, target) : undefined,
      };
    }),
  }));
  return (
    <ConnectionsPanel
      groups={groups} loading={countable && q.isLoading} className={className}
      error={q.error ? <FrappeErrorState error={q.error} compact /> : undefined}
      onRetry={q.error ? () => void q.refetch() : undefined}
      onOpen={onOpenList && data ? (it) => { const target = connectionTarget(data, q.data, it.id, doc.name); if (target) onOpenList(it.id, target); } : undefined}
      onNew={onNew && data ? (it) => onNew(it.id, connectionFilters(data, it.id, doc.name)) : undefined}
    />
  );
}
