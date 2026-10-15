/**
 * useFrappeMeta / useFrappeList — the List View in server mode over a Frappe DocType (Sear hooks/useDataGrid.ts,
 * whose Frappe path had never run). `useFrappeList` returns the props to spread onto `ListView`: it builds the
 * request from the list's state (query.ts), fetches rows and the count with the SAME filters, loads grouped lists in
 * chunks with "Load more" (rule C1), and explains narrowed search (rule C2).
 */
import * as React from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { fieldOf, mergeColumns, type ColumnDef } from "../list/model/columns";
import type { GroupByOption } from "../list/model/group";
import type { FilterField } from "../list/model/filters";
import type { LoadOptions } from "../list/parts/FilterBuilder";
import type { ListQueryState } from "../list/useListState";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";
import type { FrappeClient } from "./client";
import { useFrappeClient } from "./FrappeProvider";
import { buildFrappeListMeta } from "./meta";
import { buildListRequest, type FrappeFilter } from "./query";

export function useFrappeMeta(doctype: string, opts: { client?: FrappeClient } = {}) {
  const fallback = useFrappeClient();
  const client = opts.client ?? fallback;
  const { t } = useLocale();
  const q = useQuery({ queryKey: ["sf-frappe", "meta", doctype], queryFn: () => client.getMeta(doctype), staleTime: 5 * 60_000 });
  const meta = React.useMemo(() => (q.data ? buildFrappeListMeta(q.data, t) : undefined), [q.data, t]);
  return { meta, doc: q.data, loading: q.isPending, error: q.error, refetch: q.refetch };
}

/** After the app writes (insert, delete, update), reload a DocType's lists and counts — or every Frappe list. */
export async function invalidateFrappeList(queryClient: QueryClient, doctype?: string): Promise<void> {
  await Promise.all(["list", "count"].map((kind) => queryClient.invalidateQueries({ queryKey: doctype ? ["sf-frappe", kind, doctype] : ["sf-frappe", kind] })));
}

/** Link-field options from Frappe's own link search (`frappe.desk.search.search_link`). */
export function frappeLinkSearch(client: FrappeClient, referenceDoctype?: string): LoadOptions {
  return async (field: FilterField, text: string) => {
    if (!field.link_doctype) return [];
    const res = await client.searchLink(field.link_doctype, text, { referenceDoctype });
    return res.map((r) => ({ value: r.value, label: r.label || r.value }));
  };
}

export interface FrappeListOptions<T> {
  doctype: string;
  /** Curated columns; the DocType's other fields are added after them (hidden unless `in_list_view`). */
  columns?: ColumnDef<T>[];
  /** Always AND-ed into every request (e.g. a project scope). Changing them clears the selection. */
  baseFilters?: FrappeFilter[];
  /** Search these fields. Default: title field + the DocType's search fields + ID. */
  searchFields?: string[];
  /** Fields offered in "Group by" (opt-in). */
  groupByFields?: string[];
  /** Grouped lists load this many rows at a time. Default 200. */
  chunkSize?: number;
  /** Default 20. */
  pageSize?: number;
  /** Labels for the DocType's fields (DocField labels come as defined on the server, untranslated). A curated column's
   *  label also names its field in filters and search. */
  fieldLabels?: Record<string, Localized>;
  client?: FrappeClient;
}

type Row = Record<string, unknown>;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useFrappeList<T = Row>(o: FrappeListOptions<T>) {
  const fallback = useFrappeClient();
  const client = o.client ?? fallback;
  const { t, language } = useLocale();
  const m = useFrappeMeta(o.doctype, { client });
  const meta = m.meta;

  // a field's label: the app's `fieldLabels`, else the label of a curated column showing that field, else the DocType's
  const curatedLabel = React.useMemo(() => new Map((o.columns ?? []).map((c) => [fieldOf(c), c.label])), [o.columns]);
  const label = React.useCallback((name: string, fallbackLabel: Localized) => loc(o.fieldLabels?.[name] ?? curatedLabel.get(name) ?? fallbackLabel, language), [o.fieldLabels, curatedLabel, language]);
  const columns = React.useMemo<ColumnDef<T>[]>(() => {
    const generated = (meta?.columns ?? []).map((c) => ({ ...c, label: label(c.key, c.label) })) as unknown as ColumnDef<T>[];
    return mergeColumns(o.columns ?? [], generated);
  }, [meta, o.columns, label]);
  const filterFields = React.useMemo(() => (meta?.filterFields ?? []).map((f) => ({ ...f, label: label(f.name, f.label) })), [meta, label]);

  const [state, setState] = React.useState<ListQueryState | null>(null);
  // Only the list built from the DocType reports state: the placeholder shown while the meta loads has no columns, and
  // its state would fetch rows with `name` only before the real request.
  const metaRef = React.useRef(meta);
  metaRef.current = meta;
  const onStateChange = React.useCallback((next: ListQueryState) => {
    if (metaRef.current) setState((prev) => (sameJson(prev, next) ? prev : next));
  }, []);

  const req = React.useMemo(
    () => (meta && state ? buildListRequest({ meta, columns: columns as never, state, baseFilters: o.baseFilters, searchFields: o.searchFields, chunkSize: o.chunkSize }) : null),
    [meta, state, columns, o.baseFilters, o.searchFields, o.chunkSize],
  );

  const list = useInfiniteQuery({
    queryKey: ["sf-frappe", "list", o.doctype, req && [req.fields, req.filters, req.or_filters, req.order_by, req.limit_start, req.limit_page_length]],
    enabled: !!req,
    initialPageParam: req?.limit_start ?? 0,
    queryFn: ({ pageParam }) => client.getList<T>(o.doctype, {
      fields: req!.fields, filters: req!.filters, or_filters: req!.or_filters, order_by: req!.order_by,
      limit_start: pageParam, limit_page_length: req!.limit_page_length,
    }),
    // grouped: the next chunk starts where the loaded rows end; paged: one page per query
    getNextPageParam: (last, _all, lastParam) => (req?.grouped && last.length === req.limit_page_length ? lastParam + last.length : undefined),
    placeholderData: keepPreviousData,
  });
  const count = useQuery({
    queryKey: ["sf-frappe", "count", o.doctype, req && [req.filters, req.or_filters]],
    enabled: !!req,
    queryFn: () => client.getCount(o.doctype, { filters: req!.filters, or_filters: req!.or_filters }),
    placeholderData: keepPreviousData,
  });

  const rows = React.useMemo(() => list.data?.pages.flat() ?? [], [list.data]);
  const err = m.error ?? list.error ?? count.error;
  const titleLabel = filterFields.find((f) => f.name === meta?.titleField)?.label ?? meta?.titleField ?? "";

  const groupByOptions = React.useMemo<GroupByOption<T>[]>(() => (o.groupByFields ?? []).filter((f) => meta?.known.has(f)).map((f) => {
    const isCheck = meta?.fieldtypes.get(f) === "Check";
    return {
      key: f,
      label: filterFields.find((x) => x.name === f)?.label ?? f,
      groupOf: (row: T) => {
        const v = (row as Row)[f];
        if (v === null || v === undefined || v === "") return { key: "__none__", label: "—" };
        return { key: String(v), label: isCheck ? (v ? t("yes") : t("no")) : String(v) };
      },
    };
  }), [o.groupByFields, meta, filterFields, t]);

  const loadOptions = React.useMemo(() => frappeLinkSearch(client, o.doctype), [client, o.doctype]);

  return {
    meta,
    ready: !!meta,
    request: req,
    refetch: () => { if (m.error) void m.refetch(); else { void list.refetch(); void count.refetch(); } },
    listProps: {
      mode: "server" as const,
      rows,
      total: count.data ?? rows.length,
      loading: !err && (m.loading || !state || list.isPending),
      error: err ? (err instanceof Error && err.message ? err.message : true) : undefined,
      onRetry: () => { if (m.error) void m.refetch(); else { void list.refetch(); void count.refetch(); } },
      onStateChange,
      onLoadMore: req?.grouped && list.hasNextPage ? () => void list.fetchNextPage() : undefined,
      searchHint: req?.searchNarrowed ? t("searchTitleOnly").replace("{field}", titleLabel) : undefined,
      columns,
      filterFields,
      quickFilterFields: meta?.quickFilterFields,
      groupByOptions,
      loadOptions,
      rowKey: (row: T) => String((row as Row).name),
      selectionScope: JSON.stringify(o.baseFilters ?? []),
      pageSize: o.pageSize,
    },
  };
}
