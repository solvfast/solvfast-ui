/**
 * FrappeFormPrint — Desk's print page for ONE document, as a dialog (printing/page/print/print.js): Print Format
 * (`printFormatOptions`: "Standard", the DocType's formats, its default first — list/print.ts), Letter Head
 * (`letterheadOptions`: the default first, "No Letterhead"), the server-rendered preview (`FrappePrintPreview`,
 * `get_html_and_style`, sandboxed iframe), Refresh, "Full Page" / "Print" (`/printview`, new tab) and "PDF"
 * (`download_pdf`: a link to the server URL like Desk, or — `pdf="download"` — a POST through `api.download` saved
 * with `saveFile`, for hosts whose session does not travel with a plain link).
 * Guards, before any request: a new document ("Save the document before printing"), Print Settings' draft /
 * cancelled rule (toolbar.js:345-355), and `canPrint === false`. A dirty form shows Desk's warning (form.js:1229-1237).
 * The server authorises and renders everything; the preview of a dirty form shows the local values (Desk sends the
 * whole document, print.js:686-694).
 * P36e: the presentation is Core `PrintViewDialog` / `PrintView` (`variant="page"` renders Desk's print page in place,
 * with `onBack` as Desk's "Form" button); this component keeps the server integration.
 */
import * as React from "react";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../primitives/button";
import { fmt } from "../../record/format";
import { PrintView, PrintViewDialog, type PrintViewProps } from "../../record/PrintView";
import { useLocale } from "../../theme/ThemeProvider";
import { frappeKeys, type DocTypeMeta, type FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { saveFile } from "../list/export";
import { NO_LETTERHEAD, letterheadOptions, printFormatOptions, type PrintSettingsInput } from "../list/print";
import { printAllowedForStatus } from "./formMenu";
import { DOWNLOAD_PDF_METHOD, downloadPdfArgs, downloadPdfUrl, printViewUrl } from "./formPrint";
import { FrappePrintPreview } from "./FrappePrintPreview";

export interface FrappeFormPrintProps {
  doc: FrappeDoc;
  /** The DocType's getdoctype meta (`__print_formats`, `default_print_format`, `is_submittable`). */
  meta: DocTypeMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Print Settings from the host's boot (draft / cancelled rule, raw printing). */
  settings?: PrintSettingsInput;
  /** The form has unsaved changes (Desk's warning). */
  dirty?: boolean;
  /** The user's print right (`usePermissions().can("print")`); false → refused before any request. */
  canPrint?: boolean;
  /** Site origin for the Full Page / PDF links. Default "" (same origin). */
  baseUrl?: string;
  /** "link" (default, Desk) or "download" (POST through `api.download`). */
  pdf?: "link" | "download";
  /** Direction of the printed document in the preview. */
  dir?: "ltr" | "rtl";
  /** P36e: "dialog" (default) or "page" — Desk's print page in place (`open` still gates it). */
  variant?: "dialog" | "page";
  /** Page variant: Desk's "Form" button (back to the document). */
  onBack?: () => void;
  backLabel?: React.ReactNode;
}

export function FrappeFormPrint({ doc, meta, open, onOpenChange, settings, dirty, canPrint, baseUrl = "", pdf = "link", dir, variant = "dialog", onBack, backLabel }: FrappeFormPrintProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const qc = useQueryClient();
  const formats = React.useMemo(() => printFormatOptions(meta, settings), [meta, settings]);
  const [format, setFormat] = React.useState(formats[0]);
  const [letterheads, setLetterheads] = React.useState<string[]>([NO_LETTERHEAD]);
  const [letterhead, setLetterhead] = React.useState(NO_LETTERHEAD);
  const [letterheadError, setLetterheadError] = React.useState("");
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<unknown>(null);
  const isNew = !!doc.__islocal;
  const statusOk = printAllowedForStatus(meta, doc, settings);
  const allowed = !isNew && statusOk && canPrint !== false;

  React.useEffect(() => {
    if (!open || !allowed) return;
    setFormat(formats[0]); setPdfError(null); setLetterheadError("");
    let live = true;
    letterheadOptions(api).then((o) => { if (live) { setLetterheads(o); setLetterhead(o[0]); } })
      .catch((e: unknown) => { if (live) { setLetterheads([NO_LETTERHEAD]); setLetterhead(NO_LETTERHEAD); setLetterheadError(e instanceof Error ? e.message : String(e)); } });
    return () => { live = false; };
  }, [open, allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const choice = { format, letterhead };
  const refresh = () => void qc.invalidateQueries({ queryKey: [...frappeKeys.all, "print-preview", doc.doctype, doc.name] });
  const downloadPdf = async () => {
    setPdfError(null); setPdfBusy(true);
    try { saveFile(await api.download(DOWNLOAD_PDF_METHOD, downloadPdfArgs(doc.doctype, doc.name, choice))); }
    catch (e) { setPdfError(e); }
    finally { setPdfBusy(false); }
  };
  const reason = isNew ? t("r35PrintSaveFirst") : !statusOk ? t("r35PrintDraftCancelled") : canPrint === false ? t("r35PrintNoPermission") : "";
  const title = fmt(t("r35PrintTitle"), `${doc.doctype} ${doc.name}`);
  const view: PrintViewProps = {
    title, formats, format, onFormatChange: setFormat, letterheads, letterhead, onLetterheadChange: setLetterhead,
    letterheadNote: letterheadError ? <>{t("r35LetterheadsFailed")} {letterheadError}</> : undefined,
    printHref: printViewUrl(doc.doctype, doc.name, choice, baseUrl, true),
    actions: (
      <>
        <Button type="button" size="sm" variant="outline" onClick={refresh}><RefreshCw aria-hidden />{t("r35Refresh")}</Button>
        <Button asChild size="sm" variant="outline">
          <a href={printViewUrl(doc.doctype, doc.name, choice, baseUrl)} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />{t("r35FullPage")}</a>
        </Button>
        {pdf === "download"
          ? <Button type="button" size="sm" variant="outline" onClick={() => void downloadPdf()} loading={pdfBusy}><Download aria-hidden />{t("r35Pdf")}</Button>
          : <Button asChild size="sm" variant="outline"><a href={downloadPdfUrl(doc.doctype, doc.name, choice, baseUrl)} target="_blank" rel="noopener noreferrer" data-pdf-link><Download aria-hidden />{t("r35Pdf")}</a></Button>}
      </>
    ),
    notice: dirty ? <p role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">{t("r35PrintDirty")}</p> : undefined,
    blocked: reason || undefined,
    error: pdfError ? <FrappeErrorState error={pdfError} compact /> : undefined,
    preview: open ? <FrappePrintPreview doc={doc} format={format} letterhead={letterhead} dir={dir} height="60vh" /> : undefined,
    onBack, backLabel,
  };
  if (variant === "page") return open ? <PrintView {...view} /> : null;
  return <PrintViewDialog open={open} onOpenChange={onOpenChange} {...view} />;
}
