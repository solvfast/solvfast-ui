/**
 * Headless list state — PMO's shape (useListView + page-owned search/filter/selection, solvfast_pmo) with Sear's
 * engine (useDataGrid: client "mock" mode, server pagination, saved views, column prefs — sear_product). Rendering is
 * separate (ListView / ListTable / …), so apps can build other views (kanban, cards) on the same state.
 *
 * Modes
 * - client (default): `rows` = every row; filter, search, sort, group and paging happen here.
 * - server: `rows` = the current page (or loaded chunk) and `total`; the app fetches on `onStateChange`.
 *
 * Rules (docs/FEATURES.md)
 * - C1 grouping: client mode groups ALL filtered rows and turns paging off while grouped (nothing hidden on another
 *   page). Server mode groups the rows the app has loaded; ListView shows how many of `total` that is.
 * - C3 selection: keyed by `rowKey`, kept across pages; pruned when the query or search changes (client: to rows that
 *   still match; server: cleared, also when `selectionScope` changes) — PMO kept stale selections that bulk actions
 *   then acted on.
 */
import * as React from "react";
import { useLocale } from "../theme/ThemeProvider";
import { loc } from "../lib/localized";
import { fieldOf, filterFieldsFromColumns, type ColumnDef } from "./model/columns";
import { EMPTY_QUERY, activeConditionCount, applyFilterQuery, type FilterField, type FilterQuery, type FiscalYear } from "./model/filters";
import { groupRows, type GroupByOption, type RowGroup } from "./model/group";
import { sortRows, type SortState } from "./model/sort";
import { createLocalStorageAdapter, type ListPrefs, type ListPrefsStorage, type SavedFilter, type SavedFiltersStorage } from "./model/storage";

export interface ListQueryState {
  search: string;
  query: FilterQuery;
  sort: SortState;
  page: number;
  pageSize: number;
  groupBy: string;
  /** Visible column keys (server mode: fetch only these fields). */
  visible: string[];
}

export interface UseListStateOptions<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  mode?: "client" | "server";
  /** Server mode: total matching rows. */
  total?: number;
  /** Default: from columns that have a `type`. */
  filterFields?: FilterField[];
  /** "Fiscal Year" in the date filters (and client-mode filtering by it). */
  fiscalYears?: FiscalYear[];
  /** Client search fields. Default: the first text column. */
  searchFields?: string[];
  /** Debounce before search and filter edits take effect (typing). Default: 300 ms in server mode, none in client mode. */
  searchDebounceMs?: number;
  /** Default 20 (Sear). */
  pageSize?: number;
  defaultSort?: SortState;
  groupByOptions?: GroupByOption<T>[];
  /** Fields shown as quick filters until the user changes them. */
  quickFilterFields?: string[];
  /** Persistence key for prefs + saved filters. Omit to keep state in memory only. */
  viewKey?: string;
  /** Default: localStorage (`sf:list:<viewKey>:…`). `null` disables. */
  storage?: { prefs?: ListPrefsStorage | null; saved?: SavedFiltersStorage | null } | null;
  /** Server mode: called (debounced for typing) whenever what the app must fetch changes. */
  onStateChange?: (state: ListQueryState) => void;
  /** Server mode: anything else that scopes the result (e.g. the app's base filters, serialized). The selection is
   *  cleared when it changes (rule C3). */
  selectionScope?: string;
  /** Saved-filter feedback (PMO showed toasts): after a filter is saved… */
  onFilterSaved?: (filter: SavedFilter) => void;
  /** …and when the saved-filters storage fails (otherwise the failure is silent). */
  onSavedFiltersError?: (error: unknown, action: "list" | "save" | "remove") => void;
}

const DEFAULT_SORT: SortState = { key: null, dir: "desc" }; // Sear: nothing sorted; first click sorts ascending
let defaultAdapter: ReturnType<typeof createLocalStorageAdapter> | null = null;
const local = () => (defaultAdapter ??= createLocalStorageAdapter());

/** `value` after it has stopped changing for `ms`; `value` itself when `ms` is 0. */
function useDebounced<V>(value: V, ms: number): V {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    if (!ms) return;
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return ms ? settled : value;
}

export function useListState<T>(opts: UseListStateOptions<T>) {
  const { language } = useLocale();
  const { rows, columns, rowKey, mode = "client", viewKey } = opts;
  const pageSize = opts.pageSize ?? 20;
  const prefsStore = opts.storage === null ? null : opts.storage?.prefs === undefined ? local().prefs : opts.storage.prefs;
  const savedStore = opts.storage === null ? null : opts.storage?.saved === undefined ? local().saved : opts.storage.saved;
  const initial = React.useMemo<ListPrefs>(() => (viewKey && prefsStore ? prefsStore.load(viewKey) : {}), [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterFields = React.useMemo(
    () => opts.filterFields ?? filterFieldsFromColumns(columns, (l) => loc(l, language)),
    [opts.filterFields, columns, language],
  );

  // ---- columns: visibility + order -----------------------------------------------------------------------------------
  const defaultVisible = React.useMemo(() => columns.filter((c) => !c.hidden).map((c) => c.key), [columns]);
  const [visibleKeys, setVisibleKeysState] = React.useState<string[]>(() => initial.visible?.length ? initial.visible : defaultVisible);
  const visibleColumns = React.useMemo(() => {
    const locked = columns.filter((c) => c.alwaysVisible && !visibleKeys.includes(c.key));
    return [...locked, ...visibleKeys.map((k) => columns.find((c) => c.key === k)).filter(Boolean)] as ColumnDef<T>[];
  }, [columns, visibleKeys]);

  // ---- query state -----------------------------------------------------------------------------------------------------
  const [query, setQueryState] = React.useState<FilterQuery>(EMPTY_QUERY);
  const [search, setSearchState] = React.useState("");
  const [sort, setSortState] = React.useState<SortState>(initial.sort ?? opts.defaultSort ?? DEFAULT_SORT);
  const [groupBy, setGroupByState] = React.useState<string>(initial.groupBy ?? "none");
  const [page, setPage] = React.useState(0);
  const [quickFields, setQuickFieldsState] = React.useState<string[]>(initial.quick ?? opts.quickFilterFields ?? []);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const persist = (patch: Partial<ListPrefs>) => {
    if (!viewKey || !prefsStore) return;
    prefsStore.save(viewKey, { ...prefsStore.load(viewKey), ...patch });
  };

  // Typing (search, text filters) updates the inputs at once; results follow after the debounce — one request per pause in
  // server mode (neither source debounced filters). Without a debounce the live values are used directly.
  const debounceMs = opts.searchDebounceMs ?? (mode === "server" ? 300 : 0);
  const appliedSearch = useDebounced(search, debounceMs);
  const appliedQuery = useDebounced(query, debounceMs);
  const pending = appliedSearch !== search || appliedQuery !== query;

  // ---- client pipeline -------------------------------------------------------------------------------------------------
  const searchFields = React.useMemo(
    () => opts.searchFields ?? [columns.find((c) => (c.type ?? "text") === "text")].filter(Boolean).map((c) => fieldOf(c!)),
    [opts.searchFields, columns],
  );
  const filtered = React.useMemo(() => {
    if (mode === "server") return rows;
    let out = applyFilterQuery(rows, appliedQuery, filterFields, { fiscalYears: opts.fiscalYears });
    const s = appliedSearch.trim().toLowerCase();
    if (s) out = out.filter((r) => searchFields.some((f) => String((r as Record<string, unknown>)[f] ?? "").toLowerCase().includes(s)));
    return sortRows(out, sort, columns);
  }, [mode, rows, appliedQuery, filterFields, appliedSearch, searchFields, sort, columns, opts.fiscalYears]);

  const groupOption = groupBy !== "none" ? opts.groupByOptions?.find((o) => o.key === groupBy) : undefined;
  const grouped = !!groupOption;
  const total = mode === "server" ? opts.total ?? rows.length : filtered.length;
  // C1: client mode never pages while grouped
  const pageRows = mode === "server" || grouped ? filtered : filtered.slice(page * pageSize, page * pageSize + pageSize);
  const groups: RowGroup<T>[] | null = React.useMemo(() => (groupOption ? groupRows(pageRows, groupOption.groupOf) : null), [groupOption, pageRows]);

  // C3: prune the selection when the result set changes underneath it
  const keysOfFiltered = React.useMemo(() => new Set(filtered.map(rowKey)), [filtered, rowKey]);
  React.useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      if (mode === "server") return new Set();
      const next = new Set([...prev].filter((k) => keysOfFiltered.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [appliedQuery, appliedSearch, opts.selectionScope]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- server: tell the app what to fetch --------------------------------------------------------------------------------
  const onStateChange = opts.onStateChange;
  React.useEffect(() => {
    if (mode !== "server" || !onStateChange || pending) return; // wait for the typing pause
    onStateChange({ search: appliedSearch, query: appliedQuery, sort, page, pageSize, groupBy, visible: visibleColumns.map((c) => c.key) });
  }, [mode, pending, appliedSearch, appliedQuery, sort, page, pageSize, groupBy, visibleColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- saved filters --------------------------------------------------------------------------------------------------
  const [saved, setSaved] = React.useState<SavedFilter[]>([]);
  React.useEffect(() => {
    if (!viewKey || !savedStore) return;
    let live = true;
    Promise.resolve().then(() => savedStore.list(viewKey)).then((l) => live && setSaved(l)).catch((e) => live && opts.onSavedFiltersError?.(e, "list"));
    return () => { live = false; };
  }, [viewKey, savedStore]);

  // ---- API ---------------------------------------------------------------------------------------------------------
  const setQuery = (q: FilterQuery) => { setQueryState(q); setPage(0); };
  const setSearch = (v: string) => { setSearchState(v); setPage(0); };
  const setSort = (s: SortState) => { setSortState(s); persist({ sort: s }); };
  const toggleSort = (key: string) => setSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const setVisibleKeys = (keys: string[]) => { setVisibleKeysState(keys); persist({ visible: keys }); };
  const setGroupBy = (key: string) => { setGroupByState(key); setPage(0); persist({ groupBy: key }); };
  const setQuickFields = (names: string[]) => { setQuickFieldsState(names); persist({ quick: names }); };
  // adapters may throw or reject; either way the error goes to `onSavedFiltersError`
  const update = <R,>(run: () => R | Promise<R>, action: "save" | "remove", then: (r: R) => void) => {
    Promise.resolve().then(run).then(then).catch((e) => opts.onSavedFiltersError?.(e, action));
  };

  return {
    mode, columns, visibleColumns, visibleKeys, setVisibleKeys, filterFields,
    search, setSearch, query, setQuery, activeCount: activeConditionCount(query),
    sort, setSort, toggleSort,
    groupBy, setGroupBy, groupByOptions: opts.groupByOptions ?? [], groups, grouped,
    rows: pageRows, total, page, setPage, pageSize,
    hasPrev: !grouped && page > 0,
    hasNext: !grouped && (page + 1) * pageSize < total,
    quickFields, setQuickFields,
    // selection
    selected,
    isSelected: (row: T) => selected.has(rowKey(row)),
    toggleRow: (row: T) => setSelected((prev) => { const n = new Set(prev); const k = rowKey(row); n.has(k) ? n.delete(k) : n.add(k); return n; }),
    /** Select / unselect exactly these rows (the visible page, or one group). */
    setRowsSelected: (list: T[], on: boolean) => setSelected((prev) => { const n = new Set(prev); for (const r of list) (on ? n.add(rowKey(r)) : n.delete(rowKey(r))); return n; }),
    clearSelection: () => setSelected(new Set()),
    selectedRows: () => (mode === "server" ? rows : filtered).filter((r) => selected.has(rowKey(r))),
    // saved filters
    saved,
    applySaved: (f: SavedFilter) => setQuery(f.query),
    saveCurrent: (label: string) => {
      if (!viewKey || !savedStore) return;
      update(() => savedStore.save(viewKey, label, query), "save", (list) => {
        setSaved(list);
        const f = list.find((x) => x.label === label);
        if (f) opts.onFilterSaved?.(f);
      });
    },
    removeSaved: (id: string) => { if (viewKey && savedStore) update(() => savedStore.remove(viewKey, id), "remove", setSaved); },
    canSave: !!viewKey && !!savedStore,
    rowKey,
  };
}

export type ListState<T> = ReturnType<typeof useListState<T>>;
