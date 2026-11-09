/**
 * P36e print — the Core print presentation (Frappe-free): Desk's print page (`PrintView`) and list "Print Documents"
 * dialog (`PrintDocumentsDialog`) driven by a LOCAL renderer, with BROWSER printing (`composePrintDocument` +
 * `printHtmlDocument`): the preview and the printout are the same composed document; the browser's dialog prints or
 * saves as PDF. No server, no PDF generation. The Frappe hosts (FrappeFormPrint / FrappePrintDialog, server-rendered)
 * are on the P35 record page.
 */
import * as React from "react";
import {
  Button, NO_LETTERHEAD, PrintDocumentsDialog, PrintPreviewFrame, PrintView, composePrintDocument, escapeHtml, isValidPrintPage, printHtmlDocument,
  printPageOf, useLocale, type PrintDocumentsValue,
} from "@ui";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

interface Sample { id: string; name: string; nameAr: string; city: string; cityAr: string; value: number }
const SAMPLES: Sample[] = [
  { id: "LEAD-0001", name: "Nora Haddad", nameAr: "نورة حداد", city: "Riyadh", cityAr: "الرياض", value: 120000 },
  { id: "LEAD-0002", name: "Omar Saleh <script>", nameAr: "عمر صالح", city: "Jeddah", cityAr: "جدة", value: 54000 },
  { id: "LEAD-0003", name: "Lina Farouk", nameAr: "لينا فاروق", city: "Dammam", cityAr: "الدمام", value: 87000 },
];
const FORMATS = ["Standard", "Summary"];
const LETTERHEADS = ["Acme Travel", NO_LETTERHEAD];

/** A tiny local renderer: every value escaped. "Standard" = all fields, "Summary" = the title only. */
function render(s: Sample, format: string, letterhead: string, ar: boolean): string {
  const head = letterhead === NO_LETTERHEAD ? "" : `<div class="lh">${escapeHtml(ar ? "أكمي للسفر" : letterhead)}</div>`;
  const title = `<h1>${escapeHtml(ar ? s.nameAr : s.name)}</h1><p class="id">${escapeHtml(s.id)}</p>`;
  if (format === "Summary") return head + title;
  const rows = [[ar ? "المدينة" : "City", ar ? s.cityAr : s.city], [ar ? "القيمة" : "Value", s.value.toLocaleString(ar ? "ar" : "en")]];
  return head + title + `<table>${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>`;
}
const STYLE = "body{font-family:system-ui,sans-serif;color:#1c1626}.lh{border-bottom:2px solid #512195;color:#512195;font-weight:700;padding-bottom:8px;margin-bottom:12px}h1{font-size:20px;margin:0}.id{color:#777;font-size:12px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #eee;padding:6px;text-align:start;font-size:13px}";

function RecordPrintDemo() {
  const { language } = useLocale();
  const tr = useTr();
  const [format, setFormat] = React.useState("Standard");
  const [letterhead, setLetterhead] = React.useState(LETTERHEADS[0]);
  const [lang, setLang] = React.useState<string>(language);
  const ar = lang === "ar";
  const doc = composePrintDocument({ documents: [render(SAMPLES[0], format, letterhead, ar)], style: STYLE, page: { pageSize: "A4" }, dir: ar ? "rtl" : "ltr", lang, title: SAMPLES[0].id });
  return (
    <PrintView title={SAMPLES[0].id} formats={FORMATS} format={format} onFormatChange={setFormat} letterheads={LETTERHEADS} letterhead={letterhead} onLetterheadChange={setLetterhead}
      languages={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} language={lang} onLanguageChange={setLang}
      onPrint={() => void printHtmlDocument(doc)} onBack={() => {}} backLabel={tr(l("Back to the record", "العودة إلى السجل"))}
      hint={tr(l("Print opens the browser's print dialog (Save as PDF there).", "تفتح الطباعة نافذة الطباعة في المتصفح (حفظ بتنسيق PDF هناك)."))}
      preview={<PrintPreviewFrame title={`Print preview of ${SAMPLES[0].id}`} srcDoc={doc} height="420px" />} />
  );
}

function ListPrintDemo({ count }: { count: number }) {
  const { language } = useLocale();
  const tr = useTr();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<PrintDocumentsValue>({ letterhead: LETTERHEADS[0], format: "Standard", pageSize: "A4", pageHeight: "", pageWidth: "", language });
  const docs = SAMPLES.slice(0, count);
  const page = printPageOf(v);
  const ar = v.language === "ar";
  const doc = isValidPrintPage(page)
    ? composePrintDocument({ documents: docs.map((s) => render(s, v.format, v.letterhead, ar)), style: STYLE, page, dir: ar ? "rtl" : "ltr", lang: v.language, title: "Leads" })
    : null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{tr(l(`Print ${count} selected`, `طباعة ${count} محدد`))}</Button>
      <PrintDocumentsDialog open={open} onOpenChange={setOpen} description={`Lead · ${count}`} letterheads={LETTERHEADS} formats={FORMATS} value={v} onValueChange={setV}
        languages={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]}
        note={tr(l("Print opens the browser's print dialog (Save as PDF there). Nothing is generated on a server, so there is no Background Print.", "تفتح الطباعة نافذة الطباعة في المتصفح. لا يُنشأ شيء على خادم، لذا لا توجد طباعة في الخلفية."))}
        preview={<PrintPreviewFrame title={`Print preview of ${count} documents`} srcDoc={doc} height="52vh" />}
        onPrint={() => { if (doc) void printHtmlDocument(doc); setOpen(false); }} />
    </>
  );
}

export function PrintP36ePage() {
  return (
    <div className="space-y-10" data-testid="print-p36e">
      <Section title={l("Print page (PrintView)", "صفحة الطباعة (PrintView)")}
        description={l("Desk's print page (printing/page/print/print.js) without a server: Print Format, Language, Letter Head (its sidebar order), the Form button, Print. The host renders the document locally; the preview frame shows the exact document the browser prints.",
          "صفحة الطباعة في ديسك دون خادم: تنسيق الطباعة واللغة والترويسة (بترتيب شريطها الجانبي) وزر العودة والطباعة. يعرض المضيف المستند محليًا، وتعرض المعاينة المستند نفسه الذي يطبعه المتصفح.")}>
        <Example title={l("Local renderer · browser print", "عارض محلي · طباعة المتصفح")}><RecordPrintDemo /></Example>
      </Section>
      <Section title={l("Print Documents (PrintDocumentsDialog)", "طباعة المستندات (PrintDocumentsDialog)")}
        description={l("Desk's list dialog (list/bulk_operations.js:47-93): Letter Head, Print Format, Page Size (Custom asks height / width in mm and refuses zero), then Language. Each selected document prints on its own page in the chosen format; the preview draws the chosen paper.",
          "مربع حوار القائمة في ديسك: الترويسة وتنسيق الطباعة وحجم الصفحة (المخصص يطلب الارتفاع والعرض بالمليمتر ويرفض الصفر) ثم اللغة. يُطبع كل مستند محدد في صفحته بالتنسيق المختار، وترسم المعاينة الورق المختار.")}>
        <div className="flex flex-wrap gap-3">
          <Example title={l("One document", "مستند واحد")}><ListPrintDemo count={1} /></Example>
          <Example title={l("Three documents", "ثلاثة مستندات")}><ListPrintDemo count={3} /></Example>
        </div>
      </Section>
    </div>
  );
}
