/**
 * ImageView — the batteries-included Image view: `ViewToolbar` + `ImageGrid` + the list pager on `useListState`, so it
 * takes the same options as `ListView` (client or server mode, filters, sort, search, paging, selection) and renders
 * the rows as image cards. Nothing here talks to a server (`FrappeImageView` wraps it).
 *
 * P36c views — the selection's actions, as `ListView` has them (Desk's ImageView extends ListView, image_view.js:6, and
 * keeps its check events, :17-21, so checking a card's `list-row-checkbox`, :113, swaps the primary action for the
 * Actions menu: `on_row_checked` → `toggle_actions_menu_button`, list_view.js:1613-1634, 590-598). The same props as
 * `ListView`: `primaryAction`, `bulkActions`, `renderBulkActions`, `selectionMode` ("header" default | "bar"),
 * `renderActionsMenu`, `onActionsOpenChange`, `actionsLabel`. In header mode, while cards are selected a strip above the
 * cards shows select-all (this page), "{n} items selected" and Clear — the List view's header content; Desk's Image view
 * has no header row (`get_header_html` is commented out, image_view.js:161-177). The surface appears once any of those
 * selection props is given; a plain `selectable` ImageView keeps its cards-only selection (unchanged).
 */
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import type { LoadOptions } from "../parts/FilterBuilder";
import { ListPagination } from "../parts/ListFooter";
import { useListState, type UseListStateOptions } from "../useListState";
import { EMPTY_QUERY, type FiscalYear } from "../model/filters";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { DropdownMenuItem } from "../../primitives/dropdown-menu";
import type { ListViewProps } from "../ListView";
import { BulkActionBar, ListActionsMenu, resolveBulkActions, type BulkActionContext } from "../parts/ListFooter";
import { SelectionHeaderContent } from "../parts/ListTable";
import { ImageGrid, type ImageGridProps } from "./ImageGrid";
import { ViewToolbar, type ViewToolbarControls } from "./ViewToolbar";

export interface ImageViewProps<T> extends UseListStateOptions<T>, Pick<ImageGridProps<T>, "image" | "title" | "detail" | "indicator" | "onOpen">,
  // P36c views — the selection's actions, exactly as `ListView` takes them (see there)
  Pick<ListViewProps<T>, "primaryAction" | "bulkActions" | "renderBulkActions" | "selectionMode" | "renderActionsMenu" | "onActionsOpenChange" | "actionsLabel"> {
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
  const { image, title, detail, indicator, onOpen, selectable, onSelectionChange, loading, error, onRetry, emptyMessage, controls, loadOptions, loadFiscalYears, toolbarLeading, toolbarActions, totalLabel, hasMore, className,
    primaryAction, bulkActions, renderBulkActions, selectionMode = "header", renderActionsMenu, onActionsOpenChange, actionsLabel } = props;
  const selectedKeys = [...s.selected];
  const sig = selectedKeys.join("\u0001");
  React.useEffect(() => { onSelectionChange?.([...s.selected]); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = s.activeCount > 0 || !!s.search.trim();
  // the List view's header mode (ListView.tsx): the Actions menu replaces `primaryAction` while ANY card is selected (Desk
  // swaps on the selection alone, list_view.js:1634) — an empty menu says so instead of bringing the primary action back
  // backward compatible: a plain `selectable` ImageView (no actions given) keeps its 0.7.0-dev cards-only selection
  const surface = props.selectionMode !== undefined || bulkActions !== undefined || !!renderActionsMenu || !!renderBulkActions;
  const header = !!selectable && selectionMode === "header" && surface;
  const hasActions = header && selectedKeys.length > 0;
  const actionCtx: BulkActionContext<T> = { keys: selectedKeys, rows: hasActions ? s.selectedRows() : [], clear: s.clearSelection };
  const noActions = hasActions && resolveBulkActions(bulkActions, actionCtx).length === 0 && !renderActionsMenu;
  const shown = s.rows;
  const onPage = shown.filter((r) => s.isSelected(r)).length;
  const allOn = shown.length > 0 && onPage === shown.length;
  const actions = (
    <>
      {toolbarActions}
      {hasActions && renderBulkActions?.(actionCtx)}
      {hasActions
        ? <ListActionsMenu actions={bulkActions} ctx={actionCtx} label={actionsLabel} onOpenChange={onActionsOpenChange}
            extra={noActions ? <DropdownMenuItem disabled data-no-actions="">{t("listNoActions")}</DropdownMenuItem> : renderActionsMenu?.(actionCtx)} />
        : primaryAction}
    </>
  );
  return (
    <div className={cn("space-y-3 sf-datagrid", className)}>
      <ViewToolbar state={s} controls={controls} loadOptions={loadOptions} fiscalYears={props.fiscalYears} loadFiscalYears={loadFiscalYears} leading={toolbarLeading} actions={actions} />
      {hasActions && (
        // the List view's selection header (select all on this page, "{n} items selected", Clear) above the cards
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-1.5" data-testid="sf-image-selection">
          <Checkbox checked={allOn ? true : onPage > 0 ? "indeterminate" : false} onCheckedChange={(c) => s.setRowsSelected(shown, c === true)} aria-label={t("selectAll")} />
          <SelectionHeaderContent count={selectedKeys.length} onClear={s.clearSelection} allShownSelected={allOn} />
        </div>
      )}
      {selectable && !header && (bulkActions?.length || renderBulkActions) ? (
        <BulkActionBar count={selectedKeys.length} actions={bulkActions} render={renderBulkActions} onClear={s.clearSelection} keys={selectedKeys} rows={s.selectedRows()} />
      ) : null}
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
