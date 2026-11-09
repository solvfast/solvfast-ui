/**
 * Chrome strings added by the P36e "submit" workstream (en + ar; the ar object has every en key): Frappe's docstatus
 * messages for hosts that apply the rules themselves (`src/record/docstatus.ts`). English = Frappe 15.110's server /
 * Desk text; Arabic = Frappe's own translation (frappe/locale/ar.po) where it reads correctly, otherwise reworded (noted).
 * Draft / Submitted / Cancelled / Amend / Missing Fields reuse the existing form keys (formDraft, formAmend, …).
 */
export const submitEn = {
  // document.py:880-915 check_docstatus_transition
  subCannotDraftToCancelled: "Cannot change docstatus from 0 (Draft) to 2 (Cancelled)",
  subCannotSubmittedToDraft: "Cannot change docstatus from 1 (Submitted) to 0 (Draft)",
  subCannotEditCancelled: "Cannot edit cancelled document",
  // workflow.py:145-146 apply_workflow
  subIllegalDocStatus: "Illegal Document Status for {0}",
  subNotValidWorkflowAction: "Not a valid Workflow Action",
  // workflow/doctype/workflow/workflow.py:84-109 validate_docstatus
  subWfCancelledRow: "Cannot change state of Cancelled Document. Transition row {0}",
  subWfSubmittedToDraftRow: "Submitted Document cannot be converted back to draft. Transition row {0}",
  subWfCancelBeforeSubmitRow: "Cannot cancel before submitting. See Transition {0}",
  // base_document.py:758 / 1077-1085
  subValueMissing: "Error: Value missing for {0}: {1}",
  subNotAllowedAfterSubmit: "Not allowed to change {0} after submission from {1} to {2}",
  subCannotUpdateAfterSubmit: "Cannot Update After Submit",
  // delete_doc.py:254-262 (the help link around "Cancel" is dropped)
  subCannotDeleteSubmitted: "{0} {1}: Submitted Record cannot be deleted. You must Cancel it first.",
  // delete_doc.py:432-445 raise_link_exists_exception (the trailing row part {4} is dropped)
  subLinkExists: "Cannot delete or cancel because {0} {1} is linked with {2} {3}",
  // form.js:1025 (Frappe's spelling) / document.py:440-444
  subAlreadyAmended: "This document is already amended, you cannot ammend it again",
  subAmendNotCancelled: "{0} cannot be amended because it is not cancelled. Please cancel the document before creating an amendment.",
  // list_view.js:1108-1112 — the indicator pill's title
  subDocDraft: "Document is in draft state",
  subDocSubmitted: "Document has been submitted",
  subDocCancelled: "Document has been cancelled",
  // meta.js:199 / model.js:137
  subDocumentStatus: "Document Status",
  subAmendedFrom: "Amended From",
  // workflow.py:300-328 print_workflow_log
  subWorkflowStatus: "Workflow Status",
  subFailedTransactions: "Failed Transactions",
  subSuccessfulTransactions: "Successful Transactions",
};
export const submitAr: { [K in keyof typeof submitEn]: string } = {
  subCannotDraftToCancelled: "لا يمكن تغيير حالة المستند من 0 (مسودة) إلى 2 (ملغى)",
  subCannotSubmittedToDraft: "لا يمكن تغيير حالة المستند من 1 (تم الإرسال) إلى 0 (مسودة)",
  subCannotEditCancelled: "لا يمكنك التعديل على وثيقة ملغية",
  // ar.po: "حالة المستند غير القانوني لـ {0}" (ungrammatical) — reworded
  subIllegalDocStatus: "حالة المستند غير مسموح بها لـ {0}",
  subNotValidWorkflowAction: "ليس إجراء سير عمل صالح",
  subWfCancelledRow: "لا يمكن تغيير حالة المستند الملغى. صف الانتقال {0}",
  subWfSubmittedToDraftRow: "لا يمكن إعادة المستند المعتمد إلى مسودة. صف الانتقال {0}",
  subWfCancelBeforeSubmitRow: "لا يمكن الإلغاء قبل الاعتماد. راجع الانتقال {0}",
  subValueMissing: "خطأ: قيمة مفقودة ل {0}: {1}",
  subNotAllowedAfterSubmit: "غير مسموح بتغيير {0} بعد الإرسال من {1} إلى {2}",
  subCannotUpdateAfterSubmit: "لا يمكن التحديث بعد الإرسال",
  subCannotDeleteSubmitted: "{0} {1}: لا يمكن حذف السجل المقدم. يجب عليك إلغاؤه أولاً.",
  subLinkExists: "لا يمكن حذف أو إلغاء لأن {0} {1} مرتبط مع {2} {3}",
  subAlreadyAmended: "تم تعديل هذا المستند بالفعل ، ولا يمكنك تعديله مرة أخرى",
  subAmendNotCancelled: "لا يمكن تعديل {0} لأنه غير ملغى. ألغِ المستند قبل إنشاء تعديل.",
  subDocDraft: "المستند في حالة مسودة",
  subDocSubmitted: "تم تقديم المستند",
  subDocCancelled: "تم إلغاء المستند",
  subDocumentStatus: "حالة المستند",
  subAmendedFrom: "معدل من",
  subWorkflowStatus: "حالة سير العمل",
  subFailedTransactions: "المعاملات الفاشلة",
  subSuccessfulTransactions: "المعاملات الناجحة",
};
