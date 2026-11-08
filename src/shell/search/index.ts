/** P36b search — Core global search (Desk's awesome bar + Global Search dialog), Frappe-free. */
export { GlobalSearchBar, SEARCH_FOR_ID } from "./GlobalSearchBar";
export type { GlobalSearchBarProps } from "./GlobalSearchBar";
export { GlobalSearchDialog } from "./GlobalSearchDialog";
export type { GlobalSearchDialogProps } from "./GlobalSearchDialog";
export { fuzzyMatch, fuzzySearch, markSegments, fillTemplate } from "./fuzzy";
export type { FuzzyHit, TextSegment } from "./fuzzy";
export { Marked } from "./parts";
export type { GlobalSearchSource, SearchItem, SearchItemDetail, SearchResultGroup, SelectOptions } from "./types";
