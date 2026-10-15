/**
 * Demo configuration = Sear's real shell configuration (SearStudioLayout.tsx NAV_ITEMS, binaDropdown.js
 * WORKSPACE_SECTIONS, notificationCenterStore.ts seed — baseline 7abc895-dirty), expressed as @solvfast/ui props.
 * Playground only (not published). Assets in ./sear-assets are copies of Sear's.
 */
import {
  BookMarked, Cable, Calendar, CalendarDays, ClipboardList, Clock, GitBranch, LayoutDashboard, ListChecks,
  MessageSquare, Radio, Route as RouteIcon, Split, Timer, Wrench,
} from "lucide-react";
import type { NavItem, NotificationItem, SwitcherSection } from "@ui";
import searLogo from "./sear-assets/sear.png";
import workspaceLogo from "./sear-assets/my-workspace.svg";
import crmIcon from "./sear-assets/sf-crm.png";
import ticketsIcon from "./sear-assets/sf-tickets.png";
import servicesIcon from "./sear-assets/sf-services.png";
import omniIcon from "./sear-assets/sf-omnichannel.png";
import myWorkLogo from "./sear-assets/my-work.svg";
import servefastLogo from "./sear-assets/servefast.png";
import sadaLogo from "./sear-assets/sada.svg";
import rasdLogo from "./sear-assets/rasd.svg";
import saqrBiLogo from "./sear-assets/saqr-bi.png";
import marsadLogo from "./sear-assets/marsad.png";
import mizanLogo from "./sear-assets/mizan.png";
import boslahLogo from "./sear-assets/boslah.png";
import hawkamaLogo from "./sear-assets/hawkama.png";
import experienceLogo from "./sear-assets/experience-center.svg";
import senaiypediaLogo from "./sear-assets/senaiypedia.png";
import senaiyLogo from "./sear-assets/senaiy.svg";
import orgStructureLogo from "./sear-assets/org-structure-icon.png";
import portalLogo from "./sear-assets/customer-icon.png";
import searStudioLogo from "./sear-assets/sear-studio.svg";
import sewarLogo from "./sear-assets/sewar.svg";
import launchfastLogo from "./sear-assets/launchfast-logo.svg";
import dealfastLogo from "./sear-assets/dealfast-logo.svg";
import consultationfastLogo from "./sear-assets/consultationfast-logo.svg";

export const BASE = "/workspace/build/sear_studio";
const p = (s: string) => `${BASE}${s}`;

export const BRAND = { name: "Sayr Studio", logoSrc: searLogo, logoClassName: "w-14 h-14", nameClassName: "text-brand-violet", href: "/workspace" };
export { workspaceLogo };

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", href: p("/overview"), icon: LayoutDashboard, label: { en: "Overview", ar: "نظرة عامة" } },
  { id: "field_library", href: p("/field_library"), icon: ListChecks, label: { en: "Field Library", ar: "مكتبة الحقول" } },
  {
    id: "calendars", href: p("/calendars"), icon: Calendar, label: { en: "Calendars", ar: "التقاويم" },
    children: [
      { id: "working_hours", href: p("/calendars/working_hours"), icon: Clock, label: { en: "Working Hours", ar: "ساعات العمل" } },
      { id: "holidays", href: p("/calendars/holidays"), icon: CalendarDays, label: { en: "Holidays", ar: "العطلات" } },
    ],
  },
  { id: "channels", href: p("/channels"), icon: Radio, label: { en: "Channels", ar: "القنوات" } },
  { id: "connectors", href: p("/connectors"), icon: Cable, label: { en: "Connectors", ar: "الموصّلات" } },
  { id: "message_templates", href: p("/message_templates"), icon: MessageSquare, label: { en: "Notification Templates", ar: "قوالب الإشعارات" } },
  { id: "assignment_profile", href: p("/assignment_profile"), icon: RouteIcon, label: { en: "Assignment Profile", ar: "ملف الإسناد" } },
  { id: "workflow_components", href: p("/workflow_components"), icon: Wrench, label: { en: "Workflows", ar: "سير العمل" } },
  { id: "playbooks", href: p("/playbooks"), icon: BookMarked, label: { en: "Playbooks", ar: "أدلة العمل" } },
  { id: "service_module", href: p("/service_module"), icon: ClipboardList, label: { en: "Surveys", ar: "الاستبيانات" } },
  { id: "sla_policy", href: p("/sla_policy"), icon: Timer, label: { en: "SLA Policies", ar: "سياسات اتفاقية الخدمة" } },
  { id: "life_cycles", href: p("/life_cycles"), icon: GitBranch, label: { en: "Life Cycles", ar: "دورات الحياة" } },
  { id: "routing", href: p("/routing"), icon: Split, label: { en: "Routing", ar: "التوجيه" } },
];

const app = (id: string, name: string, href: string, logoSrc: string) => ({ id, name, href, logoSrc });
export const SWITCHER_SECTIONS: SwitcherSection[] = [
  { title: "My Work", items: [app("my-work", "My Work", "/my_work", myWorkLogo)] },
  {
    title: "Packages",
    groups: [
      { label: "Industry Package", items: [app("servefast", "ServeFast", "/workspace/packages/servefast", servefastLogo)] },
      { label: "Complementary", items: [app("sada", "Sada", "/workspace/packages/sada", sadaLogo), app("rasd", "Rasd", "/workspace/packages/rasd", rasdLogo)] },
    ],
  },
  {
    title: "Strategic Management",
    items: [
      app("saqr-bi", "Saqr BI", "/workspace/knowledge/saqr_bi", saqrBiLogo),
      app("marsad", "Marsad", "/workspace/knowledge/marsad", marsadLogo),
      app("mizan", "Mizan", "/workspace/knowledge/mizan", mizanLogo),
      app("boslah", "Boslah", "/workspace/knowledge/bosla", boslahLogo),
      app("hawkama", "Hawkama", "/workspace/knowledge/hawkama", hawkamaLogo),
    ],
  },
  { title: "Customer Experience", items: [app("experience-center", "Experience Center", "/workspace/knowledge/experience_center", experienceLogo)] },
  { title: "Knowledge Hub", items: [app("senaiypedia", "Senaiy-Pedia", "/workspace/knowledge/senaiypedia", senaiypediaLogo)] },
  { title: "AI Operations", items: [app("senaiy", "Senaiy Agentic System", "/workspace/build/senaiy", senaiyLogo)] },
  {
    title: "Administration",
    items: [
      app("org-structure", "Organization Structure", "/workspace/build/organization_structure", orgStructureLogo),
      app("portal-config", "Customer Portal Configuration", "/workspace/build/customer_portal_configuration", portalLogo),
    ],
  },
  { title: "Build", items: [app("sear-studio", "Sear Studio", "/workspace/build/sear_studio", searStudioLogo), app("sewar", "Sewar App Builder", "/workspace/build/sewar", sewarLogo)] },
  {
    title: "Squad Packages",
    items: [
      app("launchfast", "Product Development Squad", "/workspace/squads/launchfast", launchfastLogo),
      app("consultationfast", "Digital Consultation Squad", "/workspace/squads/consultationfast", consultationfastLogo),
      app("dealfast", "Business Development Squad", "/workspace/squads/dealfast", dealfastLogo),
    ],
  },
];

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const SOURCES = {
  crm: { iconSrc: crmIcon, source: { en: "CRM", ar: "إدارة العملاء" } },
  tickets: { iconSrc: ticketsIcon, source: { en: "Tickets", ar: "التذاكر" } },
  services: { iconSrc: servicesIcon, source: { en: "Services", ar: "الخدمات" } },
  omnichannel: { iconSrc: omniIcon, source: { en: "Omnichannel", ar: "القنوات الموحّدة" } },
};
/** Sear's Rihlat fixture (notificationCenterStore.ts seed()), as NotificationItem[]. */
export function seedNotifications(now = Date.now()): NotificationItem[] {
  const n = (id: string, app: keyof typeof SOURCES, en: string, ar: string, ago: number, read: boolean): NotificationItem =>
    ({ id, ...SOURCES[app], body: { en, ar }, at: now - ago, read });
  return [
    n("n1", "crm", "New lead “Gulf Adventures Co.” was assigned to you.", "تم إسناد العميل المحتمل «Gulf Adventures Co.» إليك.", 12 * MIN, false),
    n("n2", "omnichannel", "A new WhatsApp conversation was opened and is waiting to be picked up.", "تم فتح محادثة واتساب جديدة وهي بانتظار الاستلام.", 48 * MIN, false),
    n("n3", "tickets", "Your request “Booking Change Request” is complete.", "اكتمل طلبك «طلب تغيير حجز».", 3 * HOUR, false),
    n("n4", "services", "New work has been assigned to you: “Visa Processing — KSA”.", "تم إسناد عمل جديد إليك: «معالجة تأشيرة — السعودية».", 6 * HOUR, true),
    n("n5", "crm", "Deal “Red Sea Retreats” has moved to Won.", "انتقلت الصفقة «Red Sea Retreats» إلى مكسوبة.", DAY + 2 * HOUR, false),
    n("n6", "tickets", "A ticket handled by your team moved to On Hold and may need attention.", "انتقلت تذكرة يتولاها فريقك إلى «معلّقة» وقد تحتاج إلى متابعة.", DAY + 5 * HOUR, true),
    n("n7", "omnichannel", "A new public comment was posted on Instagram — review and respond.", "تم نشر تعليق عام جديد على إنستغرام — راجِع وردّ.", 3 * DAY, true),
    n("n8", "services", "Your request “Refund — Unused Ticket” is complete.", "اكتمل طلبك «استرداد — تذكرة غير مستخدمة».", 5 * DAY, true),
  ];
}
