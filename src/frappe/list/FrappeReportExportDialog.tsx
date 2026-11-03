/**
 * FrappeReportExportDialog — Desk's Report view export dialog (`JS/views/reports/report_utils.js:173-241`
 * `get_export_dialog`, opened from `report_view.js:1646-1722`): File Format (Excel / CSV, default Excel), Export in
 * Background, the CSV settings (delimiter, quoting) when CSV, "Export all N rows?" when more rows match than are shown
 * ("Export all matching rows?" when the count is off), "Translate values" for a non-English session. Checked rows are
 * exported as `selected_items` (Desk sends them whenever rows are checked; the package also lets the user pick "All
 * matching rows" instead).
 *
 * The file comes from `frappe.desk.reportview.export_query` through `api.download` (`downloadReportExport`) and is handed
 * to the browser with `saveFile`; a background export shows the server's message and produces no file; a refusal is
 * shown as `FrappeErrorState` and produces no file. Never a client-built file.
 *
 * ⚠ On a real site every Download writes an Access Log row (`desk/reportview.py:410-415`), refused or not: BLOCKED for
 * site verification. Offer it only when `canExport(session.roles, levels[0])` (Desk: `frappe.model.can_export`,
 * `report_view.js:1646`). Not reproduced: Desk's CSV Preview box (`report_utils.js:216-222, 243-276`), the totals row
 * and group-by aggregate arguments of a report view (the list has neither).
 */
import * as React from "react";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import type { FrappeApi } from "../client";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import type { FrappeFilter } from "../query";
import { saveFile } from "./export";
import { downloadReportExport, type CsvQuoting, type ReportExportFormat, type ReportExportResult } from "./reportExport";

/** English defaults (Desk's own words); override to localize — the package catalogue has no report-export keys yet. */
export interface ReportExportDialogLabels {
  title: string; fileFormat: string; background: string; csvSettings: string; csvDelimiter: string; csvQuoting: string;
  quotingMinimal: string; quotingAll: string; quotingNonNumeric: string; quotingNone: string;
  rows: string; selectedRows: string; allRows: string; exportAllRows: string; exportAllMatching: string; translateValues: string;
  download: string; downloading: string; cancel: string; close: string;
}
export const REPORT_EXPORT_DIALOG_LABELS_EN: ReportExportDialogLabels = {
  title: "Export Report: {0}", fileFormat: "File Format", background: "Export in Background", csvSettings: "Settings",
  csvDelimiter: "CSV Delimiter", csvQuoting: "CSV Quoting", quotingMinimal: "Minimal", quotingAll: "All", quotingNonNumeric: "Non-numeric", quotingNone: "None",
  rows: "Rows", selectedRows: "Selected rows ({0})", allRows: "All matching rows", exportAllRows: "Export all {0} rows?", exportAllMatching: "Export all matching rows?",
  translateValues: "Translate values", download: "Download", downloading: "Downloading…", cancel: "Cancel", close: "Close",
};

export interface FrappeReportExportDialogProps {
  api: Pick<FrappeApi, "download" | "call">;
  doctype: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Columns to export — `reportExportFields(visible fields, meta.known)` for a list. */
  fields: string[];
  /** The list's current request (`useFrappeList().request`). */
  filters?: FrappeFilter[];
  or_filters?: FrappeFilter[];
  order_by?: string;
  /** Checked rows: exported as `selected_items` unless the user picks "All matching rows". */
  selectedNames?: string[];
  /** Rows on screen (Desk's `this.data.length`); with `totalCount` above it, "Export all N rows?" is asked (unchecked → only these). */
  shownCount?: number;
  /** The list's count; `null` = the count is off (List View Settings `disable_count`): "Export all matching rows?". */
  totalCount?: number | null;
  /** File name; default the DocType. */
  title?: string;
  /** Offer "Translate values" (Desk: when `frappe.boot.lang !== "en"`), checked by default. */
  offerTranslate?: boolean;
  /** After the server answered: a file (already handed to the browser when possible), or a queued background export. */
  onDone?: (result: ReportExportResult) => void;
  labels?: Partial<ReportExportDialogLabels>;
}

export function FrappeReportExportDialog({ api, doctype, open, onOpenChange, fields, filters, or_filters, order_by, selectedNames, shownCount, totalCount, title, offerTranslate, onDone, labels }: FrappeReportExportDialogProps) {
  const L = { ...REPORT_EXPORT_DIALOG_LABELS_EN, ...labels };
  const hasSelection = !!selectedNames?.length;
  const [format, setFormat] = React.useState<ReportExportFormat>("Excel");
  const [background, setBackground] = React.useState(false);
  const [delimiter, setDelimiter] = React.useState(",");
  const [quoting, setQuoting] = React.useState<CsvQuoting>(2);
  const [scope, setScope] = React.useState<"selected" | "all">(hasSelection ? "selected" : "all");
  const [allRows, setAllRows] = React.useState(false);
  const [translate, setTranslate] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [queued, setQueued] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setError(null); setQueued(null); setScope(hasSelection ? "selected" : "all"); setAllRows(false);
  }, [open, hasSelection]);

  // Desk's extra field (report_view.js:1653-1671): asked when the count is off, or when more rows match than are shown
  const askAll = totalCount === null || (totalCount !== undefined && shownCount !== undefined && totalCount > shownCount);
  const run = async () => {
    setBusy(true); setError(null); setQueued(null);
    try {
      const result = await downloadReportExport(api, {
        doctype, fields, filters, or_filters, order_by, fileFormat: format, title: title || doctype, background,
        selectedItems: scope === "selected" && hasSelection ? selectedNames : undefined,
        // "Export all … rows?" unchecked → only the rows shown (start 0, page_length = shown), report_view.js:1704-1710
        pageLength: askAll && !allRows && shownCount ? shownCount : undefined,
        ...(format === "CSV" ? { csvDelimiter: delimiter, csvQuoting: quoting } : {}),
        ...(offerTranslate ? { translateValues: translate } : {}),
      });
      if (result.kind === "file") { saveFile(result.file); onDone?.(result); onOpenChange(false); }
      else { setQueued(result.message); onDone?.(result); }
    } catch (e) {
      setError(e); // a refusal: nothing saved
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L.title.replace("{0}", title || doctype)}</DialogTitle>
          <DialogDescription>{doctype}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1"><span>{L.fileFormat}</span>
            <Select value={format} onValueChange={(v) => setFormat(v as ReportExportFormat)}>
              <SelectTrigger aria-label={L.fileFormat}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Excel">Excel</SelectItem><SelectItem value="CSV">CSV</SelectItem></SelectContent>
            </Select>
          </label>
          {hasSelection && (
            <label className="block space-y-1"><span>{L.rows}</span>
              <Select value={scope} onValueChange={(v) => setScope(v as "selected" | "all")}>
                <SelectTrigger aria-label={L.rows}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">{L.selectedRows.replace("{0}", String(selectedNames!.length))}</SelectItem>
                  <SelectItem value="all">{L.allRows}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="sf-report-export-bg" checked={background} onCheckedChange={(v) => setBackground(v === true)} />
            <Label className="font-normal" htmlFor="sf-report-export-bg">{L.background}</Label>
          </div>
          {format === "CSV" && (
            <fieldset className="space-y-2 rounded-md border p-3" data-testid="sf-report-export-csv">
              <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">{L.csvSettings}</legend>
              <label className="block space-y-1"><span>{L.csvDelimiter}</span>
                <Input value={delimiter} maxLength={1} aria-label={L.csvDelimiter} onChange={(e) => setDelimiter(e.target.value.slice(0, 1))} />
              </label>
              <label className="block space-y-1"><span>{L.csvQuoting}</span>
                <Select value={String(quoting)} onValueChange={(v) => setQuoting(Number(v) as CsvQuoting)}>
                  <SelectTrigger aria-label={L.csvQuoting}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{L.quotingMinimal}</SelectItem>
                    <SelectItem value="1">{L.quotingAll}</SelectItem>
                    <SelectItem value="2">{L.quotingNonNumeric}</SelectItem>
                    <SelectItem value="3">{L.quotingNone}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </fieldset>
          )}
          {askAll && (
            <div className="flex items-center gap-2">
              <Checkbox id="sf-report-export-all" checked={allRows} onCheckedChange={(v) => setAllRows(v === true)} />
              <Label className="font-normal" htmlFor="sf-report-export-all">{totalCount === null ? L.exportAllMatching : L.exportAllRows.replace("{0}", String(totalCount))}</Label>
            </div>
          )}
          {offerTranslate && (
            <div className="flex items-center gap-2">
              <Checkbox id="sf-report-export-translate" checked={translate} onCheckedChange={(v) => setTranslate(v === true)} />
              <Label className="font-normal" htmlFor="sf-report-export-translate">{L.translateValues}</Label>
            </div>
          )}
        </div>
        {queued !== null && <p role="status" className="text-sm text-muted-foreground">{queued}</p>}
        {error ? <FrappeErrorState error={error} compact /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{queued !== null ? L.close : L.cancel}</Button>
          {queued === null && <Button type="button" onClick={() => void run()} disabled={busy || !fields.length} loading={busy}>{busy ? L.downloading : L.download}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
