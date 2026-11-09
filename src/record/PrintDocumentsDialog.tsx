/**
 * PrintDocumentsDialog — the presentation of Desk's list "Print Documents" dialog (`bulk_operations.js:47-93`), Core and
 * Frappe-free: Letter Head, Print Format, Page Size, Page Height / Width (in mm, only for "Custom"), then the optional
 * rows a host supports — Language (a local renderer that prints in either language) and Background Print (Frappe's
 * server job; omit it where nothing is queued). An optional `preview` slot shows what will print (Desk's dialog has no
 * preview; a host that renders locally can show one). Primary action "Print" (`:95`).
 *
 * Controlled: the host owns `value` and gets every change through `onValueChange`; on Print the dialog validates the
 * page first — a Custom size needs height AND width > 0 ("Page height and width cannot be zero", `:104-106`; an empty
 * value is refused too) — and only then calls `onPrint(value, page)`. Hosts: `FrappePrintDialog` (server PDF) and any
 * local / mock app (browser printing via `composePrintDocument` + `printHtmlDocument`).
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { NO_LETTERHEAD, PRINT_PAGE_SIZES, isValidPrintPage, type PrintPageSpec } from "./printDocument";

export interface PrintDocumentsValue {
  letterhead: string;
  format: string;
  pageSize: string;
  /** mm, as typed (only used for "Custom"). */
  pageHeight: string;
  pageWidth: string;
  /** Only with the `background` row. */
  background?: boolean;
  /** Only with `languages`. */
  language?: string;
}

export interface PrintOption { value: string; label: string }

export interface PrintDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default "Print Documents". */
  title?: React.ReactNode;
  /** E.g. "Lead · 3". */
  description?: React.ReactNode;
  letterheads: string[];
  formats: string[];
  /** Default `PRINT_PAGE_SIZES` (Desk's list). */
  pageSizes?: readonly string[];
  /** Optional Language row (after Page Size). */
  languages?: PrintOption[];
  value: PrintDocumentsValue;
  onValueChange: (next: PrintDocumentsValue) => void;
  /** Label of a letterhead option; default: "No Letterhead" translated, others as named. */
  letterheadLabel?: (option: string) => string;
  /** Label of a format option; default as named. */
  formatLabel?: (option: string) => string;
  /** A note under Letter Head (e.g. "Letter heads could not be loaded: …"). */
  letterheadNote?: React.ReactNode;
  /** The Background Print row (`bulk_operations.js:85-91`); `forced` = checked and read-only (> 25 documents). Omit for none. */
  background?: { forced?: boolean };
  /** What will print (e.g. `PrintPreviewFrame`). The dialog widens to two columns with it. */
  preview?: React.ReactNode;
  /** A note above the footer (e.g. how browser printing works). */
  note?: React.ReactNode;
  /** Validated page → the host prints. */
  onPrint: (value: PrintDocumentsValue, page: PrintPageSpec) => void;
  /** Default "Print". */
  printLabel?: React.ReactNode;
  busy?: boolean;
  /** An error of the last Print (text or node). */
  error?: React.ReactNode;
  /** Replaces the form (e.g. "queued" / "ready" after a background job); hides Print and turns Cancel into Close. */
  status?: React.ReactNode;
  className?: string;
}

export const BACKGROUND_PRINT_ID = "sf-print-background";

/** The page of a dialog value (`heightMm` / `widthMm` parsed from the inputs). */
export function printPageOf(v: Pick<PrintDocumentsValue, "pageSize" | "pageHeight" | "pageWidth">): PrintPageSpec {
  return v.pageSize === "Custom" ? { pageSize: "Custom", heightMm: Number(v.pageHeight), widthMm: Number(v.pageWidth) } : { pageSize: v.pageSize };
}

export function PrintDocumentsDialog(p: PrintDocumentsDialogProps) {
  const { t } = useLocale();
  const { open, onOpenChange, value: v, onValueChange, busy } = p;
  const [sizeError, setSizeError] = React.useState(false);
  React.useEffect(() => { if (open) setSizeError(false); }, [open]);
  const set = (patch: Partial<PrintDocumentsValue>) => { if (patch.pageSize || patch.pageHeight !== undefined || patch.pageWidth !== undefined) setSizeError(false); onValueChange({ ...v, ...patch }); };
  const close = (o: boolean) => { if (busy) return; onOpenChange(o); };
  const lhLabel = p.letterheadLabel ?? ((o: string) => (o === NO_LETTERHEAD ? t("listPrintNoLetterhead") : o));
  const fmtLabel = p.formatLabel ?? ((o: string) => o);
  const sizes = p.pageSizes ?? PRINT_PAGE_SIZES;
  const forced = !!p.background?.forced;
  const print = () => {
    const page = printPageOf(v);
    if (!isValidPrintPage(page)) { setSizeError(true); return; }
    setSizeError(false);
    p.onPrint(v, page);
  };
  const wide = !!p.preview && !p.status;

  const fields = (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm"><span>{t("listPrintLetterhead")}</span>
        <Select value={v.letterhead} onValueChange={(x) => set({ letterhead: x })}>
          <SelectTrigger aria-label={t("listPrintLetterhead")}><SelectValue /></SelectTrigger>
          <SelectContent>{p.letterheads.map((o) => <SelectItem key={o} value={o}>{lhLabel(o)}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      {p.letterheadNote ? <p className="text-xs text-muted-foreground">{p.letterheadNote}</p> : null}
      <label className="block space-y-1 text-sm"><span>{t("listPrintFormat")}</span>
        <Select value={v.format} onValueChange={(x) => set({ format: x })}>
          <SelectTrigger aria-label={t("listPrintFormat")}><SelectValue /></SelectTrigger>
          <SelectContent>{p.formats.map((o) => <SelectItem key={o} value={o}>{fmtLabel(o)}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      <label className="block space-y-1 text-sm"><span>{t("listPrintPageSize")}</span>
        <Select value={v.pageSize} onValueChange={(x) => set({ pageSize: x })}>
          <SelectTrigger aria-label={t("listPrintPageSize")}><SelectValue /></SelectTrigger>
          <SelectContent>{sizes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      {v.pageSize === "Custom" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm"><span>{t("listPrintPageHeight")}</span>
            <Input type="number" inputMode="decimal" min={0} aria-label={t("listPrintPageHeight")} aria-invalid={sizeError || undefined} value={v.pageHeight} onChange={(e) => set({ pageHeight: e.target.value })} /></label>
          <label className="block space-y-1 text-sm"><span>{t("listPrintPageWidth")}</span>
            <Input type="number" inputMode="decimal" min={0} aria-label={t("listPrintPageWidth")} aria-invalid={sizeError || undefined} value={v.pageWidth} onChange={(e) => set({ pageWidth: e.target.value })} /></label>
        </div>
      )}
      {p.languages && p.languages.length > 0 && (
        <label className="block space-y-1 text-sm"><span>{t("prLanguage")}</span>
          <Select value={v.language ?? p.languages[0].value} onValueChange={(x) => set({ language: x })}>
            <SelectTrigger aria-label={t("prLanguage")}><SelectValue /></SelectTrigger>
            <SelectContent>{p.languages.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      )}
      {p.background && (
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id={BACKGROUND_PRINT_ID} checked={!!v.background} disabled={forced} onCheckedChange={(x) => set({ background: x === true })} aria-label={t("listPrintBackground")} />
          <Label htmlFor={BACKGROUND_PRINT_ID} className="font-normal">{t("listPrintBackground")}</Label>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={cn(wide ? "max-h-[94vh] overflow-y-auto sm:max-w-5xl" : "sm:max-w-lg", p.className)}>
        <DialogHeader>
          <DialogTitle>{p.title ?? t("listPrintTitle")}</DialogTitle>
          <DialogDescription>{p.description}</DialogDescription>
        </DialogHeader>
        {p.status ? p.status : wide ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <section aria-label={t("prSettings")}>{fields}</section>
            <div className="min-w-0">{p.preview}</div>
          </div>
        ) : fields}
        {sizeError && <p role="alert" className="text-sm text-destructive">{t("listPrintSizeZero")}</p>}
        {p.error ? (typeof p.error === "string" ? <p role="alert" className="text-sm text-destructive">{p.error}</p> : p.error) : null}
        {p.note && !p.status ? <p className="text-xs text-muted-foreground">{p.note}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>{p.status ? t("close") : t("cancel")}</Button>
          {!p.status && <Button type="button" onClick={print} disabled={busy} loading={busy}>{p.printLabel ?? t("listBulkPrint")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
