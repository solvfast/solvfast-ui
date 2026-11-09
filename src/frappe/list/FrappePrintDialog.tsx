/**
 * FrappePrintDialog — Desk's "Print Documents" dialog of the list (`bulk_operations.js:47-166`): Letter Head (default
 * letterhead first, else "No Letterhead"), Print Format (`get_print_formats`, the DocType's default first), Page Size
 * (`get_print_sizes`, Print Settings' `pdf_page_size`; "Custom" asks height / width in mm) and "Background Print"
 * (forced and read-only above 25 documents). The PDF always comes from the server:
 *  - sync: `download_multi_pdf` through `api.download`, handed to the browser with `saveFile`; a refusal is shown here
 *    as `FrappeErrorState`, nothing saved;
 *  - background: `download_multi_pdf_async` → `{task_id}`; with `subscribeTask` the dialog waits for
 *    `task_complete:<task_id>` and offers the server's `file_url` ("Download PDF"), as Desk's msgprint does
 *    (`:126-141`); without it the dialog says the job is queued and stops there (NOT REPRODUCED: the contract's
 *    `RealtimePort` has no task events).
 * P36e: the presentation is Core `PrintDocumentsDialog` (fields, validation, footer); this component keeps the server
 * integration (letterheads, PDF, background job). Callers run `checkPrintable` first (draft / cancelled / none / > 500), as Desk does before opening the dialog.
 */
import * as React from "react";
import { Button } from "../../primitives/button";
import { PrintDocumentsDialog, type PrintDocumentsValue } from "../../record/PrintDocumentsDialog";
import { useLocale } from "../../theme/ThemeProvider";
import type { DownloadedFile, FrappeApi, FrappeClient } from "../client";
import type { DocTypeMeta } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { saveFile } from "./export";
import {
  BACKGROUND_PRINT_THRESHOLD, NO_LETTERHEAD, PRINT_SETTINGS_DEFAULTS, downloadMultiPdf, downloadMultiPdfAsync, letterheadOptions,
  pdfOptions, printFormatOptions, type PrintSettingsInput, type PrintTaskSubscriber,
} from "./print";

export interface FrappePrintDialogProps {
  api: Pick<FrappeApi, "download"> & Pick<FrappeClient, "call" | "getList">;
  doctype: string;
  /** The names `checkPrintable` accepted. */
  names: string[];
  /** The DocType's getdoctype meta (`__print_formats`, `default_print_format`). */
  meta?: DocTypeMeta;
  /** Print Settings from the host's boot (see `PrintSettingsInput`); the DocType defaults otherwise. */
  settings?: PrintSettingsInput;
  /** Wait for `task_complete:<task_id>` (background printing). */
  subscribeTask?: PrintTaskSubscriber;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the server answered: the PDF (sync) or the queued task (background). */
  onDone?: (result: { file?: DownloadedFile; taskId?: string }) => void;
}

type Phase = { kind: "form" } | { kind: "queued"; taskId: string; waiting: boolean } | { kind: "ready"; fileUrl?: string };

export function FrappePrintDialog({ api, doctype, names, meta, settings, subscribeTask, open, onOpenChange, onDone }: FrappePrintDialogProps) {
  const { t } = useLocale();
  const s = { ...PRINT_SETTINGS_DEFAULTS, ...settings };
  const formats = React.useMemo(() => printFormatOptions(meta, settings), [meta, settings]);
  const forced = names.length > BACKGROUND_PRINT_THRESHOLD;
  const [letterheads, setLetterheads] = React.useState<string[]>([NO_LETTERHEAD]);
  const [letterheadError, setLetterheadError] = React.useState<string>("");
  const defaultFormat = typeof meta?.default_print_format === "string" && meta.default_print_format ? meta.default_print_format : formats[0];
  const initial = (): PrintDocumentsValue => ({
    letterhead: NO_LETTERHEAD, format: defaultFormat, pageSize: s.pdf_page_size || "A4",
    pageHeight: settings?.pdf_page_height ? String(settings.pdf_page_height) : "", pageWidth: settings?.pdf_page_width ? String(settings.pdf_page_width) : "",
    background: forced,
  });
  const [value, setValue] = React.useState<PrintDocumentsValue>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" });
  const unsubscribe = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null); setPhase({ kind: "form" }); setLetterheadError("");
    setValue((v) => ({ ...v, background: forced, format: defaultFormat }));
    let live = true;
    letterheadOptions(api).then((opts) => { if (live) { setLetterheads(opts); setValue((v) => ({ ...v, letterhead: opts[0] })); } })
      .catch((e: unknown) => { if (live) { setLetterheads([NO_LETTERHEAD]); setValue((v) => ({ ...v, letterhead: NO_LETTERHEAD })); setLetterheadError(e instanceof Error ? e.message : String(e)); } });
    return () => { live = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // the task subscription ends with the dialog (Desk unsubscribes after the event, :139-140)
  React.useEffect(() => () => { unsubscribe.current?.(); unsubscribe.current = null; }, []);
  const change = (o: boolean) => {
    if (!o) { unsubscribe.current?.(); unsubscribe.current = null; }
    onOpenChange(o);
  };

  const run = async (v: PrintDocumentsValue) => {
    setError(null);
    // the Core dialog validated the page; pdfOptions builds Desk's `options` string (bulk_operations.js:103-114)
    const options = pdfOptions(v.pageSize, Number(v.pageHeight), Number(v.pageWidth));
    const args = { doctype, names, format: v.format || (typeof meta?.default_print_format === "string" ? meta.default_print_format : undefined), letterhead: v.letterhead, options };
    setBusy(true);
    try {
      if (v.background) {
        const { taskId } = await downloadMultiPdfAsync(api, args);
        onDone?.({ taskId });
        if (subscribeTask) {
          setPhase({ kind: "queued", taskId, waiting: true });
          unsubscribe.current = subscribeTask(taskId, (data) => {
            unsubscribe.current?.(); unsubscribe.current = null;
            setPhase({ kind: "ready", fileUrl: typeof data?.file_url === "string" ? data.file_url : undefined });
          });
        } else setPhase({ kind: "queued", taskId, waiting: false });
      } else {
        const file = await downloadMultiPdf(api, args);
        saveFile(file);
        onDone?.({ file });
        onOpenChange(false);
      }
    } catch (e) {
      setError(e);
    } finally { setBusy(false); }
  };

  const status = phase.kind === "queued"
    ? <p role="status" className="text-sm">{phase.waiting ? t("listPrintQueued") : t("listPrintQueuedNoLink")}</p>
    : phase.kind === "ready" ? (
      <div role="status" className="space-y-2 text-sm">
        <p>{t("listPrintReady")}</p>
        {phase.fileUrl && <Button asChild size="sm"><a href={phase.fileUrl} target="_blank" rel="noopener noreferrer">{t("listPrintDownload")}</a></Button>}
      </div>
    ) : undefined;
  return (
    <PrintDocumentsDialog
      open={open} onOpenChange={change} description={<>{doctype} · {names.length}</>}
      letterheads={letterheads} formats={formats} value={value} onValueChange={setValue}
      letterheadNote={letterheadError ? <>{t("listPrintLetterheadsFailed")} {letterheadError}</> : undefined}
      background={{ forced }} busy={busy} status={status}
      error={error ? <FrappeErrorState error={error} compact /> : undefined}
      onPrint={(v) => void run(v)}
    />
  );
}
