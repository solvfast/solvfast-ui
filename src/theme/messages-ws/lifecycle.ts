/** Chrome strings of the Lifecycle components (LifecycleRail, LifecycleDiagramDialog, LifecycleGraphView). en + ar; the ar object must have
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
  // lcPhaseOpen / lcPhaseOnHold / lcPhaseClosed: defined once, in run1.ts (0.9.0's wording).
  lcZoomIn: "Zoom in",
  lcZoomOut: "Zoom out",
  lcFit: "Fit to view",
  // LifecycleGraphView's text alternative (0.10.0): the diagram, every transition as a sentence, each state's progress
  lcDiagram: "Lifecycle diagram",
  lcTransitions: "Transitions",
  lcTransitionItem: "From {0} to {1}: {2}",
  lcTransitionItemPlain: "From {0} to {1}",
  lcReached: "Reached",
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
  lcZoomIn: "تكبير",
  lcZoomOut: "تصغير",
  lcFit: "ملاءمة العرض",
  lcDiagram: "مخطط دورة الحياة",
  lcTransitions: "الانتقالات",
  lcTransitionItem: "من {0} إلى {1}: {2}",
  lcTransitionItemPlain: "من {0} إلى {1}",
  lcReached: "تم الوصول إليها",
};
