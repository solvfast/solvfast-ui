/**
 * FrappeExportDialog — Desk's "Export Data" dialog (`data_exporter.js:12-102`): file type (Excel / CSV), export type
 * (All / Filtered / 5 records / Blank template), one field group per DocType and child table with Select All /
 * Select Mandatory / Unselect All, Export disabled without a parent field. The file comes from `download_template`
 * through `api.download` and is handed to the browser (`saveFile`). A refusal is shown as `FrappeErrorState`; there is
 * never a success toast and never a client-built file.
 *
 * Package differences (documented in docs/release/LISTVIEW-FRAPPE-PARITY.md): the field groups are restricted to the
 * permlevels the user may read when `levels` is given; "Filtered Records" uses the filters the host passes (the list's
 * current ones, or `[doctype, "name", "in", selected]` for a selection — `bulk_operations.js:463-474`) instead of an
 * in-dialog FilterGroup; no record-count message (`frappe.db.count`, data_exporter.js:209-238).
 */
import * as React from "react";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import type { DownloadedFile, FrappeApi } from "../client";
import type { DocPermissions, MetaBundle } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import type { FrappeFilter } from "../query";
import { downloadExportTemplate, exportPickerGroups, mandatorySelection, saveFile, selectedNamesFilter, type ExportFileType, type ExportRecords, type ImportType } from "./export";

/** English labels; override to localize (the package's message catalogue has no export keys yet). */
export interface ExportDialogLabels {
  title: string; fileType: string; exportType: string; all: string; byFilter: string; selected: string; fiveRecords: string; blankTemplate: string;
  selectAll: string; selectMandatory: string; unselectAll: string; mandatory: string; oneRowMandatory: string; export: string; cancel: string; downloading: string;
}
export const EXPORT_DIALOG_LABELS_EN: ExportDialogLabels = {
  title: "Export Data", fileType: "File Type", exportType: "Export Type", all: "All Records", byFilter: "Filtered Records", selected: "Selected Records",
  fiveRecords: "5 Records", blankTemplate: "Blank Template", selectAll: "Select All", selectMandatory: "Select Mandatory", unselectAll: "Unselect All",
  mandatory: "(Mandatory)", oneRowMandatory: "(1 row mandatory)", export: "Export", cancel: "Cancel", downloading: "Downloading…",
};

export interface FrappeExportDialogProps {
  api: Pick<FrappeApi, "download">;
  bundle: MetaBundle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Checked rows: the dialog opens on "Selected Records" (= `by_filter` on their names). */
  selectedNames?: string[];
  /** The list's current filters, offered as "Filtered Records" when nothing is selected. */
  filters?: FrappeFilter[];
  /** The user's rights per permlevel (`usePermissions().levels`); restricts the fields offered. Unknown → all exportable fields. */
  levels?: DocPermissions;
  /** Desk's `exporting_for`: the list opens the exporter for "Insert New Records" (bulk_operations.js:465-468). */
  importType?: ImportType;
  /** After the server answered with a file (already handed to the browser when possible). */
  onDone?: (file: DownloadedFile) => void;
  labels?: Partial<ExportDialogLabels>;
}

export function FrappeExportDialog({ api, bundle, open, onOpenChange, selectedNames, filters, levels, importType = "Insert New Records", onDone, labels }: FrappeExportDialogProps) {
  const L = { ...EXPORT_DIALOG_LABELS_EN, ...labels };
  const doctype = bundle.meta.name;
  const groups = React.useMemo(() => exportPickerGroups(bundle, { importType, levels }), [bundle, importType, levels]);
  const hasSelection = !!selectedNames?.length;
  const [fileType, setFileType] = React.useState<ExportFileType>("CSV");
  // Desk: `blank_template` when exporting for an insert, else `all`; the list's Actions → Export presets `by_filter`
  const [records, setRecords] = React.useState<ExportRecords>(hasSelection ? "by_filter" : importType === "Insert New Records" ? "blank_template" : "all");
  const [checked, setChecked] = React.useState<Record<string, string[]>>(() => mandatorySelection(groups));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  React.useEffect(() => { if (open) { setChecked(mandatorySelection(groups)); setError(null); setRecords(hasSelection ? "by_filter" : importType === "Insert New Records" ? "blank_template" : "all"); } }, [open, groups, hasSelection, importType]);

  const toggle = (key: string, field: string, on: boolean) => setChecked((c) => ({ ...c, [key]: on ? [...(c[key] ?? []).filter((f) => f !== field), field] : (c[key] ?? []).filter((f) => f !== field) }));
  const selectAll = () => setChecked(Object.fromEntries(groups.map((g) => [g.key, g.fields.map((f) => f.fieldname)])));
  const unselectAll = () => setChecked(Object.fromEntries(groups.map((g) => [g.key, importType === "Update Existing Records" && g.fields.some((f) => f.fieldname === "name") ? ["name"] : []])));
  const parentSelected = (checked[doctype] ?? []).length > 0;

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const exportFields = Object.fromEntries(groups.map((g) => [g.key, g.fields.filter((f) => (checked[g.key] ?? []).includes(f.fieldname)).map((f) => f.fieldname)]));
      const exportFilters = records === "by_filter" ? (hasSelection ? selectedNamesFilter(doctype, selectedNames!) : (filters ?? [])) : null;
      const file = await downloadExportTemplate(api, { doctype, fileType, exportRecords: records, exportFields, exportFilters });
      saveFile(file);
      onDone?.(file);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription>{doctype}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm"><span>{L.fileType}</span>
            <Select value={fileType} onValueChange={(v) => setFileType(v as ExportFileType)}>
              <SelectTrigger aria-label={L.fileType}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Excel">Excel</SelectItem><SelectItem value="CSV">CSV</SelectItem></SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm"><span>{L.exportType}</span>
            <Select value={records} onValueChange={(v) => setRecords(v as ExportRecords)}>
              <SelectTrigger aria-label={L.exportType}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L.all}</SelectItem>
                <SelectItem value="by_filter">{hasSelection ? `${L.selected} (${selectedNames!.length})` : L.byFilter}</SelectItem>
                <SelectItem value="5_records">{L.fiveRecords}</SelectItem>
                <SelectItem value="blank_template">{L.blankTemplate}</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={selectAll}>{L.selectAll}</Button>
          {importType === "Insert New Records" && <Button type="button" size="sm" variant="outline" onClick={() => setChecked(mandatorySelection(groups))}>{L.selectMandatory}</Button>}
          <Button type="button" size="sm" variant="outline" onClick={unselectAll}>{L.unselectAll}</Button>
        </div>
        {groups.map((g) => (
          <fieldset key={g.key} className="space-y-2 rounded-md border p-3" data-export-group={g.key}>
            <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">{g.label}{g.key !== doctype && g.reqd ? ` ${L.oneRowMandatory}` : ""}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {g.fields.map((f) => {
                const id = `sf-export-${g.key}-${f.fieldname}`;
                const on = (checked[g.key] ?? []).includes(f.fieldname);
                return (
                  <div key={f.fieldname} className="flex items-start gap-2 text-sm">
                    <Checkbox id={id} checked={on} onCheckedChange={(v) => toggle(g.key, f.fieldname, v === true)} aria-label={`${g.label}: ${f.label}`} />
                    <label htmlFor={id} className="leading-tight">
                      <span className={f.mandatory ? "text-destructive" : undefined}>{f.label}</span>
                      <span className="block text-xs text-muted-foreground">{f.fieldname} {f.reqd ? L.mandatory : ""}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        {error ? <FrappeErrorState error={error} compact /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L.cancel}</Button>
          <Button type="button" onClick={() => void run()} disabled={busy || !parentSelected} loading={busy}>{busy ? L.downloading : L.export}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
