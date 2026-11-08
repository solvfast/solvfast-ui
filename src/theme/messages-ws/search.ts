/** Chrome strings added by the P36 batch-2 "search" workstream (en + ar; the ar object must have every en key). */
export const searchEn = {
  /** navbar.html:29 — `Search or type a command ({0})`, {0} = "Ctrl + G" / "⌘ + G". */
  globalSearchPlaceholder: "Search or type a command ({0})",
  /** Mobile trigger / dialog input label. */
  globalSearchOpen: "Search",
  /** AB:302 — `Search for {0}`. */
  globalSearchFor: "Search for {0}",
  /** SD:49 — the dialog's empty text `Search for anything`. */
  globalSearchAnything: "Search for anything",
  /** SD:210 — `Searching ...`. */
  globalSearchSearching: "Searching ...",
  /** SD:50 — `No Results found`. */
  globalSearchNoResults: "No Results found",
  /** SD:259 — `All Results`. */
  globalSearchAllResults: "All Results",
  /** SD:287 / SD:301 — `More`. */
  globalSearchMore: "More",
  /** SD:395 — `<N> results found` (untranslated in Desk). */
  globalSearchResultsFound: "{n} results found",
  /** Addition (Desk has no error state, SU:472-489). */
  globalSearchError: "The search failed.",
  globalSearchRetry: "Retry",
  /** Awesome bar popup: suggestions are loading (async sources only). */
  globalSearchLoading: "Loading…",
  /** Group navigation (the Desk sidebar, SD:238-263). */
  globalSearchGroups: "Result groups",
  globalSearchResults: "Search results",
};
export const searchAr: { [K in keyof typeof searchEn]: string } = {
  globalSearchPlaceholder: "ابحث أو اكتب أمراً ({0})",
  globalSearchOpen: "بحث",
  globalSearchFor: "ابحث عن {0}",
  globalSearchAnything: "ابحث عن أي شيء",
  globalSearchSearching: "جارٍ البحث ...",
  globalSearchNoResults: "لا توجد نتائج",
  globalSearchAllResults: "كل النتائج",
  globalSearchMore: "المزيد",
  globalSearchResultsFound: "{n} نتيجة",
  globalSearchError: "تعذّر البحث.",
  globalSearchRetry: "إعادة المحاولة",
  globalSearchLoading: "جارٍ التحميل…",
  globalSearchGroups: "مجموعات النتائج",
  globalSearchResults: "نتائج البحث",
};
