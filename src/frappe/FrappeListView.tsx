/**
 * FrappeListView — `ListView` over a Frappe DocType: `<FrappeListView doctype="ToDo" />`. Columns, filter fields,
 * quick filters, title and default sort come from the DocType; everything else is a `ListView` prop (row click, row
 * actions, selection and bulk actions, toolbar, controls, storage). Works without any provider (one is created).
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { ListView, type ListViewProps } from "../list/ListView";
import { FrappeProvider } from "./FrappeProvider";
import { useFrappeList, type FrappeListOptions } from "./useFrappeList";

type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "onLoadMore"
  | "searchHint" | "selectionScope" | "filterFields" | "groupByOptions" | "searchFields" | "pageSize" | "fiscalYears" | "loadFiscalYears";

export interface FrappeListViewProps<T> extends Omit<ListViewProps<T>, Managed>, FrappeListOptions<T> {
  /** Default: the document `name`. */
  rowKey?: (row: T) => string;
}

export function FrappeListView<T = Record<string, unknown>>(props: FrappeListViewProps<T>) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowKey, ...rest }: FrappeListViewProps<T>) {
  const f = useFrappeList<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears });
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  return (
    <ListView<T>
      // remount once the DocType is known, so default columns and quick filters initialise from it
      key={f.ready ? "ready" : "meta"}
      viewKey={doctype}
      quickFilterFields={rest.quickFilterFields ?? quickFilterFields}
      loadOptions={rest.loadOptions ?? loadOptions}
      {...rest}
      {...data}
      rowKey={rowKey ?? data.rowKey}
    />
  );
}
