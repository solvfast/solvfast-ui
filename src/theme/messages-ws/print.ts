/**
 * Chrome strings added by the P36e "print" workstream: the Core print view / Print Documents dialogs and browser printing
 * (en + ar; the ar object has every en key). Desk sources: printing/page/print/print.js (Language, :103-112),
 * list/bulk_operations.js (Print Documents). Existing print keys (listPrint*, r35*) are reused, not duplicated.
 */
export const printEn = {
  prLanguage: "Language",
  prBrowserPrintNote: "Print opens your browser's print dialog. To get a PDF, choose “Save as PDF” there.",
  prBackTo: "Back to {0}",
  prPrintFailed: "The browser could not open its print dialog:",
  prPreviewDocs: "Print preview of {0} documents",
  prSettings: "Print settings",
};
export const printAr: { [K in keyof typeof printEn]: string } = {
  prLanguage: "اللغة",
  prBrowserPrintNote: "تفتح الطباعة نافذة الطباعة في المتصفح. للحصول على ملف PDF اختر «حفظ بتنسيق PDF» هناك.",
  prBackTo: "العودة إلى {0}",
  prPrintFailed: "تعذّر على المتصفح فتح نافذة الطباعة:",
  prPreviewDocs: "معاينة طباعة {0} مستند",
  prSettings: "إعدادات الطباعة",
};
