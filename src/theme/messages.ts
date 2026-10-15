/** The package's own chrome strings (ar/en). Consumers override per key via <ThemeProvider messages>.
 *  Increment 5.1 ships the theme/shell basics; the list and shell increments add their keys here. */
export type Language = "ar" | "en";

const en = {
  toggleTheme: "Toggle theme",
  toggleLanguage: "Toggle language",
  lightMode: "Light mode",
  darkMode: "Dark mode",
  close: "Close",
  search: "Search…",
  pickDate: "Pick a date",
  pickTime: "Pick a time",
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
};

export const defaultMessages: Record<Language, Messages> = { en, ar };
