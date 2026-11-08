/**
 * FrappeImageView — Desk's Image view (frappe/public/js/frappe/views/image/image_view.js) over a DocType: the Core
 * `ImageView` fed by `frappe.desk.reportview.get`, with the DocType's `image_field` and `title_field` (image_view.js:21-29
 * requests name, the in_list_view fields, the title field and the image field), the first non-empty list field as the
 * detail line (`item_details_html`, :68-85), and the list's filters, search, sort and paging.
 *
 * Not reproduced from Desk: the photo gallery / zoom (PhotoSwipe, :140-196, and the `get_attached_images` lookup of
 * every attachment), the Like heart on the card, the "Images" page title.
 *
 * P36c views — Desk's Actions on the checked cards (`bulk`): Desk's ImageView extends ListView (image_view.js:6), keeps
 * its check events (`setup_check_events`, :17-21) and its page head (`set_primary_action` + `set_actions_menu_items`,
 * list_view.js:157-179), and puts a `list-row-checkbox` on every card (:113-114). Checking one swaps "Add {DocType}" for
 * the Actions menu (`on_row_checked` → `toggle_actions_menu_button`, list_view.js:1613-1634, 590-598), whose items, gates
 * and outcomes are the List view's (`get_actions_menu_items`, :1855-2128; `get_checked_items`, :1643-1651). The package
 * reuses the List / Report wiring as is (`useFrappeSelectionActions`), so the Image view offers exactly what they offer.
 */
import * as React from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { ImageView, type ImageViewProps } from "../../list/views/ImageView";
import { FrappeProvider } from "../FrappeProvider";
import type { FrappeClient } from "../client";
import type { FrappeFilter } from "../query";
import type { ListQueryState } from "../../list/useListState";
import { useFrappeMeta } from "../useFrappeList";
import { useLocale } from "../../theme/ThemeProvider";
import { withFrappeApi } from "../client";
import { usePermissions } from "../hooks/usePermissions";
import type { FrappeBulkOptions } from "../list/FrappeBulkActions";
import { FrappeExportDialog } from "../list/FrappeExportDialog";
import { fetchListSettings } from "../list/settings";
import { useFrappeSelectionActions } from "../list/useFrappeSelectionActions";
import { useFrappeViewList } from "./useFrappeViewList";

type Row = Record<string, unknown>;
type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "image" | "title"
  | "filterFields" | "groupByOptions" | "pageSize" | "totalLabel" | "hasMore" | "selectionScope";

export interface FrappeImageViewProps extends Omit<ImageViewProps<Row>, Managed> {
  doctype: string;
  client?: FrappeClient;
  baseFilters?: FrappeFilter[];
  /** Default 20. */
  pageSize?: number;
  /** Default: the DocType's `image_field`. */
  imageField?: string;
  /** Default: the DocType's `title_field`, else `name`. */
  titleField?: string;
  /** Turn a stored file URL (`/files/x.png`) into an `<img src>` (e.g. prefix the site URL). Default: as stored. */
  imageUrl?: (fileUrl: string) => string;
  /** The applied list state, after each change (to carry filters / sort to another view). */
  onQueryStateChange?: (state: ListQueryState) => void;
  /**
   * P36c — Desk's Actions on the checked cards, as Desk's Image view inherits them from the List view (image_view.js:6,
   * :17-21, :113; list_view.js:1855-2128): Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags,
   * Print, Submit, Cancel, Delete, then the workflow's actions — each with the List view's gates (rights, submittable,
   * active Workflow) and selection outcome. Turns `selectable` on; header mode (default: Actions replaces `primaryAction`
   * while cards are checked) or `selectionMode="bar"`. Same options as `FrappeListView` / `FrappeReportView` `bulk`.
   * Omitted: no Frappe actions (unchanged).
   */
  bulk?: FrappeBulkOptions;
}

export function FrappeImageView(props: FrappeImageViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner({ doctype, client, baseFilters, pageSize, imageField, titleField, imageUrl, onQueryStateChange, bulk, ...rest }: FrappeImageViewProps) {
  const { t } = useLocale();
  const doc = useFrappeMeta(doctype, { client }).doc as { image_field?: string; title_field?: string } | undefined;
  const image = imageField ?? doc?.image_field;
  const titleKey = titleField ?? (doc?.title_field || "name");
  const v = useFrappeViewList({ doctype, client, baseFilters, pageSize, scope: "image", extraFields: [image, titleKey].filter((f): f is string => !!f) });
  const { listProps } = v;
  // P36c — the List view's Actions, shared wiring (as FrappeReportView): rights from getdoctype (`usePermissions`), the
  // active Workflow from `__workflow_docs`, List View Settings `allow_edit` (base_list.js:72-78; same cache entry as the
  // List view's, only asked when the actions are on), Export through the exporter dialog on the checked names
  const perms = usePermissions(v.bundle);
  const listSettings = useQuery({ queryKey: ["sf-frappe", "list-settings", doctype], queryFn: () => fetchListSettings(v.client, doctype), enabled: !!bulk, staleTime: 5 * 60_000 });
  const api = React.useMemo(() => withFrappeApi(v.client), [v.client]);
  const [exporting, setExporting] = React.useState<{ names?: string[]; allMatching?: boolean } | null>(null);
  const sa = useFrappeSelectionActions<Row>({
    client: v.client, doctype, meta: v.meta, bundle: v.bundle, perms, allowEdit: !!listSettings.data?.allow_edit, rows: v.rows, rowKey: listProps.rowKey, bulk,
    exportAction: bulk && v.bundle ? { label: t("listBulkExport"), open: setExporting } : undefined,
    host: { selectionMode: rest.selectionMode, renderBulkActions: rest.renderBulkActions, bulkActions: rest.bulkActions, renderActionsMenu: rest.renderActionsMenu, onActionsOpenChange: rest.onActionsOpenChange, onSelectionChange: rest.onSelectionChange },
  });
  const onState = listProps.onStateChange;
  const onStateChange = React.useCallback((s: ListQueryState) => { onState(s); onQueryStateChange?.(s); }, [onState, onQueryStateChange]);
  const detailKeys = React.useMemo(() => (v.state?.visible ?? []).filter((k) => k !== titleKey && k !== image && k !== "name"), [v.state, titleKey, image]);
  return (
    <>
    <ImageView<Row>
      key={v.ready ? "ready" : "meta"}
      viewKey={`${doctype}:image`}
      emptyMessage={rest.emptyMessage}
      {...rest}
      {...listProps}
      selectable={rest.selectable ?? (bulk ? true : undefined)}
      {...(bulk ? sa.listProps : {})}
      quickFilterFields={rest.quickFilterFields ?? listProps.quickFilterFields}
      loadOptions={rest.loadOptions ?? listProps.loadOptions}
      onStateChange={onStateChange}
      onRetry={v.refetch}
      image={(row) => { const u = image ? row[image] : null; return typeof u === "string" && u ? (imageUrl ? imageUrl(u) : u) : null; }}
      title={(row) => String(row[titleKey] ?? row.name ?? "")}
      detail={rest.detail ?? ((row) => { const k = detailKeys.find((x) => row[x] !== null && row[x] !== undefined && row[x] !== ""); return k ? String(row[k]) : null; })}
    />
    {bulk && sa.dialogs}
    {bulk && sa.message && <p className="mt-2 text-sm text-muted-foreground" role="status" data-testid="sf-image-bulk-message">{sa.message}</p>}
    {bulk && v.bundle && exporting && (
      <FrappeExportDialog api={api} bundle={v.bundle} open onOpenChange={(o) => !o && setExporting(null)} selectedNames={exporting.names} defaultRecords={exporting.allMatching ? "by_filter" : undefined}
        filters={v.request?.filters} levels={perms.known ? perms.levels : undefined} />
    )}
    </>
  );
}
