/**
 * Frappe forms (0.4.0, A3): FrappeForm and its parts, the field dispatcher, Link / Dynamic Link, child tables, Table
 * MultiSelect, formEvents (D-24) and the behaviour engine (model/, D-23). The Lead re-exports this barrel from
 * src/frappe/index.ts.
 */
export { FrappeForm } from "./FrappeForm";
export type { FrappeFormProps, FrappeFormMenuOptions, FrappeFormConnectionsOptions } from "./FrappeForm";
export { FrappeFormView } from "./FrappeFormView";
export type { FrappeFormViewProps, FrappeFormMenuContext, FormPermissions, LinkedDoc, SaveAction as FormSaveAction } from "./FrappeFormView";
export { FrappeField, dataOptionInvalid } from "./FrappeField";
export type { FrappeFieldProps } from "./FrappeField";
export { FrappeLinkField, FrappeDynamicLinkField, parseLinkFilters, mergeLinkFilters } from "./FrappeLinkField";
export { linkTitleCache, useLinkTitles } from "./linkTitles";
export type { LinkTitleCache } from "./linkTitles";
export type { FrappeLinkFieldProps, FrappeDynamicLinkFieldProps } from "./FrappeLinkField";
export { FrappeChildTable, gridColumns, useLocalTableController } from "./FrappeChildTable";
export type { FrappeChildTableProps, TableController } from "./FrappeChildTable";
export { FrappeTableMultiSelect } from "./FrappeTableMultiSelect";
export type { FrappeTableMultiSelectProps } from "./FrappeTableMultiSelect";
export { FrappeFormServices, useFormServices } from "./services";
export type { FormServices, CreateNewRequest } from "./services";
export { runEvent, resolveLinkQuery } from "./events";
export type { CustomButton, FormController, FormEventHandler, FormEvents, FormEventsConfig, LinkQuery, ResolvedLinkQuery } from "./events";
export * from "./model";
// P35 form
export { FrappeQuickEntry, useQuickEntryHost } from "./FrappeQuickEntry";
export type { FrappeQuickEntryProps } from "./FrappeQuickEntry";
export { useUnsavedChangesBlocker } from "./unsavedChanges";
export type { UnsavedChangesBlocker, UnsavedChangesBlockerOptions } from "./unsavedChanges";
export { defaultLinkHref } from "./services";
// P36b attachimage — Desk's Attach / Attach Image controls (attach.js, attach_image.js) and the image_field menu (user_image.js)
export { FrappeAttachField, useFrappeAttach, attachUploadOptions, fileIdForUrl, MAX_FILE_SIZE_METHOD, ATTACH_FIELD_FOLDER } from "./FrappeAttachField";
export type { FrappeAttachFieldProps, UseFrappeAttachOptions } from "./FrappeAttachField";
export { FrappeAttachHost, useAttachHost, attachSaveAction } from "./attachHost";
export type { FrappeAttachHostValue } from "./attachHost";
export { FrappeFormImage } from "./FrappeFormImage";
export type { FrappeFormImageProps } from "./FrappeFormImage";
// P36d fields — Desk's split_emails (utils.js:839-853), used with dataOptionInvalid by apps that check addresses
export { splitEmails } from "./FrappeField";
// P36e ftypes — Desk's Icon control over Frappe's sprite (icon.js), and the supported-but-partial fieldtypes
export { FrappeIconField, FrappeIconGlyph, FRAPPE_ICON_NAMES, deskIconNames, hasFrappeIcon } from "./FrappeIconField";
export type { FrappeIconFieldProps } from "./FrappeIconField";
export { PARTIAL_FIELDTYPES } from "./model/fieldtypes";
