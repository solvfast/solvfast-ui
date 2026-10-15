/**
 * ListView — the batteries-included list: Sear's DataGrid layout and look (toolbar, glass table card, pill pager) on
 * `useListState`, with PMO's features available by props. Defaults reproduce Sear's DataGrid; PMO's extra controls
 * appear when used: `selectable` + `bulkActions`, `groupByOptions`, `controls.sortMenu`, `controls.quickFiltersCustomizable`,
 * `rowActions`, `error` + `onRetry`. Nothing here talks to a server: the Frappe entry wraps this component.
 */
import * as React from "react";
import { Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../primitives/alert-dialog";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { cn } from "../lib/cn";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";
import type { ColumnDef } from "./model/columns";
import { FilterBuilder, type LoadOptions } from "./parts/FilterBuilder";
import { BulkActionBar, ListPagination, type BulkAction } from "./parts/ListFooter";
import { GroupedListTable, ListTable } from "./parts/ListTable";
import { ColumnManager, GroupByMenu, QuickFilters, SavedFilters, SortMenu } from "./parts/Toolbar";
import { useListState, type UseListStateOptions } from "./useListState";

export interface RowAction<T> {
  key: string;
  label: Localized;
  icon: React.ComponentType<{ className?: string }>;
  /** "destructive" = Sear's delete button look. */
  tone?: "default" | "destructive";
  onSelect: (row: T) => void | Promise<void>;
  /** Ask first (AlertDialog). */
  confirm?: { title: Localized; description?: Localized; confirmLabel?: Localized };
  hidden?: (row: T) => boolean;
}

export interface ListViewControls {
  search?: boolean;
  savedFilters?: boolean;
  filter?: boolean;
  columns?: boolean;
  /** PMO's "Sort by" menu (with Clear). Default off — header sorting is always there. */
  sortMenu?: boolean;
  /** PMO's quick-filter picker (users choose the fields). Default off. */
  quickFiltersCustomizable?: boolean;
}

export interface ListViewProps<T> extends UseListStateOptions<T> {
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  rowActions?: RowAction<T>[];
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  renderBulkActions?: (ctx: { keys: string[]; rows: T[]; clear: () => void }) => React.ReactNode;
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  /** Shown when there are no rows and nothing is filtered (default: "No data yet"). */
  emptyMessage?: React.ReactNode;
  /** Trailing toolbar content, e.g. a "New" button. */
  toolbarActions?: React.ReactNode;
  controls?: ListViewControls;
  /** Link-field options for filters. */
  loadOptions?: LoadOptions;
  /** Server mode + grouped: fetch the next chunk (the banner's "Load more"). */
  onLoadMore?: () => void;
  className?: string;
}

function RowActionsCell<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const { language, t } = useLocale();
  const [asking, setAsking] = React.useState<RowAction<T> | null>(null);
  return (
    <div className="flex items-center justify-start gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {actions.filter((a) => !a.hidden?.(row)).map((a) => {
        const Icon = a.icon;
        return (
          <Button key={a.key} aria-label={loc(a.label, language)} variant="outline" size="icon-sm"
            className={cn("!rounded-lg", a.tone === "destructive" && "!border-destructive/25 text-destructive")}
            onClick={() => (a.confirm ? setAsking(a) : a.onSelect(row))}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
      {asking?.confirm && (
        <AlertDialog open onOpenChange={(o) => !o && setAsking(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{loc(asking.confirm.title, language)}</AlertDialogTitle>
              {asking.confirm.description && <AlertDialogDescription>{loc(asking.confirm.description, language)}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              {/* a destructive action confirms with the destructive button (as Sear's and PMO's delete dialogs do) */}
              <AlertDialogAction asChild onClick={() => { const a = asking; setAsking(null); a.onSelect(row); }}>
                <Button variant={asking.tone === "destructive" ? "destructive" : "default"}>
                  {asking.confirm.confirmLabel ? loc(asking.confirm.confirmLabel, language) : t("confirm")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export function ListView<T>(props: ListViewProps<T>) {
  const { t } = useLocale();
  const {
    onRowClick, rowClassName, rowActions, selectable, bulkActions, renderBulkActions, loading, error, onRetry,
    emptyMessage, toolbarActions, controls = {}, loadOptions, onLoadMore, className,
  } = props;
  const s = useListState(props);
  const c = { search: true, savedFilters: true, filter: true, columns: true, sortMenu: false, quickFiltersCustomizable: false, ...controls };

  // Row actions stay the last column and are not offered in the column manager, filters or sort (Sear's Field Library
  // modelled them as an `actions` field, so it could be hidden, moved, filtered and sorted — docs/FEATURES.md, fixes).
  const columns: ColumnDef<T>[] = React.useMemo(() => rowActions?.length
    ? [...s.visibleColumns, { key: "__actions", label: t("actions"), sortable: false, filterable: false, hideable: false, render: (row: T) => <RowActionsCell row={row} actions={rowActions} /> }]
    : s.visibleColumns, [s.visibleColumns, rowActions, t]);

  const filtered = s.activeCount > 0 || !!s.search.trim();
  const tableProps = {
    columns, rowKey: s.rowKey, sort: s.sort, onSortToggle: s.toggleSort, onRowClick, rowClassName,
    selection: selectable ? { isSelected: s.isSelected, toggleRow: s.toggleRow, setRowsSelected: s.setRowsSelected } : undefined,
    loading, error, onRetry, empty: filtered ? t("noData") : emptyMessage ?? t("noData"),
  };
  const partial = s.mode === "server" && s.grouped && s.rows.length < s.total;
  const selectedKeys = [...s.selected];

  return (
    <div className={cn("space-y-3 sf-datagrid", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {c.search && (
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 ps-8" placeholder={t("listSearch")} aria-label={t("listSearch")} value={s.search} onChange={(e) => s.setSearch(e.target.value)} />
          </div>
        )}
        <QuickFilters fields={s.filterFields} shown={s.quickFields} onShownChange={s.setQuickFields} customizable={c.quickFiltersCustomizable} query={s.query} onChange={s.setQuery} />
        {/* Sear's group with `flex-wrap justify-end`: on a phone its buttons wrap instead of widening the page (Sear's
            list page was 506 px wide at 390 px). One line wherever they fit, as in Sear. */}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {c.savedFilters && s.canSave && <SavedFilters saved={s.saved} activeCount={s.activeCount} onApply={s.applySaved} onSave={s.saveCurrent} onDelete={s.removeSaved} />}
          {c.filter && <FilterBuilder fields={s.filterFields} query={s.query} onChange={s.setQuery} activeCount={s.activeCount} loadOptions={loadOptions} />}
          {s.groupByOptions.length > 0 && <GroupByMenu options={s.groupByOptions} value={s.groupBy} onChange={s.setGroupBy} />}
          {c.sortMenu && <SortMenu columns={s.visibleColumns} sort={s.sort} onChange={s.setSort} />}
          {c.columns && <ColumnManager columns={s.columns} visibleKeys={s.visibleKeys} onChange={s.setVisibleKeys} />}
          {toolbarActions}
        </div>
      </div>

      {partial && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground" role="status">
          <span>{t("partialGroups").replace("{loaded}", String(s.rows.length)).replace("{total}", String(s.total))}</span>
          {onLoadMore && <Button variant="outline" size="sm" onClick={onLoadMore}>{t("loadMore")}</Button>}
        </div>
      )}

      {s.groups ? <GroupedListTable {...tableProps} groups={s.groups} partial={partial} /> : <ListTable {...tableProps} rows={s.rows} />}

      {selectable && (bulkActions?.length || renderBulkActions) ? (
        <BulkActionBar count={selectedKeys.length} actions={bulkActions} render={renderBulkActions} onClear={s.clearSelection} keys={selectedKeys} rows={s.selectedRows()} />
      ) : null}

      {/* The pager must be the last child (pill styles, styles/src/sf-overrides.css); while grouped there is no paging (rule
          C1), so an empty element keeps those selectors from matching anything else. */}
      {s.grouped ? <div hidden /> : <ListPagination total={s.total} page={s.page} hasPrev={s.hasPrev} hasNext={s.hasNext} onPage={s.setPage} />}
    </div>
  );
}
