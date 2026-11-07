/**
 * FrappeReportView — Desk's Report view (frappe/public/js/frappe/views/reports/report_view.js) on the package's
 * `ListView`: every field of the DocType in the column picker (hidden until chosen), the child tables' fields too
 * (`Child:field`, requested as Desk does, :869-884), the list's filters / search / sort / paging, inline cell editing
 * through `frappe.client.set_value` (Desk's `set_control_value`, :682-697) where `isCellEditable` allows it, a totals
 * row over the loaded rows (:1523-1549), and Group by over the loaded rows.
 *
 * Not reproduced from Desk: saving as a Report Builder report (`save_report`), the SQL aggregate Group By
 * (`aggregate_function` / `aggregate_on_field`, reportview.py:161-176 — here grouping is the list's, over loaded rows),
 * charts, multi-column sort, column widths / reordering by drag, "Pick Columns" per child table, editing child cells,
 * `add_totals_row` saved in user settings, print / export entries (use `FrappeReportExportDialog`).
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
import type { FrappeDocField } from "../contract";
import type { FrappeFilter } from "../query";
import { patchCachedRows, useFrappeViewList } from "./useFrappeViewList";
import { columnTotals, isCellEditable, NUMERIC_TYPES } from "./report";

type Row = Record<string, unknown>;
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
  /** Inline cell editing where allowed (`isCellEditable`). Default true. */
  inlineEdit?: boolean;
  /** Start with the totals row shown (Desk: off until "Show Totals"). Default false. */
  totals?: boolean;
  /** The applied list state after each change (to carry filters / sort to another view). */
  onQueryStateChange?: (state: ListQueryState) => void;
  /** A cell was saved (the server's document). */
  onCellSaved?: (row: Row, fieldname: string, doc: Row) => void;
}

export function FrappeReportView(props: FrappeReportViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function EditableCell({ row, df, label, onSave }: { row: Row; df: FrappeDocField; label: string; onSave: (value: unknown) => Promise<void> }) {
  const { t } = useLocale();
  const value = row[df.fieldname];
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const col = { key: df.fieldname, label, fieldtype: df.fieldtype } as ColumnDef<Row>;
  const start = () => { setDraft(value === null || value === undefined ? "" : String(value)); setError(""); setEditing(true); };
  const commit = async (raw: string) => {
    const typed = NUMERIC_TYPES.has(df.fieldtype) ? (raw.trim() === "" ? null : Number(raw)) : df.fieldtype === "Check" ? (raw === "1" ? 1 : 0) : raw;
    if (typeof typed === "number" && Number.isNaN(typed)) { setError(t("reportSaveFailed").replace("{field}", label)); return; }
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

function Inner({ doctype, client, baseFilters, pageSize, groupByFields, inlineEdit = true, totals: totalsInitial = false, onQueryStateChange, onCellSaved, ...rest }: FrappeReportViewProps) {
  const { t, language } = useLocale();
  const v = useFrappeViewList({ doctype, client, baseFilters, pageSize, groupByFields, childColumns: true, scope: "report" });
  const perms = usePermissions(v.bundle);
  const [showTotals, setShowTotals] = React.useState(totalsInitial);
  const [saved, setSaved] = React.useState("");
  const dfs = React.useMemo(() => new Map((v.doc?.fields ?? []).map((f) => [f.fieldname, f as unknown as FrappeDocField])), [v.doc]);

  const save = React.useCallback(async (row: Row, df: FrappeDocField, label: string, value: unknown) => {
    // Desk: frappe.db.set_value(doctype, docname, { [fieldname]: value }) (report_view.js:682-697) → frappe.client.set_value
    const res = await v.client.call("frappe.client.set_value", { doctype, name: String(row.name), fieldname: JSON.stringify({ [df.fieldname]: value }) });
    const doc = (res.message ?? {}) as Row;
    patchCachedRows(v.queryClient, doctype, String(row.name), { [df.fieldname]: doc[df.fieldname] ?? value, ...(doc.modified ? { modified: doc.modified } : {}) });
    setSaved(t("reportSaved").replace("{field}", label));
    onCellSaved?.(row, df.fieldname, doc);
  }, [v.client, v.queryClient, doctype, onCellSaved, t]);

  const columns = React.useMemo<ColumnDef<Row>[]>(() => v.listProps.columns.map((c) => {
    const df = dfs.get(fieldOf(c));
    if (!inlineEdit || !df || c.key.includes(":") || !perms.levels[df.permlevel ?? 0]?.write) return c;
    const label = loc(c.label, language);
    return { ...c, render: (row: Row) => (isCellEditable(df, row, perms.levels)
      ? <EditableCell row={row} df={df} label={label} onSave={(val) => save(row, df, label, val)} />
      : <DefaultCell value={row[df.fieldname]} col={c} />) };
  }), [v.listProps.columns, dfs, inlineEdit, perms.levels, language, save]);

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
