/**
 * @solvfast/ui/frappe — the optional Frappe layer. Requires `@tanstack/react-query` ^5 and a page served by the
 * Frappe site (same origin). The core entry never imports this. See docs/FRAPPE.md.
 */
export { createFrappeClient, FrappeError, toFrappeError } from "./client";
export type { FrappeClient, FrappeClientOptions, FrappeTransport, FrappeResponse, DocField, DocMeta, GetListArgs } from "./client";
export { FrappeProvider, useFrappeClient, createFrappeQueryClient, frappeRetry } from "./FrappeProvider";
export type { FrappeProviderProps } from "./FrappeProvider";
export { useFrappeMeta, useFrappeList, frappeLinkSearch, invalidateFrappeList } from "./useFrappeList";
export type { FrappeListOptions } from "./useFrappeList";
export { FrappeListView } from "./FrappeListView";
export type { FrappeListViewProps } from "./FrappeListView";
export { buildFrappeListMeta, columnsFromMeta, filterFieldsFromMeta, STANDARD_FIELDNAMES } from "./meta";
export type { FrappeListMeta } from "./meta";
export { queryToFrappe, conditionToFrappe, buildListRequest } from "./query";
export type { FrappeFilter, ListRequest, ListRequestInput, TranslatedQuery } from "./query";
