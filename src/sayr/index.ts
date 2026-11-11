// @solvfast/ui/sayr — the only entry that calls Sayr's own methods (sear_product). Core and ./frappe never import it.
export { createSayrFieldDesignerAdapter, sayrToken } from "./fieldDesignerAdapter";
export type { SayrApi, SayrFieldDesignerOptions } from "./fieldDesignerAdapter";
export { SayrFieldDesigner } from "./SayrFieldDesigner";
export type { SayrFieldDesignerProps } from "./SayrFieldDesigner";
export { SayrRecordPage, RECORD_RAIL_CARDS } from "./SayrRecordPage";
export type { SayrRecordPageProps, RecordRailCard } from "./SayrRecordPage";
export { RECORD_PAGE_METHOD, TRANSITION_METHOD, defaultLifecycleHref } from "./recordPage";
export type { RecordPageData, ChecklistData } from "./recordPage";
