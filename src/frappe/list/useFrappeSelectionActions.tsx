/**
 * Desk's Actions on the checked records of a Frappe TABLE view, shared by `FrappeListView` and `FrappeReportView`
 * (P36b bulk). Desk's Report view IS a List view (`frappe.views.ReportView extends frappe.views.ListView`,
 * report_view.js:9): it inherits `get_actions_menu_items` (list_view.js:1855-2128) — Edit, Export, Assign To, Clear
 * Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete, then the workflow's actions
 * (`set_actions_menu_items`, :161-180) — and shows the Actions menu instead of the primary action as soon as a row of its
 * datatable is checked (`onCheckRow` → `toggle_actions_menu_button`, report_view.js:371-374; list_view.js:590-598).
 *
 * This hook is that wiring on the package's `ListView`: the selected UI row keys are resolved to Frappe document NAMES
 * (`documentNamesForKeys`; a Report row with child-table columns repeats its parent's name — sent once), the actions
 * and their dialogs come from `useFrappeBulkActions` (header mode, the default) or `FrappeBulkActions` (the opt-in bar),
 * and the selection / list follow Desk per action (`selectionAfterBulk`). Spread `listProps` into the `ListView`, render
 * `dialogs` and `message` next to it; `busy` / `selectedCount` pause realtime as Desk's `disable_list_update` does.
 */
import * as React from "react";
import { Download } from "lucide-react";
import type { ListViewProps } from "../../list/ListView";
import type { BulkAction } from "../../list/parts/ListFooter";
import { Button } from "../../primitives/button";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeClient } from "../client";
import type { MetaBundle } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import type { PermissionsResult } from "../hooks/usePermissions";
import type { FrappeListMeta } from "../meta";
import { FrappeBulkActions, useFrappeBulkActions, type FrappeBulkOptions } from "./FrappeBulkActions";

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

/**
 * The names a bulk request carries: each document ONCE, in selection order. Desk's report view sends one name per checked
 * datatable row (`get_checked_items(true)`, report_view.js:1339-1348), so a document shown on several rows (one per
 * child-table row) would be sent twice — the server then submits it once and reports the second copy as failed
 * (`_bulk_action`: docstatus is no longer draft, bulk_update.py:85-100). The package sends it once (documented difference).
 */
export const uniqueNames = (names: readonly string[]): string[] => [...new Set(names)];

type HostProps<T> = Pick<ListViewProps<T>, "selectionMode" | "renderBulkActions" | "bulkActions" | "renderActionsMenu" | "onActionsOpenChange" | "onSelectionChange">;

export interface FrappeSelectionActionsInput<T> {
  client: FrappeClient;
  doctype: string;
  /** The list meta (`buildFrappeListMeta`); until it is known only the host's own actions are offered. */
  meta: FrappeListMeta | null | undefined;
  /** getdoctype's bundle (Print formats, `__workflow_docs`). */
  bundle: MetaBundle | null | undefined;
  /** `usePermissions(bundle)`: the DocType rights (gates) and the active Workflow (`perms.workflow`). */
  perms: PermissionsResult;
  /** List View Settings `allow_edit` (Edit / Delete stay offered under a workflow, list_view.js:1881-1887). */
  allowEdit: boolean;
  /** The rows currently shown (key → name / row maps survive paging). */
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Desk's Actions (`FrappeBulkOptions`); omitted → only Export (when `exportAction`) and the host's actions. */
  bulk?: FrappeBulkOptions;
  /** Export in Desk's position (list_view.js:2092); the host owns the exporter dialog. */
  exportAction?: { label: string; open: (target: { names?: string[]; allMatching?: boolean }) => void };
  /** The host's own ListView props this composes with (kept, run next to Desk's). */
  host: HostProps<T>;
}

export interface FrappeSelectionActions<T> {
  /** Spread into the `ListView`. */
  listProps: Required<Pick<ListViewProps<T>, "onSelectionChange">> & Pick<ListViewProps<T>, "renderBulkActions" | "bulkActions" | "renderActionsMenu" | "onActionsOpenChange">;
  /** The actions' dialogs (header mode). */
  dialogs: React.ReactNode;
  /** The outcome line of the last action ("" = none). */
  message: string;
  /** An action is running (Desk's `disable_list_update`). */
  busy: boolean;
  selectedCount: number;
}

export function useFrappeSelectionActions<T>({ client, doctype, meta, bundle, perms, allowEdit, rows, rowKey, bulk, exportAction, host }: FrappeSelectionActionsInput<T>): FrappeSelectionActions<T> {
  const { t } = useLocale();
  const { session } = useFrappeSettings();
  // key → document name of every row shown so far (selection survives paging); reset per DocType
  const nameByKey = React.useMemo(() => new Map<string, string>(), [doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowByKey = React.useMemo(() => new Map<string, T>(), [doctype]); // eslint-disable-line react-hooks/exhaustive-deps
  for (const r of rows) {
    const n = (r as { name?: unknown }).name;
    if (n !== undefined && n !== null && n !== "") nameByKey.set(rowKey(r), String(n));
    rowByKey.set(rowKey(r), r);
  }
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const showExport = !!exportAction;
  const exportLabel = exportAction?.label;
  const openExport = exportAction?.open;
  // Desk hides Edit / Submit / Cancel / Delete and adds the workflow's actions when the DocType has an active Workflow
  // (frappe.model.has_workflow, list_view.js:1806, 1881-1886, 2108-2125) — read from getdoctype's `__workflow_docs`
  const hasWorkflow = bulk?.hasWorkflow ?? !!perms.workflow;
  const permissions = bulk ? (bulk.permissions ?? ((p: Parameters<PermissionsResult["can"]>[0]) => perms.can(p))) : undefined;

  const renderBulk = React.useMemo(() => {
    if ((!bulk && !showExport) || !meta) return host.renderBulkActions;
    return (ctx: { keys: string[]; rows: T[]; clear: () => void }) => {
      // every server request gets document names, never the UI row keys (custom `rowKey`)
      const { names: all, missing } = documentNamesForKeys(ctx.keys, nameByKey);
      const names = uniqueNames(all);
      if (missing.length) return <><p className="text-sm text-muted-foreground" role="status" data-testid="sf-bulk-unresolved">{t("listBulkUnresolved")}</p>{host.renderBulkActions?.(ctx)}</>;
      return (
        <>
          {bulk ? (
            <FrappeBulkActions client={client} meta={meta} doctype={doctype} keys={names} rows={ctx.rows} docMeta={bundle?.meta} roles={session?.roles} clear={ctx.clear} onBusy={setBusy} onMessage={setMessage}
              // Desk's Actions → Export: the exporter preset to "by_filter" on the checked names (bulk_operations.js:463-474), in Desk's position
              onExport={openExport ? () => openExport({ names }) : undefined} exportLabel={exportLabel}
              options={{ allowEdit, ...bulk, hasWorkflow, permissions }} />
          ) : openExport ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openExport({ names })}><Download className="h-4 w-4" /> {exportLabel}</Button>
          ) : null}
          {host.renderBulkActions?.(ctx)}
        </>
      );
    };
  }, [bulk, showExport, meta, host.renderBulkActions, nameByKey, client, doctype, bundle, session?.roles, openExport, exportLabel, allowEdit, hasWorkflow, permissions, t]);

  // Desk's header mode (the default; "bar" is the explicit opt-in): the same actions as data for the ListView's Actions
  // menu (selection keys → document names)
  const header = host.selectionMode !== "bar";
  const clearRef = React.useRef<() => void>(() => {});
  const sel = documentNamesForKeys(selectedKeys, nameByKey);
  const names = uniqueNames(sel.names);
  const hb = useFrappeBulkActions<T>({
    client, meta: meta ?? EMPTY_LIST_META, doctype, keys: names, rows: selectedKeys.map((k) => rowByKey.get(k)).filter((r): r is T => r !== undefined),
    docMeta: bundle?.meta, roles: session?.roles, clear: () => clearRef.current(), onBusy: setBusy, onMessage: setMessage,
    onExport: openExport ? () => openExport({ names }) : undefined, exportLabel,
    options: { allowEdit, ...bulk, hasWorkflow, permissions },
  });
  const headerActions: BulkAction<T>[] | undefined = header && meta && (bulk || showExport)
    ? [...hb.actions.map((a): BulkAction<T> => (a.key === "export"
      // "Select all {n} matching": Export is the one Desk action that can act on the query — the exporter by the current
      // filters (exporter.py; `FrappeExportDialog` without names). Every other Frappe bulk method takes document names.
      ? { ...a, allMatching: true, disabled: sel.missing.length ? (ctx) => (ctx.allMatching ? false : t("listBulkUnresolved")) : a.disabled, run: (k, r, ctx) => (ctx?.allMatching ? openExport?.({ allMatching: true }) : a.run(k, r, ctx)) }
      : sel.missing.length ? { ...a, disabled: () => t("listBulkUnresolved") } : a)), ...(host.bulkActions ?? [])]
    : host.bulkActions;

  return {
    listProps: {
      renderBulkActions: header ? (ctx) => { clearRef.current = ctx.clear; return host.renderBulkActions?.(ctx); } : renderBulk,
      bulkActions: headerActions,
      renderActionsMenu: header && hb.workflowMenu ? (ctx) => <>{ctx.allMatching ? null : hb.workflowMenu}{host.renderActionsMenu?.(ctx)}</> : host.renderActionsMenu,
      onActionsOpenChange: header ? (o) => { hb.onMenuOpenChange(o); host.onActionsOpenChange?.(o); } : host.onActionsOpenChange,
      onSelectionChange: (k) => { setSelectedKeys(k); host.onSelectionChange?.(k); },
    },
    dialogs: header ? hb.dialogs : null,
    message,
    busy,
    selectedCount: selectedKeys.length,
  };
}

/** Placeholder until the DocType's meta is known (no editable fields, not submittable): nothing but Export is offered. */
const EMPTY_LIST_META = { doctype: "", isSubmittable: false, isLargeTable: false, states: [], childOf: new Map(), editable: [], fieldDefs: {}, hasField: () => false,
  titleField: "name", searchFields: [], defaultOrderBy: "modified desc", filterFields: [], columns: [], quickFilterFields: [], known: new Set<string>() } as unknown as FrappeListMeta;
