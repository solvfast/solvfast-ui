import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/**
 * Fallback shown while a lazily-loaded studio page chunk downloads.
 *
 * Uses the DS list-skeleton shape rather than a bare spinner: the DS rule is
 * "skeletons over spinners" for content that is still arriving, and its a11y
 * requirement is "Skeleton/spinner + aria-busy + status text; never animation alone".
 * Matching the final layout also avoids the shift a centred spinner causes.
 */
const StudioFallback = () => {
  const { lang } = useLanguage();
  const isRTL = lang === 'ar';
  return (
    <div className="h-full w-full px-6 md:px-8 pb-6 pt-5" aria-busy="true" role="status">
      <span className="sr-only">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</span>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-28" /></div>
      </div>
      <div className="mt-4 rounded-xl border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
};
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster as RadixToaster } from '@/components/ui/toaster';
import {
  Layers, GitBranch, Timer, Route as RouteIcon, ClipboardList, Wrench,
  Calendar, Cable, ListChecks, Clock, CalendarDays, Radio, MessageSquare, BookMarked, Split,
  LayoutDashboard,
} from 'lucide-react';

// ServeFast contexts (Theme is intentionally NOT mounted — this app owns `dark`).
import { AuthProvider } from '@sear/contexts/AuthContext';
import { FeatureFlagsProvider } from '@sear/contexts/FeatureFlagsContext';
import { SenaiyChatProvider } from '@sear/contexts/SenaiyChatContext';
import SenaiyChat, { FloatingSenaiyButton } from '@sear/components/ai-management/SenaiyChat';
import ErrorBoundary from '@sear/components/ErrorBoundary';

import { SEAR_STUDIO_BASE } from '@sear/lib/searStudioBase';

// This app's own providers
import { useLanguage } from '../shared/i18n/LanguageProvider';

// Shared shell used by BOTH Sayr Studio and the Knowledge Hub apps.
import { StudioShell, NavItem } from './StudioShell';
import searStudioLogo from '../assets/applogos/apps/sear.png';

// Seed ServeFast's AuthContext so its module-level auth gates pass. AuthProvider
// reads this on first render, so set it before any provider mounts.
try { localStorage.setItem('auth', 'true'); } catch { /* ignore */ }
// Seed FeatureFlags ON for the ported modules (defaults are already all-on).

// The Sayr Studio modules, in order.
// Nav order (user-defined): Overview → Field Library → Calendars → Channels → Connectors →
// Notification Templates → Assignment Profile → Workflows → Playbooks → Surveys →
// SLA Policies → Life Cycles → Routing.
export const NAV_ITEMS: NavItem[] = [
  { to: '/overview',            icon: LayoutDashboard, en: 'Overview',       ar: 'نظرة عامة' },
  { to: '/field_library',       icon: ListChecks, en: 'Field Library',      ar: 'مكتبة الحقول' },
  {
    to: '/calendars', icon: Calendar, en: 'Calendars', ar: 'التقاويم',
    children: [
      { to: '/calendars/working_hours', icon: Clock,        en: 'Working Hours', ar: 'ساعات العمل' },
      { to: '/calendars/holidays',      icon: CalendarDays, en: 'Holidays',      ar: 'العطلات' },
    ],
  },
  { to: '/channels',            icon: Radio,     en: 'Channels',            ar: 'القنوات' },
  { to: '/connectors',          icon: Cable,     en: 'Connectors',          ar: 'الموصّلات' },
  { to: '/message_templates',   icon: MessageSquare, en: 'Notification Templates', ar: 'قوالب الإشعارات' },
  { to: '/assignment_profile',  icon: RouteIcon, en: 'Assignment Profile',  ar: 'ملف الإسناد' },
  { to: '/workflow_components', icon: Wrench,    en: 'Workflows',           ar: 'سير العمل' },
  { to: '/playbooks',           icon: BookMarked, en: 'Playbooks',          ar: 'أدلة العمل' },
  { to: '/service_module',      icon: ClipboardList, en: 'Surveys',          ar: 'الاستبيانات' },
  { to: '/sla_policy',          icon: Timer,     en: 'SLA Policies',        ar: 'سياسات اتفاقية الخدمة' },
  { to: '/life_cycles',         icon: GitBranch, en: 'Life Cycles',         ar: 'دورات الحياة' },
  { to: '/routing',             icon: Split,      en: 'Routing',            ar: 'التوجيه' },
];

// Routes that render full-screen (no sidebar/topbar) — the visual "palettes".
// Mirrors ServeFast, where the Lifecycle Designer and Workflow Builder are
// top-level routes outside the app layout.
const FULLSCREEN_PATTERNS = [
  /\/life_cycles\/[^/]+$/,                       // Lifecycle Designer
  /\/workflow_components\/[^/]+\/[^/]+\/build$/, // Workflow Builder canvas
  /\/routing\/[^/]+$/,                           // Decision Tree editor
  /\/playbooks\/[^/]+(\/editor)?$/,              // Playbook editor (new + existing) — full-screen palette
];

const Shell: React.FC = () => {
  const { lang } = useLanguage();
  const { pathname } = useLocation();
  const isRTL = lang === 'ar';
  const isFullscreen = FULLSCREEN_PATTERNS.some(rx => rx.test(pathname));

  if (isFullscreen) {
    return (
      <div className="sear-studio h-dvh w-full overflow-hidden bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
        <ErrorBoundary><Suspense fallback={<StudioFallback />}><Outlet /></Suspense></ErrorBoundary>
      </div>
    );
  }

  return (
    <StudioShell
      brandLabel="Sayr Studio"
      brandIcon={Layers}
      brandLogoSrc={searStudioLogo}
      brandLogoClassName="w-14 h-14"
      brandLabelClassName="text-brand-violet"
      navItems={NAV_ITEMS}
      basePath={SEAR_STUDIO_BASE}
      currentAppName="Sayr Studio"
    >
      <ErrorBoundary><Suspense fallback={<StudioFallback />}><Outlet /></Suspense></ErrorBoundary>
    </StudioShell>
  );
};

// Global Senaiy Assistant chrome for Sayr Studio: the chat panel (opens on any
// page's openChat() — e.g. Connectors' "Request Connector") + the floating
// launcher. Launcher hidden on the fullscreen workflow builder, which has its
// own inline "Build with Senaiy" entry point.
const SenaiyChrome: React.FC = () => {
  const { pathname } = useLocation();
  const onBuilder = /\/workflow_components\/[^/]+\/[^/]+\/build\/?$/.test(pathname);
  return (
    <div className="sear-studio">
      <SenaiyChat />
      {!onBuilder && <FloatingSenaiyButton />}
    </div>
  );
};

// Direction/language/theme come from the app-level AppProvider (main.tsx), and the
// QueryClient is the shared one from @/lib/queryClient — this layout no longer creates
// a second, shadowing client.
export default function SearStudioLayout() {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <SenaiyChatProvider>
          <ReactFlowProvider>
            <Shell />
            <SenaiyChrome />
            <Toaster position="top-center" richColors />
            <div className="sear-studio"><RadixToaster /></div>
          </ReactFlowProvider>
        </SenaiyChatProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}
