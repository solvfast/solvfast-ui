/**
 * PrintView — the presentation of Desk's print page for ONE document (`printing/page/print/print.js`), Core and
 * Frappe-free:
 *  - title (the document, print.js:61) and a way back to the form (the "Form" button, :77-86 → `onBack`);
 *  - the toolbar: the host's extra actions (Desk: Full Page, PDF, Refresh, :67-75 — `actions`) and the primary "Print"
 *    (:65) as a button (`onPrint`) or a link (`printHref`, e.g. Frappe's `/printview?…&trigger_print=1`);
 *  - the settings Desk shows in its sidebar, in its order: Print Format (:91-101), Language (optional, :103-112),
 *    Letter Head (:125-135);
 *  - `notice` (e.g. the unsaved-changes warning), `blocked` (a reason that replaces everything, e.g. "Save the
 *    document before printing"), and the `preview` (e.g. `PrintPreviewFrame`).
 * Rendered in place (`PrintView`, a page section) or in a dialog (`PrintViewDialog`). Hosts: `FrappeFormPrint` (the
 * server renders and prints) and local / mock apps (browser printing).
 */
import * as React from "react";
import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { Button } from "../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { NO_LETTERHEAD } from "./printDocument";
import type { PrintOption } from "./PrintDocumentsDialog";

export interface PrintViewProps {
  /** Heading of the page (Desk: the document name). In the dialog it is the dialog title. */
  title: React.ReactNode;
  formats: string[];
  format: string;
  onFormatChange: (format: string) => void;
  formatLabel?: (option: string) => string;
  letterheads: string[];
  letterhead: string;
  onLetterheadChange: (letterhead: string) => void;
  /** Default: "No Letterhead" translated, others as named. */
  letterheadLabel?: (option: string) => string;
  /** A note under the selectors (e.g. "Letter heads could not be loaded: …"). */
  letterheadNote?: React.ReactNode;
  /** Optional Language selector (Desk's `_lang`). */
  languages?: PrintOption[];
  language?: string;
  onLanguageChange?: (language: string) => void;
  /** Primary Print: a button… */
  onPrint?: () => void;
  /** …or a link (opens in a new tab). */
  printHref?: string;
  printBusy?: boolean;
  /** Extra toolbar actions, before Print. */
  actions?: React.ReactNode;
  /** Back to the document (page variant). */
  onBack?: () => void;
  backLabel?: React.ReactNode;
  notice?: React.ReactNode;
  /** A reason printing is refused; replaces the selectors and the preview (shown as role="alert"). */
  blocked?: React.ReactNode;
  /** An error of the last action (node or text). */
  error?: React.ReactNode;
  preview?: React.ReactNode;
  /** A small hint under the toolbar (e.g. how browser printing works). */
  hint?: React.ReactNode;
  className?: string;
}

function Selectors(p: PrintViewProps) {
  const { t } = useLocale();
  const lhLabel = p.letterheadLabel ?? ((o: string) => (o === NO_LETTERHEAD ? t("r35NoLetterhead") : o));
  const fmtLabel = p.formatLabel ?? ((o: string) => o);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm"><span className="block">{t("r35PrintFormat")}</span>
        <Select value={p.format} onValueChange={p.onFormatChange}>
          <SelectTrigger className="w-full min-w-44 sm:w-52" aria-label={t("r35PrintFormat")}><SelectValue /></SelectTrigger>
          <SelectContent>{p.formats.map((f) => <SelectItem key={f} value={f}>{fmtLabel(f)}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      {p.languages && p.languages.length > 0 && p.onLanguageChange && (
        <label className="space-y-1 text-sm"><span className="block">{t("prLanguage")}</span>
          <Select value={p.language ?? p.languages[0].value} onValueChange={p.onLanguageChange}>
            <SelectTrigger className="w-full min-w-36 sm:w-40" aria-label={t("prLanguage")}><SelectValue /></SelectTrigger>
            <SelectContent>{p.languages.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      )}
      <label className="space-y-1 text-sm"><span className="block">{t("r35Letterhead")}</span>
        <Select value={p.letterhead} onValueChange={p.onLetterheadChange}>
          <SelectTrigger className="w-full min-w-44 sm:w-52" aria-label={t("r35Letterhead")}><SelectValue /></SelectTrigger>
          <SelectContent>{p.letterheads.map((o) => <SelectItem key={o} value={o}>{lhLabel(o)}</SelectItem>)}</SelectContent>
        </Select>
      </label>
    </div>
  );
}

function Toolbar(p: PrintViewProps) {
  const { t } = useLocale();
  if (p.blocked) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {p.actions}
      {p.printHref
        ? <Button asChild size="sm"><a href={p.printHref} target="_blank" rel="noopener noreferrer"><Printer aria-hidden />{t("r35Print")}</a></Button>
        : p.onPrint ? <Button type="button" size="sm" onClick={p.onPrint} loading={p.printBusy}><Printer aria-hidden />{t("r35Print")}</Button> : null}
    </div>
  );
}

function Body(p: PrintViewProps) {
  if (p.blocked) return typeof p.blocked === "string" ? <p role="alert" className="text-sm text-destructive">{p.blocked}</p> : <>{p.blocked}</>;
  return (
    <div className="space-y-3">
      {p.notice}
      <Selectors {...p} />
      {p.letterheadNote ? <p className="text-xs text-muted-foreground">{p.letterheadNote}</p> : null}
      {p.hint ? <p className="text-xs text-muted-foreground">{p.hint}</p> : null}
      {p.error ? (typeof p.error === "string" ? <p role="alert" className="text-sm text-destructive">{p.error}</p> : p.error) : null}
      {p.preview}
    </div>
  );
}

/** Desk's print page in place (a page section with its own heading and the way back). */
export function PrintView(p: PrintViewProps) {
  const { isRTL } = useLocale();
  const Back = isRTL ? ArrowRight : ArrowLeft;
  return (
    <section className={cn("space-y-4", p.className)} aria-label={typeof p.title === "string" ? p.title : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {p.onBack && (
            <Button type="button" variant="ghost" size="sm" onClick={p.onBack}><Back aria-hidden />{p.backLabel}</Button>
          )}
          <h1 className="truncate text-lg font-semibold">{p.title}</h1>
        </div>
        <Toolbar {...p} />
      </div>
      <Body {...p} />
    </section>
  );
}

export interface PrintViewDialogProps extends PrintViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Desk's print page as a dialog (the form stays behind it). */
export function PrintViewDialog({ open, onOpenChange, ...p }: PrintViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto sm:max-w-4xl", p.className)}>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription className="sr-only">{p.title}</DialogDescription>
        </DialogHeader>
        {p.blocked ? <Body {...p} /> : (
          <div className="space-y-3">
            {p.notice}
            <div className="flex flex-wrap items-end gap-3">
              <Selectors {...p} />
              <div className="ms-auto"><Toolbar {...p} /></div>
            </div>
            {p.letterheadNote ? <p className="text-xs text-muted-foreground">{p.letterheadNote}</p> : null}
            {p.hint ? <p className="text-xs text-muted-foreground">{p.hint}</p> : null}
            {p.error ? (typeof p.error === "string" ? <p role="alert" className="text-sm text-destructive">{p.error}</p> : p.error) : null}
            {p.preview}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
