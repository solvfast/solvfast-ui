/** The package's own chrome strings (ar/en). Consumers override per key via <ThemeProvider messages>.
 *  The list increment adds its keys here. */
export type Language = "ar" | "en";

const en = {
  toggleTheme: "Toggle theme",
  toggleLanguage: "Toggle language",
  lightMode: "Light Mode",
  darkMode: "Dark Mode",
  close: "Close",
  search: "Search...",
  pickDate: "Pick a date",
  pickTime: "Pick a time",
  // shell (strings as Sear shows them; Sear's English-only ones now have Arabic too)
  notifications: "Notifications",
  markAllRead: "Mark all as read",
  filterAll: "All",
  filterUnread: "Unread",
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
  allCaughtUp: "You're all caught up.",
  noNotifications: "No notifications yet.",
  more: "More",
  collapse: "Collapse",
  expand: "Expand",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  openMenu: "Open menu",
  myWorkspace: "My Workspace",
  backToWorkspace: "Back to My Workspace",
};

export type Messages = typeof en;

const ar: Messages = {
  toggleTheme: "تبديل المظهر",
  toggleLanguage: "تبديل اللغة",
  lightMode: "الوضع الفاتح",
  darkMode: "الوضع الداكن",
  close: "إغلاق",
  search: "بحث...",
  pickDate: "اختر تاريخاً",
  pickTime: "اختر وقتاً",
  notifications: "الإشعارات",
  markAllRead: "تعليم الكل كمقروء",
  filterAll: "الكل",
  filterUnread: "غير مقروء",
  today: "اليوم",
  yesterday: "أمس",
  earlier: "أقدم",
  allCaughtUp: "أنت على اطّلاع بكل شيء.",
  noNotifications: "لا توجد إشعارات بعد.",
  more: "المزيد",
  collapse: "طي",
  expand: "توسيع",
  collapseSidebar: "طي الشريط الجانبي",
  expandSidebar: "توسيع الشريط الجانبي",
  openMenu: "فتح القائمة",
  myWorkspace: "مساحة العمل",
  backToWorkspace: "العودة إلى مساحة العمل",
};

export const defaultMessages: Record<Language, Messages> = { en, ar };
