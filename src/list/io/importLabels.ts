/**
 * The strings of the Data Import tool (Desk's `data_import.js` / `import_preview.js` wording) — en / ar — shared by the
 * Core `DataImportDialog` and the Frappe `FrappeDataImport`. `{0}`, `{1}` are filled in order by `fmt`.
 */

/** Every string of the Data Import components. `{0}`, `{1}` are filled in order (Desk's `__("…{0}…", [a])`). */
export interface DataImportLabels {
  title: string; importType: string; insertNew: string; updateExisting: string; submitAfterImport: string; muteEmails: string;
  downloadTemplate: string; importFile: string; chooseAnotherFile: string; fileHint: string; upload: string; uploading: string; loadingPreview: string;
  stepUpload: string; stepPreview: string; stepImport: string; stepResult: string; steps: string;
  preview: string; srNo: string; untitledColumn: string; skipped: string; mappedTo: string; showingFirst: string; noData: string; noPreview: string; imported: string;
  warnings: string; row: string; column: string; info: string;
  mapColumns: string; mapHeading: string; dontImport: string; searchFields: string; noFields: string; saveMapping: string; savingMapping: string; cancel: string;
  startImport: string; retry: string; starting: string; alreadyQueued: string;
  inProgress: string; queued: string; importProgress: string; importingOf: string; updatingOf: string; skippingOf: string; secondsRemaining: string; minuteRemaining: string; minutesRemaining: string; countsSoFar: string;
  stoppedByWarnings: string;
  statusPending: string; statusSuccess: string; statusPartialSuccess: string; statusError: string; statusTimedOut: string;
  resultInserted1: string; resultInserted: string; resultUpdated1: string; resultUpdated: string;
  resultInsertedPartial1: string; resultInsertedPartial: string; resultUpdatedPartial1: string; resultUpdatedPartial: string;
  timedOut: string; errorNoLog: string;
  exportErroredRows: string; exportImportLog: string; importLog: string; rowNumber: string; status: string; message: string; success: string; failure: string;
  importedDoc: string; updatedDoc: string; showTraceback: string; hideTraceback: string; showFailedOnly: string; noFailedLogs: string;
  goToList: string; importAnother: string; close: string; createRefused: string; downloading: string;
  /** The file picker's button and its empty state (p275: replaces the browser's untranslated "Choose File / No file chosen"). */
  chooseFile?: string; noFileChosen?: string;
}

export const DATA_IMPORT_LABELS_EN: DataImportLabels = {
  title: "Data Import", importType: "Import Type", insertNew: "Insert New Records", updateExisting: "Update Existing Records",
  submitAfterImport: "Submit After Import", muteEmails: "Don't Send Emails",
  downloadTemplate: "Download Template", importFile: "Import File", chooseAnotherFile: "Choose another file", fileHint: "CSV, XLS or XLSX", upload: "Upload and Preview", uploading: "Uploading…",
  loadingPreview: "Loading import file...",
  stepUpload: "Upload", stepPreview: "Preview", stepImport: "Import", stepResult: "Result", steps: "Import steps",
  preview: "Preview", srNo: "Sr. No", untitledColumn: "Untitled Column", skipped: "Not imported", mappedTo: "→ {0}",
  showingFirst: "Showing only first {0} rows out of {1}", noData: "No Data", noPreview: "The server returned no preview for this file.", imported: "Imported",
  warnings: "Import File Errors and Warnings", row: "Row {0}", column: "Column {0}", info: "Info",
  mapColumns: "Map Columns", mapHeading: "Map columns from {0} to fields in {1}", dontImport: "Don't Import", searchFields: "Search fields",
  noFields: "No matching field", saveMapping: "Save Mapping", savingMapping: "Saving…", cancel: "Cancel",
  startImport: "Start Import", retry: "Retry", starting: "Starting…", alreadyQueued: "An import of this file is already queued on the server.",
  inProgress: "In Progress", queued: "Queued — waiting for the server to start the import…", importProgress: "Import Progress",
  importingOf: "Importing {0} of {1}", updatingOf: "Updating {0} of {1}", skippingOf: "Skipping {0} of {1}",
  secondsRemaining: "About {0} seconds remaining", minuteRemaining: "About {0} minute remaining", minutesRemaining: "About {0} minutes remaining",
  countsSoFar: "{0} imported, {1} failed, of {2}",
  stoppedByWarnings: "The server did not import anything: the file has the warnings below. Fix the file and upload it again, or map the columns, then start the import.",
  statusPending: "Pending", statusSuccess: "Success", statusPartialSuccess: "Partial Success", statusError: "Error", statusTimedOut: "Timed Out",
  resultInserted1: "Successfully imported 1 record.", resultInserted: "Successfully imported {0} records.",
  resultUpdated1: "Successfully updated 1 record.", resultUpdated: "Successfully updated {0} records.",
  resultInsertedPartial1: "Successfully imported {0} record out of {1}. Click on Export Errored Rows, fix the errors and import again.",
  resultInsertedPartial: "Successfully imported {0} records out of {1}. Click on Export Errored Rows, fix the errors and import again.",
  resultUpdatedPartial1: "Successfully updated {0} record out of {1}. Click on Export Errored Rows, fix the errors and import again.",
  resultUpdatedPartial: "Successfully updated {0} records out of {1}. Click on Export Errored Rows, fix the errors and import again.",
  timedOut: "Import timed out, please re-try.", errorNoLog: "The import failed on the server before any row was logged.",
  exportErroredRows: "Export Errored Rows", exportImportLog: "Export Import Log", importLog: "Import Log", rowNumber: "Row Number", status: "Status",
  message: "Message", success: "Success", failure: "Failure", importedDoc: "Successfully imported {0}", updatedDoc: "Successfully updated {0}",
  showTraceback: "Show Traceback", hideTraceback: "Hide Traceback", showFailedOnly: "Show Only Failed Logs", noFailedLogs: "No failed logs",
  goToList: "Go to {0} List", importAnother: "Import another file", close: "Close",
  createRefused: "The server refused to create the Data Import. In Frappe core only the System Manager role may create Data Import documents.",
  downloading: "Downloading…",
  chooseFile: "Choose File", noFileChosen: "No file chosen",
};

export const DATA_IMPORT_LABELS_AR: DataImportLabels = {
  title: "استيراد البيانات", importType: "نوع الاستيراد", insertNew: "إدراج سجلات جديدة", updateExisting: "تحديث السجلات الموجودة",
  submitAfterImport: "اعتماد بعد الاستيراد", muteEmails: "عدم إرسال رسائل البريد",
  downloadTemplate: "تنزيل القالب", importFile: "ملف الاستيراد", chooseAnotherFile: "اختيار ملف آخر", fileHint: "CSV أو XLS أو XLSX", upload: "رفع ومعاينة", uploading: "جارٍ الرفع…",
  loadingPreview: "جارٍ تحميل ملف الاستيراد...",
  stepUpload: "الرفع", stepPreview: "المعاينة", stepImport: "الاستيراد", stepResult: "النتيجة", steps: "خطوات الاستيراد",
  preview: "المعاينة", srNo: "م", untitledColumn: "عمود بلا عنوان", skipped: "لن يُستورد", mappedTo: "← {0}",
  showingFirst: "عرض أول {0} صفوف فقط من {1}", noData: "لا توجد بيانات", noPreview: "لم يُرجع الخادم معاينة لهذا الملف.", imported: "مستورد",
  warnings: "أخطاء وتحذيرات ملف الاستيراد", row: "الصف {0}", column: "العمود {0}", info: "معلومة",
  mapColumns: "ربط الأعمدة", mapHeading: "ربط أعمدة {0} بحقول {1}", dontImport: "عدم الاستيراد", searchFields: "ابحث في الحقول",
  noFields: "لا يوجد حقل مطابق", saveMapping: "حفظ الربط", savingMapping: "جارٍ الحفظ…", cancel: "إلغاء",
  startImport: "بدء الاستيراد", retry: "إعادة المحاولة", starting: "جارٍ البدء…", alreadyQueued: "يوجد استيراد لهذا الملف في قائمة انتظار الخادم.",
  inProgress: "قيد التنفيذ", queued: "في قائمة الانتظار — بانتظار أن يبدأ الخادم الاستيراد…", importProgress: "تقدم الاستيراد",
  importingOf: "استيراد {0} من {1}", updatingOf: "تحديث {0} من {1}", skippingOf: "تخطي {0} من {1}",
  secondsRemaining: "يتبقى نحو {0} ثانية", minuteRemaining: "يتبقى نحو {0} دقيقة", minutesRemaining: "يتبقى نحو {0} دقائق",
  countsSoFar: "{0} مستورد، {1} فاشل، من {2}",
  stoppedByWarnings: "لم يستورد الخادم شيئًا: في الملف التحذيرات أدناه. أصلح الملف وارفعه مجددًا أو اربط الأعمدة، ثم ابدأ الاستيراد.",
  statusPending: "معلق", statusSuccess: "نجاح", statusPartialSuccess: "نجاح جزئي", statusError: "خطأ", statusTimedOut: "انتهت المهلة",
  resultInserted1: "تم استيراد سجل واحد بنجاح.", resultInserted: "تم استيراد {0} سجلات بنجاح.",
  resultUpdated1: "تم تحديث سجل واحد بنجاح.", resultUpdated: "تم تحديث {0} سجلات بنجاح.",
  resultInsertedPartial1: "تم استيراد {0} سجل من أصل {1} بنجاح. اضغط «تصدير الصفوف الخاطئة»، أصلح الأخطاء ثم استورد مجددًا.",
  resultInsertedPartial: "تم استيراد {0} سجلات من أصل {1} بنجاح. اضغط «تصدير الصفوف الخاطئة»، أصلح الأخطاء ثم استورد مجددًا.",
  resultUpdatedPartial1: "تم تحديث {0} سجل من أصل {1} بنجاح. اضغط «تصدير الصفوف الخاطئة»، أصلح الأخطاء ثم استورد مجددًا.",
  resultUpdatedPartial: "تم تحديث {0} سجلات من أصل {1} بنجاح. اضغط «تصدير الصفوف الخاطئة»، أصلح الأخطاء ثم استورد مجددًا.",
  timedOut: "انتهت مهلة الاستيراد، يرجى إعادة المحاولة.", errorNoLog: "فشل الاستيراد على الخادم قبل تسجيل أي صف.",
  exportErroredRows: "تصدير الصفوف الخاطئة", exportImportLog: "تصدير سجل الاستيراد", importLog: "سجل الاستيراد", rowNumber: "رقم الصف", status: "الحالة",
  message: "الرسالة", success: "نجاح", failure: "فشل", importedDoc: "تم استيراد {0} بنجاح", updatedDoc: "تم تحديث {0} بنجاح",
  showTraceback: "عرض التتبع", hideTraceback: "إخفاء التتبع", showFailedOnly: "عرض السجلات الفاشلة فقط", noFailedLogs: "لا توجد سجلات فاشلة",
  goToList: "الانتقال إلى قائمة {0}", importAnother: "استيراد ملف آخر", close: "إغلاق",
  createRefused: "رفض الخادم إنشاء مستند استيراد البيانات. في نواة Frappe لا يُنشئ مستندات Data Import إلا دور System Manager.",
  downloading: "جارٍ التنزيل…",
  chooseFile: "اختيار ملف", noFileChosen: "لم يُختر أي ملف",
};

/** `__("…{0}…", [a, b])`: positional placeholders. */
export const fmt = (template: string, ...args: (string | number)[]): string => template.replace(/\{(\d+)\}/g, (m, i: string) => (args[Number(i)] !== undefined ? String(args[Number(i)]) : m));

/**
 * Strings only the Core dialog uses (a client-side import: its own file reading, mapping, validation and duplicate
 * check). Optional so a full `DataImportLabels` object stays valid; the defaults are `IMPORT_DIALOG_LABELS_EN / _AR`.
 */
export interface ImportDialogExtraLabels {
  fileSummary: string; readingFile: string; readFailed: string; emptyFile: string;
  notMapped: string; mappedTwice: string; mandatoryNotMapped: string; valueMissing: string; invalidValue: string;
  duplicateOfExisting: string; duplicateInFile: string; duplicateHandling: string; duplicateSkip: string; duplicateImport: string;
  summary: string; summaryReady: string; summaryErrors: string; summaryDuplicates: string;
  runUnavailable: string; nothingToImport: string; fixErrorsFirst: string; resultFailedRows: string;
  valueMissingWhen: string; notFoundForUpdate: string; noIdentityForUpdate: string;
}
export type ImportDialogLabels = DataImportLabels & ImportDialogExtraLabels;

export const IMPORT_DIALOG_LABELS_EN: ImportDialogExtraLabels = {
  fileSummary: "{0}: {1} rows, {2} columns", readingFile: "Reading the file…", readFailed: "The file could not be read: {0}", emptyFile: "The file has no rows below its header.",
  notMapped: "Cannot match column {0} with any field: it will not be imported.", mappedTwice: "Field {0} is mapped to more than one column.",
  mandatoryNotMapped: "Mandatory field {0} is not mapped to any column.", valueMissing: "Value missing for mandatory field {0}", invalidValue: "{0}: {1}",
  duplicateOfExisting: "Duplicate: matches the existing record {0}", duplicateInFile: "Duplicate: same as row {0} of this file",
  duplicateHandling: "Rows that match an existing record", duplicateSkip: "Skip them", duplicateImport: "Import them as new records",
  summary: "Validation", summaryReady: "{0} rows ready to import", summaryErrors: "{0} rows with errors", summaryDuplicates: "{0} duplicate rows",
  runUnavailable: "Import is not available here: {0}", nothingToImport: "No row is ready to import.", fixErrorsFirst: "Rows with errors are not imported.",
  resultFailedRows: "Failed rows",
  valueMissingWhen: "Value missing for {0} (mandatory when {1})", notFoundForUpdate: "No existing record matches {0}: nothing to update",
  noIdentityForUpdate: "The row does not identify an existing record to update",
};
export const IMPORT_DIALOG_LABELS_AR: ImportDialogExtraLabels = {
  fileSummary: "{0}: {1} صف، {2} عمود", readingFile: "جارٍ قراءة الملف…", readFailed: "تعذّرت قراءة الملف: {0}", emptyFile: "لا توجد صفوف في الملف تحت العناوين.",
  notMapped: "تعذّر ربط العمود {0} بأي حقل: لن يُستورد.", mappedTwice: "الحقل {0} مربوط بأكثر من عمود.",
  mandatoryNotMapped: "الحقل الإلزامي {0} غير مربوط بأي عمود.", valueMissing: "قيمة مفقودة للحقل الإلزامي {0}", invalidValue: "{0}: {1}",
  duplicateOfExisting: "مكرر: يطابق السجل الموجود {0}", duplicateInFile: "مكرر: مطابق للصف {0} من هذا الملف",
  duplicateHandling: "الصفوف المطابقة لسجل موجود", duplicateSkip: "تخطيها", duplicateImport: "استيرادها كسجلات جديدة",
  summary: "التحقق", summaryReady: "{0} صف جاهز للاستيراد", summaryErrors: "{0} صف به أخطاء", summaryDuplicates: "{0} صف مكرر",
  runUnavailable: "الاستيراد غير متاح هنا: {0}", nothingToImport: "لا يوجد صف جاهز للاستيراد.", fixErrorsFirst: "الصفوف التي بها أخطاء لا تُستورد.",
  resultFailedRows: "الصفوف الفاشلة",
  valueMissingWhen: "قيمة مفقودة للحقل {0} (إلزامي عندما {1})", notFoundForUpdate: "لا يوجد سجل مطابق لـ {0}: لا شيء للتحديث",
  noIdentityForUpdate: "الصف لا يحدد سجلاً موجوداً لتحديثه",
};

/** Desk's Data Import indicator colours (`data_import_list.js:15-31`): Success green, Error red, the rest orange. */
export function importStatusTone(status: string | undefined): "success" | "destructive" | "warning" {
  return status === "Success" ? "success" : status === "Error" ? "destructive" : "warning";
}
export function importStatusLabel(status: string | undefined, L: DataImportLabels): string {
  switch (status) {
    case "Success": return L.statusSuccess;
    case "Partial Success": return L.statusPartialSuccess;
    case "Error": return L.statusError;
    case "Timed Out": return L.statusTimedOut;
    default: return L.statusPending;
  }
}

/**
 * `show_import_status`'s headline from the counts (`data_import.js:139-171`): insert / update, singular, partial,
 * "Timed Out" hint. `null` without a total.
 */
export function importResultHeadline(o: { status: string; success: number; failed: number; total: number; importType: string }, L: DataImportLabels): string | null {
  if (!o.total) return null;
  const insert = o.importType === "Insert New Records";
  let message: string;
  if (o.failed === 0) message = o.success === 1 ? (insert ? L.resultInserted1 : L.resultUpdated1) : fmt(insert ? L.resultInserted : L.resultUpdated, o.success);
  else message = fmt(o.success === 1 ? (insert ? L.resultInsertedPartial1 : L.resultUpdatedPartial1) : insert ? L.resultInsertedPartial : L.resultUpdatedPartial, o.success, o.total);
  return o.status === "Timed Out" ? `${message} ${L.timedOut}` : message;
}
