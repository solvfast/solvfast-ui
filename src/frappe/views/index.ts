/** P35 views: Frappe adapters for the Core views (src/list/views). */
export { availableViews, calendarFieldMapFromMeta, kanbanGroupFields } from "./availableViews";
export type { AvailableViewsContext, CalendarFieldMap } from "./availableViews";
export { useFrappeViewList, patchCachedRows, updateCachedRows } from "./useFrappeViewList";
export type { FrappeViewListOptions, ViewRequest } from "./useFrappeViewList";
export { FrappeImageView } from "./FrappeImageView";
export type { FrappeImageViewProps } from "./FrappeImageView";
export { FrappeReportView } from "./FrappeReportView";
export type { FrappeReportViewProps, ReportEditable, ReportEditInfo } from "./FrappeReportView";
export { isCellEditable, columnTotals, INLINE_EDIT_TYPES, deskCanWrite, evaluateReportReadOnlyDependsOn, isNonStdField, rowFromSavedDoc } from "./report";
export type { ReportEditMode, ReportEditOptions } from "./report";
export { FrappeKanbanView } from "./FrappeKanbanView";
export type { FrappeKanbanViewProps } from "./FrappeKanbanView";
export { getKanbanBoards, getKanbanBoard, moveKanbanCard, boardLayout, KANBAN_METHODS } from "./kanban";
export type { KanbanBoardDoc, KanbanBoardColumnDoc, KanbanBoardSummary, KanbanCardMove } from "./kanban";
export { FrappeCalendarView, rowToEvent, CALENDAR_EVENTS_METHOD } from "./FrappeCalendarView";
export type { FrappeCalendarViewProps } from "./FrappeCalendarView";
export { FrappeViews, useFrappeAvailableViews } from "./FrappeViews";
export type { FrappeViewsProps } from "./FrappeViews";
