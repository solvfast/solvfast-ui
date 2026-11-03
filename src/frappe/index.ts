/**
 * @solvfast/ui/frappe — the optional Frappe layer. Requires `@tanstack/react-query` ^5 and a page served by the
 * Frappe site (same origin). The core entry never imports this. See docs/FRAPPE.md.
 */
export { createFrappeClient, FrappeError, toFrappeError } from "./client";
export type { FrappeClient, FrappeClientOptions, FrappeTransport, FrappeResponse, DocField, DocMeta, GetListArgs } from "./client";
export { FrappeProvider, useFrappeClient, useFrappeApi, useFrappeSettings, useFormatContext, createFrappeQueryClient, frappeRetry } from "./FrappeProvider";
export type { FrappeProviderProps, FrappeSettings } from "./FrappeProvider";
export { useFrappeMeta, useFrappeList, frappeLinkSearch, invalidateFrappeList } from "./useFrappeList";
export type { FrappeListOptions } from "./useFrappeList";
export { FrappeListView } from "./FrappeListView";
export type { FrappeListViewProps } from "./FrappeListView";
export { buildFrappeListMeta, columnsFromMeta, filterFieldsFromMeta, STANDARD_FIELDNAMES } from "./meta";
export type { FrappeListMeta } from "./meta";
export { queryToFrappe, conditionToFrappe, buildListRequest } from "./query";
export type { FrappeFilter, ListRequest, ListRequestInput, TranslatedQuery } from "./query";
// 0.4.0 integration contract (types + query keys). docs/CONTRACT-0.4.md
export * from "./contract";

// 0.4.0 — list (A2). docs/CONTRACT-0.4.md
export { loadDocTypeBundle } from "./useFrappeList";
export { orderByWithTieBreak } from "./query";
export type { ListDocMeta, ChildFieldRef } from "./meta";
export { decodeReportview, reportviewGet, reportviewCount, commentCount, COUNT_UPPER_BOUND, ROW_STANDARD_FIELDS } from "./list/reportview";
export type { ReportviewUser } from "./list/reportview";
export { getIndicator, guessColour, toneOf, hasIndicator } from "./list/indicator";
export type { Indicator, IndicatorConfig, IndicatorWorkflow } from "./list/indicator";
export { fetchListSettings, applyColumnSettings } from "./list/settings";
export type { ListViewSettings } from "./list/settings";
export { queryToTuples, tuplesToQuery, UnstorableQueryError } from "./list/tuples";
export { createFrappeSavedFilters, createFrappeUserSettings } from "./list/storage";
export { bulkMenu, bulkDelete, bulkSubmitCancelOrUpdate, bulkAssign } from "./list/bulk";
export type { BulkKind, BulkPermissions, BulkOutcome } from "./list/bulk";
export { FrappeBulkActions } from "./list/FrappeBulkActions";
export type { FrappeBulkOptions } from "./list/FrappeBulkActions";
export { useListRealtime } from "./list/realtime";

// 0.4.0 — record (A4): workflow actions, assignment, timeline, status. docs/CONTRACT-0.4.md
// `Indicator` from ./record is exported as `RecordIndicator` (the list layer's `Indicator` keeps the name). Debt: one
// indicator module for list and record before 0.4.0 (both reproduce frappe.get_indicator).
export * from "./record";
export type { Indicator as RecordIndicator } from "./record/indicator";

// 0.4.0 — foundation (A1): hooks, services (format, translate, permissions, cache), feedback. docs/CONTRACT-0.4.md §2
export * from "./hooks";
export * from "./services";
export * from "./feedback";

// 0.4.0 — client extras (A1). The simulated backend is NOT exported here: import it from "@solvfast/ui/frappe/testing".
export { withFrappeApi, createDocumentApis, toMetaBundle, normalizeDocInfo, workflowFromMeta as workflowInfoFromMeta, frappeErrorKind, parseServerMessages, toFrappeMessage, visibleMessages } from "./client";
export type { FrappeApi, SessionUser, ServerMessagesListener } from "./client";

// 0.4.0 — forms (A3): FrappeForm, fields, link, dynamic link, child table, table multiselect, behaviour engine, formEvents.
export * from "./form";
// `commaAnd` exists in record and form (duplicate — consolidation debt); the record one is exported.
export { commaAnd } from "./record";
