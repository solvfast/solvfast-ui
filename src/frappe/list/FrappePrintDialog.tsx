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
 * Callers run `checkPrintable` first (draft / cancelled / none / > 500), as Desk does before opening the dialog.
 */
import * as React from "react";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { useLocale } from "../../theme/ThemeProvider";
import type { DownloadedFile, FrappeApi, FrappeClient } from "../client";
import type { DocTypeMeta } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { saveFile } from "./export";
import {
  BACKGROUND_PRINT_THRESHOLD, NO_LETTERHEAD, PRINT_PAGE_SIZES, PRINT_SETTINGS_DEFAULTS, downloadMultiPdf, downloadMultiPdfAsync, letterheadOptions,
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
  const [letterhead, setLetterhead] = React.useState(NO_LETTERHEAD);
  const defaultFormat = typeof meta?.default_print_format === "string" && meta.default_print_format ? meta.default_print_format : formats[0];
  const [format, setFormat] = React.useState(defaultFormat);
  const [pageSize, setPageSize] = React.useState(s.pdf_page_size || "A4");
  const [height, setHeight] = React.useState(settings?.pdf_page_height ? String(settings.pdf_page_height) : "");
  const [width, setWidth] = React.useState(settings?.pdf_page_width ? String(settings.pdf_page_width) : "");
  const [background, setBackground] = React.useState(forced);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [sizeError, setSizeError] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" });
  const unsubscribe = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null); setSizeError(false); setPhase({ kind: "form" }); setBackground(forced); setFormat(defaultFormat); setLetterheadError("");
    let live = true;
    letterheadOptions(api).then((opts) => { if (live) { setLetterheads(opts); setLetterhead(opts[0]); } })
      .catch((e: unknown) => { if (live) { setLetterheads([NO_LETTERHEAD]); setLetterhead(NO_LETTERHEAD); setLetterheadError(e instanceof Error ? e.message : String(e)); } });
    return () => { live = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // the task subscription ends with the dialog (Desk unsubscribes after the event, :139-140)
  React.useEffect(() => () => { unsubscribe.current?.(); unsubscribe.current = null; }, []);
  const close = (o: boolean) => {
    if (busy) return;
    if (!o) { unsubscribe.current?.(); unsubscribe.current = null; }
    onOpenChange(o);
  };

  const run = async () => {
    setError(null); setSizeError(false);
    let options: string;
    try { options = pdfOptions(pageSize, Number(height), Number(width)); } catch { setSizeError(true); return; }
    const args = { doctype, names, format: format || (typeof meta?.default_print_format === "string" ? meta.default_print_format : undefined), letterhead, options };
    setBusy(true);
    try {
      if (background) {
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

  const label = (o: string) => (o === NO_LETTERHEAD ? t("listPrintNoLetterhead") : o);
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("listPrintTitle")}</DialogTitle>
          <DialogDescription>{doctype} · {names.length}</DialogDescription>
        </DialogHeader>
        {phase.kind === "form" ? (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm"><span>{t("listPrintLetterhead")}</span>
              <Select value={letterhead} onValueChange={setLetterhead}>
                <SelectTrigger aria-label={t("listPrintLetterhead")}><SelectValue /></SelectTrigger>
                <SelectContent>{letterheads.map((o) => <SelectItem key={o} value={o}>{label(o)}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            {letterheadError && <p className="text-xs text-muted-foreground">{t("listPrintLetterheadsFailed")} {letterheadError}</p>}
            <label className="block space-y-1 text-sm"><span>{t("listPrintFormat")}</span>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger aria-label={t("listPrintFormat")}><SelectValue /></SelectTrigger>
                <SelectContent>{formats.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="block space-y-1 text-sm"><span>{t("listPrintPageSize")}</span>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger aria-label={t("listPrintPageSize")}><SelectValue /></SelectTrigger>
                <SelectContent>{PRINT_PAGE_SIZES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            {pageSize === "Custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm"><span>{t("listPrintPageHeight")}</span>
                  <Input type="number" inputMode="decimal" aria-label={t("listPrintPageHeight")} value={height} onChange={(e) => setHeight(e.target.value)} /></label>
                <label className="block space-y-1 text-sm"><span>{t("listPrintPageWidth")}</span>
                  <Input type="number" inputMode="decimal" aria-label={t("listPrintPageWidth")} value={width} onChange={(e) => setWidth(e.target.value)} /></label>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Checkbox id="sf-print-background" checked={background} disabled={forced} onCheckedChange={(v) => setBackground(v === true)} aria-label={t("listPrintBackground")} />
              <Label htmlFor="sf-print-background" className="font-normal">{t("listPrintBackground")}</Label>
            </div>
          </div>
        ) : phase.kind === "queued" ? (
          <p role="status" className="text-sm">{phase.waiting ? t("listPrintQueued") : t("listPrintQueuedNoLink")}</p>
        ) : (
          <div role="status" className="space-y-2 text-sm">
            <p>{t("listPrintReady")}</p>
            {phase.fileUrl && <Button asChild size="sm"><a href={phase.fileUrl} target="_blank" rel="noopener noreferrer">{t("listPrintDownload")}</a></Button>}
          </div>
        )}
        {sizeError && <p role="alert" className="text-sm text-destructive">{t("listPrintSizeZero")}</p>}
        {error ? <FrappeErrorState error={error} compact /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>{phase.kind === "form" ? t("cancel") : t("close")}</Button>
          {phase.kind === "form" && <Button type="button" onClick={() => void run()} disabled={busy} loading={busy}>{t("listBulkPrint")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
