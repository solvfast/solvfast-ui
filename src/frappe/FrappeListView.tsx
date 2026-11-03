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
import { useFrappeList, type FrappeListOptions } from "./useFrappeList";
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
  serverStorage?: boolean | { user?: string; savedFilters?: boolean; userSettings?: boolean; global?: boolean };
}

export function FrappeListView<T = Record<string, unknown>>(props: FrappeListViewProps<T>) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, serverStorage, rowKey, ...rest }: FrappeListViewProps<T>) {
  const f = useFrappeList<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings });
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  const fallbackClient = useFrappeClient();
  const c = client ?? fallbackClient;
  const metaRef = React.useRef(f.meta);
  metaRef.current = f.meta;
  const server = typeof serverStorage === "object" ? serverStorage : serverStorage ? {} : null;
  const storage = React.useMemo(() => {
    if (rest.storage !== undefined || !server || !f.ready) return rest.storage;
    return {
      prefs: server.userSettings === false ? undefined : createFrappeUserSettings(c, { doctype, initial: f.userSettings, meta: () => metaRef.current }),
      saved: server.savedFilters === false || !server.user ? undefined : createFrappeSavedFilters(c, { user: server.user, meta: () => metaRef.current, global: server.global }),
    };
  }, [rest.storage, server?.user, server?.userSettings, server?.savedFilters, server?.global, !!server, f.ready, c, doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ListView<T>
      // remount once the DocType is known, so default columns and quick filters initialise from it
      key={f.ready ? "ready" : "meta"}
      viewKey={doctype}
      quickFilterFields={rest.quickFilterFields ?? quickFilterFields}
      loadOptions={rest.loadOptions ?? loadOptions}
      {...rest}
      storage={storage}
      {...data}
      rowKey={rowKey ?? data.rowKey}
    />
  );
}
