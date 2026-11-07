/** Chrome strings added by the P35 "form" workstream (en + ar; the ar object must have every en key). */
export const formEn = {
  /** form.js add_web_link default label. */
  formSeeOnWebsite: "See on Website",
  /** Banner line for a fieldtype the form has no control for (the value is shown read-only). */
  formUnsupportedFieldtype: "{field}: the field type \"{type}\" has no control here; its value is shown read-only.",
  /** Desk undo_manager alerts. */
  formNothingToUndo: "Nothing left to undo",
  formNothingToRedo: "Nothing left to redo",
  formUndo: "Undo",
  formRedo: "Redo",
  /** Leaving a form with unsaved edits (useUnsavedChangesBlocker default prompt). */
  formLeaveUnsaved: "You have unsaved changes. Leave this page and lose them?",
  /** Quick Entry (quick_entry.js render_edit_in_full_page_link). */
  formEditFullForm: "Edit Full Form",
  /** Custom button group default (Desk "Create" dropdown, toolbar.js make_group). */
  formCreateGroup: "Create",
};
export const formAr: { [K in keyof typeof formEn]: string } = {
  formSeeOnWebsite: "عرض على الموقع",
  formUnsupportedFieldtype: "{field}: لا يوجد عنصر تحكم لنوع الحقل \"{type}\" هنا؛ تُعرض قيمته للقراءة فقط.",
  formNothingToUndo: "لا يوجد ما يمكن التراجع عنه",
  formNothingToRedo: "لا يوجد ما يمكن إعادته",
  formUndo: "تراجع",
  formRedo: "إعادة",
  formLeaveUnsaved: "لديك تغييرات غير محفوظة. هل تريد مغادرة هذه الصفحة وفقدانها؟",
  formEditFullForm: "تحرير النموذج الكامل",
  formCreateGroup: "إنشاء",
};
