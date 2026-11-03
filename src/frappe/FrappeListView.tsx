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
import { canImport } from "./services/permissions";
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
   * Desk's Actions in the selection bar, in Desk's order (`list_view.js:2088-2128`): Edit, Export, Assign To, Clear
   * Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete, then the workflow's actions — each offered
   * only when `permissions` allow it (Export always). Turns `selectable` on. Runs next to the app's own `bulkActions`.
   * `bulk.print` passes the site's Print Settings and a background-print task subscriber; `bulk.hasWorkflow` defaults to
   * the DocType's active Workflow (`__workflow_docs`).
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
   * System Manager or the level-0 `import` right — needs `session.roles`), as Desk gates it. Default: Desk's Data Import
   * LIST filtered on the DocType, `/app/data-import?reference_doctype=…` — Desk's `set_route("list", "data-import",
   * {reference_doctype})` keeps the object in `frappe.route_options` and pushes `/app/data-import` (`router.js:431-440`,
   * `:466-472`); from outside Desk the same options travel as the query string, which Desk reads back into
   * `route_options` (`router.js:548-566`). `onImport` replaces the navigation (e.g. your own dialog over `startDataImport`).
   */
  onImport?: () => void;
  /**
   * Turn the menu entries off: `{ import: false }`, `{ export: false }`, or `false` for both. Default: Import gated by
   * `canImport`; Export ALWAYS offered, as Desk does (`list_view.js:2075-2092`, owner decision Phase 27 #1) — the server
   * refuses a user without the right (`exporter.py:116-126`) and the dialog shows that refusal. An app that prefers to
   * hide it can pass `menu={{ export: canExport(roles, levels[0]) }}`.
   */
  menu?: boolean | { import?: boolean; export?: boolean };
  /** Labels of the Import / Export entries (default: the message catalogue) and of the Export dialog (English by default). */
  ioLabels?: Partial<ExportDialogLabels & { importEntry: string; exportEntry: string; moreActions: string }>;
}

/** Desk's Import route as a URL: the Data Import list with `reference_doctype` as a route option (`router.js:548-566`). */
export const dataImportListUrl = (doctype: string) => `/app/data-import?reference_doctype=${encodeURIComponent(doctype)}`;

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

  // Import / Export (docs/release/LISTVIEW-FRAPPE-PARITY.md). Import keeps Desk's client gate (model.js:434-442 via
  // list_view.js:1703); the server decides anyway (data_import.py:59-75). Export is offered to everyone, exactly as Desk
  // pushes it unconditionally (list_view.js:2075-2092) — owner decision Phase 27 #1, reversing the Phase 26 rule D.1
  // gate: the server is the authority (exporter.py:116-126 `can_export`) and FrappeExportDialog shows its refusal as a
  // permission error (FrappeErrorState), with no file and no success.
  const { session } = useFrappeSettings();
  const menuOn = menu === false ? { import: false, export: false } : { import: true, export: true, ...(typeof menu === "object" ? menu : {}) };
  const showImport = menuOn.import !== false && canImport(f.bundle?.meta, session?.roles, perms.levels[0]);
  const showExport = menuOn.export !== false && !!f.bundle;
  const [exporting, setExporting] = React.useState<{ names?: string[] } | null>(null);
  const L = { importEntry: t("listMenuImport"), exportEntry: t("listBulkExport"), moreActions: t("listMenuMore"), ...ioLabels };
  // Desk: frappe.set_route("list", "data-import", { reference_doctype }) — the Data Import LIST (list_view.js:1703-1712)
  const doImport = onImport ?? (() => { if (typeof location !== "undefined") location.assign(dataImportListUrl(doctype)); });
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
    // Desk hides Edit / Submit / Cancel / Delete and adds the workflow's actions when the DocType has an active Workflow
    // (frappe.model.has_workflow, list_view.js:1806, 1881-1886, 2111-2125) — read from getdoctype's `__workflow_docs`
    const hasWorkflow = bulk?.hasWorkflow ?? !!perms.workflow;
    return (ctx: { keys: string[]; rows: T[]; clear: () => void }) => (
      <>
        {bulk ? (
          <FrappeBulkActions client={c} meta={meta} doctype={doctype} keys={ctx.keys} rows={ctx.rows} docMeta={f.bundle?.meta} roles={session?.roles} clear={ctx.clear} onBusy={setBulkBusy} onMessage={setBulkMessage}
            // Desk's Actions → Export: the exporter preset to "by_filter" on the checked names (bulk_operations.js:463-474), in Desk's position
            onExport={showExport ? () => setExporting({ names: ctx.keys }) : undefined} exportLabel={L.exportEntry}
            options={{ allowEdit: !!f.settings?.allow_edit, ...bulk, hasWorkflow, permissions: bulk.permissions ?? ((p) => perms.can(p)) }} />
        ) : showExport ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExporting({ names: ctx.keys })}><Download className="h-4 w-4" /> {L.exportEntry}</Button>
        ) : null}
        {rest.renderBulkActions?.(ctx)}
      </>
    );
  }, [bulk, perms, f.meta, f.bundle, f.settings, c, doctype, rest.renderBulkActions, showExport, L.exportEntry, session?.roles]);
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
