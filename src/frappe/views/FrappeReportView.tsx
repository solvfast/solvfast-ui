/**
 * FrappeReportView — Desk's Report view (frappe/public/js/frappe/views/reports/report_view.js) on the package's
 * `ListView`: every field of the DocType in the column picker (hidden until chosen), the child tables' fields too
 * (`Child:field`, requested as Desk does, :869-884), the list's filters / search / sort / paging, inline cell editing
 * through `frappe.client.set_value` (Desk's `set_control_value`, :682-696) where `isCellEditable` allows it — by
 * default exactly Desk's rule (P36; docs/components/views.md §3), parent AND child-table cells —, a totals row over
 * the loaded rows (:1523-1549), and Group by over the loaded rows.
 *
 * Not reproduced from Desk: saving as a Report Builder report (`save_report`), the SQL aggregate Group By
 * (`aggregate_function` / `aggregate_on_field`, reportview.py:161-176 — here grouping is the list's, over loaded rows),
 * charts, multi-column sort, column widths / reordering by drag, "Pick Columns" per child table, editors for the
 * fieldtypes outside `INLINE_EDIT_TYPES`, `add_totals_row` saved in user settings, print / export entries (use
 * `FrappeReportExportDialog`).
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { Check, Pencil, Sigma, X } from "lucide-react";
import { ListView, type ListViewProps } from "../../list/ListView";
import { DefaultCell } from "../../list/parts/ListTable";
import { fieldOf, type ColumnDef } from "../../list/model/columns";
import type { ListQueryState } from "../../list/useListState";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { Input } from "../../primitives/input";
import { Toggle } from "../../primitives/toggle";
import { cn } from "../../lib/cn";
import { loc } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";
import { FrappeProvider } from "../FrappeProvider";
import { usePermissions } from "../hooks/usePermissions";
import { describeError } from "../feedback/FrappeErrorState";
import type { FrappeClient } from "../client";
import type { DocPermissions, FrappeDocField } from "../contract";
import type { FrappeFilter } from "../query";
import { updateCachedRows, useFrappeViewList } from "./useFrappeViewList";
import { columnTotals, deskCanWrite, INLINE_EDIT_TYPES, isCellEditable, isNonStdField, NUMERIC_TYPES, rowFromSavedDoc, type ReportEditMode } from "./report";

type Row = Record<string, unknown>;

/** What a custom `editable` rule receives besides the field and the loaded row. */
export interface ReportEditInfo {
  /** Desk's verdict for this cell (`isCellEditable`, mode "desk"). */
  desk: boolean;
  /** The report's DocType. */
  doctype: string;
  /** Set for a child-table column (`Child:field`): the child DocType. The save then targets the child row. */
  childDoctype?: string;
  /** Rights per permlevel of the session on the DocType (`usePermissions`). */
  levels: DocPermissions;
}
/**
 * Which cells are editable inline. `"desk"` (default) = Frappe 15.110's report view exactly; `"strict"` = Desk plus the
 * server's own checks (field permlevel write, submit right on submitted documents, `read_only_depends_on` always
 * evaluated); a function decides itself (`info.desk` carries Desk's verdict). A child cell needs its child row
 * (`Child:name`) whatever the rule says.
 */
export type ReportEditable = ReportEditMode | ((df: FrappeDocField, row: Row, info: ReportEditInfo) => boolean);
type Managed = "rows" | "columns" | "rowKey" | "mode" | "total" | "onStateChange" | "loading" | "error" | "onRetry" | "onLoadMore"
  | "totalLabel" | "hasMore" | "onTotalClick" | "searchHint" | "selectionScope" | "filterFields" | "groupByOptions" | "searchFields" | "pageSize";

export interface FrappeReportViewProps extends Omit<ListViewProps<Row>, Managed> {
  doctype: string;
  client?: FrappeClient;
  baseFilters?: FrappeFilter[];
  /** Default 20. */
  pageSize?: number;
  /** Fields offered in Group by (grouping of the loaded rows). */
  groupByFields?: string[];
  /** Inline cell editing on / off. Default true. Which cells: `editable`. */
  inlineEdit?: boolean;
  /** The editability rule. Default `"desk"` (Frappe 15.110's report view, docs/components/views.md §3). */
  editable?: ReportEditable;
  /** Start with the totals row shown (Desk: off until "Show Totals"). Default false. */
  totals?: boolean;
  /** The applied list state after each change (to carry filters / sort to another view). */
  onQueryStateChange?: (state: ListQueryState) => void;
  /** A cell was saved: the row as it was, the column key (`field`, or `Child:field` for a child cell) and the
   *  server's (parent) document. */
  onCellSaved?: (row: Row, fieldname: string, doc: Row) => void;
}

export function FrappeReportView(props: FrappeReportViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function EditableCell({ row, valueKey, df, label, onSave }: { row: Row; valueKey: string; df: FrappeDocField; label: string; onSave: (value: unknown) => Promise<void> }) {
  const { t } = useLocale();
  const value = row[valueKey];
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const col = { key: df.fieldname, label, fieldtype: df.fieldtype } as ColumnDef<Row>;
  const start = () => { setDraft(value === null || value === undefined ? "" : String(value)); setError(""); setEditing(true); };
  const commit = async (raw: string) => {
    const typed = NUMERIC_TYPES.has(df.fieldtype) ? (raw.trim() === "" ? null : Number(raw)) : df.fieldtype === "Check" ? (raw === "1" ? 1 : 0) : raw;
    if (typeof typed === "number" && Number.isNaN(typed)) { setError(t("reportSaveFailed").replace("{field}", label)); return; }
    // datatable submitEditing (cellmanager.js:553-556): an unchanged value sends nothing
    if (typed === value || (typed === "" && (value === null || value === undefined))) { setEditing(false); return; }
    setBusy(true); setError("");
    try { await onSave(typed); setEditing(false); }
    catch (e) { setError(describeError(e).bodies[0] || t("reportSaveFailed").replace("{field}", label)); }
    finally { setBusy(false); }
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  if (!editing) {
    return (
      <div className="group flex items-center gap-1" onClick={stop}>
        <span className="min-w-0 flex-1 truncate"><DefaultCell value={value} col={col} /></span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100" aria-label={t("reportEdit").replace("{field}", label)} onClick={start}><Pencil className="h-3 w-3" /></Button>
      </div>
    );
  }
  const options = df.fieldtype === "Select" ? (df.options ?? "").split("\n") : null;
  const inputType = NUMERIC_TYPES.has(df.fieldtype) ? "number" : df.fieldtype === "Date" ? "date" : "text";
  return (
    <div className="flex flex-col gap-1" onClick={stop} onKeyDown={stop}>
      <div className="flex items-center gap-1">
        {options ? (
          <select className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm" aria-label={label} value={draft} autoFocus disabled={busy}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void commit(draft); if (e.key === "Escape") setEditing(false); }}>
            {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
          </select>
        ) : df.fieldtype === "Check" ? (
          <input type="checkbox" aria-label={label} checked={draft === "1"} autoFocus disabled={busy} onChange={(e) => setDraft(e.target.checked ? "1" : "0")}
            onKeyDown={(e) => { if (e.key === "Enter") void commit(draft); if (e.key === "Escape") setEditing(false); }} />
        ) : (
          <Input className="h-7 min-w-0 flex-1 px-1.5 text-sm" type={inputType} aria-label={label} value={draft} autoFocus disabled={busy} dir={inputType === "text" ? undefined : "ltr"}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void commit(draft); if (e.key === "Escape") setEditing(false); }} />
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("reportSave")} disabled={busy} onClick={() => void commit(draft)}><Check className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("reportCancelEdit")} disabled={busy} onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
      {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
    </div>
  );
}

function Inner({ doctype, client, baseFilters, pageSize, groupByFields, inlineEdit = true, editable = "desk", totals: totalsInitial = false, onQueryStateChange, onCellSaved, ...rest }: FrappeReportViewProps) {
  const { t, language } = useLocale();
  const v = useFrappeViewList({ doctype, client, baseFilters, pageSize, groupByFields, childColumns: true, scope: "report" });
  const perms = usePermissions(v.bundle);
  const [showTotals, setShowTotals] = React.useState(totalsInitial);
  const [saved, setSaved] = React.useState("");
  const dfs = React.useMemo(() => new Map((v.doc?.fields ?? []).map((f) => [f.fieldname, f as unknown as FrappeDocField])), [v.doc]);

  const children = v.bundle?.children;

  const save = React.useCallback(async (row: Row, df: FrappeDocField, key: string, label: string, value: unknown, childDoctype?: string) => {
    // Desk: frappe.db.set_value(doctype, docname, { [fieldname]: value }) (report_view.js:682-696) → frappe.client.set_value;
    // a child cell targets the child row (`cell.doctype` / `cell.name` = `Child:name`, :629-632, :1287-1292)
    const target = childDoctype ? { doctype: childDoctype, name: String(row[`${childDoctype}:name`]) } : { doctype, name: String(row.name) };
    const res = await v.client.call("frappe.client.set_value", { ...target, fieldname: JSON.stringify({ [df.fieldname]: value }) });
    // :688-692 — no `message` is a failure
    if (!res.message || typeof res.message !== "object") throw new Error(t("reportSaveFailed").replace("{field}", label));
    const doc = res.message as Row;
    // :639-670 — the row is refreshed from the returned (parent) document, child keys from its child row
    updateCachedRows(v.queryClient, doctype, (r) => rowFromSavedDoc(r, doc));
    setSaved(t("reportSaved").replace("{field}", label));
    onCellSaved?.(row, key, doc);
  }, [v.client, v.queryClient, doctype, onCellSaved, t]);

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    if (!inlineEdit) return v.listProps.columns;
    const meta = v.bundle?.meta;
    const rule = { fields: meta?.fields ?? v.doc?.fields ?? [], levels: perms.levels, issingle: meta?.issingle };
    return v.listProps.columns.map((c) => {
      const key = fieldOf(c);
      const childDoctype = key.includes(":") ? key.split(":")[0] : undefined;
      const fieldname = childDoctype ? key.slice(childDoctype.length + 1) : key;
      const df = (childDoctype ? children?.[childDoctype]?.fields.find((f) => f.fieldname === fieldname) : dfs.get(key)) as FrappeDocField | undefined;
      if (!df || !INLINE_EDIT_TYPES.has(df.fieldtype)) return c; // no editor for this fieldtype in this package
      if (typeof editable !== "function") {
        // column level (build_column :1170-1173) and can_write: no cell of this column can pass
        const f = df as FrappeDocField & { is_virtual?: unknown };
        if (!isNonStdField(fieldname) || f.read_only || f.is_virtual || !deskCanWrite(perms.levels, meta)) return c;
      }
      const label = loc(c.label, language);
      const can = (row: Row) => {
        const child = childDoctype ? { name: row[`${childDoctype}:name`] } : undefined;
        if (typeof editable !== "function") return isCellEditable(df, row, { ...rule, child, mode: editable });
        const desk = isCellEditable(df, row, { ...rule, child });
        return (!child || !!child.name) && editable(df, row, { desk, doctype, childDoctype, levels: perms.levels });
      };
      return { ...c, render: (row: Row) => (can(row)
        ? <EditableCell row={row} valueKey={key} df={df} label={label} onSave={(val) => save(row, df, key, label, val, childDoctype)} />
        : <DefaultCell value={row[key]} col={c} />) };
    });
  }, [v.listProps.columns, v.bundle, v.doc, children, dfs, inlineEdit, editable, perms.levels, language, save, doctype]);

  const onState = v.listProps.onStateChange;
  const onStateChange = React.useCallback((s: ListQueryState) => { onState(s); onQueryStateChange?.(s); }, [onState, onQueryStateChange]);
  const visible = v.state?.visible ?? [];
  const numeric = visible.map((k) => columns.find((c) => c.key === k)).filter((c): c is ColumnDef<Row> => !!c && NUMERIC_TYPES.has(c.fieldtype ?? ""));
  const sums = columnTotals(v.rows, numeric.map((c) => c.key));
  const fmt = (n: number) => n.toLocaleString(language === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-2">
      <ListView<Row>
        key={v.ready ? "ready" : "meta"}
        viewKey={`${doctype}:report`}
        controls={{ sortMenu: true, ...rest.controls }}
        {...rest}
        {...v.listProps}
        columns={columns}
        quickFilterFields={rest.quickFilterFields ?? v.listProps.quickFilterFields}
        loadOptions={rest.loadOptions ?? v.listProps.loadOptions}
        onStateChange={onStateChange}
        onRetry={v.refetch}
        toolbarActions={<>
          {rest.toolbarActions}
          <Toggle size="sm" variant="outline" pressed={showTotals} onPressedChange={setShowTotals} aria-label={t("reportShowTotals")} className="gap-1.5"><Sigma className="h-4 w-4" />{t("reportShowTotals")}</Toggle>
        </>}
      />
      {showTotals && numeric.length > 0 && v.rows.length > 0 && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm" data-testid="sf-report-totals" aria-label={t("reportTotals")}>
          <span className="font-semibold">{t("reportTotals")}</span>
          {numeric.map((c) => (
            <span key={c.key} className="inline-flex gap-1.5" data-total={c.key}>
              <span className="text-muted-foreground">{loc(c.label, language)}</span>
              <span dir="ltr" className={cn("font-medium tabular-nums")}>{fmt(sums[c.key] ?? 0)}</span>
            </span>
          ))}
        </Card>
      )}
      <p className="sr-only" role="status" aria-live="polite">{saved}</p>
    </div>
  );
}
