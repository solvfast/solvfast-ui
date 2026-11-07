/**
 * ImageView — the batteries-included Image view: `ViewToolbar` + `ImageGrid` + the list pager on `useListState`, so it
 * takes the same options as `ListView` (client or server mode, filters, sort, search, paging, selection) and renders
 * the rows as image cards. Nothing here talks to a server (`FrappeImageView` wraps it).
 */
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import type { LoadOptions } from "../parts/FilterBuilder";
import { ListPagination } from "../parts/ListFooter";
import { useListState, type UseListStateOptions } from "../useListState";
import { EMPTY_QUERY, type FiscalYear } from "../model/filters";
import { Button } from "../../primitives/button";
import { ImageGrid, type ImageGridProps } from "./ImageGrid";
import { ViewToolbar, type ViewToolbarControls } from "./ViewToolbar";

export interface ImageViewProps<T> extends UseListStateOptions<T>, Pick<ImageGridProps<T>, "image" | "title" | "detail" | "indicator" | "onOpen"> {
  selectable?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  emptyMessage?: React.ReactNode;
  controls?: ViewToolbarControls;
  loadOptions?: LoadOptions;
  loadFiscalYears?: () => Promise<FiscalYear[]>;
  /** Before the search box (e.g. a ViewSwitcher). */
  toolbarLeading?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  /** Server mode: text instead of the numeric total. */
  totalLabel?: string;
  /** Server mode: more rows may follow even though `total` says otherwise. */
  hasMore?: boolean;
  className?: string;
}

export function ImageView<T>(props: ImageViewProps<T>) {
  const { t } = useLocale();
  const s = useListState(props);
  const { image, title, detail, indicator, onOpen, selectable, onSelectionChange, loading, error, onRetry, emptyMessage, controls, loadOptions, loadFiscalYears, toolbarLeading, toolbarActions, totalLabel, hasMore, className } = props;
  const sig = [...s.selected].join("\u0001");
  React.useEffect(() => { onSelectionChange?.([...s.selected]); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = s.activeCount > 0 || !!s.search.trim();
  return (
    <div className={cn("space-y-3 sf-datagrid", className)}>
      <ViewToolbar state={s} controls={controls} loadOptions={loadOptions} fiscalYears={props.fiscalYears} loadFiscalYears={loadFiscalYears} leading={toolbarLeading} actions={toolbarActions} />
      <ImageGrid rows={s.rows} rowKey={s.rowKey} image={image} title={title} detail={detail} indicator={indicator} onOpen={onOpen}
        selection={selectable ? { isSelected: s.isSelected, toggleRow: s.toggleRow } : undefined}
        loading={loading} error={error} onRetry={onRetry}
        empty={filtered ? (
          <div className="flex flex-col items-center gap-2">
            <span>{t("listEmptyFiltered")}</span>
            <Button variant="outline" size="sm" onClick={() => { s.setQuery(EMPTY_QUERY); s.setSearch(""); }}>{t("listClearFilters")}</Button>
          </div>
        ) : emptyMessage} />
      {/* the pager stays the last child of .sf-datagrid (pill styles) */}
      {error ? <div hidden /> : <ListPagination total={s.total} totalLabel={totalLabel} page={s.page} hasPrev={s.hasPrev} hasNext={s.hasNext || (!!hasMore && s.mode === "server" && s.rows.length >= s.pageSize)} onPage={s.setPage} />}
    </div>
  );
}
