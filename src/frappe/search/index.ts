/** P36b search — the Frappe adapter of the Core global search (Desk awesome bar + Global Search dialog). */
export {
  awesomeBarItems, awesomeBarRecent, navGroups, dedupeAwesomeBar, deskRouteUrl, deskSlug, deskSearchBootFrom,
  getCreatables, getSearchInList, getDoctypes, getReports, getPages, getWorkspaces, getDashboards, getRecentPages, getFrequentLinks, getSearchInCurrent,
} from "./awesomebar";
export type { AwesomeBarContext, DeskRoute, DeskSearchBoot, DeskSearchTarget } from "./awesomebar";
export { GLOBAL_SEARCH_METHOD, fetchGlobalSearch, makeDescription, globalRowToItem, groupGlobalRows } from "./globalSearch";
export type { GlobalSearchArgs, GlobalSearchRow, GlobalResultOptions } from "./globalSearch";
export { useFrappeGlobalSearch, createFrappeSearchSource, recordDeskRoute, deskRouteHistory, clearDeskRouteHistory } from "./useFrappeGlobalSearch";
export type { FrappeGlobalSearchOptions, FrappeSearchSourceOptions } from "./useFrappeGlobalSearch";
export { fuzzyMatch, fuzzySearch, fillTemplate } from "./fuzzy";
export type { FuzzyHit } from "./fuzzy";
