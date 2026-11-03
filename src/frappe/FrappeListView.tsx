/**
 * FrappeListView — `ListView` over a Frappe DocType: `<FrappeListView doctype="ToDo" />`. Columns, filter fields,
 * quick filters, title and default sort come from the DocType; everything else is a `ListView` prop (row click, row
 * actions, selection and bulk actions, toolbar, controls, storage). Works without any provider (one is created).
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { ListView, type ListViewProps } from "../list/ListView";
import { FrappeProvider } from "./FrappeProvider";
import { useFrappeClient } from "./FrappeProvider";
import { useLocale } from "../theme/ThemeProvider";
import { usePermissions } from "./hooks/usePermissions";
import { useFrappeList, type FrappeListOptions } from "./useFrappeList";
import { FrappeBulkActions, type FrappeBulkOptions } from "./list/FrappeBulkActions";
import { useListRealtime } from "./list/realtime";
import type { RealtimePort } from "./contract";
import { createFrappeSavedFilters, createFrappeUserSettings } from "./list/storage";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import { Button } from "../primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/dropdown-menu";
import { useFrappeSettings } from "./FrappeProvider";
import { withFrappeApi } from "./client";
import { canExport, canImport } from "./services/permissions";
import { FrappeExportDialog, type ExportDialogLabels } from "./list/FrappeExportDialog";

type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "onLoadMore"
  | "totalLabel" | "hasMore" | "onTotalClick" | "searchHint" | "selectionScope" | "filterFields" | "groupByOptions" | "searchFields" | "pageSize" | "fiscalYears" | "loadFiscalYears";

export interface FrappeListViewProps<T> extends Omit<ListViewProps<T>, Managed>, FrappeListOptions<T> {
  /** Default: the document `name`. */
  rowKey?: (row: T) => string;
  /**
   * Keep saved filters and the user's list settings on the server (`List Filter` rows; `user_settings`) instead of
   * localStorage. An explicit `storage` prop wins. `user` (the session user) is required for saved filters.
   */
  /**
   * Bulk actions (delete, submit, cancel, edit, assign) in the selection bar, each offered only when `permissions` allow
   * it. Turns `selectable` on. Runs next to the app's own `bulkActions`.
   */
  bulk?: FrappeBulkOptions;
  /** Offers "Create your first {DocType}" in the empty list (Desk: only when the user may create). */
  onCreate?: () => void;
  /** Reload on the server's `list_update` (debounced 2 s, 15 s for large tables; not while rows are selected). */
  realtime?: RealtimePort;
  /** Override the realtime quiet period (ms). Default 2000, 15000 for large tables. */
  realtimeDebounceMs?: number;
  serverStorage?: boolean | { user?: string; savedFilters?: boolean; userSettings?: boolean; global?: boolean };
  /**
   * The list menu's "Import" (Desk `list_view.js:1703-1712`), offered only when `canImport` (DocType `allow_import` and
   * System Manager or the level-0 `import` right — needs `session.roles`). Default: open Desk's Data Import tool for the
   * DocType (`/app/data-import/new?reference_doctype=…`; Desk itself routes to the Data Import LIST, `:1706-1708`).
   * `onImport` replaces the navigation (e.g. your own dialog over `startDataImport`).
   */
  onImport?: () => void;
  /** Turn the menu entries off: `{ import: false }`, `{ export: false }`, or `false` for both. Default: both, gated by permissions. */
  menu?: boolean | { import?: boolean; export?: boolean };
  /** Labels of the Import / Export entries and the Export dialog (English by default). */
  ioLabels?: Partial<ExportDialogLabels & { importEntry: string; exportEntry: string; moreActions: string }>;
}

export function FrappeListView<T = Record<string, unknown>>(props: FrappeListViewProps<T>) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext, serverStorage, bulk, onCreate, realtime, realtimeDebounceMs, rowKey, onImport, menu, ioLabels, ...rest }: FrappeListViewProps<T>) {
  const f = useFrappeList<T>({ doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext });
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  const fallbackClient = useFrappeClient();
  const c = client ?? fallbackClient;
  const api = React.useMemo(() => withFrappeApi(c), [c]);
  const metaRef = React.useRef(f.meta);
  metaRef.current = f.meta;
  // bulk gates: the user's rights on the DocType (Desk's `frm.perm`); the `permissions` prop overrides
  const perms = usePermissions(f.bundle);
  const { t } = useLocale();
  const [selectedCount, setSelectedCount] = React.useState(0);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkMessage, setBulkMessage] = React.useState("");
  useListRealtime({ port: realtime, doctype, enabled: !f.settings?.disable_auto_refresh, isLargeTable: f.meta?.isLargeTable, suppressed: selectedCount > 0 || bulkBusy, debounceMs: realtimeDebounceMs });

  // Import / Export (docs/release/LISTVIEW-FRAPPE-PARITY.md). Gates are Desk's client checks (model.js:434-450) from the
  // session roles + the DocType's DocPerm rows; the server decides anyway (data_import.py:59-75, exporter.py:116-126).
  // Desk shows Export to everyone (list_view.js:2092) — the package hides it without the right (Phase 26 rule D.1).
  const { session } = useFrappeSettings();
  const menuOn = menu === false ? { import: false, export: false } : { import: true, export: true, ...(typeof menu === "object" ? menu : {}) };
  const showImport = menuOn.import !== false && canImport(f.bundle?.meta, session?.roles, perms.levels[0]);
  const showExport = menuOn.export !== false && !!f.bundle && canExport(session?.roles, perms.levels[0]);
  const [exporting, setExporting] = React.useState<{ names?: string[] } | null>(null);
  const L = { importEntry: "Import", exportEntry: "Export", moreActions: "More actions", ...ioLabels };
  const doImport = onImport ?? (() => { if (typeof location !== "undefined") location.assign(`/app/data-import/new?reference_doctype=${encodeURIComponent(doctype)}`); });
  const menuNode = showImport || showExport ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={L.moreActions} data-testid="sf-list-menu"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showImport && <DropdownMenuItem onSelect={() => doImport()}><Upload className="me-2 h-4 w-4" /> {L.importEntry}</DropdownMenuItem>}
        {showExport && <DropdownMenuItem onSelect={() => setExporting({})}><Download className="me-2 h-4 w-4" /> {L.exportEntry}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const renderBulk = React.useMemo(() => {
    if ((!bulk && !showExport) || !f.meta) return rest.renderBulkActions;
    const meta = f.meta;
    return (ctx: { keys: string[]; rows: T[]; clear: () => void }) => (
      <>
        {bulk && <FrappeBulkActions client={c} meta={meta} doctype={doctype} keys={ctx.keys} clear={ctx.clear} onBusy={setBulkBusy} onMessage={setBulkMessage}
          options={{ allowEdit: !!f.settings?.allow_edit, ...bulk, permissions: bulk.permissions ?? ((p) => perms.can(p)) }} />}
        {showExport && (
          // Desk's Actions → Export: the exporter preset to "by_filter" on the checked names (bulk_operations.js:463-474)
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExporting({ names: ctx.keys })}><Download className="h-4 w-4" /> {L.exportEntry}</Button>
        )}
        {rest.renderBulkActions?.(ctx)}
      </>
    );
  }, [bulk, perms, f.meta, f.settings, c, doctype, rest.renderBulkActions, showExport, L.exportEntry]);
  const server = typeof serverStorage === "object" ? serverStorage : serverStorage ? {} : null;
  const storage = React.useMemo(() => {
    if (rest.storage !== undefined || !server || !f.ready) return rest.storage;
    return {
      prefs: server.userSettings === false ? undefined : createFrappeUserSettings(c, { doctype, initial: f.userSettings, meta: () => metaRef.current }),
      saved: server.savedFilters === false || !server.user ? undefined : createFrappeSavedFilters(c, { user: server.user, meta: () => metaRef.current, global: server.global }),
    };
  }, [rest.storage, server?.user, server?.userSettings, server?.savedFilters, server?.global, !!server, f.ready, c, doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
    <ListView<T>
      // remount once the DocType is known, so default columns and quick filters initialise from it
      key={f.ready ? "ready" : "meta"}
      viewKey={doctype}
      quickFilterFields={rest.quickFilterFields ?? quickFilterFields}
      loadOptions={rest.loadOptions ?? loadOptions}
      {...rest}
      storage={storage}
      emptyMessage={rest.emptyMessage ?? t("listEmptyNone").replace("{doctype}", doctype)}
      emptyFilteredMessage={rest.emptyFilteredMessage ?? t("listEmptyFilteredDoctype").replace("{doctype}", doctype)}
      emptyAction={rest.emptyAction ?? (onCreate ? { label: t("listCreateFirst").replace("{doctype}", doctype), onClick: onCreate } : undefined)}
      selectable={rest.selectable ?? (bulk ? true : undefined)}
      toolbarActions={menuNode || rest.toolbarActions ? <>{rest.toolbarActions}{menuNode}</> : undefined}
      renderBulkActions={renderBulk}
      onSelectionChange={(k) => { setSelectedCount(k.length); rest.onSelectionChange?.(k); }}
      {...data}
      rowKey={rowKey ?? data.rowKey}
    />
    {bulkMessage && <p className="mt-2 text-sm text-muted-foreground" role="status">{bulkMessage}</p>}
    {f.bundle && exporting && (
      <FrappeExportDialog api={api} bundle={f.bundle} open onOpenChange={(o) => !o && setExporting(null)} selectedNames={exporting.names}
        filters={f.request?.filters} levels={session?.roles ? perms.levels : undefined} labels={ioLabels} />
    )}
    </>
  );
}
