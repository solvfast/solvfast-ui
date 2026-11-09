/**
 * PrintPreviewFrame — server-rendered print HTML shown in a SANDBOXED iframe (Desk renders `get_html_and_style` into
 * its print page, print.js:681-703). The frame has `sandbox=""`: no scripts, no same-origin access, no forms, no
 * top navigation — the HTML is the server's (Jinja print format) and is never executed or merged into the page.
 * Frappe-free: the caller passes `html` / `style` and the loading / error states.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../primitives/button";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

export interface PrintPreviewFrameProps {
  /** The rendered body HTML (null / empty → "No Preview Available"). */
  html?: string | null;
  /** The print CSS. */
  style?: string | null;
  loading?: boolean;
  /** An error to show instead of the preview (text or a node, e.g. FrappeErrorState). */
  error?: React.ReactNode;
  onRetry?: () => void;
  /** Accessible name of the frame. */
  title: string;
  /** Direction of the printed document (Desk sets `dir` on the print wrapper from the print language). */
  dir?: "ltr" | "rtl";
  className?: string;
  /** Height of the frame (CSS). Default "70vh". */
  height?: string;
  /** P36e: a complete, already composed document (`composePrintDocument`) shown instead of `html` / `style` — the SAME
   *  string the browser prints (`printHtmlDocument`), so preview and printout cannot diverge. Still sandboxed. */
  srcDoc?: string | null;
}

const CLOSE_STYLE = /<\/style/gi;
/** The srcdoc of the frame (pure; exported for tests). `</style` in the CSS is neutralised so it cannot end the block. */
export function printSrcDoc(html: string, style = "", dir: "ltr" | "rtl" = "ltr"): string {
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><style>${style.replace(CLOSE_STYLE, "<\\/style")}</style></head><body>${html}</body></html>`;
}

export function PrintPreviewFrame({ html, style, loading, error, onRetry, title, dir = "ltr", className, height = "70vh", srcDoc }: PrintPreviewFrameProps) {
  const { t } = useLocale();
  const box = cn("relative w-full overflow-hidden rounded-xl border border-border bg-white", className);
  if (error) {
    return (
      <div className={cn("space-y-2 rounded-xl border border-border p-4", className)}>
        {typeof error === "string" ? <p role="alert" className="text-sm text-destructive">{error}</p> : error}
        {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}>{t("r35Retry")}</Button>}
      </div>
    );
  }
  if (loading) {
    return (
      <div className={cn(box, "flex items-center justify-center bg-card")} style={{ height }} role="status" aria-live="polite">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <span className="ms-2 text-sm text-muted-foreground">{t("r35PreviewLoading")}</span>
      </div>
    );
  }
  if (!html && !srcDoc) {
    return <div className={cn(box, "flex items-center justify-center bg-card text-sm text-muted-foreground")} style={{ height }}>{t("r35PreviewEmpty")}</div>;
  }
  return (
    <div className={box} style={{ height }}>
      <iframe title={title} sandbox="" referrerPolicy="no-referrer" srcDoc={srcDoc || printSrcDoc(html ?? "", style ?? "", dir)} className="size-full border-0" />
    </div>
  );
}
