/**
 * FrappeChildTable — a Table field (docs `12` §5): the generic DataGrid plus Frappe's rows, columns, row form and
 * rules.
 *  - Columns: child fields with `in_list_view`, not hidden, not layout; width `columns` else 2 (Small Text 3, Check 1);
 *    the running total starts at 1 and the column that takes it past 11 ends the list (Desk's `return false`).
 *    UNVERIFIED: Desk's choice when no field has `in_list_view` — here the first value fields, same width rule.
 *  - Editable when the grid's status is Write and the table is not `static_rows`; inline editing when the child
 *    DocType has `editable_grid`, otherwise a click opens the row form. Cells are FrappeFields (`onlyInput`) with the
 *    row's own dependencies (`doc` = the row, `parent` = the form's document); a Read grid makes its cells Read.
 *  - `cannot_add_rows` hides add / insert / duplicate; `cannot_delete_rows` hides delete. Pages of
 *    `grid_page_length` (default 50). A required empty table is flagged.
 *  - Row form: a dialog with the child DocType's layout and fields, and Insert Above / Insert Below / Duplicate /
 *    Delete. Opening it fires `form_render` and `<table>_on_form_rendered` (through the form's controller).
 *  - Rows: new rows get `__islocal` and a `new-…` name (docStore); `idx` stays 1…n.
 * Standalone (no form controller), the table edits `rows` through `onRowsChange` with the same row model.
 */
import * as React from "react";
import { X } from "lucide-react";
import { useLocale } from "../../theme/ThemeProvider";
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { DataGrid, type DataGridColumn } from "../../fields/DataGrid";
import { interpolate } from "../../fields/FieldShell";
import type { DocPermissions, DocTypeMeta, FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle } from "../contract";
import { createDocStore } from "./model/docStore";
import { isEmptyValue, resolveFields, type EffectiveField } from "./model/depends";
import { LAYOUT_TYPES, NO_VALUE_TYPES } from "./model/fieldtypes";
import { buildLayout, sectionFields } from "./model/layout";
import { controlStatus, ladderStatus } from "./model/status";
import { usePermissions } from "../hooks";
import { useFormServices } from "./services";
import { FrappeField, type FrappeFieldProps } from "./FrappeField";

/** Rows of one table field, and what may be done to them. FrappeForm provides one over its docStore. */
export interface TableController {
  rows: FrappeDoc[];
  add(index?: number, values?: Record<string, unknown>): FrappeDoc;
  duplicate(index: number): FrappeDoc;
  /** Resolves after the rows are removed (or the removal was stopped by `before_<table>_remove`). */
  remove(indexes: number[]): Promise<void> | void;
  move(from: number, to: number): void;
  setCell(rowName: string, fieldname: string, value: unknown): void;
  /** Effective DocFields of a row (dependencies evaluated). */
  fieldsFor?(row: FrappeDoc): Map<string, EffectiveField>;
  /** Display status of a cell. */
  statusFor?(df: EffectiveField, row: FrappeDoc): FieldDisplayStatus;
  /** Extra FrappeField props for a cell (Link queries, fetch handling, button clicks). */
  cellProps?(df: EffectiveField, row: FrappeDoc): Partial<FrappeFieldProps>;
  onRowFormOpen?(row: FrappeDoc): void;
}

export function childMetaOf(df: FrappeDocField, bundle?: MetaBundle): DocTypeMeta | undefined {
  return df.options ? bundle?.children?.[df.options] : undefined;
}

/** A controller over a plain rows array (standalone tables), with the docStore's row model. */
export function useLocalTableController(df: FrappeDocField, childMeta: DocTypeMeta | undefined, parent: FrappeDoc, rows: FrappeDoc[], onRowsChange?: (rows: FrappeDoc[]) => void): TableController {
  const latest = React.useRef({ parent, rows, onRowsChange });
  latest.current = { parent, rows, onRowsChange };
  return React.useMemo<TableController>(() => {
    const withStore = <T,>(op: (store: ReturnType<typeof createDocStore>) => T): T => {
      const { parent: p, rows: r, onRowsChange: cb } = latest.current;
      const meta = childMeta ?? { name: String(df.options ?? "Row"), fields: [] };
      const store = createDocStore({ doctype: p.doctype, meta: { name: p.doctype, fields: [df] }, children: { [meta.name]: meta } }, { ...p, [df.fieldname]: r });
      const out = op(store);
      cb?.(store.getRows(df.fieldname));
      return out;
    };
    return {
      get rows() { return latest.current.rows; },
      add: (index, values) => withStore((s) => s.addRow(df.fieldname, { index, values, unedited: true })),
      duplicate: (index) => withStore((s) => s.duplicateRow(df.fieldname, index)),
      remove: (indexes) => { withStore((s) => s.deleteRows(df.fieldname, indexes)); },
      move: (from, to) => withStore((s) => s.moveRow(df.fieldname, from, to)),
      setCell: (rowName, fieldname, value) => withStore((s) => s.setValue(fieldname, value, { parentfield: df.fieldname, name: rowName })),
    };
  }, [df, childMeta]);
}

/** Visible grid columns (grid.js `setup_visible_columns`). */
export function gridColumns(childMeta: DocTypeMeta, canRead?: (df: FrappeDocField) => boolean): { df: FrappeDocField; width: number }[] {
  // grid.js:1015-1021: `frm.get_perm(df.permlevel, "read")` filters the columns BEFORE the width budget is spent
  const candidates = (childMeta.fields ?? []).filter((f) => !LAYOUT_TYPES.has(f.fieldtype) && !f.hidden && (!canRead || canRead(f)));
  const listed = candidates.filter((f) => f.in_list_view);
  const pool = listed.length ? listed : candidates.filter((f) => !NO_VALUE_TYPES.has(f.fieldtype) && f.fieldtype !== "Table");
  const out: { df: FrappeDocField; width: number }[] = [];
  let total = 1;
  for (const df of pool) {
    const width = Number(df.columns) || (df.fieldtype === "Small Text" ? 3 : df.fieldtype === "Check" ? 1 : 2);
    total += width;
    if (total > 11) break;
    out.push({ df, width });
  }
  return out;
}

export interface FrappeChildTableProps {
  /** The Table DocField. */
  df: FrappeDocField;
  bundle?: MetaBundle;
  /** The child DocType's meta (default: `bundle.children[df.options]`). */
  childMeta?: DocTypeMeta;
  /** The form's document. */
  parent: FrappeDoc;
  rows: FrappeDoc[];
  onRowsChange?: (rows: FrappeDoc[]) => void;
  controller?: TableController;
  /** The grid's display status (Read: no editing). */
  status?: FieldDisplayStatus;
  /** Rights per permlevel for a standalone table (Desk's no-permission branch is for dialogs only, perm.js:196-203);
   *  a form's controller supplies cell statuses itself. */
  permissions?: DocPermissions;
  label?: string;
  invalid?: boolean;
  className?: string;
}

export function FrappeChildTable({ df, bundle, childMeta: metaProp, parent, rows, onRowsChange, controller, status: statusProp, permissions, label, invalid, className }: FrappeChildTableProps) {
  const { t } = useLocale();
  const s = useFormServices();
  const childMeta = metaProp ?? childMetaOf(df, bundle);
  const status: FieldDisplayStatus = statusProp ?? (permissions ? ladderStatus(df, parent, permissions) : "Write");
  // inside a form (a controller) Desk filters columns by the read right of their permlevel; a standalone grid has no frm and shows all
  const perms = usePermissions(bundle, parent);
  const local = useLocalTableController(df, childMeta, parent, rows, onRowsChange);
  const ctl = controller ?? local;
  const [openRow, setOpenRow] = React.useState<string | null>(null);
  if (!childMeta) return <p className="text-sm text-destructive">{df.options}</p>;

  const data = controller ? controller.rows : rows;
  const editable = status === "Write" && !df.static_rows;
  const fieldsFor = (row: FrappeDoc) => ctl.fieldsFor?.(row) ?? resolveFields(childMeta.fields, row, parent, s.evaluator);
  const statusFor = (f: EffectiveField, row: FrappeDoc): FieldDisplayStatus => {
    const base = ctl.statusFor?.(f, row) ?? controlStatus(ladderStatus(f, row, permissions), f, row, { gridStatus: status });
    return status === "Read" && base === "Write" && !f.allow_on_submit ? "Read" : base;
  };
  const cols = gridColumns(childMeta, controller && bundle ? (f) => perms.can("read", f.permlevel ?? 0) : undefined);
  const columns: DataGridColumn<FrappeDoc>[] = cols.map(({ df: col, width }) => ({
    key: col.fieldname,
    label: s.translate(bundle, col.label || col.fieldname),
    width,
    align: ["Int", "Float", "Currency", "Percent"].includes(col.fieldtype) ? "end" : "start",
    required: !!col.reqd,
    renderCell: (row) => {
      const eff = fieldsFor(row).get(col.fieldname) ?? col;
      if (eff.hidden_due_to_dependency) return null;
      if (col.fieldtype === "Check") return Number(row[col.fieldname]) ? "✓" : "";
      return s.formatValue(row[col.fieldname], eff, row);
    },
    renderEditor: (row) => {
      const eff = fieldsFor(row).get(col.fieldname) ?? col;
      const st = statusFor(eff, row);
      return (
        <FrappeField df={eff} value={row[col.fieldname]} onChange={(v) => ctl.setCell(row.name, col.fieldname, v)} doc={row} parent={parent} bundle={bundle}
          status={st === "None" && !eff.hidden_due_to_dependency ? "Read" : st} onlyInput markMissing={false} {...ctl.cellProps?.(eff, row)} />
      );
    },
    isInvalid: (row) => { const eff = fieldsFor(row).get(col.fieldname); return !!eff?.reqd && !eff.hidden_due_to_dependency && isEmptyValue(row[col.fieldname]); },
  }));

  const canAdd = editable && !df.cannot_add_rows;
  const canDelete = editable && !df.cannot_delete_rows;
  const inline = childMeta.editable_grid == null ? true : !!childMeta.editable_grid;
  const rowIndex = openRow ? data.findIndex((r) => r.name === openRow) : -1;
  const row = rowIndex >= 0 ? data[rowIndex] : undefined;
  const open = (i: number) => { const r = data[i]; if (!r) return; setOpenRow(r.name); ctl.onRowFormOpen?.(r); };
  const pageSize = Number(childMeta.grid_page_length) || 50;

  return (
    <>
      <DataGrid<FrappeDoc>
        label={label}
        rows={data}
        getRowKey={(r) => r.name}
        columns={columns}
        editable={editable}
        inlineEdit={inline}
        canAdd={canAdd}
        canDelete={canDelete}
        pageSize={pageSize}
        invalid={invalid}
        className={className}
        onAddRow={() => { const r = ctl.add(); if (!inline) setTimeout(() => { setOpenRow(r.name); ctl.onRowFormOpen?.(r); }); }}
        onInsertRow={(i) => ctl.add(i)}
        onDuplicateRow={(i) => ctl.duplicate(i)}
        onDeleteRows={(idx) => void ctl.remove(idx)}
        onMoveRow={(f, to) => ctl.move(f, to)}
        onOpenRow={open}
      />
      <Dialog open={!!row} onOpenChange={(o) => { if (!o) setOpenRow(null); }}>
        {row && (
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{interpolate(t("formRowTitle"), { n: rowIndex + 1 })}{label ? ` · ${label}` : ""}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {buildLayout(childMeta).tabs.flatMap((tab) => tab.sections).map((sec) => {
                const eff = fieldsFor(row);
                const shown = sectionFields(sec).filter((f) => statusFor(eff.get(f.fieldname) ?? f, row) !== "None");
                if (!shown.length) return null;
                return (
                  <div key={sec.key} className="space-y-3">
                    {sec.df?.label && <h4 className="text-sm font-semibold">{s.translate(bundle, sec.df.label)}</h4>}
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, sec.columns.length)}, minmax(0, 1fr))` }}>
                      {sec.columns.map((c) => (
                        <div key={c.key} className="min-w-0 space-y-4">
                          {c.fields.map((f) => {
                            const e = eff.get(f.fieldname) ?? f;
                            return <FrappeField key={f.fieldname} df={e} value={row[f.fieldname]} onChange={(v) => ctl.setCell(row.name, f.fieldname, v)} doc={row} parent={parent} bundle={bundle} status={statusFor(e, row)} {...ctl.cellProps?.(e, row)} />;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {canAdd && <Button type="button" variant="outline" size="sm" onClick={() => { const r = ctl.add(rowIndex); setOpenRow(r.name); }}>{t("formInsertAbove")}</Button>}
                {canAdd && <Button type="button" variant="outline" size="sm" onClick={() => { const r = ctl.add(rowIndex + 1); setOpenRow(r.name); }}>{t("formInsertBelow")}</Button>}
                {canAdd && <Button type="button" variant="outline" size="sm" onClick={() => { const r = ctl.duplicate(rowIndex); setOpenRow(r.name); }}>{t("formDuplicateRow")}</Button>}
                {canDelete && <Button type="button" variant="destructive" size="sm" onClick={() => { setOpenRow(null); void ctl.remove([rowIndex]); }}>{t("formDelete")}</Button>}
              </div>
              <Button type="button" size="sm" onClick={() => setOpenRow(null)}><X className="size-4" aria-hidden />{t("formCloseRow")}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
