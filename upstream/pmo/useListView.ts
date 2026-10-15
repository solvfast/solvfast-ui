import { useMemo, useState } from "react";
import {
  getColumnPrefs,
  setColumnPrefs,
  getViewPrefs,
  setViewPrefs,
  sortRows,
  type ColumnDef,
  type SortState,
  type GroupByKey,
} from "@/lib/list-view";

/**
 * Owns a list view's group-by + sort + column-visibility/order state (all persisted per `viewKey`) and
 * exposes helpers. Lets the page assemble one unified toolbar (filters + group-by + sort + columns) and
 * pass a presentational table the already-ordered visible columns + sorted rows.
 */
export function useListView<T>(
  viewKey: string,
  columns: ColumnDef<T>[],
  opts?: { defaultColumns?: string[]; defaultSort?: SortState; defaultGroupBy?: GroupByKey },
) {
  const allKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const stored = useMemo(() => getViewPrefs(viewKey), [viewKey]);

  const [visibleKeys, setVisibleKeysState] = useState<string[]>(() =>
    getColumnPrefs(viewKey, opts?.defaultColumns ?? allKeys),
  );
  const [sort, setSortState] = useState<SortState>(stored.sort.key ? stored.sort : opts?.defaultSort ?? { key: null, dir: "asc" });
  const [groupBy, setGroupByState] = useState<GroupByKey>(
    stored.group_by !== "none" ? stored.group_by : opts?.defaultGroupBy ?? "none",
  );

  const visibleColumns = useMemo(
    () => visibleKeys.map((k) => columns.find((c) => c.key === k)).filter(Boolean) as ColumnDef<T>[],
    [visibleKeys, columns],
  );

  const setVisibleKeys = (keys: string[]) => {
    setVisibleKeysState(keys);
    setColumnPrefs(viewKey, keys);
  };

  const setSort = (next: SortState) => {
    setSortState(next);
    setViewPrefs(viewKey, { sort: next });
  };

  const setGroupBy = (next: GroupByKey) => {
    setGroupByState(next);
    setViewPrefs(viewKey, { group_by: next });
  };

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortValue) return;
    setSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  const sortVisible = (rows: T[]) => sortRows(rows, sort, columns);

  return {
    sort, setSort, toggleSort,
    groupBy, setGroupBy,
    visibleKeys, setVisibleKeys, visibleColumns, columns,
    sortRows: sortVisible,
  };
}

export type ListViewState<T> = ReturnType<typeof useListView<T>>;
