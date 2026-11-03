/**
 * FrappeDataImport — Desk's Data Import form (`core/doctype/data_import/data_import.js`) as one panel (or dialog) an
 * app opens itself, e.g. from `FrappeListView`'s `onImport`. Every step is a server request and every state shown is the
 * server's answer; nothing is imported, parsed or validated on the client.
 *
 *  1. Upload — import type, Submit After Import (submittable DocTypes, `:227-236`), Don't Send Emails, "Download
 *     Template" (`:214-221` → the exporter dialog with the import type), the file (`.csv, .xls, .xlsx`, `:62-66`).
 *     "Upload and Preview" = save a new Data Import (`savedocs`), `upload_file` attached to it, save it with
 *     `import_file` (the server parses the file here), `get_preview_from_template` (`:250-282`). A refused file is
 *     replaced on the SAME Data Import.
 *  2. Preview — the server's columns / first rows / warnings (`FrappeImportPreview`, `FrappeImportWarnings`), "Map
 *     Columns" (`FrappeColumnMapping` → `template_options` saved, preview requested again, `:302-309`).
 *  3. Start Import / Retry (`:102-116, 202-212` → `form_start_import`), then `get_import_status` + the document, polled
 *     (`useImportStatus`, with the document's `modified` as the start marker) — and, when the app supplies `subscribe`,
 *     Desk's realtime `data_import_progress` for the progress text and `data_import_refresh` for an immediate re-poll
 *     (`:6-52`). If the job refuses to run (`template_warnings`, importer.py:81-90) the panel returns to the preview with
 *     those warnings.
 *  4. Result — ONLY once the server reports the run finished: status, the headline from the server's counts
 *     (`:127-176`), "Export Errored Rows" on Partial Success (`:85-89, 315-322`), the import log (`:412-502`; "Export
 *     Import Log" from 5000 logged rows, `:504-531`), Retry, "Go to {0} List" (`:91-95`).
 *
 * Refusals are shown as the server sent them (`FrappeErrorState`): 403 on the first save — in Frappe core only System
 * Manager may create a Data Import — upload refusals, template errors on the second save, 417 on start ("Scheduler is
 * inactive"), refused downloads. State lives as long as the component is mounted (closing the dialog keeps it and the
 * poll); unmounting stops polling, never the server's job.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Label } from "../../primitives/label";
import { Progress } from "../../primitives/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { StatusDot } from "../../primitives/status-dot";
import { Stepper, type StepState } from "../../primitives/stepper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/table";
import { FrappeError, type FrappeApi } from "../client";
import { frappeKeys, type MetaBundle } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { ServerHtml } from "../feedback/ServerHtml";
import { FrappeColumnMapping } from "./ColumnMapping";
import { saveFile, type ImportType } from "./export";
import { FrappeExportDialog, type ExportDialogLabels } from "./FrappeExportDialog";
import {
  attachImportFile, createDataImport, downloadErroredRows, downloadImportLog, getImportLogs, getImportPreview, parseTemplateWarnings, saveColumnMapping, startImport, useImportStatus,
  type DataImportDoc, type ImportLogRow, type ImportPreview, type ImportProgress,
} from "./import";
import { FrappeImportPreview, FrappeImportWarnings, useDataImportLabels } from "./ImportPreview";
import { IMPORT_LOG_TABLE_LIMIT, fmt, importResultMessage, parseLogMessages, parseRowIndexes, statusLabel, statusTone, type DataImportLabels } from "./importMapping";

/** Desk's realtime events of a Data Import (published per user / site-wide, not to a document room). */
export type ImportRealtimeEvent = "data_import_progress" | "data_import_refresh";
/** `frappe.realtime.on(event, handler)` of the app's socket; returns the unsubscribe. */
export type ImportRealtimeSubscribe = (event: ImportRealtimeEvent, handler: (data: Record<string, unknown>) => void) => () => void;

export interface FrappeDataImportProps {
  api: Pick<FrappeApi, "call" | "saveDoc" | "uploadFile" | "download" | "getDoc" | "getMetaBundle">;
  /** The DocType to import into (the Data Import's `reference_doctype`). */
  doctype: string;
  /** Its meta bundle; read with `api.getMetaBundle` when absent (for the mapper, the template and Submit After Import). */
  bundle?: MetaBundle;
  /** Pre-selected import type. Default "Insert New Records". */
  importType?: ImportType;
  /** Given → rendered in a Dialog controlled by `open` / `onOpenChange`; absent → an inline panel. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `get_import_status` poll interval while the job runs. Default 2000 ms. */
  pollIntervalMs?: number;
  /** Optional realtime source (progress text and an immediate re-poll). Completion always comes from the poll. */
  subscribe?: ImportRealtimeSubscribe;
  /** "Go to {DocType} List" after a run with successes (Desk `:91-95`); hidden when absent. */
  onGoToList?: () => void;
  /** The server reported the end of a run (Success, Partial Success, Error, Timed Out). */
  onFinished?: (progress: ImportProgress) => void;
  /** Link of an imported document in the log (Desk: `get_form_link`). Plain text when absent or `undefined`. */
  docHref?: (doctype: string, name: string) => string | undefined;
  labels?: Partial<DataImportLabels>;
  /** Labels of the "Download Template" exporter dialog. */
  exportLabels?: Partial<ExportDialogLabels>;
  className?: string;
}

type Phase = "setup" | "preview" | "mapping" | "importing" | "done";
type Step = "meta" | "create" | "upload" | "preview" | "remap" | "start" | "logs" | "download";
interface RealtimeProgress { current: number; total: number; eta: number; success: boolean; skipping: boolean }

const FILE_TYPES = ".csv,.xls,.xlsx";

export function FrappeDataImport({ api, doctype, bundle: bundleProp, importType: importTypeProp, open, onOpenChange, pollIntervalMs, subscribe, onGoToList, onFinished, docHref, labels, exportLabels, className }: FrappeDataImportProps) {
  const L = useDataImportLabels(labels);
  const [busy, setBusy] = React.useState<null | "upload" | "remap" | "start" | "download">(null);
  const metaQ = useQuery<MetaBundle>({ queryKey: frappeKeys.metaBundle(doctype), queryFn: () => api.getMetaBundle(doctype), enabled: !bundleProp, staleTime: 5 * 60_000, retry: false });
  const bundle = bundleProp ?? metaQ.data;

  const [phase, setPhase] = React.useState<Phase>("setup");
  const [mappingFrom, setMappingFrom] = React.useState<Phase>("preview");
  const [importType, setImportType] = React.useState<ImportType>(importTypeProp ?? "Insert New Records");
  const [submitAfter, setSubmitAfter] = React.useState(false);
  const [muteEmails, setMuteEmails] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [doc, setDoc] = React.useState<DataImportDoc | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState<{ step: Step; error: unknown } | null>(null);
  const [since, setSince] = React.useState<string | undefined>(undefined);
  const [alreadyQueued, setAlreadyQueued] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const [rt, setRt] = React.useState<RealtimeProgress | null>(null);
  const [result, setResult] = React.useState<ImportProgress | null>(null);
  const [logs, setLogs] = React.useState<ImportLogRow[] | null>(null);
  const [failedOnly, setFailedOnly] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const uid = React.useId();

  // the job: polled only after `form_start_import` answered (never before — it would poll a document nobody started)
  const poll = useImportStatus(api, doc?.name, { enabled: phase === "importing", since, intervalMs: pollIntervalMs });
  const refetchRef = React.useRef(poll.refetch);
  refetchRef.current = poll.refetch;
  const finishedRef = React.useRef(onFinished);
  finishedRef.current = onFinished;

  React.useEffect(() => {
    const p = poll.progress;
    if (phase !== "importing" || !p || p.running) return;
    if (p.doc) setDoc(p.doc); // the server's document: new `modified` and `template_warnings` for the next save / start
    if (p.status === "Pending" && p.warnings.length) { setStopped(true); setPhase("preview"); return; }
    setResult(p);
    setPhase("done");
    finishedRef.current?.(p);
  }, [poll.progress, phase]);

  // the import log, once the run is over: Desk renders it under 5000 log rows, else offers "Export Import Log"
  React.useEffect(() => {
    if (phase !== "done" || !result || !doc) return;
    const count = result.success + result.failed;
    if (!count || count >= IMPORT_LOG_TABLE_LIMIT) { setLogs(null); return; }
    let live = true;
    getImportLogs(api, doc.name).then((rows) => { if (live) setLogs(rows); }, (e: unknown) => { if (live) setError({ step: "logs", error: e }); });
    return () => { live = false; };
  }, [phase, result, api, doc?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desk's realtime (data_import.js:6-52), only for this Data Import and only while it runs
  React.useEffect(() => {
    if (!subscribe || !doc?.name || phase !== "importing") return;
    const name = doc.name;
    const offProgress = subscribe("data_import_progress", (d) => {
      if (d.data_import !== name) return;
      setRt({ current: Number(d.current) || 0, total: Number(d.total) || 0, eta: Number(d.eta) || 0, success: !!d.success, skipping: !!d.skipping });
    });
    const offRefresh = subscribe("data_import_refresh", (d) => { if (d.data_import === name) void refetchRef.current(); });
    return () => { offProgress(); offRefresh(); };
  }, [subscribe, doc?.name, phase]);

  const fail = (step: Step, e: unknown) => setError({ step, error: e });

  const upload = async () => {
    if (!file) return;
    setBusy("upload"); setError(null); setStopped(false);
    let current = doc;
    try {
      if (!current) { current = await createDataImport(api, { referenceDoctype: doctype, importType, submitAfterImport: submitAfter, muteEmails }); setDoc(current); }
    } catch (e) { fail("create", e); setBusy(null); return; }
    try {
      current = await attachImportFile(api, current, file, file.name);
      setDoc(current);
    } catch (e) { fail("upload", e); setBusy(null); return; }
    await loadPreview(current);
    setBusy(null);
  };

  const loadPreview = async (d: DataImportDoc) => {
    setPreview(null);
    setPhase("preview");
    try { setPreview(await getImportPreview(api, d.name, d.import_file ?? undefined)); } catch (e) { fail("preview", e); }
  };

  const remap = async (changed: Record<string, string>) => {
    if (!doc) return;
    setBusy("remap"); setError(null);
    try {
      const saved = await saveColumnMapping(api, doc, changed);
      setDoc(saved);
      setStopped(false);
      await loadPreview(saved);
    } catch (e) { fail("remap", e); }
    finally { setBusy(null); }
  };

  const start = async () => {
    if (!doc) return;
    setBusy("start"); setError(null);
    const marker = typeof doc.modified === "string" ? doc.modified : undefined;
    try {
      const enqueued = await startImport(api, doc.name);
      setAlreadyQueued(!enqueued); setSince(marker); setStopped(false); setResult(null); setLogs(null); setRt(null);
      setPhase("importing");
    } catch (e) { fail("start", e); }
    finally { setBusy(null); }
  };

  const download = async (kind: "errored" | "log") => {
    if (!doc) return;
    setBusy("download"); setError(null);
    try { saveFile(kind === "errored" ? await downloadErroredRows(api, doc.name) : await downloadImportLog(api, doc.name)); }
    catch (e) { fail("download", e); }
    finally { setBusy(null); }
  };

  const reset = () => {
    setPhase("setup"); setDoc(null); setPreview(null); setFile(null); setError(null); setSince(undefined); setAlreadyQueued(false);
    setStopped(false); setRt(null); setResult(null); setLogs(null); setFailedOnly(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const status = doc?.status ?? "Pending";
  const fileName = (doc?.import_file || file?.name || "").split("/").pop() || "";
  const errorView = error ? (
    <div className="space-y-1" data-import-error={error.step}>
      <FrappeErrorState error={error.error} compact onRetry={error.step === "preview" && doc ? () => { setError(null); void loadPreview(doc); } : undefined} />
      {error.step === "create" && error.error instanceof FrappeError && error.error.kind === "permission" ? <p className="text-sm text-muted-foreground" data-create-refused="">{L.createRefused}</p> : null}
    </div>
  ) : null;

  // ---- steps ----
  const stepStates: StepState[] = (() => {
    const errAt = (i: number, s: StepState): StepState => (error && stepOfError(error.step) === i ? "error" : s);
    switch (phase) {
      case "setup": return [errAt(0, "current"), "upcoming", "upcoming", "upcoming"];
      case "preview": case "mapping": return ["done", errAt(1, "current"), "upcoming", "upcoming"];
      case "importing": return ["done", "done", errAt(2, "current"), "upcoming"];
      default: return ["done", "done", "done", result?.status === "Success" ? "done" : result?.status === "Partial Success" ? "current" : "error"];
    }
  })();
  const steps = [L.stepUpload, L.stepPreview, L.stepImport, L.stepResult].map((label, i) => ({ label, state: stepStates[i] }));

  const mapButton = bundle && preview?.columns?.length && status !== "Success" ? (
    <Button type="button" size="sm" variant="outline" onClick={() => { setMappingFrom(phase === "done" ? "done" : "preview"); setError(null); setPhase("mapping"); }} disabled={!!busy}>{L.mapColumns}</Button>
  ) : null;
  const previewHasFailures = (preview?.import_log ?? []).some((l) => !l.success);
  const startLabel = status === "Pending" ? L.startImport : L.retry;

  const body = (
    <div className="space-y-4">
      <Stepper steps={steps} ariaLabel={L.steps} />

      {phase === "setup" && (
        <div className="space-y-4" data-import-step="upload">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm"><span>{L.importType}</span>
              <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)} disabled={!!doc || !!busy}>
                <SelectTrigger aria-label={L.importType}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Insert New Records">{L.insertNew}</SelectItem>
                  <SelectItem value="Update Existing Records">{L.updateExisting}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="flex flex-col justify-end gap-2 text-sm">
              {bundle?.meta.is_submittable ? (
                <div className="flex items-center gap-2"><Checkbox id={`${uid}-submit`} checked={submitAfter} onCheckedChange={(v) => setSubmitAfter(v === true)} disabled={!!doc || !!busy} aria-label={L.submitAfterImport} /><Label htmlFor={`${uid}-submit`} className="font-normal">{L.submitAfterImport}</Label></div>
              ) : null}
              <div className="flex items-center gap-2"><Checkbox id={`${uid}-mute`} checked={muteEmails} onCheckedChange={(v) => setMuteEmails(v === true)} disabled={!!doc || !!busy} aria-label={L.muteEmails} /><Label htmlFor={`${uid}-mute`} className="font-normal">{L.muteEmails}</Label></div>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor="sf-data-import-file" id={`${uid}-file-label`} className="block">{L.importFile}</label>
            {/* the browser's own picker text ("Choose File / No file chosen") is never translated: the input stays (labelled, out of the
                tab order) behind a DS button and the chosen file's name */}
            <input ref={fileInput} id="sf-data-import-file" type="file" accept={FILE_TYPES} disabled={!!busy} tabIndex={-1} className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} />
            <div className="flex min-w-0 items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={!!busy} aria-describedby={`${uid}-file-label ${uid}-file-name`} onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" aria-hidden />{L.chooseFile}
              </Button>
              <span id={`${uid}-file-name`} dir="auto" className={cn("min-w-0 truncate", !file && "text-muted-foreground")} data-import-file-name="">{file?.name ?? L.noFileChosen}</span>
            </div>
            <p className="text-xs text-muted-foreground">{L.fileHint}</p>
          </div>
          {metaQ.error && !bundleProp ? <FrappeErrorState error={metaQ.error} compact /> : null}
          {errorView}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)} disabled={!bundle || !!busy}>{L.downloadTemplate}</Button>
            <Button type="button" onClick={() => void upload()} disabled={!file || !!busy} loading={busy === "upload"}>{busy === "upload" ? L.uploading : L.upload}</Button>
          </div>
          {bundle ? <FrappeExportDialog api={api} bundle={bundle} open={exportOpen} onOpenChange={setExportOpen} importType={importType} labels={exportLabels} /> : null}
        </div>
      )}

      {phase === "preview" && (
        <div className="space-y-3" data-import-step="preview">
          {status !== "Pending" ? <StatusDot tone={statusTone(status)} label={statusLabel(status, L)} /> : null}
          {stopped ? <p role="alert" className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm" data-import-stopped="">{L.stoppedByWarnings}</p> : null}
          {preview || stopped ? <FrappeImportWarnings warnings={[...parseTemplateWarnings(doc ?? undefined), ...(preview?.warnings ?? [])]} columns={preview?.columns} referenceDoctype={doctype} labels={L} /> : null}
          {preview ? (
            <FrappeImportPreview
              preview={preview}
              labels={L}
              actions={<>
                {mapButton}
                {previewHasFailures ? <Button type="button" size="sm" variant="outline" onClick={() => void download("errored")} disabled={!!busy}>{L.exportErroredRows}</Button> : null}
              </>}
            />
          ) : error?.step === "preview" ? null : (
            <p className="text-sm text-muted-foreground" role="status">{L.loadingPreview}</p>
          )}
          {errorView}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => { setError(null); setPhase("setup"); }} disabled={!!busy}>{L.chooseAnotherFile}</Button>
            {status !== "Success" ? <Button type="button" onClick={() => void start()} disabled={!!busy || !doc?.import_file} loading={busy === "start"}>{busy === "start" ? L.starting : startLabel}</Button> : null}
          </div>
        </div>
      )}

      {phase === "mapping" && preview && bundle && (
        <div className="space-y-3" data-import-step="mapping">
          <FrappeColumnMapping preview={preview} bundle={bundle} fileName={fileName} labels={L} busy={busy === "remap"} onSubmit={(c) => void remap(c)} onCancel={() => setPhase(mappingFrom)} />
          {errorView}
        </div>
      )}

      {phase === "importing" && (
        <ImportingView L={L} progress={poll.progress} pollError={poll.error} rt={rt} alreadyQueued={alreadyQueued} importType={doc?.import_type ?? importType} />
      )}

      {phase === "done" && result && (
        <div className="space-y-3" data-import-step="result">
          <StatusDot tone={statusTone(result.status)} label={statusLabel(result.status, L)} />
          <ResultHeadline L={L} result={result} importType={doc?.import_type ?? importType} hasLogs={!!logs?.length} />
          <div className="flex flex-wrap gap-2">
            {result.status === "Partial Success" ? <Button type="button" size="sm" variant="outline" onClick={() => void download("errored")} disabled={!!busy}>{L.exportErroredRows}</Button> : null}
            {result.success + result.failed >= IMPORT_LOG_TABLE_LIMIT ? <Button type="button" size="sm" variant="outline" onClick={() => void download("log")} disabled={!!busy}>{L.exportImportLog}</Button> : null}
            {mapButton}
            {result.status.includes("Success") && onGoToList ? <Button type="button" size="sm" variant="outline" onClick={onGoToList}>{fmt(L.goToList, doctype)}</Button> : null}
            <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={!!busy}>{L.importAnother}</Button>
            {result.status !== "Success" ? <Button type="button" size="sm" onClick={() => void start()} disabled={!!busy} loading={busy === "start"}>{L.retry}</Button> : null}
          </div>
          {errorView}
          {logs?.length ? <ImportLogTable L={L} logs={logs} failedOnly={failedOnly} setFailedOnly={setFailedOnly} doctype={doctype} importType={doc?.import_type ?? importType} docHref={docHref} /> : null}
        </div>
      )}
    </div>
  );

  // the state above lives in THIS component: in dialog mode, closing the dialog keeps it (and the poll) — reopening shows
  // the same import; "Import another file" starts a new one. Unmounting the component stops polling, never the job.
  if (open === undefined) {
    return (
      <section className={cn("space-y-4", className)} aria-label={L.title} data-frappe-import={doctype}>
        <header>
          <h2 className="text-lg font-semibold">{L.title}</h2>
          <p className="text-sm text-muted-foreground">{doctype}</p>
        </header>
        {body}
      </section>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange?.(o)}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-4xl", className)} data-frappe-import={doctype}>
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription>{doctype}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

const stepOfError = (s: Step): number => (s === "create" || s === "upload" || s === "meta" ? 0 : s === "preview" || s === "remap" ? 1 : s === "start" ? 2 : 3);

function ImportingView({ L, progress, pollError, rt, alreadyQueued, importType }: { L: DataImportLabels; progress?: ImportProgress; pollError: Error | null; rt: RealtimeProgress | null; alreadyQueued: boolean; importType: ImportType }) {
  const queued = !progress || progress.queued;
  // Desk's progress line (data_import.js:19-41) when the app relays `data_import_progress`; else the server's log counts
  let percent: number | undefined;
  let line: string | null = null;
  if (rt && rt.total) {
    percent = Math.floor((rt.current * 100) / rt.total);
    const seconds = Math.floor(rt.eta);
    const minutes = Math.floor(rt.eta / 60);
    const eta = seconds < 60 ? fmt(L.secondsRemaining, seconds) : minutes === 1 ? fmt(L.minuteRemaining, minutes) : fmt(L.minutesRemaining, minutes);
    const what = rt.skipping ? L.skippingOf : importType === "Insert New Records" ? L.importingOf : L.updatingOf;
    line = `${fmt(what, rt.current, rt.total)}, ${eta}`;
  } else if (progress && !queued && progress.total) {
    percent = Math.floor(((progress.success + progress.failed) * 100) / progress.total);
  }
  return (
    <div className="space-y-3" data-import-step="importing" aria-busy="true">
      {alreadyQueued ? <p className="text-sm text-muted-foreground" data-already-queued="">{L.alreadyQueued}</p> : null}
      <StatusDot tone="warning" label={queued ? L.queued : L.inProgress} />
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{L.importProgress}</span>
        <Progress value={percent ?? null} aria-label={L.importProgress} />
        {line ? <p className="text-sm" data-realtime-progress="">{line}</p> : null}
        {progress && !queued && progress.total ? <p className="text-sm text-muted-foreground" data-import-counts="">{fmt(L.countsSoFar, progress.success, progress.failed, progress.total)}</p> : null}
      </div>
      {pollError ? <FrappeErrorState error={pollError} compact /> : null}
    </div>
  );
}

function ResultHeadline({ L, result, importType, hasLogs }: { L: DataImportLabels; result: ImportProgress; importType: ImportType; hasLogs: boolean }) {
  const message = importResultMessage({ status: result.status, success: result.success, failed: result.failed, total: result.total, importType }, L);
  if (message) return <p role="status" className="text-sm font-medium" data-import-result="">{message}</p>;
  if (result.status === "Error" && !hasLogs) return <p role="status" className="text-sm" data-import-result="">{L.errorNoLog}</p>;
  if (result.status === "Timed Out") return <p role="status" className="text-sm" data-import-result="">{L.timedOut}</p>;
  return null;
}

function ImportLogTable({ L, logs, failedOnly, setFailedOnly, doctype, importType, docHref }: {
  L: DataImportLabels; logs: ImportLogRow[]; failedOnly: boolean; setFailedOnly: (v: boolean) => void; doctype: string; importType: ImportType; docHref?: (doctype: string, name: string) => string | undefined;
}) {
  const rows = failedOnly ? logs.filter((l) => !l.success) : logs;
  const failedId = React.useId();
  return (
    <section className="space-y-2" aria-label={L.importLog} data-import-log="">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{L.importLog}</h4>
        <div className="flex items-center gap-2"><Checkbox id={`${failedId}-failed`} checked={failedOnly} onCheckedChange={(v) => setFailedOnly(v === true)} aria-label={L.showFailedOnly} /><Label htmlFor={`${failedId}-failed`} className="font-normal">{L.showFailedOnly}</Label></div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%]">{L.rowNumber}</TableHead>
              <TableHead className="w-[12%]">{L.status}</TableHead>
              <TableHead>{L.message}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{L.noFailedLogs}</TableCell></TableRow>
            ) : rows.map((log, i) => <LogRow key={i} L={L} log={log} doctype={doctype} importType={importType} docHref={docHref} />)}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function LogRow({ L, log, doctype, importType, docHref }: { L: DataImportLabels; log: ImportLogRow; doctype: string; importType: ImportType; docHref?: (doctype: string, name: string) => string | undefined }) {
  const [trace, setTrace] = React.useState(false);
  const ok = !!log.success;
  const name = log.docname ?? "";
  const href = ok && name ? docHref?.(doctype, name) : undefined;
  const doc = href ? <a href={href} className="text-primary underline underline-offset-2">{name}</a> : <span className="font-medium">{name}</span>;
  const template = importType === "Insert New Records" ? L.importedDoc : L.updatedDoc;
  const [before, after = ""] = template.split("{0}");
  return (
    <TableRow data-log-success={ok ? "1" : "0"}>
      <TableCell className="align-top">{parseRowIndexes(log.row_indexes).join(", ")}</TableCell>
      <TableCell className="align-top"><StatusDot tone={ok ? "success" : "destructive"} label={ok ? L.success : L.failure} /></TableCell>
      <TableCell className="align-top">
        {ok ? <span>{before}{doc}{after}</span> : (
          <div className="space-y-1">
            {parseLogMessages(log).map((m, i) => (
              <div key={i}>{m.title ? <strong className="block">{m.title}</strong> : null}{m.message ? <ServerHtml html={m.message} /> : null}</div>
            ))}
            {log.exception ? (
              <div>
                <Button type="button" size="sm" variant="outline" onClick={() => setTrace((v) => !v)} aria-expanded={trace}>{trace ? L.hideTraceback : L.showTraceback}</Button>
                {trace ? <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{log.exception}</pre> : null}
              </div>
            ) : null}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
