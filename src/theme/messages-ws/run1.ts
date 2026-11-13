/** Chrome strings added in Run 1 (P1 / P2 closures; en + ar — the ar object must have every en key). */
export const run1En = {
  // C-24 / C-25 date and date-time fields
  dtToday: "Today",
  dtNow: "Now",
  dtClear: "Clear",
  dtTypeDate: "Type a date",
  dtInvalidDate: "Not a valid date",
  // E-19 report export dialog (Desk report_utils.js:173-241 wording)
  rxTitle: "Export Report: {0}", rxFileFormat: "File Format", rxBackground: "Export in Background", rxCsvSettings: "Settings",
  rxCsvDelimiter: "CSV Delimiter", rxCsvQuoting: "CSV Quoting", rxQuotingMinimal: "Minimal", rxQuotingAll: "All",
  rxQuotingNonNumeric: "Non-numeric", rxQuotingNone: "None", rxRows: "Rows", rxSelectedRows: "Selected rows ({0})",
  rxAllRows: "All matching rows", rxExportAllRows: "Export all {0} rows?", rxExportAllMatching: "Export all matching rows?",
  rxTranslateValues: "Translate values", rxDownload: "Download", rxDownloading: "Downloading…", rxCancel: "Cancel", rxClose: "Close",
  // A-09 notification panel
  notificationsUnread: "Notifications, {n} unread", ntfMarkRead: "Mark as read", ntfLoading: "Loading notifications…",
  // A-27 / A-23 navigation landmarks
  navMain: "Main navigation",
  // D-62 lifecycle stepper (screen-reader cues and the list's name)
  lcSteps: "Lifecycle", lcStepDone: "Completed", lcStepNotReached: "Not reached",
  // D-41 Communication delivery statuses (Communication.delivery_status options) and media
  commStatusSent: "Sent", commStatusBounced: "Bounced", commStatusOpened: "Opened", commStatusMarkedAsSpam: "Marked As Spam",
  commStatusRejected: "Rejected", commStatusDelayed: "Delayed", commStatusSoftBounced: "Soft-Bounced", commStatusClicked: "Clicked",
  commStatusRecipientUnsubscribed: "Recipient Unsubscribed", commStatusError: "Error", commStatusExpired: "Expired",
  commStatusSending: "Sending", commStatusRead: "Read", commStatusScheduled: "Scheduled",
  // A-28 skip link
  skipToContent: "Skip to main content",
  // B-26 sort direction
  sortAscending: "Ascending", sortDescending: "Descending", sortToggleDirection: "Sort direction: {dir}", sortIndex: "Index",
  // A-33 number cards (Desk number_card_widget.js: "NA", loading, error)
  statNotAvailable: "N/A", statLoading: "Loading…", statError: "Could not load the value",
  // C-67 / A-42 title rename
  r35Title: "Title", titleEditHint: "Edit the title", titleSaveFailed: "Could not save the title",
  // E-14 totals row
  listTotalsRow: "Total", listShowTotals: "Show totals row",
  // I1 lifecycle diagram (the CRM's phase words)
  lcPhaseOpen: "Open", lcPhaseOnHold: "On Hold", lcPhaseClosed: "Closed",
};
export const run1Ar: { [K in keyof typeof run1En]: string } = {
  dtToday: "اليوم",
  dtNow: "الآن",
  dtClear: "مسح",
  dtTypeDate: "اكتب التاريخ",
  dtInvalidDate: "تاريخ غير صالح",
  rxTitle: "تصدير التقرير: {0}", rxFileFormat: "صيغة الملف", rxBackground: "التصدير في الخلفية", rxCsvSettings: "الإعدادات",
  rxCsvDelimiter: "فاصل CSV", rxCsvQuoting: "علامات الاقتباس في CSV", rxQuotingMinimal: "الحد الأدنى", rxQuotingAll: "الكل",
  rxQuotingNonNumeric: "غير الرقمية", rxQuotingNone: "بدون", rxRows: "الصفوف", rxSelectedRows: "الصفوف المحددة ({0})",
  rxAllRows: "كل الصفوف المطابقة", rxExportAllRows: "تصدير كل الصفوف ({0})؟", rxExportAllMatching: "تصدير كل الصفوف المطابقة؟",
  rxTranslateValues: "ترجمة القيم", rxDownload: "تنزيل", rxDownloading: "جارٍ التنزيل…", rxCancel: "إلغاء", rxClose: "إغلاق",
  notificationsUnread: "الإشعارات، {n} غير مقروءة", ntfMarkRead: "تعليم كمقروء", ntfLoading: "جارٍ تحميل الإشعارات…",
  navMain: "التنقل الرئيسي",
  lcSteps: "دورة الحياة", lcStepDone: "مكتملة", lcStepNotReached: "لم تُبلغ بعد",
  commStatusSent: "مُرسلة", commStatusBounced: "مرتدّة", commStatusOpened: "مفتوحة", commStatusMarkedAsSpam: "مُعلَّمة كرسالة مزعجة",
  commStatusRejected: "مرفوضة", commStatusDelayed: "متأخرة", commStatusSoftBounced: "مرتدّة مؤقتًا", commStatusClicked: "تم النقر",
  commStatusRecipientUnsubscribed: "ألغى المستلم الاشتراك", commStatusError: "خطأ", commStatusExpired: "منتهية",
  commStatusSending: "جارٍ الإرسال", commStatusRead: "مقروءة", commStatusScheduled: "مجدولة",
  skipToContent: "انتقل إلى المحتوى الرئيسي",
  sortAscending: "تصاعدي", sortDescending: "تنازلي", sortToggleDirection: "اتجاه الترتيب: {dir}", sortIndex: "الترتيب",
  statNotAvailable: "غير متاح", statLoading: "جارٍ التحميل…", statError: "تعذّر تحميل القيمة",
  r35Title: "العنوان", titleEditHint: "تعديل العنوان", titleSaveFailed: "تعذّر حفظ العنوان",
  listTotalsRow: "الإجمالي", listShowTotals: "إظهار صف الإجماليات",
  lcPhaseOpen: "مفتوح", lcPhaseOnHold: "معلّق", lcPhaseClosed: "مغلق",
};
