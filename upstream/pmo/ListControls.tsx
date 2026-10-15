import { Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Input } from "@/components/ui/input";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import { QuickFilters } from "@/components/filters/QuickFilters";
import { SortControl } from "@/components/lists/SortControl";
import { ColumnCustomizer } from "@/components/lists/ColumnCustomizer";
import { GroupByControl, type GroupByOption } from "@/components/lists/GroupByControl";
import type { FilterField, FilterQuery } from "@/lib/filter-engine";
import type { ListViewState } from "@/components/lists/useListView";

/**
 * Unified list-view toolbar — one organized row of [search …… extra · Filter · Sort · Columns] plus a
 * quick-filters row below. Used by every list view so they all share the same layout and controls.
 */
export function ListControls<T>({
  search,
  onSearchChange,
  fields,
  query,
  onQueryChange,
  viewKey,
  quickDefaults,
  listView,
  extra,
  showTableControls = true,
  groupByOptions,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  fields: FilterField[];
  query: FilterQuery;
  onQueryChange: (q: FilterQuery) => void;
  viewKey: string;
  quickDefaults: string[];
  listView: ListViewState<T>;
  extra?: React.ReactNode;
  showTableControls?: boolean;
  /** When supplied (+ table controls on), renders the generic Group-By control. */
  groupByOptions?: GroupByOption<T>[];
}) {
  const { t } = useApp();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => onSearchChange(e.target.value)} className="ps-8" aria-label={t("search")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <AdvancedFilter fields={fields} query={query} onChange={onQueryChange} viewKey={viewKey} />
          {showTableControls && groupByOptions && (
            <GroupByControl options={groupByOptions} value={listView.groupBy} onChange={listView.setGroupBy} />
          )}
          {showTableControls && <SortControl columns={listView.columns} sort={listView.sort} onChange={listView.setSort} />}
          {showTableControls && <ColumnCustomizer columns={listView.columns} visibleKeys={listView.visibleKeys} onChange={listView.setVisibleKeys} />}
        </div>
      </div>
      <QuickFilters fields={fields} query={query} onChange={onQueryChange} viewKey={viewKey} defaultFields={quickDefaults} />
    </div>
  );
}
