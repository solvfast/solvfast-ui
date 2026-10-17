/** Navigation: groups → pages. Only what the package implements. Pages load per group, on demand. */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { CalendarDays, Component, Layers, PanelLeft, Rocket, Table2, type LucideIcon } from "lucide-react";
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

export const GROUPS: Group[] = [
  { id: "start", title: l("Get started", "البداية"), icon: Rocket, pages: [
    { id: "overview", title: l("Overview", "نظرة عامة"), description: l("What @solvfast/ui is, its entry points, and how to start.", "ما هي ‎@solvfast/ui‎، ونقاط الدخول، وكيف تبدأ."), Component: from(start, "Overview") },
    { id: "theming", title: l("Theme & language", "السمة واللغة"), description: l("ThemeProvider: light and dark, Arabic and English, right-to-left; the colour tokens and type roles.", "‏ThemeProvider: الفاتح والداكن، العربية والإنجليزية، من اليمين إلى اليسار؛ رموز الألوان وأدوار الخطوط."), Component: from(start, "Theming") },
  ] },
  { id: "components", title: l("Components", "المكوّنات"), icon: Component, pages: [
    { id: "button", title: l("Button", "الزر"), description: l("Variants, sizes, states and icon buttons.", "الأنواع والأحجام والحالات وأزرار الأيقونات."), Component: from(components, "Buttons") },
    { id: "badge", title: l("Badge", "الشارة"), description: l("Compact status, category and count labels.", "تسميات مختصرة للحالة والفئة والعدد."), Component: from(components, "Badges") },
    { id: "card", title: l("Card", "البطاقة"), description: l("The glass container: header, content and footer.", "الحاوية الزجاجية: الرأس والمحتوى والتذييل."), Component: from(components, "Cards") },
    { id: "fields", title: l("Text fields", "حقول النص"), description: l("Input, Textarea and Label, with labels, hints and the disabled state.", "حقل الإدخال ومنطقة النص والتسمية، مع التسميات والتلميحات وحالة التعطيل."), Component: from(components, "Fields") },
    { id: "choices", title: l("Checkbox & Switch", "مربع الاختيار والمفتاح"), description: l("Binary choices.", "الخيارات الثنائية."), Component: from(components, "Choices") },
    { id: "select", title: l("Select", "القائمة المنسدلة"), description: l("Pick one value from a list, with groups.", "اختيار قيمة واحدة من قائمة، مع مجموعات."), Component: from(components, "SelectPage") },
    { id: "tabs", title: l("Tabs", "علامات التبويب"), description: l("Switch between views of the same context.", "التنقّل بين عروض السياق نفسه."), Component: from(components, "TabsPage") },
    { id: "avatar", title: l("Avatar", "الصورة الرمزية"), description: l("A person's image with an initials fallback.", "صورة الشخص مع الأحرف الأولى بديلاً."), Component: from(components, "AvatarPage") },
    { id: "feedback", title: l("Skeleton & Separator", "الهيكل والفاصل"), description: l("Loading placeholders and dividers.", "عناصر نائبة أثناء التحميل وفواصل."), Component: from(components, "SkeletonSeparator") },
    { id: "scroll-area", title: l("Scroll area", "منطقة التمرير"), description: l("A scroll container with a styled scrollbar.", "حاوية تمرير بشريط تمرير منسّق."), Component: from(components, "ScrollAreaPage") },
    { id: "tooltip", title: l("Tooltip", "التلميح"), description: l("A short label for an icon or truncated control.", "تسمية قصيرة لأيقونة أو عنصر مقتطع."), Component: from(components, "TooltipPage") },
  ] },
  { id: "overlays", title: l("Overlays", "الطبقات"), icon: Layers, pages: [
    { id: "dialog", title: l("Dialog", "مربع الحوار"), description: l("A focused task on top of the page.", "مهمة مركّزة فوق الصفحة."), Component: from(overlays, "DialogPage") },
    { id: "alert-dialog", title: l("Alert dialog", "حوار التنبيه"), description: l("Confirm a consequential or destructive action.", "تأكيد إجراء مهم أو هدّام."), Component: from(overlays, "AlertDialogPage") },
    { id: "sheet", title: l("Sheet", "اللوحة الجانبية"), description: l("A panel that slides in from an edge.", "لوحة تنزلق من أحد الحواف."), Component: from(overlays, "SheetPage") },
    { id: "popover", title: l("Popover", "النافذة المنبثقة"), description: l("Rich content anchored to a trigger.", "محتوى غني مثبّت على زر."), Component: from(overlays, "PopoverPage") },
    { id: "dropdown-menu", title: l("Dropdown menu", "القائمة المنسدلة للإجراءات"), description: l("Actions and options in a menu.", "الإجراءات والخيارات في قائمة."), Component: from(overlays, "DropdownPage") },
    { id: "command", title: l("Command", "لوحة الأوامر"), description: l("A searchable list of commands, inline or as a dialog.", "قائمة أوامر قابلة للبحث، مضمّنة أو كحوار."), Component: from(overlays, "CommandPage") },
  ] },
  { id: "datetime", title: l("Date & time", "التاريخ والوقت"), icon: CalendarDays, pages: [
    { id: "calendar", title: l("Calendar", "التقويم"), description: l("Single dates and ranges, in both directions.", "تاريخ واحد أو نطاق، في الاتجاهين."), Component: from(datetime, "CalendarPage") },
    { id: "date-time-fields", title: l("Date & time fields", "حقول التاريخ والوقت"), description: l("DateField, TimeField and DateTimeField: glass pickers instead of native inputs.", "‏DateField و TimeField و DateTimeField: منتقيات زجاجية بدل الحقول الأصلية."), Component: from(datetime, "DateTimePage") },
  ] },
  { id: "data", title: l("Data", "البيانات"), icon: Table2, pages: [
    { id: "list-view", title: l("List View", "عرض القائمة"), description: l("Search, saved filters, advanced filter, column manager, sorting and paging — Sear's data grid.", "البحث والتصفيات المحفوظة والتصفية المتقدّمة وإدارة الأعمدة والفرز والتصفّح — شبكة بيانات سير."), Component: from(data, "ListViewPage") },
    { id: "list-features", title: l("List View features", "ميزات عرض القائمة"), description: l("Selection and bulk actions, group-by, sort menu, quick filters, row actions and row styles — all opt-in.", "التحديد والإجراءات الجماعية والتجميع وقائمة الفرز والتصفية السريعة وإجراءات الصفوف وتنسيقها — كلها اختيارية."), Component: from(data, "ListFeaturesPage") },
    { id: "list-states", title: l("List View states", "حالات عرض القائمة"), description: l("Loading, empty and error.", "التحميل والفراغ والخطأ."), Component: from(data, "ListStatesPage") },
    { id: "filters", title: l("Filters", "التصفية"), description: l("The filter builder on its own, and the filter model behind it.", "منشئ التصفية وحده، ونموذج التصفية خلفه."), Component: from(data, "FiltersPage") },
    { id: "frappe-list", title: l("Frappe List View", "عرض قائمة فرابيه"), description: l("FrappeListView on a simulated Frappe site (no network).", "‏FrappeListView على موقع فرابيه محاكى (دون شبكة)."), Component: from(data, "FrappePage") },
  ] },
  { id: "shell", title: l("App shell", "هيكل التطبيق"), icon: PanelLeft, pages: [
    { id: "app-shell", title: l("App shell", "هيكل التطبيق"), description: l("Sidebar, top bar, app switcher, notifications and mobile navigation in one layout.", "الشريط الجانبي والعلوي ومبدّل التطبيقات والإشعارات والتنقّل على الجوال في تخطيط واحد."), Component: from(shell, "AppShellPage") },
    { id: "shell-parts", title: l("Shell parts", "أجزاء الهيكل"), description: l("The app switcher and the notification panel on their own.", "مبدّل التطبيقات ولوحة الإشعارات منفردين."), Component: from(shell, "ShellPartsPage") },
  ] },
];

export const PAGES = GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g })));
