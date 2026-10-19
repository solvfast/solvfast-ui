/**
 * @solvfast/ui — core entry. Explicit, intentional exports only.
 * This entry must never import the Frappe layer or @tanstack/* (enforced by scripts/check-boundaries.mjs).
 */

// Theme
export { ThemeProvider, useTheme, useLocale, usePortalContainer } from "./theme/ThemeProvider";
export type { Theme, Direction, StorageKeys, ThemeProviderProps } from "./theme/ThemeProvider";
export { defaultMessages } from "./theme/messages";
export type { Language, Messages } from "./theme/messages";

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
export type { ListTableProps } from "./list/parts/ListTable";
export { FilterBuilder, FilterValueInput } from "./list/parts/FilterBuilder";
export type { FilterBuilderProps, LoadOptions } from "./list/parts/FilterBuilder";
export { SavedFilters, ColumnManager, QuickFilters, SortMenu, GroupByMenu } from "./list/parts/Toolbar";
export { ListPagination, BulkActionBar } from "./list/parts/ListFooter";
export type { BulkAction } from "./list/parts/ListFooter";
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
