/** Chrome strings of the record rail (RecordRail, RecordRailSection, RecordRailCustomize, RecordRailArticles). en + ar;
 *  the ar object must have every en key. Hosts that render outside a ThemeProvider pass `labels` instead. */
export const recordRailEn = {
  rrCustomize: "Customize sections",
  rrVisibleSections: "Visible sections",
  rrDragToReorder: "Drag to reorder",
  rrLink: "Link",
  rrAdd: "Add",
  rrChange: "Change",
  rrClear: "Clear",
  rrArticles: "Articles",
};
export const recordRailAr: { [K in keyof typeof recordRailEn]: string } = {
  rrCustomize: "تخصيص الأقسام",
  rrVisibleSections: "الأقسام المرئية",
  rrDragToReorder: "اسحب لإعادة الترتيب",
  rrLink: "ربط",
  rrAdd: "إضافة",
  rrChange: "تغيير",
  rrClear: "مسح",
  rrArticles: "المقالات",
};
