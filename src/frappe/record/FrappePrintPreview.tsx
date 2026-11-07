/**
 * FrappePrintPreview — the server's print HTML of one document (`frappe.www.printview.get_html_and_style`, see
 * formPrint.ts) in the Core sandboxed `PrintPreviewFrame`. Re-requested when the document, format or letterhead
 * changes, or on `refreshKey`. A refusal (no read, draft / cancelled not allowed by Print Settings, missing format) is
 * shown as `FrappeErrorState` with Retry.
 */
import { useQuery } from "@tanstack/react-query";
import { PrintPreviewFrame } from "../../record/PrintPreviewFrame";
import { fmt } from "../../record/format";
import { useLocale } from "../../theme/ThemeProvider";
import { frappeKeys, type FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { PRINT_PREVIEW_METHOD, parsePrintPreview, printPreviewArgs, type FormPrintChoice } from "./formPrint";

export interface FrappePrintPreviewProps extends FormPrintChoice {
  doc: FrappeDoc;
  /** Direction of the printed document. */
  dir?: "ltr" | "rtl";
  height?: string;
  className?: string;
}

export function FrappePrintPreview({ doc, format, letterhead, dir, height, className }: FrappePrintPreviewProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const q = useQuery({
    queryKey: [...frappeKeys.all, "print-preview", doc.doctype, doc.name, String(doc.modified ?? ""), format, letterhead, JSON.stringify(doc)],
    queryFn: async () => parsePrintPreview(await api.call(PRINT_PREVIEW_METHOD, printPreviewArgs(doc, { format, letterhead }))),
    retry: false,
    staleTime: 0,
  });
  return (
    <PrintPreviewFrame
      title={fmt(t("r35PreviewFrame"), `${doc.doctype} ${doc.name}`)}
      html={q.data?.html} style={q.data?.style} loading={q.isLoading}
      error={q.error ? <FrappeErrorState error={q.error} compact /> : undefined}
      onRetry={() => void q.refetch()} dir={dir} height={height} className={className}
    />
  );
}
