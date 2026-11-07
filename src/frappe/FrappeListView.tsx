/**
 * FrappeListView — `ListView` over a Frappe DocType: `<FrappeListView doctype="ToDo" />`. Columns, filter fields,
 * quick filters, title and default sort come from the DocType; everything else is a `ListView` prop (row click, row
 * actions, selection and bulk actions, toolbar, controls, storage). Works without any provider (one is created).
 */
import * as React from "react";
import { QueryClientContext, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ListView, type ListViewProps } from "../list/ListView";
import type { ListLikeConfig } from "../list/parts/ListTable";
import type { FrappeFilter } from "./query";
import { FrappeProvider } from "./FrappeProvider";
import { useFrappeClient } from "./FrappeProvider";
import { useLocale } from "../theme/ThemeProvider";
import { usePermissions } from "./hooks/usePermissions";
import { invalidateFrappeList, useFrappeList, type FrappeListOptions } from "./useFrappeList";
import { FrappeBulkActions, useFrappeBulkActions, type FrappeBulkOptions } from "./list/FrappeBulkActions";
import type { FrappeListMeta } from "./meta";
import type { BulkAction } from "../list/parts/ListFooter";
import { useListRealtime } from "./list/realtime";
import type { RealtimePort } from "./contract";
import { createFrappeSavedFilters, createFrappeUserSettings } from "./list/storage";
import { Download, FileSpreadsheet, MoreHorizontal, PanelLeft, Plus, Settings2, ShieldCheck, Upload, Wrench } from "lucide-react";
import { FrappeListSettingsDialog } from "./list/FrappeListSettingsDialog";
import { hasIndicator as hasIndicatorFn, indicatorWorkflowFromMeta } from "./list/indicator";
import { DEFAULT_SIDEBAR_GROUP_BY, FrappeGroupBySidebar } from "./list/FrappeGroupBySidebar";
import { Button } from "../primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../primitives/dropdown-menu";
import { useFrappeSettings } from "./FrappeProvider";
import { withFrappeApi } from "./client";
import { actsAsSystemManagerFor, canExport, canImport } from "./services/permissions";
import { FrappeReportExportDialog } from "./list/FrappeReportExportDialog";
import { FrappeExportDialog, type ExportDialogLabels } from "./list/FrappeExportDialog";
import type { ListQueryState } from "../list/useListState";
import type { FrappeDoc } from "./contract";
import { FrappeQuickEntry } from "./form/FrappeQuickEntry";
import { newDoc, type DefaultsContext } from "./form/model/defaults";
import { quickEntryFields } from "./form/model/quickEntry";

type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "onLoadMore"
  | "totalLabel" | "hasMore" | "onTotalClick" | "searchHint" | "selectionScope" | "filterFields" | "groupByOptions" | "searchFields" | "pageSize" | "fiscalYears" | "loadFiscalYears" | "like";

export interface FrappeListViewProps<T> extends Omit<ListViewProps<T>, Managed>, FrappeListOptions<T> {
  /** Default: the document `name`. */
  rowKey?: (row: T) => string;
  /**
   * Desk's Like heart on every row and the "Liked by me" header toggle (list_view.js:729-735, 985-991, 1431-1455). On by
   * default when the provider's session names a logged-in user (none for Guest / no session); `false` turns it off.
   * The heart reads `_liked_by` (requested with every list, as Desk's std_fields_list), toggles through
   * `frappe.desk.like.toggle_like` (not optimistic: the row changes only after the server answers) and updates the
   * cached rows without reloading the list, as Desk does. "Liked by me" adds `_liked_by like %user%` (always ANDed).
   */
  like?: boolean;
  /** A like / unlike failed. Desk is quiet (the heart keeps its state); this lets the host show something. */
  onLikeError?: (error: unknown, row: T) => void;
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
   *
   * With `selectionMode="header"` (Desk's own layout, list_view.js:590-598, 1613-1634) the same actions are the items of the
   * toolbar's Actions menu that replaces `primaryAction` while rows are selected — no bar row; the workflow's actions are
   * asked from the server each time the menu opens, and Assign To opens Desk's dialog (Assign to me, users, Complete By,
   * Priority, Comment). The default stays "bar" (0.4.x).
   */
  bulk?: FrappeBulkOptions;
  /** Offers "Create your first {DocType}" in the empty list — only when the user may create (level-0 `create`, from
   *  `session.roles`; unknown rights → not offered, rule 9). */
  onCreate?: () => void;
  /**
   * Desk's primary "Add {DocType}" button (list_view.js:279-296 `set_primary_action`), shown only when the user may create
   * (`frappe.model.can_create`; here the level-0 `create` right from `session.roles` — unknown rights hide it). Omit: no
   * built-in button (`primaryAction` / `onCreate` as before). `false`: never (also no empty-state create). An object:
   * `label` (default "Add {DocType}"), `onCreate` (e.g. route to the new form), or `render` — a dialog the list opens
   * (e.g. a Quick Entry); its `onCreated(doc)` reloads the list and closes it. An app `primaryAction` still wins.
   */
  create?: false | FrappeListCreate;
  /**
   * Desk's list sidebar (list_sidebar.js, list_sidebar_group_by.js): group-by counts from the server
   * (`get_group_by_count`) for "Assigned To", "Created By" and the user's `user_settings.group_by_fields` (or `fields`),
   * plus the tag stats unless List View Settings `disable_sidebar_stats`; clicking a value filters the list. Adds
   * "Toggle Sidebar" to the list menu. Off by default (no extra requests); `true` = open, `{ open: false }` = closed.
   */
  sidebar?: boolean | { open?: boolean; fields?: string[]; tags?: boolean };
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
  /** `reportExport: true` adds "Export as report" (Report-view `export_query`, gated by `canExport` as Desk's report view,
   *  report_view.js:1646). Off by default: Desk's List View has no such entry (Phase 27.5 decision review). */
  /**
   * P35 — Desk's other menu entries (list_view.js:1714-1785), each on by default and offered only to System Managers
   * (the Administrator user included): `userPermissions` (`/app/user-permission?allow=<doctype>`), `rolePermissions`
   * (`/app/permission-manager?doctype=<doctype>`), `customize` (`/app/customize-form?doc_type=<doctype>`, or the DocType
   * form for a custom DocType — Desk gates it on creating Custom Field and Property Setter, which stock Frappe grants to
   * System Manager / Administrator only), `listSettings` (the List Settings dialog, `save_listview_settings`). `false`
   * turns one off; `menu={false}` turns every entry off.
   */
  menu?: boolean | { import?: boolean; export?: boolean; reportExport?: boolean; userPermissions?: boolean; rolePermissions?: boolean; customize?: boolean; listSettings?: boolean };
  /** Where menu entries navigate (Import without `onImport`, User Permissions, Role Permissions Manager, Customize).
   *  Default: `location.assign(url)`. `url` is Desk's route as a URL (`/app/…` with route options as the query string). */
  onNavigate?: (url: string, entry: "import" | "userPermissions" | "rolePermissions" | "customize") => void;
  /** The applied list state (filters, sort, search, page) after each change — e.g. to carry the filters into another view
   *  (`FrappeViews` does). P35 integration. */
  onQueryStateChange?: (state: ListQueryState) => void;
  /** Labels of the Import / Export entries (default: the message catalogue) and of the Export dialog (English by default). */
  ioLabels?: Partial<ExportDialogLabels & { importEntry: string; exportEntry: string; moreActions: string; reportExportEntry: string }>;
}

export interface FrappeListCreate {
  label?: string;
  onCreate?: () => void;
  /** The create dialog. Default (P35 integration, when neither `render` nor `onCreate` / the `onCreate` prop is given):
   *  `FrappeQuickEntry` for a Quick Entry eligible DocType (`quickEntryFields(meta).eligible`); for any other DocType
   *  `onOpenFullForm(newDoc)` is called directly when given, else the Quick Entry dialog shows the whole form. */
  render?: (p: { open: boolean; onOpenChange(open: boolean): void; onCreated(doc: Record<string, unknown>): void }) => React.ReactNode;
  /** The host's full-form route (P35): Quick Entry's "Edit Full Form", and the target of "Add" for a DocType that is not
   *  Quick Entry eligible — receives the unsaved new document. */
  onOpenFullForm?: (doc: FrappeDoc) => void;
  /** New-document defaults for the default Quick Entry (`routeOptions`, `userDefaults`, …). */
  defaults?: DefaultsContext;
}

/** Desk's Import route as a URL: the Data Import list with `reference_doctype` as a route option (`router.js:548-566`). */
/**
 * UI row identity vs the Frappe document name. Selection is keyed by the list's `rowKey` (kept across pages); every server
 * request needs the document `name`. Resolves the selected keys through a key → name map of the rows the list has shown.
 * `missing` lists keys whose row is no longer known: callers must not send them (a UI key is never a document name).
 */
export function documentNamesForKeys(keys: readonly string[], nameByKey: ReadonlyMap<string, string>): { names: string[]; missing: string[] } {
  const names: string[] = []; const missing: string[] = [];
  for (const k of keys) { const n = nameByKey.get(k); if (n === undefined) missing.push(k); else names.push(n); }
  return { names, missing };
}

/** Desk's page lengths (base_list.js:375). FrappeListView offers them by default; `pageSizes={[]}` hides the picker. */
export const DESK_PAGE_SIZES = [20, 100, 500, 2500];

/** Desk's `set_route("list", "user-permission", { allow })` as a URL (list_view.js:1714-1722; router.js:431-440, 548-566). */
export const userPermissionsUrl = (doctype: string) => `/app/user-permission?allow=${encodeURIComponent(doctype)}`;
/** Desk's `set_route("permission-manager", { doctype })` as a URL (list_view.js:1725-1733). */
export const rolePermissionsUrl = (doctype: string) => `/app/permission-manager?doctype=${encodeURIComponent(doctype)}`;
/** Desk's Customize (list_view.js:1735-1754): the DocType form for a custom DocType, else Customize Form with `doc_type`. */
export const customizeUrl = (doctype: string, custom = false) => (custom ? `/app/doctype/${encodeURIComponent(doctype)}` : `/app/customize-form?doc_type=${encodeURIComponent(doctype)}`);

export const dataImportListUrl = (doctype: string) => `/app/data-import?reference_doctype=${encodeURIComponent(doctype)}`;

export function FrappeListView<T = Record<string, unknown>>(props: FrappeListViewProps<T>) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner<T>({ like = true, onLikeError, doctype, columns, baseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext, serverStorage, bulk, onCreate, create, sidebar, onNavigate, realtime, realtimeDebounceMs, rowKey, onImport, menu, ioLabels, treeDoctypes, columnLimit, hideNameColumn, urlFilters, onQueryStateChange, ...rest }: FrappeListViewProps<T>) {
  // `columnLimit` defaults ON here: Desk always caps the generated columns by window width (list_view.js:432-444);
  // app-curated `columns` are never capped. `columnLimit={false}` keeps every `in_list_view` column.
  // Like: the session user decides; "Liked by me" narrows the list server-side like Desk's filter (always ANDed)
  const { session: likeSession } = useFrappeSettings();
  const likeUser = like && likeSession?.user && likeSession.user !== "Guest" ? likeSession.user : undefined;
  const [likedByMe, setLikedByMe] = React.useState(false);
  const effectiveBaseFilters = React.useMemo<FrappeFilter[] | undefined>(
    () => (likeUser && likedByMe ? [...(baseFilters ?? []), ["_liked_by", "like", `%${likeUser}%`]] : baseFilters),
    [baseFilters, likeUser, likedByMe],
  );
  const f = useFrappeList<T>({ doctype, columns, baseFilters: effectiveBaseFilters, searchFields, groupByFields, chunkSize, pageSize, fieldLabels, client, fiscalYears, rowMeta, workflow, getIndicator, listSettings, formatContext, treeDoctypes, columnLimit: columnLimit ?? true, hideNameColumn, urlFilters });
  const { quickFilterFields, loadOptions, ...data } = f.listProps;
  const fallbackClient = useFrappeClient();
  const c = client ?? fallbackClient;
  const api = React.useMemo(() => withFrappeApi(c), [c]);
  const queryClient = useQueryClient();
  const likeConfig = React.useMemo<ListLikeConfig<T> | undefined>(() => {
    if (!likeUser) return undefined;
    return {
      isLiked: (row) => likedBy(row).includes(likeUser),
      likedByTitle: (row) => likedBy(row).map((u) => f.userName(u)).join(", ") || undefined,
      onToggle: async (row, next) => {
        const name = String((row as { name?: unknown }).name ?? "");
        await c.call("frappe.desk.like.toggle_like", { doctype, name, add: next ? "Yes" : "No" });
        // Desk updates the heart in place (ui/like.js:31-50), no reload: rewrite the cached rows of this DocType's lists
        queryClient.setQueriesData<InfiniteData<{ rows: T[] }>>({ queryKey: ["sf-frappe", "list", doctype] }, (data) => data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, rows: p.rows.map((r) => {
            if (String((r as { name?: unknown }).name) !== name) return r;
            const users = likedBy(r).filter((u) => u !== likeUser);
            return { ...r, _liked_by: JSON.stringify(next ? [...users, likeUser] : users) };
          }) })),
        });
      },
      onError: onLikeError,
      filter: { active: likedByMe, onChange: setLikedByMe },
    };
  }, [likeUser, likedByMe, c, doctype, queryClient, onLikeError, f.userName]); // eslint-disable-line react-hooks/exhaustive-deps
  const metaRef = React.useRef(f.meta);
  metaRef.current = f.meta;
  // key → document name of every row shown so far (selection survives paging); reset per DocType
  const effectiveRowKey = (rowKey ?? data.rowKey) as (row: T) => string;
  const nameByKey = React.useMemo(() => new Map<string, string>(), [doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowByKey = React.useMemo(() => new Map<string, T>(), [doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  for (const r of (data.rows ?? []) as T[]) {
    const n = (r as { name?: unknown }).name;
    if (n !== undefined && n !== null && n !== "") nameByKey.set(effectiveRowKey(r), String(n));
    rowByKey.set(effectiveRowKey(r), r);
  }
  // bulk gates: the user's rights on the DocType (Desk's `frm.perm`); the `permissions` prop overrides
  const perms = usePermissions(f.bundle);
  const { t, language } = useLocale();
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const selectedCount = selectedKeys.length;
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkMessage, setBulkMessage] = React.useState("");
  useListRealtime({ port: realtime, doctype, enabled: !f.settings?.disable_auto_refresh, isLargeTable: f.meta?.isLargeTable, suppressed: selectedCount > 0 || bulkBusy, debounceMs: realtimeDebounceMs });

  // Import / Export (docs/release/LISTVIEW-FRAPPE-PARITY.md). Import keeps Desk's client gate (model.js:434-442 via
  // list_view.js:1703); the server decides anyway (data_import.py:59-75). Export is offered to everyone, exactly as Desk
  // pushes it unconditionally (list_view.js:2075-2092) — owner decision Phase 27 #1, reversing the Phase 26 rule D.1
  // gate: the server is the authority (exporter.py:116-126 `can_export`) and FrappeExportDialog shows its refusal as a
  // permission error (FrappeErrorState), with no file and no success.
  const { session } = useFrappeSettings();
  const menuOn = menu === false
    ? { import: false, export: false, reportExport: false, userPermissions: false, rolePermissions: false, customize: false, listSettings: false }
    : { import: true, export: true, reportExport: false, userPermissions: true, rolePermissions: true, customize: true, listSettings: true, ...(typeof menu === "object" ? menu : {}) };
  // Desk: `frappe.user_roles.includes("System Manager")` (list_view.js:1714-1733, 1772-1776); Customize needs create on
  // Custom Field + Property Setter (:1735-1754) — System Manager / Administrator in stock Frappe
  const sysManager = actsAsSystemManagerFor(session) && !!f.bundle;
  const navEntries = ([
    ["userPermissions", menuOn.userPermissions, t("listMenuUserPermissions"), userPermissionsUrl(doctype)],
    ["rolePermissions", menuOn.rolePermissions, t("listMenuRolePermissions"), rolePermissionsUrl(doctype)],
    ["customize", menuOn.customize, t("listMenuCustomize"), customizeUrl(doctype, !!(f.bundle?.meta as { custom?: unknown } | undefined)?.custom)],
  ] as const).filter(([, on]) => on !== false && sysManager);
  const showListSettings = menuOn.listSettings !== false && sysManager && !!f.meta;
  const [listSettingsOpen, setListSettingsOpen] = React.useState(false);
  const navigate = (url: string, entry: "import" | "userPermissions" | "rolePermissions" | "customize") => {
    if (onNavigate) onNavigate(url, entry); else if (typeof location !== "undefined") location.assign(url);
  };
  const showImport = menuOn.import !== false && canImport(f.bundle?.meta, session, perms.levels[0]);
  const showExport = menuOn.export !== false && !!f.bundle;
  // Report-view export (export_query): Desk's report view offers it only with `frappe.model.can_export` (report_view.js:1646)
  const showReportExport = menuOn.reportExport === true && !!f.bundle && !!f.reportExport && canExport(session, perms.levels[0]);
  const [exporting, setExporting] = React.useState<{ names?: string[]; allMatching?: boolean } | null>(null);
  const [reportExporting, setReportExporting] = React.useState(false);
  const L = { importEntry: t("listMenuImport"), exportEntry: t("listBulkExport"), moreActions: t("listMenuMore"), reportExportEntry: t("listMenuReportExport"), ...ioLabels };
  // Desk: frappe.set_route("list", "data-import", { reference_doctype }) — the Data Import LIST (list_view.js:1703-1712)
  const doImport = onImport ?? (() => navigate(dataImportListUrl(doctype), "import"));
  // Desk's sidebar (opt-in) and its "Toggle Sidebar" menu entry (list_view.js:1756-1762)
  const sidebarCfg = sidebar ? (typeof sidebar === "object" ? sidebar : {}) : null;
  const [sidebarOpen, setSidebarOpen] = React.useState(sidebarCfg?.open !== false);
  const menuNode = showImport || showExport || sidebarCfg || navEntries.length || showListSettings ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={L.moreActions} data-testid="sf-list-menu"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showImport && <DropdownMenuItem onSelect={() => doImport()}><Upload className="me-2 h-4 w-4" /> {L.importEntry}</DropdownMenuItem>}
        {showExport && <DropdownMenuItem onSelect={() => setExporting({})}><Download className="me-2 h-4 w-4" /> {L.exportEntry}</DropdownMenuItem>}
        {showReportExport && <DropdownMenuItem onSelect={() => setReportExporting(true)}><FileSpreadsheet className="me-2 h-4 w-4" /> {L.reportExportEntry}</DropdownMenuItem>}
        {(navEntries.length > 0 || sidebarCfg || showListSettings) && (showImport || showExport || showReportExport) && <DropdownMenuSeparator />}
        {navEntries.map(([key, , label, url]) => (
          <DropdownMenuItem key={key} data-menu={key} onSelect={() => navigate(url, key)}>{key === "customize" ? <Wrench className="me-2 h-4 w-4" /> : <ShieldCheck className="me-2 h-4 w-4" />} {label}</DropdownMenuItem>
        ))}
        {sidebarCfg && <DropdownMenuItem onSelect={() => setSidebarOpen((o) => !o)}><PanelLeft className="me-2 h-4 w-4" /> {t("listToggleSidebar")}</DropdownMenuItem>}
        {showListSettings && <DropdownMenuItem data-menu="listSettings" onSelect={() => setListSettingsOpen(true)}><Settings2 className="me-2 h-4 w-4" /> {t("listMenuListSettings")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const renderBulk = React.useMemo(() => {
    if ((!bulk && !showExport) || !f.meta) return rest.renderBulkActions;
    const meta = f.meta;
    // Desk hides Edit / Submit / Cancel / Delete and adds the workflow's actions when the DocType has an active Workflow
    // (frappe.model.has_workflow, list_view.js:1806, 1881-1886, 2111-2125) — read from getdoctype's `__workflow_docs`
    const hasWorkflow = bulk?.hasWorkflow ?? !!perms.workflow;
    return (ctx: { keys: string[]; rows: T[]; clear: () => void }) => {
      // every server request gets document names, never the UI row keys (custom `rowKey`)
      const { names, missing } = documentNamesForKeys(ctx.keys, nameByKey);
      if (missing.length) return <><p className="text-sm text-muted-foreground" role="status" data-testid="sf-bulk-unresolved">{t("listBulkUnresolved")}</p>{rest.renderBulkActions?.(ctx)}</>;
      return (
      <>
        {bulk ? (
          <FrappeBulkActions client={c} meta={meta} doctype={doctype} keys={names} rows={ctx.rows} docMeta={f.bundle?.meta} roles={session?.roles} clear={ctx.clear} onBusy={setBulkBusy} onMessage={setBulkMessage}
            // Desk's Actions → Export: the exporter preset to "by_filter" on the checked names (bulk_operations.js:463-474), in Desk's position
            onExport={showExport ? () => setExporting({ names }) : undefined} exportLabel={L.exportEntry}
            options={{ allowEdit: !!f.settings?.allow_edit, ...bulk, hasWorkflow, permissions: bulk.permissions ?? ((p) => perms.can(p)) }} />
        ) : showExport ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExporting({ names })}><Download className="h-4 w-4" /> {L.exportEntry}</Button>
        ) : null}
        {rest.renderBulkActions?.(ctx)}
      </>
      );
    };
  }, [bulk, perms, f.meta, f.bundle, f.settings, c, doctype, rest.renderBulkActions, showExport, L.exportEntry, session?.roles, nameByKey, t]);
  // Desk's header mode: the same actions as data for the ListView's Actions menu (selection keys → document names)
  const header = rest.selectionMode === "header";
  const clearRef = React.useRef<() => void>(() => {});
  const sel = documentNamesForKeys(selectedKeys, nameByKey);
  const hb = useFrappeBulkActions<T>({
    client: c, meta: f.meta ?? EMPTY_LIST_META, doctype, keys: sel.names, rows: selectedKeys.map((k) => rowByKey.get(k)).filter((r): r is T => r !== undefined),
    docMeta: f.bundle?.meta, roles: session?.roles, clear: () => clearRef.current(), onBusy: setBulkBusy, onMessage: setBulkMessage,
    onExport: showExport ? () => setExporting({ names: sel.names }) : undefined, exportLabel: L.exportEntry,
    options: { allowEdit: !!f.settings?.allow_edit, ...bulk, hasWorkflow: bulk?.hasWorkflow ?? !!perms.workflow, permissions: bulk ? (bulk.permissions ?? ((p) => perms.can(p))) : undefined },
  });
  const headerActions: BulkAction<T>[] | undefined = header && f.meta && (bulk || showExport)
    ? [...hb.actions.map((a): BulkAction<T> => (a.key === "export"
      // "Select all {n} matching": Export is the one Desk action that can act on the query — the exporter by the current
      // filters (exporter.py; `FrappeExportDialog` without names). Every other Frappe bulk method takes document names.
      ? { ...a, allMatching: true, disabled: sel.missing.length ? (ctx) => (ctx.allMatching ? false : t("listBulkUnresolved")) : a.disabled, run: (k, r, ctx) => (ctx?.allMatching ? setExporting({ allMatching: true }) : a.run(k, r, ctx)) }
      : sel.missing.length ? { ...a, disabled: () => t("listBulkUnresolved") } : a)), ...(rest.bulkActions ?? [])]
    : rest.bulkActions;
  // Create: Desk shows "Add {DocType}" and the empty-state create only with `frappe.model.can_create` (list_view.js:279-296, 497-537)
  const mayCreate = create !== false && perms.can("create");
  const [creating, setCreating] = React.useState(false);
  const createCfg = typeof create === "object" ? create : undefined;
  // P35 integration: `create` without render / onCreate → Quick Entry (eligible DocType) or the host's full form
  const qeDefault = !!createCfg && !createCfg.render && !createCfg.onCreate && !onCreate;
  const qeEligible = qeDefault && f.bundle ? quickEntryFields(f.bundle.meta).eligible : undefined;
  const toFullForm = qeDefault && qeEligible === false && createCfg?.onOpenFullForm && f.bundle
    ? () => createCfg.onOpenFullForm!(newDoc(f.bundle!, { user: session?.user, userFullname: session?.fullName, ...createCfg.defaults }))
    : undefined;
  const renderCreate = createCfg?.render ?? (qeDefault && f.bundle && !toFullForm ? (p: { open: boolean; onOpenChange(open: boolean): void; onCreated(doc: Record<string, unknown>): void }) => {
    const qe = <FrappeQuickEntry doctype={doctype} open={p.open} onOpenChange={p.onOpenChange} onCreated={p.onCreated} defaults={createCfg?.defaults}
      onOpenFullForm={createCfg?.onOpenFullForm ? (d) => { p.onOpenChange(false); createCfg.onOpenFullForm!(d); } : undefined} />;
    return client ? <FrappeProvider client={client} serverMessages={false}>{qe}</FrappeProvider> : qe;
  } : undefined);
  const startCreate = toFullForm ?? (renderCreate ? () => setCreating(true) : (createCfg?.onCreate ?? onCreate));
  const addButton = mayCreate && createCfg && startCreate ? (
    <Button className="gap-1.5 shrink-0" onClick={startCreate} data-testid="sf-list-add"><Plus className="h-4 w-4" aria-hidden /> {createCfg.label ?? t("listAddDoctype").replace("{doctype}", doctype)}</Button>
  ) : undefined;
  const createdNode = mayCreate && renderCreate ? renderCreate({
    open: creating, onOpenChange: setCreating,
    onCreated: () => { setCreating(false); void invalidateFrappeList(queryClient, doctype); },
  }) : null;
  const asideNode = React.useMemo(() => {
    if (!sidebarCfg || !f.meta) return undefined;
    const meta = f.meta;
    const own = Array.isArray(f.userSettings?.group_by_fields) ? (f.userSettings!.group_by_fields as unknown[]).map(String) : [];
    const fields = [...new Set(sidebarCfg.fields ?? [...DEFAULT_SIDEBAR_GROUP_BY, ...own])].filter((x) => x === "assigned_to" || meta.known.has(x));
    const labelOf = (x: string) => (x === "assigned_to" ? t("listAssigned") : x === "owner" ? t("listOwner") : meta.filterFields.find((ff) => ff.name === x)?.label ?? x);
    const userFields = Object.values(meta.fieldDefs).filter((d) => d.fieldtype === "Link" && d.options === "User").map((d) => d.fieldname).concat(["owner", "modified_by"]);
    const checkFields = [...meta.fieldtypes.entries()].filter(([, ft]) => ft === "Check").map(([n]) => n);
    return (
      <FrappeGroupBySidebar doctype={doctype} client={c} fields={fields} filters={f.request?.filters} labelOf={labelOf} userName={f.userName}
        userFields={userFields} checkFields={checkFields} user={session?.user} tags={sidebarCfg.tags !== false && !f.settings?.disable_sidebar_stats} />
    );
  }, [sidebarCfg?.fields?.join(","), sidebarCfg?.tags, !!sidebarCfg, f.meta, f.userSettings, f.request?.filters, f.settings, f.userName, doctype, c, session?.user, t]); // eslint-disable-line react-hooks/exhaustive-deps
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
      emptyAction={rest.emptyAction ?? (mayCreate && startCreate ? { label: t("listCreateFirst").replace("{doctype}", doctype), onClick: startCreate } : undefined)}
      selectable={rest.selectable ?? (bulk ? true : undefined)}
      primaryAction={rest.primaryAction ?? addButton}
      pageSizes={rest.pageSizes ?? DESK_PAGE_SIZES}
      // Desk offers "Is Global" to System Managers / the Administrator only (list_filter.js:6)
      savedFiltersGlobal={rest.savedFiltersGlobal ?? actsAsSystemManagerFor(session)}
      aside={rest.aside ?? asideNode}
      asideOpen={rest.asideOpen ?? (asideNode ? sidebarOpen : undefined)}
      toolbarActions={menuNode || rest.toolbarActions ? <>{rest.toolbarActions}{menuNode}</> : undefined}
      renderBulkActions={header ? (ctx) => { clearRef.current = ctx.clear; return rest.renderBulkActions?.(ctx); } : renderBulk}
      bulkActions={headerActions}
      renderActionsMenu={header && hb.workflowMenu ? (ctx) => <>{ctx.allMatching ? null : hb.workflowMenu}{rest.renderActionsMenu?.(ctx)}</> : rest.renderActionsMenu}
      onActionsOpenChange={header ? (o) => { hb.onMenuOpenChange(o); rest.onActionsOpenChange?.(o); } : rest.onActionsOpenChange}
      onSelectionChange={(k) => { setSelectedKeys(k); rest.onSelectionChange?.(k); }}
      {...data}
      onStateChange={onQueryStateChange ? (st: ListQueryState) => { data.onStateChange(st); onQueryStateChange(st); } : data.onStateChange}
      like={likeConfig}
      rowKey={rowKey ?? data.rowKey}
    />
    {header && hb.dialogs}
    {createdNode}
    {showListSettings && f.bundle && listSettingsOpen && (
      <FrappeListSettingsDialog client={c} doctype={doctype} meta={f.bundle.meta as never} settings={f.settings} open onOpenChange={setListSettingsOpen}
        hasIndicator={!!f.meta && hasIndicatorFn({ isSubmittable: f.meta.isSubmittable, workflow: workflow === undefined ? indicatorWorkflowFromMeta(f.bundle.meta) : workflow || undefined, states: f.meta.states, hasField: f.meta.hasField, getIndicator })} />
    )}
    {bulkMessage && <p className="mt-2 text-sm text-muted-foreground" role="status">{bulkMessage}</p>}
    {f.bundle && exporting && (
      <FrappeExportDialog api={api} bundle={f.bundle} open onOpenChange={(o) => !o && setExporting(null)} selectedNames={exporting.names} defaultRecords={exporting.allMatching ? "by_filter" : undefined}
        filters={f.request?.filters} levels={perms.known ? perms.levels : undefined} labels={ioLabels} />
    )}
    {f.bundle && f.reportExport && reportExporting && (
      <FrappeReportExportDialog api={api} doctype={doctype} open onOpenChange={(o) => !o && setReportExporting(false)} {...f.reportExport} offerTranslate={language !== "en"} />
    )}
    </>
  );
}

/** Placeholder until the DocType's meta is known (no editable fields, not submittable): nothing but Export is offered. */
const EMPTY_LIST_META = { doctype: "", isSubmittable: false, isLargeTable: false, states: [], childOf: new Map(), editable: [], fieldDefs: {}, hasField: () => false,
  titleField: "name", searchFields: [], defaultOrderBy: "modified desc", filterFields: [], columns: [], quickFilterFields: [], known: new Set<string>() } as unknown as FrappeListMeta;

/** `_liked_by` is a JSON list of user ids (desk/like.py); anything else counts as nobody. */
function likedBy(row: unknown): string[] {
  const v = (row as { _liked_by?: unknown })?._liked_by;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== "string" || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}
