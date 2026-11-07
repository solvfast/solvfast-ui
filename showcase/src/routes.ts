/** Sections of the one-page showcase: groups → sections. Only what the package implements. */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Bell, Compass, Component, Database, Layers, Shapes, Table2, type LucideIcon } from "lucide-react";
import { l, type L } from "./i18n";

export interface Page { id: string; title: L; description: L; Component: LazyExoticComponent<ComponentType> }
export interface Group { id: string; title: L; icon: LucideIcon; pages: Page[] }

const from = <M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const start = () => import("./pages/start");
const components = () => import("./pages/components");
const overlays = () => import("./pages/overlays");
const datetime = () => import("./pages/datetime");
const data = () => import("./pages/data");
const shell = () => import("./pages/shell");
const merged = () => import("./pages/merged");
const chart = () => import("./pages/chart");
const frappe = () => import("./pages/frappe");
const io = () => import("./pages/io");

/** Navigation, grouped as on the Design System site. Section bodies load per module, when a section is first opened. */
export const GROUPS: Group[] = [
  { id: "foundations", title: l("Foundations", "الأساسيات"), icon: Layers, pages: [
    { id: "overview", title: l("Overview", "نظرة عامة"), description: l("What @solvfast/ui is, its entry points, and how to start.", "ما هي ‎@solvfast/ui‎، ونقاط الدخول، وكيف تبدأ."), Component: from(start, "Overview") },
    { id: "theming", title: l("Theme & language", "السمة واللغة"), description: l("ThemeProvider: light and dark, Arabic and English, right-to-left; the colour tokens and type roles.", "‏ThemeProvider: الفاتح والداكن، العربية والإنجليزية، من اليمين إلى اليسار؛ رموز الألوان وأدوار الخطوط."), Component: from(start, "Theming") },
  ] },
  { id: "components", title: l("Components", "المكوّنات"), icon: Component, pages: [
    { id: "button", title: l("Button", "الزر"), description: l("Variants, sizes, states and icon buttons.", "الأنواع والأحجام والحالات وأزرار الأيقونات."), Component: from(components, "Buttons") },
    { id: "badge", title: l("Badge", "الشارة"), description: l("Compact status, category and count labels.", "تسميات مختصرة للحالة والفئة والعدد."), Component: from(components, "Badges") },
    { id: "card", title: l("Card", "البطاقة"), description: l("The glass container: header, content and footer.", "الحاوية الزجاجية: الرأس والمحتوى والتذييل."), Component: from(components, "Cards") },
    { id: "fields", title: l("Text fields", "حقول النص"), description: l("Input, Textarea and Label, with labels, hints and the disabled state.", "حقل الإدخال ومنطقة النص والتسمية، مع التسميات والتلميحات وحالة التعطيل."), Component: from(components, "Fields") },
    { id: "choices", title: l("Checkbox & Switch", "مربع الاختيار والمفتاح"), description: l("Binary choices.", "الخيارات الثنائية."), Component: from(components, "Choices") },
    { id: "radio-group", title: l("Radio group", "مجموعة الاختيار"), description: l("One choice from a short, visible list.", "اختيار واحد من قائمة قصيرة ظاهرة."), Component: from(components, "RadioPage") },
    { id: "select", title: l("Select", "القائمة المنسدلة"), description: l("Pick one value from a list, with groups.", "اختيار قيمة واحدة من قائمة، مع مجموعات."), Component: from(components, "SelectPage") },
    { id: "tabs", title: l("Tabs", "علامات التبويب"), description: l("Switch between views of the same context.", "التنقّل بين عروض السياق نفسه."), Component: from(components, "TabsPage") },
    { id: "avatar", title: l("Avatar", "الصورة الرمزية"), description: l("A person's image with an initials fallback.", "صورة الشخص مع الأحرف الأولى بديلاً."), Component: from(components, "AvatarPage") },
    { id: "feedback", title: l("Skeleton & Separator", "الهيكل والفاصل"), description: l("Loading placeholders and dividers.", "عناصر نائبة أثناء التحميل وفواصل."), Component: from(components, "SkeletonSeparator") },
    { id: "scroll-area", title: l("Scroll area", "منطقة التمرير"), description: l("A scroll container with a styled scrollbar.", "حاوية تمرير بشريط تمرير منسّق."), Component: from(components, "ScrollAreaPage") },
    { id: "calendar", title: l("Calendar", "التقويم"), description: l("Single dates and ranges, in both directions.", "تاريخ واحد أو نطاق، في الاتجاهين."), Component: from(datetime, "CalendarPage") },
    { id: "date-time-fields", title: l("Date & time fields", "حقول التاريخ والوقت"), description: l("DateField, TimeField and DateTimeField: glass pickers instead of native inputs.", "‏DateField و TimeField و DateTimeField: منتقيات زجاجية بدل الحقول الأصلية."), Component: from(datetime, "DateTimePage") },
    { id: "search-combobox", title: l("Search combobox", "مربع البحث والاختيار"), description: l("Pick one record found by a server search.", "اختيار سجل واحد يُعثر عليه ببحث على الخادم."), Component: from(merged, "SearchComboboxPage") },
    { id: "rich-text", title: l("Rich text", "النص المنسّق"), description: l("A light editor and its read-only view; sanitized HTML.", "محرّر خفيف وعرضه للقراءة فقط؛ HTML منقّى."), Component: from(merged, "RichTextPage") },
    { id: "form", title: l("Form", "النموذج"), description: l("@solvfast/ui/form — fields wired to react-hook-form.", "‏@solvfast/ui/form — حقول موصولة بـ react-hook-form."), Component: from(merged, "FormPage") },
    { id: "toggle", title: l("Toggle & toggle group", "زر التبديل ومجموعته"), description: l("Two-state buttons, alone or in a group.", "أزرار بحالتين، منفردة أو في مجموعة."), Component: from(merged, "TogglePage") },
    { id: "slider", title: l("Slider", "المنزلق"), description: l("A number in a range.", "رقم ضمن مدى."), Component: from(merged, "SliderPage") },
    { id: "accordion", title: l("Accordion & collapsible", "الأكورديون والقسم القابل للطي"), description: l("Sections that open and close.", "أقسام تُفتح وتُغلق."), Component: from(merged, "AccordionPage") },
    { id: "aspect-ratio", title: l("Aspect ratio", "نسبة الأبعاد"), description: l("Media at a fixed ratio.", "وسائط بنسبة ثابتة."), Component: from(merged, "AspectRatioPage") },
  ] },
  { id: "data", title: l("Data display", "عرض البيانات"), icon: Table2, pages: [
    { id: "stat-cards", title: l("Stat cards", "بطاقات الإحصاء"), description: l("StatCard from the Design System and IconStatCard from Sear's overview: a number at a glance.", "‏StatCard من نظام التصميم و IconStatCard من نظرة سير العامة: رقم في لمحة."), Component: from(components, "StatCards") },
    { id: "status-pill", title: l("Status dot & pill", "نقطة الحالة والحبّة"), description: l("Frappe-style status and rounded chips.", "حالة بأسلوب فرابيه وشرائح دائرية."), Component: from(merged, "StatusPillPage") },
    { id: "progress", title: l("Progress", "شريط التقدّم"), description: l("How far a task has got.", "مدى تقدّم مهمة."), Component: from(merged, "ProgressPage") },
    { id: "chart", title: l("Chart", "الرسم البياني"), description: l("@solvfast/ui/chart — the Design System's chart helpers on recharts.", "‏@solvfast/ui/chart — أدوات الرسوم في نظام التصميم على recharts."), Component: from(chart, "ChartPage") },
    { id: "table", title: l("Table", "الجدول"), description: l("A plain table for small, fixed data.", "جدول بسيط لبيانات قليلة وثابتة."), Component: from(data, "TablePage") },
    { id: "list-view", title: l("List View", "عرض القائمة"), description: l("Search, saved filters, advanced filter, column manager, sorting and paging — Sear's data grid.", "البحث والتصفيات المحفوظة والتصفية المتقدّمة وإدارة الأعمدة والفرز والتصفّح — شبكة بيانات سير."), Component: from(data, "ListViewPage") },
    { id: "list-features", title: l("List View features", "ميزات عرض القائمة"), description: l("Selection and bulk actions, group-by, sort menu, quick filters, row actions and row styles — all opt-in.", "التحديد والإجراءات الجماعية والتجميع وقائمة الفرز والتصفية السريعة وإجراءات الصفوف وتنسيقها — كلها اختيارية."), Component: from(data, "ListFeaturesPage") },
    { id: "list-states", title: l("List View states", "حالات عرض القائمة"), description: l("Loading, empty and error.", "التحميل والفراغ والخطأ."), Component: from(data, "ListStatesPage") },
    { id: "filters", title: l("Filters", "التصفية"), description: l("The filter builder on its own, and the filter model behind it.", "منشئ التصفية وحده، ونموذج التصفية خلفه."), Component: from(data, "FiltersPage") },
    { id: "export-import", title: l("Export & Import", "التصدير والاستيراد"), description: l("ExportDialog and DataImportDialog from the core entry: the Design System's Export Data dialog and Data Import tool behind an adapter — no Frappe server.", "‏ExportDialog و DataImportDialog من المدخل الأساسي: حوار تصدير البيانات وأداة الاستيراد في نظام التصميم خلف محوّل — بلا خادم فرابيه."), Component: from(io, "CoreIoPage") },
    { id: "frappe-list", title: l("Frappe List View", "عرض قائمة فرابيه"), description: l("FrappeListView on a simulated Frappe site (no network).", "‏FrappeListView على موقع فرابيه محاكى (دون شبكة)."), Component: from(data, "FrappePage") },
  ] },
  { id: "overlays", title: l("Feedback & overlays", "التغذية والطبقات"), icon: Bell, pages: [
    { id: "tooltip", title: l("Tooltip", "التلميح"), description: l("A short label for an icon or truncated control.", "تسمية قصيرة لأيقونة أو عنصر مقتطع."), Component: from(components, "TooltipPage") },
    { id: "alert", title: l("Alert", "التنبيه"), description: l("A static message in the page.", "رسالة ثابتة في الصفحة."), Component: from(merged, "AlertPage") },
    { id: "toast", title: l("Toast", "التنبيه العابر"), description: l("Short, non-blocking confirmations — @solvfast/ui/toast, on sonner.", "تأكيدات قصيرة لا تقاطع العمل — ‎@solvfast/ui/toast‎ على sonner."), Component: from(overlays, "ToastPage") },
    { id: "dialog", title: l("Dialog", "مربع الحوار"), description: l("A focused task on top of the page.", "مهمة مركّزة فوق الصفحة."), Component: from(overlays, "DialogPage") },
    { id: "alert-dialog", title: l("Alert dialog", "حوار التنبيه"), description: l("Confirm a consequential or destructive action.", "تأكيد إجراء مهم أو هدّام."), Component: from(overlays, "AlertDialogPage") },
    { id: "sheet", title: l("Sheet", "اللوحة الجانبية"), description: l("A panel that slides in from an edge.", "لوحة تنزلق من أحد الحواف."), Component: from(overlays, "SheetPage") },
    { id: "popover", title: l("Popover", "النافذة المنبثقة"), description: l("Rich content anchored to a trigger.", "محتوى غني مثبّت على زر."), Component: from(overlays, "PopoverPage") },
    { id: "dropdown-menu", title: l("Dropdown menu", "القائمة المنسدلة للإجراءات"), description: l("Actions and options in a menu.", "الإجراءات والخيارات في قائمة."), Component: from(overlays, "DropdownPage") },
    { id: "command", title: l("Command", "لوحة الأوامر"), description: l("A searchable list of commands, inline or as a dialog.", "قائمة أوامر قابلة للبحث، مضمّنة أو كحوار."), Component: from(overlays, "CommandPage") },
    { id: "hover-card", title: l("Hover card", "بطاقة التمرير"), description: l("A preview on hover or focus.", "معاينة عند التمرير أو التركيز."), Component: from(merged, "HoverCardPage") },
    { id: "context-menu", title: l("Context menu", "قائمة السياق"), description: l("Actions on right-click.", "إجراءات بالنقر الأيمن."), Component: from(merged, "ContextMenuPage") },
    { id: "menubar", title: l("Menubar", "شريط القوائم"), description: l("A desktop-style row of menus.", "صف قوائم بأسلوب سطح المكتب."), Component: from(merged, "MenubarPage") },
  ] },
  { id: "navigation", title: l("Navigation", "التنقّل"), icon: Compass, pages: [
    { id: "breadcrumb", title: l("Breadcrumb", "مسار التنقل"), description: l("Where this page sits.", "موقع هذه الصفحة."), Component: from(merged, "BreadcrumbsPage") },
    { id: "pagination", title: l("Pagination", "ترقيم الصفحات"), description: l("Page links for server-paged lists.", "روابط الصفحات للقوائم المجزّأة على الخادم."), Component: from(merged, "PaginationPage") },
    { id: "navigation-menu", title: l("Navigation menu", "قائمة التنقّل"), description: l("Site-style top navigation with panels.", "تنقّل علوي بأسلوب المواقع مع لوحات."), Component: from(merged, "NavigationMenuPage") },
  ] },
  { id: "patterns", title: l("Patterns", "الأنماط"), icon: Shapes, pages: [
    { id: "page-header", title: l("Page header", "رأس الصفحة"), description: l("Back, title, details and actions — PageHeader and EditableTitle.", "الرجوع والعنوان والتفاصيل والإجراءات — PageHeader و EditableTitle."), Component: from(merged, "PageHeaderPage") },
    { id: "stepper", title: l("Stepper", "خطوات المعالج"), description: l("Progress through a multi-step flow.", "التقدّم في معالج متعدّد الخطوات."), Component: from(shell, "StepperPage") },
    { id: "app-shell", title: l("App shell", "هيكل التطبيق"), description: l("Sidebar, top bar, app switcher, notifications and mobile navigation in one layout.", "الشريط الجانبي والعلوي ومبدّل التطبيقات والإشعارات والتنقّل على الجوال في تخطيط واحد."), Component: from(shell, "AppShellPage") },
    { id: "shell-parts", title: l("Shell parts", "أجزاء الهيكل"), description: l("The app switcher and the notification panel on their own.", "مبدّل التطبيقات ولوحة الإشعارات منفردين."), Component: from(shell, "ShellPartsPage") },
  ] },
  { id: "frappe", title: l("Frappe layer", "طبقة فرابيه"), icon: Database, pages: [
    { id: "frappe-gallery", title: l("Component gallery", "معرض المكوّنات"), description: l("Every 0.4 Frappe component with its status from the completion matrix and a link to where it runs.", "كل مكوّن فرابيه 0.4 مع حالته من مصفوفة الإكمال ورابط إلى حيث يعمل."), Component: from(frappe, "FrappeGalleryPage") },
    { id: "frappe-list-view", title: l("Frappe list view", "عرض قائمة فرابيه"), description: l("FrappeListView on the simulated ToDo site: search, filters, saved filters, columns, sort, paging, selection, bulk actions, realtime, and the loading / empty / error states.", "FrappeListView على موقع ToDo المحاكى: البحث والتصفية والتصفيات المحفوظة والأعمدة والفرز والتصفّح والتحديد والإجراءات الجماعية والزمن الحقيقي وحالات التحميل والفراغ والخطأ."), Component: from(frappe, "FrappeListViewPage") },
    { id: "frappe-forms", title: l("Frappe forms", "نماذج فرابيه"), description: l("FrappeForm: Contact with child tables, new ToDo, Travel Request with depends_on and Table MultiSelect, submitted memo, save error, loading, permission denied.", "FrappeForm: جهة اتصال مع جداول فرعية، مهمة جديدة، طلب سفر مع depends_on واختيار متعدد، مذكرة معتمدة، خطأ حفظ، تحميل، رفض إذن."), Component: from(frappe, "FrappeFormsPage") },
    { id: "frappe-record", title: l("Record detail", "تفاصيل السجل"), description: l("FrappeStatusIndicator and FrappeTimeline with the comment composer, versions and assignment logs.", "FrappeStatusIndicator و FrappeTimeline مع صندوق التعليق والإصدارات وسجلات الإسناد."), Component: from(frappe, "FrappeRecordPage") },
    { id: "frappe-workflow", title: l("Workflow", "سير العمل"), description: l("FrappeWorkflowActions on the Approval Memo workflow (stepper and compact), plus the generic LifecycleBar and ActionBar.", "FrappeWorkflowActions على سير عمل مذكرة الاعتماد (متتبّع ومضغوط)، مع LifecycleBar و ActionBar العامّين."), Component: from(frappe, "FrappeWorkflowPage") },
    { id: "frappe-assign", title: l("Assignment & comments", "الإسناد والتعليقات"), description: l("FrappeAssignTo through the simulator, the generic AssigneeGroup / AssignPicker, and CommentComposer with mentions.", "FrappeAssignTo عبر المحاكي، و AssigneeGroup / AssignPicker العامّان، و CommentComposer مع الإشارات."), Component: from(frappe, "FrappeAssignPage") },
    { id: "frappe-permissions", title: l("Permissions playground", "ساحة الأذونات"), description: l("A role picker over usePermissions, canImport, canExport and bulkMenu: the rights, a permlevel-1 field's display status, and what the UI hides. Client-side mirror of Desk; the server is the authority.", "منتقي أدوار فوق usePermissions و canImport و canExport و bulkMenu: الحقوق وحالة عرض حقل permlevel 1 وما تخفيه الواجهة. مرآة في العميل لديسك؛ الخادم هو المرجع."), Component: from(frappe, "FrappePermissionsPage") },
    { id: "frappe-import-export", title: l("Import & export", "الاستيراد والتصدير"), description: l("The gated Import entry and Export dialog — pending the list-io merge; nothing is ever downloaded or imported here.", "مدخل الاستيراد المقيّد وحوار التصدير — بانتظار دمج list-io؛ لا يُنزَّل ولا يُستورَد شيء هنا أبداً."), Component: from(frappe, "FrappeImportExportPage") },
    { id: "frappe-rtl", title: l("RTL and LTR", "اليمين واليسار"), description: l("The same list and form in Arabic (right-to-left) and English (left-to-right), side by side, with mixed-direction text.", "القائمة والنموذج نفسهما بالعربية (يمين إلى يسار) والإنجليزية (يسار إلى يمين) جنباً إلى جنب، مع نص مختلط الاتجاه."), Component: from(frappe, "FrappeRtlPage") },
    { id: "frappe-themes", title: l("Light and dark", "الفاتح والداكن"), description: l("List, form and timeline in two themed containers at once.", "القائمة والنموذج والخط الزمني في حاويتَين بسمتَين في آن واحد."), Component: from(frappe, "FrappeThemesPage") },
  ] },
];

export const PAGES = GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g })));

// P35 record — form menu, print, connections, e-mail composer (SIMULATED backend operations)
{
  const p35record = () => import("./pages/p35-record");
  const group = GROUPS.find((g) => g.id === "frappe")!;
  const page: Page = {
    id: "frappe-record-actions",
    title: l("Record actions (P35)", "إجراءات السجل (P35)"),
    description: l("SIMULATED backend operations: the form ⋯ menu (Desk's toolbar rules), form print with a sandboxed server preview, Connections from meta.__dashboard with get_open_count, and the e-mail composer.", "عمليات خلفية محاكاة: قائمة ⋯ للنموذج (قواعد شريط ديسك)، وطباعة النموذج مع معاينة الخادم في إطار معزول، والارتباطات من meta.__dashboard مع get_open_count، ومحرّر البريد."),
    Component: from(p35record, "RecordActionsPage"),
  };
  group.pages.push(page);
  PAGES.push({ ...page, group });
}
