/**
 * Headless engine behind <DataGrid>. Give it a doctype; it fetches the Frappe meta, derives filter fields +
 * columns + quick-filters, runs the (server-side filtered, paginated) list query, and owns column-visibility,
 * sort, saved filters and search. Use it directly for custom layouts (kanban/cards); use <DataGrid> for the
 * standard table. In the Frontend phase (no doctype yet) pass `mock` to render from local data.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocMeta, getList, getCount } from "@/services/frappe-data";
import { buildGridMeta, type GridMeta, type DocField } from "@/lib/data-grid/frappe-meta";
import { queryToFrappe, type FrappeFilter } from "@/lib/data-grid/filter-to-frappe";
import { EMPTY_QUERY, applyFilterQuery, activeConditionCount, type FilterQuery } from "@/lib/data-grid/filter-engine";
import { getColumnPrefs, setColumnPrefs, getSavedFilters, saveFilter, deleteSavedFilter } from "@/lib/data-grid/storage";

export interface UseDataGridOptions {
  viewKey?: string;
  fields?: string[]; // explicit columns to fetch/show (else from meta defaultColumns)
  baseFilters?: FrappeFilter[]; // always-AND'd (e.g. a project scope)
  pageLength?: number;
  mock?: { rows: Record<string, any>[]; fields?: DocField[] }; // Frontend-phase fallback
}

type Sort = { key: string | null; dir: "asc" | "desc" };

export function useDataGrid(doctype: string, opts: UseDataGridOptions = {}) {
  const viewKey = opts.viewKey || doctype;
  const isMock = !!opts.mock;
  const pageLength = opts.pageLength ?? 20;

  // --- meta (live: getdoctype; mock: from provided/ inferred fields) ---
  const metaQuery = useQuery({
    queryKey: ["grid-meta", doctype],
    queryFn: () => getDocMeta(doctype),
    enabled: !isMock,
    staleTime: 5 * 60_000,
  });
  const meta: GridMeta | null = useMemo(() => {
    if (isMock) {
      const fields = opts.mock!.fields ?? inferFields(opts.mock!.rows);
      return buildGridMeta({ doctype, fields });
    }
    return metaQuery.data ? buildGridMeta(metaQuery.data) : null;
  }, [isMock, metaQuery.data, doctype]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- state ---
  const [query, setQuery] = useState<FilterQuery>(EMPTY_QUERY);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: null, dir: "desc" });
  const [page, setPage] = useState(0);
  const [visibleKeys, setVisibleKeysState] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(() => getSavedFilters(viewKey));

  // visible columns (persisted) — resolved once meta is known
  const resolvedVisible = useMemo(() => {
    if (!meta) return [];
    if (visibleKeys) return visibleKeys;
    return getColumnPrefs(viewKey, opts.fields ?? meta.defaultColumns);
  }, [meta, visibleKeys, viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleKeys = (keys: string[]) => { setVisibleKeysState(keys); setColumnPrefs(viewKey, keys); };
  const visibleColumns = useMemo(
    () => (meta ? resolvedVisible.map((k) => meta.columns.find((c) => c.key === k)).filter(Boolean) : []),
    [meta, resolvedVisible],
  ) as GridMeta["columns"];

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // --- the list query: build Frappe filters from base + advanced + search ---
  const { filters: advFilters, or_filters } = useMemo(
    () => (meta ? queryToFrappe(query, meta.filterFields) : { filters: [], or_filters: [] }),
    [query, meta],
  );
  const titleField = meta?.titleField ?? "name";
  const searchFilters: FrappeFilter[] = search.trim() ? [[titleField, "like", `%${search.trim()}%`]] : [];
  const baseFilters = [...(opts.baseFilters || []), ...advFilters, ...searchFilters];
  const orderBy = sort.key ? `${sort.key} ${sort.dir}` : "modified desc";
  const fetchFields = useMemo(
    () => Array.from(new Set(["name", titleField, ...resolvedVisible])),
    [titleField, resolvedVisible],
  );

  const listQuery = useQuery({
    queryKey: ["grid-rows", doctype, baseFilters, or_filters, orderBy, page, pageLength, fetchFields],
    queryFn: async () => {
      const [rows, total] = await Promise.all([
        getList(doctype, { fields: fetchFields, filters: baseFilters, or_filters, order_by: orderBy, limit_start: page * pageLength, limit_page_length: pageLength }),
        getCount(doctype, baseFilters, or_filters),
      ]);
      return { rows, total };
    },
    enabled: !isMock && !!meta,
    placeholderData: (prev) => prev,
  });

  // --- mock path: filter/sort/paginate client-side ---
  const mockResult = useMemo(() => {
    if (!isMock || !meta) return null;
    let rows = applyFilterQuery(opts.mock!.rows, query, meta.filterFields);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter((r) => String(r[titleField] ?? "").toLowerCase().includes(s));
    }
    if (sort.key) {
      const k = sort.key;
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => compareValues(a[k], b[k]) * dir);
    }
    const total = rows.length;
    return { rows: rows.slice(page * pageLength, page * pageLength + pageLength), total };
  }, [isMock, meta, opts.mock, query, search, sort, page, pageLength, titleField]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = isMock ? mockResult : listQuery.data;

  // saved filters
  const applySaved = (q: FilterQuery) => { setQuery(q); setPage(0); };
  const saveCurrent = (label: string) => setSaved(saveFilter(viewKey, label, query));
  const removeSaved = (id: string) => setSaved(deleteSavedFilter(viewKey, id));

  const update = (q: FilterQuery) => { setQuery(q); setPage(0); };

  return {
    doctype,
    meta,
    loading: isMock ? !meta : metaQuery.isLoading || listQuery.isLoading,
    error: (metaQuery.error || listQuery.error) as Error | null,
    rows: (result?.rows ?? []) as Record<string, any>[],
    total: result?.total ?? 0,
    // filter
    query, setQuery: update, activeCount: activeConditionCount(query),
    search, setSearch: (v: string) => { setSearch(v); setPage(0); },
    // columns
    columns: meta?.columns ?? [], visibleColumns, visibleKeys: resolvedVisible, setVisibleKeys,
    // quick filters
    quickFilterFields: meta?.quickFilterFields ?? [],
    // sort
    sort, toggleSort,
    // pagination
    page, setPage, pageLength,
    hasNext: (page + 1) * pageLength < (result?.total ?? 0),
    hasPrev: page > 0,
    // saved
    saved, applySaved, saveCurrent, removeSaved,
    refetch: listQuery.refetch,
  };
}

export type DataGridState = ReturnType<typeof useDataGrid>;

/** Type-aware comparator for the mock (client-side) sort: numbers sort numerically, dates
 *  chronologically, everything else with a locale-aware string compare. Nullish values sort last. */
function compareValues(a: any, b: any): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
  const da = Date.parse(a), db = Date.parse(b);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a).localeCompare(String(b));
}

/** Infer DocFields from mock rows when explicit fields aren't given (Frontend phase convenience). */
function inferFields(rows: Record<string, any>[]): DocField[] {
  const sample = rows[0] || {};
  return Object.keys(sample).map((k) => {
    const v = sample[k];
    let fieldtype = "Data";
    if (typeof v === "number") fieldtype = "Float";
    else if (typeof v === "boolean") fieldtype = "Check";
    else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) fieldtype = "Date";
    return { fieldname: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), fieldtype, in_list_view: 1 };
  });
}
