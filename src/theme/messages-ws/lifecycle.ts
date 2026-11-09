/** Chrome strings of the Lifecycle components (LifecycleRail, LifecycleDiagramDialog). en + ar; the ar object must have
 *  every en key. Consumers that render outside a ThemeProvider pass their own `labels` instead. */
export const lifecycleEn = {
  lcCurrent: "Current",
  lcBack: "back",
  lcEnd: "End of lifecycle",
  lcViewAll: "View full lifecycle",
  lcNext: "Next",
  lcDone: "Done",
  lcNotReached: "Not reached",
  lcPathTaken: "Path taken",
  lcClose: "Close",
};
export const lifecycleAr: { [K in keyof typeof lifecycleEn]: string } = {
  lcCurrent: "الحالية",
  lcBack: "رجوع",
  lcEnd: "نهاية دورة الحياة",
  lcViewAll: "عرض دورة الحياة كاملة",
  lcNext: "التالي",
  lcDone: "تم",
  lcNotReached: "لم تُبلغ",
  lcPathTaken: "المسار المتّبع",
  lcClose: "إغلاق",
};
