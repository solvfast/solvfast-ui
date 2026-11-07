/**
 * ViewToolbar — the list toolbar for views other than the table (Image, Kanban, Calendar): search, quick filters,
 * the filter builder and the sort menu, all on the SAME headless list state (`useListState`), so a view filters and
 * sorts exactly as the list does. `leading` (e.g. a ViewSwitcher) comes first, `actions` last.
 */
import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "../../primitives/input";
import { useLocale } from "../../theme/ThemeProvider";
import type { FiscalYear } from "../model/filters";
import { FilterBuilder, type LoadOptions } from "../parts/FilterBuilder";
import { QuickFilters, SortMenu } from "../parts/Toolbar";
import type { ListState } from "../useListState";

export interface ViewToolbarControls { search?: boolean; filter?: boolean; sort?: boolean; quickFilters?: boolean }

export interface ViewToolbarProps<T> {
  state: ListState<T>;
  controls?: ViewToolbarControls;
  loadOptions?: LoadOptions;
  fiscalYears?: FiscalYear[];
  loadFiscalYears?: () => Promise<FiscalYear[]>;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ViewToolbar<T>({ state: s, controls = {}, loadOptions, fiscalYears, loadFiscalYears, leading, actions }: ViewToolbarProps<T>) {
  const { t } = useLocale();
  const c = { search: true, filter: true, sort: true, quickFilters: true, ...controls };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      {c.search && (
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 ps-8" placeholder={t("listSearch")} aria-label={t("listSearch")} value={s.search} onChange={(e) => s.setSearch(e.target.value)} />
        </div>
      )}
      {c.quickFilters && <QuickFilters fields={s.filterFields} shown={s.quickFields} onShownChange={s.setQuickFields} query={s.query} onChange={s.setQuery} />}
      <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
        {c.filter && <FilterBuilder fields={s.filterFields} query={s.query} onChange={s.setQuery} activeCount={s.activeCount} loadOptions={loadOptions} fiscalYears={fiscalYears} loadFiscalYears={loadFiscalYears} />}
        {c.sort && <SortMenu columns={s.columns} sort={s.sort} onChange={s.setSort} />}
        {actions}
      </div>
    </div>
  );
}
