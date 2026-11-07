/**
 * useFrappeViewList — the row source every P35 view shares (Image, Report, Kanban, Calendar). It is `useFrappeList`'s
 * pipeline, read-only reused: the DocType bundle (`useFrappeMeta`), the list state → request translation
 * (`buildListRequest`: filters, search, sort, paging), `frappe.desk.reportview.get` + `get_count` — plus what the views
 * need and the list's request builder drops:
 *
 * - `extraFields`: fields the list never requests, e.g. the `image_field` (Attach Image is not a list column, so
 *   `buildListRequest` drops it) or a Kanban Board's `field_name`. Each must be a field of the DocType (or standard).
 * - `childColumns` (Report): child-table fields as columns `Child:field`, requested as Desk's report view does
 *   (report_view.js:869-884: `` `tabChild`.`f` as 'Child:f' `` + `` `tabChild`.`name` as 'Child:name' ``, every parent field
 *   fully qualified, no `group_by` — report_view.js:136 — so the server answers one row per child row).
 * - `pageSize: 0`: every matching row (Desk's Kanban, kanban_view.js:80 `page_length = 0`).
 * - `fetchRows`: another row source on the same request (Calendar's `get_events`).
 *
 * Returns `listProps` for `useListState` / `ListView` / the Core views (server mode), keyed on `ready` by the caller so
 * the list state starts once the DocType is known (as FrappeListView does).
 */
import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "../../list/model/columns";
import type { GroupByOption } from "../../list/model/group";
import type { ListQueryState } from "../../list/useListState";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeClient } from "../client";
import { useFrappeClient } from "../FrappeProvider";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { STANDARD_FIELDNAMES } from "../meta";
import { buildListRequest, type FrappeFilter, type ListRequest } from "../query";
import { COUNT_UPPER_BOUND, reportviewCount, reportviewGet } from "../list/reportview";
import { frappeLinkSearch, useFrappeMeta } from "../useFrappeList";

type Row = Record<string, unknown>;

/** The request a view sends (`ListRequest` with the views' additions applied). */
export type ViewRequest = ListRequest & { childDoctypes: string[] };

export interface FrappeViewListOptions {
  doctype: string;
  client?: FrappeClient;
  /** Always AND-ed (e.g. a Kanban Board's filters, the calendar's date range). */
  baseFilters?: FrappeFilter[];
  /** Fields to request beyond the visible columns (must be fields of the DocType or standard ones). */
  extraFields?: string[];
  /** Offer the child tables' fields as (hidden) columns `Child:field` — the Report view. */
  childColumns?: boolean;
  /** Default 20. 0 = every matching row. */
  pageSize?: number;
  searchFields?: string[];
  /** Fields offered in Group by. */
  groupByFields?: string[];
  /** Ask for the count (default true). */
  count?: boolean;
  /** Another row source for the same request. */
  fetchRows?: (client: FrappeClient, request: ViewRequest) => Promise<Row[]>;
  /** Part of the cache key: views of one DocType that fetch differently (e.g. "image", "report"). */
  scope: string;
  /** Default true. */
  enabled?: boolean;
  treeDoctypes?: string[];
}

const strip = (k: string) => k.replace(/^['"`](.*)['"`]$/, "$1");
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const qualified = (doctype: string, f: string) => (f.includes("`") ? f : `\`tab${doctype}\`.\`${f}\``);

/** Rewrite cached rows of a DocType's lists (FrappeListView's paged cache and the views' cache) — e.g. after set_value. */
export function patchCachedRows(queryClient: QueryClient, doctype: string, name: string, patch: Row): void {
  const apply = (r: Row) => (String(r.name) === name ? { ...r, ...patch } : r);
  queryClient.setQueriesData<unknown>({ queryKey: ["sf-frappe", "list", doctype] }, (data: unknown) => {
    if (!data || typeof data !== "object") return data;
    const d = data as { pages?: { rows: Row[] }[]; rows?: Row[] };
    if (Array.isArray(d.pages)) return { ...d, pages: d.pages.map((p) => ({ ...p, rows: p.rows.map(apply) })) };
    if (Array.isArray(d.rows)) return { ...d, rows: d.rows.map(apply) };
    return data;
  });
}

export function useFrappeViewList(o: FrappeViewListOptions) {
  const fallback = useFrappeClient();
  const client = o.client ?? fallback;
  const { t, language } = useLocale();
  const qc = useQueryClient();
  const m = useFrappeMeta(o.doctype, { client, treeDoctypes: o.treeDoctypes });
  const meta = m.meta;
  const pageSize = o.pageSize ?? 20;

  // child-table columns: the composite filter fields `Child.field` (permlevel-restricted already) as `Child:field`
  const childCols = React.useMemo<ColumnDef<Row>[]>(() => {
    if (!o.childColumns || !meta) return [];
    return meta.filterFields.filter((f) => meta.childOf.has(f.name)).map((f) => {
      const ref = meta.childOf.get(f.name)!;
      return { key: `${ref.doctype}:${ref.fieldname}`, label: f.label, type: f.type, fieldtype: f.fieldtype, options: f.options, hidden: true, sortable: false, filterable: false };
    });
  }, [o.childColumns, meta]);
  const columns = React.useMemo<ColumnDef<Row>[]>(() => (meta ? [...meta.columns, ...childCols] : []), [meta, childCols]);

  const [state, setState] = React.useState<ListQueryState | null>(null);
  const metaRef = React.useRef(meta);
  metaRef.current = meta;
  const onStateChange = React.useCallback((next: ListQueryState) => {
    if (metaRef.current) setState((prev) => (sameJson(prev, next) ? prev : next));
  }, []);

  const rawFields = React.useMemo(() => new Set([...(m.doc?.fields ?? []).map((f) => f.fieldname), ...STANDARD_FIELDNAMES]), [m.doc]);
  const extraKey = JSON.stringify(o.extraFields ?? []);
  const request = React.useMemo<ViewRequest | null>(() => {
    if (!meta || !state) return null;
    const st = pageSize === 0 ? { ...state, page: 0, pageSize: 0 } : state;
    const req = buildListRequest({ meta, columns: columns as never, state: st, baseFilters: o.baseFilters, searchFields: o.searchFields });
    const extra = (o.extraFields ?? []).filter((f) => rawFields.has(f));
    const parent = [...new Set([...req.fields, ...["docstatus", ...extra].map((f) => (req.joinsChild ? qualified(o.doctype, f) : f))])];
    const childKeys = state.visible.filter((k) => k.includes(":") && childCols.some((c) => c.key === k));
    const childDoctypes = [...new Set(childKeys.map((k) => k.split(":")[0]))];
    if (!childKeys.length) return { ...req, fields: parent, childDoctypes, ...(pageSize === 0 ? { limit_start: 0, limit_page_length: 0 } : {}) };
    // Desk's report view with child columns (report_view.js:869-884, :136)
    const fields = [
      ...parent.map((f) => qualified(o.doctype, f)),
      ...childKeys.map((k) => { const [cdt, f] = k.split(":"); return `${qualified(cdt, f)} as '${cdt}:${f}'`; }),
      ...childDoctypes.map((cdt) => `${qualified(cdt, "name")} as '${cdt}:name'`),
    ];
    const order_by = req.joinsChild ? req.order_by : req.order_by.split(",").map((p) => { const [f, d = "asc"] = p.trim().split(/\s+/); return `${qualified(o.doctype, f)} ${d}`; }).join(", ");
    return { ...req, fields, order_by, group_by: undefined, childDoctypes, ...(pageSize === 0 ? { limit_start: 0, limit_page_length: 0 } : {}) };
  }, [meta, state, columns, childCols, o.baseFilters, o.searchFields, extraKey, rawFields, pageSize, o.doctype]); // eslint-disable-line react-hooks/exhaustive-deps

  const enabled = o.enabled !== false && !!request;
  const listKey = ["sf-frappe", "list", o.doctype, "view", o.scope, request && [request.fields, request.filters, request.or_filters, request.order_by, request.limit_start, request.limit_page_length, request.group_by]];
  const list = useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => {
      const req = request!;
      if (o.fetchRows) return { rows: await o.fetchRows(client, req) };
      const res = await reportviewGet<Row>(client, o.doctype, {
        fields: req.fields, filters: req.filters, or_filters: req.or_filters, order_by: req.order_by,
        limit_start: req.limit_start, limit_page_length: req.limit_page_length, withCommentCount: false, group_by: req.group_by,
      });
      // `as 'Child:f'` aliases come back without quotes from SQL; strip them in case a server echoes them
      return { rows: res.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [strip(k), v]))) };
    },
    placeholderData: keepPreviousData,
  });
  const wantCount = o.count !== false && !o.fetchRows;
  const count = useQuery({
    queryKey: ["sf-frappe", "count", o.doctype, "view", o.scope, request && [request.filters, request.or_filters]],
    enabled: enabled && wantCount,
    queryFn: () => reportviewCount(client, o.doctype, { filters: request!.filters, or_filters: request!.or_filters, distinct: request!.joinsChild, limit: COUNT_UPPER_BOUND }),
    placeholderData: keepPreviousData,
  });

  const rows = React.useMemo(() => list.data?.rows ?? [], [list.data]);
  const childDoctypes = request?.childDoctypes ?? [];
  const childSig = childDoctypes.join("\u0000");
  const rowKey = React.useCallback((row: Row) => [String(row.name), ...childSig.split("\u0000").filter(Boolean).map((cdt) => String(row[`${cdt}:name`] ?? ""))].join("::"), [childSig]);
  const err = m.error ?? list.error ?? (wantCount ? count.error : null);
  const refetch = React.useCallback(() => { if (m.error) void m.refetch(); else { void list.refetch(); if (wantCount) void count.refetch(); } }, [m, list, count, wantCount]);

  const groupByOptions = React.useMemo<GroupByOption<Row>[]>(() => (o.groupByFields ?? []).filter((f) => meta?.known.has(f)).map((f) => ({
    key: f,
    label: meta?.filterFields.find((x) => x.name === f)?.label ?? f,
    groupOf: (row: Row) => {
      const v = row[f];
      if (v === null || v === undefined || v === "") return { key: "__none__", label: "—" };
      return { key: String(v), label: meta?.fieldtypes.get(f) === "Check" ? (v ? t("yes") : t("no")) : String(v) };
    },
  })), [o.groupByFields, meta, t]);
  const loadOptions = React.useMemo(() => frappeLinkSearch(client, o.doctype), [client, o.doctype]);
  const capped = !!count.data?.capped;

  return {
    meta,
    bundle: m.bundle,
    doc: m.doc,
    ready: !!meta,
    request,
    state,
    rows,
    refetch,
    client,
    queryClient: qc,
    listProps: {
      mode: "server" as const,
      rows,
      total: wantCount ? count.data?.count ?? rows.length : rows.length,
      totalLabel: capped ? `${(count.data!.count - 1).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}+` : undefined,
      hasMore: capped,
      columns,
      filterFields: meta?.filterFields ?? [],
      quickFilterFields: meta?.quickFilterFields,
      groupByOptions,
      loadOptions,
      onStateChange,
      loading: !err && (m.loading || !state || list.isPending),
      error: err ? <FrappeErrorState error={err} onRetry={refetch} /> : undefined,
      rowKey,
      pageSize: pageSize === 0 ? 1000 : pageSize,
      selectionScope: JSON.stringify(o.baseFilters ?? []),
    },
  };
}
