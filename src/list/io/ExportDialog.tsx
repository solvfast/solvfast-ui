/**
 * ExportDialog — the Design System's "Export Data" dialog (Desk's Data Exporter, `data_exporter.js:12-102`) without a
 * backend: File Type (Excel / CSV), Export Type (All / Filtered — or Selected (n) — / 5 Records / Blank Template), one
 * field group per entity (and child table) with Select All / Select Mandatory / Unselect All, each field with its label,
 * key and "(Mandatory)" marker; Export is disabled (with the reason) while the main group has no field. The host gets
 * `onExport({ fileType, records, fields })` and produces the file; a rejection is shown in the dialog, a resolution
 * closes it.
 *
 * `FrappeExportDialog` renders this dialog with the DocType's groups and the server's `download_template`; an app with
 * its own data passes its fields and writes the file itself (`buildCsv`, or a spreadsheet library for XLSX).
 */
import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../primitives/alert";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { useLocale } from "../../theme/ThemeProvider";
import { mandatorySelection, orderedSelection, type ExportFileType, type ExportGroup, type ExportRecords, type ExportRequest } from "./export";

/** Every string of the dialog. Defaults come from the package's message catalogue (en / ar). */
export interface ExportDialogLabels {
  title: string; fileType: string; exportType: string; all: string; byFilter: string; selected: string; fiveRecords: string; blankTemplate: string;
  selectAll: string; selectMandatory: string; unselectAll: string; mandatory: string; oneRowMandatory: string; export: string; cancel: string; downloading: string;
  /** Shown while the main group has no field selected (Export disabled). */
  nothingSelected?: string;
  /** Fallback text of a failed export whose error carries no message. */
  failed?: string;
}

/** English labels (also the catalogue's `export*` keys). */
export const EXPORT_DIALOG_LABELS_EN: ExportDialogLabels = {
  title: "Export Data", fileType: "File Type", exportType: "Export Type", all: "All Records", byFilter: "Filtered Records", selected: "Selected Records",
  fiveRecords: "5 Records", blankTemplate: "Blank Template", selectAll: "Select All", selectMandatory: "Select Mandatory", unselectAll: "Unselect All",
  mandatory: "(Mandatory)", oneRowMandatory: "(1 row mandatory)", export: "Export", cancel: "Cancel", downloading: "Downloading…",
  nothingSelected: "Select at least one field to export.", failed: "The export failed.",
};

/** The dialog's labels for the current language (the catalogue's `export*` keys), overridden by `labels`. */
export function useExportDialogLabels(labels?: Partial<ExportDialogLabels>): Required<ExportDialogLabels> {
  const { t } = useLocale();
  return React.useMemo(() => ({
    title: t("exportTitle"), fileType: t("exportFileType"), exportType: t("exportType"), all: t("exportAll"), byFilter: t("exportByFilter"),
    selected: t("exportSelected"), fiveRecords: t("exportFiveRecords"), blankTemplate: t("exportBlankTemplate"), selectAll: t("exportSelectAll"),
    selectMandatory: t("exportSelectMandatory"), unselectAll: t("exportUnselectAll"), mandatory: t("exportMandatory"), oneRowMandatory: t("exportOneRowMandatory"),
    export: t("exportExport"), cancel: t("exportCancel"), downloading: t("exportDownloading"), nothingSelected: t("exportNothingSelected"), failed: t("exportFailed"),
    ...stripUndefined(labels),
  }), [t, labels]);
}
const stripUndefined = <T extends object>(o: T | undefined): Partial<T> => (o ? (Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>) : {});

const ALL_RECORDS: ExportRecords[] = ["all", "by_filter", "5_records", "blank_template"];

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The field groups: the main entity first (its selection gates Export), then child tables. */
  groups: ExportGroup[];
  /** Produce the file. Resolve → the dialog closes (and `onDone` runs); reject → the error is shown in the dialog. */
  onExport: (request: ExportRequest) => Promise<unknown> | unknown;
  onDone?: (request: ExportRequest) => void;
  /** Under the title (Frappe: the DocType; an app: the entity's name). */
  description?: React.ReactNode;
  /** Checked rows: "Filtered Records" reads "Selected Records (n)" and is the default. */
  selectedCount?: number;
  /** Record counts shown after "All Records" / "Filtered Records" (e.g. `{ all: 120, by_filter: 18 }`). */
  counts?: Partial<Record<ExportRecords, number>>;
  /** The Export Type options offered, in this order. Default: all four. */
  recordOptions?: ExportRecords[];
  /** Pre-selected Export Type when the dialog opens. Default: "by_filter" with a selection, else "all". */
  defaultRecords?: ExportRecords;
  /** File types offered. Default: Excel and CSV. */
  fileTypes?: ExportFileType[];
  defaultFileType?: ExportFileType;
  /** Show "Select Mandatory" (Frappe: only when exporting for an insert). Default true. */
  showSelectMandatory?: boolean;
  /** Fields "Unselect All" keeps (Frappe, Update Existing Records: the ID). */
  unselectKeeps?: Record<string, string[]>;
  /** Selected when the dialog opens, on top of the mandatory fields (e.g. the list's visible columns). */
  defaultSelection?: Record<string, string[]>;
  /** Mandatory fields cannot be unchecked: they are always exported. */
  lockMandatory?: boolean;
  /** How a failure is shown (Frappe: FrappeErrorState). Default: a destructive alert with the error's message. */
  renderError?: (error: unknown) => React.ReactNode;
  labels?: Partial<ExportDialogLabels>;
  className?: string;
}

export function ExportDialog({
  open, onOpenChange, groups, onExport, onDone, description, selectedCount, counts, recordOptions = ALL_RECORDS, defaultRecords, fileTypes = ["Excel", "CSV"],
  defaultFileType = "CSV", showSelectMandatory = true, unselectKeeps, defaultSelection, lockMandatory = false, renderError, labels, className,
}: ExportDialogProps) {
  const L = useExportDialogLabels(labels);
  const hasSelection = !!selectedCount;
  const initialRecords: ExportRecords = defaultRecords ?? (hasSelection ? "by_filter" : "all");
  // `defaultSelection` is read when the dialog (re)opens or the groups change — a new object per render never resets the picks
  const defaultSelectionRef = React.useRef(defaultSelection);
  defaultSelectionRef.current = defaultSelection;
  const initialChecked = React.useCallback((): Record<string, string[]> => {
    const base = mandatorySelection(groups);
    const extraSel = defaultSelectionRef.current;
    if (!extraSel) return base;
    const out: Record<string, string[]> = { ...base };
    for (const g of groups) {
      const extra = (extraSel[g.key] ?? []).filter((f) => g.fields.some((x) => x.fieldname === f));
      if (extra.length) out[g.key] = [...new Set([...(out[g.key] ?? []), ...extra])];
    }
    return out;
  }, [groups]);
  const [fileType, setFileType] = React.useState<ExportFileType>(defaultFileType);
  const [records, setRecords] = React.useState<ExportRecords>(initialRecords);
  const [checked, setChecked] = React.useState<Record<string, string[]>>(initialChecked);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  React.useEffect(() => {
    if (open) { setChecked(initialChecked()); setError(null); setRecords(initialRecords); setFileType(defaultFileType); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChecked, initialRecords]);

  const locked = (g: ExportGroup, fieldname: string) => lockMandatory && g.reqd && g.fields.some((f) => f.fieldname === fieldname && f.mandatory);
  const lockedOf = (g: ExportGroup) => (lockMandatory && g.reqd ? g.fields.filter((f) => f.mandatory).map((f) => f.fieldname) : []);
  const toggle = (key: string, field: string, on: boolean) => setChecked((c) => ({ ...c, [key]: on ? [...(c[key] ?? []).filter((f) => f !== field), field] : (c[key] ?? []).filter((f) => f !== field) }));
  const selectAll = () => setChecked(Object.fromEntries(groups.map((g) => [g.key, g.fields.map((f) => f.fieldname)])));
  const unselectAll = () => setChecked(Object.fromEntries(groups.map((g) => [g.key, [...new Set([...(unselectKeeps?.[g.key] ?? []).filter((f) => g.fields.some((x) => x.fieldname === f)), ...lockedOf(g)])]])));
  const main = groups[0];
  const mainSelected = !!main && (checked[main.key] ?? []).length > 0;

  const run = async () => {
    const request: ExportRequest = { fileType, records, fields: orderedSelection(groups, checked) };
    setBusy(true); setError(null);
    try {
      await onExport(request);
      onDone?.(request);
      onOpenChange(false);
    } catch (e) {
      setError(e ?? new Error(L.failed));
    } finally { setBusy(false); }
  };

  const countOf = (r: ExportRecords) => (counts?.[r] !== undefined ? ` (${counts[r]})` : "");
  const recordLabel = (r: ExportRecords) => {
    switch (r) {
      case "all": return `${L.all}${countOf("all")}`;
      case "by_filter": return hasSelection ? `${L.selected} (${selectedCount})` : `${L.byFilter}${countOf("by_filter")}`;
      case "5_records": return L.fiveRecords;
      default: return L.blankTemplate;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={className ?? "max-h-[85vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl"} data-export-dialog="">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm"><span>{L.fileType}</span>
            <Select value={fileType} onValueChange={(v) => setFileType(v as ExportFileType)}>
              <SelectTrigger aria-label={L.fileType}><SelectValue /></SelectTrigger>
              <SelectContent>{fileTypes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm"><span>{L.exportType}</span>
            <Select value={records} onValueChange={(v) => setRecords(v as ExportRecords)}>
              <SelectTrigger aria-label={L.exportType}><SelectValue /></SelectTrigger>
              <SelectContent>{recordOptions.map((r) => <SelectItem key={r} value={r}>{recordLabel(r)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={selectAll}>{L.selectAll}</Button>
          {showSelectMandatory && <Button type="button" size="sm" variant="outline" onClick={() => setChecked(mandatorySelection(groups))}>{L.selectMandatory}</Button>}
          <Button type="button" size="sm" variant="outline" onClick={unselectAll}>{L.unselectAll}</Button>
        </div>
        {groups.map((g, gi) => (
          <fieldset key={g.key} className="space-y-2 rounded-md border p-3" data-export-group={g.key}>
            <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">{g.label}{gi > 0 && g.reqd ? ` ${L.oneRowMandatory}` : ""}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {g.fields.map((f) => {
                const id = `sf-export-${g.key}-${f.fieldname}`;
                const isLocked = locked(g, f.fieldname);
                const on = isLocked || (checked[g.key] ?? []).includes(f.fieldname);
                return (
                  <div key={f.fieldname} className="flex items-start gap-2 text-sm" data-export-field={f.fieldname}>
                    <Checkbox id={id} checked={on} disabled={isLocked} onCheckedChange={(v) => toggle(g.key, f.fieldname, v === true)} aria-label={`${g.label}: ${f.label}`} />
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
        {!mainSelected ? <p className="text-sm text-muted-foreground" role="status" data-export-validation="">{L.nothingSelected}</p> : null}
        {error ? (renderError ? renderError(error) : (
          <Alert variant="destructive" role="alert" data-export-error="">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{error instanceof Error && error.message ? error.message : typeof error === "string" ? error : L.failed}</AlertDescription>
          </Alert>
        )) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L.cancel}</Button>
          <Button type="button" onClick={() => void run()} disabled={busy || !mainSelected} loading={busy}>{busy ? L.downloading : L.export}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
