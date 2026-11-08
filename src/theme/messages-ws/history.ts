/**
 * Chrome strings added by the P36d "history" workstream (en + ar; the ar object must have every en key).
 * Frappe 15.110 sources: public/js/frappe/utils/pretty_date.js:46-76 (relative times), form/templates/timeline_message_box.html
 * (communication cards), form/footer/form_timeline.js:92-116 (document e-mail), version_timeline_content_builder.js:14-24,
 * 354-365 (Version suffixes). Arabic follows frappe/locale/ar.po where it reads naturally.
 */
export const historyEn = {
  // pretty_date.js:46-76 (long form)
  hisJustNow: "just now",
  hisMinuteAgo: "1 minute ago",
  hisMinutesAgo: "{0} minutes ago",
  hisHourAgo: "1 hour ago",
  hisHoursAgo: "{0} hours ago",
  hisYesterday: "yesterday",
  hisDaysAgo: "{0} days ago",
  hisWeekAgo: "1 week ago",
  hisWeeksAgo: "{0} weeks ago",
  hisMonthAgo: "1 month ago",
  hisMonthsAgo: "{0} months ago",
  hisYearAgo: "1 year ago",
  hisYearsAgo: "{0} years ago",
  // timeline_message_box.html
  hisNotificationSentTo: "Notification sent to {0}",
  hisOpenCommunication: "Open Communication",
  hisCopyLink: "Copy Link",
  hisCopied: "Copied to clipboard",
  hisPrivateFile: "Private",
  hisAttachments: "Attachments",
  // form_timeline.js:101
  hisDocumentEmail: "Add to this activity by mailing to {0}",
  hisCopyEmail: "Copy e-mail address",
  // version_timeline_content_builder.js:17, 357, 363, 345-347
  hisVia: "via {0}",
  hisImpersonatedBy: "Impersonated by {0}",
  hisActionTakenBy: "[Action taken by {0}]",
  hisCreatedThisRef: "{0} created this document {1}",
  // error state
  hisLoadFailed: "The history could not be loaded.",
};

export const historyAr: { [K in keyof typeof historyEn]: string } = {
  hisJustNow: "الآن",
  hisMinuteAgo: "قبل دقيقة",
  hisMinutesAgo: "قبل {0} دقائق",
  hisHourAgo: "قبل ساعة",
  hisHoursAgo: "قبل {0} ساعات",
  hisYesterday: "أمس",
  hisDaysAgo: "قبل {0} أيام",
  hisWeekAgo: "قبل أسبوع",
  hisWeeksAgo: "قبل {0} أسابيع",
  hisMonthAgo: "قبل شهر",
  hisMonthsAgo: "قبل {0} أشهر",
  hisYearAgo: "قبل سنة",
  hisYearsAgo: "قبل {0} سنوات",
  hisNotificationSentTo: "تم إرسال الإشعار إلى {0}",
  hisOpenCommunication: "فتح المراسلة",
  hisCopyLink: "نسخ الرابط",
  hisCopied: "تم النسخ إلى الحافظة",
  hisPrivateFile: "خاص",
  hisAttachments: "المرفقات",
  hisDocumentEmail: "أضف إلى هذا النشاط عن طريق إرسال بريد إلكتروني إلى {0}",
  hisCopyEmail: "نسخ عنوان البريد الإلكتروني",
  hisVia: "عبر {0}",
  hisImpersonatedBy: "بانتحال هوية من {0}",
  hisActionTakenBy: "[الإجراء نفّذه {0}]",
  hisCreatedThisRef: "{0} أنشأ هذا المستند {1}",
  hisLoadFailed: "تعذّر تحميل السجل.",
};
