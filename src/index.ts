/**
 * @solvfast/ui — core entry. Explicit, intentional exports only.
 * This entry must never import the Frappe layer or @tanstack/* (enforced by scripts/check-boundaries.mjs).
 */

// Theme
export { ThemeProvider, useTheme, useLocale, usePortalContainer } from "./theme/ThemeProvider";
export type { Theme, Direction, StorageKeys, ThemeProviderProps } from "./theme/ThemeProvider";
export { defaultMessages } from "./theme/messages";
export type { Language, Messages } from "./theme/messages";
// Brand colours and the workspace background (0.7.0-dev.7)
export { applyBrandTheme, brandTokens, hexToHsl, DEFAULT_BRAND_COLORS } from "./theme/brand";
export type { BrandColors } from "./theme/brand";
export { BrandTheme } from "./theme/BrandTheme";
export type { BrandThemeProps } from "./theme/BrandTheme";
export {
  colorBackground, imageLayerStyle, imageOverlayStyle, isImageBackground, presetBackground,
  BACKGROUND_PRESETS, BACKGROUND_INTENSITY_CAP, BACKGROUND_MAX_COLORS, DEFAULT_WORKSPACE_BACKGROUND,
} from "./theme/workspaceBackground";
export type { WorkspaceBackground, WorkspaceBackgroundMode, WorkspaceBackgroundStyle, BackgroundPreset } from "./theme/workspaceBackground";
export { WorkspaceBackdrop } from "./theme/WorkspaceBackdrop";
export type { WorkspaceBackdropProps } from "./theme/WorkspaceBackdrop";

// Utilities
export { cn } from "./lib/cn";

// Primitives (vendored from DS v0.3.0 with Sear's effective look — VENDORED.md)
export { Button, buttonVariants } from "./primitives/button";
export type { ButtonProps } from "./primitives/button";
export { Input } from "./primitives/input";
export { Textarea } from "./primitives/textarea";
export { Label } from "./primitives/label";
export { Badge, badgeVariants } from "./primitives/badge";
export type { BadgeProps } from "./primitives/badge";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./primitives/card";
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator,
  SelectScrollUpButton, SelectScrollDownButton,
} from "./primitives/select";
export { Checkbox } from "./primitives/checkbox";
export { Switch } from "./primitives/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./primitives/tabs";
export { Separator } from "./primitives/separator";
export { Avatar, AvatarImage, AvatarFallback } from "./primitives/avatar";
export { Skeleton } from "./primitives/skeleton";
export { ScrollArea, ScrollBar } from "./primitives/scroll-area";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./primitives/tooltip";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./primitives/popover";
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
} from "./primitives/dropdown-menu";
export {
  Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut,
  CommandSeparator,
} from "./primitives/command";
export {
  Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from "./primitives/dialog";
export {
  AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "./primitives/alert-dialog";
export {
  Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle,
  SheetDescription,
} from "./primitives/sheet";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./primitives/table";
export { RadioGroup, RadioGroupItem } from "./primitives/radio-group";
export { Stepper } from "./primitives/stepper";
export type { StepperStep, StepState } from "./primitives/stepper";
export { Calendar } from "./primitives/calendar";
export { DateField, TimeField, DateTimeField } from "./primitives/date-time-field";

// Merged components (0.3.0): the rest of PMO's components/ui — DS v0.3.0 primitives and PMO's own pieces (VENDORED.md).
// Charts and forms are separate entries: @solvfast/ui/chart (recharts) and @solvfast/ui/form (react-hook-form).
export { Alert, AlertTitle, AlertDescription } from "./primitives/alert";
export { Progress } from "./primitives/progress";
export { Toggle, toggleVariants } from "./primitives/toggle";
export { ToggleGroup, ToggleGroupItem } from "./primitives/toggle-group";
export { StatusDot } from "./primitives/status-dot";
export { Pill } from "./primitives/pill";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./primitives/accordion";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./primitives/collapsible";
export {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis,
} from "./primitives/breadcrumb";
export {
  Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "./primitives/pagination";
export { Slider } from "./primitives/slider";
export { AspectRatio } from "./primitives/aspect-ratio";
export { HoverCard, HoverCardTrigger, HoverCardContent } from "./primitives/hover-card";
export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup,
} from "./primitives/context-menu";
export {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem,
  MenubarRadioGroup, MenubarRadioItem, MenubarPortal, MenubarSubContent, MenubarSubTrigger, MenubarGroup, MenubarSub,
  MenubarShortcut,
} from "./primitives/menubar";
export {
  navigationMenuTriggerStyle, NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent,
  NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport,
} from "./primitives/navigation-menu";
export { SearchCombobox } from "./primitives/search-combobox";
export type { ComboOption, SearchComboboxProps } from "./primitives/search-combobox";
export { RichText, RichTextEditor, sanitizeHtml, htmlIsEmpty } from "./primitives/rich-text-editor";
export type { RichTextProps, RichTextEditorProps } from "./primitives/rich-text-editor";
export { PageHeader } from "./primitives/page-header";
export type { PageHeaderProps } from "./primitives/page-header";
export { EditableTitle } from "./primitives/editable-title";
export type { EditableTitleProps } from "./primitives/editable-title";

// Number cards: the Design System's stat card and Sear Studio's overview card
export { StatCard, IconStatCard } from "./cards/StatCard";
export type { StatCardProps, IconStatCardProps } from "./cards/StatCard";

// App shell (Sear's StudioShell, made configurable — increment 5.2)
export { AppShell } from "./shell/AppShell";
export type { AppShellProps } from "./shell/AppShell";
export { Navbar } from "./shell/Navbar";
export type { NavbarProps, NavbarSearch } from "./shell/Navbar";
export { Sidebar } from "./shell/Sidebar";
export type { SidebarProps, ShellBrand } from "./shell/Sidebar";
export { MobileNav } from "./shell/MobileNav";
export type { MobileNavProps } from "./shell/MobileNav";
export { AppSwitcher } from "./shell/AppSwitcher";
export type { AppSwitcherProps, SwitcherApp, SwitcherSection } from "./shell/AppSwitcher";
export { NotificationPanel } from "./shell/NotificationPanel";
export type { NotificationPanelProps, NotificationItem } from "./shell/NotificationPanel";
export { UserMenu, userInitials } from "./shell/UserMenu";
export type { UserMenuProps, ShellUser } from "./shell/UserMenu";
export { CompanyLogo } from "./shell/CompanyLogo";
export type { CompanyLogoProps } from "./shell/CompanyLogo";
export { defaultIsActive, pathMatches, deepestActive, loc } from "./shell/nav";
export type { NavItem, Localized, IsActive } from "./shell/nav";
export { relativeTime, timeGroup } from "./lib/relative-time";
export type { TimeGroup } from "./lib/relative-time";

// List View (Sear's DataGrid look + PMO's list features — increment 5.3)
export { ListView } from "./list/ListView";
export type { ListViewProps, ListViewControls, RowAction } from "./list/ListView";
export { useListState } from "./list/useListState";
export type { UseListStateOptions, ListQueryState, ListState } from "./list/useListState";
export { ListTable, GroupedListTable, DefaultCell } from "./list/parts/ListTable";
export type { ListTableProps, ListLikeConfig } from "./list/parts/ListTable";
export { FilterBuilder, FilterValueInput } from "./list/parts/FilterBuilder";
export type { FilterBuilderProps, LoadOptions } from "./list/parts/FilterBuilder";
export { SavedFilters, ColumnManager, QuickFilters, SortMenu, GroupByMenu } from "./list/parts/Toolbar";
export { ListPagination, BulkActionBar, ListActionsMenu, useBulkActionRunner, resolveBulkActions } from "./list/parts/ListFooter";
export type { BulkAction, BulkActionContext, BulkActionConfirm } from "./list/parts/ListFooter";
export {
  applyFilterQuery, activeConditionCount, newCondition, OPERATORS_BY_TYPE, EMPTY_QUERY, getQuickValue, setQuickValue,
  operatorsFor, defaultOperator, operatorLabelKey, TIMESPANS, timespanRange, splitRange, joinRange,
} from "./list/model/filters";
export type { FilterField, FilterQuery, FilterCondition, Operator, FieldType, FiscalYear, Timespan } from "./list/model/filters";
export { mergeColumns, filterFieldsFromColumns } from "./list/model/columns";
export type { ColumnDef } from "./list/model/columns";
export { compareValues, sortRows } from "./list/model/sort";
export type { SortState } from "./list/model/sort";
export { groupRows } from "./list/model/group";
export type { GroupByOption, RowGroup } from "./list/model/group";
export { createLocalStorageAdapter } from "./list/model/storage";
export type { ListPrefs, ListPrefsStorage, SavedFilter, SavedFiltersStorage } from "./list/model/storage";

// 0.4.0 — generic record pieces (Frappe-free). docs/CONTRACT-0.4.md §1
export { Timeline, filterItems, sortItems, CommentComposer, draftToHtml, htmlToDraft, AssigneeGroup, AssignPicker, AssignDialog, LifecycleBar, ActionBar, StatusBadge, LikeToggle } from "./record";
export type {
  TimelineProps, TimelineLabels, TimelineFilter, CommentComposerProps, CommentComposerLabels, CommentDraft, AssigneeGroupProps, AssignPickerProps,
  AssignLabels, AssignDialogProps, AssignDialogLabels, LifecycleBarProps, ActionBarProps, ActionBarLabels, StatusBadgeProps, LikeToggleProps, Tone, RecordUser, TimelineKind, TimelineChange, TimelineItem,
  Assignee, AssignDetails, MentionOption, UserOption, LifecycleStateItem, LifecycleActionItem,
} from "./record";

// 0.4.0 — generic field controls (Frappe-free). docs/CONTRACT-0.4.md §1
export * from "./fields";

// 0.4.0 — list actions context (A2)
export { ListActionsContext, useListActions } from "./list/ListActionsContext";
// Plain-text use of timeline summaries (aria-label, copy, export): strip the bidi isolates.
export { stripIsolates } from "./record/format";
// 0.4.0 — nested-set filter operators (Frappe filter.js:32-36)
export { NESTED_SET_OPERATORS, NESTED_SET_LABEL, isNestedSetOperator, operatorLabel } from "./list/model/filters";
export type { NestedSetOperator } from "./list/model/filters";

// 0.6.0 — Core Export / Import (the Design System's Export Data dialog and Data Import tool, without a backend)
export { ExportDialog, useExportDialogLabels } from "./list/io/ExportDialog";
export type { ExportDialogProps, ExportDialogLabels } from "./list/io/ExportDialog";
export { mandatorySelection, orderedSelection, buildCsv, parseCsv, saveBlob } from "./list/io/export";
export type { ExportFileType, ExportRecords, ExportField, ExportGroup, ExportRequest } from "./list/io/export";
export { DataImportDialog } from "./list/io/DataImportDialog";
export type { DataImportDialogProps, DataImportAdapter, ImportRunInput, ImportRunResult } from "./list/io/DataImportDialog";
export { ImportPreviewTable, ImportWarningsPanel, ColumnMappingForm, DONT_IMPORT, useDataImportLabels, useImportDialogLabels } from "./list/io/ImportParts";
export type { ImportPreviewTableProps, ImportWarningsPanelProps, ColumnMappingFormProps, ImportColumnView, GroupedImportWarnings, ImportFieldOption } from "./list/io/ImportParts";
export { autoMapColumns, mapRow, validateImport, isMandatoryFor, importableRows, importPreviewColumns, normalizeHeader } from "./list/io/importModel";
export type { ImportField, ImportType, ParsedImportFile, ColumnMap, ImportDuplicateCheck, ImportRowCheck, ImportValidation } from "./list/io/importModel";
export {
  DATA_IMPORT_LABELS_EN, DATA_IMPORT_LABELS_AR, IMPORT_DIALOG_LABELS_EN, IMPORT_DIALOG_LABELS_AR, fmt as formatImportMessage,
  importStatusLabel, importStatusTone, importResultHeadline,
} from "./list/io/importLabels";
export type { DataImportLabels, ImportDialogExtraLabels, ImportDialogLabels } from "./list/io/importLabels";

// P35 record — generic record menu, connections, e-mail composer, print preview, rename and reminder dialogs (Frappe-free)
export {
  RecordMenu, groupMenuItems, RenameDialog, PrintPreviewFrame, printSrcDoc, ConnectionsPanel, EmailComposer, isValidEmail, ReminderDialog, toFrappeDatetime,
  remindAtFor, reminderSetText,
} from "./record";
export type {
  RecordMenuProps, RecordMenuItem, RecordMenuConfirm, RecordMenuLabels, RenameDialogProps, PrintPreviewFrameProps, ConnectionsPanelProps, ConnectionGroup,
  ConnectionItem, EmailComposerProps, EmailDraft, EmailAttachmentOption, ReminderDialogProps, RemindIn,
} from "./record";

// P35 core — generic capabilities the CRM audit found missing (docs/components/p35-core.md)
export { STATUS_PALETTE, resolveStatusColor, statusColorStyles } from "./primitives/status-dot";
export type { LifecycleStep } from "./record";
// Lifecycle — the shared record lifecycle rail + diagram look (CRM, Tickets). docs/components/record.md §9
export { LifecycleRail, LifecycleDiagramDialog, LifecycleDiagramLegend, LifecycleStateCard, LifecycleEdgeLabel, LifecycleStepDot, LIFECYCLE_DIAGRAM_COLORS } from "./record";
export type {
  LifecycleRailProps, LifecycleRailStep, LifecycleRailNext, LifecycleRailLabels, LifecycleDiagramDialogProps, LifecycleDiagramLegendLabels,
  LifecycleStateCardProps, LifecycleNodeKind, LifecyclePhase,
} from "./record";
// Families — the Records | Types tabs; the Frappe screens are in ./frappe. docs/components/family.md
export { FamilyTabs } from "./record";
export { IconColorPicker, APPEARANCE_ICONS, APPEARANCE_ICON_NAMES, APPEARANCE_COLORS } from "./fields";
export type { IconColorPickerProps } from "./fields";
export type { FamilyTabsProps, FamilyTab, FamilyTabProps } from "./record";
export { FieldDesigner, toLayout as designerLayout, fromLayout as designerItems, previousId as designerPreviousId, kindOfFieldtype } from "./record";
export type { FieldDesignerProps, FieldDesignerAdapter, DesignerState, DesignerFieldSet, DesignerSetField, DesignerRemoval, DesignerPending, DesignerItem, DesignerKind } from "./record";
export { FieldInspector, INSPECTED_PROPERTIES, ownKeys as designerKeys } from "./record";
export type { FieldInspectorProps, FieldDefinition, FieldLinkFilter, FieldTypeProperty, FieldTypeInfo, FieldTypeRegistry } from "./record";
export { EmptyState } from "./primitives/empty-state";
export type { EmptyStateProps } from "./primitives/empty-state";
export type { RichTextEditorHandle } from "./primitives/rich-text-editor";

// P35 views — Core list views (Frappe-free): view switcher, Image, Kanban, Calendar
export {
  LIST_VIEW_TYPES, IMPLEMENTED_VIEWS, isImplementedView, switcherOptions, ViewSwitcher, VIEW_ICONS, useViewLabel, useViewReason, ViewToolbar,
  ImageGrid, initialsOf, ImageView, KanbanBoard, KANBAN_INDICATOR_COLORS, CalendarMonth, monthGrid, eventsOn, addMonths, monthStart, dayOf,
} from "./list/views";
export type {
  ListViewType, ViewOption, ViewUnavailableReason, ViewSwitcherProps, ViewToolbarProps, ViewToolbarControls, ImageGridProps, ImageViewProps,
  KanbanBoardProps, KanbanColumn, KanbanMove, CalendarMonthProps, CalendarEvent,
} from "./list/views";

// P35 list
export { GroupBySidebar } from "./list/parts/GroupBySidebar";
export type { GroupBySidebarProps, GroupBySidebarSection, GroupBySidebarItem } from "./list/parts/GroupBySidebar";
export type { GroupBucket } from "./list/model/group";
export type { SaveFilterOptions } from "./list/model/storage";
export type { SelectionMatching } from "./list/parts/ListTable";
export type { ListActions } from "./list/ListActionsContext";

// P36b social — Desk's Share dialog / shared-with avatars and the liked-by heart + list (Frappe-free)
export { ShareDialog, SharedAvatars, SHARE_RIGHTS, LikedBy } from "./record";
export type { ShareDialogProps, ShareDialogLabels, SharedAvatarsProps, ShareEntry, ShareRight, ShareRights, LikedByProps, LikedByUser } from "./record";

// P36b sidebar — Form Sidebar layout and its Core parts (docs/components/record.md "Form Sidebar")
export { FormSidebar, FORM_SIDEBAR_SECTIONS, SidebarSection, AttachmentList, AttachDialog, TagList } from "./record";
export type {
  FormSidebarProps, FormSidebarSectionId, FormSidebarUserAction, FormSidebarStamp, SidebarSectionProps, SidebarSectionAction, AttachmentListProps, AttachmentItem,
  AttachmentListLabels, AttachDialogProps, LibraryFile, TagListProps,
} from "./record";

// P36b search — the header's global search (Desk awesome bar + Global Search dialog), Core (docs/components/search.md)
export * from "./shell/search";
export type { NavbarSearchSlot } from "./shell/Navbar";

// P36c usergroup — AssignDialog's "Assign To User Group" source (docs/components/record.md, Assign)
export { uniqueMembers } from "./record";
export type { AssignGroupSource } from "./record";

// P36d history — Timeline: entry extras (avatars, communication cards), Desk relative times, absolute time (docs/components/record.md)
export { deskRelativeTime, absoluteTime } from "./record";
export type { TimelineEntry, TimelineItemExtras, TimelineTimeFormat } from "./record";

// P36e ftypes — Core controls for Frappe's Signature, Icon, Barcode (display) and Geolocation (summary) field types
// (also reached through `export * from "./fields"`; listed here so the block shows what P36e added)
export { SignatureInput, isSignatureDataUrl, IconInput, BarcodeInput, parseBarcodeValue, GeolocationInput, parseGeolocation, sanitizeSvg } from "./fields";
export type {
  SignatureInputProps, SignatureInputLabels, IconInputProps, IconInputLabels, BarcodeInputProps, BarcodeInputLabels, ParsedBarcode,
  GeolocationInputProps, GeoFeatureKind, GeoFeatureSummary, ParsedGeolocation,
} from "./fields";

// P36e print — Core print presentation and browser printing (docs in src/record/printDocument.ts): Desk's print page
// (PrintView / PrintViewDialog) and list "Print Documents" dialog as Frappe-free components, plus the composer and the
// helper that print a host-rendered document through the browser (preview and printout are the same document)
export {
  PRINT_PAGE_SIZES, PRINT_PAGE_SIZE_MM, NO_LETTERHEAD, MAX_PRINT_LIMIT, PRINT_DOC_CLASS, pageDimensionsMm, isValidPrintPage, pageCss, escapeHtml,
  composePrintDocument, printHtmlDocument, PRINT_FRAME_ATTR, PrintDocumentsDialog, printPageOf, BACKGROUND_PRINT_ID, PrintView, PrintViewDialog,
} from "./record";
export type {
  PrintPageSpec, PrintOrientation, ComposePrintOptions, PrintHtmlOptions, PrintDocumentsDialogProps, PrintDocumentsValue, PrintOption,
  PrintViewProps, PrintViewDialogProps,
} from "./record";

// P36e submit — Frappe's docstatus rules as Frappe-free pure functions (src/record/docstatus.ts): check_docstatus_transition,
// apply_workflow's docstatus step, Workflow.validate_docstatus, mandatory / update-after-submit checks, delete refusal,
// amended names, and the indicator tooltip keys — for hosts that keep their own records (mock stores)
export {
  DOCSTATUS, SUBMIT_MESSAGE_TEXT, DOCSTATUS_LABEL_KEY, DOCSTATUS_TONE, DOCSTATUS_DESCRIPTION_KEY,
  fillArgs, docMessage, formatDocMessage, toDocStatus, docstatusTransition, workflowDocAction, validateWorkflowDocstatus,
  stateDocStatus, hasMandatoryValue, missingMandatory, isEditableAtDocstatus, updateAfterSubmitViolations, deleteRefusal,
  amendedName, amendRefusal, linkedDeleteRefusal,
} from "./record";
export type {
  DocStatus, DocMessage, SubmitMessageKey, DocstatusAction, DocstatusResult, WorkflowDocAction, WorkflowDocResult,
  WorkflowStateDoc, WorkflowTransitionDoc, DocstatusField,
} from "./record";
