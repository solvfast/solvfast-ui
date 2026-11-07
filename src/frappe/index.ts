/**
 * @solvfast/ui/frappe — the optional Frappe layer. Requires `@tanstack/react-query` ^5 and a page served by the
 * Frappe site (same origin). The core entry never imports this. See docs/FRAPPE.md.
 */
export { createFrappeClient, FrappeError, toFrappeError } from "./client";
export type { FrappeClient, FrappeClientOptions, FrappeTransport, FrappeResponse, DocField, DocMeta, GetListArgs, FrappeFilesTransport, DownloadedFile, UploadFileOptions } from "./client";
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
export { FrappeBulkActions, useFrappeBulkActions } from "./list/FrappeBulkActions";
export type { FrappeBulkOptions, FrappeBulkActionsProps } from "./list/FrappeBulkActions";
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
// Form helpers (A3): Desk's can_cancel rule and the form loading skeleton.
export { canCancelDoctype, FormSkeleton } from "./form/FrappeForm";

// 0.4.0 — Phase 26: server-authorised Export (Data Exporter `download_template`) and Data Import sequence; gated menu.
export { downloadExportTemplate, exportPickerGroups, mandatorySelection, selectedNamesFilter, saveFile, DOWNLOAD_TEMPLATE_METHOD } from "./list/export";
export type { ExportFileType, ExportRecords, ImportType, ExportTemplateOptions, ExportPickerGroup, ExportPickerField } from "./list/export";
export { startDataImport, startImport, getImportPreview, getImportStatus, getImportLogs, downloadImportTemplate, downloadErroredRows, downloadImportLog, parseTemplateWarnings, useImportStatus, DATA_IMPORT_METHODS } from "./list/import";
export type { DataImportDoc, DataImportStatus, ImportPreview, ImportWarning, StartDataImportOptions, StartedDataImport, ImportStatus, ImportProgress, ImportLogRow } from "./list/import";
export { FrappeExportDialog, EXPORT_DIALOG_LABELS_EN } from "./list/FrappeExportDialog";
export type { ExportDialogLabels, FrappeExportDialogProps } from "./list/FrappeExportDialog";
export { restrictMetaToReadable } from "./meta";

// 0.4.0 — Phase 27 B (query27): width-based column limit, URL filters, report-view export, nested-set operators.
export { capDefaultColumns, deskColumnLimit, listedFields } from "./list/settings";
export type { DeskColumnCapOptions } from "./list/settings";
export { parseUrlFilters, filtersToUrl, filtersToSearchParams, resolveUrlKey } from "./list/urlFilters";
export type { ParsedUrlFilters, UrlFilterSource } from "./list/urlFilters";
export { downloadReportExport, reportExportArgs, reportExportFields, EXPORT_QUERY_METHOD } from "./list/reportExport";
export type { ReportExportOptions, ReportExportResult, ReportExportFormat, CsvQuoting } from "./list/reportExport";
export { FrappeReportExportDialog, REPORT_EXPORT_DIALOG_LABELS_EN } from "./list/FrappeReportExportDialog";
export type { FrappeReportExportDialogProps, ReportExportDialogLabels } from "./list/FrappeReportExportDialog";
export { NESTED_SET_FRAPPE_OP } from "./query";
export { treeDoctypesOf } from "./meta";
export type { TreeDoctypes } from "./meta";

// 0.4.0 — Phase 27 B (actions27): Desk's full Actions menu — Print, Clear Assignment, Assignment Rule, Add Tags, workflow bulk.
export { listActionsMenu, isBulkKind, bulkClearAssignment, bulkApplyAssignmentRule, bulkAddTags } from "./list/bulk";
export type { ListActionKind } from "./list/bulk";
export { checkPrintable, printFormatOptions, letterheadOptions, pdfOptions, multiPdfArgs, downloadMultiPdf, downloadMultiPdfAsync, PRINT_METHODS, MAX_PRINT_LIMIT, BACKGROUND_PRINT_THRESHOLD, NO_LETTERHEAD, PRINT_PAGE_SIZES, PRINT_SETTINGS_DEFAULTS } from "./list/print";
export type { PrintSettingsInput, PrintCheck, PrintTaskSubscriber, MultiPdfOptions } from "./list/print";
export { commonTransitionActions, bulkWorkflowApproval, workflowDocs, WORKFLOW_BULK_METHODS, WORKFLOW_BULK_SYNC_BELOW, WORKFLOW_BULK_MAX } from "./list/workflowBulk";
export { FrappePrintDialog } from "./list/FrappePrintDialog";
export type { FrappePrintDialogProps } from "./list/FrappePrintDialog";
export { dataImportListUrl, documentNamesForKeys } from "./FrappeListView";

// 0.4.0 — Phase 27 C (import27): Data Import preview, column mapping, server-confirmed completion.
export { FrappeDataImport } from "./list/FrappeDataImport";
export type { FrappeDataImportProps, ImportRealtimeEvent, ImportRealtimeSubscribe } from "./list/FrappeDataImport";
export { FrappeImportPreview, FrappeImportWarnings, useDataImportLabels } from "./list/ImportPreview";
export type { FrappeImportPreviewProps, FrappeImportWarningsProps } from "./list/ImportPreview";
export { FrappeColumnMapping } from "./list/ColumnMapping";
export type { FrappeColumnMappingProps } from "./list/ColumnMapping";
export { createDataImport, attachImportFile, saveColumnMapping, remapImportColumns, importRunning } from "./list/import";
export type { ImportPreviewColumn } from "./list/import";
export {
  DATA_IMPORT_LABELS_EN, DATA_IMPORT_LABELS_AR, importPickerOptions, columnMappingValue, changedColumnMap, mergeColumnToFieldMap,
  groupImportWarnings, previewColumns, importResultMessage, parseLogMessages, parseRowIndexes,
  statusLabel as importStatusLabel, statusTone as importStatusTone, DONT_IMPORT, IMPORT_LOG_TABLE_LIMIT,
} from "./list/importMapping";
export type { DataImportLabels, ImportFieldOption, GroupedImportWarnings, PreviewColumnView } from "./list/importMapping";

// P35 views — Frappe adapters for the list views (Report, Image, Kanban, Calendar) + availableViews(meta)
export {
  availableViews, calendarFieldMapFromMeta, kanbanGroupFields, useFrappeViewList, patchCachedRows, FrappeImageView, FrappeReportView,
  isCellEditable, columnTotals, INLINE_EDIT_TYPES, FrappeKanbanView, getKanbanBoards, getKanbanBoard, moveKanbanCard, boardLayout, KANBAN_METHODS,
  FrappeCalendarView, rowToEvent, CALENDAR_EVENTS_METHOD, FrappeViews, useFrappeAvailableViews,
} from "./views";
export type {
  AvailableViewsContext, CalendarFieldMap, FrappeViewListOptions, ViewRequest, FrappeImageViewProps, FrappeReportViewProps, FrappeKanbanViewProps,
  KanbanBoardDoc, KanbanBoardColumnDoc, KanbanBoardSummary, KanbanCardMove, FrappeCalendarViewProps, FrappeViewsProps,
} from "./views";

// P35 form
export { linkTitlesOf } from "./client";
export type { LoadedDocWithTitles } from "./client";
export { userDefaultsFromBoot } from "./services/boot";
