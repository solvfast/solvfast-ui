/**
 * DataImportDialog — the Design System's Data Import tool (the structure of Desk's Data Import form,
 * `core/doctype/data_import/data_import.js`, as `FrappeDataImport` renders it) for an app WITHOUT a Frappe server.
 * Four steps (Upload → Preview → Import → Result) on the same Stepper and views:
 *
 *  1. Upload — Import Type, "Download Template" (the Core `ExportDialog` on the adapter's fields), the file
 *     (`.csv, .xls, .xlsx` by default) behind a DS button, "Upload and Preview" = `adapter.parse(file)`.
 *  2. Preview — "{file}: {n} rows, {m} columns", the warnings (unmatched columns, mandatory fields without a column,
 *     per-row errors, duplicates — by row, as Desk groups them), the counts (ready / with errors / duplicates), the
 *     duplicate handling choice, the first rows in the preview grid with each column's field, "Map Columns" (the
 *     column mapper; saving re-validates).
 *  3. Start Import → `adapter.run(rows, onProgress)` with a progress bar. When the adapter declares
 *     `runUnavailable: "<reason>"`, Start Import stays disabled and the reason is shown — nothing is imported and
 *     no success is ever shown.
 *  4. Result — only the counts `run` resolved with (status, Desk's headline, failed rows), "Import another file".
 *
 * The file is read, mapped and validated in the browser by the adapter's `parse` and the fields' checks. The
 * Frappe layer does not use this orchestration (its every step is a server request — `FrappeDataImport`); both
 * render the same Core views (`ImportPreviewTable`, `ImportWarningsPanel`, `ColumnMappingForm`, the labels).
 */
import * as React from "react";
import { AlertCircle, Info, Upload } from "lucide-react";
import { cn } from "../../lib/cn";
import { Alert, AlertDescription } from "../../primitives/alert";
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Progress } from "../../primitives/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { StatusDot } from "../../primitives/status-dot";
import { Stepper, type StepState } from "../../primitives/stepper";
import { ExportDialog, type ExportDialogProps } from "./ExportDialog";
import { ColumnMappingForm, DONT_IMPORT, ImportPreviewTable, ImportWarningsPanel, useImportDialogLabels } from "./ImportParts";
import { fmt, importResultHeadline, importStatusLabel, importStatusTone, type ImportDialogLabels } from "./importLabels";
import {
  autoMapColumns, importPreviewColumns, importableRows, validateImport,
  type ColumnMap, type ImportDuplicateCheck, type ImportField, type ImportRowCheck, type ImportType, type ParsedImportFile,
} from "./importModel";

export interface ImportRunInput {
  importType: ImportType;
  /** The rows to import (no errors; duplicates only when the user chose to import them), values by field key. */
  rows: ImportRowCheck[];
  importDuplicates: boolean;
}
export interface ImportRunResult {
  success: number;
  failed: number;
  /** Failed rows and why. */
  errors?: { rowNumber: number; message: string }[];
}

/** What a host supplies: its fields, how a file is read, how duplicates are found, and whether / how the import runs. */
export interface DataImportAdapter {
  fields: ImportField[];
  /** Read the chosen file (CSV: `parseCsv`; XLSX needs a spreadsheet library in the host). Reject with a readable error. */
  parse: (file: File) => Promise<ParsedImportFile>;
  /** File types accepted by the picker. Default ".csv,.xls,.xlsx". */
  accept?: string;
  /** Import types offered. Default: Insert New Records only. */
  importTypes?: ImportType[];
  duplicates?: ImportDuplicateCheck;
  /** Run the import. Absent, or `runUnavailable` set → Start Import is disabled. */
  run?: (input: ImportRunInput, onProgress: (done: number, total: number) => void) => Promise<ImportRunResult>;
  /** Why the import cannot run here (shown next to the disabled Start Import). */
  runUnavailable?: string;
  /** "Download Template": the Core ExportDialog with these props (groups and the file writer). */
  template?: Omit<ExportDialogProps, "open" | "onOpenChange">;
}

export interface DataImportDialogProps {
  adapter: DataImportAdapter;
  /** Under the title (the entity's name). */
  description?: React.ReactNode;
  /** Given → a Dialog controlled by `open` / `onOpenChange`; absent → an inline panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rows shown in the preview grid. Default 10 (Desk's MAX_ROWS_IN_PREVIEW). */
  previewRows?: number;
  /** After a run resolved. */
  onFinished?: (result: ImportRunResult & { total: number; status: "Success" | "Partial Success" | "Error" }) => void;
  labels?: Partial<ImportDialogLabels>;
  className?: string;
}

type Phase = "setup" | "preview" | "mapping" | "importing" | "done";
interface Result extends ImportRunResult { total: number; status: "Success" | "Partial Success" | "Error" }

export function DataImportDialog({ adapter, description, open, onOpenChange, previewRows = 10, onFinished, labels, className }: DataImportDialogProps) {
  const L = useImportDialogLabels(labels);
  const importTypes = adapter.importTypes?.length ? adapter.importTypes : (["Insert New Records"] as ImportType[]);
  const [phase, setPhase] = React.useState<Phase>("setup");
  const [importType, setImportType] = React.useState<ImportType>(importTypes[0]);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParsedImportFile | null>(null);
  const [map, setMap] = React.useState<ColumnMap>([]);
  const [importDuplicates, setImportDuplicates] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "read" | "run">(null);
  const [error, setError] = React.useState<{ step: "read" | "run"; message: string } | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const uid = React.useId();

  const validation = React.useMemo(
    () => (parsed ? validateImport(parsed, map, adapter.fields, L, adapter.duplicates) : null),
    [parsed, map, adapter.fields, adapter.duplicates, L],
  );
  const toImport = React.useMemo(() => (validation ? importableRows(validation, importDuplicates) : []), [validation, importDuplicates]);
  const columns = React.useMemo(() => (parsed ? importPreviewColumns(parsed, map, adapter.fields) : []), [parsed, map, adapter.fields]);
  const rowStatus = React.useMemo(() => {
    const m = new Map<number, "error" | "duplicate">();
    for (const r of validation?.rows ?? []) if (r.errors.length) m.set(r.rowNumber, "error"); else if (r.duplicate) m.set(r.rowNumber, "duplicate");
    return m;
  }, [validation]);

  // the mapper's inputs, memoised on the file / mapping / fields' STRUCTURE: a host re-render (a new-but-equal adapter)
  // must not reset the picks the user has not saved yet
  const fieldsSig = adapter.fields.map((f) => `${f.key}\u0001${f.label}\u0001${f.description ?? ""}`).join("\u0002");
  const fieldsRef = React.useRef(adapter.fields);
  fieldsRef.current = adapter.fields;
  const mapColumns = React.useMemo(() => (parsed ? parsed.headers.map((h, j) => ({ index: j + 1, header: h })) : []), [parsed]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mapOptions = React.useMemo(() => fieldsRef.current.map((f) => ({ value: f.key, label: f.label, description: f.description ?? f.key, doctype: "" })), [fieldsSig]);
  const mapInitial = React.useMemo(() => (parsed ? Object.fromEntries(parsed.headers.map((_, j) => [j + 1, map[j] ?? DONT_IMPORT])) : {}), [parsed, map]);

  const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : typeof e === "string" ? e : String(e));

  const upload = async () => {
    if (!file) return;
    setBusy("read"); setError(null);
    try {
      const p = await adapter.parse(file);
      if (!p.headers.length || !p.rows.length) { setError({ step: "read", message: L.emptyFile }); return; }
      setParsed(p);
      setMap(autoMapColumns(p.headers, adapter.fields));
      setPhase("preview");
    } catch (e) {
      setError({ step: "read", message: fmt(L.readFailed, errorMessage(e)) });
    } finally { setBusy(null); }
  };

  const runAvailable = !!adapter.run && !adapter.runUnavailable;
  const start = async () => {
    if (!adapter.run || !runAvailable || !toImport.length) return;
    setBusy("run"); setError(null); setProgress({ done: 0, total: toImport.length }); setPhase("importing");
    try {
      const r = await adapter.run({ importType, rows: toImport, importDuplicates }, (done, total) => setProgress({ done, total }));
      const total = toImport.length;
      const status: Result["status"] = r.failed === 0 && r.success > 0 ? "Success" : r.success > 0 ? "Partial Success" : "Error";
      const res: Result = { ...r, total, status };
      setResult(res); setPhase("done");
      onFinished?.(res);
    } catch (e) {
      setError({ step: "run", message: errorMessage(e) }); setPhase("preview");
    } finally { setBusy(null); }
  };

  const reset = () => {
    setPhase("setup"); setFile(null); setParsed(null); setMap([]); setError(null); setProgress(null); setResult(null); setImportDuplicates(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const stepStates: StepState[] = (() => {
    switch (phase) {
      case "setup": return [error?.step === "read" ? "error" : "current", "upcoming", "upcoming", "upcoming"];
      case "preview": case "mapping": return ["done", error?.step === "run" ? "error" : "current", "upcoming", "upcoming"];
      case "importing": return ["done", "done", "current", "upcoming"];
      default: return ["done", "done", "done", result?.status === "Success" ? "done" : result?.status === "Partial Success" ? "current" : "error"];
    }
  })();
  const steps = [L.stepUpload, L.stepPreview, L.stepImport, L.stepResult].map((label, i) => ({ label, state: stepStates[i] }));
  const errorView = error ? (
    <Alert variant="destructive" role="alert" data-import-error={error.step}>
      <AlertCircle className="h-4 w-4" aria-hidden />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ) : null;
  const unavailableId = `${uid}-unavailable`;
  const shown = parsed ? parsed.rows.slice(0, previewRows).map((cells, i) => [i + 2, ...parsed.headers.map((_, j) => cells[j] ?? "")]) : [];

  const body = (
    <div className="space-y-4">
      <Stepper steps={steps} ariaLabel={L.steps} />

      {phase === "setup" && (
        <div className="space-y-4" data-import-step="upload">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm"><span>{L.importType}</span>
              <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)} disabled={!!busy}>
                <SelectTrigger aria-label={L.importType}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {importTypes.map((t) => <SelectItem key={t} value={t}>{t === "Insert New Records" ? L.insertNew : L.updateExisting}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor={`${uid}-file`} id={`${uid}-file-label`} className="block">{L.importFile}</label>
            <input ref={fileInput} id={`${uid}-file`} type="file" accept={adapter.accept ?? ".csv,.xls,.xlsx"} disabled={!!busy} tabIndex={-1} className="sr-only" data-import-file-input=""
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} />
            <div className="flex min-w-0 items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={!!busy} aria-describedby={`${uid}-file-label ${uid}-file-name`} onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" aria-hidden />{L.chooseFile ?? "Choose File"}
              </Button>
              <span id={`${uid}-file-name`} dir="auto" className={cn("min-w-0 truncate", !file && "text-muted-foreground")} data-import-file-name="">{file?.name ?? L.noFileChosen ?? "No file chosen"}</span>
            </div>
            <p className="text-xs text-muted-foreground">{L.fileHint}</p>
          </div>
          {errorView}
          <div className="flex flex-wrap justify-between gap-2">
            {adapter.template ? <Button type="button" variant="outline" onClick={() => setTemplateOpen(true)} disabled={!!busy}>{L.downloadTemplate}</Button> : <span />}
            <Button type="button" onClick={() => void upload()} disabled={!file || !!busy} loading={busy === "read"}>{busy === "read" ? L.readingFile : L.upload}</Button>
          </div>
          {adapter.template ? <ExportDialog defaultRecords="blank_template" {...adapter.template} open={templateOpen} onOpenChange={setTemplateOpen} /> : null}
        </div>
      )}

      {phase === "preview" && parsed && validation && (
        <div className="space-y-3" data-import-step="preview">
          <p className="text-sm font-medium" data-import-summary-file="" dir="auto">{fmt(L.fileSummary, file?.name ?? "", parsed.rows.length, parsed.headers.length)}</p>
          <ImportWarningsPanel warnings={validation.warnings} labels={L} />
          <section className="space-y-2 rounded-md border p-3 text-sm" aria-label={L.summary} data-import-counts="">
            <h4 className="font-semibold">{L.summary}</h4>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <StatusDot tone="success" label={<span data-count-ready={toImport.length}>{fmt(L.summaryReady, toImport.length)}</span>} />
              <StatusDot tone={validation.counts.errors ? "destructive" : "default"} label={<span data-count-errors={validation.counts.errors}>{fmt(L.summaryErrors, validation.counts.errors)}</span>} />
              {adapter.duplicates ? <StatusDot tone={validation.counts.duplicates ? "warning" : "default"} label={<span data-count-duplicates={validation.counts.duplicates}>{fmt(L.summaryDuplicates, validation.counts.duplicates)}</span>} /> : null}
            </div>
            {validation.counts.errors ? <p className="text-muted-foreground">{L.fixErrorsFirst}</p> : null}
            {adapter.duplicates ? (
              <label className="flex flex-wrap items-center gap-2 pt-1"><span>{L.duplicateHandling}</span>
                <Select value={importDuplicates ? "import" : "skip"} onValueChange={(v) => setImportDuplicates(v === "import")} disabled={!!busy}>
                  <SelectTrigger aria-label={L.duplicateHandling} className="h-8 w-auto min-w-[12rem]" data-duplicate-handling=""><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">{L.duplicateSkip}</SelectItem>
                    <SelectItem value="import">{L.duplicateImport}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : null}
          </section>
          <ImportPreviewTable
            columns={columns}
            rows={shown}
            rowStatus={rowStatus}
            labels={L}
            shownOf={parsed.rows.length > previewRows ? { shown: previewRows, total: parsed.rows.length } : null}
            actions={<Button type="button" size="sm" variant="outline" onClick={() => { setError(null); setPhase("mapping"); }} disabled={!!busy}>{L.mapColumns}</Button>}
          />
          {!runAvailable ? (
            <p id={unavailableId} role="status" className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm" data-import-unavailable="">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{fmt(L.runUnavailable, adapter.runUnavailable ?? "")}</span>
            </p>
          ) : !toImport.length ? <p id={unavailableId} role="status" className="text-sm text-muted-foreground" data-import-nothing="">{L.nothingToImport}</p> : null}
          {errorView}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => { setError(null); setPhase("setup"); }} disabled={!!busy}>{L.chooseAnotherFile}</Button>
            <Button type="button" onClick={() => void start()} disabled={!!busy || !runAvailable || !toImport.length} aria-describedby={!runAvailable || !toImport.length ? unavailableId : undefined} data-import-start="">{L.startImport}</Button>
          </div>
        </div>
      )}

      {phase === "mapping" && parsed && (
        <div className="space-y-3" data-import-step="mapping">
          <ColumnMappingForm
            columns={mapColumns}
            options={mapOptions}
            initial={mapInitial}
            heading={fmt(L.mapHeading, file?.name ?? "", typeof description === "string" ? description : "")}
            labels={L}
            onCancel={() => setPhase("preview")}
            onSubmit={(changes) => {
              setMap((m) => { const next = [...m]; for (const [i, v] of Object.entries(changes)) next[Number(i) - 1] = v === DONT_IMPORT ? null : v; return next; });
              setPhase("preview");
            }}
          />
        </div>
      )}

      {phase === "importing" && (
        <div className="space-y-3" data-import-step="importing" aria-busy="true">
          <StatusDot tone="warning" label={L.inProgress} />
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{L.importProgress}</span>
            <Progress value={progress && progress.total ? Math.floor((progress.done * 100) / progress.total) : null} aria-label={L.importProgress} />
            {progress ? <p className="text-sm" data-import-progress="">{fmt(importType === "Insert New Records" ? L.importingOf : L.updatingOf, progress.done, progress.total)}</p> : null}
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="space-y-3" data-import-step="result">
          <StatusDot tone={importStatusTone(result.status)} label={importStatusLabel(result.status, L)} />
          <p role="status" className="text-sm font-medium" data-import-result="">{importResultHeadline({ ...result, importType }, L) ?? L.errorNoLog}</p>
          {result.errors?.length ? (
            <section className="space-y-1 text-sm" aria-label={L.resultFailedRows} data-import-failed-rows="">
              <h4 className="font-semibold">{L.resultFailedRows}</h4>
              <ul className="list-disc ps-5">{result.errors.map((e, i) => <li key={i}>{fmt(L.row, e.rowNumber)}: {e.message}</li>)}</ul>
            </section>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={reset}>{L.importAnother}</Button>
          </div>
        </div>
      )}
    </div>
  );

  if (open === undefined) {
    return (
      <section className={cn("space-y-4", className)} aria-label={L.title} data-data-import="">
        <header>
          <h2 className="text-lg font-semibold">{L.title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>
        {body}
      </section>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange?.(o)}>
      <DialogContent className={cn("max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-4xl", className)} data-data-import="">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
