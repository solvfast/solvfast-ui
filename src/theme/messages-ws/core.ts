/** Chrome strings added by the P35 "core" workstream (en + ar; the ar object must have every en key). */
export const coreEn = {
  // LifecycleBar (G7): screen-reader suffix of a skipped / failed state
  coreStepSkipped: "Skipped",
  coreStepFailed: "Failed",
  // Timeline (G13): name of a change entry's expand toggle when the summary is itself selectable
  coreShowChanges: "show changes",
  // FileDropzone (G14)
  coreFileDropPrompt: "Drag files here or click to browse",
  coreFileDropPromptSingle: "Drag a file here or click to browse",
  coreFileDropActive: "Drop to add",
  coreFileAccepted: "Accepted: {types}",
  coreFileMaxSize: "Up to {size} each",
  coreFileRejectType: "“{name}” is not an accepted file type.",
  coreFileRejectSize: "“{name}” is larger than {size}.",
  coreFileRejectCount: "“{name}” was not added: at most {max} files.",
  coreFileRemove: "Remove {name}",
  coreFileList: "Chosen files",
  // SearchCombobox multiple (G16): trigger text for more than two picks
  coreComboSelected: "{n} selected",
  // IconStatCard trend (G23): screen-reader direction
  coreTrendUp: "Up",
  coreTrendDown: "Down",
  // MonthInput (G20)
  corePickMonth: "Pick a month",
  corePrevYear: "Previous year",
  coreNextYear: "Next year",
};
export const coreAr: { [K in keyof typeof coreEn]: string } = {
  coreStepSkipped: "تم تخطّيها",
  coreStepFailed: "فشلت",
  coreShowChanges: "عرض التغييرات",
  coreFileDropPrompt: "اسحب الملفات إلى هنا أو انقر للاستعراض",
  coreFileDropPromptSingle: "اسحب ملفاً إلى هنا أو انقر للاستعراض",
  coreFileDropActive: "أفلِت للإضافة",
  coreFileAccepted: "المقبول: {types}",
  coreFileMaxSize: "حتى {size} للملف",
  coreFileRejectType: "«{name}» ليس من أنواع الملفات المقبولة.",
  coreFileRejectSize: "«{name}» أكبر من {size}.",
  coreFileRejectCount: "لم يُضَف «{name}»: الحد الأقصى {max} ملفات.",
  coreFileRemove: "إزالة {name}",
  coreFileList: "الملفات المختارة",
  coreComboSelected: "{n} محدّدة",
  coreTrendUp: "ارتفاع",
  coreTrendDown: "انخفاض",
  corePickMonth: "اختر شهراً",
  corePrevYear: "السنة السابقة",
  coreNextYear: "السنة التالية",
};
