/**
 * FrappeListView — `ListView` over a Frappe DocType: `<FrappeListView doctype="ToDo" />`. Columns, filter fields,
 * quick filters, title and default sort come from the DocType; everything else is a `ListView` prop (row click, row
 * actions, selection and bulk actions, toolbar, controls, storage). Works without any provider (one is created).
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { ListView, type ListViewProps } from "../list/ListView";
import { FrappeProvider } from "./FrappeProvider";
import { useFrappeClient } from "./FrappeProvider";
import { useLocale } from "../theme/ThemeProvider";
import { usePermissions } from "./hooks/usePermissions";
import { useFrappeList, type FrappeListOptions } from "./useFrappeList";
import { FrappeBulkActions, type FrappeBulkOptions } from "./list/FrappeBulkActions";
import { useListRealtime } from "./list/realtime";
import type { RealtimePort } from "./contract";
import { createFrappeSavedFilters, createFrappeUserSettings } from "./list/storage";

type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "onLoadMore"
  | "totalLabel" | "hasMore" | "onTotalClick" | "searchHint" | "selectionScope" | "filterFields" | "groupByOptions" | "searchFields" | "pageSize" | "fiscalYears" | "loadFiscalYears";

export interface FrappeListViewProps<T> extends Omit<ListViewProps<T>, Managed>, FrappeListOptions<T> {
  /** Default: the document `name`. */
  rowKey?: (row: T) => string;
  /**
   * Keep saved filters and the user's list settings on the server (`List Filter` rows; `user_settings`) instead of
   * localStorage. An explicit `storage` prop wins. `user` (the session user) is required for saved filters.
   */
  /**
   * Bulk actions (delete, submit, cancel, edit, assign) in the selection bar, each offered only when `permissions` allow
   * it. Turns `selectable` on. Runs next to the app's own `bulkActions`.
   */
  bulk?: FrappeBulkOptions;
  /** Offers "Create your first {DocType}" in the empty list (Desk: only when the user may create). */
  onCreate?: () => void;
  /** Reload on the server's `list_update` (debounced 2 s, 15 s for large tables; not while rows are selected). */
  realtime?: RealtimePort;
  /** Override the realtime quiet period (ms). Default 2000, 15000 for large tables. */
  realtimeDebounceMs?: number;
  serverStorage?: boolean | { user?: string; savedFilters?: boolean; userSettings?: boolean; global?: boolean };
}

export function FrappeListView<T = Record<string, unknown>>(props: FrappeListViewProps<T>) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext, serverStorage, bulk, onCreate, realtime, realtimeDebounceMs, rowKey, ...rest }: FrappeListViewProps<T>) {
  const f = useFrappeList<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext });
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  const fallbackClient = useFrappeClient();
  const c = client ?? fallbackClient;
  const metaRef = React.useRef(f.meta);
  metaRef.current = f.meta;
  // bulk gates: the user's rights on the DocType (Desk's `frm.perm`); the `permissions` prop overrides
  const perms = usePermissions(f.bundle);
  const { t } = useLocale();
  const [selectedCount, setSelectedCount] = React.useState(0);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkMessage, setBulkMessage] = React.useState("");
  useListRealtime({ port: realtime, doctype, enabled: !f.settings?.disable_auto_refresh, isLargeTable: f.meta?.isLargeTable, suppressed: selectedCount > 0 || bulkBusy, debounceMs: realtimeDebounceMs });
  const renderBulk = React.useMemo(() => {
    if (!bulk || !f.meta) return rest.renderBulkActions;
    const meta = f.meta;
    return (ctx: { keys: string[]; rows: T[]; clear: () => void }) => (
      <>
        <FrappeBulkActions client={c} meta={meta} doctype={doctype} keys={ctx.keys} clear={ctx.clear} onBusy={setBulkBusy} onMessage={setBulkMessage}
          options={{ allowEdit: !!f.settings?.allow_edit, ...bulk, permissions: bulk.permissions ?? ((p) => perms.can(p)) }} />
        {rest.renderBulkActions?.(ctx)}
      </>
    );
  }, [bulk, perms, f.meta, f.settings, c, doctype, rest.renderBulkActions]);
  const server = typeof serverStorage === "object" ? serverStorage : serverStorage ? {} : null;
  const storage = React.useMemo(() => {
    if (rest.storage !== undefined || !server || !f.ready) return rest.storage;
    return {
      prefs: server.userSettings === false ? undefined : createFrappeUserSettings(c, { doctype, initial: f.userSettings, meta: () => metaRef.current }),
      saved: server.savedFilters === false || !server.user ? undefined : createFrappeSavedFilters(c, { user: server.user, meta: () => metaRef.current, global: server.global }),
    };
  }, [rest.storage, server?.user, server?.userSettings, server?.savedFilters, server?.global, !!server, f.ready, c, doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
    <ListView<T>
      // remount once the DocType is known, so default columns and quick filters initialise from it
      key={f.ready ? "ready" : "meta"}
      viewKey={doctype}
      quickFilterFields={rest.quickFilterFields ?? quickFilterFields}
      loadOptions={rest.loadOptions ?? loadOptions}
      {...rest}
      storage={storage}
      emptyMessage={rest.emptyMessage ?? t("listEmptyNone").replace("{doctype}", doctype)}
      emptyFilteredMessage={rest.emptyFilteredMessage ?? t("listEmptyFilteredDoctype").replace("{doctype}", doctype)}
      emptyAction={rest.emptyAction ?? (onCreate ? { label: t("listCreateFirst").replace("{doctype}", doctype), onClick: onCreate } : undefined)}
      selectable={rest.selectable ?? (bulk ? true : undefined)}
      renderBulkActions={renderBulk}
      onSelectionChange={(k) => { setSelectedCount(k.length); rest.onSelectionChange?.(k); }}
      {...data}
      rowKey={rowKey ?? data.rowKey}
    />
    {bulkMessage && <p className="mt-2 text-sm text-muted-foreground" role="status">{bulkMessage}</p>}
    </>
  );
}
